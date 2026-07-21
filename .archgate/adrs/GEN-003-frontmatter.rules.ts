/// <reference path="../rules.d.ts" />

// GEN-003 — Frontmatter Contract: the OKF frontmatter floor that owns `type`
// repo-wide. One rule, `frontmatter-floor`, resolves every governed markdown
// file to its pathRules entry (first-match-wins) and enforces the floor there —
// a kebab-case type, exactly one pinned label (name xor title), and a
// description. Scope and per-file policy are read from the harness config
// `.typescript-ai-harness.json` (schema owned by GEN-002); when that config or
// its `adr.frontmatter` block is absent the built-in DEFAULT_CONFIG below
// applies. Single evaluation path: `userConfig?.adr?.frontmatter ?? DEFAULT`.
// The rule DECLARES the error tier per GEN-001 §7 and emits a per-file report at
// the matched entry's configured tier (default error) through one code path.
const CONFIG_PATH = '.typescript-ai-harness.json';

// OKF/Agent-Skills default ceilings; a pathRules entry may raise either via
// maxLabel / maxDescription. `type` is the OKF anchor and is always mandatory in
// a governed entry.
const DEFAULT_MAX_LABEL = 64;
const DEFAULT_MAX_DESCRIPTION = 1024;

// The tier a matched entry emits at. Written via this constant — never as a
// `severity:`-prefixed literal — so GEN-001's adr-error-tier scan does not read
// this rules file as declaring a non-error rule.
const WARNING_TIER = 'warning';
const DRAFT_TYPE = 'draft';

// A kebab-case token: lowercase alphanumerics in one-or-more hyphen-joined
// segments (e.g. `adr`, `design-adr`, `agents-md`).
const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The built-in default policy, applied when the harness config or its
// adr.frontmatter block is absent. Expressed in GEN-002's pathRules shape as a
// typed constant — deliberately not a JSON file, which cannot live under
// .archgate/adrs/ (GEN-001 adr-governed-files). Every entry is root-or-specific
// (no `**`), closes allowedTypes to one type, pins the title label, and runs at
// the error tier, so installing the contract never sweeps node_modules or
// vendored markdown. Keys are unquoted so GEN-001's ruleKeysOf scan reads no
// phantom rule here.
const DEFAULT_CONFIG: Record<string, unknown> = {
  unmatched: 'exempt',
  pathRules: [
    { match: '.archgate/adrs/*.md', allowedTypes: ['adr'], label: 'title' },
    { match: 'README.md', allowedTypes: ['docs'], label: 'title' },
    { match: 'AGENTS.md', allowedTypes: ['agents-md'], label: 'title' },
    { match: 'CLAUDE.md', allowedTypes: ['claude-md'], label: 'title' },
  ],
};

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

// The `adr.frontmatter` block of the harness config, or null when the config —
// or that block — is absent or the wrong shape. The floor keys its DEFAULT
// fallback off a null here.
function frontmatterConfig(config: unknown): Record<string, unknown> | null {
  if (!config || typeof config !== 'object') return null;
  const adr = (config as Record<string, unknown>).adr;
  if (!adr || typeof adr !== 'object') return null;
  const fm = (adr as Record<string, unknown>).frontmatter;
  if (!fm || typeof fm !== 'object') return null;
  return fm as Record<string, unknown>;
}

