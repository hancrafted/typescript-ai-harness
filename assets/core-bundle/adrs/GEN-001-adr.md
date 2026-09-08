---
type: adr
id: GEN-001
title: 'ADR Contract'
domain: general
rules: true
files: ['.archgate/adrs/**/*.{md,ts}']
paths: ['.archgate/adrs/**/*.{md,ts}']
description: 'The shape contract every ADR under .archgate/adrs/ obeys: frontmatter bundle and order, six canonical sections, authoring discipline, a size budget, and companion rules-file duties.'
---

# ADR Contract

## Context

An ADR records an **ADR Discipline**: one universal constraint on how code is written, at an altitude no future feature can invalidate. An **ADR rule** is the mechanical check a Discipline earns in a companion `.rules.ts`; a Discipline may have none. Feature- and contract-shaped reasoning belongs in a design-ADR — if the next feature could make the record wrong, the altitude is wrong.

This ADR pins the shape every other ADR relies on. `archgate check --strict` gates it at commit and push.

## Decision

### 1. Scope and directory layout

1. `.archgate/adrs/` MUST stay flat: top-level `<PREFIX>-<NNN>-<slug>` `.md`, `.rules.ts`, or `.rules.test.ts`, with rules files backed by an `.md`. (📜 Rule: `adr-governed-files`)

### 2. Frontmatter contract (📜 Rule: `adr-frontmatter`)

1. Frontmatter MUST lead with `type: adr`, declaring non-empty `id` (matching filename prefix), `title`, registered `domain`, `rules` (true iff sibling `.rules.ts` exists), `files`, `description`, and optional `paths`.
2. `paths:` MAY differ from `files:`: `files:` inspects, `paths:` steers the author.
3. Both globs MUST be inline YAML flow lists — `['glob']`. (📜 Rule: `adr-glob-inline`)

### 3. Required sections (📜 Rule: `adr-required-sections`)

1. Every ADR MUST carry all six canonical H2 headings: `## Context`, `## Decision`, `## Do's and Don'ts`, `## Consequences`, `## Compliance and Enforcement`, `## References`.

### 4. Size budget (📜 Rule: `adr-size-budget`)

1. An ADR markdown file MUST stay under 12,000 characters.

### 5. Authoring discipline

1. Number Decision anchors `### N.` sequentially from 1, each holding a sequential ordered list. (📜 Rule: `adr-numbered-decision`)
2. Head blocks `### Do's` then `### Don'ts`, each restarting at 1 with bold `**DO**` / `**DON'T**` prefixes. (📜 Rule: `adr-numbered-dos-donts`)
3. Anchor every companion rule twice: in Decision (`📜 Rule: <id>`) and in Do's/Don'ts (`Decision <N>, 📜 Rule: <id>`). (📜 Rule: `adr-rule-mentions`)

### 6. Companion rules-file discipline

1. Every `.rules.ts` MUST have a sibling `.rules.test.ts` covering pass and fail paths. (📜 Rule: `adr-rules-test-sibling`)
2. Every rule report message MUST embed `(<ID> [<rule-key>])`. (📜 Rule: `adr-message-provenance`)

### 7. Enforcement tier

1. Every rule MUST run at `error` tier. (📜 Rule: `adr-error-tier`)

## Do's and Don'ts

### Do's

1. **DO** open every ADR frontmatter with `type: adr`, declaring required keys with `id` matching the filename. (Decision 2, 📜 Rule: `adr-frontmatter`)
2. **DO** write `files:` and `paths:` as inline flow lists, each scoped for its own channel. (Decision 2, 📜 Rule: `adr-glob-inline`)
3. **DO** emit all six canonical H2 sections; empty bodies pass the linter but not review. (Decision 3, 📜 Rule: `adr-required-sections`)
4. **DO** keep every ADR markdown file under the character budget, this one included. (Decision 4, 📜 Rule: `adr-size-budget`)
5. **DO** number Decision anchors `### N.` from 1, with sequential ordered items inside each. (Decision 5, 📜 Rule: `adr-numbered-decision`)
6. **DO** head the blocks `### Do's` then `### Don'ts`, each restarting at 1 with its bold prefix. (Decision 5, 📜 Rule: `adr-numbered-dos-donts`)
7. **DO** anchor every companion rule to prose on both sides. (Decision 5, 📜 Rule: `adr-rule-mentions`)
8. **DO** give every `.rules.ts` a sibling `.rules.test.ts` exercising each rule's pass and fail path. (Decision 6, 📜 Rule: `adr-rules-test-sibling`)
9. **DO** embed `(<ID> [<rule-key>])` in every report message. (Decision 6, 📜 Rule: `adr-message-provenance`)
10. **DO** run every companion rule at the `error` tier. (Decision 7, 📜 Rule: `adr-error-tier`)

