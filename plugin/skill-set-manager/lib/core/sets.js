/**
 * 技能集数据模型（§5/§11）：setsDir 下每集一个用户可见 JSON 文件；
 * slug = ASCII kebab 稳定文件名（binding 引用它，重命名只改文件内显示名）；
 * 常驻 = 保留文件 _resident.json（§5.3：插件级全局唯一一份）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_NAME_RE } from './paths.js';
import { writeTextAtomic } from './atomic.js';
import { writeSkillManifest } from './manifest.js';

export const RESIDENT_SLUG = '_resident';

export function slugify(name) {
  const s = String(name || '').toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s;
}
function uniqueSlug(roots, base) {
  let slug = base || 'set';
  for (let n = 2; fs.existsSync(path.join(roots.setsDir, `${slug}.json`)); n++) slug = `${base}-${n}`;
  return slug;
}

function setPath(roots, slug) { return path.join(roots.setsDir, `${slug}.json`); }
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw new Error(`${file}: 解析失败（文件被手改坏？请人工修复，插件不覆盖）: ${e.message}`);
  }
}

export function loadSet(roots, slug) {
  if (slug === RESIDENT_SLUG) return null;
  return readJson(setPath(roots, slug));
}

export function listSets(roots) {
  let names;
  try { names = fs.readdirSync(roots.setsDir); } catch { return []; }
  return names
    .filter((n) => n.endsWith('.json') && n !== `${RESIDENT_SLUG}.json`)
    .map((n) => readJson(path.join(roots.setsDir, n)))
    .filter(Boolean)
    .map((s) => ({ slug: s.slug, name: s.name, description: s.description, skills: s.skills, updatedAt: s.updatedAt }));
}

export function saveSet(roots, set) {
  const { slug, name, description = '', skills = [] } = set;
  if (!slug || slug === RESIDENT_SLUG || !SKILL_NAME_RE.test(slug)) throw new Error(`非法 slug: ${JSON.stringify(slug)}（须 ASCII kebab-case，且不用保留名 _resident）`);
  if (!name || String(name).trim() === '') throw new Error('技能集显示名不能为空');
  for (const s of skills) if (!SKILL_NAME_RE.test(s)) throw new Error(`技能名不合法（非 kebab-case）: ${s}`);
  for (const other of listSets(roots)) {
    if (other.slug !== slug && other.name === name) throw new Error(`显示名已被技能集「${other.slug}」占用，导入/新建不覆盖`);
  }
  const prev = readJson(setPath(roots, slug));
  const doc = { slug, name, description, skills: [...skills], createdAt: prev?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
  writeTextAtomic(setPath(roots, slug), JSON.stringify(doc, null, 2) + '\n');
  return doc;
}

export function deleteSet(roots, slug) {
  if (slug === RESIDENT_SLUG) throw new Error('常驻技能不是技能集，不能按技能集删除');
  try { fs.unlinkSync(setPath(roots, slug)); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

/** 只改显示名；slug 稳定（binding 引用不断，§11）。 */
export function renameSet(roots, slug, newName) {
  const set = loadSet(roots, slug);
  if (!set) throw new Error(`技能集不存在: ${slug}`);
  const old = set.name;
  set.name = String(newName).trim();
  set.updatedAt = new Date().toISOString();
  return (saveSet(roots, set), { old, new: set.name });
}

export function copySet(roots, slug, name) {
  const set = loadSet(roots, slug);
  if (!set) throw new Error(`技能集不存在: ${slug}`);
  const newSlug = uniqueSlug(roots, slugify(name || `${set.name}-copy`) || `${slug}-copy`);
  return saveSet(roots, { slug: newSlug, name: name || `${set.name} 副本`, description: set.description, skills: set.skills });
}

// ---------- 常驻技能（§5.3） ----------
export function loadResident(roots) {
  return readJson(path.join(roots.setsDir, `${RESIDENT_SLUG}.json`)) ?? { slug: RESIDENT_SLUG, name: '常驻技能', skills: [] };
}
export function saveResident(roots, skills, { links } = {}) {
  for (const s of skills) if (!SKILL_NAME_RE.test(s)) throw new Error(`技能名不合法: ${s}`);
  const prev = readJson(path.join(roots.setsDir, `${RESIDENT_SLUG}.json`));
  const doc = {
    slug: RESIDENT_SLUG, name: '常驻技能', skills: [...skills],
    links: links ?? prev?.links ?? {}, // 全局区自建链接台账（退常驻精确回收）
    updatedAt: new Date().toISOString(),
  };
  writeTextAtomic(path.join(roots.setsDir, `${RESIDENT_SLUG}.json`), JSON.stringify(doc, null, 2) + '\n');
  return doc;
}

