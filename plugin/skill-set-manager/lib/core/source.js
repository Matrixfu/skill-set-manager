/**
 * 技能来源规格（§8.3 格式，仿 dsh-skills-marketplace「仓库+分支+稀疏路径」）。
 * 独立叶子模块：github（拉取）与 manifest（认领来源）都要解析来源，放这里避免 ESM 环。
 */

/**
 * owner/repo[@ref][/subpath] → {owner, repo, ref|null, subpath|null}；非法 throw 业务错。
 * 容忍三种粘贴形态（都是真实用户输入，用户报告 2026-10-26）：整条 `https://github.com/…` 地址、
 * clone 地址尾部的 `.git`、网页地址路由残留 `tree/<ref>/`（或 `blob/<ref>/`——无显式 @ref 时当 ref）。
 */
export function parseRepoSpec(spec) {
  if (typeof spec !== 'string' || !spec.trim()) throw new Error('技能来源须为非空字符串');
  const rest = spec.trim().replace(/^(https?:\/\/(?:www\.)?github\.com\/|github\.com\/)/, '');
  const at = rest.indexOf('@');
  const repoPart = at >= 0 ? rest.slice(0, at) : rest;
  const refPart = at >= 0 ? rest.slice(at + 1) : null;
  const segs = repoPart.split('/').filter(Boolean);
  if (segs.length < 2) throw new Error(`技能来源格式错误 "${spec}"：期望 owner/repo[@ref][/subpath]`);
  const [owner, rawRepo] = segs;
  // 尾部 `.git` 是 clone 地址的后缀，不是仓库名（GitHub 网页地址不带它）：不剥就拼出
  // `owner/repo.git.git` → 远端「Repository not found」（用户报告 2026-10-26：
  // manifest 存了 github:vercel-labs/skills.git，库「检查更新」exit 128）
  const repo = rawRepo.length > 4 && rawRepo.endsWith('.git') ? rawRepo.slice(0, -4) : rawRepo;
  let subpath = segs.length > 2 ? segs.slice(2).join('/') : null;
  // 浏览器地址的残留路由段 owner/repo/{tree|blob}/<ref>/<path>：GitHub 网页地址就是这个形状，
  // 粘贴它是常态（用户报告 2026-10-26：diagram-design、ask-matt 的认领来源都粘成
  // …/tree/main/skills、…/blob/main/skills/engineering → tree/main 被当成稀疏路径 →
  // 稀疏检出空目录 → 检查更新报「上游不含技能」）。仅在没写显式 @ref 时认它，不与 @ 语法打架。
  let webRef = null;
  if (refPart === null && subpath) {
    const ps = subpath.split('/');
    if ((ps[0] === 'tree' || ps[0] === 'blob') && ps.length >= 2) { webRef = ps[1] || null; subpath = ps.slice(2).join('/') || null; }
  }
  if (refPart === null) return { owner, repo, ref: webRef, subpath };
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
/**
 * 一次解析、两种口径同时出（评审 C1 修复）：`canonical` 写 manifest / 参与比较，
 * `spec` 直接喂 fetchRepo（owner 绝不能带 `github:` 前缀，否则拼出的 remote URL 必 404）。
 * 「归一化输出再当输入解析」= 双重前缀；解析只做一次即从根上断掉。
 */
export function resolveRepoSource(source) {
  // parseRepoSpec 只认 URL/裸写法，`github:` 前缀（manifest 规范形）在此剥掉
  const spec = parseRepoSpec(String(source ?? '').trim().replace(/^github:/, ''));
  const canonical = `github:${spec.owner}/${spec.repo}${spec.subpath ? `/${spec.subpath}` : ''}`;
  return { canonical, spec: { owner: spec.owner, repo: spec.repo, ref: null, subpath: spec.subpath } };
}

export function normalizeRepoSource(source) {
  return resolveRepoSource(source).canonical;
}