### Don'ts

1. **DON'T** omit `files:` — archgate then widens the check to every project file. (Decision 2)
2. **DON'T** park stray files, subdirectories, or ADR-less rules files under `.archgate/adrs/`. (Decision 1, 📜 Rule: `adr-governed-files`)
3. **DON'T** exempt an ADR from the size budget or widen this contract beyond `.archgate/adrs/`. (Decision 4)
4. **DON'T** flip the enforcement tier or add rules outside an explicit ADR amendment. (Decision 7)

## Consequences

**Positive:**

1. **Fork-proof shape:** the frontmatter bundle, six sections and numbering are machine-held, not habit-held.
2. **Scoped checks:** `files:` keeps an ADR's rules off changes they have no business judging.
3. **Bounded context cost:** the budget caps what any one ADR adds to a matching Read.
4. **Dogfooded:** GEN-001's rules validate its own bundle on every `archgate check`.
5. **Rule ↔ prose traceability:** markers are checked both directions — no unmentioned rule, no marker naming a rule that does not exist.

**Negative:**

1. **Name-level pairing only:** markers pair names, not meanings. A marked sentence that outruns its rule reads as compliant, so alignment is a review duty.
2. **Regex meta-parsing:** the meta-rules parse YAML and TypeScript with regexes, making quoted kebab-case rule keys and inline flow globs load-bearing. AST hardening: [#7](https://github.com/hancrafted/typescript-ai-harness/issues/7).
3. **Authoring ceremony:** numbered anchors, subsection headings, twin markers, a sibling rules-test and provenance tags cost more than plain prose. Mitigated: `archgate:adr-author` encodes the shape and each message names its fix.
4. **The budget forces splits:** a Discipline set outgrowing the cap must split by glob, buying a frontmatter block and six sections per new ADR.

**Risks:**

1. **Two budgets disagree:** archgate's briefing budget caps `Decision` and `Do's and Don'ts` far below the whole-file cap, so a file under budget can still overflow a briefing. **Mitigation:** `archgate check` reports both figures every run; `--strict` promotes briefing overflow to a failure if adopted.
2. **Vendor drift:** the cap tracks one vendor's published limit, on no measured evidence. **Mitigation:** re-measure against Claude Code `InstructionsLoaded` output and amend this ADR rather than the rule alone.

## Compliance and Enforcement

**Enforcer per Discipline:** `GEN-001-adr.rules.ts` holds every Discipline above at the `error` tier (§7), scoped by `files:` to ADR bundle files, and is the source-of-truth for the full set. `.archgate/**` sits outside this repo's eslint and `tsc --noEmit` gates until a dedicated script ADR governs rules-file authoring ([#9](https://github.com/hancrafted/typescript-ai-harness/issues/9)), so every rules file is self-contained; prettier and vitest cover `.archgate/**/*.ts`, and `archgate check` is the sole gate on ADR markdown.

**Second budget channel:** `archgate check` reports a per-section briefing budget over `Decision` and `Do's and Don'ts`, stricter than §4's whole-file cap and independent of it. `archgate check --strict` promotes those warnings to failures — not adopted here, since `--strict` also promotes suppression and unparsed-ADR warnings, a `verify`-pipeline decision of its own.

**Manual review duties** (never linted): each glob describes its channel's real scope; each rule's prose describes what that rule does (§5.3 pairs names, not meanings); section bodies are substantive, not presence-only placeholders; `## Compliance and Enforcement` names a real enforcer and config location; the sibling test covers each rule's pass and fail path (§6.1).

**Exceptions:** raise a separate ADR; human approval required.

## References

- [archgate](https://archgate.dev/) — `files:`, `ctx.scopedFiles`, registered domains, the deterministic rule model.
- [GEN-002](./GEN-002-adr-symlink-claude-rules.md) — the `.claude/rules` runtime channel that carries a scoped ADR into agent context.
- Deferred hardening: [#7 AST-harden the meta-parsers](https://github.com/hancrafted/typescript-ai-harness/issues/7), [#8 contract evolution mechanism](https://github.com/hancrafted/typescript-ai-harness/issues/8), [#9 script ADR + toolchain guardrails](https://github.com/hancrafted/typescript-ai-harness/issues/9).
