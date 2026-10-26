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
 * ⚠ 必须在 DSH 文件沙箱外跑：沙箱把 junction 虚拟化成普通目录（readlink 报 EINVAL、realpath 原地返回），
 *   link/junction 类 case（resident-global、migrate-agents、copy-fallback…）会**假红**（实锤 2026-10-26）。
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
/** 返回该会话历轮注入的技能名清单数组（按出现顺序）。权威源 = data.source.entries[].name。 */
function catalogEventsFromSession(file) {
  const out = [];
  for (const line of decompressSession(file).split('\n')) {
    if (!line.includes('skill-catalog')) continue;
    let obj; try { obj = JSON.parse(line); } catch { continue; }
    if (obj.type !== 'user/message' || obj.data?.source?.kind !== 'skill-catalog') continue;
    const entries = obj.data?.source?.entries;
    if (Array.isArray(entries) && entries.length) { out.push([...new Set(entries.map((e) => e.name))]); continue; }
    const text = JSON.stringify(obj.data);
    const names = new Set();
    const m = text.match(/(?:^|[^a-z0-9-])([a-z0-9]+(?:-[a-z0-9]+)*)(?:[/\\]SKILL\.md|\\n)/g) || [];
    for (const s of m) names.add(s.replace(/[^a-z0-9-]+$/, '').replace(/^[^a-z0-9-]+/, ''));
    if (names.size) out.push([...names]);
  }
  return out;
}
function findLatestSession(projectRoot) {
  const dir = path.join(os.homedir(), '.dsh', 'sessions', sessionDirKey(projectRoot));
  if (!fs.existsSync(dir)) return null;
  const sess = fs.readdirSync(dir)
    .filter((d) => d.startsWith('session-'))
    .map((d) => { try { return { d, m: fs.statSync(path.join(dir, d)).mtimeMs }; } catch { return { d, m: 0 }; } })
    .sort((a, b) => a.m - b.m); // 最近写入的会话 = 活会话（名字排序不可靠）
  for (let i = sess.length - 1; i >= 0; i--) {
    const file = path.join(dir, sess[i].d, 'session.v4.jsonl.zstd');
    if (fs.existsSync(file)) return file;
  }
  return null;
}
/** 全部候选会话文件（新→旧）：服务重启会开新会话，#6 需回退到最近一个 ≥2 轮的会话。 */
function listSessionFiles(projectRoot) {
  const dir = path.join(os.homedir(), '.dsh', 'sessions', sessionDirKey(projectRoot));
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((d) => d.startsWith('session-'))
    .map((d) => { try { return { d, m: fs.statSync(path.join(dir, d)).mtimeMs }; } catch { return { d, m: 0 }; } })
    .sort((a, b) => b.m - a.m)
    .map((s) => path.join(dir, s.d, 'session.v4.jsonl.zstd'))
    .filter((f) => fs.existsSync(f));
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
    id: 'edit-members', title: '编辑成员：saveSet 改已绑定集成员 → 重绑收敛（摘旧加新、台账无残留、自检绿）',
    async run(f) {
      await withRoots(f);
      for (const n of ['em-alpha', 'em-beta', 'em-gamma']) writeSkill(f.library, n);
      const s = await core('sets');
      await s.saveSet(f.roots, { slug: 'em-set', name: '成员编辑集', description: 'desc-keep', skills: ['em-alpha', 'em-beta'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan, selfCheck } = await core('effective');
      const { readManaged } = await core('managed');
      await writeBinding(f.projectA, 'em-set');
      await applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 'em-set'));
      setEq(skillDirNames(f.projectA), ['em-alpha', 'em-beta'], '初始绑定：条目 = 集');
      // 面板「编辑成员→保存」的编排：saveSet（同 slug、回传原 name/description，γ 勾上 α 取消）→ 当前绑定集再 bind 收敛
      await s.saveSet(f.roots, { slug: 'em-set', name: '成员编辑集', description: 'desc-keep', skills: ['em-beta', 'em-gamma'] });
      eq((await s.loadSet(f.roots, 'em-set')).description, 'desc-keep', 'saveSet 保留 description（UI 回传原值）');
      await writeBinding(f.projectA, 'em-set');
      await applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 'em-set'));
      setEq(skillDirNames(f.projectA), ['em-beta', 'em-gamma'], '成员编辑后收敛：取消勾选摘除、勾选加入、保留项不动');
      setEq(Object.keys((await readManaged(f.projectA)).entries), ['em-beta', 'em-gamma'], '托管台账 = 新成员（旧条目无残留）');
      eq(selfCheck(f.roots, f.projectA).ok, true, '编辑成员后自检绿（不得把自家收敛报成异常）');
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
    id: 'resident-global', title: '常驻 = 链入全局生效区（§5.3）；同名不抢占、退常驻精确回收（M2）',
    async run(f) {
      await withRoots(f);
      for (const n of ['res-a', 'res-b']) writeSkill(f.library, n);
      const s = await core('sets');
      const { syncResident } = await core('resident');
      const { entryKind } = await core('linkx');
      mkdirp(path.join(f.userAgentsSkills, 'res-b')); // 常驻区既有同名外来条目
      fs.writeFileSync(path.join(f.userAgentsSkills, 'res-b', 'SKILL.md'), '# foreign\n');
      await s.saveResident(f.roots, ['res-a', 'res-b']);
      const r = await syncResident(f.roots);
      eq(entryKind(path.join(f.userAgentsSkills, 'res-a')), 'junction', 'res-a 链入常驻区 ~/.agents/skills（P3 搬迁）');
      eq(fs.readFileSync(path.join(f.userAgentsSkills, 'res-b', 'SKILL.md'), 'utf8'), '# foreign\n', '常驻区外来同名不被抢占');
      ok(r.warnings.some((w) => w.includes('res-b')), '常驻区冲突有警告');
      await s.saveResident(f.roots, []);
      await syncResident(f.roots);
      ok(!fs.existsSync(path.join(f.userAgentsSkills, 'res-a')), '取消常驻 → 精确回收自建链接');
      ok(fs.existsSync(path.join(f.userAgentsSkills, 'res-b')), '非我创建的条目不误删');
      await s.saveResident(f.roots, ['res-a']);
      await withRoots(f, { crossHarnessResident: true }); // 开关开 = 额外保留旧 ~/.dsh/skills 链
      await syncResident(f.roots);
      eq(entryKind(path.join(f.userDsh, 'res-a')), 'junction', '开关开时旧区同时链入');
    },
  },
  {
    id: '4', title: '新项目绑定后自动生成生效清单；.managed.json 不被扫成条目（§17#4）',
    async run(f) {
      await withRoots(f);
      for (const n of ['lib-docx', 'lib-pdf', 'resident-x']) writeSkill(f.library, n);
      const s = await core('sets'); await s.saveResident(f.roots, ['resident-x']);
      const { syncResident } = await core('resident'); await syncResident(f.roots);
      await s.saveSet(f.roots, { slug: 'doc', name: '文档', skills: ['lib-docx', 'lib-pdf'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan } = await core('effective');
      const { readManaged } = await core('managed');
      const { entryKind } = await core('linkx');
      await writeBinding(f.projectA, 'doc');
      const plan = await planEffective(f.roots, f.projectA, 'doc');
      await applyPlan(f.projectA, plan);
      setEq(skillDirNames(f.projectA), ['lib-docx', 'lib-pdf'], '项目条目 = 集（常驻在全局区，§5.3）');
      eq(entryKind(path.join(f.userAgentsSkills, 'resident-x')), 'junction', '常驻在全局生效区可见（P3 后 = agents 区）');
      const mg = await readManaged(f.projectA);
      eq(mg.setSlug, 'doc', '托管清单记录来源技能集');
      eq(mg.entries['lib-docx'].from, 'library', 'managed.from = 来源标签（§11）');
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
      await writeBinding(f.projectB, 'two'); await applyPlan(f.projectB, await planEffective(f.roots, f.projectB, 'two'));
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
      const project = ctx.catalogProject || f.projectA;
      let file = ctx.assertCatalog === 'auto' ? null : ctx.assertCatalog;
      let rounds = [];
      if (file) rounds = catalogEventsFromSession(file);
      else {
        let first = null;
        for (const cand of listSessionFiles(project)) { // 服务重启会开新会话：回退到最近一个 ≥2 轮的会话
          if (!first) first = cand;
          const r = catalogEventsFromSession(cand);
          if (r.length >= 2) { file = cand; rounds = r; break; }
        }
        if (!rounds.length && first) { file = first; rounds = catalogEventsFromSession(first); }
      }
      ok(file && fs.existsSync(file), `找不到待解析会话文件（--assert-catalog auto 需要已存在会话的项目）`);
      ok(rounds.length >= 2, `skill-catalog 事件不足 2 轮（${rounds.length}，会话 ${file}），无法断言“切换后下一轮变化”`);
      const pairOf = (rs) => { // 找相邻两轮满足 expectAdd 的最新证据对
        for (let i = rs.length - 2; i >= 0; i--) {
          const b = rs[i], a = rs[i + 1];
          const ad = a.filter((n) => !b.includes(n));
          if (ctx.expectAdd.every((n) => ad.includes(n)) && !ctx.expectAdd.some((n) => b.includes(n))) return { before: b, after: a };
        }
        return null;
      };
      let before; let after;
      if (ctx.expectAdd?.length) {
        let found = rounds.length >= 2 ? pairOf(rounds) : null;
        if (!found && ctx.assertCatalog === 'auto') {
          for (const cand of listSessionFiles(project)) { // 跨会话搜索：重启切会话不失效
            const rs = catalogEventsFromSession(cand);
            found = pairOf(rs);
            if (found) { file = cand; break; }
          }
        }
        ok(found, `所有会话的相邻两轮中未找到满足 --expect-add（${ctx.expectAdd.join(', ')}）的生效证据`);
        before = found.before; after = found.after;
        ctx.log(`expect-add ok: ${ctx.expectAdd.join(', ')}（会话 ${path.basename(path.dirname(file))}）`);
      } else {
        [before, after] = rounds.slice(-2);
      }
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
    id: 'override-consistency', title: '会话临时覆盖/常驻链：自检与诊断不得把自己的机制报成异常（活体误报复盘）',
    async run(f) {
      await withRoots(f);
      writeSkill(f.library, 'lib-a'); writeSkill(f.library, 'lib-b');
      const s = await core('sets');
      await s.saveSet(f.roots, { slug: 'set-a', name: 'A', skills: ['lib-a'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan, selfCheck } = await core('effective');
      await writeBinding(f.projectA, 'set-a');
      await applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 'set-a'));
      // 模拟面板「临时覆盖」：pending.startOverride 直接动目录 + 台账记 sessionOverride（§12.97）
      const pending = await core('pending');
      const T = {};
      const store = {
        get: async (t, k) => T[t + ':' + k],
        put: async (t, k, v) => { T[t + ':' + k] = structuredClone(v); },
        delete: async (t, k) => { delete T[t + ':' + k]; },
        keys: async (t) => Object.keys(T).filter((k) => k.startsWith(t + ':')).map((k) => k.slice(t.length + 1)),
      };
      await pending.startOverride(store, f.roots, f.projectA, { add: ['lib-b'] });
      ok(fs.existsSync(path.join(f.projectA, '.dsh', 'skills', 'lib-b')), '覆盖条目已进生效区');
      const sc = await selfCheck(f.roots, f.projectA);
      ok(sc.ok, `selfCheck 不得把覆盖条目报成多出（活体误报 constitution）: ${sc.detail}`);
      // 活体回归②：切换/重建走 planEffective——它必须认识活动覆盖，否则覆盖条目被摘掉
      // 而覆盖标记还在 → 自检反报「缺失」（活体：重建后 missing: speckit-constitution）
      await applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 'set-a'));
      ok(fs.existsSync(path.join(f.projectA, '.dsh', 'skills', 'lib-b')), '重建不得摘掉活动覆盖条目');
      ok((await selfCheck(f.roots, f.projectA)).ok, '重建后自检仍一致');
      // 常驻 = 全局生效区 junction（§5.3）：诊断不得把自家链报成重复名
      s.saveResident(f.roots, ['lib-b']);
      const { syncResident } = await core('resident');
      await syncResident(f.roots);
      const dg = await (await core('diagnose')).diagnose(f.roots, { projectRoot: f.projectA, cwd: f.base });
      ok(!dg.groups.structure.some((r) => r.kind === 'duplicate'), `常驻链不是重复技能名（活体误报 clarify/plan）: ${JSON.stringify(dg.groups.structure.map((r) => r.what))}`);
      ok(dg.groups.deadLinks.length === 0, '常驻链不是失效链接');
    },
  },
  {
    id: 'frozen', title: '冻结绑定：集被删 → 清单原样保留、不再驱动、红标改绑（Review-Focus 1）',
    async run(f) {
      await withRoots(f);
      writeSkill(f.library, 'f1');
      const s = await core('sets'); await s.saveSet(f.roots, { slug: 'frz', name: 'F', skills: ['f1'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan, selfCheck } = await core('effective');
      const { readManaged } = await core('managed');
      await writeBinding(f.projectA, 'frz');
      await applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 'frz'));
      await s.deleteSet(f.roots, 'frz');
      const sc = await selfCheck(f.roots, f.projectA);
      eq(sc.frozen, true, 'frozen 判定');
      ok(fs.existsSync(path.join(f.projectA, '.dsh', 'skills', 'f1')), '冻结：生效清单原样保留');
      ok('f1' in (await readManaged(f.projectA)).entries, '冻结：托管清单不回收');
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
      // P1a-T0：source/commit 参数贯通 + 单技能直写（GitHub 安装用）
      writeSkill(f.library, 'lib-b');
      await registerLibrary(f.roots, { source: 'github:o/r', commit: 'abc1234' });
      const m2 = JSON.parse(fs.readFileSync(path.join(f.library, 'lib-b', '.manifest.json'), 'utf8'));
      eq(m2.source, 'github:o/r', 'registerLibrary source 参数');
      eq(m2.commit, 'abc1234', 'registerLibrary commit 参数');
      const ma2 = JSON.parse(fs.readFileSync(path.join(f.library, 'lib-a', '.manifest.json'), 'utf8'));
      eq(ma2.source, 'unknown', '已有 manifest 不被参数重刷');
      const { writeSkillManifest } = await core('manifest');
      ok(typeof writeSkillManifest === 'function', 'writeSkillManifest 应导出');
      writeSkill(f.library, 'lib-c');
      const m3 = await writeSkillManifest(path.join(f.library, 'lib-c'), { source: 'github:a/b', commit: 'dead00' });
      eq(m3.source, 'github:a/b', 'writeSkillManifest source');
      eq(m3.commit, 'dead00', 'writeSkillManifest commit');
      ok(Object.keys(m3.files).includes('SKILL.md'), 'writeSkillManifest files 逐文件');
      eq(JSON.parse(fs.readFileSync(path.join(f.library, 'lib-c', '.manifest.json'), 'utf8')).commit, 'dead00', 'writeSkillManifest 落盘');
    },
  },
  {
    id: 'github-install', title: 'GitHub 稀疏安装：解析/拉取/no-clobber/overwrite 先备份（P1a-T1）',
    async run(f) {
      await withRoots(f);
      const repo = fs.mkdtempSync(path.join(f.base, 'ghrepo-'));
      fs.mkdirSync(path.join(repo, 'skills/alpha/nested'), { recursive: true });
      fs.mkdirSync(path.join(repo, 'skills/beta'), { recursive: true });
      fs.writeFileSync(path.join(repo, 'skills/alpha/SKILL.md'), '---\nname: alpha\ndescription: a\n---\n');
      fs.writeFileSync(path.join(repo, 'skills/alpha/nested/SKILL.md'), '---\nname: alpha-nested\ndescription: n\n---\n');
      fs.writeFileSync(path.join(repo, 'skills/beta/SKILL.md'), '---\nname: beta\ndescription: b\n---\n');
      fs.writeFileSync(path.join(repo, 'README.md'), '#r\n');
      execFileSync('git', ['-C', repo, 'init', '-q', '-b', 'main'], { stdio: 'ignore' });
      execFileSync('git', ['-C', repo, 'add', '-A'], { stdio: 'ignore' });
      execFileSync('git', ['-c', 'user.name=v', '-c', 'user.email=v@v', '-C', repo, 'commit', '-qm', 'v1'], { stdio: 'ignore' });
      const head = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      const g = await core('github');
      const s1 = g.parseRepoSpec('o/r');
      eq(s1.owner, 'o', 'parse owner'); eq(s1.repo, 'r', 'parse repo'); eq(s1.ref, null, 'parse ref 缺省'); eq(s1.subpath, null, 'parse subpath 缺省');
      const s2 = g.parseRepoSpec('o/r@v2/a/b');
      eq(s2.ref, 'v2', 'parse ref'); eq(s2.subpath, 'a/b', 'parse subpath');
      const s3 = g.parseRepoSpec('o/r/skills');
      eq(s3.ref, null, '无@ 时 ref 空'); eq(s3.subpath, 'skills', '无@ 时 subpath');
      let threw = false; try { g.parseRepoSpec('bad'); } catch { threw = true; } ok(threw, '非法 spec 应 throw');
      const s4 = g.parseRepoSpec('https://github.com/ox/ry@dev/pkg'); // 粘贴整 URL（review n1）
      eq(s4.owner, 'ox', 'URL 前缀剥离 owner'); eq(s4.repo, 'ry', 'URL 前缀剥离 repo'); eq(s4.ref, 'dev', 'URL 形态 ref'); eq(s4.subpath, 'pkg', 'URL 形态 subpath');
      // 粘贴 clone 地址带 `.git` 后缀（用户报告 2026-10-26：库「检查更新」find-skills 炸）：
      // 不剥就拼出 owner/repo.git.git → GitHub「Repository not found」（本机实锤 exit 128）
      for (const [src, want] of [['o/r.git', 'r'], ['https://github.com/vercel-labs/skills.git', 'skills'], ['o/r.git/skills', 'r'], ['o/r.js', 'r.js'], ['o/r@v2.git/a', 'r']])
        eq(g.parseRepoSpec(src).repo, want, `repo 段剥 .git 克隆后缀：${src}`);
      eq(g.normalizeRepoSource('github:vercel-labs/skills.git'), 'github:vercel-labs/skills', '规范形不留 .git 后缀（认领来源同口径）');
      // 粘贴 GitHub 网页地址 owner/repo/tree/<ref>/<path>（用户报告 2026-10-26：认领来源粘了
      // github.com/cathrynlavery/diagram-design/tree/main/skills → tree/main/skills 被当稀疏路径
      // → 检出空目录 → 检查更新报「上游不含技能」；上游真实路径是 skills/diagram-design）
      const s5 = g.parseRepoSpec('https://github.com/cathrynlavery/diagram-design/tree/main/skills');
      eq([s5.owner, s5.repo, s5.ref, s5.subpath], ['cathrynlavery', 'diagram-design', 'main', 'skills'], '网页地址 tree/<ref>/<path> 归位');
      eq(g.normalizeRepoSource('github:cathrynlavery/diagram-design/tree/main/skills'), 'github:cathrynlavery/diagram-design/skills', '规范形剥掉 tree/main 残留');
      const s6 = g.parseRepoSpec('o/r/blob/dev/pkg/a');
      eq([s6.ref, s6.subpath], ['dev', 'pkg/a'], 'blob/<ref>/<path> 同口径');
      const s7 = g.parseRepoSpec('o/r@v2/tree/x'); // 显式 @ref 为准，网页残留规则不得插手
      eq([s7.ref, s7.subpath], ['v2', 'tree/x'], '显式 @ref 优先于 tree 规则');
      // 报错口径（同一报告）：本机 git 全局 http.sslVerify=false → stderr 首行是 TLS 告警横幅，
      // 真因在 fatal 行；只报首行 = 用户看到「SECURITY WARNING」误判成 GitHub 授权失败
      // 假 git：只有 fetch/ls-remote 炸（fetchRepo 会在 args 前塞 -c 配置，判定须按元素而非 args[0]）
      const warnGit = (args) => (args.includes('fetch') || args.includes('ls-remote')
        ? { status: 128, stdout: '', stderr: "warning: ----------------- SECURITY WARNING ----------------\nwarning: | TLS certificate verification has been disabled! |\nwarning: ---------------------------------------------------\nremote: Repository not found.\nfatal: repository 'https://github.com/o/r.git.git/' not found\n" }
        : { status: 0, stdout: '', stderr: '' });
      const grab = async (mod, fn) => { let m = ''; try { await fn(await core(mod)); } catch (e) { m = String(e?.message ?? e); } return m; };
      const fm = await grab('github', (gg) => gg.fetchRepo({ owner: 'o', repo: 'r', ref: null, subpath: null }, { tmpDir: path.join(f.base, 'gherr-'), git: warnGit }));
      ok(fm.startsWith('git fetch failed'), `fetch 失败归一为业务错，实得：${fm}`);
      ok(fm.includes('not found'), `git 报错须带 fatal 行，实得：${fm}`);
      ok(!fm.includes('SECURITY WARNING'), `不得把 TLS 告警横幅当结论，实得：${fm}`);
      const rm = await grab('updates', (uu) => uu.remoteHead({ owner: 'o', repo: 'r', ref: null, subpath: null }, { git: warnGit }));
      ok(rm.includes('not found') && !rm.includes('SECURITY WARNING'), `ls-remote 同口径，实得：${rm}`);
      // partial clone（用户报告 2026-10-26：大仓库整仓 depth-1 拉包 → 「invalid index-pack output」）：
      // fetch 带 --filter=blob:none 只取树，blob 按 sparse 路径按需取；服务器/老 git 不认则退回全量
      const seen = [];
      const spyGit = (args, cwd) => { seen.push(args.join(' ')); return spawnSync('git', args, { cwd, encoding: 'utf8' }); }; // 此处还不能引用下面 const git（TDZ）
      const got2 = await g.fetchRepo({ owner: 'o', repo: 'r', ref: null, subpath: 'skills' }, { tmpDir: fs.mkdtempSync(path.join(f.base, 'ghpc-')), git: spyGit, url: pathToFileURL(repo).toString() });
      ok(seen.some((a) => a.includes(' fetch ') && a.includes('--filter=blob:none')), 'fetch 走 partial clone（--filter=blob:none）');
      eq(got2.commit, head, 'partial clone 仍能取到 commit');
      ok(fs.existsSync(path.join(got2.skillsDir, 'alpha', 'SKILL.md')), 'partial clone + sparse 仍能检出 skills/alpha');
      const noFilter = (args) => (args.includes('--filter=blob:none')
        ? { status: 128, stdout: '', stderr: 'warning: ----------------- SECURITY WARNING ----------------\nfatal: filtering not recognized by server, ignoring server advertisement\n' }
        : args.includes('rev-parse') ? { status: 0, stdout: 'deadbeef\n', stderr: '' } : { status: 0, stdout: '', stderr: '' });
      const seen2 = [];
      const got3 = await g.fetchRepo({ owner: 'o', repo: 'r', ref: null, subpath: 'skills' }, { tmpDir: fs.mkdtempSync(path.join(f.base, 'ghnf-')), git: (a, c) => { seen2.push(a.join(' ')); return noFilter(a, c); } });
      eq(got3.commit, 'deadbeef', '不认 filter 时退回全量仍能装成');
      ok(seen2.some((a) => a.includes('--filter=blob:none')) && seen2.some((a) => a.includes(' fetch ') && !a.includes('--filter')), '不认 filter → 退回不带 filter 的 fetch');
      // 真因（仓库不存在/网络炸）绝不重试第二轮：慢网络下白等一遍等于把等待翻倍
      const seen3 = [];
      let fm2 = '';
      try { await g.fetchRepo({ owner: 'o', repo: 'r', ref: null, subpath: null }, { tmpDir: fs.mkdtempSync(path.join(f.base, 'ghrt-')), git: (a) => { seen3.push(a.join(' ')); return a.includes('fetch') ? { status: 128, stdout: '', stderr: "warning: SECURITY\nfatal: repository 'https://github.com/o/r.git.git/' not found\n" } : { status: 0, stdout: '', stderr: '' }; } }); } catch (e) { fm2 = String(e?.message ?? e); }
      ok(fm2.includes('not found'), `仓库不存在照报 fatal 行，实得：${fm2}`);
      eq(seen3.filter((a) => a.includes(' fetch ')).length, 1, '非 filter 失败不重试（只拉一次）');
      const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8' });
      const spec = g.parseRepoSpec('o/r/skills');
      const tmp = fs.mkdtempSync(path.join(f.base, 'ghwt-'));
      const got = await g.fetchRepo(spec, { tmpDir: tmp, git, url: pathToFileURL(repo).toString() });
      eq(got.commit, head, 'fetch commit == HEAD');
      ok(fs.existsSync(path.join(got.skillsDir, 'alpha', 'SKILL.md')), '稀疏检出 skills/alpha 可见');
      const res = await g.installSkills(f.roots, { source: 'github:o/r', commit: got.commit, skillsDir: got.skillsDir, backup: async () => 'unused' });
      eq(JSON.stringify(res.map((r) => r.name).sort()), JSON.stringify(['alpha', 'beta']), '装 alpha+beta');
      ok(res.every((r) => r.ok), '全部 ok');
      const m = JSON.parse(fs.readFileSync(path.join(f.library, 'alpha', '.manifest.json'), 'utf8'));
      eq(m.source, 'github:o/r', 'manifest.source'); eq(m.commit, head, 'manifest.commit');
      const again = await g.installSkills(f.roots, { source: 'github:o/r', commit: got.commit, skillsDir: got.skillsDir, backup: async () => 'unused' });
      ok(again.length === 2 && again.every((r) => !r.ok && r.reason === 'exists'), '同名 no-clobber 跳过');
      fs.writeFileSync(path.join(f.library, 'alpha', 'SKILL.md'), 'local-mod');
      let backed = 0;
      const ow = await g.installSkills(f.roots, { source: 'github:o/r', commit: got.commit, skillsDir: got.skillsDir, overwrite: true, backup: async () => { backed++; return 'b'; } });
      ok(ow.find((r) => r.name === 'alpha')?.ok, 'overwrite 成功');
      eq(backed, 2, 'overwrite 先备份（alpha+beta 均覆盖）');
      ok(!fs.readFileSync(path.join(f.library, 'alpha', 'SKILL.md'), 'utf8').includes('local-mod'), 'overwrite 后为上游内容');
      const nf = await g.installSkills(f.roots, { source: 'github:o/r', commit: got.commit, skillsDir: got.skillsDir, names: ['alpha', 'nope'], backup: async () => 'unused' });
      eq(JSON.stringify(nf.map((r) => `${r.name}:${r.ok ? 'ok' : r.reason}`).sort()), JSON.stringify(['alpha:exists', 'nope:not-found']), 'names 缺项报 not-found（review n2）');
      let gerr = null;
      try { await g.fetchRepo(spec, { tmpDir: fs.mkdtempSync(path.join(f.base, 'ghx-')), git: () => { const e = new Error('spawn git ENOENT'); e.code = 'ENOENT'; throw e; }, url: 'file://nope' }); } catch (e) { gerr = e; }
      ok(gerr && /git/i.test(gerr.message), 'git 缺失 → 业务错含 git（Review Focus #1）');
    },
  },
  {
    id: 'update-skip-local', title: '升级三份比对：本地改动默认跳过并报告（§17#9 数据侧，P1a-T2）',
    async run(f) {
      await withRoots(f);
      const repo = fs.mkdtempSync(path.join(f.base, 'uprepo-'));
      const sk = path.join(repo, 'skills/alpha');
      fs.mkdirSync(path.join(sk, 'reference'), { recursive: true });
      fs.writeFileSync(path.join(sk, 'SKILL.md'), 'v1 body\n');
      fs.writeFileSync(path.join(sk, 'gone.md'), 'to-be-removed\n');
      fs.writeFileSync(path.join(sk, 'stable.md'), 'stable\n');
      fs.writeFileSync(path.join(sk, 'reference/placeholder.md'), 'p\n'); // 保证目录入 git
      execFileSync('git', ['-C', repo, 'init', '-q', '-b', 'main'], { stdio: 'ignore' });
      const gcommit = (m) => {
        execFileSync('git', ['-C', repo, 'add', '-A'], { stdio: 'ignore' });
        execFileSync('git', ['-c', 'user.name=v', '-c', 'user.email=v@v', '-C', repo, 'commit', '-qm', m], { stdio: 'ignore' });
      };
      gcommit('v1');
      const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8' });
      const url = pathToFileURL(repo).toString();
      const g = await core('github');
      const got = await g.fetchRepo({ owner: 'o', repo: 'r', ref: null, subpath: 'skills' }, { tmpDir: fs.mkdtempSync(path.join(f.base, 'upwt1-')), git, url });
      await g.installSkills(f.roots, { source: 'github:o/r', commit: got.commit, skillsDir: got.skillsDir, backup: async () => 'b' });
      // 上游 v2：SKILL.md 改、reference/x.md 增、gone.md 删；stable.md 不动
      fs.writeFileSync(path.join(sk, 'SKILL.md'), 'v2 body\n');
      fs.writeFileSync(path.join(sk, 'reference/x.md'), 'new\n');
      fs.rmSync(path.join(sk, 'gone.md'));
      gcommit('v2');
      const head2 = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      // 本地：SKILL.md 也改（上游+本地双改 → 跳过）；notes.md 本地独有（不入 action）
      const libAlpha = path.join(f.library, 'alpha');
      fs.writeFileSync(path.join(libAlpha, 'SKILL.md'), 'local body\n');
      fs.writeFileSync(path.join(libAlpha, 'notes.md'), 'mine\n');
      const u = await core('updates');
      const remote = await u.remoteHead({ owner: 'o', repo: 'r' }, { git, url });
      eq(remote, head2, 'remoteHead == v2 HEAD');
      const fetch = async () => g.fetchRepo({ owner: 'o', repo: 'r', ref: null, subpath: 'skills' }, { tmpDir: fs.mkdtempSync(path.join(f.base, 'upwt2-')), git, url });
      const chk = await u.checkUpdate(f.roots, 'alpha', { fetch });
      eq(chk.upToDate, false, 'upToDate=false');
      eq(chk.remote, head2, 'checkUpdate.remote');
      const act = Object.fromEntries(chk.files.map((x) => [x.path, x.action]));
      eq(act['SKILL.md'], 'skip-modified', '双改 → 跳过保留本地');
      eq(act['reference/x.md'], 'add', '上游新增 → add');
      eq(act['gone.md'], 'remove', '上游删&本地未改 → remove');
      eq(act['stable.md'], 'same', '未变 → same');
      ok(!chk.files.some((x) => x.path === 'notes.md'), '本地独有文件不入 action 列表');
      let bk = 0;
      let fetchCount = 0;
      const fetch1 = async () => { fetchCount++; return fetch(); };
      const ap = await u.applyUpdate(f.roots, 'alpha', { fetch: fetch1, backup: async () => { bk++; return 'bk'; } });
      eq(fetchCount, 1, 'apply 只拉一次上游（review n7）');
      eq(bk, 1, '升级前自动备份（§17#9/#10 前置）');
      eq(JSON.stringify(ap.skipped), JSON.stringify(['SKILL.md']), 'skipped 报告含本地改动文件');
      ok(fs.readFileSync(path.join(libAlpha, 'SKILL.md'), 'utf8').includes('local body'), '本地改动未被覆盖');
      ok(fs.readFileSync(path.join(libAlpha, 'reference/x.md'), 'utf8').includes('new'), '新增文件已写入');
      ok(!fs.existsSync(path.join(libAlpha, 'gone.md')), '上游删已落实');
      ok(fs.readFileSync(path.join(libAlpha, 'notes.md'), 'utf8').includes('mine'), '本地独有文件不动');
      const m2 = JSON.parse(fs.readFileSync(path.join(libAlpha, '.manifest.json'), 'utf8'));
      eq(m2.commit, head2, 'manifest commit 前进');
      const H = (t) => 'sha256:' + crypto.createHash('sha256').update(t).digest('hex');
      eq(m2.files['SKILL.md'], H('v1 body\n'), '跳过文件 baseline 保持旧上游哈希（下轮仍可识别本地偏差）');
      const chk2 = await u.checkUpdate(f.roots, 'alpha', { fetch });
      eq(chk2.upToDate, true, '已到 HEAD → upToDate');
      const act2 = Object.fromEntries(chk2.files.map((x) => [x.path, x.action]));
      eq(act2['SKILL.md'], 'skip-modified', 'upToDate 仍照出上轮跳过的本地分歧（活体冒烟教训）');
      eq(act2['stable.md'], 'same', '其余 same');
      // 来源被粘贴成仓库根（无子路径）：按安装侧同口径只下探一层找 <sub>/<name>/SKILL.md
      // （用户报告 2026-10-26：github:vercel-labs/skills 的 find-skills 实际在 skills/find-skills）
      const upRoot = path.join(f.base, 'uproot');
      fs.mkdirSync(path.join(upRoot, 'skills/alpha'), { recursive: true });
      fs.writeFileSync(path.join(upRoot, 'skills/alpha/SKILL.md'), 'v1 body\n');
      eq(u.upstreamDirOf(upRoot, 'alpha', fs), path.join(upRoot, 'skills/alpha'), '来源无子路径 → 下探一层命中');
      fs.mkdirSync(path.join(upRoot, 'other/alpha'), { recursive: true });
      fs.writeFileSync(path.join(upRoot, 'other/alpha/SKILL.md'), 'dup\n');
      let em = ''; try { u.upstreamDirOf(upRoot, 'alpha', fs); } catch (e) { em = String(e?.message ?? e); }
      ok(em.includes('skills') && em.includes('other'), `多处命中列候选不猜，实得：${em}`);
      let em2 = ''; try { u.upstreamDirOf(upRoot, 'nope', fs); } catch (e) { em2 = String(e?.message ?? e); }
      ok(em2.includes('上游不含技能 "nope"') && em2.includes('github:'), `不含该技能时给出改来源提示，实得：${em2}`);
      // 端到端：fetch 返回仓库根当 skillsDir，仍要能定位上游技能做三份比对（原先必抛「上游不含技能」）
      const fetchRoot = async () => g.fetchRepo({ owner: 'o', repo: 'r', ref: null, subpath: null }, { tmpDir: fs.mkdtempSync(path.join(f.base, 'upwt3-')), git, url });
      const chk3 = await u.checkUpdate(f.roots, 'alpha', { fetch: fetchRoot });
      eq(chk3.upToDate, true, '无子路径来源也能比对（已在 HEAD）');
      ok(chk3.files.some((x) => x.path === 'SKILL.md' && x.action === 'skip-modified'), '无子路径来源：下探一层后仍照出本地分歧');
    },
  },
  {
    id: 'uninstall-backup-restore', title: '卸载→回收站→跨集跨项目回收→恢复哈希一致（§17#10，P1a-T3）',
    async run(f) {
      await withRoots(f);
      writeSkill(f.library, 'alpha'); writeSkill(f.library, 'beta');
      const { registerLibrary } = await core('manifest');
      await registerLibrary(f.roots);
      const alphaHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(f.library, 'alpha', 'SKILL.md'))).digest('hex');
      const { saveSet } = await core('sets');
      await saveSet(f.roots, { slug: 's1', name: 'S1', skills: ['alpha', 'beta'] });
      await saveSet(f.roots, { slug: 's2', name: 'S2', skills: ['alpha'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan } = await core('effective');
      for (const [proj, slug] of [[f.projectA, 's1'], [f.projectB, 's2']]) {
        writeBinding(proj, slug);
        applyPlan(proj, await planEffective(f.roots, proj, slug));
      }
      eq(JSON.stringify(skillDirNames(f.projectA)), JSON.stringify(['alpha', 'beta']), '前置：A=alpha+beta');
      eq(JSON.stringify(skillDirNames(f.projectB)), JSON.stringify(['alpha']), '前置：B=alpha');
      // B 的集先删 → B 进入冻结态，卸载时不得动 B
      fs.rmSync(path.join(f.dshHome, 'skill-sets', 's2.json'));
      const lc = await core('lifecycle');
      const res = await lc.uninstallSkill(f.roots, { name: 'alpha', bindings: [f.projectA, f.projectB] }, {});
      ok(res.backup && fs.existsSync(res.backup), '卸载前自动备份');
      ok(!fs.existsSync(path.join(f.library, 'alpha')), '库体已删');
      eq(JSON.stringify(res.frozenProjects), JSON.stringify([f.projectB]), '冻结项目识别');
      ok(res.rewrittenProjects.includes(f.projectA), 'A 重写');
      eq(JSON.stringify(skillDirNames(f.projectA)), JSON.stringify(['beta']), 'A 精确回收 alpha 无孤儿');
      const { readManaged } = await core('managed');
      ok(!('alpha' in (await readManaged(f.projectA)).entries), 'A 托管清单同步');
      eq(JSON.stringify(fs.readdirSync(path.join(f.projectB, '.dsh', 'skills')).filter((n) => n !== '.managed.json').sort()), JSON.stringify(['alpha']), '冻结项目条目原样保留（死链也不动，§7.8）');
      const { loadSet } = await core('sets');
      eq(JSON.stringify((await loadSet(f.roots, 's1')).skills), JSON.stringify(['beta']), 's1 移除 alpha');
      const oplog = JSON.parse(fs.readFileSync(path.join(f.library, '.backups', 'oplog.json'), 'utf8'));
      eq(oplog.at(-1).action, 'uninstall', '操作日志'); eq(oplog.at(-1).name, 'alpha', '日志 name');
      const b = await core('backup');
      const list = b.listBackups(f.roots, 'alpha');
      ok(list.length >= 1, '回收站可见');
      const r = b.restore(f.roots, 'alpha', list[0].dir);
      eq(r.verified, true, '恢复后逐文件哈希一致（§17#10 判定）');
      eq(crypto.createHash('sha256').update(fs.readFileSync(path.join(f.library, 'alpha', 'SKILL.md'))).digest('hex'), alphaHash, 'SKILL.md 内容复原');
      // prune：12 份快照留 10（§8.8）
      const droot = path.join(f.library, '.backups', 'delta');
      for (let i = 0; i < 12; i++) { const d = path.join(droot, `2026-10-0${i < 10 ? i : i - 10}T00-00-00-000Z`); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'SKILL.md'), 'x'); }
      b.prune(f.roots, 'delta');
      ok(fs.readdirSync(droot).length === 10, 'prune 留最近 10 份');
      fs.mkdirSync(path.join(droot, '2026-01-01T00-00-00-000Z.tmp'), { recursive: true });
      b.prune(f.roots, 'delta');
      ok(!fs.readdirSync(droot).some((n) => n.endsWith('.tmp')), 'prune 顺带清崩溃残留 .tmp（review n6）');
      // Review Focus #3：半成品不入回收站
      // m1 真注入：拷贝中途抛 → 无已发布半成品、.tmp 已清（原空断言转正，review m1）
      const boomFs = { ...fs, writeFileSync: (p, ...a) => { if (String(p).includes('.tmp')) throw new Error('boom'); return fs.writeFileSync(p, ...a); } };
      let berr = null;
      try { b.snapshot(f.roots, 'alpha', { fs: boomFs }); } catch (e) { berr = e; }
      ok(berr, 'snapshot 中途失败上抛');
      eq(b.listBackups(f.roots, 'alpha').length, list.length, '中断不产生已发布快照');
      ok(!fs.readdirSync(path.join(f.library, '.backups', 'alpha')).some((n) => n.endsWith('.tmp')), '半成品 .tmp 已清');
      // m2：覆盖式 restore 对现存库体先自动快照（Review Focus #2 口径）
      const before2 = b.listBackups(f.roots, 'alpha').length;
      const r2 = b.restore(f.roots, 'alpha', list[0].dir);
      eq(r2.verified, true, '二次恢复仍哈希一致');
      eq(b.listBackups(f.roots, 'alpha').length, before2 + 1, '覆盖恢复前自动快照');
      // n8：oplog 只保留最近 200 条（无界增长防线）
      const oplogFile = path.join(f.library, '.backups', 'oplog.json');
      fs.writeFileSync(oplogFile, JSON.stringify(Array.from({ length: 250 }, (_, i) => ({ ts: 'x', action: 'uninstall', name: 'n' + i }))));
      await lc.uninstallSkill(f.roots, { name: 'alpha', bindings: [f.projectA, f.projectB] }); // alpha 已被 restore 复原，再卸一次
      const log = JSON.parse(fs.readFileSync(oplogFile, 'utf8'));
      eq(log.length, 200, 'oplog 封顶 200 条（review n8）');
      eq(log.at(-1).name, 'alpha', '封顶保留的是最新记录');
    },
  },
  {
    id: '10', title: '卸载→回收站→恢复（§17#10 → uninstall-backup-restore/rebuild-dead-entry）', run: async () => {},
  },
  {
    id: 'diagnose-fixture', title: '诊断六类：悬空/失效链接/重复/非kebab/嵌套/环境逐项命中且不抛（§17#11，P1a-T4）',
    async run(f) {
      await withRoots(f);
      const dg = await core('diagnose');
      // 干净夹具：除分区(info)外全空
      const clean = dg.diagnose(f.roots, { projectRoot: f.projectA, cwd: f.projectA });
      for (const k of ['copies', 'dangling', 'deadLinks', 'structure', 'env'])
        eq(JSON.stringify(clean.groups[k]), JSON.stringify([]), `干净夹具 ${k} 应为空`);
      ok(Array.isArray(clean.groups.partition), 'partition 分区存在');
      ok(clean.fixable && clean.fixable.reclaimDeadLinks && clean.fixable.rebuild, 'fixable 两动作暴露');
      // 注入五类异常（§17#11 清单）
      const { saveSet } = await core('sets');
      await saveSet(f.roots, { slug: 's1', name: 'S1', skills: ['ghost'] }); // 悬空引用
      writeSkill(f.userDsh, 'dup'); writeSkill(f.library, 'dup'); // 重复技能名
      writeSkill(f.library, 'Bad_Name'); // 非 kebab-case
      writeSkill(f.library, 'alpha');
      fs.mkdirSync(path.join(f.library, 'alpha', 'nested'), { recursive: true });
      fs.writeFileSync(path.join(f.library, 'alpha', 'nested', 'SKILL.md'), '---\nname: n\ndescription: n\n---\n'); // 嵌套
      // 失效链接：项目内 junction 指向不存在库体
      const { makeEntry } = await core('linkx');
      writeSkill(f.library, 'ghostbody');
      const deadLink = path.join(f.projectA, '.dsh', 'skills', 'dead');
      fs.mkdirSync(path.dirname(deadLink), { recursive: true });
      makeEntry(path.join(f.library, 'ghostbody'), deadLink);
      fs.rmSync(path.join(f.library, 'ghostbody'), { recursive: true, force: true }); // 本体消失 → 死链
      const d = dg.diagnose(f.roots, { projectRoot: f.projectA, cwd: f.projectA });
      ok(d.groups.dangling.some((r) => String(r.what).includes('ghost')), '悬空引用报出');
      ok(d.groups.deadLinks.some((r) => String(r.what).includes('dead')), '失效链接报出');
      ok(d.groups.structure.some((r) => r.kind === 'duplicate' && String(r.what).includes('dup')), '重复名报出');
      ok(d.groups.structure.some((r) => r.kind === 'kebab' && String(r.what).includes('Bad_Name')), '非 kebab 报出');
      ok(d.groups.structure.some((r) => r.kind === 'nested' && String(r.what).includes('alpha')), '嵌套 SKILL.md 报出且不追');
      for (const g of ['dangling', 'deadLinks', 'structure'])
        ok(d.groups[g].every((r) => r.level && r.fix), '每条附级别与可复制修复动作');
      // 环境类：custom 目录覆盖库路径 / workspace-scope 双真相源 / 根漂移
      const r2 = await withRoots(f, { customSkillDirs: [f.library] });
      const d2 = dg.diagnose(r2, { projectRoot: f.projectA, cwd: f.projectA });
      ok(d2.groups.env.some((r) => String(r.what).includes('custom')), 'custom 覆盖库路径报出');
      const d3 = dg.diagnose(f.roots, { projectRoot: f.projectA, cwd: f.projectA, workspaceScopeInstalled: true });
      ok(d3.groups.env.some((r) => String(r.what).includes('workspace-scope')), '双真相源提示');
      const d4 = dg.diagnose(f.roots, { projectRoot: f.projectA, cwd: path.join(f.projectA, 'sub') });
      ok(d4.groups.env.some((r) => String(r.what).includes('根漂移') || String(r.what).toLowerCase().includes('drift')), '根漂移报出');
      // 副本漂移：copied 条目盘上内容与库不一致
      const { writeBinding } = await core('binding');
      const { writeManaged } = await core('managed');
      await saveSet(f.roots, { slug: 's3', name: 'S3', skills: ['dup'] });
      writeBinding(f.projectB, 's3');
      writeManaged(f.projectB, { setSlug: 's3', entries: { dup: { kind: 'copy', from: 'skill-library', copied: true }, flatone: { kind: 'copy', from: 'skill-library', copied: true, flat: true }, gone1: { kind: 'junction', from: 'skill-library' } }, sessionOverride: { active: false, previous: null } });
      fs.mkdirSync(path.join(f.projectB, '.dsh', 'skills', 'dup'), { recursive: true });
      fs.writeFileSync(path.join(f.projectB, '.dsh', 'skills', 'dup', 'SKILL.md'), 'drifted\n');
      writeSkill(f.library, 'flatone'); writeSkill(f.library, 'gone1'); // gone1：库体在、盘上条目没了 → 外删
      fs.writeFileSync(path.join(f.projectB, '.dsh', 'skills', 'flatone.md'), '---\nname: flatone\ndescription: flat\n---\n');
      const d5 = dg.diagnose(f.roots, { projectRoot: f.projectB, cwd: f.projectB });
      ok(d5.groups.copies.some((r) => String(r.what).includes('漂移') || String(r.what).includes('drift') || r.level === 'warn'), '副本漂移检出');
      ok(!d5.groups.env.some((r) => String(r.what).includes('flatone')), 'flat 托管条目不误报 foreign（review m7）');
      ok(d5.groups.dangling.some((r) => String(r.what).includes('gone1')), '台账在盘上缺 → broken-entry 报出');
      // 集名同步（用户报告 2026-10-26：面板里 aa 已改名「设计类」，诊断分区行仍打 slug）
      await saveSet(f.roots, { slug: 'aa', name: '设计类', skills: ['ghost'] });
      writeBinding(f.projectA, 'aa');
      const d6 = dg.diagnose(f.roots, { projectRoot: f.projectA, cwd: f.projectA });
      const part = d6.groups.partition.map((r) => String(r.what)).join('\n');
      ok(part.includes('"设计类"'), '分区行显示技能集显示名');
      ok(!part.includes('"aa"'), '分区行不再打 slug（改名后不同步）');
      const dang = d6.groups.dangling.filter((r) => String(r.what).includes('"ghost"')).map((r) => String(r.what)).join('\n');
      ok(dang.includes('设计类') && !dang.includes('"aa"'), '悬空行同样用显示名');
    },
  },
  {
    id: 'migrate', title: '迁移向导：预览/移动/ledger 幂等续跑/一键回滚（§8.2，P1a-T5）',
    async run(f) {
      await withRoots(f);
      writeSkill(f.userDsh, 'gamma'); writeSkill(f.userDsh, 'delta');
      writeSkill(f.library, 'delta'); // 库同名 → 不得移动（no-clobber）
      const { saveResident } = await core('sets');
      saveResident(f.roots, ['gamma']); // gamma 曾常驻：apply 后链回原区，undo 必须先摘链（review m4）
      const m = await core('migrate');
      const pv = m.preview(f.roots);
      eq(JSON.stringify(pv.moves.map((x) => x.name)), JSON.stringify(['gamma']), '只移 gamma');
      eq(pv.keep[0]?.name, 'delta', '同名 keep'); eq(pv.keep[0]?.reason, 'exists', 'keep 理由');
      ok(pv.warnings.some((w) => w.includes('只剩常驻')), '向导明说「其他 harness 将只剩常驻技能」');
      const L = { data: null };
      const ledger = { load: async () => L.data, save: async (d) => { L.data = JSON.parse(JSON.stringify(d)); } };
      const ap = await m.apply(f.roots, { moves: pv.moves, ledger });
      const { entryKind } = await core('linkx');
      eq(entryKind(path.join(f.userAgentsSkills, 'gamma')), 'junction', '原区真身消失、常驻链在 agents 区（P3）');
      ok(fs.existsSync(path.join(f.library, 'gamma', 'SKILL.md')), '入库');
      eq(JSON.stringify(L.data.moved.map((x) => x.name)), JSON.stringify(['gamma']), 'ledger 记录');
      ok(ap.moved.includes('gamma'), 'apply 返回');
      // 中断续跑：m1 成功 m2 抛 → 重跑补齐且不重复
      writeSkill(f.userDsh, 'm1'); writeSkill(f.userDsh, 'm2');
      const moves2 = [{ name: 'm1', from: path.join(f.userDsh, 'm1'), to: path.join(f.library, 'm1') }, { name: 'm2', from: path.join(f.userDsh, 'm2'), to: path.join(f.library, 'm2') }];
      const boomFs = { ...fs, renameSync: (a, b) => { if (String(a).includes('m2')) throw new Error('boom'); return fs.renameSync(a, b); } };
      let boom = null;
      try { await m.apply(f.roots, { moves: moves2, ledger }, { fs: boomFs }); } catch (e) { boom = e; }
      ok(boom, '中断上抛');
      ok(fs.existsSync(path.join(f.library, 'm1')), 'm1 已入库');
      const ap2 = await m.apply(f.roots, { moves: moves2, ledger });
      ok(fs.existsSync(path.join(f.library, 'm2', 'SKILL.md')), 'm2 续跑补齐');
      eq(JSON.stringify(L.data.moved.map((x) => x.name).sort()), JSON.stringify(['gamma', 'm1', 'm2']), 'ledger 无重复');
      // 回滚
      await m.undo(f.roots, { ledger });
      ok(fs.existsSync(path.join(f.userDsh, 'gamma', 'SKILL.md')) && fs.existsSync(path.join(f.userDsh, 'm2', 'SKILL.md')), '回滚复原');
      eq(entryKind(path.join(f.userDsh, 'gamma')), 'dir', 'undo 先摘常驻链再回移（review m4）');
      ok(!fs.existsSync(path.join(f.library, 'gamma')), '库侧移除');
      eq(JSON.stringify(L.data.moved), JSON.stringify([]), 'ledger 清空');
    },
  },
  {
    id: 'unbind', title: '解绑：托管条目精确回收、用户条目不动、幂等（P1a-T6 面板缺口）',
    async run(f) {
      await withRoots(f);
      writeSkill(f.library, 'alpha'); writeSkill(f.library, 'beta');
      const { saveSet } = await core('sets');
      await saveSet(f.roots, { slug: 's1', name: 'S1', skills: ['alpha', 'beta'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan } = await core('effective');
      writeBinding(f.projectA, 's1');
      applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 's1'));
      writeSkill(path.join(f.projectA, '.dsh', 'skills'), 'userown'); // 外来条目必须存活
      const lc = await core('lifecycle');
      const r = lc.unbindProject(f.projectA);
      eq(r.wasBound, true, 'wasBound');
      eq(JSON.stringify(r.removed.sort()), JSON.stringify(['alpha', 'beta']), '托管条目全回收');
      eq(JSON.stringify(skillDirNames(f.projectA)), JSON.stringify(['userown']), '用户条目不动');
      const { readBinding, bindingFile } = await core('binding');
      const { readManaged, managedFile } = await core('managed');
      eq(readBinding(f.projectA), null, 'binding 已删');
      ok(!fs.existsSync(bindingFile(f.projectA)), 'binding 文件消失');
      eq(readManaged(f.projectA), null, 'managed 已删');
      ok(fs.existsSync(path.join(f.projectA, '.dsh', 'skills', 'userown', 'SKILL.md')), 'userown 内容完整');
      const r2 = lc.unbindProject(f.projectA);
      eq(r2.wasBound, false, '幂等：再解绑不抛');
    },
  },
  {
    id: 'delete-set-multi', title: 'deleteSet 全量受影响项目推导 + 双项目冻结语义（P1a-T6）',
    async run(f) {
      await withRoots(f);
      writeSkill(f.library, 'alpha');
      const { saveSet, deleteSet, loadSet } = await core('sets');
      await saveSet(f.roots, { slug: 's1', name: 'S1', skills: ['alpha'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan, selfCheck } = await core('effective');
      for (const p of [f.projectA, f.projectB]) {
        writeBinding(p, 's1');
        applyPlan(p, await planEffective(f.roots, p, 's1'));
      }
      writeBinding(f.projectB, 's1'); // B 也绑 s1
      const lc = await core('lifecycle');
      eq(JSON.stringify(lc.findBoundProjects([f.projectA, f.projectB], 's1').sort()),
        JSON.stringify([f.projectA, f.projectB].sort()), 'findBoundProjects 全量');
      eq(JSON.stringify(lc.findBoundProjects([f.projectA, f.projectB], 'nope')), JSON.stringify([]), '不误报');
      deleteSet(f.roots, 's1');
      eq(loadSet(f.roots, 's1'), null, '集已删');
      for (const p of [f.projectA, f.projectB]) {
        const sc = selfCheck(f.roots, p);
        eq(sc.frozen, true, `${path.basename(p)} 冻结红标`);
        eq(JSON.stringify(skillDirNames(p)), JSON.stringify(['alpha']), '冻结：生效清单原样（§7.8）');
      }
    },
  },
  {
    id: 'rebuild-dead-entry', title: '托管条目外删/死链 → 重建（review M1：重新生成不得空转）',
    async run(f) {
      await withRoots(f);
      writeSkill(f.library, 'alpha'); writeSkill(f.library, 'beta');
      const { saveSet } = await core('sets');
      await saveSet(f.roots, { slug: 's1', name: 'S1', skills: ['alpha', 'beta'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan } = await core('effective');
      const { entryKind, removeEntry, makeEntry } = await core('linkx');
      writeBinding(f.projectA, 's1');
      applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 's1'));
      eq(JSON.stringify(skillDirNames(f.projectA)), JSON.stringify(['alpha', 'beta']), '前置：两条目齐');
      // 场景①：外删托管目录（台账仍记）→ plan 必须重新进 add
      fs.rmSync(path.join(f.projectA, '.dsh', 'skills', 'alpha'), { recursive: true, force: true });
      const p1 = await planEffective(f.roots, f.projectA, 's1');
      ok(p1.add.some((a) => a.name === 'alpha'), '外删条目回到 add（不再 keep 空转）');
      ok(p1.keep.includes('beta') && !p1.keep.includes('alpha'), 'keep 只留真存在项');
      const r1 = applyPlan(f.projectA, p1);
      eq(r1.applied.added, 1, 'added=1');
      eq(entryKind(path.join(f.projectA, '.dsh', 'skills', 'alpha')), 'junction', '重建为 junction');
      // 场景②：死 junction（本体没了）→ removeEntry 自判可摘 stub；makeEntry 重建
      const betaStub = path.join(f.projectA, '.dsh', 'skills', 'beta');
      eq(entryKind(betaStub), 'junction', '前置：beta 是活 junction');
      fs.rmSync(path.join(f.library, 'beta'), { recursive: true, force: true }); // 库体消失 → 死链
      eq(entryKind(betaStub), 'missing', '死链 entryKind=missing');
      eq(removeEntry(betaStub), true, 'removeEntry 自判摘死 stub（Dirent 支路）');
      ok(!fs.existsSync(betaStub), 'stub 已消失');
      writeSkill(f.library, 'beta'); // 库体回来
      const p2 = await planEffective(f.roots, f.projectA, 's1');
      ok(p2.add.some((a) => a.name === 'beta'), '死链重建回 add');
      applyPlan(f.projectA, p2);
      eq(entryKind(betaStub), 'junction', 'beta 重建为 junction');
      ok(fs.readFileSync(path.join(betaStub, 'SKILL.md'), 'utf8').includes('beta'), '内容可读');
      // 场景③：makeEntry 对已存在死 stub 先清再建（不清会 EEXIST）
      fs.rmSync(path.join(f.library, 'beta'), { recursive: true, force: true });
      makeEntry(path.join(f.library, 'alpha'), betaStub); // 对死 stub 直接建
      eq(entryKind(betaStub), 'junction', 'makeEntry 先清死 stub 再建');
      const r3 = applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 's1'));
      ok(r3.applied.added >= 0, '幂等：再 apply 不抛');
      eq(JSON.stringify(skillDirNames(f.projectA)), JSON.stringify(['alpha', 'beta']), '终态两条目齐');
    },
  },
  {
    id: '11', title: '诊断六类分组报出（§17#11 → diagnose-fixture）', run: async () => {},
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
  {
    id: 'override-merge', title: '连续临时覆盖：覆盖记录按净差累计（第二次操作不得丢第一次记录），自检不误报“多出”',
    async run(f) {
      await withRoots(f);
      for (const n of ['ov-a', 'ov-b', 'ov-c']) writeSkill(f.library, n);
      const s = await core('sets'); await s.saveSet(f.roots, { slug: 'ov-set', name: 'OV', skills: ['ov-a', 'ov-b'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan, selfCheck } = await core('effective');
      const { readManaged } = await core('managed');
      const { makeFallbackStore } = await core('storage');
      const p = await core('pending');
      await writeBinding(f.projectA, 'ov-set'); await applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 'ov-set'));
      const store = makeFallbackStore(path.join(f.base, 'store'));
      // 用户报的场景：先勾选加 c，再取消勾选摘 b——第二次操作不得把第一次的 added 抹掉
      await p.startOverride(store, f.roots, f.projectA, { add: ['ov-c'], sessionId: 's1' });
      await p.startOverride(store, f.roots, f.projectA, { remove: ['ov-b'], sessionId: 's1' });
      setEq(skillDirNames(f.projectA), ['ov-a', 'ov-c'], '盘上：c 在、b 摘');
      const mg1 = await readManaged(f.projectA);
      setEq(mg1.sessionOverride.added, ['ov-c'], '第二次覆盖不得丢第一次的新增记录');
      setEq(mg1.sessionOverride.removed, ['ov-b'], '第二次的移除记录生效');
      eq(selfCheck(f.roots, f.projectA).ok, true, '自检绿（c 有账可依，不得报“多出”）');
      // 把摘掉的 b 再加回：removed 里的 b 净归零
      await p.startOverride(store, f.roots, f.projectA, { add: ['ov-b'], sessionId: 's1' });
      const mg2 = await readManaged(f.projectA);
      setEq(mg2.sessionOverride.added, ['ov-c'], '加回基线内的 b 不进 added');
      setEq(mg2.sessionOverride.removed, [], '加回后 removed 清掉 b');
      // 把加过的 c 再摘掉：c 从 added 净归零，也不进 removed（不在集里谈不上“移除”）
      await p.startOverride(store, f.roots, f.projectA, { remove: ['ov-c'], sessionId: 's1' });
      const mg3 = await readManaged(f.projectA);
      setEq(mg3.sessionOverride.added, [], '摘掉加过的 c：added 归零');
      setEq(mg3.sessionOverride.removed, [], '摘掉 c 不进 removed');
      setEq(skillDirNames(f.projectA), ['ov-a', 'ov-b'], '盘上回到集基线');
      eq(selfCheck(f.roots, f.projectA).ok, true, '净归位后自检绿');
      await p.endOverride(store, f.roots, f.projectA);
      setEq(skillDirNames(f.projectA), ['ov-a', 'ov-b'], '结束覆盖收敛回绑定态');
    },
  },
  {
    id: 'translations-core', title: 'P3-T1 翻译缓存核心：折叠块 description 读取+稳定哈希、reconcile 对账/失效/GC、decorate 三字段',
    async run(f) {
      await withRoots(f);
      const tr = await core('translations');
      // (1) readDescription：折叠块多行 → 单行 + 稳定哈希；无 frontmatter/无目录 → null
      const dir1 = writeSkill(f.library, 'tr-fold');
      fs.writeFileSync(path.join(dir1, 'SKILL.md'), '---\nname: tr-fold\ndescription: >\n  Use when receiving code review feedback,\n  after completing a task.\n---\n\nbody\n');
      const r1 = tr.readDescription(dir1);
      eq(r1.text, 'Use when receiving code review feedback, after completing a task.', '折叠块展开为单行');
      eq(r1.hash, sha256(Buffer.from(r1.text.trim())), '哈希 = sha256(text.trim()) 带前缀');
      eq(tr.readDescription(dir1).hash, r1.hash, '哈希稳定');
      const dir2 = writeSkill(f.library, 'tr-nofm');
      fs.writeFileSync(path.join(dir2, 'SKILL.md'), 'no frontmatter here\n');
      eq(tr.readDescription(dir2), { text: null, hash: null }, '无 frontmatter → null');
      eq(tr.readDescription(path.join(f.library, 'ghost')), { text: null, hash: null }, '无目录 → null');
      // (2) reconcile：新名 pending、同哈希不动、改哈希重置、库消失 GC
      const r0 = tr.reconcile({}, [{ name: 'tr-fold', hash: r1.hash, en: r1.text }]);
      eq(r0.pending, ['tr-fold'], '新名字 → pending');
      eq(r0.cache['tr-fold'].en, r1.text, 'en 快照入缓存');
      eq(r0.cache['tr-fold'].status, 'pending', '新条目状态 pending');
      let cache = tr.setTranslated(r0.cache, 'tr-fold', { srcHash: r1.hash, en: r1.text, zh: '收到代码审查反馈时使用', status: 'ok' });
      eq(cache['tr-fold'].zh, '收到代码审查反馈时使用', 'setTranslated 写入 zh');
      eq(cache['tr-fold'].status, 'ok', 'setTranslated 写状态');
      let r = tr.reconcile(cache, [{ name: 'tr-fold', hash: r1.hash, en: r1.text }]);
      eq(r.pending, [], '同哈希 → 不重翻');
      eq(r.cache['tr-fold'].status, 'ok', 'ok 保持');
      const newHash = sha256(Buffer.from('changed text'));
      r = tr.reconcile(r.cache, [{ name: 'tr-fold', hash: newHash, en: 'changed text' }]);
      eq(r.pending, ['tr-fold'], '改哈希 → 重置 pending');
      eq(r.cache['tr-fold'].status, 'pending', '状态回 pending');
      r = tr.reconcile(r.cache, []);
      eq(Object.keys(r.cache), [], '库里消失 → 条目删除（GC 即在 reconcile）');
      r = tr.reconcile({}, [{ name: 'tr-empty', hash: null, en: null }]);
      eq(r.pending, [], '无描述文本 → 不入队');
      eq(Object.keys(r.cache), [], '无描述文本 → 不建条目');
      // (3) decorate：三字段口径
      const libRows = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
      const d = tr.decorate(libRows, {
        a: { srcHash: 'h', en: 'en a', zh: '中文甲', status: 'ok' },
        b: { srcHash: 'h', en: 'en b', zh: 'x', status: 'failed' },
      });
      eq(d[0].description, 'en a', 'description = en 快照');
      eq(d[0].descriptionZh, '中文甲', 'ok → zh');
      eq(d[0].descriptionStatus, 'ok', '状态 ok');
      eq(d[1].descriptionZh, null, 'failed → descriptionZh=null');
      eq(d[1].descriptionStatus, 'failed', '状态 failed 透出');
      eq(d[2].description, null, '无缓存 → description null');
      eq(d[2].descriptionStatus, 'none', '无缓存 → none');
      eq(libRows[0].description, undefined, 'decorate 不污染原行');
      eq(d.length, 3, 'decorate 行数不变');
      eq(tr.CACHE_KEY, 'translations', '缓存 key 常量');
    },
  },
  {
    id: 'search-core', title: 'P3-T2 匹配器：中文经 zh 命中、token AND、全半角折叠、名称前缀优先、空 query 原序',
    async run(f) {
      const { searchRows, normalize } = await core('search');
      const rows = [
        { name: 'receiving-code-review', source: 'github:obra/superpowers', description: 'Use when responding to code review feedback', descriptionZh: '收到代码审查反馈时使用' },
        { name: 'codebase-design', source: 'local', description: 'Design deep modules', descriptionZh: '设计深层模块' },
        { name: 'abc-tool', source: 'github:y', description: null, descriptionZh: null },
      ];
      const names = (q) => searchRows(rows, q).map((r) => r.name);
      eq(normalize('ＡＢＣ　ＤＥＦ'), 'abc def', '全角→半角 + 全角空格折叠');
      eq(names('审查'), ['receiving-code-review'], '中文 token 经 descriptionZh 命中');
      eq(names('review'), ['receiving-code-review'], '英文 token 命中 name/description 子串');
      eq(names('反馈 feedback'), ['receiving-code-review'], '两 token 同行 AND（跨 zh/en 字段）');
      eq(names('审查 module'), [], 'token 须同行命中（跨行不算）');
      eq(names('ＡＢＣ'), ['abc-tool'], '全角查询命中半角 name');
      eq(names('code'), ['codebase-design', 'receiving-code-review'], '名称前缀命中排前');
      eq(names(''), ['receiving-code-review', 'codebase-design', 'abc-tool'], '空 query 原序全量');
      eq(names('不存在xyz'), [], '无命中 → 空');
      eq(searchRows(null, 'x'), [], 'rows 非数组 → 空');
      eq(searchRows(rows, '  ').length, 3, '纯空白 = 空 query');
    },
  },
  {
    id: 'translate-exec-core', title: 'P3-T3 翻译执行器：LLM 优先、mt 兜底（缺席不调）、双败不炸批、并发≤2、上限 50 截断',
    async run(f) {
      const { runBatch, buildLlmPrompt } = await core('translateExec');
      const en = (n) => 'en text ' + n;
      let r = await runBatch({ items: [{ name: 'a', en: en('a') }], callLlm: async () => '中文甲', callMt: async () => '机翻甲' });
      eq(r.done, [{ name: 'a', zh: '中文甲', via: 'llm' }], 'LLM 成功 → via=llm');
      eq(r.failed, [], '无失败');
      r = await runBatch({ items: [{ name: 'b', en: en('b') }], callLlm: async () => { throw new Error('llm down'); }, callMt: async () => ' 机翻乙 ' });
      eq(r.done, [{ name: 'b', zh: '机翻乙', via: 'mt' }], 'LLM 抛 → mt 兜底且 trim');
      r = await runBatch({ items: [{ name: 'c', en: en('c') }], callLlm: async () => { throw new Error('e1'); }, callMt: async () => { throw new Error('e2'); } });
      eq(r.done, [], '双败无 done');
      eq(r.failed.length, 1, '双败 → 单条 failed 不炸批');
      ok(r.failed[0].error.includes('e2'), 'failed 带末错信息');
      r = await runBatch({ items: [{ name: 'd', en: en('d') }], callLlm: async () => { throw new Error('no-llm'); }, callMt: null });
      eq(r.failed.length, 1, '无兜底路由（translator 缺席实态）→ failed');
      ok(r.failed[0].error.includes('no-llm'), '无兜底时保留 llm 错因');
      r = await runBatch({ items: [{ name: 'e', en: en('e') }], callLlm: async () => '   ', callMt: async () => '机翻戊' });
      eq(r.done, [{ name: 'e', zh: '机翻戊', via: 'mt' }], 'LLM 空串 → 走兜底');
      let cur = 0, max = 0;
      const slow = async () => { cur++; max = Math.max(max, cur); await new Promise((res) => setTimeout(res, 20)); cur--; return '中'; };
      r = await runBatch({ items: Array.from({ length: 6 }, (_, i) => ({ name: 'n' + i, en: en(i) })), callLlm: slow, callMt: null });
      eq(r.done.length, 6, '6 条全成');
      ok(max <= 2, `并发峰值 ${max} 应 ≤2`);
      r = await runBatch({ items: Array.from({ length: 101 }, (_, i) => ({ name: 'm' + i, en: en(i) })), callLlm: async () => '中', callMt: null });
      eq(r.done.length, 50, '单次批量截 50');
      eq(r.skipped, 51, 'skipped=51');
      r = await runBatch({ items: [], callLlm: async () => '中', callMt: null });
      eq(r, { done: [], failed: [], skipped: 0 }, '空 items → 空结果');
      const p = buildLlmPrompt(['text one', 'text two']);
      ok(p.includes('text one') && p.includes('text two'), 'prompt 含全部文本');
      ok(/40/.test(p), 'prompt 含 ≤40 字生成口径');
    },
  },
  {
    id: 'resident-relocate', title: 'P3-T4 常驻区搬迁：globalResidentDirs 默认 = agents 区、开关 = 额外保留旧区、prune 按台账精确回收',
    async run(f) {
      await withRoots(f);
      const { buildRoots } = await core('paths');
      eq(JSON.stringify(f.roots.globalResidentDirs), JSON.stringify([f.userAgentsSkills]), '默认常驻区 = ~/.agents/skills');
      const r2 = buildRoots({ dshHome: f.dshHome, agentsHome: f.agentsHome, crossHarnessResident: true });
      eq(JSON.stringify(r2.globalResidentDirs), JSON.stringify([f.userAgentsSkills, f.userDsh]), '开关开 = 额外保留旧 dsh 区');
      const { makeEntry, entryKind } = await core('linkx');
      const { loadResident, saveResident } = await core('sets');
      const { pruneLegacyResidentLinks } = await core('resident');
      for (const n of ['pa', 'pb']) writeSkill(f.library, n);
      const made = makeEntry(path.join(f.library, 'pa'), path.join(f.userDsh, 'pa'));
      saveResident(f.roots, [], { links: { [f.userDsh]: { pa: { kind: made.kind } } } }); // 旧区自建链台账（搬迁前状态）
      mkdirp(path.join(f.userDsh, 'pb'));
      fs.writeFileSync(path.join(f.userDsh, 'pb', 'SKILL.md'), '# other\n');
      const pr = await pruneLegacyResidentLinks(f.roots);
      ok(!fs.existsSync(path.join(f.userDsh, 'pa')), '旧区自建链接被回收');
      ok(fs.existsSync(path.join(f.userDsh, 'pb')), '旧区他人条目不动');
      ok(fs.existsSync(path.join(f.library, 'pa', 'SKILL.md')), '库真身无损');
      setEq(pr.pruned.map((x) => x.name), ['pa'], 'pruned 记录');
      eq(loadResident(f.roots).links[f.userDsh], undefined, '旧区台账清空');
      const pr2 = await pruneLegacyResidentLinks(f.roots);
      eq(pr2.pruned.length, 0, '幂等：第二次无事可做');
      await withRoots(f, { crossHarnessResident: true }); // 开关开：旧区在 residentDirs 内 → 不算旧区
      const made2 = makeEntry(path.join(f.library, 'pa'), path.join(f.userDsh, 'pa'));
      saveResident(f.roots, [], { links: { [f.userDsh]: { pa: { kind: made2.kind } } } });
      const pr3 = await pruneLegacyResidentLinks(f.roots);
      eq(pr3.pruned.length, 0, '在区链接不被回收');
      ok(entryKind(path.join(f.userDsh, 'pa')) === 'junction', '开关开时链接保留');
      // M4（终审 2026-10-26）：卸载常驻技能 → 名单剔除 + syncResident 回收链接（防幽灵名灰行失真）
      await withRoots(f); // 回默认 roots（常驻区 = agents）
      const rs = await core('resident');
      writeSkill(f.library, 'ghost-x');
      saveResident(f.roots, ['ghost-x']);
      await rs.syncResident(f.roots);
      ok(fs.existsSync(path.join(f.userAgentsSkills, 'ghost-x')), '常驻链接建立');
      ok(rs.dropResidentName(f.roots, 'ghost-x'), 'drop 命中返回 true');
      eq(loadResident(f.roots).skills.includes('ghost-x'), false, '名单剔除该名');
      await rs.syncResident(f.roots);
      ok(!fs.existsSync(path.join(f.userAgentsSkills, 'ghost-x')), 'syncResident 回收自建链接');
      ok(fs.existsSync(path.join(f.library, 'ghost-x', 'SKILL.md')), '库真身无损');
      // 幽灵名自动收敛（用户报告 2026-10-26：speckit-* 实体被外部删除，名单幽灵致弹窗「缺失」+ 启动反复告警）
      writeSkill(f.library, 'ok-s');
      writeSkill(f.library, 'gone');
      const dead = makeEntry(path.join(f.library, 'gone'), path.join(f.userAgentsSkills, 'gone')); // 曾有自建链
      fs.rmSync(path.join(f.library, 'gone'), { recursive: true, force: true }); // 库本体消失 → 幽灵（有残链）
      saveResident(f.roots, ['ok-s', 'gone', 'nov'], { links: { [f.userAgentsSkills]: { gone: { kind: dead.kind } } } });
      const sy = await rs.syncResident(f.roots);
      setEq(sy.ghosts, ['gone', 'nov'], '库里无本体：带残链与无链都收敛');
      setEq(loadResident(f.roots).skills, ['ok-s'], '名单自动剔幽灵');
      ok(!fs.existsSync(path.join(f.userAgentsSkills, 'gone')), '幽灵残链一并回收');
      ok(fs.existsSync(path.join(f.userAgentsSkills, 'ok-s')), '正常常驻不受影响');
      ok(sy.warnings.some((w) => w.includes('nov') && w.includes('剔除')), '剔除有警告记录');
      const sy2 = await rs.syncResident(f.roots);
      eq(sy2.ghosts.length, 0, '幂等：二次无幽灵可剔');
      eq(rs.dropResidentName(f.roots, 'ghost-x'), false, '名单外名字 drop 返回 false（幂等）');
      // N1（终审 2026-10-26）：prune removeEntry 失败 → 失败项保留台账下次重试，不清整目录
      saveResident(f.roots, [], { links: { [f.userDsh]: { pb2: { kind: 'junction' }, pb3: { kind: 'junction' } } } });
      const fakeFs = { rmdirSync: (p) => { if (String(p).includes('pb3')) throw new Error('EBUSY'); } }; // pb2 成功、pb3 失败
      const pr4 = await pruneLegacyResidentLinks(f.roots, { fs: fakeFs });
      setEq(pr4.pruned.map((x) => x.name), ['pb2'], '成功项进 pruned');
      eq(pr4.warnings.length, 1, '失败项进 warnings');
      const lk = loadResident(f.roots).links[f.userDsh];
      ok(lk?.pb3 && !lk?.pb2, '台账只保留失败项（成功后清、失败重试）');
    },
  },
  {
    id: 'migrate-agents', title: 'P3-T5 agents 存量迁移：只列无 manifest 纯目录、入库认领 unknown、undo 删认领复原、ledger 独立',
    async run(f) {
      await withRoots(f);
      const m = await core('migrate');
      const { readManifest } = await core('manifest');
      const { entryKind, makeEntry } = await core('linkx');
      writeSkill(f.userAgentsSkills, 'ag-one'); writeSkill(f.userAgentsSkills, 'ag-two');
      const foreign = writeSkill(f.userAgentsSkills, 'ag-foreign');
      fs.writeFileSync(path.join(foreign, '.manifest.json'), JSON.stringify({ source: 'github:some/one' }));
      const ext = writeSkill(path.join(f.base, 'ext-src'), 'ag-ext'); // 外部真身 + 外来 junction（链接不搬真身）
      makeEntry(ext, path.join(f.userAgentsSkills, 'ag-ext'));
      const libRes = writeSkill(f.library, 'ag-res'); // 迁移完成态：库有本体 + agents 区是链回库的常驻 junction
      makeEntry(libRes, path.join(f.userAgentsSkills, 'ag-res'));
      const pv = m.previewAgents(f.roots);
      setEq(pv.moves.map((x) => x.name), ['ag-one', 'ag-two'], '只列无 manifest 纯目录');
      ok(pv.keep.some((k) => k.name === 'ag-foreign' && k.reason === 'manifest'), '带 manifest 他人条目 → keep');
      ok(pv.keep.some((k) => k.name === 'ag-ext' && k.reason === 'link'), 'junction 链接 → keep 不搬');
      ok(pv.keep.some((k) => k.name === 'ag-res' && k.reason === 'resident'), '链回库的常驻 junction → resident（不再误报「库同名」）');
      ok(!pv.moves.some((x) => x.name === 'ag-res'), '常驻链接不入 moves');
      ok(pv.warnings.some((w) => w.includes('只剩常驻')), '披露「其他 harness 只剩常驻」');
      const L = { data: null };
      const ledger = { load: async () => L.data, save: async (d) => { L.data = JSON.parse(JSON.stringify(d)); } };
      const ap = await m.applyAgents(f.roots, { ledger });
      ok(ap.moved.includes('ag-one') && ap.moved.includes('ag-two'), 'apply 返回 moved');
      ok(fs.existsSync(path.join(f.library, 'ag-one', 'SKILL.md')), '入库');
      eq(readManifest(path.join(f.library, 'ag-one'))?.source, 'unknown', '入库认领 source unknown');
      ok(fs.existsSync(path.join(f.userAgentsSkills, 'ag-foreign')), 'agents 区他人条目不动');
      eq(entryKind(path.join(f.userAgentsSkills, 'ag-ext')), 'junction', '外来链接不动');
      ok(L.data.moved.every((x) => x.claimed), 'ledger 标 claimed（undo 据此删认领）');
      const un = await m.undoAgents(f.roots, { ledger });
      setEq(un.restored, ['ag-one', 'ag-two'], '逆序复原');
      ok(fs.existsSync(path.join(f.userAgentsSkills, 'ag-one', 'SKILL.md')), '回移 agents 区');
      eq(readManifest(path.join(f.userAgentsSkills, 'ag-one')), null, '复原后删认领 manifest（不留 foreign 假象）');
      ok(!fs.existsSync(path.join(f.library, 'ag-one')), '库侧移除');
      eq(JSON.stringify(L.data.moved), JSON.stringify([]), 'ledger 清空');
      // M3 回归（终审 2026-10-26）：预览为空 + ledger 从未写过 → apply() 不 save → load()=null → 曾 null.moved TypeError
      const L3 = { data: null };
      const ledger3 = { load: async () => L3.data, save: async (d) => { L3.data = JSON.parse(JSON.stringify(d)); } };
      const ap3 = await m.applyAgents(f.roots, { ledger: ledger3 });
      eq(ap3.moved.length, 2, '再 apply 把 undo 回的两条目重新搬走');
      L3.data = null; // 模拟插件重装（fresh ledger）+ agents 区只剩 keep 条目 = 空预览
      const ap4 = await m.applyAgents(f.roots, { ledger: ledger3 });
      eq(ap4.moved.length, 0, '空预览 + 空 ledger apply 不崩（M3：曾 null.moved TypeError）');
      // 迁移完成态预览（用户报告 2026-10-26）：0 移动不再弹「只剩常驻」告警，三类保留各归其位 + 中性说明
      const pv2 = m.previewAgents(f.roots);
      eq(pv2.moves.length, 0, '已迁完 = 空预览');
      eq(pv2.keep.map((k) => `${k.name}:${k.reason}`).sort(), ['ag-ext:link', 'ag-foreign:manifest', 'ag-res:resident'], '保留分类：外部链接/他人记账/已是常驻');
      ok(pv2.warnings.every((w) => !w.includes('只剩常驻')), '空预览不再弹「只剩常驻」告警');
      ok((pv2.notes ?? []).some((n) => n.includes('已是迁移后状态')), '空预览给中性说明');
      // 旧向导 undo 不受 claimed 逻辑影响：legacy ledger 无 claimed 字段
      const L2 = { data: { moved: [{ name: 'legacy-x', from: path.join(f.userDsh, 'legacy-x'), to: path.join(f.library, 'legacy-x') }] } };
      writeSkill(f.library, 'legacy-x');
      const ledger2 = { load: async () => L2.data, save: async (d) => { L2.data = JSON.parse(JSON.stringify(d)); } };
      const un2 = await m.undo(f.roots, { ledger: ledger2 });
      setEq(un2.restored, ['legacy-x'], 'legacy undo 照常复原');
    },
  },
  {
    id: 'p3-data-plane', title: 'P3-T6 数据面：reconcileLibrary 落盘/GC、translateRunCore ok/failed 回写、residentForeign、autoTranslate 钩子默认零出网',
    async run(f) {
      await withRoots(f);
      const dp = await core('dataPlane');
      const tr = await core('translations');
      const te = await core('translateExec');
      eq(te.parseSingleReply('1. 收到代码审查反馈时使用\n2. 另一条'), '收到代码审查反馈时使用', '拆回编号行首条');
      eq(te.parseSingleReply('「2」设计深层模块'), '设计深层模块', '剥编号与引号');
      const store = (() => { const m = new Map(); const c = (v) => v === undefined ? v : JSON.parse(JSON.stringify(v)); return { get: async (t, k) => c(m.get(t + '|' + k)), put: async (t, k, v) => m.set(t + '|' + k, c(v)) }; })(); // get/put 均深拷贝 = 盘上 JSON store 语义（共享引用会掩盖丢更新竞态）
      writeSkill(f.library, 'dp-a', 'en text alpha'); writeSkill(f.library, 'dp-b', 'en text beta');
      // (1) 对账：全 pending + 落盘 + decorate 口径
      let r = await dp.reconcileLibrary(f.roots, store);
      setEq(r.pending, ['dp-a', 'dp-b'], '新条目全 pending');
      const cache = await dp.loadCache(store);
      eq(cache['dp-a'].status, 'pending', '缓存经 store 落盘');
      eq(tr.decorate([{ name: 'dp-a' }], cache)[0].descriptionStatus, 'pending', '未翻译 → pending 状态（UI 显英文）');
      // (2) translateRunCore：fake 执行器，一成一败逐条粒度
      const out = await dp.translateRunCore({ roots: f.roots, store, names: ['dp-a', 'dp-b'],
        callLlm: async (en) => { if (en.includes('beta')) throw new Error('boom'); return '1. 中文甲'; }, callMt: null });
      eq(out.done.length, 1, '一条成功'); eq(out.failed.length, 1, '一条失败不炸批');
      const c2 = await dp.loadCache(store);
      eq(c2['dp-a'].status, 'ok', 'ok 回写'); eq(c2['dp-a'].zh, '中文甲', 'zh 剥编号后回写');
      eq(c2['dp-b'].status, 'failed', 'failed 回写');
      eq(c2['dp-b'].srcHash, sha256(Buffer.from('en text beta')), 'failed 也带 srcHash（同哈希不自愈）');
      // (2b) M1 竞态（终审 2026-10-26）：批中外部 reconcile save → 批尾回写不得整表覆盖外部成果
      writeSkill(f.library, 'dp-race', 'en race');
      await dp.reconcileLibrary(f.roots, store);
      let injected = false;
      const out2 = await dp.translateRunCore({ roots: f.roots, store, names: ['dp-race'],
        callLlm: async () => {
          if (!injected) {
            injected = true; // 模拟批中（分钟级）弹窗打开触发 reconcileLibrary 落盘
            const mid = await dp.loadCache(store);
            mid['dp-mid'] = { srcHash: 'sha256:mid', en: 'en mid', zh: null, status: 'pending', updatedAt: '2026-01-01T00:00:00.000Z' };
            await dp.saveCache(store, mid);
          }
          return '1. 竞速中文';
        }, callMt: null });
      eq(out2.done.length, 1, '竞态批成功一条');
      const c3 = await dp.loadCache(store);
      eq(c3['dp-race']?.status, 'ok', '本批结果回写');
      eq(c3['dp-mid']?.status, 'pending', '批中外部新增条目不被批尾覆盖（M1 merge）');
      // (3) 对账幂等 + 库删 GC
      r = await dp.reconcileLibrary(f.roots, store);
      eq(r.pending, [], '同哈希不重翻（failed 不自愈，等手动批量）');
      fs.rmSync(path.join(f.library, 'dp-b'), { recursive: true, force: true });
      fs.rmSync(path.join(f.library, 'dp-race'), { recursive: true, force: true });
      await dp.reconcileLibrary(f.roots, store);
      setEq(Object.keys(await dp.loadCache(store)), ['dp-a'], '库消失 → 缓存 GC（含批中注入的 dp-mid 幽灵）');
      // (4) residentForeign：名单外含 SKILL.md 的 agents 条目
      writeSkill(f.userAgentsSkills, 'foreign-z'); writeSkill(f.userAgentsSkills, 'mine-y');
      const { saveResident } = await core('sets');
      saveResident(f.roots, ['mine-y']);
      setEq(dp.residentForeign(f.roots), ['foreign-z'], '外来 = 名单外且含 SKILL.md');
      eq(f.roots.globalResidentDirs[0], f.userAgentsSkills, 'residentTarget = 第一常驻区（agents）');
      // (5) autoTranslate 钩子：默认 false 零触发（不注入即零出网）
      let calls = 0;
      await dp.libraryView(f.roots, store, { autoTranslate: false, onPending: (p) => { calls += p.length; } });
      eq(calls, 0, 'autoTranslate=false → 钩子完全不触发');
      writeSkill(f.library, 'dp-new', 'en text new');
      await dp.libraryView(f.roots, store, { autoTranslate: true, onPending: (p) => { calls += p.length; } });
      eq(calls, 1, 'autoTranslate=true → 触发一次带 pending 名单');
    },
  },
  {
    id: 'p3-storage-wiring', title: 'P3 活体复盘：fallback store 接受全部在用表名（migrate_agents 非连字符）、带点 projectKey 可读写、. 与 .. 拒绝',
    run: async (f) => {
      const { makeFallbackStore, projectKey } = await core('storage');
      const store = makeFallbackStore(path.join(f.base, 'wstore'));
      // 活体实锤（2026-10-26 复盘）：本机 store = fallback；连字符表名曾炸 migrateAgents*，
      // 带点 projectKey（无会话 state 路径）曾被 KEY_RE 拒 → 两教训各钉一条。
      for (const t of ['pending', 'undo', 'oplog', 'bindings', 'migration', 'migrate_agents', 'translations']) {
        await store.put(t, 'probe', { v: 1 });
        eq((await store.get(t, 'probe'))?.v, 1, `表 ${t} 可读写`);
      }
      let hyphen = false;
      try { await store.put('migrate-agents', 'ledger', {}); } catch { hyphen = true; }
      ok(hyphen, '连字符表名仍被拒（须用 migrate_agents）');
      const dotKey = projectKey('C:\\Users\\x\\.dsh\\profiles\\desktop');
      ok(dotKey.includes('.'), `projectKey 含点（${dotKey}）`);
      await store.put('bindings', dotKey, { projectRoot: 'x' });
      eq((await store.get('bindings', dotKey))?.projectRoot, 'x', '带点 key 可读写（无会话 state 路径）');
      for (const evil of ['.', '..']) {
        let bad = false;
        try { await store.put('bindings', evil, {}); } catch { bad = true; }
        ok(bad, `key "${evil}" 被拒（防目录穿越）`);
      }
    },
  },
  {
    id: 'p3-rc3-shape', title: 'P3 rc.3 形状容错：refId 收字符串/{id}/{name}、normalizeSel 缺侧即 null（防 provider 对象进 stream 炸 NO_ADAPTER 崩 host）',
    run: async () => {
      const { refId, normalizeSel } = await core('translateExec');
      eq(refId(' strata '), 'strata', '字符串去空白');
      eq(refId({ id: 'strata', name: 'Strata' }), 'strata', '对象取 id 优先');
      eq(refId({ name: 'Strata' }), 'Strata', '无 id 回落 name');
      for (const bad of [null, undefined, 42, '', '   ', {}, { id: 7 }]) eq(refId(bad), null, `拒 ${JSON.stringify(bad) ?? String(bad)}`);
      eq(normalizeSel({ provider: 'a', model: 'b' }), { provider: 'a', model: 'b' }, '字符串对直收');
      eq(normalizeSel({ provider: { id: 'a' }, model: { id: 'b', name: 'B' } }), { provider: 'a', model: 'b' }, '对象对归一（rc.3 疑似形状）');
      eq(normalizeSel({ providerId: 'a', modelId: 'b' }), { provider: 'a', model: 'b' }, 'providerId/modelId 别名兼容');
      eq(normalizeSel({ provider: 'a' }), null, '缺 model 即 null');
      eq(normalizeSel({ provider: {}, model: 'b' }), null, 'provider 空对象即 null（不再 [object Object] 进 stream）');
      eq(normalizeSel(null), null, 'null 安全');
    },
  },
  {
    id: 'p3-translate-chunk', title: 'P3 翻译拼接批：parseBatchReply 按编号拆回（缺行即 null）；runBatch chunk 模式错行整组逐条回退（提速：5 条 1 prompt）',
    run: async () => {
      const { parseBatchReply, runBatch } = await core('translateExec');
      eq(parseBatchReply('1. a\n2. b\n3. c', 3), ['a', 'b', 'c'], '编号行按序拆回');
      eq(parseBatchReply('2. b\n好的，以下是翻译：\n1. a\n3. c', 3), ['a', 'b', 'c'], '乱序 + 说明行忽略');
      eq(parseBatchReply('1. "a"\n2. “b”', 2), ['a', 'b'], '包裹引号剥除');
      eq(parseBatchReply('1. a\n3. c', 3), null, '缺行 → null（触发回退）');
      eq(parseBatchReply('1. a\n1. b', 2), null, '重复编号首个生效、缺行仍 null');
      eq(parseBatchReply('', 2), null, '空答复 → null');
      eq(parseBatchReply('没有编号的一行', 1), null, '无编号 → null');
      eq(parseBatchReply('1. a', 1), ['a'], 'n=1 也走编号协议');
      // runBatch chunk：拼接调用 + 错行回退
      const items = [{ name: 'x1', en: 'E1' }, { name: 'x2', en: 'E2' }, { name: 'x3', en: 'E3' }];
      const seen = [];
      const r1 = await runBatch({ items, chunk: 3, callLlm: async (arg) => { seen.push(Array.isArray(arg) ? 'batch' : 'single'); return '1. A\n2. B\n3. C'; } });
      eq(r1.done.length, 3, '拼接批 3 条全成');
      eq(seen, ['batch'], 'chunk=3 → 仅 1 次数组调用');
      eq(r1.done.map((d) => d.zh), ['A', 'B', 'C'], '按编号拆回对位');
      eq(r1.done[0].via, 'llm', 'via=llm');
      const seen2 = [];
      const r2 = await runBatch({ items, chunk: 3, callLlm: async (arg) => { seen2.push(Array.isArray(arg) ? 'batch' : `single:${arg}`); return Array.isArray(arg) ? '完全不像编号的答复' : `T:${arg}`; } });
      eq(r2.done.length, 3, '错行 → 整组逐条回退后仍 3 成');
      eq(seen2, ['batch', 'single:E1', 'single:E2', 'single:E3'], '回退为逐条字符串调用（含首批失败重试）');
      const seen3 = [];
      const r3 = await runBatch({ items, chunk: 2, callLlm: async (arg) => { seen3.push(Array.isArray(arg) ? 'batch' : 'single'); return Array.isArray(arg) && arg.length === 2 ? '1. A\n2. B' : null; } });
      eq(r3.done.length, 2, 'chunk=2 分组：首组成、次组 null 答复全缺');
      eq(r3.failed.length, 1, '次组第 3 条（单独成组拿 null）failed');
      eq(seen3, ['batch', 'single'], '末组仅 1 条：不拼接直接逐条（组内 ≥2 才拼 prompt）');
      const r4 = await runBatch({ items, callLlm: async (arg) => `T:${arg}` }); // chunk 缺省 = 1（回归）
      eq(r4.done.length, 3, 'chunk 缺省逐条行为不变');
      eq(r4.done[0].zh, 'T:E1', '单条直收');
      const r5 = await runBatch({ items, chunk: 3, callLlm: async () => { throw new Error('boom'); } });
      eq(r5.failed.length, 3, '拼接批抛错 → 逐条回退也抛错 → 全 failed');
      ok(r5.failed.every((f) => String(f.error).includes('boom')), '回退错误入 failed 记录');
    },
  },
  {
    id: 'save-as-resident', title: 'P3 另存为 excludeResident：常驻（全局）名不写进集合（用户 2026-10-26：另存把全局技能连进项目 .dsh/skills）',
    async run(f) {
      await withRoots(f);
      const { saveAsSet, saveResident, effectiveNames } = await core('sets');
      for (const n of ['g1', 'p1', 'p2']) writeSkill(f.library, n);
      saveResident(f.roots, ['g1']);
      const eff = effectiveNames(f.roots, null);
      setEq(eff.names, ['g1'], '未绑定生效清单 = 常驻（现状语义，供 RPC 兜底源）');
      const s1 = saveAsSet(f.roots, { name: '项目组', names: eff.names, excludeResident: true });
      setEq(s1.skills, [], 'excludeResident：常驻名剔除 → 成员不含全局');
      const s2 = saveAsSet(f.roots, { name: '自选组', names: ['p1', 'p2', 'g1'] });
      setEq(s2.skills, ['p1', 'p2', 'g1'], '缺省不剔除（显式名单原样）');
      const s3 = saveAsSet(f.roots, { name: '显剔', names: ['p1', 'g1'], excludeResident: true });
      setEq(s3.skills, ['p1'], '显式名单同样可剔常驻');
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
    id: 'conflict-foreign', title: '目标同名外来条目：跳过并警告，绝不删除（M3/§7.3）',
    async run(f) {
      await withRoots(f);
      writeSkill(f.library, 'alpha');
      const s = await core('sets'); await s.saveSet(f.roots, { slug: 'doc', name: 'D', skills: ['alpha'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan, selfCheck } = await core('effective');
      const { readManaged } = await core('managed');
      const foreign = path.join(f.projectA, '.dsh', 'skills', 'alpha');
      mkdirp(foreign);
      fs.writeFileSync(path.join(foreign, 'SKILL.md'), '# user content\n');
      await writeBinding(f.projectA, 'doc');
      const plan = await planEffective(f.roots, f.projectA, 'doc');
      ok((plan.warnForeign ?? []).some((w) => w.name === 'alpha'), '冲突应列入 warnForeign');
      ok(!(plan.add ?? []).some((a) => a.name === 'alpha'), '冲突不进 add（不抢占）');
      const applied = await applyPlan(f.projectA, plan);
      eq(fs.readFileSync(path.join(foreign, 'SKILL.md'), 'utf8'), '# user content\n', '外来内容不被覆盖');
      ok(applied.warnings.some((w) => w.includes('alpha')), 'apply 报冲突警告');
      ok(!('alpha' in ((await readManaged(f.projectA))?.entries ?? {})), '冲突条目不记托管');
      const sc = await selfCheck(f.roots, f.projectA);
      ok(sc.foreign.includes('alpha'), 'selfCheck 报外来条目');
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
    id: 'stale-remove', title: '条目被外部手删后：切换/退常驻不抛错、台账照常收敛（复审 minor#1）',
    async run(f) {
      await withRoots(f);
      for (const n of ['m1', 'm2']) writeSkill(f.library, n);
      const s = await core('sets');
      await s.saveSet(f.roots, { slug: 'sa', name: 'A', skills: ['m1'] });
      await s.saveSet(f.roots, { slug: 'sb', name: 'B', skills: ['m2'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan } = await core('effective');
      await writeBinding(f.projectA, 'sa');
      await applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 'sa'));
      fs.rmdirSync(path.join(f.projectA, '.dsh', 'skills', 'm1')); // 外部手删 managed 条目
      await applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 'sb')); // 切换不抛错
      has(skillDirNames(f.projectA), 'm2', '切换后新条目就位');
      const { readManaged } = await core('managed');
      ok(!('m1' in (await readManaged(f.projectA)).entries), '被手删条目随切换出台账');
      const { syncResident } = await core('resident');
      const { entryKind } = await core('linkx');
      await s.saveResident(f.roots, ['m1']);
      await syncResident(f.roots);
      eq(entryKind(path.join(f.userAgentsSkills, 'm1')), 'junction', '常驻链接就位（agents 区）');
      fs.rmdirSync(path.join(f.userAgentsSkills, 'm1')); // 外部手删常驻链接
      await s.saveResident(f.roots, []);
      const r = await syncResident(f.roots); // 退常驻不抛错
      eq(r.warnings.filter((w) => w.includes('m1')).length, 0, '外部手删后退常驻无异常警告');
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
      // 回归（e2e 发现）：无关注释提到插件名不得阻止条目行写入
      fs.writeFileSync(g, '# skill-set-manager dev workspace\nnode_modules/\n');
      const r2 = await ensureGitignoreLine(f.projectA, { enabled: true });
      ok(r2.changed, '无关注释不阻止署名条目行');
      ok(fs.readFileSync(g, 'utf8').split('\n').some((l) => l.trim() === '.dsh/skills/'), '条目行存在即生效');
      const before = fs.readFileSync(g, 'utf8');
      await ensureGitignoreLine(f.projectA, { enabled: false });
      eq(fs.readFileSync(g, 'utf8'), before, '开关关闭不写不删');
      await ensureGitignoreLine(f.projectA, { enabled: false });
      eq(fs.readFileSync(g, 'utf8'), before, '开关关闭二次调用仍不动');
    },
  },
  {
    id: 'cmd-line', title: '/skill-set 子命令解析：空参=show、--yes 任意位置剥离、未知 token 原样带回（P2-T0）',
    async run(f) {
      const { parseSkillSetLine } = await core('commandLine');
      eq(parseSkillSetLine(''), { action: 'show', arg: null, yes: false }, '空参 → show');
      eq(parseSkillSetLine(null), { action: 'show', arg: null, yes: false }, 'null → show');
      eq(parseSkillSetLine('   '), { action: 'show', arg: null, yes: false }, '纯空白 → show');
      eq(parseSkillSetLine('list'), { action: 'list', arg: null, yes: false }, 'list');
      eq(parseSkillSetLine('use doc-processing'), { action: 'use', arg: 'doc-processing', yes: false }, 'use <slug>');
      eq(parseSkillSetLine('use 文档处理'), { action: 'use', arg: '文档处理', yes: false }, '显示名可作参数（多字节不拆）');
      eq(parseSkillSetLine('use x --yes'), { action: 'use', arg: 'x', yes: true }, '--yes 在尾');
      eq(parseSkillSetLine('--yes use x'), { action: 'use', arg: 'x', yes: true }, '--yes 在首');
      eq(parseSkillSetLine('use 我的 前端 集'), { action: 'use', arg: '我的 前端 集', yes: false }, '显示名含空格：整段作 arg（评审 M1）');
      eq(parseSkillSetLine('use 我的 前端 集 --yes'), { action: 'use', arg: '我的 前端 集', yes: true }, '含空格显示名 + --yes 仍可剥');
      eq(parseSkillSetLine('bogus'), { action: 'bogus', arg: null, yes: false }, '未知子命令原样带回（处理器出帮助）');
    },
  },
  {
    id: 'tool-args', title: 'skill_set 工具入参解析：action 白名单、use 必须带 slug、slug 去空白（P2-T1）',
    async run(f) {
      const { parseToolArgs } = await core('commandLine');
      eq(parseToolArgs({ action: 'list' }), { action: 'list', slug: null }, 'list 无需 slug');
      eq(parseToolArgs({ action: 'use', slug: 'doc-processing' }), { action: 'use', slug: 'doc-processing' }, 'use + slug');
      eq(parseToolArgs({ action: 'use', slug: '  文档处理  ' }), { action: 'use', slug: '文档处理' }, 'slug 去空白');
      eq(parseToolArgs({ action: 'show', slug: 'ignored' }), { action: 'show', slug: 'ignored' }, 'show 带 slug 不报错');
      const bad = (args, msg) => { try { parseToolArgs(args); throw new Error('应当抛错却没抛'); } catch (e) { ok(/action|slug/.test(e.message), `${msg}（实际：${e.message}）`); } };
      bad({}, '缺 action');
      bad({ action: 'bogus' }, '未知 action');
      bad({ action: 'use' }, 'use 缺 slug');
      bad({ action: 'use', slug: '   ' }, 'use slug 全空白');
    },
  },
  {
    id: 'override-event', title: '会话结束/归档即还原临时覆盖：有 pending 标记即复原、无标记不动盘（P2-T2）',
    async run(f) {
      await withRoots(f);
      writeSkill(f.library, 'ev-a'); writeSkill(f.library, 'ev-b');
      const s = await core('sets');
      await s.saveSet(f.roots, { slug: 'ev-set', name: '事件还原集', skills: ['ev-a'] });
      const { writeBinding } = await core('binding');
      const { planEffective, applyPlan } = await core('effective');
      const { readManaged } = await core('managed');
      const { projectKey } = await core('storage');
      await writeBinding(f.projectA, 'ev-set');
      await applyPlan(f.projectA, await planEffective(f.roots, f.projectA, 'ev-set'));
      const store = (await core('storage')).makeFallbackStore(path.join(f.base, 'store'));
      const p = await core('pending');
      await p.startOverride(store, f.roots, f.projectA, { add: ['ev-b'] });
      has(skillDirNames(f.projectA), 'ev-b', '覆盖期：临时加的技能在盘');
      const r = await p.endOverrideIfActive(store, f.roots, f.projectA);
      eq(r.ended, true, '会话结束：有覆盖即还原');
      lacks(skillDirNames(f.projectA), 'ev-b', '还原：覆盖条目已摘');
      has(skillDirNames(f.projectA), 'ev-a', '还原：回到绑定态清单');
      eq(await store.get('pending', projectKey(f.projectA)), null, 'pending 标记已清');
      const mg = await readManaged(f.projectA);
      ok(!mg.sessionOverride || (!(mg.sessionOverride.added?.length) && !(mg.sessionOverride.removed?.length)), 'sessionOverride 标记已清');
      // 无覆盖：ended:false 且托管清单一字不动（事件对未覆盖项目必须零副作用）
      const file = path.join(f.projectA, '.dsh', 'skills', '.managed.json');
      const before = fs.readFileSync(file, 'utf8');
      const r2 = await p.endOverrideIfActive(store, f.roots, f.projectA);
      eq(r2.ended, false, '无覆盖 → ended:false');
      eq(fs.readFileSync(file, 'utf8'), before, '无覆盖不动盘');
      // 评审 I1：同一仓库两个会话——别的会话结束不得误伤会话 A 的覆盖（§6.6「只对本次会话生效」）
      await p.startOverride(store, f.roots, f.projectA, { add: ['ev-b'], sessionId: 'sess-A' });
      has(skillDirNames(f.projectA), 'ev-b', '会话 A 开覆盖：条目在盘');
      eq((await store.get('pending', projectKey(f.projectA)))?.sessionId, 'sess-A', 'pending 记录写入归属会话');
      const rOther = await p.endOverrideIfActive(store, f.roots, f.projectA, 'sess-B');
      eq([rOther.ended, rOther.skipped], [false, 'other-session'], '会话 B 结束/归档 → 跳过');
      has(skillDirNames(f.projectA), 'ev-b', 'B 结束不动 A 的覆盖');
      eq((await p.endOverrideIfActive(store, f.roots, f.projectA, 'sess-A')).ended, true, '归属会话自己结束 → 还原');
      lacks(skillDirNames(f.projectA), 'ev-b', 'A 结束：覆盖条目已摘');
      // 旧记录（无 sessionId）与拿不到结束会话 id：按 P1 口径照还原（向后兼容）
      await p.startOverride(store, f.roots, f.projectA, { add: ['ev-b'], sessionId: 'sess-A' });
      await store.put('pending', projectKey(f.projectA), { ...(await store.get('pending', projectKey(f.projectA))), sessionId: null });
      eq((await p.endOverrideIfActive(store, f.roots, f.projectA, 'sess-Z')).ended, true, '记录无归属 → 照旧还原');
      lacks(skillDirNames(f.projectA), 'ev-b', '兼容路径也还原');
      // 评审 M9：冻结绑定（集已删）→ 只摘本次覆盖加的条目，其余清单原样保留（§5.8）
      await s.deleteSet(f.roots, 'ev-set');
      await p.startOverride(store, f.roots, f.projectA, { add: ['ev-b'], sessionId: 'sess-A' });
      has(skillDirNames(f.projectA), 'ev-b', '冻结期仍可开覆盖');
      await p.endOverrideIfActive(store, f.roots, f.projectA, 'sess-A');
      has(skillDirNames(f.projectA), 'ev-a', '冻结：原有托管条目不被空清单摘光');
      lacks(skillDirNames(f.projectA), 'ev-b', '冻结：本次覆盖加的条目照摘');
      eq(await store.get('pending', projectKey(f.projectA)), null, '冻结：pending 标记照清');
      ok(!(await readManaged(f.projectA)).sessionOverride, '冻结：sessionOverride 照清');
    },
  },
  {
    id: 'import-pin', title: '导入导出 pin：预览只读、三选一（按 pin 安装/占位/忽略）、显示名冲突不覆盖、非法 payload 不半写（§5.6，P2-T3）',
    async run(f) {
      await withRoots(f);
      const s = await core('sets');
      // 源库：一个带 github manifest（可 pin），一个无 manifest（无 pin）
      writeSkill(f.library, 'pinned');
      fs.writeFileSync(path.join(f.library, 'pinned', '.manifest.json'), JSON.stringify({ name: 'pinned', source: 'github:foo/bar/skills', commit: 'abc1234', managed: true, files: {}, dirDigest: 'sha256:x' }));
      writeSkill(f.library, 'bare');
      await s.saveSet(f.roots, { slug: 'pkg', name: '文档流', description: '导出描述', skills: ['pinned', 'bare'] });
      const ex = s.exportSet(f.roots, 'pkg');
      eq(ex.sets[0].description, '导出描述', '导出带描述（可完整读回）');
      eq(ex.sets[0].pins, { pinned: { source: 'github:foo/bar/skills', commit: 'abc1234' } }, '只有有来源的技能带 pin');

      // 换一套空库 roots（同 base 下新建，避免嵌套夹具泄漏）
      const home2 = path.join(f.base, 'home2');
      const agents2 = path.join(f.base, 'agents2');
      for (const d of [home2, path.join(home2, 'skill-sets'), path.join(home2, 'skill-library'), agents2, path.join(agents2, 'skills')]) mkdirp(d);
      const roots2 = (await core('paths')).buildRoots({ dshHome: home2, agentsHome: agents2 });

      const pv = s.importPreview(roots2, ex);
      eq(pv.items.length, 1, '预览一个集');
      eq(pv.items[0].name, '文档流', '显示名照搬');
      eq(pv.items[0].conflict, false, '空库无显示名冲突');
      setEq(pv.items[0].missing.map((m) => m.name), ['bare', 'pinned'], '两个技能在本机都缺');
      eq(pv.items[0].missing.find((m) => m.name === 'pinned').pin, { source: 'github:foo/bar/skills', commit: 'abc1234' }, '缺失项带 pin');
      eq(pv.items[0].missing.find((m) => m.name === 'bare').pin, null, '无来源技能无 pin');
      eq(fs.readdirSync(path.join(home2, 'skill-sets')).length, 0, '预览只读：不写盘');

      // 三选一：pinned→install（注入桩，插件自己不自动联网）、bare→placeholder
      const got = [];
      const res = await s.importApply(roots2, ex, {
        choices: { pinned: 'install', bare: 'placeholder' },
        install: async (name, pin) => { got.push({ name, pin }); writeSkill(roots2.libraryRoot, name); return { ok: true }; },
      });
      eq(got, [{ name: 'pinned', pin: { source: 'github:foo/bar/skills', commit: 'abc1234' } }], 'install 收到 pin 并交注入实现执行');
      setEq(res.installed, ['pinned'], 'installed 计数');
      setEq(res.placeholders, ['bare'], 'placeholders 计数');
      const ph = path.join(roots2.libraryRoot, 'bare');
      ok(fs.existsSync(path.join(ph, 'SKILL.md')), '占位技能体就位');
      eq(JSON.parse(fs.readFileSync(path.join(ph, '.manifest.json'), 'utf8')).source, 'placeholder', '占位 manifest source=placeholder');
      eq((await core('resolver')).parseFrontmatter(fs.readFileSync(path.join(ph, 'SKILL.md'), 'utf8')).name, 'bare', '占位 SKILL.md frontmatter name 合法');
      eq(res.created, [{ slug: 'pkg', name: '文档流' }], '集已创建');
      eq(s.loadSet(roots2, 'pkg').skills, ['pinned', 'bare'], '导入后的集保留完整技能名单');
      eq(res.ignored, [], '本次无忽略项');

      // 缺省 = ignore：不写库、不联网，集仍引用该名（悬空由诊断兜）
      const res2 = await s.importApply(roots2, { sets: [{ slug: 'other', name: '忽略集', skills: ['nope'] }] }, {});
      setEq(res2.ignored, ['nope'], '缺省不自动联网安装 → ignore');
      eq(fs.existsSync(path.join(roots2.libraryRoot, 'nope')), false, 'ignore 不写库');

      // 显示名冲突：不覆盖、不创建（上面已导入过「文档流」）
      const res3 = await s.importApply(roots2, { sets: [{ slug: 'pkg2', name: '文档流', skills: [] }] }, {});
      setEq(res3.nameConflicts.map((c) => c.name), ['文档流'], '显示名冲突报出');
      eq(res3.created.length, 0, '冲突项不覆盖不新建');

      // 非法 payload：报 errors 且不半写
      const bad = await s.importApply(roots2, { sets: [{ name: '坏集', skills: ['Bad_Name'] }] }, {});
      ok(bad.errors.length > 0, '非法技能名报 error');
      eq(bad.created.length, 0, '非法 payload 不半写');
      eq(s.importPreview(roots2, { sets: [{ name: '坏集', skills: ['Bad_Name'] }] }).errors.length, 1, '预览同样报非法');
      ok(s.importPreview(roots2, null).errors.length >= 1, 'payload 非对象 → errors');
      // 评审 C1：解析一次出双口径——spec.owner 绝不能带 `github:` 前缀（真 GitHub 拼 remote URL 必 404）
      const { resolveRepoSource, normalizeRepoSource } = await core('source');
      eq(resolveRepoSource('github:foo/bar/skills'), { canonical: 'github:foo/bar/skills', spec: { owner: 'foo', repo: 'bar', ref: null, subpath: 'skills' } }, '规范形再解析：owner 不带 github: 前缀');
      eq([resolveRepoSource('foo/bar').spec.owner, resolveRepoSource('https://github.com/a/b/c').spec.owner], ['foo', 'a'], '裸写法与 URL 同口径');
      eq(normalizeRepoSource('github:a/b'), 'github:a/b', 'normalizeRepoSource 保持幂等');
      // 评审 M10：install 抛错 → 可见警告 + 改判忽略，集创建不受影响
      const resErr = await s.importApply(roots2, { sets: [{ slug: 'boom', name: '炸掉集', skills: ['boom-skill'], pins: { 'boom-skill': { source: 'github:x/y', commit: 'c' } } }] }, {
        choices: { 'boom-skill': 'install' },
        install: async () => { throw new Error('上游 404'); },
      });
      setEq(resErr.ignored, ['boom-skill'], 'install 抛错改判忽略');
      ok(resErr.warnings.some((w) => w.includes('boom-skill') && w.includes('上游 404')), 'install 抛错出可见警告');
      eq(resErr.created.length, 1, 'install 抛错不毁集创建');
      // 评审 M2：placeholder 来源不进 pin、也不当 pin（否则导入端「按 pin 安装」必败）
      const exPh = s.exportSet(roots2, 'pkg');
      ok(!('bare' in (exPh.sets[0].pins ?? {})), '占位来源不进导出 pin');
      const pvPh = s.importPreview(roots2, { sets: [{ name: '占位 pin 集', skills: ['ghost-skill'], pins: { 'ghost-skill': { source: 'placeholder', commit: null } } }] });
      eq(pvPh.items[0].missing[0].pin, null, 'placeholder pin 视为无 pin');
      // 评审 M3：库内空壳目录（无 SKILL.md）→ 占位补写并计数
      mkdirp(path.join(roots2.libraryRoot, 'shell-skill'));
      fs.writeFileSync(path.join(roots2.libraryRoot, 'shell-skill', 'README.md'), 'x');
      const resShell = await s.importApply(roots2, { sets: [{ slug: 'shell', name: '空壳集', skills: ['shell-skill'] }] }, { choices: { 'shell-skill': 'placeholder' } });
      setEq(resShell.placeholders, ['shell-skill'], '空壳目录计入 placeholders');
      ok(fs.existsSync(path.join(roots2.libraryRoot, 'shell-skill', 'SKILL.md')), '空壳目录补写 SKILL.md');
    },
  },
  {
    id: 'claim-source', title: '认领来源：本地技能补 manifest（逐文件哈希即基线）、非法来源不落盘、撤认领回落 unknown（§8.1，P2-T4）',
    async run(f) {
      await withRoots(f);
      const dir = writeSkill(f.library, 'local-skill');
      const { claimSource, readManifest, walkFiles } = await core('manifest');
      eq(readManifest(dir), null, '认领前无 manifest（本地技能未登记）');
      const mf = await claimSource(f.roots, { name: 'local-skill', source: 'github:foo/bar/skills', commit: 'abc1234' });
      eq(mf.source, 'github:foo/bar/skills', '来源写规范形');
      eq(mf.commit, 'abc1234', 'commit 入册');
      eq(Object.keys(mf.files).sort(), ['SKILL.md'], '逐文件哈希表覆盖 SKILL.md');
      ok(/^sha256:/.test(mf.dirDigest), '目录摘要在');
      eq(Object.entries(walkFiles(dir)).every(([p, v]) => mf.files[p] === v), true, '认领后盘上 == 基线（libraryList 的 localModified 口径）');
      // 非法来源：抛业务错且盘上仍无 manifest
      const had = fs.existsSync(path.join(dir, '.manifest.json'));
      let threw = false;
      try { claimSource(f.roots, { name: 'local-skill', source: 'not-a-repo' }); } catch { threw = true; }
      ok(threw, '非法来源（单段名）抛业务错');
      eq(fs.existsSync(path.join(dir, '.manifest.json')), had, '非法来源不动盘');
      // 重新认领 = 以当前盘上内容为新基线
      fs.writeFileSync(path.join(dir, 'extra.md'), 'x');
      const mf2 = await claimSource(f.roots, { name: 'local-skill', source: 'github:other/repo' });
      eq(Object.keys(mf2.files).sort(), ['SKILL.md', 'extra.md'], '重新认领：当前盘上内容即新基线');
      eq(mf2.source, 'github:other/repo', '改认领覆盖来源');
      eq(mf2.commit, null, '未给 commit 记 null');
      // 撤认领 = 回落 source:'unknown'（§8.1 本地技能态），哈希基线保留
      const mf3 = await claimSource(f.roots, { name: 'local-skill', source: 'unknown' });
      eq(mf3.source, 'unknown', '撤认领回落 unknown');
      eq(Object.keys(mf3.files).sort(), ['SKILL.md', 'extra.md'], '撤认领保留哈希基线');
      // 库外与非法名
      let t2 = false; try { claimSource(f.roots, { name: 'no-such-skill', source: 'github:a/b' }); } catch { t2 = true; }
      ok(t2, '库内不存在的技能不可认领');
      let t3 = false; try { claimSource(f.roots, { name: 'Bad_Name', source: 'github:a/b' }); } catch { t3 = true; }
      ok(t3, '非 kebab-case 名拒绝认领');
    },
  },
  {
    id: 'client-scope',
    title: 'client.js 分段作用域扫描：只在点击路径上炸的 ReferenceError（§10 UI 无 linter）',
    async run() {
      // 教训（用户报告 2026-10-26）：新建「文档类」技能集已保存成功，面板却弹「操作失败: load is not
      // defined」——Panel 作用域里的重载函数叫 reload，「另存为」与「剔除幽灵名」两处写成 load()。
      // client.js 没有 linter（package.json 无 devDeps），node --check 也不报未定义标识符，
      // 这类笔误只有真点到那个按钮才抛，且 run() 的 catch 把它降级成一条错误文案 → 数据已写对、UI 却说失败。
      const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'typeof', 'new', 'await', 'yield', 'do', 'else', 'try', 'finally', 'case', 'in', 'of', 'instanceof', 'void', 'delete', 'throw', 'super', 'import', 'async', 'const', 'let', 'var', 'class', 'extends', 'get', 'set', 'default']);
      const GLOBALS = new Set(['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'fetch', 'console', 'JSON', 'Math', 'Object', 'Array', 'Set', 'Map', 'WeakMap', 'WeakSet', 'Promise', 'Error', 'TypeError', 'Date', 'RegExp', 'Symbol', 'String', 'Number', 'Boolean', 'Intl', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'queueMicrotask', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'AbortController', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'crypto', 'structuredClone', 'matchMedia', 'getComputedStyle', 'TextEncoder', 'TextDecoder', 'performance', 'Proxy', 'Reflect', 'globalThis', 'Infinity', 'NaN', 'undefined', 'arguments', 'btoa', 'atob', 'alert', 'confirm', 'prompt', 'React']);
      const blank = (m) => m.replace(/[^\n]/g, ' '); // 抹掉内容但保行号列宽（报错才指得准）
      const strip = (raw) => raw
        .replace(/\/\*[\s\S]*?\*\//g, blank)
        .replace(/(^|[ \t])\/\/[^\n]*/gm, (m, p) => p + blank(m.slice(p.length))) // `https://` 前有冒号，不会被当注释
        .replace(/`(?:\\[\s\S]|[^`\\])*`/g, blank)
        .replace(/'(?:\\[\s\S]|[^'\\\n])*'/g, '""')
        .replace(/"(?:\\[\s\S]|[^"\\\n])*"/g, '""');
      const ids = (s, into) => { for (const m of String(s).matchAll(/[A-Za-z_$][\w$]*/g)) into.add(m[0]); return into; };
      const declaredIn = (text) => {
        const set = new Set();
        for (const m of text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*|[{\[][^\n]*?[}\]])/g)) ids(m[1], set);
        for (const m of text.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) set.add(m[1]);
        for (const m of text.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)) ids(m[1], set); // 参数表（含 ({ctx,t}) 解构）
        for (const m of text.matchAll(/(?:^|[^\w$])([A-Za-z_$][\w$]*)\s*=>/g)) set.add(m[1]); // 单参箭头
        for (const m of text.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) set.add(m[1]);
        for (const m of text.matchAll(/\bfor\s*\(\s*(?:await\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) set.add(m[1]);
        for (const m of text.matchAll(/(?:^|[{,])\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/gm)) set.add(m[1]); // 对象简写方法（行首或 `{`/`,` 后）
        return set;
      };
      /** 按「模块顶层段」分段扫：跨段不可见，所以别段定义的 load() 在本段用了就该报。 */
      const scan = (raw) => {
        const lines = strip(raw).split('\n');
        const tops = [];
        lines.forEach((l, i) => { const m = /^    (?:async )?(?:function|const|let)\s+([A-Za-z_$][\w$]*)/.exec(l); if (m) tops.push({ i, name: m[1] }); });
        if (!tops.length) return ['找不到顶层段（文件结构变了？先更新本 case 的分段口径）'];
        // 模块可见名 = 各顶层段名 + preamble（第 7 行 `window.__ModuleLoader__.load({` 这种）里的**声明/参数**名。
        // 这里必须走 declaredIn 而不是把 preamble 的 token 全收：`load` 只是属性调用名，收进来会让
        // 整份扫描对 load() 失明（第一版就是这么漏掉用户报的那个 bug 的）。
        const moduleNames = new Set([...tops.map((x) => x.name), ...declaredIn(lines.slice(0, tops[0].i).join('\n'))]);
        const bad = [];
        for (let k = 0; k < tops.length; k++) {
          const from = tops[k].i, to = k + 1 < tops.length ? tops[k + 1].i : lines.length;
          const text = lines.slice(from, to).join('\n');
          const known = new Set([...moduleNames, ...declaredIn(text)]);
          for (const m of text.matchAll(/(^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
            const name = m[2];
            if (KEYWORDS.has(name) || GLOBALS.has(name) || known.has(name)) continue;
            const tag = `${tops[k].name} 段 L${from + 1}-${to}：${name}()`;
            if (!bad.includes(tag)) bad.push(tag);
          }
        }
        return bad;
      };
      // 自检：能抓到未定义调用（防守卫空转），也不误报已定义/全局/简写方法
      ok(scan('    function A() {\n      return nopeThing();\n    }\n').some((x) => x.includes('nopeThing')), '扫描自检：能抓到跨段未定义调用');
      eq(scan('    function A() {\n      const ok2 = (e) => React.useState(e);\n      ok2(1);\n      const o = { apply(ctx) { return ok2(ctx); } };\n      return o;\n    }\n'), [], '扫描自检：局部/全局/简写方法不误报');
      const file = path.resolve(import.meta.dirname, '..', 'plugin', 'skill-set-manager', 'client.js');
      const bad = scan(fs.readFileSync(file, 'utf8'));
      ok(bad.length === 0, `client.js 各顶层段无未定义调用（点击才炸的 ReferenceError）：\n      ${bad.join('\n      ')}`);
    },
  },
  {
    id: 'provider-skill',
    title: '插件/Preset 提供分区：fake skills 服务过滤口径 + 诊断第三分区行（用户疑问 2026-10-26）',
    async run(f) {
      await withRoots(f);
      const { providerSkills } = await core('providerSkills');
      const fake = {
        list: async () => [
          { name: 'archify', provider: 'archify-plugin', source: 'archify-plugin' },
          { name: 'office-docx', provider: 'skill-office', source: 'bundled' },
          { name: 'alpha', provider: 'filesystem', source: 'workspace' }, // 生效区文件系统技能：必须排除
          { name: 'runtimey', provider: 'runtime', source: 'runtime' }, // 运行期注册：不算插件注入，排除
          { name: 'ghost', provider: 'skill-office' }, // 无 source：回落 provider 口径
        ],
      };
      const emptyService = { list: async () => [] };
      // 排除口径 = 生效清单 ∪ 托管台账 ∪ 常驻名单；provider=filesystem/runtime 不列；库名不排除
      let got = await providerSkills(
        { skillsService: fake, projectRoot: f.projectA, managedEntries: { managedone: { kind: 'junction' } } },
        { effectiveNames: ['alpha'], residentNames: [] },
      );
      eq(got.map((e) => e.name), ['archify', 'ghost', 'office-docx'], '只列插件/Preset 注入且不在生效/台账里的技能（ghost 无 source 也列出）');
      eq(got.map((e) => e.provider), ['archify-plugin', 'skill-office', 'skill-office'], '提供者名透出（修复动作按它指向；无 source 回落 provider）');
      got = await providerSkills(
        { skillsService: fake, projectRoot: f.projectA, managedEntries: {} },
        { effectiveNames: [], residentNames: ['ghost'] },
      );
      eq(got.map((e) => e.name), ['archify', 'office-docx'], '常驻名单命中同样排除（ghost 在名单 → 不列）');
      eq(await providerSkills({ skillsService: null, projectRoot: f.projectA }), null, '服务缺席 → null（不可知 ≠ 空集）');
      eq(await providerSkills({ skillsService: emptyService, projectRoot: null }), null, '无项目根 → null');
      // 诊断 §9.1 第三分区行：有数据列名单，null 如实报不可枚举
      const dg = await core('diagnose');
      const { writeBinding } = await core('binding');
      const { saveSet } = await core('sets');
      await saveSet(f.roots, { slug: 'pv', name: 'PV', skills: [] });
      writeBinding(f.projectA, 'pv');
      const d1 = dg.diagnose(f.roots, { projectRoot: f.projectA, cwd: f.projectA, providerEntries: got.filter((e) => e.name === 'archify') });
      const part1 = d1.groups.partition.map((r) => String(r.what)).join('\n');
      ok(part1.includes('插件/Preset 提供') && part1.includes('archify（archify-plugin）'), '分区行列出注入技能与提供者');
      const d2 = dg.diagnose(f.roots, { projectRoot: f.projectA, cwd: f.projectA, providerEntries: null });
      ok(d2.groups.partition.some((r) => String(r.what).includes('不可枚举')), '服务不可用时如实报，不冒充空集');
      const d0 = dg.diagnose(f.roots, { projectRoot: f.projectA, cwd: f.projectA, providerEntries: [] });
      const part0 = d0.groups.partition.map((r) => String(r.what)).join('\n');
      ok(part0.includes('插件/Preset 提供') && part0.includes('（无）'), '空集如实报（无）');
      // 旧调用口径不传 providerEntries → 行为与从前一致（向后兼容）
      const dOld = dg.diagnose(f.roots, { projectRoot: f.projectA, cwd: f.projectA });
      ok(!dOld.groups.partition.map((r) => String(r.what)).join('\n').includes('插件/Preset'), '不传参数时不新增分区行');
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
    else if (a[i] === '--expect-add') ctx.expectAdd = a[++i].split(',').map((x) => x.trim()).filter(Boolean);
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
