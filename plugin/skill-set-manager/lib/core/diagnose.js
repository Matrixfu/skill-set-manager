/**
 * 诊断（§9）：默认只读报告，按六类分组，每条 {level, kind, what, where, fix}
 * （fix = 可复制修复动作）。只有两类可自动修复（回收失效链接 / 按集重建），
 * 其余只给建议不动文件。只扫一层（§9.5）。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readBinding } from './binding.js';
import { readManaged } from './managed.js';
import { listSets, loadSet, loadResident } from './sets.js';
import { entryKind } from './linkx.js';
import { parseFrontmatter } from './resolver.js';
import { SKILL_NAME_RE } from './paths.js';
import { walkFiles } from './manifest.js';

const row = (level, kind, what, where, fix) => ({ level, kind, what, where, fix });
const dirExists = (p, fsImpl) => { try { return fsImpl.statSync(p).isDirectory(); } catch { return false; } };
const oneLevel = (dir, fsImpl) => { try { return fsImpl.readdirSync(dir).filter((n) => !n.startsWith('.')); } catch { return []; } };
function digestOf(dir, fsImpl) {
  const files = walkFiles(dir, { fs: fsImpl });
  return 'sha256:' + crypto.createHash('sha256').update(
    Object.entries(files).sort().map(([k, v]) => `${k}:${v}`).join('\n'),
  ).digest('hex');
}

export function diagnose(roots, { projectRoot = null, cwd = process.cwd(), workspaceScopeInstalled = false } = {}, { fs: fsImpl = fs } = {}) {
  const groups = { partition: [], copies: [], dangling: [], deadLinks: [], structure: [], env: [] };
  const zones = [roots.libraryRoot, roots.userDshRoot, roots.userAgentsRoot, ...roots.customDirs];
  const skillsDirOf = (pr) => path.join(pr, '.dsh', 'skills');
  // 集名口径（用户报告 2026-10-26：面板改名后诊断仍打 slug）：显示名优先，集文件缺失（冻结绑定）回落 slug
  const setLabel = (slug) => (slug ? (loadSet(roots, slug)?.name || slug) : slug);

  // §9.1 分区（信息行：解释「为什么生效清单比技能集大」）
  const managed = (projectRoot ? readManaged(projectRoot, { fs: fsImpl }) : null) ?? { entries: {} };
  if (projectRoot) {
    const binding = readBinding(projectRoot, { fs: fsImpl });
    groups.partition.push(row('info', 'partition-managed',
      `受管技能（技能集 ${binding?.setSlug ? `"${setLabel(binding.setSlug)}"` : '（未绑定）'} 提供，插件按托管清单接管，切换即改写）：${Object.keys(managed.entries || {}).join(', ') || '（无）'}`,
      skillsDirOf(projectRoot), '无需修复：分区仅解释清单构成'));
    const resident = loadResident(roots);
    groups.partition.push(row('info', 'partition-resident',
      `全局常驻（不受管控，所有技能集自动包含，故生效清单可能比技能集大）：${(resident.skills || []).join(', ') || '（无）'}`,
      roots.dshHome, '如需减少：面板「全局常驻」取消勾选'));
  }

  // §9.2 副本漂移
  if (projectRoot) {
    for (const [name, e] of Object.entries(managed.entries || {})) {
      if (!e.copied) continue;
      const lib = path.join(roots.libraryRoot, name);
      const entry = path.join(skillsDirOf(projectRoot), name);
      if (!dirExists(lib, fsImpl) || !dirExists(entry, fsImpl)) continue; // 缺失由 dangling/deadLinks 报
      if (digestOf(lib, fsImpl) !== digestOf(entry, fsImpl))
        groups.copies.push(row('warn', 'copy-drift', `副本技能 "${name}" 与库内容漂移（副本不随库更新）`, entry, `恢复一致：移除条目 "${name}" 后重新生成`));
    }
  }

  // 已知技能名（全部扫描区一层）
  const known = new Set();
  for (const z of zones) for (const n of oneLevel(z, fsImpl)) if (dirExists(path.join(z, n), fsImpl)) known.add(n);

  // §9.3 悬空引用
  for (const s of listSets(roots)) {
    const set = loadSet(roots, s.slug);
    for (const n of set?.skills || []) if (!known.has(n))
      groups.dangling.push(row('warn', 'dangling', `技能集 "${set?.name || s.slug}" 引用不存在的技能 "${n}"`, roots.setsDir, `从该集移除 "${n}" 或补齐技能体`));
  }
  for (const n of loadResident(roots).skills || []) if (!known.has(n))
    groups.dangling.push(row('warn', 'dangling', `常驻名单引用不存在的技能 "${n}"`, path.join(roots.setsDir, '_resident.json'), `取消常驻 "${n}" 或补齐技能体`));
  // 台账在、盘上条目没了（外删/死链）：broken-entry——可经「按当前集重建」修复（review M1 建议）
  if (projectRoot) {
    for (const [name, e] of Object.entries(managed.entries || {})) {
      const pDir = path.join(skillsDirOf(projectRoot), name);
      const pFile = path.join(skillsDirOf(projectRoot), `${name}.md`);
      const onDisk = entryKind(e?.flat ? pFile : pDir, { fs: fsImpl }) !== 'missing'
        || entryKind(e?.flat ? pDir : pFile, { fs: fsImpl }) !== 'missing';
      if (!onDisk) groups.dangling.push(row('warn', 'broken-entry', `托管条目 "${name}" 已被外部删除（台账仍在）`, e?.flat ? pFile : pDir, '点「按当前集重建」重新生成'));
    }
  }

  // §9.4 失效链接（项目内 link 条目指向不存在的本体）。
  // 判定口径（§10.1.2）：readdir Dirent 把 junction 报成 isSymbolicLink——据此认「是链」，
  // 再 stat 判死活（stat 跟随目标）；不可用 entryKind（死链 stat 失败会被归为 missing）。
  if (projectRoot) {
    let ents;
    try { ents = fsImpl.readdirSync(skillsDirOf(projectRoot), { withFileTypes: true }); } catch { ents = []; }
    for (const ent of ents) {
      if (ent.name.startsWith('.') || !ent.isSymbolicLink()) continue;
      const p = path.join(skillsDirOf(projectRoot), ent.name);
      try { fsImpl.statSync(p); } catch { groups.deadLinks.push(row('error', 'dead-link', `条目 "${ent.name}" 指向已不存在的本体`, p, '点「回收失效链接」或移除该条目')); }
    }
  }

  // §9.5 结构：只扫一层。自家常驻链（links 台账记账的全局生效区条目）不是独立副本，
  // 跳过防「重复技能名」误报（活体误报：常驻 clarify/plan 与库本体同名）。
  const ownLinks = new Set();
  {
    const links = loadResident(roots).links ?? {};
    for (const dir of Object.keys(links)) for (const n of Object.keys(links[dir] ?? {})) ownLinks.add(path.resolve(dir, n));
  }
  const seen = new Map();
  for (const z of zones) {
    for (const n of oneLevel(z, fsImpl)) {
      const d = path.join(z, n);
      if (ownLinks.has(path.resolve(d))) continue;
      if (!dirExists(d, fsImpl)) continue;
      let skillMd = null;
      try { skillMd = fsImpl.readFileSync(path.join(d, 'SKILL.md'), 'utf8'); } catch {}
      if (skillMd === null) { groups.structure.push(row('warn', 'no-skillmd', `目录 "${n}" 缺 SKILL.md（不会被加载）`, d, '补 SKILL.md 或移出扫描目录')); continue; }
      if (!SKILL_NAME_RE.test(n)) groups.structure.push(row('warn', 'kebab', `技能名 "${n}" 非 kebab-case（平台加载不稳定；改名=卸载+重装）`, d, `重命名为 kebab-case 等价名`));
      const fm = parseFrontmatter(skillMd);
      if (!fm || !fm.name || !fm.description) groups.structure.push(row('warn', 'frontmatter', `技能 "${n}" frontmatter 缺 name/description`, d, '补全 frontmatter 两字段'));
      else if (fm.name !== n) groups.structure.push(row('warn', 'name-mismatch', `技能 "${n}" 的 frontmatter.name="${fm.name}" 与目录名不一致`, d, '统一目录名与 name'));
      const key = (fm && fm.name) || n;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(d);
      for (const sub of oneLevel(d, fsImpl)) {
        const sd = path.join(d, sub);
        if (!dirExists(sd, fsImpl)) continue;
        try { fsImpl.statSync(path.join(sd, 'SKILL.md')); groups.structure.push(row('warn', 'nested', `技能 "${n}" 内嵌套 SKILL.md（"${sub}/"，不会被平台发现）`, sd, `把 "${sub}" 移到扫描目录顶层`)); } catch {}
      }
    }
  }
  for (const [name, dirs] of seen) if (dirs.length > 1)
    groups.structure.push(row('warn', 'duplicate', `重复技能名 "${name}"（同名冲突平台只 warn 不报错，需人工消歧）`, dirs.join(' | '), '保留一处，另一处改名或移出扫描区'));

  // §9.6 环境
  if (projectRoot) {
    if (cwd && path.resolve(cwd) !== path.resolve(projectRoot))
      groups.env.push(row('warn', 'root-drift', `根漂移：会话目录与项目根不一致，写入落在 ${projectRoot}`, projectRoot, '确认写入位置后继续；或把会话开在仓库根'));
    let up = path.dirname(path.resolve(projectRoot));
    for (let i = 0; i < 5 && up && up !== path.dirname(up); i++, up = path.dirname(up)) {
      try { fsImpl.statSync(path.join(up, '.dsh', 'skill-set-binding.json')); groups.env.push(row('warn', 'parent-binding', `上层目录 ${up} 另有技能集绑定（潜在双真相源）`, up, '只在一层绑定，移除其一')); break; } catch {}
    }
    // flat 复制条目盘上是 `<name>.md`——按台账口径换算，不得裸名误报（review m7）
    const mine = new Set(Object.entries(managed.entries || {}).map(([n, e]) => (e && e.flat ? `${n}.md` : n)));
    for (const n of oneLevel(skillsDirOf(projectRoot), fsImpl))
      if (!mine.has(n))
        groups.env.push(row('warn', 'foreign', `外来条目 "${n}"（不在托管清单：不接管、切换不覆盖）`, path.join(skillsDirOf(projectRoot), n), `需要接管：移走 "${n}" 后重新生成`));
  }
  for (const c of roots.customDirs)
    if (path.resolve(c) === path.resolve(roots.libraryRoot))
      groups.env.push(row('warn', 'custom-covers-library', `custom(300) 目录 "${c}" 恰为技能库路径——库会被直接扫进生效区（破坏 §4.2）`, c, '从 Config.customSkillDirs 移除该目录'));
  if (workspaceScopeInstalled)
    groups.env.push(row('warn', 'dual-truth', '已装 dsh-workspace-scope：其生效区切换与本插件存在双真相源风险', 'profile', '二选一：禁用其技能相关面或停用本插件'));

  return {
    groups,
    fixable: {
      reclaimDeadLinks: { count: groups.deadLinks.length, action: '回收失效链接：按托管清单 removeEntry 后按当前集重新生成' },
      rebuild: { action: '按当前技能集重建生效清单（对当前集重新绑定）' },
    },
  };
}
