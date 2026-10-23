/** 项目绑定文件（§11）：<projectRoot>/.dsh/skill-set-binding.json。 */
import fs from 'node:fs';
import path from 'node:path';
import { writeTextAtomic } from './atomic.js';

const bindingFile = (projectRoot) => path.join(projectRoot, '.dsh', 'skill-set-binding.json');

export function readBinding(projectRoot, { fs: fsImpl = fs } = {}) {
  let raw;
  try { raw = fsImpl.readFileSync(bindingFile(projectRoot), 'utf8'); } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw new Error(`${bindingFile(projectRoot)}: 解析失败（文件被手改坏？请人工修复）: ${e.message}`);
  }
  const doc = JSON.parse(raw);
  return { setSlug: doc.setSlug ?? null, updatedAt: doc.updatedAt ?? null };
}

export function writeBinding(projectRoot, setSlug, { fs: fsImpl = fs } = {}) {
  const doc = { setSlug, updatedAt: new Date().toISOString() };
  writeTextAtomic(bindingFile(projectRoot), JSON.stringify(doc, null, 2) + '\n', { fs: fsImpl });
  return doc;
}
