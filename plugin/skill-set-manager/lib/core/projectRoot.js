/**
 * 项目根解析（§4.5）：照抄平台——最近的含 .git 祖先目录（目录或 worktree 文件都算），
 * 否则退回会话目录本身。插件不自算第二套。
 */
import fs from 'node:fs';
import path from 'node:path';

export function findProjectRoot(startDir, { fs: fsImpl = fs } = {}) {
  const start = path.resolve(startDir);
  let dir = start;
  for (;;) {
    try {
      const marker = fsImpl.statSync(path.join(dir, '.git')); // stat 跟随：.git 目录或文件都算
      if (marker) return dir;
    } catch { /* 无 .git，继续向上 */ }
    const parent = path.dirname(dir);
    if (parent === dir) return start; // 到盘根仍无版本库：退回会话目录本身（§4.5）
    dir = parent;
  }
}
