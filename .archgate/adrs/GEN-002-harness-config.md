---
type: adr
id: GEN-002
title: "Harness Config"
domain: general
rules: true
paths: [".typescript-ai-harness.json", ".archgate/harness-config.d.ts"]
description: "Owns the envelope of the root harness config `.typescript-ai-harness.json`: JSON-not-YAML, the seeded-never-patched lifecycle, the `markdown` namespace with its format version stamp and closed block registry, and the domain-blind generic spine (FileSet include/exclude, pathRules, unmatched/coverage) every path-scoped block satisfies. Block payloads (`rule`, `settings`) are opaque here — owned wholesale by block ADRs such as GEN-003."
---

# Harness Config

## Context

**The problem:** The first cut of this contract validated the frontmatter block's *domain vocabulary* (`allowedTypes`, `maxDescription`, …) while GEN-003 interpreted it — so every new knob amended two ADRs in lockstep (commit `0e3ddef` demonstrated it live), and the boundary between "config shape" and "config meaning" was a judgment call per key. Worse, two silent-degradation holes shipped: a config with a JSON **syntax error**, and a **block-name typo** (`frontmater`), both silently reverted the repo to the built-in default with zero errors — the config lied about being in force.

**The solution — the `package.json` model:** GEN-002 becomes the **envelope**: the file's location and lifecycle, a closed **block registry** under one namespace, and a **generic, domain-blind spine** every path-scoped block satisfies. Each registered block is owned *wholesale* by its own ADR — payload schema, validation, interpretation, and built-in default (frontmatter: GEN-003). Adding a block is one registry line; adding a knob to a block touches GEN-002 not at all. A 2026-07-21 adversarial architecture review added the hardening that is cheap now and breaking later: the format version stamp, retired-key tombstones, the coverage FileSet, registry shape kinds, and the all-or-nothing consumer contract.

Alternatives considered: **central schema** (GEN-002 validates everything) — rejected: lockstep amendments and a domain-aware envelope; **flat single-block format** — rejected: no growth path for sibling blocks; **tool-owned patched key** (the `package.json`-merge model, this contract's own first design) — rejected: there is no safe auto-merge for an *ordered, first-match-wins* array, so re-seeding could silently reorder policy; **folding into `.archgate/config.json`** and **YAML** — rejected as before (archgate's config stays clean; archgate is zero-dependency and JSON-native).

## Decision

### 1. The config file

