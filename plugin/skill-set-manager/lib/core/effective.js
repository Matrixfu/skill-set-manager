/**
 * 生效清单生成（§7）：目标 = 常驻 ∪ 集；只对 managed 条目做增量；
 * 外来条目不进 plan、不动不删（ADR-0003）；悬空引用 warnMissing、不静默写入（§7.4）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { effectiveNames } from './sets.js';
import { resolveSkillTargets } from './resolver.js';
import { readManaged, writeManaged } from './managed.js';
import { makeEntry, removeEntry, entryKind } from './linkx.js';

export async function planEffective(roots, projectRoot, setSlug, { fs: fsImpl = fs } = {}) {
  const { names, missing } = effectiveNames(roots, setSlug);
  const { targets } = await resolveSkillTargets(roots, projectRoot, names, { fs: fsImpl });
  const managed = readManaged(projectRoot, { fs: fsImpl });
  const current = managed?.entries ?? {};
  const targetSet = new Set(names);
  const add = [];
  const warnMissing = [];
  for (const name of names) {
    const t = targets.get(name);
    if (!t) { warnMissing.push(name); continue; } // 悬空引用：警告，不写入
    if (!(name in current)) add.push({ name, target: t.path, targetKind: t.kind });
  }
  const remove = Object.keys(current).filter((name) => !targetSet.has(name)).map((name) => ({ name, kind: current[name].kind }));
  const keep = names.filter((name) => name in current && targets.has(name));
  return { setSlug, add, remove, keep, warnMissing, missing: [...new Set([...missing, ...warnMissing])] };
}

/** 直接写（崩溃即设计前提，§6.6）：写前快照由 undo 层负责，这里只落盘。 */
export function applyPlan(projectRoot, plan, { fs: fsImpl = fs } = {}) {
  const managed = readManaged(projectRoot, { fs: fsImpl }) ?? { setSlug: null, entries: {}, sessionOverride: null };
  const entries = { ...managed.entries };
  const warnings = [];
  const skillsDir = path.join(projectRoot, '.dsh', 'skills');
  for (const item of plan.remove) {
    removeEntry(path.join(skillsDir, item.name), item.kind, { fs: fsImpl });
    delete entries[item.name];
  }
  for (const item of plan.add) {
    const made = makeEntry(item.target, path.join(skillsDir, item.name), { fs: fsImpl });
    entries[item.name] = { kind: made.kind, from: item.target, ...(made.copied ? { copied: true } : {}), ...(made.flat ? { flat: true } : {}) };
    if (made.copied) warnings.push(`${item.name}: 链接不可用，已复制（升级不自动传导，可「重新链接」）`);
  }
  for (const name of plan.warnMissing ?? []) warnings.push(`${name}: 技能不存在（悬空引用），未写入`);
  writeManaged(projectRoot, { setSlug: plan.setSlug ?? managed.setSlug, entries, sessionOverride: managed.sessionOverride }, { fs: fsImpl });
  return { applied: { added: plan.add.length, removed: plan.remove.length, kept: plan.keep.length }, warnings };
}

/** 读回自检原（§7.5；T5 的 selfCheck 在其上补外来条目/冻结绑定判定）。 */
export function readbackCheck(roots, projectRoot, setSlug, { fs: fsImpl = fs } = {}) {
  const { names } = effectiveNames(roots, setSlug);
  const actual = [];
  let names2;
  try { names2 = fsImpl.readdirSync(path.join(projectRoot, '.dsh', 'skills')); } catch { names2 = []; }
  for (const n of names2) {
    if (n.startsWith('.')) continue;
    const kind = entryKind(path.join(projectRoot, '.dsh', 'skills', n), { fs: fsImpl });
    if (kind === 'junction' || kind === 'dir' || kind === 'symlink') actual.push(n);
    else if (kind === 'file' && n.endsWith('.md')) actual.push(n.slice(0, -3)); // flat 复制条目
  }
  const expected = [...names].sort();
  const actualSet = new Set(actual);
  return {
    ok: expected.every((n) => actualSet.has(n)) && actual.length === expected.length,
    expected,
    actual: [...new Set(actual)].sort(),
    missing: expected.filter((n) => !actualSet.has(n)),
    extra: [...actualSet].filter((n) => !expected.includes(n)).sort(),
  };
}
