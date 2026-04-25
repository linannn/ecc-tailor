# ecc-tailor

[English](README.md) | **中文**

[Everything Claude Code (ECC)](https://github.com/affaan-m/everything-claude-code) 的按需安装工具。从 183 个 skill / 48 个 agent 的超大配置集中，按技术栈精选你需要的部分。

## 为什么需要这个

ECC 自带安装器粒度太粗——`--with lang:java` 会拉进 38 个 skill（包括 Rust/Kotlin/Django/Laravel），不支持项目级安装，agent 要么全装要么全不装。ecc-tailor 解决这些问题：

- **逐个可选** — 精确到单个 agent / skill
- **两级安装** — 通用的放全局 `~/.claude/`，栈相关的放项目 `<proj>/.claude/`
- **配置即代码** — 一个 JSON 文件声明所有，`apply` 一键生效
- **Symlink 模式** — 零拷贝，ECC `git pull` 后立即生效
- **Hook 集成** — ECC 的 26 条 hook 按 profile/disabled 精细控制
- **MCP server 管理** — bundle 关联的 MCP server 自动合并到 `~/.claude.json`
- **自动依赖检测** — 扫描 agent/skill 中的 `/command` 和 `mcp__server__` 引用，自动带入
- **升级检测** — 被动通知新能力 + 交互式三选一决策

## 安装

```bash
git clone https://github.com/<you>/ecc-tailor.git
cd ecc-tailor
npm link              # 把 ecc-tailor 注册为全局 CLI 命令
```

`npm link` 会在系统 PATH 中创建一个 symlink 指向本仓库的 `bin/ecc-tailor`，之后在终端任意位置都能运行 `ecc-tailor`。

需要 Node >= 18，零 npm 依赖。

## 快速开始

```bash
# 1. 安装全局 bundle + hooks（无需配置文件，开箱即用）
ecc-tailor apply

# 2. 给项目加上栈相关的 bundle
cd ~/code/my-java-project
ecc-tailor add bundle java-proj --to project:$(pwd)
ecc-tailor apply
```

首次运行会自动 clone ECC 到 `~/.local/share/ecc-tailor/ecc/`。如果本地已有 ECC clone，创建 `~/.config/ecc-tailor/config.json`：

```json
{ "eccPath": "/path/to/everything-claude-code" }
```

不写配置文件时使用默认值：global bundle、standard hook profile、claude-mem 兼容模式。完整配置项见[配置参考](#配置参考)。

## Bundle 列表

共 33 个 bundle，覆盖 48 个 agent 和 148 个 skill。一个项目可以组合多个 bundle：

```json
{ "path": "/path/to/fullstack-app", "bundles": ["ts-backend-proj", "ts-frontend-proj", "database"] }
```

### 语言 / 框架

| Bundle | Agents | Skills | 适用场景 |
|---|---|---|---|
| `global` | 15 | 9 | 栈无关基础（planner、architect、tdd 等） |
| `java-proj` | 2 | 7 | Spring Boot 项目 |
| `py-proj` | 1 | 2 | Python 项目 |
| `py-django-proj` | 继承 py-proj | +4 | Django 项目 |
| `py-ml-proj` | 继承 py-proj +1 | +1 | PyTorch / 深度学习 |
| `ts-backend-proj` | 2 | 3 | Node/Express/Fastify 后端 |
| `ts-frontend-proj` | 3 | 7 | React/Next/Vue 前端 |
| `ts-nestjs-proj` | 继承 ts-backend | +1 | NestJS 项目 |
| `nuxt-proj` | 继承 ts-frontend | +1 | Nuxt 项目 |
| `go-proj` | 2 | 3 | Go 项目 |
| `rust-proj` | 2 | 2 | Rust 项目 |
| `kotlin-proj` | 2 | 7 | Kotlin / Android / KMP |
| `cpp-proj` | 2 | 2 | C++ 项目 |
| `csharp-proj` | 1 | 2 | C# / .NET 项目 |
| `swift-proj` | 0 | 6 | Swift / iOS / macOS |
| `dart-flutter-proj` | 2 | 2 | Dart / Flutter |
| `laravel-proj` | 0 | 5 | Laravel / PHP |
| `perl-proj` | 0 | 3 | Perl 项目 |

### 领域 / 功能

| Bundle | Agents | Skills | 适用场景 |
|---|---|---|---|
| `ai-app-dev` | 0 | 5 | Claude API / MCP server / Claude Code 扩展 |
| `security` | 1 | 3 | 安全审查 + 漏洞扫描 |
| `database` | 1 | 3 | 数据库设计、迁移、优化 |
| `devops` | 0 | 4 | Docker、部署、基准测试 |
| `healthcare` | 1 | 5 | 医疗 / HIPAA / 临床系统 |
| `opensource` | 3 | 1 | Fork、脱敏、打包开源发布 |
| `a11y` | 1 | 1 | 无障碍 / WCAG 合规 |
| `seo` | 1 | 1 | SEO 审计与优化 |
| `gan-harness` | 3 | 1 | GAN 多 agent 对抗生成 |
| `agent-dev` | 2 | 15 | AI agent 开发与编排 |
| `research` | 0 | 4 | 深度调研、网络搜索、市场分析 |
| `content` | 0 | 13 | 写作、视频、社交媒体、演示文稿 |
| `ops` | 2 | 12 | 邮件、Jira、GitHub、Slack 工作流自动化 |
| `crypto` | 0 | 4 | Web3 / DeFi 安全 |
| `scan` | 0 | 11 | 临时评估工具（用完即删） |

每个 bundle 包含的 agent 和 skill 完整列表：**[docs/BUNDLES.zh.md](docs/BUNDLES.zh.md)**

完整依赖链路（每个 agent/skill 需要的 command 和 MCP server）：**[docs/DEPENDENCIES.zh.md](docs/DEPENDENCIES.zh.md)**

## 命令

### 核心

```bash
ecc-tailor apply [--dry-run]        # 按配置同步 symlink + hook
ecc-tailor status                    # 查看已安装内容
ecc-tailor doctor                    # 健康检查（断链、配置合法性）
```

### 增量修改

```bash
ecc-tailor add skill <name> --to global                  # 全局加 skill
ecc-tailor add skill <name> --to project:$(pwd)          # 给当前项目加 skill
ecc-tailor add bundle <name> --to project:$(pwd)         # 给当前项目加 bundle
ecc-tailor add mcp <name> --to global                    # 加 MCP server
ecc-tailor remove skill <name> --from global             # 移除
ecc-tailor remove mcp <name> --from global               # 移除 MCP server
```

### Bundle 定制

```bash
ecc-tailor customize java-proj                           # 查看当前 override + 解析结果
ecc-tailor customize java-proj exclude skills jpa-patterns  # 从 bundle 中排除
ecc-tailor customize java-proj add skills hexagonal-architecture  # 往 bundle 中加
ecc-tailor customize java-proj reset                     # 清空所有 override
```

Override 存储在配置文件的 `bundleOverrides` 中，不修改上游 `bundles.json`，ECC 更新安全。

### 浏览 ECC 资源

```bash
ecc-tailor inventory --type skill                        # 全部 skill，标记选中状态
ecc-tailor inventory --type skill --state unselected     # 只看没选的
ecc-tailor inventory --detail <name>                     # 查看某个 skill 的完整内容
```

### 扫描新项目

```bash
cd ~/code/new-project
ecc-tailor scan attach .           # 临时装 11 个评估 skill
# 在 Claude Code 里跑 /agent-sort 获取建议
ecc-tailor add bundle java-proj --to project:$(pwd)      # 根据建议装
ecc-tailor scan detach .           # 清理评估工具
```

### Fork（本地定制）

```bash
ecc-tailor fork ~/.claude/agents/planner.md
# symlink 变成真文件，随便改，apply 不会覆盖
```

### 升级 ECC

```bash
ecc-tailor upgrade
# 拉取最新 ECC，列出新增的 skill/agent，逐个问你：
#   [a]pprove — 加到配置里装上
#   [i]gnore  — 永远不再提醒
#   [s]kip    — 这次不装，下次还问
```

### Hook 管理

```bash
ecc-tailor hooks status                          # 查看当前 profile + disabled
ecc-tailor hooks set-profile strict              # minimal | standard | strict
ecc-tailor hooks disable <hook-id>               # 禁用某条 hook
ecc-tailor hooks enable <hook-id>                # 启用
ecc-tailor hooks claude-mem-compat off           # 关闭 claude-mem 兼容（启用被自动禁用的 8 条 hook）
```

### 依赖文档

```bash
ecc-tailor deps                                  # 生成 docs/DEPENDENCIES.{md,zh.md}
```

扫描所有 agent 和 skill 的 `/command` 引用和 `mcp__server__` 工具调用，生成依赖关系图：资源 → 谁需要它 → 所属 bundle。

## Slash Command

`apply` 会自动安装 `/ecc-tailor` 斜杠命令到 `~/.claude/commands/`。在 Claude Code 会话里直接用自然语言：

```
/ecc-tailor 给当前项目加上 hexagonal-architecture
/ecc-tailor 扫描一下这个项目应该装什么
/ecc-tailor 看看状态
```

## 工作原理

- **Symlink** — agent 按文件链接，skill 和 rule 按目录链接，指向 ECC clone
- **State** — `~/.local/state/ecc-tailor/state.json` 记录所有 symlink、fork、临时扫描
- **Hook** — 生成 wrapper 脚本设置 `ECC_HOOK_PROFILE` + `ECC_DISABLED_HOOKS` 环境变量，ECC 自己的 `run-with-flags.js` 负责判断
- **MCP** — bundle 定义的 MCP server 合并到 `~/.claude.json`，`[ecc-tailor]` 标记归属；检测未填的 API key 占位符并提示
- **溯源** — `apply` 打印依赖报告：哪些 command/MCP server 被安装、是什么带进来的
- **冲突** — 目标路径已存在且不是 ecc-tailor 管理的 → 终止并报错，绝不覆盖
- **幂等** — 跑两次 `apply` 结果一样

## 配置参考

`~/.config/ecc-tailor/config.json`：

```json
{
  "eccPath": null,
  "global": {
    "bundles": ["global"],
    "extras": {
      "agents": [],
      "skills": ["hexagonal-architecture"],
      "commands": [],
      "mcp": [],
      "rulesLanguages": ["common", "java", "python", "typescript", "web"]
    },
    "excludes": {
      "agents": [],
      "skills": [],
      "commands": [],
      "mcp": []
    }
  },
  "projects": [
    {
      "path": "/abs/path",
      "bundles": ["java-proj"],
      "extras": { "skills": ["hexagonal-architecture"] }
    }
  ],
  "bundleOverrides": {
    "java-proj": {
      "exclude": { "skills": ["jpa-patterns"] },
      "add": { "skills": ["hexagonal-architecture"] }
    }
  },
  "hooks": {
    "install": true,
    "profile": "standard",
    "claudeMemCompat": true,
    "disabled": []
  },
  "mcp": {
    "install": true
  }
}
```

| 字段 | 说明 |
|---|---|
| `eccPath` | ECC clone 路径（null = 自动管理） |
| `global.bundles` | 全局安装的 bundle 列表 |
| `global.extras.*` | bundle 之外额外加的 agent/skill/command/mcp/rule |
| `global.excludes.*` | 从 bundle 里排除的 |
| `global.excludes.commands` | 抑制自动检测到的 command 依赖 |
| `global.excludes.mcp` | 排除特定 MCP server |
| `projects[].bundles` | 数组，一个项目可吃多个 bundle |
| `bundleOverrides` | 按 bundle 定制（排除/添加 agent、skill、mcp） |
| `bundleOverrides.*.exclude` | 从 bundle 解析结果中移除的项 |
| `bundleOverrides.*.add` | bundle 解析后追加的项 |
| `hooks.profile` | `minimal` / `standard` / `strict` |
| `hooks.claudeMemCompat` | 自动禁用 8 条和 claude-mem 功能重叠的 hook |
| `hooks.disabled` | 额外手动禁用的 hook ID |
| `mcp.install` | 是否启用 MCP server 管理（默认 true） |

## 卸载

```bash
ecc-tailor remove --all              # 删除所有 symlink + hook
npm unlink -g ecc-tailor             # 移除 CLI
rm -rf ~/.config/ecc-tailor          # 删除配置
rm -rf ~/.local/state/ecc-tailor     # 删除状态
rm -rf ~/.local/share/ecc-tailor     # 删除 ECC clone + wrapper
```

## 开发

```bash
npm test                             # 单元 + 集成测试（127 个）
ECC_PATH=/path/to/ecc npm test       # + 真实 ECC 验证（10 个 E2E 测试）
```

## License

MIT
