# ecc-tailor

**English** | [中文](README.zh.md)

A selective installer for [Everything Claude Code (ECC)](https://github.com/affaan-m/everything-claude-code). Cherry-pick what you need from 235 skills / 47 agents by tech stack instead of installing everything.

## Why

ECC's built-in installer is too coarse — `--with lang:java` pulls in 38 skills (including Rust/Kotlin/Django/Laravel), doesn't support project-level installation, and agents are all-or-nothing. ecc-tailor fixes this:

- **Individual selection** — pick down to a single agent or skill
- **Two-level install** — stack-agnostic goes to global `~/.claude/`, stack-specific goes to project `<proj>/.claude/`
- **Config as code** — one JSON file declares everything, `apply` makes it happen
- **Symlink mode** — zero-copy, `git pull` on ECC takes effect immediately
- **Hook integration** — fine-grained control over ECC's 26 hooks via profile/disabled
- **Upgrade detection** — passive notification of new capabilities + interactive 3-way decisions

## Install

```bash
git clone https://github.com/<you>/ecc-tailor.git
cd ecc-tailor
npm link              # registers `ecc-tailor` as a global CLI command
```

`npm link` creates a symlink from your system PATH to `bin/ecc-tailor` in this repo, so you can run `ecc-tailor` from anywhere in the terminal.

Requires Node >= 18. Zero npm dependencies.

## Quick Start

```bash
# 1. Install global bundle + hooks (no config needed — sensible defaults)
ecc-tailor apply

# 2. Add stack-specific bundles to your project
cd ~/code/my-java-project
ecc-tailor add bundle java-proj --to project:$(pwd)
ecc-tailor apply
```

On first run, ECC is automatically cloned to `~/.local/share/ecc-tailor/ecc/`. To use an existing local clone, create `~/.config/ecc-tailor/config.json`:

```json
{ "eccPath": "/path/to/everything-claude-code" }
```

Without a config file, ecc-tailor uses these defaults: global bundle, standard hook profile, claude-mem compatibility on. See [Config Reference](#config-reference) for full customization.

## Bundles

33 bundles covering 47 agents and 166 skills. A project can combine multiple bundles:

```json
{ "path": "/path/to/fullstack-app", "bundles": ["ts-backend-proj", "ts-frontend-proj", "database"] }
```

### Language / Framework

| Bundle | Agents | Skills | Use case |
|---|---|---|---|
| `global` | 16 | 9 | Stack-agnostic basics (planner, architect, tdd, etc.) |
| `java-proj` | 2 | 6 | Spring Boot projects |
| `py-proj` | 1 | 2 | Python projects |
| `py-django-proj` | extends py-proj | +4 | Django projects |
| `py-ml-proj` | extends py-proj +1 | +1 | PyTorch / deep learning |
| `ts-backend-proj` | 2 | 1 | Node/Express/Fastify backends |
| `ts-frontend-proj` | 3 | 4 | React/Next/Vue frontends |
| `ts-nestjs-proj` | extends ts-backend | +1 | NestJS projects |
| `nuxt-proj` | extends ts-frontend | +1 | Nuxt projects |
| `go-proj` | 2 | 2 | Go projects |
| `rust-proj` | 2 | 2 | Rust projects |
| `kotlin-proj` | 2 | 7 | Kotlin / Android / KMP |
| `cpp-proj` | 2 | 2 | C++ projects |
| `csharp-proj` | 1 | 2 | C# / .NET projects |
| `swift-proj` | 0 | 6 | Swift / iOS / macOS |
| `dart-flutter-proj` | 2 | 2 | Dart / Flutter |
| `laravel-proj` | 0 | 5 | Laravel / PHP |
| `perl-proj` | 0 | 3 | Perl projects |

### Domain / Purpose

| Bundle | Agents | Skills | Use case |
|---|---|---|---|
| `ai-app-dev` | 0 | 3 | Claude API / MCP server development |
| `security` | 1 | 3 | Security review + scanning |
| `database` | 1 | 3 | Database design, migrations, optimization |
| `devops` | 0 | 3 | Docker, deployment, benchmarking |
| `healthcare` | 1 | 5 | Medical / HIPAA / clinical systems |
| `opensource` | 3 | 1 | Fork, sanitize, package for public release |
| `a11y` | 1 | 1 | Accessibility / WCAG compliance |
| `seo` | 1 | 1 | SEO audits and optimization |
| `gan-harness` | 3 | 1 | GAN multi-agent adversarial generation |
| `agent-dev` | 1 | 14 | AI agent development and orchestration |
| `research` | 0 | 4 | Deep research, web search, market analysis |
| `content` | 0 | 13 | Writing, video, social media, presentations |
| `ops` | 2 | 12 | Email, Jira, GitHub, Slack workflow automation |
| `crypto` | 0 | 4 | Web3 / DeFi security |
| `scan` | 0 | 11 | Temporary evaluation tools (attach/detach) |

### Bundle Details

<details>
<summary><b>global</b> — Stack-agnostic core</summary>

| Type | Name | Description |
|---|---|---|
| agent | planner | Complex feature and refactoring planning |
| agent | architect | System design, scalability, and technical decisions |
| agent | code-architect | Feature architecture blueprints from codebase patterns |
| agent | code-explorer | Trace execution paths and map architecture layers |
| agent | code-reviewer | Code quality, security, and maintainability review |
| agent | code-simplifier | Simplify code for clarity while preserving behavior |
| agent | comment-analyzer | Analyze code comments for accuracy and rot risk |
| agent | silent-failure-hunter | Find swallowed errors, bad fallbacks, missing propagation |
| agent | tdd-guide | Test-driven development enforcement |
| agent | type-design-analyzer | Analyze type design for encapsulation and invariants |
| agent | performance-optimizer | Bottleneck identification and optimization |
| agent | pr-test-analyzer | PR test coverage quality review |
| agent | doc-updater | Documentation and codemap maintenance |
| agent | docs-lookup | Library/framework docs via Context7 MCP |
| agent | harness-optimizer | Agent harness configuration tuning |
| agent | refactor-cleaner | Dead code cleanup and consolidation |
| skill | coding-standards | Cross-project conventions: naming, readability, immutability |
| skill | api-design | REST API patterns: resources, status codes, pagination, versioning |
| skill | tdd-workflow | Write-tests-first methodology with 80%+ coverage |
| skill | verification-loop | Comprehensive verification for Claude Code sessions |
| skill | plankton-code-quality | Auto-formatting and linting on every file edit via hooks |
| skill | strategic-compact | Manual context compaction at logical intervals |
| skill | git-workflow | Branching strategies, commit conventions, merge vs rebase |
| skill | gateguard | Per-file fact-forcing gate, blocks edits until investigation (+2.25 quality) |
| skill | architecture-decision-records | Capture architectural decisions as structured ADR documents |

</details>

<details>
<summary><b>java-proj</b> — Spring Boot</summary>

| Type | Name | Description |
|---|---|---|
| agent | java-reviewer | Java/Spring Boot code review: layered arch, JPA, security, concurrency |
| agent | java-build-resolver | Fix Maven/Gradle build errors and dependency issues |
| skill | springboot-patterns | Spring Boot architecture, REST API, data access, caching, async |
| skill | springboot-tdd | TDD with JUnit 5, Mockito, MockMvc, Testcontainers |
| skill | springboot-verification | Build, static analysis, tests, security scans before release |
| skill | java-coding-standards | Java naming, immutability, Optional, streams, exceptions |
| skill | jpa-patterns | JPA/Hibernate entity design, queries, transactions, indexing |
| skill | springboot-security | Spring Security authn/authz, CSRF, validation, rate limiting |

</details>

<details>
<summary><b>py-proj</b> — Python</summary>

| Type | Name | Description |
|---|---|---|
| agent | python-reviewer | PEP 8, type hints, Pythonic idioms, security review |
| skill | python-patterns | Pythonic idioms, type hints, and best practices |
| skill | python-testing | pytest, TDD, fixtures, mocking, parametrization, coverage |

</details>

<details>
<summary><b>py-django-proj</b> — Django (extends py-proj)</summary>

| Type | Name | Description |
|---|---|---|
| skill | django-patterns | Architecture, DRF, ORM, caching, signals, middleware |
| skill | django-tdd | Testing with pytest-django, factory_boy, coverage |
| skill | django-verification | Migrations, linting, tests, security scans before release |
| skill | django-security | Auth, CSRF, SQL injection prevention, secure deployment |

</details>

<details>
<summary><b>py-ml-proj</b> — ML / deep learning (extends py-proj)</summary>

| Type | Name | Description |
|---|---|---|
| agent | pytorch-build-resolver | Fix tensor shape mismatches, CUDA errors, gradient issues |
| skill | pytorch-patterns | Training pipelines, model architectures, data loading |

</details>

<details>
<summary><b>ts-backend-proj</b> — TypeScript/JS backend</summary>

| Type | Name | Description |
|---|---|---|
| agent | typescript-reviewer | Type safety, async correctness, Node/web security review |
| agent | build-error-resolver | Fix build/type errors with minimal diffs |
| skill | backend-patterns | Backend arch, API design, DB optimization for Node.js/Express |

</details>

<details>
<summary><b>ts-frontend-proj</b> — TypeScript/JS frontend</summary>

| Type | Name | Description |
|---|---|---|
| agent | typescript-reviewer | Type safety, async correctness, Node/web security review |
| agent | build-error-resolver | Fix build/type errors with minimal diffs |
| agent | e2e-runner | E2E testing with Vercel Agent Browser / Playwright |
| skill | frontend-patterns | React, Next.js, state management, performance, UI best practices |
| skill | frontend-design | Production-grade frontend with high design quality |
| skill | e2e-testing | Playwright patterns, Page Object Model, CI/CD, flaky test strategies |
| skill | nextjs-turbopack | Next.js 16+ Turbopack incremental bundling and configuration |

</details>

<details>
<summary><b>ts-nestjs-proj</b> — NestJS (extends ts-backend-proj)</summary>

| Type | Name | Description |
|---|---|---|
| skill | nestjs-patterns | Modules, controllers, providers, DTO validation, guards, interceptors |

</details>

<details>
<summary><b>nuxt-proj</b> — Nuxt (extends ts-frontend-proj)</summary>

| Type | Name | Description |
|---|---|---|
| skill | nuxt4-patterns | Hydration safety, route rules, SSR-safe data fetching |

</details>

<details>
<summary><b>go-proj</b> — Go</summary>

| Type | Name | Description |
|---|---|---|
| agent | go-reviewer | Idiomatic Go, concurrency, error handling, performance review |
| agent | go-build-resolver | Fix go build errors, vet issues, linter warnings |
| skill | golang-patterns | Idiomatic Go patterns and conventions |
| skill | golang-testing | Table-driven tests, subtests, benchmarks, fuzzing, coverage |

</details>

<details>
<summary><b>rust-proj</b> — Rust</summary>

| Type | Name | Description |
|---|---|---|
| agent | rust-reviewer | Ownership, lifetimes, error handling, unsafe review |
| agent | rust-build-resolver | Fix cargo build, borrow checker, Cargo.toml issues |
| skill | rust-patterns | Idiomatic Rust, ownership, traits, concurrency |
| skill | rust-testing | Unit/integration tests, async testing, property-based testing |

</details>

<details>
<summary><b>kotlin-proj</b> — Kotlin / Android / KMP</summary>

| Type | Name | Description |
|---|---|---|
| agent | kotlin-reviewer | Idiomatic Kotlin, coroutine safety, Compose, clean architecture |
| agent | kotlin-build-resolver | Fix Kotlin/Gradle build and compiler errors |
| skill | kotlin-patterns | Kotlin idioms, coroutines, null safety, DSL builders |
| skill | kotlin-testing | Kotest, MockK, coroutine testing, property-based testing |
| skill | kotlin-coroutines-flows | Structured concurrency, Flow operators, StateFlow, error handling |
| skill | kotlin-exposed-patterns | JetBrains Exposed ORM: DSL, DAO, HikariCP, Flyway |
| skill | kotlin-ktor-patterns | Ktor routing, plugins, auth, Koin DI, WebSockets |
| skill | android-clean-architecture | Clean Architecture for Android/KMP: modules, UseCases, Repositories |
| skill | compose-multiplatform-patterns | Compose Multiplatform: state, navigation, theming, performance |

</details>

<details>
<summary><b>cpp-proj</b> — C++</summary>

| Type | Name | Description |
|---|---|---|
| agent | cpp-reviewer | Memory safety, modern C++ idioms, concurrency, performance |
| agent | cpp-build-resolver | Fix CMake, compilation, linker, and template errors |
| skill | cpp-coding-standards | C++ Core Guidelines for modern, safe, idiomatic code |
| skill | cpp-testing | GoogleTest, CTest, sanitizers, coverage |

</details>

<details>
<summary><b>csharp-proj</b> — C# / .NET</summary>

| Type | Name | Description |
|---|---|---|
| agent | csharp-reviewer | .NET conventions, async patterns, nullable, security review |
| skill | dotnet-patterns | Idiomatic C#, DI, async/await, .NET best practices |
| skill | csharp-testing | xUnit, FluentAssertions, mocking, integration tests |

</details>

<details>
<summary><b>swift-proj</b> — Swift / iOS / macOS</summary>

| Type | Name | Description |
|---|---|---|
| skill | swiftui-patterns | @Observable, view composition, navigation, performance |
| skill | swift-concurrency-6-2 | Swift 6.2 single-threaded default, @concurrent, isolation |
| skill | swift-actor-persistence | Thread-safe data persistence using actors |
| skill | swift-protocol-di-testing | Protocol-based DI for testable Swift code |
| skill | liquid-glass-design | iOS 26 Liquid Glass dynamic material and morphing |
| skill | foundation-models-on-device | Apple FoundationModels for on-device LLM in iOS 26+ |

</details>

<details>
<summary><b>dart-flutter-proj</b> — Dart / Flutter</summary>

| Type | Name | Description |
|---|---|---|
| agent | dart-build-resolver | Fix dart analyze errors, pub conflicts, build_runner issues |
| agent | flutter-reviewer | Widget best practices, state management, accessibility review |
| skill | dart-flutter-patterns | Null safety, async composition, widget arch, GoRouter, Dio |
| skill | flutter-dart-code-review | Library-agnostic Flutter/Dart review checklist |

</details>

<details>
<summary><b>laravel-proj</b> — Laravel / PHP</summary>

| Type | Name | Description |
|---|---|---|
| skill | laravel-patterns | Routing, Eloquent ORM, service layers, queues, events, caching |
| skill | laravel-tdd | TDD with PHPUnit and Pest, factories, database testing |
| skill | laravel-verification | Env checks, linting, static analysis, tests, security scans |
| skill | laravel-security | Auth, validation, CSRF, mass assignment, file uploads, secrets |
| skill | laravel-plugin-discovery | Discover and evaluate Laravel packages via LaraPlugins.io |

</details>

<details>
<summary><b>perl-proj</b> — Perl</summary>

| Type | Name | Description |
|---|---|---|
| skill | perl-patterns | Modern Perl 5.36+ idioms and conventions |
| skill | perl-testing | Test2::V0, prove runner, mocking, Devel::Cover |
| skill | perl-security | Taint mode, DBI parameterized queries, web security |

</details>

<details>
<summary><b>ai-app-dev</b> — Claude API / MCP</summary>

| Type | Name | Description |
|---|---|---|
| skill | claude-api | Messages API, streaming, tool use, vision, thinking, batches, caching |
| skill | mcp-server-patterns | Build MCP servers: tools, resources, prompts, Zod, stdio vs HTTP |
| skill | cost-aware-llm-pipeline | LLM cost optimization: model routing, budget tracking, caching |

</details>

<details>
<summary><b>security</b> — Security hardening</summary>

| Type | Name | Description |
|---|---|---|
| agent | security-reviewer | SSRF, injection, unsafe crypto, OWASP Top 10 detection |
| skill | security-review | Security vulnerability review |
| skill | security-scan | Scan .claude/ config for misconfigurations and injection risks |
| skill | security-bounty-hunter | Hunt exploitable, bounty-worthy vulnerabilities |

</details>

<details>
<summary><b>database</b> — Database</summary>

| Type | Name | Description |
|---|---|---|
| agent | database-reviewer | PostgreSQL query optimization, schema design, security |
| skill | database-migrations | Schema changes, rollbacks, zero-downtime deploys across ORMs |
| skill | postgres-patterns | PostgreSQL indexing, query optimization, Supabase best practices |
| skill | clickhouse-io | ClickHouse analytics, query optimization, data engineering |

</details>

<details>
<summary><b>devops</b> — Deployment and infrastructure</summary>

| Type | Name | Description |
|---|---|---|
| skill | docker-patterns | Docker/Compose: container security, networking, multi-service |
| skill | deployment-patterns | CI/CD pipelines, health checks, rollback, production readiness |
| skill | benchmark | Performance baselines, regression detection, stack comparison |

</details>

<details>
<summary><b>healthcare</b> — Medical / clinical</summary>

| Type | Name | Description |
|---|---|---|
| agent | healthcare-reviewer | Clinical safety, PHI compliance, medical data integrity |
| skill | healthcare-cdss-patterns | Drug interaction checking, dose validation, clinical scoring |
| skill | healthcare-emr-patterns | EMR/EHR workflows, prescription generation, clinical decision support |
| skill | healthcare-eval-harness | Patient safety evaluation: CDSS accuracy, PHI exposure testing |
| skill | healthcare-phi-compliance | PHI/PII classification, access control, audit trails, encryption |
| skill | hipaa-compliance | HIPAA privacy/security: covered entities, BAAs, breach posture |

</details>

<details>
<summary><b>opensource</b> — Open source release</summary>

| Type | Name | Description |
|---|---|---|
| agent | opensource-forker | Fork, strip secrets/credentials, clean git history |
| agent | opensource-packager | Generate CLAUDE.md, README, LICENSE, CONTRIBUTING, setup.sh |
| agent | opensource-sanitizer | Scan for leaked secrets, PII, internal references before release |
| skill | opensource-pipeline | End-to-end fork → sanitize → package pipeline |

</details>

<details>
<summary><b>a11y</b> — Accessibility</summary>

| Type | Name | Description |
|---|---|---|
| agent | a11y-architect | WCAG 2.2 compliance for web and native platforms |
| skill | accessibility | Design, implement, and audit inclusive digital products |

</details>

<details>
<summary><b>seo</b> — SEO</summary>

| Type | Name | Description |
|---|---|---|
| agent | seo-specialist | Technical SEO audits, Core Web Vitals, structured data |
| skill | seo | Audit and implement SEO improvements, schema markup, sitemap |

</details>

<details>
<summary><b>gan-harness</b> — GAN adversarial generation</summary>

| Type | Name | Description |
|---|---|---|
| agent | gan-evaluator | Test live app via Playwright, score against rubric |
| agent | gan-generator | Implement features per spec, iterate on evaluator feedback |
| agent | gan-planner | Expand one-line prompt into full product spec with sprints |
| skill | gan-style-harness | Generator-Evaluator agent harness pattern |

</details>

<details>
<summary><b>agent-dev</b> — AI agent development</summary>

| Type | Name | Description |
|---|---|---|
| agent | loop-operator | Operate autonomous loops, monitor progress, intervene on stall |
| skill | agentic-engineering | Eval-first execution, decomposition, cost-aware model routing |
| skill | autonomous-agent-harness | Persistent memory, scheduled ops, computer use, task queuing |
| skill | autonomous-loops | Sequential pipelines to RFC-driven multi-agent DAG systems |
| skill | continuous-agent-loop | Quality gates, evals, and recovery controls for agent loops |
| skill | agent-harness-construction | Design action spaces, tool definitions, observation formatting |
| skill | agent-introspection-debugging | Self-debugging: capture, diagnosis, contained recovery |
| skill | eval-harness | Formal evaluation framework for eval-driven development |
| skill | enterprise-agent-ops | Observability, security boundaries, lifecycle management |
| skill | dmux-workflows | Multi-agent orchestration via dmux (tmux pane manager) |
| skill | santa-method | Two independent review agents must both pass before shipping |
| skill | council | Four-voice council for ambiguous decisions and tradeoffs |
| skill | team-builder | Interactive agent picker for composing parallel teams |
| skill | ralphinho-rfc-pipeline | RFC-driven multi-agent DAG with quality gates and merge queues |
| skill | safety-guard | Prevent destructive operations in autonomous agent runs |

</details>

<details>
<summary><b>research</b> — Research and analysis</summary>

| Type | Name | Description |
|---|---|---|
| skill | deep-research | Multi-source web research with citations via firecrawl and exa |
| skill | exa-search | Neural search for web, code, companies, people via Exa MCP |
| skill | market-research | Competitive analysis, market sizing, industry intelligence |
| skill | research-ops | Current-state research with public evidence and local context |

</details>

<details>
<summary><b>content</b> — Content creation</summary>

| Type | Name | Description |
|---|---|---|
| skill | article-writing | Articles, guides, blog posts, tutorials, newsletter issues |
| skill | brand-voice | Build writing style profiles from real posts and reuse across content |
| skill | content-engine | Platform-native content for X, LinkedIn, TikTok, YouTube, newsletters |
| skill | crosspost | Multi-platform distribution adapted per platform (never identical) |
| skill | frontend-slides | Animation-rich HTML presentations from scratch or PPT conversion |
| skill | manim-video | Manim animated explainers for concepts, graphs, diagrams |
| skill | video-editing | Full pipeline: raw capture → FFmpeg → Remotion → ElevenLabs → polish |
| skill | remotion-video-creation | Video creation in React with Remotion (3D, animations, captions) |
| skill | fal-ai-media | Image/video/audio generation via fal.ai MCP |
| skill | videodb | Ingest, index, search, edit, and generate video/audio |
| skill | ui-demo | Record polished UI demo videos using Playwright |
| skill | investor-materials | Pitch decks, one-pagers, memos, financial models |
| skill | investor-outreach | Cold emails, warm intros, follow-ups for fundraising |

</details>

<details>
<summary><b>ops</b> — Business operations</summary>

| Type | Name | Description |
|---|---|---|
| agent | chief-of-staff | Email/Slack/LINE/Messenger triage with 4-tier classification |
| agent | conversation-analyzer | Analyze transcripts to find behaviors worth preventing with hooks |
| skill | email-ops | Mailbox triage, drafting, send verification, follow-up |
| skill | messages-ops | Read texts/DMs, recover one-time codes, inspect threads |
| skill | google-workspace-ops | Drive/Docs/Sheets/Slides: find, edit, migrate, clean up |
| skill | unified-notifications-ops | Alert routing, deduplication, escalation across GitHub/Linear/desktop |
| skill | knowledge-ops | Knowledge base management, ingestion, sync, retrieval |
| skill | project-flow-ops | GitHub/Linear issue triage, PR management, backlog control |
| skill | jira-integration | Jira ticket retrieval, status updates, transitions via MCP/REST |
| skill | github-ops | Issue/PR/CI/release management and automation via gh CLI |
| skill | terminal-ops | Run commands, debug CI failures, push narrow fixes with proof |
| skill | automation-audit-ops | Inventory jobs, hooks, connectors to find broken/redundant automations |
| skill | finance-billing-ops | Revenue snapshots, pricing comparisons, duplicate-charge diagnosis |
| skill | customer-billing-ops | Subscriptions, refunds, churn triage via Stripe |

</details>

<details>
<summary><b>crypto</b> — Web3 / DeFi</summary>

| Type | Name | Description |
|---|---|---|
| skill | defi-amm-security | Solidity AMM security: reentrancy, oracle manipulation, slippage |
| skill | evm-token-decimals | Prevent decimal mismatch bugs across EVM chains |
| skill | llm-trading-agent-security | Prompt injection, spend limits, circuit breakers for trading agents |
| skill | nodejs-keccak256 | Node sha3-256 ≠ Ethereum Keccak-256 — prevent silent hashing bugs |

</details>

<details>
<summary><b>scan</b> — Ephemeral evaluation (attach/detach)</summary>

| Type | Name | Description |
|---|---|---|
| skill | agent-sort | Evidence-backed ECC install plan: DAILY vs LIBRARY buckets |
| skill | skill-stocktake | Audit skills and commands for quality (quick scan / full stocktake) |
| skill | repo-scan | Cross-stack source code audit with four-level verdicts |
| skill | workspace-surface-audit | Audit repo, MCP servers, plugins, env, recommend ECC setup |
| skill | ecc-tools-cost-audit | Audit ECC Tools burn: PR creation, quota, premium-model leakage |
| skill | rules-distill | Extract cross-cutting principles from skills into rules |
| skill | agent-eval | Head-to-head coding agent comparison with metrics |
| skill | skill-comply | Visualize whether skills/rules are actually followed |
| skill | codebase-onboarding | Analyze unfamiliar codebase, generate onboarding guide + CLAUDE.md |
| skill | configure-ecc | Interactive ECC installer with skill/rule selection |
| skill | context-budget | Audit context window consumption, find bloat, recommend savings |

</details>

## Commands

### Core

```bash
ecc-tailor apply [--dry-run]        # Sync symlinks + hooks per config
ecc-tailor status                    # Show what's installed
ecc-tailor doctor                    # Health check (broken links, config validity)
```

### Incremental Changes

```bash
ecc-tailor add skill <name> --to global                  # Add skill globally
ecc-tailor add skill <name> --to project:$(pwd)          # Add skill to current project
ecc-tailor add bundle <name> --to project:$(pwd)         # Add bundle to current project
ecc-tailor remove skill <name> --from global             # Remove
```

### Browse ECC Resources

```bash
ecc-tailor inventory --type skill                        # All skills, with selection status
ecc-tailor inventory --type skill --state unselected     # Only unselected
ecc-tailor inventory --detail <name>                     # View full content of a skill
```

### Scan a New Project

```bash
cd ~/code/new-project
ecc-tailor scan attach .           # Temporarily install 11 evaluation skills
# Run /agent-sort in Claude Code for recommendations
ecc-tailor add bundle java-proj --to project:$(pwd)      # Install based on recommendations
ecc-tailor scan detach .           # Clean up evaluation tools
```

### Fork (Local Customization)

```bash
ecc-tailor fork ~/.claude/agents/planner.md
# Symlink becomes a real file — edit freely, apply won't overwrite
```

### Upgrade ECC

```bash
ecc-tailor upgrade
# Pulls latest ECC, lists new skills/agents, asks for each:
#   [a]pprove — add to config and install
#   [i]gnore  — never ask again
#   [s]kip    — skip for now, ask next time
```

### Hook Management

```bash
ecc-tailor hooks status                          # Show current profile + disabled
ecc-tailor hooks set-profile strict              # minimal | standard | strict
ecc-tailor hooks disable <hook-id>               # Disable a hook
ecc-tailor hooks enable <hook-id>                # Enable
ecc-tailor hooks claude-mem-compat off           # Disable claude-mem compat (enables 8 auto-disabled hooks)
```

## Slash Command

`apply` automatically installs an `/ecc-tailor` slash command to `~/.claude/commands/`. Use natural language inside Claude Code:

```
/ecc-tailor add hexagonal-architecture to this project
/ecc-tailor scan this project for recommendations
/ecc-tailor show status
```

## How It Works

- **Symlink** — agents linked per-file, skills and rules linked per-directory, pointing to ECC clone
- **State** — `~/.local/state/ecc-tailor/state.json` tracks all symlinks, forks, and ephemeral scans
- **Hooks** — generates a wrapper script that sets `ECC_HOOK_PROFILE` + `ECC_DISABLED_HOOKS` env vars; ECC's own `run-with-flags.js` handles the rest
- **Conflicts** — if the target path exists and isn't managed by ecc-tailor, abort with error (never overwrite)
- **Idempotent** — running `apply` twice produces the same result

## Config Reference

`~/.config/ecc-tailor/config.json`:

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
      "extras": { "skills": ["hexagonal-architecture"] }
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

| Field | Description |
|---|---|
| `eccPath` | Path to ECC clone (null = auto-managed) |
| `global.bundles` | Bundles to install globally |
| `global.extras.*` | Extra agents/skills/rules beyond bundles |
| `global.excludes.*` | Exclude specific items from bundles |
| `projects[].bundles` | Array — a project can use multiple bundles |
| `hooks.profile` | `minimal` / `standard` / `strict` |
| `hooks.claudeMemCompat` | Auto-disable 8 hooks that overlap with claude-mem plugin |
| `hooks.disabled` | Additional manually disabled hook IDs |

## Uninstall

```bash
ecc-tailor remove --all              # Remove all symlinks + hooks
npm unlink -g ecc-tailor             # Remove CLI
rm -rf ~/.config/ecc-tailor          # Remove config
rm -rf ~/.local/state/ecc-tailor     # Remove state
rm -rf ~/.local/share/ecc-tailor     # Remove ECC clone + wrappers
```

## Development

```bash
npm test                             # Unit + integration tests (86)
ECC_PATH=/path/to/ecc npm test       # + real ECC verification (10 E2E tests)
```

## License

MIT
