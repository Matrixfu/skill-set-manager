/**
 * skill-set-manager client 半：单一入口（composer 工具行左缘；§12 的侧边栏入口经用户决定移除，
 * 会话绑定/状态预拉本就在 composer 半）打开同一个 shell.overlay 面板；
 * 操作一律经 host 半（Remote 面优先、同源 fetch 兜底）——无第二实现（#15）。
 * 正常切换不设模态（§6.5），仅「项目根 ≠ 会话目录」时经 overlay 确认；撤销入口在面板内。
 */
window.__ModuleLoader__.load({
  id: '@matrixfu/skill-set-manager',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const PKG = '@matrixfu/skill-set-manager';

    const DICTS = {
      zh: {
        chip: '技能集', panel: '技能集管理器', close: '关闭', sets: '技能集', projectRoot: '项目根',
        rootDrift: '（≠ 会话目录——切换影响该仓库全部会话）', resident: '全局常驻（不受管控）',
        managedSec: '技能集提供（受管）', override: '临时覆盖', overrideOn: '临时覆盖中', endOverride: '结束覆盖',
        ovRemoved: '已被剔除', ovRestoreTip: '重新勾选即恢复本会话生效', overrideHint: '临时覆盖中：在「受管」区取消勾选 = 仅本会话剔除（不改技能集）；重新勾选或「结束覆盖」即恢复；要从集合里永久移除请用集合区「编辑成员」',
        undo: '撤销切换（回到上一份生效清单）', switchTo: '切换', current: '当前', saveAs: '另存为当前清单',
        newName: '新名称', copy: '复制', rename: '改名', del: '删除', confirmDel: '确认删除该技能集？受影响项目将冻结绑定',
        confirmSwitch: '确认切换：将改写仓库根的 .dsh/skills/（仅托管条目）', exportJson: '导出', importJson: '导入',
        regen: '重新生成', claimForeign: '接管失配条目', claimForeignHint: '把「名字在本集里、盘上已存在、且确实指向库/生效区」的链接补回托管台账（只补台账，不动盘上条目）', pruneMissing: '从集合移除缺失成员', draftHint: '未绑定：勾选即本会话临时生效（会话结束自动撤下）；要固化就在上方输入集合名 → 「另存为当前清单」创建并绑定本项目（常驻全局技能不在候选中）', noBinding: '未绑定技能集', skillsCount: '个技能', loadFailed: '加载失败',
        opFailed: '操作失败', empty: '（暂无技能集）', hintP2: '技能变化下一轮请求生效；/ 命令列表属 P2，新会话前不同步',
        copyClip: '复制到剪贴板', copied: '已复制 ✓', copyFail: '复制失败',
        noSession: '先在对话页打开一个会话',
        settingsLabel: '技能集管理器', tabLibrary: '库', tabOps: '安装与更新', tabDiag: '诊断',
        filterPh: '按名称/来源过滤', managedTag: '受管', unmanagedTag: '未登记', modifiedTag: '本地改动',
        backupsTitle: '回收站', restoreGo: '恢复', checkUp: '检查更新', applyUp: '应用更新', checkingUp: '检查更新中…', applyingUp: '应用更新中…',
        upToDate: '已是最新', upActions: '差异', skipNote: '本地改动的文件已跳过', noContentDiff: '内容已一致', claimNoCommit: '来源为认领，未记 commit',
        uninstallGo: '卸载', confirmUn: '确认卸载？（先备份→从所有集移除→各项目回收托管条目）',
        installTitle: '从 GitHub 安装', installSpecPh: '仓库规格 owner/repo[@ref][/subpath]', installGo: '安装', overwriteChk: '覆盖同名（先备份）',
        migrateTitle: '旧通用区迁移（~/.dsh/skills，一次性）', migratePreview: '预览迁移', migrateApply: '执行迁移', migrateUndo: '回滚迁移',
        migrateMoves: '将移动', migrateKeep: '保留不搬',
        migrateReasonExists: '库同名', migrateReasonLink: '外部链接', migrateReasonManifest: '他人记账', migrateReasonResident: '已是常驻链接',
        migrateAgentsTitle: '跨 harness 通用区迁移（~/.agents/skills，一次性）', migrateAgentsGo: '预览并迁移',
        migrateAgentsHint: '把与其他 harness 共用的通用区技能移入技能库；只移无 manifest 的纯目录，其他工具的条目与同名保留不动，可一键回滚。',
        diagRun: '运行诊断', fixReclaim: '回收失效链接', fixRebuild: '按当前集重建',
        diagPartition: '分区说明', diagCopies: '副本漂移', diagDangling: '悬空引用',
        diagDeadLinks: '失效链接', diagStructure: '结构问题', diagEnv: '环境',
        none: '（无）', opDone: '完成', backupAt: '备份位置', moreFiles: '…（其余略）',
        unbindGo: '解绑', confirmUnbind: '确认解绑？托管条目将被回收，用户自有条目不动',
        foreignLine: '外来条目（不接管、切换不覆盖）',
        settingsHint: '安装/升级/卸载/回收站/诊断在「设置 → 技能集管理器」',
        searchPh: '按名称/用途搜索技能…', hitCount: '命中', pendingTag: '待翻译',
        residentRow: '全局常驻 · 已在所有项目生效', foreignRow: '外来常驻 · 其他工具放入 ~/.agents/skills',
        providerSec: '插件/Preset 提供', providerHint: '插件或 agent preset 注入，不受技能集管控：切换技能集不移除；停用对应插件即消失', providerRow: '插件/Preset 提供 · 不受技能集管控', providerRowGo: '在「设置 → 插件」停用来源插件',
        goSettings: '去设置 → 技能集管理器管理 ›', unboundHint: '本项目未绑定技能集：勾选即本会话临时生效（会话结束自动撤下）；要固化请用「另存为当前清单」创建并绑定技能集', // 设计 2026-10-28：未绑定也可起盘临时覆盖（host 台账 setSlug:null），旧 N6「未绑定不可覆盖」口径已废
        tabGlobal: '全局技能集', globalTabHint: '常驻技能在所有项目生效；链接落在下行所示目录（跨 harness 共享，其他工具可见）。外来常驻条目只读。',
        residentOnly: '只看常驻', batchTranslate: '批量翻译', translateGo: '翻译', translateDone: '翻译结果', failedRetryable: '条此前失败 · 点击一并重试',
        translateProgress: '翻译中', translateStop: '停止', translateStopping: '停止中（等在途条目收尾）',
        modelSelect: '翻译模型（默认 = 当前会话模型）', currentModel: '当前模型（默认）',
        autoTranslateHint: '自动翻译默认关（零出网）；关闭时用手动批量按钮。中文写缓存、不改技能原文。',
        tabTitle: '技能集详情', tabDesc: '完整生效清单、状态分区与诊断摘要', openRight: '在右栏打开技能集详情',
        rpEffective: '生效清单', rpSelf: '状态自检', rpDiag: '诊断摘要',
        rpFrozen: '技能集已删除（冻结：清单原样保留）', rpClick: '点击查看 SKILL.md', rpNoSession: '（右栏 tab 未绑定会话）',
        rpForeign: '外来', rpMissing: '缺失', rpDead: '失效',
        rpEmpty: '（无生效技能）', rpDiagFail: '诊断加载失败',
        rpGlobalActiveUnbound: '未绑定技能集：全局常驻技能已生效（{n} 项，不逐条列出）', rpGlobalActiveHint: '全局常驻技能已生效（{n} 项，不逐条列出）',
        importPreviewBtn: '预览导入', importApply: '应用导入', importConflict: '显示名已存在（该项跳过）',
        importAllPresent: '技能齐备', importMissing: '本机缺失', importNoPin: '无来源 pin，装不了',
        importChoiceInstall: '按 pin 安装', importChoicePlaceholder: '先占位', importChoiceIgnore: '忽略',
        importDefaultHint: '每个缺失技能选一项；不选 = 忽略（插件不自动联网安装）', importApplied: '导入完成',
        claimGo: '认领来源', claimEdit: '改认领', claimSourcePh: '来源 owner/repo[/subpath]', claimCommitPh: 'commit（可空）',
        claimUndo: '撤认领', claimHint: '认领 = 以当前盘上内容为基线写 manifest（此后本地改动可被升级识别并跳过）',
        editMembers: '成员', editTitle: '编辑成员', saveBtn: '保存',
        memberHint: '勾选 = 该集包含，保存即写回；当前绑定集会立即重新生成生效清单（会话临时覆盖保留）；全局常驻技能所有集自动包含，故不进候选（用户 2026-10-26）', memberMissing: '不在库', memberResidentTag: '已是全局常驻·自动包含',
      },
      en: {
        chip: 'Skill sets', panel: 'Skill Set Manager', close: 'Close', sets: 'Skill sets', projectRoot: 'Project root',
        rootDrift: '(≠ session dir — switching affects every session in this repo)', resident: 'Global resident (unmanaged)',
        managedSec: 'Set-provided (managed)', override: 'Session override', overrideOn: 'Override active', endOverride: 'End override',
        ovRemoved: 'removed by override', ovRestoreTip: 'Tick again to restore for this session', overrideHint: 'Override active: unticking in the managed area removes it for this session only (the set is unchanged); tick again or "End override" to restore; to remove from the set permanently use "Edit members" in the sets area',
        undo: 'Undo switch (restore previous effective set)', switchTo: 'Switch', current: 'current', saveAs: 'Save current as set',
        newName: 'New name', copy: 'Copy', rename: 'Rename', del: 'Delete', confirmDel: 'Delete this set? Affected projects freeze their binding.',
        confirmSwitch: 'Confirm switch: rewrites .dsh/skills/ at the repo root (managed entries only)', exportJson: 'Export', importJson: 'Import',
        regen: 'Regenerate', claimForeign: 'Claim mismatched entries', claimForeignHint: 'Re-register links that are named in this set, already on disk and really pointing at the library/active zones back into the managed ledger (ledger only, disk entries untouched)', pruneMissing: 'Remove missing members', draftHint: 'No set bound: ticking a skill activates it for this session only (auto-removed when the session ends); to keep it, name the set above, then "Save current as set" creates it and binds this project (global resident skills are not candidates)', noBinding: 'No skill set bound', skillsCount: 'skills', loadFailed: 'Load failed',
        opFailed: 'Operation failed', empty: '(no skill sets yet)', hintP2: 'Skill changes take effect on the next request; / commands are P2 (new sessions only)',
        copyClip: 'Copy to clipboard', copied: 'Copied ✓', copyFail: 'Copy failed',
        noSession: 'Open a conversation session first',
        settingsLabel: 'Skill Sets', tabLibrary: 'Library', tabOps: 'Install & update', tabDiag: 'Diagnose',
        filterPh: 'Filter by name/source', managedTag: 'managed', unmanagedTag: 'untracked', modifiedTag: 'locally modified',
        backupsTitle: 'Trash', restoreGo: 'Restore', checkUp: 'Check update', applyUp: 'Apply update', checkingUp: 'Checking…', applyingUp: 'Applying…',
        upToDate: 'Up to date', upActions: 'Diff', skipNote: 'locally modified files skipped', noContentDiff: 'contents already match', claimNoCommit: 'source claimed without a recorded commit',
        uninstallGo: 'Uninstall', confirmUn: 'Uninstall? (backup → remove from all sets → reclaim managed entries per project)',
        installTitle: 'Install from GitHub', installSpecPh: 'repo spec owner/repo[@ref][/subpath]', installGo: 'Install', overwriteChk: 'overwrite same name (backup first)',
        migrateTitle: 'Migrate legacy shared area (~/.dsh/skills, one-time)', migratePreview: 'Preview', migrateApply: 'Apply', migrateUndo: 'Undo migration',
        migrateMoves: 'Will move', migrateKeep: 'Kept',
        migrateReasonExists: 'name clash', migrateReasonLink: 'external link', migrateReasonManifest: 'other tool', migrateReasonResident: 'already resident',
        migrateAgentsTitle: 'Migrate cross-harness skills (~/.agents/skills, one-time)', migrateAgentsGo: 'Preview & migrate',
        migrateAgentsHint: 'Move skills from the shared cross-harness dir into the library; only plain dirs without a manifest move — other tools’ entries and same-name collisions stay put, undoable.',
        diagRun: 'Run diagnose', fixReclaim: 'Reclaim dead links', fixRebuild: 'Rebuild from set',
        diagPartition: 'Partition', diagCopies: 'Copy drift', diagDangling: 'Dangling refs',
        diagDeadLinks: 'Dead links', diagStructure: 'Structure', diagEnv: 'Environment',
        none: '(none)', opDone: 'Done', backupAt: 'Backup at', moreFiles: '… (rest omitted)',
        unbindGo: 'Unbind', confirmUnbind: 'Unbind? Managed entries are reclaimed; your own entries stay.',
        foreignLine: 'Foreign entries (untouched by switching)',
        settingsHint: 'Install/update/uninstall/trash/diagnose live in Settings → Skill Sets',
        searchPh: 'Search skills by name or purpose…', hitCount: 'matches', pendingTag: 'untranslated',
        residentRow: 'Global resident · active in every project', foreignRow: 'Foreign resident · from ~/.agents/skills',
        providerSec: 'Plugin / preset-provided', providerHint: 'Injected by a plugin or agent preset, outside skill-set control: switching sets will not remove them; disable the plugin to hide', providerRow: 'Plugin / preset-provided · not skill-set managed', providerRowGo: 'disable the source plugin in Settings → Plugins',
        goSettings: 'manage in Settings → Skill Sets ›', unboundHint: 'No skill set bound: ticking a skill in Session override activates it for this session only (auto-removed when the session ends); to keep it, use "Save current as set" to create a set and bind this project',
        tabGlobal: 'Global Skills', globalTabHint: 'Resident skills apply to every project; links live in the dir shown below (shared across harnesses). Foreign residents are read-only.',
        residentOnly: 'Resident only', batchTranslate: 'Batch translate', translateGo: 'Translate', translateDone: 'Translation result', failedRetryable: 'previously failed · click to retry all',
        translateProgress: 'Translating', translateStop: 'Stop', translateStopping: 'stopping (waiting for in-flight items)',
        modelSelect: 'Translate model (default = current model)', currentModel: 'Current model (default)',
        autoTranslateHint: 'Auto-translate is off by default (no outbound traffic); use the batch button any time. Translations are cached; originals untouched.',
        tabTitle: 'Skill set detail', tabDesc: 'Full effective list, status partition and diagnose summary', openRight: 'Open skill set detail in right sidebar',
        rpEffective: 'Effective list', rpSelf: 'Self-check', rpDiag: 'Diagnose summary',
        rpFrozen: 'Set deleted (frozen: list kept as-is)', rpClick: 'Click to open SKILL.md', rpNoSession: '(right tab has no bound session)',
        rpForeign: 'foreign', rpMissing: 'missing', rpDead: 'dead',
        rpEmpty: '(no effective skills)', rpDiagFail: 'diagnose failed',
        rpGlobalActiveUnbound: 'No skill set bound: global resident skills are active ({n} items, not listed one by one)', rpGlobalActiveHint: 'Global resident skills are active ({n} items, not listed one by one)',
        importPreviewBtn: 'Preview import', importApply: 'Apply import', importConflict: 'name exists (this item is skipped)',
        importAllPresent: 'all skills present', importMissing: 'missing locally', importNoPin: 'no source pin — cannot install',
        importChoiceInstall: 'Install by pin', importChoicePlaceholder: 'Placeholder', importChoiceIgnore: 'Ignore',
        importDefaultHint: 'Pick one per missing skill; unpicked = ignore (no automatic network install)', importApplied: 'Import done',
        claimGo: 'Claim source', claimEdit: 'Re-claim', claimSourcePh: 'source owner/repo[/subpath]', claimCommitPh: 'commit (optional)',
        claimUndo: 'Unclaim', claimHint: 'Claiming writes a manifest with the current files as baseline (later local edits are then detected and skipped on update)',
        editMembers: 'Members', editTitle: 'Edit members', saveBtn: 'Save',
        memberHint: 'Checked = in this set; Save writes it back. The bound set rebuilds its effective list immediately (session overrides stay). Global resident skills are auto-included in every set, so they are not offered as candidates', memberMissing: 'not in library', memberResidentTag: 'already global resident · auto-included',
      },
    };

    /** 入口与 overlay 面板共享的模块级总线（overlay 是 root scope，拿不到 sessionId prop）。 */
    const bus = {
      open: false, sessionId: null, state: null, subs: new Set(), token: 0,
      setOpen(v) { this.open = v; this.subs.forEach((f) => f()); },
      setSession(id) { if (id && id !== this.sessionId) { this.sessionId = id; this.subs.forEach((f) => f()); } },
      clearSessionIf(id) { if (id && this.sessionId === id) { this.sessionId = null; this.subs.forEach((f) => f()); } },
      setState(s) { this.state = s; this.subs.forEach((f) => f()); },
      // 右栏详情刷新信号（用户报告 2026-10-27）：v0.25 起 betterSidebar 的原生 tab 体常驻挂载，
      // 已打开的 tab 再点 ⇥ 既不重挂载、visible 也不翻转 → 组件自带的 visible/load 效应永不触发，
      // 右栏停在旧集快照。onOpen/onActivate 与面板 run() 统一广播本信号；只广播当前会话防串台。
      refresh(id) { if (id && id === this.sessionId) { this.token += 1; this.subs.forEach((f) => f()); } },
    };
    function useBus() {
      const [, bump] = React.useState(0);
      React.useEffect(() => {
        const fn = () => bump((v) => v + 1);
        bus.subs.add(fn);
        return () => bus.subs.delete(fn);
      }, []);
      return bus;
    }

    /** Remote 面优先（RemoteResult 归一化）；任何失败退同源 fetch（同一 host 实现）。 */
    async function call(ctx, method, args) {
      const face = ctx.get('remote')?.['skill-set-manager'];
      let faceErr = null;
      if (face && typeof face[method] === 'function') {
        let r;
        try { r = await face[method](args ?? {}); } catch (e) { faceErr = e; }
        if (r !== undefined) {
          if (r && typeof r === 'object' && ('value' in r || 'error' in r)) {
            // 业务错误：直接上报，不走 fetch 重试（副作用操作避免跑两遍）
            if (r.error) throw new Error(typeof r.error === 'string' ? r.error : r.error?.message ?? JSON.stringify(r.error));
            return r.value;
          }
          return r;
        }
      }
      try {
        const res = await fetch('/api/skill-set-manager', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ method, args: args ?? {} }), credentials: 'same-origin',
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j.error) throw new Error(j.error || `HTTP ${res.status}`);
        return j.value;
      } catch (e2) {
        if (faceErr && !(ctx.get('remote')?.['skill-set-manager'])) throw faceErr;
        throw e2;
      }
    }

    /**
     * 搜索匹配器——权威实现 = lib/core/search.js（verify CASES search-core 钉死口径）。
     * client bundle 是 __ModuleLoader__ factory，require 解析不了相对路径（预裁定），内联同款；改口径须两处同步。
     */
    function normalizeQuery(s) {
      if (typeof s !== 'string') return '';
      return s.toLowerCase().replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g, ' ');
    }
    function searchRows(rows, query, fields = ['name', 'source', 'description', 'descriptionZh']) {
      const list = Array.isArray(rows) ? rows : [];
      const tokens = normalizeQuery(query).split(/\s+/).filter(Boolean);
      if (!tokens.length) return list.slice();
      const scored = [];
      for (const row of list) {
        const vals = fields.map((f) => normalizeQuery(row?.[f]));
        if (!tokens.every((tk) => vals.some((v) => v.includes(tk)))) continue;
        const name = vals[0];
        const rank = tokens.every((tk) => name.startsWith(tk)) ? 0 : tokens.every((tk) => name.includes(tk)) ? 1 : 2;
        scored.push({ row, rank });
      }
      scored.sort((a, b) => a.rank - b.rank || String(a.row?.name ?? '').localeCompare(String(b.row?.name ?? '')));
      return scored.map((x) => x.row);
    }

    function Panel({ ctx, t, sessionId, onClose, bs }) {
      const [state, setState] = React.useState(null);
      const [error, setError] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [confirm, setConfirm] = React.useState(null); // {kind:'switch'|'del', slug}
      const [draft, setDraft] = React.useState('');
      const [renaming, setRenaming] = React.useState(null); // slug | null（面板内改名，Electron 无 window.prompt）
      const [renameDraft, setRenameDraft] = React.useState('');
      const [io, setIo] = React.useState(null); // {mode:'export'|'import', text, copied?}
      const [confirmUnbind, setConfirmUnbind] = React.useState(false);
      const [edit, setEdit] = React.useState(null); // {slug, picked:{name:true}}——编辑成员表单（§5#2）
      const [q, setQ] = React.useState(''); // P3 搜索框（设计 §6.3）：非空 → 结果列表替换三区
      const [mq, setMq] = React.useState(''); // P3 成员编辑表单过滤（§6.2；勾选态 picked 按名字存，过滤不丢）
      const reload = React.useCallback(async () => {
        if (!sessionId) return;
        try { const v = await call(ctx, 'state', { sessionId }); setState(v); bus.setState(v); } catch (e) { setError(`${t('loadFailed')}: ${e?.message ?? e}`); }
      }, [ctx, sessionId]);
      React.useEffect(() => { reload(); }, [reload]);
      React.useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [onClose]);
      const run = async (fn) => {
        setBusy(true); setError(null);
        try {
          const r = await fn();
          // 返回的 warnings 必须可见：台账失配态下「重新生成」盘上什么都不做，理由只存在于 warnings，
          // 丢弃就等于「点了没反应」（活体复盘 2026-10-27，另一作用域 line run(key,fn) 早已这么做）。
          const w = r && Array.isArray(r.warnings) && r.warnings.length ? r.warnings : null;
          if (w) setError(`${t('opDone')} ⚠ ${w.join('; ')}`);
        } catch (e) { setError(`${t('opFailed')}: ${e?.message ?? e}`); }
        finally { setBusy(false); setConfirm(null); await reload(); bus.refresh(sessionId); } // 面板切集/重生成后右栏详情同步刷新（用户 2026-10-27）
      };
      const st = state ?? {};
      // 「已在项目」口径 = JSON 生效清单 ∪ 托管台账：临时覆盖加的技能只进台账、不进 state.effective
      // 的 JSON 口径，加完必须即从候选区撤回（受管区即显示为选中勾选），否则复选框永远显未勾（用户报）。
      const eff = new Set([...(st.effective?.names ?? []), ...Object.keys(st.managed ?? {})]);
      const resident = new Set(st.resident ?? []);
      const managed = Object.keys(st.managed ?? {}); // 一套勾选（设计 2026-10-28）：已绑定=集提供的条目；未绑定=本会话临时生效的条目
      // P3 搜索结果（设计 §6.3/§6.4）：语料 = 库行 ∪ 常驻名单 ∪ 盘上外来常驻（灰行判定 = 名单 ∪ 实扫）
      const foreignRes = new Set(st.residentForeign ?? []);
      const bound = !!st.binding?.setSlug;
      const qq = q.trim();
      const corpus = [...(st.library ?? [])];
      for (const n of new Set([...(st.resident ?? []), ...foreignRes])) if (!corpus.some((l) => l.name === n)) corpus.push({ name: n, source: 'resident', description: null, descriptionZh: null });
      // 插件/Preset 提供也入搜索语料（灰行只读）：搜 archify / office-docx 不再「查无此技能」
      const providerSet = new Set((st.unmanaged ?? []).map((e) => e.name));
      for (const e of st.unmanaged ?? []) if (!corpus.some((l) => l.name === e.name)) corpus.push({ name: e.name, source: e.provider, provider: true, description: null, descriptionZh: null });
      const hits = qq ? searchRows(corpus, qq) : [];
      const doSwitch = (slug) => {
        if (st.rootDrift) { setConfirm({ kind: 'switch', slug }); return; } // 仅根漂移需确认（§6.5）
        run(() => call(ctx, 'switchSet', { sessionId, slug }));
      };
      const sc = st.selfCheck ?? {};
      // 库行徽标（T8 Step2 / review m6）：来源与本地改动提示
      const LibBadges = ({ lib }) => h(React.Fragment, null,
        lib.source && lib.source !== 'unknown' ? h('span', { className: 'ssm-n' }, ` ${String(lib.source).replace('github:', '').slice(0, 20)}`) : null,
        lib.localModified ? h('span', { className: 'ssm-warn-inline' }, ` ${t('modifiedTag')}`) : null);
      return h('div', { className: 'ssm-panel', role: 'dialog', 'aria-label': t('panel'), onClick: (e) => e.stopPropagation() },
        h('div', { className: 'ssm-head' },
          h('b', null, t('panel')),
          st.binding?.setSlug ? h('span', { className: 'ssm-cur' }, st.set?.name ?? st.binding.setSlug) : h('span', { className: 'ssm-cur' }, t('noBinding')),
          h('span', { className: 'ssm-grow' }, null),
          bs || ctx.get('betterSidebar') ? h('button', { className: 'ssm-x', title: t('openRight'), onClick: () => (bs ?? ctx.get('betterSidebar'))?.openTab({ type: 'skill-set-manager:detail', title: t('tabTitle') }, { sessionId }) }, '⇥') : null,
          h('button', { className: 'ssm-x', onClick: onClose, 'aria-label': t('close') }, '×')),
        st.projectRoot ? h('div', { className: 'ssm-root' }, t('projectRoot'), '：', st.projectRoot, st.rootDrift ? h('span', { className: 'ssm-warn-inline' }, t('rootDrift')) : null) : null,
        st.presetWarn ? h('div', { className: 'ssm-warn' }, st.presetWarn) : null,
        sc.ok === false && !sc.unbound
          ? h('div', { className: sc.frozen ? 'ssm-warn' : 'ssm-err' }, sc.detail, ' ',
              sc.frozen ? null : h('button', { disabled: busy, onClick: () => run(() => call(ctx, 'bind', { sessionId, slug: st.binding?.setSlug })) }, t('regen')),
              // 接管（认领）：台账与盘上失配时 regen 只会空转（planEffective 一律判外来而跳过），
              // 唯一恢复通道是把自家链接补回台账——只在确实有外来条目时出现（活体实锤 2026-10-27）
              (sc.foreign ?? []).length && !sc.frozen
                ? h('button', { disabled: busy, title: t('claimForeignHint'), onClick: () => run(() => call(ctx, 'claimForeign', { sessionId })) }, t('claimForeign'))
                : null,
              // 幽灵名快捷修复（用户报告 2026-10-26：speckit-* 实体被外部删除，regen 无源可重建，唯一出路是从集合剔除）
              st.set && (st.effective?.missing ?? []).length
                ? h('button', { disabled: busy, className: 'ssm-danger', onClick: () => run(async () => {
                    const miss = new Set(st.effective.missing);
                    await call(ctx, 'saveSet', { set: { ...st.set, skills: (st.set.skills ?? []).filter((n) => !miss.has(n)) } }); // 刷新由 run() 的 finally reload() 负责；Panel 作用域里没有 load（误写会 ReferenceError）
                  }) }, t('pruneMissing'))
                : null)
          : null,
        error ? h('div', { className: 'ssm-err' }, error) : null,
        confirm?.kind === 'switch'
          ? h('div', { className: 'ssm-confirm' }, t('confirmSwitch'), ' ', st.projectRoot, ' ',
              h('button', { autoFocus: true, disabled: busy, onClick: () => run(() => call(ctx, 'switchSet', { sessionId, slug: confirm.slug })) }, t('switchTo')),
              h('button', { onClick: () => setConfirm(null) }, '×'))
          : null,
        confirm?.kind === 'del'
          ? h('div', { className: 'ssm-confirm' }, t('confirmDel'), ' ', confirm.slug, ' ',
              h('button', { autoFocus: true, disabled: busy, className: 'ssm-danger', onClick: () => run(() => call(ctx, 'deleteSet', { slug: confirm.slug })) }, t('del')),
              h('button', { onClick: () => setConfirm(null) }, '×'))
          : null,
        h('div', { className: 'ssm-sec' }, t('sets')),
        (st.sets ?? []).length === 0 ? h('div', { className: 'ssm-empty' }, t('empty')) : null,
        ...(st.sets ?? []).map((s) => h(React.Fragment, { key: s.slug },
          h('div', { className: 'ssm-row' + (st.binding?.setSlug === s.slug ? ' ssm-on' : '') },
            h('button', { className: 'ssm-pick', disabled: busy || st.binding?.setSlug === s.slug, onClick: () => doSwitch(s.slug) },
              h('span', null, s.name), h('span', { className: 'ssm-n' }, `${(s.skills ?? []).length} ${t('skillsCount')}`),
              st.binding?.setSlug === s.slug ? h('span', { className: 'ssm-cur-tag' }, t('current')) : null),
            h('span', { className: 'ssm-grow' }, null),
            h('button', { disabled: busy, onClick: () => setEdit({ slug: s.slug, picked: Object.fromEntries((s.skills ?? []).map((n) => [n, true])) }) }, t('editMembers')),
            h('button', { disabled: busy, onClick: () => run(() => call(ctx, 'copySet', { slug: s.slug })) }, t('copy')),
            h('button', { disabled: busy, onClick: () => { setRenaming(s.slug); setRenameDraft(s.name); } }, t('rename')),
            h('button', { disabled: busy, onClick: async () => { try { const j = await call(ctx, 'exportSet', { slug: s.slug }); setIo({ mode: 'export', text: JSON.stringify(j, null, 2), copied: false }); } catch (e) { setError(`${t('opFailed')}: ${e?.message ?? e}`); } } }, t('exportJson')),
            h('button', { disabled: busy, className: 'ssm-danger', onClick: () => setConfirm({ kind: 'del', slug: s.slug }) }, t('del'))),
          renaming === s.slug
            ? h('div', { className: 'ssm-row' },
                h('input', { className: 'ssm-input', autoFocus: true, value: renameDraft, disabled: busy, onChange: (e) => setRenameDraft(e.target.value) }),
                h('button', { disabled: busy || !renameDraft.trim() || renameDraft.trim() === s.name, onClick: () => run(() => call(ctx, 'renameSet', { slug: s.slug, name: renameDraft.trim() })).then(() => setRenaming(null)) }, '✓'),
                h('button', { disabled: busy, onClick: () => setRenaming(null) }, '×'))
            : null,
          // 编辑成员表单（§5#2「从技能库勾选技能加入技能集」）：saveSet 写回；当前绑定集随即 bind 收敛
          // ——该路径由 verify case edit-members 固化（摘旧加新、台账无残留、自检绿）。
          edit?.slug === s.slug
            ? h('div', { className: 'ssm-io' },
                h('div', { className: 'ssm-sec' }, t('editTitle'), ' ', s.name),
                h('div', { className: 'ssm-row' },
                  h('input', { className: 'ssm-input', placeholder: t('searchPh'), value: mq, disabled: busy, 'aria-label': t('searchPh'), onChange: (e) => setMq(e.target.value) }),
                  mq ? h('button', { disabled: busy, onClick: () => setMq('') }, '×') : null),
                h('div', { className: 'ssm-chips' },
                  ...searchRows(
                    // 常驻 = 所有集自动包含（§17#3）→ 不进成员候选（用户报告 2026-10-26，与另存为 excludeResident 同口径）；
                    // 已存进本集的常驻名仍列出并标注，避免保存时被静默剔除
                    [...new Set([...(st.library ?? []).map((l) => l.name), ...(s.skills ?? [])])]
                      .filter((n) => !(resident.has(n) || foreignRes.has(n)) || (s.skills ?? []).includes(n))
                      .sort()
                      .map((n) => {
                        const l = (st.library ?? []).find((x) => x.name === n); // 语料带三字段 → 中文用途也能搜（§6.2）
                        return { name: n, source: l?.source ?? '', description: l?.description ?? null, descriptionZh: l?.descriptionZh ?? null };
                      }),
                    mq,
                  ).map((row) => {
                    const n = row.name;
                    return h('label', { key: n, className: 'ssm-chip' + (edit.picked[n] ? ' ssm-on' : ''), title: row.descriptionZh ?? undefined },
                      h('input', { type: 'checkbox', checked: !!edit.picked[n], disabled: busy, onChange: () => setEdit({ ...edit, picked: { ...edit.picked, [n]: !edit.picked[n] } }) }), ' ', n,
                      (st.library ?? []).some((l) => l.name === n) ? null : h('span', { className: 'ssm-warn-inline' }, ` ${t('memberMissing')}`),
                      (resident.has(n) || foreignRes.has(n)) ? h('span', { className: 'ssm-n' }, ` ${t('memberResidentTag')}`) : null);
                  })),
                h('div', { className: 'ssm-hint' }, t('memberHint')),
                h('div', { className: 'ssm-row' },
                  h('button', { disabled: busy, onClick: () => run(async () => {
                    await call(ctx, 'saveSet', { set: { slug: s.slug, name: s.name, description: s.description ?? '', skills: Object.keys(edit.picked).filter((n) => edit.picked[n]) } });
                    if (st.binding?.setSlug === s.slug) await call(ctx, 'bind', { sessionId, slug: s.slug }); // 立即收敛生效清单，不留「改了但没生效」窗口
                    setEdit(null);
                  }) }, t('saveBtn')),
                  h('button', { disabled: busy, onClick: () => setEdit(null) }, '×')))
            : null)),
        h('div', { className: 'ssm-row' },
          h('input', { className: 'ssm-input', placeholder: t('newName'), value: draft, onChange: (e) => setDraft(e.target.value) }),
          h('button', { disabled: busy || !draft.trim() || (!bound && !managed.length), title: !bound && !managed.length ? t('draftHint') : undefined, onClick: () => run(async () => {
            const name = draft.trim();
            // 未绑定走当前临时清单（候选已剔常驻）；已绑定隐式 = 生效清单，host 端剔常驻（save-as-resident CASE）
            const s = await call(ctx, 'saveAsFromEffective', { sessionId, name, ...(bound ? {} : { names: [...managed] }) });
            if (!bound && s?.slug) await call(ctx, 'bind', { sessionId, slug: s.slug }); // 存集即生效：bind 先丢临时覆盖（dropOverrideOnBind），本项目只出现所选技能
            setDraft(''); // 新建集已落盘；刷新同上走 reload()（用户报告：保存成功却弹「操作失败: load is not defined」）
          }) }, t('saveAs')),
          h('button', { disabled: busy, onClick: () => setIo({ mode: 'import', text: '{"sets":[]}', copied: false }) }, t('importJson'))),
        io
          ? h('div', { className: 'ssm-io' },
              h('textarea', {
                className: 'ssm-textarea', rows: 8, spellCheck: false,
                readOnly: io.mode === 'export' || !!io.preview, value: io.text, disabled: busy,
                onChange: (e) => setIo({ ...io, text: e.target.value, copied: false, preview: null }),
              }),
              // 导入第二步（§5.6）：预览只读结果 → 每个缺失技能三选一「按 pin 安装 / 先占位 / 忽略」
              io.mode === 'import' && io.preview
                ? h('div', { className: 'ssm-io' },
                    ...(io.preview.errors ?? []).map((er, i) => h('div', { key: 'e' + i, className: 'ssm-warn' }, `⚠ ${er}`)),
                    ...(io.preview.items ?? []).map((it) => h('div', { key: it.name, className: 'ssm-row' },
                      h('span', null, it.name, h('span', { className: 'ssm-n' }, ` ${(it.skills ?? []).length} ${t('skillsCount')}`)),
                      it.conflict ? h('span', { className: 'ssm-warn-inline' }, ' ' + t('importConflict')) : null,
                      (it.missing ?? []).length
                        ? h('span', { className: 'ssm-n' }, ` ${t('importMissing')}：${(it.missing ?? []).map((m) => m.name).join('、')}`)
                        : h('span', { className: 'ssm-ok' }, ' ' + t('importAllPresent')))),
                    (io.preview.items ?? []).some((it) => (it.missing ?? []).length)
                      ? h('div', { className: 'ssm-hint' }, t('importDefaultHint')) : null,
                    ...(io.preview.items ?? []).flatMap((it) => (it.missing ?? []).map((m) => h('div', { key: `${it.slug}/${m.name}`, className: 'ssm-row' },
                      h('span', null, m.name, m.pin ? h('span', { className: 'ssm-n' }, ` ${String(m.pin.source).replace('github:', '')}${m.pin.commit ? ` @${String(m.pin.commit).slice(0, 7)}` : ''}`) : null),
                      h('span', { className: 'ssm-grow' }, null),
                      h('button', {
                        disabled: busy || !m.pin || io.choices[m.name] === 'install',
                        title: m.pin ? '' : t('importNoPin'),
                        onClick: () => setIo({ ...io, choices: { ...io.choices, [m.name]: 'install' } }),
                      }, (io.choices[m.name] === 'install' ? '✓ ' : '') + t('importChoiceInstall')),
                      h('button', {
                        disabled: busy || io.choices[m.name] === 'placeholder',
                        onClick: () => setIo({ ...io, choices: { ...io.choices, [m.name]: 'placeholder' } }),
                      }, (io.choices[m.name] === 'placeholder' ? '✓ ' : '') + t('importChoicePlaceholder')),
                      h('button', {
                        disabled: busy || io.choices[m.name] === 'ignore',
                        onClick: () => setIo({ ...io, choices: { ...io.choices, [m.name]: 'ignore' } }),
                      }, (io.choices[m.name] === 'ignore' ? '✓ ' : '') + t('importChoiceIgnore'))))))
                : null,
              // 导入结果回显（评审 I2）：四组计数 + 警告留在面板里，不静默关面板
              io.applied
                ? h('div', { className: 'ssm-io' },
                    h('div', { className: 'ssm-ok' },
                      `${t('importApplied')}：` + ([[io.applied.created?.length ?? 0, t('sets')], [io.applied.installed?.length ?? 0, t('importChoiceInstall')], [io.applied.placeholders?.length ?? 0, t('importChoicePlaceholder')], [io.applied.ignored?.length ?? 0, t('importChoiceIgnore')], [(io.applied.nameConflicts?.length ?? 0) + (io.applied.errors?.length ?? 0), t('importConflict')]].filter((p) => p[0]).map((p) => `${p[1]} ${p[0]}`).join(' · ') || t('none')),
                      (io.applied.created ?? []).length ? `（${io.applied.created.map((c) => c.slug).join('、')}）` : ''),
                    ...(io.applied.warnings ?? []).map((w, i) => h('div', { key: 'aw' + i, className: 'ssm-warn' }, `⚠ ${w}`)))
                : null,
              h('div', { className: 'ssm-row' },
                io.mode === 'export'
                  ? h('button', {
                      disabled: busy,
                      onClick: async () => {
                        try { await navigator.clipboard.writeText(io.text); setIo({ ...io, copied: true }); }
                        catch (e) { setError(`${t('copyFail')}: ${e?.message ?? e}`); }
                      },
                    }, t('copyClip'))
                  : io.preview
                    ? h('button', {
                        disabled: busy,
                        onClick: async () => {
                          setBusy(true); setError(null);
                          try { setIo({ ...io, applied: await call(ctx, 'importApply', { payload: io.payload, choices: io.choices }) }); } // 结果留在面板里回显（评审 I2）
                          catch (e) { setError(`${t('importApply')}: ${e?.message ?? e}`); }
                          finally { setBusy(false); await reload(); }
                        },
                      }, t('importApply'))
                    : h('button', {
                        disabled: busy || !io.text.trim(),
                        onClick: async () => {
                          let payload;
                          try { payload = JSON.parse(io.text); } catch (e) { setError(`${t('importJson')}: JSON ${e?.message ?? e}`); return; }
                          setBusy(true); setError(null);
                          try { setIo({ ...io, payload, preview: await call(ctx, 'importPreview', { payload }), choices: {} }); }
                          catch (e) { setError(`${t('importPreviewBtn')}: ${e?.message ?? e}`); }
                          finally { setBusy(false); } // 预览只读，无需 reload
                        },
                      }, t('importPreviewBtn')),
                io.mode === 'export' && io.copied ? h('span', { className: 'ssm-ok' }, t('copied')) : null,
                h('span', { className: 'ssm-grow' }, null),
                h('button', { disabled: busy, onClick: () => setIo(null) }, '×')))
          : null,
        st.binding?.setSlug ? (confirmUnbind
          ? h('div', { className: 'ssm-confirm' }, t('confirmUnbind'), ' ',
              h('button', { autoFocus: true, disabled: busy, className: 'ssm-danger', onClick: () => run(() => call(ctx, 'unbind', { sessionId })) }, t('unbindGo')),
              h('button', { onClick: () => setConfirmUnbind(false) }, '×'))
          : h('div', { className: 'ssm-row' }, h('button', { disabled: busy, className: 'ssm-danger', onClick: () => setConfirmUnbind(true) }, t('unbindGo'))))
          : null,
        (sc.foreign?.length ? h('div', { className: 'ssm-hint' }, t('foreignLine'), '：', (sc.foreign ?? []).join(', ')) : null),
        st.undoAvailable ? h('div', { className: 'ssm-row' }, h('button', { disabled: busy, onClick: () => run(() => call(ctx, 'undoSwitch', { sessionId })) }, t('undo'))) : null,
        // P3 搜索框（设计 §6.3）：技能集区之后、三区之前；非空 query → 结果列表替换三区
        h('div', { className: 'ssm-row' },
          h('input', { className: 'ssm-input', placeholder: t('searchPh'), value: q, disabled: busy, 'aria-label': t('searchPh'), onChange: (e) => setQ(e.target.value) }),
          q ? h('button', { disabled: busy, onClick: () => setQ('') }, '×') : null),
        qq
          ? h(React.Fragment, null,
              h('div', { className: 'ssm-sec' }, `${hits.length} ${t('hitCount')}`),
              bound ? null : h('div', { className: 'ssm-hint' }, t('unboundHint')),
              hits.length ? null : h('div', { className: 'ssm-empty' }, t('none')),
              // 中文用途第二行（用户点验反馈 2026-10-26：弹窗与设置页同款，窄面板不挤右侧）
              ...hits.map((l) => {
                const desc = l.descriptionZh
                  ? h('div', { className: 'ssm-n', style: { padding: '2px 0 0' }, title: l.description ?? undefined }, l.descriptionZh)
                  : l.description
                    ? h('div', { className: 'ssm-desc-en', style: { padding: '2px 0 0', maxWidth: 'none' }, title: l.description }, l.description, ' ', h('span', { className: 'ssm-warn-inline' }, t('pendingTag')))
                    : null;
                const isRes = resident.has(l.name) || foreignRes.has(l.name);
                if (isRes || providerSet.has(l.name)) return h('div', { key: l.name, className: 'ssm-srow ssm-gray' }, // 灰行只读、无复选框（反目标项）
                  h('div', { className: 'ssm-row' },
                    h('span', null, l.name),
                    h('span', { className: 'ssm-n' }, ' ', isRes ? (resident.has(l.name) ? t('residentRow') : t('foreignRow')) : t('providerRow')),
                    h('span', { className: 'ssm-grow' }, null),
                    h('span', { className: 'ssm-n' }, isRes ? t('goSettings') : t('providerRowGo'))), // T0 静态裁定：无编程跳转 → 纯文案（插件行指向插件设置）
                  desc);
                const on = bound ? eff.has(l.name) : !!st.managed?.[l.name]; // 未绑定：勾上态 = 已在盘上临时生效（台账）
                return h('div', { key: l.name, className: 'ssm-srow' },
                  h('div', { className: 'ssm-row' },
                    h('label', { className: 'ssm-chip' + (on ? ' ssm-on' : '') },
                      h('input', { type: 'checkbox', checked: on, disabled: busy, title: l.descriptionZh ?? undefined,
                        onChange: () => run(() => call(ctx, 'startOverride', { sessionId, ...(on ? { remove: [l.name] } : { add: [l.name] }) })) }), ' ', l.name, h(LibBadges, { lib: l }))),
                  desc);
              }))
          : h(React.Fragment, null,
              // 未绑定时整段隐藏（设计 2026-10-28）：临时条目已在下方「临时覆盖」区以勾上态呈现，不重复一节
              ...(bound ? [
                h('div', { className: 'ssm-sec' }, t('managedSec')),
                h('div', { className: 'ssm-chips' }, managed.length ? null : h('span', { className: 'ssm-empty' }, '—'),
                  ...managed.map((n) => h('label', { key: n, className: 'ssm-chip' },
                    h('input', { type: 'checkbox', checked: true, disabled: busy, onChange: () => run(() => call(ctx, 'startOverride', { sessionId, remove: [n] })) }), ' ', n))),
              ] : []),
              // 常驻大平铺段已删（P3 设计 §6.3）：常驻管理移设置页「全局技能集」tab；弹窗内仅搜索结果灰行
              h('div', { className: 'ssm-sec' }, t('override'), st.sessionOverrideActive ? h('span', { className: 'ssm-cur-tag' }, t('overrideOn')) : null),
              h('div', { className: 'ssm-chips' },
                ...(bound
                  ? (st.library ?? []).filter((l) => !eff.has(l.name)).map((l) => h('label', { key: l.name, className: 'ssm-chip', title: l.descriptionZh ?? undefined },
                      h('input', { type: 'checkbox', checked: false, disabled: busy, onChange: () => run(() => call(ctx, 'startOverride', { sessionId, add: [l.name] })) }), ' ', l.name, h(LibBadges, { lib: l })))
                  // 未绑定（设计 2026-10-28）：候选 = 库 − 常驻全局；勾选即本会话临时生效（host 起盘 setSlug:null 台账），要固化走「另存为当前清单」
                  : (st.library ?? []).filter((l) => !resident.has(l.name) && !foreignRes.has(l.name)).map((l) => {
                      const on = managed.includes(l.name);
                      return h('label', { key: l.name, className: 'ssm-chip' + (on ? ' ssm-on' : ''), title: l.descriptionZh ?? undefined },
                        h('input', { type: 'checkbox', checked: on, disabled: busy, onChange: () => run(() => call(ctx, 'startOverride', { sessionId, ...(on ? { remove: [l.name] } : { add: [l.name] }) })) }), ' ', l.name, h(LibBadges, { lib: l }));
                    })),
                  // 被覆盖剔除的集成员（用户 2026-10-26：testt 4 技能项目只见 3，被剔项从三区消失）——显示并可直接勾回
                  ...((st.sessionOverride?.removed) ?? []).map((n) => h('label', { key: 'ovr-' + n, className: 'ssm-chip', title: t('ovRestoreTip') },
                    h('input', { type: 'checkbox', checked: false, disabled: busy, onChange: () => run(() => call(ctx, 'startOverride', { sessionId, add: [n] })) }), ' ', n,
                    h('span', { className: 'ssm-n' }, ' ', t('ovRemoved')))),
                st.sessionOverrideActive ? h('button', { disabled: busy, onClick: () => run(() => call(ctx, 'endOverride', { sessionId })) }, t('endOverride')) : null),
              h('div', { className: 'ssm-hint' }, bound ? (st.sessionOverrideActive ? t('overrideHint') : t('hintP2')) : t('draftHint')),
              h('div', { className: 'ssm-hint' }, t('settingsHint'))));
    }

    function Dot({ st }) {
      const sc = st?.selfCheck;
      const cls = !st || st.unbound || sc?.unbound ? 'ssm-dot-idle' : sc && !sc.ok ? 'ssm-dot-red' : 'ssm-dot-ok';
      return h('span', { className: `ssm-dot ${cls}` }, null);
    }
    function Name({ st }) {
      return st?.binding?.setSlug ? h('span', { className: 'ssm-cur' }, st.set?.name ?? st.binding.setSlug) : null;
    }

    function ComposerChip({ ctx, t, sessionId }) {
      const b = useBus();
      React.useEffect(() => {
        bus.setSession(sessionId);
        (async () => { // §12 P0：徽标/集名常驻显示——挂载即拉一次状态，不必先开面板
          try { const v = await call(ctx, 'state', { sessionId }); if (bus.sessionId === sessionId) bus.setState(v); } catch {}
        })();
        return () => bus.clearSessionIf(sessionId);
      }, [ctx, sessionId]);
      return h('button', { className: 'ssm-chip-btn', title: t('panel'), onClick: () => bus.setOpen(!b.open) },
        h(Dot, { st: b.state }), t('chip'), h(Name, { st: b.state }),
        b.state?.selfCheck && !b.state.selfCheck.ok && !b.state.selfCheck.unbound ? h('span', { className: 'ssm-badge' }, '!') : null);
    }

    /**
     * 右栏详情 tab（§12.209，betterSidebar 服务契约源码取证：TabDescriptor.component(props)
     * 收 { ctx, store, scope, tab, visible, onOpenFile }）。数据只走既有 Remote 面（#15）。
     */
    function RightPanel({ ctx, t, scope, visible, onOpenFile }) {
      const [st, setSt] = React.useState(null);
      const [dg, setDg] = React.useState(null);
      const [dgErr, setDgErr] = React.useState(null);
      const [err, setErr] = React.useState(null);
      const [token, setToken] = React.useState(bus.token); // 刷新信号快照（⇥ 再点/面板操作即刷新，见 bus.refresh）
      const sessionId = scope?.sessionId ?? null;
      React.useEffect(() => { setSt(null); setDg(null); setDgErr(null); setToken(bus.token); }, [sessionId]); // scope 切换先清旧数据（含旧会话的刷新信号），防瞬态串会话
      React.useEffect(() => { // 订阅刷新信号：bus.refresh 只广播当前会话，token 变即触发下方重载
        const fn = () => setToken(bus.token);
        bus.subs.add(fn);
        return () => bus.subs.delete(fn);
      }, []);
      const load = React.useCallback(async () => {
        if (!sessionId) return;
        try {
          const v = await call(ctx, 'state', { sessionId });
          setSt(v);
          if (bus.sessionId === sessionId) bus.setState(v); // 迟到响应不得覆盖他会话的 bus 单例（review M1，对齐 :282 口径）
          try { setDg(await call(ctx, 'diagnoseRun', { sessionId })); setDgErr(null); }
          catch (e) { setDgErr(`${e?.message ?? e}`); } // 挂了什么得看得见，不得与「无问题」同形（review n6）
          setErr(null);
        } catch (e) { setErr(`${t('loadFailed')}: ${e?.message ?? e}`); }
      }, [ctx, sessionId]);
      React.useEffect(() => { if (visible !== false) load(); }, [load, visible, token]); // parked 时暂停拉取（计划 T0 口径，review m3）；token=bus 刷新信号：tab 常驻挂载下 ⇥ 再点/面板切集都靠它触发重载（用户报告 2026-10-27）
      if (!sessionId) return h('div', { className: 'ssm-rp' }, t('rpNoSession'));
      const sc = st?.selfCheck ?? {};
      const resident = new Set(st?.resident ?? []);
      const managed = st?.managed ?? {};
      const foreign = new Set(sc.foreign ?? []);
      const broken = new Set(sc.brokenLinks ?? []);
      const missing = new Set(st?.effective?.missing ?? []);
      const libMap = new Map((st?.library ?? []).map((l) => [l.name, l]));
      // 右栏列表口径（用户 2026-10-27）：已绑定 = 集成员 ∪ 托管台账 ∪ 外来条目（冻结/集被删回退生效清单），
      // 且剔除「仅全局常驻」行——不逐条列出全部全局技能，改由下方计数提示如实告知常驻已生效；
      // 绑定常驻伪集（_resident，loadSet 返回 null）例外：列表本身就是常驻名册。
      const bound = !!st?.binding?.setSlug;
      const residentSlugBound = st?.binding?.setSlug === '_resident';
      const setNames = new Set(st?.set?.skills ?? []);
      const baseNames = st?.set?.skills ?? (bound ? st?.effective?.names ?? [] : []);
      let names = [...new Set([...baseNames, ...Object.keys(managed), ...foreign])].sort();
      if (bound && !residentSlugBound) names = names.filter((n) => !resident.has(n) || setNames.has(n) || n in managed);
      const row = (n) => {
        const l = libMap.get(n);
        const open = l?.skillMd && onOpenFile ? () => onOpenFile(l.skillMd) : null;
        return h('div', { key: n, className: 'ssm-row' + (open ? ' ssm-click' : ''), title: open ? t('rpClick') : '', onClick: open ?? undefined },
          h('span', null, n), ' ',
          n in managed ? h(Tag, { text: t('managedTag') }) : null, ' ',
          resident.has(n) ? h(Tag, { text: t('resident') }) : null, ' ',
          foreign.has(n) ? h(Tag, { text: t('rpForeign'), warn: true }) : null, ' ',
          broken.has(n) ? h(Tag, { text: t('rpDead'), warn: true }) : null, ' ',
          missing.has(n) ? h(Tag, { text: t('rpMissing'), warn: true }) : null);
      };
      const dgRows = dg ? Object.entries({ dangling: t('diagDangling'), deadLinks: t('diagDeadLinks'), copies: t('diagCopies'), structure: t('diagStructure'), env: t('diagEnv') })
        .flatMap(([g, label]) => (dg.groups?.[g] ?? []).slice(0, 3).map((r, i) => h('div', { key: `${g}${i}`, className: 'ssm-diag-row' },
          h('span', { className: `ssm-lvl ssm-lvl-${r.level}` }, null), h('span', null, `${label}: ${r.what}`)))) : [];
      const dgCount = dg ? Object.entries(dg.groups).filter(([k]) => k !== 'partition').reduce((a, [, v]) => a + v.length, 0) : 0;
      return h('div', { className: 'ssm-rp' },
        h('div', { className: 'ssm-head' },
          h('b', null, t('rpEffective')), ' ', st?.set?.name ?? st?.binding?.setSlug ?? t('noBinding'),
          sc.frozen ? h('span', { className: 'ssm-warn-inline' }, t('rpFrozen')) : null,
          h('span', { className: 'ssm-grow' }, null),
          h('button', { className: 'ssm-x', onClick: load, title: t('regen') }, '⟳')),
        h('div', { className: 'ssm-root' }, st?.projectRoot ?? ''),
        err ? h('div', { className: 'ssm-err' }, err) : null,
        !st && !err ? h('div', { className: 'ssm-empty' }, '…') : null, // 未到位≠空：不得先渲染空态（review m4）
        st && !st.binding?.setSlug && (st.resident ?? []).length ? h('div', { className: 'ssm-empty' }, t('rpGlobalActiveUnbound').replace('{n}', st.resident.length)) : null,
        st && (!st.binding?.setSlug ? !(st.resident ?? []).length : names.length === 0) ? h('div', { className: 'ssm-empty' }, t('rpEmpty')) : null,
        st && bound && (st.resident ?? []).length ? h('div', { className: 'ssm-hint' }, t('rpGlobalActiveHint').replace('{n}', st.resident.length)) : null, // 未绑定时由上方专属文案告知，不重复
        st ? h('div', null, ...names.map(row)) : null,
        // 插件/Preset 灰段（用户疑问 2026-10-26）：运行时注入、不在生效清单内，只读不可勾；null = 服务不可知不渲染。
        (st?.unmanaged?.length ?? -1) >= 0 ? h(React.Fragment, null,
          h('div', { className: 'ssm-sec' }, t('providerSec'), ' ', h('span', { className: 'ssm-n' }, `(${st.unmanaged.length})`)),
          h('div', { className: 'ssm-hint' }, t('providerHint')),
          ...st.unmanaged.map((e) => h('div', { key: `p-${e.name}`, className: 'ssm-row ssm-gray', title: e.source ?? undefined },
            h('span', null, e.name), ' ', h(Tag, { text: e.provider })))) : null,
        h('div', { className: 'ssm-sec' }, t('rpSelf'), ' ', !st ? '—' : sc.ok === false ? h('span', { className: sc.frozen ? 'ssm-warn-inline' : 'ssm-err' }, sc.detail) : h('span', { className: 'ssm-ok' }, '✓')),
        h('div', { className: 'ssm-sec' }, t('rpDiag'), ' ', h('span', { className: 'ssm-n' }, dg ? `${dgCount}` : dgErr ? `⚠ ${t('rpDiagFail')}` : '—')),
        dgErr ? h('div', { className: 'ssm-hint' }, dgErr) : null,
        ...dgRows);
    }

    function OverlayHost({ ctx, t, bs }) {
      const b = useBus();
      if (!b.open) return null;
      return h('div', { className: 'ssm-overlay', onClick: () => bus.setOpen(false) },
        b.sessionId
          ? h(Panel, { ctx, t, sessionId: b.sessionId, onClose: () => bus.setOpen(false), bs })
          : h('div', { className: 'ssm-panel' }, t('noSession')));
    }

    function Tag({ text, warn }) { return h('span', { className: 'ssm-tag' + (warn ? ' ssm-tag-warn' : '') }, text); }

    /**
     * 设置页（§10.1.4 settings.section：注册仅 id/order/label，ownerProps 只给 close；
     * 三页签自绘）。数据全部走同一 host Remote 面（call 兜底 fetch）——无第二实现（#15）。
     */
    /** 保留理由 → 人话：resident = 插件自家常驻链（不是同名冲突，用户报告 2026-10-26）；
     *  未知 reason 原样显示，避免新版 core 加了分类而字典缺键时 UI 空白。 */
    const keepReasonText = (t, reason) => {
      const r = String(reason ?? '');
      const key = 'migrateReason' + r.charAt(0).toUpperCase() + r.slice(1);
      const v = t(key);
      return v === key ? r : v;
    };

    function SettingsSection({ ctx, t }) {
      const [tab, setTab] = React.useState('library');
      const [lib, setLib] = React.useState([]);
      const [filter, setFilter] = React.useState('');
      const [busy, setBusy] = React.useState(null);
      const [msg, setMsg] = React.useState(null); // {kind:'err'|'ok', text}
      const [claimOf, setClaimOf] = React.useState(null); // 认领来源行内编辑中的技能名（Electron 无 window.prompt，§6.4）
      const [claimDraft, setClaimDraft] = React.useState({ source: '', commit: '' });
      const [confirmUn, setConfirmUn] = React.useState(null); // name
      const [backupsOf, setBackupsOf] = React.useState(null); // {name, list}
      const [upRes, setUpRes] = React.useState({}); // name -> checkUpdate result
      const [spec, setSpec] = React.useState('');
      const [overwrite, setOverwrite] = React.useState(false);
      const [instRes, setInstRes] = React.useState(null);
      const [mig, setMig] = React.useState(null); // {preview, applied}
      // P3 全局技能集 tab + 翻译/agents 迁移（设计 §6.4/§6.1/§6.6）
      const [gq, setGq] = React.useState('');
      const [gOnly, setGOnly] = React.useState(false);
      const [resident, setResident] = React.useState([]);
      const [foreign, setForeign] = React.useState([]);
      const [rTarget, setRTarget] = React.useState('');
      const [tr, setTr] = React.useState(null); // {pending, failed, models, model, result, progress}
      const trStop = React.useRef(false); // 批量翻译「停止」标志（逐条 RPC 循环检查，用户反馈 2026-10-26：无进度不可知）
      const [migA, setMigA] = React.useState(null); // {preview, applied}
      const [diag, setDiag] = React.useState(null);
      const load = React.useCallback(async () => {
        try { const v = await call(ctx, 'libraryList', {}); setLib(v.library ?? []); }
        catch (e) { setMsg({ kind: 'err', text: `${t('loadFailed')}: ${e?.message ?? e}` }); }
      }, [ctx]);
      React.useEffect(() => { load(); }, [load]);
      const loadState = React.useCallback(async () => {
        try {
          const v = await call(ctx, 'state', bus.sessionId ? { sessionId: bus.sessionId } : {});
          setResident(v.resident ?? []); setForeign(v.residentForeign ?? []); setRTarget(v.residentTarget ?? '');
        } catch { /* 无会话时项目面可能拒；全局字段照常取 */ }
      }, [ctx]);
      React.useEffect(() => { loadState(); }, [loadState]);
      const run = async (key, fn) => {
        setBusy(key); setMsg(null);
        try {
          const r = await fn();
          const w = r && Array.isArray(r.warnings) && r.warnings.length ? r.warnings.join('; ') : null;
          setMsg(w ? { kind: 'err', text: `${t('opDone')} ⚠ ${w}` } : { kind: 'ok', text: (r && r.noteText) || t('opDone') }); // 警告可见（review m4）
          return r;
        } catch (e) { setMsg({ kind: 'err', text: `${t('opFailed')}: ${e?.message ?? e}` }); }
        finally { setBusy(null); }
      };
      /** 进行中按钮 = 转圈小图标 + 进行时文案（用户 2026-10-26：检查更新要等几十秒，界面毫无反应像卡死）。 */
      const busyBtn = (key, label, doing, onClick) => h('button', { disabled: !!busy, onClick },
        busy === key ? h('span', { className: 'ssm-spin' }, null) : null, busy === key ? doing : label);
      const sess = () => (bus.sessionId ? { sessionId: bus.sessionId } : {}); // 项目面必须带活动会话（review M2）
      const rows = searchRows(lib, filter); // P3：过滤框 = 同款匹配器（名称/来源/描述/中文用途）
      const gCorpus = [...lib, ...foreign.filter((n) => !lib.some((l) => l.name === n)).map((n) => ({ name: n, source: 'foreign', foreign: true, descriptionZh: null }))];
      const grows = searchRows(gCorpus, gq).filter((r) => !gOnly || resident.includes(r.name) || foreign.includes(r.name));
      const counts = (files) => {
        const c = { update: 0, add: 0, remove: 0, 'skip-modified': 0 };
        for (const f of files ?? []) if (c[f.action] !== undefined) c[f.action] += 1;
        return c;
      };
      const tabBtn = (id, label) => h('button', { className: 'ssm-tab' + (tab === id ? ' ssm-tab-on' : ''), disabled: !!busy, onClick: () => setTab(id) }, label);
      return h('div', { className: 'ssm-settings' },
        h('div', { className: 'ssm-tabs' }, tabBtn('library', t('tabLibrary')), tabBtn('global', t('tabGlobal')), tabBtn('ops', t('tabOps')), tabBtn('diag', t('tabDiag'))),
        msg ? h('div', { className: msg.kind === 'err' ? 'ssm-err' : 'ssm-ok' }, msg.text) : null,
        tab === 'library' ? h(React.Fragment, null,
          h('input', { className: 'ssm-input', style: { maxWidth: 300 }, placeholder: t('filterPh'), value: filter, onChange: (e) => setFilter(e.target.value) }),
          // P3 翻译入口（设计 §6.1：默认关出网，手动批量）+ agents 存量迁移向导（§6.6，Task 5 RPC）
          h('div', { className: 'ssm-row' },
            h('button', { disabled: !!busy, onClick: () => run('trP', async () => { const p = await call(ctx, 'translatePending', {}); const m = await call(ctx, 'translateModels', {}).catch(() => ({ options: [] })); setTr({ pending: p.pending ?? [], failed: p.failed ?? [], models: m, model: '', result: null }); }) }, t('batchTranslate')),
            (tr?.pending?.length || tr?.failed?.length)
              ? h(React.Fragment, null,
                  h('select', { className: 'ssm-input', style: { maxWidth: 280 }, disabled: !!busy, title: t('modelSelect'), value: tr.model, onChange: (e) => setTr({ ...tr, model: e.target.value }) },
                    h('option', { value: '' }, t('currentModel')),
                    ...(tr.models?.options ?? []).map((o, i) => h('option', { key: `${o.provider}/${o.model}`, value: String(i) }, o.label))), // N7：value 用下标，免 provider/model 含 | 时碎裂
                  tr.failed?.length ? h('span', { className: 'ssm-hint' }, `${tr.failed.length} ${t('failedRetryable')}`) : null,
                  h('button', { disabled: !!busy, onClick: () => run('trR', async () => {
                    const o = tr.model !== '' ? (tr.models?.options ?? [])[Number(tr.model)] ?? null : null; // M2：pending ∪ failed 一并（failed 同哈希不自愈，此处即重试入口，AC#2）
                    const names = [...(tr.pending ?? []).map((p) => p.name), ...(tr.failed ?? []).map((f) => f.name)];
                    // 分组 RPC（每组 5 条 = host 一个 prompt，reasoning 模型思考次数 ÷5）+ 并发 2：
                    // 每组返回即刷进度；host 组内即落盘，停止不丢已完成（用户反馈 2026-10-26：无进度 + 逐条太慢）
                    trStop.current = false;
                    const base = { ...tr, result: null };
                    const st = { done: [], failed: [], running: [] };
                    let i = 0;
                    const paint = () => setTr({ ...base, progress: { total: names.length, done: st.done.length, failed: st.failed.length, running: st.running.slice(), stopping: trStop.current } });
                    paint();
                    const worker = async () => {
                      while (i < names.length && !trStop.current) {
                        const g = names.slice(i, i + 5); i += g.length;
                        st.running.push(...g); paint();
                        try {
                          const r = await call(ctx, 'translateRun', { names: g, provider: o?.provider ?? null, model: o?.model ?? null });
                          if (r?.done?.length) st.done.push(...r.done);
                          st.failed.push(...(r?.failed ?? []));
                        } catch (e) { g.forEach((n) => st.failed.push({ name: n, error: String(e?.message ?? e) })); }
                        st.running = st.running.filter((x) => !g.includes(x)); paint();
                      }
                    };
                    await Promise.all([worker(), worker()]);
                    const stopped = trStop.current; trStop.current = false;
                    setTr({ ...base, progress: null, result: { done: st.done, failed: st.failed, skipped: stopped ? names.length - st.done.length - st.failed.length : 0 } });
                    await load();
                  }) }, `${t('translateGo')}(${(tr.pending?.length ?? 0) + (tr.failed?.length ?? 0)})`),
                  tr?.progress ? h('button', { disabled: !tr.progress, onClick: () => { trStop.current = true; } }, t('translateStop')) : null)
                : null),
          tr?.progress
            ? h('div', { className: 'ssm-hint' },
                `${t('translateProgress')} ${tr.progress.done + tr.progress.failed}/${tr.progress.total}（✓${tr.progress.done} ×${tr.progress.failed}）${tr.progress.stopping ? ` · ${t('translateStopping')}` : ''}`,
                tr.progress.running.length ? h('div', { className: 'ssm-hint' }, `⋯ ${tr.progress.running.slice(0, 2).join(', ')}${tr.progress.running.length > 2 ? ` +${tr.progress.running.length - 2}` : ''}`) : null)
            : null,
          tr?.result
            ? h('div', { className: 'ssm-hint' }, `${t('translateDone')}: ✓${(tr.result.done ?? []).length} ×${(tr.result.failed ?? []).length}${tr.result.skipped ? ` ⏭${tr.result.skipped}` : ''}`,
                ...(tr.result.failed ?? []).map((f) => h('div', { key: f.name, className: 'ssm-warn-inline' }, `${f.name}: ${f.error ?? ''}`)))
            : null,
          h('div', { className: 'ssm-hint' }, t('autoTranslateHint')),
          rows.length === 0 ? h('div', { className: 'ssm-empty' }, t('empty')) : null,
          ...rows.map((x) => h('div', { key: x.name, className: 'ssm-srow' },
            h('div', { className: 'ssm-row' },
              h('span', { className: 'ssm-cur' }, x.name),
              h(Tag, { text: x.managed ? t('managedTag') : t('unmanagedTag'), warn: !x.managed }),
              x.localModified ? h(Tag, { text: t('modifiedTag'), warn: true }) : null,
              h('span', { className: 'ssm-n' }, `${String(x.source).replace('github:', '')}${x.commit ? ` @${String(x.commit).slice(0, 7)}` : ''}`),
              h('span', { className: 'ssm-grow' }, null),
              String(x.source).startsWith('github:')
                ? busyBtn(`chk:${x.name}`, t('checkUp'), t('checkingUp'), () => run(`chk:${x.name}`, async () => { const v = await call(ctx, 'updateCheck', { name: x.name }); setUpRes((m) => ({ ...m, [x.name]: v })); }))
                : null,
              upRes[x.name] && !upRes[x.name].upToDate
                ? busyBtn(`ap:${x.name}`, t('applyUp'), t('applyingUp'), () => run(`ap:${x.name}`, async () => { const r = await call(ctx, 'updateApply', { name: x.name }); setUpRes((m) => ({ ...m, [x.name]: null })); await load(); return r?.backup ? { noteText: `${t('opDone')} · ${t('backupAt')} ${r.backup}` } : null; }))
                : null,
              x.backupCount
                ? h('button', { disabled: !!busy, onClick: () => {
                    if (backupsOf?.name === x.name) { setBackupsOf(null); return; }
                    run(`bk:${x.name}`, async () => setBackupsOf({ name: x.name, list: (await call(ctx, 'backupsList', { name: x.name })).backups ?? [] }));
                  } }
                , `${t('backupsTitle')}(${x.backupCount})`)
                : null,
              h('button', {
                disabled: !!busy,
                title: t('claimHint'),
                onClick: () => {
                  const on = claimOf === x.name;
                  setClaimOf(on ? null : x.name);
                  // github 行预填现值（改认领：换来源或补 commit），本地/占位行留空
                  if (!on) setClaimDraft({ source: String(x.source).startsWith('github:') ? String(x.source) : '', commit: x.commit ? String(x.commit) : '' });
                },
              }, String(x.source).startsWith('github:') ? t('claimEdit') : t('claimGo')),
              h('button', { disabled: !!busy, className: 'ssm-danger', onClick: () => setConfirmUn(x.name) }, t('uninstallGo'))),
            // P3 中文用途灰字行（未翻译显英文 + 待翻译角标，§6.1）
            x.descriptionZh
              ? h('div', { className: 'ssm-n', style: { padding: '2px 0 0' } }, x.descriptionZh)
              : x.description
                ? h('div', { className: 'ssm-desc-en', style: { padding: '2px 0 0' }, title: x.description }, x.description, ' ', h('span', { className: 'ssm-warn-inline' }, t('pendingTag')))
                : null,
            // 行内认领来源（§8.1）：自绘输入行，不用 window.prompt（§6.4）
            claimOf === x.name
              ? h(React.Fragment, null,
                  h('div', { className: 'ssm-row' },
                    h('input', { className: 'ssm-input', style: { maxWidth: 230 }, autoFocus: true, placeholder: t('claimSourcePh'), value: claimDraft.source, disabled: !!busy, onChange: (e) => setClaimDraft({ ...claimDraft, source: e.target.value }) }),
                    h('input', { className: 'ssm-input', style: { maxWidth: 120 }, placeholder: t('claimCommitPh'), value: claimDraft.commit, disabled: !!busy, onChange: (e) => setClaimDraft({ ...claimDraft, commit: e.target.value }) }),
                    h('button', { disabled: !!busy || !claimDraft.source.trim(), onClick: () => run(`claim:${x.name}`, async () => { await call(ctx, 'claimSource', { name: x.name, source: claimDraft.source.trim(), commit: claimDraft.commit.trim() || null }); setClaimOf(null); await load(); }) }, '✓'),
                    x.source !== 'unknown' && x.source !== 'placeholder'
                      ? h('button', { disabled: !!busy, onClick: () => run(`claim:${x.name}`, async () => { await call(ctx, 'claimSource', { name: x.name, source: 'unknown' }); setClaimOf(null); await load(); }) }, t('claimUndo'))
                      : null,
                    h('button', { disabled: !!busy, onClick: () => setClaimOf(null) }, '×')),
                  h('div', { className: 'ssm-hint' }, t('claimHint')))
              : null,
            upRes[x.name]
              ? h(React.Fragment, null,
                h('div', { className: 'ssm-hint' }, upRes[x.name].upToDate
                  ? (() => {
                      const sk = counts(upRes[x.name].files)['skip-modified'];
                      return `${t('upToDate')} @${String(upRes[x.name].current ?? '').slice(0, 7)}${sk ? ` ⚠ ${sk} ${t('skipNote')}` : ''}`;
                    })()
                  : (() => {
                      const c = counts(upRes[x.name].files);
                      // 远端 commit 前进了但一个文件都没变（或来源是认领的、current 为空无法比 commit）：
                      // 报「差异 ↑0 +0 −0」会被读成“有更新可装”，直说内容已一致（用户报告 2026-10-26 连带场景）
                      if (!c.update && !c.add && !c.remove && !c['skip-modified'])
                        return `${t('noContentDiff')} → @${String(upRes[x.name].remote ?? '').slice(0, 7)}${upRes[x.name].current ? '' : `（${t('claimNoCommit')}）`}`;
                      return `${t('upActions')}: ↑${c.update} +${c.add} −${c.remove} ⚠${c['skip-modified']} → ${String(upRes[x.name].remote ?? '').slice(0, 7)}${c['skip-modified'] ? ` (${t('skipNote')})` : ''}`;
                    })()),
                // 文件级 diff + 跳过项名单（§13.6 / review m5）：非 same 的条目逐行列出
                ...(upRes[x.name].files ?? []).filter((f) => f.action !== 'same').slice(0, 15)
                  .map((f) => h('div', { key: f.path, className: 'ssm-hint' }, f.action === 'skip-modified' ? '⚠ ' : `${f.action === 'update' ? '↑' : f.action === 'add' ? '+' : '−'} `, f.path)),
                (upRes[x.name].files ?? []).filter((f) => f.action !== 'same').length > 15 ? h('div', { className: 'ssm-hint' }, t('moreFiles')) : null)
              : null,
            confirmUn === x.name
              ? h('div', { className: 'ssm-confirm' }, t('confirmUn'), ' ', x.name, ' ',
                  h('button', { autoFocus: true, disabled: !!busy, className: 'ssm-danger', onClick: () => run(`un:${x.name}`, async () => { await call(ctx, 'uninstallSkill', { name: x.name }); setConfirmUn(null); setUpRes((m) => ({ ...m, [x.name]: null })); await load(); }) }, t('uninstallGo')),
                  h('button', { onClick: () => setConfirmUn(null) }, '×'))
              : null,
            backupsOf?.name === x.name
              ? h('div', { className: 'ssm-row' }, backupsOf.list.length === 0
                ? h('span', { className: 'ssm-empty' }, t('none'))
                : backupsOf.list.map((b) => h('label', { key: b.dir, className: 'ssm-chip' },
                    h('span', null, `${b.ts} (${b.fileCount})`), ' ',
                    h('button', { disabled: !!busy, onClick: () => run(`rs:${b.dir}`, async () => { await call(ctx, 'backupRestore', { name: x.name, dir: b.dir }); setBackupsOf(null); await load(); }) }, t('restoreGo')))))
              : null))
        ) : null,
        tab === 'global' ? h(React.Fragment, null, // P3 全局技能集 tab（设计 §6.4）：常驻名单 + 外来只读
          h('div', { className: 'ssm-hint' }, t('globalTabHint'), rTarget ? ` ${rTarget}` : ''),
          h('div', { className: 'ssm-row' },
            h('input', { className: 'ssm-input', style: { maxWidth: 300 }, placeholder: t('searchPh'), value: gq, disabled: !!busy, onChange: (e) => setGq(e.target.value) }),
            h('label', { className: 'ssm-hint' }, h('input', { type: 'checkbox', checked: gOnly, disabled: !!busy, onChange: (e) => setGOnly(e.target.checked) }), ' ', t('residentOnly'))),
          grows.length === 0 ? h('div', { className: 'ssm-empty' }, t('empty')) : null,
          ...grows.map((r) => {
            if (r.foreign) return h('div', { key: r.name, className: 'ssm-srow ssm-gray' }, // N5：已在设置页内，不再挂「去设置管理」文案
              h('div', { className: 'ssm-row' },
                h('span', { className: 'ssm-cur' }, r.name),
                h(Tag, { text: t('foreignRow'), warn: true })));
            const on = resident.includes(r.name);
            return h('div', { key: r.name, className: 'ssm-srow' },
              h('div', { className: 'ssm-row' },
                h('label', { className: 'ssm-chip' + (on ? ' ssm-on' : '') },
                  h('input', { type: 'checkbox', checked: on, disabled: !!busy, onChange: () => run(`res:${r.name}`, async () => {
                    const next = on ? resident.filter((n) => n !== r.name) : [...resident, r.name];
                    await call(ctx, 'setResident', { names: next });
                    await loadState();
                  }) }), ' ', r.name),
                String(r.source).startsWith('github:') ? h('span', { className: 'ssm-n' }, String(r.source).replace('github:', '').slice(0, 20)) : null),
              // 描述第二行（用户反馈 2026-10-26：同行挤压显乱，与库 tab 同款）
              r.descriptionZh
                ? h('div', { className: 'ssm-n', style: { padding: '2px 0 0' }, title: r.description ?? undefined }, r.descriptionZh)
                : r.description
                  ? h('div', { className: 'ssm-desc-en', style: { padding: '2px 0 0', maxWidth: 'none' }, title: r.description }, r.description, ' ', h('span', { className: 'ssm-warn-inline' }, t('pendingTag')))
                  : null);
          })) : null,
        tab === 'ops' ? h(React.Fragment, null,
          h('div', { className: 'ssm-sec' }, t('installTitle')),
          h('div', { className: 'ssm-row' },
            h('input', { className: 'ssm-input', placeholder: t('installSpecPh'), value: spec, disabled: !!busy, onChange: (e) => setSpec(e.target.value) }),
            h('label', { className: 'ssm-hint' }, h('input', { type: 'checkbox', checked: overwrite, disabled: !!busy, onChange: (e) => setOverwrite(e.target.checked) }), ' ', t('overwriteChk')),
            h('button', { disabled: !!busy || !spec.trim(), onClick: () => run('install', async () => { setInstRes(await call(ctx, 'installApply', { spec: spec.trim(), overwrite })); setSpec(''); await load(); }) }, t('installGo'))),
          instRes
            ? h('div', { className: 'ssm-hint' }, `@${String(instRes.commit ?? '').slice(0, 7)} `,
                ...(instRes.results ?? []).map((r) => h('span', { key: r.name, className: 'ssm-chip' }, `${r.name}: ${r.ok ? '✓' : `× ${r.reason ?? ''}`}`)))
            : null,
          h('div', { className: 'ssm-sec' }, t('migrateAgentsTitle')),
          h('div', { className: 'ssm-row' },
            h('button', { disabled: !!busy, onClick: () => run('migAP', async () => setMigA({ preview: await call(ctx, 'migrateAgentsPreview', {}), applied: false })) }, t('migrateAgentsGo')),
            migA?.applied ? h('button', { disabled: !!busy, onClick: () => run('migAU', async () => { await call(ctx, 'migrateAgentsUndo', {}); setMigA(null); await load(); }) }, t('migrateUndo')) : null,
            migA && !migA.applied ? h('button', { disabled: !!busy || !(migA.preview?.moves?.length), onClick: () => run('migAA', async () => { await call(ctx, 'migrateAgentsApply', {}); setMigA({ preview: null, applied: true }); await load(); }) }, t('migrateApply')) : null, // M3：空预览禁用执行（host 侧 null-ledger 崩溃已另修）
            !migA ? h('span', { className: 'ssm-hint' }, t('migrateAgentsHint')) : null),
          migA?.preview
            ? h('div', { className: 'ssm-hint' },
                `${t('migrateMoves')}: ${(migA.preview.moves ?? []).map((m) => m.name).join(', ') || t('none')}；${t('migrateKeep')}: ${(migA.preview.keep ?? []).map((k) => `${k.name}(${keepReasonText(t, k.reason)})`).join(', ') || t('none')}`,
                ...(migA.preview.warnings ?? []).map((w, i) => h('div', { key: 'ma' + i, className: 'ssm-warn-inline' }, w)),
                ...(migA.preview.notes ?? []).map((n, i) => h('div', { key: 'mn' + i, className: 'ssm-hint' }, n)))
            : null,
          h('div', { className: 'ssm-sec' }, t('migrateTitle')),
          h('div', { className: 'ssm-row' },
            h('button', { disabled: !!busy, onClick: () => run('migP', async () => setMig({ preview: await call(ctx, 'migratePreview', {}), applied: false })) }, t('migratePreview')),
            mig ? h('button', { disabled: !!busy, onClick: () => run('migA', async () => { const r = await call(ctx, mig.applied ? 'migrateUndo' : 'migrateApply', {}); setMig(null); await load(); return r; }) }, mig.applied ? t('migrateUndo') : t('migrateApply')) : null),
          mig?.preview
            ? h('div', { className: 'ssm-hint' },
                `${t('migrateMoves')}: ${(mig.preview.moves ?? []).map((m) => m.name).join(', ') || t('none')}；${t('migrateKeep')}: ${(mig.preview.keep ?? []).map((k) => k.name).join(', ') || t('none')}`,
                ...(mig.preview.warnings ?? []).map((w, i) => h('div', { key: i, className: 'ssm-warn-inline' }, w)))
            : null
        ) : null,
        tab === 'diag' ? h(React.Fragment, null,
          h('div', { className: 'ssm-row' },
            h('button', { disabled: !!busy || !bus.sessionId, onClick: () => run('diag', async () => setDiag(await call(ctx, 'diagnoseRun', sess()))) }, t('diagRun')),
            diag?.fixable?.reclaimDeadLinks?.count
              ? h('button', { disabled: !!busy || !bus.sessionId, onClick: () => run('reclaim', async () => { await call(ctx, 'reclaimDeadLinks', sess()); setDiag(await call(ctx, 'diagnoseRun', sess())); }) }, `${t('fixReclaim')}(${diag.fixable.reclaimDeadLinks.count})`)
              : null,
            h('button', { disabled: !!busy || !bus.sessionId, onClick: () => run('rebuild', async () => { const r = await call(ctx, 'rebuildManaged', sess()); setDiag(await call(ctx, 'diagnoseRun', sess())); return r; }) }, t('fixRebuild')),
            !bus.sessionId ? h('div', { className: 'ssm-hint' }, t('noSession')) : null),
          diag
            ? h('div', null, ...Object.entries({
              partition: t('diagPartition'), copies: t('diagCopies'), dangling: t('diagDangling'),
              deadLinks: t('diagDeadLinks'), structure: t('diagStructure'), env: t('diagEnv'),
            }).map(([g, label]) => h('div', { key: g },
              h('div', { className: 'ssm-sec' }, label, ' ', h('span', { className: 'ssm-n' }, `${(diag.groups?.[g] ?? []).length}`)),
              (diag.groups?.[g] ?? []).length === 0 ? h('div', { className: 'ssm-empty' }, t('none')) : null,
              ...(diag.groups?.[g] ?? []).map((r, i) => h('div', { key: i, className: 'ssm-diag-row' },
                h('span', { className: `ssm-lvl ssm-lvl-${r.level}` }, null),
                h('span', null, r.what), ' ',
                h('span', { className: 'ssm-n' }, r.where ?? ''),
                h('span', { className: 'ssm-grow' }, null),
                h('span', { className: 'ssm-hint' }, r.fix ?? ''))))))
            : null
        ) : null);
    }

    const CSS = `
.ssm-chip-btn{display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary);background:transparent;border:0;padding:3px 7px;border-radius:6px;cursor:pointer}
.ssm-chip-btn:hover{background:color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent);color:var(--dsw-alias-label-primary)}
.ssm-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
.ssm-dot-ok{background:var(--dsw-alias-state-success-primary,#22c55e)}.ssm-dot-red{background:var(--dsw-alias-state-error-primary,#e5484d)}.ssm-dot-idle{background:var(--dsw-alias-label-secondary)}
.ssm-cur{color:var(--dsw-alias-label-primary);font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ssm-badge{min-width:14px;height:14px;border-radius:7px;background:var(--dsw-alias-state-error-primary,#e5484d);color:#fff;font-size:10px;display:inline-flex;align-items:center;justify-content:center;padding:0 4px}
.ssm-overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center;padding:0 12px 12px;pointer-events:auto}
.ssm-panel{width:min(620px,96vw);max-height:72vh;overflow:auto;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;box-shadow:0 12px 40px rgba(0,0,0,.35)}
.ssm-head{display:flex;align-items:center;gap:8px}
.ssm-x{background:0;border:0;color:inherit;font-size:15px;cursor:pointer;padding:2px 6px}
.ssm-grow{flex:1}
.ssm-root{font-size:11px;color:var(--dsw-alias-label-secondary);word-break:break-all}
.ssm-warn-inline{color:var(--dsw-alias-state-warn-primary,#f5a623)}
.ssm-spin{display:inline-block;width:.7em;height:.7em;border:1.5px solid currentColor;border-top-color:transparent;border-radius:50%;animation:ssm-spin .7s linear infinite;vertical-align:-1px;margin-right:5px}
@keyframes ssm-spin{to{transform:rotate(360deg)}}
.ssm-warn,.ssm-err{font-size:11px;padding:4px 6px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f5a623) 18%,transparent)}
.ssm-err{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 16%,transparent)}
.ssm-sec{font-size:11px;font-weight:700;color:var(--dsw-alias-label-secondary);margin-top:4px;display:flex;gap:6px;align-items:center}
.ssm-hint{font-size:10px;color:var(--dsw-alias-label-secondary)}
.ssm-row{display:flex;align-items:center;gap:4px;font-size:12px}
.ssm-pick{flex:1;display:flex;align-items:center;gap:6px;background:0;border:0;color:var(--dsw-alias-label-primary);cursor:pointer;padding:4px 6px;border-radius:6px;text-align:left;min-width:0}
.ssm-pick:hover{background:color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent)}
.ssm-on{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}
.ssm-n{color:var(--dsw-alias-label-secondary);font-size:11px}
.ssm-cur-tag{font-size:10px;color:var(--dsw-alias-brand-primary)}
.ssm-row button:not(.ssm-pick){font:inherit;font-size:11px;color:var(--dsw-alias-label-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);border:1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 50%, transparent);border-radius:6px;padding:4px 10px;cursor:pointer} /* 品牌色软底（用户 2026-10-26：要一眼可辨的按钮） */
.ssm-row button:not(.ssm-pick):hover{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-brand-primary) 70%, transparent)}
.ssm-row button.ssm-danger,.ssm-settings .ssm-row button.ssm-danger,.ssm-confirm button.ssm-danger,.ssm-settings .ssm-confirm button.ssm-danger{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 16%, transparent);border:1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 55%, transparent)} /* 高危操作（解绑/卸载/删除）错误色（用户 2026-10-26） */
.ssm-row button.ssm-danger:hover,.ssm-settings .ssm-row button.ssm-danger:hover,.ssm-confirm button.ssm-danger:hover,.ssm-settings .ssm-confirm button.ssm-danger:hover{background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 28%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 75%, transparent)}
.ssm-input{flex:1;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 7px;min-width:0}
.ssm-io{display:flex;flex-direction:column;gap:6px;margin:6px 0}
.ssm-textarea{width:100%;box-sizing:border-box;resize:vertical;font:11px/1.5 ui-monospace,Consolas,monospace;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:6px 8px}
.ssm-ok{font-size:11px;color:var(--dsw-alias-state-success-primary,#22c55e)}
.ssm-confirm{font-size:11px;padding:5px 7px;border-radius:6px;background:var(--dsw-alias-bg-layer-1);display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.ssm-confirm button{font:inherit;font-size:11px;border:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent);color:var(--dsw-alias-label-primary);border-radius:6px;padding:3px 8px;cursor:pointer}
.ssm-chips{display:flex;flex-wrap:wrap;gap:4px;font-size:11px}
.ssm-chips .ssm-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;cursor:pointer}
.ssm-chips .ssm-on{border-color:var(--dsw-alias-brand-primary)}
.ssm-gray{opacity:.55}
.ssm-desc-en{max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--dsw-alias-label-secondary)}
.ssm-empty{font-size:11px;color:var(--dsw-alias-label-secondary)}
.ssm-settings{display:flex;flex-direction:column;gap:8px;padding:4px 2px;max-width:920px}
.ssm-tabs{display:flex;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.ssm-tab{font:inherit;font-size:12px;border:0;background:0;color:var(--dsw-alias-label-secondary);padding:6px 10px;cursor:pointer;border-radius:6px 6px 0 0}
.ssm-tab:hover{color:var(--dsw-alias-label-primary)}
.ssm-tab-on{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}
.ssm-srow{display:flex;flex-direction:column;gap:3px;padding:5px 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px}
.ssm-tag{font-size:10px;padding:1px 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);flex:none}
.ssm-tag-warn{color:var(--dsw-alias-state-warn-primary,#f5a623);border-color:currentColor}
.ssm-diag-row{display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 0;flex-wrap:wrap}
.ssm-lvl{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-label-secondary)}
.ssm-lvl-warn{background:var(--dsw-alias-state-warn-primary,#f5a623)}
.ssm-lvl-error{background:var(--dsw-alias-state-error-primary,#e5484d)}
.ssm-lvl-info{background:var(--dsw-alias-brand-primary)}
.ssm-rp{display:flex;flex-direction:column;gap:6px;height:100%;overflow:auto;padding:6px 8px;font-size:12px}
.ssm-click{cursor:pointer}
.ssm-click:hover{background:color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent);border-radius:6px}
.ssm-settings .ssm-row button{font:inherit;font-size:11px;color:var(--dsw-alias-label-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);border:1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 50%, transparent);border-radius:6px;padding:4px 10px;cursor:pointer}
.ssm-settings .ssm-row button:hover{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-brand-primary) 70%, transparent)}
.ssm-settings .ssm-confirm button{font:inherit;font-size:11px;border:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent);color:var(--dsw-alias-label-primary);border-radius:6px;padding:3px 8px;cursor:pointer}
`;

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        for (const [lang, dict] of Object.entries(DICTS)) ctx.effect(() => ctx.locale.register(PKG, lang, dict));
        ctx.effect(() => ctx.locale.register(PKG, 'zh-cn', DICTS.zh));
        const t = (key) => {
          const tr = ctx.locale.bind(PKG);
          const v = tr?.(key);
          return typeof v === 'string' && v !== key ? v : (DICTS.zh[key] ?? DICTS.en[key] ?? key);
        };
        ctx.effect(() => {
          const style = document.createElement('style');
          style.setAttribute('data-plugin', PKG);
          style.textContent = CSS;
          document.head.append(style);
          return () => style.remove();
        });
        // 右栏详情 tab（§12.209）：betterSidebar 是第三方服务，启动顺序不保证——
        // apply 时取不到则每秒重试直到成功；注册 disposer 恒挂 ctx.effect（重复 id 抛错，泄漏即永久失去 tab）。
        ctx.effect(() => {
          const TAB_ID = 'skill-set-manager:detail'; // 命名空间 id：第三方 tab 类型惯例（review n1）
          let off = null;
          let warned = false;
          const tryReg = () => {
            const svc = ctx.get('betterSidebar');
            if (!svc) return false;
            try { off = svc.registerTab({
              id: TAB_ID,
              title: () => t('tabTitle'),
              description: () => t('tabDesc'),
              order: 40,
              single: true,
              // 刷新接线（用户报告 2026-10-27，betterSidebar 源码取证）：surface 分支每次 openTab
              // （含已开 reveal）必发 onOpen；底栏分支激活既有 tab 发 onActivate——两钩子广播信号，
              // 常驻挂载的 tab 体据此重载，不再停在旧集快照（手动 ⟳ 仍保留）。
              onOpen: (_tab, scope) => bus.refresh(scope?.sessionId),
              onActivate: (_tab, scope) => bus.refresh(scope?.sessionId),
              badge: (_c, scope) => (bus.state && scope?.sessionId === bus.sessionId && bus.state.selfCheck && !bus.state.selfCheck.ok && !bus.state.selfCheck.unbound) ? '!' : null,
              component: (props) => h(RightPanel, { ctx, t, scope: props.scope, visible: props.visible, onOpenFile: props.onOpenFile }),
            }); } catch (e) {
              if (!warned) { warned = true; console.warn('[skill-set-manager] rightTab 注册失败，看门狗持续重试:', e?.message ?? e); }
              off = null; return false;
            }
            return true;
          };
          tryReg();
          // 3s 看门狗：服务缺席、热替换竞态、以及 betterSidebar 自身热重载后新注册表
          // 丢我方注册（review m2）——getTab 探活失败即重挂，openTab 不再静默 no-op。
          const id = setInterval(() => {
            const svc = ctx.get('betterSidebar');
            if (!svc) return;
            let alive = false;
            try { alive = !!off && !!svc.getTab?.(TAB_ID); } catch { alive = false; }
            if (alive) return;
            off = null; tryReg();
          }, 3000);
          return () => { clearInterval(id); off?.(); };
        }, 'skill-set-manager.rightTab');
        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left', id: PKG, order: 30, label: () => t('chip'),
        }, (props) => h(ComposerChip, { ctx, t, sessionId: props?.sessionId })));
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: PKG, order: 30,
        }, () => h(OverlayHost, { ctx, t, bs: ctx.get('betterSidebar') })));
        // 设置页（§10.1.4 探针事实：注册面仅 id/order/label；label thunk 随 locale 自动跟随）
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: PKG, order: 90, label: () => t('settingsLabel'),
        }, () => h(SettingsSection, { ctx, t })));
      },
    };
  },
});
