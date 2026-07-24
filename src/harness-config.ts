import rawHarnessConfig from '../harness.config.json';

/**
 * The **Harness build config** (ADR-0010 §2): root, Tool-owned metadata naming
 * what the Core governance bundle ships. It is read by the capture step (#47)
 * and by the CLI on self-apply, and is **never shipped to a Target** — the
 * `package.json` `files` whitelist ships only `dist`, so the JSON import below
 * is inlined into the bundle at build (tsup/esbuild) and the source file itself
 * stays out of the published tarball.
 *
 * Distinct from `.archgate/config.json` (archgate's own runtime config) and
 * `.typescript-ai-harness.json` (the Target-facing runtime config, GEN-002-owned).
 */
export interface HarnessConfig {
  /**
   * The explicit, ordered list of core ADR ids — `["GEN-001", "GEN-002",
   * "GEN-003"]` today. Deliberately an explicit list, never a `GEN-*` glob, so
   * a half-finished ADR cannot leak into a release (ADR-0010 §2).
   */
  ADR_CORE: string[];
  /**
   * The `.archgate/`-relative supporting files the bundle carries beyond the
   * per-ADR trios: the two `harness-config-*.d.ts` (GEN-002/003 reference them)
   * and the shared fixtures both `.rules.test.ts` import (ADR-0010 §3, §7).
   *
   * `frontmatter-config.md` (named in ADR-0010 §3) is intentionally absent: it
   * lives at `docs/agents/frontmatter-config.md` today, outside `.archgate/`,
   * and will be added here only once it ships alongside a dedicated
   * frontmatter-config skill that becomes its reference — tracked with the
   * capture work (#47). Listing it before the file exists under `.archgate/`
   * would point that capture at a missing path.
   */
  supportingFiles: string[];
  /**
   * The pinned archgate Dependency version range (ADR-0005). The single
   * greppable version source, moved here from the former `template.ts`
   * constant so "what core ships" is one readable file.
   */
  ARCHGATE_VERSION: string;
}

// Field-level guards, each kept small so the compound conditions live behind a
// name (eslint `complexity`) and narrow `raw`'s untyped fields as they validate.
const isConfigObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

// A list of non-empty path/id strings — an empty element would pass as a broken
// capture target downstream (#47), so it is rejected here. supportingFiles may
// be empty; ADR_CORE additionally must be non-empty (isCoreList).
const isPathList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isNonEmptyString);

const isCoreList = (value: unknown): value is string[] => isPathList(value) && value.length > 0;

/**
 * Validate an untrusted parse of the build config into a {@link HarnessConfig},
 * throwing a pinpointed error on any malformed field. Kept a pure function
 * (separate from the module-load read below) so it is unit-coverable in isolation
 * and could validate a config parsed from any source, not only the baked import.
 */
export function parseHarnessConfig(raw: unknown): HarnessConfig {
  if (!isConfigObject(raw)) {
    throw new Error('harness.config.json: expected a JSON object');
  }
  const { ADR_CORE, supportingFiles, ARCHGATE_VERSION } = raw;
  if (!isCoreList(ADR_CORE)) {
    throw new Error('harness.config.json: "ADR_CORE" must be a non-empty array of non-empty strings');
  }
  if (!isPathList(supportingFiles)) {
    throw new Error('harness.config.json: "supportingFiles" must be an array of non-empty strings');
  }
  if (!isNonEmptyString(ARCHGATE_VERSION)) {
    throw new Error('harness.config.json: "ARCHGATE_VERSION" must be a non-empty string');
  }
  return { ADR_CORE, supportingFiles, ARCHGATE_VERSION };
}

/** The validated build config, parsed once at module load from the baked JSON. */
export const harnessConfig: HarnessConfig = parseHarnessConfig(rawHarnessConfig);

export const { ADR_CORE, supportingFiles, ARCHGATE_VERSION } = harnessConfig;
