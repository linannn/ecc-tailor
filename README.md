# ecc-tailor

**English** | [中文](README.zh.md)

A selective installer for [Everything Claude Code (ECC)](https://github.com/affaan-m/everything-claude-code). Cherry-pick what you need from 183 skills / 48 agents by tech stack instead of installing everything.

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
| `global` | 15 | 8 | Stack-agnostic basics (planner, architect, tdd, etc.) |
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
| `agent-dev` | 2 | 14 | AI agent development and orchestration |
| `research` | 0 | 4 | Deep research, web search, market analysis |
| `content` | 0 | 13 | Writing, video, social media, presentations |
| `ops` | 2 | 12 | Email, Jira, GitHub, Slack workflow automation |
| `crypto` | 0 | 4 | Web3 / DeFi security |
| `scan` | 0 | 11 | Temporary evaluation tools (attach/detach) |

Full per-bundle listing with type, name, and description: **[docs/BUNDLES.md](docs/BUNDLES.md)**

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
