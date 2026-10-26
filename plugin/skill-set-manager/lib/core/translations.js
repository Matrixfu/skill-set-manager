/**
 * P3 翻译缓存（设计 §6.1）：缓存只存翻译（en 快照 + zh + status + srcHash），
 * source/commit/managed 等派生字段一律照旧现算——缓存永不成为第二真相源。
 * 本模块纯函数无 IO 状态：store 读写由 host（index.js）经 storageDomain 负责。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseFrontmatter } from './resolver.js';

/** storageDomain 键（已过 storage.js KEY_RE）。 */
export const CACHE_KEY = 'translations';

/** 读 <skillDir>/SKILL.md 的 frontmatter.description（折叠块已由 parseFrontmatter 展开为单行）。 */
export function readDescription(skillDir, { fs: fsImpl = fs } = {}) {
  let text;
  try { text = fsImpl.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8'); } catch { return { text: null, hash: null }; }
  const fm = parseFrontmatter(text);
  const desc = fm && fm.description ? String(fm.description).trim() : '';
  if (!desc) return { text: null, hash: null };
  return { text: desc, hash: 'sha256:' + crypto.createHash('sha256').update(desc).digest('hex') };
}

/**
 * 对账（§6.1）：新名字/哈希变化 → pending；同哈希 → 原样保留（failed 不自愈，等手动批量）；
 * 库里消失 → 条目不进新表（GC 即在此）。无源文本（hash/en 缺失）的条目不入队不建条目。
 * 返回新 cache，不改入参。
 */
export function reconcile(cache, entries, { now = () => new Date().toISOString() } = {}) {
  const out = {};
  const pending = [];
  for (const e of entries) {
    if (!e || !e.name || !e.hash || !e.en) continue;
    const prev = cache[e.name];
    if (prev && prev.srcHash === e.hash) {
      out[e.name] = prev;
      if (prev.status === 'pending') pending.push(e.name);
      continue;
    }
    out[e.name] = { srcHash: e.hash, en: e.en, zh: null, status: 'pending', updatedAt: now() };
    pending.push(e.name);
  }
  return { cache: out, pending };
}

/** 翻译回写（单条粒度）：返回新 cache。 */
export function setTranslated(cache, name, { srcHash, en, zh, status }, { now = () => new Date().toISOString() } = {}) {
  return { ...cache, [name]: { ...(cache[name] ?? {}), srcHash, en, zh, status, updatedAt: now() } };
}

/** 给 libraryList 行加 description/descriptionZh/descriptionStatus 三字段（新行数组，不污染原行）。 */
export function decorate(library, cache) {
  return library.map((row) => {
    const c = cache[row.name];
    return {
      ...row,
      description: c?.en ?? null,
      descriptionZh: c && c.status === 'ok' ? c.zh : null,
      descriptionStatus: c?.status ?? 'none',
    };
  });
}
