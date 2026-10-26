/**
 * P3 翻译批量执行器（设计 §6.1）：路由 = LLM 优先 → 匿名机翻兜底（callMt 可为 null——
 * 本机 translator 未挂载的实态），逐条粒度成败、并发上限（默认 2）、单次批量上限（默认 50）。
 * 本模块不发网络：callLlm/callMt 由 host 注入（T6），纯逻辑可测。
 */
export function buildLlmPrompt(enTexts) {
  const lines = enTexts.map((t, i) => `${i + 1}. ${t}`).join('\n');
  return [
    '把下列英文技能用途逐条改写成简洁中文用途（每条不超过 40 字，只译用途语义；英文术语/技能名保留原文）。',
    '每条单独一行输出，行首为编号，不要解释。直接翻译，无需长时间斟酌措辞。',
    '',
    lines,
  ].join('\n');
}

/** 模型答复拆回：取首个非空行，剥编号前缀与包裹引号（单条批量场景）。 */
export function parseSingleReply(text) {
  const line = String(text ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] ?? '';
  return line
    .replace(/^["'“「『]+/, '')
    .replace(/^\d+\s*[.、)．：:」』]/, '')
    .replace(/["'”」』]+$/, '')
    .trim();
}

/**
 * rc.3 形状容错（崩溃复盘 2026-10-26：provider 以对象进 llm 面 → "[object Object]" NO_ADAPTER 崩 host）：
 * 元素可能是字符串或 {id}/{name} 对象，统一收成非空字符串或 null。
 */
export function refId(x) {
  if (typeof x === 'string') return x.trim() || null;
  if (x && typeof x === 'object') {
    const v = x.id ?? x.name ?? x.value;
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  }
  return null;
}

/** currentSelection()/手选对 → {provider,model} 字符串对；任一侧收不出即 null（调用方降级无 LLM，绝不带对象进 stream）。 */
export function normalizeSel(sel) {
  if (!sel || typeof sel !== 'object') return null;
  const provider = refId(sel.provider ?? sel.providerId);
  const model = refId(sel.model ?? sel.modelId);
  return provider && model ? { provider, model } : null;
}

/**
 * 拼接批答复拆回（提速 2026-10-26：reasoning 模型逐条思考太慢，5 条拼一个 prompt）：
 * 按行首编号对位，忽略无编号说明行，重复编号首个生效，剥包裹引号；
 * 任一行缺失 → null（调用方据此**整组逐条回退**，错行宁慢勿错）。
 */
export function parseBatchReply(text, n) {
  if (text == null || !String(text).trim()) return null;
  const out = new Array(n).fill(null);
  for (const raw of String(text).split(/\r?\n/)) {
    const ln = raw.trim();
    if (!ln) continue;
    const m = ln.match(/^(\d+)\s*[.、)．：:」』]\s*/);
    if (!m) continue;
    const i = Number(m[1]) - 1;
    if (i < 0 || i >= n || out[i] != null) continue;
    const v = ln.slice(m[0].length).replace(/^["'“「『]+/, '').replace(/["'”」』]+$/, '').trim();
    if (v) out[i] = v;
  }
  return out.every((x) => x != null) ? out : null;
}

export async function runBatch({ items, callLlm, callMt, concurrency = 2, limit = 50, chunk = 1 }) {
  const all = Array.isArray(items) ? items : [];
  const batch = all.slice(0, limit);
  const skipped = all.length - batch.length;
  const done = [];
  const failed = [];
  let next = 0;
  async function one(item) {
    const errs = [];
    if (callLlm) {
      try {
        const v = await callLlm(item.en);
        if (v && String(v).trim()) return { name: item.name, zh: String(v).trim(), via: 'llm' };
        errs.push('llm: empty result');
      } catch (e) { errs.push(`llm: ${e?.message ?? e}`); }
    }
    if (callMt) {
      try {
        const v = await callMt(item.en);
        if (v && String(v).trim()) return { name: item.name, zh: String(v).trim(), via: 'mt' };
        errs.push('mt: empty result');
      } catch (e) { errs.push(`mt: ${e?.message ?? e}`); }
    }
    return { name: item.name, error: errs.join('; ') || 'no translate route' };
  }
  // chunk>1：多条拼一个 prompt（callLlm 收 en 数组）；拆回失败/抛错 → 整组逐条回退（宁慢勿错）
  const groups = [];
  if (chunk > 1 && callLlm) {
    for (let i = 0; i < batch.length; i += chunk) groups.push(batch.slice(i, i + chunk));
  } else {
    for (const it of batch) groups.push([it]);
  }
  async function worker() {
    while (next < groups.length) {
      const g = groups[next++];
      if (g.length > 1 && callLlm) {
        let parsed = null;
        try {
          parsed = parseBatchReply(await callLlm(g.map((x) => x.en)), g.length);
        } catch { parsed = null; }
        if (parsed) {
          g.forEach((it, i) => done.push({ name: it.name, zh: parsed[i], via: 'llm' }));
          continue;
        }
      }
      for (const it of g) {
        const res = await one(it);
        (res.zh ? done : failed).push(res);
      }
    }
  }
  const n = Math.max(1, Math.min(concurrency, groups.length));
  await Promise.all(Array.from({ length: n }, worker));
  return { done, failed, skipped };
}
