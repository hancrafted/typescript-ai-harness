---
name: release
description: Publish the next version of @hancrafted/typescript-ai-harness. Releases are tag-driven — bump the version, push a vX.Y.Z tag, and GitHub Actions publishes to npm via trusted publishing (OIDC). This skill drafts release notes from the commit log since the last tag and stops at a review gate for your approval before anything publishes. Use when the user wants to release, publish a new version, ship, bump the version, or push a release tag.
---

Releasing is **tag-driven**: a `vX.Y.Z` tag push is the only thing that publishes — merging `main` never does. Publishing runs on npm **trusted publishing (OIDC)**, so there is no token to manage. Full pipeline mechanics, one-time setup, troubleshooting, and gotchas live in [`assets/release.md`](assets/release.md); consult it when a step below surprises you.

Nothing publishes until the user approves the version and notes at the **review gate** (step 3). Work the steps in order; each ends on a criterion you can check before moving on.

## 1. Pre-flight

Run every gate — a red one aborts the release:

1. On an up-to-date `main`: `git checkout main && git pull`.
2. Working tree clean: `git status --porcelain` prints nothing.
3. CI green on `main` in the Actions tab (Publish re-runs `verify`, but catch failures here).
4. Core bundle asset fresh: `npm run capture` then `git status --porcelain -- assets` prints nothing.
5. Self-apply clean overwrite: `npm run self-apply` then `git status --porcelain -- .archgate .claude/rules` prints nothing.

**Done when:** every gate passes.

## 2. Draft the release notes and version

1. Find the last release tag: `git describe --tags --abbrev=0`.
2. Gather the commits since it: `git log --no-merges <last-tag>..HEAD --pretty=format:'%h %s'`.
3. Group them into Keep a Changelog v1.1.0 sections by Conventional Commit type — `feat` → **Added**, `fix` → **Fixed**, other user-facing types → **Changed**; surface any `!` / `BREAKING CHANGE` at the top. Drop noise the reader won't act on (release chores, merge commits).
4. Only propose patch version, since this repo is in early development phase.

**Done when:** you have a proposed `vX.Y.Z` and grouped notes accounting for every commit since the last tag.

## 3. Review gate — approve before releasing

Show the user the proposed `vX.Y.Z` and the full release notes, then **stop and wait**. Advance to step 4 only once the user explicitly approves this version and these notes. If they change the bump or edit the notes, revise and show the updated version and notes again.

**Done when:** the user has approved a specific version and its notes.

## 4. Cut the release

The release commit bumps `package.json` **and** `.typescript-ai-harness.json` together: GEN-002 §1.4 requires the local config's `version` — the value the CLI ships and stamps into a Target on install — to equal the harness release, and a vitest test asserts it, so a commit that bumps only `package.json` is rejected by pre-commit `archgate check`. `npm version` has no hook that restamps the config, so bump both by hand in one commit:

```bash
npm version patch --no-git-tag-version   # bump package.json only; prints the new vX.Y.Z, no commit, no tag
# set "version" in .typescript-ai-harness.json to that same X.Y.Z
# commit package.json + package-lock.json + .typescript-ai-harness.json with the `commit` skill
git tag -a vX.Y.Z -m "vX.Y.Z"            # annotated — a bare `git tag vX.Y.Z` never leaves the machine
git push --follow-tags                   # pushes commit AND tag -> triggers Publish
git ls-remote --tags origin | grep vX.Y.Z   # prove the tag landed; no tag, no publish
```

This step has two silent failure modes, both observed in a real release:

- **`git push --follow-tags` pushes annotated tags only.** A lightweight tag — `git tag vX.Y.Z`, no `-a` — is skipped without a word: the push prints `main -> main`, exits `0`, and Publish never fires. The release looks finished and nothing reached npm. That is what the `-a` and the `ls-remote` line above are for; do not treat a clean push as proof.
- **The commit-msg hook rejects a bare `git commit -m "chore(release): X.Y.Z"`.** It requires a Keep a Changelog `### <category>` section carrying at least one numbered item, plus a `Source:` trailer. Use the `commit` skill, which writes a conforming message and runs the gate before committing.

`HARNESS_VERSION` is read from `package.json` (`src/harness-config.ts`), so those two files are the whole version change.

**Done when:** `git ls-remote --tags origin` lists the `vX.Y.Z` tag.

## 5. Watch Publish

The **Publish** workflow fires on the tag: it re-verifies, rebuilds, and `npm publish`es with provenance via OIDC. A failing verify or build aborts before anything reaches npm.

**Done when:** the Publish run for the tag is green in the Actions tab.

## 6. Verify and record the notes

1. Confirm the version resolves on the registry: `npm view @hancrafted/typescript-ai-harness version` reports the tag you cut.
2. Publish the approved notes as the GitHub Release for the tag (write them to a file first so multi-line markdown survives): `gh release create vX.Y.Z --title vX.Y.Z --notes-file <notes-file>`.

**Done when:** the registry reports the new version and its GitHub Release carries the approved notes. Published versions are immutable — if anything went wrong, never overwrite; bump again and re-tag (troubleshooting in `assets/release.md`).
