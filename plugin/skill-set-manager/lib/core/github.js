/**
 * GitHub 稀疏安装（§8.3）：格式 = owner/repo[@ref][/subpath]（仿 dsh-skills-marketplace
 * 「仓库+分支+稀疏路径」，实现格式自定、不依赖其代码）；detached commit SHA 记录进
 * manifest。git 一律注入（测试 file:// 夹具免网络；缺失/网络错归一为业务错上抛）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { writeSkillManifest, rootSkillName } from './manifest.js';
import { gitFailMessage } from './giterr.js';
import { classifyAttempt } from './gitnet.js';

/** 来源解析与归一在叶子模块 source.js（github 与 manifest 共用，避免 ESM 环）；此处转发保持既有 import 不变。 */
export { parseRepoSpec, normalizeRepoSource } from './source.js';

/**
 * 异步 git 子进程（2026-11-19 异步化，用户报：批量检查更新在飞的几分钟里整机冻结——
 * spawnSync 把 host 事件循环占满整段 git，新建对话/刷 Git 状态全部排队等它）。
 * timeoutMs 超时 kill，结论归一 `spawn git ETIMEDOUT`（gitnet 可重试口径）；kill 后
 * 存活的孙进程仍归 sweepGitOrphans 口径管。resolve 与注入 git 夹具同形
 * {status,stdout,stderr}，调用方只多一个 await。
 */
function spawnGit(args, cwd, timeoutMs, onChild) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r) => { if (!settled) { settled = true; resolve(r); } };
    let child;
    try { child = spawn('git', args, { cwd, windowsHide: true }); }
    catch (e) { return finish({ status: 'spawn', stdout: '', stderr: String(e?.message ?? e) }); }
    // onChild（取消长任务 2026-11-20）：host 收句柄用于当场 kill；钩子抛错不得影响 git 本身
    if (onChild) { try { onChild(child); } catch {} }
    let stdout = ''; let stderr = '';
    child.stdout?.setEncoding('utf8'); child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (c) => { stdout += c; });
    child.stderr?.on('data', (c) => { stderr += c; });
    const timer = timeoutMs > 0 ? setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      finish({ status: 'spawn', stdout, stderr: `${stderr ? stderr + '\n' : ''}spawn git ETIMEDOUT` });
    }, timeoutMs) : null;
    timer?.unref?.();
    child.on('error', (e) => { if (timer) clearTimeout(timer); finish({ status: 'spawn', stdout: '', stderr: String(e?.message ?? e) }); });
    child.on('close', (code) => { if (timer) clearTimeout(timer); finish({ status: code ?? 'killed', stdout, stderr }); });
  });
}

/**
 * 带硬超时的默认 git 工厂（2026-11-17 加固；2026-11-19 异步化，见 spawnGit 注释——
 * **不得回退 spawnSync**，它会占满 host 事件循环整段 git 时长）。注入 git 的调用方
 * （verify 夹具）自理超时；updates.js 的 ls-remote 也复用本工厂。
 */
export function makeGit(timeoutMs, opts = {}) {
  return (args, cwd) => spawnGit(args, cwd, timeoutMs || 0, opts.onChild);
}

/** 上游缓存底（GLOSSARY「上游缓存」）：owner/repo(+ref) 哈希定键；同仓不同 ref 不串底。 */
export function cacheDirFor(roots, spec) {
  const key = `${spec.owner}/${spec.repo}@${spec.ref || ''}`;
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 8);
  return path.join(roots.cacheDir, `${spec.owner}-${spec.repo}-${hash}`);
}

/** 目录树整拷（无 manifest 语义；T3 备份/恢复复用）。 */
export function copyDirTree(src, dst, fsImpl = fs) {
  fsImpl.mkdirSync(dst, { recursive: true });
  for (const ent of fsImpl.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDirTree(s, d, fsImpl);
    else if (ent.isFile()) fsImpl.writeFileSync(d, fsImpl.readFileSync(s));
  }
}

/** 检出根 → 库条目（根即技能的单技能仓库）：逐顶层条目拷，唯独跳过 `.git` 对象库——
 *  技能本体里的点文件（.github/.gitignore…）照拷，与「一层子目录」路径口径一致。 */
