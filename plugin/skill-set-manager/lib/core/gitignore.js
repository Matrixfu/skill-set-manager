/** .gitignore 署名行（§7.6）：幂等追加；开关关闭不写也不删用户已有内容。 */
import fs from 'node:fs';
import path from 'node:path';

export const GITIGNORE_MARKER = '# skill-set-manager: project skill entries (managed)';
export const GITIGNORE_ENTRY = '.dsh/skills/';

export function ensureGitignoreLine(projectRoot, { enabled = true } = {}, { fs: fsImpl = fs } = {}) {
  const file = path.join(projectRoot, '.gitignore');
  if (!enabled) return { changed: false, line: GITIGNORE_MARKER }; // 不写不删（他人所有）
  let text = '';
  let existed = true;
  try { text = fsImpl.readFileSync(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; existed = false; }
  if (text.split(/\r?\n/).some((l) => l.includes('skill-set-manager'))) return { changed: false, line: GITIGNORE_MARKER };
  const block = `${GITIGNORE_MARKER}\n${GITIGNORE_ENTRY}\n`;
  const next = !existed || text === '' ? block : (text.endsWith('\n') ? text + block : text + '\n' + block);
  fsImpl.writeFileSync(file, next);
  return { changed: true, line: GITIGNORE_MARKER };
}
