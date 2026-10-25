/**
 * skill-set-manager host 半：Config 校验、roots 装配、storageDomain（失败回退 JSON）、
 * 启动无条件还原 pending（§6.6）、Remote 操作面（操作唯一实现，§14）、webServer 兜底通道。
 */
import z from '@deepseek-ai/schemastery';
import fs from 'node:fs';
import path from 'node:path';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { buildRoots } from './lib/core/paths.js';
import { registerLibrary, readManifest, walkFiles } from './lib/core/manifest.js';
import * as sets from './lib/core/sets.js';
import { findProjectRoot } from './lib/core/projectRoot.js';
import { readBinding, writeBinding } from './lib/core/binding.js';
import { readManaged } from './lib/core/managed.js';
import { planEffective, applyPlan, selfCheck } from './lib/core/effective.js';
import { entryKind, removeEntry } from './lib/core/linkx.js';
import { ensureGitignoreLine } from './lib/core/gitignore.js';
import { openDomain, projectKey } from './lib/core/storage.js';
import { startOverride, endOverride, restoreAllPending, pushUndo, applyUndo } from './lib/core/pending.js';
import { syncResident } from './lib/core/resident.js';
import os from 'node:os';
import { parseRepoSpec, fetchRepo, installSkills } from './lib/core/github.js';
import * as updates from './lib/core/updates.js';
import * as bk from './lib/core/backup.js';
import * as lifecycle from './lib/core/lifecycle.js';
import { diagnose } from './lib/core/diagnose.js';
import * as migrate from './lib/core/migrate.js';

/** 行级配置（cordis.patch.yml 的 config 块；用户 patch 层升级存活）。 */
export const Config = z.object({
  gitignoreLine: z.boolean().default(true),
  residentLinkToCrossHarness: z.boolean().default(false),
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

  // Remote 命名空间 = 操作唯一实现（§14）；fetch 兜底通道共用同一清单。
  const REMOTE_METHODS = [
    'state', 'listSets', 'saveSet', 'deleteSet', 'renameSet', 'copySet', 'setResident', 'saveAsFromEffective', 'exportSet', 'importSets', 'bind', 'switchSet', 'undoSwitch', 'startOverride', 'endOverride', 'libraryList',
    // P1a：技能生命周期 + 诊断 + 解绑
    'installApply', 'updateCheck', 'updateApply', 'uninstallSkill', 'backupsList', 'backupRestore',
    'diagnoseRun', 'reclaimDeadLinks', 'rebuildManaged', 'migratePreview', 'migrateApply', 'migrateUndo', 'unbind',
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
      // uninstall/deleteSet 的候选推导自此不再漏项目。幂等一次 put，成本可忽略。
      if (loc.projectRoot) { try { await store.put('bindings', projectKey(loc.projectRoot), { projectRoot: loc.projectRoot }); } catch {} }
      return {
        ...loc,
        sessionId: req?.sessionId ?? null,
        binding,
        set,
        sets: sets.listSets(roots),
        library: (await this.libraryList()).library,
        effective: eff,
        resident: sets.loadResident(roots).skills,
        selfCheck: { ok: sc.ok, frozen: sc.frozen, unbound: sc.unbound, missing: sc.missing, extra: sc.extra, foreign: sc.foreign, brokenLinks: sc.brokenLinks, detail: sc.detail },
        managed: managed?.entries ?? {},
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
      const names = req.names ?? sets.effectiveNames(roots, binding?.setSlug).names;
      return sets.saveAsSet(roots, { name: req.name, names });
    }

    async exportSet(req) {
      return sets.exportSet(roots, req.slug);
    }

    async importSets(req) {
      return sets.importSets(roots, req.payload);
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
      const snap = await startOverride(store, roots, loc.projectRoot, { add: req.add ?? [], remove: req.remove ?? [] });
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
        library.push({
          name: n,
          source: mf?.source ?? 'unknown',
          commit: mf?.commit ?? null,
          hasSkillMd: fs.existsSync(path.join(dir, 'SKILL.md')),
          managed: !!mf,
          localModified,
          backupCount: bk.listBackups(roots, n).length,
        });
      }
      return { library };
    }

    // ---- P1a：GitHub 安装 / 升级 / 卸载 / 回收站（全部薄包装 core，同一实现） ----

    /** manifest.source = github:owner/repo[/subpath] → 稀疏拉取（tmp 目录批量回收；url 覆盖同 installApply）。 */
    _fetchFor(tmpDirs, urlOverride = null) {
      return async (source) => {
        const segs = String(source).replace(/^github:/, '').split('/').filter(Boolean);
        if (segs.length < 2) throw new Error(`无法解析来源: ${source}`);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssm-up-'));
        tmpDirs.push(tmpDir);
        return fetchRepo({ owner: segs[0], repo: segs[1], ref: null, subpath: segs.length > 2 ? segs.slice(2).join('/') : null }, { tmpDir, ...(urlOverride ? { url: urlOverride } : {}) });
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
