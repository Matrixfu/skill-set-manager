/**
 * Skill Set Manager — MVP 第 0 步探针（一次性，验证完即可卸载）。
 * 三件事：
 *  a) 各 agent preset 下技能是否加载（§10.2 #1）：acquireScope(preset) + ctx.skills.list({cwd: 夹具, scope})
 *  b) 存活会话可见技能集读取路径（§10.2 #2）：agentPresets.serviceFor(liveAgent,'skills') 与冷路径 acquireScope 双跑比对
 *  c) 第三方插件能否自行 ctx.storageDomain.open() 声明 domain（§10.1 #6）
 * 结果逐阶段写入 C:/AI/DSH_Skill_Manager/probe-out/step0-result.json。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';

const OUT = 'C:/AI/DSH_Skill_Manager/probe-out/step0-result.json';
const FIXTURE = 'C:/AI/DSH_Skill_Manager/probe-0';
const PROBE_SKILLS = ['step0-probe-a', 'step0-probe-b'];

const errText = (e) => String((e && (e.code ? e.code + ': ' : '') + (e?.message ?? e)) || e);

const summarize = (list) => ({
  count: list.length,
  probeHits: list
    .filter((s) => PROBE_SKILLS.includes(s.name))
    .map((s) => ({ name: s.name, source: s.source, provider: s.provider, invocation: s.invocation, path: s.path })),
  names: list.map((s) => s.name),
});

export function apply(ctx) {
  void run(ctx).catch((e) => {
    try {
      const out = JSON.parse(fs.readFileSync(OUT, 'utf8'));
      out.fatal = errText(e);
      out.completedAt = new Date().toISOString();
      out.completedOk = false;
      fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
    } catch {
      fs.writeFileSync(OUT, JSON.stringify({ fatal: errText(e), completedOk: false }, null, 2));
    }
  });
}

async function run(ctx) {
  const out = {
    startedAt: new Date().toISOString(),
    node: process.versions.node,
    fixture: FIXTURE,
    probeSkills: PROBE_SKILLS,
  };
  const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  save();

  const skills = ctx.get('skills');
  const presets = ctx.get('agentPresets');
  const sessions = ctx.get('sessions');
  const agents = ctx.get('agents');
  const storageDomain = ctx.get('storageDomain');
  out.services = {
    skills: !!skills,
    agentPresets: !!presets,
    sessions: !!sessions,
    agents: !!agents,
    storageDomain: !!storageDomain,
  };
  save();

  // ---------- (a) 各 preset 下技能是否加载 ----------
  let presetIds = [];
  try {
    const declared = await presets.list();
    out.declaredPresets = declared.map((p) => ({ id: p.id, name: p.name, broken: p.broken }));
    presetIds = declared.map((p) => p.id);
  } catch (e) {
    out.declaredPresetsError = errText(e);
  }
  for (const id of ['standard', 'minimal', 'ptc', 'cordis']) {
    if (!presetIds.includes(id)) presetIds.push(id);
  }
  out.presetSkillVisibility = {};
  for (const id of presetIds) {
    const rec = {};
    try {
      const lease = await presets.acquireScope(id);
      try {
        const list = await skills.list({ cwd: FIXTURE, scope: lease.key });
        Object.assign(rec, summarize(list));
      } finally {
        await lease[Symbol.asyncDispose]?.();
      }
    } catch (e) {
      rec.error = errText(e);
    }
    out.presetSkillVisibility[id] = rec;
    save();
  }
  // 宿主层基线（不带 scope）：夹具技能不应出现（host skill-filesystem 已 disabled）
  try {
    Object.assign(out.hostLayerBaseline = {}, summarize(await skills.list({ cwd: FIXTURE })));
  } catch (e) {
    out.hostLayerBaseline = { error: errText(e) };
  }
  // 运行期组合清单：各 preset 挂了哪些 skill 相关行
  try {
    const inv = await presets.compositionInventory();
    out.compositionInventory = inv.map((p) => ({
      id: p.id,
      isDefault: p.isDefault,
      broken: p.broken,
      skillRows: (p.rows ?? [])
        .filter((r) => /skill/i.test(r.moduleName))
        .map((r) => ({ module: r.moduleName, entryId: r.entryId, enabled: r.enabled, fiberState: r.fiberState })),
    }));
  } catch (e) {
    out.compositionInventoryError = errText(e);
  }
  save();

  // ---------- (b) 存活会话可见技能集读取路径 ----------
  out.liveSessions = [];
  try {
    const liveAgents = agents.list();
    out.liveAgentCount = liveAgents.length;
    for (const agent of liveAgents) {
      const rec = { agentId: agent.id, agentHasCtx: !!agent.ctx };
      const session = sessions.get(agent.id);
      rec.sessionFound = !!session;
      const cwd = session?.header?.cwd;
      const agentPreset = session?.header?.agentPreset;
      rec.cwd = cwd;
      rec.agentPreset = agentPreset;
      // 路径 1：serviceFor(live,'skills') —— 核心 sessionSkillCatalog Remote 的选择逻辑
      try {
        const scoped = presets.serviceFor(agent, 'skills');
        rec.path1_serviceFor_hit = scoped !== undefined;
        if (scoped) Object.assign(rec.path1_serviceFor = {}, summarize(await scoped.list({ cwd })));
      } catch (e) {
        rec.path1_error = errText(e);
      }
      // 路径 2：acquireScope(header.agentPreset) + 全局 list({cwd, scope})（Remote 的冷路径形态）
      try {
        const lease = await presets.acquireScope(agentPreset);
        try {
          Object.assign(rec.path2_acquireScope = {}, summarize(await skills.list({ cwd, scope: lease.key })));
        } finally {
          await lease[Symbol.asyncDispose]?.();
        }
      } catch (e) {
        rec.path2_error = errText(e);
      }
      // 路径 3：Remote 的 live 路径——scope 直接传存活 Agent 对象（skill-catalog.js:152-162）
      try {
        Object.assign(rec.path3_scopeAgent = {}, summarize(await skills.list({ cwd, scope: agent })));
      } catch (e) {
        rec.path3_error = errText(e);
      }
      // 路径间名字集是否一致（2 vs 3 为主：同为该会话视角）
      const a = rec.path1_serviceFor?.names;
      const b = rec.path2_acquireScope?.names;
      const c = rec.path3_scopeAgent?.names;
      rec.pathsAgree_2_vs_3 = Array.isArray(b) && Array.isArray(c) && JSON.stringify(b) === JSON.stringify(c);
      rec.path1_hit_and_agrees_3 = !!rec.path1_serviceFor_hit && Array.isArray(a) && JSON.stringify(a) === JSON.stringify(c);
      out.liveSessions.push(rec);
      save();
    }
  } catch (e) {
    out.liveSessionsError = errText(e);
  }
  save();

  // ---------- (c) 第三方插件自行 open() storageDomain ----------
  out.storageDomainProbe = {};
  try {
    const domainEvents = [];
    const off = ctx.on('domain/changed', (change) => {
      domainEvents.push({ at: new Date().toISOString(), name: change?.name ?? change?.domain?.name });
    });
    try {
      // UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/（dsh-storage/lib/index.js:80）——连字符会被拒
      const spec = {
        name: 'skill_set_probe',
        version: 1,
        layout: 'single',
        tables: { probe: { valueSchema: z.record(z.string(), z.unknown()) } },
      };
      const domain = await storageDomain.open(spec);
      try {
        const table = domain.table('probe');
        await table.put('probe1', { hello: 'world', at: Date.now() });
        out.storageDomainProbe.opened = true;
        out.storageDomainProbe.readBack = table.get('probe1');
        const file = path.join(os.homedir(), '.dsh', 'storages', 'skill_set_probe.json');
        out.storageDomainProbe.filePath = file;
        out.storageDomainProbe.fileExists = fs.existsSync(file);
        out.storageDomainProbe.fileContentHead = out.storageDomainProbe.fileExists
          ? fs.readFileSync(file, 'utf8').slice(0, 400)
          : null;
      } finally {
        await domain.close();
      }
      // close 后重开：读回持久值
      const again = await storageDomain.open(spec);
      try {
        out.storageDomainProbe.reopenReadBack = again.table('probe').get('probe1');
      } finally {
        await again.close();
      }
      out.storageDomainProbe.domainChangedEvents = domainEvents;
    } finally {
      off?.();
    }
  } catch (e) {
    out.storageDomainProbe.error = errText(e);
    out.storageDomainProbe.code = e?.code;
  }
  save();

  out.completedAt = new Date().toISOString();
  out.completedOk = true;
  save();
}
