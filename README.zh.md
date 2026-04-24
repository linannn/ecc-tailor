# ecc-tailor

[English](README.md) | **中文**

[Everything Claude Code (ECC)](https://github.com/affaan-m/everything-claude-code) 的按需安装工具。从 235 个 skill / 47 个 agent 的超大配置集中，按技术栈精选你需要的部分。

## 为什么需要这个

ECC 自带安装器粒度太粗——`--with lang:java` 会拉进 38 个 skill（包括 Rust/Kotlin/Django/Laravel），不支持项目级安装，agent 要么全装要么全不装。ecc-tailor 解决这些问题：

- **逐个可选** — 精确到单个 agent / skill
- **两级安装** — 通用的放全局 `~/.claude/`，栈相关的放项目 `<proj>/.claude/`
- **配置即代码** — 一个 JSON 文件声明所有，`apply` 一键生效
- **Symlink 模式** — 零拷贝，ECC `git pull` 后立即生效
- **Hook 集成** — ECC 的 26 条 hook 按 profile/disabled 精细控制
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
# 1. 创建配置
mkdir -p ~/.config/ecc-tailor
cat > ~/.config/ecc-tailor/config.json << 'EOF'
{
  "global": {
    "bundles": ["global"],
    "extras": {
      "rulesLanguages": ["common", "java", "python", "typescript"]
    }
  },
  "projects": [
    {
      "path": "/absolute/path/to/my-java-project",
      "bundles": ["java-proj"]
    }
  ],
  "hooks": {
    "install": true,
    "profile": "standard",
    "claudeMemCompat": true
  }
}
EOF

# 2. 预览
ecc-tailor apply --dry-run

# 3. 安装
ecc-tailor apply
```

首次运行会自动 clone ECC 到 `~/.local/share/ecc-tailor/ecc/`。如果本地已有 ECC clone：

```json
{ "eccPath": "/path/to/everything-claude-code", ... }
```

## Bundle 列表

| Bundle | Agents | Skills | 适用场景 |
|---|---|---|---|
| `global` | 16 | 6 | 栈无关基础（planner、architect、tdd 等） |
| `java-proj` | 2 | 5 | Spring Boot 项目 |
| `py-proj` | 1 | 2 | Python 项目 |
| `py-django-proj` | 继承 py-proj | +3 | Django 项目 |
| `ts-backend-proj` | 2 | 1 | Node/Express/Fastify 后端 |
| `ts-frontend-proj` | 3 | 2 | React/Next/Vue 前端 |
| `ts-nestjs-proj` | 继承 ts-backend | +1 | NestJS 项目 |
| `ai-app-dev` | 0 | 2 | Claude API / MCP server 开发 |
| `security` | 1 | 2 | 安全审查 + 扫描 |
| `scan` | 0 | 9 | 临时评估工具（用完即删） |

一个项目可以组合多个 bundle：

```json
{
  "path": "/path/to/fullstack-app",
  "bundles": ["ts-backend-proj", "ts-frontend-proj"]
}
```

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
ecc-tailor remove skill <name> --from global             # 移除
```

### 浏览 ECC 资源

```bash
ecc-tailor inventory --type skill                        # 全部 181 个 skill，标记选中状态
ecc-tailor inventory --type skill --state unselected     # 只看没选的
ecc-tailor inventory --detail <name>                     # 查看某个 skill 的完整内容
```

### 扫描新项目

```bash
cd ~/code/new-project
ecc-tailor scan attach .           # 临时装 9 个评估 skill
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
      "rulesLanguages": ["common", "java", "python", "typescript", "web"]
    },
    "excludes": {
      "agents": [],
      "skills": []
    }
  },
  "projects": [
    {
      "path": "/abs/path",
      "bundles": ["java-proj"],
      "extras": { "skills": ["springboot-security"] }
    }
  ],
  "hooks": {
    "install": true,
    "profile": "standard",
    "claudeMemCompat": true,
    "disabled": []
  }
}
```

| 字段 | 说明 |
|---|---|
| `eccPath` | ECC clone 路径（null = 自动管理） |
| `global.bundles` | 全局安装的 bundle 列表 |
| `global.extras.*` | bundle 之外额外加的 agent/skill/rule |
| `global.excludes.*` | 从 bundle 里排除的 |
| `projects[].bundles` | 数组，一个项目可吃多个 bundle |
| `hooks.profile` | `minimal` / `standard` / `strict` |
| `hooks.claudeMemCompat` | 自动禁用 8 条和 claude-mem 功能重叠的 hook |
| `hooks.disabled` | 额外手动禁用的 hook ID |

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
npm test                             # 单元 + 集成测试（84 个）
ECC_PATH=/path/to/ecc npm test       # + 真实 ECC 验证（10 个 E2E 测试）
```

## License

MIT
