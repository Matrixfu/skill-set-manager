#!/usr/bin/env node
/**
 * Skill Set Manager — §17 验收脚本（verify.ps1 的等价 node 脚本；选 node：会话落盘是多帧 zstd + JSON 断言，探针工具链已是 node）。
 * 自建临时夹具 → 建联接 → 断言；不依赖任何手工状态。**脚本跑不通不算交付。**
 *
 * 用法:
 *   node scripts/verify.mjs                    # 跑全部 MVP 可执行 case
 *   node scripts/verify.mjs --case 4 --case 5  # 只跑指定 case
 *   node scripts/verify.mjs --keep-fixtures    # 保留临时夹具目录（打印路径）
 *   node scripts/verify.mjs --assert-catalog auto|<session.v4.jsonl[.zstd]>
 *       # T9：以会话落盘 skill-catalog 事件为权威口径断言 #3/#4/#6（需活会话轮次）
 *   node scripts/verify.mjs --list-cases
 *
 * 口径: 退出码 0 = 全部 active case 绿；任何 FAIL → 1。SKIP（pending-scope / live）不算失败但会列出。
 * 范围裁定（待用户确认）: #10（卸载→回收站→恢复）与 #11（六类诊断页）验收 P1 功能 → 标 pending-scope；
 *   其检测原语（悬空引用/外来条目/非 kebab/嵌套）由 #dangling/#foreign 等 case 在 core 层覆盖。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const CORE_DIR = path.resolve(import.meta.dirname, '..', 'plugin', 'skill-set-manager', 'lib', 'core');
const ZSTD = 'C:/Users/fuhd2/miniconda3/Library/bin/zstd.exe';

// ---------- core 动态装载（未实现 → 明确报红） ----------
const _cache = new Map();
async function core(mod) {
  if (_cache.has(mod)) return _cache.get(mod);
  const file = path.join(CORE_DIR, mod + '.js');
  if (!fs.existsSync(file)) throw new Error(`core not implemented: plugin/skill-set-manager/lib/core/${mod}.js`);
  const m = await import(pathToFileURL(file).href);
  _cache.set(mod, m);
  return m;
}

// ---------- 断言 ----------
class AssertionError extends Error {}
function ok(cond, msg) { if (!cond) throw new AssertionError(msg); }
function eq(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new AssertionError(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function setEq(actual, expected, msg) {
  const a = [...new Set(actual)].sort(), b = [...new Set(expected)].sort();
  eq(a, b, msg);
}
function has(list, item, msg) { ok(list.includes(item), `${msg}: ${JSON.stringify(item)} 应在 ${JSON.stringify(list)}`); }
function lacks(list, item, msg) { ok(!list.includes(item), `${msg}: ${JSON.stringify(item)} 不应在 ${JSON.stringify(list)}`); }

// ---------- 夹具 ----------
const sha256 = (buf) => 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex');
const mkdirp = (p) => fs.mkdirSync(p, { recursive: true });

function writeSkill(parentDir, name, desc = 'verify 夹具技能') {
  const dir = path.join(parentDir, name);
  mkdirp(dir);
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${desc}\n---\n\nverify 夹具，可安全删除。\n`);
  return dir;
}
function gitInit(dir) { execFileSync('git', ['init', '-q', dir], { stdio: 'ignore' }); return dir; }
function gitProject(dir) { mkdirp(path.join(dir, '.dsh', 'skills')); return gitInit(dir); }

/** 每 case 一套独立夹具：假 dshHome（库/技能集/全局生效区）+ 项目 A/B + 假 agentsHome。 */
function makeFixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ssm-verify-'));
  const f = { base };
  f.dshHome = path.join(base, 'home');
  f.agentsHome = path.join(base, 'agents-home');
  f.library = path.join(f.dshHome, 'skill-library');
  f.userDsh = path.join(f.dshHome, 'skills');
  f.userAgentsSkills = path.join(f.agentsHome, 'skills');
  for (const d of [f.dshHome, f.library, f.userDsh, f.userAgentsSkills]) mkdirp(d);
  f.projectA = gitProject(path.join(base, 'projects', 'A'));
  f.projectB = gitProject(path.join(base, 'projects', 'B'));
  f.roots = null; // 由各 case 经 paths.buildRoots 填充
  f.cleanup = () => fs.rmSync(base, { recursive: true, force: true });
  return f;
}
async function withRoots(f, extra = {}) {
  const { buildRoots } = await core('paths');
  f.roots = buildRoots({ dshHome: f.dshHome, agentsHome: f.agentsHome, ...extra });
  return f.roots;
}
const skillDirNames = (projectRoot) =>
  fs.readdirSync(path.join(projectRoot, '.dsh', 'skills'))
    .filter((n) => { try { return fs.statSync(path.join(projectRoot, '.dsh', 'skills', n)).isDirectory(); } catch { return false; } })
    .sort();
