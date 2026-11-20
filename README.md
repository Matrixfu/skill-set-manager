# Skill Set Manager（技能集管理器）

[![npm](https://img.shields.io/npm/v/@matrixfu/skill-set-manager)](https://www.npmjs.com/package/@matrixfu/skill-set-manager)
[![DSH plugin](https://img.shields.io/badge/DSH-desktop%20plugin-4B6EF5)](https://github.com/Matrixfu/skill-set-manager)

DSH desktop 的技能集管理插件：把技能按**具名集合**组织、绑定到**单个项目**，只让当前项目需要的技能生效。

*A DSH desktop plugin (DeepSeek Harness) that groups skills into named sets, binds one set per project, and loads only what that project needs.*

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

| 依赖        | 版本 / 说明                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------- |
| DSH desktop | `>= 0.2.0-rc.2 < 0.3.0`（见 `plugin/skill-set-manager/package.json` 的 `engines.dsh`） |
| Node.js     | `>= 22`                                                                                    |
| 操作系统    | Windows（项目技能目录用 junction 实现）                                                      |

## 安装

插件是标准 DSH bundle（带 `dsh.bundle.patch` 的 npm 包），用 DSH 自带的 `dsh plugin` 命令安装，**不需要手工拷贝文件**。

### 从 npm 安装（推荐）

包名 `@matrixfu/skill-set-manager`，发布在公共 npm 源（`registry.npmjs.org`），无需配置源或凭据：

```bash
dsh plugin --profile desktop add "@matrixfu/skill-set-manager"
```

装指定版本时加 `@<version>`（如 `@matrixfu/skill-set-manager@1.1.3`）。

### 在 DSH desktop 中安装（添加插件）

不想用命令行时，可直接在图形界面装同一份 npm 包：

1. 打开左侧栏的「插件」页，点右上角「添加插件」（也可点箭头 →「安装第三方插件」）。
2. 在包名输入框填 `@matrixfu/skill-set-manager`（可带版本，如 `@matrixfu/skill-set-manager@1.1.3`）。
3. 「安装源」保持「默认安装源」即可（公共 npm 源或本机已配置的镜像都能解析）。
4. 点「安装」，跑完后点「立即启用」；重启 host 或刷新页面，插件生效。

### 从 GitHub 源码安装

插件在仓库的 `plugin/skill-set-manager` 子目录，用 pnpm 的 `path:` 参数指定子目录：

```bash
dsh plugin --profile desktop add "github:Matrixfu/skill-set-manager#path:/plugin/skill-set-manager"
```

装完后在左侧栏「插件」页启用「技能集管理器」：启用会把该 bundle 追加到 profile 的 `dsh.profile.bundles` 列表；重启 host 或刷新页面后，设置页出现「技能集管理器」即生效。

### 本地开发安装（不拷贝）

```bash
dsh plugin --profile desktop add "file:C:/path/to/skill-set-manager/plugin/skill-set-manager"
```

`file:` 目录以链接方式装进 profile，改完代码重装或重启即可，无需复制目录。

注意：`link:` / `file:` 安装只建链接，**不会**给源目录装依赖。先在插件目录跑一次 `npm install`（或 `pnpm install`），否则 host 加载时会从该目录向上找不到依赖，报 `ERR_MODULE_NOT_FOUND: @deepseek-ai/schemastery`（Module import 失败 → 组件启用失败）。

### 卸载

```bash
dsh plugin --profile desktop remove @matrixfu/skill-set-manager
```

依赖（`zod`、`@deepseek-ai/dsh-typert-protocol`、`@deepseek-ai/schemastery`）在 registry / GitHub 源码安装时由 pnpm 按 `package.json` 自动解析；`link:` / `file:` 链接安装不在此列（见上节）。

## 目录结构

```text
plugin/skill-set-manager/     插件本体：host 半 index.js、client 半 client.js、lib/core/*（纯逻辑）
scripts/                      验收门禁：verify.mjs、ui-gates.mjs
GLOSSARY.md                   领域术语表
```

## 开发与验收

- 无构建步骤，纯 ESM；改 `client.js` 后刷新页面生效，改 host 半（`index.js` / `lib/core/`）需重装或重启。
- `node scripts/verify.mjs` 跑全部验收 case；`--list-cases` 列 case，`--case N` 只跑指定 case。
- `node scripts/ui-gates.mjs` 跑语法与 UI 隔离门禁。
- 两者都**必须在 DSH 文件沙箱外**、Windows 下运行：沙箱会把 junction 虚拟化成普通目录，link/junction 类 case 会假红。
- 会话落盘是多帧 zstd：PATH 里有 `zstd`，或用环境变量 `ZSTD_BIN` 指定可执行文件；缺失时回退 Node 内置单帧解压（可能解不全）。

## 许可

[MIT](LICENSE)
