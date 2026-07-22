---
type: docs
title: "typescript-ai-harness"
description: "Project README — what the harness installs, how to run the CLI, and how the Integrations and governance fit together."
---

# typescript-ai-harness

An interactive CLI that installs and updates a standard dev-tooling **harness** in
any Node/TypeScript project — so you stop re-deriving the same boilerplate by hand.

One command stands up [archgate](https://www.npmjs.com/package/archgate), ESLint,
Prettier, Vitest, and Husky, wires the `verify` scripts and git hooks, and applies
everything in a single pass. Re-run it any time to pull the latest version of the
harness — it updates in place without clobbering your project metadata.

- **One command, no install step** — `npx @hancrafted/typescript-ai-harness` pulls one small tarball with zero runtime dependencies.
- **Pick what you want** — a multiselect of five integrations, each with its own sub-options.
- **Safe to re-run** — tool-owned configs are refreshed; your `package.json` is surgically merged, never overwritten.
- **Preview first** — `--dry-run` prints the full plan and touches nothing.
- **Scriptable** — `--yes` skips every prompt and applies the full harness with defaults.

---

## Requirements

- **Node.js** 20+ and **npm** (the tool assumes npm for installs and hooks).
- **git** — Husky wires git hooks, so the tool runs inside a git repository.

No global install and no build toolchain: `npx` pulls a single bundled file with zero
runtime dependencies and runs it directly — you don't need [tsx](https://www.npmjs.com/package/tsx)
or a compile step on your machine.

---

## How to use

### 1. Run it in your project

From the root of the project you want to set up:

```bash
npx @hancrafted/typescript-ai-harness
```

If the directory has no `package.json`, the tool creates a minimal one for you first —
you don't need to run `npm init`.

### 2. Choose your integrations

You'll get a multiselect with **all five preselected**. Press <kbd>Enter</kbd> to take
the full harness, or use the arrow keys + <kbd>Space</kbd> to deselect any you don't want:

| Integration | What it sets up |
| --- | --- |
| **archgate** — deterministic ADR governance | Runs `archgate init` to scaffold `.archgate/` governance |
| **eslint** — linting | A generic two-tier `eslint.config.mjs` (ESM) |
| **prettier** — formatting | An opinionated `.prettierrc.json` + `.prettierignore` |
| **vitest** — testing | A minimal `vitest.config.ts` (v8 coverage available) |
| **husky** — git hooks + commit verification | Git hooks + the `verify` / `verify:commit` scripts |

### 3. Answer each integration's sub-options

Selected integrations then prompt you, one after another:

- **archgate** — which editor integration to configure: **Claude Code** (default), Cursor, VS Code, GitHub Copilot, or opencode. Passed straight to `archgate init --editor`, so it never prompts again.
- **eslint** — a pre-checked multiselect of five clean-code rules — `complexity`, `max-lines-per-function`, `max-params`, `max-depth`, `max-lines`. <kbd>Enter</kbd> accepts all; deselect any you don't want. The recommended base (`@eslint/js` + `typescript-eslint` recommended + stylistic) is always on.
- **prettier** — enable import sorting (on by default). If on, pick **exactly one** plugin (they cannot coexist):
  - `organize-imports` (default) — sorts, merges, and **removes unused imports** (⚠️ destructive).
  - `@ianvs/sort-imports` — grouped and configurable, non-destructive.
- **husky** — which hooks to install: **pre-commit** and **pre-push** are on by default; **commit-msg** (a minimal Conventional Commits header check) is off by default.

### 4. Review the plan and confirm

Before anything is written, the tool prints a summary of every file it will write,
overwrite, merge, append, and install — then asks you to confirm. Nothing happens until
you say yes.

### Preview without changing anything

```bash
npx @hancrafted/typescript-ai-harness --dry-run
```

`--dry-run` runs the prompts and prints the full plan, then exits **without touching the
project**. Ideal for previewing an update.

### Non-interactive mode

```bash
npx @hancrafted/typescript-ai-harness --yes
```

`--yes` skips every prompt — the integrations multiselect and each integration's
sub-options — and applies the full harness with defaults: all five integrations,
archgate editor `claude`, all five eslint clean-code rules, prettier's
`organize-imports`, husky's `pre-commit` + `pre-push` hooks. It still prints the plan
summary before applying, but never blocks for input. Combine with `--dry-run` to
preview the default plan non-interactively without applying it.

### Re-running = update

Running the tool again performs an **update from this repo as the single source of truth**:

- **Tool-owned config files** are overwritten with the latest canonical versions.
- **`package.json`** is surgically merged — only the tool's scripts are set/replaced; your
  name, version, dependencies, and own scripts are preserved.
- The merge is **idempotent** — a second run converges and won't keep churning `package.json`.

---

## What gets written

| Path | On re-run |
| --- | --- |
| `eslint.config.mjs`, `.prettierrc.json`, `vitest.config.ts`, `.lintstagedrc.json`, `.husky/*` | **Overwritten** with the canonical version |
| `package.json` | **Surgically merged** — only the tool's scripts; everything else preserved |
| `.gitignore`, `.prettierignore` | **Appended** (missing entries only); never overwritten |
| `tsconfig.json` | Written **only if absent**; never overwritten |
| `.archgate/*` | Created by `archgate init` (archgate owns it) |

### Scripts added to `package.json`

Only the scripts for the integrations you selected are added, and `verify` / `verify:commit`
are composed from exactly those integrations:

| Script | Provided by | Command |
| --- | --- | --- |
| `test` | vitest | `vitest run` |
| `test:watch` | vitest | `vitest watch` |
| `format` | prettier | `prettier --write .` |
| `format:check` | prettier | `prettier --check .` |
| `verify` | husky | full-repo checks, no mutation (see below) |
| `verify:commit` | husky | staged autofix + full-repo correctness (see below) |
| `prepare` | husky | `husky` (wires hooks on install) |

### Commit verification model

Clean git history is treated as project memory, so **every commit must be provably green** —
enforced deterministically in the hook, not by soft instruction:

- **`verify`** (run on **pre-push**, and while you work) — full-repo checks, no mutation:
  `archgate check && eslint . && prettier --check . && tsc --noEmit && vitest run`
  *(only the steps for your selected integrations; `tsc --noEmit` always runs).*
- **`verify:commit`** (run on **pre-commit**) — autofix only the **staged** files via
  lint-staged, then run **full-repo** correctness:
  `lint-staged && archgate check && tsc --noEmit && vitest run`.

Formatting/autofix is scoped to staged files (fast); correctness always runs on the whole
repo (so a staged change can never commit a red tree).

---

## Notes & current limitations

- **Distribution.** Published to npm as `@hancrafted/typescript-ai-harness` — a single
  bundled file with **zero runtime dependencies**. Contributors still run the source
  directly through [tsx](https://www.npmjs.com/package/tsx) via the git-spec dev inner
  loop; only the _published_ `bin` points at the bundle.
- **npm only.** pnpm / yarn / bun detection is not implemented.
- **No ADRs are copied** by the archgate integration in this version — you start from a clean
  governance baseline. `archgate init` may require you to be in a git repository.
- Deferred: an adaptation skill that fits the generic templates to a project's actual layout,
  and full Keep-a-Changelog commit-body validation.

---

## Development

This repo **self-hosts** — it installs and updates its own harness, so the tool is
continuously exercised against a real project (itself).

```bash
npm install        # install the harness devDependencies
npm run verify     # archgate check && eslint . && prettier --check . && tsc --noEmit && vitest run
npm test           # vitest run
npm run format     # prettier --write .
npm run build      # bundle src/cli.ts -> dist/cli.mjs (the published bin)
npm run smoke      # boot-smoke the built bundle (--dry-run --yes); run after build
```

### Layout

```
bin/typescript-ai-harness.mjs      # launcher: registers tsx, imports src/cli.ts
src/
  cli.ts                      # interactive @clack/prompts layer -> answers
  run.ts                      # run(answers, {cwd, exec}) — the core seam
  plan.ts                     # buildPlan() -> declarative Action[]
  apply.ts                    # the single executor for every Action
  package-json.ts             # surgical, idempotent package.json merge
  summary.ts                  # renders the plan for the confirm prompt / --dry-run
  integrations/
    registry.ts               # explicit static array of the five integrations
    <id>/index.ts             # each Integration (id, deps, promptSubOptions, plan)
    <id>/template.ts          # co-located config template(s)
```

### Adding to the harness

- **A new sub-option** — extend one integration's `promptSubOptions()` and `plan()`.
- **A new integration** — add one folder under `src/integrations/` and one line in
  `registry.ts`. Nothing else changes.

### How it's tested

Behaviour is tested through the single seam `run(answers, { cwd, exec })`: tests inject a
resolved set of answers (bypassing the interactive prompts) and a stub `exec` (so tests never
shell out or hit the network), then assert the harness a target ends up with — files
materialized, `package.json` after merge, and which external commands were invoked.

```bash
npm test
```

A second seam, the **boot-smoke**, spawns the _built_ bundle as a subprocess with
`--dry-run --yes` and asserts a clean exit and a coherent plan preview — the only check
that exercises the published artifact rather than source. It runs after `npm run build`
(never inside `verify`, which builds nothing):

```bash
npm run build && npm run smoke
```

### Releasing

Releases are cut manually. CI (`ci.yml`) verifies, builds, and boot-smokes every push and
PR; a `v*` tag triggers `publish.yml`, which re-verifies, rebuilds, and publishes to npm
with provenance. To release:

```bash
npm version <patch|minor|major>   # bumps package.json and creates the vX.Y.Z tag
git push --follow-tags            # pushes the commit and the tag -> triggers publish.yml
```

The package stays in `0.x` until the CLI surface is deliberately declared stable. Publishing
uses npm **trusted publishing** (OIDC) — no token, nothing to rotate: CI authenticates via
the workflow's `id-token` and provenance is attached automatically. This requires a one-time
setup on npmjs.com — configure a trusted publisher for the package (this repo + `publish.yml`)
— and, because OIDC cannot create a not-yet-published package, a one-time manual publish of a
`0.0.0` placeholder with interactive 2FA to bootstrap it (see ADR-0009).

---

## License

MIT
