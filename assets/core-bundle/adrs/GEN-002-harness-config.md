---
type: adr
id: GEN-002
title: "Harness Config"
domain: general
rules: true
paths: [".typescript-ai-harness.json", ".archgate/harness-config-core.d.ts", ".archgate/harness-config-extension.d.ts"]
description: "Owns the envelope of the root harness config `.typescript-ai-harness.json`: JSON validity, the seeded-never-patched lifecycle, the top-level semver `version` matched to the installed harness release, the fence grammar whose declared `namespace.block` paths form the closed set of legal keys, and the domain-blind generic spine every config block satisfies. Hardcodes no namespace or block name — registration and payloads are owned by block ADRs such as GEN-003."
---

# Harness Config

## Context

The harness config `.typescript-ai-harness.json` is data that future ADRs can consume to allow the user to configure governance, since the ADRs are designed to be portable across projects. This contract owns its **envelope** — file location, JSON validity, lifecycle, `version` — and a domain-blind generic **spine** every config block shares; each block ADR owns its own block wholesale. GEN-002 never learns a block's domain vocabulary, so a new block is one fence plus its own ADR and a new knob touches only its owning ADR.

The legal config keys are not hardcoded here. Shared types split into a **core** file this contract owns (spine + `version` envelope, naming no namespace or block) and an **extension** file where each block ADR declares its block inside a marker **fence**. The fences' declared `namespace.block` paths form the closed set of legal keys, read at check time — closing the block-name-typo hole while keeping this contract domain-blind.

Rejected alternatives:

- **Central schema** (GEN-002 validates every block) — lockstep two-ADR amendments and a domain-aware envelope.
- **Registry-in-rules** (legal keys hardcoded in this rules file) — the envelope owner still learns every block's name.
- **Tool-owned patched key** (the `package.json`-merge model) — no safe auto-merge for an ordered, first-match-wins array.
- **Folding into `.archgate/config.json`, or YAML** — archgate's config stays clean; archgate is zero-dependency and JSON-native.

## Decision

### 1. The config file and version envelope

