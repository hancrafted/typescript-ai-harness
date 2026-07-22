---
type: agent-doc
title: "Frontmatter configuration reference"
description: "Option-by-option reference for the adr.frontmatter block of .typescript-ai-harness.json: pathRules, exempt, draftEscape, unmatched, requireDescription, the caps, and the built-in default."
---

# Frontmatter configuration reference

The frontmatter floor (GEN-003) reads its policy from the `adr.frontmatter` block of `.typescript-ai-harness.json` at the repo root (file owned by GEN-002). This is the complete option reference — the ADRs carry the contracts, this doc carries the how-to.

## Resolution model

- If the config file, its `adr` key, or its `frontmatter` block is absent, the **built-in default** (below) applies.
- If the block is present, it **replaces** the default entirely — never merges. Re-declare every path you want governed.
- Every markdown file is tested against `pathRules` in order; the **first** entry whose glob matches claims the file (first-match-wins). Later entries never see it.
- A file claimed by an `exempt` entry, or matching no entry at all, has no frontmatter requirements.

## Options — `adr.frontmatter`

- `pathRules` (array, required) — ordered list of entries, evaluated first-match-wins.
- `unmatched` (string, optional) — policy for files matching no entry. Only valid value: `"exempt"`, which is also the behavior when omitted. Reserved for future postures.
- `draftEscape` (boolean, default `false`) — when `true`, any governed file may declare `type: draft` regardless of its entry's `allowedTypes`. The rest of the floor (label, caps, a required description) still applies. Lets you create a file whose final classification is unsettled without touching this config.

## Options — each `pathRules` entry

- `match` (string or string[], required) — glob(s) relative to the repo root, e.g. `"docs/adr/*.md"` or `["README.md", "AGENTS.md"]`.
- `exempt` (boolean, default `false`) — `true` switches the whole floor **off** for matched files; nothing is checked, not even `type`. Order it before broader governed entries to carve out exceptions.
- `allowedTypes` (string[], optional) — closed set of kebab-case types the entry accepts. Omit for open membership: any kebab-case `type` passes.
- `label` (string, optional: `"name"` or `"title"`) — pins which label key matched files must carry. Omitted: either is fine, but exactly one.
- `requireDescription` (boolean, default `false`) — `true` makes `description` mandatory for matched files. By default `description` is optional and only cap-checked when present.
- `severity` (string, optional: `"error"` or `"warning"`, default `"error"`) — the tier this entry's violations emit at. `warning` reports without blocking — useful to ratchet a brownfield surface.
- `maxLabel` (integer, default `64`) — cap for the label value.
- `maxDescription` (integer, default `1024`) — cap for `description`.
- `maxTag` (integer, default `30`) — cap for each individual tag.

## What a governed file must carry

- `type` — required; kebab-case; a member of `allowedTypes` when the entry closes it (`draft` also passes under `draftEscape`).
- `name` **xor** `title` — required; exactly one; the pinned one when the entry pins.
- `description` — optional unless the entry sets `requireDescription`.
- `tags` — optional; a comma-separated list of kebab-case tags, e.g. `tags: governance, frontmatter`. No closed set, no count limit.

## exempt vs. draft

- `exempt: true` is **per path region, total, config-level**: every file the entry matches loses the entire floor until someone edits this config.
- `type: draft` (with `draftEscape: true`) is **per file, partial, file-level**: the file stays governed — label, caps, and any required description are still enforced — it only escapes the closed `allowedTypes` membership while its classification is unsettled. Grepping `type: draft` doubles as the inventory of unclassified files.

## Recipes

Greenfield allowlist — govern only what you declare; everything else is exempt by default:

```json
{
  "adr": {
    "frontmatter": {
      "unmatched": "exempt",
      "pathRules": [
        {
          "match": ".archgate/adrs/*.md",
          "allowedTypes": ["adr"],
          "label": "title",
          "requireDescription": true
        },
        { "match": "docs/adr/*.md", "allowedTypes": ["design-adr"], "label": "title" }
      ]
    }
  }
}
```

Brownfield ratchet — carve out legacy paths first, then govern the rest without blocking:

```json
{
  "adr": {
    "frontmatter": {
      "pathRules": [
        { "match": "docs/legacy/**", "exempt": true },
        { "match": "docs/**/*.md", "label": "title", "severity": "warning" }
      ]
    }
  }
}
```

## Built-in default

Applies only when the config file or its `adr.frontmatter` block is absent. Root-or-specific paths only; each entry pins `label: title`, closes `allowedTypes` to the listed type, and runs at `error`:

- `.archgate/adrs/*.md` → `adr`
- `README.md` → `docs`
- `AGENTS.md` → `agents-md`
- `CLAUDE.md` → `claude-md`

## Validation

`archgate check` validates the block's shape via `frontmatter-config-valid` (GEN-002) and enforces the floor via `frontmatter-floor` (GEN-003). A malformed block fails loudly instead of silently disabling governance.
