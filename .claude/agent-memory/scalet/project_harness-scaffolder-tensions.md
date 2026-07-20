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
