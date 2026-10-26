/**
 * GitHub 稀疏安装（§8.3）：格式 = owner/repo[@ref][/subpath]（仿 dsh-skills-marketplace
 * 「仓库+分支+稀疏路径」，实现格式自定、不依赖其代码）；detached commit SHA 记录进
 * manifest。git 一律注入（测试 file:// 夹具免网络；缺失/网络错归一为业务错上抛）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { writeSkillManifest } from './manifest.js';
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

/**
 * 稀疏拉取：init + remote add + fetch --depth 1 origin <ref|HEAD> + sparse-checkout
 * （有 subpath 时）+ checkout --detach FETCH_HEAD。返回 {commit, skillsDir}。
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
  run(['fetch', '--depth', '1', 'origin', spec.ref || 'HEAD']);
  if (spec.subpath) run(['sparse-checkout', 'set', '--', spec.subpath]);
  run(['checkout', '-q', '--detach', 'FETCH_HEAD']);
  const commit = run(['rev-parse', 'FETCH_HEAD']).stdout.trim();
  return { commit, skillsDir: path.join(tmpDir, ...(spec.subpath ? spec.subpath.split('/') : [])) };
}

/**
 * 装入技能库：一层扫描含 SKILL.md 的目录（嵌套不追）；no-clobber——库同名默认跳过
 * （reason:'exists'），overwrite 必须先 backup(name) 再替换（ADR-0003 / Review Focus #2）。
 * 每个成功项写 manifest（source/commit）。
 */
export async function installSkills(roots, { source, commit, skillsDir, names = null, overwrite = false, backup, fs: fsImpl = fs } = {}) {
  const out = [];
  const seen = new Set(); // names 里上游不存在的名字必须报 not-found，不得静默吞（review n2）
  let entries;
  try { entries = fsImpl.readdirSync(skillsDir, { withFileTypes: true }); }
  catch { throw new Error(`技能目录不存在: ${skillsDir}`); }
  for (const ent of entries) {
    if (ent.name.startsWith('.') || !ent.isDirectory()) continue;
    const name = ent.name;
    if (names && !names.includes(name)) continue;
    const src = path.join(skillsDir, name);
    try { fsImpl.statSync(path.join(src, 'SKILL.md')); } catch { continue; }
    seen.add(name);
    const dst = path.join(roots.libraryRoot, name);
    let exists = false;
    try { fsImpl.statSync(dst); exists = true; } catch {}
    if (exists && !overwrite) { out.push({ name, ok: false, reason: 'exists' }); continue; }
    if (exists && overwrite) {
      if (backup) await backup(name);
      fsImpl.rmSync(dst, { recursive: true, force: true });
    }
    copyDirTree(src, dst, fsImpl);
    writeSkillManifest(dst, { source, commit, fs: fsImpl });
    out.push({ name, ok: true });
  }
  if (names) for (const n of names) if (!seen.has(n)) out.push({ name: n, ok: false, reason: 'not-found' });
  return out;
}
