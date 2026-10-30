/**
 * GitHub 稀疏安装（§8.3）：格式 = owner/repo[@ref][/subpath]（仿 dsh-skills-marketplace
 * 「仓库+分支+稀疏路径」，实现格式自定、不依赖其代码）；detached commit SHA 记录进
 * manifest。git 一律注入（测试 file:// 夹具免网络；缺失/网络错归一为业务错上抛）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { writeSkillManifest, rootSkillName } from './manifest.js';
import { gitFailMessage } from './giterr.js';

/** 来源解析与归一在叶子模块 source.js（github 与 manifest 共用，避免 ESM 环）；此处转发保持既有 import 不变。 */
export { parseRepoSpec, normalizeRepoSource } from './source.js';

const defaultGit = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8' });

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
 * 稀疏拉取：init + remote add + fetch --depth 1 --filter=blob:none origin <ref|HEAD>
 * + sparse-checkout（有 subpath 时）+ checkout --detach FETCH_HEAD。返回 {commit, skillsDir}。
 * 只取树、blob 按需，避免大仓库整仓拉包炸传输（不认 filter 的远端自动退回全量）。
 */
export async function fetchRepo(spec, { tmpDir, git = defaultGit, url } = {}) {
  const repoUrl = url ?? `https://github.com/${spec.owner}/${spec.repo}.git`;
  const run = (args) => {
    let r;
    // 强制 LF：autocrlf 机器上检出 CRLF 会使逐文件哈希随行尾漂移（manifest 不可移植）。
    try { r = git(['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', ...args], tmpDir); }
    catch (e) { throw new Error(`git ${args[0]} failed: ${e?.message ?? e}`); }
    if (!r || r.status !== 0) throw new Error(gitFailMessage(args, r));
    return r;
  };
  fs.mkdirSync(tmpDir, { recursive: true });
  run(['init', '-q']);
  run(['remote', 'add', 'origin', repoUrl]);
  // partial clone（用户报告 2026-10-26：大仓库检查更新报「invalid index-pack output」）：
  // 整仓 depth-1 也要把**全部 blob** 压成一个 pack（diagram-design 那种带素材的仓库最容易炸），
  // 改 --filter=blob:none 只取树对象，blob 交给下面的 sparse-checkout 按需拉。
  // 只有「服务器/老 git 不认 filter」才退回全量拉法；真因（仓库不存在、网络炸）不重试——
  // 慢网络下重试等于把等待翻倍（verify 有「非 filter 失败只拉一次」断言）。
  const fetchArgs = (filtered) => ['fetch', '--depth', '1', ...(filtered ? ['--filter=blob:none'] : []), 'origin', spec.ref || 'HEAD'];
  try { run(fetchArgs(true)); }
  catch (e) { if (!/filter/i.test(String(e?.message ?? ''))) throw e; run(fetchArgs(false)); }
  if (spec.subpath) run(['sparse-checkout', 'set', '--', spec.subpath]);
  run(['checkout', '-q', '--detach', 'FETCH_HEAD']);
  const commit = run(['rev-parse', 'FETCH_HEAD']).stdout.trim();
  return { commit, skillsDir: path.join(tmpDir, ...(spec.subpath ? spec.subpath.split('/') : [])) };
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
