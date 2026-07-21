---
type: adr
id: GEN-002
title: "Harness Config"
domain: general
rules: true
paths: [".typescript-ai-harness.json"]
description: "Owns the root harness config `.typescript-ai-harness.json`: its location and separation from archgate's own config, JSON-not-YAML, seeding, and the `adr.frontmatter` schema — pathRules, unmatched, draftEscape — evaluated first-match-wins, with a project's config replacing the built-in default."
---

# Harness Config

## Context

**The problem:** The frontmatter floor (GEN-003) needs a per-project governance surface — which paths are governed, which types each allows, which label each pins — but that surface differs in every repo. Baking it into the rules would make the rules unportable; scattering it across ad-hoc files would make it undiscoverable.

**The solution:** A single, root-level **harness config**, `.typescript-ai-harness.json`, carries all harness configuration as data. Frontmatter governance lives under its `adr.frontmatter` key, and the file has room to grow other harness concerns beside it. The rules read this one file, so the same rule code serves every project and only the data differs.

Alternatives considered: **folding the config into `.archgate/config.json`** — rejected so archgate's own config is never polluted with harness fields, and so the harness owns its file outright; **YAML** — rejected because archgate ships zero runtime dependencies and its rule API is JSON-native (`ctx.readJSON`), so JSON needs no parser; **a mode flag** (`allowlist` vs `denylist`) to select enforcement posture — rejected because posture is instead made *emergent* from which paths a project declares (§3.3). This contract governs the config file and its schema only; the `type` semantics and the floor these rules feed are owned by GEN-003.

## Decision

### 1. The config file

1. Harness configuration lives in a single JSON file, `.typescript-ai-harness.json`, at the repo root, kept separate from `.archgate/config.json` so archgate's own config is never polluted with harness fields.
2. The file is JSON (not YAML) because archgate is zero-dependency and JSON-native (`ctx.readJSON`). It is seeded once by the CLI, and only its `adr` key is tool-owned — surgically patched on re-run (the `package.json`-merge model), leaving the rest hand-editable and room under `adr` for future ADR-governance config beyond `adr.frontmatter`.
3. Everything the floor needs sits under `adr.frontmatter`; a project without the file, or without that block, falls back to GEN-003's built-in default.

### 2. The `adr.frontmatter` schema

1. The `adr.frontmatter` block MUST be well-formed or enforcement integrity is compromised: `pathRules` MUST be an array; each entry MUST carry a `match` glob (a string, or a non-empty array of strings); optional `allowedTypes` MUST be kebab-case strings; `label` MUST be `name` or `title`; an entry's `severity` (its enforcement tier) MUST be `error` or `warning`; `maxLabel`/`maxDescription` MUST be positive integers; `unmatched` MUST be `exempt` and `draftEscape` a boolean. A malformed block surfaces as an error rather than silently disabling the floor. (📜 Rule: `frontmatter-config-valid`)
2. Each `pathRules` entry is one of three cases: `exempt: true` (floor off for matched files), `allowedTypes: [...]` (floor on, closed membership), or neither (floor on, membership open to any kebab-case `type`). `label` pins the single required label (`name` xor `title`); `maxLabel`/`maxDescription` raise the OKF ceilings (defaults 64 and 1024) for that entry.

### 3. Evaluation

1. `adr.frontmatter` declares a single `unmatched` default (`exempt`), an optional `draftEscape` flag, and an **ordered** `pathRules` array evaluated **first-match-wins**: a file resolves to the first entry whose `match` glob(s) hit, and a file matching no entry is `unmatched` (exempt).
2. A project's `adr.frontmatter` block, when present, **replaces** GEN-003's built-in default outright — it never merges — so the declared policy is the whole policy; when the block is absent, the default applies.
3. Enforcement posture is **emergent**, not a mode flag: a greenfield project declares only the paths it governs and lets everything else fall to `unmatched: exempt` (zero install blast radius); a brownfield project lists exempt globs first and ends with a catch-all entry. One evaluation model serves both.

## Do's and Don'ts

1. **DO** keep harness configuration in `.typescript-ai-harness.json` at the repo root, and archgate's own config in `.archgate/config.json` — never merge the two.
2. **DO** validate the `adr.frontmatter` block's shape so a malformed config fails loudly instead of silently disabling the floor. (Decision 2, 📜 Rule: `frontmatter-config-valid`)
3. **DO** order `pathRules` deliberately and rely on first-match-wins — put exempt globs before a catch-all when governing a brownfield surface.
4. **DO** express enforcement posture through which paths you declare, letting `unmatched: exempt` absorb everything else, rather than reaching for a mode flag.
5. **DO** raise `maxLabel`/`maxDescription` on a single `pathRules` entry when a file type legitimately needs a longer label or description, leaving the OKF defaults everywhere else.
6. **DO** write the config as JSON — archgate reads it with `ctx.readJSON`, and the toolchain ships no YAML parser.

