---
status: amended 2026-07-21 — token auth replaced by OIDC trusted publishing
---

# CI/CD pipeline and npm release process

Publishing to npm (ADR-0001) requires a build / test / release pipeline. We run **two GitHub Actions workflows**. `ci.yml` runs on every push and PR — `npm ci` → `npm run verify` (ADR-0007) → `npm run build` → a **boot-smoke** of the built `dist` bin (`--dry-run --yes` in a temp dir, assert exit 0) — matrixed over **Node 22 + 24**. `publish.yml` is triggered by a `v*` git tag: it re-runs verify + build, then `npm publish --access public --provenance` on **Node 24**. Releases are cut **manually** (`npm version <bump>` → `git push --follow-tags`); the first published version is **`0.1.0`** and the package stays in `0.x` until the CLI surface is deliberately declared stable. A real end-to-end test — a lightweight Node Docker image that runs the built tool and **asserts the created artifacts on disk** — is kept out of the push/PR path for speed and deferred to a future **scheduled** run, tracked as a follow-up GitHub issue.

## Considered Options

- **Publish auth — `NPM_TOKEN` secret (chosen)** vs OIDC trusted publishing. Chose a granular, `@hancrafted`-scoped, expiring token so CI owns the entire lifecycle **including the first publish**, with no manual bootstrap. Provenance is kept regardless (`--provenance` + `id-token: write`), so declining OIDC does not cost the supply-chain badge. Trade-off: a standing credential to rotate, in exchange for a fully hands-off first release.
- **Release trigger — manual `v*` tag (chosen)** vs GitHub Release UI vs automated release-please / changesets. Manual tagging keeps version bumps deliberate while the API is unstable and adds the least machinery; the Conventional-Commits discipline still allows generating a changelog later without handing the release trigger to a bot.
- **e2e placement — deferred + scheduled (chosen)** vs on every push. The Docker artifact test pulls an image and runs the tool for real; on the hot path it would drag every push for little marginal value over the deterministic boot-smoke. A fast boot-smoke stays in `ci.yml`; the heavy artifact-asserting e2e runs on a schedule.
- **Fast-path scope — build + boot-smoke the bundle (chosen)** vs verify-only. Building and executing the bundle on every push catches "the bundle doesn't even boot / a dynamic import broke in bundling" — failures that unit tests on `src/` cannot, and that would otherwise first surface at publish time.

## Consequences

- The publish job must run on **Node 24** (ships npm ≥ 11.5.1) — Node 22 ships npm 10 and would need a manual npm upgrade for provenance + registry auth.
- The `NPM_TOKEN` secret is a maintenance item: it is scoped and expiring, so it must be **rotated before expiry** or releases will start failing.
- The push/PR pipeline builds and boots the bundle but never asserts real filesystem artifacts; the deferred Docker e2e is the only guard that the tool writes correct files end-to-end. Until it exists, that assurance rests on the unit suite (`src/run.test.ts`) plus manual verification.
- The build/publish plumbing (`tsup`, the workflows, `dist/`) is **repo-local release tooling** and is deliberately **not** part of the harness installed into target projects — preserving the self-hosting boundary of ADR-0003.

## Update — 2026-07-21: token auth replaced by OIDC trusted publishing

The `NPM_TOKEN` decision above is **reversed**. In 2026 npm began restricting tokens that bypass 2FA for direct publishing: an account that requires 2FA to publish can no longer publish with a plain granular token — only one with the now-deprecated, security-flagged "bypass 2FA" option, which npm itself steers away from in favour of trusted publishing. The token model's one advantage here — a hands-off first release — was in practice already blocked by that same policy (the first `v0.1.0` publish 403'd on exactly this), so the trade-off inverted.

`publish.yml` now uses **npm trusted publishing (OIDC)**: no `NODE_AUTH_TOKEN`, and **no standing secret to rotate** (superseding the rotation consequence above). The npm CLI (≥ 11.5.1, from Node 24) detects the GitHub Actions OIDC environment through the existing `id-token: write` permission and authenticates directly; **provenance is attached automatically**, so the supply-chain badge is retained without the `--provenance` flag. A one-time setup on npmjs.com is required: configure a **trusted publisher** for the package (this repo + the `publish.yml` filename), set the package to "require two-factor authentication and disallow tokens", and delete the `NPM_TOKEN` repository secret.

**First-publish caveat:** OIDC cannot create a package that does not yet exist ([npm/cli#8544](https://github.com/npm/cli/issues/8544)), because a trusted publisher is configured on the package's own settings page. The package is therefore bootstrapped by a one-time **manual** publish of a `0.0.0` placeholder using interactive 2FA (an OTP prompt, not a token); CI then cuts `0.1.0` — and every later release — via OIDC with provenance. This manual bootstrap is the only hands-on step and uses no token.
