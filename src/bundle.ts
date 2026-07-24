import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The Core governance bundle (ADR-0010): the canonical ADR trios + supporting
 * files that the CLI installs into a Target. This module owns two seams — where
 * those files are read from at run time ({@link resolveBundleRoot}) and how they
 * are staged into the committed asset ({@link captureBundle}) — with the pure
 * pieces factored out so both arms are unit-coverable without a real published
 * layout or a live `.archgate/`.
 */

/** Bundle-root-relative subdir holding the per-ADR trios, shared by canonical and asset. */
const ADRS_DIR = 'adrs';

/**
 * The bundle root for a project root: **always** the committed
 * `assets/core-bundle/` asset. The install reads the captured asset in every
 * context — dev, self-apply, and a published install alike — so self-apply runs
 * the same real `cpSync(force)` overwrite a foreign Target does, with no
 * canonical-vs-asset branch and no skip (#48). `.archgate/` is the authoring
 * workspace (the source for the *next* capture), not what the install reads; the
 * committed asset is the distribution source-of-truth (ADR-0010 §1 v2), kept
 * byte-equal to canonical by the CI freshness guard so self-apply is a clean
 * overwrite. Pure and total — no filesystem probe. (ADR-0010 §1)
 */
export function selectBundleRoot(projectRoot: string): string {
  return join(projectRoot, 'assets', 'core-bundle');
}

/**
 * The project/package root for a module that sits one level beneath it — `src/`
 * in dev (tsx), `dist/` once bundled, or `scripts/` for the capture tool. Takes
 * the caller's own `import.meta.url` because that value resolves relative to the
 * calling module, not this one.
 */
export function projectRootOf(moduleUrl: string): string {
  return dirname(dirname(fileURLToPath(moduleUrl)));
}

/**
 * The absolute bundle root for the running CLI: the committed
 * `assets/core-bundle/` asset. In dev (tsx) this module is `src/bundle.ts`;
 * bundled it is `dist/cli.mjs` — both sit one level under the project/package
 * root, so {@link projectRootOf} yields that root either way, and
 * {@link selectBundleRoot} appends the asset path. The consumer (the archgate
 * plan, #48) reads this to source the files its copyAsset/symlink Actions
 * install; because the source is always under the asset and the destination
 * always under `.archgate/`, the two never coincide and the copy always runs.
 */
export function resolveBundleRoot(): string {
  return selectBundleRoot(projectRootOf(import.meta.url));
}

/**
 * The `adrs/`-relative trio for one core ADR, discovered from a directory
 * listing: its `<id>-<slug>.md` + `.rules.ts` + `.rules.test.ts` (GEN-001 §6).
 * Matches on the `<id>-` prefix so a neighbour like `GEN-0010` is never mistaken
 * for `GEN-001`. Throws when any member is missing — a half-authored ADR named
 * in `ADR_CORE` must fail the capture loudly, not ship a partial bundle (ADR-0010 §2).
 */
export function adrTrio(id: string, listing: string[]): string[] {
  const mine = listing.filter((file) => file.startsWith(`${id}-`));
  const md = mine.find((file) => file.endsWith('.md'));
  const rules = mine.find((file) => file.endsWith('.rules.ts'));
  const test = mine.find((file) => file.endsWith('.rules.test.ts'));
  if (!md || !rules || !test) {
    throw new Error(
      `core ADR ${id}: expected a .md + .rules.ts + .rules.test.ts trio under .archgate/${ADRS_DIR}/, ` +
        `found [${mine.join(', ')}]`,
    );
  }
  return [md, rules, test];
}

/** The concrete member set a bundle root carries: files to copy, ADR docs to symlink. */
export interface BundleLayout {
  /**
   * Every bundle-root-relative file path the install copies into a Target's
   * `.archgate/` — each ADR trio member (`adrs/`-relative) then the supporting
   * files — with forward-slash separators so the derived `to`/link paths are
   * deterministic across platforms.
   */
  files: string[];
  /**
   * The `adrs/`-relative `.md` basename of each core ADR, in `ADR_CORE` order:
   * the source for the one `.claude/rules/<name>.md` symlink each ADR needs
   * (GEN-001 §6, `adr-claude-rules-symlink`).
   */
  adrDocs: string[];
}

/**
 * Resolve a bundle root to its concrete member set by listing its `adrs/` dir
 * once. Both the capture ({@link captureBundle}) and the install (the archgate
 * plan, #48) enumerate from the *explicit* `ADR_CORE` ids rather than globbing
 * `adrs/`, so a non-core ADR sitting in the tree can never leak into a release
 * or an install (ADR-0010 §2). `files` drives the copyAsset actions; `adrDocs`
 * (each trio's leading `.md`) drives the `.claude/rules/<name>.md` symlinks.
 */
export function readBundleLayout(bundleRoot: string, core: string[], supporting: string[]): BundleLayout {
  const listing = readdirSync(join(bundleRoot, ADRS_DIR));
  const trios = core.map((id) => adrTrio(id, listing));
  const adrFiles = trios.flatMap((trio) => trio.map((file) => posix.join(ADRS_DIR, file)));
  return { files: [...adrFiles, ...supporting], adrDocs: trios.map(([md]) => md) };
}

export interface CaptureOpts {
  /** The canonical governed source root — `.archgate/`. */
  canonical: string;
  /** The committed asset root the bundle is staged into — `assets/core-bundle/`. */
  assetRoot: string;
  /** The ordered core ADR ids (`ADR_CORE`). */
  core: string[];
  /** The `.archgate/`-relative supporting files (`supportingFiles`). */
  supporting: string[];
}

/**
 * Stage the Core bundle from `canonical` into `assetRoot`, returning the
 * bundle-relative paths written. The asset is **Tool-owned**: the target is
 * wiped first, so a member dropped from `ADR_CORE` leaves no stale file behind,
 * and each surviving file is a byte copy of its canonical source — keeping the
 * committed asset byte-equal to canonical, which a CI guard diffs to block drift
 * and which makes the self-apply overwrite (the install reads this asset)
 * reproduce the source byte-for-byte, a clean `git diff` (ADR-0010 §1, §4).
 */
export function captureBundle(opts: CaptureOpts): string[] {
  const { canonical, assetRoot, core, supporting } = opts;
  rmSync(assetRoot, { recursive: true, force: true });
  const { files } = readBundleLayout(canonical, core, supporting);
  for (const relative of files) copyOne(canonical, assetRoot, relative);
  return files;
}

/** Copy one canonical-relative file into the asset at the same relative path. */
function copyOne(canonical: string, assetRoot: string, relative: string): void {
  const dest = join(assetRoot, relative);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(join(canonical, relative), dest);
}
