/**
 * 会话临时覆盖（§6.6）：先落 pending 标记再动目录；崩溃残留由启动 restoreAllPending
 * **无条件**还原（按 binding 重放 planEffective+applyPlan）——这是「直接写」设计的前提。
 * 未绑定项目也可起盘覆盖（台账 setSlug 为 null），还原后回到插件零写入（设计 2026-10-28）。
 * undo 快照供技能集切换的一次性撤销（§5.2），消费即删。
 */
import fs from 'node:fs';
import path from 'node:path';
import { projectKey } from './storage.js';
import { readManaged, writeManaged } from './managed.js';
import { readBinding, writeBinding } from './binding.js';
import { planEffective, applyPlan } from './effective.js';
import { loadSet, RESIDENT_SLUG } from './sets.js';
import { resolveSkillTargets } from './resolver.js';
import { makeEntry, removeEntry, entryKind } from './linkx.js';

/**
 * 净覆盖口径：台账 ∖ 集 = added；集 ∖ 台账 = removed。每次 startOverride 全量重算写回，
 * 连续覆盖自然累计合并（用户报：先加 c 再摘 b，第二次把记录整个替换成 {added:[],removed:[b]}，
 * c 失去归属 → 自检误报「多出」红标）；对历史丢记录的状态也起自纠作用。
 * 冻结（集已删）：基线未知无法算净差——退回「前记录 ∪ 本次」累计，冻结还原分支据 added 精确回收（review M9）。
 */
function netOverride(roots, setSlug, entries, prev, { addedThisCall = [], removedThisCall = [] } = {}) {
  const resident = !setSlug || setSlug === RESIDENT_SLUG;
  const setDoc = resident ? null : loadSet(roots, setSlug);
  if (!resident && !setDoc)
    return {
      added: [...new Set([...(prev?.added ?? []), ...addedThisCall])],
      removed: [...new Set([...(prev?.removed ?? []), ...removedThisCall])],
    };
  const base = new Set(setDoc?.skills ?? []); // 常驻绑定：项目目录基线本就为空（§5.3）
  const cur = new Set(Object.keys(entries));
  return { added: [...cur].filter((n) => !base.has(n)), removed: [...base].filter((n) => !cur.has(n)) };
}

export async function startOverride(store, roots, projectRoot, { add = [], remove = [], sessionId = null } = {}, { fs: fsImpl = fs } = {}) {
  const managed = readManaged(projectRoot, { fs: fsImpl }) ?? { setSlug: null, entries: {}, sessionOverride: null }; // 未绑定也可起盘：台账 setSlug 为 null（设计 2026-10-28）
  const snapshot = { setSlug: managed.setSlug, entries: structuredClone(managed.entries), sessionOverride: managed.sessionOverride };
  // 先落标记后动目录（§6.6 崩溃即设计前提）：标记在 = 可还原；目录动了没标记 = 不可还原
  // sessionId = 本次覆盖的归属会话（§6.6「只对本次会话生效」）：事件还原据此判断是否该动手（评审 I1）
  const rec = (added, removed) => ({ projectRoot, setSlug: managed.setSlug, sessionId: sessionId ?? null, previousManaged: snapshot, added, removed });
  await store.put('pending', projectKey(projectRoot), rec([], []));
  const entries = { ...managed.entries };
  const skillsDir = path.join(projectRoot, '.dsh', 'skills');
  const removed = remove.filter((n) => n in entries);
  for (const name of removed) {
    removeEntry(path.join(skillsDir, name), entries[name].kind, { fs: fsImpl });
    delete entries[name];
  }
  const added = [];
  const missingAdd = [];
  if (add.length) {
    const { targets } = await resolveSkillTargets(roots, projectRoot, add, { fs: fsImpl });
    for (const name of add) {
      const t = targets.get(name);
      if (!t) { missingAdd.push(name); continue; }
      if (entryKind(path.join(skillsDir, name), { fs: fsImpl }) !== 'missing') { missingAdd.push(name); continue; } // 同名外来条目：不抢占（§7.3）
      const made = makeEntry(t.path, path.join(skillsDir, name), { fs: fsImpl });
      entries[name] = { kind: made.kind, from: t.origin ?? t.path, ...(made.copied ? { copied: true } : {}), ...(made.flat ? { flat: true } : {}) };
      added.push(name);
    }
  }
  // 先写标记后动目录的反序风险取「先落标记」：标记在 = 可还原；目录动了没标记 = 不可还原
  writeManaged(projectRoot, { setSlug: managed.setSlug, entries, sessionOverride: netOverride(roots, managed.setSlug, entries, managed.sessionOverride, { addedThisCall: added, removedThisCall: removed }) }, { fs: fsImpl });
  await store.put('pending', projectKey(projectRoot), rec(added, removed));
  return { ...snapshot, missingAdd };
}

