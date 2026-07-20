---
type: adr
id: GEN-001
title: "ADR Contract"
domain: general
rules: true
paths: [".archgate/adrs/**/*.{md,ts}"]
description: "The shape and runtime-loading contract every ADR under .archgate/adrs/ obeys: frontmatter bundle and order, six canonical sections, and a .claude/rules symlink that loads the ADR into agent context on Read."
---

# ADR Contract

## Context

Archgate ADRs govern this repo's architecture and this ADRs governs all ARDs. Shape uniformity — the six sections, the frontmatter keys and their order, the numbered decisions, and the markers that tie each rule back to the decision it enforces.

Since archgate enforces ADRs at commit/push (the hard backstop), Claude Code's `.claude/rules/` feature is used to provide LLMs the right context at "runtime".

Alternatives considered: (1) A generator that copies each ADR body into `.claude/rules/` — rejected for now (a symlink needs no build step and is a pointer, never a stale copy), but kept as the documented escalation path for platforms without ergonomic symlink support (notably Windows).

## Decision

### 1. Scope and self-hosting

1. This contract governs every ADR markdown and rule.ts file under `.archgate/adrs/` whose basename matches `<PREFIX>-<NNN>-<slug>.{md,ts}`.
2. GEN-001 is self-hosting: its own file and companion `.rules.ts` satisfy every rule below, and its `paths:` spans the whole bundle (`.md`, `.rules.ts`, tests), so the contract loads whichever piece an agent opens.
3. Universal frontmatter (the cross-file semantics of `type`) and cross-harness INDEX routing are explicitly out of scope — owned by `GEN-002-frontmatter` and a future index ADR respectively.

### 2. Frontmatter contract (📜 Rule: `adr-frontmatter`)

1. Keys `type`, `id`, `title`, `domain`, `rules` MUST be present and non-empty; `paths` is optional.
2. Field order MUST be exactly `type → id → title → domain → rules → paths`. `type` leads because it is a universal field GEN-002 will own; additional keys (e.g. `description`) MAY follow `paths`.
3. `type` MUST be `adr`.
4. `id` MUST match the filename prefix (`GEN-001-adr.md` carries `id: GEN-001`).
5. `domain` MUST be a registered archgate domain (built-in or `.archgate/config.json` custom).
6. `rules: true` MUST have a sibling `<basename>.rules.ts`, and an existing sibling `.rules.ts` MUST have `rules: true` — both directions.
7. `paths`, when present, MUST be written inline (YAML flow form) — e.g. `paths: [".archgate/adrs/**/*.{md,ts}"]`. A block-style list parses as empty, and §4.3 then bans the symlink: runtime scope silently degrades to nothing. Unlinted — a manual review duty.

### 3. Required sections (📜 Rule: `adr-required-sections`)

Every ADR MUST carry all six canonical H2 headings (exact text, presence-only): `## Context`, `## Decision`, `## Do's and Don'ts`, `## Consequences`, `## Compliance and Enforcement`, `## References`. Additional sections are permitted.

### 4. Runtime loading channel (📜 Rule: `adr-claude-rules-symlink`)

1. An ADR declaring a non-empty `paths:` MUST have a companion **symlink** at `.claude/rules/<basename-lowercased>.md` resolving to it — e.g. `.claude/rules/gen-001-adr.md → ../../.archgate/adrs/GEN-001-adr.md`. Claude Code loads the symlinked ADR into context on Read of any file matching the ADR's `paths:` globs.
2. The runtime entry MUST be a symlink (a pointer), never a copied body. archgate enforces this without special APIs: its file reader does not follow symlinks, so a `.claude/rules` ADR entry it *can* open is a copy and fails the rule; one it cannot open is a genuine symlink and passes.
3. An ADR with empty or absent `paths:` MUST NOT have such a symlink — it governs nothing at runtime.
4. Every ADR-named symlink under `.claude/rules/` (basename `<prefix>-<nnn>-<slug>.md`) MUST have a backing ADR with a non-empty `paths:`; orphaned symlinks are a violation. Hand-written, non-ADR-named rule files are left untouched.
5. `paths:` is the single source of scope: it both documents the ADR's governance surface and triggers Claude Code loading. "Always-on" is expressed as `paths: ["**/*"]` (a glob that matches every Read); the no-`paths` launch-load mode Claude Code also offers is deliberately unused, so every symlinked ADR declares its scope.
6. The channel is soft: a missing symlink degrades runtime hinting but does not gate the build beyond this rule; archgate at commit/push stays authoritative.

