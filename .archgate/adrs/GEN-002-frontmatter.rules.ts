/// <reference path="../rules.d.ts" />

// GEN-002 — Frontmatter Contract: the config-driven OKF frontmatter floor that
// owns `type` repo-wide. Two rules. `frontmatter-config-valid` guards the shape
// of the root manifest `.typescript-ai-harness.json`; `frontmatter-floor`
// resolves every governed markdown file to its zone (first-match-wins) and
// enforces the floor there. Both rules DECLARE the error tier per GEN-001 §7;
// the floor emits a per-file report at the matched zone's configured tier
// (default error) through a single code path. Both no-op when the manifest or
// its `adr.frontmatter` block is absent, so the contract is safe to ship before
// the config is seeded.
const MANIFEST_PATH = '.typescript-ai-harness.json';

// OKF/Agent-Skills default ceilings; a zone may raise either via maxLabel /
// maxDescription. `type` is the OKF anchor and is always mandatory in a
// governed zone.
const DEFAULT_MAX_LABEL = 64;
const DEFAULT_MAX_DESCRIPTION = 1024;

const VALID_LABELS = ['name', 'title'];
// The tiers a zone may declare. Written as a bare list — never as a
// `severity:`-prefixed literal — so GEN-001's adr-error-tier scan does not read
// this rules file as declaring a non-error rule.
const VALID_ZONE_TIERS = ['error', 'warning'];
const VALID_UNMATCHED = ['exempt'];
const WARNING_TIER = 'warning';
const DRAFT_TYPE = 'draft';

// A kebab-case token: lowercase alphanumerics in one-or-more hyphen-joined
// segments (e.g. `adr`, `design-adr`, `agents-md`).
const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Emit = (detail: { message: string; file?: string }) => void;

function extractFrontmatter(content: string): string | null {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
}