1. **Location:** Harness config is a single JSON file, `.typescript-ai-harness.json`, at the repo root — separate from `.archgate/config.json`. JSON, not YAML: archgate reads it natively (`ctx.readJSON`) and ships no YAML parser.
2. **Seeded, never patched:** The CLI writes the file once at install and never touches it on re-run. Upgrades are an explicit, interactive **migrate step** — show the diff, restamp the version — never a silent rewrite.
3. **JSON Validity (📜 Rule: `config-json-parses`):** A present file MUST parse. A file that exists but is not valid JSON is an error — never a silent fall-back to defaults, which would enforce policy the file no longer describes.
4. **Version Envelope (📜 Rule: `config-version`):** The top-level `version` is required and MUST be a semver string everywhere.
    1. **Exact match, self only:** The stamp MUST equal the installed harness release **only where `package.json` names the harness itself** (`@hancrafted/typescript-ai-harness` — dogfooding), the sole project where the stamp and `package.json` `.version` name the same release; a mismatch there errors and names the migrate step. A config authored for another release is never reinterpreted under this one's semantics.
    2. **Foreign target carries, never compares:** In any other project `package.json` `.version` is the target app's, not the harness's, and the harness is unresolvable under ephemeral `npx` — so the stamp is carried for the migrate engine but never equality-checked, else a fresh install would false-fail on install. Cross-release comparison lands with the migrate engine ([#68](https://github.com/hancrafted/typescript-ai-harness/issues/68)).
    3. **Pre-1.0 honesty:** Exact-match (where it applies) is deliberate — every `0.x` release may break the format. Loosening to semver-range compatibility arrives with the migrate engine.
    4. **No source of truth:** When `package.json` does not name the harness or yields no version, the equality check is skipped — never guessed — while the stamp's presence and semver shape stay enforced.

### 2. The config extension — fence-derived registry

1. **Two type files:** `.archgate/harness-config-core.d.ts` — owned here, carrying the spine (§3) and envelope, naming **no** namespace or block; and `.archgate/harness-config-extension.d.ts`, where each block ADR declaration-merges its namespace and block into `Harness.Config` inside its own fence.
2. **Fence Grammar (📜 Rule: `config-extension-fenced`):** A fence is a marker-delimited region — `// <ADR-ID>-START: <namespace.block>` … `// <ADR-ID>-END`.
    1. **Balanced:** Fences MUST NOT nest or overlap; each END matches the open START's ADR id and closes bare.
    2. **Well-formed path:** Each START declares one `namespace.block` path, unique across fences.
    3. **Regex-read:** The grammar is read by regex at check time — never by parsing TypeScript.
3. **The registry:** The union of declared fence paths is the config's **closed set of legal keys**. Each block ADR owns its fence *contents* wholesale — payload types, schema, validation, interpretation, and built-in default. Adding a block = one fence plus an owning ADR; adding a knob = zero changes outside that ADR. This contract is **never amended to register a block**.
4. **Project-local extension:** Project governance extends the config the same way — its own fence (under a project-local ADR id) declaring its own `namespace.block`. Free top-level keys are retired: a top-level key that is not `version` is a namespace, and every `namespace.block` needs a declaring fence.

### 3. The generic shape and spine

1. **Config Shape Validity (📜 Rule: `config-shape-valid`):** The shape, its closed keys, and their defaults are declared and documented in [`harness-config-core.d.ts`](../harness-config-core.d.ts) — `ConfigBlock`, `PathRule`, `FileSet`, and the `Config` envelope. That file is the authoring reference; this rule enforces it domain-blind (the types aid authoring, they do not enforce — §4.2). The config is exactly `{version, [namespace]: {[block]: ConfigBlock}}`, with unknown keys rejected at every level, plus the guards and cross-field invariants the types cannot express:
    1. **Namespace typo guard:** every **present** `namespace.block` key MUST match a fence-declared path — `markdown.frontmater` errors.
    2. **Optional presence:** a declared path **absent** from the config is fine — the owner's built-in default applies, so presence is never required.
    3. **Depth guard:** a block is a `ConfigBlock` exactly two key levels deep — a third nesting level errors.
    4. **Cross-field invariants:** a `coverage` FileSet is present *iff* `unmatched` is `'error'` (both directions), and an `exempt` entry carries neither `rule` nor `severity`. The per-field defaults and shapes those keys carry — along with the opaque `settings`/`rule` payloads — live at their declaration in the core types above, not restated here.
2. **Evaluation grammar** (declared here, executed by block owners):
    1. **Entry files:** An entry's files are `glob(include) − glob(exclude)`.
    2. **First-match-wins:** The **ordered** `pathRules` array is evaluated first-match-wins — the first entry whose FileSet contains a file *claims* it.
    3. **Three-way carve-outs:** An **exempt** entry claims and waives; an entry **exclude** means *not claimed* (the file falls through to later entries, then to `unmatched`); a **coverage exclude** removes the file from the governed universe entirely.
3. **Coverage posture:** Under `unmatched: 'error'`, the block owner reports every file in `coverage` that no entry claims, at the error tier — the strict posture where an unlisted file is a mistake. Under `unmatched: 'exempt'`, posture stays emergent — govern what you list, everything else is exempt.
4. **Consumer contract (all-or-nothing):**
    1. **Absent → default:** Config file absent, or a healthy file without the block → the block's built-in default.
    2. **Broken → nothing:** File unparseable, `version` missing or skewed, or the block spine- or payload-invalid → the block governs **nothing**, never best-effort interpretation (which enforces wrong policy while looking healthy).
    3. **Probe:** This contract's rules and the owner's payload validator are the loud gate; consumers distinguish absent from broken via a `readFile` probe.

### 4. Shared ambient types

1. **Namespace, not globals:** Both files declare into `namespace Harness` (never global interfaces, which silently merge on a collision); each fence attaches its block to `Harness.Config` via declaration merging. Rules files reference the types via triple-slash directives — compile-time only, so archgate's no-imports constraint is untouched. This contract's rules reference **only the core file**; block owners reference the extension.
2. **Authoring aid, not enforcement:** Hand-authored types never go in the generated `.archgate/rules.d.ts`. The fence *grammar* is machine-checked; the fence *contents* are not, so keeping both `.d.ts` files aligned with the validators is a Manual review duty (see the core file's header).

## Do's and Don'ts

### Do's

1. **DO** keep harness config in `.typescript-ai-harness.json` at the repo root, parseable JSON, separate from `.archgate/config.json`. (Decision 1, 📜 Rule: `config-json-parses`)
2. **DO** stamp `version` with the seeding release and restamp it only through the migrate step. (Decision 1, 📜 Rule: `config-version`)
3. **DO** register a block with one fence plus an owning ADR — never by editing this contract. (Decision 2, 📜 Rule: `config-extension-fenced`)
4. **DO** keep the config two levels deep, every present block fence-declared and spine-valid. (Decision 3, 📜 Rule: `config-shape-valid`)
5. **DO** pick the right carve-out: `exempt` (claim-and-waive), entry `exclude` (fall through), `coverage` exclude (leave the strict universe).
6. **DO** honor the all-or-nothing contract: absent → default; broken → govern nothing.

### Don'ts

1. **DON'T** validate or interpret a block's `rule`/`settings` here — payload vocabulary belongs to its owning ADR.
2. **DON'T** hardcode a namespace or block name in this contract's rules — legal keys come only from the fences.
3. **DON'T** patch the seeded config on re-run — upgrades go through the migrate step.
4. **DON'T** best-effort-skip invalid pieces of a block — a block that fails validation governs nothing.
5. **DON'T** add hand-authored types to `rules.d.ts`, edit another ADR's fence, or park block types outside every fence.
6. **DON'T** park project-local governance at an undeclared key — give it its own fence and ADR.

## Consequences

**Positive:**

1. **Zero-touch growth:** a new knob touches only its block ADR; a new block is one fence plus its ADR — this contract is amended for neither.
2. **Silent holes stay closed without coupling:** unparseable JSON, block-name typos, version skew, and payload typos all error loudly, yet no block name appears here.
3. **One grammar for all futures:** every block inherits FileSet arithmetic, first-match-wins claiming, and the coverage posture without redesign.
4. **Portable:** rules are byte-identical across projects; only the config data differs, and `version` names the release that wrote it.

**Negative:**

1. **Spine duplicated in consumers:** archgate rules cannot share runtime code, so each block owner copies the spine walk and version probe — and the reporting validator could drift from that copy. Kept honest by the shared fixtures both rules tests import, run against the *live* repo files.
2. **Exact-match version ceremony:** every release bump invalidates seeded configs until restamped (deliberate pre-1.0 honesty); in a target project `package.json` is the *target's* version — a later concern.
3. **Registry rides on regex-parsed comment markers:** the machine guarantee covers the fence grammar only; contents drifting from the owner's schema is a Manual review duty, and AST-hardening is deferred.
4. **Every block is spine-shaped:** a future freeform block would need a fence-grammar amendment here — accepted; none exists.

## Compliance and Enforcement

Automated: `GEN-002-harness-config.rules.ts` enforces four `error`-tier rules (GEN-001 §7) — `config-json-parses` (§1.3), `config-version` (§1.4), `config-extension-fenced` (§2.2), `config-shape-valid` (§3.1). All no-op when the config is absent; the fence rule also no-ops when the extension file is absent. Block payloads and interpretation are enforced by their owners (frontmatter: GEN-003).

**Manual review duties** (never linted): the core types match what the validator accepts; each fence's contents stay within its declared `namespace.block` and match the owning ADR's payload schema; each fence's ADR id names a real, owning ADR; [docs/agents/frontmatter-config.md](../../docs/agents/frontmatter-config.md) stays aligned with the envelope and spine.

**Toolchain:** `.archgate/**` is outside the repo's eslint gate; prettier and vitest cover the rules and tests, `tsc --noEmit` covers both `.d.ts` files and the fixtures, and `.typescript-ai-harness.json` is prettier-checked. `archgate check` gates this ADR, the config, and the extension's fences.

**Templates/scaffolding:** deferred — the CLI will seed `.typescript-ai-harness.json` (stamping `version`), `harness-config-core.d.ts`, and `harness-config-extension.d.ts` (never `rules.d.ts`), and implement the migrate step.

**Exceptions:** raise a separate ADR; human approval required.

## References

- [Frontmatter Contract (GEN-003)](./GEN-003-frontmatter.md) — the first block owner; its fence declares `markdown.frontmatter`.
- [Frontmatter configuration reference](../../docs/agents/frontmatter-config.md) — option-by-option user reference for the envelope, spine, and frontmatter block.
- [ADR Contract (GEN-001)](./GEN-001-adr.md) — the shape and runtime-loading contract this ADR self-hosts under.
- [Distribution model (ADR-0001)](../../docs/adr/0001-github-git-spec-tsx-distribution.md) — the runtime-dependency firewall that forces JSON over YAML.
- [archgate integration (ADR-0005)](../../docs/adr/0005-archgate-integration.md) — seeds the config in target projects.
- Spec [#19](https://github.com/hancrafted/typescript-ai-harness/issues/19), refinement [#30](https://github.com/hancrafted/typescript-ai-harness/issues/30) — the envelope/block restructure and core/extension split this contract implements.
- Deferred: [#68 config-version migrate engine (older→newer transform, semver-range compatibility)](https://github.com/hancrafted/typescript-ai-harness/issues/68), [#7 AST-harden the meta-parsers](https://github.com/hancrafted/typescript-ai-harness/issues/7), [#9 real-binary gate](https://github.com/hancrafted/typescript-ai-harness/issues/9).