1. Harness configuration lives in a single JSON file, `.typescript-ai-harness.json`, at the repo root, separate from `.archgate/config.json` so archgate's own config is never polluted with harness fields. JSON, not YAML: archgate reads it natively (`ctx.readJSON`) and ships no YAML parser.
2. The file is **seeded, never patched**: the CLI writes the `markdown` key once at install and never touches it on re-run (the glossary's "Seeded config file" lifecycle). Format upgrades are an explicit, interactive **migrate step** — show the diff, bump the version — never a silent rewrite. This supersedes the retired tool-owned-patched-key design.
3. A present file MUST parse. A config that exists but is not valid JSON is an error — never a silent fall-back to built-in defaults, which would enforce policy the file no longer describes. (📜 Rule: `config-json-parses`)

### 2. The `markdown` namespace and block registry

1. Markdown governance lives under the top-level `markdown` key, named for what its blocks govern (markdown files), not for who consumes them. When `markdown` exists it MUST carry `version` — a positive integer equal to the current format version (1) — the skew detector between a seeded config and the rules that read it; a mismatch errors and names the migrate step. `version` is reserved format metadata, never a block.
2. Every other key under `markdown` MUST be a **registered block**. The registry is closed and lives in this contract's rules file; each entry carries its owning ADR and a **shape kind** — `path-scoped` (satisfies the spine, §3) or `freeform` (a JSON object whose whole shape the owner defines). Retired keys are **tombstoned**: the pre-v1 top-level `adr` key and the entry-level `match` key error with their rename, never silently ignored. (📜 Rule: `config-namespace-registered`)
3. The block-owner convention: a block's ADR owns its payload schema (closed keys — unknown keys are errors), its interpretation, and its built-in default, wholesale. Adding a block = one registry line + an owning ADR; adding a knob to a block = zero GEN-002 changes.
4. Top-level keys beside `markdown` stay free — the consumer-extension surface. Project-local governance MUST NOT squat inside `markdown` (unregistered blocks error); it lives at its own top-level key with a project-local ADR.

### 3. The generic spine

1. Every `path-scoped` block satisfies one domain-blind grammar. Block level: closed keys `{unmatched, coverage, settings, pathRules}`; `unmatched` is `'exempt'` (default) or `'error'`; a `coverage` **FileSet** is present *iff* `unmatched` is `'error'`; `settings` (block-level knobs) and each entry's `rule` (per-path policy payload) are opaque JSON objects owned by the block's ADR. Entry level: closed keys `{include, exclude, exempt, severity, rule}`; a FileSet is `{include, exclude}` with `include` a non-empty array of non-empty globs; `exempt: true` entries carry neither `rule` nor `severity`; `severity` is `error` or `warning` (default `error`). (📜 Rule: `config-spine-valid`)
2. Evaluation grammar (declared here, executed by block owners): an entry's files are `glob(include) − glob(exclude)`; the **ordered** `pathRules` array is evaluated **first-match-wins** — the first entry whose FileSet contains a file *claims* it. The three-way semantics: an **exempt** entry claims and waives; an entry **exclude** means *not claimed* — the file falls through to later entries and ultimately to `unmatched`; a **coverage exclude** removes the file from the governed universe entirely.
3. Under `unmatched: 'error'`, the block owner reports every file in `coverage` that no entry claims, at the error tier — the strict posture for a surface where an unlisted file is a mistake. With `unmatched: 'exempt'`, posture stays emergent: govern what you list, everything else is exempt.
4. The consumer contract is **all-or-nothing**: config file absent, or a healthy file without the block → the block's built-in default; file present but unparseable, version skewed, or the block spine- or payload-invalid → the block governs **nothing** — never best-effort interpretation, which enforces wrong policy while looking healthy. This contract's rules and the owner's payload validator are the loud gate; consumers distinguish absent from broken via a `readFile` probe.

### 4. Shared ambient types

1. The config's types live in the hand-authored, committed `.archgate/harness-config.d.ts` under `declare namespace Harness` (never global interfaces, which would silently merge on a name collision). Rules files reference it via a triple-slash directive — compile-time only, erased at runtime, so archgate's no-imports constraint is untouched.
2. The generated `.archgate/rules.d.ts` is archgate's; hand-authored types never go there. The types are an authoring aid, not enforcement — keeping them aligned with the validators is a Manual review duty until the real-binary gate in [#9](https://github.com/hancrafted/typescript-ai-harness/issues/9).

## Do's and Don'ts

1. **DO** keep harness configuration in `.typescript-ai-harness.json` at the repo root and archgate's own config in `.archgate/config.json` — never merge the two, and keep the harness file parseable JSON. (Decision 1, 📜 Rule: `config-json-parses`)
2. **DO** stamp `markdown.version`, and add a block only by registering it — one registry line plus an owning ADR that defines payload, validation, interpretation, and default. (Decision 2, 📜 Rule: `config-namespace-registered`)
3. **DO** satisfy the generic spine in every path-scoped block — FileSet `include`/`exclude` arrays, first-match-wins `pathRules`, `coverage` exactly when `unmatched` is `'error'` — and keep all block vocabulary inside `rule`/`settings`. (Decision 3, 📜 Rule: `config-spine-valid`)
4. **DO** pick the right carve-out: `exempt` to claim-and-waive, an entry `exclude` to let a file fall through to later entries, a `coverage` exclude to remove it from the strict universe.
5. **DO** honor the all-or-nothing consumer contract when consuming a block: absent → built-in default; broken → govern nothing.
6. **DO** put project-local governance at a free top-level key with its own ADR — never as an unregistered block inside `markdown`.

1. **DON'T** validate or interpret a block's `rule`/`settings` contents in this contract — payload vocabulary belongs to the block's owning ADR.
2. **DON'T** patch the seeded `markdown` key on re-run — format upgrades go through the interactive migrate step (diff + version bump).
3. **DON'T** resurrect retired keys — top-level `adr` and entry-level `match` are tombstoned and error with their rename.
4. **DON'T** best-effort-skip invalid pieces of a block when consuming it — a block that fails validation governs nothing.
5. **DON'T** add hand-authored types to the generated `rules.d.ts` — shared config types live only in `harness-config.d.ts`.

## Consequences

**Positive:**

1. **Zero-lockstep growth:** a new frontmatter knob (timestamps, TTL, line caps, …) touches only its block ADR; a new governance surface is one registry line plus its own ADR.
2. **Silent holes closed:** unparseable JSON, block-name typos, retired keys, version skew, and payload typos all error loudly instead of silently reverting to defaults or weakening the floor.
3. **One grammar for all futures:** every path-scoped block inherits FileSet arithmetic, first-match-wins claiming, exempt-vs-exclude semantics, and the strict coverage posture without redesign.
4. **Portable:** rules stay byte-identical across projects; only the config data differs — including the strictness posture, which is data (`unmatched` + `coverage`).

**Negative:**

1. **The spine is structurally duplicated in consumers:** archgate rules cannot share runtime code, so each block owner carries a boolean copy of the spine walk (and the format version constant) to honor the all-or-nothing contract. Mitigated: the shared conformance fixtures in `test/fixtures/` are imported by both rules tests, so validator and consumer are exercised against identical inputs.
2. **Version ceremony while only v1 exists:** every config carries `version: 1` that no migrate step yet consumes. Accepted — retrofitting a version stamp after target projects are seeded is a breaking change; stamping now is free.
3. **More envelope surface:** three rules instead of one, plus a registry and tombstones to maintain. Accepted as the cost of a domain-blind boundary.

**Risks:**

1. **Evaluator-copy drift:** GEN-002's reporting validator and a block owner's boolean spine walk could disagree, making a config one side accepts and the other refuses. Mitigation: the shared fixtures assert both sides on the same inputs; any divergence fails a test before it ships.
2. **Registry as bottleneck:** every new block needs a GEN-002 edit. Accepted deliberately — one reviewed line is the anti-squatting gate that keeps `markdown` closed.

## Compliance and Enforcement

Automated: `GEN-002-harness-config.rules.ts` enforces three rules, all declared at the `error` tier per GEN-001 §7 — `config-json-parses` (§1.3), `config-namespace-registered` (§2.1–2.2), `config-spine-valid` (§3.1). All no-op when the config file is absent, so the contract is safe to ship before the config is seeded. Block payloads are validated by their owners (frontmatter: GEN-003's `frontmatter-config-valid`); block interpretation is enforced by the owners' consumers (GEN-003's `frontmatter-floor`).

**Manual review duties** (never linted): `harness-config.d.ts` stays aligned with what the validators actually accept (§4.2); the registry's owner references point at real ADRs; a config's `coverage` FileSet actually describes the intended strict universe; [docs/agents/frontmatter-config.md](../../docs/agents/frontmatter-config.md) stays aligned with the spine this contract validates; the migrate-step design is honored when [#11](https://github.com/hancrafted/typescript-ai-harness/issues/11) builds seeding.

**Toolchain note:** `.archgate/**` is deliberately outside the repo's eslint gate ([#9](https://github.com/hancrafted/typescript-ai-harness/issues/9)); prettier and vitest cover the rules and test files, `tsc --noEmit` covers `harness-config.d.ts` and the shared fixtures, and the root `.typescript-ai-harness.json` is prettier-checked. `archgate check` gates this ADR markdown and the config's contents.

**Templates/scaffolding:** deferred to [#11](https://github.com/hancrafted/typescript-ai-harness/issues/11): the CLI seeds `.typescript-ai-harness.json` (stamping `version`) and `harness-config.d.ts` (never `rules.d.ts`), and implements the interactive migrate step for future format bumps.

**Exceptions:** raise a separate ADR; human approval required.

## References

- [Frontmatter Contract (GEN-003)](./GEN-003-frontmatter.md) — the first registered block's owner: payload schema, interpretation, built-in default.
- [Frontmatter configuration reference](../../docs/agents/frontmatter-config.md) — option-by-option user reference for the spine and the frontmatter block.
- [ADR Contract (GEN-001)](./GEN-001-adr.md) — the shape and runtime-loading contract this ADR self-hosts under.
- [Spec #19](https://github.com/hancrafted/typescript-ai-harness/issues/19) — the envelope/block restructure this contract implements, including the 2026-07-21 adversarial review findings.
- [Distribution model (ADR-0001)](../../docs/adr/0001-github-git-spec-tsx-distribution.md) — the runtime-dependency firewall that forces JSON over YAML.
- [archgate integration (ADR-0005)](../../docs/adr/0005-archgate-integration.md) — the integration that seeds the config in target projects ([#11](https://github.com/hancrafted/typescript-ai-harness/issues/11)).
