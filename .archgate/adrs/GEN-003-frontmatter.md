---
type: adr
id: GEN-003
title: "Frontmatter Contract"
domain: general
rules: true
paths: ["**/*.md", ".typescript-ai-harness.json", ".archgate/harness-config-extension.d.ts"]
description: "Owns `type` repo-wide via the OKF frontmatter floor: every governed markdown file carries type + exactly one of name/title, plus optional cap-checked description and tags. Owns the harness config's `markdown.frontmatter` block wholesale — its registering fence in the config extension, payload schema (`rule`, `settings`), validation, interpretation, and the built-in default; the envelope, fence grammar, and generic spine are GEN-002's."
---

# Frontmatter Contract

## Context

Markdown files carry no machine-readable classification, so tooling falls back on fragile path conventions that drift as files move. This contract makes `type` a mandatory frontmatter key and pins a minimal **floor** around it — exactly one human label (`name` xor `title`) — so a file classifies itself. The floor is grounded on Google's Open Knowledge Format (OKF), where `type` is the sole mandatory field.

This contract is also the first **block owner** under GEN-002's envelope: it owns the `markdown.frontmatter` block wholesale — the fence in `.archgate/harness-config-extension.d.ts` that registers the block and carries its types, plus payload vocabulary, payload validation, interpretation, and the built-in default — so a new frontmatter knob (or even a new markdown block) amends only its owning ADR, never GEN-002.

Rejected alternatives: inferring type from path (exactly the drift this contract removes); a bespoke anchor key (`kind`, `category`) — OKF's published `type` wins on forward-compatibility; keeping payload validation in GEN-002 (the pre-restructure design) — every knob then amended two ADRs in lockstep.

## Decision

### 1. Scope

1. This contract owns the repo-wide semantics of `type` and the frontmatter **floor**: the keys every _governed_ markdown file MUST satisfy. A floor, not a ceiling — policy MAY require more, never less.
2. Runtime-load scope is deliberately wider than enforcement scope: the broad `paths:` loads this ADR on any markdown Read, while enforcement applies only to files claimed by a `markdown.frontmatter` pathRules entry or the built-in default (§3).

### 2. The frontmatter floor (📜 Rule: `frontmatter-floor`)

One requirement per key; every cap is a default the matched entry's `rule` may raise:

1. `type` — always required; kebab-case. When the matched entry's rule declares `allowedTypes`, the value MUST be a member (plus `draft` when `settings.draftEscape` is on); without `allowedTypes`, any kebab-case value passes.
2. Label — always required: exactly one of `name` xor `title`, non-empty, ≤ 64 chars (`maxLabel`). When the entry's rule pins a label, only that key MAY appear — carrying the unpinned label, or both, is a violation.
3. `description` — optional by default; required when the matched entry's rule sets `requireDescription`. When present: ≤ 1024 chars (`maxDescription`).
4. `tags` — optional. When present: a comma-separated list, each tag kebab-case and ≤ 30 chars (`maxTag`). No other restrictions — no closed set, no count limit.
5. Under `unmatched: 'error'`, the floor additionally reports every file inside the block's `coverage` FileSet that no pathRules entry claims, at the error tier — the strict posture where an unlisted file is a mistake.

### 3. Configuration (📜 Rule: `frontmatter-config-valid`)