function copyRepoRoot(src, dst, fsImpl = fs) {
  fsImpl.mkdirSync(dst, { recursive: true });
  for (const ent of fsImpl.readdirSync(src, { withFileTypes: true })) {
    if (ent.name === '.git') continue;
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDirTree(s, d, fsImpl);
    else if (ent.isFile()) fsImpl.writeFileSync(d, fsImpl.readFileSync(s));
  }
}

/**
 * 稀疏拉取（2026-11-17 加固版）：在 `dir`（可持久缓存底）上 init（缺底时）+ remote add +
 * fetch --depth 1 --filter=blob:none origin <ref|HEAD> + sparse-checkout（有 subpath 时）+
 * checkout -q -f --detach FETCH_HEAD。返回 {commit, skillsDir}。
 * - 已有 `.git` 底 → 不 init/不 remote add，只 `remote set-url` 对齐后增量 fetch
 *   （GLOSSARY「上游缓存」：每次仍真 fetch 最新，缓存只是传输层复用）。
 * - `checkout -f`：上次超时被 kill 留下的脏 worktree 下次自愈。
 * - fetch 步骤：网络类失败（gitnet 分类）自动重试一次，每次失败进 failLog；真因不重试。
 * - `timeoutMs` 走 makeGit 硬超时（代理半死不吊死）；注入 git 的夹具自理。
 */
/** 清 git 尸（活体实测 2026-11-17）：spawnSync 超时 kill 只杀 git.exe，孙进程 git-remote-https
 *  存活且继承持锁句柄（index.lock 删不掉 EPERM、半尸目录删不掉），实测可挂 20+ 分钟，
 *  期间该缓存仓每次检查秒红。长任务单飞口径（GLOSSARY「长任务」全局只允许一个）下，
 *  撞到这个状态时清掉所有 git* 进程是正当修法：git.exe 是瞬态工具，编辑器/终端的 git 会被
 *  自动重试，代价远小于「缓存仓永红且重试不自愈」。POSIX 下 kill 自带进程组语义，不清。 */
function sweepGitOrphans() {
  if (process.platform !== 'win32') return;
  const cmd = "Get-Process git,git-remote-https -ErrorAction SilentlyContinue | Stop-Process -Force";
  for (const shell of ['pwsh', 'powershell']) { // 终审 St6：PS7 缺失回落 Windows PowerShell，不再静默 no-op
    try {
      const r = spawnSync(shell, ['-NoProfile', '-NonInteractive', '-Command', cmd], { timeout: 8000, windowsHide: true, encoding: 'utf8' });
      if (!r?.error) break; // 起得来（不论退出码）；只有 shell 本身 ENOENT 才换下一个
    } catch {}
  }
}

