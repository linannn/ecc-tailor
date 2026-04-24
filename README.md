# ecc-tailor

Selective installer for [Everything Claude Code (ECC)](https://github.com/affaan-m/everything-claude-code). Cherry-pick agents, skills, rules, and hooks by stack instead of loading the entire 181-skill / 48-agent bundle.

## Why

ECC's built-in installer has coarse granularity — `--with lang:java` pulls in 38 skills including Rust/Kotlin/Django/Laravel. It doesn't support per-project scoping, and agents are all-or-nothing. ecc-tailor fixes this with:

- **Per-file granularity** — pick individual agents and skills
- **Two-tier install** — global (`~/.claude/`) + per-project (`<proj>/.claude/`)
- **Config-as-code** — one JSON file declares everything, `apply` makes it so
- **Symlink model** — zero-copy, instant ECC upgrades via `git pull`
- **Hook integration** — ECC's 26 hooks merged into your settings.json with profile/disabled controls
- **Upgrade workflow** — passive notifications + interactive 3-way decisions for new capabilities

## Install

```bash
git clone https://github.com/<you>/ecc-tailor.git
cd ecc-tailor
npm link
```

Node >= 18 required. Zero npm dependencies.

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

First run auto-clones ECC to `~/.local/share/ecc-tailor/ecc/`. To use an existing local clone:

```json
{ "eccPath": "/path/to/everything-claude-code", ... }
```

## Bundles

| Bundle | Agents | Skills | Use case |
|---|---|---|---|
| `global` | 16 | 6 | Stack-agnostic core (planner, architect, tdd, etc.) |
| `java-proj` | 2 | 5 | Spring Boot projects |
| `py-proj` | 1 | 2 | Python projects |
| `py-django-proj` | extends py-proj | +3 | Django projects |
| `ts-backend-proj` | 2 | 1 | Node/Express/Fastify backend |
| `ts-frontend-proj` | 3 | 2 | React/Next/Vue frontend |
| `ts-nestjs-proj` | extends ts-backend | +1 | NestJS projects |
| `ai-app-dev` | 0 | 2 | Claude API / MCP server dev |
| `security` | 1 | 2 | Security review + scanning |
| `scan` | 0 | 9 | Ephemeral evaluation tools |

A project can consume multiple bundles:

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
ecc-tailor status                    # Print installed items summary
ecc-tailor doctor                    # Health check (broken links, config validity)
```

### Incremental changes

```bash
ecc-tailor add skill <name> --to global
ecc-tailor add skill <name> --to project:$(pwd)
ecc-tailor add bundle <name> --to project:$(pwd)
ecc-tailor remove skill <name> --from global
```

### Explore ECC

```bash
ecc-tailor inventory --type skill                     # All 181 skills with selection markers
ecc-tailor inventory --type skill --state unselected   # What you haven't picked yet
ecc-tailor inventory --detail <name>                   # Full SKILL.md content
```

### Scan a new project

```bash
cd ~/code/new-project
ecc-tailor scan attach .      # Install 9 evaluation skills temporarily
# In Claude Code: run /agent-sort to get recommendations
ecc-tailor add bundle java-proj --to project:$(pwd)   # Act on recommendations
ecc-tailor scan detach .      # Clean up eval tools
```

### Fork (customize)

```bash
ecc-tailor fork ~/.claude/agents/planner.md
# Symlink → real file. Edit freely; apply won't overwrite it.
```

### Upgrade ECC

```bash
ecc-tailor upgrade
# Fetches latest ECC, shows new skills/agents, lets you:
#   [a]pprove — add to config
#   [i]gnore  — never ask again
#   [s]kip    — ask next time
```

### Hooks

```bash
ecc-tailor hooks status
ecc-tailor hooks set-profile strict          # minimal | standard | strict
ecc-tailor hooks disable <hook-id>
ecc-tailor hooks enable <hook-id>
ecc-tailor hooks claude-mem-compat off       # Enable hooks that overlap with claude-mem
```

## Slash Command

`apply` installs `/ecc-tailor` as a Claude Code slash command. In any session:

```
/ecc-tailor add hexagonal-architecture to this project
/ecc-tailor scan this project and recommend what to install
/ecc-tailor status
```

## How It Works

- **Symlinks** — agents are file-level symlinks, skills and rules are directory-level symlinks pointing into the ECC clone
- **State** — `~/.local/state/ecc-tailor/state.json` tracks every symlink, fork, and ephemeral scan
- **Hooks** — a generated wrapper script (`~/.local/share/ecc-tailor/bin/run-hook.sh`) sets `ECC_HOOK_PROFILE` and `ECC_DISABLED_HOOKS` env vars; ECC's own `run-with-flags.js` handles the rest
- **Conflicts** — if a target path already exists and isn't managed by ecc-tailor, apply aborts with a clear message
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
| `eccPath` | Override ECC clone location (null = auto-manage) |
| `global.bundles` | Bundle names for `~/.claude/` |
| `global.extras.*` | Additional agents/skills/rules beyond bundles |
| `global.excludes.*` | Remove specific items from bundles |
| `projects[].bundles` | Array — a project can consume multiple bundles |
| `hooks.profile` | `minimal` / `standard` / `strict` |
| `hooks.claudeMemCompat` | Auto-disable 8 hooks that overlap with claude-mem |
| `hooks.disabled` | Additional hook IDs to disable |

## Uninstall

```bash
ecc-tailor remove --all              # Remove all symlinks + hooks
npm unlink -g ecc-tailor             # Remove CLI
rm -rf ~/.config/ecc-tailor          # Remove config
rm -rf ~/.local/state/ecc-tailor     # Remove state
rm -rf ~/.local/share/ecc-tailor     # Remove ECC clone + wrapper
```

## Development

```bash
npm test                             # Unit + integration tests (84 tests)
ECC_PATH=/path/to/ecc npm test       # + real ECC validation (10 E2E tests)
```

## License

MIT
