/**
 * skill-set-manager host 半：Config 校验、roots 装配、storageDomain（失败回退 JSON）、
 * 启动无条件还原 pending（§6.6）、Remote 操作面（操作唯一实现，§14）、webServer 兜底通道。
 */
import z from '@deepseek-ai/schemastery';
import fs from 'node:fs';
import path from 'node:path';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { parseSkillSetLine, parseToolArgs, TOOL_ACTIONS } from './lib/core/commandLine.js';
import { buildRoots } from './lib/core/paths.js';
import { registerLibrary, readManifest, walkFiles, claimSource } from './lib/core/manifest.js';
import * as sets from './lib/core/sets.js';
import { findProjectRoot } from './lib/core/projectRoot.js';
import { readBinding, writeBinding } from './lib/core/binding.js';
import { readManaged } from './lib/core/managed.js';
import { planEffective, applyPlan, selfCheck } from './lib/core/effective.js';
import { entryKind, removeEntry } from './lib/core/linkx.js';
import { ensureGitignoreLine } from './lib/core/gitignore.js';
import { openDomain, projectKey } from './lib/core/storage.js';
import { startOverride, endOverride, endOverrideIfActive, restoreAllPending, pushUndo, applyUndo } from './lib/core/pending.js';
import { syncResident, pruneLegacyResidentLinks, dropResidentName } from './lib/core/resident.js';
import os from 'node:os';
import { parseRepoSpec, fetchRepo, installSkills } from './lib/core/github.js';
import { resolveRepoSource } from './lib/core/source.js';
import * as updates from './lib/core/updates.js';
import * as bk from './lib/core/backup.js';
import * as lifecycle from './lib/core/lifecycle.js';
import { diagnose } from './lib/core/diagnose.js';
import * as migrate from './lib/core/migrate.js';
import { decorate } from './lib/core/translations.js';
import * as dataPlane from './lib/core/dataPlane.js';
import { buildLlmPrompt, refId, normalizeSel } from './lib/core/translateExec.js';

/** 行级配置（cordis.patch.yml 的 config 块；用户 patch 层升级存活）。 */
export const Config = z.object({
  gitignoreLine: z.boolean().default(true),
  residentLinkToCrossHarness: z.boolean().default(false), // P3 后语义 = 额外保留旧 ~/.dsh/skills 链（默认常驻已搬 ~/.agents/skills）
  autoTranslate: z.boolean().default(false), // P3：库列表后自动翻 pending（默认关 = 零出网；手动批量不受限）
  autoBindNewProject: z.boolean().default(false),
  autoBindSlug: z.string().default(''),
  customSkillDirs: z.array(z.string()).default([]),
});

export const inject = ['sessionQuery', 'workingDirectory', 'agents', 'sessions'];

const EFFECTIVE_PRESETS = new Set(['standard', 'ptc', 'cordis']);

