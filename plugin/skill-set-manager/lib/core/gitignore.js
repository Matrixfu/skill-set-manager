/** .gitignore 署名行（§7.6）：幂等追加；开关关闭不写也不删用户已有内容。 */
import fs from 'node:fs';
import path from 'node:path';
import { writeTextAtomic } from './atomic.js';

export const GITIGNORE_MARKER = '# skill-set-manager: project skill entries (managed)';
export const GITIGNORE_ENTRY = '.agents/skills/'; // 项目生效目录（2026-10-30 迁至 .agents/skills）
export const GITIGNORE_LEGACY_ENTRY = '.dsh/skills/'; // 2026-10-30 前的署名条目：升级时原地改写

export function ensureGitignoreLine(projectRoot, { enabled = true } = {}, { fs: fsImpl = fs } = {}) {
  const file = path.join(projectRoot, '.gitignore');
  if (!enabled) return { changed: false, line: GITIGNORE_MARKER }; // 不写不删（他人所有）
  let text = '';
  let existed = true;
  try { text = fsImpl.readFileSync(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; existed = false; }
  // 幂等 = 条目行已在（用户自己的 .agents/skills/ 行同样视为已生效）；
  // 仅提及插件名的注释不构成已生效（e2e 发现的误判）。
  const lines = text.split(/\r?\n/);
  if (lines.some((l) => l.trim() === GITIGNORE_ENTRY)) return { changed: false, line: GITIGNORE_MARKER };

  // 升级（2026-10-30）：旧版本写的署名块是「marker + .dsh/skills/」两行。
  // 原地改写该条目行，而不是再追加一组署名块——否则旧条目永久残留、文件里出现两组同名注释。
  const mi = lines.findIndex((l) => l.trim() === GITIGNORE_MARKER);
  if (mi >= 0 && lines[mi + 1]?.trim() === GITIGNORE_LEGACY_ENTRY) {
    lines[mi + 1] = lines[mi + 1].replace(GITIGNORE_LEGACY_ENTRY, GITIGNORE_ENTRY);
    // 保留原文件换行风格（Windows 仓库常见 CRLF）
    writeTextAtomic(file, lines.join(text.includes('\r\n') ? '\r\n' : '\n'), { fs: fsImpl });
    return { changed: true, line: GITIGNORE_MARKER };
  }

  const block = `${GITIGNORE_MARKER}\n${GITIGNORE_ENTRY}\n`;
  const next = !existed || text === '' ? block : (text.endsWith('\n') ? text + block : text + '\n' + block);
  writeTextAtomic(file, next, { fs: fsImpl });
  return { changed: true, line: GITIGNORE_MARKER };
}
