---
type: design-adr
title: "Core governance bundle: capture, seed, and self-apply"
description: "How the harness ships its foundational Governance ADRs into a Target: an authoring workspace in .archgate/, a captured distribution asset every install reads, unconditional Tool-owned overwrite, and a version-gated config seed."
---

# Core governance bundle distribution: authoring workspace, captured distribution asset, unconditional overwrite

The harness now installs its foundational **Governance ADRs** — the **Core governance bundle** — into a **Target project** through the archgate Integration. This ADR owns *how the bundle travels and is written*; [ADR-0005](./0005-archgate-integration.md) owns the archgate Integration behaviour that invokes it, and GEN-001/002/003 own what the ADRs themselves say.

The first consumer is this repo (self-application, ADR-0003); arbitrary Target support is the same code path, with two knowns explicitly deferred (§6, §7).

## 1. Authoring workspace and captured distribution source — not templated, not symlinked

The bundle plays two roles, and separating them is what lets self-application run the same install path a foreign Target runs (§4):

- **`.archgate/` is the authoring workspace** — where the Core bundle is edited, GEN-001 self-hosts, `archgate check` runs live, the `.claude/rules/` symlinks resolve, and the prose reviews (#38) happen. It is the source for the *next* captured release; authoring never moves. It is **not** what any install reads.
- **The committed Bundle asset (`assets/core-bundle/`) is the distribution source-of-truth** — the immutable, CI-fresh bytes every install reads from, self-apply included. A scripted, CI-gated **capture** step stages the workspace into the asset; the CLI writes the asset into a Target.

Rejected alternatives:

- **Templates-as-strings** (today's `template.ts` model). Fine for a two-line config; impractical and drift-prone for ~150 KB across a growing ADR tree, and the shipped copy would silently diverge from the canonical, governed ADRs.
- **Templates-as-source** (ADR-0003's literal model, with `.archgate/adrs/` as generated output). It relocates the crown-jewel ADRs *outside* the contract that governs them — no GEN-001 in context on Read, no live `archgate check`, no prose gate — until re-materialised.
- **Symlinking the canonical files into a template tree.** Blocked on a hard fact: archgate's file reader does not follow symlinks (`ctx.readFile` throws on one — the very mechanic `adr-claude-rules-symlink` relies on). A symlinked `.archgate/adrs/` file is unreadable by `archgate check`, so the ADR errors or goes undiscovered.

The capture is never hand-edited, so it cannot drift. Because every install — self-apply included — reads the asset and never the live `.archgate/`, `resolveBundleRoot()` returns the asset in dev, self-apply, and published installs alike; `from` is always under the asset and `to` always under the Target's `.archgate/`, so the two never coincide and the copy always runs (§4). The CI freshness guard keeps the asset byte-equal to canonical, so on any committed state that overwrite reproduces the source byte-for-byte — a clean `git diff`.

## 2. Membership is data — `ADR_CORE` in the Harness build config

A new root, Tool-owned **`harness.config.json`** (the **Harness build config**) names what the harness ships. It is build metadata, read by the capture step and by the CLI on self-apply, and is **never shipped to a Target** (the Target receives the materialised asset, not this file). It is distinct from `.archgate/config.json` (archgate's own) and `.typescript-ai-harness.json` (the target-facing runtime config, GEN-002-owned).

- **`ADR_CORE`** is the explicit, ordered list of core ADR ids — `["GEN-001", "GEN-002", "GEN-003"]` today. The `GEN-001`–`GEN-009` range is reserved for foundational governance; promoting a new one into core is a one-line edit here, not a CLI code change.
- The file also holds the curated **supporting-files** list (§3) and the pinned **`ARCHGATE_VERSION`** (today a constant buried in `template.ts`), so "what core ships" is one readable file.

Membership is deliberately an explicit list, not a glob of whatever `GEN-*` exists, so a half-finished ADR cannot leak into a release.

## 3. What core writes — the whole bundle, forced by GEN-001

"Three ADRs" is three *bundles*. GEN-001's own rules make the following mandatory members — omitting any fails `archgate check` in the Target:

- **Per core ADR:** its `.md` + `.rules.ts` + `.rules.test.ts` (`adr-rules-test-sibling` requires the sibling to exist) + a real `.claude/rules/<name>.md` symlink (`adr-claude-rules-symlink`, for any non-empty `paths:`).
- **Supporting files:** `harness-config-core.d.ts`, `harness-config-extension.d.ts` (GEN-002/003 reference them), the shared fixtures (§7), `frontmatter-config.md` (the harness-config how-to, relocated under `.archgate/`), and the `@generated` `rules.d.ts` (archgate's ambient rule types, committed and seeded so a Target type-checks its own ADR `.rules.ts` before its first `archgate check`; ADR-0005 v5).

The Target footprint is confined to `.archgate/**` plus the `.claude/rules/` symlinks — core does not bleed into the Target's `test/` tree (§7). Core does **not** force-install vitest: the `.rules.test.ts` files are archgate-satisfying artifacts a Target *may* run if it also selected vitest.

## 4. Lifecycle: Tool-owned bundle, Seeded config, self-apply as the proof

- The bundle is a **Tool-owned** set — every file overwritten on each run via `cpSync(force)`, full replacement including `.rules.ts` and `.rules.test.ts`. The install reads the committed asset in every context (§1), so this overwrite runs **unconditionally**: there is no skip-self guard and no self-apply special case anywhere in the install path. This is how a brownfield Target (this repo included) is brought up to the current governance release. Ownership is a manifest, not a directory wipe: the install overwrites exactly the `ADR_CORE` trios + supporting files and creates their symlinks, so a foreign Target's own non-core ADRs are never touched.
- `.typescript-ai-harness.json` is a **Seeded config file** — written once if absent, never patched on re-run (GEN-002 §1.2); the migrate/update flow is #11.
- **Definition of done for the update mechanism:** `npm run capture` → run the CLI on this repo → a clean `git diff` across `.archgate/**` and `.claude/rules/`. The dogfood *is* the test that the overwrite path works and is idempotent — it runs the same real `cpSync(force)` a foreign Target does (the dogfood script and CI clean-diff guard are #50), not a skipped no-op.
- **Workflow rule — capture before you install.** Because `.archgate/` is the authoring workspace (§1) *and* the install's destination, running the install over *un-captured* workspace edits reverts them to the last captured bytes. The accepted discipline is **edit `.archgate/` → `npm run capture` → install**; the CI freshness guard (§1) keeps the committed asset byte-equal to canonical on every PR, so on any committed state the dogfood is a clean overwrite and no edit is lost by surprise.

## 5. Two new declarative Action kinds

`apply()` stays the single IO chokepoint (ADR-0004). Two `Action` kinds are added:

- **`copyAsset`** — copy a file (sub)tree from the CLI's bundled asset into the Target.
- **`symlink`** — create a relative symlink. **Real-symlink-only; never a copy fallback.** A copied body would invert `adr-claude-rules-symlink` (archgate can open a copy → the rule fails), turning every ADR into a false violation. On a platform/permission where `fs.symlink` fails (Windows without Developer Mode/admin), the action errors loudly with a post-run note — it does not silently degrade. Full Windows support is **deferred** to the target-matrix / Dockerized-e2e work (#4).

## 6. Config seed — portable default, version-gated

The seed materialises GEN-003's portable built-in `DEFAULT_CONFIG` (the 4 root-or-specific entries) plus the `version` stamp — **not** this repo's richer 8-entry config, whose project-specific `docs/adr`→`design-adr` / `docs/agents`→`agent-doc` / `.claude/agents`→`agent` / `CONTEXT.md` entries are the repo-specific surface #14 carves out and offers separately. Seeding is therefore a behaviour no-op: it materialises, visibly and editably, exactly the policy GEN-003 already applies when the file is absent.

Known limitation, accepted and deferred: `config-version` compares the seeded `version` against the **Target's own** root `package.json` `.version`. On this repo the harness *is* the package, so they coincide; in a foreign Target they diverge and `archgate check` errors until #11 corrects the version envelope (to compare against the installed harness release). A post-run note explains a version mismatch rather than leaving it mysterious.

Because GEN-003's `DEFAULT_CONFIG` is hardcoded in its `rules.ts` (archgate rules cannot import) and the CLI's seed is separate code, a keep-honest test asserts the CLI seed equals `DEFAULT_CONFIG` — the same shared-source discipline GEN-002/003 already use.

## 7. Fixtures relocation

Both `*.rules.test.ts` currently import shared fixtures from `test/fixtures/` — a path that, in a Target, resolves outside `.archgate/`. To keep core self-contained, the shared fixtures move under `.archgate/` and the two imports are repointed. This is a small change made here under live governance, and it lines up with the `#490` "`.archgate`-contained shared helper imports" thread. Tests (not rules) do the importing, so archgate's no-imports constraint on rules files is untouched.

## Consequences

**Positive:**

- One canonical byte-source per file, still fully governed by the contract it defines; no second hand-maintained copy to drift.
- Adding a foundational ADR is a one-line `ADR_CORE` edit; the capture picks it up on the next release.
- Both install modes become deterministic and idempotent (see ADR-0005 v4), and self-apply runs the same real `cpSync(force)` overwrite a foreign Target does — so the dogfood is a genuine test of the install path, not a skipped no-op.
- A brownfield Target is brought to the current governance release in one run.

**Negative:**

- `.archgate/` is both the authoring workspace and the install's destination, so running the install over un-captured workspace edits reverts them to the last captured bytes; mitigated by the edit → capture → install workflow rule (§4) and the CI freshness guard (§1).
- The published package grows beyond `dist/`: the asset must be staged and kept fresh by a prepack step, CI-gated so it cannot lag the canonical source.
- The config seed is knowingly broken-on-arrival for a foreign Target whose app version differs, until #11 — the ADR bundle still installs correctly.
- Windows symlink creation is unsupported until the deferred target-matrix work; the failure is loud, not silent.
- A copied-body fallback for symlinks is deliberately unavailable, so a symlink failure blocks that part of the install rather than producing a subtly-wrong result.

## History

- **v1:** establishes the capture model, `harness.config.json`/`ADR_CORE`, Tool-owned bundle replacement with Seeded config, the `copyAsset`/`symlink` Action kinds, and the version-gated seed. Realises GEN-002's deferred "Templates/scaffolding" note.
- **v2 (#48 always-overwrite):** reframes §1 into two roles — `.archgate/` as the **authoring workspace** (source for the next capture) and the committed asset as the **distribution source-of-truth** every install reads, self-apply included. Consequently `resolveBundleRoot()` returns the asset in dev, self-apply, and published installs alike (superseding #47's "canonical in dev/self-apply"), and the `apply()` path-equality skip plus the canonical-vs-asset branch are removed. §4's definition-of-done becomes capture → install → clean `git diff` with **no skip-self guard**, so the self-apply dogfood runs the real `cpSync(force)` overwrite rather than a skipped no-op (realigning with #50 and #43 user story 18). Adds the capture-before-install workflow rule and records its accepted trade-off (install reverts un-captured workspace edits). ADR-0005 stays v4 — the direct-write model is unchanged; only the install's read-source is made unconditionally the asset.

- **v3 (okf#32 phase 0):** `ADR_CORE` shrinks to `["GEN-001"]` and `supportingFiles` to `["rules.d.ts"]`, so §2's and §3's enumerations describe a three-ADR bundle that no longer ships. `GEN-002` and `GEN-003` are **unshipped, not deleted** — they still govern this repo from `.archgate/`, and only the copy that travels to a Target is withdrawn, pending their replacement by `markdown-harness`. Consequently §6's version-gated config seed is removed entirely (the `.typescript-ai-harness.json` it wrote configured `GEN-003`, so with the floor unshipped a Target got a config file with no reader), and §4's "Seeded config" half now covers only `.archgate/config.json` and `.claude/settings.local.json`. §5's `symlink` rationale is also superseded on its own terms: it argued real-symlink-only because "a copied body would invert `adr-claude-rules-symlink`", but archgate's reader now resolves symlinks, so a copy is invisible to that rule rather than fatal to it — the real-symlink requirement stands, and `src/run.test.ts`'s `lstat` check is what enforces it. Deleting the two ADRs, their four supporting files, `.typescript-ai-harness.json` and this ADR's GEN-002/GEN-003 References links stays deferred until the replacement is real.

## References

- [archgate Integration (ADR-0005)](./0005-archgate-integration.md) — the Integration behaviour (v4: unified direct-write) that invokes core.
- [Self-hosting scaffolder (ADR-0003)](./0003-self-hosting-scaffolder.md) — templates-as-source, amended here for the core bundle.
- [Integration contract (ADR-0004)](./0004-integration-contract.md) — the `Action` model the two new kinds extend.
- [Harness Config (GEN-002)](../../.archgate/adrs/GEN-002-harness-config.md) — the config envelope, version rule, and its deferred scaffolding note.
- [Frontmatter Contract (GEN-003)](../../.archgate/adrs/GEN-003-frontmatter.md) — the `DEFAULT_CONFIG` the seed materialises.
- [ADR Contract (GEN-001)](../../.archgate/adrs/GEN-001-adr.md) — forces the bundle's membership (test sibling, `.claude/rules` symlink) and the symlink-not-copy mechanic.
- Deferred / linked: [#11](https://github.com/hancrafted/typescript-ai-harness/issues/11) (version-in-target + migrate), [#14](https://github.com/hancrafted/typescript-ai-harness/issues/14) (offered design-adr disambiguation), [#490 archgate](https://github.com/archgate) (fixtures relocation), [#4](https://github.com/hancrafted/typescript-ai-harness/issues/4) (Windows + e2e).
