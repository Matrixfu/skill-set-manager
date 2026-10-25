/**
 * 卸载（§8.7）：确认由 UI 层做，本模块执行——备份 → 删库体 → 所有技能集移除该名 →
 * 按各项目 .managed.json 精确回收（冻结项目不动）→ 可回滚操作日志。
 * bindings = 候选项目根列表（host 半从 bindings 索引提供；ADR-0003 只动托管条目）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { snapshot } from './backup.js';
import { listSets, loadSet, saveSet } from './sets.js';
import { readBinding } from './binding.js';
import { readManaged, writeManaged } from './managed.js';
import { planEffective, applyPlan } from './effective.js';
import { entryKind, removeEntry } from './linkx.js';

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
  let log = [];
  try { log = JSON.parse(fsImpl.readFileSync(logFile, 'utf8')); } catch {}
  log.push({ ts: new Date().toISOString(), action: 'uninstall', name, backup, removedFromSets, rewrittenProjects, frozenProjects });
  fsImpl.mkdirSync(path.dirname(logFile), { recursive: true });
  fsImpl.writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n');

  return { backup, removedFromSets, rewrittenProjects, frozenProjects, warnings };
}
