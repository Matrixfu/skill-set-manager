/**
 * 常驻技能 = 从库链入全局生效区的那一小撮条目（§4.2/§5.3）——与项目生效同一链接机制，两处复用。
 * 全局生效区既有内容他人所有：同名不抢占、退常驻只精确回收自建链接（links 台账）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadResident, saveResident } from './sets.js';
import { makeEntry, removeEntry, entryKind } from './linkx.js';
import { diffPlan } from './plan.js';

/**
 * M4（终审 2026-10-26）：卸载常驻技能时从常驻名单剔除该名（调用方随后 syncResident 回收链接）。
 * 否则名单幽灵名在 P3 弹窗语料里以灰行显示「已在所有项目生效」而实无库体无链接，文案失真。
 * 命中返回 true；名单外返回 false（幂等）。
 */
export function dropResidentName(roots, name) {
  const doc = loadResident(roots);
  if (!doc.skills.includes(name)) return false;
  saveResident(roots, doc.skills.filter((s) => s !== name), { links: doc.links });
  return true;
}

/** 按 resident.json desired 状态同步全部 globalResidentDirs；返回 { linked, ghosts, warnings }。
 *  幽灵名自动收敛（用户报告 2026-10-26：名单内技能体被外部删除 → 弹窗「缺失」幽灵 + 每次启动反复告警）：
 *  库里没有本体的名字 → 回收残留自建链并从名单剔除；回收失败则保留名单下次启动重试。 */
export async function syncResident(roots, { fs: fsImpl = fs } = {}) {
  const doc = loadResident(roots);
  const names = doc.skills;
  const links = doc.links ?? {};
  const warnings = [];
  const ghosts = [];
  for (const dir of roots.globalResidentDirs) {
    const dirLinks = links[dir] ?? {};
    const { add, remove, keep, warnMissing, warnForeign } = diffPlan({
      names,
      ledger: dirLinks,
      resolve: (name) => {
        const target = path.join(roots.libraryRoot, name);
        let ok = false;
        try { ok = fsImpl.statSync(path.join(target, 'SKILL.md')).isFile(); } catch {}
        return ok ? { target } : null;
      },
      probe: (name) => {
        const kind = entryKind(path.join(dir, name), { fs: fsImpl });
        return { onDisk: kind !== 'missing', kind };
      },
    });
    for (const name of warnMissing) { // 幽灵名：回收残留自建链并从名单剔除；回收失败则保留名单下次启动重试
      if (dirLinks[name]) {
        try { removeEntry(path.join(dir, name), dirLinks[name].kind, { fs: fsImpl }); }
        catch (e) { warnings.push(`${name}: 幽灵残链回收失败（名单保留，下次启动重试）: ${e?.message ?? e}`); continue; }
        delete dirLinks[name];
      }
      if (!ghosts.includes(name)) ghosts.push(name);
      warnings.push(`${name}: 库里没有技能体，已从常驻名单自动剔除`);
    }
    for (const w of warnForeign) warnings.push(`${w.name}: 全局生效区已有同名条目（他人所有），未抢占，常驻对该区未生效`);
    // keep 也要重跑 makeEntry：「先摘再建」是修复语义（copied 条目每次机会重试 junction）
    for (const name of [...keep, ...add.map((a) => a.name)]) {
      const made = makeEntry(path.join(roots.libraryRoot, name), path.join(dir, name), { fs: fsImpl });
      dirLinks[name] = { kind: made.kind, ...(made.copied ? { copied: true } : {}) };
      if (made.copied) warnings.push(`${name}: 链接不可用，已复制（升级不自动传导）`);
    }
    for (const item of remove) {
      removeEntry(path.join(dir, item.name), item.kind, { fs: fsImpl });
      delete dirLinks[item.name];
    }
    links[dir] = dirLinks;
  }
  const kept = doc.skills.filter((s) => !ghosts.includes(s));
  saveResident(roots, kept, { links });
  return { linked: kept, ghosts, warnings };
}

/**
 * P3 常驻区搬迁（设计 §6.4/§6.6）：回收「links 台账里有记录、但目录已不在 globalResidentDirs」
 * 的旧区自建链接（默认即 ~/.dsh/skills 遗留链），他人条目（台账无记录）一律不动。幂等。
 */
export async function pruneLegacyResidentLinks(roots, { fs: fsImpl = fs } = {}) {
  const doc = loadResident(roots);
  const links = doc.links ?? {};
  const keep = new Set(roots.globalResidentDirs);
  const pruned = [];
  const warnings = [];
  for (const dir of Object.keys(links)) {
    if (keep.has(dir)) continue;
    const failed = {};
    for (const [name, rec] of Object.entries(links[dir] ?? {})) {
      try { removeEntry(path.join(dir, name), rec?.kind, { fs: fsImpl }); }
      catch (e) { warnings.push(`${dir}/${name}: ${e?.message ?? e}`); failed[name] = rec; continue; } // N1（终审 2026-10-26）：失败项保留台账，下次启动重试（防旧链永驻被扫描区）
      pruned.push({ dir, name });
    }
    if (Object.keys(failed).length) links[dir] = failed;
    else delete links[dir];
  }
  saveResident(roots, doc.skills, { links });
  return { pruned, warnings };
}
