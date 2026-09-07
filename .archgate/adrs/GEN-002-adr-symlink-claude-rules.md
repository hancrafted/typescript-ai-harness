---
type: adr
id: GEN-002
title: 'ADR Symlink for Claude Code Rules'
domain: general
rules: true
files: ['.archgate/adrs/**/*.md', '.claude/rules/**/*.md']
paths: ['.archgate/adrs/**/*.md']
description: 'The runtime channel that loads a governing ADR into agent context on Read: one .claude/rules symlink per scoped ADR, no orphans, and pointer-ness as a review duty.'
---

# ADR Symlink for Claude Code Rules

## Context

A commit-time check rejects work already written. Loading the governing record into agent context _before_ the code is written moves the same constraint onto the authoring path, where it costs nothing to obey. Claude Code's `.claude/rules/` feature carries that channel: a rule file declaring `paths:` is loaded on Read of any matching file.

An ADR reaches that channel by being symlinked into `.claude/rules/`. This ADR governs the symlink set — one entry per scoped ADR, no entry for an unscoped one, and no orphan left behind.

Rejected alternative: a generator that copies each ADR body into `.claude/rules/`. A symlink needs no build step and cannot go stale, so it wins wherever symlinks work; the generator stays the documented escalation path for symlink-hostile platforms.

## Decision

### 1. One symlink per scoped ADR

1. An ADR declaring a non-empty `paths:` MUST have a companion entry at `.claude/rules/<basename-lowercased>.md` resolving to it — `.claude/rules/gen-002-adr-symlink-claude-rules.md → ../../.archgate/adrs/GEN-002-adr-symlink-claude-rules.md`. (📜 Rule: `adr-claude-rules-symlink`)
2. An ADR with empty or absent `paths:` MUST NOT have such an entry; it governs nothing at runtime.
3. Every ADR-named entry under `.claude/rules/` MUST have a backing ADR with a non-empty `paths:`. Hand-written, non-ADR-named rule files are left untouched.
4. The entry MUST be a symlink, never a copied body. archgate's file reader resolves a symlink to its target, so a copy and a pointer are indistinguishable to any rule — pointer-ness is an authoring and review duty, and what the rule asserts is presence at the expected name plus the absence of orphans.
5. Always-on scope is `paths: ['**/*']`. The no-`paths` launch-load mode is deliberately unused, so every runtime entry declares its scope.
6. Delete the entry in the same change that deletes its ADR or drops that ADR's `paths:`.

### 2. Scope of the channel

1. `files:` here spans both sides of the invariant — ADR markdown and the runtime directory — because an orphan is only visible from the `.claude/rules/` side. `paths:` narrows to ADR markdown alone, steering the author who creates the entry rather than anyone browsing one. Check broad, steer narrow.
2. The channel is soft: a missing entry degrades steering but gates nothing beyond the rule below. `archgate check` at commit and push stays authoritative.
3. Runtime loading is a shipped contract, not a host-only convenience. The CLI writes these entries into a Target alongside the Core bundle, so this ADR travels with them; [ADR-0010](../../docs/adr/0010-core-governance-bundle-distribution.md) owns how the bundle and its symlinks are written.

## Do's and Don'ts

### Do's

1. **DO** give every ADR with a non-empty `paths:` a `.claude/rules/<basename-lowercased>.md` symlink pointing back to it. (Decision 1, 📜 Rule: `adr-claude-rules-symlink`)
2. **DO** keep the runtime entry a symlink — no rule can see the difference, so this one holds only if you hold it.
3. **DO** express always-on scope as `paths: ['**/*']` rather than omitting `paths`.
4. **DO** remove the entry in the same change that deletes an ADR or drops its `paths:`.
5. **DO** edit the ADR, never the runtime entry.

### Don'ts

1. **DON'T** attach a runtime entry to an ADR whose `paths:` is empty or absent.
2. **DON'T** leave an orphaned ADR-named entry under `.claude/rules/`.
3. **DON'T** copy an ADR body into `.claude/rules/` — a copy freezes silently while every check stays green.
4. **DON'T** treat the runtime channel as a gate; it steers, and `archgate check` rejects.

## Consequences

**Positive:**

1. **Just-in-time steering:** the governing ADR reaches agent context the moment a governed file is opened, before the commit-time backstop can reject.
2. **No build step:** a symlink cannot drift from its target, so there is nothing to regenerate and nothing to stale-check.
3. **Orphans are caught:** an entry outliving its ADR fails the check rather than loading dead governance.
4. **Asymmetric globs demonstrated:** `files:` and `paths:` differ here for a stated reason, giving the technique a worked instance rather than an assertion.

**Negative:**

1. **Presence, not pointer-ness:** the reader resolves symlinks, so §1.4 is unenforceable. A copied body is invisible whether or not it has drifted, so the channel can freeze while every rule stays green. Content equality — comparing the entry's bytes to the ADR — would catch a drifted copy at one extra read per ADR, and still not a fresh byte-identical one; the rule set stays presence-only.
2. **Target correctness unverified:** the rule proves an entry exists at the expected name, not that it resolves to its own ADR. A mispointed or dangling link passes and silently loads wrong or no context. The rule API cannot readlink; alignment is a review duty.
3. **Upkeep:** one entry per scoped ADR is extra surface to keep in sync. Mitigated: the rule fails on drift in either direction.

**Risks:**

1. **Platform symlink support:** on Windows, symlinks need Administrator or Developer Mode, and default git (`core.symlinks=false`) checks entries out as plain files. Those files satisfy the presence check, so a fresh clone passes while every entry is a frozen copy — silent staleness rather than a blocked build, the worse of the two failures. **Mitigation:** enable Developer Mode plus `git config core.symlinks true` and re-checkout; escalate to the copy-body generator (Context) where that is impossible.
2. **Loader drift:** `.claude/rules` is a versioned Host-harness feature and may regress. **Mitigation:** pivot to the generator fallback with zero ADR renames — the ADR set is unaffected by how its bodies reach context.

## Compliance and Enforcement

**Enforcer per Discipline:** `GEN-002-adr-symlink-claude-rules.rules.ts` holds §1.1–§1.3 at the `error` tier — one archgate rule, because no other enforcer can see across the ADR directory and the runtime directory at once. eslint and dependency-cruiser hold nothing here. §1.4 and §1.6 are **not mechanically enforced** — review duties, for the reasons in Consequences.

**Manual review duties** (never linted): each entry is a symlink rather than a copied body (§1.4); each entry resolves to its own ADR, since the rule API cannot readlink; an ADR deletion or a dropped `paths:` removes its entry in the same change (§1.6).

**Exceptions:** raise a separate ADR; human approval required.

## References

- [Claude Code — memory and `.claude/rules` path-scoped rules](https://code.claude.com/docs/en/memory#organize-rules-with-claude/rules/) — the loading mechanism §1 relies on: the `paths:` field, glob matching on Read, and symlink support.
- [archgate](https://archgate.dev/) — the `files:` scoping key and the deterministic rule model.
