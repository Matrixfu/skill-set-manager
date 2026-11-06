#!/usr/bin/env node
/**
 * client.js UI 门禁（面板美化计划的可执行测试件，见 plans/2026-11-06-composer-panel-beautify）：
 *   ① node --check 语法；
 *   ② DICTS zh/en 键集双向相等（Review Focus #2 单 locale）；
 *   ③ 所有 t('字面键') 在 zh 与 en 都存在（英文界面不露裸键）；
 *   ④ 所有 h(Icon, { n: '字面' }) 的 n ∈ ICON_PATHS（图标引用完整性）。
 * 用法: node scripts/ui-gates.mjs  （退出码 0=全绿；FAIL 列明细）
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const FILE = path.resolve(import.meta.dirname, '..', 'plugin', 'skill-set-manager', 'client.js');
const src = fs.readFileSync(FILE, 'utf8');
const fails = [];

// ① 语法
const chk = spawnSync(process.execPath, ['--check', FILE], { encoding: 'utf8' });
if (chk.status !== 0) fails.push(`syntax: ${String(chk.stderr).trim().split('\n')[0]}`);

// 平衡括号切片（跳过字符串字面量），从 startIdx 处的 '{' 起到匹配 '}'
function sliceBalanced(text, startIdx) {
  let depth = 0, i = startIdx, q = null, esc = false;
  for (; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === q) q = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return text.slice(startIdx, i + 1); }
  }
  return null;
}
function evalLiteral(name) {
  const m = new RegExp(`const ${name} = \\{`).exec(src);
  if (!m) return null;
  const lit = sliceBalanced(src, src.indexOf('{', m.index + m[0].length - 1));
  if (!lit) return null;
  try { return new Function(`return ${lit}`)(); } catch { return null; }
}

// ② DICTS zh/en 键集相等
const dicts = evalLiteral('DICTS');
if (!dicts || !dicts.zh || !dicts.en) fails.push('DICTS: 无法提取 zh/en 对象字面量');
else {
  const zh = new Set(Object.keys(dicts.zh)), en = new Set(Object.keys(dicts.en));
  for (const k of zh) if (!en.has(k)) fails.push(`locale: 键 "${k}" 只在 zh（en 缺失→英文界面露裸键）`);
  for (const k of en) if (!zh.has(k)) fails.push(`locale: 键 "${k}" 只在 en（zh 缺失）`);

  // ③ t('字面键') 引用完整性（动态 t(var)/t(模板) 不在检查范围）
  for (const m of src.matchAll(/\bt\('([A-Za-z0-9_]+)'\)/g)) {
    const k = m[1];
    if (!zh.has(k)) fails.push(`t(): 键 "${k}" 不在 DICTS.zh`);
    if (!en.has(k)) fails.push(`t(): 键 "${k}" 不在 DICTS.en`);
  }
}

// ④ Icon 引用 ∈ ICON_PATHS（ICON_PATHS 未定义时跳过——Task 1 之前的基线）
const iconPaths = evalLiteral('ICON_PATHS');
if (iconPaths) {
  for (const m of src.matchAll(/h\(Icon,\s*\{[^}]*?\bn:\s*'([a-zA-Z]+)'/g)) {
    if (!(m[1] in iconPaths)) fails.push(`Icon: n="${m[1]}" 不在 ICON_PATHS`);
  }
  for (const [k, v] of Object.entries(iconPaths)) {
    if (typeof v !== 'string' || !v.trim()) fails.push(`ICON_PATHS.${k}: 空或非字符串`);
  }
}

if (fails.length) {
  console.log('UI GATES: FAIL');
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('UI GATES: PASS');
