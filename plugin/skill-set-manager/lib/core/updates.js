/**
 * 检查更新与升级（§8.4/§8.5/§8.6）：手动检查（无轮询）；baseline(manifest)/已装/上游
 * 三份逐文件比对；升级默认策略=上游改&本地未改才更新，本地改过一律跳过保留并报告。
 * fetch 注入（host 传 fetchRepo 包装；测试 file:// 夹具）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readManifest, writeSkillManifest, walkFiles } from './manifest.js';
import { writeTextAtomic } from './atomic.js';

const defaultGit = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8' });

/** 远端默认分支 HEAD（ls-remote）；失败归一业务错。 */
export async function remoteHead(spec, { git = defaultGit, url } = {}) {
  const repoUrl = url ?? `https://github.com/${spec.owner}/${spec.repo}.git`;
  let r;
  try { r = git(['ls-remote', repoUrl, 'HEAD'], process.cwd()); }
  catch (e) { throw new Error(`git ls-remote failed: ${e?.message ?? e}`); }
  if (!r || r.status !== 0) throw new Error(`git ls-remote failed: ${String(r?.stderr ?? '').split('\n')[0].trim() || `exit ${r?.status}`}`);
  const sha = String(r.stdout || '').trim().split(/\s/)[0];
  if (!sha) throw new Error('git ls-remote failed: 空响应');
  return sha;
}

/**
 * 三份逐文件比对（纯函数，独立可测）。action ∈ update|skip-modified|add|remove|same。
 * 规则（§8.6）：本地改过（盘上哈希 ≠ baseline，含本地删/本地新增同名）→ skip-modified
 * （无论上游是否改）；否则上游改→update、上游增→add、上游删→remove、其余 same。
 * 仅本地存在的文件不入列表（用户文件，升级不动）。
 */
export function diffThreeWay(baseline, local, upstream) {
  const files = [];
  for (const p of Object.keys(upstream)) {
    const inBase = p in baseline;
    const inLocal = p in local;
    if (!inBase && !inLocal) { files.push({ path: p, action: 'add' }); continue; }
    if (!inBase && inLocal) { files.push({ path: p, action: local[p] === upstream[p] ? 'same' : 'skip-modified' }); continue; }
    if (local[p] !== baseline[p]) { files.push({ path: p, action: 'skip-modified' }); continue; }
    if (upstream[p] !== baseline[p]) { files.push({ path: p, action: 'update' }); continue; }
    files.push({ path: p, action: 'same' });
  }
  for (const p of Object.keys(baseline)) {
    if (p in upstream) continue;
    if (local[p] === baseline[p]) files.push({ path: p, action: 'remove' });
    else files.push({ path: p, action: 'skip-modified' });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function upstreamDirOf(skillsDir, name, fsImpl) {
  const d = path.join(skillsDir, name);
  let names;
  try { names = fsImpl.readdirSync(d); } catch { throw new Error(`上游不含技能 "${name}"：${d}`); }
  if (!names.includes('SKILL.md')) throw new Error(`上游不含技能 "${name}"：${d}`);
  return d;
}

/** 检查更新：fetch 注入 = async (manifestSourceInfo) => {commit, skillsDir}。 */
export async function checkUpdate(roots, name, { fetch, fs: fsImpl = fs } = {}) {
  const dir = path.join(roots.libraryRoot, name);
  const manifest = readManifest(dir, { fs: fsImpl });
  if (!manifest) throw new Error(`技能 "${name}" 无 manifest（本地技能不参与升级检查，§8.1）`);
  if (manifest.source === 'unknown') throw new Error(`技能 "${name}" 为本地技能，不参与升级检查（§8.1）`);
  const { commit, skillsDir } = await fetch(manifest.source);
  const upToDate = commit === manifest.commit;
  const baseline = manifest.files || {};
  const local = walkFiles(dir, { fs: fsImpl });
  let files;
  // 即便 commit 追平也要照出「上轮跳过的本地分歧」（否则 skip-modified 伪装成 same，
  // 直到上游再次移动才现形——活体冒烟实测教训）。
  const upstream = walkFiles(upstreamDirOf(skillsDir, name, fsImpl), { fs: fsImpl });
  files = diffThreeWay(baseline, local, upstream);
  return { name, source: manifest.source, current: manifest.commit, remote: commit, upToDate, files };
}

/**
 * 应用升级：先 backup(name) 快照，再仅落实 update/add/remove；skip-modified 一律不动。
 * manifest 前进到新 commit，但被跳过文件的 baseline 哈希保持旧上游值（下轮仍可识别
 * 本地偏差——§8.6「跳过并保留」的可追溯口径）。
 */
export async function applyUpdate(roots, name, { fetch, backup, fs: fsImpl = fs } = {}) {
  const chk = await checkUpdate(roots, name, { fetch, fs: fsImpl });
  if (chk.upToDate) return { ...chk, updated: [], skipped: [], backup: null };
  const dir = path.join(roots.libraryRoot, name);
  const { skillsDir } = await fetch(chk.source);
  const upDir = upstreamDirOf(skillsDir, name, fsImpl);
  const oldBaseline = readManifest(dir, { fs: fsImpl }).files || {};
  const backupPath = backup ? await backup(name) : null;
  const updated = [];
  const skipped = [];
  for (const { path: p, action } of chk.files) {
    if (action === 'skip-modified') { skipped.push(p); continue; }
    if (action === 'same') continue;
    const dst = path.join(dir, p);
    if (action === 'remove') { fsImpl.rmSync(dst, { force: true }); updated.push(p); continue; }
    const src = path.join(upDir, p);
    fsImpl.mkdirSync(path.dirname(dst), { recursive: true });
    fsImpl.writeFileSync(dst, fsImpl.readFileSync(src));
    updated.push(p);
  }
  const manifest = writeSkillManifest(dir, { source: chk.source, commit: chk.remote, fs: fsImpl });
  for (const p of skipped) if (p in oldBaseline) manifest.files[p] = oldBaseline[p];
  writeTextAtomic(path.join(dir, '.manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { fs: fsImpl }); // 原子写（review m8）
  return { ...chk, updated, skipped, backup: backupPath };
}
