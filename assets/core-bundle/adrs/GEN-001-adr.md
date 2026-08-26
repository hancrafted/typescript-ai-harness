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

Archgate ADRs govern this repo's architecture, and this ADR governs all ADRs — it pins the shape every other ADR relies on: the six sections, the frontmatter keys and their order, the numbered decisions, and the markers tying each rule to the decision it enforces.

archgate enforces ADRs at commit and push, the hard backstop. Claude Code's `.claude/rules/` feature carries the same contract earlier — into agent context at authoring time — so a governed file is steered correct before that backstop ever runs.

Rejected alternative: a generator that copies each ADR body into `.claude/rules/`. A symlink needs no build step and never goes stale, so it wins wherever symlinks work; the generator stays the documented escalation path for symlink-hostile platforms (notably Windows).

## Decision

### 1. Scope and self-hosting

1. This contract governs every ADR markdown and `.rules.ts` file under `.archgate/adrs/` whose basename matches `<PREFIX>-<NNN>-<slug>.{md,ts}`.
2. GEN-001 is self-hosting: its own file and companion `.rules.ts` satisfy every rule below, and its `paths:` spans the whole bundle (`.md`, `.rules.ts`, tests), so the contract loads whichever piece an agent opens.
3. Universal frontmatter (the cross-file semantics of `type`) and cross-harness INDEX routing are out of scope — this contract governs only the files under `.archgate/adrs/`.
4. `.archgate/adrs/` is flat and fully governed: every non-hidden file MUST be a top-level `<PREFIX>-<NNN>-<slug>` `.md`, `.rules.ts`, or `.rules.test.ts`, and every rules or test file MUST have its backing `.md`. archgate discovers ADRs by frontmatter, not filename, so a misnamed or nested file may still act as governance while this contract cannot see it, and an ADR-less `.rules.ts` is silently inert. (📜 Rule: `adr-governed-files`)

### 2. Frontmatter contract (📜 Rule: `adr-frontmatter`)

1. Keys `type`, `id`, `title`, `domain`, `rules` MUST be present and non-empty; `paths` is optional.
2. Field order MUST be exactly `type → id → title → domain → rules → paths`; `type` leads so a reader or a cheap scanner can identify the document kind from its first line — recognisability, not a parsing requirement (References). Additional keys (e.g. `description`) MAY follow `paths`.
3. `type` MUST be `adr`.
4. `id` MUST match the filename prefix — `GEN-001-adr.md` carries `id: GEN-001`.
5. `domain` MUST be a registered archgate domain (built-in or `.archgate/config.json` custom).
6. `rules: true` MUST have a sibling `<basename>.rules.ts`, and an existing sibling MUST have `rules: true` — both directions.
7. `paths`, when present, MUST be inline YAML flow form — e.g. `paths: [".archgate/adrs/**/*.{md,ts}"]`. A block-style, bare, or null value parses as empty, and §4.3 then bans the symlink, silently degrading runtime scope to nothing. (📜 Rule: `adr-paths-inline`)

### 3. Required sections (📜 Rule: `adr-required-sections`)

Every ADR MUST carry all six canonical H2 headings — exact text, presence-only, fenced code blocks don't count: `## Context`, `## Decision`, `## Do's and Don'ts`, `## Consequences`, `## Compliance and Enforcement`, `## References`. Additional sections are permitted.

### 4. Claude Code rules symlink (📜 Rule: `adr-claude-rules-symlink`)

1. An ADR declaring a non-empty `paths:` MUST have a companion **symlink** at `.claude/rules/<basename-lowercased>.md` resolving to it — e.g. `.claude/rules/gen-001-adr.md → ../../.archgate/adrs/GEN-001-adr.md`. This is the runtime layer: Claude Code loads the symlinked ADR into context on Read of any file matching the ADR's `paths:`, ahead of archgate's commit/push backstop (§4.6).
2. The runtime entry MUST be a symlink (a pointer), never a copied body that would silently go stale. archgate's file reader resolves a symlink to its target, so a copy and a pointer are indistinguishable to the rule: this item is an authoring and review duty, and what the rule asserts is presence at the expected name plus the absence of orphans (Consequences).
3. An ADR with empty or absent `paths:` MUST NOT have such a symlink — it governs nothing at runtime.
4. Every ADR-named symlink under `.claude/rules/` (basename `<prefix>-<nnn>-<slug>.md`) MUST have a backing ADR with a non-empty `paths:`; orphaned symlinks are a violation. Hand-written, non-ADR-named rule files are left untouched.
5. `paths:` is the single source of scope — it documents the ADR's governance surface and triggers Claude Code loading. Always-on scope is `paths: ["**/*"]` (a glob matching every Read); the no-`paths` launch-load mode is deliberately unused, so every symlinked ADR declares its scope.
6. The channel is soft: a missing symlink degrades runtime hinting but does not gate the build beyond this rule — archgate at commit and push stays authoritative.

