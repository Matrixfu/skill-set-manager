/**
 * 绑定写点（§5.2 切换 / §6.6 临时覆盖 / §7.6 .gitignore / P1a bindings 索引）。
 *
 * 顺序不变式只住在这里：dropOverrideOnBind 必须在 writeBinding **之前**判前态
 * （「绑定前是否未绑定」靠的就是当时的 binding），binding 落盘后才按新集收敛盘面。
 * 收口前 bind() 与 `session/created` 自动绑定各写一遍，并已漂移：自动绑定漏发
 * `/` 菜单失效事件、索引写失败被静默吞掉。
 */
import fs from 'node:fs';
import { writeBinding } from './binding.js';
import { converge } from './effective.js';
import { ensureGitignoreLine } from './gitignore.js';
import { dropOverrideOnBind } from './pending.js';

/**
 * @param {object} opts
 * @param {boolean} [opts.gitignore=true]  .gitignore 署名行开关（host config.gitignoreLine）
 * @param {(projectRoot: string, setSlug: string) => Promise<void>} [opts.index]  bindings 索引登记
 * @param {() => void} [opts.onCommitted]  生效清单落盘后的失效事件（/ 菜单缓存）
 * @returns {Promise<{ applied: object, warnings: string[], plan: object, projectRoot: string }>}
 */
export async function bindProject(roots, projectRoot, setSlug, {
  gitignore = true, index = null, onCommitted = null, fs: fsImpl = fs,
} = {}) {
  dropOverrideOnBind(projectRoot, { fs: fsImpl });
  writeBinding(projectRoot, setSlug, { fs: fsImpl });
  const { plan, applied, warnings } = await converge(roots, projectRoot, setSlug, { fs: fsImpl });
  ensureGitignoreLine(projectRoot, { enabled: gitignore }, { fs: fsImpl });
  if (index) await index(projectRoot, setSlug);
  if (onCommitted) onCommitted();
  return { applied, warnings, plan, projectRoot };
}