export function apply(ctx, config) {
  const roots = buildRoots({
    customSkillDirs: config.customSkillDirs,
    crossHarnessResident: config.residentLinkToCrossHarness,
  });
  let storePromise;
  const storeOf = () => (storePromise ??= openDomain(ctx, { fallbackDir: roots.dshHome }));
  const trInflight = new Set(); // M1 互斥（终审 2026-10-26）：autoTranslate 后台批与手动 translateRun 不叠加同条目重复出网

  // Remote 命名空间 = 操作唯一实现（§14）；fetch 兜底通道共用同一清单。
  const REMOTE_METHODS = [
    'state', 'listSets', 'saveSet', 'deleteSet', 'renameSet', 'copySet', 'setResident', 'saveAsFromEffective', 'exportSet', 'importSets', 'importPreview', 'importApply', 'bind', 'switchSet', 'undoSwitch', 'startOverride', 'endOverride', 'libraryList',
    // P1a：技能生命周期 + 诊断 + 解绑
    'installApply', 'updateCheck', 'updateApply', 'uninstallSkill', 'backupsList', 'backupRestore',
    'diagnoseRun', 'reclaimDeadLinks', 'rebuildManaged', 'migratePreview', 'migrateApply', 'migrateUndo', 'migrateAgentsPreview', 'migrateAgentsApply', 'migrateAgentsUndo', 'unbind', 'claimSource',
    // P3：翻译数据面
    'translatePending', 'translateRun', 'translateModels',
  ];

  class SkillSetManagerRemote extends TypertRemoteService {
    constructor(ctx) {
      super(ctx, 'skillSetManager', { namespace: 'skill-set-manager' });
    }

    /** 会话 → 项目根 + preset 判定（投影优先，header 可能过期——探针取证）。 */
    async locate(req) {
      const sessionId = req?.sessionId;
      let cwd = req?.cwd;
      let preset;
      let presetSource = 'request';
      if (sessionId) {
        try {
          const session = ctx.sessions.get(sessionId);
          if (session && !cwd) cwd = ctx.workingDirectory.get(session);
        } catch {}
        try {
          const obs = await ctx.sessionQuery.observeSession(sessionId);
          preset = obs?.projections?.values?.agentPreset;
          presetSource = 'projection';
        } catch {
          const header = ctx.sessionQuery.stat?.(sessionId) ?? ctx.sessions.info?.(sessionId);
          if (header) { preset = header.agentPreset; presetSource = 'header(stale-possible)'; }
        }
      }
      if (!cwd) cwd = process.cwd();
      const projectRoot = findProjectRoot(cwd);
      const presetWarn = preset && !EFFECTIVE_PRESETS.has(preset)
        ? `当前 preset「${preset}」未挂载技能注入，切换技能集不会改变可见技能（§10.2 #1）`
        : null;
      return { cwd, projectRoot, preset, presetSource, presetWarn, rootDrift: projectRoot !== cwd };
    }

    async state(req) {
      const loc = await this.locate(req);
      const binding = readBinding(loc.projectRoot);
      const set = binding?.setSlug ? sets.loadSet(roots, binding.setSlug) : null;
      const eff = binding?.setSlug ? sets.effectiveNames(roots, binding.setSlug) : { names: [], missing: [] };
      const sc = selfCheck(roots, loc.projectRoot);
      const managed = readManaged(loc.projectRoot);
      const store = await storeOf();
      // 索引自愈（review m3）：面板每打开一次该项目即入索引——MVP 期历史绑定项目最迟一次点面板补齐，
      // uninstall/deleteSet 的候选推导自此不再漏项目。仅带会话的定位才入索引，host cwd 兜底行是垃圾（review n5）。
      if (req?.sessionId && loc.projectRoot) { try { await store.put('bindings', projectKey(loc.projectRoot), { projectRoot: loc.projectRoot }); } catch {} }
      return {
        ...loc,
        sessionId: req?.sessionId ?? null,
        binding,
        set,
        sets: sets.listSets(roots),
        library: (await this.libraryList()).library,
        effective: eff,
        resident: sets.loadResident(roots).skills,
        residentForeign: dataPlane.residentForeign(roots), // 灰行判定源：常驻区名单外条目（设计 §6.4）
        residentTarget: roots.globalResidentDirs[0], // 弹窗「去设置管理」文案指向
        selfCheck: { ok: sc.ok, frozen: sc.frozen, unbound: sc.unbound, missing: sc.missing, extra: sc.extra, foreign: sc.foreign, brokenLinks: sc.brokenLinks, detail: sc.detail },
        managed: managed?.entries ?? {},
        sessionOverride: managed?.sessionOverride ?? null, // 覆盖明细透出（用户 2026-10-26：被剔项从三区消失无处发现/还原）
        sessionOverrideActive: (managed?.sessionOverride?.added?.length ?? 0) + (managed?.sessionOverride?.removed?.length ?? 0) > 0,
        undoAvailable: !!(await store.get('undo', projectKey(loc.projectRoot))),
      };
    }

    async listSets() {
      return { sets: sets.listSets(roots), resident: sets.loadResident(roots) };
    }

    async saveSet(req) {
      return sets.saveSet(roots, req.set);
    }

    async deleteSet(req) {
      const store = await storeOf();
      const affected = [];
      const push = (pr) => { if (pr && readBinding(pr)?.setSlug === req.slug && !affected.includes(pr)) affected.push(pr); };
      // P1a：bindings 索引全量推导（§7.8 冻结红标仍由 selfCheck 兜底）
      for (const pr of lifecycle.findBoundProjects(await this._candidateProjects(), req.slug)) push(pr);
      for (const table of ['pending', 'undo']) {
        for (const key of await store.keys(table)) {
          const rec = await store.get(table, key);
          push(rec?.projectRoot);
        }
      }
      const deleted = sets.deleteSet(roots, req.slug);
      return { deleted, affectedProjects: affected };
    }

    async renameSet(req) {
      return sets.renameSet(roots, req.slug, req.name);
    }

    async copySet(req) {
      return sets.copySet(roots, req.slug, req.name);
    }

    async setResident(req) {
      sets.saveResident(roots, req.names ?? []);
      return await syncResident(roots);
    }

    async saveAsFromEffective(req) {
      const loc = await this.locate(req);
      const binding = readBinding(loc.projectRoot);
      // 显式 names = 弹窗勾选草稿（候选区已排除常驻，原样保存）；
      // 隐式 = 生效清单兜底，须剔常驻（用户 2026-10-26：全局技能不该被另存进项目集合）
      const explicit = Array.isArray(req.names);
      const names = explicit ? req.names : sets.effectiveNames(roots, binding?.setSlug).names;
      return sets.saveAsSet(roots, { name: req.name, names, excludeResident: !explicit });
    }

    async exportSet(req) {
      return sets.exportSet(roots, req.slug);
    }

    async importSets(req) {
      return sets.importSets(roots, req.payload);
    }

    /** 导入预览（只读）：缺哪些技能、有没有 pin 可装、显示名会不会撞车（§5.6 两步导入第一步）。 */
    async importPreview(req) {
      return sets.importPreview(roots, req.payload);
    }

    /**
     * 导入落盘（§5.6）：三选一由 client 传 choices；「按 pin 安装」在这里走与
     * installApply **完全同一条**稀疏拉取 + installSkills 路径（§14 单一实现），
     * 插件自己不擅自联网——只有 choices 选了 install 才拉。
     */
    async importApply(req) {
      const tmps = [];
      const notes = [];
      try {
        const res = await sets.importApply(roots, req.payload, {
          choices: req.choices ?? {},
          install: async (name, pin) => {
            const { canonical, spec } = resolveRepoSource(pin.source); // 解析一次：canonical 入 manifest，spec 供 fetch（owner 不带 github: 前缀，评审 C1）
            if (spec.owner.includes(':')) throw new Error(`来源解析异常：owner="${spec.owner}" 仍带前缀（按 pin 安装会拼出错误 remote URL）`);
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssm-pin-'));
            tmps.push(tmpDir);
            const got = await fetchRepo(spec, { tmpDir, ...(req.url ? { url: req.url } : {}) });
            const rows = await installSkills(roots, {
              source: canonical,
              commit: got.commit,
              skillsDir: got.skillsDir,
              names: [name],
              overwrite: false,
              backup: async (n) => bk.snapshot(roots, n),
            });
            const row = rows.find((r) => r.name === name);
            if (!row?.ok) throw new Error(`按 pin 安装失败：${row?.reason ?? '上游未返回该技能'}`);
            if (pin.commit && pin.commit !== got.commit)
              notes.push(`${name}: pin 记的是 ${String(pin.commit).slice(0, 7)}，上游 HEAD 是 ${got.commit.slice(0, 7)}——已按 HEAD 装入（稀疏拉取不保证能取任意 SHA）`);
            registerLibrary(roots);
            return { commit: got.commit };
          },
        });
        if (notes.length) res.warnings.push(...notes);
        return res;
      } finally {
        for (const t of tmps) { try { fs.rmSync(t, { recursive: true, force: true }); } catch {} }
      }
    }

    /** 绑定 + 直接写 + 幂等补 .gitignore 署名行（§7.6）。 */
    async bind(req) {
      const loc = await this.locate(req);
      if (!sets.loadSet(roots, req.slug) && req.slug !== sets.RESIDENT_SLUG) throw new Error(`技能集不存在: ${req.slug}`);
      writeBinding(loc.projectRoot, req.slug);
      const plan = await planEffective(roots, loc.projectRoot, req.slug);
      const result = applyPlan(loc.projectRoot, plan);
      ensureGitignoreLine(loc.projectRoot, { enabled: config.gitignoreLine });
      await (await storeOf()).put('bindings', projectKey(loc.projectRoot), { projectRoot: loc.projectRoot }); // P1a 索引：deleteSet/uninstall 全量推导
      return { ...result, plan, projectRoot: loc.projectRoot };
    }

    /** 切换：先压一次性 undo 快照，再 bind（§5.2 撤销入口）。 */
    async switchSet(req) {
      const store = await storeOf();
      const loc = await this.locate(req);
      await pushUndo(store, roots, loc.projectRoot);
      const bound = await this.bind(req);
      return { ...bound, undoAvailable: true };
    }

    async undoSwitch(req) {
      const store = await storeOf();
      const loc = await this.locate(req);
      return { restored: await applyUndo(store, roots, loc.projectRoot) };
    }

    async startOverride(req) {
      const store = await storeOf();
      const loc = await this.locate(req);
      const snap = await startOverride(store, roots, loc.projectRoot, { add: req.add ?? [], remove: req.remove ?? [], sessionId: req.sessionId ?? null });
      return { snapshot: snap };
    }

    async endOverride(req) {
      const store = await storeOf();
      const loc = await this.locate(req);
      return { ended: await endOverride(store, roots, loc.projectRoot) };
    }

    /** 库登记 + 候选清单（建集勾选数据源）+ P1a manifest 摘要字段。 */
    async libraryList() {
      registerLibrary(roots);
      const library = [];
      let names;
      try { names = fs.readdirSync(roots.libraryRoot); } catch { names = []; }
      for (const n of names) {
        if (n.startsWith('.')) continue;
        const dir = path.join(roots.libraryRoot, n);
        const mf = readManifest(dir);
        let localModified = false;
        if (mf?.files) {
          const now = walkFiles(dir);
          localModified = Object.keys(mf.files).some((p) => mf.files[p] !== now[p]) || Object.keys(now).some((p) => now[p] !== mf.files[p]);
        }
        const hasSkillMd = fs.existsSync(path.join(dir, 'SKILL.md'));
        library.push({
          name: n,
          source: mf?.source ?? 'unknown',
          commit: mf?.commit ?? null,
          hasSkillMd,
          skillMd: hasSkillMd ? path.join(dir, 'SKILL.md') : null, // 右栏点击打开的绝对路径（P1b-T0）
          managed: !!mf,
          localModified,
          backupCount: bk.listBackups(roots, n).length,
        });
      }
      // P3：读时对账翻译缓存（缓存非真相源，§6.1）+ 三字段 decorate；autoTranslate 默认关 = 钩子不触发
      let cache = {};
      try {
        const store = await storeOf();
        const r = await dataPlane.libraryView(roots, store, {
          autoTranslate: config.autoTranslate,
          onPending: (names) => { void this._translate(names).catch(() => {}); },
        });
        cache = r.cache;
      } catch (e) { ctx.logger.warn(`skill-set-manager 翻译对账失败（列表照常无中文列）: ${e?.message ?? e}`); }
      return { library: decorate(library, cache) };
    }

    /** 认领来源（§8.1）：本地技能补 manifest（认领时的盘上内容即基线）；source='unknown' 撤认领回落本地态。 */
    async claimSource(req) {
      const mf = claimSource(roots, { name: req.name, source: req.source, commit: req.commit ?? null });
      return { name: mf.name, source: mf.source, commit: mf.commit, files: Object.keys(mf.files).length, dirDigest: mf.dirDigest };
    }

    // ---- P1a：GitHub 安装 / 升级 / 卸载 / 回收站（全部薄包装 core，同一实现） ----

    /** manifest.source = github:owner/repo[/subpath] → 稀疏拉取（tmp 目录批量回收；url 覆盖同 installApply）。 */
    _fetchFor(tmpDirs, urlOverride = null) {
      return async (source) => {
        // 单一口径走 core source.js：手拆 '/' 曾把 clone 地址尾部的 `.git` 当仓库名，
        // 拼出 owner/repo.git.git → 远端「Repository not found」（用户报告 2026-10-26，检查更新炸）
        const { spec } = resolveRepoSource(source);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssm-up-'));
        tmpDirs.push(tmpDir);
        return fetchRepo(spec, { tmpDir, ...(urlOverride ? { url: urlOverride } : {}) });
      };
    }

    async installApply(req) {
      const spec = parseRepoSpec(req.spec);
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssm-install-'));
      try {
        // req.url：file:// 或私仓镜像覆盖（活体验证夹具也走这里）
        const got = await fetchRepo(spec, { tmpDir, ...(req.url ? { url: req.url } : {}) });
        const results = await installSkills(roots, {
          source: `github:${spec.owner}/${spec.repo}${spec.subpath ? `/${spec.subpath}` : ''}`,
          commit: got.commit,
          skillsDir: got.skillsDir,
          names: req.names ?? null,
          overwrite: !!req.overwrite,
          backup: async (name) => bk.snapshot(roots, name),
        });
        registerLibrary(roots);
        return { commit: got.commit, results };
      } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      }
    }

    async updateCheck(req) {
      const tmps = [];
      try { return await updates.checkUpdate(roots, req.name, { fetch: this._fetchFor(tmps, req.url ?? null) }); }
      finally { for (const t of tmps) { try { fs.rmSync(t, { recursive: true, force: true }); } catch {} } }
    }

    async updateApply(req) {
      const tmps = [];
      try { return await updates.applyUpdate(roots, req.name, { fetch: this._fetchFor(tmps, req.url ?? null), backup: async (n) => bk.snapshot(roots, n) }); }
      finally { for (const t of tmps) { try { fs.rmSync(t, { recursive: true, force: true }); } catch {} } }
    }

    /** 候选项目集 = bindings 索引 ∪ pending/undo 记录（旧版遗留兜底）。 */
    async _candidateProjects() {
      const store = await storeOf();
      const out = new Set();
      for (const key of await store.keys('bindings')) {
        const rec = await store.get('bindings', key);
        if (rec?.projectRoot) out.add(rec.projectRoot);
      }
      for (const table of ['pending', 'undo']) {
        for (const key of await store.keys(table)) {
          const rec = await store.get(table, key);
          if (rec?.projectRoot) out.add(rec.projectRoot);
        }
      }
      return [...out];
    }

    async uninstallSkill(req) {
      const res = await lifecycle.uninstallSkill(roots, { name: req.name, bindings: await this._candidateProjects() });
      // M4（终审 2026-10-26）：卸载常驻技能 → 常驻名单同步剔除 + 回收链接（否则幽灵名灰行失真、启动 syncResident 反复告警）。
      try {
        if (dropResidentName(roots, req.name)) await syncResident(roots);
      } catch (e) { ctx.logger.warn(`skill-set-manager 常驻名单剔除失败: ${e?.message ?? e}`); }
      return res;
    }

    async backupsList(req) {
      return { backups: bk.listBackups(roots, req.name) };
    }

    async backupRestore(req) {
      return bk.restore(roots, req.name, req.dir);
    }

    // ---- P1a：诊断（§9 只读 + 两类可修复） ----

    _workspaceScopeInstalled() {
      // profile 目录逐个 package.json 查依赖（profile 名对插件不可见——不猜 desktop）。
      try {
        for (const p of fs.readdirSync(path.join(roots.dshHome, 'profiles'))) {
          try {
            const pkg = JSON.parse(fs.readFileSync(path.join(roots.dshHome, 'profiles', p, 'package.json'), 'utf8'));
            if (Object.keys(pkg.dependencies ?? {}).some((d) => d.includes('dsh-workspace-scope'))) return true;
          } catch {}
        }
      } catch {}
      return false;
    }

    async diagnoseRun(req) {
      // 无活动会话时项目面如实置空，不得拿 host 进程 cwd 冒充（review M2）
      const loc = req?.sessionId ? await this.locate(req) : { cwd: null, projectRoot: null };
      return diagnose(roots, {
        projectRoot: loc.projectRoot,
        cwd: loc.cwd ?? process.cwd(),
        workspaceScopeInstalled: this._workspaceScopeInstalled(),
      });
    }

    /** 自动修复①（§9）：按托管清单回收失效链接后按当前集重建。
     *  死 stub 判定用 entryKind（stat 失败即 missing，含死链）；摘除走 linkx.removeEntry
     *  （Windows 死 junction 的 ENOTDIR/EPERM 兜底，review m9）；flat 条目按 `<name>.md` 口径（m7）。 */
    async reclaimDeadLinks(req) {
      if (!req?.sessionId) throw new Error('无活动会话：无法定位项目，请先在对话页打开会话（review M2）');
      const loc = await this.locate(req);
      const managed = readManaged(loc.projectRoot) ?? { entries: {} };
      const reclaimed = [];
      const warnings = [];
      const skillsDir = path.join(loc.projectRoot, '.dsh', 'skills');
      for (const name of Object.keys(managed.entries)) {
        const p = path.join(skillsDir, managed.entries[name]?.flat ? `${name}.md` : name);
        if (entryKind(p) !== 'missing') continue;
        try { removeEntry(p); } catch (e) { warnings.push(`${name}: 死链摘除失败 ${e?.message ?? e}`); continue; } // 摘除失败不动台账
        delete managed.entries[name];
        reclaimed.push(name);
      }
      if (reclaimed.length) writeManaged(loc.projectRoot, managed);
      let rebuilt = null;
      const slug = readBinding(loc.projectRoot)?.setSlug;
      if (slug) rebuilt = applyPlan(loc.projectRoot, await planEffective(roots, loc.projectRoot, slug));
      return { reclaimed, rebuilt, warnings };
    }

    /** 自动修复②（§9 / review minor#2 转正，M1 后 planEffective 会把外删条目带回 add）：按当前集重建。 */
    async rebuildManaged(req) {
      if (!req?.sessionId) throw new Error('无活动会话：无法定位项目，请先在对话页打开会话（review M2）');
      const loc = await this.locate(req);
      const slug = readBinding(loc.projectRoot)?.setSlug;
      if (!slug) throw new Error('未绑定技能集，无从重建');
      const plan = await planEffective(roots, loc.projectRoot, slug);
      return { ...applyPlan(loc.projectRoot, plan), plan };
    }

    // ---- P1a：迁移向导（§8.2，ledger 落 storageDomain） ----

    _migrateLedger() {
      return {
        load: async () => (await storeOf()).get('migration', 'ledger'),
        save: async (data) => { await (await storeOf()).put('migration', 'ledger', data); },
      };
    }

    async migratePreview() {
      return migrate.preview(roots);
    }

    async migrateApply() {
      const pv = migrate.preview(roots);
      return migrate.apply(roots, { moves: pv.moves, ledger: this._migrateLedger() });
    }

    async migrateUndo() {
      return migrate.undo(roots, { ledger: this._migrateLedger() });
    }

    // ---- P3：~/.agents/skills 存量迁移（设计 §5.7/§6.6；ledger 独立域，不与旧向导互踩） ----

    _migrateAgentsLedger() {
      return {
        load: async () => (await storeOf()).get('migrate_agents', 'ledger'), // 表名禁连字符（fallback/domain 两侧同款约束，活体实锤）
        save: async (data) => { await (await storeOf()).put('migrate_agents', 'ledger', data); },
      };
    }

    async migrateAgentsPreview() {
      return migrate.previewAgents(roots);
    }

    async migrateAgentsApply() {
      return migrate.applyAgents(roots, { ledger: this._migrateAgentsLedger() });
    }

    async migrateAgentsUndo() {
      return migrate.undoAgents(roots, { ledger: this._migrateAgentsLedger() });
    }

    // ---- P3：翻译数据面（设计 §6.1/§5.8——llm 主路由，translator 在场才兜底） ----

    /** 待翻清单（M2 终审 2026-10-26）：pending + failed 都返回——failed 同哈希不自愈但 UI 须有重试入口（AC#2）。 */
    async translatePending() {
      const store = await storeOf();
      const r = await dataPlane.reconcileLibrary(roots, store);
      const failed = Object.keys(r.cache).filter((name) => r.cache[name]?.status === 'failed' && r.cache[name]?.en).sort();
      return {
        pending: r.pending.map((name) => ({ name, en: r.cache[name]?.en ?? null })),
        failed: failed.map((name) => ({ name, en: r.cache[name]?.en ?? null })),
        autoTranslate: config.autoTranslate,
      };
    }

    /**
     * 模型面（rc.3 探针实锤 2026-10-26：listModels 改位置字符串参数，对象参数被整体 stringify 成
     * "[object Object]" 炸 NO_ADAPTER；rc.2 则是 {providerId} 对象参数——双签名兼容）。
     * 全部调用 await Promise.resolve 收 rejection、逐 provider 隔离、refId 归一，绝不逃到 Remote 面。
     */
    async translateModels() {
      let current = null;
      const options = [];
      const llm = ctx.get('llm');
      const listModels = async (pid) => {
        try { return await Promise.resolve(llm.listModels(pid)); } // rc.3：位置字符串参数
        catch (e1) {
          try { return await Promise.resolve(llm.listModels({ providerId: pid })); } // rc.2：对象参数
          catch { throw e1; }
        }
      };
      try { current = normalizeSel(await Promise.resolve(ctx.get('agentDefaultModel')?.currentSelection?.() ?? null)); } catch (e) { ctx.logger.warn(`skill-set-manager 当前模型读取失败: ${e?.message ?? e}`); }
      try {
        const provs = await Promise.resolve(llm?.listProviders?.() ?? []);
        for (const p of Array.isArray(provs) ? provs : []) {
          const pid = refId(p);
          if (!pid) continue;
          const pname = typeof p?.name === 'string' && p.name.trim() ? p.name.trim() : pid;
          let models = [];
          try { models = await listModels(pid); } catch (e) { ctx.logger.warn(`skill-set-manager provider ${pid} 模型列表跳过: ${e?.message ?? e}`); continue; } // 单 provider 失败只损失该 provider
          for (const m of Array.isArray(models) ? models : []) {
            const mid = refId(m);
            if (!mid) continue;
            const mname = typeof m?.name === 'string' && m.name.trim() ? m.name.trim() : mid;
            options.push({ provider: pid, model: mid, label: `${pname} · ${mname}` });
          }
        }
      } catch (e) { ctx.logger.warn(`skill-set-manager 模型列表失败: ${e?.message ?? e}`); }
      return { current, options };
    }

    /** llm 单条调用：归一后 provider/model 必须是字符串（rc.3 教训：对象进 stream 即崩）；只拼非 reasoning delta。 */
    _callLlmTranslate(sel) {
      const llm = ctx.get('llm');
      const s = normalizeSel(sel);
      if (!llm || !s) return null;
      return async (enOrArr) => { // chunk 拼接批收 en 数组、逐条收字符串（runBatch 两种形态都投喂）
        let cur = null;
        let text = '';
        for await (const ev of llm.stream({ provider: s.provider, model: s.model, messages: [{ role: 'user', content: [{ type: 'text', text: buildLlmPrompt(Array.isArray(enOrArr) ? enOrArr : [enOrArr]) }] }] })) {
          if (ev.type === 'block-start') cur = ev.blockType ?? null;
          else if (typeof ev.type === 'string' && ev.type.endsWith('-delta') && cur !== 'reasoning' && typeof ev.text === 'string') text += ev.text;
          else if (ev.type === 'finish' && ev.reason && ev.reason !== 'stop' && !text) throw new Error(`llm finish: ${ev.reason}`);
        }
        return text;
      };
    }

    _callMtTranslate() {
      const mt = ctx.get('translator'); // 本机 live profile 未挂载（探针证实）→ null = 无兜底，LLM 失败逐条 failed
      if (!mt) return null;
      return async (en) => {
        const r = await mt.translate?.(en, { to: 'zh' }); // 形状未经实证（服务缺席），抛错即该条 failed
        return typeof r === 'string' ? r : r?.text ?? null;
      };
    }

    async _translate(names, { provider = null, model = null } = {}) {
      const all = Array.isArray(names) ? names : [];
      const fresh = all.filter((n) => !trInflight.has(n)); // M1 互斥：已在翻的条目跳过（手动批与 autoTranslate 后台批可叠加时不重复出网）
      const skipped = all.length - fresh.length;
      if (!fresh.length) return { done: [], failed: [], skipped };
      fresh.forEach((n) => trInflight.add(n));
      try {
        const store = await storeOf();
        let sel = null;
        try { sel = normalizeSel(provider && model ? { provider, model } : (await Promise.resolve(ctx.get('agentDefaultModel')?.currentSelection?.() ?? null))); } catch (e) { ctx.logger.warn(`skill-set-manager 翻译模型选择失败: ${e?.message ?? e}`); }
        const r = await dataPlane.translateRunCore({ roots, store, names: fresh, callLlm: this._callLlmTranslate(sel), callMt: this._callMtTranslate() });
        return { done: r.done, failed: r.failed, skipped: r.skipped + skipped };
      } finally {
        fresh.forEach((n) => trInflight.delete(n));
      }
    }

    async translateRun(req) {
      // 兜底：RPC 内任何未预期抛出不得逃到 Remote 面（2026-10-26 实锤：NO_ADAPTER 同步抛经
      // webServer 兜底通道成为 unhandled rejection，直接崩 host 进程）。
      try {
        return await this._translate(Array.isArray(req?.names) ? req.names : [], { provider: req?.provider ?? null, model: req?.model ?? null });
      } catch (e) {
        ctx.logger.warn(`skill-set-manager 批量翻译失败: ${e?.message ?? e}`);
        return { done: [], failed: (Array.isArray(req?.names) ? req.names : []).map((name) => ({ name, error: String(e?.message ?? e) })), skipped: 0 };
      }
    }

    /** 解绑（面板缺口）：回收托管条目 + 删 binding/managed；gitignore 行保留。 */
    async unbind(req) {
      const loc = await this.locate(req);
      const res = lifecycle.unbindProject(loc.projectRoot);
      const store = await storeOf();
      await store.delete('bindings', projectKey(loc.projectRoot));
      return { ...res, projectRoot: loc.projectRoot };
    }
  }

  // @Remote 的显式等价：网关 source-mode 读取的 prototype marker（形状照抄 dsh-typert-protocol 源码
  // addMarker/remoteMethods；加载器解析器不保证支持装饰符语法——ledger 裁定）。
  // 方法清单 = 文件头 REMOTE_METHODS 单一来源（fetch 兜底通道共用）。
  Object.defineProperty(SkillSetManagerRemote.prototype, '@deepseek-ai/dsh-typert-protocol/remote-methods', {
    configurable: true,
    value: Object.freeze({ version: 1, methods: Object.freeze(REMOTE_METHODS.map((name) => Object.freeze({ kind: 'direct', exportName: name }))) }),
  });

  const remote = new SkillSetManagerRemote(ctx);

  // ---- P2：人机入口（§12 P2）：slash 命令与模型工具只是同一批 remote.* 方法的
  // 薄包装（§14「一个操作、两个调用方」）——这里只允许出现解析与文本渲染。 ----
  const NO_SESSION = '无法定位项目：请在对话页打开会话后再调用（插件不拿 host 进程 cwd 冒充项目根）';
  const HELP = '用法：/skill-set list | show | use <集名或显示名> [--yes] | undo';
  const detailText = (d) => (Array.isArray(d) ? d.join('；') : String(d ?? ''));
  const fmtList = (r, currentSlug) => {
    const lines = [`技能集（${r.sets.length}）｜全局常驻 ${r.resident.skills.length} 项`];
    for (const s of r.sets) lines.push(`  ${s.slug === currentSlug ? '→' : ' '} ${s.slug}  ${s.name}（${(s.skills || []).length}）`);
    if (!r.sets.length) lines.push('  （还没有技能集：面板「从当前生效清单另存为」是第一个集的主路径）');
    lines.push(currentSlug ? `当前项目绑定：${currentSlug}` : '当前项目：未绑定技能集');
    return lines.join('\n');
  };
  const fmtShow = (st) => {
    const sc = st.selfCheck;
    const lines = [
      `项目根：${st.projectRoot}${st.rootDrift ? `（≠ 会话目录 ${st.cwd}：改动影响该仓库全部会话）` : ''}`,
      `当前技能集：${st.set ? `${st.set.name}（${st.set.slug}）` : '未绑定'}`,
      `生效清单（${st.effective.names.length}）：${st.effective.names.join('、') || '（空）'}`,
      `全局常驻（${st.resident.length}）：${st.resident.join('、') || '（无）'}`,
      sc.ok ? '自检：✓ 与盘上一致' : `自检：⚠ ${detailText(sc.detail) || '自算清单与盘上不一致'}`,
    ];
    if (st.sessionOverrideActive) lines.push('临时覆盖：本次会话进行中（会话结束即还原）');
    if (sc.frozen) lines.push('冻结绑定：技能集已被删除，清单原样保留、插件不再驱动——改绑或重建。');
    if (st.presetWarn) lines.push(`注意：${st.presetWarn}`);
    lines.push('提示：`/` 命令列表在新会话前不会同步，以本命令与面板为准。');
    return lines.join('\n');
  };
  const fmtSwitch = (set, res) => {
    const a = res.applied ?? { added: 0, removed: 0, kept: 0 };
    const w = res.warnings?.length ? `\n警告：${res.warnings.join('；')}` : '';
    return `已切换：${set.name}（${set.slug}）\n新增 ${a.added} / 移除 ${a.removed}（保留 ${a.kept}），下一轮请求即生效。${w}\n/skill-set undo 可撤销本次切换。`;
  };
  const DOCTOR_GROUPS = [['partition', '分区构成'], ['copies', '副本漂移'], ['dangling', '悬空引用'], ['deadLinks', '失效链接'], ['structure', '结构与 frontmatter'], ['env', '环境']];
  const fmtDoctor = (d) => {
    const lines = [];
    for (const [key, label] of DOCTOR_GROUPS) {
      const rows = d.groups?.[key] ?? [];
      lines.push(`【${label}】${rows.length} 条`);
      for (const r of rows.slice(0, 5)) lines.push(`  ${r.level === 'info' ? '·' : '⚠'} ${r.what}${r.fix ? `｜修复：${r.fix}` : ''}`);
      if (rows.length > 5) lines.push(`  …另 ${rows.length - 5} 条见设置页「诊断」页签`);
    }
    lines.push(`可自动修复：回收失效链接（${d.fixable?.reclaimDeadLinks?.count ?? 0} 条）与「按当前技能集重建」——两者都在面板或设置页诊断页签执行。`);
    return lines.join('\n');
  };

  /** 命令面契约：处理器必须返回 {kind:'success'|'error'}，不得让异常冒到宿主（评审 I3：技能集 JSON 可手改坏）。 */
  const guard = (fn) => async (inv) => {
    try { return await fn(inv); }
    catch (e) { return { kind: 'error', text: `操作失败：${e?.message ?? e}` }; }
  };

  /** slug 或显示名——命令与工具同一匹配口径（评审 M7）。 */
  const matchSets = (all, ref) => all.filter((s) => s.slug === ref || s.name === ref);

  /** `/skill-set` 处理器：解析 → remote → 文本（无业务逻辑）。 */
  async function runSkillSet(inv) {
    const { action, arg, yes } = parseSkillSetLine(inv?.rawInput);
    const sessionId = inv?.agent?.id ?? null;
    if (action === 'list') {
      const r = await remote.listSets();
      const current = sessionId ? (await remote.state({ sessionId })).binding?.setSlug ?? null : null;
      return { kind: 'success', text: fmtList(r, current) };
    }
    if (action === 'show') {
      if (!sessionId) return { kind: 'error', text: NO_SESSION };
      return { kind: 'success', text: fmtShow(await remote.state({ sessionId })) };
    }
    if (action === 'use') {
      if (!sessionId) return { kind: 'error', text: NO_SESSION };
      if (!arg) return { kind: 'error', text: `缺少技能集。\n${HELP}` };
      const hit = matchSets((await remote.listSets()).sets, arg);
      if (!hit.length) return { kind: 'error', text: `找不到技能集「${arg}」。/skill-set list 查看全部。` };
      if (hit.length > 1) return { kind: 'error', text: `「${arg}」匹配多个集：${hit.map((s) => `${s.slug}（${s.name}）`).join('、')}——请用 slug。` };
      const st = await remote.state({ sessionId });
      if (st.rootDrift && !yes)
        return { kind: 'error', text: `项目根 ≠ 会话目录：本次会改 ${st.projectRoot}，影响该仓库全部会话。\n确认无误后加 --yes 重试：/skill-set use ${hit[0].slug} --yes` };
      const res = await remote.switchSet({ sessionId, slug: hit[0].slug });
      return { kind: 'success', text: fmtSwitch(hit[0], res) };
    }
    if (action === 'undo') {
      if (!sessionId) return { kind: 'error', text: NO_SESSION };
      const r = await remote.undoSwitch({ sessionId });
      return { kind: 'success', text: r.restored ? '已撤销上一次切换，生效清单回到切换前。' : '没有可撤销的切换记录（撤销入口用过一次即消失）。' };
    }
    return { kind: 'error', text: `未知子命令「${action}」。\n${HELP}` };
  }

  /** `/skill-doctor` 处理器：全局只读诊断（无会话时项目面如实置空，review M2 口径）。 */
  async function runDoctor(inv) {
    return { kind: 'success', text: fmtDoctor(await remote.diagnoseRun({ sessionId: inv?.agent?.id ?? null })) };
  }

  // 注册即挂 disposer（P1 血泪规则）；服务缺位 → 一次性警告 + 该入口退化。
  const commands = ctx.get('commands');
  if (!commands) ctx.logger.warn('skill-set-manager：无 commands 服务，/skill-set 与 /skill-doctor 不可用（面板与设置页不受影响）');
  else
    ctx.effect(() => {
      const defs = [
        { name: 'skill-set', description: '查看与切换本项目的技能集（list / show / use <集> / undo）', input: { hint: '<list | show | use <集> [--yes] | undo>' }, handler: guard(runSkillSet) },
        { name: 'skill-doctor', description: '技能诊断：六类状态分组 + 修复指引', handler: guard(runDoctor) },
      ];
      const offs = [];
      for (const def of defs) {
        try { offs.push(commands.register(def)); }
        catch (e) { ctx.logger.warn(`skill-set-manager：命令 /${def.name} 注册失败（同名被占用或上一代际残留）: ${e?.message ?? e}`); }
      }
      return () => { for (const off of offs) { try { off(); } catch {} } };
    }, 'skill-set-manager.commands');

  // ---- P2：模型侧入口（§12 P2 行 211）：slash 命令是人机专属，不提供 tool 模型就管不了技能集。
  // 工具与命令、UI 复用同一批 remote 方法（§14），差别只在文本渲染与 rootDrift 的处理。 ----
  const renderToolValue = (value) => {
    if (value && typeof value.text === 'string') return value.text;
    return JSON.stringify(value ?? null, null, 2);
  };
  const tools = ctx.get('tools');
  if (!tools) ctx.logger.warn('skill-set-manager：无 tools 服务，skill_set 工具不可用（模型侧无法管理技能集，其余不受影响）');
  else
    ctx.effect(() => {
      let off;
      try {
        off = tools.register({
          name: 'skill_set',
          description: '查看或切换当前项目的技能集。list=列出全部技能集与当前绑定；show=当前项目根、生效清单与自检；use=切换到指定技能集（下一轮请求即生效，无需重启会话；技能体在下一轮开始前就位）。',
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: [...TOOL_ACTIONS], description: 'list / show / use 三选一' },
              slug: { type: 'string', description: 'action=use 时必填：技能集 slug 或显示名（可先 action=list 查询）' },
            },
            required: ['action'],
            additionalProperties: false,
          },
          output: {
            schema: { type: 'object', properties: { ok: { type: 'boolean' }, text: { type: 'string' } } },
            render: (_args, value) => [{ type: 'text', text: renderToolValue(value) }],
          },
          isConcurrencySafe: (args) => { try { return parseToolArgs(args).action !== 'use'; } catch { return false; } }, // 写操作排他
          execute: async (args, exec) => {
            const { action, slug } = parseToolArgs(args);
            const sessionId = exec?.agent?.id ?? null;
            if (!sessionId) throw new Error('无会话上下文：skill_set 只能在会话内调用（需要会话定位项目根）');
            if (action === 'list') {
              const r = await remote.listSets();
              const current = (await remote.state({ sessionId })).binding?.setSlug ?? null;
              return { ok: true, current, resident: r.resident.skills, sets: r.sets.map((s) => ({ slug: s.slug, name: s.name, count: (s.skills || []).length })), text: fmtList(r, current) };
            }
            if (action === 'show') {
              const st = await remote.state({ sessionId });
              return {
                ok: true, selfCheckOk: st.selfCheck.ok, projectRoot: st.projectRoot, rootDrift: st.rootDrift,
                set: st.set?.slug ?? null, effective: st.effective.names, missing: st.effective.missing,
                text: fmtShow(st),
              };
            }
            const hit = matchSets((await remote.listSets()).sets, slug);
            if (!hit.length) throw new Error(`找不到技能集「${slug}」：先 action=list 查看全部`);
            if (hit.length > 1) throw new Error(`「${slug}」匹配多个集：${hit.map((s) => `${s.slug}（${s.name}）`).join('、')}——改用 slug`);
            const st = await remote.state({ sessionId });
            // 模型侧没有 --yes 通道：项目根漂移时改的是整仓库全部会话，明确拒绝比静默误伤好（P2 裁定）。
            if (st.rootDrift)
              throw new Error(`项目根 ${st.projectRoot} ≠ 会话目录 ${st.cwd}：会影响该仓库全部会话，需人工确认——请在面板切换，或人侧执行 /skill-set use ${hit[0].slug} --yes`);
            const res = await remote.switchSet({ sessionId, slug: hit[0].slug });
            return { ok: true, set: hit[0].slug, applied: res.applied, warnings: res.warnings ?? [], text: fmtSwitch(hit[0], res) };
          },
        });
      } catch (e) {
        ctx.logger.warn(`skill-set-manager：skill_set 工具注册失败（同名被占用或上一代际残留）: ${e?.message ?? e}`);
      }
      return () => { try { off?.(); } catch {} };
    }, 'skill-set-manager.tool');

  // 启动无条件还原（崩溃残留即设计前提）；失败不阻塞激活，只警告。
  storeOf().then(async (store) => {
    try {
      const r = await restoreAllPending(store, roots);
      if (r.warnings.length) ctx.logger.warn(`skill-set-manager 启动还原警告: ${r.warnings.join('; ')}`);
      if (r.restored.length) ctx.logger.info(`skill-set-manager 启动还原 ${r.restored.length} 个项目的临时覆盖`);
    } catch (e) {
      ctx.logger.warn(`skill-set-manager 启动还原失败: ${e?.message ?? e}`);
    }
  }).catch((e) => ctx.logger.warn(`skill-set-manager 存储打开失败: ${e?.message ?? e}`));

  // 常驻链接幂等修复（§5.3：常驻 = 库 → 全局生效区的链接，重启/外部改动后自愈）。
  syncResident(roots).then((r) => {
    if (r.warnings.length) ctx.logger.warn(`skill-set-manager 常驻同步警告: ${r.warnings.join('; ')}`);
  }).catch((e) => ctx.logger.warn(`skill-set-manager 常驻同步失败: ${e?.message ?? e}`));

  // P3 常驻区搬迁：按台账回收旧 ~/.dsh/skills 的自建遗留链（他人条目零触碰，幂等）。
  pruneLegacyResidentLinks(roots).then((r) => {
    if (r.pruned.length) ctx.logger.info(`skill-set-manager 回收 ${r.pruned.length} 条旧常驻链（常驻区已迁 ~/.agents/skills）`);
    if (r.warnings.length) ctx.logger.warn(`skill-set-manager 旧链回收警告: ${r.warnings.join('; ')}`);
  }).catch((e) => ctx.logger.warn(`skill-set-manager 旧链回收失败: ${e?.message ?? e}`));

  // 新会话自动绑定（默认关；开启后仅对无绑定的项目落默认集）。
  if (config.autoBindNewProject && config.autoBindSlug) {
    ctx.on('session/created', async (session) => {
      try {
        const cwd = ctx.workingDirectory.get(session);
        const projectRoot = findProjectRoot(cwd);
        if (readBinding(projectRoot)) return;
        if (!sets.loadSet(roots, config.autoBindSlug)) return;
        writeBinding(projectRoot, config.autoBindSlug);
        applyPlan(projectRoot, await planEffective(roots, projectRoot, config.autoBindSlug));
        ensureGitignoreLine(projectRoot, { enabled: config.gitignoreLine });
        try { await (await storeOf()).put('bindings', projectKey(projectRoot), { projectRoot }); } catch {} // session/created 自动绑定同步入索引（P1b-T1）
      } catch (e) {
        ctx.logger.warn(`skill-set-manager 自动绑定失败: ${e?.message ?? e}`);
      }
    });
  }

  // 事件级还原（§6.6 P2）：会话结束（session/disposed）或归档（workspace/session-stop，
  // 探针取证：parallel 派发、payload 只有 sessionId）即尽力还原该项目临时覆盖，不再等重启。
  // 定位不到会话 cwd 就绝不动盘——不拿 host 进程 cwd 冒充项目根（review M2 同族）。
  const cwdOfSession = (sessionId, sessionHint = null) => {
    if (!sessionId) return null;
    // 事件自带的 session 对象优先（处置时机注册表可能已摘除该会话，评审 M8），再回落注册表/落盘索引
    for (const s of [sessionHint, (() => { try { return ctx.sessions.get(sessionId); } catch { return null; } })()]) {
      if (!s) continue;
      try { const c = ctx.workingDirectory.get(s); if (c) return c; } catch {}
    }
    try { const h = ctx.sessionQuery.stat?.(sessionId) ?? ctx.sessions.info?.(sessionId); if (h?.cwd) return h.cwd; } catch {}
    return null;
  };
  const restoreOnSessionEnd = async (sessionId, label, sessionHint = null) => {
    try {
      const cwd = cwdOfSession(sessionId, sessionHint);
      if (!cwd) return; // 无 cwd = 无法定位项目：启动无条件还原仍是兜底（§6.6 设计前提不变）
      const projectRoot = findProjectRoot(cwd);
      // 带 ending sessionId：同仓库另一会话开着覆盖时不误伤（§6.6「只对本次会话生效」，评审 I1）
      const r = await endOverrideIfActive(await storeOf(), roots, projectRoot, sessionId);
      if (r.ended) ctx.logger.info(`skill-set-manager：会话${label}已还原 ${projectRoot} 的临时覆盖`);
    } catch (e) {
      ctx.logger.warn(`skill-set-manager 会话${label}还原失败: ${e?.message ?? e}`);
    }
  };
  ctx.on('session/disposed', (session) => { void restoreOnSessionEnd(session?.id, '结束', session); });
  ctx.on('workspace/session-stop', (request) => { void restoreOnSessionEnd(request?.sessionId, '归档'); });

  // 技能目录变化 = 缓存失效点（本实现无缓存：roots 为纯路径装配，扫描即时——裁定记录在 ledger）。
  ctx.on('skills/change', () => {});

  // 兜底通道：Remote 面不可达时 client 走同源 fetch（同一实现，非第二套逻辑）。
  // 注意：webServer 用 ctx.get 可选取用（headless profile 无此服务时不得崩 entry）。
  // 关键：路由 disposer 必须挂进 ctx.effect——否则 bundle 禁用后路由泄漏在
  // app 级路由表里引用已 dispose 的旧 ctx（“inactive context”），再启用时
  // duplicate 注册被拒，路由永久停在已死的旧 handler 上。
  try {
    const webServer = ctx.get('webServer');
    if (!webServer) {
      ctx.logger.warn('skill-set-manager：无 webServer 服务，fetch 兜底通道不可用（Remote 面不受影响）');
    } else {
      const route = {
        kind: 'exact',
        path: '/api/skill-set-manager',
        handler: async (req, res) => {
          if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
          let body = '';
          for await (const chunk of req) body += chunk;
          try {
            const { method, args } = JSON.parse(body || '{}');
            const fn = remote[method];
            if (typeof fn !== 'function' || !REMOTE_METHODS.includes(method)) {
              res.writeHead(400, { 'content-type': 'application/json' });
              res.end(JSON.stringify({ error: `unknown method: ${method}` }));
              return;
            }
            const value = await fn.call(remote, args);
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ value }));
          } catch (e) {
            res.writeHead(500, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: String(e?.message ?? e) }));
          }
        },
      };
      ctx.effect(() => {
        let off;
        try {
          off = webServer.register(route);
        } catch (e) {
          // 抢占上一代际泄漏的死路由占位（仅 duplicate 才抢；该路径名空间归本插件）。
          if (!/duplicate/.test(String(e?.message ?? e))) throw e;
          webServer.exact?.delete(route.path);
          off = webServer.register(route);
        }
        return () => off();
      }, 'skill-set-manager.fetchRoute');
    }
  } catch (e) {
    ctx.logger.warn(`skill-set-manager webServer 兜底通道注册失败（不影响 Remote 面）: ${e?.message ?? e}`);
  }
}
