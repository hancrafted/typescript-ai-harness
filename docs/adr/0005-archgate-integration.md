---
type: design-adr
title: "archgate Integration"
description: "Install archgate by deterministic direct-write in both modes — no interactive init shell-out — seeding archgate's config/settings and the core governance bundle."
---

# archgate Integration: deterministic direct-write (v5)

archgate ships an `init` command but exposes **no non-interactive contract** — no `--yes`/`--no-input`, and `--editor <value>` suppresses only the editor prompt. Earlier versions of this Integration therefore ran a **hybrid**: shell out to `npx archgate init` when a human was present, direct-write a snapshot when headless (`--yes`). See History for why that was the right call at the time.

**v4 retires the shell-out entirely. Both modes now direct-write, deterministically.** Two things changed the calculus:

1. **The harness now ships a governed Core governance bundle** ([ADR-0010](./0010-core-governance-bundle-distribution.md)). `archgate init` seeds an *example ADR* that almost certainly violates GEN-001's shape rules (numbered anchors, twin rule markers, six exact sections, test sibling, symlink…), so `archgate check` would fail on a file archgate itself wrote — into the very directory core owns. archgate exposes no flag to suppress it.
2. **`npx archgate init` is network- and environment-fragile.** It fetches over the network and installs a global Claude plugin into `~/.claude`; a corporate proxy (Zscaler, reported on a locked-down Windows machine) blocks it, so the interactive path was already silently broken there. Everything else `init` did deterministically — write `.archgate/config.json` and `.claude/settings.local.json` — the headless path already did itself.

The `--yes` flag still threads into the plan context (`Ctx.yes`), but archgate no longer branches on it for *what* to write; both modes write the same deterministic surface.

## What the direct-write path writes (against the pinned archgate version, editor `claude`)

- **The Core governance bundle** — the `ADR_CORE` ADRs and their supporting files, written **Tool-owned** (overwrite) into `.archgate/**`, plus the `.claude/rules/` symlinks. Owned by ADR-0010; this Integration invokes it. The supporting files include the `@generated` `.archgate/rules.d.ts` (archgate's ambient rule types), seeded so a Target type-checks its **own** ADR `.rules.ts` before its first `archgate check` — which regenerates the same file byte-for-byte under the pinned version (v5).
- `.archgate/config.json` — **Seeded config file** (write-if-absent): `{"domains":{}, "baseBranch":"origin/main"}`. The five built-in ADR domains (ARCH/BE/DATA/FE/GEN) need no config; `baseBranch` is a static `origin/main`.
- `.claude/settings.local.json` — **Seeded config file**: the `archgate:developer` agent + allowed archgate skills, verbatim.
- `.typescript-ai-harness.json` — **Seeded config file**: GEN-003's portable default, version-stamped (ADR-0010 §6).

Deliberately **not** written: no `.gitignore` entry for `rules.d.ts` (it is committed and seeded, not ignored — v5); the `lint/` placeholder; the empty `.archgate/adrs/.gitkeep` (retired — core writes real, governed ADRs). The global `~/.claude` plugin install is dropped; a one-line post-run note points the user to `archgate plugin install`.

## editor

Fixed to **claude** in both modes. Interactive users no longer get archgate's editor prompt; the other editors (`cursor`/`vscode`/`copilot`/`opencode`) remain a reserved, deferred slot for per-editor snapshots. This matches the first consumer (this repo) and the prior headless behaviour.

## Consequences

- **Both modes are now deterministic and idempotent.** A dev's setup byte-matches CI's; self-application rewrites the bundle byte-for-byte (ADR-0010's dogfood definition-of-done). The cross-mode divergence that v3 accepted is gone.
- **Interactive users lose archgate's native onboarding** — no editor prompt, no in-`init` plugin install. The plugin is one noted command (`archgate plugin install`); governance (`archgate check`, a devDep binary) works without it.
- **The Zscaler failure mode leaves the setup path.** The post-run `archgate plugin install`, and `npx`/`archgate check` themselves, may still be proxy-affected — that is the plugin/binary's concern, and it lands with the deferred Windows posture (#4), not the CLI's install run.
- The Dependency stays **version-pinned** (single `ARCHGATE_VERSION`, now surfaced in `harness.config.json` per ADR-0010) so `check`/config behaviour matches the seeded snapshot.
- Snapshot rot is mitigated by the deferred drift test (real `archgate init` diffed against the snapshot) — network + binary + git, so **deferred to #4**'s Dockerized e2e; until then the pin is the mitigation.
- archgate emits **no `runCommand`** in either mode now; the `runCommand` Action kind survives for husky.
- `package.json` is untouched by archgate directly; `archgate check` in `verify` / `verify:commit` is husky's cross-Integration composition (ADR-0007), unchanged.

## History

- **v1 (superseded, #5):** always shelled out to `npx archgate init --editor <editor>`; introduced the `runCommand` Action kind. Superseded because the shell-out could not run headless and silently mutated global `~/.claude`.
- **v2 (superseded, #5):** always direct-wrote the snapshot, never shelling out — so `--yes` could run unattended. Superseded because it also removed native onboarding for the *interactive* case, where a TTY is present and archgate's own `init` was then the better experience.
- **v3 (superseded, this change):** hybrid — direct-write when headless, shell out to `npx archgate init` when interactive. The right balance *before* the harness shipped its own governed ADRs.
- **v4 (superseded, v5):** retire the shell-out; unified deterministic direct-write in both modes, now including the Core governance bundle (ADR-0010). Superseded v3 because `archgate init`'s example ADR conflicts with GEN-001, the network/plugin onboarding is Zscaler-fragile, and everything else `init` did is done deterministically here. Editor fixed to `claude`; plugin via post-run note.
- **v5 (current):** `rules.d.ts` is committed and seeded as a Core-bundle supporting file (ADR-0010 §3), reversing v1–v4's "deliberately not written, gitignored" stance. Rationale: a freshly-onboarded Target must be able to author its **own** ADR `.rules.ts` with working types/`tsc`/intellisense before its first `archgate check`; the file is `@generated` and regenerates byte-for-byte under the pinned archgate version, so a committed copy stays a clean diff (verified) rather than churning, and no install-time archgate shell-out is reintroduced (v4's reason stands). See ADR-0002 for the mutation-model classification.
