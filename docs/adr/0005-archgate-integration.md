# archgate Integration: shell-out to `archgate init`, editor + ADR-recommendations as sub-options

archgate owns its own `.archgate/` scaffolding and ships an `init` command, so the archgate Integration configures it by **running `archgate init` non-interactively** rather than copying a snapshot template (which would rot against archgate's canonical output). This introduces a **run-command** `Action` kind alongside copy-file / patch-package.json / install-dep.

## Sub-options

- **editor (live in MVP):** single-select over archgate's `--editor` choices (`claude` / `cursor` / `vscode` / `copilot` / `opencode`), `claude` preselected, passed as `--editor <value>` so init never prompts.
- **ADR recommendations (planned):** a multiselect of curated ADR files co-located under `src/integrations/archgate/adrs/`, copied into the target's `.archgate/adrs/` after init. None ship in the MVP, but the design reserves the slot.

`--install-plugin` is not used — it requires a prior `archgate login`, and the MVP is auth-free.

## Consequences

- archgate is a **hybrid** Integration: primarily shell-out (init), and later copy-template (selected ADR recommendations).
- When the ADR-recommendations sub-option lands, its files populate the target's `.archgate/adrs/` — consistent with AGENTS.md → "ADR governance" (archgate ADRs are the governance source of truth).
