---
type: adr
id: GEN-003
title: "Frontmatter Contract"
domain: general
rules: true
paths: ["**/*.md", ".typescript-ai-harness.json"]
description: "Owns `type` repo-wide via an OKF frontmatter floor: every governed markdown file carries type + exactly one of name/title + description. Scope and per-file policy are read from the harness config (GEN-002); absent that config, a built-in default governs the ADR, README, AGENTS.md and CLAUDE.md."
---

# Frontmatter Contract

## Context

**The problem:** Markdown files (ADRs, skills, PRDs, READMEs) carry no explicit, machine-readable classification. Tooling that wants to act on "every skill" or "every PRD" is forced into fragile path conventions or prose parsing, and that classification silently drifts as files move.

**The solution:** Make `type` a mandatory, deterministic frontmatter key and pin a small **floor** of keys around it — exactly one human label (`name` or `title`) and a `description`. A file then classifies itself: a nightly cleanup job filtering for `type: prd`, a control-flow filter picking `type: skill` files, or a decomposition pass over `type: adr` all read three keys instead of guessing from a path. Because the floor is declared per file, the contract stays portable — its ADR and rules are byte-identical across repos, and each project's governance surface is supplied as data (owned by GEN-002), never baked into the rules.

The floor is grounded on Google's Open Knowledge Format (OKF), where `type` is the sole mandatory field; the label and `description` are the minimum a human and a machine both need to identify a file at a glance.

Alternatives considered: **inferring type from path** (e.g. anything under `docs/adr/` is an ADR) — rejected as exactly the path archaeology this contract removes; **a bespoke anchor key** (`kind`, `category`) — rejected in favour of OKF's published `type` for forward-compatibility; **leaving `description` optional** — rejected because machine summaries and cleanup jobs need a one-line intent without opening the file. How that governance surface is *configured* — the file format, evaluation order, and defaults — is a separate decision owned by the harness-config contract (GEN-002).

## Decision

### 1. Scope

1. This contract owns the repo-wide semantics of `type` and establishes a frontmatter **floor**: the minimum keys every *governed* markdown file MUST carry. It is a floor, not a ceiling — a matched policy or a tightening ADR MAY require more, never less.
2. Runtime-load scope is deliberately wider than enforcement scope: the ADR's broad `paths:` loads it into context on any markdown Read, while enforcement applies only to files that a harness-config `pathRules` entry — or the built-in default (§3) — matches.

### 2. The frontmatter floor

1. A governed markdown file MUST carry `type` (the OKF anchor, kebab-case), exactly the pinned label (`name` xor `title`) with a non-empty value, and a non-empty `description`. When the matched policy declares `allowedTypes`, `type` MUST be a member (plus `draft` when `draftEscape` is on); an open policy accepts any kebab-case `type`. The pinned label MUST be within its cap (default 64) and `description` within its cap (default 1024). Carrying the label the policy did not pin — or both `name` and `title` — is a violation. (📜 Rule: `frontmatter-floor`)
2. The floor rule resolves each file to its matching `pathRules` entry first-match-wins and emits at that entry's tier — `warning` (visible, non-blocking) or `error` (blocking, the default) — from a single code path, so per-entry severity needs no second rule.
3. A file matched by an `exempt` entry, or matched by no entry at all, bears no floor. A governed file the rule cannot read (e.g. a symlink archgate refuses to follow) is skipped rather than failed, since a deliberately-scoped unreadable file cannot be classified in place.

### 3. Configuration and the built-in default

1. The floor's scope and per-file policy are supplied as data in the `adr.frontmatter` block of the harness config `.typescript-ai-harness.json`. That block's schema — the `pathRules` shape, `unmatched`, `draftEscape`, the caps — and its first-match-wins evaluation are owned by GEN-002; this contract only *consumes* the resolved policy.
2. The floor rule runs a **single evaluation path**: `userConfig?.adr?.frontmatter ?? DEFAULT`. When the config file, its `adr` key, or its `frontmatter` block is absent the built-in **default** applies; when the block is present it **replaces** the default outright (never merges), so a project's declared policy is the whole policy. There is no `if`/`else` branch between "configured" and "default" — both are the same `pathRules` shape.
3. The default is a typed constant inside this contract's `rules.ts`, expressed in GEN-002's `pathRules` shape — deliberately *not* a separate JSON file, which cannot live under `.archgate/adrs/` (GEN-001 `adr-governed-files`). It governs only root-or-specific paths, so installing the contract into a fresh project never sweeps `node_modules` or vendored markdown. The default entries are:

   | pathRule | match | type |
   |---|---|---|
   | ADR | `.archgate/adrs/*.md` | `adr` |
   | README | `README.md` | `docs` |
   | AGENTS | `AGENTS.md` | `agents-md` |
   | CLAUDE | `CLAUDE.md` | `claude-md` |

   Every default entry pins `label: title`, requires `description`, closes `allowedTypes` to the single listed type, and runs at the `error` tier.

### 4. Relationship to GEN-001

1. Double-governing `.archgate/adrs/` is deliberate and additive: GEN-001 leaves `description` optional, and this contract's floor (the `.archgate/adrs/*.md` → `adr` entry, `label: title`) tightens governance ADRs to require it. This is compatible with GEN-001's field-order rule because `description` trails `paths`.
2. The design-ADR vs governance-ADR name collision is resolved by `type`, not prose: `design-adr` under `docs/adr/`, `adr` under `.archgate/adrs/`. New design ADRs authored via `/domain-modeling` are backfilled with `design-adr` frontmatter until that skill is patched (a manual duty, deferred).

## Do's and Don'ts

