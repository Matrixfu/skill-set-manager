/** 托管清单（§11）：<projectRoot>/.dsh/skills/.managed.json —— 插件区分自己条目与外来条目的唯一依据。 */
import fs from 'node:fs';
import path from 'node:path';
import { writeTextAtomic } from './atomic.js';

export const managedFile = (projectRoot) => path.join(projectRoot, '.dsh', 'skills', '.managed.json');

export function readManaged(projectRoot, { fs: fsImpl = fs } = {}) {
  let doc;
  try { doc = JSON.parse(fsImpl.readFileSync(managedFile(projectRoot), 'utf8')); } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw new Error(`${managedFile(projectRoot)}: 解析失败（文件被手改坏？请人工修复，插件不覆盖）: ${e.message}`);
  }
  return { setSlug: doc.setSlug ?? null, entries: doc.entries ?? {}, sessionOverride: doc.sessionOverride ?? null };
}

export function writeManaged(projectRoot, managed, { fs: fsImpl = fs } = {}) {
  writeTextAtomic(
    managedFile(projectRoot),
    JSON.stringify({ setSlug: managed.setSlug, entries: managed.entries, sessionOverride: managed.sessionOverride ?? null }, null, 2) + '\n',
    { fs: fsImpl },
  );
}
