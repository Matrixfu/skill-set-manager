/**
 * 网络失败语义（2026-11-17 加固 T1，叶子模块）：
 * - `isRetryableGitFailure`：只有「网络传输抖动」值得自动重试一次；真因失败
 *   （仓库不存在、上游无技能、来源格式不符）不重试——慢网络下重试等于把等待翻倍
 *   （github.js 2026-10-26 教训，GLOSSARY「可重试失败」口径）。
 * - `logGitFailure`：failures.log 一行一条 JSON 追加——插件无常驻日志，这是「经常
 *   失败」事后复盘的唯一证据源（命令结论行 + 耗时 + 第几次尝试）。
 * - `probeProxy`：联网动作前探测 git 实际会走的代理（env → git config 全局）是否
 *   有人监听；失联当场报人话错，而不是吊死或抛 git 乱码（Watt Toolkit PAC 模式，
 *   代理未启动时 git 指死 26561 直接 refused）。两处都没配 = 直连环境，不探测。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import net from 'node:net';

/** 网络类结论行形状（git/curl 的 stderr 措辞）；ETIMEDOUT/timed out = spawnSync 硬超时也算。 */
const RETRYABLE_PATTERNS = [
  /RPC failed/i,
  /invalid index-pack output/i,
  /early EOF/i,
  /Could not resolve host/i,
  /Failed to connect/i,
  /Connection reset/i,
  /Connection refused/i,
  /Empty reply/i,
  /transfer closed/i,
  /The requested URL returned error: (?:408|5\d\d)/i,
  /ETIMEDOUT/,
  /timed out/i,
];

/** 可重试失败判定：输入是 gitFailMessage 产出的业务错文案（或原始 stderr）。 */
export function isRetryableGitFailure(message) {
  const s = String(message ?? '');
  return RETRYABLE_PATTERNS.some((re) => re.test(s));
}

/** 失败留痕：一行一条 JSON 追加；嵌套目录自动建；任何异常吞掉——留痕绝不炸主流程。 */
export function logGitFailure(failLogPath, rec) {
  try {
    fs.mkdirSync(path.dirname(failLogPath), { recursive: true });
    fs.appendFileSync(failLogPath, JSON.stringify(rec) + '\n', 'utf8');
  } catch {}
}

const defaultGit = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8' });

/** 代理地址解析序：env（大小写都认）→ git 全局 https.proxy/http.proxy；无配置返回 null。 */
function proxyTarget(git, env) {
  const fromEnv = env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy;
  if (fromEnv) return String(fromEnv);
  for (const key of ['https.proxy', 'http.proxy']) {
    let r;
    try { r = git(['config', '--global', '--get', key]); } catch { continue; }
    const v = String(r?.stdout ?? '').trim();
    if (r?.status === 0 && v) return v;
  }
  return null;
}

/**
 * 代理 TCP 预检：`{ dead: 'host:port' | null }`。地址解析不了当无配置放行
 * （不拦，让 git 自己报它的错）；connect 成功=null，error/超时=dead。
 * net/git/env 全可注入（verify 夹具免真网络；host 默认拿 node:net + process.env）。
 */
export async function probeProxy({ git = defaultGit, net: netImpl = net, env = process.env, timeoutMs = 1500 } = {}) {
  const raw = proxyTarget(git, env);
  if (!raw) return { dead: null };
  let url;
  try { url = new URL(raw.includes('://') ? raw : `http://${raw}`); }
  catch { return { dead: null }; }
  const host = url.hostname;
  const port = Number(url.port) || (url.protocol === 'https:' ? 443 : 80);
  const dead = `${host}:${port}`;
  const alive = await new Promise((resolve) => {
    let done = false;
    let sock;
    let timer;
    const finish = (v) => {
      if (done) return;
      done = true;
      try { clearTimeout(timer); } catch {}
      try { sock?.destroy?.(); } catch {}
      resolve(v);
    };
    try { sock = netImpl.connect({ host, port, timeout: timeoutMs }, () => finish(true)); }
    catch { finish(false); return; }
    sock.on?.('connect', () => finish(true));
    sock.on?.('error', () => finish(false));
    sock.on?.('timeout', () => finish(false));
    if (typeof sock.setTimeout === 'function') sock.setTimeout(timeoutMs, () => finish(false));
    timer = setTimeout(() => finish(false), timeoutMs + 200);
    timer.unref?.(); // 兜底定时器不拖住测试进程退出
  });
  return { dead: alive ? null : dead };
}
