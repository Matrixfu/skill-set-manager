/**
 * 条目原语（§4.3）：junction 优先（node fs.symlink 'junction'，禁 MSYS ln -s / 禁 symlink 类型），
 * 失败回退复制（副本不随库演进，kind 由调用方写进 .managed.json）。
 * 性质判定照抄取证：readdir Dirent 把 junction 报成 symlink、lstat 反而看不出——
 * 所以 junction 检测用「父目录 Dirent.isSymbolicLink() + stat 是否目录」，其余一律 stat/lstat。
 */
import fs from 'node:fs';
import path from 'node:path';

/** fs 层真相：'junction' | 'symlink' | 'dir' | 'file' | 'missing' | 'other'（copy 与 dir 在 fs 层不可分，归托管清单记）。 */
export function entryKind(linkPath, { fs: fsImpl = fs } = {}) {
  let st;
  try { st = fsImpl.statSync(linkPath); } catch { return 'missing'; } // stat 跟随：失效链接 → missing
  let ents;
  try { ents = fsImpl.readdirSync(path.dirname(linkPath), { withFileTypes: true }); } catch { return 'other'; }
  const ent = ents.find((e) => e.name === path.basename(linkPath));
  if (ent && ent.isSymbolicLink()) return st.isDirectory() ? 'junction' : 'symlink';
  if (st.isDirectory()) return 'dir';
  if (st.isFile()) return 'file';
  return 'other';
}

export function makeEntry(target, linkPath, { fs: fsImpl = fs } = {}) {
  let targetStat;
  try { targetStat = fsImpl.statSync(target); } catch (e) { throw new Error(`链接本体不存在: ${target}`); } // 失效引用在 plan 阶段已挡
  removeEntry(linkPath, undefined, { fs: fsImpl }); // EEXIST 或死 stub 都先清（死 stub stat 失败，removeEntry 走 Dirent 支路）
  fsImpl.mkdirSync(path.dirname(linkPath), { recursive: true });
  if (targetStat.isFile()) {
    // flat <name>.md 本体：文件复制（junction 只用于目录）
    fsImpl.cpSync(target, linkPath);
    return { kind: 'copy', copied: true, flat: true };
  }
  try {
    fsImpl.symlinkSync(target, linkPath, 'junction');
    if (fsImpl.statSync(linkPath).isDirectory()) return { kind: 'junction' };
    throw new Error('junction 建立后不可读');
  } catch {
    try { fsImpl.rmSync(linkPath, { recursive: true, force: true }); } catch {}
    fsImpl.cpSync(target, linkPath, { recursive: true });
    return { kind: 'copy', copied: true };
  }
}

/**
 * 只删条目自身，永不跟随删本体。kind 缺省时按 entryKind 自判；
 * stat 失败但父目录 Dirent 显示仍在（死 junction/死 symlink 挂角）→ 按链摘除，
 * 否则外删条目永远删不掉、重建永远 EEXIST（review M1）。
 */
export function removeEntry(linkPath, kind, { fs: fsImpl = fs } = {}) {
  let k = kind ?? entryKind(linkPath, { fs: fsImpl });
  if (k === 'missing') {
    let ent;
    try {
      ent = fsImpl.readdirSync(path.dirname(linkPath), { withFileTypes: true })
        .find((e) => e.name === path.basename(linkPath));
    } catch { return false; }
    if (!ent) return false; // 盘上真没有：视作已摘
    k = ent.isSymbolicLink() ? 'symlink' : ent.isDirectory() ? 'dir' : 'file';
  }
  try {
    if (k === 'junction' || k === 'symlink') fsImpl.rmdirSync(linkPath); // 摘链接点，不碰本体
    else fsImpl.rmSync(linkPath, { recursive: true, force: true });
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') return false; // 已被外部手删：视作已摘，台账照常收敛
    if (e.code === 'ENOTDIR' || e.code === 'EPERM') {
      // 失效 junction（本体已没了）：rmdir 有时报 ENOTDIR/EPERM，强制摘
      try { fsImpl.rmSync(linkPath, { force: true }); return true; } catch {}
    }
    throw e;
  }
}
