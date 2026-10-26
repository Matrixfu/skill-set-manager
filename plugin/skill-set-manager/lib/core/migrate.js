/**
 * 迁移向导（§8.2，一次性可跳过）：默认把通用生效区（~/.dsh/skills）的技能**移动**
 * 入库，常驻子集经 syncResident 链回原区；ledger（host 半接 storageDomain）逐项
 * 即时落账 → 中断重跑幂等续传；undo 逆序回滚。库同名一律 keep 不动（ADR-0003）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { copyDirTree } from './github.js';
import { syncResident } from './resident.js';
import { entryKind, removeEntry } from './linkx.js';
import { claimSource, readManifest } from './manifest.js';

const hasSkillMd = (d, fsImpl) => { try { fsImpl.statSync(path.join(d, 'SKILL.md')); return true; } catch { return false; } };

function moveDir(from, to, fsImpl) {
  try { fsImpl.renameSync(from, to); }
  catch (e) {
    if (e.code === 'EXDEV') { copyDirTree(from, to, fsImpl); fsImpl.rmSync(from, { recursive: true, force: true }); }
    else throw e;
  }
}

/** 预览：一层扫描含 SKILL.md 的目录；库同名 keep。固定披露「只剩常驻」警告。 */
export function preview(roots, { fromDir = roots.userDshRoot } = {}, { fs: fsImpl = fs } = {}) {
  const moves = [];
  const keep = [];
  let names;
  try { names = fsImpl.readdirSync(fromDir).filter((n) => !n.startsWith('.')); } catch { names = []; }
  for (const name of names.sort()) {
    const from = path.join(fromDir, name);
    let st;
    try { st = fsImpl.statSync(from); } catch { continue; }
    if (!st.isDirectory() || !hasSkillMd(from, fsImpl)) continue;
    const to = path.join(roots.libraryRoot, name);
    let exists = false;
    try { fsImpl.statSync(to); exists = true; } catch {}
    if (exists) { keep.push({ name, reason: 'exists' }); continue; }
    moves.push({ name, from, to });
  }
  const warnings = ['通用生效区中的技能将整体移入技能库；移空后，其他 harness 将只剩常驻技能（§8.2）。跨 harness 通用区（~/.agents/skills）不在默认范围。'];
  return { moves, keep, warnings };
}

/** 执行：逐项 rename（EXDEV 退化为拷+删），每项即时写 ledger → 中断可续。 */
export async function apply(roots, { moves, ledger }, { fs: fsImpl = fs } = {}) {
  const data = (await ledger.load()) ?? { moved: [] };
  const done = new Set(data.moved.map((x) => x.name));
  for (const mv of moves) {
    if (done.has(mv.name)) continue;
    if (!fsImpl.existsSync(mv.from)) {
      if (hasSkillMd(mv.to, fsImpl)) { // 上次已挪走但没落账 → 补账
        data.moved.push({ name: mv.name, from: mv.from, to: mv.to });
        done.add(mv.name);
        await ledger.save(data);
      }
      continue;
    }
    moveDir(mv.from, mv.to, fsImpl);
    data.moved.push({ name: mv.name, from: mv.from, to: mv.to });
    done.add(mv.name);
    await ledger.save(data);
  }
  const res = await syncResident(roots, { fs: fsImpl }); // 常驻子集链回原区（§8.2）
  return { moved: [...done], warnings: res?.warnings ?? [] }; // syncResident 返回对象不是数组（review m4）
}

/** 回滚：按 ledger 逆序移回；原位被占则跳过并报告。 */
export async function undo(roots, { ledger }, { fs: fsImpl = fs } = {}) {
  const data = (await ledger.load()) ?? { moved: [] };
  const restored = [];
  const warnings = [];
  for (const item of [...data.moved].reverse()) {
    try {
      if (fsImpl.existsSync(item.to)) {
        // 常驻链先摘（apply 时 syncResident 把曾常驻技能链回了原区，review m4）
        const kFrom = entryKind(item.from, { fs: fsImpl });
        if (kFrom === 'junction' || kFrom === 'symlink') removeEntry(item.from, kFrom, { fs: fsImpl });
        if (fsImpl.existsSync(item.from)) warnings.push(`原位已存在同名目录，跳过 "${item.name}"`);
        else {
          moveDir(item.to, item.from, fsImpl);
          if (item.claimed) { try { fsImpl.rmSync(path.join(item.from, '.manifest.json'), { force: true }); } catch {} } // agents 迁移的认领随回滚撤销（不留 foreign 假象）
          restored.push(item.name);
        }
      }
    } catch (e) { warnings.push(`${item.name}: ${e?.message ?? e}`); }
    data.moved = data.moved.filter((x) => x.name !== item.name);
    await ledger.save(data);
  }
  const w2 = await syncResident(roots, { fs: fsImpl });
  return { restored, warnings: [...warnings, ...(w2?.warnings ?? [])] };
}

/**
 * P3 agents 存量迁移（设计 §5.7/§6.6）：只移「无 .manifest.json、非链接、库无同名」的 agents 区纯目录。
 * 带 manifest = 他人记账（ADR-0003 不动）；链接（自家常驻/外部）不搬真身。
 */
export function previewAgents(roots, { fs: fsImpl = fs } = {}) {
  const pv = preview(roots, { fromDir: roots.userAgentsRoot }, { fs: fsImpl });
  const moves = [];
  const kept = [];
  for (const mv of pv.moves) {
    const k = entryKind(mv.from, { fs: fsImpl });
    if (k !== 'dir') { kept.push({ name: mv.name, reason: 'link' }); continue; }
    if (readManifest(mv.from, { fs: fsImpl })) { kept.push({ name: mv.name, reason: 'manifest' }); continue; }
    moves.push(mv);
  }
  return {
    moves,
    keep: [...pv.keep, ...kept],
    warnings: ['跨 harness 通用区（~/.agents/skills）中的技能将移入技能库并登记为本地技能（source unknown）；移动后，其他 harness 将只剩常驻技能（P3，设计 §5.7）。'],
  };
}

/** 执行 + 逐项认领 source:'unknown'（盘上内容即基线，§8.1），ledger 条目标 claimed 供 undo 删认领。 */
export async function applyAgents(roots, { ledger }, { fs: fsImpl = fs } = {}) {
  const pv = previewAgents(roots, { fs: fsImpl });
  const res = await apply(roots, { moves: pv.moves, ledger }, { fs: fsImpl });
  const data = await ledger.load();
  for (const item of data.moved) {
    if (item.claimed) continue;
    try { claimSource(roots, { name: item.name, source: 'unknown' }, { fs: fsImpl }); item.claimed = true; } catch {}
  }
  await ledger.save(data);
  return { ...res, kept: pv.keep.map((k) => k.name) };
}

/** 回滚：复用 undo（claimed 条目回移后删认领 manifest）。 */
export async function undoAgents(roots, { ledger }, { fs: fsImpl = fs } = {}) {
  return undo(roots, { ledger }, { fs: fsImpl });
}
