---
type: research
title: "Release scripting mechanics: library vs hand-rolled"
description: "Primary-source survey for #64 (part of #62): per-mechanic recommendations for the scripted, non-LLM parts of the /release skill — commits/diff, version bump, CHANGELOG, GitHub Release, and the tag -> publish.yml handoff."
---

# Release scripting mechanics: library vs hand-rolled

Research for [#64](https://github.com/hancrafted/typescript-ai-harness/issues/64) (part of [#62](https://github.com/hancrafted/typescript-ai-harness/issues/62)). This covers only the **scripted, deterministic (non-LLM)** mechanics of the planned local `/release` skill. The LLM contract (bump decision + release-note prose) is [#63](https://github.com/hancrafted/typescript-ai-harness/issues/63); orchestration + pre-flight is [#65](https://github.com/hancrafted/typescript-ai-harness/issues/65).

Repo facts this rests on were read directly, not assumed:

- `.github/workflows/publish.yml` triggers **only** `on: push: tags: ['v*']`, publishes via npm **OIDC trusted publishing** (no token), re-runs `npm run verify` + Trivy + `npm run build`, then `npm publish --access public`.
- `src/harness-config.ts` line 2 `import { version } from '../package.json'` -> line 13 `export const HARNESS_VERSION: string = version` (tsup inlines the JSON at build). **The ticket's claim is confirmed.**
- Current release path (`docs/release.md`, `AGENTS.md` step 5): `npm version <bump>` + `git push --follow-tags`.
- Commit convention (`AGENTS.md`): Conventional Commits v1.1.0 subjects; commit **bodies** group impacts under Keep a Changelog v1.1.0 categories (Added/Changed/Deprecated/Removed/Fixed/Security) + a `Source:` trailer. Merge-commit history; **no breaking-change markers used yet**; package is **0.x**, **single package** (not a monorepo).

## TL;DR — one line per mechanic

| Mechanic | Recommendation |
| --- | --- |
| 1. Commits + diff since last `v*` tag | **Hand-roll raw `git`** (`git describe` + `git log --no-merges` + `git diff --stat`). No library. |
| 2. Version bump | **`npm version <bump>`** (built-in), not a hand edit — but add a `version` lifecycle script to also re-stamp `.typescript-ai-harness.json`. |
| 3. CHANGELOG | **Hand-roll: scripts collect raw `git log` bodies, the LLM (#63) writes the notes.** If a purely deterministic path is ever wanted, **git-cliff** > conventional-changelog; **not** changesets. |
| 4. GitHub Release | **`gh release create`** (already a repo dependency), not raw REST. |
| 5. Tag -> publish handoff | **Keep the single `on: push: tags: ['v*']` trigger; create the tag on exactly one path, from local/human creds.** Either keep `git push --follow-tags` or move to `gh release create --target <sha>`; do **not** add a `release:` trigger. |

---

## 1. Commits + diff since the last `v*` tag

**Recommendation: hand-roll with raw `git`.** This is three deterministic commands, not a problem a dependency solves.

- Find the last release tag: `git describe --tags --abbrev=0 --match 'v*'`.
  Primary: <https://git-scm.com/docs/git-describe>
- List what landed since it, robustly parseable: the `..` range means "reachable from HEAD but not from the tag"; `--no-merges` drops merge commits; `--pretty=format:` with `%B` (raw body) + `%(trailers:key=Source)` gives the full body the LLM needs. Use a NUL/`%x1f` field separator so commit text cannot break parsing.
  `git log v0.1.1..HEAD --no-merges --pretty=format:"%H%x1f%s%x1f%b%x1e"`
  Primary: <https://git-scm.com/docs/git-log> (`<commit1>..<commit2>` range shorthand; `--no-merges` == `--max-parents=1`; `--pretty=format` placeholders `%H %s %b %B %(trailers)`).
- Change surface for the bump heuristic: `git diff --stat v0.1.1..HEAD` / `git diff v0.1.1..HEAD -- <paths>`.
  Primary: <https://git-scm.com/docs/git-diff>

Why not a library: any "commit parser" package (e.g. `conventional-commits-parser`) only re-implements a `git log` call plus a regex, adds a dependency to a zero-runtime-dep package, and still cannot understand this repo's convention (categories live in **bodies**, not subjects). Raw `git` output is the cleanest hand-off surface to the LLM in #63.

**Gotcha (merge-commit history):** `--no-merges` will *hide* squash-merge summaries if PRs are squash-merged into a single merge/squash commit; conversely with true merge commits the real change commits are the non-merge ones. Feed the LLM the non-merge commits **with full `%B` bodies** (that is where Added/Changed/Fixed live) rather than subject lines. `--first-parent` is the alternative view if the team switches to merge-commit-per-PR.

## 2. Version bump

**Recommendation: `npm version <patch|minor|major>`, not a manual `package.json` edit.** Confirmed behavior (primary: <https://docs.npmjs.com/cli/v11/commands/npm-version>):

- Writes the new version to `package.json`, `package-lock.json`, and `npm-shrinkwrap.json` if present.
- In a git repo it **also creates a version commit and a tag** (`vX.Y.Z`; prefix is the `tag-version-prefix` config, default `v`).
- **Fails if the working tree is not clean** unless `--force`.
- Runs `preversion` -> bump -> `version` -> commit+tag -> `postversion` lifecycle scripts; sets `npm_old_version` / `npm_new_version`.
- Relevant flags: `--no-git-tag-version` (bump only, no commit/tag), `-m/--message` (`%s` -> version), `--sign-git-tag`, `--allow-same-version`.

A manual edit would have to replicate all of the above (lockfile, commit, tag) by hand for no benefit.

**"One bump covers both" — confirmed, with one caveat this repo actually has.** `HARNESS_VERSION` reads `package.json` at build (`src/harness-config.ts`), so `npm version` covers the shipped constant. **But there is a third version location it does not touch:** this repo dogfoods its own harness, and `.typescript-ai-harness.json` carries a top-level `"version"` (currently `"0.1.1"`). Archgate's `config-version` rule requires that to **exactly equal `package.json` `.version`** (primary in-repo: `.archgate/adrs/GEN-002-harness-config.rules.ts` `config-version`; reference `docs/agents/frontmatter-config.md`). `npm version` does not edit it, and `scripts/self-apply.ts` (lines 19-22) only seeds that file **write-if-absent** — it never re-stamps an existing one. So after a bump, `archgate check` inside `npm run verify` fails on a stale config version, and **publish.yml re-runs `npm run verify`, so the release aborts.**

Fix (deterministic, folds into the same commit): add a `"version"` npm lifecycle script that writes `package.json`'s new version into `.typescript-ai-harness.json` and `git add`s it — the `version` script runs after the bump but before `npm version`'s commit, so it lands in the same release commit. This is a hard requirement for the scripted flow, not a nice-to-have.

## 3. CHANGELOG generation

**Recommendation: hand-roll the collection, let the LLM write the notes.** Scripts run the `git log` from mechanic 1; the LLM in #63 synthesizes the human changelog / release notes from the commit bodies. This matches the #62 design (LLM judges, scripts do mechanics) and, crucially, matches **this repo's actual convention**: Keep a Changelog categories live in commit **bodies**, and **no off-the-shelf tool groups by body content** — they all group by the Conventional Commit **type** parsed from the subject line. Bridging that gap with a tool means writing a custom parser anyway.

If a **purely deterministic (no-LLM) changelog** is ever wanted as a fallback:

- **git-cliff** is the best fit. Single self-contained binary (Rust; also an npm wrapper), config-file driven (`cliff.toml`), supports both Conventional Commits *and* **regex-powered `commit_parsers`** plus a Tera template — so it can be taught to read this repo's body categories and emit Keep a Changelog format. Works on merge-commit history. Primary: <https://git-cliff.org/docs/>
- **conventional-changelog** is viable but heavier: an npm monorepo whose presets assume Angular/conventional **type-based** grouping (feat/fix), a larger dependency tree, and no built-in notion of body categories. Its README itself steers higher-level automation toward `commit-and-tag-version` (a drop-in for `npm version` that also writes the changelog) and `semantic-release`. Primary: <https://github.com/conventional-changelog/conventional-changelog>; drop-in alt: <https://github.com/absolute-version/commit-and-tag-version>
- **changesets — no.** It derives releases from **developer-authored intent files** (`.changeset/*.md`), not git history, and is explicitly monorepo/multi-package focused. For a single-package, LLM-assisted, history-derived flow it is the wrong model and adds an unrelated workflow. Primary: <https://github.com/changesets/changesets>

Keep a Changelog category vocabulary (already in `AGENTS.md`): <https://keepachangelog.com/en/1.1.0/>

## 4. GitHub Release creation

**Recommendation: `gh release create`, not raw REST.** `gh` is already a first-class dependency in this repo (`AGENTS.md`, `docs/agents/issue-tracker.md`), it reuses the user's stored auth, and one command does tag-or-not, notes, draft, and asset upload. Confirmed behavior:

- `gh release create <tag>`: "If a matching git tag does not yet exist, one will automatically get created from the latest state of the default branch." `--target <branch|sha>` points that auto-tag elsewhere; `--notes` / `--notes-file` / `--generate-notes` (GitHub Release Notes API) supply the body; `--draft`; `--verify-tag` aborts if the tag does not already exist remotely; `--latest`. Primary: <https://cli.github.com/manual/gh_release_create>
- It is a thin wrapper over the REST "Create a release" endpoint, whose `tag_name` + `target_commitish` behave identically (`target_commitish` is "Unused if Git tag already exists"; defaults to the default branch). Hand-rolling REST just means re-implementing auth + JSON + tag logic. Primary: <https://docs.github.com/en/rest/releases/releases#create-a-release>

Practical form for the skill: `gh release create vX.Y.Z --target "$(git rev-parse HEAD)" --notes-file <notes> [--verify-tag]`.

## 5. Tag -> `publish.yml` handoff ordering (the crux)

**publish.yml listens on exactly one trigger: `on: push: tags: ['v*']`** (read from the file). OIDC trusted publishing and provenance are **trigger-agnostic** — the trigger type is not a requirement for either (npm's own example even uses `on: release: [published]`; provenance is automatic under OIDC from a public repo/package). Primary: <https://docs.npmjs.com/trusted-publishers>, <https://docs.npmjs.com/generating-provenance-statements>.

The load-bearing fact for "which command creates the tag":

- **The `push` event fires for tag pushes**, and `on: push: tags` filters them. Primary: <https://docs.github.com/en/actions/reference/events-that-trigger-workflows>
- **Recursion caveat:** "events triggered by `GITHUB_TOKEN` will not create new workflow run" (except `workflow_dispatch` / `repository_dispatch`) — "This behavior prevents you from accidentally creating recursive workflow runs." A tag/release created **by a workflow using `GITHUB_TOKEN`** does **not** fire downstream `push` workflows. Primary: <https://docs.github.com/en/actions/concepts/security/github_token>
- **This does not bite the planned `/release` skill, because it runs locally / human-invoked.** The tag is created with the developer's own git credentials (SSH/HTTPS) or `gh`'s user token — **not** `GITHUB_TOKEN` — so the `push: tags` trigger fires normally whether the tag comes from `git push --follow-tags` **or** from `gh release create`. The caveat only becomes a trap if tag creation is ever moved *into* a CI job authenticated with `GITHUB_TOKEN`.

**No double-publish today, and how to keep it that way.** Both `git push --follow-tags` and `gh release create` create exactly one `v*` ref -> one `push` event -> one publish.yml run -> one `npm publish`. Because publish.yml does **not** listen on `release:` events, creating a GitHub Release does not add a second run. The only ways to get a double-publish (npm versions are immutable, so the second run hits an E409 "cannot publish over previously published version"):

1. Adding `on: release: [published]` to publish.yml **and** using `gh release create` — that fires both the tag-push run and the release-published run. **Don't add a `release:` trigger.**
2. Creating two differently-named tags (e.g. `npm version` tag pushed, then a separate `gh release create <other-tag>`).

**Two clean orderings** (pick one; both keep the single trigger and OIDC intact):

- **A — minimal change to today's flow.** `npm version <bump>` (+ the `.typescript-ai-harness.json` sync from mechanic 2) -> `git push --follow-tags` (this push triggers publish.yml) -> `gh release create vX.Y.Z --verify-tag --notes-file <notes>` to attach the human notes to the already-pushed tag. Publish is driven by the tag push; the Release is documentation.
- **B — release-driven tag.** `npm version <bump> --no-git-tag-version` -> commit (with synced config) -> push the commit -> `gh release create vX.Y.Z --target "$(git rev-parse HEAD)" --notes-file <notes>`, which creates the tag -> fires `push: tags` -> publishes. One command produces both tag and Release.

Either way, **always pin the tag to the reviewed commit** (`--follow-tags` tags the `npm version` commit; `gh release create` must use `--target <sha>` because its auto-tag otherwise points at "the latest state of the default branch," which can capture a teammate's merge that landed after the LLM reviewed).

---

## Gotchas that constrain D1 (#63) and D2 (#65)

**D1 — LLM bump decision + release notes (#63):**

1. **No breaking-change markers.** Commits carry no `!` / `BREAKING CHANGE:` today, so the bump decision cannot be a subject-line regex — the LLM must read `git diff` + full commit **bodies**. (This is also why a deterministic changelog tool can't classify severity.)
2. **0.x semver.** Under 0.x, breaking changes bump **minor**, not major; `docs/release.md` says most releases are patch/minor. The LLM's rubric must encode 0.x semantics, not 1.x.
3. **Categories live in bodies.** Release notes must be built from `%B` bodies (Added/Changed/…/Security) + the `Source:` trailer, not from subjects. Feed the LLM full bodies of non-merge commits.

**D2 — orchestration + pre-flight (#65):**

1. **Config-version lockstep (the sharp edge).** `npm version` does not touch `.typescript-ai-harness.json`, and `self-apply` won't re-stamp an existing one, but `archgate check` (re-run by publish.yml's `npm run verify`) requires it to equal `package.json`. The scripted bump **must** update that file in the same commit (a `version` lifecycle script), or the tagged release aborts in CI.
2. **Pre-flight is mandatory, publishes are immutable.** `npm version` fails on a dirty tree; the flow needs clean tree + up-to-date `main` + green CI + `npm run capture`/`self-apply` clean (per `docs/release.md`). A bad publish cannot be overwritten — recovery is bump-again, so pre-flight rigor is the safety net.
3. **Exactly one tag-creation path, from local creds.** Choose ordering A or B, never both; never add a `release:` trigger; keep tag creation local (human/PAT), never a `GITHUB_TOKEN` CI step, or the `push: tags` trigger silently won't fire.
4. **Pin the tag to the reviewed HEAD** (`--target $(git rev-parse HEAD)`) to avoid racing a concurrent merge into `main`.

## Primary sources

- git: <https://git-scm.com/docs/git-log>, <https://git-scm.com/docs/git-describe>, <https://git-scm.com/docs/git-diff>
- npm: <https://docs.npmjs.com/cli/v11/commands/npm-version>, <https://docs.npmjs.com/trusted-publishers>, <https://docs.npmjs.com/generating-provenance-statements>
- GitHub: <https://cli.github.com/manual/gh_release_create>, <https://docs.github.com/en/rest/releases/releases#create-a-release>, <https://docs.github.com/en/actions/reference/events-that-trigger-workflows>, <https://docs.github.com/en/actions/concepts/security/github_token>
- Changelog tools: <https://git-cliff.org/docs/>, <https://github.com/conventional-changelog/conventional-changelog>, <https://github.com/absolute-version/commit-and-tag-version>, <https://github.com/changesets/changesets>, <https://keepachangelog.com/en/1.1.0/>
- In-repo: `.github/workflows/publish.yml`, `src/harness-config.ts`, `docs/release.md`, `AGENTS.md`, `.archgate/adrs/GEN-002-harness-config.rules.ts`, `scripts/self-apply.ts`, `.typescript-ai-harness.json`
