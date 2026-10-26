/**
 * P3 T0 探针（一次性，验证完即卸载）：翻译路由运行时可达性。
 *  a) ctx.translator.availableProviders() 清单
 *  b) 匿名 google/bing：resolve()+translate() 实测（样例英文→zh）
 *  c) ctx.llm：形状枚举 + agentDefaultModel/存活会话 header 解析 provider/model，
 *     发一条极短翻译请求（有无存活会话两场景），记成功/错误码
 * 结果逐阶段写 C:/AI/DSH_Skill_Manager/probe-out/translate-result.json；每个网络调用 30s 超时护栏。
 */
import fs from 'node:fs';

const OUT = 'C:/AI/DSH_Skill_Manager/probe-out/translate-result.json';
const SAMPLE = 'Use when requesting code review on completed work';

const errText = (e) => String((e && (e.code ? e.code + ': ' : '') + (e?.message ?? e)) || e);
const withTimeout = (promise, ms, label) =>
  Promise.race([
    Promise.resolve(promise),
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label}: probe timeout ${ms}ms`)), ms).unref?.()),
  ]);
const shape = (v) => {
  if (v == null) return { type: typeof v };
  if (typeof v !== 'object' && typeof v !== 'function') return { type: typeof v, value: String(v).slice(0, 200) };
  const keys = Object.keys(v);
  const proto = typeof v === 'object' ? Object.getOwnPropertyNames(Object.getPrototypeOf(v) ?? {}) : [];
  return { type: typeof v, keys: keys.slice(0, 40), protoMethods: proto.filter((k) => k !== 'constructor').slice(0, 40) };
};

export function apply(ctx) {
  void run(ctx).catch((e) => {
    try {
      const out = JSON.parse(fs.readFileSync(OUT, 'utf8'));
      out.fatal = errText(e);
      out.completedAt = new Date().toISOString();
      out.completedOk = false;
      fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
    } catch {
      fs.writeFileSync(OUT, JSON.stringify({ fatal: errText(e), completedOk: false }, null, 2));
    }
  });
}

async function collectStream(streamable) {
  const text = [];
  if (streamable && typeof streamable[Symbol.asyncIterator] === 'function') {
    let n = 0;
    for await (const chunk of streamable) {
      if (typeof chunk === 'string') text.push(chunk);
      else if (chunk?.type?.endsWith('delta') && typeof chunk.text === 'string') text.push(chunk.text);
      else if (chunk?.type === 'finish') text.push(`[finish ${JSON.stringify(chunk.reason ?? {})}]`);
      else text.push(JSON.stringify(chunk));
      if (++n >= 40) break;
    }
    return { via: 'asyncIterable', chunks: n, text: text.join('').slice(0, 600) };
  }
  const awaited = await streamable;
  return { via: 'promise', value: JSON.stringify(awaited)?.slice(0, 600) };
}

async function run(ctx) {
  const out = { startedAt: new Date().toISOString() };
  const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  save();

  // ---- (a) translator 服务与 providers ----
  // 实测教训（首跑 fatal）：Cordis 属性访问未 inject 的服务会抛错，一律走 ctx.get
  const translator = ctx.get?.('translator');
  out.translator = { present: !!translator, shape: translator ? shape(translator) : null };
  if (translator) {
    try {
      out.providers = await withTimeout(translator.availableProviders(), 10000, 'availableProviders');
    } catch (e) {
      out.providersError = errText(e);
    }
    // ---- (b) 匿名 google/bing 实测 ----
    for (const provider of ['google', 'bing']) {
      const rec = {};
      const t0 = Date.now();
      try {
        const spec = await withTimeout(
          translator.resolve({ text: SAMPLE, targetLanguage: 'zh', provider }),
          15000, `${provider}.resolve`,
        );
        rec.resolveOk = true;
        rec.specShape = shape(spec);
        const res = await withTimeout(translator.translate(spec), 30000, `${provider}.translate`);
        rec.translateOk = true;
        rec.zh = String(res?.text ?? res ?? '').slice(0, 200);
      } catch (e) {
        rec.error = errText(e);
        rec.code = e?.code;
      }
      rec.ms = Date.now() - t0;
      out[provider] = rec;
      save();
    }
  }

  // ---- (c) llm 形状 + 当前选择模型 + 实发一条 ----
  const llm = ctx.get?.('llm');
  out.llm = { present: !!llm, shape: llm ? shape(llm) : null };
  const adm = ctx.get?.('agentDefaultModel');
  out.agentDefaultModel = { present: !!adm, shape: adm ? shape(adm) : null };
  // 实测方法名 = currentSelection（首轮探针 protoMethods 证实）
  let selection = null;
  if (adm && typeof adm.currentSelection === 'function') {
    try {
      selection = await withTimeout(adm.currentSelection(), 5000, 'adm.currentSelection');
      out.currentSelection = JSON.parse(JSON.stringify(selection ?? null));
    } catch (e) { out.currentSelectionError = errText(e); }
  }
  if (llm) {
    try { out.llmProviders = (await withTimeout(llm.listProviders(), 10000, 'llm.listProviders'))?.map?.((p) => (p && typeof p === 'object' ? { id: p.id, name: p.name } : p)); }
    catch (e) { out.llmProvidersError = errText(e); }
    for (const p of (out.llmProviders ?? []).slice(0, 5)) {
      const pid = p?.id ?? p;
      // v3 教训：listModels 的参数对象被整包当 provider 串（"[object Object]"）——试 {providerId} 与裸参两种形状
      let arr = null; let lastErr;
      for (const arg of [{ providerId: pid }, pid]) {
        try {
          const ms = await withTimeout(llm.listModels(arg), 15000, `llm.listModels(${pid})`);
          arr = Array.isArray(ms) ? ms : [];
          break;
        } catch (e) { lastErr = errText(e); }
      }
      if (arr) out[`llm_models_${pid}`] = { count: arr.length, sample: arr.slice(0, 8).map((x) => (typeof x === 'string' ? x : { id: x?.id, name: x?.name })) };
      else out[`llm_models_${pid}_error`] = lastErr;
    }
  }
  save();

  const candidates = [];
  const pick = (s) => s && { provider: s.provider ?? s.providerId, model: s.model ?? s.modelId ?? s.id };
  const c1 = pick(selection);
  if (c1?.provider && c1?.model) candidates.push({ from: 'agentDefaultModel.currentSelection', ...c1 });
  out.llmScenarios = { ran: [] };
  if (llm && typeof llm.stream === 'function') {
    for (const c of candidates.slice(0, 2)) {
      const rec = { candidate: c };
      const t0 = Date.now();
      try {
        // 首轮实发教训：适配器要 content 分块数组（content.some），非纯字符串
        const r = llm.stream({ provider: c.provider, model: c.model, messages: [{ role: 'user', content: [{ type: 'text', text: `Translate to Chinese in <=20 tokens, reply with translation only: "${SAMPLE}"` }] }] });
        rec.result = await withTimeout(collectStream(r), 45000, 'llm.stream');
        rec.ok = true;
      } catch (e) { rec.error = errText(e); rec.code = e?.code; }
      rec.ms = Date.now() - t0;
      out.llmScenarios.ran.push(rec);
      save();
    }
  }

  out.completedAt = new Date().toISOString();
  out.completedOk = true;
  save();
}
