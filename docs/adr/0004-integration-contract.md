---
type: design-adr
title: "Integration contract"
description: "Every Integration is a uniform module registered in an explicit static registry, with its config templates co-located alongside its code."
---

# Integration contract: uniform module + explicit static registry + co-located templates

Each harness capability is an **Integration** — a self-contained module under `src/integrations/<id>/` exposing a uniform contract:

```ts
interface Integration {
  id: 'archgate' | 'eslint' | 'prettier' | 'vitest' | 'husky';
  label: string;
  devDependencies: string[];
  promptSubOptions?(): Promise<SubChoice>;  // the extension point
  plan(ctx, choice): Action[];              // copy template / patch package.json / add script / install
}
```

A hand-maintained `src/integrations/registry.ts` lists them in an **explicit static array**. Each Integration's config template is **co-located** in its own folder (`src/integrations/<id>/template/`), not a central `templates/` tree.

Adding a sub-option = extend one Integration's `promptSubOptions` + `plan`. Adding an Integration = new folder + one line in `registry.ts`. Nothing else changes.

## Considered Options

- **Registry:** explicit static array (chosen) vs auto-discovery (runtime glob + dynamic import — magic, weaker typing, tsx friction) vs declarative manifests (break once logic like eslint-rule injection is needed).
- **Templates:** co-located per Integration (chosen — one folder holds code + prompts + template) vs central `templates/` dir.

## Consequences

- The shipped file set includes `src/integrations/**` so co-located templates travel with the tool.
- `plan()` returns declarative `Action[]` (copy file, patch `package.json`, add script, install dep) executed centrally by `apply.ts`, keeping dry-run and overwrite logic (ADR-0002) in one place.
- Refines ADR-0003: the harness source of truth is the co-located template files, not a standalone `templates/` directory.
- The `verify` / `verify:commit` scripts are composed from the *selected* Integrations, so `plan()` outputs may depend on the overall selection (a cross-Integration concern the husky Integration owns).
- **Prompt model:** each Integration's sub-options are a multiselect; any selected item may trigger conditional, arbitrarily-nested follow-up prompts, expressed *imperatively* inside `promptSubOptions()`. Do **not** build a declarative prompt-tree engine, and do **not** front-load deep prompts into the MVP — add depth per-Integration only when a real need appears.
