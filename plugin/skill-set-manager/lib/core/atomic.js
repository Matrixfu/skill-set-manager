/** 原子文本写：同目录 tmp+rename，杜绝半写文件；core 落盘统一走这里。 */
import fs from 'node:fs';
import path from 'node:path';

let seq = 0;
export function writeTextAtomic(file, text, { fs: fsImpl = fs } = {}) {
  fsImpl.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}-${seq++}`;
  try {
    fsImpl.writeFileSync(tmp, text);
    fsImpl.renameSync(tmp, file);
  } catch (e) {
    try { fsImpl.rmSync(tmp, { force: true }); } catch {}
    throw e;
  }
}
