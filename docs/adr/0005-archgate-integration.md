# archgate Integration: hybrid — interactive `init`, headless direct-write snapshot

archgate ships an `init` command but exposes **no non-interactive contract** — there is no `--yes`/`--no-input`, and `--editor <value>` suppresses only the editor prompt. With a TTY attached, `archgate init` opens an interactive session and installs a Claude plugin into the global `~/.claude`; with stdin detached it runs *uncontrolled*, picking defaults and mutating machine-global state. A scaffolder that must run under `--yes` therefore cannot delegate to it.

But that constraint only bites headless. When a human is present, archgate's own onboarding — editor prompt, plugin login, example ADR — is exactly what you want. So the archgate Integration is **hybrid, split on the `--yes` flag**:

- **Interactive (no `--yes`):** shell out to `npx archgate init`. A TTY is present, so archgate drives its full native onboarding. The tool passes no `--editor` — archgate owns that prompt.
- **Headless (`--yes`):** write a controlled snapshot directly, as Tool-owned/Seeded files — the model every other Integration uses — so the run completes with no TTY, no prompt, and no global side effects.

The `--yes` flag is threaded into the plan context (`Ctx.yes`); `archgate.plan()` branches on it. No other Integration needs it.

## What the headless (`--yes`) path writes (against `archgate@^0.50.0`, editor `claude`)

- `.archgate/config.json` — **Seeded config file** (written once, never clobbered): `{"domains":{}, "baseBranch":"origin/main"}`. The five ADR domains (`architecture`/`backend`/`data`/`frontend`/`general` → ARCH/BE/DATA/FE/GEN) are archgate built-ins, available with zero config, so they are **not** written into `domains`. `baseBranch` is a static `origin/main` — branch detection is not reintroduced at apply time.
- `.claude/settings.local.json` — **Seeded config file**: archgate's Claude settings (the `archgate:developer` agent + allowed archgate skills), verbatim as `init` emits them.
- `.archgate/adrs/.gitkeep` — an **empty ADR directory**, kept under git with `.gitkeep`. `archgate check` treats the presence of `.archgate/adrs/` (not `config.json`) as the "initialised workspace" marker: without it, `check` aborts with `error: No .archgate/ directory found`. Seeding the empty directory makes a fresh Target pass `check` with zero ADRs, so `archgate check` in `verify` is green from the first run (US-16). No ADR *content* is written — the directory starts clean (US-9).
- `.gitignore` += `.archgate/rules.d.ts` — append-only (the shared-ignore-file model).

Deliberately **not** written on the headless path: `rules.d.ts` (`@generated` and gitignored — `archgate check`, already the first step of `verify`, regenerates it); an example ADR (a Target authors its own via the archgate workflow — the `adrs/` directory is seeded, but empty); the `lint/` placeholder directory (an unused, doc-only slot — `archgate check` tolerates its absence). The global `~/.claude/plugins` install is dropped; a one-line post-run note points the user to `archgate plugin install`.

## editor sub-option

The tool carries **no** editor sub-option in either mode. Interactive runs delegate the editor choice to `archgate init`'s own prompt; the headless snapshot is fixed to **claude**. The other editors (`cursor`/`vscode`/`copilot`/`opencode`) are a reserved, deferred slot for a per-editor headless snapshot.

## Consequences

- **The two modes produce different scaffolding — this is deliberate.** Interactive `archgate init` seeds an example ADR and `lint/`, installs the global Claude plugin (and may prompt for `archgate login`), and derives `baseBranch` from the repo; the headless snapshot does none of that and pins `baseBranch` to `origin/main`. Each mode is internally deterministic, but a dev's interactive setup will not byte-match CI's headless one. The headless snapshot is captured to *approximate* `init`'s output, not to reproduce it exactly.
- The headless snapshot is **version-coupled** to archgate. Both modes install `archgate@^0.50.0` (behind a single version constant) so `check` / config behaviour matches the snapshot. Pinning is a deliberate deviation from the "install latest" convention, justified because the snapshot is captured against a specific version.
- Snapshot rot is otherwise mitigated by a **drift test** — real `archgate init` in a temp git repo, diffed against the snapshot (modulo the omitted `rules.d.ts`, the dynamic `baseBranch`, and the dropped plugin install). It needs the archgate binary + network + git, so it is **deferred to #4**'s Dockerized e2e; until then the pin is the mitigation.
- archgate emits a `runCommand` **only on the interactive path**. The headless path emits none.
- archgate adds nothing to `package.json` directly; `archgate check` in `verify` / `verify:commit` is owned by husky's cross-Integration composition (ADR-0007) and is unchanged.
- Running the tool with `--yes` completes with no TTY and no interactive prompt end-to-end, unblocking the scheduled Dockerized e2e (#4).

## History

- **v1 (superseded, #5):** always shelled out to `npx archgate init --editor <editor>`, and introduced the `runCommand` Action kind. Superseded because the shell-out could not run headless (no non-interactive contract) and silently mutated global `~/.claude`.
- **v2 (superseded, #5):** always direct-wrote the snapshot, never shelling out — chosen so `--yes` could run unattended and controlled. Superseded because it also removed the full native onboarding for the *interactive* case, where a TTY is present and archgate's own `init` (plugin, editor choice, example ADR) is the better experience.
- **v3 (current, #5 follow-up):** hybrid — direct-write when headless (`--yes`), shell out to `npx archgate init` when interactive. Keeps the hard requirement that `--yes` run unattended and controlled, while giving interactive users archgate's native onboarding. Restores archgate's use of the `runCommand` kind on the interactive path only. The cross-mode divergence above is the accepted cost.