1. Policy is data: the `markdown.frontmatter` block of the harness config `.typescript-ai-harness.json`. GEN-002 owns the envelope (top-level `version`, fence grammar) and the domain-blind generic spine — FileSet `include`/`exclude` arithmetic, ordered first-match-wins claiming, `exempt` vs entry-`exclude` vs coverage-`exclude` semantics, `unmatched`/`coverage`, replace-not-merge. This contract owns the block's **registration and vocabulary**: its fence in `.archgate/harness-config-extension.d.ts` declares the `markdown.frontmatter` path (making the key legal) and carries the payload types; each entry's `rule` payload is closed to `{allowedTypes, label, requireDescription, maxLabel, maxDescription, maxTag}` and the block's `settings` to `{draftEscape}`, all shape-checked with unknown keys rejected — a typo like `maxDescriptions` errors instead of silently weakening the floor. The complete option-by-option reference lives in [docs/agents/frontmatter-config.md](../../docs/agents/frontmatter-config.md), not in any ADR.
2. Each file resolves to the first entry that claims it (an entry's files are `glob(include) − glob(exclude)`; an excluded file is not claimed and falls through, while an `exempt` entry claims and waives). Violations emit at that entry's tier — `warning` (visible, non-blocking) or `error` (blocking, the default). An unreadable governed file is skipped, not failed.
3. Consumer contract (all-or-nothing, GEN-002 §3): when the config file — or the block in a healthy file — is absent, the built-in default (§3.4) applies; a present block **replaces** the default outright (never merges). When the config is present but unparseable, its top-level `version` missing or skewed against the installed harness release, or the block spine- or payload-invalid, the floor governs **nothing** — GEN-002's envelope rules and `frontmatter-config-valid` are the loud gate; best-effort interpretation would enforce wrong policy while looking healthy.
4. The built-in default governs only root-or-specific paths (never `node_modules` or vendored markdown), pins `label: title` and one allowed type per entry via its `rule` payload, and runs at `error`:
   - `.archgate/adrs/*.md` → `adr`
   - `README.md` → `docs`
   - `AGENTS.md` → `agents-md`
   - `CLAUDE.md` → `claude-md`

## Do's and Don'ts

1. **DO** give every governed markdown file `type` + exactly the pinned label, plus `description` where the matched entry's rule requires it — each within its caps. (Decision 2, 📜 Rule: `frontmatter-floor`)
2. **DO** classify a file by its `type` key, never by its path — e.g. `design-adr` vs `adr` disambiguates the two ADR homes.
3. **DO** keep the block's vocabulary valid — only the closed `rule` and `settings` keys, correctly shaped; an unknown key is an error, not a silently ignored knob. (Decision 3, 📜 Rule: `frontmatter-config-valid`)
4. **DO** rely on the built-in default when no harness config exists; add `.typescript-ai-harness.json` (envelope and spine: GEN-002) only to override it.
5. **DO** set `type: draft` on a file whose permanent type is unsettled (`settings.draftEscape` on) — the rest of the floor still applies, unlike `exempt`, which lifts it entirely.
6. **DO** tune per-entry policy (`requireDescription`, `maxLabel`/`maxDescription`/`maxTag`) inside that entry's `rule` payload when a file type needs it, leaving the defaults elsewhere.

1. **DON'T** invent frontmatter keys outside the floor to mean "type" — `type` is the one OKF anchor this contract owns.
2. **DON'T** carry both `name` and `title`, or the label the matched entry did not pin.
3. **DON'T** lower the floor below `type` + one label — policy may only add to it.
4. **DON'T** re-declare the envelope, fence grammar, or spine grammar here — that contract is GEN-002's; this ADR owns only its own fence, the block's payload, and its consumption.
5. **DON'T** govern by a broken block — unparseable, version-skewed, or invalid means the floor governs nothing until the loud gate is green.

## Consequences

**Positive:**

1. **Machine classification:** every governed file is classifiable from deterministic keys.
2. **Zero-config value:** the built-in default governs the ADRs, README, AGENTS.md and CLAUDE.md the moment the contract is installed.
3. **Portable:** the ADR and rules are byte-identical across projects; only the config data differs.
4. **Knobs grow in one place:** a future timestamp, TTL, or line-cap rule is a `rule`-payload addition here — GEN-002 and its rules stay untouched.

**Negative:**

1. **The default fires on install:** an unfrontmattered `README.md`/`AGENTS.md`/`CLAUDE.md` errors until fixed — accepted; the fix is cheap and silent non-governance defeats the point.
2. **Regex frontmatter parsing:** floor keys must be single-line values; block scalars are out of scope until the AST-hardening in [#7](https://github.com/hancrafted/typescript-ai-harness/issues/7).
3. **A structural spine copy rides along:** the consumer refuses blocks GEN-002 would reject, so it carries a boolean copy of the spine walk and the harness-version probe (archgate rules cannot share runtime code) — kept honest by the shared conformance fixtures both rules tests import.

**Risks:**

1. **Per-entry `warning` tier is unverified against the real archgate binary** (inferred from test mocks). Mitigation: the real-binary test in [#9](https://github.com/hancrafted/typescript-ai-harness/issues/9); fallback: two floor rules split by tier.
2. **A widened default could sweep vendored markdown.** Mitigation: default entries stay root-or-specific (§3.4); broad globs belong in an explicit, reviewed project config.

## Compliance and Enforcement

Automated: `GEN-003-frontmatter.rules.ts` enforces two rules, both declared at the `error` tier per GEN-001 §7 — `frontmatter-config-valid` (the block's payload vocabulary, §3.1) and `frontmatter-floor` (§2, emitting per-file reports at each matched entry's configured tier, plus coverage reports under `unmatched: 'error'`). The envelope and spine of the config they read are validated separately by GEN-002's three rules; one shared internal validator backs both rules here, so what the payload validator rejects the floor refuses to govern by.

**Manual review duties** (never linted): the built-in default still describes the intended zero-config governance surface; new design ADRs under `docs/adr/` are backfilled with `design-adr` frontmatter until `/domain-modeling` is patched; a raised cap or `requireDescription` is justified by the file type, not by one outlier file; [docs/agents/frontmatter-config.md](../../docs/agents/frontmatter-config.md) stays aligned with the payload schema this contract validates.

**Exceptions:** raise a separate ADR; human approval required.

## References

- [Harness Config (GEN-002)](./GEN-002-harness-config.md) — the envelope: config file lifecycle, version envelope, fence grammar, generic spine, consumer contract.
- [Frontmatter configuration reference](../../docs/agents/frontmatter-config.md) — every spine and block option with defaults, semantics and recipes.
- [Spec #19](https://github.com/hancrafted/typescript-ai-harness/issues/19) and [refinement #30](https://github.com/hancrafted/typescript-ai-harness/issues/30) — the envelope/block restructure that moved payload ownership here, then the fence-derived registry that moved registration here too.
- [Google Open Knowledge Format (OKF)](https://github.com/google/open-knowledge-format) — `type` as the sole mandatory field.
- [Agent Skills specification](https://code.claude.com/docs/en/skills) — origin of the 64/1024 default caps.
- Deferred: [#7 AST-harden the meta-parsers](https://github.com/hancrafted/typescript-ai-harness/issues/7), [#9 real-binary integration test](https://github.com/hancrafted/typescript-ai-harness/issues/9).
