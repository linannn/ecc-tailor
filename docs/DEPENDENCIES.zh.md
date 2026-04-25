# 依赖关系

自动生成。展示完整依赖链路：资源 → 谁需要它 → 所属 bundle。

## Command 依赖

`resolve` 阶段扫描 agent/skill 内容中的 `/command-name` 引用自动检测。

| Command | 依赖方 | Bundle |
|---|---|---|
| `/build-fix` | skill:prompt-optimizer | — |
| `/claw` | skill:autonomous-loops | agent-dev |
| `/code-review` | skill:prompt-optimizer | — |
| `/context-budget` | skill:context-budget | — |
| `/docs` | skill:design-system | — |
| `/e2e` | skill:prompt-optimizer | — |
| `/eval` | skill:eval-harness | agent-dev |
| `/evolve` | skill:continuous-learning-v2 | — |
| `/go-review` | skill:prompt-optimizer | — |
| `/harness-audit` | agent:harness-optimizer, skill:continuous-agent-loop | agent-dev |
| `/hookify` | agent:conversation-analyzer, skill:hookify-rules | ops |
| `/hookify-configure` | skill:hookify-rules | — |
| `/hookify-help` | skill:hookify-rules | — |
| `/hookify-list` | skill:hookify-rules | — |
| `/instinct-export` | skill:continuous-learning-v2 | — |
| `/instinct-import` | skill:continuous-learning-v2 | — |
| `/instinct-status` | skill:continuous-learning-v2 | — |
| `/learn` | skill:continuous-learning | — |
| `/plan` | skill:prompt-optimizer | — |
| `/projects` | skill:continuous-learning-v2, skill:laravel-security | laravel-proj |
| `/promote` | skill:continuous-learning-v2 | — |
| `/prompt-optimize` | skill:prompt-optimizer | — |
| `/quality-gate` | skill:continuous-agent-loop | agent-dev |
| `/refactor-clean` | skill:prompt-optimizer | — |
| `/resume-session` | skill:prompt-optimizer | — |
| `/rules-distill` | skill:rules-distill | — |
| `/save-session` | skill:council, skill:prompt-optimizer | agent-dev |
| `/tdd` | skill:prompt-optimizer | — |
| `/test-coverage` | skill:prompt-optimizer | — |
| `/update-codemaps` | agent:doc-updater, skill:prompt-optimizer | global |
| `/update-docs` | agent:doc-updater, skill:prompt-optimizer | global |
| `/verify` | skill:autonomous-loops, skill:prompt-optimizer, skill:verification-loop | agent-dev, global |

## MCP Server 依赖

在 bundle 定义（`manifests/bundles.json`）中配置的 MCP server。

| MCP Server | Bundle |
|---|---|
| `clickhouse` | database |
| `cloudflare-docs` | devops |
| `cloudflare-observability` | devops |
| `cloudflare-workers-bindings` | devops |
| `cloudflare-workers-builds` | devops |
| `confluence` | ops |
| `context7` | global |
| `devfleet` | agent-dev |
| `evalview` | agent-dev |
| `exa-web-search` | research |
| `fal-ai` | content |
| `firecrawl` | research |
| `github` | ops |
| `jira` | ops |
| `laraplugins` | laravel-proj |
| `magic` | ts-frontend-proj |
| `memory` | agent-dev |
| `omega-memory` | agent-dev |
| `playwright` | ts-frontend-proj |
| `railway` | devops |
| `sequential-thinking` | agent-dev |
| `supabase` | database |
| `token-optimizer` | scan |
| `vercel` | devops |

### 未分配的 MCP Server

可通过 `extras.mcp` 手动添加，但不在任何 bundle 中：

- `browser-use`
- `browserbase`
- `filesystem`

## 未被引用的 Command

47 个 command 未被任何 agent/skill 引用（可通过 `extras.commands` 手动添加）：

- `/agent-sort`
- `/aside`
- `/checkpoint`
- `/cpp-build`
- `/cpp-review`
- `/cpp-test`
- `/devfleet`
- `/feature-dev`
- `/flutter-build`
- `/flutter-review`
- `/flutter-test`
- `/gan-build`
- `/gan-design`
- `/go-build`
- `/go-test`
- `/gradle-build`
- `/jira`
- `/kotlin-build`
- `/kotlin-review`
- `/kotlin-test`
- `/learn-eval`
- `/loop-start`
- `/loop-status`
- `/model-route`
- `/multi-backend`
- `/multi-execute`
- `/multi-frontend`
- `/multi-plan`
- `/multi-workflow`
- `/orchestrate`
- `/pm2`
- `/prp-commit`
- `/prp-implement`
- `/prp-plan`
- `/prp-pr`
- `/prp-prd`
- `/prune`
- `/python-review`
- `/review-pr`
- `/rust-build`
- `/rust-review`
- `/rust-test`
- `/santa-loop`
- `/sessions`
- `/setup-pm`
- `/skill-create`
- `/skill-health`
