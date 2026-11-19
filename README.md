# Skill Set Manager（技能集管理器）

DSH desktop 的技能集管理插件：把技能按**具名集合**组织、绑定到**单个项目**，只让当前项目需要的技能生效。

DSH 默认让被扫描目录里的技能对所有项目开放，项目一多就会加载大量用不上的技能、白烧 context。本插件只守一条主线：**具名技能组合 + 项目绑定 + 按项目自动生效**；技能安装/升级/备份/诊断是支撑能力，不是卖点。

## 功能

- **项目绑定**：技能集 ↔ 项目根一一绑定，切换时重建项目技能目录（Windows junction），下一轮请求即生效，可一步撤销。
- **常驻并集**：全局技能集对所有项目生效，落在 `~/.agents/skills/`（跨 harness 共享，其他工具可见）；外来条目只读。
- **会话级临时覆盖**：不改磁盘、不落盘，仅影响当前会话。
- **生效清单与状态徽章**：受管 / 常驻 / 外来 / 插件提供 / 缺失 / 失效 / 本地改动 一眼可辨。
- **技能搜索**：中英文按用途搜索（`description_zh` 翻译缓存；自动翻译默认关闭，可手动批量）。
- **技能库生命周期**：从 GitHub 安装（仓库 + 稀疏路径）、检查更新（逐文件 diff + 本地改动保护）、卸载（备份/回收站）、六类诊断。
- **三个入口**：composer 面板与 chip、设置页（库 / 全局技能集 / 安装与更新 / 诊断）、右栏「技能集详情」tab。
- **命令行**：`/skill-set list | show | use <集名> [--yes] | undo`、`/skill-doctor`。

## 环境要求

| 依赖 | 版本 / 说明 |
| --- | --- |
| DSH desktop | `>= 0.2.0-rc.2 < 0.3.0`（见 `plugin/skill-set-manager/package.json` 的 `engines.dsh`） |
| Node.js | `>= 22` |
| 操作系统 | Windows（项目技能目录用 junction 实现） |

## 安装

本仓库不发布到 npm（`package.json` 为 `private: true`），以 DSH **本地插件**形式安装：

1. 把 `plugin/skill-set-manager` 装进 DSH desktop profile 的插件目录（例如指链到 `~/.dsh/profiles/desktop/node_modules/@matrixfu/skill-set-manager`）。
2. 依赖（`zod`、`@deepseek-ai/dsh-typert-protocol`、`@deepseek-ai/schemastery`）随 DSH 插件安装流程解析。
3. 重启 host 或刷新页面，设置页出现「技能集管理器」即安装成功。

## 目录结构

```text
plugin/skill-set-manager/     插件本体：host 半 index.js、client 半 client.js、lib/core/*（纯逻辑）
scripts/                      验收与探针：verify.mjs、ui-gates.mjs 及各类探针
GLOSSARY.md                   领域术语表
AGENTS.md                     面向 AI 协作者的项目约定
```

## 开发与验收

- 无构建步骤，纯 ESM；改 `client.js` 后刷新页面生效，改 host 半（`index.js` / `lib/core/`）需重装或重启。
- `node scripts/verify.mjs` 跑全部验收 case；`--list-cases` 列 case，`--case N` 只跑指定 case。
- `node scripts/ui-gates.mjs` 跑语法与 UI 隔离门禁。
- 两者都**必须在 DSH 文件沙箱外**、Windows 下运行：沙箱会把 junction 虚拟化成普通目录，link/junction 类 case 会假红。
- 会话落盘是多帧 zstd：PATH 里有 `zstd`，或用环境变量 `ZSTD_BIN` 指定可执行文件；缺失时回退 Node 内置单帧解压（可能解不全）。

## 许可

[MIT](LICENSE)
