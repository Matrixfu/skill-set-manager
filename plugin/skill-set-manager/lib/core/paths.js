/** 根路径装配与常量。纯数据，无 IO。 */
import path from 'node:path';
import os from 'node:os';

/** 技能名（=目录名/引用名）必须 kebab-case（§7.3）。 */
export const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** 扫描层优先级：数字小者胜（与 dsh-skill-filesystem 的 rank 一致）。 */
export const ZONE_RANKS = {
  'project-dsh': 100,
  'project-agents': 200,
  custom: 300,
  'user-dsh': 400,
  'user-agents': 500,
  bundled: 600,
};

export function defaultDshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
}
export function defaultAgentsHome() {
  return process.env.DSH_AGENTS_HOME || path.join(os.homedir(), '.agents');
}

/**
 * 项目生效目录（2026-10-30 迁移）：`<projectRoot>/.agents/skills`。
 * 与 DSH 扫描层 `project-agents`（rank 200）同址，且是各 harness 共享的项目技能目录，
 * 因此技能集条目在 DSH 之外的智能体软件里同样可见；旧的 `<projectRoot>/.dsh/skills`
 * （rank 100）不再由插件写入。全部读写入口统一走本函数，避免路径口径漂移。
 */
export function projectSkillsDir(projectRoot) {
  return path.join(projectRoot, '.agents', 'skills');
}

/** 显式装配全部根；生产 apply() 与验收脚本都走这里（core 不读 env）。 */
export function buildRoots({ dshHome, agentsHome, customSkillDirs = [], crossHarnessResident = false } = {}) {
  dshHome = path.resolve(dshHome ?? defaultDshHome());
  agentsHome = path.resolve(agentsHome ?? defaultAgentsHome());
  return {
    dshHome,
    agentsHome,
    libraryRoot: path.join(dshHome, 'skill-library'), // 生效区之外（§4.2）
    setsDir: path.join(dshHome, 'skill-sets'),
    // 上游缓存（GLOSSARY「上游缓存」：传输层复用，不改「检查=问最新」语义）与失败留痕
    cacheDir: path.join(dshHome, 'skill-set-manager', 'cache'),
    failLog: path.join(dshHome, 'skill-set-manager', 'failures.log'),
    userDshRoot: path.join(dshHome, 'skills'),
    userAgentsRoot: path.join(agentsHome, 'skills'),
    // 常驻链接目标区（P3 搬迁：默认 = 跨 harness 区 ~/.agents/skills；开关开 = 额外保留旧 ~/.dsh/skills）
    globalResidentDirs: [path.join(agentsHome, 'skills'), ...(crossHarnessResident ? [path.join(dshHome, 'skills')] : [])],
    customDirs: customSkillDirs.map((d) => path.resolve(d)),
  };
}
