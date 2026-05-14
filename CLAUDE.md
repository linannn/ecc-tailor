# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

ecc-tailor is a CLI tool for selectively installing [Everything Claude Code (ECC)](https://github.com/affaan-m/everything-claude-code) components. It cherry-picks agents, skills, hooks, rules, MCP servers, contexts, and commands from ECC's 183+ skills / 48 agents catalog based on tech stack, then symlinks them into `~/.claude/` (global) or `<project>/.claude/` (project-level).

## Commands

```bash
npm test                          # Run all 205 unit/integration tests (node:test)
npm run test:one -- tests/apply.test.js   # Run a single test file
ECC_PATH=/path/to/ecc npm test    # Include 10 E2E tests against real ECC checkout
node bin/ecc-tailor <command>     # Run CLI locally without npm link
```

Zero npm dependencies. Node >= 18 required. Uses `node:test` (built-in test runner).

## Architecture

### Data Flow

```
config.json → loadConfig() → resolveDesired() → planApply() → executeApply() → state.json
                  ↑               ↑                                 ↓
             bundles.json    scanEcc(eccRoot)                  symlinks on disk
```

1. **Config** (`~/.config/ecc-tailor/config.json`) declares what bundles/extras the user wants
2. **Bundles** (`manifests/bundles.json`) define curated sets of agents/skills/mcp/rules per tech stack, with `extends` chains
3. **ECC scan** (`fs-scan.js`) inventories the ECC checkout (agents/*.md, skills/*/SKILL.md, etc.)
4. **Resolve** (`resolve.js`) computes the desired symlink set from config + bundles + inventory, auto-detecting `/command` dependencies
5. **Plan** (`apply.js:planApply`) diffs desired vs current state → toAdd/toRemove/toKeep/conflicts
6. **Execute** (`apply.js:executeApply`) creates/removes symlinks with incremental state flush for crash safety
7. **Hooks/MCP** are merged into `~/.claude/settings.json` and `~/.claude.json` respectively, using `[ecc-tailor]` markers for ownership

### Key Directories

- `src/core/` — Config, state, paths, bundle resolution, ECC repo management, filesystem scanning
- `src/apply/` — The apply pipeline: plan, execute, provenance reporting
- `src/hooks/` — Hook wrapper generation, hooks.json rewriting, settings.json merge/unmerge
- `src/mcp/` — MCP server merge/unmerge into ~/.claude.json
- `src/cmd/` — All subcommands (add, remove, status, doctor, scan, upgrade, customize, inventory, fork)
- `src/util/` — JSON I/O (atomic writes), git helpers, backup rotation
- `manifests/bundles.json` — The bundle catalog (34 bundles mapping to agents/skills/mcp/rules)
- `templates/` — Hook wrapper shell template, slash command template

### State Management

- **Config**: `~/.config/ecc-tailor/config.json` — user intent (XDG_CONFIG_HOME)
- **State**: `~/.local/state/ecc-tailor/state.json` — tracks symlinks, forks, ephemeral scans, hook/mcp status (XDG_STATE_HOME)
- **Data**: `~/.local/share/ecc-tailor/ecc/` — auto-cloned ECC repo + hook wrapper script (XDG_DATA_HOME)
- All path functions in `src/core/paths.js` are thunks (functions, not values) to support env var overrides in tests

### Ownership Markers

Hooks use description prefix `[ecc-tailor] ` — merge/unmerge filters on this. MCP servers use the same `[ecc-tailor]` prefix in their description field. This is how idempotent apply/remove works without touching user-owned entries.

### Testing Pattern

Tests use `makeTmpEnv()` (from `tests/helpers/tmp-env.js`) to create isolated HOME/XDG directories, and `makeFakeEcc()` (from `tests/helpers/fake-ecc.js`) to create a minimal ECC checkout with the agents/skills/rules/hooks/mcp structure needed for the test. Override XDG env vars so no test touches the real `~/.claude/` or `~/.config/`.

### Immutability Convention

All write paths (apply, hooks-merge, mcp-merge, state save) create new objects rather than mutating existing ones. Spread operators and destructuring are used throughout — never `obj.field = value` on shared state.
