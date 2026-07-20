---
type: adr
id: GEN-001
title: "ADR Contract"
domain: general
rules: true
paths: [".archgate/adrs/**/*.md"]
description: "The shape and runtime-loading contract every ADR under .archgate/adrs/ obeys: frontmatter bundle and order, six canonical sections, and a .claude/rules symlink that loads the ADR into agent context on Read."
---

# ADR Contract

## Context

ADRs govern this repo's architecture; until now nothing governed the ADRs themselves. Shape uniformity — the six sections, the frontmatter keys and their order — held by convention only, and one drift forks the fleet silently.

There is also a timing gap. archgate enforces ADRs at commit/push (the hard backstop), but nothing puts the *relevant* ADR in front of an agent **during** a session. An agent can burn a whole session building work archgate then rejects at push. Claude Code's `.claude/rules/` feature closes that gap: a path-scoped rule file loads into context on Read of a matching file, and it follows symlinks — so an ADR symlinked into `.claude/rules/` becomes just-in-time governance.

This ADR is the shape contract for ADRs **and** establishes that runtime channel. It is deliberately narrow:

- **Scope is `.archgate/adrs/` only.** The universal frontmatter floor (the repo-wide semantics of the `type` field) is deferred to `GEN-002-frontmatter`. Portable cross-harness routing (an INDEX that maps an edited path to its governing ADR for non-Claude agents) is deferred to a future index ADR plus a companion skill, tracked as a GitHub issue.
- **Runtime enforcement is soft** — context plus instruction. archgate remains the hard backstop.

For typescript-ai-harness — a scaffolder that self-applies its own harness — this contract is authored clean of any workspace-specific coupling and proven on this repo first, because a later phase ships it as a template into target projects. Self-hosting it here is the dogfood that must pass before it travels.

Alternatives considered: (1) prose-convention only, no meta-rules — rejected, conventions drift. (2) A hard `PreToolUse` hook for runtime enforcement — rejected: Claude-only, brittle, and it duplicates archgate. (3) A generator that copies each ADR body into `.claude/rules/` — rejected for now (a symlink needs no build step and is a pointer, never a stale copy), but kept as the documented escalation path for platforms without ergonomic symlink support (notably Windows).

## Decision

### 1. Scope and self-hosting

1. This contract governs every ADR markdown file under `.archgate/adrs/` whose basename matches `<PREFIX>-<NNN>-<slug>.md`.
2. GEN-001 is self-hosting: its own file and companion `.rules.ts` satisfy every rule below.
3. Universal frontmatter (the cross-file semantics of `type`) and cross-harness INDEX routing are explicitly out of scope — owned by `GEN-002-frontmatter` and a future index ADR respectively.

### 2. Frontmatter contract (📜 Rule: `adr-frontmatter`)

1. Keys `type`, `id`, `title`, `domain`, `rules` MUST be present and non-empty; `paths` is optional.
2. Field order MUST be exactly `type → id → title → domain → rules → paths`. `type` leads because it is a universal field GEN-002 will own; additional keys (e.g. `description`) MAY follow `paths`.
3. `type` MUST be `adr`.
4. `id` MUST match the filename prefix (`GEN-001-adr.md` carries `id: GEN-001`).
5. `domain` MUST be a registered archgate domain (built-in or `.archgate/config.json` custom).
6. `rules: true` MUST have a sibling `<basename>.rules.ts`, and an existing sibling `.rules.ts` MUST have `rules: true` — both directions.

### 3. Required sections (📜 Rule: `adr-required-sections`)

Every ADR MUST carry exactly these six H2 headings (exact text, presence-only): `## Context`, `## Decision`, `## Do's and Don'ts`, `## Consequences`, `## Compliance and Enforcement`, `## References`. Additional sections are permitted.

### 4. Runtime loading channel (📜 Rule: `adr-claude-rules-symlink`)

1. An ADR declaring a non-empty `paths:` MUST have a companion **symlink** at `.claude/rules/<basename-lowercased>.md` resolving to it — e.g. `.claude/rules/gen-001-adr.md → ../../.archgate/adrs/GEN-001-adr.md`. Claude Code loads the symlinked ADR into context on Read of any file matching the ADR's `paths:` globs.
2. The runtime entry MUST be a symlink (a pointer), never a copied body. archgate enforces this without special APIs: its file reader does not follow symlinks, so a `.claude/rules` ADR entry it *can* open is a copy and fails the rule; one it cannot open is a genuine symlink and passes.
3. An ADR with empty or absent `paths:` MUST NOT have such a symlink — it governs nothing at runtime.
4. Every ADR-named symlink under `.claude/rules/` (basename `<prefix>-<nnn>-<slug>.md`) MUST have a backing ADR with a non-empty `paths:`; orphaned symlinks are a violation. Hand-written, non-ADR-named rule files are left untouched.
5. `paths:` is the single source of scope: it both documents the ADR's governance surface and triggers Claude Code loading. "Always-on" is expressed as `paths: ["**/*"]` (a glob that matches every Read); the no-`paths` launch-load mode Claude Code also offers is deliberately unused, so every symlinked ADR declares its scope.
6. The channel is soft: a missing symlink degrades runtime hinting but does not gate the build beyond this rule; archgate at commit/push stays authoritative.

