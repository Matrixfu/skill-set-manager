/**
 * 备份与回收站（§8.8）：`~/.dsh/skill-library/.backups/<name>/<ts>/`（库目录点开头
 * 天然不被 libraryList 列出）；快照先写 `.tmp` 再 rename 发布——半成品永不成为恢复
 * 源（Review Focus #3）；保留 = 每技能最近 10 份或 30 天先到为准。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { copyDirTree } from './github.js';
import { walkFiles } from './manifest.js';

const DAYS = 30 * 24 * 3600 * 1000;
const KEEP = 10;

function backupsRoot(roots) {
  return path.join(roots.libraryRoot, '.backups');
}

/** 整技能快照（含 .manifest.json）；返回已发布目录。 */
export function snapshot(roots, name, { fs: fsImpl = fs } = {}) {
  const src = path.join(roots.libraryRoot, name);
  fsImpl.statSync(src); // 不存在 → 直接 throw（调用方归一）
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const pub = path.join(backupsRoot(roots), name, ts);
  const tmp = `${pub}.tmp`;
  fsImpl.mkdirSync(path.dirname(pub), { recursive: true });
  try {
    fsImpl.rmSync(tmp, { recursive: true, force: true });
    copyDirTree(src, tmp, fsImpl);
    // 快照自记「盘上内容摘要」：manifest.files 对 skip 文件是上游基线哈希而非盘上值，
    // 不能用作恢复校验基准（活体冒烟教训）——.snapshot.json 才是内容口径。
    fsImpl.writeFileSync(path.join(tmp, '.snapshot.json'), JSON.stringify({ ts, files: walkFiles(src, { fs: fsImpl }) }, null, 2) + '\n');
    fsImpl.renameSync(tmp, pub);
  } catch (e) {
    try { fsImpl.rmSync(tmp, { recursive: true, force: true }); } catch {}
    throw e;
  }
  prune(roots, name, { fs: fsImpl });
  return pub;
}

/** 保留策略：按 mtime 降序，超出 10 份或超 30 天者删除。 */
export function prune(roots, name, { fs: fsImpl = fs, now = Date.now() } = {}) {
  const root = path.join(backupsRoot(roots), name);
  let names;
  try { names = fsImpl.readdirSync(root); } catch { return; }
  const dirs = names
    .filter((n) => !n.endsWith('.tmp'))
    .map((n) => {
      const dir = path.join(root, n);
      let mtime = now;
      try { mtime = fsImpl.statSync(dir).mtimeMs; } catch {}
      return { dir, n, mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);
  dirs.forEach((d, i) => {
    if (i < KEEP && now - d.mtime <= DAYS) return;
    try { fsImpl.rmSync(d.dir, { recursive: true, force: true }); } catch {}
  });
}

/** 已发布快照列表（新→旧），ts=mtime。 */
export function listBackups(roots, name, { fs: fsImpl = fs } = {}) {
  const root = path.join(backupsRoot(roots), name);
  let names;
  try { names = fsImpl.readdirSync(root); } catch { return []; }
  return names
    .filter((n) => !n.endsWith('.tmp'))
    .map((n) => {
      const dir = path.join(root, n);
      let fileCount = 0; let mtime = 0;
      try {
        mtime = fsImpl.statSync(dir).mtimeMs;
        fileCount = countFiles(dir, fsImpl);
      } catch { return null; }
      return { dir, ts: new Date(mtime).toISOString(), fileCount };
    })
    .filter(Boolean)
    .sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

function countFiles(dir, fsImpl) {
  let n = 0;
  for (const ent of fsImpl.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) n += countFiles(path.join(dir, ent.name), fsImpl);
    else n += 1;
  }
  return n;
}

/** 恢复 = 快照整体替换库体 → 以快照 manifest 逐文件哈希复核（§17#10 判定）。 */
export function restore(roots, name, backupDir, { fs: fsImpl = fs } = {}) {
  const dst = path.join(roots.libraryRoot, name);
  fsImpl.statSync(backupDir);
  // 覆盖式恢复先对现存库体自动快照（Review Focus #2：overwrite 必先备份，恢复不得静默吞掉当前内容）
  let had = false;
  try { fsImpl.statSync(dst); had = true; } catch {}
  if (had) snapshot(roots, name, { fs: fsImpl });
  fsImpl.rmSync(dst, { recursive: true, force: true });
  copyDirTree(backupDir, dst, fsImpl);
  // 校验基准优先 .snapshot.json（盘上内容口径）；旧快照无此文件时退回 manifest（内容≈manifest 时代）。
  let basis = null;
  for (const f of ['.snapshot.json', '.manifest.json']) {
    try { basis = JSON.parse(fsImpl.readFileSync(path.join(dst, f), 'utf8')); break; } catch {}
  }
  let verified = false;
  if (basis && basis.files) {
    verified = true;
    for (const [p, h] of Object.entries(basis.files)) {
      try {
        const buf = fsImpl.readFileSync(path.join(dst, p));
        const hex = crypto.createHash('sha256').update(buf).digest('hex');
        if (`sha256:${hex}` !== h) { verified = false; break; }
      } catch { verified = false; break; }
    }
  }
  return { verified };
}
