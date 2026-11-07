#!/usr/bin/env node
/**
 * client.js UI 门禁（面板美化计划的可执行测试件，见 plans/2026-11-06-composer-panel-beautify）：
 *   ① node --check 语法；
 *   ② DICTS zh/en 键集双向相等（Review Focus #2 单 locale）；
 *   ③ 所有 t('字面键') 在 zh 与 en 都存在（英文界面不露裸键）；
 *   ④ 所有 h(Icon, { n: '字面' }) 的 n ∈ ICON_PATHS（图标引用完整性）；
 *   ⑤ CSS 隔离：旧 .ssm-* 规则区零 ssm-p- 污染、新区只含 .ssm-p- / .ssm-s- / .ssm-chip-btn 三类新前缀（同一视觉轨道的机械证明，spec 2026-11-07 §6.1），
 *      并证明退役旧类（§5.5 矩阵 + Task 6.3 清理清单）既没在 CSS 里长回来、也没被 JS className 字面引用。
 *   ⑥ 面板秒开：Panel 首屏吃 chip 预拉的 bus 快照（seed），且 seed 传入前比对 sessionId。
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

// ⑤ CSS 隔离（ADR-0004 / spec 2026-11-07 §6.1）：旧区（CSS 串开头→「面板美化」标记）零 ssm-p- 污染；
//    新区选择器只许 .ssm-p-*/.ssm-s-*/.ssm-chip-btn（@keyframes 步进 from/to/% 豁免；@media 头剥除）
const MARK = '/* 面板美化';
const mIdx = src.indexOf(MARK);
if (mIdx === -1) fails.push('css-sep: 找不到 CSS 隔离标记「/* 面板美化」');
else {
  const cssStart = src.lastIndexOf('`', mIdx);
  if (cssStart === -1) fails.push('css-sep: 标记不在 CSS 模板串内');
  else {
    const oldRegion = src.slice(cssStart, mIdx);
    if (oldRegion.includes('ssm-p-')) fails.push('css-sep: 旧区出现 ssm-p-（新类写进了旧区，隔离标记形同虚设）');
    // ⑤b 退役类残留（spec 2026-11-07 §5.5 矩阵 + Task 6.3 清理清单）：这些类在设置页/右栏迁移后归零、已删；
    //    CSS 全区（剥注释，历史提及不算）不得再出现，JS 区所有字符串字面量也不得再引用——防「删了又长回来」的机械证明。
    const DELETED = [
      // composer 改版（2026-11-06）前就退役的弹框旧类
      'ssm-overlay', 'ssm-panel', 'ssm-pick', 'ssm-cur-tag', 'ssm-chips', 'ssm-chip',
      // 本次（2026-11-07 Task 6.3）：设置页/右栏迁移后归零 + TaskStrip 明细行迁 banner 语态后归零
      'ssm-head', 'ssm-x', 'ssm-root', 'ssm-task', 'ssm-err', 'ssm-sec', 'ssm-on',
      'ssm-gray', 'ssm-desc-en', 'ssm-empty', 'ssm-settings', 'ssm-tabs', 'ssm-tab', 'ssm-tab-on',
      'ssm-srow', 'ssm-tag', 'ssm-tag-warn', 'ssm-diag-row', 'ssm-lvl', 'ssm-lvl-warn', 'ssm-lvl-error',
      'ssm-lvl-info', 'ssm-rp', 'ssm-click',
      // 新区退役（composer 行骨架收口进 RowShell）
      'ssm-p-rowwrap',
    ];
    const cssAll = src.slice(cssStart, src.indexOf('`', mIdx)).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const cls of DELETED) {
      if (new RegExp('\\.' + cls + '(?![\\w-])').test(cssAll)) fails.push(`css-clean: CSS 残留已删类 .${cls}（清理清单已删，不该再出现）`);
    }
    // JS 扫描口径（终审 Minor 1 增强）：旧实现只吃完整 `className:'…'` 引号字面，
    // 漏 `'a' + (c?'b':'')` 的拼接尾与 `` x ${c?'b':''} `` 模板串内片段（假绿方向）。
    // 改为对 JS 区（CSS 区外）逐字符串字面量扫描：带注释/转义意识的分词器取出每个引号/模板串的内容
    // （模板串连 ${…} 内的嵌套串一并纳入，正是旧版漏掉的片段），再按词边界匹配 DELETED 类
    // （尾界 (?![\w-]) 照旧；前界 (?<![\w-]) 防 ssm-p-* 新类误吃 ssm-* 旧类）。当前实况无引用，增强后仍须 PASS。
    function jsStringLiterals(text) {
      const out = [];
      let i = 0, q = null, esc = false, start = 0, lineC = false, blockC = false;
      while (i < text.length) {
        const c = text[i], n = text[i + 1];
        if (lineC) { if (c === '\n') lineC = false; i++; continue; }
        if (blockC) { if (c === '*' && n === '/') { blockC = false; i += 2; } else i++; continue; }
        if (q) {
          if (esc) { esc = false; i++; continue; }
          if (c === '\\') { esc = true; i++; continue; }
          if (c === q) { out.push(text.slice(start, i)); q = null; i++; continue; }
          i++; continue;
        }
        if (c === '/' && n === '/') { lineC = true; i += 2; continue; }
        if (c === '/' && n === '*') { blockC = true; i += 2; continue; }
        if (c === "'" || c === '"' || c === '`') { q = c; start = i + 1; i++; continue; }
        i++;
      }
      return out;
    }
    for (const lit of jsStringLiterals(src.slice(0, cssStart))) {
      for (const cls of DELETED) {
        if (new RegExp('(?<![\\w-])' + cls + '(?![\\w-])').test(lit)) {
          fails.push(`css-clean: JS 字符串仍引用已删类 .${cls}`);
          break;
        }
      }
    }
    const newRegion = src.slice(mIdx, src.indexOf('`', mIdx));
    for (const raw of newRegion.split('}')) {
      const noComment = raw.replace(/\/\*[\s\S]*?\*\//g, '');
      const brace = noComment.indexOf('{');
      if (brace === -1) continue;
      const sel = noComment.slice(0, brace).replace(/@keyframes[^{]*|@media[^{]*/g, '').trim();
      for (const s of sel.split(',')) {
        const c = s.trim();
        if (!c || /^(from|to|\d+%|0%)$/.test(c)) continue;
        if (!/^\.ssm-(p-|s-|chip-btn)/.test(c)) fails.push(`css-sep: 新区选择器 "${c}" 不属于 .ssm-p-*/.ssm-s-*/.ssm-chip-btn`);
      }
    }
  }
}

// ⑥ 面板秒开（性能回归 2026-11-07）：开面板不得再从 null 起等一轮 RPC——
//    Panel 首屏必须吃 chip 挂载时预拉的 bus 快照，且快照要按 sessionId 比对后才传入（防跨会话串台）。
if (!/function Panel\(\{[^}]*\bseed\b/.test(src)) fails.push('fast-open: Panel 未接 seed 参数（开面板仍从 null 起，骨架屏必然等满一个来回）');
if (!src.includes('React.useState(seed ?? null)')) fails.push('fast-open: Panel 首屏未用 seed 初始化（预拉快照被丢掉）');
if (!src.includes('seed: b.state?.sessionId === b.sessionId ? b.state : null')) fails.push('fast-open: OverlayHost 传入 seed 未比对 sessionId（跨会话快照会串台）');

if (fails.length) {
  console.log('UI GATES: FAIL');
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('UI GATES: PASS');
