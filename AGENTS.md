# AI Harness Setup

This project provides an interactive CLI Tool to setup basic harness libraries to any projects to reduce the boilerplate code for AI projects.

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

TypeScript 7 and NodeJs

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.