### 5. Authoring discipline

An ADR loads into agent context as a `.claude/rules` runtime rule (§4), so every sentence is authoring-steering instruction for whoever opens a file its `paths:` governs — for GEN-001, ADR markdown and companion `.rules.ts`. Items 1–4 are the machine-checked shape grammar; items 5–10 are the prose standard that shape carries. The shape is linted by this ADR's own rules; the prose standard is guidance the `adr-author` skill applies and review upholds — deliberately unlinted, since an LLM writes to it better than a regex checks it.

1. Decision anchors are numbered `### N.` sequential from 1 (or a single top-level ordered list when an ADR uses no anchors); the first-level items inside each anchor form a sequential ordered list, never loose bullets. (📜 Rule: `adr-numbered-decision`)
2. The Do's and the Don'ts sit under exactly one `### Do's` and one `### Don'ts` heading, in that order, each block an ordered list restarting at 1 with every item keeping its bold `**DO**` / `**DON'T**` prefix — the heading break is what makes the restart render; bare adjacent lists merge, numbering the Don'ts on from the Do's. (📜 Rule: `adr-numbered-dos-donts`)
3. Every rule in a companion `.rules.ts` is anchored to prose twice — a Decision-side marker on the anchor that decides it, and a back-referencing Do's/Don'ts marker naming that anchor — so every rule is named where it is decided and where it is obeyed, and no marker names a rule that does not exist. The pairing matches names, never rule bodies: whether the marked sentence describes what the rule does is a review duty, not a checked one. (📜 Rule: `adr-rule-mentions`)
4. The retired `[review]` tag MUST NOT appear in an ADR outside code spans; a review obligation is written into the Manual review duties instead. (📜 Rule: `adr-no-review-tag`)
5. **Root** — every sentence earns its place by steering the reader to write a correct governed file. Per-sentence test: "does this help author the file? If not, cut it or move it to a reference doc." An ADR is runtime instruction, not a design essay.
6. **Altitude** — state the rule and its _architectural_ why; keep implementation detail sparse and cite its source-of-truth (the companion `.rules.ts` and its tests) rather than transcribing constants. Test: "if a constant is renamed, does this sentence go stale? Then it sits too low."
7. **History** — none. Give the architectural why, never the chronology; state a rejected alternative as a live tradeoff, not a past phase. Test: "does this sentence only parse for someone who read the previous version? Then it is changelog — cut it."
8. **Density** — one idea per list item; lead with the point, not the caveat; let inline code name a thing rather than carry the sentence. A runtime rule the agent skims lands each instruction in one read, where a multi-idea item gets half-applied. Soft guidance, not a counted cap.
9. **Machinery** — the required Consequences and Compliance sections stay but lean: record the live tradeoff and the enforcement surface, then point to the reference doc or rules file for the mechanism.
10. **Audience** — pitch each ADR at the authors of the files _its_ `paths:` governs. GEN-001 governs ADR bundles, so it addresses ADR and rules-file authors; an ADR governing only markdown drops rules-file mechanics that never reach its reader.

### 6. Companion rules-file discipline

1. Every `<ID>-<slug>.rules.ts` has a sibling `<ID>-<slug>.rules.test.ts`; archgate requires the file to exist, and review requires it to cover each rule's pass and fail path. (📜 Rule: `adr-rules-test-sibling`)
2. Every rule embeds the provenance tag `(<ID> [<rule-key>])` in each report message, so a failing check names the ADR and the rule that raised it. (📜 Rule: `adr-message-provenance`)

### 7. Enforcement tier

1. All rules run at `error`; a companion rules file MUST NOT declare a warning- or info-tier severity. (📜 Rule: `adr-error-tier`)

## Do's and Don'ts

### Do's

