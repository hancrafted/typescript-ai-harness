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

Archgate ADRs govern this repo's architecture, and this ADR governs all ADRs. It pins the shape uniformity all ADRs rely on — the six sections, the frontmatter keys and their order, the numbered decisions, and the markers that tie each rule back to the decision it enforces.

Since archgate enforces ADRs at commit/push (the hard backstop), Claude Code's `.claude/rules/` feature is used to provide LLMs the right context at "runtime".

Alternatives considered: (1) A generator that copies each ADR body into `.claude/rules/` — rejected for now (a symlink needs no build step and is a pointer, never a stale copy), but kept as the documented escalation path for platforms without ergonomic symlink support (notably Windows).

## Decision

### 1. Scope and self-hosting

1. This contract governs every ADR markdown and rules.ts file under `.archgate/adrs/` whose basename matches `<PREFIX>-<NNN>-<slug>.{md,ts}`.
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

### 4. Claude Code rules symlink (📜 Rule: `adr-claude-rules-symlink`)

1. This symlink is the **runtime enforcement layer**: a soft channel unique to Claude Code that steers the agent as it works, ahead of archgate's hard commit/push backstop (§4.6). An ADR declaring a non-empty `paths:` MUST have a companion **symlink** at `.claude/rules/<basename-lowercased>.md` resolving to it — e.g. `.claude/rules/gen-001-adr.md → ../../.archgate/adrs/GEN-001-adr.md`. Claude Code loads the symlinked ADR into context on Read of any file matching the ADR's `paths:` globs.
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
3. **Scope self-documents:** `paths:` is both the runtime load trigger and the documented governance surface of each ADR. The contract's own lint scope is a separate, fixed set of globs in `GEN-001-adr.rules.ts` — no rule reads `paths:` to scope itself, so keeping the two aligned is a manual review duty.
4. **Dogfooded:** GEN-001's own rules validate its own file and symlink on every `archgate check`.
5. **Rule ↔ prose traceability:** every companion rule is marked on both the Decision and the Do's/Don'ts sides, so no rule enforces something the ADR never states and no stated rule goes unenforced — the correspondence is machine-checked, not trusted.

**Negative:**

1. **Symlink upkeep:** one `.claude/rules` symlink per scoped ADR is extra surface to keep in sync — mitigated: `adr-claude-rules-symlink` fails on drift.
2. **Behavioral dependency with an inverting failure mode:** the symlink-not-copy check rides on archgate's file reader rejecting symlinks — documented in the CLI skill reference, but not a semver-guaranteed contract, and the enforcing binary is a shared global cache (`~/.archgate/bin`), not a per-repo pin. If a future archgate release follows symlinks, the check does **not** degrade gracefully — it inverts: every valid symlink reads as a forbidden copy (an `error` on every scoped ADR, blocking all commits) while orphan detection goes silent at the same time. The rule's unit tests mock the non-following reader, so only a real `archgate check` run surfaces the flip. Recovery: pin or roll back the binary, or amend this rule; then pivot to the copy-body generator fallback (Context, alternative 1).
3. **Silent block-form failure:** a block-style `paths:` parses as empty and drops runtime scope with no lint error (§2.7) — guarded by manual review only, not by a rule.
4. **Authoring ceremony:** nine rules — numbered anchors, twin rule markers, a sibling rules-test, provenance tags — are more to satisfy per ADR than plain prose. Mitigated: the `adr-author` skill encodes the shape, this ADR auto-loads into context via its `.claude/rules` symlink whenever an ADR file is opened, and each rule's message names the exact fix.
5. **Target correctness unverified:** the symlink rule proves *a symlink exists at the expected name*, not that it resolves to its own ADR — a link pointing at the wrong file, or left dangling by a target move, passes and silently loads wrong (or no) runtime context. The rule API cannot inspect link targets (no lstat/readlink); alignment is a manual review duty, and [#9](https://github.com/hancrafted/typescript-ai-harness/issues/9) tracks the upstream ask.

**Risks:**

1. **Platform symlink support:** on Windows, creating symlinks requires Administrator or Developer Mode, and default git (`core.symlinks=false`) checks the existing runtime entries out as plain text files — which read as forbidden copies and fail `archgate check` on a fresh clone. Any Windows contributor to this repo is therefore blocked until symlinks are enabled (Developer Mode + `git config core.symlinks true`, then re-checkout); the future CLI-template phase that ships this contract into arbitrary target projects MUST provide the copy-body generator fallback for such platforms. Documented, not built.
2. **Loader drift:** Claude Code's `.claude/rules` behavior is a versioned feature. Mitigation: the `paths:` + symlink contract is documented and stable; if it regresses, pivot to the generator fallback with zero ADR renames.

## Compliance and Enforcement

Automated: `GEN-001-adr.rules.ts` enforces these nine rules, all at `error` (§7), scoped to ADR basenames under `.archgate/adrs/`; each is marked inline via `📜 Rule:` at its deciding anchor in §2–§6: `adr-frontmatter`, `adr-required-sections`, `adr-claude-rules-symlink`, `adr-numbered-decision`, `adr-numbered-dos-donts`, `adr-rule-mentions`, `adr-no-review-tag`, `adr-rules-test-sibling`, `adr-message-provenance`.

**Manual review duties** (never linted): `paths:` is written inline (§2.7); `paths:` globs actually describe the ADR's real governance surface; each `.claude/rules` symlink resolves to its own ADR (§4.2 — link targets are not machine-checkable); the sibling `.rules.test.ts` exercises each rule's pass and fail path (§6.1); section bodies are substantive, not empty placeholders that pass the presence-only check.

**Toolchain note:** `.archgate/**` is deliberately outside the repo's eslint and `tsc --noEmit` gates until a dedicated script ADR governs rules-file authoring ([#9](https://github.com/hancrafted/typescript-ai-harness/issues/9)); archgate forbids imports from shared folders (e.g. `.archgate/lib`), so every rules file is self-contained. Prettier and vitest do cover `.archgate/**/*.ts`; `archgate check` is the sole gate on the ADR markdown itself.

**Templates/scaffolding:** self-hosting only for now. The future CLI-template phase ships this contract — with the copy-body fallback for symlink-hostile platforms — into target projects; that packaging is out of scope here.

**Exceptions:** raise a separate ADR; human approval required.

## References

- [Claude Code — memory & `.claude/rules` path-scoped rules](https://code.claude.com/docs/en/memory#organize-rules-with-claude/rules/) — the runtime loading mechanism §4 relies on (`paths:` field, glob matching, symlink support).
- [archgate](https://archgate.dev/) — ADR authoring path and the deterministic rule model.
- Deferred hardening from the 2026-07-20 adversarial review: [#7 AST-harden the meta-parsers](https://github.com/hancrafted/typescript-ai-harness/issues/7), [#8 contract evolution mechanism](https://github.com/hancrafted/typescript-ai-harness/issues/8), [#9 script ADR + toolchain guardrails](https://github.com/hancrafted/typescript-ai-harness/issues/9).