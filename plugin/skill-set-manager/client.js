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
        rootDrift: '（≠ 会话目录——切换影响该仓库全部会话）', // 「全局常驻」纯文本行口径随美化退役（死键 resident 已删，呈现见 residentRow/徽章族）
        managedSec: '技能集提供（受管）', override: '临时覆盖', overrideOn: '临时覆盖中', endOverride: '结束覆盖',
        ovRemoved: '已被剔除', ovRestoreTip: '重新勾选即恢复本会话生效', overrideHint: '临时覆盖中：在「受管」区取消勾选 = 仅本会话剔除（不改技能集）；重新勾选或「结束覆盖」即恢复；要从集合里永久移除请用集合区「编辑成员」',
        undo: '撤销切换（回到上一份生效清单）', switchTo: '切换', current: '当前', saveAs: '另存为当前清单',
        newName: '新名称', copy: '复制', rename: '改名', del: '删除', confirmDel: '确认删除该技能集？受影响项目将冻结绑定',
        confirmSwitch: '确认切换：将改写仓库根的 .agents/skills/（仅托管条目）', exportJson: '导出', importJson: '导入',
        regen: '重新生成', claimForeign: '接管失配条目', claimForeignHint: '把「名字在本集里、盘上已存在、且确实指向库/生效区」的链接补回托管台账（只补台账，不动盘上条目）', pruneMissing: '从集合移除缺失成员', draftHint: '未绑定：勾选即本会话临时生效（会话结束自动撤下）；要固化就在上方输入集合名 → 「另存为当前清单」创建并绑定本项目（常驻全局技能不在候选中）', noBinding: '未绑定技能集', skillsCount: '个技能', loadFailed: '加载失败',
        opFailed: '操作失败', empty: '（暂无技能集）', hintP2: '技能变化下一轮请求生效；本面板操作后 / 菜单列表即同步刷新',
        copyClip: '复制到剪贴板', copied: '已复制 ✓', copyFail: '复制失败',
        noSession: '先在对话页打开一个会话',
        settingsLabel: '技能集管理器', tabLibrary: '库', tabOps: '安装与更新', tabDiag: '诊断',
        filterPh: '按名称/来源过滤', managedTag: '受管', unmanagedTag: '未登记', modifiedTag: '本地改动',
        backupsTitle: '回收站', restoreGo: '恢复', applyUp: '应用更新', checkingUp: '检查更新中…', applyingUp: '应用更新中…', // 死键 checkUp 已删（行内图标钮用 sAriaCheckUpd，无其它使用者）
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
        // 长任务态（设计 2026-10-29）：阶段文案只描述「还在等 host」，不假装知道真实边界
        taskConnect: '正在连接 GitHub…', taskFetching: '正在浅克隆仓库并检出文件…', taskSlowRepo: '仍在拉取：大仓库可能要 1–2 分钟',
        taskImport: '正在按 pin 安装所选技能…', taskUpdateCheck: '正在比对远端 commit…', taskUpdateApply: '正在拉取远端并写回本地…',
        taskUninstall: '正在卸载并回收托管条目…', taskMigrate: '正在迁移存量条目…',
        taskElapsed: '已等待 {n}s', taskBusyWith: '正在{n}，请先等它跑完', taskDismiss: '清除',
        taskOpInstall: '安装', taskOpImport: '导入', taskOpUninstall: '卸载', taskOpMigrate: '迁移', taskOpCheck: '检查更新', taskOpApply: '应用更新',
        opPartial: '部分完成：{n} 装入 · {m} 未装（逐条结果见「运维」页签）',
        // 面板美化（spec 2026-11-06）：新结构文案键（Task 2/3/4 消费）
        effTitle: '生效清单', candidates: '候选', notActive: '未生效',
        ovBanner: '临时覆盖中 · 剔除 {n} 项 · 加入 {m} 项',
        grayResident: '全局常驻', grayForeign: '外来常驻', grayProvider: '插件/Preset 提供', grayItems: '项',
        otherSec: '其他（不受技能集管控）',
        descPh: '描述（可空）', emptySearch: '没有匹配的技能', emptyList: '当前没有生效技能', updatedAt: '更新于',
        ariaExpand: '展开', ariaCollapse: '收起', ariaPick: '勾选',
        // 设置页/右栏美化（spec 2026-11-07）：基座新键，一次补齐（Task 3–6 消费；zh/en 同键集）
        rpModified: '本地改动',
        sAriaCheckUpd: '检查更新', sAriaTrashBin: '移入回收站', sAriaClaim: '改认领', sAriaUninstall: '卸载', sAriaReload: '刷新',
        sEmptyLib: '技能库还没有技能：到「安装与更新」页签从 GitHub 安装', sEmptyGlobal: '还没有全局常驻技能：勾选候选即在所有项目生效', sEmptyDiag: '未发现异常',
      },
      en: {
        chip: 'Skill sets', panel: 'Skill Set Manager', close: 'Close', sets: 'Skill sets', projectRoot: 'Project root',
        rootDrift: '(≠ session dir — switching affects every session in this repo)', // 死键 resident 已删（无使用者，见 zh 侧同注）
        managedSec: 'Set-provided (managed)', override: 'Session override', overrideOn: 'Override active', endOverride: 'End override',
        ovRemoved: 'removed by override', ovRestoreTip: 'Tick again to restore for this session', overrideHint: 'Override active: unticking in the managed area removes it for this session only (the set is unchanged); tick again or "End override" to restore; to remove from the set permanently use "Edit members" in the sets area',
        undo: 'Undo switch (restore previous effective set)', switchTo: 'Switch', current: 'current', saveAs: 'Save current as set',
        newName: 'New name', copy: 'Copy', rename: 'Rename', del: 'Delete', confirmDel: 'Delete this set? Affected projects freeze their binding.',
        confirmSwitch: 'Confirm switch: rewrites .agents/skills/ at the repo root (managed entries only)', exportJson: 'Export', importJson: 'Import',
        regen: 'Regenerate', claimForeign: 'Claim mismatched entries', claimForeignHint: 'Re-register links that are named in this set, already on disk and really pointing at the library/active zones back into the managed ledger (ledger only, disk entries untouched)', pruneMissing: 'Remove missing members', draftHint: 'No set bound: ticking a skill activates it for this session only (auto-removed when the session ends); to keep it, name the set above, then "Save current as set" creates it and binds this project (global resident skills are not candidates)', noBinding: 'No skill set bound', skillsCount: 'skills', loadFailed: 'Load failed',
        opFailed: 'Operation failed', empty: '(no skill sets yet)', hintP2: 'Skill changes take effect on the next request; the / menu list refreshes right after panel operations',
        copyClip: 'Copy to clipboard', copied: 'Copied ✓', copyFail: 'Copy failed',
        noSession: 'Open a conversation session first',
        settingsLabel: 'Skill Sets', tabLibrary: 'Library', tabOps: 'Install & update', tabDiag: 'Diagnose',
        filterPh: 'Filter by name/source', managedTag: 'managed', unmanagedTag: 'untracked', modifiedTag: 'locally modified',
        backupsTitle: 'Trash', restoreGo: 'Restore', applyUp: 'Apply update', checkingUp: 'Checking…', applyingUp: 'Applying…', // 死键 checkUp 已删（见 zh 侧同注）
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
        taskConnect: 'Connecting to GitHub…', taskFetching: 'Shallow-cloning the repo and checking out files…', taskSlowRepo: 'Still fetching: large repos can take 1–2 minutes',
        taskImport: 'Installing the selected skills by pin…', taskUpdateCheck: 'Comparing against the remote commit…', taskUpdateApply: 'Fetching the remote and writing files back…',
        taskUninstall: 'Uninstalling and reclaiming managed entries…', taskMigrate: 'Migrating legacy entries…',
        taskElapsed: 'Waiting {n}s', taskBusyWith: '{n} in progress — wait for it to finish', taskDismiss: 'Dismiss',
        taskOpInstall: 'Install', taskOpImport: 'Import', taskOpUninstall: 'Uninstall', taskOpMigrate: 'Migrate', taskOpCheck: 'Update check', taskOpApply: 'Apply update',
        opPartial: 'Partially done: {n} installed · {m} skipped (per-skill results are in the Ops tab)',
        // panel beautify (spec 2026-11-06): keys for the new structure (consumed by Tasks 2-4)
        effTitle: 'Effective list', candidates: 'Candidates', notActive: 'not active',
        ovBanner: 'Session override active · {n} removed · {m} added',
        grayResident: 'Global resident', grayForeign: 'Foreign resident', grayProvider: 'Plugin / preset-provided', grayItems: 'items',
        otherSec: 'Other (outside skill-set control)',
        descPh: 'Description (optional)', emptySearch: 'no matching skills', emptyList: 'no skills are active right now', updatedAt: 'updated',
        ariaExpand: 'expand', ariaCollapse: 'collapse', ariaPick: 'tick',
        // settings/right-panel beautify (spec 2026-11-07): base keys, added up front (consumed by Tasks 3-6; same key set as zh)
        rpModified: 'locally modified',
        sAriaCheckUpd: 'check for updates', sAriaTrashBin: 'move to trash', sAriaClaim: 're-claim source', sAriaUninstall: 'uninstall', sAriaReload: 'reload',
        sEmptyLib: 'No skills in the library yet — install from GitHub in the Install & update tab', sEmptyGlobal: 'No global resident skills yet: tick candidates to make them active in every project', sEmptyDiag: 'No issues found',
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

    /**
     * 慢操作登记表（设计 2026-10-29）：键 = RPC 名。T = 进度条时间常数（ms）；
     * stages = [文案键, 起始 ms] 递增阶梯；label = 被挡住按钮 title 里的短名。
     * 阶段与百分比都是按耗时的猜测——真边界要 host 把 git 改异步 spawn 并解析 --progress，本期明确排除。
     */
    const SLOW_OPS = {
      installApply: { T: 25000, label: 'taskOpInstall', stages: [['taskConnect', 0], ['taskFetching', 10000], ['taskSlowRepo', 60000]] },
      importApply: { T: 25000, label: 'taskOpImport', stages: [['taskImport', 0], ['taskSlowRepo', 60000]] },
      updateCheck: { T: 15000, label: 'taskOpCheck', stages: [['taskUpdateCheck', 0]] },
      updateApply: { T: 20000, label: 'taskOpApply', stages: [['taskUpdateApply', 0]] },
      uninstallSkill: { T: 6000, label: 'taskOpUninstall', stages: [['taskUninstall', 0]] },
      migrateApply: { T: 6000, label: 'taskOpMigrate', stages: [['taskMigrate', 0]] },
      migrateUndo: { T: 6000, label: 'taskOpMigrate', stages: [['taskMigrate', 0]] },
      migrateAgentsApply: { T: 6000, label: 'taskOpMigrate', stages: [['taskMigrate', 0]] },
      migrateAgentsUndo: { T: 6000, label: 'taskOpMigrate', stages: [['taskMigrate', 0]] },
    };

    /**
     * 模块级长任务态（用户 2026-10-29：安装中退出设置界面，回来必须仍见进度与最终结果）。
     * promise 本来就与组件无关（host 侧无人取消），丢的一直是 UI 侧的状态与结果——所以状态不放 useState。
     * 单飞：host 没有取消能力（git 走 spawnSync），并行没有真实收益，同名技能还会互踩，故全局只允许一个。
     */
    const tasks = { seq: 0, running: null, last: null, subs: new Set() };
    const emitTasks = () => tasks.subs.forEach((f) => f());
    function useTasks() {
      const [, bump] = React.useState(0);
      React.useEffect(() => {
        const fn = () => bump((v) => v + 1);
        tasks.subs.add(fn);
        return () => tasks.subs.delete(fn);
      }, []);
      return tasks;
    }
    /** 起一个长任务。已在飞 → 返回 false 且不改任何状态；调用方据此给按钮挂 title 说明被谁挡住。 */
    function startLong(ctx, op, target, args, opts = {}) {
      if (tasks.running) return false;
      const task = {
        id: (tasks.seq += 1), op, target, note: null, T: opts.T ?? SLOW_OPS[op].T,
        startedAt: Date.now(), doneAt: null, status: 'running', result: null, error: null, warnings: [],
      };
      tasks.running = task; tasks.last = task; emitTasks();
      const settle = (s) => {
        task.status = s.ok ? 'ok' : 'err';
        task.result = s.value; task.error = s.error; task.warnings = s.warnings; try { task.note = opts.noteOf?.(s) ?? s.note ?? null; } catch { task.note = null; } // noteOf 只是附加说明，抛错不得卡住 settle（终审 N1）
        task.doneAt = Date.now(); tasks.running = null; emitTasks();
        // 收尾回调拿同一份 settled：调用方只在 ok 时写回，失败不再被 run() 的 catch 降级成「操作失败」
        opts.onDone?.({ ok: s.ok, value: s.value, error: s.error, warnings: s.warnings });
      };
      call(ctx, op, args).then(
        (value) => settle({ ok: true, value, error: null, warnings: Array.isArray(value?.warnings) ? value.warnings : [] }),
        (error) => settle({ ok: false, value: null, error, warnings: [] }),
      );
      return true;
    }
    /** 清除已结束的任务。在飞不提供清除：隐藏一个还在跑的任务，等于回到本次要修的「点了没反应」。 */
    function clearTask() { if (!tasks.running) { tasks.last = null; emitTasks(); } }
    /** 运行中永不到 100%（封顶 95）：条子自己爬满就是在谎报完成（反目标 #1）；只有 RPC 真返回才 100。 */
    const taskPercent = (task, now) => task.status !== 'running' ? 100
      : Math.min(95, Math.round(95 * (1 - Math.exp(-(now - task.startedAt) / task.T))));
    /** 按耗时挑当前阶段文案键：只说「还在等 host」，不假装知道 fetch / 写库的真实边界。 */
    const taskStageKey = (task, now) => {
      const st = SLOW_OPS[task.op]?.stages ?? [];
      const el = now - task.startedAt;
      let key = st[0]?.[0] ?? 'taskConnect';
      for (const [k, from] of st) if (el >= from) key = k;
      return key;
    };

    /**
     * 长任务条（设计 2026-10-29）：设置页页签条下方与会话面板顶部各挂一条，切页签照样看得见。
     * now 每次渲染现算 ⇒ 关掉界面再重开，耗时与阶段按 startedAt 续算、进度条不重置（Review Focus #1）。
     * 秒表只在「有任务在飞」且组件挂载时跑，卸载即 clearInterval——不挂载就不刷。
     */
    function TaskStrip({ t, tasks }) {
      const [now, setNow] = React.useState(() => Date.now());
      React.useEffect(() => {
        if (!tasks.running) return undefined;
        const tick = () => setNow(Date.now());
        tick();
        const id = setInterval(tick, 500);
        return () => clearInterval(id);
      }, [tasks, tasks.running]);
      const task = tasks.last;
      if (!task) return null;
      const pct = taskPercent(task, now);
      const secs = Math.max(0, Math.floor(((task.doneAt ?? now) - task.startedAt) / 1000));
      return h('div', { className: 'ssm-p-task' },
        h('div', { className: 'ssm-p-task-row' },
          task.status === 'running' ? h('span', { className: 'ssm-spin' }, null) : null,
          h('span', { className: 'ssm-cur' }, t(SLOW_OPS[task.op].label)),
          task.target ? h('span', { className: 'ssm-n' }, task.target) : null,
          // 失败不在这行重复「操作失败」：下方 error 横幅已带同一个 key 的前缀（终审 N3）
          h('span', { className: 'ssm-n' }, task.status === 'running' ? t(taskStageKey(task, now)) : task.status === 'ok' ? t('opDone') : null),
          h('span', { className: 'ssm-grow' }, null),
          h('span', { className: 'ssm-n' }, t('taskElapsed').replace('{n}', `${secs}`)),
          // 在飞不提供 ×：隐藏一个还在跑的任务，等于回到本次要修的「点了没反应」（设计末条判断）
          tasks.running ? null : h('button', { className: 'ssm-p-icon-btn', onClick: () => clearTask(), title: t('taskDismiss') }, h(Icon, { n: 'x' }))),
        h('div', { className: 'ssm-bar' },
          h('div', { className: task.status === 'err' ? 'ssm-bar-fill ssm-bar-err' : task.status === 'ok' ? 'ssm-bar-fill ssm-bar-ok' : 'ssm-bar-fill', style: { width: pct + '%' } })),
        // 明细行换 .ssm-p-banner 语态（Task 2 转交项：横幅壳下不再挂旧 .ssm-err/.ssm-warn 小底行；文案与语义零改动，⚠ 由 alert 图标承载）
        task.status === 'err' ? h('div', { className: 'ssm-p-banner ssm-p-banner-error' }, h(Icon, { n: 'alert' }), `${t('opFailed')}: ${String(task.error?.message ?? task.error ?? '')}`) : null,
        task.note ? h('div', { className: 'ssm-p-descwrap' }, task.note) : null,
        // warnings 必须逐行可见：台账失配态下盘上什么都没做，理由只存在于 warnings（历史教训 2026-10-27）
        ...(task.warnings ?? []).map((w, i) => h('div', { key: 'tw' + i, className: 'ssm-p-banner ssm-p-banner-warn' }, h(Icon, { n: 'alert' }), w)));
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

    /**
     * 共享行壳（spec 2026-11-07 §6.2）：设置页/右栏共用的行卡骨架（Task 6 起弹框 SkillRow 也收口到这里）。
     * 槽位：leading（复选框/色点）+ 名称 + 徽章组（PBadge 数组）+ 第二行 desc + 第三行 sub + 尾部动作条 actions；
     * gray=灰态（.ssm-p-gray 语汇）、removed=删除线、onClick=整行点击（右栏开 SKILL.md、composer 勾选行）；
     * 无 leading 的行加 tabIndex + role=button + onKeyDown（Enter/Space 触发 onClick）键盘可达（AC#13，focus 环见 .ssm-p-rowcard-click）；
     * 有 leading（行首已是可聚焦控件——composer 生效清单的裸复选框）则不挂 role/tabIndex/onKeyDown：复选框作唯一 tab 停靠点，
     * 避免每行两个停靠点、且读屏器把 button 当叶子节点吞掉内层勾选态（终审 Important 1）；行 onClick 鼠标路径与 cursor/clickTitle 照旧。
     * 行形态同款 .ssm-p-row：hover 底色 8%、:focus-visible brand 环、hover/focus-within 显形动作条；
     * 常驻动作（confirm 态）不在「.ssm-p-row 直接子级 .ssm-p-icon-btn」显形选择器覆盖范围内，天然常显。
     * desc/sub 传 React 元素时原样透传（调用方可自带 .ssm-p-desc 与 title），纯内容则包 .ssm-p-desc；空串同样跳过（空行不渲染空 div）。
     * 顶层段声明（client-scope）：Panel/SettingsSection/RightPanel 三段都要消费，不能塞进某段内部。
     * t 预留：Task 3/5/6 的 aria/文案收口再消费。
     * title=非点击行的 hover 提示（库行 = 来源 @commit(7)，spec 2026-11-07 §6.5）；onClick 行 clickTitle 优先、缺省回落 title。
     */
    function RowShell({ t, name, badges, desc, sub, actions, gray, onClick, clickTitle, leading, removed, title }) {
      const line = (v) => v == null || v === '' ? null
        : typeof v === 'object' && v && v.$$typeof ? v : h('div', { className: 'ssm-p-desc' }, v);
      return h('div', {
        className: 'ssm-p-rowcard' + (gray ? ' ssm-p-gray' : '') + (onClick ? ' ssm-p-rowcard-click' : ''),
        // Enter/Space 触发整行点击（Task 6.2 a11y：修右栏/设置页行卡 Enter 不触发的遗留）；Space 阻止页面滚动；
        // 只认行自身的焦点（target!==currentTarget 即放行），行内控件保持原生键盘语义不被劫持。
        // leading 有值 = 行首已是可聚焦控件（composer 复选框）：不再挂 role=button/tabIndex/onKeyDown，复选框作唯一 tab 停靠点
        // （终审 Important 1：旧版一行双停靠点 + AT 扁平化）；onClick（鼠标）与 title/clickTitle 照旧，无 leading 的行键盘行为不变。
        ...(onClick ? {
          ...(leading == null ? {
            tabIndex: 0, role: 'button',
            onKeyDown: (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); }
            },
          } : {}),
          onClick, title: clickTitle ?? title,
        } : (title ? { title } : {})),
      },
        h('div', { className: 'ssm-p-row' },
          leading ?? null,
          h('span', { className: 'ssm-p-name' + (removed ? ' ssm-p-strike' : '') }, name),
          ...(badges ?? []).map((b) => h(PBadge, { key: b.text, kind: b.kind, text: b.text })),
          h('span', { className: 'ssm-grow' }, null),
          ...(actions ?? [])),
        line(desc), line(sub));
    }

    function Panel({ ctx, t, sessionId, onClose, bs }) {
      const tasks = useTasks(); // 与设置页同一份模块级任务态：面板关掉后，导入的进行中与结果仍在这份状态里
      const [state, setState] = React.useState(null);
      const [error, setError] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [confirm, setConfirm] = React.useState(null); // {kind:'switch'|'del', slug}
      const [draft, setDraft] = React.useState('');
      const [saveOpen, setSaveOpen] = React.useState(false); // 另存为收进操作条（Task 2），展开成一行输入
      const [saveDesc, setSaveDesc] = React.useState('');
      const [descDraft, setDescDraft] = React.useState(''); // 改名行的描述输入（spec §6.6）
      const [openZones, setOpenZones] = React.useState({}); // 折叠灰区展开态（spec §6.3：常驻/外来常驻/插件提供）
      const [renaming, setRenaming] = React.useState(null); // slug | null（面板内改名，Electron 无 window.prompt）
      const [renameDraft, setRenameDraft] = React.useState('');
      const [io, setIo] = React.useState(null); // {mode:'export'|'import', text, copied?}
      const [confirmUnbind, setConfirmUnbind] = React.useState(false);
      const [edit, setEdit] = React.useState(null); // {slug, picked:{name:true}}——编辑成员表单（§5#2）
      const [q, setQ] = React.useState(''); // P3 搜索框（设计 §6.3）：非空 → 结果列表替换三区
      const [mq, setMq] = React.useState(''); // P3 成员编辑表单过滤（§6.2；勾选态 picked 按名字存，过滤不丢）
      const locked = !!tasks.running || busy; // 长任务在飞时 host 事件循环也被 spawnSync 占住，此处不再另起 RPC
      const busyTitle = tasks.running ? t('taskBusyWith').replace('{n}', t(SLOW_OPS[tasks.running.op].label)) : undefined;
      // 导入结果改从任务态读（原 io.applied 是组件 state，一关面板就没了）
      const importDone = tasks.last?.op === 'importApply' && tasks.last.status === 'ok' ? tasks.last.result : null;
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
      if (!state && !error) return h('div', { className: 'ssm-p-panel', role: 'dialog', 'aria-label': t('panel'), onClick: (e) => e.stopPropagation() },
        h('div', { className: 'ssm-p-head' },
          h(Dot, { st: null }), h('span', { className: 'ssm-p-cur' }, '…'), h('span', { className: 'ssm-grow' }, null),
          h('button', { className: 'ssm-p-icon-btn', onClick: onClose, 'aria-label': t('close') }, h(Icon, { n: 'x' }))),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          h('div', { className: 'ssm-p-skel' }), h('div', { className: 'ssm-p-skel' }), h('div', { className: 'ssm-p-skel' })));
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
      // —— 生效清单卡数据面（Task 3，spec §6.4）：徽章口径与右栏 rp* 同源 ——
      const brokenSet = new Set(sc.brokenLinks ?? []);
      const missingSet = new Set(st.effective?.missing ?? []);
      const foreignSet = new Set(sc.foreign ?? []);
      const ov = st.sessionOverride ?? {};
      const srcOf = (n) => (st.library ?? []).find((l) => l.name === n);
      // 生效行集合（甲案）：JSON 生效 ∪ 托管台账 ∪ 盘上外来，剔常驻（§5.4），字母序
      const effNames = [...new Set([...(st.effective?.names ?? []).filter((n) => !resident.has(n)), ...managed, ...foreignSet])].sort();
      const rowModel = (n) => {
        const l = srcOf(n) ?? { name: n, source: 'unknown', description: null, descriptionZh: null };
        const badges = [];
        if (managed.includes(n)) badges.push({ kind: 'brand', text: t('managedTag') });
        if (l.localModified) badges.push({ kind: 'warn', text: t('modifiedTag') });
        if (missingSet.has(n)) badges.push({ kind: 'error', text: t('rpMissing') });
        if (brokenSet.has(n)) badges.push({ kind: 'error', text: t('rpDead') });
        if (foreignSet.has(n)) badges.push({ kind: 'muted', text: t('rpForeign') });
        const title = l.source && l.source !== 'unknown' ? `${l.name} · ${l.source}${l.commit ? '@' + String(l.commit).slice(0, 7) : ''}` : (l.descriptionZh ?? l.name);
        return { l, badges, title };
      };
      // 同款列表行（Task 4 成员抽屉复用）：on=null → 只读无复选框；ro → 灰区只读行；removed → 删除线
      // Task 6.1 收口（spec 2026-11-07 §6.2）：骨架换成共享 RowShell——同一批 .ssm-p-* 原子件，DOM 由 rowwrap 换行卡；
      // 勾选语义照旧：原 label 包整行（点名字=勾选）现由行 onClick 承接——点复选框本身走 input onChange，
      // 点击目标命中 input 即跳过，绝不双跑 RPC；busy 时不挂 onClick=整行不可点，同「被禁 input 的 label 不激活」口径。
      const SkillRow = ({ key, l, on, ro, removed, onChange, badges, title }) => {
        const desc = l.descriptionZh
          ? h('div', { className: 'ssm-p-desc', title: l.description ?? undefined }, l.descriptionZh)
          : l.description
            ? h('div', { className: 'ssm-p-desc', title: l.description }, l.description, ' ', h(PBadge, { kind: 'muted', text: t('pendingTag') }))
            : null;
        return h(RowShell, {
          key, t, name: l.name, badges, desc, gray: !!ro, removed,
          title: title ?? l.descriptionZh ?? undefined,
          leading: on == null ? null : h('input', { type: 'checkbox', checked: on === true, disabled: busy, 'aria-label': l.name, onChange: () => onChange?.() }),
          ...(on != null && !busy ? { onClick: (e) => { if (e.target?.closest?.('input')) return; onChange?.(); } } : {}),
        });
      };
      // 折叠灰区一行（3.3）：默认收起「图标 标签 · N 项 ▸」，展开 = 只读同款行 + 既有 hint 文案
      const ZoneRow = (zone, label, icon, names, hint) => names.length
        ? h(React.Fragment, { key: 'zone-' + zone },
            h('button', { className: 'ssm-p-collapse', disabled: busy, 'aria-expanded': openZones[zone] ? 'true' : 'false', 'aria-label': openZones[zone] ? t('ariaCollapse') : t('ariaExpand'), onClick: () => setOpenZones({ ...openZones, [zone]: !openZones[zone] }) },
              h(Icon, { n: icon, s: 13 }), label, ' · ', String(names.length), ' ', t('grayItems'),
              h('span', { className: 'ssm-grow' }, null), h(Icon, { n: 'chevron', s: 12 })),
            openZones[zone]
              ? h(React.Fragment, null,
                  ...names.map((n) => SkillRow({ key: 'z-' + n, l: srcOf(n) ?? { name: n, source: '', description: null, descriptionZh: null }, on: null, ro: true, badges: [], title: hint })),
                  h('div', { className: 'ssm-hint' }, hint))
              : null)
        : null;
      return h('div', { className: 'ssm-p-panel', role: 'dialog', 'aria-label': t('panel'), onClick: (e) => e.stopPropagation() },
        h('div', { className: 'ssm-p-head' },
          h(Dot, { st: state }),
          st.binding?.setSlug ? h('span', { className: 'ssm-p-cur' }, st.set?.name ?? st.binding.setSlug) : h('span', { className: 'ssm-p-cur' }, t('noBinding')),
          st.set?.skills?.length ? h(PBadge, { kind: 'muted', text: `${st.set.skills.length} ${t('skillsCount')}` }) : null,
          h('span', { className: 'ssm-grow' }, null),
          bs || ctx.get('betterSidebar') ? h('button', { className: 'ssm-p-icon-btn', title: t('openRight'), 'aria-label': t('openRight'), onClick: () => (bs ?? ctx.get('betterSidebar'))?.openTab({ type: 'skill-set-manager:detail', title: t('tabTitle') }, { sessionId }) }, h(Icon, { n: 'external' })) : null,
          h('button', { className: 'ssm-p-icon-btn', onClick: onClose, 'aria-label': t('close') }, h(Icon, { n: 'x' }))),
        h(TaskStrip, { t, tasks }), // 面板顶部一条：导入块（io）被关掉后，进度与结果仍在这行上（设计 §5）
        st.projectRoot ? h('div', { className: 'ssm-p-rootline' }, h('span', { title: st.projectRoot }, t('projectRoot'), '：', st.projectRoot), st.rootDrift ? h(PBadge, { kind: 'warn', text: t('rootDrift') }) : null) : null,
        st.presetWarn ? h('div', { className: 'ssm-p-banner ssm-p-banner-warn' }, h(Icon, { n: 'alert' }), st.presetWarn) : null,
        sc.ok === false && !sc.unbound
          ? h('div', { className: `ssm-p-banner ${sc.frozen ? 'ssm-p-banner-warn' : 'ssm-p-banner-error'}` }, h(Icon, { n: 'alert' }), sc.detail, ' ',
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
        error ? h('div', { className: 'ssm-p-banner ssm-p-banner-error' }, h(Icon, { n: 'alert' }), error) : null,
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
        h('div', { className: 'ssm-p-card' },
          h('div', { className: 'ssm-p-card-title' }, t('sets'), (st.sets ?? []).length ? h(PBadge, { kind: 'muted', text: String((st.sets ?? []).length) }) : null),
          (st.sets ?? []).length === 0 ? h('div', { className: 'ssm-p-desc' }, t('empty')) : null,
          ...(st.sets ?? []).map((s) => h('div', { key: s.slug, className: 'ssm-p-setrow' + (st.binding?.setSlug === s.slug ? ' ssm-p-setrow-cur' : '') },
            h('div', { className: 'ssm-p-row' },
              h('button', { className: 'ssm-p-pick', disabled: busy || st.binding?.setSlug === s.slug, title: st.binding?.setSlug === s.slug ? undefined : t('switchTo'), onClick: () => doSwitch(s.slug) },
                h('span', { className: 'ssm-p-setname' }, s.name),
                st.binding?.setSlug === s.slug ? h(PBadge, { kind: 'brand', text: t('current') }) : null,
                h(PBadge, { kind: 'muted', text: `${(s.skills ?? []).length} ${t('skillsCount')}` }),
                s.updatedAt ? h('span', { className: 'ssm-p-desc' }, `${t('updatedAt')} ${String(s.updatedAt).slice(0, 10)}`) : null),
              h('span', { className: 'ssm-grow' }, null),
              h('button', { className: 'ssm-p-icon-btn', disabled: busy, title: t('editMembers'), 'aria-label': t('editMembers'), onClick: () => setEdit({ slug: s.slug, picked: Object.fromEntries((s.skills ?? []).map((n) => [n, true])), desc: s.description ?? '' }) }, h(Icon, { n: 'users' })),
              h('button', { className: 'ssm-p-icon-btn', disabled: busy, title: t('copy'), 'aria-label': t('copy'), onClick: () => run(() => call(ctx, 'copySet', { slug: s.slug })) }, h(Icon, { n: 'copy' })),
              h('button', { className: 'ssm-p-icon-btn', disabled: busy, title: t('rename'), 'aria-label': t('rename'), onClick: () => { setRenaming(s.slug); setRenameDraft(s.name); setDescDraft(s.description ?? ''); } }, h(Icon, { n: 'pencil' })),
              h('button', { className: 'ssm-p-icon-btn ssm-p-icon-danger', disabled: busy, title: t('del'), 'aria-label': t('del'), onClick: () => setConfirm({ kind: 'del', slug: s.slug }) }, h(Icon, { n: 'trash' }))),
            s.description ? h('div', { className: 'ssm-p-desc' }, s.description) : null,
            renaming === s.slug
              ? h('div', { className: 'ssm-p-row' },
                  h('input', { className: 'ssm-input', autoFocus: true, value: renameDraft, disabled: busy, 'aria-label': t('rename'), onChange: (e) => setRenameDraft(e.target.value) }),
                  h('input', { className: 'ssm-input', placeholder: t('descPh'), value: descDraft, disabled: busy, 'aria-label': t('descPh'), onChange: (e) => setDescDraft(e.target.value) }),
                  h('button', { disabled: busy || !renameDraft.trim(), onClick: () => run(async () => { const name = renameDraft.trim(); if (name !== s.name) await call(ctx, 'renameSet', { slug: s.slug, name }); if (descDraft !== (s.description ?? '')) await call(ctx, 'saveSet', { set: { slug: s.slug, name, description: descDraft, skills: s.skills ?? [] } }); setRenaming(null); }) }, '✓'),
                  h('button', { disabled: busy, onClick: () => setRenaming(null) }, '×'))
              : null,
          // 编辑成员抽屉（Task 4，spec §6.5）：chips → 同款 SkillRow；顶部描述输入（§6.6 入口③）；saveSet 写回语义不变
          // ——该路径仍由 verify case edit-members 固化（摘旧加新、台账无残留、自检绿）。
          edit?.slug === s.slug
            ? h('div', { className: 'ssm-p-card' },
                h('div', { className: 'ssm-p-card-title' }, t('editTitle'), ' ', s.name,
                  h('span', { className: 'ssm-grow' }, null),
                  h(Icon, { n: 'search', s: 12 }),
                  h('input', { className: 'ssm-p-search', placeholder: t('searchPh'), value: mq, disabled: busy, 'aria-label': t('searchPh'), onChange: (e) => setMq(e.target.value) }),
                  mq ? h('button', { className: 'ssm-p-icon-btn', disabled: busy, 'aria-label': t('none'), onClick: () => setMq('') }, h(Icon, { n: 'x', s: 12 })) : null),
                h('div', { className: 'ssm-p-row' },
                  h('input', { className: 'ssm-input', placeholder: t('descPh'), value: edit.desc ?? '', disabled: busy, 'aria-label': t('descPh'), onChange: (e) => setEdit({ ...edit, desc: e.target.value }) })),
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
                ).map((row) => SkillRow({ key: row.name, l: row, on: !!edit.picked[row.name],
                  badges: [
                    ...((st.library ?? []).some((l) => l.name === row.name) ? [] : [{ kind: 'warn', text: t('memberMissing') }]),
                    ...((resident.has(row.name) || foreignRes.has(row.name)) ? [{ kind: 'muted', text: t('memberResidentTag') }] : []),
                  ],
                  onChange: () => setEdit({ ...edit, picked: { ...edit.picked, [row.name]: !edit.picked[row.name] } }) })),
                h('div', { className: 'ssm-hint' }, t('memberHint')),
                h('div', { className: 'ssm-row' },
                  h('button', { disabled: busy, onClick: () => run(async () => {
                    await call(ctx, 'saveSet', { set: { slug: s.slug, name: s.name, description: edit.desc ?? '', skills: Object.keys(edit.picked).filter((n) => edit.picked[n]) } }); // 描述随保存一并写回（§6.6 入口③，host 透传）
                    if (st.binding?.setSlug === s.slug) await call(ctx, 'bind', { sessionId, slug: s.slug }); // 立即收敛生效清单，不留「改了但没生效」窗口
                    setEdit(null);
                  }) }, t('saveBtn')),
                  h('button', { disabled: busy, onClick: () => setEdit(null) }, '×')))
            : null)),
          h('div', { className: 'ssm-p-actions' },
            saveOpen
              ? h('div', { className: 'ssm-p-row', style: { width: '100%' } },
                  h('input', { className: 'ssm-input', autoFocus: true, placeholder: t('newName'), value: draft, disabled: busy, 'aria-label': t('newName'), onChange: (e) => setDraft(e.target.value) }),
                  h('input', { className: 'ssm-input', placeholder: t('descPh'), value: saveDesc, disabled: busy, 'aria-label': t('descPh'), onChange: (e) => setSaveDesc(e.target.value) }),
                  h('button', { disabled: busy || !draft.trim() || (!bound && !managed.length), onClick: () => run(async () => {
                    const name = draft.trim();
                    // 未绑定走当前临时清单（候选已剔常驻）；已绑定隐式 = 生效清单，host 端剔常驻（save-as-resident CASE）
                    const s = await call(ctx, 'saveAsFromEffective', { sessionId, name, ...(bound ? {} : { names: [...managed] }) });
                    if (saveDesc.trim() && s?.slug) await call(ctx, 'saveSet', { set: { slug: s.slug, name, description: saveDesc.trim(), skills: s.skills ?? [] } }); // 描述补写入（spec §6.6，host 透传）
                    if (!bound && s?.slug) await call(ctx, 'bind', { sessionId, slug: s.slug }); // 存集即生效（dropOverrideOnBind）
                    setDraft(''); setSaveDesc(''); setSaveOpen(false);
                  }) }, '✓'),
                  h('button', { disabled: busy, onClick: () => { setSaveOpen(false); setDraft(''); setSaveDesc(''); } }, '×'))
              : null,
            h('button', { className: 'ssm-p-icon-btn', disabled: busy || (!bound && !managed.length), title: !bound && !managed.length ? t('draftHint') : t('saveAs'), 'aria-label': t('saveAs'), onClick: () => setSaveOpen(true) }, h(Icon, { n: 'download' })),
            h('button', { className: 'ssm-p-icon-btn', disabled: busy, title: t('importJson'), 'aria-label': t('importJson'), onClick: () => setIo({ mode: 'import', text: '{"sets":[]}', copied: false }) }, h(Icon, { n: 'upload' })),
            h('button', { className: 'ssm-p-icon-btn', disabled: busy, title: t('exportJson'), 'aria-label': t('exportJson'), onClick: async () => { try { const arr = await Promise.all((st.sets ?? []).map((x) => call(ctx, 'exportSet', { slug: x.slug }))); setIo({ mode: 'export', text: JSON.stringify({ sets: arr.flatMap((j) => j.sets ?? []) }, null, 2), copied: false }); } catch (e) { setError(`${t('opFailed')}: ${e?.message ?? e}`); } } }, h(Icon, { n: 'copy' })),
            st.undoAvailable ? h('button', { className: 'ssm-p-icon-btn', disabled: busy, title: t('undo'), 'aria-label': t('undo'), onClick: () => run(() => call(ctx, 'undoSwitch', { sessionId })) }, h(Icon, { n: 'undo' })) : null,
            h('span', { className: 'ssm-grow' }, null),
            st.binding?.setSlug ? h('button', { className: 'ssm-p-icon-btn ssm-p-icon-danger', disabled: busy, title: t('unbindGo'), 'aria-label': t('unbindGo'), onClick: () => setConfirmUnbind(true) }, h(Icon, { n: 'linkOff' })) : null),
        ),
        // 另存为/导入行已收进技能集卡底部操作条（Task 2，spec §6.3）
        io
          ? h('div', { className: 'ssm-p-card' },
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
              // 导入结果回显（评审 I2 + 用户 2026-10-29）：四组计数从任务态读；warnings 由上方 TaskStrip 逐行显示，不重复一遍
              importDone
                ? h('div', { className: 'ssm-io' },
                    h('div', { className: 'ssm-ok' },
                      `${t('importApplied')}：` + ([[importDone.created?.length ?? 0, t('sets')], [importDone.installed?.length ?? 0, t('importChoiceInstall')], [importDone.placeholders?.length ?? 0, t('importChoicePlaceholder')], [importDone.ignored?.length ?? 0, t('importChoiceIgnore')], [(importDone.nameConflicts?.length ?? 0) + (importDone.errors?.length ?? 0), t('importConflict')]].filter((p) => p[0]).map((p) => `${p[1]} ${p[0]}`).join(' · ') || t('none')),
                      (importDone.created ?? []).length ? `（${importDone.created.map((c) => c.slug).join('、')}）` : ''))
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
                        disabled: locked, title: busyTitle,
                        onClick: () => startLong(ctx, 'importApply', null, { payload: io.payload, choices: io.choices }, {
                          // 预期耗时按「按 pin 安装」的技能数放大：每个技能各自浅克隆一次仓库，25s 是单个的量级
                          T: 25000 * Math.max(1, Object.values(io.choices ?? {}).filter((c) => c === 'install').length),
                          onDone: () => { reload(); bus.refresh(sessionId); }, // 左面板与右栏详情同步刷新（用户 2026-10-27）
                        }),
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
        st.binding?.setSlug && confirmUnbind
          ? h('div', { className: 'ssm-confirm' }, t('confirmUnbind'), ' ',
              h('button', { autoFocus: true, disabled: busy, className: 'ssm-danger', onClick: () => run(() => call(ctx, 'unbind', { sessionId })) }, t('unbindGo')),
              h('button', { onClick: () => setConfirmUnbind(false) }, '×'))
          : null,
        (sc.foreign?.length ? h('div', { className: 'ssm-hint' }, t('foreignLine'), '：', (sc.foreign ?? []).join(', ')) : null),
        // 生效清单卡（甲案，spec §6.4）：搜索框并进标题行；默认视图 = 生效行 + 折叠灰区；搜索 = 生效中/候选两段
        h('div', { className: 'ssm-p-card' },
          h('div', { className: 'ssm-p-card-title' },
            t('effTitle'), h(PBadge, { kind: 'muted', text: String(effNames.length) }),
            h('span', { className: 'ssm-grow' }, null),
            h(Icon, { n: 'search', s: 12 }),
            h('input', { className: 'ssm-p-search', placeholder: t('searchPh'), value: q, disabled: busy, 'aria-label': t('searchPh'), onChange: (e) => setQ(e.target.value) }),
            q ? h('button', { className: 'ssm-p-icon-btn', disabled: busy, 'aria-label': t('none'), onClick: () => setQ('') }, h(Icon, { n: 'x', s: 12 })) : null),
          bound && st.sessionOverrideActive
            ? h('div', { className: 'ssm-p-banner ssm-p-banner-warn' }, h(Icon, { n: 'alert' }),
                t('ovBanner').replace('{n}', String((ov.removed ?? []).length)).replace('{m}', String((ov.added ?? []).length)),
                h('span', { className: 'ssm-grow' }, null),
                h('button', { disabled: busy, onClick: () => run(() => call(ctx, 'endOverride', { sessionId })) }, t('endOverride')))
            : null,
          !bound ? h('div', { className: 'ssm-p-banner ssm-p-banner-muted' }, h(Icon, { n: 'linkOff' }), t('draftHint')) : null,
          qq
            ? h(React.Fragment, null,
                ...(() => { // 搜索两段视图（3.4）+「其他」灰段（review#5：搜常驻/插件名不再假阴性，旧灰行命中能力保留）
                  const hitSet = new Set(hits.map((l) => l.name));
                  const act = effNames.filter((n) => hitSet.has(n));
                  const cand = (st.library ?? []).filter((l) => !eff.has(l.name) && (bound || (!resident.has(l.name) && !foreignRes.has(l.name)))).filter((l) => hitSet.has(l.name));
                  const other = hits
                    .filter((l) => !act.includes(l.name) && !cand.some((c) => c.name === l.name) && (resident.has(l.name) || foreignRes.has(l.name) || providerSet.has(l.name)))
                    .map((l) => SkillRow({ key: 'oth-' + l.name, l, on: null, ro: true,
                      badges: [{ kind: 'muted', text: resident.has(l.name) ? t('grayResident') : foreignRes.has(l.name) ? t('grayForeign') : t('grayProvider') }],
                      title: resident.has(l.name) ? t('residentRow') : foreignRes.has(l.name) ? t('foreignRow') : t('providerRowGo') }));
                  if (!act.length && !cand.length && !other.length) return [h('div', { className: 'ssm-p-empty' }, h(Icon, { n: 'fileWarn', s: 16 }), t('emptySearch'))];
                  return [
                    ...(act.length ? [
                      h('div', { className: 'ssm-p-seclabel' }, t('effTitle'), ' ', String(act.length)),
                      ...act.map((n) => { const { l, badges, title } = rowModel(n); return SkillRow({ key: n, l, on: foreignSet.has(n) ? null : eff.has(n), badges, title, onChange: () => run(() => call(ctx, 'startOverride', { sessionId, ...(eff.has(n) ? { remove: [n] } : { add: [n] }) })) }); }),
                    ] : []),
                    ...(cand.length ? [
                      h('div', { className: 'ssm-p-seclabel' }, t('candidates'), ' ', String(cand.length)),
                      ...cand.map((l) => SkillRow({ key: l.name, l, on: bound ? false : managed.includes(l.name), badges: [{ kind: 'muted', text: t('notActive') }], title: l.descriptionZh ?? undefined, onChange: () => run(() => call(ctx, 'startOverride', { sessionId, ...(managed.includes(l.name) ? { remove: [l.name] } : { add: [l.name] }) })) })),
                    ] : []),
                    ...(other.length ? [
                      h('div', { className: 'ssm-p-seclabel' }, t('otherSec'), ' ', String(other.length)),
                      ...other,
                    ] : [])];
                })())
            : h(React.Fragment, null,
                effNames.length ? null : h('div', { className: 'ssm-p-empty' }, h(Icon, { n: 'fileWarn', s: 16 }), t('emptyList')),
                // 勾选语义照抄现 chips：勾上取消 = startOverride remove；未勾勾上 = add（不许反）
                ...effNames.map((n) => { const { l, badges, title } = rowModel(n); return SkillRow({ key: n, l, on: foreignSet.has(n) ? null : true, badges, title, onChange: () => run(() => call(ctx, 'startOverride', { sessionId, remove: [n] })) }); }),
                // 被覆盖剔除的集成员（用户 2026-10-26）：挪列表底部，删除线 + 「已被剔除」，勾回 = add
                ...(ov.removed ?? []).map((n) => { const { l, badges } = rowModel(n); return SkillRow({ key: 'ovr-' + n, l, on: false, removed: true, badges: [...badges, { kind: 'warn', text: t('ovRemoved') }], title: t('ovRestoreTip'), onChange: () => run(() => call(ctx, 'startOverride', { sessionId, add: [n] })) }); }),
                // 候选折叠段（用户报告 2026-11-06：默认视图候选只能靠搜索、入口太深）：点开=旧「临时覆盖」区同款可勾选列表
                // 口径与搜索视图候选段一致：bound = 库−生效；未绑定 = 库−常驻−外来常驻，勾上=add、取消=remove（草稿语义照旧）
                (() => {
                  const cand = (st.library ?? []).filter((l) => !eff.has(l.name) && (bound || (!resident.has(l.name) && !foreignRes.has(l.name))));
                  return cand.length
                    ? h(React.Fragment, null,
                        h('button', { className: 'ssm-p-collapse', disabled: busy, 'aria-expanded': openZones.cand ? 'true' : 'false', 'aria-label': openZones.cand ? t('ariaCollapse') : t('ariaExpand'), onClick: () => setOpenZones({ ...openZones, cand: !openZones.cand }) },
                          h(Icon, { n: 'search', s: 13 }), t('candidates'), ' · ', String(cand.length), ' ', t('grayItems'),
                          h('span', { className: 'ssm-grow' }, null), h(Icon, { n: 'chevron', s: 12 })),
                        openZones.cand
                          ? h(React.Fragment, null,
                              ...cand.map((l) => SkillRow({ key: 'cand-' + l.name, l, on: bound ? false : managed.includes(l.name), badges: [{ kind: 'muted', text: t('notActive') }], title: l.descriptionZh ?? undefined, onChange: () => run(() => call(ctx, 'startOverride', { sessionId, ...(managed.includes(l.name) ? { remove: [l.name] } : { add: [l.name] }) })) })),
                              h('div', { className: 'ssm-hint' }, t('hintP2')))
                          : null)
                    : null;
                })(),
                ZoneRow('res', t('grayResident'), 'globe', [...resident].sort(), t('residentRow')),
                ZoneRow('fres', t('grayForeign'), 'foreign', [...foreignRes].sort(), t('foreignRow')),
                // unmanaged=null（host 未提供该字段）→ 整段不渲染（3.3）
                st.unmanaged ? ZoneRow('prov', t('grayProvider'), 'box', (st.unmanaged ?? []).map((e) => e.name).sort(), t('providerRowGo')) : null),
          h('div', { className: 'ssm-hint' }, bound ? (st.sessionOverrideActive ? t('overrideHint') : t('hintP2')) : t('hintP2')),
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
      const [openProv, setOpenProv] = React.useState(false); // 插件/Preset 灰段折叠态（spec §6.9 同款灰区语汇：默认收起，纯呈现态）
      const sessionId = scope?.sessionId ?? null;
      React.useEffect(() => { setSt(null); setDg(null); setDgErr(null); setToken(bus.token); setOpenProv(false); }, [sessionId]); // scope 切换先清旧数据（含旧会话的刷新信号）、插件灰段收回默认收起（纯呈现态，Task 5 转交），防瞬态串会话
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
      if (!sessionId) return h('div', { className: 'ssm-s-rp' }, t('rpNoSession')); // 早退只渲染 rpNoSession（数据机制照旧）
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
        // 徽章组统一到弹框口径（spec §6.9）：受管 brand / 全局常驻 muted / 外来 muted / 失效 error / 缺失 error / 本地改动 warn
        const badges = [];
        if (n in managed) badges.push({ kind: 'brand', text: t('managedTag') });
        if (resident.has(n)) badges.push({ kind: 'muted', text: t('grayResident') });
        if (foreign.has(n)) badges.push({ kind: 'muted', text: t('rpForeign') });
        if (broken.has(n)) badges.push({ kind: 'error', text: t('rpDead') });
        if (missing.has(n)) badges.push({ kind: 'error', text: t('rpMissing') });
        if (l?.localModified) badges.push({ kind: 'warn', text: t('rpModified') }); // 漂移补齐：右栏此前不显「本地改动」
        // 第二行中文用途（漂移补齐，与库页签 §6.5 同款回退：未翻译显英文 + 待翻译角标）
        const desc = l?.descriptionZh
          ? h('div', { className: 'ssm-p-desc', title: l.description ?? undefined }, l.descriptionZh)
          : l?.description
            ? h('div', { className: 'ssm-p-desc', title: l.description }, l.description, ' ', h(PBadge, { kind: 'muted', text: t('pendingTag') }))
            : null;
        // 点击开 SKILL.md 与 title=rpClick 照旧（RowShell 点击态：tabIndex+role 键盘可达）
        return h(RowShell, { key: n, t, name: n, badges, desc, ...(open ? { onClick: open, clickTitle: t('rpClick') } : {}) });
      };
      // 诊断摘要保持紧凑（spec §6.9）：5 组 × 前 3 条、仅 label: what，不展开 where/fix；角色点换已入库 .ssm-p-lvl*
      const dgRows = dg ? Object.entries({ dangling: t('diagDangling'), deadLinks: t('diagDeadLinks'), copies: t('diagCopies'), structure: t('diagStructure'), env: t('diagEnv') })
        .flatMap(([g, label]) => (dg.groups?.[g] ?? []).slice(0, 3).map((r, i) => h('div', { key: `${g}${i}`, className: 'ssm-s-dgrow' },
          h('span', { className: `ssm-p-lvl ssm-p-lvl-${r.level}` }, null), h('span', null, `${label}: ${r.what}`)))) : [];
      const dgCount = dg ? Object.entries(dg.groups).filter(([k]) => k !== 'partition').reduce((a, [, v]) => a + v.length, 0) : 0;
      return h('div', { className: 'ssm-s-rp' },
        // sticky 头部（spec §6.9）：集名（或 noBinding）+ frozen warn 徽章 + grow + ⟳ 图标钮（aria）；管内滚动时头不滚走
        h('div', { className: 'ssm-s-head' },
          h('b', null, t('rpEffective')), ' ', st?.set?.name ?? st?.binding?.setSlug ?? t('noBinding'),
          sc.frozen ? h(PBadge, { kind: 'warn', text: t('rpFrozen') }) : null,
          h('span', { className: 'ssm-grow' }, null),
          h('button', { className: 'ssm-p-icon-btn', onClick: load, title: t('regen'), 'aria-label': t('sAriaReload') }, h(Icon, { n: 'refresh' }))),
        st?.projectRoot ? h('div', { className: 'ssm-p-rootline' }, h('span', { title: st.projectRoot }, t('projectRoot'), '：', st.projectRoot)) : null,
        err ? h('div', { className: 'ssm-p-banner ssm-p-banner-error' }, h(Icon, { n: 'alert' }), err) : null,
        // 空态三态（§6.9）：未到位保留「…」文本行（未到位≠空：不得先渲染空态，review m4）；未绑定/空清单图标化
        !st && !err ? h('div', { className: 'ssm-p-empty' }, '…') : null,
        st && !st.binding?.setSlug && (st.resident ?? []).length ? h('div', { className: 'ssm-p-empty' }, h(Icon, { n: 'globe', s: 16 }), t('rpGlobalActiveUnbound').replace('{n}', st.resident.length)) : null,
        st && (!st.binding?.setSlug ? !(st.resident ?? []).length : names.length === 0) ? h('div', { className: 'ssm-p-empty' }, h(Icon, { n: 'fileWarn', s: 16 }), t('rpEmpty')) : null,
        st && bound && (st.resident ?? []).length ? h('div', { className: 'ssm-p-descwrap' }, t('rpGlobalActiveHint').replace('{n}', st.resident.length)) : null, // 未绑定时由上方专属文案告知，不重复；常驻计数 hint 保留
        st ? h('div', null, ...names.map(row)) : null,
        // 插件/Preset 灰段（用户疑问 2026-10-26）：运行时注入、不在生效清单内，只读不可勾；null = 服务不可知不渲染。
        // 折叠语汇同款 composer 灰区（§6.9）：默认收起「图标 标签 + 计数胶囊 ▸」，展开 = 灰态只读行 + 既有 hint（providerHint 文案照旧）。
        // 计数钮只在有条目时渲染（对齐 composer ZoneRow 的 names.length 口径；unmanaged=null=不可知也不渲染）
        st?.unmanaged?.length ? h(React.Fragment, null,
          h('button', { className: 'ssm-p-collapse', 'aria-expanded': openProv ? 'true' : 'false', 'aria-label': openProv ? t('ariaCollapse') : t('ariaExpand'), onClick: () => setOpenProv(!openProv) },
            h(Icon, { n: 'box', s: 13 }), t('providerSec'), h(PBadge, { kind: 'muted', text: String(st.unmanaged.length) }),
            h('span', { className: 'ssm-grow' }, null), h(Icon, { n: 'chevron', s: 12 })),
          openProv ? h(React.Fragment, null,
            ...st.unmanaged.map((e) => h(RowShell, { key: `p-${e.name}`, t, gray: true, name: e.name, badges: [{ kind: 'muted', text: e.provider }], title: e.source ?? undefined })),
            h('div', { className: 'ssm-p-descwrap' }, t('providerHint'))) : null) : null,
        // rpSelf 自检行语态（§6.9）：ok→ok 语态 ✓、detail→error 语态、frozen→warn PBadge（detail 行随冻结保留，warn 语态）
        h('div', { className: 'ssm-p-card-title' }, t('rpSelf'),
          !st ? '—' : sc.ok === false ? (sc.frozen ? h(PBadge, { kind: 'warn', text: t('rpFrozen') }) : null) : h('span', { className: 'ssm-p-ok' }, '✓')),
        sc.ok === false ? h('div', { className: sc.frozen ? 'ssm-p-warn' : 'ssm-p-err' }, sc.detail) : null,
        // 节标题计数随 composer 同场景口径：PBadge muted（§7 裁量项）；rpDiagFail/dgErr 文案照旧
        h('div', { className: 'ssm-p-card-title' }, t('rpDiag'),
          dg ? h(PBadge, { kind: 'muted', text: String(dgCount) }) : dgErr ? `⚠ ${t('rpDiagFail')}` : '—'),
        dgErr ? h('div', { className: 'ssm-p-descwrap' }, dgErr) : null,
        ...dgRows);
    }

    function OverlayHost({ ctx, t, bs }) {
      const b = useBus();
      if (!b.open) return null;
      return h('div', { className: 'ssm-p-overlay', onClick: () => bus.setOpen(false) },
        b.sessionId
          ? h(Panel, { ctx, t, sessionId: b.sessionId, onClose: () => bus.setOpen(false), bs })
          : h('div', { className: 'ssm-p-panel', style: { padding: 14 } }, t('noSession')));
    }

    const ICON_PATHS = {
      check: 'M20 6 9 17l-5-5',
      pencil: 'M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
      copy: 'M9 9h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2ZM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
      users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
      trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
      download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
      upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
      undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
      refresh: 'M23 4v6h-6M20.49 15a9 9 0 1 1-2.12-9.36L23 10', // 右栏 ⟳ 刷新钮（feather rotate-cw 同款）
      linkOff: 'M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8M3 3l18 18',
      search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.35-4.35',
      chevron: 'M6 9l6 6 6-6',
      external: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
      x: 'M18 6 6 18M6 6l12 12',
      alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01',
      fileWarn: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M12 10v4M12 18h.01',
      globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.6 9h16.8M3.6 15h16.8M11.3 3a17 17 0 0 0 0 18M12.7 3a17 17 0 0 1 0 18',
      box: 'M21 8 12 3 3 8v8l9 5 9-5ZM3 8l9 5 9-5M12 13v8',
      foreign: 'M7 17 17 7M8 7h9v9',
    };
    function Icon({ n, s = 14 }) {
      return h('svg', { className: 'ssm-p-icon', viewBox: '0 0 24 24', width: s, height: s, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: ICON_PATHS[n] }));
    }
    function PBadge({ kind, text }) { return h('span', { className: `ssm-p-tag ssm-p-tag-${kind}` }, text); }

    /**
     * 设置页（§10.1.4 settings.section：注册仅 id/order/label，ownerProps 只给 close；
     * 四页签自绘（库/全局技能集/安装与更新/诊断））。数据全部走同一 host Remote 面（call 兜底 fetch）——无第二实现（#15）。
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
      const tasks = useTasks(); // 模块级长任务态：关掉设置页也不丢进度与结果（用户 2026-10-29）
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
      // 在飞时关掉设置页，onDone 写回的是点击那一刻的实例，那次写入被 React 丢弃；
      // 重开时从任务态把最近一次「检查更新」的结果补回来（终审 I2）
      React.useEffect(() => {
        const last = tasks.last;
        if (last?.op !== 'updateCheck' || last.status !== 'ok' || !last.result) return;
        setUpRes((m) => (m[last.target] ? m : { ...m, [last.target]: last.result }));
      }, [tasks.last]);
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
      /** 在飞判定读模块级任务态（组件卸载也看得见）：只有「就是这个 op、就是这个目标」才亮转圈。 */
      const rowBusy = (op, name) => !!tasks.running && tasks.running.op === op && tasks.running.target === name;
      const locked = !!tasks.running || !!busy;
      // 被单飞挡住的按钮必须写明在跑什么（反目标：不得制造新的「点了没反应」）
      const busyTitle = tasks.running ? t('taskBusyWith').replace('{n}', t(SLOW_OPS[tasks.running.op].label)) : undefined;
      /** 图标钮 title：动作名打头，被单飞挡住时追加「正在跑什么」（反目标：不得制造新的「点了没反应」）。 */
      const iTitle = (label) => (busyTitle ? `${label} · ${busyTitle}` : label);
      // 安装结果改从任务态读：原 instRes 是组件 state，关掉设置页就没了（Review Focus #1）
      const instDone = tasks.last?.op === 'installApply' && tasks.last.status === 'ok' ? tasks.last.result : null;
      const sess = () => (bus.sessionId ? { sessionId: bus.sessionId } : {}); // 项目面必须带活动会话（review M2）
      const rows = searchRows(lib, filter); // P3：过滤框 = 同款匹配器（名称/来源/描述/中文用途）
      const gCorpus = [...lib, ...foreign.filter((n) => !lib.some((l) => l.name === n)).map((n) => ({ name: n, source: 'foreign', foreign: true, descriptionZh: null }))];
      const grows = searchRows(gCorpus, gq).filter((r) => !gOnly || resident.includes(r.name) || foreign.includes(r.name));
      const counts = (files) => {
        const c = { update: 0, add: 0, remove: 0, 'skip-modified': 0 };
        for (const f of files ?? []) if (c[f.action] !== undefined) c[f.action] += 1;
        return c;
      };
      // 等待期不禁用页签（用户 2026-10-29：装一个仓库要几十秒，连切页签都做不到）
      const tabBtn = (id, label) => h('button', { className: 'ssm-s-tab' + (tab === id ? ' ssm-s-tab-on' : ''), onClick: () => setTab(id) }, label); // 页签不加 disabled（spec §5.4/AC#1）；文案沿用 tab* 键（verify 字面锚点）
      return h('div', { className: 'ssm-s-settings' },
        h('div', { className: 'ssm-s-tabs' }, tabBtn('library', t('tabLibrary')), tabBtn('global', t('tabGlobal')), tabBtn('ops', t('tabOps')), tabBtn('diag', t('tabDiag'))),
        h(TaskStrip, { t, tasks }), // 条子挂在页签下方：切到任何页签都看得见（Review Focus #1/#5）
        msg ? h('div', { className: `ssm-p-banner ${msg.kind === 'err' ? 'ssm-p-banner-error' : 'ssm-p-banner-ok'}` }, h(Icon, { n: msg.kind === 'err' ? 'alert' : 'check' }), msg.text) : null, // msg 换 banner 语态：成功 ok 底、失败 error 底（spec §6.4）
        tab === 'library' ? h(React.Fragment, null,
          h('div', { className: 'ssm-p-row' }, // 过滤框换同款 .ssm-p-search（spec §6.5）；宽度归 flex-basis 管，不再 inline maxWidth
            h('input', { className: 'ssm-p-search', placeholder: t('filterPh'), value: filter, 'aria-label': t('filterPh'), onChange: (e) => setFilter(e.target.value) })),
          // P3 翻译入口（设计 §6.1：默认关出网，手动批量）+ agents 存量迁移向导（§6.6，Task 5 RPC）
          // 翻译行同迁新语态（评审 2026-11-07：库页签内容属本任务，禁「半迁移裂缝」）：
          // 按钮走 .ssm-s-btn（.ssm-p-row>button 的特异性坑已由 .ssm-p-row>.ssm-s-btn 抬回规则接住）、
          // select 复用 .ssm-p-search 同款底样、计数提示走 .ssm-p-desc。RPC 与分组/并发流程一字未动。
          h('div', { className: 'ssm-p-row' },
            h('button', { className: 'ssm-s-btn', disabled: locked, title: iTitle(t('batchTranslate')), onClick: () => run('trP', async () => { const p = await call(ctx, 'translatePending', {}); const m = await call(ctx, 'translateModels', {}).catch(() => ({ options: [] })); setTr({ pending: p.pending ?? [], failed: p.failed ?? [], models: m, model: '', result: null }); }) }, t('batchTranslate')),
            (tr?.pending?.length || tr?.failed?.length)
              ? h(React.Fragment, null,
                  h('select', { className: 'ssm-p-search', style: { flex: '0 1 280px', maxWidth: 280 }, disabled: locked, title: t('modelSelect'), 'aria-label': t('modelSelect'), value: tr.model, onChange: (e) => setTr({ ...tr, model: e.target.value }) },
                    h('option', { value: '' }, t('currentModel')),
                    ...(tr.models?.options ?? []).map((o, i) => h('option', { key: `${o.provider}/${o.model}`, value: String(i) }, o.label))), // N7：value 用下标，免 provider/model 含 | 时碎裂
                  tr.failed?.length ? h('span', { className: 'ssm-p-desc' }, `${tr.failed.length} ${t('failedRetryable')}`) : null,
                  h('button', { className: 'ssm-s-btn', disabled: locked, title: iTitle(t('translateGo')), onClick: () => run('trR', async () => {
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
                  tr?.progress ? h('button', { className: 'ssm-s-btn', disabled: !tr.progress, onClick: () => { trStop.current = true; } }, t('translateStop')) : null)
                : null),
          // 进行中 = banner 语态 + 转圈（与 TaskStrip 同族信号）；逐行 running 名单走 .ssm-p-desc
          tr?.progress
            ? h(React.Fragment, null,
                h('div', { className: 'ssm-p-banner ssm-p-banner-muted' }, h('span', { className: 'ssm-spin' }, null),
                  `${t('translateProgress')} ${tr.progress.done + tr.progress.failed}/${tr.progress.total}（✓${tr.progress.done} ×${tr.progress.failed}）${tr.progress.stopping ? ` · ${t('translateStopping')}` : ''}`),
                tr.progress.running.length ? h('div', { className: 'ssm-p-desc' }, `⋯ ${tr.progress.running.slice(0, 2).join(', ')}${tr.progress.running.length > 2 ? ` +${tr.progress.running.length - 2}` : ''}`) : null)
            : null,
          // 结果 = banner 语态：全成就 ok，有可重试失败就 warn；失败明细逐行（key 照旧）
          tr?.result
            ? h(React.Fragment, null,
                h('div', { className: `ssm-p-banner ${(tr.result.failed ?? []).length ? 'ssm-p-banner-warn' : 'ssm-p-banner-ok'}` },
                  h(Icon, { n: (tr.result.failed ?? []).length ? 'alert' : 'check' }),
                  `${t('translateDone')}: ✓${(tr.result.done ?? []).length} ×${(tr.result.failed ?? []).length}${tr.result.skipped ? ` ⏭${tr.result.skipped}` : ''}`),
                ...(tr.result.failed ?? []).map((f) => h('div', { key: f.name, className: 'ssm-p-desc' }, `${f.name}: ${f.error ?? ''}`)))
            : null,
          h('div', { className: 'ssm-p-desc' }, t('autoTranslateHint')),
          // 空态（§6.5 同款 .ssm-p-empty + 图标）：库为空=引导去安装；有过滤词无命中=没有匹配
          rows.length === 0 ? h('div', { className: 'ssm-p-empty' }, h(Icon, { n: filter.trim() ? 'search' : 'box' }), filter.trim() ? t('emptySearch') : t('sEmptyLib')) : null,
          // 技能行 = 行壳卡片（spec §6.5）：徽章组 + 中文用途第二行 + 图标动作条；状态变体（认领编辑/diff/confirm/回收站）
          // 一律经 RowShell 的 sub 槽嵌进同一张卡——操作前后不掉样式（AC#3）；RPC 调用面与参数字面一字未动。
          ...rows.map((x) => {
            const isGh = String(x.source).startsWith('github:');
            const chk = rowBusy('updateCheck', x.name);
            const ap = rowBusy('updateApply', x.name);
            const up = upRes[x.name];
            // 徽章组（§6.5）：受管 brand / 未登记（本地技能，GLOSSARY「本地技能 = Unmanaged Skill」）muted /
            // 本地改动 warn / 目录缺 SKILL.md（不会被加载，diagnose structure 同款判定）error
            const badges = [x.managed ? { kind: 'brand', text: t('managedTag') } : { kind: 'muted', text: t('unmanagedTag') }];
            if (x.localModified) badges.push({ kind: 'warn', text: t('modifiedTag') });
            if (x.hasSkillMd === false) badges.push({ kind: 'error', text: t('rpDead') });
            // 第二行中文用途（§6.1 同款回退：未翻译显英文 + 待翻译角标）
            const desc = x.descriptionZh
              ? h('div', { className: 'ssm-p-desc', title: x.description ?? undefined }, x.descriptionZh)
              : x.description
                ? h('div', { className: 'ssm-p-desc', title: x.description }, x.description, ' ', h(PBadge, { kind: 'muted', text: t('pendingTag') }))
                : null;
            // hover title = 来源 @commit(7)（§6.5）：本地/占位行无来源可展示，回落中文/名称（同款拼法）
            const srcTitle = x.source === 'unknown' || x.source === 'placeholder'
              ? (x.descriptionZh ?? x.name)
              : `${String(x.source).replace('github:', '')}${x.commit ? ` @${String(x.commit).slice(0, 7)}` : ''}`;
            return h(RowShell, {
              key: x.name, t, name: x.name, badges, desc, title: srcTitle,
              // 动作条 = 图标按钮 + aria/title（§6.5）：检查更新 download / 回收站 trash / 改认领 pencil / 卸载 trash-danger
              actions: [
                isGh ? h('button', { className: 'ssm-p-icon-btn', disabled: locked, title: chk ? t('checkingUp') : iTitle(t('sAriaCheckUpd')), 'aria-label': t('sAriaCheckUpd'), onClick: () => startLong(ctx, 'updateCheck', x.name, { name: x.name }, { onDone: (s) => { if (s.ok) setUpRes((m) => ({ ...m, [x.name]: s.value })); } }) }, chk ? h('span', { className: 'ssm-spin' }, null) : h(Icon, { n: 'download' })) : null,
                // 应用更新 = 拉远端写回本地，图标用 upload 与「检查更新」的 download 区分（两个都是 download 会读成同一件事）
                up && !up.upToDate ? h('button', { className: 'ssm-p-icon-btn', disabled: locked, title: ap ? t('applyingUp') : iTitle(t('applyUp')), 'aria-label': t('applyUp'), onClick: () => startLong(ctx, 'updateApply', x.name, { name: x.name }, {
                  noteOf: (s) => s.ok && s.value?.backup ? `${t('opDone')} · ${t('backupAt')} ${s.value.backup}` : null,
                  onDone: (s) => {
                    if (!s.ok) return; // 失败由 TaskStrip 染红并报原因，不再被 run() 的 catch 混成「操作失败」
                    setUpRes((m) => ({ ...m, [x.name]: null }));
                    load();
                  },
                }) }, ap ? h('span', { className: 'ssm-spin' }, null) : h(Icon, { n: 'upload' })) : null,
                x.backupCount ? h('button', { className: 'ssm-p-icon-btn', disabled: locked, title: iTitle(`${t('backupsTitle')}(${x.backupCount})`), 'aria-label': t('sAriaTrashBin'), onClick: () => {
                  if (backupsOf?.name === x.name) { setBackupsOf(null); return; }
                  run(`bk:${x.name}`, async () => setBackupsOf({ name: x.name, list: (await call(ctx, 'backupsList', { name: x.name })).backups ?? [] }));
                } }, h(Icon, { n: 'trash' })) : null,
                h('button', { className: 'ssm-p-icon-btn', disabled: locked, title: iTitle(isGh ? t('sAriaClaim') : t('claimGo')), 'aria-label': isGh ? t('sAriaClaim') : t('claimGo'), onClick: () => {
                  const on = claimOf === x.name;
                  setClaimOf(on ? null : x.name);
                  // github 行预填现值（改认领：换来源或补 commit），本地/占位行留空
                  if (!on) setClaimDraft({ source: isGh ? String(x.source) : '', commit: x.commit ? String(x.commit) : '' });
                } }, h(Icon, { n: 'pencil' })),
                h('button', { className: 'ssm-p-icon-btn ssm-p-icon-danger', disabled: locked, title: iTitle(t('sAriaUninstall')), 'aria-label': t('sAriaUninstall'), onClick: () => setConfirmUn(x.name) }, h(Icon, { n: 'trash' })),
              ],
              sub: h(React.Fragment, null,
                // 行内认领来源（§8.1）：输入行嵌进卡内，保存/撤认领/取消收进图标钮（Electron 无 window.prompt，§6.4）
                claimOf === x.name
                  ? h(React.Fragment, null,
                      h('div', { className: 'ssm-p-row' },
                        h('input', { className: 'ssm-p-search', style: { maxWidth: 230 }, autoFocus: true, placeholder: t('claimSourcePh'), value: claimDraft.source, disabled: locked, 'aria-label': t('claimSourcePh'), onChange: (e) => setClaimDraft({ ...claimDraft, source: e.target.value }) }),
                        h('input', { className: 'ssm-p-search', style: { maxWidth: 120 }, placeholder: t('claimCommitPh'), value: claimDraft.commit, disabled: locked, 'aria-label': t('claimCommitPh'), onChange: (e) => setClaimDraft({ ...claimDraft, commit: e.target.value }) }),
                        h('button', { className: 'ssm-p-icon-btn', disabled: locked || !claimDraft.source.trim(), title: iTitle(t('saveBtn')), 'aria-label': t('saveBtn'), onClick: () => run(`claim:${x.name}`, async () => { await call(ctx, 'claimSource', { name: x.name, source: claimDraft.source.trim(), commit: claimDraft.commit.trim() || null }); setClaimOf(null); await load(); }) }, h(Icon, { n: 'check' })),
                        x.source !== 'unknown' && x.source !== 'placeholder'
                          ? h('button', { className: 'ssm-p-icon-btn', disabled: locked, title: iTitle(t('claimUndo')), 'aria-label': t('claimUndo'), onClick: () => run(`claim:${x.name}`, async () => { await call(ctx, 'claimSource', { name: x.name, source: 'unknown' }); setClaimOf(null); await load(); }) }, h(Icon, { n: 'undo' }))
                          : null,
                        h('button', { className: 'ssm-p-icon-btn', disabled: locked, title: t('close'), 'aria-label': t('close'), onClick: () => setClaimOf(null) }, h(Icon, { n: 'x' }))),
                      h('div', { className: 'ssm-p-desc' }, t('claimHint')))
                  : null,
                // 检查更新结果 = banner 语态（§6.5）；文件级 diff 名单仍逐行（§13.6 / review m5）
                up
                  ? h(React.Fragment, null,
                      h('div', { className: 'ssm-p-banner ssm-p-banner-muted' }, h(Icon, { n: 'download' }), up.upToDate
                        ? (() => {
                            const sk = counts(up.files)['skip-modified'];
                            return `${t('upToDate')} @${String(up.current ?? '').slice(0, 7)}${sk ? ` ⚠ ${sk} ${t('skipNote')}` : ''}`;
                          })()
                        : (() => {
                            const c = counts(up.files);
                            // 远端 commit 前进了但一个文件都没变（或来源是认领的、current 为空无法比 commit）：
                            // 报「差异 ↑0 +0 −0」会被读成“有更新可装”，直说内容已一致（用户报告 2026-10-26 连带场景）
                            if (!c.update && !c.add && !c.remove && !c['skip-modified'])
                              return `${t('noContentDiff')} → @${String(up.remote ?? '').slice(0, 7)}${up.current ? '' : `（${t('claimNoCommit')}）`}`;
                            return `${t('upActions')}: ↑${c.update} +${c.add} −${c.remove} ⚠${c['skip-modified']} → ${String(up.remote ?? '').slice(0, 7)}${c['skip-modified'] ? ` (${t('skipNote')})` : ''}`;
                          })()),
                      ...(up.files ?? []).filter((f) => f.action !== 'same').slice(0, 15)
                        .map((f) => h('div', { key: f.path, className: 'ssm-p-desc' }, `${f.action === 'skip-modified' ? '⚠' : f.action === 'update' ? '↑' : f.action === 'add' ? '+' : '−'} ${f.path}`)),
                      (up.files ?? []).filter((f) => f.action !== 'same').length > 15 ? h('div', { className: 'ssm-p-desc' }, t('moreFiles')) : null)
                  : null,
                // 卸载二次确认（§6.5）：banner 语态 + 常驻可见——动作条是 hover 显形，确认条不能被藏；文案与流程照旧
                confirmUn === x.name
                  ? h('div', { className: 'ssm-p-banner ssm-p-banner-error' }, h(Icon, { n: 'alert' }), t('confirmUn'), ' ', x.name, ' ',
                      h('button', { className: 'ssm-p-banner-cta', autoFocus: true, disabled: locked, title: busyTitle, onClick: () => startLong(ctx, 'uninstallSkill', x.name, { name: x.name }, { onDone: (s) => { if (!s.ok) return; setConfirmUn(null); setUpRes((m) => ({ ...m, [x.name]: null })); load(); } }) }, t('uninstallGo')),
                      h('button', { onClick: () => setConfirmUn(null) }, '×'))
                  : null,
                // 回收站展开（§6.5）：行卡同款 + 备份标签胶囊 muted + 恢复按钮品牌软底复刻
                backupsOf?.name === x.name
                  ? h('div', { className: 'ssm-p-card' }, backupsOf.list.length === 0
                    ? h('div', { className: 'ssm-p-empty' }, h(Icon, { n: 'trash' }), t('none'))
                    : backupsOf.list.map((b) => h(RowShell, {
                        key: b.dir, t, name: b.ts, badges: [{ kind: 'muted', text: `(${b.fileCount})` }],
                        actions: [h('button', { className: 'ssm-s-btn', disabled: locked, title: busyTitle ?? t('restoreGo'), 'aria-label': t('restoreGo'), onClick: () => run(`rs:${b.dir}`, async () => { await call(ctx, 'backupRestore', { name: x.name, dir: b.dir }); setBackupsOf(null); await load(); }) }, t('restoreGo'))],
                      })))
                  : null),
            });
          }),
        ) : null,
        tab === 'global' ? h(React.Fragment, null, // P3 全局技能集 tab（spec §6.6）：行卡 + 复选胶囊（选中 brand 软底），外来常驻灰态只读
          h('div', { className: 'ssm-p-descwrap' }, t('globalTabHint'), rTarget ? ` ${rTarget}` : ''),
          h('div', { className: 'ssm-p-row' }, // 过滤框/只看常驻换同款 .ssm-p-search + .ssm-p-check 语汇（§6.6）
            h('input', { className: 'ssm-p-search', placeholder: t('searchPh'), value: gq, disabled: locked, 'aria-label': t('searchPh'), onChange: (e) => setGq(e.target.value) }),
            h('label', { className: 'ssm-p-check' }, h('input', { type: 'checkbox', checked: gOnly, disabled: locked, onChange: (e) => setGOnly(e.target.checked) }), t('residentOnly'))),
          // 空态（§6.6 同款 .ssm-p-empty + 图标）：无过滤词 = 引导勾选候选；有过滤词无命中 = 没有匹配
          grows.length === 0 ? h('div', { className: 'ssm-p-empty' }, h(Icon, { n: gq.trim() ? 'search' : 'box' }), gq.trim() ? t('emptySearch') : t('sEmptyGlobal')) : null,
          ...grows.map((r) => {
            if (r.foreign) return h(RowShell, { key: r.name, t, name: r.name, gray: true, badges: [{ kind: 'warn', text: t('foreignRow') }] }); // N5：已在设置页内，不再挂「去设置管理」文案；灰态只读（§6.6）
            const on = resident.includes(r.name);
            // 描述第二行（用户反馈 2026-10-26：同行挤压显乱，与库 tab 同款回退口径）
            const desc = r.descriptionZh
              ? h('div', { className: 'ssm-p-desc', title: r.description ?? undefined }, r.descriptionZh)
              : r.description
                ? h('div', { className: 'ssm-p-desc', title: r.description }, r.description, ' ', h(PBadge, { kind: 'muted', text: t('pendingTag') }))
                : null;
            return h(RowShell, {
              key: r.name, t, name: r.name, desc,
              // 复选胶囊（§6.6）：label 包住复选框即胶囊，选中态 brand 软底走新区变体 .ssm-p-check-on——
              // 不动 composer 在用的 .ssm-p-check 基样（AC#14 composer 观感零变化）；setResident 勾选语义一字未动（AC#5）
              leading: h('label', { className: 'ssm-p-check' + (on ? ' ssm-p-check-on' : '') },
                h('input', { type: 'checkbox', checked: on, disabled: locked, 'aria-label': r.name, onChange: () => run(`res:${r.name}`, async () => {
                  const next = on ? resident.filter((n) => n !== r.name) : [...resident, r.name];
                  await call(ctx, 'setResident', { names: next });
                  await loadState();
                }) })),
              // github 来源展示口径照旧：截断片段进第三行 muted 文本
              sub: String(r.source).startsWith('github:') ? h('div', { className: 'ssm-p-desc' }, String(r.source).replace('github:', '').slice(0, 20)) : null,
            });
          })) : null,
        tab === 'ops' ? h(React.Fragment, null, // 分节卡片化（spec §6.7）：GitHub 安装 / 两级迁移各一张 .ssm-p-card；动作按钮 = 新区品牌软底复刻 .ssm-s-btn（.ssm-p-row>button 特异性坑由已入库 .ssm-p-row>.ssm-s-btn 抬回规则接住）
          h('div', { className: 'ssm-p-card' },
            h('div', { className: 'ssm-p-card-title' }, t('installTitle')),
            h('div', { className: 'ssm-p-row' },
              h('input', { className: 'ssm-p-search', placeholder: t('installSpecPh'), value: spec, disabled: locked, 'aria-label': t('installSpecPh'), onChange: (e) => setSpec(e.target.value) }),
              h('label', { className: 'ssm-p-check' }, h('input', { type: 'checkbox', checked: overwrite, disabled: locked, onChange: (e) => setOverwrite(e.target.checked) }), t('overwriteChk')),
              h('button', { className: 'ssm-s-btn', disabled: locked || !spec.trim(), title: busyTitle, onClick: () => { if (startLong(ctx, 'installApply', spec.trim(), { spec: spec.trim(), overwrite }, { noteOf: (s) => { const rs = s.ok ? s.value?.results ?? [] : []; const bad = rs.filter((r) => !r.ok).length; return bad ? t('opPartial').replace('{n}', String(rs.length - bad)).replace('{m}', String(bad)) : null; }, onDone: () => load() })) setSpec(''); } }, t('installGo'))),
            // 安装结果胶囊换 .ssm-p-tag-muted（§6.6）；commit 短哈希与逐条 ✓/× reason 文案照旧
            // 安装结果徽章行允许换行（Task 5 转交：多条结果时 .ssm-p-row 不换行 → 徽章 flex:none 撑出横溢）
            instDone ? h('div', { className: 'ssm-p-row ssm-s-wrap' }, h('span', { className: 'ssm-p-desc' }, `@${String(instDone.commit ?? '').slice(0, 7)}`),
              ...(instDone.results ?? []).map((r) => h(PBadge, { key: r.name, kind: 'muted', text: `${r.name}: ${r.ok ? '✓' : `× ${r.reason ?? ''}`}` }))) : null),
          h('div', { className: 'ssm-p-card' },
            h('div', { className: 'ssm-p-card-title' }, t('migrateAgentsTitle')),
            h('div', { className: 'ssm-p-row' },
              h('button', { className: 'ssm-s-btn', disabled: locked, title: busyTitle, onClick: () => run('migAP', async () => setMigA({ preview: await call(ctx, 'migrateAgentsPreview', {}), applied: false })) }, t('migrateAgentsGo')),
              migA?.applied ? h('button', { className: 'ssm-s-btn', disabled: locked, title: busyTitle, onClick: () => startLong(ctx, 'migrateAgentsUndo', null, {}, { onDone: (s) => { if (!s.ok) return; setMigA(null); load(); } }) }, t('migrateUndo')) : null,
              migA && !migA.applied ? h('button', { className: 'ssm-s-btn', disabled: locked || !(migA.preview?.moves?.length), title: busyTitle, onClick: () => startLong(ctx, 'migrateAgentsApply', null, {}, { onDone: (s) => { if (!s.ok) return; setMigA({ preview: null, applied: true }); load(); } }) }, t('migrateApply')) : null, // M3：空预览禁用执行（host 侧 null-ledger 崩溃已另修）
              !migA ? h('span', { className: 'ssm-p-desc' }, t('migrateAgentsHint')) : null),
            // 预览展示口径照旧（§13#6）：moves/keep 名单、警告、notes 只换文本语态——
            // .ssm-p-descwrap 复刻旧 .ssm-hint（长名单不截断）、.ssm-p-warn 复刻旧 .ssm-warn-inline
            migA?.preview
              ? h(React.Fragment, null,
                  h('div', { className: 'ssm-p-descwrap' },
                    `${t('migrateMoves')}: ${(migA.preview.moves ?? []).map((m) => m.name).join(', ') || t('none')}；${t('migrateKeep')}: ${(migA.preview.keep ?? []).map((k) => `${k.name}(${keepReasonText(t, k.reason)})`).join(', ') || t('none')}`),
                  ...(migA.preview.warnings ?? []).map((w, i) => h('div', { key: 'ma' + i, className: 'ssm-p-warn' }, w)),
                  ...(migA.preview.notes ?? []).map((n, i) => h('div', { key: 'mn' + i, className: 'ssm-p-descwrap' }, n)))
              : null),
          h('div', { className: 'ssm-p-card' },
            h('div', { className: 'ssm-p-card-title' }, t('migrateTitle')),
            h('div', { className: 'ssm-p-row' },
              h('button', { className: 'ssm-s-btn', disabled: locked, title: busyTitle, onClick: () => run('migP', async () => setMig({ preview: await call(ctx, 'migratePreview', {}), applied: false })) }, t('migratePreview')),
              mig ? h('button', { className: 'ssm-s-btn', disabled: locked, title: busyTitle, onClick: () => startLong(ctx, mig.applied ? 'migrateUndo' : 'migrateApply', null, {}, { onDone: (s) => { if (!s.ok) return; setMig(null); load(); } }) }, mig.applied ? t('migrateUndo') : t('migrateApply')) : null),
            mig?.preview
              ? h(React.Fragment, null,
                  h('div', { className: 'ssm-p-descwrap' },
                    `${t('migrateMoves')}: ${(mig.preview.moves ?? []).map((m) => m.name).join(', ') || t('none')}；${t('migrateKeep')}: ${(mig.preview.keep ?? []).map((k) => k.name).join(', ') || t('none')}`),
                  ...(mig.preview.warnings ?? []).map((w, i) => h('div', { key: i, className: 'ssm-p-warn' }, w)))
              : null)
        ) : null,
        tab === 'diag' ? h(React.Fragment, null,
          h('div', { className: 'ssm-p-row' }, // 动作按钮品牌软底复刻同款语态（§6.7/§6.8）；无会话提示换 .ssm-p-desc
            h('button', { className: 'ssm-s-btn', disabled: locked || !bus.sessionId, title: busyTitle, onClick: () => run('diag', async () => setDiag(await call(ctx, 'diagnoseRun', sess()))) }, t('diagRun')),
            diag?.fixable?.reclaimDeadLinks?.count
              ? h('button', { className: 'ssm-s-btn', disabled: locked || !bus.sessionId, title: busyTitle, onClick: () => run('reclaim', async () => { await call(ctx, 'reclaimDeadLinks', sess()); setDiag(await call(ctx, 'diagnoseRun', sess())); }) }, `${t('fixReclaim')}(${diag.fixable.reclaimDeadLinks.count})`)
              : null,
            h('button', { className: 'ssm-s-btn', disabled: locked || !bus.sessionId, title: busyTitle, onClick: () => run('rebuild', async () => { const r = await call(ctx, 'rebuildManaged', sess()); setDiag(await call(ctx, 'diagnoseRun', sess())); return r; }) }, t('fixRebuild')),
            !bus.sessionId ? h('span', { className: 'ssm-p-desc' }, t('noSession')) : null),
          diag
            ? h(React.Fragment, null, ...Object.entries({ // 六类分组各一节卡片（§6.8）：节标题 .ssm-p-card-title + 计数；每条诊断 = 行卡，左角色点 .ssm-p-lvl* 复刻旧 .ssm-lvl* 语义（token 配色升级）
              partition: t('diagPartition'), copies: t('diagCopies'), dangling: t('diagDangling'),
              deadLinks: t('diagDeadLinks'), structure: t('diagStructure'), env: t('diagEnv'),
            }).map(([g, label]) => h('div', { key: g, className: 'ssm-p-card' },
              h('div', { className: 'ssm-p-card-title' }, label, h(PBadge, { kind: 'muted', text: String((diag.groups?.[g] ?? []).length) })),
              (diag.groups?.[g] ?? []).length === 0 ? h('div', { className: 'ssm-p-empty' }, h(Icon, { n: 'check' }), t('sEmptyDiag')) : null,
              // what 首行、where/fix 二三行展示保留（§13#7 可复制修复动作 = 可选中复制的文本行，语态照旧、不新增机制）
              ...(diag.groups?.[g] ?? []).map((r, i) => h('div', { key: i, className: 'ssm-p-rowcard' },
                h('div', { className: 'ssm-p-row' },
                  h('span', { className: `ssm-p-lvl ssm-p-lvl-${r.level}` }, null),
                  h('span', null, r.what)),
                r.where ? h('div', { className: 'ssm-p-descwrap' }, r.where) : null,
                r.fix ? h('div', { className: 'ssm-p-descwrap' }, r.fix) : null)))))
            : null
        ) : null);
    }

    const CSS = `
.ssm-chip-btn{display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);padding:3px 9px;border-radius:999px;cursor:pointer}
.ssm-chip-btn:hover{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-brand-primary) 60%, transparent);color:var(--dsw-alias-label-primary)}
.ssm-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
.ssm-dot-ok{background:var(--dsw-alias-state-success-primary,#22c55e)}.ssm-dot-red{background:var(--dsw-alias-state-error-primary,#e5484d)}.ssm-dot-idle{background:var(--dsw-alias-label-secondary)}
.ssm-cur{color:var(--dsw-alias-label-primary);font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ssm-badge{min-width:14px;height:14px;border-radius:7px;background:var(--dsw-alias-state-error-primary,#e5484d);color:#fff;font-size:10px;display:inline-flex;align-items:center;justify-content:center;padding:0 4px}
.ssm-grow{flex:1}
.ssm-warn-inline{color:var(--dsw-alias-state-warn-primary,#f5a623)}
.ssm-spin{display:inline-block;width:.7em;height:.7em;border:1.5px solid currentColor;border-top-color:transparent;border-radius:50%;animation:ssm-spin .7s linear infinite;vertical-align:-1px;margin-right:5px}
@keyframes ssm-spin{to{transform:rotate(360deg)}}
.ssm-bar{height:5px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);overflow:hidden}
.ssm-bar-fill{height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary);transition:width .4s}
.ssm-bar-ok{background:var(--dsw-alias-state-success-primary,#22c55e)}
.ssm-bar-err{background:var(--dsw-alias-state-error-primary,#e5484d)}
.ssm-warn{font-size:11px;padding:4px 6px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f5a623) 18%,transparent)} /* 只剩 io 预览警告行在用；.ssm-err 随 TaskStrip 明细行迁 banner 语态退役（Task 6.3） */
.ssm-hint{font-size:10px;color:var(--dsw-alias-label-secondary)}
.ssm-row{display:flex;align-items:center;gap:4px;font-size:12px}
.ssm-n{color:var(--dsw-alias-label-secondary);font-size:11px}
.ssm-row button{font:inherit;font-size:11px;color:var(--dsw-alias-label-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);border:1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 50%, transparent);border-radius:6px;padding:4px 10px;cursor:pointer} /* 品牌色软底（用户 2026-10-26：要一眼可辨的按钮；原 :not() 豁免随其目标类删除一并简化，同款复刻见新区 .ssm-s-btn） */
.ssm-row button:hover{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-brand-primary) 70%, transparent)}
.ssm-row button.ssm-danger,.ssm-confirm button.ssm-danger{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 16%, transparent);border:1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 55%, transparent)} /* 高危操作（解绑/卸载/删除）错误色（用户 2026-10-26）；.ssm-settings … 片段随设置页迁移退役（Task 6.3：多选择器规则只摘死片段） */
.ssm-row button.ssm-danger:hover,.ssm-confirm button.ssm-danger:hover{background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 28%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 75%, transparent)}
.ssm-input{flex:1;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 7px;min-width:0}
.ssm-io{display:flex;flex-direction:column;gap:6px;margin:6px 0}
.ssm-textarea{width:100%;box-sizing:border-box;resize:vertical;font:11px/1.5 ui-monospace,Consolas,monospace;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:6px 8px}
.ssm-ok{font-size:11px;color:var(--dsw-alias-state-success-primary,#22c55e)}
.ssm-confirm{font-size:11px;padding:5px 7px;border-radius:6px;background:var(--dsw-alias-bg-layer-1);display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.ssm-confirm button{font:inherit;font-size:11px;border:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent);color:var(--dsw-alias-label-primary);border-radius:6px;padding:3px 8px;cursor:pointer}
/* 面板美化（spec 2026-11-06 · ADR-0004）：新结构全部 .ssm-p-* 原子件 + 页面布局类 .ssm-s-*（spec 2026-11-07 §6.1 白名单）；
   旧 .ssm-* 只留 composer Panel/TaskStrip 仍在用的（§5.5 使用矩阵）——设置页/右栏迁移后归零的旧类与 .ssm-settings 后代规则已于 Task 6.3 删除，残留检查进 ui-gates ⑤ */
.ssm-p-overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.35);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;padding:0 12px 12px;pointer-events:auto}
.ssm-p-panel{width:min(760px,94vw);max-height:78vh;overflow:auto;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;padding:0 14px 10px;display:flex;flex-direction:column;gap:10px;box-shadow:0 16px 48px rgba(0,0,0,.4);font-size:13px;animation:ssm-pop .12s ease-out}
@keyframes ssm-pop{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.ssm-p-panel{animation:none}.ssm-p-skel{animation:none}}
.ssm-p-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:8px;margin:0 -14px;padding:10px 14px;background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l2);border-radius:14px 14px 0 0;font-size:15px}
.ssm-p-cur{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ssm-p-rootline{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-secondary);min-width:0}
.ssm-p-rootline>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ssm-p-card{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.ssm-p-card-title{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;color:var(--dsw-alias-label-secondary)}
.ssm-p-row{display:flex;align-items:center;gap:6px;font-size:13px;min-width:0}
.ssm-p-desc{font-size:11px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ssm-p-tag{font-size:10px;padding:1px 7px;border-radius:999px;border:1px solid transparent;flex:none;line-height:1.6}
.ssm-p-tag-brand{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,transparent)}
.ssm-p-tag-warn{color:var(--dsw-alias-state-warn-primary,#f5a623);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f5a623) 16%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f5a623) 45%,transparent)}
.ssm-p-tag-error{color:var(--dsw-alias-state-error-primary,#e5484d);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 14%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 45%,transparent)}
.ssm-p-tag-muted{color:var(--dsw-alias-label-secondary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);border-color:var(--dsw-alias-border-l2)}
.ssm-p-check{display:flex;align-items:flex-start;gap:8px;border-radius:8px;padding:4px 6px;cursor:pointer}
.ssm-p-check:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent)}
.ssm-p-check input[type=checkbox]{margin-top:3px;flex:none;accent-color:var(--dsw-alias-brand-primary)}
.ssm-p-pick:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;border-radius:6px}
.ssm-p-search:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}
.ssm-p-check:has(input:focus-visible){outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ssm-p-icon{flex:none}
.ssm-p-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;flex:none;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0}
.ssm-p-icon-btn:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);color:var(--dsw-alias-label-primary)}
.ssm-p-icon-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ssm-p-icon-danger{color:var(--dsw-alias-state-error-primary,#e5484d)}
.ssm-p-banner{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;padding:7px 10px;border-radius:10px;border:1px solid}
.ssm-p-banner-warn{color:var(--dsw-alias-state-warn-primary,#f5a623);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f5a623) 12%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f5a623) 40%,transparent)}
.ssm-p-banner-error{color:var(--dsw-alias-state-error-primary,#e5484d);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 12%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 40%,transparent)}
.ssm-p-collapse{display:flex;align-items:center;gap:8px;width:100%;font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary);padding:5px 6px;border:0;border-radius:8px;background:0;cursor:pointer;text-align:left}
.ssm-p-collapse:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);color:var(--dsw-alias-label-primary)}
.ssm-p-collapse:focus-visible{outline:2px solid var(--dsw-alias-brand-primary)}
.ssm-p-collapse[aria-expanded="true"]>svg:last-of-type{transform:rotate(180deg)}
.ssm-p-skel{height:34px;border-radius:8px;background:linear-gradient(90deg,color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent) 25%,color-mix(in srgb,var(--dsw-alias-label-primary) 16%,transparent) 50%,color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent) 75%);background-size:200% 100%;animation:ssm-skel 1.2s linear infinite}
@keyframes ssm-skel{from{background-position:100% 0}to{background-position:-100% 0}}
.ssm-p-actions{display:flex;align-items:center;gap:2px;border-top:1px solid var(--dsw-alias-border-l2);padding-top:6px;margin-top:2px}
.ssm-p-actions .ssm-p-icon-btn{opacity:1}
.ssm-p-setrow>.ssm-p-row .ssm-p-icon-btn{opacity:0;transition:opacity .12s}
.ssm-p-setrow:hover>.ssm-p-row .ssm-p-icon-btn,.ssm-p-setrow:focus-within>.ssm-p-row .ssm-p-icon-btn{opacity:1}
@media (prefers-reduced-motion:reduce){.ssm-p-setrow>.ssm-p-row .ssm-p-icon-btn{opacity:1;transition:none}}
.ssm-p-setrow{border-radius:8px;padding:5px 6px;display:flex;flex-direction:column;gap:2px}
.ssm-p-setrow:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent)}
.ssm-p-setrow-cur{border-left:2px solid var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,transparent)}
.ssm-p-row .ssm-p-pick{flex:1;display:flex;align-items:center;gap:8px;min-width:0;background:0;border:0;color:var(--dsw-alias-label-primary);cursor:pointer;padding:2px 0;text-align:left;font:inherit;font-size:13px}
.ssm-p-row .ssm-p-pick:disabled{cursor:default}
.ssm-p-row .ssm-p-pick:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;border-radius:6px}
.ssm-p-setname{font-weight:600;color:var(--dsw-alias-label-primary);max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ssm-p-banner button{font:inherit;font-size:11px;border:1px solid currentColor;border-radius:6px;background:transparent;color:inherit;padding:2px 8px;cursor:pointer;opacity:.85}
.ssm-p-banner button:hover{opacity:1}
.ssm-p-banner .ssm-p-banner-cta{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 26%,transparent);border-color:var(--dsw-alias-state-error-primary,#e5484d);color:var(--dsw-alias-label-primary);opacity:1} /* 卸载二次确认的破坏性动作钮强调变体（终审 Minor 2）：error 软底实心，与同条 × 取消（透明描边）视觉可辨 */
.ssm-p-banner .ssm-p-banner-cta:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 38%,transparent);opacity:1}
.ssm-p-banner .ssm-spin{margin:0} /* 转圈自带 margin-right:5px 与 banner gap:8px 叠加多约 13px（终审 Minor 观感）：banner 内归零，间距交给 gap 统一 */
.ssm-p-search{flex:0 1 220px;min-width:120px;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:3px 10px}
.ssm-p-search:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.ssm-p-row>button{font:inherit;font-size:11px;border:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);color:var(--dsw-alias-label-primary);border-radius:6px;padding:3px 8px;cursor:pointer}
.ssm-p-row>.ssm-p-icon-btn{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary);width:24px;height:24px;padding:0}
.ssm-p-row>button:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 20%,transparent)}
.ssm-p-row>.ssm-p-icon-btn:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);color:var(--dsw-alias-label-primary)}
.ssm-p-gray{opacity:.55}
.ssm-p-name{color:var(--dsw-alias-label-primary);font-size:13px;flex:none;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ssm-p-strike{text-decoration:line-through;color:var(--dsw-alias-label-secondary)}
.ssm-p-seclabel{font-size:11px;font-weight:700;color:var(--dsw-alias-label-secondary);margin-top:4px}
.ssm-p-empty{display:flex;align-items:center;gap:8px;padding:14px 6px;color:var(--dsw-alias-label-secondary);font-size:12px}
.ssm-p-banner-muted{color:var(--dsw-alias-label-secondary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);border-color:var(--dsw-alias-border-l2)}
/* 设置页+右栏美化基座（spec 2026-11-07 §6.2/§6.3）：TaskStrip 横幅壳 + RowShell 行卡 + 品牌软底复刻 */
.ssm-p-task{display:flex;flex-direction:column;gap:5px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}
.ssm-p-task-row{display:flex;align-items:center;gap:6px;font-size:12px}
.ssm-p-rowcard{display:flex;flex-direction:column;gap:1px;border-radius:8px;padding:4px 6px}
.ssm-p-rowcard:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent)}
.ssm-p-rowcard.ssm-p-gray:not(.ssm-p-rowcard-click):hover{background:transparent} /* 灰态只读行（无 onClick：设置页外来常驻行 / 右栏 provider 灰行）不显 hover 底（终审 Minor 6）：不可点的灰行用 hover 暗示可交互是误导；带 -click 的可点灰行不受此收窄影响 */
.ssm-p-rowcard-click{cursor:pointer}
.ssm-p-rowcard-click:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
/* composer 行卡（Task 6.1 收口）leading 槽裸复选框：首行居中（原 .ssm-p-check label 的 margin-top:3px 顶对齐语汇随 label 退役）、focus 环、禁用不手型 */
.ssm-p-rowcard>.ssm-p-row>input[type=checkbox]{margin:0;flex:none;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}
.ssm-p-rowcard>.ssm-p-row>input[type=checkbox]:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ssm-p-rowcard>.ssm-p-row>input[type=checkbox]:disabled{cursor:default}
.ssm-p-rowcard>.ssm-p-row>.ssm-p-icon-btn{opacity:0;transition:opacity .12s}
.ssm-p-rowcard:hover>.ssm-p-row>.ssm-p-icon-btn,.ssm-p-rowcard:focus-within>.ssm-p-row>.ssm-p-icon-btn{opacity:1}
@media (prefers-reduced-motion:reduce){.ssm-p-rowcard>.ssm-p-row>.ssm-p-icon-btn{opacity:1;transition:none}}
.ssm-s-btn{font:inherit;font-size:11px;color:var(--dsw-alias-label-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);border:1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 50%, transparent);border-radius:6px;padding:4px 10px;cursor:pointer} /* 品牌软底复刻：供 .ssm-s-* 界面使用，承接旧区按钮软底选择器的 :not() 豁免职责（spec §5.5/§6.1） */
.ssm-s-btn:hover{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-brand-primary) 70%, transparent)}
/* 库页签（spec 2026-11-07 §6.5）：行内品牌软底按钮需抬回——「.ssm-p-row>button」语态兜底比「.ssm-s-btn」高一级（回收站恢复按钮）；图标钮内转圈去偏移 */
.ssm-p-row>.ssm-s-btn{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 50%,transparent);padding:4px 10px}
.ssm-p-row>.ssm-s-btn:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 70%,transparent)}
.ssm-p-icon-btn .ssm-spin{margin:0}
/* 设置页壳 + 页签分段控件 + msg 横幅（spec 2026-11-07 §6.4）：软底分段页签（选中 brand 14% 药丸、纯文字）+ banner ok 语态；根布局照旧 920px */
.ssm-s-settings{display:flex;flex-direction:column;gap:8px;padding:4px 2px;max-width:920px}
.ssm-s-tabs{display:flex;align-self:flex-start;gap:4px;padding:3px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}
.ssm-s-tab{font:inherit;font-size:12px;border:0;background:0;color:var(--dsw-alias-label-secondary);padding:5px 12px;border-radius:999px;cursor:pointer}
.ssm-s-tab:hover{color:var(--dsw-alias-label-primary)}
.ssm-s-tab-on{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}
.ssm-s-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ssm-p-banner-ok{color:var(--dsw-alias-state-success-primary,#22c55e);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#22c55e) 12%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,#22c55e) 40%,transparent)} /* 成功语态复刻（spec §6.4 msg ok 底；warn/error/muted 见上） */
/* 全局/ops/diag 页签（spec 2026-11-07 §6.6–§6.8）：复选胶囊选中态 brand 软底变体（不动 composer 在用的 .ssm-p-check 基样，AC#14 零变化）+ diag 角色点复刻 + 长文本语态复刻（旧 hint/warn-inline 只换名不换相） */
.ssm-p-check-on{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}
.ssm-p-check-on:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent)}
.ssm-p-lvl{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-label-secondary)} /* 诊断角色点复刻（§6.8 token 配色升级）：warn/error/info/未知级语义照旧 */
.ssm-p-lvl-warn{background:var(--dsw-alias-state-warn-primary,#f5a623)}
.ssm-p-lvl-error{background:var(--dsw-alias-state-error-primary,#e5484d)}
.ssm-p-lvl-info{background:var(--dsw-alias-brand-primary)}
.ssm-p-descwrap{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:normal} /* 长文本语态（11px 次级色；旧 .ssm-hint 是 10px，收口时升一档，spec 2026-11-07 §6.5/§6.8）：长名单/路径/where/fix 不截断（.ssm-p-desc 是 nowrap 兜底） */
.ssm-p-warn{font-size:11px;color:var(--dsw-alias-state-warn-primary,#f5a623);white-space:normal} /* 旧 .ssm-warn-inline 复刻：迁移预览警告行 */
/* 右栏详情 tab（spec 2026-11-07 §6.9）：sticky 头 + 行卡 + 紧凑诊断；宽度由 betterSidebar 决定，本组类只管内（§5.7）——管内边距/滚动值照旧搬自旧 .ssm-rp（该类已随迁移退役） */
.ssm-s-rp{display:flex;flex-direction:column;gap:6px;height:100%;overflow:auto;padding:6px 8px;font-size:12px}
.ssm-s-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;margin:0 -8px;padding:6px 8px;background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l2)} /* 头伸出管内边距成通栏（同款 .ssm-p-head 手法）；opaque 底遮住滚动穿行的内容 */
.ssm-s-dgrow{display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 0;flex-wrap:wrap} /* 旧 .ssm-diag-row 复刻：诊断摘要紧凑行（5 组 × 前 3 条，不含 where/fix） */
.ssm-p-ok{font-size:11px;color:var(--dsw-alias-state-success-primary,#22c55e)} /* 旧 .ssm-ok 复刻：rpSelf ok 语态 ✓ */
.ssm-p-err{font-size:11px;color:var(--dsw-alias-state-error-primary,#e5484d);white-space:normal} /* 旧 .ssm-err 文本语态复刻（与 .ssm-p-warn 同族）：rpSelf detail 行 */
/* 多徽章结果行换行防横溢（Task 5 转交：ops 安装结果行；徽章 .ssm-p-tag 是 flex:none，长名单撑破 920px 卡宽） */
.ssm-s-wrap{flex-wrap:wrap}
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
