/** 扫描登记（§8.1）：为库内缺 manifest 的技能补写 .manifest.json（本地技能 source:'unknown'）。 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseFrontmatter } from './resolver.js';
import { writeTextAtomic } from './atomic.js';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function walkFiles(root, { fs: fsImpl = fs }) {
  const files = {};
  const walk = (dir, rel) => {
    for (const ent of fsImpl.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name.startsWith('.')) continue; // .manifest.json 自身与点目录一律不进哈希表
      const abs = path.join(dir, ent.name);
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      const st = fsImpl.statSync(abs); // 跟随 junction
      if (st.isDirectory()) walk(abs, r);
      else if (st.isFile()) files[r] = 'sha256:' + sha256(fsImpl.readFileSync(abs));
    }
  };
  walk(root, '');
  return files;
}

/** 逐文件哈希 + 目录摘要（§11 manifest 形状，#8 验收字段）。 */
export function registerLibrary(roots, { fs: fsImpl = fs } = {}) {
  const registered = [];
  const manifests = [];
  let names;
  try { names = fsImpl.readdirSync(roots.libraryRoot); } catch { return { registered, manifests }; }
  for (const name of names) {
    if (name.startsWith('.')) continue;
    const dir = path.join(roots.libraryRoot, name);
    try { if (!fsImpl.statSync(dir).isDirectory()) continue; } catch { continue; }
    const mfPath = path.join(dir, '.manifest.json');
    try { fsImpl.statSync(mfPath); continue; } catch {} // 已有 manifest 不覆盖
    let skillMd;
    try { skillMd = fsImpl.readFileSync(path.join(dir, 'SKILL.md'), 'utf8'); } catch { continue; }
    const fm = parseFrontmatter(skillMd);
    const files = walkFiles(dir, { fs: fsImpl });
    const dirDigest = 'sha256:' + sha256(Buffer.from(
      Object.entries(files).sort().map(([k, v]) => `${k}:${v}`).join('\n'),
    ));
    const manifest = {
      name: (fm && fm.name) || name,
      source: 'unknown',
      commit: null,
      installedAt: new Date().toISOString(),
      managed: true,
      files,
      dirDigest,
    };
    writeTextAtomic(mfPath, JSON.stringify(manifest, null, 2) + '\n', { fs: fsImpl });
    registered.push(manifest.name);
    manifests.push(mfPath);
  }
  return { registered, manifests };
}