export async function fetchRepo(spec, { dir, git, url, timeoutMs, failLog, sweepOrphans = sweepGitOrphans } = {}) {
  const repoUrl = url ?? `https://github.com/${spec.owner}/${spec.repo}.git`;
  const runner = git ?? makeGit(timeoutMs);
  const run = async (args) => {
    let r;
    // 强制 LF：autocrlf 机器上检出 CRLF 会使逐文件哈希随行尾漂移（manifest 不可移植）。
    try { r = await runner(['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', ...args], dir); }
    catch (e) { throw new Error(`git ${args[0]} failed: ${e?.message ?? e}`); }
    if (!r || r.status !== 0) throw new Error(gitFailMessage(args, r));
    return r;
  };
  // 半尸自愈（活体实测 2026-11-17：git init 被硬超时 kill 留下无 HEAD 的空 .git，
  // existsSync(.git) 为真会跳过 init，此后 remote set-url 秒报 not a git repository 永红）：
  // `.git/HEAD` 是 init 成功落盘的验收件，缺了即半尸——缓存底归我们所有，整目录推倒重建。
  if (fs.existsSync(path.join(dir, '.git')) && !fs.existsSync(path.join(dir, '.git', 'HEAD'))) {
    try { fs.rmSync(dir, { recursive: true, force: true }); }
    catch { sweepOrphans(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
  }
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(path.join(dir, '.git'))) {
    try { await run(['remote', 'set-url', 'origin', repoUrl]); } // url 覆盖夹具/换 remote 都对齐
    catch (e) { // 终审 St5：init 成功但 remote add 被超时 kill（HEAD 在、origin 缺）→
      // set-url 报 No such remote（非可重试），回落 add，绝不落「该缓存仓永红」
      if (!/No such remote/i.test(String(e?.message ?? e))) throw e;
      await run(['remote', 'add', 'origin', repoUrl]);
    }
  } else {
    await run(['init', '-q']);
    await run(['remote', 'add', 'origin', repoUrl]);
  }
  // partial clone（用户报告 2026-10-26：大仓库检查更新报「invalid index-pack output」）：
  // 整仓 depth-1 也要把**全部 blob** 压成一个 pack（diagram-design 那种带素材的仓库最容易炸），
  // 改 --filter=blob:none 只取树对象，blob 交给下面的 sparse-checkout 按需拉。
  // 只有「服务器/老 git 不认 filter」才退回全量拉法；真因（仓库不存在）不重试——
  // 慢网络下重试等于把等待翻倍（verify 有「非 filter 失败只拉一次」断言）；
  // 网络类（RPC failed/超时等，gitnet 口径）重试一次，失败各进 failLog。
  const attemptFetch = async (filtered) => {
    const bare = ['fetch', '--depth', '1', ...(filtered ? ['--filter=blob:none'] : []), 'origin', spec.ref || 'HEAD'];
    const fetchArgs = ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', ...bare];
    for (let attempt = 1; attempt <= 2; attempt++) {
      const t0 = Date.now();
      let r;
      try { r = await runner(fetchArgs, dir); }
      catch (e) { r = { status: 'spawn', stdout: '', stderr: String(e?.message ?? e) }; }
      const v = classifyAttempt({ cmd: 'fetch', args: bare, r, t0, failLog, attempt }); // head 用裸 args：-c 前缀不进结论（gitFailMessage 口径=命令名）
      if (v.ok) return;
      if (!v.retry) {
        const err = new Error(v.msg);
        err.filterUnrecognized = /filter/i.test(v.msg); // 调用方据此决定退不退全量
        throw err;
      }
    }
  };
  try { await attemptFetch(true); }
  catch (e) { if (!e?.filterUnrecognized) throw e; await attemptFetch(false); }
  // sparse-checkout/checkout 层同样走「网络类重试一次 + 留痕」（Review Focus #2）：
  // blob:none 的 blob 下载发生在 checkout 时，大素材仓库（hyperframes）吊死在这层，
  // 与 fetch 层同款形状；两步皆幂等（set 可重入、detach -f 可重来），重试安全。
  // 陈旧锁自愈每次 attempt 前都清（活体实测 2026-11-17：60s kill checkout 留 index.lock 尸，
  // checkout -f 对它无解——只在开头清一次，重试必撞尸秒败，重试形同虚设）；
  // 长任务单飞口径（GLOSSARY「长任务」全局只允许一个）保证此刻必无活 git 在动这底，撞锁必是尸。
  const runLogged = async (cmd, args) => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try { fs.rmSync(path.join(dir, '.git', 'index.lock'), { force: true }); }
      catch { sweepOrphans(); try { fs.rmSync(path.join(dir, '.git', 'index.lock'), { force: true }); } catch {} }
      const t0 = Date.now();
      let r;
      try { r = await runner(['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', ...args], dir); }
      catch (e) { r = { status: 'spawn', stdout: '', stderr: String(e?.message ?? e) }; }
      const v = classifyAttempt({ cmd, args, r, t0, failLog, attempt }); // head 用裸 args（-c 前缀不进结论）
      if (v.ok) return r;
      if (!v.retry) {
        // 锁清不掉 = 孤儿 git-remote-https 继承了持锁句柄（活体实测 2026-11-17：spawnSync
        // 超时 kill 只杀 git.exe，孙进程 remote-https 存活且继承 index.lock 句柄，rmSync 吃 EPERM）：
        // 孤儿自己死掉后「重试失败仓库」就能过——给人话指路，别让人去翻 .git。
        if (/index\.lock/.test(v.msg)) throw new Error(`${v.msg} ——锁被上次超时的残留进程占着，稍后用「重试失败仓库」再试`);
        throw new Error(v.msg);
      }
    }
  };
  if (spec.subpath) await runLogged('sparse-checkout', ['sparse-checkout', 'set', '--', spec.subpath]);
  await runLogged('checkout', ['checkout', '-q', '-f', '--detach', 'FETCH_HEAD']);
  const commit = (await run(['rev-parse', 'FETCH_HEAD'])).stdout.trim();
  return { commit, skillsDir: path.join(dir, ...(spec.subpath ? spec.subpath.split('/') : [])) };
}

