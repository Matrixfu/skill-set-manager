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
        residentHint: '常驻 = 从库链入全局生效区，所有项目自动包含；生效清单比技能集大属正常',
        managedSec: '技能集提供（受管）', override: '临时覆盖', overrideOn: '临时覆盖中', endOverride: '结束覆盖',
        undo: '撤销切换（回到上一份生效清单）', switchTo: '切换', current: '当前', saveAs: '另存为当前清单',
        newName: '新名称', copy: '复制', rename: '改名', del: '删除', confirmDel: '确认删除该技能集？受影响项目将冻结绑定',
        confirmSwitch: '确认切换：将改写仓库根的 .dsh/skills/（仅托管条目）', exportJson: '导出', importJson: '导入',
        regen: '重新生成', noBinding: '未绑定技能集', skillsCount: '个技能', loadFailed: '加载失败',
        opFailed: '操作失败', empty: '（暂无技能集）', hintP2: '技能变化下一轮请求生效；/ 命令列表属 P2，新会话前不同步',
        copyClip: '复制到剪贴板', copied: '已复制 ✓', copyFail: '复制失败',
        residentPick: '勾选常驻', noSession: '先在对话页打开一个会话',
        settingsLabel: '技能集管理器', tabLibrary: '库', tabOps: '安装与更新', tabDiag: '诊断',
        filterPh: '按名称/来源过滤', managedTag: '受管', unmanagedTag: '未登记', modifiedTag: '本地改动',
        backupsTitle: '回收站', restoreGo: '恢复', checkUp: '检查更新', applyUp: '应用更新',
        upToDate: '已是最新', upActions: '差异', skipNote: '本地改动的文件已跳过',
        uninstallGo: '卸载', confirmUn: '确认卸载？（先备份→从所有集移除→各项目回收托管条目）',
        installTitle: '从 GitHub 安装', installSpecPh: '仓库规格 owner/repo[@ref][/subpath]', installGo: '安装', overwriteChk: '覆盖同名（先备份）',
        migrateTitle: '通用生效区迁移（一次性）', migratePreview: '预览迁移', migrateApply: '执行迁移', migrateUndo: '回滚迁移',
        migrateMoves: '将移动', migrateKeep: '同名保留',
        migrateAgentsTitle: '跨 harness 通用区迁移（~/.agents/skills，一次性）', migrateAgentsGo: '预览并迁移',
        migrateAgentsWarn: '移动后，其他 harness 将只剩常驻技能；被移技能随后在技能库中登记为本地技能。',
        diagRun: '运行诊断', fixReclaim: '回收失效链接', fixRebuild: '按当前集重建',
        diagPartition: '分区说明', diagCopies: '副本漂移', diagDangling: '悬空引用',
        diagDeadLinks: '失效链接', diagStructure: '结构问题', diagEnv: '环境',
        none: '（无）', opDone: '完成', backupAt: '备份位置', moreFiles: '…（其余略）',
        unbindGo: '解绑', confirmUnbind: '确认解绑？托管条目将被回收，用户自有条目不动',
        foreignLine: '外来条目（不接管、切换不覆盖）',
        settingsHint: '安装/升级/卸载/回收站/诊断在「设置 → 技能集管理器」',
        searchPh: '按名称/用途搜索技能…', hitCount: '命中', pendingTag: '待翻译',
        residentRow: '全局常驻 · 已在所有项目生效', foreignRow: '外来常驻 · 其他工具放入 ~/.agents/skills',
        goSettings: '去设置 → 技能集管理器管理 ›', unboundHint: '本项目未绑定技能集：先在上方选择，或用临时覆盖（仅本会话）',
        tabTitle: '技能集详情', tabDesc: '完整生效清单、状态分区与诊断摘要', openRight: '在右栏打开技能集详情',
        rpEffective: '生效清单', rpSelf: '状态自检', rpDiag: '诊断摘要',
        rpFrozen: '技能集已删除（冻结：清单原样保留）', rpClick: '点击查看 SKILL.md', rpNoSession: '（右栏 tab 未绑定会话）',
        rpForeign: '外来', rpMissing: '缺失', rpDead: '失效',
        rpEmpty: '（无生效技能）', rpDiagFail: '诊断加载失败',
        importPreviewBtn: '预览导入', importApply: '应用导入', importConflict: '显示名已存在（该项跳过）',
        importAllPresent: '技能齐备', importMissing: '本机缺失', importNoPin: '无来源 pin，装不了',
        importChoiceInstall: '按 pin 安装', importChoicePlaceholder: '先占位', importChoiceIgnore: '忽略',
        importDefaultHint: '每个缺失技能选一项；不选 = 忽略（插件不自动联网安装）', importApplied: '导入完成',
        claimGo: '认领来源', claimEdit: '改认领', claimSourcePh: '来源 owner/repo[/subpath]', claimCommitPh: 'commit（可空）',
        claimUndo: '撤认领', claimHint: '认领 = 以当前盘上内容为基线写 manifest（此后本地改动可被升级识别并跳过）',
        editMembers: '成员', editTitle: '编辑成员', saveBtn: '保存',
        memberHint: '勾选 = 该集包含，保存即写回；当前绑定集会立即重新生成生效清单（会话临时覆盖保留）', memberMissing: '不在库',
      },
      en: {
        chip: 'Skill sets', panel: 'Skill Set Manager', close: 'Close', sets: 'Skill sets', projectRoot: 'Project root',
        rootDrift: '(≠ session dir — switching affects every session in this repo)', resident: 'Global resident (unmanaged)',
        residentHint: 'Resident = linked from library into the global effective zone; every project includes them automatically',
        managedSec: 'Set-provided (managed)', override: 'Session override', overrideOn: 'Override active', endOverride: 'End override',
        undo: 'Undo switch (restore previous effective set)', switchTo: 'Switch', current: 'current', saveAs: 'Save current as set',
        newName: 'New name', copy: 'Copy', rename: 'Rename', del: 'Delete', confirmDel: 'Delete this set? Affected projects freeze their binding.',
        confirmSwitch: 'Confirm switch: rewrites .dsh/skills/ at the repo root (managed entries only)', exportJson: 'Export', importJson: 'Import',
        regen: 'Regenerate', noBinding: 'No skill set bound', skillsCount: 'skills', loadFailed: 'Load failed',
        opFailed: 'Operation failed', empty: '(no skill sets yet)', hintP2: 'Skill changes take effect on the next request; / commands are P2 (new sessions only)',
        copyClip: 'Copy to clipboard', copied: 'Copied ✓', copyFail: 'Copy failed',
        residentPick: 'Toggle resident', noSession: 'Open a conversation session first',
        settingsLabel: 'Skill Sets', tabLibrary: 'Library', tabOps: 'Install & update', tabDiag: 'Diagnose',
        filterPh: 'Filter by name/source', managedTag: 'managed', unmanagedTag: 'untracked', modifiedTag: 'locally modified',
        backupsTitle: 'Trash', restoreGo: 'Restore', checkUp: 'Check update', applyUp: 'Apply update',
        upToDate: 'Up to date', upActions: 'Diff', skipNote: 'locally modified files skipped',
        uninstallGo: 'Uninstall', confirmUn: 'Uninstall? (backup → remove from all sets → reclaim managed entries per project)',
        installTitle: 'Install from GitHub', installSpecPh: 'repo spec owner/repo[@ref][/subpath]', installGo: 'Install', overwriteChk: 'overwrite same name (backup first)',
        migrateTitle: 'Migrate common skills (one-time)', migratePreview: 'Preview', migrateApply: 'Apply', migrateUndo: 'Undo migration',
        migrateMoves: 'Will move', migrateKeep: 'Kept (name clash)',
        migrateAgentsTitle: 'Migrate cross-harness skills (~/.agents/skills, one-time)', migrateAgentsGo: 'Preview & migrate',
        migrateAgentsWarn: 'Other harnesses will keep only resident skills; moved skills are registered as local library skills.',
        diagRun: 'Run diagnose', fixReclaim: 'Reclaim dead links', fixRebuild: 'Rebuild from set',
        diagPartition: 'Partition', diagCopies: 'Copy drift', diagDangling: 'Dangling refs',
        diagDeadLinks: 'Dead links', diagStructure: 'Structure', diagEnv: 'Environment',
        none: '(none)', opDone: 'Done', backupAt: 'Backup at', moreFiles: '… (rest omitted)',
        unbindGo: 'Unbind', confirmUnbind: 'Unbind? Managed entries are reclaimed; your own entries stay.',
        foreignLine: 'Foreign entries (untouched by switching)',
        settingsHint: 'Install/update/uninstall/trash/diagnose live in Settings → Skill Sets',
        searchPh: 'Search skills by name or purpose…', hitCount: 'matches', pendingTag: 'untranslated',
        residentRow: 'Global resident · active in every project', foreignRow: 'Foreign resident · from ~/.agents/skills',
        goSettings: 'manage in Settings → Skill Sets ›', unboundHint: 'No skill set bound: pick one above, or use session override',
        tabTitle: 'Skill set detail', tabDesc: 'Full effective list, status partition and diagnose summary', openRight: 'Open skill set detail in right sidebar',
        rpEffective: 'Effective list', rpSelf: 'Self-check', rpDiag: 'Diagnose summary',
        rpFrozen: 'Set deleted (frozen: list kept as-is)', rpClick: 'Click to open SKILL.md', rpNoSession: '(right tab has no bound session)',
        rpForeign: 'foreign', rpMissing: 'missing', rpDead: 'dead',
        rpEmpty: '(no effective skills)', rpDiagFail: 'diagnose failed',
        importPreviewBtn: 'Preview import', importApply: 'Apply import', importConflict: 'name exists (this item is skipped)',
        importAllPresent: 'all skills present', importMissing: 'missing locally', importNoPin: 'no source pin — cannot install',
        importChoiceInstall: 'Install by pin', importChoicePlaceholder: 'Placeholder', importChoiceIgnore: 'Ignore',
        importDefaultHint: 'Pick one per missing skill; unpicked = ignore (no automatic network install)', importApplied: 'Import done',
        claimGo: 'Claim source', claimEdit: 'Re-claim', claimSourcePh: 'source owner/repo[/subpath]', claimCommitPh: 'commit (optional)',
        claimUndo: 'Unclaim', claimHint: 'Claiming writes a manifest with the current files as baseline (later local edits are then detected and skipped on update)',
        editMembers: 'Members', editTitle: 'Edit members', saveBtn: 'Save',
        memberHint: 'Checked = in this set; Save writes it back. The bound set rebuilds its effective list immediately (session overrides stay)', memberMissing: 'not in library',
      },
    };

    /** 入口与 overlay 面板共享的模块级总线（overlay 是 root scope，拿不到 sessionId prop）。 */
    const bus = {
      open: false, sessionId: null, state: null, subs: new Set(),
      setOpen(v) { this.open = v; this.subs.forEach((f) => f()); },
      setSession(id) { if (id && id !== this.sessionId) { this.sessionId = id; this.subs.forEach((f) => f()); } },
      clearSessionIf(id) { if (id && this.sessionId === id) { this.sessionId = null; this.subs.forEach((f) => f()); } },
      setState(s) { this.state = s; this.subs.forEach((f) => f()); },
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
        try { await fn(); } catch (e) { setError(`${t('opFailed')}: ${e?.message ?? e}`); }
        finally { setBusy(false); setConfirm(null); await reload(); }
      };
      const st = state ?? {};
      // 「已在项目」口径 = JSON 生效清单 ∪ 托管台账：临时覆盖加的技能只进台账、不进 state.effective
      // 的 JSON 口径，加完必须即从候选区撤回（受管区即显示为选中勾选），否则复选框永远显未勾（用户报）。
      const eff = new Set([...(st.effective?.names ?? []), ...Object.keys(st.managed ?? {})]);
      const resident = new Set(st.resident ?? []);
      const managed = Object.keys(st.managed ?? {});
      // P3 搜索结果（设计 §6.3/§6.4）：语料 = 库行 ∪ 常驻名单 ∪ 盘上外来常驻（灰行判定 = 名单 ∪ 实扫）
      const foreignRes = new Set(st.residentForeign ?? []);
      const bound = !!st.binding?.setSlug;
      const qq = q.trim();
      const corpus = [...(st.library ?? [])];
      for (const n of new Set([...(st.resident ?? []), ...foreignRes])) if (!corpus.some((l) => l.name === n)) corpus.push({ name: n, source: 'resident', description: null, descriptionZh: null });
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
              sc.frozen ? null : h('button', { disabled: busy, onClick: () => run(() => call(ctx, 'bind', { sessionId, slug: st.binding?.setSlug })) }, t('regen')))
          : null,
        error ? h('div', { className: 'ssm-err' }, error) : null,
        confirm?.kind === 'switch'
          ? h('div', { className: 'ssm-confirm' }, t('confirmSwitch'), ' ', st.projectRoot, ' ',
              h('button', { autoFocus: true, disabled: busy, onClick: () => run(() => call(ctx, 'switchSet', { sessionId, slug: confirm.slug })) }, t('switchTo')),
              h('button', { onClick: () => setConfirm(null) }, '×'))
          : null,
        confirm?.kind === 'del'
          ? h('div', { className: 'ssm-confirm' }, t('confirmDel'), ' ', confirm.slug, ' ',
              h('button', { autoFocus: true, disabled: busy, onClick: () => run(() => call(ctx, 'deleteSet', { slug: confirm.slug })) }, t('del')),
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
            h('button', { disabled: busy, onClick: () => setConfirm({ kind: 'del', slug: s.slug }) }, t('del'))),
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
                h('div', { className: 'ssm-chips' },
                  ...[...new Set([...(st.library ?? []).map((l) => l.name), ...(s.skills ?? [])])].sort()
                    .map((n) => h('label', { key: n, className: 'ssm-chip' + (edit.picked[n] ? ' ssm-on' : '') },
                      h('input', { type: 'checkbox', checked: !!edit.picked[n], disabled: busy, onChange: () => setEdit({ ...edit, picked: { ...edit.picked, [n]: !edit.picked[n] } }) }), ' ', n,
                      (st.library ?? []).some((l) => l.name === n) ? null : h('span', { className: 'ssm-warn-inline' }, ` ${t('memberMissing')}`)))),
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
          h('button', { disabled: busy || !draft.trim(), onClick: () => run(() => call(ctx, 'saveAsFromEffective', { sessionId, name: draft.trim() }).then(() => setDraft(''))) }, t('saveAs')),
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
              h('button', { autoFocus: true, disabled: busy, onClick: () => run(() => call(ctx, 'unbind', { sessionId })) }, t('unbindGo')),
              h('button', { onClick: () => setConfirmUnbind(false) }, '×'))
          : h('div', { className: 'ssm-row' }, h('button', { disabled: busy, onClick: () => setConfirmUnbind(true) }, t('unbindGo'))))
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
              ...hits.map((l) => {
                const isRes = resident.has(l.name) || foreignRes.has(l.name);
                if (isRes) return h('div', { key: l.name, className: 'ssm-row ssm-gray', title: l.descriptionZh ?? l.description ?? undefined }, // 灰行只读、无复选框（反目标项）
                  h('span', null, l.name),
                  h('span', { className: 'ssm-n' }, ' ', resident.has(l.name) ? t('residentRow') : t('foreignRow')),
                  h('span', { className: 'ssm-grow' }, null),
                  h('span', { className: 'ssm-n' }, t('goSettings'))); // T0 静态裁定：无编程跳转 → 纯文案
                const on = eff.has(l.name);
                return h('div', { key: l.name, className: 'ssm-row' },
                  h('label', { className: 'ssm-chip' + (on ? ' ssm-on' : '') },
                    h('input', { type: 'checkbox', checked: on, disabled: busy || !bound, title: l.descriptionZh ?? undefined,
                      onChange: () => run(() => call(ctx, 'startOverride', { sessionId, ...(on ? { remove: [l.name] } : { add: [l.name] }) })) }), ' ', l.name, h(LibBadges, { lib: l })),
                  h('span', { className: 'ssm-grow' }, null),
                  l.descriptionZh
                    ? h('span', { className: 'ssm-n', title: l.description ?? undefined }, l.descriptionZh)
                    : l.description
                      ? h('span', { className: 'ssm-desc-en', title: l.description }, l.description, ' ', h('span', { className: 'ssm-warn-inline' }, t('pendingTag')))
                      : null);
              }))
          : h(React.Fragment, null,
              h('div', { className: 'ssm-sec' }, t('managedSec')),
              h('div', { className: 'ssm-chips' }, managed.length ? null : h('span', { className: 'ssm-empty' }, '—'),
                ...managed.map((n) => h('label', { key: n, className: 'ssm-chip' },
                  h('input', { type: 'checkbox', checked: true, disabled: busy, onChange: () => run(() => call(ctx, 'startOverride', { sessionId, remove: [n] })) }), ' ', n))),
              // 常驻大平铺段已删（P3 设计 §6.3）：常驻管理移设置页「全局技能集」tab；弹窗内仅搜索结果灰行
              h('div', { className: 'ssm-sec' }, t('override'), st.sessionOverrideActive ? h('span', { className: 'ssm-cur-tag' }, t('overrideOn')) : null),
              h('div', { className: 'ssm-chips' },
                ...(st.binding?.setSlug ? (st.library ?? []).filter((l) => !eff.has(l.name)).map((l) => h('label', { key: l.name, className: 'ssm-chip', title: l.descriptionZh ?? undefined },
                  h('input', { type: 'checkbox', checked: false, disabled: busy, onChange: () => run(() => call(ctx, 'startOverride', { sessionId, add: [l.name] })) }), ' ', l.name, h(LibBadges, { lib: l })))
                  : []),
                st.sessionOverrideActive ? h('button', { disabled: busy, onClick: () => run(() => call(ctx, 'endOverride', { sessionId })) }, t('endOverride')) : null),
              h('div', { className: 'ssm-hint' }, t('hintP2')),
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
      const sessionId = scope?.sessionId ?? null;
      React.useEffect(() => { setSt(null); setDg(null); setDgErr(null); }, [sessionId]); // scope 切换先清旧数据，防瞬态串会话
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
      React.useEffect(() => { if (visible !== false) load(); }, [load, visible]); // parked 时暂停拉取（计划 T0 口径，review m3）
      if (!sessionId) return h('div', { className: 'ssm-rp' }, t('rpNoSession'));
      const sc = st?.selfCheck ?? {};
      const resident = new Set(st?.resident ?? []);
      const managed = st?.managed ?? {};
      const foreign = new Set(sc.foreign ?? []);
      const broken = new Set(sc.brokenLinks ?? []);
      const missing = new Set(st?.effective?.missing ?? []);
      const libMap = new Map((st?.library ?? []).map((l) => [l.name, l]));
      const names = [...new Set([...(st?.effective?.names ?? []), ...Object.keys(managed), ...foreign])].sort();
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
        st && names.length === 0 ? h('div', { className: 'ssm-empty' }, t('rpEmpty')) : null,
        st ? h('div', null, ...names.map(row)) : null,
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
      const [diag, setDiag] = React.useState(null);
      const load = React.useCallback(async () => {
        try { const v = await call(ctx, 'libraryList', {}); setLib(v.library ?? []); }
        catch (e) { setMsg({ kind: 'err', text: `${t('loadFailed')}: ${e?.message ?? e}` }); }
      }, [ctx]);
      React.useEffect(() => { load(); }, [load]);
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
      const sess = () => (bus.sessionId ? { sessionId: bus.sessionId } : {}); // 项目面必须带活动会话（review M2）
      const q = filter.trim().toLowerCase();
      const rows = lib.filter((x) => !q || x.name.toLowerCase().includes(q) || String(x.source).toLowerCase().includes(q));
      const counts = (files) => {
        const c = { update: 0, add: 0, remove: 0, 'skip-modified': 0 };
        for (const f of files ?? []) if (c[f.action] !== undefined) c[f.action] += 1;
        return c;
      };
      const tabBtn = (id, label) => h('button', { className: 'ssm-tab' + (tab === id ? ' ssm-tab-on' : ''), disabled: !!busy, onClick: () => setTab(id) }, label);
      return h('div', { className: 'ssm-settings' },
        h('div', { className: 'ssm-tabs' }, tabBtn('library', t('tabLibrary')), tabBtn('ops', t('tabOps')), tabBtn('diag', t('tabDiag'))),
        msg ? h('div', { className: msg.kind === 'err' ? 'ssm-err' : 'ssm-ok' }, msg.text) : null,
        tab === 'library' ? h(React.Fragment, null,
          h('input', { className: 'ssm-input', style: { maxWidth: 300 }, placeholder: t('filterPh'), value: filter, onChange: (e) => setFilter(e.target.value) }),
          rows.length === 0 ? h('div', { className: 'ssm-empty' }, t('empty')) : null,
          ...rows.map((x) => h('div', { key: x.name, className: 'ssm-srow' },
            h('div', { className: 'ssm-row' },
              h('span', { className: 'ssm-cur' }, x.name),
              h(Tag, { text: x.managed ? t('managedTag') : t('unmanagedTag'), warn: !x.managed }),
              x.localModified ? h(Tag, { text: t('modifiedTag'), warn: true }) : null,
              h('span', { className: 'ssm-n' }, `${String(x.source).replace('github:', '')}${x.commit ? ` @${String(x.commit).slice(0, 7)}` : ''}`),
              h('span', { className: 'ssm-grow' }, null),
              String(x.source).startsWith('github:')
                ? h('button', { disabled: !!busy, onClick: () => run(`chk:${x.name}`, async () => { const v = await call(ctx, 'updateCheck', { name: x.name }); setUpRes((m) => ({ ...m, [x.name]: v })); }) }, t('checkUp'))
                : null,
              upRes[x.name] && !upRes[x.name].upToDate
                ? h('button', { disabled: !!busy, onClick: () => run(`ap:${x.name}`, async () => { const r = await call(ctx, 'updateApply', { name: x.name }); setUpRes((m) => ({ ...m, [x.name]: null })); await load(); return r?.backup ? { noteText: `${t('opDone')} · ${t('backupAt')} ${r.backup}` } : null; }) }, t('applyUp'))
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
              h('button', { disabled: !!busy, onClick: () => setConfirmUn(x.name) }, t('uninstallGo'))),
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
                      return `${t('upActions')}: ↑${c.update} +${c.add} −${c.remove} ⚠${c['skip-modified']} → ${String(upRes[x.name].remote ?? '').slice(0, 7)}${c['skip-modified'] ? ` (${t('skipNote')})` : ''}`;
                    })()),
                // 文件级 diff + 跳过项名单（§13.6 / review m5）：非 same 的条目逐行列出
                ...(upRes[x.name].files ?? []).filter((f) => f.action !== 'same').slice(0, 15)
                  .map((f) => h('div', { key: f.path, className: 'ssm-hint' }, f.action === 'skip-modified' ? '⚠ ' : `${f.action === 'update' ? '↑' : f.action === 'add' ? '+' : '−'} `, f.path)),
                (upRes[x.name].files ?? []).filter((f) => f.action !== 'same').length > 15 ? h('div', { className: 'ssm-hint' }, t('moreFiles')) : null)
              : null,
            confirmUn === x.name
              ? h('div', { className: 'ssm-confirm' }, t('confirmUn'), ' ', x.name, ' ',
                  h('button', { autoFocus: true, disabled: !!busy, onClick: () => run(`un:${x.name}`, async () => { await call(ctx, 'uninstallSkill', { name: x.name }); setConfirmUn(null); setUpRes((m) => ({ ...m, [x.name]: null })); await load(); }) }, t('uninstallGo')),
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
            h('button', { disabled: !!busy || !bus.sessionId, onClick: () => run('rebuild', async () => { await call(ctx, 'rebuildManaged', sess()); setDiag(await call(ctx, 'diagnoseRun', sess())); }) }, t('fixRebuild')),
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
.ssm-row button:not(.ssm-pick){background:0;border:0;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:11px;padding:3px 6px;border-radius:5px}
.ssm-row button:not(.ssm-pick):hover{background:color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent)}
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
.ssm-settings .ssm-row button{background:0;border:0;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:11px;padding:3px 6px;border-radius:5px}
.ssm-settings .ssm-row button:hover{background:color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent)}
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