1. **DO** open every ADR with frontmatter in the order `type → id → title → domain → rules → paths`, `type: adr`, `id` matching the filename. (Decision 2, 📜 Rule: `adr-frontmatter`)
2. **DO** emit all six canonical H2 sections; presence-only, empty bodies pass the linter but not review. (Decision 3, 📜 Rule: `adr-required-sections`)
3. **DO** give every ADR that declares a non-empty `paths:` a `.claude/rules/<basename-lowercased>.md` symlink pointing back to it. (Decision 4, 📜 Rule: `adr-claude-rules-symlink`)
4. **DO** express always-on scope as `paths: ["**/*"]` rather than omitting `paths`.
5. **DO** keep the runtime entry a symlink (a pointer), never a copied body — no rule can see the difference, so this one holds only if you hold it. (Decision 4)
6. **DO** number Decision anchors `### N.` from 1 and keep each anchor's first-level items a sequential ordered list. (Decision 5, 📜 Rule: `adr-numbered-decision`)
7. **DO** head the blocks with `### Do's` then `### Don'ts` and write each as an ordered list restarting at 1, every item keeping its `**DO**` / `**DON'T**` prefix. (Decision 5, 📜 Rule: `adr-numbered-dos-donts`)
8. **DO** anchor every companion rule to prose on both sides — a Decision-side marker on the deciding anchor and a back-referencing Do's/Don'ts marker naming that anchor. (Decision 5, 📜 Rule: `adr-rule-mentions`)
9. **DO** give every `.rules.ts` a sibling `.rules.test.ts` that exercises each rule's pass and fail path. (Decision 6, 📜 Rule: `adr-rules-test-sibling`)
10. **DO** embed the provenance tag `(<ID> [<rule-key>])` in every rule's report messages. (Decision 6, 📜 Rule: `adr-message-provenance`)
11. **DO** run every companion rule at the `error` tier — §7 permits no other. (Decision 7, 📜 Rule: `adr-error-tier`)
12. **DO** make every ADR sentence steer the authoring of a governed file; cut or relocate any line that doesn't. (Decision 5)
13. **DO** state each rule's architectural why and cite the companion `.rules.ts` and its tests as the source-of-truth, keeping implementation detail sparse. (Decision 5)
14. **DO** keep one idea per list item, leading with the point. (Decision 5)
15. **DO** keep Consequences and Compliance lean — the live tradeoff and the enforcement surface, with the mechanism left to a reference doc or the rules file. (Decision 5)
16. **DO** pitch each ADR at the authors of the files its `paths:` governs, dropping mechanics that never reach that reader. (Decision 5)

### Don'ts

1. **DON'T** widen this contract's scope beyond `.archgate/adrs/` — universal frontmatter and INDEX routing are out of scope, wherever they are owned.
2. **DON'T** leave a `.claude/rules` ADR entry behind when its backing ADR is deleted or drops its `paths:` — remove the symlink in the same change.
3. **DON'T** flip the enforcement tier or add new rules outside an explicit ADR amendment.
4. **DON'T** author `paths:` as a YAML block-style list — inline flow form only. (Decision 2, 📜 Rule: `adr-paths-inline`)
5. **DON'T** attach a `.claude/rules` symlink to an ADR whose `paths:` is empty or absent — an ADR that governs nothing at runtime carries no runtime entry.
6. **DON'T** let the retired `[review]` tag resurface in an ADR — write the obligation into the Manual review duties instead. (Decision 5, 📜 Rule: `adr-no-review-tag`)
7. **DON'T** park stray files, subdirectories, or ADR-less rules files under `.archgate/adrs/` — what the contract cannot see it cannot govern, and an orphan `.rules.ts` never runs. (Decision 1, 📜 Rule: `adr-governed-files`)
8. **DON'T** narrate an ADR's history — no "previously", no "now that", no phase-by-phase; give the architectural why and state rejected alternatives as live tradeoffs. (Decision 5)
9. **DON'T** transcribe a constant an author would otherwise read from a `.rules.ts` or `.d.ts` — cite the source-of-truth so the prose cannot drift from it. (Decision 5)

## Consequences

**Positive:**

1. **Fork-proof shape:** the six-section, ordered-frontmatter form is machine-held, not convention-held.
2. **Just-in-time governance:** the governing ADR loads into agent context the moment a governed file is opened, so compliance happens before the archgate backstop rejects at push.
3. **Scope self-documents:** `paths:` is both the runtime load trigger and the documented governance surface; the contract's own lint scope is a separate fixed glob set in `GEN-001-adr.rules.ts`, so keeping the two aligned is a manual review duty.
4. **Dogfooded:** GEN-001's own rules validate its file and symlink on every `archgate check`.
5. **Rule ↔ prose traceability:** every rule is marked on both the Decision and Do's/Don'ts sides, and every marker must name a declared rule — checked in both directions, so a rule cannot go unmentioned and a marker cannot name a rule that does not exist. Name-level only: a marked sentence that outruns its rule reads as compliant, so keeping the two aligned is a review duty.

**Negative:**

