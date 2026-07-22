import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
 * Choose the bundle root from a project root: the live canonical `.archgate/`
 * when its `adrs/` tree is present (dev and self-apply, where the governed
 * source sits beside the running code), else the shipped `assets/core-bundle/`
 * asset — a published install never receives `.archgate/`, only the captured
 * asset. Pure (`exists` is injected) so both arms are testable directly. (ADR-0010 §1)
 */
export function selectBundleRoot(projectRoot: string, exists: (path: string) => boolean = existsSync): string {
  const canonical = join(projectRoot, '.archgate');
  if (exists(join(canonical, ADRS_DIR))) return canonical;
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
 * The absolute bundle root for the running CLI. In dev (tsx) this module is
 * `src/bundle.ts`; bundled it is `dist/cli.mjs` — both sit one level under the
 * project/package root, so {@link projectRootOf} yields that root either way,
 * and {@link selectBundleRoot} then picks canonical or asset. The consumer (the
 * plan rewrite, #48) reads this to source the files its copyAsset/symlink
 * Actions install.
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
 * and each surviving file is a byte copy of its canonical source — making
 * self-application a byte-identical no-op and letting a CI guard diff the two
 * (ADR-0010 §1, §4).
 */
export function captureBundle(opts: CaptureOpts): string[] {
  const { canonical, assetRoot, core, supporting } = opts;
  rmSync(assetRoot, { recursive: true, force: true });
  const listing = readdirSync(join(canonical, ADRS_DIR));
  const adrFiles = core.flatMap((id) => adrTrio(id, listing).map((file) => join(ADRS_DIR, file)));
  const written = [...adrFiles, ...supporting];
  for (const relative of written) copyOne(canonical, assetRoot, relative);
  return written;
}

/** Copy one canonical-relative file into the asset at the same relative path. */
function copyOne(canonical: string, assetRoot: string, relative: string): void {
  const dest = join(assetRoot, relative);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(join(canonical, relative), dest);
}