1. **DO** give every governed markdown file `type` + exactly the pinned label + `description`, each within its caps. (Decision 2, 📜 Rule: `frontmatter-floor`)
2. **DO** classify a file by its `type` key rather than its path — `design-adr` vs `adr` disambiguates the two ADR homes deterministically.
3. **DO** rely on the built-in default when no harness config is present, and add `.typescript-ai-harness.json` (schema in GEN-002) only to override it.
4. **DO** set `type: draft` on a new file whose permanent type is unsettled, and enable `draftEscape` on the policy that should accept it.
5. **DO** raise a policy's `maxLabel`/`maxDescription` in the harness config when a file type legitimately needs a longer label or description, leaving the OKF defaults everywhere else.

1. **DON'T** invent frontmatter keys outside the floor to mean "type" — `type` is the one OKF anchor this contract owns.
2. **DON'T** carry both `name` and `title` on a governed file, or use the label the matched policy did not pin.
3. **DON'T** lower a floor requirement below `type` + one label + `description`; a policy or tightening ADR may only add to it.
4. **DON'T** re-declare the harness-config schema or evaluation here — that contract is GEN-002's; this ADR only consumes the resolved policy.

## Consequences

**Positive:**

1. **`type` finally has a contract:** GEN-001's deferral is closed; every governed file is machine-classifiable from three deterministic keys.
2. **Works with zero config:** the built-in default governs the ADR, README, AGENTS.md and CLAUDE.md the moment the contract is installed — no config file required to get value.
3. **OKF-grounded:** the floor inherits a published spec's authority and forward-compatibility rather than being hand-invented.
4. **Single evaluation semantics:** `userConfig?.adr?.frontmatter ?? DEFAULT` is one code path; there is exactly one model to reason about, configured or not.
5. **Portable by construction:** the ADR and rules are byte-identical across projects; only the config data differs.
6. **Dogfoods GEN-001:** this contract proves the ADR Contract governs a sibling, and additively tightens governance ADRs to require `description`.

**Negative:**

1. **The default governs on install:** dropping the contract into a project with an unfrontmattered `README.md`/`AGENTS.md`/`CLAUDE.md` fires the floor at `error` until those files are fixed — accepted because that fix is cheap (an AI pass) and the alternative, silent non-governance, defeats the point.
2. **Frontmatter parsing rides on regex:** the floor extracts single-line frontmatter values by regex, so block scalars and multi-line values are out of scope. This will be mitigated by the AST-hardening tracked in [#7](https://github.com/hancrafted/typescript-ai-harness/issues/7).
3. **Broad runtime scope:** `paths: ["**/*.md", ...]` loads this ADR on every markdown Read — more context than a single file needs. Accepted because the floor genuinely applies to all governed markdown, and enforcement scope stays narrow in the config and default.

**Risks:**

1. **Per-call severity is unverified against the real binary.** The single-floor-rule design assumes `ctx.report.warning` emits a non-blocking diagnostic independent of the rule's declared tier — inferred from GEN-001's test mock, not confirmed against archgate. This will be mitigated by the real-binary integration test tracked in [#9](https://github.com/hancrafted/typescript-ai-harness/issues/9); the fallback is two floor rules sharing one check implementation, partitioned by tier — identical behavior, one extra rule object.
2. **A widened default could over-reach.** If a future default adds a `**` glob it could match vendored or generated markdown a project never meant to govern. This will be mitigated by keeping every default entry root-or-specific (§3.3) and leaving broad globs to an explicit, reviewed project config.

## Compliance and Enforcement

Automated: `GEN-003-frontmatter.rules.ts` enforces one rule — `frontmatter-floor` (resolves each governed file to its matching `pathRules` entry, or the built-in default, and checks the floor, §2.1) — declared at the `error` tier per GEN-001 §7. The rule additionally emits a per-file report at the matched entry's configured tier through one code path; this repo's own config ships every entry at `error`, so the warning tier is exercised only by the rules-test. The shape of the harness config this rule reads is validated separately by GEN-002's `frontmatter-config-valid`.

**Manual review duties** (never linted): the built-in default's `pathRules` still describe the intended zero-config governance surface; new design ADRs authored via `/domain-modeling` are backfilled with `design-adr` frontmatter until that skill is patched (§4.2); a raised cap in a project config is justified by the file type rather than papering over one outlier.

**Toolchain note:** `.archgate/**` is deliberately outside the repo's eslint and `tsc --noEmit` gates ([#9](https://github.com/hancrafted/typescript-ai-harness/issues/9)); prettier and vitest cover `GEN-003-frontmatter.rules.ts` and its sibling test. `archgate check` is the sole gate on this ADR markdown.

**Templates/scaffolding:** the CLI seeding an editable starter config, and archgate growing to patch the `adr` key in `.typescript-ai-harness.json`, are designed in GEN-002 but deferred. Until then the built-in default is the shipped behavior.

**Exceptions:** raise a separate ADR; human approval required.

## References

- [Harness Config (GEN-002)](./GEN-002-harness-config.md) — the config file, `adr.frontmatter` schema, and first-match-wins evaluation this floor consumes.
- [ADR Contract (GEN-001)](./GEN-001-adr.md) — the shape and runtime-loading contract this ADR self-hosts under, and the sibling it dogfoods.
- [Google Open Knowledge Format (OKF)](https://github.com/google/open-knowledge-format) — the schema the floor is grounded on (`type` mandatory).
- [Agent Skills specification](https://code.claude.com/docs/en/skills) — origin of the `name ≤ 64` / `description ≤ 1024` default ceilings.
- Deferred and related work: [#7 AST-harden the meta-parsers](https://github.com/hancrafted/typescript-ai-harness/issues/7), [#9 script ADR + real-binary integration test](https://github.com/hancrafted/typescript-ai-harness/issues/9).
