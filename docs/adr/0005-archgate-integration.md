# archgate Integration: direct-write snapshot (headless), claude editor

archgate ships an `init` command but exposes **no non-interactive contract** — there is no `--yes`/`--no-input`, and `--editor <value>` suppresses only the editor prompt. With a TTY attached, `archgate init` still opens an interactive session and installs a Claude plugin into the global `~/.claude`. A scaffolder that must run under `--yes` therefore cannot delegate to it. So the archgate Integration **writes its scaffolding directly** as Tool-owned files — the same model every other Integration uses — rather than shelling out to `archgate init`.

## What it writes (against `archgate@^0.50.0`, editor `claude`)

- `.archgate/config.json` — **Seeded config file** (written once, never clobbered): `{"domains":{}, "baseBranch":"origin/main"}`. The five ADR domains (`architecture`/`backend`/`data`/`frontend`/`general` → ARCH/BE/DATA/FE/GEN) are archgate built-ins, available with zero config, so they are **not** written into `domains`.
- `.claude/settings.local.json` — **Seeded config file**: archgate's Claude settings (the `archgate:developer` agent + allowed archgate skills), verbatim as `init` emits them.
- `.gitignore` += `.archgate/rules.d.ts` — append-only (the shared-ignore-file model).

Deliberately **not** written: `rules.d.ts` (`@generated` and gitignored — `archgate check`, already the first step of `verify`, regenerates it); an example ADR (a Target project authors its own ADRs via the archgate workflow); the `lint/` placeholder directory (an unused, doc-only extension slot — `archgate check` tolerates its absence). The global `~/.claude/plugins` install `init` performs is dropped; a one-line post-run note points the user to `archgate plugin install`.

## editor sub-option

Narrowed to **claude** only. As that is the single choice, the `--editor` prompt is removed and archgate becomes a no-sub-option Integration (like vitest). The other editors (`cursor`/`vscode`/`copilot`/`opencode`) are a reserved, deferred slot.

## Consequences

- The snapshot is **version-coupled** to archgate. The Integration installs `archgate@^0.50.0` (behind a single version constant, matching the tool's own pin) so `check` / config behaviour matches the snapshot. Pinning is a deliberate deviation from the "install latest" convention every other Dependency uses — justified because the snapshot is captured against a specific version.
- Rot is otherwise mitigated by a **drift test** — real `archgate init` in a temp git repo, diffed against the snapshot (modulo the omitted `rules.d.ts`, the dynamic `baseBranch`, and the dropped plugin install). It needs the archgate binary + network + git, so it is **deferred to #4**'s Dockerized e2e; until then the pin is the mitigation.
- archgate no longer emits a `runCommand`. The `runCommand` Action kind remains — husky still uses `npx husky`.
- archgate adds nothing to `package.json` directly; `archgate check` in `verify` / `verify:commit` is unchanged (owned by husky's cross-Integration composition, ADR-0007).
- Running the tool with `--yes` now completes with no TTY and no interactive prompt end-to-end, unblocking the scheduled Dockerized e2e (#4).

## History

- **v1 (superseded, #5):** shelled out to `npx archgate init --editor <editor>` to avoid a snapshot template rotting against archgate's canonical output, and introduced the `runCommand` Action kind. Reversed because archgate has no non-interactive contract, so the shell-out could not run headless — and it silently mutated global `~/.claude` state. The snapshot approach trades a *managed* rot risk (pin + deferred drift test) for the hard requirement that the tool run unattended; an *uncontrolled* run is barely better than a *blocked* one.
