/** 扫描登记（§8.1）：为库内缺 manifest 的技能补写 .manifest.json（本地技能 source:'unknown'）。 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseFrontmatter } from './resolver.js';
import { writeTextAtomic } from './atomic.js';
import { SKILL_NAME_RE } from './paths.js';
import { normalizeRepoSource } from './source.js';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * 一次遍历同时产出两样东西：逐文件哈希（基线）与逐文件 stat 摘要（size:mtime）。
 * `hash:false` = 只 stat 不读内容——「本地改动」判定的廉价口径。
 * 实测本机 96 技能 / 11386 文件 / 451.8MB：读+sha256 1483ms（其中读盘占 84%），
 * 只 stat 172ms；旧口径每次开面板都全库读盘，就是面板与设置页 2~3 秒的来源。
 */
function walkScan(root, { fs: fsImpl = fs, hash = true } = {}) {
  const files = {};
  const stats = {};
  const walk = (dir, rel) => {
    for (const ent of fsImpl.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name.startsWith('.')) continue; // .manifest.json 自身与点目录一律不进哈希表
      const abs = path.join(dir, ent.name);
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      const st = fsImpl.statSync(abs); // 跟随 junction
      if (st.isDirectory()) walk(abs, r);
      else if (st.isFile()) {
        stats[r] = `${st.size}:${Math.round(st.mtimeMs)}`;
        if (hash) files[r] = 'sha256:' + sha256(fsImpl.readFileSync(abs));
      }
    }
  };
  walk(root, '');
  return { files, stats };
}

export function walkFiles(root, opts) {
  return walkScan(root, opts).files;
}

/** 与 walkFiles 同一趟遍历，但不读内容、不哈希，只回 size:mtime 摘要（staleness 快路径）。 */
export function walkStat(root, opts) {
  return walkScan(root, { ...opts, hash: false }).stats;
}

const hashFile = (abs, fsImpl = fs) => 'sha256:' + sha256(fsImpl.readFileSync(abs));

/** 两张哈希表是否不同（现口径：任一方向有差异即不同）。 */
function hashDiffers(baseline, now) {
  return Object.keys(baseline).some((p) => baseline[p] !== now[p]) || Object.keys(now).some((p) => now[p] !== baseline[p]);
}

/**
 * 「本地改动」判定（§6.4 徽标）：盘上现状 vs manifest 基线，只回布尔。
 * 快路径靠 manifest.stats（登记/安装时记下的 size:mtime）：stat 口径没变即内容没变，一个文件都不读；
 * stat 不匹配才回读该文件哈希比对（只 touch 不假红）。
 * 已知代价：内容变了但 size 与 mtime 都没变（工具刻意保留 mtime 那类）会漏判——
 * 升级检查/卸载/备份还原等真正要命的判定仍走 walkFiles 全量哈希，不受此影响。
 * 旧 manifest 没有 stats：回退一次全量哈希，由调用方补写 stats（backfillManifestStats）后即走快路径。
 */
export function localModified(dir, mf, { fs: fsImpl = fs } = {}) {
  const baseline = mf?.files;
  if (!baseline || !Object.keys(baseline).length) return false; // 无基线 = 无从比对（照旧口径）
  if (!mf.stats) return hashDiffers(baseline, walkFiles(dir, { fs: fsImpl }));
  const nowStats = walkStat(dir, { fs: fsImpl });
  for (const [p, baseHash] of Object.entries(baseline)) {
    const now = nowStats[p];
    if (now === undefined) return true; // 基线文件已不在盘上
    if (now === mf.stats[p]) continue; // size+mtime 未变 → 不读盘
    if (hashFile(path.join(dir, p), fsImpl) !== baseHash) return true;
  }
  return Object.keys(nowStats).some((p) => !(p in baseline)); // 基线外新增文件
}

/** 给升级前的旧 manifest 补写 stats（一次性）。只加字段，files/dirDigest 基线口径一字不动。 */
export function backfillManifestStats(dir, mf, { fs: fsImpl = fs } = {}) {
  if (!mf || mf.stats) return mf;
  const next = { ...mf, stats: walkStat(dir, { fs: fsImpl }) };
  writeTextAtomic(path.join(dir, '.manifest.json'), JSON.stringify(next, null, 2) + '\n', { fs: fsImpl });
  return next;
}

