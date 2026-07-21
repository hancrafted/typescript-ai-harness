---
type: agent-doc
title: "Frontmatter configuration reference"
description: "Option-by-option reference for the markdown.frontmatter block of .typescript-ai-harness.json: the generic spine (version, FileSet include/exclude, pathRules, exempt, severity, unmatched, coverage), the frontmatter rule payload and settings, and the built-in default."
---

# Frontmatter configuration reference

The frontmatter floor (GEN-003) reads its policy from the `markdown.frontmatter` block of `.typescript-ai-harness.json` at the repo root. GEN-002 owns the file's envelope and the generic **spine** every block satisfies; GEN-003 owns this block's vocabulary — the `rule` payloads and `settings`. This is the complete option reference — the ADRs carry the contracts, this doc carries the how-to.

## File shape

```json
{
  "markdown": {
    "version": 1,
    "frontmatter": {
      "unmatched": "exempt",
      "settings": { "draftEscape": true },
      "pathRules": [{ "include": ["docs/adr/*.md"], "rule": { "allowedTypes": ["design-adr"], "label": "title" } }]
    }
  }
}
```

- `markdown` is the namespace for markdown-governance blocks; `frontmatter` is currently the only registered block. Unregistered keys under `markdown` are errors — a typo cannot silently disable governance.
- `markdown.version` (required) stamps the config format. Current version: `1`. A mismatch errors and names the migrate step — the config is never reinterpreted under different semantics.
- The file is **seeded, never patched**: the CLI writes `markdown` once at install and never touches it on re-run; format upgrades are an explicit interactive migrate (diff + version bump).
- Top-level keys beside `markdown` are yours — project-local config lives there, never inside `markdown`.

## Resolution model

- Config file absent, or a healthy file without the `frontmatter` block → the **built-in default** (below) applies.
- Block present → it **replaces** the default entirely — never merges. Re-declare every path you want governed.
- Config present but unparseable, wrong `version`, or the block invalid in any way → the block governs **nothing** until the loudly-reported errors are fixed (all-or-nothing; there is no best-effort mode).
- An entry's files are `glob(include) − glob(exclude)`. Every markdown file is tested against `pathRules` in order; the **first** entry whose file set contains it **claims** it (first-match-wins). Later entries never see it.
- A file claimed by an `exempt` entry, or matching no entry at all, has no frontmatter requirements (with `unmatched: "exempt"`).

## Spine options — `markdown.frontmatter` (owned by GEN-002)

- `pathRules` (array, required) — ordered list of entries, evaluated first-match-wins.
- `unmatched` (string, optional: `"exempt"` | `"error"`, default `"exempt"`) — policy for files no entry claims. `"exempt"`: ungoverned. `"error"`: every unclaimed file inside `coverage` is a violation.
- `coverage` (FileSet, required iff `unmatched` is `"error"`) — the governed universe for the strict posture: `{ "include": [...], "exclude": [...] }`.
- `settings` (object, optional) — block-level knobs owned by GEN-003, see below.

## Spine options — each `pathRules` entry (owned by GEN-002)

- `include` (string[], required) — non-empty array of non-empty globs relative to the repo root, e.g. `["docs/adr/*.md"]`.
- `exclude` (string[], optional) — files matched here are **not claimed** by this entry; they fall through to later entries (and ultimately to `unmatched`). Not an exemption.
- `exempt` (boolean, default `false`) — `true` claims matched files and switches the whole floor **off** for them; such an entry must not carry `rule` or `severity`. Order it before broader governed entries to carve out exceptions.
- `severity` (string, optional: `"error"` | `"warning"`, default `"error"`) — the tier this entry's violations emit at. `warning` reports without blocking — useful to ratchet a brownfield surface.
- `rule` (object, optional) — the frontmatter policy payload, below. Absent = an open governed entry: the baseline floor applies.

## Three carve-outs, three meanings

| Mechanism        | Claims the file? | Effect                                                                   |
| ---------------- | ---------------- | ------------------------------------------------------------------------ |
| `exempt: true`   | Yes              | Floor waived entirely; later entries never see the file                   |
| entry `exclude`  | No               | Falls through to later entries, then to `unmatched`                       |
| coverage exclude | —                | Outside the strict universe: never a coverage violation under `"error"`  |

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
  "markdown": {
    "version": 1,
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
  "markdown": {
    "version": 1,
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
  "markdown": {
    "version": 1,
    "frontmatter": {
      "unmatched": "error",
      "coverage": { "include": ["docs/**/*.md"], "exclude": ["docs/vendor/**"] },
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

`archgate check` gates the file in layers: GEN-002's `config-json-parses` (the file parses), `config-namespace-registered` (version stamp, registered blocks, retired-key tombstones) and `config-spine-valid` (the generic spine above); GEN-003's `frontmatter-config-valid` (the `rule`/`settings` vocabulary) and `frontmatter-floor` (the floor itself, plus coverage under `unmatched: "error"`). A broken config fails loudly and governs nothing — never silently.

## Hand-editing with types

`.archgate/harness-config.d.ts` carries the `Harness.Config` ambient types for this file — editors and rules files share them via triple-slash reference. It is hand-authored and committed; the generated `rules.d.ts` never carries config types.