### 5. Authoring discipline — the ADR's shape grammar

1. Decision anchors are numbered `### N.` sequential from 1 (or a single top-level ordered list when an ADR uses no anchors); the first-level items inside each anchor form a sequential ordered list, never loose bullets. (📜 Rule: `adr-numbered-decision`)
2. The Do's and the Don'ts are each written as an ordered list restarting at 1, every item keeping its bold `**DO**` / `**DON'T**` prefix. (📜 Rule: `adr-numbered-dos-donts`)
3. Every rule in a companion `.rules.ts` is anchored to prose twice — a Decision-side marker on the anchor that decides it, and a back-referencing Do's/Don'ts marker naming that anchor — so no rule enforces something the prose never states, and no stated rule goes unenforced. (📜 Rule: `adr-rule-mentions`)
4. The retired `[review]` tag MUST NOT appear in an ADR outside code spans; a review obligation is written into the Manual review duties instead. (📜 Rule: `adr-no-review-tag`)

### 6. Companion rules-file discipline

1. Every `<ID>-<slug>.rules.ts` has a sibling `<ID>-<slug>.rules.test.ts`; archgate requires the file to exist, and review requires it to cover each rule's pass and fail path. (📜 Rule: `adr-rules-test-sibling`)
2. Every rule embeds the provenance tag `(<ID> [<rule-key>])` in each of its report messages, so a failing check names the ADR and the rule that raised it. (📜 Rule: `adr-message-provenance`)

### 7. Enforcement tier

1. All rules run at `error`.

## Do's and Don'ts

1. **DO** open every ADR with frontmatter in the order `type → id → title → domain → rules → paths`, `type: adr`, `id` matching the filename. (Decision 2, 📜 Rule: `adr-frontmatter`)
2. **DO** emit all six canonical H2 sections; presence-only, empty bodies pass the linter but not review. (Decision 3, 📜 Rule: `adr-required-sections`)
3. **DO** give every ADR that declares a non-empty `paths:` a `.claude/rules/<basename-lowercased>.md` symlink pointing back to it. (Decision 4, 📜 Rule: `adr-claude-rules-symlink`)
4. **DO** express always-on scope as `paths: ["**/*"]` rather than omitting `paths`.
5. **DO** keep the runtime entry a symlink (a pointer), never a copied body.
6. **DO** number Decision anchors `### N.` from 1 and keep each anchor's first-level items a sequential ordered list. (Decision 5, 📜 Rule: `adr-numbered-decision`)
7. **DO** write the Do's and the Don'ts each as an ordered list restarting at 1, every item keeping its `**DO**` / `**DON'T**` prefix. (Decision 5, 📜 Rule: `adr-numbered-dos-donts`)
8. **DO** anchor every companion rule to prose on both sides — a Decision-side marker on the deciding anchor and a back-referencing Do's/Don'ts marker naming that anchor. (Decision 5, 📜 Rule: `adr-rule-mentions`)
9. **DO** give every `.rules.ts` a sibling `.rules.test.ts` that exercises each rule's pass and fail path. (Decision 6, 📜 Rule: `adr-rules-test-sibling`)
10. **DO** embed the provenance tag `(<ID> [<rule-key>])` in every rule's report messages. (Decision 6, 📜 Rule: `adr-message-provenance`)

1. **DON'T** widen this contract's scope beyond `.archgate/adrs/` — universal frontmatter is GEN-002's, INDEX routing is the index ADR's.
2. **DON'T** leave a `.claude/rules` ADR entry behind when its backing ADR is deleted or drops its `paths:` — remove the symlink in the same change.
3. **DON'T** flip the enforcement tier or add new rules outside an explicit ADR amendment.
4. **DON'T** author `paths:` as a YAML block-style list — inline flow form only (§2.7).
5. **DON'T** attach a `.claude/rules` symlink to an ADR whose `paths:` is empty or absent — an ADR that governs nothing at runtime carries no runtime entry.
6. **DON'T** let the retired `[review]` tag resurface in an ADR — write the obligation into the Manual review duties instead. (Decision 5, 📜 Rule: `adr-no-review-tag`)

## Consequences

**Positive:**

