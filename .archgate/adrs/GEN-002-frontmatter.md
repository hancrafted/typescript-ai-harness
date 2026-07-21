---
type: adr
id: GEN-002
title: "Frontmatter Contract"
domain: general
rules: true
paths: ["**/*.md", ".typescript-ai-harness.json"]
description: "The config-driven OKF frontmatter floor that owns `type` repo-wide: every governed markdown file carries type + exactly one of name/title + description, with scope and per-zone policy declared as data in the root manifest .typescript-ai-harness.json and enforced first-match-wins."
---

# Frontmatter Contract

## Context

**The Problem:** Markdown files (ADRs, skills, PRDs) lack explicit classification, forcing tooling to rely on fragile path or prose parsing.
**The Solution:** Make type a mandatory, deterministic frontmatter key to enable cheap, scalable machine classification (e.g., nightly cleanup jobs filtering for type: prd) — and to keep the contract portable: its ADR and rules stay byte-identical across repos, with per-project scope declared as data.

The floor is grounded on Google's Open Knowledge Format (OKF), where `type` is the sole mandatory field.

Alternatives considered: a mode flag (`allowlist` vs `denylist`) to select enforcement posture — rejected because posture is instead made *emergent* from which zones a project declares (§3.3); folding the config into `.archgate/config.json` — rejected to keep archgate's own config unpolluted (§2.1); and YAML for the manifest — rejected because archgate ships zero runtime dependencies and its rule API is JSON-native (§2.2).

## Decision

### 1. Scope

1. This contract owns the repo-wide semantics of `type` and establishes a frontmatter **floor**: the minimum keys every *governed* markdown file MUST carry. It is a floor, not a ceiling — a zone or a tightening ADR MAY require more, never less.
2. Runtime-load scope is deliberately wider than enforcement scope: the ADR's broad `paths:` loads it into context on any markdown Read, while enforcement applies only to files a manifest zone matches.

### 2. The root manifest

1. Governance scope and policy live in a root **Seeded config file** named `.typescript-ai-harness.json`, kept separate from `.archgate/config.json` so archgate's own config is never polluted with harness fields.
2. The file is JSON (not YAML) because archgate is zero-dependency and JSON-native; it is seeded once, and only its `adr` key is tool-owned — surgically patched on re-run (the `package.json`-merge model), leaving the rest hand-editable and room under `adr` for future ADR-governance config beyond `adr.frontmatter`.
3. The `adr.frontmatter` block MUST be well-formed or enforcement integrity is compromised: `zones` MUST be an array; each zone MUST carry a `match` glob; optional `allowedTypes` MUST be kebab-case strings; `label` MUST be `name` or `title`; a zone's `severity` (its enforcement tier) MUST be `error` or `warning`; `maxLabel`/`maxDescription` MUST be positive integers; `unmatched` MUST be `exempt` and `draftEscape` a boolean. A malformed manifest surfaces as an error rather than silently disabling the floor. (📜 Rule: `frontmatter-config-valid`)

### 3. Zones and evaluation

1. `adr.frontmatter` declares a single `unmatched` default (`exempt`), an optional `draftEscape` flag, and an **ordered** `zones` array evaluated **first-match-wins**: a file resolves to the first zone whose `match` glob(s) hit, and a file matching no zone is `unmatched` (exempt).
2. Each zone is one of three cases: `exempt: true` (floor off), `allowedTypes: [...]` (floor on, closed membership), or neither (floor on, membership open to any kebab `type`). `label` pins the single required label (`name` xor `title`); the other label being present is a violation.
3. Enforcement posture is **emergent**, not a mode flag: a greenfield project declares only the zones it governs and lets everything else fall to `unmatched: exempt` (zero install blast radius); a brownfield project lists exempt globs first and ends with a catch-all zone. One evaluation semantics serves both.
4. Each zone MAY set a `severity` (its enforcement tier, default `error`) and MAY raise the OKF ceilings via `maxLabel`/`maxDescription` (defaults 64 and 1024, the Agent-Skills caps). Ratcheting a brownfield zone from warning to error, or tightening a cap, is a reviewed one-line edit of the manifest — data, not code.

### 4. The frontmatter floor