### 5. Enforcement tier

1. All three rules run at `error`. This repo has no legacy ADR fleet to migrate, so there is no warning epoch — new and edited ADRs conform fully.
2. Adding the fuller shape ceremony later (numbered-anchor discipline, rule-mention markers, rules-file test and message-provenance duties) is a deliberate ADR amendment, never a silent addition.

## Do's and Don'ts

1. **DO** open every ADR with frontmatter in the order `type → id → title → domain → rules → paths`, `type: adr`, `id` matching the filename.
2. **DO** emit all six canonical H2 sections; presence-only, empty bodies pass the linter but not review.
3. **DO** give every ADR that declares a non-empty `paths:` a `.claude/rules/<basename-lowercased>.md` symlink pointing back to it.
4. **DO** express always-on scope as `paths: ["**/*"]` rather than omitting `paths`.
5. **DO** keep the runtime entry a symlink (a pointer), never a copied body.

1. **DON'T** widen this contract's scope beyond `.archgate/adrs/` — universal frontmatter is GEN-002's, INDEX routing is the index ADR's.
2. **DON'T** leave a `.claude/rules` ADR entry behind when its backing ADR is deleted or drops its `paths:` — remove the symlink in the same change.
3. **DON'T** flip the enforcement tier or add new rules outside an explicit ADR amendment.
4. **DON'T** author `paths:` in YAML block-list form — write it inline (e.g. `paths: [".archgate/adrs/**/*.md"]`). Block form is read as empty, silently dropping the runtime symlink with no violation raised.
5. **DON'T** attach a `.claude/rules` symlink to an ADR whose `paths:` is empty or absent — an ADR that governs nothing at runtime carries no runtime entry.

## Consequences

**Positive:**

1. **Fork-proof shape:** the six-section, ordered-frontmatter form is machine-held, not convention-held.
2. **Just-in-time governance:** the governing ADR loads into agent context the moment a governed file is opened — compliance happens before the archgate backstop rejects at push.
3. **Single source of scope:** `paths:` drives both the lint-scope documentation and the runtime load trigger, so there is no second list to drift.
4. **Dogfooded:** GEN-001's own rules validate its own file and symlink on every `archgate check`.
5. **Zero build step:** the runtime entry is a pointer, not a generated copy, so it cannot go stale relative to the ADR body.

**Negative:**

1. One `.claude/rules` symlink per scoped ADR is extra surface to keep in sync — mitigated: `adr-claude-rules-symlink` fails on drift.
2. The symlink-not-copy check rides on archgate's file reader not following symlinks — a behavioral dependency, not a documented API guarantee. If a future archgate release follows symlinks, copy-detection weakens to existence-only (it still catches missing and orphaned entries).
3. Inline-only `paths:` carries a silent-failure mode: a block-form `paths:` reads as empty, so a scoping slip drops the runtime symlink with no lint error — governance degrades invisibly. Guarded only by the inline convention (DON'T-4) and manual review, not by a rule.

**Risks:**

1. **Platform symlink support.** Windows requires Administrator or Developer Mode for symlinks. This repo (self-hosting, macOS/Linux) is unaffected, but the future CLI-template phase that ships this contract into arbitrary target projects MUST provide the copy-body generator fallback for such platforms. Documented, not built.
2. **Loader drift.** Claude Code's `.claude/rules` behavior is a versioned feature. Mitigation: the `paths:` + symlink contract is documented and stable; if it regresses, pivot to the generator fallback with zero ADR renames.

## Compliance and Enforcement

Enforced by companion `GEN-001-adr.rules.ts`, scoped to ADR basenames under `.archgate/adrs/`:

- `adr-frontmatter` (error) — §2 bundle: keys present, order, `type: adr`, id/filename match, domain registered, `rules` ⇔ sibling.
- `adr-required-sections` (error) — §3 six canonical headings.
- `adr-claude-rules-symlink` (error) — §4 symlink presence and symlink-not-copy, plus the no-`paths` and orphan directions.

**Manual review duties** (never linted): `paths:` globs actually describe the ADR's real governance surface; section bodies are substantive, not empty placeholders that pass the presence-only check.

**Templates/scaffolding:** self-hosting only for now. The future CLI-template phase ships this contract — with the copy-body fallback for symlink-hostile platforms — into target projects; that packaging is out of scope here.

**Exceptions:** raise a separate ADR; human approval required.

## References

- [Claude Code — memory & `.claude/rules` path-scoped rules](https://code.claude.com/docs/en/memory#organize-rules-with-claude/rules/) — the runtime loading mechanism §4 relies on (`paths:` field, glob matching, symlink support).
- [archgate](https://archgate.dev/) — ADR authoring path and the deterministic rule model.
- `CONTEXT.md` — repo glossary (ADR Contract, runtime loading channel, `paths:`, self-hosting).
- `GEN-002-frontmatter` (planned) — the universal frontmatter floor; owns the repo-wide semantics of `type`.
- Future index ADR + skill (planned) — portable cross-harness routing; tracked as a GitHub issue.