const scanNames = async (f, projectRoot) => {
  const { scanSkills } = await core('resolver');
  return (await scanSkills(f.roots, projectRoot)).map((s) => s.name);
};

// ---------- 会话落盘 skill-catalog 解析（#3/#4/#6 权威口径；T9 接通） ----------
function sessionDirKey(projectRoot) {
  return '--' + projectRoot.replace(/[\\/:]+/g, '-').replace(/-+$/, '') + '--';
}
function decompressSession(file) {
  if (file.endsWith('.jsonl')) return fs.readFileSync(file, 'utf8');
  const r = spawnSync(ZSTD, ['-d', '-qc', file], { maxBuffer: 256 * 1024 * 1024 });
  if (r.status === 0 && r.stdout.length) return r.stdout.toString('utf8');
  return zlib.zstdDecompressSync(fs.readFileSync(file)).toString('utf8'); // 只解第一帧，兜底
}
/** 返回该会话历轮注入的技能名清单数组（按出现顺序）。 */
function catalogEventsFromSession(file) {
  const out = [];
  for (const line of decompressSession(file).split('\n')) {
    if (!line.includes('skill-catalog')) continue;
    let obj; try { obj = JSON.parse(line); } catch { continue; }
    if (obj.type !== 'user/message' || obj.data?.source?.kind !== 'skill-catalog') continue;
    const text = JSON.stringify(obj.data);
    const names = new Set();
    const m = text.match(/(?:^|[^a-z0-9-])([a-z0-9]+(?:-[a-z0-9]+)*)(?:[/\\]SKILL\.md|\\n)/g) || [];
    for (const s of m) names.add(s.replace(/[^a-z0-9-]+$/, '').replace(/^[^a-z0-9-]+/, ''));
    out.push([...names]);
  }
  return out;
}
function findLatestSession(projectRoot) {
  const dir = path.join(os.homedir(), '.dsh', 'sessions', sessionDirKey(projectRoot));
  if (!fs.existsSync(dir)) return null;
  const sess = fs.readdirSync(dir).filter((d) => d.startsWith('session-')).sort();
  for (let i = sess.length - 1; i >= 0; i--) {
    const file = path.join(dir, sess[i], 'session.v4.jsonl.zstd');
    if (fs.existsSync(file)) return file;
  }
  return null;
}