1. A governed markdown file MUST carry `type` (the OKF anchor, kebab-case), exactly the zone-pinned label with a non-empty value, and a non-empty `description`. When the zone declares `allowedTypes`, `type` MUST be a member (plus `draft` when `draftEscape` is on); an open zone accepts any kebab `type`. The pinned label MUST be within `maxLabel` (default 64) and `description` within `maxDescription` (default 1024). (📜 Rule: `frontmatter-floor`)
2. The floor rule resolves each file to its zone first-match-wins and emits at that zone's tier — `warning` (visible, non-blocking) or `error` (blocking) — from a single code path, so per-zone severity needs no second rule.
3. Both rules MUST no-op when the manifest, or its `adr.frontmatter` block, is absent, so the contract is safe to ship before the config is seeded in a target project.

### 5. Relationship to GEN-001

1. Double-governing `.archgate/adrs/` is deliberate and additive: GEN-001 leaves `description` optional, and GEN-002's floor (zone `adr`, `allowedTypes: ["adr"]`, `label: title`) tightens governance ADRs to require it. This is compatible with GEN-001's field-order rule because `description` trails `paths`.
2. The design-ADR vs governance-ADR collision is resolved by `type`, not prose: `design-adr` under `docs/adr/`, `adr` under `.archgate/adrs/`. Any consumer classifies a governed file from three deterministic keys rather than path or prose archaeology.

## Do's and Don'ts

1. **DO** keep the frontmatter config in `.typescript-ai-harness.json` at the repo root, and keep archgate's own config in `.archgate/config.json` — never merge the two.
2. **DO** validate the `adr.frontmatter` block's shape so a malformed manifest fails loudly instead of silently disabling the floor. (Decision 2, 📜 Rule: `frontmatter-config-valid`)
3. **DO** order `zones` deliberately and rely on first-match-wins — put exempt globs before a catch-all when governing a brownfield surface.
4. **DO** give every governed markdown file `type` + exactly the zone-pinned label + `description`, each within the zone's caps. (Decision 4, 📜 Rule: `frontmatter-floor`)
5. **DO** express enforcement posture through which zones you declare, letting `unmatched: exempt` absorb everything else, rather than reaching for a mode flag.
6. **DO** raise `maxLabel`/`maxDescription` per zone when a file type legitimately needs a longer label or description (e.g. agent definitions with embedded examples), leaving the OKF defaults everywhere else.
7. **DO** set `type: draft` on a new file whose permanent type is unsettled, and enable `draftEscape` in zones that should accept it.

1. **DON'T** invent frontmatter keys outside the floor to mean "type" — `type` is the one OKF anchor this contract owns.
2. **DON'T** add a mode flag or a second rule to model allowlist vs denylist — posture is emergent and severity is per-zone data.
3. **DON'T** carry both `name` and `title` on a governed file, or use the label the zone did not pin.
4. **DON'T** lower a floor requirement below `type` + one label + `description`; a zone or tightening ADR may only add to it.
5. **DON'T** let the floor rules hard-fail when the manifest is absent — they MUST no-op so the contract ships safely pre-seed.
6. **DON'T** widen a zone's caps globally to fix one outlier file — raise the cap on that single zone instead.

## Consequences

**Positive:**

1. **`type` finally has a contract:** GEN-001's deferral is closed; every governed file is machine-classifiable from three deterministic keys.
2. **Portable by construction:** the ADR and rules are byte-identical across projects; only the manifest data differs, so one contract serves greenfield (allowlist) and brownfield (denylist) alike.
3. **OKF-grounded:** the floor inherits a published spec's authority and forward-compatibility rather than being hand-invented.
4. **Single evaluation semantics:** ordered zones + first-match-wins + one `unmatched: exempt` default means there is exactly one model to reason about; posture is emergent.
5. **Ratcheting is a data edit:** tightening a warning zone to error, or a cap, is a reviewed one-line manifest change in a PR — no code change, no ADR amendment ceremony.
6. **Dogfoods GEN-001:** GEN-002 proves the ADR Contract governs a sibling, and additively tightens governance ADRs to require `description`.

**Negative:**