/** 名字存在性（库 + 全局层；项目层由 T4 的 resolveSkillTargets 按项目补全）。 */
function skillExists(roots, name) {
  const dirs = [roots.libraryRoot, roots.userDshRoot, roots.userAgentsRoot, ...roots.customDirs];
  for (const d of dirs) {
    for (const cand of [path.join(d, name, 'SKILL.md'), path.join(d, `${name}.md`)]) {
      try { if (fs.statSync(cand).isFile()) return true; } catch {}
    }
  }
  return false;
}

/** 生效名单 = 常驻 ∪ 集（§7.4 存在性检查在此给出 missing 警告）。 */
export function effectiveNames(roots, setSlug) {
  const set = setSlug ? loadSet(roots, setSlug) : null;
  const names = [...new Set([...loadResident(roots).skills, ...(set?.skills ?? [])])];
  return { names, missing: names.filter((n) => !skillExists(roots, n)) };
}

/** 从当前生效清单另存为（§5.4：第一次建集的主路径）。 */
export function saveAsSet(roots, { name, names }) {
  const slug = uniqueSlug(roots, slugify(name) || 'set');
  return saveSet(roots, { slug, name, description: '', skills: names });
}

/** 导出 = 名字列表 + 可选来源 pin（§5.6）。 */
export function exportSet(roots, slug) {
  const set = loadSet(roots, slug);
  if (!set) throw new Error(`技能集不存在: ${slug}`);
  const pins = {};
  for (const n of set.skills) {
    const mf = readJson(path.join(roots.libraryRoot, n, '.manifest.json'));
    if (mf && mf.source && mf.source !== 'unknown' && mf.source !== 'placeholder') pins[n] = { source: mf.source, commit: mf.commit };
  }
  return { sets: [{ slug: set.slug, name: set.name, description: set.description ?? '', skills: set.skills, ...(Object.keys(pins).length ? { pins } : {}) }] };
}

// ---------- 导入（§5.6：预览 → 三选一「按 pin 安装 / 忽略 / 先占位」，插件不自动联网） ----------

/** pin 归一：无 source、source=unknown 或 placeholder 一律视为无 pin（按 pin 安装按钮随之禁用，评审 M2）。 */
function pinOf(pins, name) {
  const p = pins && typeof pins === 'object' ? pins[name] : null;
  const source = typeof p?.source === 'string' ? p.source.trim() : '';
  if (!source || source === 'unknown' || source === 'placeholder') return null;
  return { source, commit: typeof p.commit === 'string' ? p.commit : null };
}

/** payload 校验（用户粘的 JSON 不可信）：一个坏集只报一条错、整集不参与写入，绝不半写。 */
function validatePayload(payload) {
  if (!payload || !Array.isArray(payload.sets) || !payload.sets.length)
    return { errors: ['payload 须为 { sets: [{ name, skills, pins? }] }'], items: [] };
  const errors = [];
  const items = [];
  for (const item of payload.sets) {
    const label = item?.name ?? item?.slug ?? '(无名)';
    if (!item || typeof item !== 'object' || !String(item.name ?? '').trim()) { errors.push(`技能集缺少显示名：${JSON.stringify(label)}`); continue; }
    if (!Array.isArray(item.skills)) { errors.push(`技能集「${label}」的 skills 须为数组`); continue; }
    const bad = item.skills.filter((n) => typeof n !== 'string' || !SKILL_NAME_RE.test(n));
    if (bad.length) { errors.push(`技能集「${label}」含非法技能名：${bad.join('、')}`); continue; }
    items.push(item);
  }
  return { errors, items };
}

