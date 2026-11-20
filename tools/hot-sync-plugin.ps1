# hot-sync-plugin.ps1 — 把仓库插件改动热同步进 DSH profile 安装副本，供活体 GUI 验收。
#
# 为什么需要（2026-11-20 踩实）：
#   - 运行中的 host 加载的是 ~/.dsh/profiles/<profile>/node_modules/@matrixfu/skill-set-manager/
#     下的 **npm 快照拷贝**（非 link）。改仓库文件对活体无效，必须先同步到这里。
#   - plugin_manager 禁用→启用会触发 host **重新 import** 插件；重导入路径按「包内嵌套
#     node_modules」解析裸依赖（schemastery/cosmokit/dsh-typert-protocol/zod/cordis），
#     而 npm 扁平安装不产生这层 → 直接禁用/启用会 ENOENT。本脚本负责补齐这层 junction：
#       包内 node_modules\@deepseek-ai\{schemastery,cosmokit,dsh-typert-protocol,cordis}
#       前三个 junction 到 profile 根 node_modules；cordis 只在 app.asar 里，
#       用 C:\AI\DSH_Hooks\tools\asar-extract.mjs 提取 package.json+lib/index.js 到
#       tmp\cordis-pkg（本脚本自动做），再 junction 过去。
#   - 同步后必须走 plugin_manager（或 CLI）禁用→启用，client bundle 才会以新 rev 重发；
#     浏览器侧再硬刷新。首次登录 dsh web 若 401：启动 token 是进程一次性，用
#     ~/.dsh/.credentials.yaml 的 client-connection/browser-session secret 铸 HMAC cookie。
#
# 用法（沙箱外/完整权限 pwsh）：
#   pwsh -File tools/hot-sync-plugin.ps1            # 同步 + 补 junction
#   pwsh -File tools/hot-sync-plugin.ps1 -Verify    # 只校验（比对安装副本与仓库字节一致）
param(
  [switch]$Verify,
  [string]$Profile = "desktop"
)
$ErrorActionPreference = "Stop"
$repo    = (Resolve-Path (Join-Path $PSScriptRoot "..\plugin\skill-set-manager")).Path
$profDir = if ($env:DSH_PROFILE_DIR) { $env:DSH_PROFILE_DIR } else { Join-Path $env:USERPROFILE ".dsh\profiles\$Profile" }
$dst     = Join-Path $profDir "node_modules\@matrixfu\skill-set-manager"
$rootNm  = Join-Path $profDir "node_modules"
$cordisPkg = Join-Path $PSScriptRoot "..\tmp\cordis-pkg"
$asar    = Join-Path $env:LOCALAPPDATA "Programs\DeepSeek Harness\resources\app.asar"

if (-not (Test-Path $dst)) { throw "安装副本不存在: $dst" }

$files = @("client.js", "index.js", "package.json", "cordis.patch.yml", "icon.svg")
$dirs  = @("lib", "locale")

function Same-File($a, $b) {
  if (-not (Test-Path $b)) { return $false }
  (Get-FileHash $a -Algorithm SHA256).Hash -eq (Get-FileHash $b -Algorithm SHA256).Hash
}

if ($Verify) {
  $bad = @()
  foreach ($f in $files) { if (-not (Same-File (Join-Path $repo $f) (Join-Path $dst $f))) { $bad += $f } }
  foreach ($d in $dirs) {
    Get-ChildItem (Join-Path $repo $d) -Recurse -File | ForEach-Object {
      $rel = $_.FullName.Substring($repo.Length + 1)
      if (-not (Same-File $_.FullName (Join-Path $dst $rel))) { $bad += $rel }
    }
  }
  if ($bad.Count) { "VERIFY: 安装副本落后于仓库 ->`n  " + ($bad -join "`n  "); exit 1 }
  "VERIFY: 安装副本与仓库一致（记得：改动后需 plugin_manager 禁用→启用 + 浏览器硬刷新才生效）"
  exit 0
}

# 1) 同步文件（robocopy /MIR 会删包内 junction，故只逐件拷）
foreach ($f in $files) { Copy-Item (Join-Path $repo $f) (Join-Path $dst $f) -Force }
foreach ($d in $dirs)  { Copy-Item (Join-Path $repo $d) (Join-Path $dst "") -Recurse -Force }
"SYNC: 已拷贝 $($files.Count) 个文件 + $($dirs -join '/') 进安装副本"

# 2) 补包内嵌套 junction（重导入解析所需）
$nested = Join-Path $dst "node_modules\@deepseek-ai"
foreach ($d in @("schemastery", "cosmokit", "dsh-typert-protocol")) {
  $link = Join-Path $nested $d
  if (-not (Test-Path $link)) {
    New-Item -ItemType Directory -Path $nested -Force | Out-Null
    New-Item -ItemType Junction -Path $link -Target (Join-Path $rootNm "@deepseek-ai\$d") | Out-Null
    "JUNCTION: @deepseek-ai\$d -> profile 根 node_modules"
  }
}
$cordisLink = Join-Path $nested "cordis"
if (-not (Test-Path (Join-Path $cordisLink "lib\index.js"))) {
  if (-not (Test-Path (Join-Path $cordisPkg "lib\index.js"))) {
    New-Item -ItemType Directory -Path (Join-Path $cordisPkg "lib") -Force | Out-Null
    node "C:\AI\DSH_Hooks\tools\asar-extract.mjs" $asar "dsh/node_modules/@deepseek-ai/cordis/package.json" (Join-Path $cordisPkg "package.json") | Out-Null
    node "C:\AI\DSH_Hooks\tools\asar-extract.mjs" $asar "dsh/node_modules/@deepseek-ai/cordis/lib/index.js"  (Join-Path $cordisPkg "lib\index.js")  | Out-Null
    "CORDIS: 已从 app.asar 提取快照 -> $cordisPkg"
  }
  # cordis 快照自身的依赖（cosmokit 等）经其 node_modules junction 上溯到 profile 根
  if (-not (Test-Path (Join-Path $cordisPkg "node_modules"))) {
    New-Item -ItemType Junction -Path (Join-Path $cordisPkg "node_modules") -Target $rootNm | Out-Null
  }
  if (Test-Path $cordisLink) { Remove-Item $cordisLink -Force }
  New-Item -ItemType Junction -Path $cordisLink -Target $cordisPkg | Out-Null
  "JUNCTION: @deepseek-ai\cordis -> asar 提取快照"
}

# 3) 自检：字节一致
& $PSCommandPath -Verify -Profile $Profile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
"NEXT: plugin_manager set_bundle @matrixfu/skill-set-manager enabled=false → true，然后浏览器硬刷新"
