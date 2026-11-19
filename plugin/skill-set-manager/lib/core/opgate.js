/**
 * 长任务闸门（GLOSSARY「长任务」）：host 侧单飞 + 最近结果留存 + 写盘后的 `/` 菜单失效事件。
 *
 * 收口前这两条不变式都不在 host：单飞只存在于 client.js 的 tasks 表（关掉界面或换入口就没有闸门，
 * Remote / fetch 兜底同一实现但无人互斥），失效事件散在 12 个调用点自行记得——于是 installApply /
 * updateApply / importApply 装完不发事件（`/` 菜单仍是旧的），而 uninstallSkill / migrate* 发。
 */
export function createOpGate({ onMutated = null } = {}) {
  const state = { seq: 0, running: null, last: null };

  const snapshot = (task) => (task ? {
    id: task.id, name: task.name, target: task.target, status: task.status,
    startedAt: task.startedAt, doneAt: task.doneAt,
    result: task.result ?? null, error: task.error ?? null, warnings: task.warnings ?? null,
  } : null);

  const status = () => ({ running: snapshot(state.running), last: snapshot(state.last) });

  /** 被挡住时点名在跑的是谁：Remote 桥不保证保留自定义字段，故文本前缀也带 BUSY。 */
  const busyError = (running) => {
    const err = new Error(`BUSY: ${[running.name, running.target].filter(Boolean).join(' ')}`);
    err.code = 'BUSY';
    err.running = snapshot(running);
    return err;
  };

  /**
   * 长任务：全局单飞；成功即发失效事件（mutates: false 的只读任务不发）。
   * 失败不吞——原样抛出，但最近结果如实记 err，界面据此说明。
   */
  async function run(name, meta, fn) {
    if (state.running) throw busyError(state.running);
    const task = {
      id: (state.seq += 1), name, target: meta?.target ?? null, status: 'running',
      startedAt: Date.now(), doneAt: null, result: null, error: null, warnings: [],
    };
    state.running = task; state.last = task;
    try {
      const value = await fn();
      task.status = 'ok'; task.doneAt = Date.now();
      task.result = value ?? null;
      task.warnings = Array.isArray(value?.warnings) ? value.warnings : [];
      if (meta?.mutates !== false && onMutated) onMutated();
      return value;
    } catch (e) {
      task.status = 'err'; task.doneAt = Date.now(); task.error = String(e?.message ?? e);
      throw e;
    } finally { state.running = null; }
  }

  /** 短写：无单飞，但「成功落盘 → 失效事件」由这里保证，调用方无从漏发。 */
  async function mutate(fn) {
    const value = await fn();
    if (onMutated) onMutated();
    return value;
  }

  /** 条件写（只有真改了才发）：事件机制仍收在这里，条件留在调用方。 */
  const touch = () => { if (onMutated) onMutated(); };

  return { run, mutate, touch, status, isBusy: () => !!state.running };
}
