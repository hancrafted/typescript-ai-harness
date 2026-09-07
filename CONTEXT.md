---
type: context
title: "Project context"
description: "Ubiquitous language and ADR/frontmatter governance vocabulary for the AI harness — the domain terms and governance concepts this repo speaks in."
---

# AI Harness Setup

An interactive CLI that installs and configures external dependencies as a standard dev-tooling **harness** for agentic engineering environments, so each new Node/TypeScript project doesn't re-derive the same boilerplate.

## Language

**Harness**:
The full set of Integrations installed into a target project — the external dev-tooling dependencies plus the scripts and config that wire them together for an agentic engineering workflow.
_Avoid_: setup, boilerplate, toolkit

**Integration**:
A self-contained module that installs and configures one harness capability — wrapping one or more Dependencies, its config template(s), its sub-options, and its `package.json` patch. The seven current Integrations: archgate, eslint, prettier, vitest, knip, husky, trivy. Most wrap a Dependency; trivy is the exception — a standalone binary shipped purely as a `.github/workflows/security.yml` CI scan, with no npm Dependency.
_Avoid_: feature, tool, plugin

**Dependency**:
A raw external npm package the tool installs (e.g. `eslint`, `archgate`, `lint-staged`, `tsx`). One Integration may pull several.
_Avoid_: library (when precision between the package and the Integration matters)

**sub-option**:
A nested choice within an Integration (e.g. eslint's clean-code rules, husky's hooks). The extension point where Integrations grow over time.
_Avoid_: option (reserved for `@clack/prompts` list items), flag

**Target project**:
The external project the harness is installed into. Distinct from this tool's own repo (which self-applies the harness — see ADR-0003).
_Avoid_: destination, consumer, client

**Tool-owned config file**:
A config file the tool writes and fully overwrites on re-run (`eslint.config.mjs`, the prettier config, `vitest.config.ts`, `.husky/*`). Contrast with `package.json` (surgically merged, never overwritten) and a Seeded config file (written once, never clobbered).
_Avoid_: generated file, output file

**Seeded config file**:
A config file the tool writes only when absent and never overwrites on re-run, because the Target project grows it after scaffolding (`tsconfig.json`, `.archgate/config.json`, `.claude/settings.local.json`). Distinct from a Tool-owned config file, which is regenerated every run.
_Avoid_: template, default, starter file

## ADR governance

**ADR Contract**:
The self-hosted ADR (`GEN-001-adr`) that governs the shape of every ADR under `.archgate/adrs/` — the ADR *about* ADRs. It owns the frontmatter bundle, the six canonical sections, the numbering grammar, the size budget, and the companion rules-file duties. Self-hosting means its own rules validate its own file. Runtime delivery is not its business — that is the Claude Code rules symlink, owned by `GEN-002-adr-symlink-claude-rules`. Distinct from an individual design/decision ADR, which it governs.
_Avoid_: meta-ADR, ADR spec

**Claude Code rules symlink**:
The runtime enforcement layer that puts a governing ADR into an agent's context *during* a session, not only at commit — a symlink from `.claude/rules/` to the ADR, scoped by the ADR's `paths:`. It is *soft* (context plus instruction); archgate at commit/push is the hard backstop. Owned by `GEN-002-adr-symlink-claude-rules`.
_Avoid_: Runtime loading channel (retired name), rule injection, context loader

**files (ADR field)**:
The glob set archgate inspects when it runs an ADR's rules — the *check* channel. It bounds which changed files the rules judge; omitting it widens the check to every project file. Required on every ADR, and inline YAML flow form only.
_Avoid_: scope globs, include patterns

**paths (ADR field)**:
The glob set that steers the author — the *steer* channel. It documents the ADR's governance surface and triggers Claude Code to load the ADR when a matching file is Read. Optional, and free to differ from `files`: check broad, steer narrow.
_Avoid_: scope globs

**Design ADR**:
A prose decision record under `docs/adr/` (`type: design-adr`) authored via the Matt-Pocock `/domain-modeling` skill — the lightweight *why*. Distinct from a Governance ADR; the two coexist and are disambiguated by `type`, never by prose.
_Avoid_: ADR (ambiguous — always qualify design vs governance)

**Governance ADR**:
An archgate ADR under `.archgate/adrs/` (`type: adr`) with an executable `*.rules.ts` companion — the deterministic enforcement layer, governed by the ADR Contract (`GEN-001-adr`). Distinct from a Design ADR.
_Avoid_: meta-ADR; bare "ADR" (ambiguous — always qualify)

