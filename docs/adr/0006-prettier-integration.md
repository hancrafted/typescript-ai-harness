---
type: design-adr
title: "prettier Integration"
description: "Configure prettier via explicit config values and a mutually-exclusive import-sort strategy so formatting and import order never conflict."
---

# prettier Integration: config values + mutually-exclusive import-sort strategy

Ship an opinionated `.prettierrc.json`. There was no existing prettier config to copy — the repo's style was inconsistent (`eslint.config.js` used single quotes, `vitest.config.ts` double) — so the config is *defined*, not inherited:

```json
{ "semi": true, "singleQuote": true, "trailingComma": "all", "printWidth": 120, "tabWidth": 2, "arrowParens": "always", "endOfLine": "lf" }
```

`printWidth: 120` is chosen for **diff/edit stability** in an agentic environment (fewer reflow-driven diffs, more stable single-line statements for string-match edits) — not for any established LLM output-quality effect, of which there is no hard evidence.

## Import sorting — pick one, never both

A sub-option: multiselect `[auto-import-sort]` (default on) → single-choice between two **mutually exclusive** plugins:

- **`prettier-plugin-organize-imports`** (default) — sorts + merges + **removes unused** (destructive; the warning is shown in the clack option hint).
- **`@ianvs/prettier-plugin-sort-imports`** — grouped, configurable `importOrder`, non-destructive.

[VERIFIED] The two cannot run together: both override Prettier's `babel`/`typescript` parsers, so only the last-loaded one functions. Modeled as pick-one — a future contributor will be tempted to enable both; they must not.

## Consequences

- `.prettierrc.json` is a **programmatic-exception artifact**: the chosen plugin injects `"plugins"` (and `@ianvs` its default `importOrder`) — not a static copy.
- If eslint is also selected, **`eslint-config-prettier`** is appended to the eslint config to disable formatting-conflict rules (cross-Integration adjustment).
- Scripts added: `format` = `prettier --write .`, `format:check` = `prettier --check .`.

Sources: [@ianvs/prettier-plugin-sort-imports](https://github.com/IanVS/prettier-plugin-sort-imports) · [prettier-vscode #716](https://github.com/prettier/prettier-vscode/issues/716)
