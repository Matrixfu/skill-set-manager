/**
 * P3 翻译批量执行器（设计 §6.1）：路由 = LLM 优先 → 匿名机翻兜底（callMt 可为 null——
 * 本机 translator 未挂载的实态），逐条粒度成败、并发上限（默认 2）、单次批量上限（默认 50）。
 * 本模块不发网络：callLlm/callMt 由 host 注入（T6），纯逻辑可测。
 */
export function buildLlmPrompt(enTexts) {
  const lines = enTexts.map((t, i) => `${i + 1}. ${t}`).join('\n');
  return [
    '把下列英文技能用途逐条改写成简洁中文用途（每条不超过 40 字，只译用途语义；英文术语/技能名保留原文）。',
    '每条单独一行输出，行首为编号，不要解释。',
    '',
    lines,
  ].join('\n');
}

export async function runBatch({ items, callLlm, callMt, concurrency = 2, limit = 50 }) {
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
  async function worker() {
    while (next < batch.length) {
      const item = batch[next++];
      const res = await one(item);
      (res.zh ? done : failed).push(res);
    }
  }
  const n = Math.max(1, Math.min(concurrency, batch.length));
  await Promise.all(Array.from({ length: n }, worker));
  return { done, failed, skipped };
}
