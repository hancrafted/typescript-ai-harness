---
type: adr
id: GEN-003
title: "Frontmatter Contract"
domain: general
rules: true
paths: ["**/*.md", ".typescript-ai-harness.json", ".archgate/harness-config-extension.d.ts"]
description: "Owns `type` repo-wide via the OKF frontmatter floor: every governed markdown file carries type + exactly one of name/title, plus optional cap-checked description and tags. Owns the harness config's `markdown.frontmatter`."
---

# Frontmatter Contract

## Context

Markdown files carry no machine-readable classification, so tooling falls back on fragile path conventions or LLM reasoning that drift as files move or content change. This contract makes `type` a mandatory frontmatter key for markdown files, grounded in Google's Open Knowledge Format (OKF).

Rejected alternatives:

- **Infer `type` from path** — exactly the drift this contract removes.
- **A bespoke anchor key** (`kind`, `category`) — OKF's published `type` wins on forward-compatibility.
- **Payload validation in GEN-002** — every knob then amends two ADRs in lockstep.

## Decision

### 1. Scope

1. **Floor, not ceiling:** this contract owns the repo-wide semantics of `type` and the frontmatter **floor** — the keys every _governed_ markdown file MUST satisfy. Future ADRs MAY require more, never less.

### 2. The frontmatter floor (📜 Rule: `frontmatter-floor`)

1. **`type`:** always required, kebab-case. With the entry's `allowedTypes`, the value MUST be a member (plus `draft` when `settings.draftEscape` is on); without it, any kebab-case value passes.
2. **`Label`:** exactly one of `name` xor `title`, non-empty, no longer than `maxLabel`. When the entry pins a label, only that key MAY appear — the unpinned label, or both, is a violation.
3. **`description`:** optional; required when the entry sets `requireDescription`. When present, no longer than `maxDescription`.
4. **`tags`:** optional, an open set with no count limit; each tag kebab-case and no longer than `maxTag`. Accepted as either a comma-separated string or a single-line YAML inline flow array (`tags: [a, b]`) — normalized to the same list — while a multi-line block sequence stays out of scope (Consequences).
5. **Dead carve-out:** while resolving an entry's FileSet, an `excludeFiles` path that removes no file from that entry's `include` set is reported at warning tier — a typo'd or already-out-of-scope path is surfaced, not silently inert. GEN-002's spine already bans `excludeFiles` on a wildcard-free include; this catches the path that is well-formed but matches nothing.

### 3. Config

1. Frontmatter policy is configured in the `markdown.frontmatter` block and enforced (📜 Rule: `frontmatter-config-valid`); its option-by-option reference is [`frontmatter-config.md`](../frontmatter-config.md).

## Do's and Don'ts

### Do's

1. **DO** give every governed markdown file `type`, matching its `allowedTypes` (Decision 2, 📜 Rule: `frontmatter-floor`)
2. **DO** set `type: draft` when a file's permanent type is unsettled (`settings.draftEscape` on) — the floor still applies, unlike `exempt`, which lifts it entirely.
3. **DO** heed the dead-carve-out warning — an `excludeFiles` path that removes no file is a typo or a stale path; fix or drop it. (Decision 2)

### Don'ts

1. **DON'T** invent frontmatter keys outside the floor to mean "type" — `type` is the one OKF anchor this contract owns.
2. **DON'T** carry both `name` and `title`, or the label the matched entry did not pin.
3. **DON'T** adjust config to fix archgate check issues (Decision 3, 📜 Rule: `frontmatter-config-valid`)


## Consequences

**Positive:**

1. **Machine classification:** every governed file is classifiable from deterministic keys.
2. **Zero-config value:** the built-in default governs the ADRs, README, AGENTS.md, and CLAUDE.md the moment the contract is installed.
3. **Portable:** the ADR and rules are byte-identical across projects; only the config data differs.

**Negative:**

1. **The default fires on install:** an unfrontmattered `README.md`/`AGENTS.md`/`CLAUDE.md` errors until fixed — accepted; the fix is cheap and silent non-governance defeats the point.
2. **Regex frontmatter parsing:** floor keys are read as single-line values — `tags` accepts both the comma-separated and inline-array forms on that line, but multi-line block sequences and other block scalars stay out of scope until AST-hardening (deferred).

## Compliance and Enforcement

Automated: `GEN-003-frontmatter.rules.ts` enforces two `error`-tier rules (GEN-001 §7) — `frontmatter-config-valid` (the block's payload vocabulary, §3.1) and `frontmatter-floor` (§2, per-file reports at each matched entry's tier, plus coverage reports under `unmatched: 'error'`).

**Manual review duties** (never linted): the built-in default still describes the intended zero-config surface; new design ADRs under `docs/adr/` are backfilled with `design-adr` frontmatter until `/domain-modeling` is patched; a raised cap or `requireDescription` is justified by the file type, not one outlier; [frontmatter-config.md](../frontmatter-config.md) stays aligned with the payload schema this contract validates.

**Exceptions:** raise a separate ADR; human approval required.

## References

- [Harness Config (GEN-002)](./GEN-002-harness-config.md) — the envelope: config file lifecycle, version envelope, fence grammar, generic spine, consumer contract.
- [Frontmatter configuration reference](../frontmatter-config.md) — every spine and block option with defaults, semantics, and recipes.
- [Spec #19](https://github.com/hancrafted/typescript-ai-harness/issues/19), [refinement #30](https://github.com/hancrafted/typescript-ai-harness/issues/30) — where payload ownership and the fence-derived block registry are specified.
- [Google Open Knowledge Format (OKF)](https://github.com/google/open-knowledge-format) — `type` as the sole mandatory field.
- [Agent Skills specification](https://code.claude.com/docs/en/skills) — origin of the 64/1024 default caps.
- Deferred: [#7 AST-harden the meta-parsers](https://github.com/hancrafted/typescript-ai-harness/issues/7), [#9 real-binary integration test](https://github.com/hancrafted/typescript-ai-harness/issues/9).