1. **Fork-proof shape:** the six-section, ordered-frontmatter form is machine-held, not convention-held.
2. **Just-in-time governance:** the governing ADR loads into agent context the moment a governed file is opened — compliance happens before the archgate backstop rejects at push.
3. **Single source of scope:** `paths:` drives both the lint-scope documentation and the runtime load trigger, so there is no second list to drift.
4. **Dogfooded:** GEN-001's own rules validate its own file and symlink on every `archgate check`.
5. **Zero build step:** the runtime entry is a pointer, not a generated copy, so it cannot go stale relative to the ADR body.
6. **Rule ↔ prose traceability:** every companion rule is marked on both the Decision and the Do's/Don'ts sides, so no rule enforces something the ADR never states and no stated rule goes unenforced — the correspondence is machine-checked, not trusted.

**Negative:**

1. **Symlink upkeep:** one `.claude/rules` symlink per scoped ADR is extra surface to keep in sync — mitigated: `adr-claude-rules-symlink` fails on drift.
2. **Undocumented dependency:** the symlink-not-copy check rides on archgate's file reader not following symlinks — observed behavior, not an API guarantee. If a future archgate release follows symlinks, copy-detection weakens to existence-only (it still catches missing and orphaned entries).
3. **Silent block-form failure:** a block-style `paths:` parses as empty and drops runtime scope with no lint error (§2.7) — guarded by manual review only, not by a rule.
4. **Authoring ceremony:** nine rules — numbered anchors, twin rule markers, a sibling rules-test, provenance tags — are more to satisfy per ADR than plain prose. Mitigated: the `adr-author` skill encodes the shape, this ADR auto-loads into context via its `.claude/rules` symlink whenever an ADR file is opened, and each rule's message names the exact fix.

**Risks:**

1. **Platform symlink support:** Windows requires Administrator or Developer Mode for symlinks. This repo (self-hosting, macOS/Linux) is unaffected, but the future CLI-template phase that ships this contract into arbitrary target projects MUST provide the copy-body generator fallback for such platforms. Documented, not built.
2. **Loader drift:** Claude Code's `.claude/rules` behavior is a versioned feature. Mitigation: the `paths:` + symlink contract is documented and stable; if it regresses, pivot to the generator fallback with zero ADR renames.

## Compliance and Enforcement

Enforced by companion `GEN-001-adr.rules.ts`, scoped to ADR basenames under `.archgate/adrs/`:

- `adr-frontmatter` (error) — §2.1–2.6: keys present, order, `type: adr`, id/filename match, domain registered, `rules` ⇔ sibling.
- `adr-required-sections` (error) — §3 six canonical headings.
- `adr-claude-rules-symlink` (error) — §4 symlink presence and symlink-not-copy, plus the no-`paths` and orphan directions.
- `adr-numbered-decision` (error) — §5.1: numbered `### N.` Decision anchors and sequential per-anchor ordered lists.
- `adr-numbered-dos-donts` (error) — §5.2: the Do's and the Don'ts each a sequential ordered list restarting at 1.
- `adr-rule-mentions` (error) — §5.3: every rule marked on the Decision and Do's/Don'ts sides, back-references aligned.
- `adr-no-review-tag` (error) — §5.4: no retired `[review]` tag outside code spans.
- `adr-rules-test-sibling` (error) — §6.1: every `.rules.ts` has a sibling `.rules.test.ts`.
- `adr-message-provenance` (error) — §6.2: every rule embeds its `(<ID> [<rule-key>])` provenance tag.

**Manual review duties** (never linted): `paths:` is written inline (§2.7); `paths:` globs actually describe the ADR's real governance surface; the sibling `.rules.test.ts` exercises each rule's pass and fail path (§6.1); section bodies are substantive, not empty placeholders that pass the presence-only check.

**Templates/scaffolding:** self-hosting only for now. The future CLI-template phase ships this contract — with the copy-body fallback for symlink-hostile platforms — into target projects; that packaging is out of scope here.

**Exceptions:** raise a separate ADR; human approval required.

## References

- [Claude Code — memory & `.claude/rules` path-scoped rules](https://code.claude.com/docs/en/memory#organize-rules-with-claude/rules/) — the runtime loading mechanism §4 relies on (`paths:` field, glob matching, symlink support).
- [archgate](https://archgate.dev/) — ADR authoring path and the deterministic rule model.