1. **DON'T** put harness fields in `.archgate/config.json`, or archgate fields in `.typescript-ai-harness.json`.
2. **DON'T** add a mode flag or a second rule to model allowlist vs denylist — posture is emergent and severity is per-entry data.
3. **DON'T** expect a project's `adr.frontmatter` to merge with the built-in default — it replaces it, so re-declare every path the project governs.
4. **DON'T** widen a `pathRules` entry's caps globally to fix one outlier file — raise the cap on that single entry instead.

## Consequences

**Positive:**

1. **Portable rules, per-project data:** the floor's rule code is byte-identical everywhere; only `.typescript-ai-harness.json` differs, so one contract serves greenfield and brownfield alike.
2. **archgate's config stays clean:** harness concerns never leak into `.archgate/config.json`.
3. **No new dependency:** JSON is read by the native `ctx.readJSON`, honoring the zero-runtime-dependency firewall.
4. **Single evaluation model:** ordered `pathRules` + first-match-wins + one `unmatched: exempt` default is the only model to reason about; posture is emergent.
5. **Ratcheting is a data edit:** tightening a warning entry to error, or a cap, is a reviewed one-line config change in a PR — no code change, no ADR amendment ceremony.
6. **Room to grow:** the `adr` key namespaces frontmatter config today and leaves space for further ADR-governance settings without a new file.

**Negative:**

1. **A second config surface:** the harness config is one more file to seed and keep aligned with real intent — mitigated by `frontmatter-config-valid` failing on a malformed block and by the CLI seeding a starter (deferred).
2. **Replace-not-merge is a foot-gun:** a project that declares `adr.frontmatter` silently loses the built-in default, so a forgotten path goes ungoverned — mitigated by the CLI seeding the default as the visible starting point (deferred) and by reviewing the config's coverage.
3. **Validity rides on hand-checks, not a schema language:** the validator checks each field by hand, so adding a field means editing the validator. Accepted as the cost of zero dependencies.

**Risks:**

1. **A malformed config could silently disable governance.** If validation missed a case, a broken block might parse as "no rules" and pass. This will be mitigated by `frontmatter-config-valid` erroring on any shape violation, and by the floor treating a present-but-broken block as governing nothing rather than falling back to the default — so the gap is visible, not masked.
2. **Glob breadth on install.** A brownfield catch-all entry could match vendored or generated markdown a project never meant to govern. This will be mitigated by the exempt-first ordering pattern (§3.3) and by the CLI seeding a conservative starter (deferred).

## Compliance and Enforcement

Automated: `GEN-002-harness-config.rules.ts` enforces one rule — `frontmatter-config-valid` (validates the `adr.frontmatter` block, §2.1) — declared at the `error` tier per GEN-001 §7. It no-ops when the config file or its `adr.frontmatter` block is absent, so the contract is safe to ship before the config is seeded. The floor that consumes this config is enforced separately by GEN-003's `frontmatter-floor`.

**Manual review duties** (never linted): the config's `pathRules` globs actually describe the intended governance surface; each entry's `label` and `allowedTypes` match the file type it governs; a project that overrides the default re-declares every path it means to keep governing; raised caps (`maxLabel`/`maxDescription`) are justified by the file type.

**Toolchain note:** `.archgate/**` is deliberately outside the repo's eslint and `tsc --noEmit` gates ([#9](https://github.com/hancrafted/typescript-ai-harness/issues/9)); prettier and vitest cover `GEN-002-harness-config.rules.ts` and its sibling test, and the root `.typescript-ai-harness.json` is prettier-checked. `archgate check` gates this ADR markdown and the config's contents.

**Templates/scaffolding:** the CLI seeding `.typescript-ai-harness.json` with the default as an editable starter, and archgate growing to patch the tool-owned `adr` key (the `package.json`-merge model), are designed here but deferred ([#11](https://github.com/hancrafted/typescript-ai-harness/issues/11) scope).

**Exceptions:** raise a separate ADR; human approval required.

## References

- [Frontmatter Contract (GEN-003)](./GEN-003-frontmatter.md) — the `type` semantics and floor that consume this config; the built-in default lives there.
- [ADR Contract (GEN-001)](./GEN-001-adr.md) — the shape and runtime-loading contract this ADR self-hosts under.
- [Distribution model (ADR-0001)](../../docs/adr/0001-github-git-spec-tsx-distribution.md) — the runtime-dependency firewall that forces JSON over YAML.
- [archgate integration (ADR-0005)](../../docs/adr/0005-archgate-integration.md) — the integration that will seed and patch the config's `adr` key in target projects.