/** 手动结束覆盖：按 binding 还原目录，清标记（面板按钮=用户明示意图，无条件执行）。 */
export async function endOverride(store, roots, projectRoot) {
  const key = projectKey(projectRoot);
  const rec = await store.get('pending', key);
  if (!rec) return false;
  const restored = await restoreProject(roots, rec.projectRoot);
  await store.delete('pending', key);
  return restored; // 已解绑/冻结无可还原目标：如实返回，标记照样清掉
}

/**
 * 事件级还原（§6.6 P2）：会话结束/归档时**有 pending 标记才动手**——
 * 真相源是 pending 记录（startOverride 先落标记后动目录），因此对未覆盖项目零副作用。
 * 无标记时不动目录也不写文件，事件可以每个会话都挂而不用担心误伤。
 * **归属判定（评审 I1）**：记录带 sessionId 且与本次结束的会话不同 → 跳过；
 * 旧记录（无 sessionId）或拿不到结束会话 id 时按 P1 口径照还原。
 */
export async function endOverrideIfActive(store, roots, projectRoot, endingSessionId = null) {
  const rec = await store.get('pending', projectKey(projectRoot));
  if (!rec) return { ended: false };
  if (rec.sessionId && endingSessionId && rec.sessionId !== endingSessionId)
    return { ended: false, skipped: 'other-session', projectRoot, ownerSession: rec.sessionId };
  const ended = await endOverride(store, roots, projectRoot);
  return { ended: !!ended, projectRoot };
}

async function restoreProject(roots, projectRoot) {
  const binding = readBinding(projectRoot);
  if (!binding?.setSlug) return false; // 未绑定/已解绑：无目标态可还原
  // 冻结绑定（集已删，§5.8「清单原样保留」）：不按空清单重放（那会摘光托管条目，评审 M9）；
  // 只摘本次覆盖加的条目，其余条目与台账原样留着，等用户改名/重建集。
  if (binding.setSlug !== RESIDENT_SLUG && !loadSet(roots, binding.setSlug)) {
    const mg = readManaged(projectRoot);
    if (mg?.sessionOverride) {
      const skillsDir = path.join(projectRoot, '.dsh', 'skills');
      for (const n of mg.sessionOverride.added ?? []) {
        const kind = mg.entries?.[n]?.kind;
        if (kind) removeEntry(path.join(skillsDir, n), kind);
        if (mg.entries) delete mg.entries[n];
      }
      writeManaged(projectRoot, { ...mg, sessionOverride: null });
    }
    return false;
  }
  // 还原=放弃会话覆盖回到绑定态：先清 sessionOverride 标记再收敛盘，否则
  // planEffective 按覆盖口径收敛、覆盖标记与盘面互相矛盾（活体口径教训）。
  const managed = readManaged(projectRoot);
  if (managed && managed.sessionOverride) writeManaged(projectRoot, { ...managed, sessionOverride: null });
  applyPlan(projectRoot, await planEffective(roots, projectRoot, binding.setSlug));
  return true;
}

/** 启动无条件扫描（§6.6：崩溃即设计前提，不做「是否本会话」判断）。 */
export async function restoreAllPending(store, roots) {
  const restored = [];
  const warnings = [];
  for (const key of await store.keys('pending')) {
    const rec = await store.get('pending', key);
    if (!rec) continue;
    try {
      if (await restoreProject(roots, rec.projectRoot)) restored.push(rec.projectRoot);
    } catch (e) {
      warnings.push(`${rec.projectRoot}: 启动还原失败（${e.message}）`);
      continue; // 保留标记，下次启动再试
    }
    await store.delete('pending', key);
  }
  return { restored, warnings };
}

/** 切换前快照（binding + managed）；一次性：applyUndo 消费即删。 */
export async function pushUndo(store, roots, projectRoot) {
  const binding = readBinding(projectRoot);
  if (!binding) return null;
  const managed = readManaged(projectRoot);
  const snap = {
    projectRoot,
    setSlug: binding.setSlug,
    managed: managed ? { entries: managed.entries, sessionOverride: managed.sessionOverride } : null,
    pushedAt: new Date().toISOString(),
  };
  await store.put('undo', projectKey(projectRoot), snap);
  return snap;
}

export async function popUndo(store, projectRoot) {
  const key = projectKey(projectRoot);
  const snap = await store.get('undo', key);
  if (snap) await store.delete('undo', key);
  return snap;
}

/** 撤销 = 还原 binding 并重放该集生效清单（目录回到切换态）。 */
export async function applyUndo(store, roots, projectRoot) {
  const snap = await popUndo(store, projectRoot);
  if (!snap) return false;
  if (snap.setSlug) {
    writeBinding(projectRoot, snap.setSlug);
    // 先回写快照台账（含其 sessionOverride），再按快照口径收敛盘——顺序颠倒
    // 会让 planEffective 读到撤销前的覆盖标记、还原不出快照里的条目。
    const mg = snap.managed ? { setSlug: snap.setSlug, entries: snap.managed.entries ?? {}, sessionOverride: snap.managed.sessionOverride ?? null } : null;
    if (mg) writeManaged(projectRoot, mg);
    applyPlan(projectRoot, await planEffective(roots, projectRoot, snap.setSlug));
  }
  return true;
}
