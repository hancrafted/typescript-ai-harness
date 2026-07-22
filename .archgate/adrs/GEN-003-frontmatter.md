---
type: adr
id: GEN-003
title: "Frontmatter Contract"
domain: general
rules: true
paths: ["**/*.md", ".typescript-ai-harness.json"]
description: "Owns `type` repo-wide via the OKF frontmatter floor: every governed markdown file carries type + exactly one of name/title, plus optional cap-checked description and tags. Policy: the harness config (GEN-002), or a built-in default."
---

# Frontmatter Contract

## Context

Markdown files carry no machine-readable classification, so tooling falls back on fragile path conventions that drift as files move. This contract makes `type` a mandatory frontmatter key and pins a minimal **floor** around it — exactly one human label (`name` xor `title`) — so a file classifies itself. The floor is grounded on Google's Open Knowledge Format (OKF), where `type` is the sole mandatory field.

Rejected alternatives: inferring type from path (exactly the drift this contract removes); a bespoke anchor key (`kind`, `category`) — OKF's published `type` wins on forward-compatibility.

## Decision

### 1. Scope

1. This contract owns the repo-wide semantics of `type` and the frontmatter **floor**: the keys every _governed_ markdown file MUST satisfy. A floor, not a ceiling — policy MAY require more, never less.
2. Runtime-load scope is deliberately wider than enforcement scope: the broad `paths:` loads this ADR on any markdown Read, while enforcement applies only to files matched by a harness-config `pathRules` entry or the built-in default (§3).

### 2. The frontmatter floor (📜 Rule: `frontmatter-floor`)

One requirement per key; every cap is a default the matched entry may raise:

1. `type` — always required; kebab-case. When the matched entry declares `allowedTypes`, the value MUST be a member (plus `draft` when `draftEscape` is on); without `allowedTypes`, any kebab-case value passes.
2. Label — always required: exactly one of `name` xor `title`, non-empty, ≤ 64 chars (`maxLabel`). When the entry pins a label, only that key MAY appear — carrying the unpinned label, or both, is a violation.
3. `description` — optional by default; required when the matched entry sets `requireDescription`. When present: ≤ 1024 chars (`maxDescription`).
4. `tags` — optional. When present: a comma-separated list, each tag kebab-case and ≤ 30 chars (`maxTag`). No other restrictions — no closed set, no count limit.

### 3. Configuration

1. Policy is data: the `adr.frontmatter` block of the harness config `.typescript-ai-harness.json`, whose schema and first-match-wins evaluation are owned by GEN-002. The complete option-by-option reference — including `exempt` and `draftEscape` semantics and recipes — lives in [docs/agents/frontmatter-config.md](../../docs/agents/frontmatter-config.md), not in any ADR.
2. Each file resolves to its first matching `pathRules` entry; violations emit at that entry's tier — `warning` (visible, non-blocking) or `error` (blocking, the default). A file matched by an `exempt` entry, or by no entry, bears no floor; an unreadable governed file is skipped, not failed.
3. When the config file or its `adr.frontmatter` block is absent, the built-in default applies; a present block **replaces** the default outright (never merges). The default governs only root-or-specific paths (never `node_modules` or vendored markdown), pins `label: title`, closes `allowedTypes` to one type, and runs at `error`:
   - `.archgate/adrs/*.md` → `adr`
   - `README.md` → `docs`
   - `AGENTS.md` → `agents-md`
   - `CLAUDE.md` → `claude-md`

## Do's and Don'ts

1. **DO** give every governed markdown file `type` + exactly the pinned label, plus `description` where the matched entry requires it — each within its caps. (Decision 2, 📜 Rule: `frontmatter-floor`)
2. **DO** classify a file by its `type` key, never by its path — e.g. `design-adr` vs `adr` disambiguates the two ADR homes.
3. **DO** rely on the built-in default when no harness config exists; add `.typescript-ai-harness.json` (schema: GEN-002) only to override it.
4. **DO** set `type: draft` on a file whose permanent type is unsettled (`draftEscape` on) — the rest of the floor still applies, unlike `exempt`, which lifts it entirely.
5. **DO** tune per-entry policy (`requireDescription`, `maxLabel`/`maxDescription`/`maxTag`) in the harness config when a file type needs it, leaving the defaults elsewhere.

1. **DON'T** invent frontmatter keys outside the floor to mean "type" — `type` is the one OKF anchor this contract owns.
2. **DON'T** carry both `name` and `title`, or the label the matched entry did not pin.
3. **DON'T** lower the floor below `type` + one label — policy may only add to it.
4. **DON'T** re-declare the harness-config schema or evaluation here — that contract is GEN-002's.

## Consequences

**Positive:**

1. **Machine classification:** every governed file is classifiable from deterministic keys.
2. **Zero-config value:** the built-in default governs the ADRs, README, AGENTS.md and CLAUDE.md the moment the contract is installed.
3. **Portable:** the ADR and rules are byte-identical across projects; only the config data differs.

**Negative:**

1. **The default fires on install:** an unfrontmattered `README.md`/`AGENTS.md`/`CLAUDE.md` errors until fixed — accepted; the fix is cheap and silent non-governance defeats the point.
2. **Regex frontmatter parsing:** floor keys must be single-line values; block scalars are out of scope until the AST-hardening in [#7](https://github.com/hancrafted/typescript-ai-harness/issues/7).

**Risks:**

1. **Per-entry `warning` tier is unverified against the real archgate binary** (inferred from test mocks). Mitigation: the real-binary test in [#9](https://github.com/hancrafted/typescript-ai-harness/issues/9); fallback: two floor rules split by tier.
2. **A widened default could sweep vendored markdown.** Mitigation: default entries stay root-or-specific (§3.3); broad globs belong in an explicit, reviewed project config.

## Compliance and Enforcement

Automated: `GEN-003-frontmatter.rules.ts` enforces `frontmatter-floor` (§2) at the `error` tier, emitting per-file reports at each matched entry's configured tier. The harness config it reads is validated separately by GEN-002's `frontmatter-config-valid`.

**Manual review duties** (never linted): the built-in default still describes the intended zero-config governance surface; new design ADRs under `docs/adr/` are backfilled with `design-adr` frontmatter until `/domain-modeling` is patched; a raised cap or `requireDescription` is justified by the file type, not by one outlier file; [docs/agents/frontmatter-config.md](../../docs/agents/frontmatter-config.md) stays aligned with the schema GEN-002 validates.

**Exceptions:** raise a separate ADR; human approval required.

## References

- [Harness Config (GEN-002)](./GEN-002-harness-config.md) — config file, `adr.frontmatter` schema, first-match-wins evaluation.
- [Frontmatter configuration reference](../../docs/agents/frontmatter-config.md) — every `adr.frontmatter` option with defaults, semantics and recipes.
- [Google Open Knowledge Format (OKF)](https://github.com/google/open-knowledge-format) — `type` as the sole mandatory field.
- [Agent Skills specification](https://code.claude.com/docs/en/skills) — origin of the 64/1024 default caps.
- Deferred: [#7 AST-harden the meta-parsers](https://github.com/hancrafted/typescript-ai-harness/issues/7), [#9 real-binary integration test](https://github.com/hancrafted/typescript-ai-harness/issues/9).
