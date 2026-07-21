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
A self-contained module that installs and configures one harness capability — wrapping one or more Dependencies, its config template(s), its sub-options, and its `package.json` patch. The five current Integrations: archgate, eslint, prettier, vitest, husky.
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
The self-hosted ADR (`GEN-001-adr`) that governs the shape and runtime delivery of every ADR under `.archgate/adrs/` — the ADR *about* ADRs. Self-hosting means its own rules validate its own file. Distinct from an individual design/decision ADR, which it governs.
_Avoid_: meta-ADR, ADR spec

**Claude Code rules symlink**:
The runtime enforcement layer that puts a governing ADR into an agent's context *during* a session, not only at commit — a symlink from `.claude/rules/` to the ADR, scoped by the ADR's `paths:`. It is *soft* (context plus instruction); archgate at commit/push is the hard backstop.
_Avoid_: Runtime loading channel (retired name), rule injection, context loader

**paths (ADR field)**:
An ADR's single declared glob scope. It both documents the ADR's governance surface and triggers Claude Code to load the ADR when a matching file is Read. The one source of scope — there is no second list.
_Avoid_: `files` (the retired field name), scope globs

## Frontmatter governance

**Frontmatter floor**:
The minimum YAML frontmatter every *governed* markdown file must carry: `type` + exactly one of `name`/`title` + `description`. A floor, not a ceiling — a Zone may require more, never less. Owned by `GEN-002-frontmatter`.
_Avoid_: frontmatter schema, header, metadata block

**Zone**:
A path-glob region of the repo carrying one frontmatter policy: either *exempt* (no floor) or *governed* (floor required, plus an optional closed `allowedTypes` set). Zones are declared and ordered in the frontmatter config; a file matching no Zone is exempt by default. Posture (allowlist vs denylist) is emergent from which Zones are declared, not a mode flag.
_Avoid_: scope, surface, path rule

**Design ADR**:
A prose decision record under `docs/adr/` (`type: design-adr`) authored via the Matt-Pocock `/domain-modeling` skill — the lightweight *why*. Distinct from a Governance ADR; the two coexist and are disambiguated by `type`, never by prose.
_Avoid_: ADR (ambiguous — always qualify design vs governance)

**Governance ADR**:
An archgate ADR under `.archgate/adrs/` (`type: adr`) with an executable `*.rules.ts` companion — the deterministic enforcement layer, governed by the ADR Contract (`GEN-001-adr`). Distinct from a Design ADR.
_Avoid_: meta-ADR; bare "ADR" (ambiguous — always qualify)
