---
name: ai-workspace-reference-harness
description: ~/ai-workspace is the canonical reference harness that ai-harness-setup packages (archgate, eslint, prettier, vitest, husky)
metadata:
  type: reference
---

`~/ai-workspace` is Han's existing workspace whose dev-tooling harness this project (`ai-harness-setup`) is built to package and distribute. When designing or verifying Integration defaults — eslint tiers/rules, vitest config, husky hooks, `verify` scripts, archgate setup — that repo is the reference to consult.

Caveats (verify against live files; it evolves independently):
- It has **no prettier config and no lint-staged** — both were *defined fresh* for this tool (see `docs/adr/0006-prettier-integration.md` and `0007-commit-verification.md`).
- Its eslint config hardcodes project-specific globs (`scripts/**`, `vault/skills/*/**`, `dev/**`) that the tool's templates must NOT copy — templates are generic (ADR-0003).
- It uses npm; `verify = archgate check && lint && tsc --noEmit && test`; husky runs `verify` on both pre-commit and pre-push (this tool splits that into `verify:commit` vs `verify`).
