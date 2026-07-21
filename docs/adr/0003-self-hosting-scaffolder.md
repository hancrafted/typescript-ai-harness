---
type: design-adr
title: "Self-hosting scaffolder"
description: "This repo consumes its own harness, so the tool is dogfooded on every run and its output is validated against real use."
---

# Self-hosting scaffolder: this repo consumes its own harness

The co-located template files (one per Integration, under `src/integrations/<id>/template/` — see ADR-0004) are the single source of truth for the harness. This repo installs and updates its own harness by applying the tool to itself, so the tool is continuously exercised against a real project (itself). Consequently this repo conforms to the harness's own conventions — ESM + tsx (ADR-0001), source under `src/`, tests as `*.test.ts` — rather than the templates bending to this repo.

## Consequences

- Templates ship a **generic, conventional layout** (`src/**/*.ts`, `*.test.ts`, ESM). They cannot hardcode a target's bespoke paths. [VERIFIED] `~/ai-workspace`'s eslint config hardcodes `scripts/**`, `vault/skills/*/scripts/**`, `dev/**` — exactly the kind of project-specific globs a template must omit.
- **(Deferred) Adaptation skill.** An optional AI skill will run *after* setup, inspect the target's actual structure, and adjust config paths/globs to match — an LLM-driven reconciliation layer on top of the generic templates. Not in the MVP.
- Self-application pulls the **full harness devDependencies** into this repo, reinforcing ADR-0001's requirement to firewall runtime deps (`@clack/prompts`, `tsx`) from harness devDeps.
- Two ADR homes result (design vs governance) — see `AGENTS.md` → "ADR governance".