/** 逐文件哈希 + 目录摘要（§11 manifest 形状，#8 验收字段）。 */
function buildManifest(dir, name, { source = 'unknown', commit = null }, fsImpl) {
  const skillMd = fsImpl.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
  const fm = parseFrontmatter(skillMd);
  const { files, stats } = walkScan(dir, { fs: fsImpl });
  const dirDigest = 'sha256:' + sha256(Buffer.from(
    Object.entries(files).sort().map(([k, v]) => `${k}:${v}`).join('\n'),
  ));
  return {
    name: (fm && fm.name) || name,
    source,
    commit,
    installedAt: new Date().toISOString(),
    managed: true,
    files,
    stats,
    dirDigest,
  };
}

/**
 * 检出根即技能（单技能仓库：SKILL.md 直接在检出根，没有「一层目录 = 一个技能」那层）时的技能名：
 * **只认 frontmatter 里合法 kebab-case 的 name**，否则 null。名字不猜仓库名——猜错等于库条目名与
 * manifest.name 分叉，更新认领还会拿错基线误覆盖本地文件（§7.3 目录名即技能名）。
 */
export function rootSkillName(dir, { fs: fsImpl = fs } = {}) {
  let text;
  try { text = fsImpl.readFileSync(path.join(dir, 'SKILL.md'), 'utf8'); } catch { return null; }
  const name = String(parseFrontmatter(text)?.name ?? '').trim();
  return SKILL_NAME_RE.test(name) ? name : null;
}

/** 读单个技能目录的 manifest；缺失/损坏返回 null。 */
export function readManifest(dir, { fs: fsImpl = fs } = {}) {
  try { return JSON.parse(fsImpl.readFileSync(path.join(dir, '.manifest.json'), 'utf8')); }
  catch { return null; }
}

/** 单技能直写 manifest（GitHub 安装/恢复用；覆盖式）。P1a-T0。 */
export function writeSkillManifest(dir, { source = 'unknown', commit = null, fs: fsImpl = fs } = {}) {
  const manifest = buildManifest(dir, path.basename(dir), { source, commit }, fsImpl);
  writeTextAtomic(path.join(dir, '.manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { fs: fsImpl });
  return manifest;
}

/**
 * 认领来源（§8.1）：给库内本地技能补写 manifest——**认领时的盘上内容即基线**，
 * 之后本地改动才谈得上「升级时跳过并保留」。只作用于技能库（库外条目他人所有，ADR-0003）。
 * `source` 走 normalizeRepoSource 单一口径（非法来源抛业务错、不落盘）；
 * 字面 `'unknown'` = 撤认领，回落 §8.1 的「本地技能已登记」态（哈希基线保留）。
 */
export function claimSource(roots, { name, source, commit = null }, { fs: fsImpl = fs } = {}) {
  if (!SKILL_NAME_RE.test(String(name ?? ''))) throw new Error(`技能名不合法（非 kebab-case）: ${name}`);
  const dir = path.join(roots.libraryRoot, name);
  let isDir = false;
  try { isDir = fsImpl.statSync(dir).isDirectory(); } catch {}
  if (!isDir) throw new Error(`技能库内不存在该技能（认领来源只作用于 ~/.dsh/skill-library）: ${name}`);
  const raw = String(source ?? '').trim();
  const unknown = raw === '' || raw === 'unknown';
  const canonical = unknown ? 'unknown' : normalizeRepoSource(raw); // 非法来源在此抛
  return writeSkillManifest(dir, {
    source: canonical,
    commit: canonical === 'unknown' ? null : (commit ? String(commit).trim() : null),
    fs: fsImpl,
  });
}

export function registerLibrary(roots, { fs: fsImpl = fs, source = 'unknown', commit = null } = {}) {
  const registered = [];
  const manifests = [];
  let names;
  try { names = fsImpl.readdirSync(roots.libraryRoot); } catch { return { registered, manifests }; }
  for (const name of names) {
    if (name.startsWith('.')) continue;
    const dir = path.join(roots.libraryRoot, name);
    try { if (!fsImpl.statSync(dir).isDirectory()) continue; } catch { continue; }
    const mfPath = path.join(dir, '.manifest.json');
    try { fsImpl.statSync(mfPath); continue; } catch {} // 已有 manifest 不覆盖
    let manifest;
    try { manifest = buildManifest(dir, name, { source, commit }, fsImpl); } catch { continue; }
    writeTextAtomic(mfPath, JSON.stringify(manifest, null, 2) + '\n', { fs: fsImpl });
    registered.push(manifest.name);
    manifests.push(mfPath);
  }
  return { registered, manifests };
}
