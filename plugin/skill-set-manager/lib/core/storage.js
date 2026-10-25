/**
 * 状态存储（§11）：首选 ctx.storageDomain 自声明（探针已证可用），
 * 失败回退 `<dshHome>/skill-set-manager/<table>/<key>.json`。
 * 两者暴露同一 StateStore 接口 {get,put,delete,keys}，core 其余部分不感知差异。
 * key 必须 path-safe：项目键用会话目录同款编码（--C-AI-...--），天然满足 [a-zA-Z0-9_-]+。
 */
import fs from 'node:fs';
import path from 'node:path';

export const DOMAIN_NAME = 'skill_set_manager'; // 下划线：UNIT_NAME_RE 拒绝连字符（探针取证）
export const KEY_RE = /^[a-zA-Z0-9_-]+$/;

export function projectKey(p) {
  return '--' + String(p).replace(/[\\/:]+/g, '-') + '--';
}

export function makeFallbackStore(dir) {
  const tableDir = (t) => {
    if (!/^[a-z][a-z0-9_]*$/.test(t)) throw new Error(`非法表名: ${t}`);
    return path.join(dir, t);
  };
  const file = (t, k) => {
    if (!KEY_RE.test(k)) throw new Error(`非法记录 key（须 path-safe）: ${k}`);
    return path.join(tableDir(t), `${k}.json`);
  };
  return {
    kind: 'fallback',
    async get(t, k) {
      try { return JSON.parse(fs.readFileSync(file(t, k), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    },
    async put(t, k, v) {
      fs.mkdirSync(tableDir(t), { recursive: true });
      const tmp = file(t, k) + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(v, null, 2) + '\n');
      fs.renameSync(tmp, file(t, k)); // 半写不落正式文件
    },
    async delete(t, k) {
      try { fs.unlinkSync(file(t, k)); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; }
    },
    async keys(t) {
      let names;
      try { names = fs.readdirSync(tableDir(t)); } catch { return []; }
      return names.filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5));
    },
    async close() {},
  };
}

/**
 * 打开 domain（tables: pending/undo/oplog），失败回退。
 * @param ctx - 插件 Context（storageDomain 访问器）。
 * @param fallbackDir - 回退目录根（生产传 roots.dshHome）。
 */
export async function openDomain(ctx, { fallbackDir } = {}) {
  try {
    const mod = await import('zod');
    const z = mod.default ?? mod;
    const domain = await ctx.storageDomain.open({
      name: DOMAIN_NAME,
      version: 1,
      layout: 'per-record',
      tables: {
        pending: { valueSchema: z.object({ projectRoot: z.string(), setSlug: z.string().nullable(), previousManaged: z.unknown(), added: z.array(z.string()), removed: z.array(z.string()) }) },
        undo: { valueSchema: z.object({ projectRoot: z.string(), setSlug: z.string().nullable(), managed: z.unknown(), pushedAt: z.string() }) },
        oplog: { valueSchema: z.object({ at: z.string(), kind: z.string(), detail: z.unknown() }) },
        bindings: { valueSchema: z.object({ projectRoot: z.string() }) },
        migration: { valueSchema: z.object({ moved: z.array(z.object({ name: z.string(), from: z.string(), to: z.string() })) }) },
      },
    });
    return {
      kind: 'domain',
      domain,
      async get(t, k) { return domain.table(t).get(k) ?? null; },
      async put(t, k, v) { return domain.table(t).put(k, v); },
      async delete(t, k) { return domain.table(t).delete(k); },
      async keys(t) { return [...domain.table(t).keys()]; },
      async close() { return domain.close(); },
    };
  } catch (e) {
    ctx?.logger?.warn?.(`skill-set-manager: storageDomain.open 失败（${e?.message}），回退 JSON 目录 ${fallbackDir}`);
    if (!fallbackDir) throw e;
    return makeFallbackStore(path.join(fallbackDir, 'skill-set-manager'));
  }
}
