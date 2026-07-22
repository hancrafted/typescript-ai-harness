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

Markdown files carry no machine-readable classification, so tooling falls back on fragile path conventions or llm reasoning that drift as files move or content change. This contract makes `type` a mandatory frontmatter for markdown files grounded in Google's Open Knowledge Format (OKF).

Rejected alternatives:

- **Infer `type` from path** — exactly the drift this contract removes.
- **A bespoke anchor key** (`kind`, `category`) — OKF's published `type` wins on forward-compatibility.
- **Payload validation in GEN-002** (the pre-restructure design) — every knob then amends two ADRs in lockstep.

## Decision

### 1. Scope

1. **Floor, not ceiling:** this contract owns the repo-wide semantics of `type` and the frontmatter **floor** — the keys every _governed_ markdown file MUST satisfy. Future ADRs MAY require more, never less.

### 2. The frontmatter floor (📜 Rule: `frontmatter-floor`)

1. **`type`:** always required, kebab-case. With the entry's `allowedTypes`, the value MUST be a member (plus `draft` when `settings.draftEscape` is on); without it, any kebab-case value passes.
2. **`Label`:** exactly one of `name` xor `title`, non-empty, ≤ 64 chars (`maxLabel`). When the entry pins a label, only that key MAY appear — the unpinned label, or both, is a violation.
3. **`description`:** optional; required when the entry sets `requireDescription`. When present, ≤ 1024 chars (`maxDescription`).
4. **`tags`:** optional; a comma-separated list, each tag kebab-case and ≤ 30 chars (`maxTag`). No closed set, no count limit.

### 3. Config

1. Frontmatter behaviour is configurable and enforced  (📜 Rule: `frontmatter-config-valid`) 

## Do's and Don'ts

### Do's

1. **DO** give every governed markdown file `type`, matching it's `allowedTypes` (Decision 2, 📜 Rule: `frontmatter-floor`)
2. **DO** set `type: draft` when a file's permanent type is unsettled (`settings.draftEscape` on) — the floor still applies, unlike `exempt`, which lifts it entirely.

### Don'ts

1. **DON'T** invent frontmatter keys outside the floor to mean "type" — `type` is the one OKF anchor this contract owns.
2. **DON'T** carry both `name` and `title`, or the label the matched entry did not pin.
3. **DON'T** adjust config to fix archage check issues (Decision 3, 📜 Rule: `frontmatter-config-valid`) 


## Consequences

**Positive:**

1. **Machine classification:** every governed file is classifiable from deterministic keys.
2. **Zero-config value:** the built-in default governs the ADRs, README, AGENTS.md, and CLAUDE.md the moment the contract is installed.
3. **Portable:** the ADR and rules are byte-identical across projects; only the config data differs.

**Negative:**

1. **The default fires on install:** an unfrontmattered `README.md`/`AGENTS.md`/`CLAUDE.md` errors until fixed — accepted; the fix is cheap and silent non-governance defeats the point.
2. **Regex frontmatter parsing:** floor keys must be single-line values; block scalars are out of scope until AST-hardening (deferred).
3. **A structural spine copy rides along:** the consumer refuses blocks GEN-002 would reject, so it carries a boolean copy of the spine walk and version probe (archgate rules cannot share runtime code) — kept honest by the shared fixtures both rules tests import.
4. **`warning` tier unverified against the real binary** (inferred from test mocks) — mitigated by the real-binary test (deferred); fallback is two floor rules split by tier.
5. **A widened default could sweep vendored markdown** — mitigated by keeping default entries root-or-specific (§3.4); broad globs belong in an explicit, reviewed project config.

## Compliance and Enforcement

Automated: `GEN-003-frontmatter.rules.ts` enforces two `error`-tier rules (GEN-001 §7) — `frontmatter-config-valid` (the block's payload vocabulary, §3.1) and `frontmatter-floor` (§2, per-file reports at each matched entry's tier, plus coverage reports under `unmatched: 'error'`). The envelope and spine they read are validated separately by GEN-002; one shared internal validator backs both rules, so what the payload validator rejects the floor refuses to govern by.

**Manual review duties** (never linted): the built-in default still describes the intended zero-config surface; new design ADRs under `docs/adr/` are backfilled with `design-adr` frontmatter until `/domain-modeling` is patched; a raised cap or `requireDescription` is justified by the file type, not one outlier; [docs/agents/frontmatter-config.md](../../docs/agents/frontmatter-config.md) stays aligned with the payload schema this contract validates.

**Exceptions:** raise a separate ADR; human approval required.

## References

- [Harness Config (GEN-002)](./GEN-002-harness-config.md) — the envelope: config file lifecycle, version envelope, fence grammar, generic spine, consumer contract.
- [Frontmatter configuration reference](../../docs/agents/frontmatter-config.md) — every spine and block option with defaults, semantics, and recipes.
- [Spec #19](https://github.com/hancrafted/typescript-ai-harness/issues/19), [refinement #30](https://github.com/hancrafted/typescript-ai-harness/issues/30) — the restructure that moved payload ownership here, then the fence-derived registry that moved registration here.
- [Google Open Knowledge Format (OKF)](https://github.com/google/open-knowledge-format) — `type` as the sole mandatory field.
- [Agent Skills specification](https://code.claude.com/docs/en/skills) — origin of the 64/1024 default caps.
- Deferred: [#7 AST-harden the meta-parsers](https://github.com/hancrafted/typescript-ai-harness/issues/7), [#9 real-binary integration test](https://github.com/hancrafted/typescript-ai-harness/issues/9).
