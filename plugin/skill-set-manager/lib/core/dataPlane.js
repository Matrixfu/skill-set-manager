/**
 * P3 数据面核心（设计 §6.1/§6.4/§6.6）：翻译缓存 store 读写、库视图对账、外来常驻清单、翻译回写。
 * store = storageDomain 句柄（get/put）由 host 注入；本模块不碰 ctx，纯逻辑可 CASES 覆盖。
 */
import fs from 'node:fs';
import path from 'node:path';
import { readDescription, reconcile, setTranslated, CACHE_KEY } from './translations.js';
import { runBatch, parseSingleReply } from './translateExec.js';
import { loadResident } from './sets.js';

const ENTRY_KEY = 'entries';

export async function loadCache(store) { return (await store.get(CACHE_KEY, ENTRY_KEY)) ?? {}; }
export async function saveCache(store, cache) { await store.put(CACHE_KEY, ENTRY_KEY, cache); }

/** 现扫库 → readDescription → reconcile（新名/失效/GC）→ 落盘；缓存永不成为真相源。 */
export async function reconcileLibrary(roots, store, { fs: fsImpl = fs } = {}) {
  const cache = await loadCache(store);
  let names;
  try { names = fsImpl.readdirSync(roots.libraryRoot); } catch { names = []; }
  const entries = [];
  for (const n of names) {
    if (n.startsWith('.')) continue;
    const { text, hash } = readDescription(path.join(roots.libraryRoot, n), { fs: fsImpl });
    if (text) entries.push({ name: n, hash, en: text });
  }
  const r = reconcile(cache, entries);
  await saveCache(store, r.cache);
  return r;
}

/** libraryList 视图钩子：autoTranslate 关（默认）时 onPending 完全不触发 = 零出网。 */
export async function libraryView(roots, store, { autoTranslate = false, onPending = null, fs: fsImpl = fs } = {}) {
  const r = await reconcileLibrary(roots, store, { fs: fsImpl });
  if (autoTranslate && r.pending.length && onPending) onPending(r.pending);
  return r;
}

/** 外来常驻（设计 §6.4）：常驻区里「不在名单且含 SKILL.md」的条目（弹窗灰行判定源之一）。 */
export function residentForeign(roots, { fs: fsImpl = fs, residentNames = null } = {}) {
  const listed = new Set(residentNames ?? loadResident(roots).skills);
  let names;
  try { names = fsImpl.readdirSync(roots.userAgentsRoot); } catch { names = []; }
  const out = [];
  for (const n of names) {
    if (n.startsWith('.') || listed.has(n)) continue;
    try { if (fsImpl.statSync(path.join(roots.userAgentsRoot, n, 'SKILL.md')).isFile()) out.push(n); } catch {}
  }
  return out.sort();
}

/**
 * 翻译执行（逐条粒度）：names → items（en 快照优先，缺失重读盘）→ runBatch →
 * done 剥编号回写 ok、failed 回写 failed（带 srcHash，同哈希不自愈）→ 落盘。
 */
export async function translateRunCore({ roots, store, names, callLlm, callMt, concurrency, limit, fs: fsImpl = fs }) {
  const cache = await loadCache(store);
  const items = [];
  for (const name of Array.isArray(names) ? names : []) {
    let en = cache[name]?.en ?? null;
    let srcHash = cache[name]?.srcHash ?? null;
    if (!en) { const d = readDescription(path.join(roots.libraryRoot, name), { fs: fsImpl }); en = d.text; srcHash = d.hash; }
    if (en) items.push({ name, en, srcHash });
  }
  // 提速（2026-10-26 用户反馈「特别慢」）：5 条拼一个 prompt（runBatch chunk），错行自动逐条回退
  const res = await runBatch({ items, callLlm, callMt, concurrency, limit, chunk: 5 });
  const byName = new Map(items.map((i) => [i.name, i]));
  // M1（终审 2026-10-26）：整批 LLM 调用是分钟级，期间 reconcileLibrary（每次 libraryList）可能已推表——
  // 批尾必须重读最新表再逐条 merge 本批结果，绝不整表覆盖批首快照。
  let next = await loadCache(store);
  for (const d of res.done) {
    const it = byName.get(d.name);
    next = setTranslated(next, d.name, { srcHash: it.srcHash, en: it.en, zh: parseSingleReply(d.zh), status: 'ok' });
  }
  for (const fl of res.failed) {
    const it = byName.get(fl.name);
    next = setTranslated(next, fl.name, { srcHash: it?.srcHash ?? null, en: it?.en ?? null, zh: null, status: 'failed' });
  }
  await saveCache(store, next);
  return { done: res.done, failed: res.failed, skipped: res.skipped, cache: next };
}
