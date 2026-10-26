/**
 * 插件/Preset 提供技能的枚举（用户疑问 2026-10-26：选了技能集为何仍见 /archify、/office-docx）。
 * 这类技能由插件 Skill 提供者或 agent preset 运行时注入，不在生效区盘上，插件无法经目录
 * 感知；唯一可见口径 = 平台 skills 服务的清单（探针事实：ctx.get('skills') + list({cwd})，
 * provider 字段即提供者名）。排除口径 = 生效清单（常驻 ∪ 集）+ 托管台账 + 常驻名单。
 * 库名**不**作排除：库在生效区之外，未生效的库名根本不会出现在清单里；而「库里有同名
 * 本体但此刻未生效」的技能（如 archify 在库、当前集未选）仍由插件提供者注入生效，
 * 必须留在本区如实呈现。服务缺席（headless/未挂载）返回 null = 不可知，
 * 调用方不得把 null 当空集。术语见 GLOSSARY「插件提供（Plugin-provided）」。
 */

// provider 命中这些名字的技能来自文件系统扫描区（生效区/常驻区），不是插件注入，不列。
const FILESYSTEM_PROVIDERS = new Set(['filesystem', 'runtime']);

export async function providerSkills({ skillsService, projectRoot, managedEntries = {} }, { effectiveNames = [], residentNames = [] } = {}) {
  if (!skillsService || typeof skillsService.list !== 'function' || !projectRoot) return null;
  const exclude = new Set([...effectiveNames, ...residentNames, ...Object.keys(managedEntries)]);
  const list = await skillsService.list({ cwd: projectRoot });
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .filter((s) => s && typeof s.name === 'string' && !exclude.has(s.name))
    .filter((s) => !FILESYSTEM_PROVIDERS.has(String(s.provider ?? '')))
    .map((s) => ({ name: s.name, provider: String(s.provider ?? s.source ?? 'unknown'), source: typeof s.source === 'string' ? s.source : null }))
    .filter((s) => (seen.has(s.name) ? false : seen.add(s.name)))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
