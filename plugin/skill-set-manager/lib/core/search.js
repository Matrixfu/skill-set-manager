/**
 * P3 搜索匹配器（设计 §6.2）：纯函数零依赖，host CASES 与 client（web bundle）共用同一实现。
 * 口径：归一化（小写 + 全半角折叠）→ 空白分 token，token 间 AND、字段间 OR（每 token 须命中同一行的任一字段）；
 * 排序 = 名称前缀 > 名称包含 > 其余，同级按名称字典序。
 */
export function normalize(s) {
  if (typeof s !== 'string') return '';
  return s
    .toLowerCase()
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)) // 全角 ASCII → 半角
    .replace(/\u3000/g, ' '); // 全角空格
}

export function searchRows(rows, query, fields = ['name', 'source', 'description', 'descriptionZh']) {
  const list = Array.isArray(rows) ? rows : [];
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return list.slice();
  const scored = [];
  for (const row of list) {
    const vals = fields.map((f) => normalize(row?.[f]));
    if (!tokens.every((t) => vals.some((v) => v.includes(t)))) continue; // token AND、字段 OR
    const name = vals[0];
    const rank = tokens.every((t) => name.startsWith(t)) ? 0 : tokens.every((t) => name.includes(t)) ? 1 : 2;
    scored.push({ row, rank });
  }
  scored.sort((a, b) => a.rank - b.rank || String(a.row?.name ?? '').localeCompare(String(b.row?.name ?? '')));
  return scored.map((s) => s.row);
}