// ---------- case 表（§17 编号 + Review-Focus 注入项） ----------
const CASES = [
  {
    id: '1', title: '技能装在库里不会自动对所有项目生效（§17#1）',
    async run(f) {
      await withRoots(f);
      writeSkill(f.library, 'only-in-lib');
      lacks(await scanNames(f, f.projectA), 'only-in-lib', '库里技能不应出现在项目扫描');
      writeSkill(f.userDsh, 'global-res-x');
      has(await scanNames(f, f.projectA), 'global-res-x', '全局生效区技能应对项目可见');
    },
  },
  {
    id: '2', title: '可建 ≥3 个技能集并自由勾选（§17#2）',
    async run(f) {
      await withRoots(f);
      for (const n of ['lib-docx', 'lib-pdf', 'lib-math', 'resident-x']) writeSkill(f.library, n);
      const s = await core('sets');
      const mk = (slug, name, skills) => s.saveSet(f.roots, { slug, name, description: slug + ' desc', skills });
      await mk('doc-processing', '文档处理', ['lib-docx', 'lib-pdf']);
      await mk('math-set', '数学', ['lib-math']);
      await mk('all-set', '全家桶', ['lib-docx', 'lib-pdf', 'lib-math']);
      eq((await s.loadSet(f.roots, 'doc-processing')).skills, ['lib-docx', 'lib-pdf'], '读回 doc-processing');
      eq((await s.loadSet(f.roots, 'math-set')).name, '数学', '读回 math-set 显示名');
      setEq((await s.listSets(f.roots)).map((x) => x.slug), ['doc-processing', 'math-set', 'all-set'], 'listSets');
      await s.renameSet(f.roots, 'math-set', '数学增强');
      eq((await s.loadSet(f.roots, 'math-set')).name, '数学增强', '重命名只改显示名，slug 稳定（binding 引用不断）');
      const c = await s.copySet(f.roots, 'doc-processing', 'doc-copy');
      await s.saveSet(f.roots, { slug: c.slug, name: c.name, description: c.description, skills: ['lib-math'] });
      eq((await s.loadSet(f.roots, 'doc-processing')).skills, ['lib-docx', 'lib-pdf'], '复制集改动不影响原集');
    },
  },
  {
    id: '3', title: '常驻技能被所有技能集自动包含（§17#3，数据层；catalog 口径见 --assert-catalog）',
    async run(f) {
      await withRoots(f);
      for (const n of ['lib-a', 'lib-b', 'resident-x']) writeSkill(f.library, n);
      const s = await core('sets');
      await s.saveSet(f.roots, { slug: 'set-a', name: 'A', skills: ['lib-a'] });
      await s.saveSet(f.roots, { slug: 'set-b', name: 'B', skills: ['lib-b'] });
      await s.saveResident(f.roots, ['resident-x']);
      setEq((await s.effectiveNames(f.roots, 'set-a')).names, ['resident-x', 'lib-a'], 'set-a 生效名单');
      setEq((await s.effectiveNames(f.roots, 'set-b')).names, ['resident-x', 'lib-b'], 'set-b 生效名单');
    },
  },
  {
    id: '4', title: '新项目绑定后自动生成生效清单；.managed.json 不被扫成条目（§17#4）',
    async run(f) {
      await withRoots(f);
      for (const n of ['lib-docx', 'lib-pdf', 'resident-x']) writeSkill(f.library, n);
      const s = await core('sets'); await s.saveResident(f.roots, ['resident-x']);
      await s.saveSet(f.roots, { slug: 'doc', name: '文档', skills: ['lib-docx', 'lib-pdf'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan } = await core('effective');
      const { readManaged } = await core('managed');
      await writeBinding(f.projectA, 'doc');
      const plan = await planEffective(f.roots, f.projectA, 'doc');
      await applyPlan(f.projectA, plan);
      setEq(skillDirNames(f.projectA), ['resident-x', 'lib-docx', 'lib-pdf'], '项目条目 == 常驻+集');
      const mg = await readManaged(f.projectA);
      eq(mg.setSlug, 'doc', '托管清单记录来源技能集');
      lacks(await scanNames(f, f.projectA), '.managed', '.managed.json 不应被扫成条目');
      lacks(await scanNames(f, f.projectA), '.managed.json', '.managed.json 不应被扫成条目');
    },
  },
  {
    id: '5', title: '不同项目绑定不同技能集互不影响（§17#5）',
    async run(f) {
      await withRoots(f);
      for (const n of ['s1', 's2', 's3']) writeSkill(f.library, n);
      const s = await core('sets');
      await s.saveSet(f.roots, { slug: 'one', name: '一', skills: ['s1'] });
      await s.saveSet(f.roots, { slug: 'two', name: '二', skills: ['s2'] });
      await s.saveSet(f.roots, { slug: 'three', name: '三', skills: ['s3'] });
      const { writeBinding, readBinding } = await core('binding');
      const { planEffective, applyPlan } = await core('effective');
      await writeBinding(f.projectA, 'one'); await applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 'one'));
      await writeBinding(f.projectB, 'two'); await applyPlan(f.projectB, await planEffective(f.projectB, 'two'));
      const bBefore = skillDirNames(f.projectB), bindBefore = await readBinding(f.projectB);
      await writeBinding(f.projectA, 'three'); await applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 'three'));
      setEq(skillDirNames(f.projectB), bBefore, '改 A 不动 B 目录');
      eq(await readBinding(f.projectB), bindBefore, '改 A 不动 B 绑定');
    },
  },
  {
    id: '6', title: '切换后同会话下一轮请求生效（§17#6，权威=会话落盘 skill-catalog）',
    status: 'live', // 需活会话轮次：--assert-catalog auto|<file> 时执行（T9 接通）
    async run(f, ctx) {
      const file = ctx.assertCatalog === 'auto' ? findLatestSession(ctx.catalogProject || f.projectA) : ctx.assertCatalog;
      ok(file && fs.existsSync(file), `找不到待解析会话文件（--assert-catalog auto 需要已存在会话的项目）`);
      const rounds = catalogEventsFromSession(file);
      ok(rounds.length >= 2, `skill-catalog 事件不足 2 轮（${rounds.length}），无法断言“切换后下一轮变化”`);
      const [before, after] = rounds.slice(-2);
      const added = after.filter((n) => !before.includes(n)), removed = before.filter((n) => !after.includes(n));
      ok(added.length || removed.length, '最后两轮 skill-catalog 无差异：未证明切换热生效');
      lacks(after, '.managed', '注入清单不应含 .managed');
      ctx.log(`last-round=${after.length} entries, +${added.length}/-${removed.length}`);
    },
  },
  {
    id: '7', title: '插件自算清单 ≠ 注入清单时报警（§17#7，数据侧 selfCheck）',
    async run(f) {
      await withRoots(f);
      writeSkill(f.library, 'lib-a'); writeSkill(f.library, 'lib-b');
      const s = await core('sets'); await s.saveSet(f.roots, { slug: 'set-a', name: 'A', skills: ['lib-a', 'lib-b'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan, selfCheck } = await core('effective');
      await writeBinding(f.projectA, 'set-a'); await applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 'set-a'));
      ok((await selfCheck(f.roots, f.projectA)).ok, '基线自检应通过');
      fs.rmdirSync(path.join(f.projectA, '.dsh', 'skills', 'lib-b')); // 人为摘掉一个 managed 条目（模拟外部改动）
      mkdirp(path.join(f.projectA, '.dsh', 'skills', 'ghost')); writeSkill(path.join(f.projectA, '.dsh', 'skills', 'ghost'), 'ghost');
      const sc = await selfCheck(f.roots, f.projectA);
      ok(!sc.ok, '人为不一致 → selfCheck.ok 应为 false');
      has(sc.missing, 'lib-b', 'missing 应含被摘条目');
      has(sc.extra.concat(sc.foreign), 'ghost', 'extra/foreign 应含外来条目');
    },
  },
  {
    id: '8-manifest', title: '扫描登记写 manifest、逐文件哈希字段齐全（§17#8 脚本部分）',
    async run(f) {
      await withRoots(f);
      writeSkill(f.library, 'lib-a');
      fs.writeFileSync(path.join(f.library, 'lib-a', 'extra.txt'), 'x');
      const { registerLibrary } = await core('manifest');
      await registerLibrary(f.roots);
      const m = JSON.parse(fs.readFileSync(path.join(f.library, 'lib-a', '.manifest.json'), 'utf8'));
      for (const k of ['name', 'source', 'commit', 'installedAt', 'managed', 'files', 'dirDigest']) ok(k in m, `manifest 缺字段 ${k}`);
      eq(m.name, 'lib-a', 'manifest.name'); eq(m.source, 'unknown', '本地登记 source=unknown');
      ok(Object.keys(m.files).includes('SKILL.md') && Object.keys(m.files).includes('extra.txt'), 'files 应逐文件');
      for (const v of Object.values(m.files)) ok(String(v).startsWith('sha256:'), 'files 值为 sha256: 前缀');
      ok(String(m.dirDigest).startsWith('sha256:'), 'dirDigest');
    },
  },
  {
    id: '10', title: '卸载→回收站→恢复（§17#10）', status: 'pending-scope',
    note: '验收对象是 P1「备份与回收站」；范围裁定待用户确认后启用', run: async () => {},
  },
  {
    id: '11', title: '诊断六类分组报出（§17#11）', status: 'pending-scope',
    note: '验收对象是 P1 诊断页；检测原语由 #7/#dangling/#foreign/#kebab/#nested 在 core 层覆盖', run: async () => {},
  },
  {
    id: '12', title: '项目根解析与平台一致（§17#12 数据侧；确认流程人工）',
    async run(f) {
      const { findProjectRoot } = await core('projectRoot');
      const deep = path.join(f.projectA, 'sub', 'deep'); mkdirp(deep);
      eq(path.resolve(findProjectRoot(deep)), path.resolve(f.projectA), '无 git 子目录 → 上层仓库根');
      const inner = gitProject(path.join(f.projectA, 'inner')); mkdirp(path.join(inner, 'sub'));
      eq(path.resolve(findProjectRoot(path.join(inner, 'sub'))), path.resolve(inner), '嵌套仓库独立');
      const noGit = path.join(f.base, 'projects', 'no-git'); mkdirp(path.join(noGit, 'x'));
      eq(path.resolve(findProjectRoot(path.join(noGit, 'x'))), path.resolve(path.join(noGit, 'x')), '无版本库 → 退回会话目录本身');
    },
  },
  {
    id: '17', title: '临时覆盖：留 pending 标记 → 启动还原 → 标记清除（§17#17）',
    async run(f) {
      await withRoots(f);
      writeSkill(f.library, 'lib-a'); writeSkill(f.library, 'lib-b');
      const s = await core('sets'); await s.saveSet(f.roots, { slug: 'set-a', name: 'A', skills: ['lib-a', 'lib-b'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan } = await core('effective');
      await writeBinding(f.projectA, 'set-a'); await applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 'set-a'));
      const { makeFallbackStore } = await core('storage');
      const p = await core('pending');
      const store = makeFallbackStore(path.join(f.base, 'store'));
      const snap = await p.startOverride(store, f.roots, f.projectA, { add: [], remove: ['lib-b'] });
      lacks(skillDirNames(f.projectA), 'lib-b', '临时覆盖：条目已摘');
      ok(snap && (await store.keys('pending')).length === 1, 'pending 标记已写');
      await p.restoreAllPending(store, f.roots); // 模拟插件启动（崩溃后残留）
      setEq(skillDirNames(f.projectA), ['lib-a', 'lib-b'], '目录复原到绑定态');
      eq((await store.keys('pending')).length, 0, 'pending 标记已清');
      // 撤销快照：切换后一次性回滚
      await s.saveSet(f.roots, { slug: 'set-b2', name: 'B', skills: ['lib-a'] });
      await p.pushUndo(store, f.roots, f.projectA);
      await writeBinding(f.projectA, 'set-b2'); await applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 'set-b2'));
      await p.applyUndo(store, f.roots, f.projectA);
      setEq(skillDirNames(f.projectA), ['lib-a', 'lib-b'], '撤销回到上一份生效清单快照');
      eq((await store.keys('undo')).length, 0, '撤销入口一次性消费');
    },
  },
  // ---- Review-Focus 注入项（计划 Review Focus 2/3/4 对应） ----
  {
    id: 'foreign', title: '外来条目一律不动不删（Review-Focus 2）',
    async run(f) {
      await withRoots(f);
      writeSkill(f.library, 'lib-a');
      writeSkill(path.join(f.projectA, '.dsh', 'skills'), 'foreign-entry'); // 手工塞进托管目录的外来条目
      const s = await core('sets'); await s.saveSet(f.roots, { slug: 'set-a', name: 'A', skills: ['lib-a'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan } = await core('effective');
      await writeBinding(f.projectA, 'set-a');
      const plan = await planEffective(f.roots, f.projectA, 'set-a');
      ok(!(plan.remove || []).some((e) => e.name === 'foreign-entry'), 'plan 不应回收外来条目');
      await applyPlan(f.projectA, plan);
      has(skillDirNames(f.projectA), 'foreign-entry', '外来条目保留');
      const { readManaged } = await core('managed');
      ok(!Object.keys((await readManaged(f.projectA)).entries).includes('foreign-entry'), '托管清单不含外来条目');
    },
  },
  {
    id: 'dangling', title: '悬空引用：写入前警告、不静默写入（Review-Focus 3）',
    async run(f) {
      await withRoots(f);
      writeSkill(f.library, 'lib-a');
      const s = await core('sets'); await s.saveSet(f.roots, { slug: 'set-a', name: 'A', skills: ['lib-a', 'no-such-skill'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan } = await core('effective');
      await writeBinding(f.projectA, 'set-a');
      const plan = await planEffective(f.roots, f.projectA, 'set-a');
      has(plan.warnMissing, 'no-such-skill', 'warnMissing 应含不存在技能');
      await applyPlan(f.projectA, plan);
      setEq(skillDirNames(f.projectA), ['lib-a'], '不存在技能不写入目录');
    },
  },
  {
    id: 'copy-fallback', title: 'junction 不可用 → 复制兜底并标记 copied（Review-Focus 4）',
    async run(f) {
      await withRoots(f);
      const target = writeSkill(f.library, 'lib-copy');
      const { makeEntry, entryKind, removeEntry } = await core('linkx');
      const link = path.join(f.projectA, '.dsh', 'skills', 'lib-copy');
      const real = await import('node:fs');
      const fake = Object.create(real);
      fake.symlinkSync = () => { const e = new Error('EPERM'); e.code = 'EPERM'; throw e; };
      const made = await makeEntry(target, link, { fs: fake });
      eq(made.kind, 'copy', 'EPERM → 复制兜底');
      eq(entryKind(link), 'dir', '副本落地为真实目录（copy/dir 之分记在托管清单，fs 层不猜）');
      fs.writeFileSync(path.join(target, 'SKILL.md'), 'changed-in-library\n');
      ok(!fs.readFileSync(path.join(link, 'SKILL.md'), 'utf8').includes('changed-in-library'), '副本不随库演进');
      fs.writeFileSync(path.join(target, 'SKILL.md'), '---\nname: lib-copy\ndescription: x\n---\n');
      const j = await makeEntry(target, path.join(f.projectA, '.dsh', 'skills', 'lib-copy-j'), {});
      eq(j.kind, 'junction', '默认可用时建 junction');
      ok(fs.readFileSync(path.join(f.projectA, '.dsh', 'skills', 'lib-copy-j', 'SKILL.md'), 'utf8').includes('name:'), '经 junction 读 SKILL.md 透明');
      removeEntry(link, 'copy'); removeEntry(path.join(f.projectA, '.dsh', 'skills', 'lib-copy-j'), 'junction');
      ok(fs.existsSync(path.join(f.library, 'lib-copy', 'SKILL.md')), '删条目不伤库本体');
    },
  },
  {
    id: 'kebab-nested', title: '非 kebab-case / 嵌套 SKILL.md / 重复名判定（#11 检测原语）',
    async run(f) {
      await withRoots(f);
      writeSkill(f.userDsh, 'Bad_Name');            // 非 kebab
      const nested = writeSkill(f.userDsh, 'nested-ok'); mkdirp(path.join(nested, 'sub'));
      fs.writeFileSync(path.join(nested, 'sub', 'SKILL.md'), '---\nname: hidden\ndescription: x\n---\n'); // 嵌套不被发现
      writeSkill(f.userDsh, 'dup-name'); writeSkill(path.join(f.projectA, '.dsh', 'skills'), 'dup-name'); // 跨层同名
      const { scanSkills, dedupeWinners } = await core('resolver');
      const entries = await scanSkills(f.roots, f.projectA);
      lacks(entries.filter((e) => e.valid).map((e) => e.name), 'Bad_Name', '非 kebab 不算有效技能');
      lacks(entries.map((e) => e.name), 'hidden', '嵌套 SKILL.md 不被发现');
      const w = dedupeWinners(entries.filter((e) => e.name === 'dup-name'));
      eq([...w.values()][0].rank, 100, '同名冲突项目层(rank 100)胜');
    },
  },
  {
    id: 'gitignore', title: '.gitignore 署名行幂等 + 开关（§7.6）',
    async run(f) {
      const g = path.join(f.projectA, '.gitignore');
      fs.writeFileSync(g, 'node_modules/\n');
      const { ensureGitignoreLine } = await core('gitignore');
      await ensureGitignoreLine(f.projectA, { enabled: true });
      await ensureGitignoreLine(f.projectA, { enabled: true });
      const t = fs.readFileSync(g, 'utf8');
      eq(t.split('\n').filter((l) => l.includes('skill-set-manager')).length, 1, '署名行幂等（只一组）');
      ok(t.startsWith('node_modules/'), '原有行不动');
      await ensureGitignoreLine(f.projectA, { enabled: false });
      eq(fs.readFileSync(g, 'utf8'), t, '开关关闭不写不删');
    },
  },
];

// ---------- 运行器 ----------
function parseArgs() {
  const a = process.argv.slice(2);
  const ctx = { only: [], keep: false, assertCatalog: null, catalogProject: null };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--case') ctx.only.push(a[++i]);
    else if (a[i] === '--keep-fixtures') ctx.keep = true;
    else if (a[i] === '--assert-catalog') ctx.assertCatalog = a[++i];
    else if (a[i] === '--catalog-project') ctx.catalogProject = a[++i];
    else if (a[i] === '--list-cases') { for (const c of CASES) console.log(`${c.id}\t${c.status || 'active'}\t${c.title}`); process.exit(0); }
  }
  return ctx;
}

const ctx = parseArgs();
let failed = 0, passed = 0, skipped = 0;
for (const c of CASES) {
  if (ctx.only.length && !ctx.only.includes(c.id)) continue;
  const t0 = Date.now();
  try {
    if (c.status === 'pending-scope') { skipped++; console.log(`SKIP ${c.id.padEnd(13)} ${c.note || ''}`); continue; }
    if (c.status === 'live' && !ctx.assertCatalog) { skipped++; console.log(`SKIP ${c.id.padEnd(13)} 需 --assert-catalog（活会话轮次后执行）`); continue; }
    const f = makeFixture();
    const logs = [];
    await c.run(f, { ...ctx, log: (m) => logs.push(m) });
    if (!ctx.keep) f.cleanup(); else console.log(`  fixture kept: ${f.base}`);
    passed++;
    console.log(`PASS ${c.id.padEnd(13)} ${Date.now() - t0}ms  ${c.title}${logs.length ? '  [' + logs.join('; ') + ']' : ''}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${c.id.padEnd(13)} ${e instanceof AssertionError ? e.message : (e.stack || e.message)}`);
  }
}
console.log(`\n${failed === 0 ? 'ALL-GREEN' : 'RED'}: passed=${passed} failed=${failed} skipped=${skipped}`);
process.exit(failed === 0 ? 0 : 1);
