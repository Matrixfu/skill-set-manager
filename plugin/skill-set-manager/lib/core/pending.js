/**
 * 会话临时覆盖（§6.6）：先落 pending 标记再动目录；崩溃残留由启动 restoreAllPending
 * **无条件**还原（按 binding 重放 planEffective+applyPlan）——这是「直接写」设计的前提。
 * undo 快照供技能集切换的一次性撤销（§5.2），消费即删。
 */
import fs from 'node:fs';
import path from 'node:path';
import { projectKey } from './storage.js';
import { readManaged, writeManaged } from './managed.js';
import { readBinding, writeBinding } from './binding.js';
import { planEffective, applyPlan } from './effective.js';
import { resolveSkillTargets } from './resolver.js';
import { makeEntry, removeEntry, entryKind } from './linkx.js';

export async function startOverride(store, roots, projectRoot, { add = [], remove = [] } = {}, { fs: fsImpl = fs } = {}) {
  const managed = readManaged(projectRoot, { fs: fsImpl });
  if (!managed) throw new Error('临时覆盖要求该项目已绑定技能集（无托管清单）');
  const snapshot = { setSlug: managed.setSlug, entries: structuredClone(managed.entries), sessionOverride: managed.sessionOverride };
  // 先落标记后动目录（§6.6 崩溃即设计前提）：标记在 = 可还原；目录动了没标记 = 不可还原
  await store.put('pending', projectKey(projectRoot), { projectRoot, setSlug: managed.setSlug, previousManaged: snapshot, added: [], removed: [] });
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
  writeManaged(projectRoot, { setSlug: managed.setSlug, entries, sessionOverride: { added, removed } }, { fs: fsImpl });
  await store.put('pending', projectKey(projectRoot), { projectRoot, setSlug: managed.setSlug, previousManaged: snapshot, added, removed });
  return { ...snapshot, missingAdd };
}

/** 手动结束覆盖：按 binding 还原目录，清标记。 */
export async function endOverride(store, roots, projectRoot) {
  const key = projectKey(projectRoot);
  const rec = await store.get('pending', key);
  if (!rec) return false;
  await restoreProject(roots, rec.projectRoot);
  await store.delete('pending', key);
  return true;
}

async function restoreProject(roots, projectRoot) {
  const binding = readBinding(projectRoot);
  if (!binding?.setSlug) return false; // 未绑定/已解绑：无目标态可还原
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
