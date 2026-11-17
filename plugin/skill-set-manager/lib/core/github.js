/**
 * GitHub 稀疏安装（§8.3）：格式 = owner/repo[@ref][/subpath]（仿 dsh-skills-marketplace
 * 「仓库+分支+稀疏路径」，实现格式自定、不依赖其代码）；detached commit SHA 记录进
 * manifest。git 一律注入（测试 file:// 夹具免网络；缺失/网络错归一为业务错上抛）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeSkillManifest, rootSkillName } from './manifest.js';
import { gitFailMessage } from './giterr.js';
import { isRetryableGitFailure, logGitFailure } from './gitnet.js';

/** 来源解析与归一在叶子模块 source.js（github 与 manifest 共用，避免 ESM 环）；此处转发保持既有 import 不变。 */
export { parseRepoSpec, normalizeRepoSource } from './source.js';

const defaultGit = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8' });

/**
 * 带硬超时的默认 git 工厂（2026-11-17 加固）：spawnSync 原生 timeout+kill——代理半死
 * （TCP 通、传输吊死）时不再无限吊着 host。超时产出 ETIMEDOUT 结论，gitnet 判可重试。
 * 注入 git 的调用方（verify 夹具）自理超时；updates.js 的 ls-remote 也复用本工厂。
 */
export function makeGit(timeoutMs) {
  if (!timeoutMs) return defaultGit;
  return (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8', timeout: timeoutMs });
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
export async function fetchRepo(spec, { dir, git, url, timeoutMs, failLog } = {}) {
  const repoUrl = url ?? `https://github.com/${spec.owner}/${spec.repo}.git`;
  const runner = git ?? makeGit(timeoutMs);
  const run = (args) => {
    let r;
    // 强制 LF：autocrlf 机器上检出 CRLF 会使逐文件哈希随行尾漂移（manifest 不可移植）。
    try { r = runner(['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', ...args], dir); }
    catch (e) { throw new Error(`git ${args[0]} failed: ${e?.message ?? e}`); }
    if (!r || r.status !== 0) throw new Error(gitFailMessage(args, r));
    return r;
  };
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(path.join(dir, '.git'))) {
    run(['remote', 'set-url', 'origin', repoUrl]); // url 覆盖夹具/换 remote 都对齐
  } else {
    run(['init', '-q']);
    run(['remote', 'add', 'origin', repoUrl]);
  }
  // partial clone（用户报告 2026-10-26：大仓库检查更新报「invalid index-pack output」）：
  // 整仓 depth-1 也要把**全部 blob** 压成一个 pack（diagram-design 那种带素材的仓库最容易炸），
  // 改 --filter=blob:none 只取树对象，blob 交给下面的 sparse-checkout 按需拉。
  // 只有「服务器/老 git 不认 filter」才退回全量拉法；真因（仓库不存在）不重试——
  // 慢网络下重试等于把等待翻倍（verify 有「非 filter 失败只拉一次」断言）；
  // 网络类（RPC failed/超时等，gitnet 口径）重试一次，失败各进 failLog。
  const attemptFetch = (filtered) => {
    const bare = ['fetch', '--depth', '1', ...(filtered ? ['--filter=blob:none'] : []), 'origin', spec.ref || 'HEAD'];
    const fetchArgs = ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', ...bare];
    for (let attempt = 1; attempt <= 2; attempt++) {
      const t0 = Date.now();
      let r;
      try { r = runner(fetchArgs, dir); }
      catch (e) { r = { status: 'spawn', stdout: '', stderr: String(e?.message ?? e) }; }
      if (r && r.status === 0) return;
      const msg = gitFailMessage(bare, r); // head 用裸 args：-c 前缀不进结论（gitFailMessage 口径=命令名）
      if (failLog) logGitFailure(failLog, { cmd: 'fetch', status: r?.status ?? 'spawn', verdict: msg, ms: Date.now() - t0, attempt });
      if (attempt === 2 || !isRetryableGitFailure(msg)) {
        const err = new Error(msg);
        err.filterUnrecognized = /filter/i.test(msg); // 调用方据此决定退不退全量
        throw err;
      }
    }
  };
  try { attemptFetch(true); }
  catch (e) { if (!e?.filterUnrecognized) throw e; attemptFetch(false); }
  // sparse-checkout/checkout 层同样走「网络类重试一次 + 留痕」（Review Focus #2）：
  // blob:none 的 blob 下载发生在 checkout 时，大素材仓库（hyperframes）吊死在这层，
  // 与 fetch 层同款形状；两步皆幂等（set 可重入、detach -f 可重来），重试安全。
  // 陈旧锁自愈每次 attempt 前都清（活体实测 2026-11-17：60s kill checkout 留 index.lock 尸，
  // checkout -f 对它无解——只在开头清一次，重试必撞尸秒败，重试形同虚设）；
  // 长任务单飞口径（GLOSSARY「长任务」全局只允许一个）保证此刻必无活 git 在动这底，撞锁必是尸。
  const runLogged = (cmd, args) => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try { fs.rmSync(path.join(dir, '.git', 'index.lock'), { force: true }); } catch {}
      const t0 = Date.now();
      let r;
      try { r = runner(['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', ...args], dir); }
      catch (e) { r = { status: 'spawn', stdout: '', stderr: String(e?.message ?? e) }; }
      if (r && r.status === 0) return r;
      const msg = gitFailMessage(args, r); // head 用裸 args（-c 前缀不进结论）
      if (failLog) logGitFailure(failLog, { cmd, status: r?.status ?? 'spawn', verdict: msg, ms: Date.now() - t0, attempt });
      if (attempt === 2 || !isRetryableGitFailure(msg)) throw new Error(msg);
    }
  };
  if (spec.subpath) runLogged('sparse-checkout', ['sparse-checkout', 'set', '--', spec.subpath]);
  runLogged('checkout', ['checkout', '-q', '-f', '--detach', 'FETCH_HEAD']);
  const commit = run(['rev-parse', 'FETCH_HEAD']).stdout.trim();
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
