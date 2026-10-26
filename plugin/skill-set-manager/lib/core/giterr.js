/**
 * git 失败信息口径（用户报告 2026-10-26：库「检查更新」只报出
 * `warning: ----------------- SECURITY WARNING ----------------`）。
 *
 * stderr **首行**未必是真因：本机 git 全局 `http.sslVerify=false` 时，Git Credential
 * Manager 每次 https 传输都先打 4 行 TLS 告警横幅，真结论（`fatal:`/`error:`）在其后。
 * 只报首行 = 把「仓库不存在」显示成安全告警，用户据此误判成 GitHub 授权失败。
 *
 * 取法（从 stderr 里挑 git 自己的结论，不改 git 调用）：
 *   1) spawnSync 起不动（本机没装 git 等）→ r.error；
 *   2) 最后一条 `fatal:`/`error:` 行（git 的真结论，remote 提示只是它的注脚）；
 *   3) 否则最后一条非空行（有些 git 版本只写 warning 级结论）；
 *   4) 全空 → 退出码。
 * 叶子模块：github（稀疏拉取）与 updates（ls-remote）共用，不放任两处各写一份口径。
 */
export function gitFailMessage(args, r) {
  const head = `git ${String(args?.[0] ?? '').trim() || 'git'} failed`;
  if (r?.error) return `${head}: ${String(r.error?.message ?? r.error)}`;
  const lines = String(r?.stderr ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const verdict = [...lines].reverse().find((l) => /^(fatal|error):/i.test(l));
  return `${head}: ${verdict || lines[lines.length - 1] || `exit ${r?.status ?? '未知'}`}`;
}
