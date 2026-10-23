/**
 * 技能集数据模型（§5/§11）：setsDir 下每集一个用户可见 JSON 文件；
 * slug = ASCII kebab 稳定文件名（binding 引用它，重命名只改文件内显示名）；
 * 常驻 = 保留文件 _resident.json（§5.3：插件级全局唯一一份）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_NAME_RE } from './paths.js';

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
  fs.mkdirSync(roots.setsDir, { recursive: true });
  fs.writeFileSync(setPath(roots, slug), JSON.stringify(doc, null, 2) + '\n');
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
export function saveResident(roots, skills) {
  for (const s of skills) if (!SKILL_NAME_RE.test(s)) throw new Error(`技能名不合法: ${s}`);
  const doc = { slug: RESIDENT_SLUG, name: '常驻技能', skills: [...skills], updatedAt: new Date().toISOString() };
  fs.mkdirSync(roots.setsDir, { recursive: true });
  fs.writeFileSync(path.join(roots.setsDir, `${RESIDENT_SLUG}.json`), JSON.stringify(doc, null, 2) + '\n');
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
    if (mf && mf.source && mf.source !== 'unknown') pins[n] = { source: mf.source, commit: mf.commit };
  }
  return { sets: [{ slug: set.slug, name: set.name, skills: set.skills, ...(Object.keys(pins).length ? { pins } : {}) }] };
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
