---
type: design-adr
title: "Commit verification"
description: "Verify full-repo correctness on every commit; staged-file scoping is used only for autofix, never to narrow the correctness gate."
---

# Commit verification: full-repo correctness on every commit; staged-scoping only for autofix

Clean git history is a first-class citizen — it serves as project memory / audit trail — and the primary committer is an AI. So the pre-commit gate enforces that **every commit is provably green, deterministically in the hook**, not via soft AI instruction (consistent with archgate's deterministic-governance ethos). The gate is split by *kind of operation*, not by scope:

- **Formatting / autofix** (`prettier --write`, `eslint --fix`): **staged files only**, via lint-staged. The one speed optimization — only reformats what changed, and unstaged files aren't in the commit anyway.
- **Correctness** (`archgate check`, `tsc --noEmit`, `vitest run`): **full repo, always**. Guarantees the committed tree is green regardless of what was staged.

## Scripts (composed from the selected Integrations)

- **`verify:commit`** (pre-commit) = lint-staged autofix on staged **+** full-repo correctness (`archgate check && tsc --noEmit && vitest run`).
- **`verify`** (pre-push, and the command the AI runs while working) = full-repo **checks only, no mutation** (`archgate check && eslint . && prettier --check . && tsc --noEmit && vitest run`).

## Considered Options

- **Staged-only pre-commit + full pre-push (rejected):** fast commits, but `vitest related` detection has gaps (dynamic imports, fixtures/config), so a staged change can commit a red tree — unacceptable when history is memory.
- **"Instruct the AI to run full verify while working" as the guarantee (rejected):** makes correctness depend on the agent complying; contradicts deterministic governance. Retained only as fail-fast ergonomics *on top of* the hard gate.

## Consequences

- `tsc --noEmit` runs in the pre-commit path — this **overrides the original spec**, whose `verify:commit` list omitted it. Justified by the clean-history priority.
- Speed cost: full test suite + tsc on every commit. Acceptable for the priority; a `vitest related` "fast-commit" mode is a future *explicit* opt-out sub-option, never the silent default.
- `verify` / `verify:commit` are composed from the selected Integrations (no prettier step if prettier isn't selected, etc.) — the husky Integration owns this composition (ADR-0004).
