/**
 * 卸载（§8.7）：确认由 UI 层做，本模块执行——备份 → 删库体 → 所有技能集移除该名 →
 * 按各项目 .managed.json 精确回收（冻结项目不动）→ 可回滚操作日志。
 * bindings = 候选项目根列表（host 半从 bindings 索引提供；ADR-0003 只动托管条目）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { snapshot } from './backup.js';
import { listSets, loadSet, saveSet } from './sets.js';
import { readBinding, bindingFile } from './binding.js';
import { readManaged, writeManaged, managedFile } from './managed.js';
import { planEffective, applyPlan } from './effective.js';
import { entryKind, removeEntry } from './linkx.js';
import { writeTextAtomic } from './atomic.js';

export async function uninstallSkill(roots, { name, bindings = [] }, { fs: fsImpl = fs } = {}) {
  const backup = snapshot(roots, name, { fs: fsImpl });
  const libDir = path.join(roots.libraryRoot, name);
  fsImpl.rmSync(libDir, { recursive: true, force: true });

  const removedFromSets = [];
  for (const s of listSets(roots)) {
    const set = loadSet(roots, s.slug);
    if (set && Array.isArray(set.skills) && set.skills.includes(name)) {
      saveSet(roots, { ...set, skills: set.skills.filter((n) => n !== name) });
      removedFromSets.push(set.slug);
    }
  }

  const rewrittenProjects = [];
  const frozenProjects = [];
  const warnings = [];
  for (const projectRoot of bindings) {
    let binding;
    try { binding = readBinding(projectRoot, { fs: fsImpl }); } catch { continue; }
    if (!binding?.setSlug) continue;
    const set = loadSet(roots, binding.setSlug);
    if (!set) { frozenProjects.push(projectRoot); continue; } // 冻结绑定：原样保留（§7.8）
    const managed = readManaged(projectRoot, { fs: fsImpl }) ?? { entries: {} };
    if (managed.entries?.[name]) {
      const entryPath = path.join(projectRoot, '.dsh', 'skills', name);
      try { removeEntry(entryPath, entryKind(entryPath, { fs: fsImpl })); } catch (e) { warnings.push(`${projectRoot}: ${e?.message ?? e}`); }
      delete managed.entries[name];
      writeManaged(projectRoot, managed, { fs: fsImpl });
    }
    try {
      applyPlan(projectRoot, await planEffective(roots, projectRoot, binding.setSlug, { fs: fsImpl }), { fs: fsImpl });
      rewrittenProjects.push(projectRoot);
    } catch (e) { warnings.push(`${projectRoot} 重写失败: ${e?.message ?? e}`); }
  }

  // 可回滚操作日志（回收站根下，与快照同区）
  const logFile = path.join(roots.libraryRoot, '.backups', 'oplog.json');
  const OPLOG_CAP = 200; // 审计流水封顶（review n3/n8）
  let log = [];
  try { log = JSON.parse(fsImpl.readFileSync(logFile, 'utf8')); } catch {}
  log.push({ ts: new Date().toISOString(), action: 'uninstall', name, backup, removedFromSets, rewrittenProjects, frozenProjects });
  if (log.length > OPLOG_CAP) log = log.slice(-OPLOG_CAP); // 封顶保最新（review n8/n3）
  fsImpl.mkdirSync(path.dirname(logFile), { recursive: true });
  writeTextAtomic(logFile, JSON.stringify(log, null, 2) + '\n', { fs: fsImpl }); // 原子写（review m8）

  return { backup, removedFromSets, rewrittenProjects, frozenProjects, warnings };
}

/** 候选项目里绑定到 slug 的全量列表（deleteSet affectedProjects 数据源）。 */
export function findBoundProjects(projectRoots, slug, { fs: fsImpl = fs } = {}) {
  return projectRoots.filter((pr) => {
    try { return readBinding(pr, { fs: fsImpl })?.setSlug === slug; } catch { return false; }
  });
}

/**
 * 解绑（P1a 面板缺口）：删 binding + 按托管清单精确回收全部托管条目 + 删
 * .managed.json。用户自有条目与 .gitignore 行一律不动（ADR-0003）。幂等。
 */
export function unbindProject(projectRoot, { fs: fsImpl = fs } = {}) {
  const binding = readBinding(projectRoot, { fs: fsImpl });
  const managed = readManaged(projectRoot, { fs: fsImpl });
  const removed = [];
  for (const name of Object.keys(managed?.entries ?? {})) {
    const p = path.join(projectRoot, '.dsh', 'skills', name);
    try { removeEntry(p, entryKind(p, { fs: fsImpl })); removed.push(name); } catch {}
  }
  try { fsImpl.rmSync(managedFile(projectRoot), { force: true }); } catch {}
  if (binding) { try { fsImpl.rmSync(bindingFile(projectRoot), { force: true }); } catch {} }
  return { wasBound: !!binding, removed };
}
