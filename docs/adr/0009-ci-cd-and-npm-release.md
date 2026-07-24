---
type: design-adr
title: "CI/CD and npm release"
description: "Three GitHub Actions workflows by concern — ci.yml (verify + knip), security.yml (Trivy), publish.yml (release) — separating correctness, security, and publishing to npm."
status: amended 2026-07-23 — split into three workflows (ci / security / publish); add knip + Trivy; Node 24 only; least-privilege tokens
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

## Update — 2026-07-21: OIDC is not turnkey (implementation gotchas)

The "authenticates directly, provenance automatic" description above is correct only once two non-obvious conditions are met. The first `0.1.0` release failed three times before landing; the causes are recorded here so the next release skips the detour.

- **`actions/setup-node` poisons OIDC unless its token line is stripped.** With `registry-url` set, setup-node always writes `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}` to the job `.npmrc`. With no token, `NODE_AUTH_TOKEN` resolves to setup-node's placeholder, so npm finds a "token", uses it, and **never attempts the OIDC exchange** — failing with a misleading `E404` ([actions/setup-node#1551](https://github.com/actions/setup-node/issues/1551)). `registry-url` cannot simply be dropped either: OIDC only engages when the registry is *explicitly* configured (dropping it yields `ENEEDAUTH`). The working shape is **keep `registry-url` and strip only the `_authToken` line** before publishing (`sed -i '/_authToken/d' "$NPM_CONFIG_USERCONFIG"`), which `publish.yml` now does.
- **A rejected trusted-publisher match surfaces as a misleading `E404`/`ENEEDAUTH`, not a clear diagnostic** ([npm/cli#9088](https://github.com/npm/cli/issues/9088)). Once the workflow is in the shape above (verified by an `id-token` env echo + npm ≥ 11.5.1), a remaining auth error is almost always the **npmjs.com trusted-publisher config**, not the workflow: the org/user, repo, workflow filename (`publish.yml`, no path, no stray space), and environment (must be blank) must match the OIDC claim exactly. Re-trigger after fixing the config with `gh run rerun <id>` — the OIDC token is minted fresh per run, so no new tag is needed.

Net: the token → OIDC decision stands and the security win is real, but the pipeline needs the `_authToken` strip step and the trusted publisher must be **verified as actually registered** (not merely assumed) before the first tag.

## Update — 2026-07-23: split into three workflows, add knip + Trivy

The single `ci.yml` `verify` job above did everything in one place: a red run hid behind one opaque `npm run verify` step, it ran the full suite twice (Node 22 + 24) for no benefit, there was no security scanning, and it used the default broad token. This amendment splits CI into **three workflows, one concern each**, and adds two checks. The two-workflow shape (one CI, one publish) is superseded; the OIDC publish mechanics above are unchanged.

- **`ci.yml` — correctness.** One `verify` job on **Node 24 only** (the matrix is dropped: 24 is the sole supported range — see `engines` below — and the version publish.yml ships on, so testing 22 paid to cover a version nobody runs). Every check is its **own named step** in cheapest / likeliest-to-fail-first order — `prettier → eslint → tsc → vitest → knip → archgate` — so a red run names the failing check without opening logs; build + boot-smoke of the bundle stay at the end, after source is validated. Triggers are **`push: [main]` + `pull_request`** (not bare `push`), so a feature branch with an open PR runs once, not twice. `fetch-depth: 0` (archgate base compare), the npm cache, and `concurrency` cancel-in-progress are retained.
- **`security.yml` — security.** A **Trivy** filesystem scan (vulnerable deps, leaked secrets, misconfig) as its own job that needs **no `npm ci`** — it reads `package-lock.json` directly, so it adds no install tax and runs in parallel with `verify`. It runs on `pull_request` and a **weekly `schedule`**, deliberately **off the WIP-push path** so the inner loop stays fast; the weekly run surfaces a newly-disclosed CVE in an unchanged dependency even when nobody pushes. It **fails on HIGH/CRITICAL** and warns on the rest (a report-only pass at all severities plus a gate pass), so the gate blocks real risk without drowning it in noise.
- **`publish.yml` — release.** Auth/trigger unchanged, but a `v*` tag now **re-runs `verify` (including knip) + the Trivy gate before build + publish**, making a release a strict superset of the merge gate — a tag can never ship code that skipped those checks.

The organising rule: **deterministic checks** (source-only, same-input-same-result) run on push/PR/release; the **time-varying security scan** (depends on an external CVE feed) concentrates at the PR gate, release, and a weekly schedule, never on a WIP push (see `CONTEXT.md` → CI/CD).

### Considered options (this amendment)

- **Three workflows by concern (chosen)** vs one workflow with multiple jobs. Separate files give each concern its own trigger matrix, its own least-privilege token, and an independently-required status check on the PR; the small cost is three headers instead of one.
- **knip as a repo verify gate (chosen)** vs no dead-code check vs governance-mandated knip. knip flags unused files/deps/exports as a deterministic verify-tier check; its config treats `.archgate/**/*.rules.ts` as entry points so governance rule files (loaded by the archgate binary, not imported) are not falsely flagged (relates to #35). Whether *governance mandates* knip over `.archgate/**` is out of scope here — this is only a repo gate.
- **`@v4` major-tag pins + Dependabot (chosen)** vs SHA-pinning. Readable tags kept legible; a new `.github/dependabot.yml` (github-actions ecosystem) opens a PR when a newer release lands, so a pin cannot silently rot. SHA-pinning (stronger supply-chain immutability) is deferred.
- **Least privilege (chosen):** each workflow declares `permissions: contents: read` at the top; `id-token: write` stays only in `publish.yml` where OIDC needs it.

### Consequences (this amendment)

- **`engines` narrows to `">=24"`** so the advertised support range matches what CI actually tests (was `>=20`). `npm run knip` is runnable locally to reproduce hygiene failures before pushing.
- **A feature branch with no open PR now gets no CI** — accepted under a PR-based flow; open the PR to get the gate.
- The **capture-freshness guard** (the ADR-0010 clean-diff guard that fails when a stale Core bundle asset lags its canonical source) is kept as its own named step in `verify`, slotting between `archgate` and `build`. It depends on the ADR-0010 capture mechanism (`harness.config.json` + capture script, #47/#50); until that lands, `ci.yml` carries a documented placeholder at the insertion point rather than a step that would run a script that does not yet exist.
- The deferred Docker e2e artifact test and the merge-queue (`merge_group`) path remain out of scope and scheduled separately.
