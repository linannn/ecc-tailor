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
# 1. Create config
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

# 2. Preview
ecc-tailor apply --dry-run

# 3. Install
ecc-tailor apply
```

On first run, ECC is automatically cloned to `~/.local/share/ecc-tailor/ecc/`. To use an existing local clone:

```json
{ "eccPath": "/path/to/everything-claude-code", ... }
```

## Bundles

| Bundle | Agents | Skills | Use case |
|---|---|---|---|
| `global` | 16 | 6 | Stack-agnostic basics (planner, architect, tdd, etc.) |
| `java-proj` | 2 | 5 | Spring Boot projects |
| `py-proj` | 1 | 2 | Python projects |
| `py-django-proj` | extends py-proj | +3 | Django projects |
| `ts-backend-proj` | 2 | 1 | Node/Express/Fastify backends |
| `ts-frontend-proj` | 3 | 2 | React/Next/Vue frontends |
| `ts-nestjs-proj` | extends ts-backend | +1 | NestJS projects |
| `ai-app-dev` | 0 | 2 | Claude API / MCP server development |
| `security` | 1 | 2 | Security review + scanning |
| `scan` | 0 | 9 | Temporary evaluation tools (attach/detach) |

A project can combine multiple bundles:

```json
{
  "path": "/path/to/fullstack-app",
  "bundles": ["ts-backend-proj", "ts-frontend-proj"]
}
```

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
ecc-tailor inventory --type skill                        # All 181 skills, with selection status
ecc-tailor inventory --type skill --state unselected     # Only unselected
ecc-tailor inventory --detail <name>                     # View full content of a skill
```

### Scan a New Project

```bash
cd ~/code/new-project
ecc-tailor scan attach .           # Temporarily install 9 evaluation skills
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
npm test                             # Unit + integration tests (84)
ECC_PATH=/path/to/ecc npm test       # + real ECC verification (10 E2E tests)
```

## License

MIT
