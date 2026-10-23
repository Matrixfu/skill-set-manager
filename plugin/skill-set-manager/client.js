/**
 * skill-set-manager client 半：composer 工具行左缘入口（徽标）+ composer 卡内浮层面板。
 * 操作一律经 host 半（Remote 面优先，同源 fetch 兜底）——无第二实现（§14/#15）。
 */
window.__ModuleLoader__.load({
  id: '@matrixfu/skill-set-manager',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const PKG = '@matrixfu/skill-set-manager';

    const DICTS = {
      zh: {
        chip: '技能集', panel: '技能集管理器', close: '关闭', sets: '技能集', resident: '常驻技能',
        override: '临时覆盖', overrideOn: '临时覆盖中', endOverride: '结束覆盖', undo: '撤销切换',
        switchTo: '切换', current: '当前', saveAs: '另存为当前清单', newName: '新名称', create: '新建',
        copy: '复制', rename: '改名', del: '删除', exportJson: '导出', importJson: '导入',
        confirmSwitch: '切换将改写本项目 .dsh/skills/（仅托管条目）', add: '加入', remove: '移出',
        regen: '重新生成', noBinding: '未绑定技能集', library: '技能库', skillsCount: '个技能',
        loadFailed: '加载失败', opFailed: '操作失败', empty: '（暂无技能集）',
      },
      en: {
        chip: 'Skill sets', panel: 'Skill Set Manager', close: 'Close', sets: 'Skill sets', resident: 'Resident skills',
        override: 'Session override', overrideOn: 'Override active', endOverride: 'End override', undo: 'Undo switch',
        switchTo: 'Switch', current: 'current', saveAs: 'Save current as set', newName: 'New name', create: 'Create',
        copy: 'Copy', rename: 'Rename', del: 'Delete', exportJson: 'Export', importJson: 'Import',
        confirmSwitch: 'Switch rewrites .dsh/skills/ in this project (managed entries only)', add: 'add', remove: 'remove',
        regen: 'Regenerate', noBinding: 'No skill set bound', library: 'Skill library', skillsCount: 'skills',
        loadFailed: 'Load failed', opFailed: 'Operation failed', empty: '(no skill sets yet)',
      },
    };

    /** Remote 面优先（RemoteResult 归一化），失败走同源 fetch（同一 host 实现）。 */
    async function call(ctx, method, args) {
      const face = ctx.get('remote')?.['skill-set-manager'];
      if (face && typeof face[method] === 'function') {
        try {
          const r = await face[method](args ?? {});
          if (r && typeof r === 'object' && ('value' in r || 'error' in r)) {
            if (r.error) throw new Error(typeof r.error === 'string' ? r.error : r.error?.message ?? JSON.stringify(r.error));
            return r.value;
          }
          return r;
        } catch (e) {
          if (!/fetch|404|not found|no face|proxy/i.test(String(e?.message ?? ''))) throw e;
        }
      }
      const res = await fetch('/api/skill-set-manager', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method, args: args ?? {} }), credentials: 'same-origin',
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.error) throw new Error(j.error || `HTTP ${res.status}`);
      return j.value;
    }

    function SkillSetPanel({ ctx, t, state, reload, setError, onDone, busy, setBusy }) {
      const [open, setOpen] = React.useState(null); // {kind:'switch'|'del', slug}
      const [draft, setDraft] = React.useState('');
      const run = async (fn, keepOpen) => {
        setBusy(true); setError(null);
        try { await fn(); } catch (e) { setError(`${t('opFailed')}: ${e?.message ?? e}`); }
        finally { setBusy(false); if (!keepOpen) setOpen(null); await reload(); }
      };
      const eff = new Set(state?.effective?.names ?? []);
      const resident = new Set(state?.resident ?? []);
      const targetNames = (set) => new Set([...(state?.resident ?? []), ...(set?.skills ?? [])]);
      const diffOf = (slug) => {
        const set = (state?.sets ?? []).find((s) => s.slug === slug);
        const tgt = targetNames(set);
        return { add: [...tgt].filter((n) => !eff.has(n)), drop: [...eff].filter((n) => !tgt.has(n)) };
      };
      const st = state ?? {};
      return h('div', { className: 'ssm-panel', role: 'dialog', 'aria-label': t('panel') },
        h('div', { className: 'ssm-head' },
          h('b', null, t('panel')),
          st.binding?.setSlug ? h('span', { className: 'ssm-cur' }, st.set?.name ?? st.binding.setSlug) : h('span', { className: 'ssm-cur' }, t('noBinding')),
          h('span', { className: 'ssm-grow' }, null),
          h('button', { className: 'ssm-x', onClick: onDone, 'aria-label': t('close') }, '×')),
        st.presetWarn ? h('div', { className: 'ssm-warn' }, st.presetWarn) : null,
        st.selfCheck && !st.selfCheck.ok && !st.selfCheck.unbound
          ? h('div', { className: st.selfCheck.frozen ? 'ssm-warn' : 'ssm-err' }, st.selfCheck.detail, ' ',
              h('button', { disabled: busy, onClick: () => run(() => call(ctx, 'bind', { sessionId: st.sessionId, slug: st.binding?.setSlug })) }, t('regen')))
          : null,
        open?.kind === 'switch'
          ? h('div', { className: 'ssm-confirm' }, t('confirmSwitch'), '：',
              (diffOf(open.slug).add.length ? `+${diffOf(open.slug).add.length}` : ''), (diffOf(open.slug).drop.length ? ` −${diffOf(open.slug).drop.length}` : ''), ' ',
              h('button', { autoFocus: true, disabled: busy, onClick: () => run(() => call(ctx, 'switchSet', { sessionId: st.sessionId, slug: open.slug })) }, t('switchTo')),
              h('button', { onClick: () => setOpen(null) }, '×'))
          : null,
        open?.kind === 'del'
          ? h('div', { className: 'ssm-confirm' }, open.slug, ' ',
              h('button', { autoFocus: true, disabled: busy, onClick: () => run(() => call(ctx, 'deleteSet', { slug: open.slug })) }, t('del')),
              h('button', { onClick: () => setOpen(null) }, '×'))
          : null,
        h('div', { className: 'ssm-sec' }, t('sets')),
        (st.sets ?? []).length === 0 ? h('div', { className: 'ssm-empty' }, t('empty')) : null,
        ...(st.sets ?? []).map((s) => h('div', { key: s.slug, className: 'ssm-row' + (st.binding?.setSlug === s.slug ? ' ssm-on' : '') },
          h('button', { className: 'ssm-pick', disabled: busy || st.binding?.setSlug === s.slug, onClick: () => setOpen({ kind: 'switch', slug: s.slug }) },
            h('span', null, s.name), h('span', { className: 'ssm-n' }, `${(s.skills ?? []).length} ${t('skillsCount')}`),
            st.binding?.setSlug === s.slug ? h('span', { className: 'ssm-cur-tag' }, t('current')) : null),
          h('span', { className: 'ssm-grow' }, null),
          h('button', { disabled: busy, onClick: () => run(async () => { await call(ctx, 'copySet', { slug: s.slug }); }, true) }, t('copy')),
          h('button', { disabled: busy, onClick: async () => { const n = window.prompt(t('rename'), s.name); if (n && n !== s.name) await run(() => call(ctx, 'renameSet', { slug: s.slug, name: n }), true); } }, t('rename')),
          h('button', { disabled: busy, onClick: async () => { try { const j = await call(ctx, 'exportSet', { slug: s.slug }); await navigator.clipboard.writeText(JSON.stringify(j, null, 2)); } catch (e) { setError(`${t('opFailed')}: ${e?.message ?? e}`); } } }, t('exportJson')),
          h('button', { disabled: busy, onClick: () => setOpen({ kind: 'del', slug: s.slug }) }, t('del')))),
        h('div', { className: 'ssm-row' },
          h('input', { className: 'ssm-input', placeholder: t('newName'), value: draft, onChange: (e) => setDraft(e.target.value) }),
          h('button', { disabled: busy || !draft.trim(), onClick: () => run(() => call(ctx, 'saveAsFromEffective', { sessionId: st.sessionId, name: draft.trim() }).then(() => setDraft('')), true) }, t('saveAs')),
          h('button', { disabled: busy, onClick: async () => { const txt = window.prompt(t('importJson'), '{"sets":[]}'); if (txt) await run(() => call(ctx, 'importSets', { payload: JSON.parse(txt) }), true); } }, t('importJson'))),
        h('div', { className: 'ssm-sec' }, t('resident')),
        h('div', { className: 'ssm-chips' }, ...(st.library ?? []).map((lib) => h('label', { key: lib.name, className: 'ssm-chip' + (resident.has(lib.name) ? ' ssm-on' : '') },
          h('input', { type: 'checkbox', checked: resident.has(lib.name), disabled: busy, onChange: (e) => {
            const next = e.target.checked ? [...(state?.resident ?? []), lib.name] : (state?.resident ?? []).filter((n) => n !== lib.name);
            run(() => call(ctx, 'setResident', { names: next }), true);
          } }), ' ', lib.name))),
        h('div', { className: 'ssm-sec' }, t('override'), st.managed && Object.keys(st.managed).length ? '' : '',
          (state?.sessionOverrideActive ?? false) ? h('span', { className: 'ssm-cur-tag' }, t('overrideOn')) : null),
        h('div', { className: 'ssm-chips' },
          ...(st.binding?.setSlug
            ? [
              ...[...eff].map((n) => h('label', { key: n, className: 'ssm-chip' },
                h('input', { type: 'checkbox', checked: true, disabled: busy, onChange: () => run(() => call(ctx, 'startOverride', { sessionId: st.sessionId, remove: [n] }), true) }), ' ', n, ' ', t('remove'))),
              ...(st.library ?? []).filter((l) => !eff.has(l.name)).map((l) => h('label', { key: l.name, className: 'ssm-chip' },
                h('input', { type: 'checkbox', checked: false, disabled: busy, onChange: () => run(() => call(ctx, 'startOverride', { sessionId: st.sessionId, add: [l.name] }), true) }), ' ', l.name, ' ', t('add'))),
            ]
            : []),
          (state?.sessionOverrideActive ?? false) ? h('button', { disabled: busy, onClick: () => run(() => call(ctx, 'endOverride', { sessionId: st.sessionId }), true) }, t('endOverride')) : null),
        st.undoAvailable ? h('div', { className: 'ssm-row' }, h('button', { disabled: busy, onClick: () => run(() => call(ctx, 'undoSwitch', { sessionId: st.sessionId })) }, t('undo'))) : null);
    }

    function Chip({ ctx, t, sessionId }) {
      const [open, setOpen] = React.useState(false);
      const [state, setState] = React.useState(null);
      const [error, setError] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const reload = React.useCallback(async () => {
        try { const v = await call(ctx, 'state', { sessionId }); setState(v); } catch (e) { setError(`${t('loadFailed')}: ${e?.message ?? e}`); }
      }, [ctx, sessionId]);
      React.useEffect(() => { reload(); }, [reload]);
      const sc = state?.selfCheck;
      const dot = state?.unbound || sc?.unbound ? 'ssm-dot-idle'
        : sc && !sc.ok ? 'ssm-dot-red' : 'ssm-dot-ok';
      return h(React.Fragment, null,
        h('button', {
          className: 'ssm-chip-btn', title: error ?? state?.selfCheck?.detail ?? t('panel'),
          onClick: () => setOpen((v) => !v),
        }, h('span', { className: `ssm-dot ${dot}` }, null), t('chip'),
        state?.binding?.setSlug ? h('span', { className: 'ssm-cur' }, state.set?.name ?? state.binding.setSlug) : null,
        sc && !sc.ok && !sc.unbound ? h('span', { className: 'ssm-badge' }, '!') : null),
        open ? h(SkillSetPanel, {
          ctx, t, state, sessionId, reload, setError, busy, setBusy,
          onDone: () => { setOpen(false); reload(); },
        }) : null);
    }

    const CSS = `
.ssm-chip-btn{display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary);background:transparent;border:0;padding:3px 7px;border-radius:6px;cursor:pointer}
.ssm-chip-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.ssm-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
.ssm-dot-ok{background:var(--dsw-alias-brand-primary)}.ssm-dot-red{background:var(--dsw-alias-status-error,#e5484d)}.ssm-dot-idle{background:var(--dsw-alias-label-secondary)}
.ssm-cur{color:var(--dsw-alias-label-primary);font-weight:600;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ssm-badge{min-width:14px;height:14px;border-radius:7px;background:var(--dsw-alias-status-error,#e5484d);color:#fff;font-size:10px;display:inline-flex;align-items:center;justify-content:center;padding:0 4px}
.ssm-panel{position:absolute;left:12px;right:12px;bottom:calc(100% + 6px);z-index:40;max-height:60vh;overflow:auto;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:6px;box-shadow:0 8px 28px rgba(0,0,0,.25)}
.ssm-head{display:flex;align-items:center;gap:8px}
.ssm-x{background:0;border:0;color:inherit;font-size:15px;cursor:pointer;padding:2px 6px}
.ssm-grow{flex:1}
.ssm-warn,.ssm-err{font-size:11px;padding:4px 6px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-status-warning,#f5a623) 18%,transparent)}
.ssm-err{background:color-mix(in srgb,var(--dsw-alias-status-error,#e5484d) 16%,transparent)}
.ssm-sec{font-size:11px;font-weight:700;color:var(--dsw-alias-label-secondary);margin-top:4px;display:flex;gap:6px;align-items:center}
.ssm-row{display:flex;align-items:center;gap:4px;font-size:12px}
.ssm-pick{flex:1;display:flex;align-items:center;gap:6px;background:0;border:0;color:var(--dsw-alias-label-primary);cursor:pointer;padding:4px 6px;border-radius:6px;text-align:left;min-width:0}
.ssm-pick:hover{background:var(--dsw-alias-interactive-bg-hover)}
.ssm-on{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}
.ssm-n{color:var(--dsw-alias-label-secondary);font-size:11px}
.ssm-cur-tag{font-size:10px;color:var(--dsw-alias-brand-primary)}
.ssm-row button:not(.ssm-pick){background:0;border:0;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:11px;padding:3px 6px;border-radius:5px}
.ssm-row button:not(.ssm-pick):hover{background:var(--dsw-alias-interactive-bg-hover)}
.ssm-input{flex:1;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 7px;min-width:0}
.ssm-confirm{font-size:11px;padding:5px 7px;border-radius:6px;background:var(--dsw-alias-bg-layer-1);display:flex;gap:6px;align-items:center}
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
        }, (props) => h(Chip, { ctx, t, sessionId: props?.sessionId })));
      },
    };
  },
});
