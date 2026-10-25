/**
 * `/skill-set` 键盘流子命令解析（§12 P2）：纯函数、可测、无业务判断（§14 薄包装）。
 * 空参 = `show`（最高频：当前项目根 + 当前集 + 生效清单）；
 * `--yes` / `-y` = rootDrift 的显式二次确认旗标（§6.5 键盘流等价物），任意位置均可剥离；
 * 未知子命令原样带回 `action`，由处理器渲染帮助文本。
 */
export function parseSkillSetLine(raw) {
  const tokens = String(raw ?? '').trim().split(/\s+/).filter(Boolean);
  let yes = false;
  const rest = [];
  for (const t of tokens) {
    if (t === '--yes' || t === '-y') yes = true;
    else rest.push(t);
  }
  return { action: rest[0] ?? 'show', arg: rest[1] ?? null, yes };
}

/**
 * `skill_set` 工具入参解析与校验（§12 P2：模型侧只有 list / show / use 三个动作）。
 * 校验在解析层做（模型给的 args 不可信），业务判断仍在 remote 方法里（§14）。
 */
export const TOOL_ACTIONS = ['list', 'show', 'use'];
export function parseToolArgs(args) {
  const action = String(args?.action ?? '').trim();
  if (!TOOL_ACTIONS.includes(action))
    throw new Error(`action 必须是 ${TOOL_ACTIONS.join(' / ')}，收到 "${args?.action ?? ''}"`);
  const slug = args?.slug == null ? null : (String(args.slug).trim() || null);
  if (action === 'use' && !slug) throw new Error('action=use 需要 slug（技能集 slug 或显示名）');
  return { action, slug };
}
