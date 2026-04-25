# Dependency Map

Auto-generated reference showing which agents/skills depend on which commands and MCP servers.

## Command Dependencies

Commands auto-detected from `/command-name` references in agent/skill content.

| Command | Referenced By |
|---|---|
| `/build-fix` | skill:prompt-optimizer |
| `/claw` | skill:autonomous-loops |
| `/code-review` | skill:prompt-optimizer |
| `/context-budget` | skill:context-budget |
| `/docs` | skill:design-system |
| `/e2e` | skill:prompt-optimizer |
| `/eval` | skill:eval-harness |
| `/evolve` | skill:continuous-learning-v2 |
| `/go-review` | skill:prompt-optimizer |
| `/harness-audit` | agent:harness-optimizer, skill:continuous-agent-loop |
| `/hookify` | agent:conversation-analyzer, skill:hookify-rules |
| `/hookify-configure` | skill:hookify-rules |
| `/hookify-help` | skill:hookify-rules |
| `/hookify-list` | skill:hookify-rules |
| `/instinct-export` | skill:continuous-learning-v2 |
| `/instinct-import` | skill:continuous-learning-v2 |
| `/instinct-status` | skill:continuous-learning-v2 |
| `/learn` | skill:continuous-learning |
| `/plan` | skill:prompt-optimizer |
| `/projects` | skill:continuous-learning-v2, skill:laravel-security |
| `/promote` | skill:continuous-learning-v2 |
| `/prompt-optimize` | skill:prompt-optimizer |
| `/quality-gate` | skill:continuous-agent-loop |
| `/refactor-clean` | skill:prompt-optimizer |
| `/resume-session` | skill:prompt-optimizer |
| `/rules-distill` | skill:rules-distill |
| `/save-session` | skill:council, skill:prompt-optimizer |
| `/tdd` | skill:prompt-optimizer |
| `/test-coverage` | skill:prompt-optimizer |
| `/update-codemaps` | agent:doc-updater, skill:prompt-optimizer |
| `/update-docs` | agent:doc-updater, skill:prompt-optimizer |
| `/verify` | skill:autonomous-loops, skill:prompt-optimizer, skill:verification-loop |

## MCP Server → Bundle Mapping

MCP servers assigned to bundles in `manifests/bundles.json`.

| MCP Server | Bundles |
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

### Unassigned MCP Servers

Available via `extras.mcp` but not in any bundle:

- `browser-use`
- `browserbase`
- `filesystem`

## Unreferenced Commands

47 commands not referenced by any agent or skill:

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
