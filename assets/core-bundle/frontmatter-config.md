---
type: agent-doc
title: "Frontmatter configuration reference"
description: "Option-by-option reference for the markdown.frontmatter block of .typescript-ai-harness.json: the envelope (top-level version, fence-declared blocks), the generic spine (FileSet include/excludeFiles, pathRules, exempt, severity, unmatched, coverage), the frontmatter rule payload and settings, and the built-in default."
---

# Frontmatter configuration reference

The frontmatter floor (GEN-003) reads its policy from the `markdown.frontmatter` block of `.typescript-ai-harness.json` at the repo root. GEN-002 owns the file's envelope and the generic **spine** every block satisfies; GEN-003 owns this block — its registering fence and its vocabulary (the `rule` payloads and `settings`). This is the complete option reference — the ADRs carry the contracts, this doc carries the how-to.

## File shape

```json
{
  "version": "0.1.0",
  "markdown": {
    "frontmatter": {
      "unmatched": "exempt",
      "settings": { "draftEscape": true },
      "pathRules": [{ "include": ["docs/adr/*.md"], "rule": { "allowedTypes": ["design-adr"], "label": "title" } }]
    }
  }
}
```

- `version` (required, top level) — a semver string. It is equality-checked against the installed harness release **only in the harness's own repo** (where `package.json` names `@hancrafted/typescript-ai-harness`); a mismatch there errors and names the migrate step, and the config is never reinterpreted under another release's semantics. In a foreign Target `package.json` `.version` is the app's own, so the stamp is **carried but never compared** — a fresh install never false-fails — and the check is skipped entirely when `package.json` names no harness or version. The stamp's presence and semver shape are always enforced. Semver-range compatibility arrives with the migrate engine ([#68](https://github.com/hancrafted/typescript-ai-harness/issues/68)).
- The config is exactly two key levels deep: `{ version, [namespace]: { [block]: … } }`. `markdown` is the namespace for markdown-governance blocks; `frontmatter` is currently the only block. A `namespace.block` key is legal only if a fence in `.archgate/harness-config-extension.d.ts` declares it — a typo cannot silently disable governance.
- The file is **seeded, never patched**: the CLI writes it once at install and never touches it on re-run; upgrades are an explicit interactive migrate (diff + version restamp).
- Project-local governance gets its own fence in the extension file (plus a project-local ADR) — there are no free-floating top-level keys.

## Resolution model

- Config file absent, or a healthy file without the `frontmatter` block → the **built-in default** (below) applies.
- Block present → it **replaces** the default entirely — never merges. Re-declare every path you want governed.
- Config present but unparseable, `version` missing or not matching the installed harness release, or the block invalid in any way → the block governs **nothing** until the loudly-reported errors are fixed (all-or-nothing; there is no best-effort mode).
- An entry's files are `glob(include) − excludeFiles` (the listed literal paths). Every markdown file is tested against `pathRules` in order; the **first** entry whose file set contains it **claims** it (first-match-wins). Later entries never see it.
- A file claimed by an `exempt` entry, or matching no entry at all, has no frontmatter requirements (with `unmatched: "exempt"`).

## Spine options — `markdown.frontmatter` (owned by GEN-002)

- `pathRules` (array, required) — ordered list of entries, evaluated first-match-wins.
- `unmatched` (string, optional: `"exempt"` | `"error"`, default `"exempt"`) — policy for files no entry claims. `"exempt"`: ungoverned. `"error"`: every unclaimed file inside `coverage` is a violation.
- `coverage` (FileSet, required iff `unmatched` is `"error"`) — the governed universe for the strict posture: `{ "include": [...], "excludeFiles": [...] }`. Its `excludeFiles` follows the same rule as an entry's: literal file paths only, allowed only when `include` carries a wildcard.
- `settings` (object, optional) — block-level knobs owned by GEN-003, see below.

## Spine options — each `pathRules` entry (owned by GEN-002)

- `include` (string[], required) — non-empty array of non-empty globs relative to the repo root, e.g. `["docs/adr/*.md"]`.
- `excludeFiles` (string[], optional) — **literal file paths** (no wildcards) listed here are **not claimed** by this entry; they fall through to later entries (and ultimately to `unmatched`). Not an exemption. Allowed **only when `include` carries a wildcard** (`*`, `?`, `[`, `{`): a literal-path include names one file, so carving from it is contradictory — `config-shape-valid` rejects it. A listed path found nowhere in the include set is a **dead carve-out** — `frontmatter-floor` reports it at warning tier so a typo does not pass silently.
- `exempt` (boolean, default `false`) — `true` claims matched files and switches the whole floor **off** for them; such an entry must not carry `rule` or `severity`. Order it before broader governed entries to carve out exceptions.
- `severity` (string, optional: `"error"` | `"warning"`, default `"error"`) — the tier this entry's violations emit at. `warning` reports without blocking — useful to ratchet a brownfield surface.
- `rule` (object, optional) — the frontmatter policy payload, below. Absent = an open governed entry: the baseline floor applies.

## Three carve-outs, three meanings

| Mechanism        | Claims the file? | Effect                                                                   |
| ---------------- | ---------------- | ------------------------------------------------------------------------ |
| `exempt: true`   | Yes              | Floor waived entirely; later entries never see the file                   |
| entry `excludeFiles` | No | Falls through to later entries, then to `unmatched` |
| coverage `excludeFiles` | — | Outside the strict universe: never a coverage violation under `"error"` |

## Payload options — `rule` (owned by GEN-003)

- `allowedTypes` (string[], optional) — closed set of kebab-case types the entry accepts. Omit for open membership: any kebab-case `type` passes.
- `label` (string, optional: `"name"` or `"title"`) — pins which label key matched files must carry. Omitted: either is fine, but exactly one.
- `requireDescription` (boolean, default `false`) — `true` makes `description` mandatory for matched files. By default `description` is optional and only cap-checked when present.
- `maxLabel` (integer, default `64`) — cap for the label value.
- `maxDescription` (integer, default `1024`) — cap for `description`.
- `maxTag` (integer, default `30`) — cap for each individual tag.

Unknown `rule` keys are errors — `maxDescriptions` cannot silently weaken the floor.

## Payload options — `settings` (owned by GEN-003)

- `draftEscape` (boolean, default `false`) — when `true`, any governed file may declare `type: draft` regardless of its entry's `allowedTypes`. The rest of the floor (label, caps, a required description) still applies. Lets you create a file whose final classification is unsettled without touching this config.

## What a governed file must carry

- `type` — required; kebab-case; a member of `allowedTypes` when the entry's rule closes it (`draft` also passes under `draftEscape`).
- `name` **xor** `title` — required; exactly one; the pinned one when the entry's rule pins.
- `description` — optional unless the entry's rule sets `requireDescription`.
- `tags` — optional; a comma-separated list of kebab-case tags, e.g. `tags: governance, frontmatter`. No closed set, no count limit.

## exempt vs. draft

- `exempt: true` is **per path region, total, config-level**: every file the entry claims loses the entire floor until someone edits this config.
- `type: draft` (with `draftEscape: true`) is **per file, partial, file-level**: the file stays governed — label, caps, and any required description are still enforced — it only escapes the closed `allowedTypes` membership while its classification is unsettled. Grepping `type: draft` doubles as the inventory of unclassified files.

## Recipes

Greenfield allowlist — govern only what you declare; everything else is exempt by default:

```json
{
  "version": "0.1.0",
  "markdown": {
    "frontmatter": {
      "unmatched": "exempt",
      "pathRules": [
        {
          "include": [".archgate/adrs/*.md"],
          "rule": { "allowedTypes": ["adr"], "label": "title", "requireDescription": true }
        },
        { "include": ["docs/adr/*.md"], "rule": { "allowedTypes": ["design-adr"], "label": "title" } }
      ]
    }
  }
}
```

Brownfield ratchet — carve out legacy paths first, then govern the rest without blocking:

```json
{
  "version": "0.1.0",
  "markdown": {
    "frontmatter": {
      "pathRules": [
        { "include": ["docs/legacy/**"], "exempt": true },
        { "include": ["docs/**/*.md"], "severity": "warning", "rule": { "label": "title" } }
      ]
    }
  }
}
```

Strict coverage — every markdown file under `docs/` must be explicitly governed or carved out; forgetting one is an error:

```json
{
  "version": "0.1.0",
  "markdown": {
    "frontmatter": {
      "unmatched": "error",
      "coverage": { "include": ["docs/**/*.md"], "excludeFiles": ["docs/vendor/legacy.md"] },
      "pathRules": [
        { "include": ["docs/adr/*.md"], "rule": { "allowedTypes": ["design-adr"], "label": "title" } },
        { "include": ["docs/tmp/**"], "exempt": true }
      ]
    }
  }
}
```

## Built-in default

Applies only when the config file — or the `markdown.frontmatter` block in a healthy file — is absent. Root-or-specific paths only; each entry's rule pins `label: title`, closes `allowedTypes` to the listed type, and runs at `error`:

- `.archgate/adrs/*.md` → `adr`
- `README.md` → `docs`
- `AGENTS.md` → `agents-md`
- `CLAUDE.md` → `claude-md`

## Validation

`archgate check` gates the file in layers: GEN-002's `config-json-parses` (the file parses), `config-extension-fenced` (the extension's fences are well-formed — the block registry), `config-version` (the stamp matches the installed harness release) and `config-shape-valid` (two-level shape, fence-declared keys, the generic spine above); GEN-003's `frontmatter-config-valid` (the `rule`/`settings` vocabulary) and `frontmatter-floor` (the floor itself, plus coverage under `unmatched: "error"`). A broken config fails loudly and governs nothing — never silently.

## Hand-editing with types

Two hand-authored, committed files carry the `Harness` ambient types for this config. `.archgate/harness-config-core.d.ts` (GEN-002's) holds the generic spine and the envelope; `.archgate/harness-config-extension.d.ts` holds each block's types inside its owning ADR's fence — GEN-003's fence declares `markdown.frontmatter`. To add a new block: add a fence (`// <ADR-ID>-START: <namespace.block>` … `// <ADR-ID>-END`) with the block's types and a `Config` declaration-merge, plus an owning ADR. The generated `rules.d.ts` never carries config types.