1. **Symlink upkeep:** one `.claude/rules` symlink per scoped ADR is extra surface to keep in sync — mitigated: `adr-claude-rules-symlink` fails on drift.
2. **Presence, not pointer-ness:** the reader resolves symlinks, so §4.2 is unenforceable and this contract promises only what it can still check — a runtime entry present at the expected name, and no orphan. A copied body is invisible whether or not it has drifted, so the runtime layer can freeze silently while every rule stays green. The stronger alternative is content equality — read the entry through the resolving reader and compare its bytes to the ADR — which catches a drifted copy and an entry resolving outside the project root, at one extra read per ADR, and still cannot catch a fresh byte-identical copy; it is not taken here because the rule set stays presence-only for now. `src/run.test.ts` holds the one real `lstat` check, and it proves the CLI writes symlinks, not that the committed tree still has them. Reader behaviour is not a semver-guaranteed contract, and the binary is a shared global cache (`~/.archgate/bin`) that ignores the declared range, so `ARCHGATE_VERSION` governs cold installs alone.
3. **Regex meta-parsing:** the meta-rules parse YAML and TypeScript with regexes, so quoted kebab-case rule keys and inline `paths:` are load-bearing conventions; AST hardening is tracked in [#7](https://github.com/hancrafted/typescript-ai-harness/issues/7).
4. **Authoring ceremony:** the contract's full rule set — numbered anchors, subsection headings, twin markers, a sibling rules-test, provenance tags — is more to satisfy than plain prose. Mitigated: the `adr-author` skill encodes the shape, this ADR auto-loads on any ADR Read, and each rule's message names the fix.
5. **Target correctness unverified:** the symlink rule proves a symlink exists at the expected name, not that it resolves to its own ADR — a mispointed or dangling link passes and silently loads wrong or no context. The rule API cannot readlink; alignment is a manual review duty, tracked in [#9](https://github.com/hancrafted/typescript-ai-harness/issues/9).

**Risks:**

1. **Platform symlink support:** on Windows, symlinks need Administrator or Developer Mode, and default git (`core.symlinks=false`) checks existing runtime entries out as plain files. Those plain files satisfy the presence check, so a fresh clone passes `archgate check` while every runtime entry is a frozen copy — silent staleness rather than a blocked build, which is the worse failure of the two. Enabling symlinks (Developer Mode + `git config core.symlinks true`, then re-checkout) is the fix; the copy-body generator (Context) is the escalation path.
2. **Loader drift:** `.claude/rules` is a versioned Claude Code feature; if it regresses, pivot to the generator fallback (Context) with zero ADR renames.

## Compliance and Enforcement

Automated: `GEN-001-adr.rules.ts` runs every companion rule at `error` (§7), scoped to ADR basenames under `.archgate/adrs/`; each rule is marked at its deciding anchor, with the rules file as the source-of-truth for the full set.

**Manual review duties** (never linted): `paths:` globs actually describe the ADR's real governance surface; each `.claude/rules` symlink resolves to its own ADR (§4.2 — link targets are not machine-checkable); the sibling `.rules.test.ts` exercises each rule's pass and fail path (§6.1); section bodies are substantive, not empty placeholders that pass the presence-only check; each rule's prose describes what that rule actually does, since markers pair names and not meanings (§5.3); the prose obeys §5's standard (Root through Audience), which no rule enforces.

**Toolchain note:** `.archgate/**` is deliberately outside the repo's eslint and `tsc --noEmit` gates until a dedicated script ADR governs rules-file authoring ([#9](https://github.com/hancrafted/typescript-ai-harness/issues/9)); archgate forbids imports from shared folders, so every rules file is self-contained. Prettier and vitest cover `.archgate/**/*.ts`; `archgate check` is the sole gate on the ADR markdown.

**Templates/scaffolding:** self-hosting only. The future CLI-template phase ships this contract — with the copy-body fallback for symlink-hostile platforms — into target projects; that packaging is out of scope here.

**Exceptions:** raise a separate ADR; human approval required.

## References

- [Claude Code — memory & `.claude/rules` path-scoped rules](https://code.claude.com/docs/en/memory#organize-rules-with-claude/rules/) — the runtime loading mechanism §4 relies on (`paths:` field, glob matching, symlink support).
- [archgate](https://archgate.dev/) — ADR authoring path and the deterministic rule model.
- [JAR File Specification — notes on the manifest](https://docs.oracle.com/en/java/javase/21/docs/specs/jar/jar.html) — the documented precedent for §2.2's shape: `Manifest-Version` must lead "so that they can be recognized easily as magic strings", and "other than that, the order of attributes within a main section is not significant". A one-key ordered prefix, a free tail, and recognisability as the stated reason.
- Deferred hardening: [#7 AST-harden the meta-parsers](https://github.com/hancrafted/typescript-ai-harness/issues/7), [#8 contract evolution mechanism](https://github.com/hancrafted/typescript-ai-harness/issues/8), [#9 script ADR + toolchain guardrails](https://github.com/hancrafted/typescript-ai-harness/issues/9).