1. **A second config surface:** the manifest is one more file to seed and keep in sync with the zones' real intent — mitigated by `frontmatter-config-valid` failing on a malformed block and by the CLI seeding a starter (deferred).
2. **Frontmatter parsing rides on regex:** like GEN-001's meta-rules, the floor extracts single-line frontmatter values by regex, so block scalars and multi-line values are out of scope. This will be mitigated by AST-hardening tracked in [#7](https://github.com/hancrafted/typescript-ai-harness/issues/7).
3. **Broad runtime scope:** `paths: ["**/*.md", ...]` loads this ADR on every markdown Read, which is more context than any single file needs — accepted because the frontmatter contract genuinely applies to all governed markdown, and enforcement scope stays narrow in the manifest.

**Risks:**

1. **Per-call severity is unverified against the real binary.** The single-floor-rule design assumes `ctx.report.warning` emits a non-blocking diagnostic independent of the rule's declared tier — inferred from GEN-001's test mock, not confirmed against archgate. This will be mitigated by the real-binary integration test tracked in [#9](https://github.com/hancrafted/typescript-ai-harness/issues/9); the fallback is two floor rules sharing one check implementation, partitioned by tier — identical external behavior, one extra rule object.
2. **Glob breadth on install.** A brownfield catch-all zone could match vendored or generated markdown a target project never meant to govern. This will be mitigated by the exempt-first ordering pattern (Decision 3) and by the CLI seeding a conservative opt-in starter (deferred).

## Compliance and Enforcement

Automated: `GEN-002-frontmatter.rules.ts` enforces two rules — `frontmatter-config-valid` (validates the `adr.frontmatter` block, §2.3) and `frontmatter-floor` (resolves each governed file to its zone and checks the floor, §4.1) — both declared at the `error` tier per GEN-001 §7. The floor rule additionally emits a per-file report at the matched zone's configured tier through one code path; this repo's own manifest ships all zones at `error` (conform-now, no migration epoch), so the warning tier is exercised only by the rules-test and by brownfield template configs.

**Manual review duties** (never linted): the manifest's zone globs actually describe the intended governance surface; each zone's `label` and `allowedTypes` match the file type it governs; raised caps (`maxLabel`/`maxDescription`) are justified by the file type rather than papering over an outlier; new design ADRs authored via `/domain-modeling` are backfilled with `design-adr` frontmatter until that skill is patched (deferred).

**Toolchain note:** `.archgate/**` is deliberately outside the repo's eslint and `tsc --noEmit` gates ([#9](https://github.com/hancrafted/typescript-ai-harness/issues/9)); prettier and vitest cover `GEN-002-frontmatter.rules.ts` and its sibling test, and the root `.typescript-ai-harness.json` is prettier-checked. `archgate check` is the sole gate on this ADR markdown and on the manifest's contents.

**Templates/scaffolding:** self-hosting only for now. The CLI sub-option (opt-in vs opt-out starter) and the archgate integration growing to seed and patch the `adr` key in `.typescript-ai-harness.json` are designed here but deferred ([#11](https://github.com/hancrafted/typescript-ai-harness/issues/11) scope).

**Exceptions:** raise a separate ADR; human approval required.

## References

- [ADR Contract (GEN-001)](./GEN-001-adr.md) — the shape and runtime-loading contract GEN-002 self-hosts under, and the sibling this ADR dogfoods.
- [Distribution model (ADR-0001)](../../docs/adr/0001-github-git-spec-tsx-distribution.md) — the runtime-dependency firewall that forces JSON over YAML for the manifest.
- [archgate integration (ADR-0005)](../../docs/adr/0005-archgate-integration.md) — the integration that will seed and patch the manifest's `adr` key in target projects.
- [Google Open Knowledge Format (OKF)](https://github.com/google/open-knowledge-format) — the schema the floor is grounded on (`type` mandatory).
- [Agent Skills specification](https://code.claude.com/docs/en/skills) — origin of the `name ≤ 64` / `description ≤ 1024` default ceilings.
- Deferred and related work: [#6 index ADR](https://github.com/hancrafted/typescript-ai-harness/issues/6), [#7 AST-harden the meta-parsers](https://github.com/hancrafted/typescript-ai-harness/issues/7), [#8 contract-evolution / graduated tier](https://github.com/hancrafted/typescript-ai-harness/issues/8), [#9 script ADR + real-binary integration test](https://github.com/hancrafted/typescript-ai-harness/issues/9).
