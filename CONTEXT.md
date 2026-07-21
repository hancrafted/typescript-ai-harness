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
The minimum YAML frontmatter every *governed* markdown file must carry: `type` + exactly one of `name`/`title`. `description` and `tags` are optional, cap-checked keys; a pathRules entry's `rule` payload can make `description` mandatory via `requireDescription`. A floor, not a ceiling — an entry may require more, never less. Owned by `GEN-003-frontmatter`; full config reference in `docs/agents/frontmatter-config.md`.
_Avoid_: frontmatter schema, header, metadata block

**pathRules entry**:
One ordered element of a Config block's `pathRules`, claiming a FileSet of files (`include` minus `exclude`) first-match-wins and carrying one policy: *exempt* (claims and waives the floor) or *governed* (Spine keys plus an optional block-owned `rule` payload). An entry `exclude` does NOT exempt — the file falls through to later entries, then to `unmatched`. Posture (allowlist vs denylist) is emergent from which entries are declared, not a mode flag.
_Avoid_: Zone (retired name), scope, surface

**Harness config**:
The root `.typescript-ai-harness.json` file carrying all harness configuration as data, separate from archgate's own `.archgate/config.json`. A Seeded config file: written once at install, never patched on re-run; format upgrades are an explicit migrate step guarded by the `markdown.version` stamp. Markdown governance lives under the `markdown` namespace as registered Config blocks. The envelope and Spine are owned by `GEN-002-harness-config`; each block's payload by its owning ADR.
_Avoid_: manifest (retired name), frontmatter config file

**Config block**:
One registered key under the harness config's `markdown` namespace (currently only `frontmatter`), owned *wholesale* by a single governance ADR: payload schema, validation, interpretation, and built-in default. GEN-002 keeps the registry closed — an unregistered block name is an error, never a silent fallback.
_Avoid_: section, module, plugin

**Spine**:
The generic, domain-blind grammar every path-scoped Config block satisfies, owned by GEN-002: `pathRules` (FileSet entries with `exempt`/`severity`/`rule`), `unmatched` (`exempt` or `error`), `coverage` (required iff `unmatched: error`), and `settings`. The Spine never inspects inside `rule` or `settings` — those are block-owned payload.
_Avoid_: schema (ambiguous), envelope (that's the file-level contract)

**FileSet**:
The `{include, exclude}` glob pair naming a set of files by arithmetic: `glob(include) − glob(exclude)`. `include` is always a non-empty array. Used by every pathRules entry and by `coverage`; excluding a file from an entry lets it fall through, excluding it from `coverage` removes it from the strict universe.
_Avoid_: match (retired name), glob (the FileSet holds globs; it isn't one)

**rule (pathRules payload)**:
The block-owned policy object inside a governed pathRules entry — for the frontmatter block: `allowedTypes`, `label`, `requireDescription`, and the caps. Opaque to GEN-002's Spine; schema owned by the block ADR (GEN-003). Deliberately overloaded with an archgate *executable rule* (`*.rules.ts`) — qualify as "rule payload" vs "archgate rule" when ambiguity bites.
_Avoid_: policy, options (reserved), config (too broad)

**Design ADR**:
A prose decision record under `docs/adr/` (`type: design-adr`) authored via the Matt-Pocock `/domain-modeling` skill — the lightweight *why*. Distinct from a Governance ADR; the two coexist and are disambiguated by `type`, never by prose.
_Avoid_: ADR (ambiguous — always qualify design vs governance)

**Governance ADR**:
An archgate ADR under `.archgate/adrs/` (`type: adr`) with an executable `*.rules.ts` companion — the deterministic enforcement layer, governed by the ADR Contract (`GEN-001-adr`). Distinct from a Design ADR.
_Avoid_: meta-ADR; bare "ADR" (ambiguous — always qualify)