**Core governance bundle** ("core"):
The foundational Governance ADR set the harness ships, installed *intrinsically* by the archgate Integration with no sub-option prompt. Membership is the explicit `ADR_CORE` list in the Harness build config — `GEN-001` and `GEN-002` today; the `GEN-001`–`GEN-009` range is reserved for foundational governance. A **Tool-owned** set: every file is fully overwritten on each run (each ADR's `.md` + `.rules.ts` + `.rules.test.ts`, plus the supporting `rules.d.ts` and `.claude/rules` symlinks). No config rides along: the bundle ships governance only. A future sub-option list holds *optional* bundles; core is never in it.
_Avoid_: core ADRs (ambiguous), foundational pack, general governance

**Harness build config** (`harness.config.json`):
The root, Tool-owned build-metadata file naming what the harness ships — `ADR_CORE` (the Core governance bundle's ADR ids), the curated supporting-files list, and the `ARCHGATE_VERSION` range. Read by the release-time capture step and by the CLI on self-apply; **never shipped to a Target** (the Target receives the materialised Bundle asset, not this file). Distinct from archgate's own `.archgate/config.json`. It is now the only harness-owned config file — the target-facing `.typescript-ai-harness.json` is deleted.
_Avoid_: manifest (retired), harness config (retired — the target-facing runtime file is gone)

**Bundle asset** ("capture"):
The committed, derived copy of the Core governance bundle that travels with the CLI, captured from the canonical `.archgate/adrs/` (+ supporting) files by the release-time capture step. The CLI writes it into a Target's `.archgate/**` with overwrite (Tool-owned) and mints the `.claude/rules/` symlinks. Never hand-edited — the capture is scripted and CI-gated, so it cannot drift from the canonical source. On self-apply the asset equals its source, so writing is a byte-identical no-op — the dogfood proof that the update mechanism works.
_Avoid_: template (reserved for the string-template model), snapshot (reserved for archgate's config/settings capture, ADR-0005)

## Frontmatter governance

> **Withdrawn.** `GEN-002-harness-config` and `GEN-003-frontmatter` are deleted, and the
> `.typescript-ai-harness.json` config, its two ambient-types files, the shared fixtures and
> `frontmatter-config.md` went with them. Frontmatter governance moves to
> [`markdown-harness`](https://github.com/hancrafted/markdown-harness), which owns the vocabulary
> that used to live here — the frontmatter floor, pathRules entries, the Spine, FileSets, Config
> blocks and their extension fences, the `rule` payload and field policies. Re-import the terms
> this repo actually needs once that harness ships; until then this context has no frontmatter
> vocabulary, deliberately.

## CI/CD

**Stage**:
A trigger-tier at which CI checks run: **push** (to `main`), **PR**, **release** (a `v*` tag), or **scheduled** (weekly). Which checks run at which stage is set by concern — deterministic checks on push/PR/release, the security scan on PR/release/scheduled. Owned by the three workflows (ADR-0009): `ci.yml`, `security.yml`, `publish.yml`.
_Avoid_: phase, environment, gate (a gate is what blocks; a Stage is when it runs)

**Deterministic check**:
A verify-tier check whose result depends only on the committed source — `prettier`, `eslint`, `tsc`, `vitest`, `knip`, `archgate`. Same input, same result, so it runs on every push, PR, and release, each as its own named `ci.yml` step (and re-run by `publish.yml`). Contrast with a Security scan, whose result varies with the outside world.
_Avoid_: unit test (narrower), lint (only part of the set), verify step (the CI framing is "check")

**Security scan**:
A time-varying check whose verdict depends on the outside world — a CVE feed, secret patterns — as much as on the source: **Trivy** (vulnerable deps, leaked secrets, misconfig). The same commit can pass today and fail tomorrow, so it concentrates on PRs, at release, and on a weekly schedule rather than every push, and it fails only on HIGH/CRITICAL. Owned by `security.yml` and re-run by `publish.yml` at release. Contrast with a Deterministic check.
_Avoid_: audit, vulnerability check (Trivy also scans secrets + misconfig), lint

## Evals

**Eval harness layer**:
The capability that measures whether Context artifacts do their job — steering LLMs as intended — rather than merely conforming in shape. Run locally on this repo first (starting with the Governance ADRs), and destined to become an Integration promoted through the CLI. Complements archgate: linting checks an artifact's *shape*, evals exercise its *behaviour* (does a model comply; is the artifact clear) — which linting cannot see.
_Avoid_: eval integration (premature — not yet an Integration), test suite, LLM tests

**Context artifact**:
An LLM-consumed, low-churn, authored-to-steer markdown file — a Governance ADR, a skill, or AGENTS.md (more to come). Three defining traits: consumed as model context, written to steer model behaviour, and changed only to correct drift or track a model change (not per-feature). The class the Eval harness layer targets.
_Avoid_: prompt, doc, governed file (broader — not limited to markdown)
