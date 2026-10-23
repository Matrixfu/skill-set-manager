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
  // 幂等 = 条目行已在（用户自己的 .dsh/skills/ 行同样视为已生效）；
  // 仅提及插件名的注释不构成已生效（e2e 发现的误判）。
  if (text.split(/\r?\n/).some((l) => l.trim() === GITIGNORE_ENTRY)) return { changed: false, line: GITIGNORE_MARKER };
  const block = `${GITIGNORE_MARKER}\n${GITIGNORE_ENTRY}\n`;
  const next = !existed || text === '' ? block : (text.endsWith('\n') ? text + block : text + '\n' + block);
  fsImpl.writeFileSync(file, next);
  return { changed: true, line: GITIGNORE_MARKER };
}
