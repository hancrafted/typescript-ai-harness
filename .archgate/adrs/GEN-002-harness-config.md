---
type: adr
id: GEN-002
title: "Harness Config"
domain: general
rules: true
paths: [".typescript-ai-harness.json", ".archgate/harness-config-core.d.ts", ".archgate/harness-config-extension.d.ts"]
description: "Owns the envelope of the root harness config `.typescript-ai-harness.json`: JSON-not-YAML, the seeded-never-patched lifecycle, the top-level semver `version` matched against the installed harness release, the fence grammar of the config extension (whose declared `namespace.block` paths form the closed set of legal config keys), and the domain-blind generic spine (FileSet include/exclude, pathRules, unmatched/coverage) every config block satisfies. This contract hardcodes no namespace and no block name — registration and payloads are owned wholesale by block ADRs such as GEN-003."
---

# Harness Config

## Context

**The problem:** The first cut of this contract validated the frontmatter block's *domain vocabulary*, so every new knob amended two ADRs in lockstep, and two silent-degradation holes shipped: a config with a JSON **syntax error**, and a **block-name typo** (`frontmater`), both silently reverted the repo to the built-in default with zero errors. The envelope/block restructure ([#19](https://github.com/hancrafted/typescript-ai-harness/issues/19)) fixed both — but its closed block registry lived *in this contract's rules file*, hardcoding `frontmatter`: the envelope owner still knew a block's name, and registering a block still meant editing GEN-002.

