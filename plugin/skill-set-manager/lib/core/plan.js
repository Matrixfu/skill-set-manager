/**
 * 「期望名 → 盘面差异」的唯一算法（架构评审候选 3）。
 *
 * 常驻区（resident.js，台账 = 每目录一份 links 记录）与项目生效区（effective.js，
 * 台账 = .managed.json 的 entries）此前各写一遍同样的五分类：
 * - 台账在 · 盘在   → 保持（resident 仍会重跑 makeEntry：那是「先摘再建」的修复语义）
 * - 台账在 · 盘没了 → 重建（外删/死链，review M1）
 * - 台账无 · 盘上有 → 外来：警告，不抢占不删除（ADR-0003）
 * - 解析不到       → 悬空：警告，不落盘（§7.4）
 * - 台账有 · 期望无 → 摘除
 * 两个区的 apply 差异是领域差异（常驻区无台账文件、项目区有 copied/flat 标记），不在此处参数化。
 */
export function diffPlan({ names, ledger = {}, resolve, probe }) {
  const add = [];
  const keep = [];
  const warnMissing = [];
  const warnForeign = [];
  for (const name of names) {
    const target = resolve(name);
    if (!target) { warnMissing.push(name); continue; }
    const disk = probe(name);
    if (name in ledger) {
      if (disk.onDisk) { keep.push(name); continue; }
      add.push({ name, ...target });
      continue;
    }
    if (disk.onDisk) { warnForeign.push({ name, kind: disk.kind }); continue; }
    add.push({ name, ...target });
  }
  const wanted = new Set(names);
  const remove = Object.keys(ledger).filter((n) => !wanted.has(n)).map((n) => ({ name: n, kind: ledger[n].kind }));
  return { add, remove, keep, warnMissing, warnForeign };
}
