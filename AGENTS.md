---
type: agents-md
title: "Agent instructions"
description: "Canonical agent instructions for this repo — commit conventions, skills, tech stack, and the agent-skill docs index; imported by CLAUDE.md."
---

# Typescript AI Harness

This project provides an interactive CLI Tool to setup basic harness libraries to any projects to reduce the boilerplate code for AI projects.
The core workflow 

1. develop, test and verify harness layers in this repo
2. add to cli as template or assets
3. dogfood the cli in this repo
4. repeat 1 until the next harness version is ready to be released
5. release via v*.*.* tags on github, which will publish to npm @hancrafted/typescript-ai-harness 


## Antigravity CLI
<claude>Skip this section</claude>

1. Read [Scarlet](.claude/agents/scarlet.md) and [Scarlet Memory](.claude/agent-memory/scarlet/MEMORY.md), this are your agent profile and memory. You are allowed to write memory but must append [by Gemini].
2. Read [ADR INDEX](.archgate/INDEX.md), decide when you should load respetive ADR, when you read or write files matching it's `Trigger`.

## Rules

1. Do not auto-include yourself in the commit message.

## Commits

1. **Commits** Make atomic commits using Conventional Commits v1.1.0 format `[feat, fix, docs, refactor, chore](scope): <short summary in present tense>`
2. **Commit Body** Use the optional commit body to explain the why and how of the change (not the what)by using the Keep a Changelog v1.1.0 categories (Added, Changed, Deprecated, Removed, Fixed, Security) to clearly group the impacts.
3. **Commit Scope** Keep changes scoped to the domain you are working on.

Example
```
doc(README): align root README.md with the agent skills documentation

## Changed 
- Update `README.md` to align with the agent skills documentation.
```

## Skills

This project uses workflow and skills proposed by [Matt Pocock](https://github.com/mattpocock/skills).

## Tech Stack

TypeScript 6 and NodeJs. Pinned below TS7 — `typescript-eslint`'s peer range caps at `<6.1.0` (TS7 lacks the stable programmatic API type-aware rules need). Upgrade tracked in [#2](https://github.com/hancrafted/typescript-ai-harness/issues/2), gated on upstream dependency compatibility.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### ADR governance

Two ADR systems coexist, deliberately:

- `docs/adr/` — design ADRs from `/domain-modeling` (prose; the *why* behind decisions), created lazily during grilling/design sessions.
- `.archgate/adrs/` — archgate governance ADRs (`*.md` + executable `*.rules.ts`); the deterministic enforcement layer read by `archgate check`.

**For now they are separate entities.** End state: archgate ADRs are the single source of truth for ADRs — they both steer the LLM and enforce deterministic governance via `rules.ts`. Design ADRs in `docs/adr/` are converted into archgate ADRs later; until conversion, `docs/adr/` holds the canonical design record. Do not conflate the two homes.