// check.mjs — 本仓全部机械护栏的一条命令入口（retro 2026-11-20）。
//
// 为什么存在：此前 verify.mjs / ui-gates.mjs 没有任何自动挂载点——publish.yml 只跑 npm publish，
// 仓库也没有 check 入口，门禁只在「agent 记得手跑」时生效；一个回归能直接发布成新版。
// 现在：publish.yml 发布前调它，check.yml 在 push/PR 调它，人也只记这一条命令。
//
// 用法：node scripts/check.mjs   （退出码 0 = 三项全绿）
// 必须在 DSH 文件沙箱**外**跑：junction 类 case 与 `node --check` 在沙箱内会假红（见 AGENTS.md 环境事实）。
// CI 里这条天然成立：Linux runner 没有 DSH 沙箱。
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// ui-gates 自己会 spawn `node --check`（语法那一关在它内部），这里不再重复一次。
const STEPS = [
  ['验收 case 全跑', [process.execPath, join(ROOT, 'scripts', 'verify.mjs')]],
  ['UI 隔离门禁', [process.execPath, join(ROOT, 'scripts', 'ui-gates.mjs')]],
];
const failed = [];
for (const [name, cmd] of STEPS) {
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, stdio: 'inherit' });
  console.log(`${r.status === 0 ? 'OK   ' : 'FAIL '} ${name}`);
  if (r.status !== 0) failed.push(name);
}
if (failed.length) {
  console.error(`CHECK: FAIL ✗ ${failed.join('、')}`);
  process.exit(1);
}
console.log('CHECK: PASS（全部机械护栏绿）');
