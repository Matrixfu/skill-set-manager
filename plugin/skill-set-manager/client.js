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

    function Panel({ ctx, t, sessionId, onClose }) {
      const [state, setState] = React.useState(null);
      const [error, setError] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [confirm, setConfirm] = React.useState(null); // {kind:'switch'|'del', slug}
      const [draft, setDraft] = React.useState('');
      const [renaming, setRenaming] = React.useState(null); // slug | null（面板内改名，Electron 无 window.prompt）
      const [renameDraft, setRenameDraft] = React.useState('');
      const [io, setIo] = React.useState(null); // {mode:'export'|'import', text, copied?}
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
      return h('div', { className: 'ssm-panel', role: 'dialog', 'aria-label': t('panel'), onClick: (e) => e.stopPropagation() },
        h('div', { className: 'ssm-head' },
          h('b', null, t('panel')),
          st.binding?.setSlug ? h('span', { className: 'ssm-cur' }, st.set?.name ?? st.binding.setSlug) : h('span', { className: 'ssm-cur' }, t('noBinding')),
          h('span', { className: 'ssm-grow' }, null),
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
          } }), ' ', lib.name))),
        h('div', { className: 'ssm-sec' }, t('override'), st.sessionOverrideActive ? h('span', { className: 'ssm-cur-tag' }, t('overrideOn')) : null),
        h('div', { className: 'ssm-chips' },
          ...(st.binding?.setSlug ? (st.library ?? []).filter((l) => !eff.has(l.name)).map((l) => h('label', { key: l.name, className: 'ssm-chip' },
            h('input', { type: 'checkbox', checked: false, disabled: busy, onChange: () => run(() => call(ctx, 'startOverride', { sessionId, add: [l.name] })) }), ' ', l.name))
            : []),
          st.sessionOverrideActive ? h('button', { disabled: busy, onClick: () => run(() => call(ctx, 'endOverride', { sessionId })) }, t('endOverride')) : null),
        h('div', { className: 'ssm-hint' }, t('hintP2')));
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

    function OverlayHost({ ctx, t }) {
      const b = useBus();
      if (!b.open) return null;
      return h('div', { className: 'ssm-overlay', onClick: () => bus.setOpen(false) },
        b.sessionId
          ? h(Panel, { ctx, t, sessionId: b.sessionId, onClose: () => bus.setOpen(false) })
          : h('div', { className: 'ssm-panel' }, t('noSession')));
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
        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left', id: PKG, order: 30, label: () => t('chip'),
        }, (props) => h(ComposerChip, { ctx, t, sessionId: props?.sessionId })));
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action', id: PKG, order: 30, label: () => t('chip'),
        }, (props) => h(SidebarChip, { ctx, t, wide: props?.wide })));
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: PKG, order: 30,
        }, () => h(OverlayHost, { ctx, t })));
      },
    };
  },
});
