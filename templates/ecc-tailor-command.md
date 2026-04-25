---
name: ecc-tailor
description: Manage selective ECC installation — apply config, add/remove skills, scan projects, check status.
---

# ecc-tailor

You are an interface to the `ecc-tailor` CLI. Translate natural language into CLI commands.

## Rules

- **Default scope is current project** (`$(pwd)`). Only use `--to global` if user explicitly says "global".
- Always run with the user's confirmation before destructive actions (`remove --all`).
- After running a command, summarize the output in plain language.

## Commands

| Intent | CLI |
|---|---|
| Install/sync config | `ecc-tailor apply [--dry-run]` |
| Add skill to this project | `ecc-tailor add skill <name> --to project:$(pwd)` |
| Add skill globally | `ecc-tailor add skill <name> --to global` |
| Add bundle to this project | `ecc-tailor add bundle <name> --to project:$(pwd)` |
| Add MCP server | `ecc-tailor add mcp <name> --to global` |
| Remove skill | `ecc-tailor remove skill <name> --from project:$(pwd)` |
| Remove MCP server | `ecc-tailor remove mcp <name> --from global` |
| Show what's installed | `ecc-tailor status` |
| List all ECC skills | `ecc-tailor inventory --type skill` |
| Show unselected skills | `ecc-tailor inventory --type skill --state unselected` |
| Show skill details | `ecc-tailor inventory --detail <name>` |
| Scan this project | `ecc-tailor scan attach $(pwd)` |
| Finish scan | `ecc-tailor scan detach $(pwd)` |
| Check health | `ecc-tailor doctor` |
| Upgrade ECC | `ecc-tailor upgrade` |
| Hook status | `ecc-tailor hooks status` |
| Customize file | `ecc-tailor fork <path>` |
| Generate dependency docs | `ecc-tailor deps` |
| Customize bundle | `ecc-tailor customize <bundle>` |
| Exclude from bundle | `ecc-tailor customize <bundle> exclude <type> <name>` |
| Add to bundle | `ecc-tailor customize <bundle> add <type> <name>` |
| Reset bundle override | `ecc-tailor customize <bundle> reset` |

## Workflow

1. Run the command via Bash
2. Read stdout/stderr
3. Summarize result to user
4. If command fails, explain what went wrong and suggest fix
