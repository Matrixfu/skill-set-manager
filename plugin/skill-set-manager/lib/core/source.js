/**
 * 技能来源规格（§8.3 格式，仿 dsh-skills-marketplace「仓库+分支+稀疏路径」）。
 * 独立叶子模块：github（拉取）与 manifest（认领来源）都要解析来源，放这里避免 ESM 环。
 */

/** owner/repo[@ref][/subpath] → {owner, repo, ref|null, subpath|null}；非法 throw 业务错。 */
export function parseRepoSpec(spec) {
  if (typeof spec !== 'string' || !spec.trim()) throw new Error('技能来源须为非空字符串');
  const rest = spec.trim().replace(/^(https?:\/\/(?:www\.)?github\.com\/|github\.com\/)/, '');
  const at = rest.indexOf('@');
  const repoPart = at >= 0 ? rest.slice(0, at) : rest;
  const refPart = at >= 0 ? rest.slice(at + 1) : null;
  const segs = repoPart.split('/').filter(Boolean);
  if (segs.length < 2) throw new Error(`技能来源格式错误 "${spec}"：期望 owner/repo[@ref][/subpath]`);
  const [owner, repo] = segs;
  let subpath = segs.length > 2 ? segs.slice(2).join('/') : null;
  if (refPart === null) return { owner, repo, ref: null, subpath };
  const rs = refPart.split('/');
  const ref = rs[0];
  if (!ref) throw new Error(`技能来源格式错误 "${spec}"：ref 为空`);
  const tail = rs.slice(1).join('/');
  if (subpath && tail) throw new Error(`技能来源格式错误 "${spec}"：@ 前后不得同时带路径`);
  if (!subpath) subpath = tail || null;
  return { owner, repo, ref, subpath };
}

/**
 * 来源归一（P2 单一口径）：`github:` 前缀写法（manifest 规范形）、`github.com/…`、
 * `https://github.com/…` 与裸 `owner/repo[/subpath]` 一律解析后写回规范形
 * `github:owner/repo[/subpath]`（@ref 丢弃——commit 另存于 manifest）。
 * 认领来源（§8.1）与按 pin 安装（§5.6）都先过这里。
 */
export function normalizeRepoSource(source) {
  // parseRepoSpec 只认 URL/裸写法，`github:` 前缀（manifest 规范形）在此剥掉
  const spec = parseRepoSpec(String(source ?? '').trim().replace(/^github:/, ''));
  return `github:${spec.owner}/${spec.repo}${spec.subpath ? `/${spec.subpath}` : ''}`;
}