**The solution — a generic envelope with an extension-derived registry ([#30](https://github.com/hancrafted/typescript-ai-harness/issues/30)):** GEN-002 goes fully domain-blind. The shared config types split into a **core** file this contract owns (the generic spine and the `version` envelope — no namespace, no block) and an **extension** file where each block ADR declares its block inside a marker **fence**. The fences' declared `namespace.block` paths are the config's closed set of legal keys, read at check time — so the block-name-typo hole stays closed while this contract hardcodes no concrete name, and a new block never touches GEN-002. The top-level `version` ties a seeded config to the harness release that seeded it.

Alternatives considered: **central schema** (GEN-002 validates everything) — rejected: lockstep amendments and a domain-aware envelope; **registry-in-rules** (this contract's own #19 design) — rejected: the envelope owner still learns every block's name, and each registration edits this contract; **tool-owned patched key** (the `package.json`-merge model) — rejected: there is no safe auto-merge for an *ordered, first-match-wins* array; **folding into `.archgate/config.json`** and **YAML** — rejected as before (archgate's config stays clean; archgate is zero-dependency and JSON-native).

## Decision

### 1. The config file and its version envelope

1. Harness configuration lives in a single JSON file, `.typescript-ai-harness.json`, at the repo root, separate from `.archgate/config.json` so archgate's own config is never polluted with harness fields. JSON, not YAML: archgate reads it natively (`ctx.readJSON`) and ships no YAML parser.
2. The file is **seeded, never patched**: the CLI writes it once at install and never touches it on re-run (the glossary's "Seeded config file" lifecycle). Upgrades are an explicit, interactive **migrate step** — show the diff, restamp the version — never a silent rewrite.
3. A present file MUST parse. A config that exists but is not valid JSON is an error — never a silent fall-back to built-in defaults, which would enforce policy the file no longer describes. (📜 Rule: `config-json-parses`)
4. The top-level `version` is the compatibility envelope: required, a semver string **exactly equal** to the installed harness release (`package.json` `.version`). A mismatch errors and names the migrate step; a config authored for another release is never reinterpreted under this one's semantics. Exact-match is the honest pre-1.0 semantics — every `0.x` release may break the format; loosening to semver-range compatibility arrives with the migrate step ([#11](https://github.com/hancrafted/typescript-ai-harness/issues/11)). When `package.json` yields no version to compare against, the equality check is skipped — never guessed — while the stamp's presence and shape stay enforced. (📜 Rule: `config-version`)

### 2. The config extension — the fence-derived block registry

1. The config's shared types live in two hand-authored files: `.archgate/harness-config-core.d.ts` — owned by this contract, carrying the generic spine (§3) and the envelope, naming **no** namespace and **no** block — and `.archgate/harness-config-extension.d.ts`, where each block ADR declaration-merges its namespace and block into `Harness.Config` inside its own fence.
2. A fence is a marker-delimited region: `// <ADR-ID>-START: <namespace.block>` … `// <ADR-ID>-END`. Fences MUST be balanced, never nest or overlap, END matching the open START's ADR id and closing bare; every START declares one well-formed `namespace.block` path, unique across fences. The grammar is read by regex at check time — never by parsing TypeScript. (📜 Rule: `config-extension-fenced`)
3. The union of declared fence paths is the config's **closed set of legal keys** — the block registry. Each block ADR owns its fence *contents* wholesale: the payload types, and the block's schema, validation, interpretation, and built-in default. Adding a block = one fence plus an owning ADR; adding a knob to a block = zero changes outside that ADR. This contract is **never amended to register a block**.
4. Project-local governance extends the config the same way: its own fence (under a project-local ADR id) declaring its own `namespace.block`. This supersedes the retired free-top-level-keys extension surface — a top-level key that is not `version` is a namespace, and every `namespace.block` needs a declaring fence.

### 3. The generic shape and spine

1. The config is `{version, [namespace]: {[block]: ConfigBlock}}`, validated domain-blind: every top-level key beside `version` is a namespace object holding blocks; every **present** `namespace.block` key MUST match a fence-declared path (the typo guard — `markdown.frontmater` errors), while a declared path **absent** from the config is fine (the owner's built-in default applies — presence is never required); a block is a `ConfigBlock` exactly two key levels deep (the depth guard — a third nesting level is an error). Every block satisfies one domain-blind spine. Block level: closed keys `{unmatched, coverage, settings, pathRules}`; `unmatched` is `'exempt'` (default) or `'error'`; a `coverage` **FileSet** is present *iff* `unmatched` is `'error'`; `settings` (block-level knobs) and each entry's `rule` (per-path policy payload) are opaque JSON objects owned by the block's ADR. Entry level: closed keys `{include, exclude, exempt, severity, rule}`; a FileSet is `{include, exclude}` with `include` a non-empty array of non-empty globs; `exempt: true` entries carry neither `rule` nor `severity`; `severity` is `error` or `warning` (default `error`). (📜 Rule: `config-shape-valid`)
2. Evaluation grammar (declared here, executed by block owners): an entry's files are `glob(include) − glob(exclude)`; the **ordered** `pathRules` array is evaluated **first-match-wins** — the first entry whose FileSet contains a file *claims* it. The three-way semantics: an **exempt** entry claims and waives; an entry **exclude** means *not claimed* — the file falls through to later entries and ultimately to `unmatched`; a **coverage exclude** removes the file from the governed universe entirely.
3. Under `unmatched: 'error'`, the block owner reports every file in `coverage` that no entry claims, at the error tier — the strict posture for a surface where an unlisted file is a mistake. With `unmatched: 'exempt'`, posture stays emergent: govern what you list, everything else is exempt.
4. The consumer contract is **all-or-nothing**: config file absent, or a healthy file without the block → the block's built-in default; file present but unparseable, its `version` missing or skewed against the installed harness release, or the block spine- or payload-invalid → the block governs **nothing** — never best-effort interpretation, which enforces wrong policy while looking healthy. This contract's rules and the owner's payload validator are the loud gate; consumers distinguish absent from broken via a `readFile` probe.

### 4. Shared ambient types

1. Both type files declare into `namespace Harness` (never global interfaces, which would silently merge on a name collision); each fence attaches its namespace and block to `Harness.Config` via declaration merging, so the merged `Config` mirrors what the fences register. Rules files reference the types via triple-slash directives — compile-time only, erased at runtime, so archgate's no-imports constraint is untouched. This contract's rules reference **only the core file**; block owners reference the extension.
2. The generated `.archgate/rules.d.ts` is archgate's; hand-authored types never go there. The types are an authoring aid, not enforcement — the fence *grammar* is machine-checked, the fence *contents* are not type-analyzed, so keeping both files aligned with what the validators actually accept is a Manual review duty until the real-binary gate in [#9](https://github.com/hancrafted/typescript-ai-harness/issues/9).

## Do's and Don'ts

1. **DO** keep harness configuration in `.typescript-ai-harness.json` at the repo root and archgate's own config in `.archgate/config.json` — never merge the two, and keep the harness file parseable JSON. (Decision 1, 📜 Rule: `config-json-parses`)
2. **DO** stamp the top-level `version` with the harness release that seeded the config, and restamp it only through the migrate step. (Decision 1, 📜 Rule: `config-version`)
3. **DO** register a block by adding one fence to the config extension plus an owning ADR that defines payload, validation, interpretation, and default — never by editing this contract. (Decision 2, 📜 Rule: `config-extension-fenced`)
4. **DO** keep the config exactly two key levels deep — `{version, [namespace]: {[block]: …}}`, every present block fence-declared — and satisfy the generic spine in every block: FileSet `include`/`exclude` arrays, first-match-wins `pathRules`, `coverage` exactly when `unmatched` is `'error'`, all block vocabulary inside `rule`/`settings`. (Decision 3, 📜 Rule: `config-shape-valid`)
5. **DO** pick the right carve-out: `exempt` to claim-and-waive, an entry `exclude` to let a file fall through to later entries, a `coverage` exclude to remove it from the strict universe.
6. **DO** honor the all-or-nothing consumer contract when consuming a block: absent → built-in default; broken → govern nothing.

1. **DON'T** validate or interpret a block's `rule`/`settings` contents in this contract — payload vocabulary belongs to the block's owning ADR.
2. **DON'T** hardcode a namespace or block name in this contract's rules — the legal keys come from the extension's fences, nowhere else.
3. **DON'T** patch the seeded config on re-run — upgrades go through the interactive migrate step (diff + version restamp).
4. **DON'T** best-effort-skip invalid pieces of a block when consuming it — a block that fails validation governs nothing.
5. **DON'T** add hand-authored types to the generated `rules.d.ts`, edit another ADR's fence, or park block types outside every fence — core is this contract's, each fence is its owner's.
6. **DON'T** park project-local governance at an undeclared config key — give it its own fence and a project-local ADR.

## Consequences

**Positive:**

1. **Zero-touch growth:** a new knob touches only its block ADR; a new block is one fence plus its own ADR — this contract is amended for neither.
2. **Silent holes stay closed, without coupling:** unparseable JSON, block-name typos, version skew, and payload typos all error loudly, yet no block name appears in this contract — the typo guard derives from the owners' own fences.
3. **One grammar for all futures:** every block inherits FileSet arithmetic, first-match-wins claiming, exempt-vs-exclude semantics, and the strict coverage posture without redesign.
4. **Portable and self-describing:** rules stay byte-identical across projects; the config data differs, and its `version` stamp names exactly which harness release wrote it.

**Negative:**

1. **The spine is structurally duplicated in consumers:** archgate rules cannot share runtime code, so each block owner carries a boolean copy of the spine walk (and the version probe) to honor the all-or-nothing contract. Mitigated: the shared conformance fixtures in `test/fixtures/` are imported by both rules tests, so validator and consumer are exercised against identical inputs.
2. **Exact-match version ceremony:** every harness release bump invalidates seeded configs until they are restamped — deliberate pre-1.0 honesty, relieved by the migrate step and semver-range compatibility in [#11](https://github.com/hancrafted/typescript-ai-harness/issues/11). And in a seeded target project, `package.json` is the *target's* version, not the harness's — the version source of truth there is a [#11](https://github.com/hancrafted/typescript-ai-harness/issues/11) concern; for this repo's self-application they coincide.
3. **The registry rides on comment markers:** fences are regex-parsed comments, so the machine guarantee covers the grammar only — a declaration outside every fence, or fence contents drifting from the owner's real schema, is invisible to it (a Manual review duty).
4. **Every block is spine-shaped:** a future non-path-scoped (freeform) block has no fence vocabulary yet and would need a fence-grammar extension through an explicit amendment here — accepted; no such block exists, and the earlier registry's speculative `freeform` shape kind is retired with it.

**Risks:**

1. **Evaluator-copy drift:** this contract's reporting validator and a block owner's boolean spine walk could disagree, making a config one side accepts and the other refuses. Mitigation: the shared fixtures assert both sides on the same inputs, and the GEN-002 test suite also runs the four rules against the *live* repo files.
2. **Grammar rides on regex parsing:** fence markers and the frontmatter meta-parsers alike are regex-based conventions; hardening to AST parsing is tracked in [#7](https://github.com/hancrafted/typescript-ai-harness/issues/7).

## Compliance and Enforcement

Automated: `GEN-002-harness-config.rules.ts` enforces four rules, all declared at the `error` tier per GEN-001 §7 — `config-json-parses` (§1.3), `config-version` (§1.4), `config-extension-fenced` (§2.2), `config-shape-valid` (§3.1). All no-op when the config file is absent, so the contract is safe to ship before the config is seeded; the fence rule likewise no-ops when the extension file is absent (no fences, no registry). Block payloads are validated by their owners (frontmatter: GEN-003's `frontmatter-config-valid`); block interpretation is enforced by the owners' consumers (GEN-003's `frontmatter-floor`).

**Manual review duties** (never linted): the core types stay aligned with what this contract's validator actually accepts; each fence's contents stay within its declared `namespace.block` surface and match the owning ADR's real payload schema (the grammar is machine-checked, the contents are not); each fence's ADR id names a real, owning ADR; a config's `coverage` FileSet actually describes the intended strict universe; [docs/agents/frontmatter-config.md](../../docs/agents/frontmatter-config.md) stays aligned with the envelope and spine this contract validates; the migrate-step design is honored when [#11](https://github.com/hancrafted/typescript-ai-harness/issues/11) builds seeding.

**Toolchain note:** `.archgate/**` is deliberately outside the repo's eslint gate ([#9](https://github.com/hancrafted/typescript-ai-harness/issues/9)); prettier and vitest cover the rules and test files, `tsc --noEmit` covers both `.d.ts` files and the shared fixtures, and the root `.typescript-ai-harness.json` is prettier-checked. `archgate check` gates this ADR markdown, the config's contents, and the extension's fences.

**Templates/scaffolding:** deferred to [#11](https://github.com/hancrafted/typescript-ai-harness/issues/11): the CLI seeds `.typescript-ai-harness.json` (stamping `version` with the seeding release), `harness-config-core.d.ts`, and `harness-config-extension.d.ts` (never `rules.d.ts`), and implements the interactive migrate step for later releases.

**Exceptions:** raise a separate ADR; human approval required.

## References

- [Frontmatter Contract (GEN-003)](./GEN-003-frontmatter.md) — the first block owner: its fence declares `markdown.frontmatter`; payload schema, interpretation, and built-in default live there.
- [Frontmatter configuration reference](../../docs/agents/frontmatter-config.md) — option-by-option user reference for the envelope, spine, and the frontmatter block.
- [ADR Contract (GEN-001)](./GEN-001-adr.md) — the shape and runtime-loading contract this ADR self-hosts under.
- [Spec #19](https://github.com/hancrafted/typescript-ai-harness/issues/19) and [refinement #30](https://github.com/hancrafted/typescript-ai-harness/issues/30) — the envelope/block restructure, then the core/extension split with the fence-derived registry this contract implements.
- [Distribution model (ADR-0001)](../../docs/adr/0001-github-git-spec-tsx-distribution.md) — the runtime-dependency firewall that forces JSON over YAML.
- [archgate integration (ADR-0005)](../../docs/adr/0005-archgate-integration.md) — the integration that seeds the config in target projects ([#11](https://github.com/hancrafted/typescript-ai-harness/issues/11)).
