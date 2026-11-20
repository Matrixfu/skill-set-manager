// release.mjs — 一键发布 @matrixfu/skill-set-manager 新版（本会话踩坑固化，2026-11-20）。
//
// 做五件事：
//   1. bump 版本到 5 处（package.json ×1、package-lock ×2、README 示例 ×2）——手工易漏；
//   2. chore(release) commit + tag；
//   3. push master + tag（CI publish.yml 由 tag 触发）；
//   4. 建 GitHub Release（make_latest）——历史 v1.1.2/v1.1.3 只打轻量 tag，
//      Releases 侧栏会一直停在旧 Latest；
//   5. 轮询 CI；失败自动下载 attempt 日志打印 npm error；成功验 npm latest。
//
// npm Trusted Publishing 事实（诊断口径）：
//   - CI 报 `404 Not Found - PUT registry`＝「该 GitHub 来源未授权」，不是版本/tag 不存在；
//     去 npm 包 Settings → Trusted Publishers 加 GitHub Actions 来源（repo + publish.yml），
//     Allowed actions 必须勾 **publish directly**（只给 stage publish 会进待审：CI 绿但不上架）。
//   - 本机 GitHub token（git credential fill）scope = gist,repo,workflow：够读 Actions
//     日志 + rerun-failed-jobs；没有 read:packages（Packages API 用不了）。
//
// 用法：node tools/release.mjs <version> [--no-push]
// 前置：工作树干净、verify 全绿（本脚本不跑测试）。
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = join(ROOT, "plugin/skill-set-manager");
const [VER, ...FLAGS] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+([-+][\w.]+)?$/.test(VER || "")) {
  console.error("usage: node tools/release.mjs <version> [--no-push]");
  process.exit(2);
}
// 直连 github/npmjs 不可达（PAC 代理），NODE_USE_ENV_PROXY 需启动时注入 → 自我重启一次
// 另注：必须带 NODE_OPTIONS=--use-system-ca——SteamTools PAC 代理签出的证书链只装在系统 Root 存储，
// Node 默认 CA 库验不过，api.github.com 的 fetch 会报 UNABLE_TO_VERIFY_LEAF_SIGNATURE（2026-11-20 v1.3.0 实测：
// bump/tag/push 都成功，只有建 Release 那步挂）。
if (!process.env.HTTPS_PROXY && !FLAGS.includes("--no-proxy")) {
  const r = await import("node:child_process").then(({ spawnSync }) => spawnSync(
    process.execPath, process.argv.slice(1),
    { stdio: "inherit", env: { ...process.env, HTTPS_PROXY: "http://127.0.0.1:26561", HTTP_PROXY: "http://127.0.0.1:26561", NODE_USE_ENV_PROXY: "1", NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-system-ca"].filter(Boolean).join(" ") } }));
  process.exit(r.status ?? 1);
}
const sh = (cmd, opts = {}) => execSync(cmd, { cwd: ROOT, encoding: "utf8", ...opts }).trim();

const pkgPath = join(PKG, "package.json");
const OLD = JSON.parse(readFileSync(pkgPath, "utf8")).version;
if (OLD === VER) { console.error(`版本 ${VER} 已是当前 package.json 版本`); process.exit(2); }
if (sh("git status --porcelain")) { console.error("工作树不干净，先提交/清理"); process.exit(2); }

// 1) 五处 bump
const writeJson = (p, mutate) => { const o = JSON.parse(readFileSync(p, "utf8")); mutate(o); writeFileSync(p, JSON.stringify(o, null, 2) + "\n"); };
writeJson(pkgPath, o => { o.version = VER; });
writeJson(join(PKG, "package-lock.json"), o => { o.version = VER; if (o.packages?.[""]) o.packages[""].version = VER; });
const readme = join(ROOT, "README.md");
writeFileSync(readme, readFileSync(readme, "utf8").replaceAll(`@matrixfu/skill-set-manager@${OLD}`, `@matrixfu/skill-set-manager@${VER}`));
sh("git add plugin/skill-set-manager/package.json plugin/skill-set-manager/package-lock.json README.md");
sh(`git commit -q -m "chore(release): v${VER}" && git tag v${VER}`);
console.log(`BUMP+TAG: ${OLD} -> v${VER}`);

// token（gist,repo,workflow）
const cred = sh("git credential fill", { input: "protocol=https\nhost=github.com\n" });
const TOK = /^password=(.+)$/m.exec(cred)?.[1];
if (!TOK) { console.error("git credential fill 没拿到 token"); process.exit(2); }
const gh = async (path, init = {}) => {
  const r = await fetch("https://api.github.com" + path, { ...init, headers: { Authorization: `Bearer ${TOK}`, Accept: "application/vnd.github+json", "User-Agent": "dsh-release", ...init.headers } });
  if (!r.ok) throw new Error(`GH ${r.status} ${path}: ${(await r.text()).slice(0, 200)}`);
  return r;
};

// 2) push（CI 随之触发）
const branch = sh("git rev-parse --abbrev-ref HEAD");
if (!FLAGS.includes("--no-push")) {
  sh(`git push origin ${branch}`); sh(`git push origin v${VER}`);
  console.log(`PUSH: ${branch} + v${VER} -> origin`);
} else { console.log("SKIP PUSH (--no-push)"); }

// 3) GitHub Release（补 Latest）
const prev = sh("git tag --sort=-v:refname").split("\n").filter(t => t && t !== `v${VER}`)[0] || "";
const log = prev ? sh(`git log --oneline ${prev}..HEAD`) : sh("git log --oneline -10");
await gh("/repos/Matrixfu/skill-set-manager/releases", { method: "POST", body: JSON.stringify({ tag_name: `v${VER}`, name: `v${VER}`, body: log, make_latest: "true" }) });
console.log(`RELEASE: https://github.com/Matrixfu/skill-set-manager/releases/tag/v${VER}`);

// 4) 轮询 CI
const sha = sh(`git rev-parse v${VER}`); // 轻量 tag → 即 commit sha
let run = null, apiNote = "";
for (let i = 0; i < 60 && !(run && run.status === "completed"); i++) {
  await new Promise(r => setTimeout(r, 10000));
  const j = (await gh("/repos/Matrixfu/skill-set-manager/actions/runs?per_page=5&event=push")).json();
  // 轮询面偶发非预期响应（限流/MITM/代理），别把整条发布炸成 TypeError：留痕重试，末尾再判定。
  if (!Array.isArray(j.workflow_runs)) { apiNote = `runs API 非预期响应：${JSON.stringify(j).slice(0, 160)}`; continue; }
  run = j.workflow_runs.find(w => w.head_sha === sha) ?? run;
  if (run) process.stdout.write(`\rCI: ${run.status}/${run.conclusion ?? "-"} (attempt ${run.run_attempt})   `);
}
console.log();
if (!run) {
  console.error(`没在最近 5 条 push run 里找到 tag ${`v${VER}`}（sha ${sha}）。${apiNote}\n` +
    `手动核对：https://github.com/Matrixfu/skill-set-manager/actions?query=${sha}`);
  process.exit(1);
}
if (run.conclusion !== "success") {
  const buf = Buffer.from(await (await gh(`/repos/Matrixfu/skill-set-manager/actions/runs/${run.id}/logs?attempt=${run.run_attempt}`)).arrayBuffer());
  const dir = mkdtempSync(join(tmpdir(), "rellogs"));
  const z = join(dir, "l.zip"); writeFileSync(z, buf);
  sh(`tar -xf "${z}" -C "${dir}"`);
  const hit = [];
  const walk = d => readdirSync(d, { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(join(d, e.name)) : /npm publish/.test(e.name) && hit.push(join(d, e.name)));
  walk(dir);
  for (const f of hit) for (const line of readFileSync(f, "utf8").split("\n")) if (/npm error|^\+ /m.test(line)) console.log(line.replace(/^.*?Z /, ""));
  rmSync(dir, { recursive: true, force: true });
  console.error(`CI ${run.conclusion}（日志已扫）。修好后重跑：POST /repos/Matrixfu/skill-set-manager/actions/runs/${run.id}/rerun-failed-jobs`);
  process.exit(1);
}

// 5) 验 npm latest（registry 处理有几分钟延迟，重试窗口 3 分钟）
let latest = "";
for (let i = 0; i < 18; i++) {
  latest = (await (await fetch("https://registry.npmjs.org/@matrixfu%2Fskill-set-manager/latest")).json()).version;
  if (latest === VER) break;
  await new Promise(r => setTimeout(r, 10000));
}
if (latest !== VER) { console.error(`npm latest=${latest}，还没生效，稍后再查`); process.exit(1); }
console.log(`DONE: npm latest = ${VER}（OIDC provenance，Trusted Publishing）`);
