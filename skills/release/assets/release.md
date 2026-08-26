# Release process

How to cut and publish the next version of `@hancrafted/typescript-ai-harness`.

Releases are **tag-driven and deliberate**: you bump the version and push a `vX.Y.Z`
tag; GitHub Actions does the rest. Publishing uses npm **trusted publishing (OIDC)** —
there is no npm token to manage. Canonical decision record: **ADR-0009**.

## TL;DR

> **Superseded — do not run this.** `SKILL.md` step 4 is the current flow. `npm version` bumps
> `package.json` alone, and a commit that leaves `.typescript-ai-harness.json` behind is rejected by
> pre-commit `archgate check` (GEN-002 §1.4). The two files must move together, by hand, in one
> commit; only the pipeline description below still applies.

```bash
git checkout main && git pull            # be on an up-to-date main
# then follow SKILL.md step 4: bump both files, commit, annotated tag, push
```

Then watch the **Publish** workflow in the Actions tab go green.

## How the pipeline works

Two workflows, one gate and one release:

- **`ci.yml` (CI)** runs on every push and PR: `npm run verify` (archgate check, eslint,
  prettier, tsc, vitest, knip) → Core-bundle freshness guard → self-apply clean-overwrite
  guard → `npm run build` → boot-smoke. It **never publishes**. Keep `main` green.
- **`publish.yml` (Publish)** runs **only on a `v*` tag push**: it re-verifies, rebuilds,
  and publishes to npm with provenance. A failing verify or build aborts the job before
  anything reaches npm.

Nothing publishes on merge to `main` — only a `v*` tag does.

## One-time setup (already done — for reference)

Trusted publishing needs a one-time bootstrap, captured in ADR-0009:

1. Configure a **trusted publisher** for the package on npmjs.com, scoped to this repo +
   `.github/workflows/publish.yml`.
2. Because OIDC cannot create a not-yet-published package, a `0.0.0` placeholder was
   published once manually (interactive 2FA) to bootstrap the package name.

You do **not** need to repeat these for a normal release, and you should **not** add an
`NPM_TOKEN` — token auth is deliberately not used.

## Pre-flight checklist

Before cutting a release, from an up-to-date `main`:

1. **On `main`, up to date:** `git checkout main && git pull`.
2. **`main` CI is green** in the Actions tab. (Publish re-runs `verify`, but catch failures
   early.)
3. **Clean working tree:** `git status` shows nothing to commit.
4. **Core bundle asset is fresh:**
   ```bash
   npm run capture
   git status --porcelain -- assets      # expect: empty
   ```
5. **Self-apply is a clean overwrite:**
   ```bash
   npm run self-apply
   git status --porcelain -- .archgate .claude/rules   # expect: empty
   ```
6. **Pick the bump.** Follow semver. The package stays in `0.x` until the CLI surface is
   deliberately declared stable, so most releases are `patch` or `minor`.

## Cut the release

> **Superseded by `SKILL.md` step 4**, which bumps `package.json` and
> `.typescript-ai-harness.json` in one hand-made commit and tags with `git tag -a`. `--follow-tags`
> pushes annotated tags only, so a lightweight tag is silently dropped and nothing publishes.

```bash
# see SKILL.md step 4 — bump both files, commit via the `commit` skill,
# `git tag -a vX.Y.Z -m "vX.Y.Z"`, then `git push --follow-tags`
```

Notes:

- `npm version` bumps `package.json`, which is the source of `HARNESS_VERSION` — the value
  stamped into the seeded `.typescript-ai-harness.json` on install.
- `prepack` runs `npm run capture`, so the published tarball always carries a fresh
  `assets/core-bundle/` (the shipped Core governance bundle).

## What `publish.yml` does automatically

On the `v*` tag push:

1. `actions/checkout` (full history).
2. `actions/setup-node` — Node 24 (ships npm ≥ 11.5.1, required for trusted publishing),
   with the npm registry configured.
3. **Enable OIDC trusted publishing** — strips the `_authToken` placeholder so npm falls
   through to OIDC instead of token auth.
4. `npm ci`
5. `npm run verify`
6. `npm run build`
7. `npm publish --access public` — the npm CLI detects the GitHub Actions OIDC environment,
   authenticates via the workflow's `id-token`, and attaches provenance automatically.

## Verify the release

- **Actions → Publish** run is green.
- `npm view @hancrafted/typescript-ai-harness version` shows the new version.
- The npm package page shows a **provenance** attestation.
- Smoke the published artifact in a scratch dir:
  ```bash
  cd "$(mktemp -d)" && npx @hancrafted/typescript-ai-harness@<version> --dry-run --yes
  ```

## If something goes wrong

- **Verify or build failed** → nothing was published. Fix on `main`, then release again.
- **Published npm versions are immutable.** Never try to overwrite a version — if a
  release is bad, bump again (`npm version patch`) and re-tag. To re-run a release for the
  *same* version you would have to delete/move the tag, which is discouraged; prefer a new
  patch.
- **Publish step failed on OIDC/registry** → check the trusted-publisher config on
  npmjs.com (repo + `publish.yml`), then re-run the job or re-push the tag.

## Gotchas

- **Deliberate, not automatic.** Merging to `main` never publishes; only a `v*` tag does.
- **config-version ([#68](https://github.com/hancrafted/typescript-ai-harness/issues/68)).**
  The seed is stamped with `HARNESS_VERSION`. `config-version` equality-checks the stamp only
  where `package.json` names the harness itself, so a Target on a different `package.json`
  version carries the stamp without a mismatch (cross-release comparison lands with the migrate
  engine). This repo dogfoods clean (the harness *is* the package), so `npm version` still bumps
  `package.json` and the dogfood `.typescript-ai-harness.json` version in lockstep — restamp the
  config in the release commit, or the pre-commit `archgate check` rejects it.
- **No token.** Trusted publishing means there is nothing to rotate — do not add an
  `NPM_TOKEN` secret.

## References

- `ADR-0009` — release pipeline and trusted publishing.
- `README.md` → **Releasing**.
- `.github/workflows/ci.yml`, `.github/workflows/publish.yml`.
