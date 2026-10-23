/**
 * 常驻技能 = 从库链入全局生效区的那一小撮条目（§4.2/§5.3）——与项目生效同一链接机制，两处复用。
 * 全局生效区既有内容他人所有：同名不抢占、退常驻只精确回收自建链接（links 台账）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadResident, saveResident } from './sets.js';
import { makeEntry, removeEntry, entryKind } from './linkx.js';

/** 按 resident.json  desired 状态同步全部 globalResidentDirs；返回 { linked, warnings }。 */
export async function syncResident(roots, { fs: fsImpl = fs } = {}) {
  const doc = loadResident(roots);
  const desired = new Set(doc.skills);
  const links = doc.links ?? {};
  const warnings = [];
  for (const dir of roots.globalResidentDirs) {
    const dirLinks = links[dir] ?? {};
    for (const name of desired) {
      const target = path.join(roots.libraryRoot, name);
      const linkPath = path.join(dir, name);
      let targetOk = false;
      try { targetOk = fsImpl.statSync(path.join(target, 'SKILL.md')).isFile(); } catch {}
      if (!targetOk) { warnings.push(`${name}: 库里没有技能体，未链接`); continue; }
      const mine = dirLinks[name];
      const kind = entryKind(linkPath, { fs: fsImpl });
      if (kind !== 'missing' && !mine) {
        warnings.push(`${name}: 全局生效区已有同名条目（他人所有），未抢占，常驻对该区未生效`);
        continue;
      }
      const made = makeEntry(target, linkPath, { fs: fsImpl });
      dirLinks[name] = { kind: made.kind, ...(made.copied ? { copied: true } : {}) };
      if (made.copied) warnings.push(`${name}: 链接不可用，已复制（升级不自动传导）`);
    }
    for (const name of Object.keys(dirLinks)) {
      if (desired.has(name)) continue;
      removeEntry(path.join(dir, name), dirLinks[name].kind, { fs: fsImpl });
      delete dirLinks[name];
    }
    links[dir] = dirLinks;
  }
  saveResident(roots, doc.skills, { links });
  return { linked: [...desired], warnings };
}
