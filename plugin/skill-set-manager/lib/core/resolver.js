/**
 * 技能扫描与解析（§7.1/§7.3）。
 * 陷阱照抄取证：条目性质判定只用 stat/lstat，禁 readdir Dirent（junction 会报成 symlink）；
 * 只扫一层（嵌套 SKILL.md 不被发现）；`.managed.json`/`.system`/点开头条目一律跳过。
 */
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_NAME_RE, ZONE_RANKS } from './paths.js';

const MAX_SKILL_BYTES = 64 * 1024;

function unquote(v) {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

/** 极简 frontmatter：`key: value` 与 `key: >-`/`key: |` 折叠块（足够读 name/description 等标量）。 */
export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)(?:\r?\n---|$)/.exec(text);
  if (!m) return null;
  const out = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2].trim();
    if (val === '' || val.startsWith('>') || val.startsWith('|') || val.startsWith('&')) {
      const cont = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) cont.push(lines[++i].trim());
      val = cont.join(' ');
    }
    out[key] = unquote(val);
  }
  return out;
}

function truthy(v) { return v === true || v === 'true' || v === 'yes'; }
function falsy(v) { return v === false || v === 'false' || v === 'no'; }

function readEntry(dir, name, zone, rank, fsImpl) {
  const entryPath = path.join(dir, name);
  let st;
  try { st = fsImpl.statSync(entryPath); } catch { return null; } // stat 跟随 junction
  if (name.endsWith('.md')) {
    if (!st.isFile()) return null;
    return finalize(entryPath.slice(0, -3), entryPath, dir, zone, rank, 'flat', fsImpl);
  }
  if (!st.isDirectory()) return null;
  const skillPath = path.join(entryPath, 'SKILL.md');
  try { if (!fsImpl.statSync(skillPath).isFile()) return null; } catch { return null; }
  return finalize(name, skillPath, entryPath, zone, rank, 'dir', fsImpl);
}

function finalize(baseName, skillPath, dirPath, zone, rank, kind, fsImpl) {
  let text = '';
  try { text = fsImpl.readFileSync(skillPath, 'utf8').slice(0, MAX_SKILL_BYTES); } catch {}
  const fm = parseFrontmatter(text);
  const name = (fm && fm.name) ? String(fm.name).trim() : baseName;
  const problems = [];
  if (!fm) problems.push('missing-frontmatter');
  if (!SKILL_NAME_RE.test(name)) problems.push('not-kebab-case');
  if (!fm || !fm.description) problems.push('missing-description');
  return {
    name,
    path: skillPath,
    dirPath,
    zone,
    rank,
    kind,
    frontmatter: fm,
    valid: problems.length === 0,
    problems,
    invocation: {
      modelInvocable: !truthy(fm && fm['disable-model-invocation']),
      userInvocable: !falsy(fm && fm['user-invocable']),
    },
  };
}

function scanDir(dir, zone, rank, fsImpl) {
  const out = [];
  let names;
  try { names = fsImpl.readdirSync(dir); } catch { return out; } // 目录不存在 = 该层缺席
  for (const name of names) {
    if (name.startsWith('.')) continue; // 含 .managed.json 与 .system
    const e = readEntry(dir, name, zone, rank, fsImpl);
    if (e) out.push(e);
  }
  return out;
}

/** 按 rank 优先级扫描全部生效层（技能库不在其中——§4.2）。 */
export async function scanSkills(roots, projectRoot, { fs: fsImpl = fs } = {}) {
  const zones = [
    ['project-dsh', path.join(projectRoot, '.dsh', 'skills')],
    ['project-agents', path.join(projectRoot, '.agents', 'skills')],
    ...roots.customDirs.map((d) => ['custom', d]),
    ['user-dsh', roots.userDshRoot],
    ['user-agents', roots.userAgentsRoot],
  ];
  const entries = [];
  for (const [zone, dir] of zones) entries.push(...scanDir(dir, zone, ZONE_RANKS[zone], fsImpl));
  return entries;
}

/** 同名冲突：rank 小者胜（上层整体优先），同层先到者胜。 */
export function dedupeWinners(entries) {
  const sorted = [...entries].sort((a, b) => a.rank - b.rank);
  const winners = new Map();
  for (const e of sorted) if (!winners.has(e.name)) winners.set(e.name, e);
  return winners;
}

/**
 * 技能名 → 链接本体（§7.4 存在性检查 + T4 的 junction 目标）：
 * 库内本体优先（技能集引用库技能，junction 指向库）；否则取生效层 rank 胜者；都没有 → missing。
 */
export async function resolveSkillTargets(roots, projectRoot, names, { fs: fsImpl = fs } = {}) {
  const entries = await scanSkills(roots, projectRoot, { fs: fsImpl });
  const winners = dedupeWinners(entries);
  const targets = new Map();
  const missing = [];
  for (const name of names) {
    const libBody = path.join(roots.libraryRoot, name);
    let lib = false;
    try { lib = fsImpl.statSync(path.join(libBody, 'SKILL.md')).isFile(); } catch {}
    if (lib) targets.set(name, { path: libBody, origin: 'library', kind: 'dir' });
    else if (winners.has(name) && winners.get(name).valid) {
      const w = winners.get(name);
      // flat <name>.md 没有可链接目录：effective 对 flat 用文件复制（junction 只用于目录）
      targets.set(name, { path: w.kind === 'flat' ? w.path : w.dirPath, origin: w.zone, kind: w.kind });
    } else missing.push(name);
  }
  return { targets, missing };
}
