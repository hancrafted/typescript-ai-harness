# File mutation model: overwrite tool-owned configs, surgical-merge package.json, dry-run to preview

Running the tool applies changes in one pass (write configs → edit `package.json` → install → wire hooks). This repo is the single source of truth, so re-running acts as an **update**: tool-owned config files are **replaced wholesale** with this repo's canonical version, discarding any local edits. `package.json` is the one co-owned file and is never overwritten — it is **surgically merged** (our scripts, `devDependencies`, and `lint-staged` block are set/replaced; everything else is left untouched). A `--dry-run` flag prints every intended write, overwrite, merge, and install without performing them.

## Scope of "tool-owned"

Files the tool writes and fully overwrites on update: `eslint.config.js`, the prettier config, `vitest.config.ts`, `.husky/*` hooks, `.archgate/*` scaffolding.

Special-cased shared files:
- **`package.json`** — surgical merge (replace-our-keys only), never overwritten.
- **`.gitignore`** — append missing entries; never overwritten.
- **`tsconfig.json`** — written only if absent; never overwritten (TypeScript is not one of the selectable features, but `verify` runs `tsc --noEmit`).

## Considered Options

- **Overwrite tool-owned, merge `package.json` (chosen):** simple, predictable, makes re-run = update; costs any local customization of config files on re-run.
- **Three-way / deep merge of every file:** preserves local edits, but complex, ambiguous, and hard to reason about for a scaffolding tool.

## Consequences

- Hand-edits to tool-owned config files are silently lost on re-run — accepted trade-off of source-of-truth-is-this-repo; `--dry-run` is the safety valve, and a backup mode can be added later.
- `package.json` merge logic must be surgical and idempotent so repeated runs converge.