// Single-line frontmatter value, surrounding quotes stripped. Block scalars are
// out of scope — governed files author each floor key on one line.
function getFrontmatterValue(fm: string, key: string): string | null {
  const re = new RegExp(`^${key}[ \\t]*:[ \\t]*(.*)$`, 'm');
  const m = fm.match(re);
  if (!m) return null;
  return m[1]
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

async function tryReadFile(ctx: RuleContext, path: string): Promise<string | null> {
  try {
    return await ctx.readFile(path);
  } catch {
    return null;
  }
}

async function tryReadJSON(ctx: RuleContext, path: string): Promise<unknown> {
  try {
    return await ctx.readJSON(path);
  } catch {
    return null;
  }
}

// The `adr.frontmatter` block of the manifest, or null when the manifest — or
// that block — is absent or the wrong shape. Both rules key their no-op off it.
function frontmatterConfig(manifest: unknown): Record<string, unknown> | null {
  if (!manifest || typeof manifest !== 'object') return null;
  const adr = (manifest as Record<string, unknown>).adr;
  if (!adr || typeof adr !== 'object') return null;
  const fm = (adr as Record<string, unknown>).frontmatter;
  if (!fm || typeof fm !== 'object') return null;
  return fm as Record<string, unknown>;
}

function isPositiveInt(n: unknown): boolean {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

function isMatch(m: unknown): boolean {
  if (typeof m === 'string') return m.length > 0;
  return Array.isArray(m) && m.length > 0 && m.every((x) => typeof x === 'string' && x.length > 0);
}

function isKebabArray(a: unknown): boolean {
  return Array.isArray(a) && a.every((x) => typeof x === 'string' && KEBAB_RE.test(x));
}

function matchPatterns(m: unknown): string[] {
  if (typeof m === 'string') return [m];
  if (Array.isArray(m)) return m.filter((x): x is string => typeof x === 'string');
  return [];
}

async function globAll(ctx: RuleContext, patterns: string[]): Promise<string[]> {
  const out = new Set<string>();
  for (const p of patterns) {
    for (const f of await ctx.glob(p)) out.add(f);
  }
  return [...out];
}

// ---- frontmatter-config-valid helpers ----

function validateZone(ctx: RuleContext, zone: unknown, index: number): void {
  const where = `zone[${index}]`;
  if (!zone || typeof zone !== 'object') {
    ctx.report.violation({
      message: `Manifest ${where} must be an object (GEN-002 [frontmatter-config-valid]).`,
      file: MANIFEST_PATH,
    });
    return;
  }
  const z = zone as Record<string, unknown>;
  if (!isMatch(z.match)) {
    ctx.report.violation({
      message: `Manifest ${where}.match must be a non-empty glob string or array of glob strings (GEN-002 [frontmatter-config-valid]).`,
      file: MANIFEST_PATH,
    });
  }
  if (z.exempt !== undefined && typeof z.exempt !== 'boolean') {
    ctx.report.violation({
      message: `Manifest ${where}.exempt must be a boolean (GEN-002 [frontmatter-config-valid]).`,
      file: MANIFEST_PATH,
    });
  }
  if (z.allowedTypes !== undefined && !isKebabArray(z.allowedTypes)) {
    ctx.report.violation({
      message: `Manifest ${where}.allowedTypes must be an array of kebab-case type strings (GEN-002 [frontmatter-config-valid]).`,
      file: MANIFEST_PATH,
    });
  }
  if (z.label !== undefined && !VALID_LABELS.includes(z.label as string)) {
    ctx.report.violation({
      message: `Manifest ${where}.label must be 'name' or 'title' (GEN-002 [frontmatter-config-valid]).`,
      file: MANIFEST_PATH,
    });
  }
  if (z.severity !== undefined && !VALID_ZONE_TIERS.includes(z.severity as string)) {
    ctx.report.violation({
      message: `Manifest ${where}.severity must be 'error' or 'warning' (GEN-002 [frontmatter-config-valid]).`,
      file: MANIFEST_PATH,
    });
  }
  if (z.maxLabel !== undefined && !isPositiveInt(z.maxLabel)) {
    ctx.report.violation({
      message: `Manifest ${where}.maxLabel must be a positive integer (GEN-002 [frontmatter-config-valid]).`,
      file: MANIFEST_PATH,
    });
  }
  if (z.maxDescription !== undefined && !isPositiveInt(z.maxDescription)) {
    ctx.report.violation({
      message: `Manifest ${where}.maxDescription must be a positive integer (GEN-002 [frontmatter-config-valid]).`,
      file: MANIFEST_PATH,
    });
  }
}

// ---- frontmatter-floor helpers ----

function labelDesc(label: string | null): string {
  return label ?? 'name or title';
}

function checkType(
  emit: Emit,
  file: string,
  type: string | null,
  z: Record<string, unknown>,
  draftEscape: boolean,
): void {
  if (!type) {
    emit({ message: `Governed file is missing the required 'type' key (GEN-002 [frontmatter-floor]).`, file });
    return;
  }
  if (!KEBAB_RE.test(type)) {
    emit({
      message: `Governed file 'type: ${type}' must be kebab-case — lowercase alphanumerics joined by single hyphens (GEN-002 [frontmatter-floor]).`,
      file,
    });
    return;
  }
  if (Array.isArray(z.allowedTypes)) {
    const allowed = new Set(z.allowedTypes as string[]);
    if (draftEscape) allowed.add(DRAFT_TYPE);
    if (!allowed.has(type)) {
      const suffix = draftEscape ? ` (or '${DRAFT_TYPE}')` : '';
      emit({
        message: `Governed file 'type: ${type}' is not one of this zone's allowed types [${(z.allowedTypes as string[]).join(', ')}]${suffix} (GEN-002 [frontmatter-floor]).`,
        file,
      });
    }
  }
}

function checkLabelLength(
  emit: Emit,
  file: string,
  val: string | null,
  labelKey: string,
  z: Record<string, unknown>,
): void {
  if (!val) return;
  const cap = isPositiveInt(z.maxLabel) ? (z.maxLabel as number) : DEFAULT_MAX_LABEL;
  if (val.length > cap) {
    emit({
      message: `Governed file '${labelKey}' is ${val.length} chars, exceeding this zone's ${cap}-char cap (GEN-002 [frontmatter-floor]).`,
      file,
    });
  }
}

function checkLabel(emit: Emit, file: string, fm: string, label: string | null, z: Record<string, unknown>): void {
  const name = getFrontmatterValue(fm, 'name');
  const title = getFrontmatterValue(fm, 'title');
  if (label === 'name' || label === 'title') {
    const other = label === 'name' ? 'title' : 'name';
    const reqVal = label === 'name' ? name : title;
    const otherVal = label === 'name' ? title : name;
    if (!reqVal) {
      emit({
        message: `Governed file must carry '${label}', this zone's pinned label (GEN-002 [frontmatter-floor]).`,
        file,
      });
    }
    if (otherVal) {
      emit({
        message: `Governed file carries '${other}' but this zone pins '${label}' — use only '${label}' (GEN-002 [frontmatter-floor]).`,
        file,
      });
    }
    checkLabelLength(emit, file, reqVal, label, z);
    return;
  }
  if (!name && !title) {
    emit({ message: `Governed file must carry exactly one of 'name' or 'title' (GEN-002 [frontmatter-floor]).`, file });
  }
  if (name && title) {
    emit({
      message: `Governed file carries both 'name' and 'title' — exactly one is allowed (GEN-002 [frontmatter-floor]).`,
      file,
    });
  }
  checkLabelLength(emit, file, name ?? title, name ? 'name' : 'title', z);
}

function checkDescription(emit: Emit, file: string, fm: string, z: Record<string, unknown>): void {
  const desc = getFrontmatterValue(fm, 'description');
  if (!desc) {
    emit({ message: `Governed file is missing the required 'description' key (GEN-002 [frontmatter-floor]).`, file });
    return;
  }
  const cap = isPositiveInt(z.maxDescription) ? (z.maxDescription as number) : DEFAULT_MAX_DESCRIPTION;
  if (desc.length > cap) {
    emit({
      message: `Governed file 'description' is ${desc.length} chars, exceeding this zone's ${cap}-char cap (GEN-002 [frontmatter-floor]).`,
      file,
    });
  }
}

async function checkFloor(
  ctx: RuleContext,
  file: string,
  z: Record<string, unknown>,
  draftEscape: boolean,
): Promise<void> {
  // Per-zone tier resolved to the matching report channel — one code path, no
  // second rule. A missing/other tier falls to violation (error).
  const emit: Emit = (detail) =>
    z.severity === WARNING_TIER ? ctx.report.warning(detail) : ctx.report.violation(detail);
  const content = await tryReadFile(ctx, file);
  // A governed file we cannot read (e.g. a symlink archgate refuses to follow)
  // cannot be classified; exempt-by-default zones never glob such files, so
  // reaching one here means the manifest scoped it deliberately — skip rather
  // than emit a spurious floor violation the author cannot satisfy in place.
  if (content === null) return;
  const label = typeof z.label === 'string' ? z.label : null;
  const fm = extractFrontmatter(content);
  if (fm === null) {
    emit({
      message: `Governed file has no YAML frontmatter block — the floor requires type + ${labelDesc(label)} + description (GEN-002 [frontmatter-floor]).`,
      file,
    });
    return;
  }
  checkType(emit, file, getFrontmatterValue(fm, 'type'), z, draftEscape);
  checkLabel(emit, file, fm, label, z);
  checkDescription(emit, file, fm, z);
}

export default {
  rules: {
    'frontmatter-config-valid': {
      description:
        "The root manifest's adr.frontmatter block is well-formed: zones is an array; each zone has a match glob; optional allowedTypes are kebab strings; label is name|title; the zone severity is error|warning; maxLabel/maxDescription are positive integers; unmatched and draftEscape are valid. Guards enforcement integrity — a malformed manifest surfaces as an error rather than silently disabling the floor.",
      severity: 'error',
      async check(ctx) {
        const fm = frontmatterConfig(await tryReadJSON(ctx, MANIFEST_PATH));
        if (fm === null) return; // manifest or adr.frontmatter absent — nothing to validate
        if (fm.unmatched !== undefined && !VALID_UNMATCHED.includes(fm.unmatched as string)) {
          ctx.report.violation({
            message: `Manifest adr.frontmatter.unmatched must be 'exempt' (GEN-002 [frontmatter-config-valid]).`,
            file: MANIFEST_PATH,
          });
        }
        if (fm.draftEscape !== undefined && typeof fm.draftEscape !== 'boolean') {
          ctx.report.violation({
            message: `Manifest adr.frontmatter.draftEscape must be a boolean (GEN-002 [frontmatter-config-valid]).`,
            file: MANIFEST_PATH,
          });
        }
        if (!Array.isArray(fm.zones)) {
          ctx.report.violation({
            message: `Manifest adr.frontmatter.zones must be an array (GEN-002 [frontmatter-config-valid]).`,
            file: MANIFEST_PATH,
          });
          return;
        }
        fm.zones.forEach((zone, index) => validateZone(ctx, zone, index));
      },
    },

    'frontmatter-floor': {
      description:
        "Every governed markdown file, resolved to its manifest zone first-match-wins, carries the OKF floor — a kebab-case type, exactly the zone-pinned label (name xor title), and a description — each within the zone's caps (default name/title 64, description 1024). Membership is checked against the zone's allowedTypes plus draft when draftEscape is on; an exempt zone or an unmatched file bears no floor. The rule emits at the matched zone's tier (default error) from one code path and no-ops when the manifest or its adr.frontmatter block is absent.",
      severity: 'error',
      async check(ctx) {
        const fm = frontmatterConfig(await tryReadJSON(ctx, MANIFEST_PATH));
        if (fm === null || !Array.isArray(fm.zones)) return; // no manifest — safe to ship pre-seed
        const draftEscape = fm.draftEscape === true;
        const claimed = new Set<string>();
        for (const zone of fm.zones) {
          if (!zone || typeof zone !== 'object') continue;
          const z = zone as Record<string, unknown>;
          const patterns = matchPatterns(z.match);
          if (patterns.length === 0) continue;
          for (const file of await globAll(ctx, patterns)) {
            if (claimed.has(file)) continue; // an earlier zone owns it (first-match-wins)
            claimed.add(file);
            if (z.exempt === true) continue; // floor off for this zone
            await checkFloor(ctx, file, z, draftEscape);
          }
        }
      },
    },
  },
} satisfies RuleSet;
