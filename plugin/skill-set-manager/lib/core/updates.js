/**
 * 检查更新与升级（§8.4/§8.5/§8.6）：手动检查（无轮询）；baseline(manifest)/已装/上游
 * 三份逐文件比对；升级默认策略=上游改&本地未改才更新，本地改过一律跳过保留并报告。
 * fetch 注入（host 传 fetchRepo 包装；测试 file:// 夹具）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { readManifest, writeSkillManifest, walkFiles, rootSkillName } from './manifest.js';
import { writeTextAtomic } from './atomic.js';
import { gitFailMessage } from './giterr.js';
import { makeGit } from './github.js';
import { classifyAttempt } from './gitnet.js';

/**
 * 远端默认分支 HEAD（ls-remote）；失败归一业务错。2026-11-17 加固：默认 15s 硬超时
 * （makeGit 工厂），网络类失败重试一次、失败进 failLog（与 fetchRepo 同一 gitnet 口径，
 * 分类经 classifyAttempt 单点）。
 */
export async function remoteHead(spec, { git, url, timeoutMs = 15000, failLog } = {}) {
  const repoUrl = url ?? `https://github.com/${spec.owner}/${spec.repo}.git`;
  const runner = git ?? makeGit(timeoutMs);
  const args = ['ls-remote', repoUrl, 'HEAD'];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const t0 = Date.now();
    let r;
    try { r = runner(args, process.cwd()); }
    catch (e) { r = { status: 'spawn', stdout: '', stderr: String(e?.message ?? e) }; }
    const sha = r && r.status === 0 ? String(r.stdout || '').trim().split(/\s/)[0] : '';
    if (sha) return sha;
    const v = classifyAttempt({
      cmd: 'ls-remote', args, r, t0, failLog, attempt,
      ok: () => false, // 走到这里 sha 已空：status=0 也可能是空响应假成
      failMsg: (x) => (x && x.status === 0 ? 'git ls-remote failed: empty response' : gitFailMessage(args, x)),
    });
    if (!v.retry) throw new Error(v.msg);
  }
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

function hasSkillMd(dir, fsImpl) {
  try { return fsImpl.readdirSync(dir).includes('SKILL.md'); } catch { return false; }
}
/**
 * 上游技能目录：先按 `<skillsDir>/<name>` 直取；来源被粘贴成仓库根（无子路径）时，按
 * 安装侧同口径（installSkills「一层扫描含 SKILL.md 的目录」）**只下探一层**找
 * `<sub>/<name>/SKILL.md`——用户报告 2026-10-26：`github:vercel-labs/skills` 的
 * find-skills 实际在 `skills/find-skills`，直取必报「上游不含技能」。
 * 唯一命中才认；多处命中列候选让用户改来源——猜错等于拿错基线，代价是误覆盖本地文件。
 */
export function upstreamDirOf(skillsDir, name, fsImpl) {
  const direct = path.join(skillsDir, name);
  if (hasSkillMd(direct, fsImpl)) return direct;
  // 检出根即技能（单技能仓库：SKILL.md 直接在检出根）——与安装侧 installSkills 的下探同口径。
  // 只认 frontmatter name（rootSkillName）与库条目名一致的情形：名字对不上绝不把检出根当该技能，
  // 认错基线 = 升级时拿别的技能的文件覆盖本地（§8.6 三份比对的根是「同一技能」）。
  if (rootSkillName(skillsDir, { fs: fsImpl }) === name) return skillsDir;
  let entries = [];
  try { entries = fsImpl.readdirSync(skillsDir, { withFileTypes: true }); } catch { /* 上游目录读不到 → 走下面的报错 */ }
  const hits = [];
  for (const ent of entries) { // 只扫一层（§9.5 同口径）；隐藏目录（.git 等）不作候选
    if (!ent.isDirectory() || ent.name.startsWith('.')) continue;
    const cand = path.join(skillsDir, ent.name, name);
    if (hasSkillMd(cand, fsImpl)) hits.push(cand);
  }
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) throw new Error(`上游 "${name}" 同时出现在多个子目录：${hits.map((d) => path.relative(skillsDir, d)).join('、')}——请把来源改成其中一层（github:owner/repo/<子目录>）`);
  throw new Error(`上游不含技能 "${name}"：${direct}——若它在上游某个子目录下，请把来源改成 github:owner/repo/<含它的子目录>`);
}

