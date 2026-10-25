/**
 * skill-set-manager client 半：两个入口（composer 工具行左缘 + 侧边栏底部，§12 P0）共用
 * 同一个 shell.overlay 面板；操作一律经 host 半（Remote 面优先、同源 fetch 兜底）——无第二实现（#15）。
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
        diagRun: '运行诊断', fixReclaim: '回收失效链接', fixRebuild: '按当前集重建',
        diagPartition: '分区说明', diagCopies: '副本漂移', diagDangling: '悬空引用',
        diagDeadLinks: '失效链接', diagStructure: '结构问题', diagEnv: '环境',
        none: '（无）', opDone: '完成', backupAt: '备份位置', moreFiles: '…（其余略）',
        unbindGo: '解绑', confirmUnbind: '确认解绑？托管条目将被回收，用户自有条目不动',
        foreignLine: '外来条目（不接管、切换不覆盖）',
        settingsHint: '安装/升级/卸载/回收站/诊断在「设置 → 技能集管理器」',
        tabTitle: '技能集详情', tabDesc: '完整生效清单、状态分区与诊断摘要', openRight: '在右栏打开技能集详情',
        rpEffective: '生效清单', rpSelf: '状态自检', rpDiag: '诊断摘要',
        rpFrozen: '技能集已删除（冻结：清单原样保留）', rpClick: '点击查看 SKILL.md', rpNoSession: '（右栏 tab 未绑定会话）',
        rpForeign: '外来', rpMissing: '缺失', rpDead: '失效',
        rpEmpty: '（无生效技能）', rpDiagFail: '诊断加载失败',
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
        diagRun: 'Run diagnose', fixReclaim: 'Reclaim dead links', fixRebuild: 'Rebuild from set',
        diagPartition: 'Partition', diagCopies: 'Copy drift', diagDangling: 'Dangling refs',
        diagDeadLinks: 'Dead links', diagStructure: 'Structure', diagEnv: 'Environment',
        none: '(none)', opDone: 'Done', backupAt: 'Backup at', moreFiles: '… (rest omitted)',
        unbindGo: 'Unbind', confirmUnbind: 'Unbind? Managed entries are reclaimed; your own entries stay.',
        foreignLine: 'Foreign entries (untouched by switching)',
        settingsHint: 'Install/update/uninstall/trash/diagnose live in Settings → Skill Sets',
        tabTitle: 'Skill set detail', tabDesc: 'Full effective list, status partition and diagnose summary', openRight: 'Open skill set detail in right sidebar',
        rpEffective: 'Effective list', rpSelf: 'Self-check', rpDiag: 'Diagnose summary',
        rpFrozen: 'Set deleted (frozen: list kept as-is)', rpClick: 'Click to open SKILL.md', rpNoSession: '(right tab has no bound session)',
        rpForeign: 'foreign', rpMissing: 'missing', rpDead: 'dead',
        rpEmpty: '(no effective skills)', rpDiagFail: 'diagnose failed',
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
      const eff = new Set(st.effective?.names ?? []);
      const resident = new Set(st.resident ?? []);
      const managed = Object.keys(st.managed ?? {});
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
        ...(st.sets ?? []).map((s) => h('div', { key: s.slug, className: 'ssm-row' + (st.binding?.setSlug === s.slug ? ' ssm-on' : '') },
          h('button', { className: 'ssm-pick', disabled: busy || st.binding?.setSlug === s.slug, onClick: () => doSwitch(s.slug) },
            h('span', null, s.name), h('span', { className: 'ssm-n' }, `${(s.skills ?? []).length} ${t('skillsCount')}`),
            st.binding?.setSlug === s.slug ? h('span', { className: 'ssm-cur-tag' }, t('current')) : null),
          h('span', { className: 'ssm-grow' }, null),
          h('button', { disabled: busy, onClick: () => run(() => call(ctx, 'copySet', { slug: s.slug })) }, t('copy')),
          h('button', { disabled: busy, onClick: () => { setRenaming(s.slug); setRenameDraft(s.name); } }, t('rename')),
          h('button', { disabled: busy, onClick: async () => { try { const j = await call(ctx, 'exportSet', { slug: s.slug }); setIo({ mode: 'export', text: JSON.stringify(j, null, 2), copied: false }); } catch (e) { setError(`${t('opFailed')}: ${e?.message ?? e}`); } } }, t('exportJson')),
          h('button', { disabled: busy, onClick: () => setConfirm({ kind: 'del', slug: s.slug }) }, t('del')),
          renaming === s.slug
            ? h('div', { className: 'ssm-row' },
                h('input', { className: 'ssm-input', autoFocus: true, value: renameDraft, disabled: busy, onChange: (e) => setRenameDraft(e.target.value) }),
                h('button', { disabled: busy || !renameDraft.trim() || renameDraft.trim() === s.name, onClick: () => run(() => call(ctx, 'renameSet', { slug: s.slug, name: renameDraft.trim() })).then(() => setRenaming(null)) }, '✓'),
                h('button', { disabled: busy, onClick: () => setRenaming(null) }, '×'))
            : null)),
        h('div', { className: 'ssm-row' },
          h('input', { className: 'ssm-input', placeholder: t('newName'), value: draft, onChange: (e) => setDraft(e.target.value) }),
          h('button', { disabled: busy || !draft.trim(), onClick: () => run(() => call(ctx, 'saveAsFromEffective', { sessionId, name: draft.trim() }).then(() => setDraft(''))) }, t('saveAs')),
          h('button', { disabled: busy, onClick: () => setIo({ mode: 'import', text: '{"sets":[]}', copied: false }) }, t('importJson'))),
        io
          ? h('div', { className: 'ssm-io' },
              h('textarea', {
                className: 'ssm-textarea', rows: 8, spellCheck: false,
                readOnly: io.mode === 'export', value: io.text, disabled: busy,
                onChange: (e) => setIo({ ...io, text: e.target.value, copied: false }),
              }),
              h('div', { className: 'ssm-row' },
                io.mode === 'export'
                  ? h('button', {
                      disabled: busy,
                      onClick: async () => {
                        try { await navigator.clipboard.writeText(io.text); setIo({ ...io, copied: true }); }
                        catch (e) { setError(`${t('copyFail')}: ${e?.message ?? e}`); }
                      },
                    }, t('copyClip'))
                  : h('button', {
                      disabled: busy || !io.text.trim(),
                      onClick: () => {
                        let payload;
                        try { payload = JSON.parse(io.text); } catch (e) { setError(`${t('importJson')}: JSON ${e?.message ?? e}`); return; }
                        run(() => call(ctx, 'importSets', { payload })).then(() => setIo(null));
                      },
                    }, t('importJson')),
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
        h('div', { className: 'ssm-sec' }, t('managedSec')),
        h('div', { className: 'ssm-chips' }, managed.length ? null : h('span', { className: 'ssm-empty' }, '—'),
          ...managed.map((n) => h('label', { key: n, className: 'ssm-chip' },
            h('input', { type: 'checkbox', checked: true, disabled: busy, onChange: () => run(() => call(ctx, 'startOverride', { sessionId, remove: [n] })) }), ' ', n))),
        h('div', { className: 'ssm-sec' }, t('resident')),
        h('div', { className: 'ssm-hint' }, t('residentHint')),
        h('div', { className: 'ssm-chips' }, ...(st.library ?? []).map((lib) => h('label', { key: lib.name, className: 'ssm-chip' + (resident.has(lib.name) ? ' ssm-on' : '') },
          h('input', { type: 'checkbox', checked: resident.has(lib.name), disabled: busy, onChange: (e) => {
            const next = e.target.checked ? [...(st.resident ?? []), lib.name] : (st.resident ?? []).filter((n) => n !== lib.name);
            run(() => call(ctx, 'setResident', { names: next }));
          } }), ' ', lib.name, h(LibBadges, { lib })))),
        h('div', { className: 'ssm-sec' }, t('override'), st.sessionOverrideActive ? h('span', { className: 'ssm-cur-tag' }, t('overrideOn')) : null),
        h('div', { className: 'ssm-chips' },
          ...(st.binding?.setSlug ? (st.library ?? []).filter((l) => !eff.has(l.name)).map((l) => h('label', { key: l.name, className: 'ssm-chip' },
            h('input', { type: 'checkbox', checked: false, disabled: busy, onChange: () => run(() => call(ctx, 'startOverride', { sessionId, add: [l.name] })) }), ' ', l.name, h(LibBadges, { lib: l })))
            : []),
          st.sessionOverrideActive ? h('button', { disabled: busy, onClick: () => run(() => call(ctx, 'endOverride', { sessionId })) }, t('endOverride')) : null),
        h('div', { className: 'ssm-hint' }, t('hintP2')),
        h('div', { className: 'ssm-hint' }, t('settingsHint')));
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

    function SidebarChip({ ctx, t, wide }) {
      const b = useBus();
      const badge = b.state?.selfCheck && !b.state.selfCheck.ok && !b.state.selfCheck.unbound;
      return h('button', { className: 'ssm-chip-btn', title: t('panel'), onClick: () => bus.setOpen(true) },
        h(Dot, { st: b.state }),
        wide === false ? (badge ? h('span', { className: 'ssm-badge' }, '!') : null) : h(React.Fragment, null, t('chip'), h(Name, { st: b.state }), badge ? h('span', { className: 'ssm-badge' }, '!') : null));
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
              h('button', { disabled: !!busy, onClick: () => setConfirmUn(x.name) }, t('uninstallGo'))),
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
.ssm-chip-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.ssm-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
.ssm-dot-ok{background:var(--dsw-alias-brand-primary)}.ssm-dot-red{background:var(--dsw-alias-status-error,#e5484d)}.ssm-dot-idle{background:var(--dsw-alias-label-secondary)}
.ssm-cur{color:var(--dsw-alias-label-primary);font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ssm-badge{min-width:14px;height:14px;border-radius:7px;background:var(--dsw-alias-status-error,#e5484d);color:#fff;font-size:10px;display:inline-flex;align-items:center;justify-content:center;padding:0 4px}
.ssm-overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center;padding:0 12px 12px;pointer-events:auto}
.ssm-panel{width:min(620px,96vw);max-height:72vh;overflow:auto;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;box-shadow:0 12px 40px rgba(0,0,0,.35)}
.ssm-head{display:flex;align-items:center;gap:8px}
.ssm-x{background:0;border:0;color:inherit;font-size:15px;cursor:pointer;padding:2px 6px}
.ssm-grow{flex:1}
.ssm-root{font-size:11px;color:var(--dsw-alias-label-secondary);word-break:break-all}
.ssm-warn-inline{color:var(--dsw-alias-status-warning,#f5a623)}
.ssm-warn,.ssm-err{font-size:11px;padding:4px 6px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-status-warning,#f5a623) 18%,transparent)}
.ssm-err{background:color-mix(in srgb,var(--dsw-alias-status-error,#e5484d) 16%,transparent)}
.ssm-sec{font-size:11px;font-weight:700;color:var(--dsw-alias-label-secondary);margin-top:4px;display:flex;gap:6px;align-items:center}
.ssm-hint{font-size:10px;color:var(--dsw-alias-label-secondary)}
.ssm-row{display:flex;align-items:center;gap:4px;font-size:12px}
.ssm-pick{flex:1;display:flex;align-items:center;gap:6px;background:0;border:0;color:var(--dsw-alias-label-primary);cursor:pointer;padding:4px 6px;border-radius:6px;text-align:left;min-width:0}
.ssm-pick:hover{background:var(--dsw-alias-interactive-bg-hover)}
.ssm-on{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}
.ssm-n{color:var(--dsw-alias-label-secondary);font-size:11px}
.ssm-cur-tag{font-size:10px;color:var(--dsw-alias-brand-primary)}
.ssm-row button:not(.ssm-pick){background:0;border:0;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:11px;padding:3px 6px;border-radius:5px}
.ssm-row button:not(.ssm-pick):hover{background:var(--dsw-alias-interactive-bg-hover)}
.ssm-input{flex:1;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 7px;min-width:0}
.ssm-io{display:flex;flex-direction:column;gap:6px;margin:6px 0}
.ssm-textarea{width:100%;box-sizing:border-box;resize:vertical;font:11px/1.5 ui-monospace,Consolas,monospace;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:6px 8px}
.ssm-ok{font-size:11px;color:var(--dsw-alias-accent-default)}
.ssm-confirm{font-size:11px;padding:5px 7px;border-radius:6px;background:var(--dsw-alias-bg-layer-1);display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.ssm-confirm button{font:inherit;font-size:11px;border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);border-radius:6px;padding:3px 8px;cursor:pointer}
.ssm-chips{display:flex;flex-wrap:wrap;gap:4px;font-size:11px}
.ssm-chips .ssm-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;cursor:pointer}
.ssm-chips .ssm-on{border-color:var(--dsw-alias-brand-primary)}
.ssm-empty{font-size:11px;color:var(--dsw-alias-label-secondary)}
.ssm-settings{display:flex;flex-direction:column;gap:8px;padding:4px 2px;max-width:920px}
.ssm-tabs{display:flex;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.ssm-tab{font:inherit;font-size:12px;border:0;background:0;color:var(--dsw-alias-label-secondary);padding:6px 10px;cursor:pointer;border-radius:6px 6px 0 0}
.ssm-tab:hover{color:var(--dsw-alias-label-primary)}
.ssm-tab-on{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}
.ssm-srow{display:flex;flex-direction:column;gap:3px;padding:5px 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px}
.ssm-tag{font-size:10px;padding:1px 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);flex:none}
.ssm-tag-warn{color:var(--dsw-alias-status-warning,#f5a623);border-color:currentColor}
.ssm-diag-row{display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 0;flex-wrap:wrap}
.ssm-lvl{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-label-secondary)}
.ssm-lvl-warn{background:var(--dsw-alias-status-warning,#f5a623)}
.ssm-lvl-error{background:var(--dsw-alias-status-error,#e5484d)}
.ssm-lvl-info{background:var(--dsw-alias-brand-primary)}
.ssm-rp{display:flex;flex-direction:column;gap:6px;height:100%;overflow:auto;padding:6px 8px;font-size:12px}
.ssm-click{cursor:pointer}
.ssm-click:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));border-radius:6px}
.ssm-settings .ssm-row button{background:0;border:0;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:11px;padding:3px 6px;border-radius:5px}
.ssm-settings .ssm-row button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.ssm-settings .ssm-confirm button{font:inherit;font-size:11px;border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);border-radius:6px;padding:3px 8px;cursor:pointer}
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
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action', id: PKG, order: 30, label: () => t('chip'),
        }, (props) => h(SidebarChip, { ctx, t, wide: props?.wide })));
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
