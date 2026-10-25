/**
 * 生效清单生成（§7）：项目目录 = 集条目（常驻经全局生效区可见，§5.3）；
 * 只对 managed 条目做增量；外来条目（含同名冲突）不进 plan、不动不删（ADR-0003）；
 * 悬空引用 warnMissing、不静默写入（§7.4）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadSet, RESIDENT_SLUG } from './sets.js';
import { resolveSkillTargets } from './resolver.js';
import { readManaged, writeManaged } from './managed.js';
import { readBinding } from './binding.js';
import { makeEntry, removeEntry, entryKind } from './linkx.js';

export async function planEffective(roots, projectRoot, setSlug, { fs: fsImpl = fs } = {}) {
  // 项目目录只放集条目；常驻经全局生效区可见（§5.3），display 口径的并集在 sets.effectiveNames。
  const set = setSlug && setSlug !== RESIDENT_SLUG ? loadSet(roots, setSlug) : null;
  const names = [...new Set(set?.skills ?? [])];
  const { targets, missing: unresolved } = await resolveSkillTargets(roots, projectRoot, names, { fs: fsImpl });
  const managed = readManaged(projectRoot, { fs: fsImpl });
  const current = managed?.entries ?? {};
  const targetSet = new Set(names);
  const add = [];
  const warnMissing = [];
  const warnForeign = [];
  const rebuilding = new Set();
  const skillsDir = path.join(projectRoot, '.dsh', 'skills');
  for (const name of names) {
    const t = targets.get(name);
    if (!t) { warnMissing.push(name); continue; } // 悬空引用：警告，不写入
    const kDir = entryKind(path.join(skillsDir, name), { fs: fsImpl });
    const kFile = entryKind(path.join(skillsDir, `${name}.md`), { fs: fsImpl });
    const onDisk = kDir !== 'missing' || kFile !== 'missing';
    if (name in current) {
      if (onDisk) continue; // 正常 keep
      rebuilding.add(name); // 台账在、盘上没了（外删/死链）→ 重新进 add 重建（review M1）
    } else if (onDisk) {
      warnForeign.push({ name, kind: kDir === 'missing' ? kFile : kDir }); // 同名外来条目：不抢占不删除（§7.3/ADR-0003）
      continue;
    }
    add.push({ name, target: t.path, targetKind: t.kind, origin: t.origin });
  }
  const remove = Object.keys(current).filter((name) => !targetSet.has(name)).map((name) => ({ name, kind: current[name].kind }));
  const keep = names.filter((name) => name in current && targets.has(name) && !rebuilding.has(name));
  return { setSlug, add, remove, keep, warnMissing, warnForeign, missing: [...new Set([...unresolved, ...warnMissing])] };
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
    entries[item.name] = { kind: made.kind, from: item.origin ?? item.target, ...(made.copied ? { copied: true } : {}), ...(made.flat ? { flat: true } : {}) };
    if (made.copied) warnings.push(`${item.name}: 链接不可用，已复制（升级不自动传导，可「重新链接」）`);
  }
  for (const name of plan.warnMissing ?? []) warnings.push(`${name}: 技能不存在（悬空引用），未写入`);
  for (const w of plan.warnForeign ?? []) warnings.push(`${w.name}: 生效目录已有同名外来条目（他人所有），未抢占未删除，请改名或移除该条目后重试`);
  writeManaged(projectRoot, { setSlug: plan.setSlug ?? managed.setSlug, entries, sessionOverride: managed.sessionOverride }, { fs: fsImpl });
  return { applied: { added: plan.add.length, removed: plan.remove.length, kept: plan.keep.length }, warnings };
}

/** 读回自检原（§7.5；T5 的 selfCheck 在其上补外来条目/冻结绑定判定）。 */
export function readbackCheck(roots, projectRoot, setSlug, { fs: fsImpl = fs } = {}) {
  const set = setSlug && setSlug !== RESIDENT_SLUG ? loadSet(roots, setSlug) : null;
  const expected = [...new Set(set?.skills ?? [])].sort();
  const actual = [];
  let names2;
  try { names2 = fsImpl.readdirSync(path.join(projectRoot, '.dsh', 'skills')); } catch { names2 = []; }
  for (const n of names2) {
    if (n.startsWith('.')) continue;
    const kind = entryKind(path.join(projectRoot, '.dsh', 'skills', n), { fs: fsImpl });
    if (kind === 'junction' || kind === 'dir' || kind === 'symlink') actual.push(n);
    else if (kind === 'file' && n.endsWith('.md')) actual.push(n.slice(0, -3)); // flat 复制条目
  }
  const actualSet = new Set(actual);
  return {
    ok: expected.every((n) => actualSet.has(n)) && actual.length === expected.length,
    expected,
    actual: [...new Set(actual)].sort(),
    missing: expected.filter((n) => !actualSet.has(n)),
    extra: [...actualSet].filter((n) => !expected.includes(n)).sort(),
  };
}

/**
 * footer 徽标数据源（§7.5 + Review-Focus 1/2）：
 * - 冻结绑定：binding 指向已删除的技能集 → 清单原样保留、不再驱动、红标改绑。
 * - 失效链接：managed 记录的条目在盘上已 missing。
 * - 外来条目：盘上有、managed 没有——只报告不动手（ADR-0003）。
 */
export function selfCheck(roots, projectRoot, { fs: fsImpl = fs } = {}) {
  const binding = readBinding(projectRoot, { fs: fsImpl });
  const managed = readManaged(projectRoot, { fs: fsImpl });
  const base = { ok: true, missing: [], extra: [], foreign: [], brokenLinks: [], frozen: false, unbound: false, binding, setSlug: binding?.setSlug ?? null, detail: '' };
  if (!binding || !binding.setSlug) return { ...base, unbound: true, detail: '未绑定：插件不改动该项目' };
  if (binding.setSlug !== RESIDENT_SLUG && !loadSet(roots, binding.setSlug)) {
    return { ...base, ok: false, frozen: true, detail: `冻结绑定：技能集「${binding.setSlug}」已删除，生效清单原样保留，请改绑` };
  }
  const rc = readbackCheck(roots, projectRoot, binding.setSlug, { fs: fsImpl });
  const skillsDir = path.join(projectRoot, '.dsh', 'skills');
  const entries = managed?.entries ?? {};
  const brokenLinks = Object.keys(entries).filter((name) => {
    const k = entryKind(path.join(skillsDir, entries[name].flat ? `${name}.md` : name), { fs: fsImpl });
    return k === 'missing';
  });
  const foreign = [...new Set([...rc.actual, ...Object.keys(entries)])].filter((n) => !(n in entries)).sort(); // 盘上有、台账无 = 外来（即使名字恰与集重名也不当我托管）
  const ok = rc.ok && brokenLinks.length === 0;
  return {
    ...base,
    ok,
    missing: rc.missing,
    extra: rc.extra,
    foreign,
    brokenLinks,
    detail: ok ? '托管清单与目录一致' : [
      rc.missing.length ? `缺失: ${rc.missing.join(', ')}` : '',
      rc.extra.length ? `多出: ${rc.extra.join(', ')}` : '',
      brokenLinks.length ? `失效链接: ${brokenLinks.join(', ')}` : '',
    ].filter(Boolean).join('；'),
  };
}