/**
 * 装入技能库：一层扫描含 SKILL.md 的目录（嵌套不追）；no-clobber——库同名默认跳过
 * （reason:'exists'），overwrite 必须先 backup(name) 再替换（ADR-0003 / Review Focus #2）。
 * 每个成功项写 manifest（source/commit）。
 * 一层候选为空时回退认「检出根即技能」的单技能仓库（SKILL.md 在检出根，库名 = frontmatter name，
 * 见 rootSkillName）；两种空手都报业务错——技能在子目录 → 指路稀疏路径，根 SKILL.md 无合法 name →
 * 指路 frontmatter，绝不静默返回空结果（UI 会显示「安装完成」而库里没装）。
 */
export async function installSkills(roots, { source, commit, skillsDir, names = null, overwrite = false, backup, fs: fsImpl = fs } = {}) {
  const out = [];
  const seen = new Set(); // names 里上游不存在的名字必须报 not-found，不得静默吞（review n2）
  let entries;
  try { entries = fsImpl.readdirSync(skillsDir, { withFileTypes: true }); }
  catch { throw new Error(`技能目录不存在: ${skillsDir}`); }
  /** 落一个技能：no-clobber / overwrite 先备份再替换 / 整树拷 / 写 manifest（source+commit）。 */
  const place = async (name, src, copy = copyDirTree) => {
    const dst = path.join(roots.libraryRoot, name);
    let exists = false;
    try { fsImpl.statSync(dst); exists = true; } catch {}
    if (exists && !overwrite) { out.push({ name, ok: false, reason: 'exists' }); return; }
    if (exists && overwrite) {
      if (backup) await backup(name);
      fsImpl.rmSync(dst, { recursive: true, force: true });
    }
    copy(src, dst, fsImpl);
    writeSkillManifest(dst, { source, commit, fs: fsImpl });
    out.push({ name, ok: true });
  };
  for (const ent of entries) {
    if (ent.name.startsWith('.') || !ent.isDirectory()) continue;
    const name = ent.name;
    if (names && !names.includes(name)) continue;
    const src = path.join(skillsDir, name);
    try { fsImpl.statSync(path.join(src, 'SKILL.md')); } catch { continue; }
    seen.add(name);
    await place(name, src);
  }
  // 检出根即技能（单技能仓库：SKILL.md 直接在检出根，没有「一层目录 = 一个技能」那层）。
  // 用户报告 2026-10-30：Moessif/code-video-showcase 粘仓库根 → 一层扫描（assets/ references/
  // templates/ 都不含 SKILL.md）空手 → 库里什么都没装、检查更新也定位不到上游。只在候选为空时
  // 下探检出根自身；库名 = frontmatter name（rootSkillName 口径，与 updates.js 定位上游同一条规则），
  // 无合法 name 一律报真因、不猜仓库名。检出根的 .git 对象库不跟进库（copyRepoRoot）。
  if (out.length === 0) {
    const rootName = rootSkillName(skillsDir, { fs: fsImpl });
    let rootHasSkillMd = false;
    try { fsImpl.statSync(path.join(skillsDir, 'SKILL.md')); rootHasSkillMd = true; } catch {}
    if (!names && rootHasSkillMd && !rootName)
      throw new Error(`检出根含 SKILL.md 但 frontmatter 无合法 kebab-case name：${skillsDir}——请在 SKILL.md 写明 name（库条目名与更新认领都以它为准）`);
    if (rootName && (!names || names.includes(rootName))) {
      seen.add(rootName);
      await place(rootName, skillsDir, copyRepoRoot);
    }
  }
  if (names) for (const n of names) if (!seen.has(n)) out.push({ name: n, ok: false, reason: 'not-found' });
  // 0 个可安装技能 ≠ 成功（用户报告 2026-10-30：粘贴仓库根而技能在 skills/ 子目录，一层扫描空手
  // → results=[] → 任务照常 ok，UI 显示「安装完成」但库里什么都没装）。names 为空时空扫描 = 来源
  // 与「目录名即技能名」口径差一层，必须报业务错并指路稀疏路径，不得静默当成功。
  if (!names && out.length === 0) throw new Error(`上游未找到可安装技能：${skillsDir} 的一层目录中没有直接含 SKILL.md 的技能目录；若技能在仓库子目录（如 skills/），请在来源加稀疏路径 owner/repo[/subpath]`);
  return out;
}
