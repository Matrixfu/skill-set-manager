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
