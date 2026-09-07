---
type: docs
title: "typescript-ai-harness"
description: "Project README — what the harness installs, how to run the CLI, and how the Integrations and governance fit together."
---

# typescript-ai-harness

An interactive CLI that installs and updates a standard dev-tooling **harness** in
any Node/TypeScript project — so you stop re-deriving the same boilerplate by hand.

One command stands up [archgate](https://www.npmjs.com/package/archgate), ESLint,
Prettier, Vitest, Knip, Husky, and a Trivy CI scan, wires the `verify` scripts and git
hooks, and applies everything in a single pass. Re-run it any time to pull the latest version of the
harness — it updates in place without clobbering your project metadata.

- **One command, no install step** — `npx @hancrafted/typescript-ai-harness` pulls one small tarball with zero runtime dependencies.
- **Pick what you want** — a multiselect of seven integrations, each with its own sub-options.
- **Safe to re-run** — tool-owned configs are refreshed; your `package.json` is surgically merged, never overwritten.
- **Preview first** — `--dry-run` prints the full plan and touches nothing.
- **Scriptable** — `--yes` skips every prompt and applies the full harness with defaults.

---

## Requirements

- **Node.js** 24+ and **npm** (the tool assumes npm for installs and hooks).
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

You'll get a multiselect with **all seven preselected**. Press <kbd>Enter</kbd> to take
the full harness, or use the arrow keys + <kbd>Space</kbd> to deselect any you don't want:

| Integration | What it sets up |
| --- | --- |
| **archgate** — deterministic ADR governance | Runs `archgate init` to scaffold `.archgate/` governance |
| **eslint** — linting | A generic two-tier `eslint.config.mjs` (ESM) |
| **prettier** — formatting | An opinionated `.prettierrc.json` + `.prettierignore` |
| **vitest** — testing | A minimal `vitest.config.ts` (v8 coverage available) |
| **knip** — unused files, deps & exports | A `knip.json` + the `knip` script, joined into `verify` |
| **husky** — git hooks + commit verification | Git hooks + the `verify` / `verify:commit` scripts |
| **trivy** — vulnerability scanning (CI) | A `.github/workflows/security.yml` Trivy scan (PR + weekly) |

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
| `.archgate/*` | **Overwritten** with the Core governance bundle (see below); `.archgate/config.json` written **only if absent** |

### Scripts added to `package.json`

Only the scripts for the integrations you selected are added, and `verify` / `verify:commit`
are composed from exactly those integrations:

| Script | Provided by | Command |
| --- | --- | --- |
| `test` | vitest | `vitest run` |
| `test:watch` | vitest | `vitest watch` |
| `format` | prettier | `prettier --write .` |
| `format:check` | prettier | `prettier --check .` |
| `knip` | knip | `knip` |
| `verify` | husky | full-repo checks, no mutation (see below) |
| `verify:commit` | husky | staged autofix + full-repo correctness (see below) |
| `prepare` | husky | `husky` (wires hooks on install) |

### Commit verification model

Clean git history is treated as project memory, so **every commit must be provably green** —
enforced deterministically in the hook, not by soft instruction:

- **`verify`** (run on **pre-push**, and while you work) — full-repo checks, no mutation:
  `archgate check && eslint . && prettier --check . && tsc --noEmit && vitest run && knip`
  *(only the steps for your selected integrations; `tsc --noEmit` always runs).*
- **`verify:commit`** (run on **pre-commit**) — autofix only the **staged** files via
  lint-staged, then run **full-repo** correctness:
  `lint-staged && archgate check && tsc --noEmit && vitest run`.

**trivy** stays out of `verify`: it's a standalone binary (no npm install), so it ships as a
CI-only `.github/workflows/security.yml` scan rather than a local script.

Formatting/autofix is scoped to staged files (fast); correctness always runs on the whole
repo (so a staged change can never commit a red tree).

---

## Notes & current limitations

- **Distribution.** Published to npm as `@hancrafted/typescript-ai-harness` — a single
  bundled file with **zero runtime dependencies**. Contributors still run the source
  directly through [tsx](https://www.npmjs.com/package/tsx) via the git-spec dev inner
  loop; only the _published_ `bin` points at the bundle.
- **npm only.** pnpm / yarn / bun detection is not implemented.
- **Two ADRs are copied** by the archgate integration — the Core governance bundle:
  `GEN-001` (the ADR Contract) and `GEN-002` (the `.claude/rules` symlink channel), each as
  `.md` + `.rules.ts` + `.rules.test.ts`, plus the `@generated` `.archgate/rules.d.ts` so your
  own rule files type-check before the first `archgate check`, and one `.claude/rules/*.md`
  symlink per ADR that loads it into agent context. Frontmatter governance is **not** shipped —
  it moves to [markdown-harness](https://github.com/hancrafted/markdown-harness).
- Deferred: an adaptation skill that fits the generic templates to a project's actual layout,
  and full Keep-a-Changelog commit-body validation.

## Removing withdrawn ADRs

**If you installed this harness at `v0.1.4` or earlier, do this before upgrading.**

That release shipped `GEN-002-harness-config` and `GEN-003-frontmatter`. Both are withdrawn —
frontmatter governance moves to [markdown-harness](https://github.com/hancrafted/markdown-harness).
The CLI has no delete action, so it cannot remove them for you: it only ever writes files.

`GEN-002` is the one that breaks things. The number now belongs to a different ADR
(`GEN-002-adr-symlink-claude-rules`), so upgrading leaves two ADRs claiming id `GEN-002` and
archgate refuses to load the directory at all:

```
error: Duplicate ADR ID: GEN-002
```

`archgate check` then exits non-zero with no output, and your whole gate is dead. Remove the old
files first:

```bash
rm -f .archgate/adrs/GEN-002-harness-config.*
rm -f .archgate/adrs/GEN-003-frontmatter.*
rm -f .claude/rules/gen-002-harness-config.md .claude/rules/gen-003-frontmatter.md
rm -f .archgate/harness-config-core.d.ts .archgate/harness-config-extension.d.ts
rm -f .archgate/harness-config-fixtures.ts .archgate/frontmatter-config.md
rm -f .typescript-ai-harness.json
```

Then re-run the harness and `archgate check`. Keep `.typescript-ai-harness.json` only if you
have your own reader for it; nothing the harness ships reads it any more.

---

## Development

This repo **self-hosts** — it installs and updates its own harness, so the tool is
continuously exercised against a real project (itself).

```bash
npm install        # install the harness devDependencies
npm run verify     # prettier --check . && eslint . && tsc --noEmit && vitest run && knip && archgate check
npm test           # vitest run
npm run format     # prettier --write .
npm run knip       # unused files / deps / exports (also shipped to targets as the knip integration)
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
    registry.ts               # explicit static array of the seven integrations
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

### CI/CD pipeline

Three GitHub Actions workflows split CI **one concern per file** (ADR-0009), each with its
own trigger and its own least-privilege token:

| Workflow | Concern | Runs on | What it does |
| --- | --- | --- | --- |
| **`ci.yml`** | Correctness | push to `main` · every PR | `verify` as one **named step per check** (in cheapest-/likeliest-to-fail-first order — `prettier → eslint → tsc → vitest → knip → archgate`), then `build` + `boot-smoke` of the bundle. Node 24 only. |
| **`security.yml`** | Security | every PR · **weekly** (Mon 03:00 UTC) | A **Trivy** filesystem scan — vulnerable deps, leaked secrets, misconfig. Reports all severities, **fails on HIGH/CRITICAL**. No `npm ci`, so it runs in parallel with `verify`. |
| **`publish.yml`** | Release | `v*` git tag | Re-runs `verify` **and** the Trivy gate, then `build` + `npm publish` with provenance. A release is a strict superset of the merge gate. |

The organising rule: **deterministic checks** (`prettier`, `eslint`, `tsc`, `vitest`, `knip`,
`archgate` — same source in, same result out) run on push, PR, and release; the **time-varying
security scan** (its verdict depends on an external CVE feed) concentrates on PRs, at release,
and on a weekly schedule — never on a work-in-progress push, so the inner loop stays fast. The
weekly run still catches a newly-disclosed CVE in an otherwise-unchanged dependency when nobody
is pushing. Feature branches with no open PR get no CI by design — open the PR to get the gate.

> The build/publish plumbing is repo-local release tooling and is **not** shipped into target
> projects (ADR-0003). Targets receive the harness, not these workflows.

### Releasing

Releases are cut manually — bump, tag, push. The tag is what triggers `publish.yml` (above). To
release:

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