/** 检查更新：fetch 注入 = async (manifestSourceInfo) => {commit, skillsDir}。 */
function loadUpdatable(dir, name, fsImpl) { // check/apply 共用前置校验（§8.1）
  const manifest = readManifest(dir, { fs: fsImpl });
  if (!manifest) throw new Error(`技能 "${name}" 无 manifest（本地技能不参与升级检查，§8.1）`);
  if (manifest.source === 'unknown') throw new Error(`技能 "${name}" 为本地技能，不参与升级检查（§8.1）`);
  return manifest;
}
function buildChk(name, manifest, commit, skillsDir, dir, fsImpl) {
  const upToDate = commit === manifest.commit;
  const baseline = manifest.files || {};
  const local = walkFiles(dir, { fs: fsImpl });
  // 即便 commit 追平也要照出「上轮跳过的本地分歧」（否则 skip-modified 伪装成 same，
  // 直到上游再次移动才现形——活体冒烟实测教训）。
  const upstream = walkFiles(upstreamDirOf(skillsDir, name, fsImpl), { fs: fsImpl });
  return { name, source: manifest.source, current: manifest.commit, remote: commit, upToDate, files: diffThreeWay(baseline, local, upstream) };
}
export async function checkUpdate(roots, name, { fetch, fs: fsImpl = fs } = {}) {
  const dir = path.join(roots.libraryRoot, name);
  const manifest = loadUpdatable(dir, name, fsImpl);
  const { commit, skillsDir } = await fetch(manifest.source);
  return buildChk(name, manifest, commit, skillsDir, dir, fsImpl);
}

/**
 * 应用升级：先 backup(name) 快照，再仅落实 update/add/remove；skip-modified 一律不动。
 * manifest 前进到新 commit，但被跳过文件的 baseline 哈希保持旧上游值（下轮仍可识别
 * 本地偏差——§8.6「跳过并保留」的可追溯口径）。
 */
export async function applyUpdate(roots, name, { fetch, backup, fs: fsImpl = fs } = {}) {
  const dir = path.join(roots.libraryRoot, name);
  const manifest = loadUpdatable(dir, name, fsImpl);
  const { commit, skillsDir } = await fetch(manifest.source); // 全程只拉一次上游（review n7）
  const chk = buildChk(name, manifest, commit, skillsDir, dir, fsImpl);
  if (chk.upToDate) return { ...chk, updated: [], skipped: [], backup: null };
  const upDir = upstreamDirOf(skillsDir, name, fsImpl);
  const oldBaseline = manifest.files || {};
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
  const mfNew = writeSkillManifest(dir, { source: chk.source, commit: chk.remote, fs: fsImpl });
  for (const p of skipped) if (p in oldBaseline) mfNew.files[p] = oldBaseline[p];
  writeTextAtomic(path.join(dir, '.manifest.json'), JSON.stringify(mfNew, null, 2) + '\n', { fs: fsImpl }); // 原子写（review m8）
  return { ...chk, updated, skipped, backup: backupPath };
}

/**
 * 批量检查更新（GLOSSARY「批量检查更新」，2026-11-17 加固 T3）：按来源仓库分组、
 * 每仓只拉一次、覆盖该源全部受管技能；单仓失败不中止整批——失败仓库进
 * failedSources，可经 `sources` 子集单独重试。无 manifest / 本地技能（source
 * unknown）不参与（§8.1，与单技能检查同口径）；`.` 开头目录（.backups）跳过。
 * 组内逐技能定位失败（上游删了该技能）不进 results，带 error 上报（行级失败）。
 */
export async function checkUpdateAll(roots, { fetch, sources = null, fs: fsImpl = fs } = {}) {
  const groups = new Map();
  let entries = [];
  try { entries = fsImpl.readdirSync(roots.libraryRoot, { withFileTypes: true }); } catch {}
  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name.startsWith('.')) continue;
    const dir = path.join(roots.libraryRoot, ent.name);
    const manifest = readManifest(dir, { fs: fsImpl });
    if (!manifest || manifest.source === 'unknown') continue;
    if (sources && !sources.includes(manifest.source)) continue;
    if (!groups.has(manifest.source)) groups.set(manifest.source, []);
    groups.get(manifest.source).push({ name: ent.name, dir, manifest });
  }
  const results = [];
  const failedSources = [];
  for (const [source, members] of groups) {
    let got;
    try { got = await fetch(source); }
    catch (e) { failedSources.push({ source, error: String(e?.message ?? e) }); continue; }
    for (const m of members) {
      try { results.push({ name: m.name, chk: buildChk(m.name, m.manifest, got.commit, got.skillsDir, m.dir, fsImpl) }); }
      catch (e) { results.push({ name: m.name, chk: null, error: String(e?.message ?? e) }); }
    }
  }
  return { results, failedSources };
}