/** 只读预览：本机上哪些技能缺、有没有 pin 可装、显示名会不会撞车。 */
export function importPreview(roots, payload) {
  const { errors, items } = validatePayload(payload);
  const known = listSets(roots);
  const out = items.map((item) => {
    const skills = [...new Set(item.skills)];
    return {
      name: String(item.name).trim(),
      slug: uniqueSlug(roots, slugify(item.slug || item.name) || 'set'),
      skills,
      conflict: known.some((s) => s.name === String(item.name).trim()),
      missing: skills.filter((n) => !skillExists(roots, n)).map((n) => ({ name: n, pin: pinOf(item.pins, n) })),
    };
  });
  return { items: out, errors };
}

/** 占位技能体（§5.6「先占位」）：让名字先存在、集不悬空，manifest 标 source=placeholder。 */
function makePlaceholder(roots, name) {
  const dir = path.join(roots.libraryRoot, name);
  const md = path.join(dir, 'SKILL.md');
  if (fs.existsSync(md)) return false; // 已有技能体就不覆盖（空壳目录仍补写，评审 M3）
  fs.mkdirSync(dir, { recursive: true });
  writeTextAtomic(md,
    `---\nname: ${name}\ndescription: 占位：导入时选「先占位」，技能体尚未安装\n---\n\n# ${name}\n\n占位技能：技能体尚未安装。装上真身后请删除本目录（或从 GitHub 安装覆盖）。\n`);
  writeSkillManifest(dir, { source: 'placeholder' });
  return true;
}

/**
 * 落盘导入：`choices[技能名] = 'install' | 'placeholder' | 'ignore'`，缺省 ignore
 * （插件不自动联网安装——§5.6 硬约束）；install 由调用方注入（host 走同一条稀疏拉取路径）。
 */
export async function importApply(roots, payload, { choices = {}, install = null } = {}) {
  const { errors, items } = validatePayload(payload);
  const created = [], nameConflicts = [], installed = [], placeholders = [], ignored = [], warnings = [];
  for (const item of items) {
    const name = String(item.name).trim();
    const exists = listSets(roots).find((s) => s.name === name);
    if (exists) { nameConflicts.push({ name, slug: exists.slug }); continue; } // 显示名冲突不覆盖（§5.10）
    const slug = uniqueSlug(roots, slugify(item.slug || name) || 'set');
    const skills = [...new Set(item.skills)];
    saveSet(roots, { slug, name, description: typeof item.description === 'string' ? item.description : '', skills });
    created.push({ slug, name });
    for (const n of skills) {
      if (skillExists(roots, n)) continue;
      const choice = choices[n] ?? 'ignore';
      if (choice === 'install') {
        const pin = pinOf(item.pins, n);
        if (!pin) { warnings.push(`${n}: 无来源 pin，无法按 pin 安装（改判忽略）`); ignored.push(n); continue; }
        if (!install) { warnings.push(`${n}: 本环境无安装通道（改判忽略）`); ignored.push(n); continue; }
        try { await install(n, pin); installed.push(n); }
        catch (e) { warnings.push(`${n}: 按 pin 安装失败（${e?.message ?? e}）`); ignored.push(n); }
      } else if (choice === 'placeholder') {
        try {
          if (makePlaceholder(roots, n)) placeholders.push(n);
          else warnings.push(`${n}: 库内已有 SKILL.md，占位未写（保留现有技能体）`);
        } catch (e) { warnings.push(`${n}: 占位失败（${e?.message ?? e}）`); }
      } else ignored.push(n);
    }
  }
  return { created, nameConflicts, installed, placeholders, ignored, warnings, errors };
}

/** 导入：显示名冲突不覆盖；缺失技能只列清单，插件不自动联网安装（§5.6）。 */
export function importSets(roots, payload) {
  const created = [];
  const nameConflicts = [];
  const missingSkills = [];
  for (const item of payload?.sets ?? []) {
    const exists = listSets(roots).find((s) => s.name === item.name);
    if (exists) { nameConflicts.push({ name: item.name, slug: exists.slug }); continue; }
    const slug = uniqueSlug(roots, slugify(item.slug || item.name) || 'set');
    saveSet(roots, { slug, name: item.name, description: item.description ?? '', skills: item.skills ?? [] });
    created.push({ slug, name: item.name });
    for (const n of item.skills ?? []) if (!skillExists(roots, n) && !missingSkills.includes(n)) missingSkills.push(n);
  }
  return { created, nameConflicts, missingSkills };
}