function isPositiveInt(n: unknown): boolean {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
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

// ---- frontmatter-floor helpers ----

function labelDesc(label: string | null): string {
  return label ?? 'name or title';
}

function checkType(
  emit: Emit,
  file: string,
  type: string | null,
  rule: Record<string, unknown>,
  draftEscape: boolean,
): void {
  if (!type) {
    emit({ message: `Governed file is missing the required 'type' key (GEN-003 [frontmatter-floor]).`, file });
    return;
  }
  if (!KEBAB_RE.test(type)) {
    emit({
      message: `Governed file 'type: ${type}' must be kebab-case — lowercase alphanumerics joined by single hyphens (GEN-003 [frontmatter-floor]).`,
      file,
    });
    return;
  }
  if (Array.isArray(rule.allowedTypes)) {
    const allowed = new Set(rule.allowedTypes as string[]);
    if (draftEscape) allowed.add(DRAFT_TYPE);
    if (!allowed.has(type)) {
      const suffix = draftEscape ? ` (or '${DRAFT_TYPE}')` : '';
      emit({
        message: `Governed file 'type: ${type}' is not one of the matched entry's allowed types [${(rule.allowedTypes as string[]).join(', ')}]${suffix} (GEN-003 [frontmatter-floor]).`,
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
  rule: Record<string, unknown>,
): void {
  if (!val) return;
  const cap = isPositiveInt(rule.maxLabel) ? (rule.maxLabel as number) : DEFAULT_MAX_LABEL;
  if (val.length > cap) {
    emit({
      message: `Governed file '${labelKey}' is ${val.length} chars, exceeding the matched entry's ${cap}-char cap (GEN-003 [frontmatter-floor]).`,
      file,
    });
  }
}

function checkLabel(emit: Emit, file: string, fm: string, label: string | null, rule: Record<string, unknown>): void {
  const name = getFrontmatterValue(fm, 'name');
  const title = getFrontmatterValue(fm, 'title');
  if (label === 'name' || label === 'title') {
    const other = label === 'name' ? 'title' : 'name';
    const reqVal = label === 'name' ? name : title;
    const otherVal = label === 'name' ? title : name;
    if (!reqVal) {
      emit({
        message: `Governed file must carry '${label}', the matched entry's pinned label (GEN-003 [frontmatter-floor]).`,
        file,
      });
    }
    if (otherVal) {
      emit({
        message: `Governed file carries '${other}' but the matched entry pins '${label}' — use only '${label}' (GEN-003 [frontmatter-floor]).`,
        file,
      });
    }
    checkLabelLength(emit, file, reqVal, label, rule);
    return;
  }
  if (!name && !title) {
    emit({ message: `Governed file must carry exactly one of 'name' or 'title' (GEN-003 [frontmatter-floor]).`, file });
  }
  if (name && title) {
    emit({
      message: `Governed file carries both 'name' and 'title' — exactly one is allowed (GEN-003 [frontmatter-floor]).`,
      file,
    });
  }
  checkLabelLength(emit, file, name ?? title, name ? 'name' : 'title', rule);
}

function checkDescription(emit: Emit, file: string, fm: string, rule: Record<string, unknown>): void {
  const desc = getFrontmatterValue(fm, 'description');
  if (!desc) {
    emit({ message: `Governed file is missing the required 'description' key (GEN-003 [frontmatter-floor]).`, file });
    return;
  }
  const cap = isPositiveInt(rule.maxDescription) ? (rule.maxDescription as number) : DEFAULT_MAX_DESCRIPTION;
  if (desc.length > cap) {
    emit({
      message: `Governed file 'description' is ${desc.length} chars, exceeding the matched entry's ${cap}-char cap (GEN-003 [frontmatter-floor]).`,
      file,
    });
  }
}

async function checkFloor(
  ctx: RuleContext,
  file: string,
  rule: Record<string, unknown>,
  draftEscape: boolean,
): Promise<void> {
  // Per-entry tier resolved to the matching report channel — one code path, no
  // second rule. A missing/other tier falls to violation (error).
  const emit: Emit = (detail) =>
    rule.severity === WARNING_TIER ? ctx.report.warning(detail) : ctx.report.violation(detail);
  const content = await tryReadFile(ctx, file);
  // A governed file we cannot read (e.g. a symlink archgate refuses to follow)
  // cannot be classified; exempt-by-default entries never glob such files, so
  // reaching one here means the config scoped it deliberately — skip rather than
  // emit a spurious floor violation the author cannot satisfy in place.
  if (content === null) return;
  const label = typeof rule.label === 'string' ? rule.label : null;
  const fm = extractFrontmatter(content);
  if (fm === null) {
    emit({
      message: `Governed file has no YAML frontmatter block — the floor requires type + ${labelDesc(label)} + description (GEN-003 [frontmatter-floor]).`,
      file,
    });
    return;
  }
  checkType(emit, file, getFrontmatterValue(fm, 'type'), rule, draftEscape);
  checkLabel(emit, file, fm, label, rule);
  checkDescription(emit, file, fm, rule);
}

export default {
  rules: {
    'frontmatter-floor': {
      description:
        "Every governed markdown file, resolved to its pathRules entry first-match-wins (or the built-in default when the harness config is absent), carries the OKF floor — a kebab-case type, exactly the pinned label (name xor title), and a description — each within the entry's caps (default name/title 64, description 1024). Membership is checked against the entry's allowedTypes plus draft when draftEscape is on; an exempt entry or an unmatched file bears no floor. The rule runs the single path userConfig?.adr?.frontmatter ?? DEFAULT and emits at the matched entry's tier (default error) from one code path.",
      severity: 'error',
      async check(ctx) {
        // Single evaluation path: a present adr.frontmatter block replaces the
        // default outright; an absent one falls back to the built-in default.
        const fm = frontmatterConfig(await tryReadJSON(ctx, CONFIG_PATH)) ?? DEFAULT_CONFIG;
        const pathRules = Array.isArray(fm.pathRules) ? fm.pathRules : [];
        const draftEscape = fm.draftEscape === true;
        const claimed = new Set<string>();
        for (const entry of pathRules) {
          if (!entry || typeof entry !== 'object') continue;
          const rule = entry as Record<string, unknown>;
          const patterns = matchPatterns(rule.match);
          if (patterns.length === 0) continue;
          for (const file of await globAll(ctx, patterns)) {
            if (claimed.has(file)) continue; // an earlier entry owns it (first-match-wins)
            claimed.add(file);
            if (rule.exempt === true) continue; // floor off for this entry
            await checkFloor(ctx, file, rule, draftEscape);
          }
        }
      },
    },
  },
} satisfies RuleSet;
