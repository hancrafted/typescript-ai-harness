---
name: harness-scaffolder-tensions
description: Two unresolved ADR tensions in the harness scaffolder (prepare guard vs self-hosting; ADR-0002 wording) surfaced during issue #1 implementation
metadata:
  type: project
---

Issue #1 (the interactive harness setup CLI) was implemented and committed (feat commit `3db58cf`, design record `46bef41`). Two architectural tensions were surfaced during code review and left for Han to resolve deliberately rather than fixed silently.

**1. `prepare` guard vs self-hosting (ADR-0001 vs ADR-0003 vs US-36).**
The husky Integration template emits `prepare: "husky"` for targets (US-36 literal). The tool's own `package.json` uses the guarded `prepare: "husky || true"` (ADR-0001, so `npx github:` consumers don't break when the `husky` devDep is absent). But ADR-0003 self-hosting means re-running the tool on this repo would overwrite the guard with plain `husky`. **Pending decision:** either make the template emit `husky || true` universally (resolves the clash, minor deviation from US-36 literal) or accept the tool repo hand-maintains its guard.
**Why:** US-36 explicitly wants two different values; the spec author may not have foreseen the self-host clobber.
**How to apply:** raise it before any self-host re-application; don't let a self-host run silently strip the guard.

**2. ADR-0002 wording is stale vs the shipped merge.** ADR-0002 says the `package.json` merge sets "scripts, devDependencies, and the lint-staged block." Implementation deliberately: (a) writes lint-staged to a standalone `.lintstagedrc.json` (mandated by US-34), and (b) delegates devDependencies to `npm install --save-dev` (npm resolves versions). The merge only touches `scripts`.
**Why:** US-34 refines ADR-0002; version resolution belongs to npm.
**How to apply:** when ADRs are consolidated into `.archgate/adrs/`, update ADR-0002's scope wording to match — flag it, don't treat the code as the deviation.

**3. ADR/CONTEXT doc-drift on artifact names & layout (surfaced by 2026-07-17 code review of `3db58cf`).** Two places where the design record text lags the shipped code:
- ADR-0002 "Scope of tool-owned" (line 7) and `CONTEXT.md` "Tool-owned config file" (line 28) both name the eslint config `eslint.config.js`; the tool ships `eslint.config.mjs` (US-19 mandates `.mjs` so it works regardless of target `type`). The `.js` text is stale.
- ADR-0004 (line 15) specifies co-located templates at `src/integrations/<id>/template/` (a directory); implementation uses `src/integrations/<id>/template.ts` (a file). Honors co-location intent; literal path differs.
**Why:** ADRs 0001–0008 were written during design (`46bef41`) before the implementation settled these details; the code is correct, the prose is behind.
**How to apply:** treat the code as canonical; fix the ADR/CONTEXT wording when ADRs are consolidated into `.archgate/adrs/`. Don't "fix" the code to match stale prose.

Also deferred (not defects): `.archgate/adrs/` is not yet initialized on this repo, so the repo self-hosts **without** archgate and **without active husky hooks** (would gate commits on `archgate check`). Activate both after `archgate init` + ADRs exist. The tool's `.prettierignore` is hand-broadened (`.agents`, `docs`, `.claude`, `*.md`) beyond the generic template — a target-specific adaptation the deferred ADR-0003 skill would generalize; it is append-only so self-host preserves it.

**4. TypeScript pinned to 6, not 7 — deliberate, tracked in [issue #2](https://github.com/hancrafted/ai-harness-setup/issues/2) (resolved 2026-07-20).**
`AGENTS.md`/`CLAUDE.md` used to claim "Tech Stack: TypeScript 7" while `package.json` had silently pinned `typescript@^6.0.3` since the same commit that added `typescript-eslint@^8.64.0` — no ADR recorded why. Root cause: TypeScript 7 ships without a stable programmatic compiler API; `typescript-eslint`'s type-aware rules need that API, so its peer range caps at `<6.1.0`. Upstream closed the TS7 support request "not planned" (typescript-eslint#12518) — fix depends on TS 7.1 (~Oct 2026), not on typescript-eslint.
**Why it matters beyond this repo:** the `eslint` Integration (`src/integrations/eslint/index.ts`) installs unpinned `typescript-eslint` via plain `npm install --save-dev` (`src/apply.ts:72`, no `--legacy-peer-deps`). Issue #2 tracks re-assessing that once upstream catches up.
**How to apply:** `AGENTS.md` now states TS6 + the reason inline — don't let it drift back to claiming TS7 support until #2 actually closes.

**Correction (2026-07-20, same day, verified empirically):** I originally claimed a *fresh/empty* target folder would install TS7 (unpinned `typescript` in `plan.ts` baseline) and hard-ERESOLVE the moment `eslint` was also selected — stated as fact without testing it. Tested it directly: `npm install --save-dev typescript eslint @eslint/js typescript-eslint eslint-config-prettier` on a truly empty dir (no prior lockfile/pin) resolves `typescript@6.0.3` cleanly, no error, no warning — npm's solver treats the unpinned dep as a free variable and satisfies `typescript-eslint`'s `<6.1.0` peer automatically when there's nothing pre-existing to conflict with. **The real bug surface is narrower than I first said**: only a target whose `package.json` *already has* an explicit `typescript@^7.x` devDependency before the tool touches it (i.e. the original `harness-test` case) hits the hard failure — because npm then has a prior resolution to reconcile against, not a free choice. No source fix needed for the fresh-scaffold path; `plan.ts`'s unpinned baseline is fine as-is. Issue #2 comment updated to narrow scope accordingly.
**How to apply:** if someone reports this ERESOLVE against a *target* project, ask whether TS7 was already pinned there before running the tool — that's the only reproducible case.
