/// <reference path="../rules.d.ts" />
/// <reference path="../harness-config-extension.d.ts" />

// GEN-003 — Frontmatter Contract: the OKF frontmatter floor that owns `type`
// repo-wide, and the owner of the `markdown.frontmatter` block of the harness
// config `.typescript-ai-harness.json` (envelope and generic spine: GEN-002).
// Two rules:
//   - `frontmatter-config-valid` validates the block's OWN vocabulary, payload
//     only: each pathRules entry's `rule` and the block's `settings`, closed
//     keys with shape checks — a typo like `maxDescriptions` errors instead of
//     silently weakening the floor.
//   - `frontmatter-floor` consumes the block: every governed markdown file,
//     resolved to its pathRules entry by FileSet arithmetic (glob include −
//     exclude) first-match-wins, carries the floor — a kebab-case type, exactly
//     one pinned label (name xor title), an optional cap-checked description
//     (required when the entry's rule says so) and optional comma-separated
//     kebab-case tags. Under unmatched: 'error' every in-coverage file no
//     entry claims is a violation.
// Consumer contract (all-or-nothing, GEN-002 §3): config file absent, or a
// healthy file without the block → the built-in DEFAULT_CONFIG below; file
// present but unparseable, version skew against the installed harness release,
// or a spine-/payload-invalid block → the block governs NOTHING (GEN-002's
// rules and frontmatter-config-valid are the loud gate; best-effort would
// enforce wrong policy). This ADR also owns its fence in
// .archgate/harness-config-extension.d.ts — the `markdown.frontmatter`
// declaration GEN-002's shape rule reads as this block's registration. Both
// rules DECLARE the error tier per GEN-001 §7; the floor emits per-file
// reports at the matched entry's configured tier (default error).
const CONFIG_PATH = '.typescript-ai-harness.json';
// Deliberate copy of GEN-002's version probe and semver shape check (rules
// files cannot share runtime code): the config's top-level `version` must be a
// semver-shaped string equal to the installed harness release in package.json,
// or this consumer refuses to interpret the file — a config authored for
// another release is never read with this one's semantics. The shared
// conformance fixtures are the drift tripwire.
const PACKAGE_JSON = 'package.json';
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

// Default ceilings (OKF/Agent-Skills for label and description); an entry's
// rule may raise any of them via maxLabel / maxDescription / maxTag. `type` is
// the OKF anchor and is always mandatory in a governed entry.
const DEFAULT_MAX_LABEL = 64;
const DEFAULT_MAX_DESCRIPTION = 1024;
const DEFAULT_MAX_TAG = 30;

// The tier a matched entry emits at. Written via this constant — never as a
// `severity:`-prefixed literal — so GEN-001's adr-error-tier scan does not read
// this rules file as declaring a non-error rule.
const WARNING_TIER = 'warning';
const DRAFT_TYPE = 'draft';

// A kebab-case token: lowercase alphanumerics in one-or-more hyphen-joined
// segments (e.g. `adr`, `design-adr`, `agents-md`).
const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The spine grammar this consumer refuses to interpret loosely — a structural
// copy of GEN-002's checks (boolean, not reported: GEN-002 raises the errors).
// Kept in lockstep via the shared conformance fixtures.
const BLOCK_KEYS = ['unmatched', 'coverage', 'settings', 'pathRules'];
const FILESET_KEYS = ['include', 'exclude'];
const ENTRY_KEYS = ['include', 'exclude', 'exempt', 'severity', 'rule'];
const VALID_UNMATCHED = ['exempt', 'error'];
const VALID_ENTRY_TIERS = ['error', 'warning'];

// The block's own vocabulary — the payload schema this ADR owns wholesale.
const RULE_KEYS = ['allowedTypes', 'label', 'requireDescription', 'maxLabel', 'maxDescription', 'maxTag'];
const SETTINGS_KEYS = ['draftEscape'];
const VALID_LABELS = ['name', 'title'];

// The built-in default policy, applied when the harness config file — or the
// markdown.frontmatter block in a healthy file — is absent. Expressed in the
// spine shape as a typed constant — deliberately not a JSON file, which cannot
// live under .archgate/adrs/ (GEN-001 adr-governed-files). Every entry is
// root-or-specific (no `**`), closes allowedTypes to one type via its rule
// payload, pins the title label, and runs at the error tier, so installing the
// contract never sweeps node_modules or vendored markdown. Keys are unquoted so
// GEN-001's ruleKeysOf scan reads no phantom rule here.
export const DEFAULT_CONFIG = {
  unmatched: 'exempt',
  pathRules: [
    { include: ['.archgate/adrs/*.md'], rule: { allowedTypes: ['adr'], label: 'title' } },
    { include: ['README.md'], rule: { allowedTypes: ['docs'], label: 'title' } },
    { include: ['AGENTS.md'], rule: { allowedTypes: ['agents-md'], label: 'title' } },
    { include: ['CLAUDE.md'], rule: { allowedTypes: ['claude-md'], label: 'title' } },
  ],
} satisfies Harness.ConfigBlock<Harness.FrontmatterRule, Harness.FrontmatterSettings> as Record<string, unknown>;

type Emit = (detail: { message: string; file?: string }) => void;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPositiveInt(n: unknown): boolean {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

function isGlobArray(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && x.length > 0);
}

function isKebabArray(a: unknown): boolean {
  return Array.isArray(a) && a.every((x) => typeof x === 'string' && KEBAB_RE.test(x));
}

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

async function globAll(ctx: RuleContext, patterns: string[]): Promise<string[]> {
  const out = new Set<string>();
  for (const p of patterns) {
    for (const f of await ctx.glob(p)) out.add(f);
  }
  return [...out];
}

// The FileSet arithmetic (GEN-002 §3): glob(include) − glob(exclude). An
// excluded file is NOT claimed — it falls through to later entries (and
// ultimately to `unmatched`), unlike an exempt entry, which claims and waives.
async function fileSetFiles(ctx: RuleContext, fileSet: Record<string, unknown>): Promise<string[]> {
  const files = await globAll(ctx, Array.isArray(fileSet.include) ? (fileSet.include as string[]) : []);
  if (!Array.isArray(fileSet.exclude) || fileSet.exclude.length === 0) return files;
  const excluded = new Set(await globAll(ctx, fileSet.exclude as string[]));
  return files.filter((f) => !excluded.has(f));
}

// ---- block validation shared by both rules ----

function fileSetOk(fs: unknown): boolean {
  if (!isRecord(fs)) return false;
  if (Object.keys(fs).some((k) => !FILESET_KEYS.includes(k))) return false;
  if (!isGlobArray(fs.include)) return false;
  return fs.exclude === undefined || isGlobArray(fs.exclude);
}

function entrySpineOk(entry: unknown): boolean {
  if (!isRecord(entry)) return false;
  if (Object.keys(entry).some((k) => !ENTRY_KEYS.includes(k))) return false;
  if (!isGlobArray(entry.include)) return false;
  if (entry.exclude !== undefined && !isGlobArray(entry.exclude)) return false;
  if (entry.exempt !== undefined && typeof entry.exempt !== 'boolean') return false;
  if (entry.exempt === true && (entry.rule !== undefined || entry.severity !== undefined)) return false;
  if (entry.severity !== undefined && !VALID_ENTRY_TIERS.includes(entry.severity as string)) return false;
  return entry.rule === undefined || isRecord(entry.rule);
}

// Structural spine walk — pass/fail only. A block GEN-002 would reject must
// never be best-effort-interpreted here (the all-or-nothing contract).
function blockSpineOk(block: Record<string, unknown>): boolean {
  if (Object.keys(block).some((k) => !BLOCK_KEYS.includes(k))) return false;
  if (block.unmatched !== undefined && !VALID_UNMATCHED.includes(block.unmatched as string)) return false;
  if ((block.unmatched === 'error') !== (block.coverage !== undefined)) return false;
  if (block.coverage !== undefined && !fileSetOk(block.coverage)) return false;
  if (block.settings !== undefined && !isRecord(block.settings)) return false;
  return Array.isArray(block.pathRules) && block.pathRules.every(entrySpineOk);
}

function rulePayloadProblems(where: string, rule: Record<string, unknown>): string[] {
  const problems: string[] = [];
  for (const key of Object.keys(rule)) {
    if (!RULE_KEYS.includes(key)) {
      problems.push(
        `'${where}.${key}' is not a frontmatter rule key — rule keys are {allowedTypes, label, requireDescription, maxLabel, maxDescription, maxTag}`,
      );
    }
  }
  if (rule.allowedTypes !== undefined && !isKebabArray(rule.allowedTypes)) {
    problems.push(`'${where}.allowedTypes' must be an array of kebab-case type strings`);
  }
  if (rule.label !== undefined && !VALID_LABELS.includes(rule.label as string)) {
    problems.push(`'${where}.label' must be 'name' or 'title'`);
  }
  if (rule.requireDescription !== undefined && typeof rule.requireDescription !== 'boolean') {
    problems.push(`'${where}.requireDescription' must be a boolean`);
  }
  for (const cap of ['maxLabel', 'maxDescription', 'maxTag']) {
    if (rule[cap] !== undefined && !isPositiveInt(rule[cap])) {
      problems.push(`'${where}.${cap}' must be a positive integer`);
    }
  }
  return problems;
}

// The block's payload vocabulary — everything the spine treats as opaque.
// Single source of truth for both rules: frontmatter-config-valid reports each
// problem; the floor refuses to govern while any exists.
function payloadProblems(block: Record<string, unknown>): string[] {
  const problems: string[] = [];
  if (isRecord(block.settings)) {
    for (const key of Object.keys(block.settings)) {
      if (!SETTINGS_KEYS.includes(key)) {
        problems.push(
          `'markdown.frontmatter.settings.${key}' is not a frontmatter setting — settings are {draftEscape}`,
        );
      }
    }
    if (block.settings.draftEscape !== undefined && typeof block.settings.draftEscape !== 'boolean') {
      problems.push(`'markdown.frontmatter.settings.draftEscape' must be a boolean`);
    }
  }
  const pathRules = Array.isArray(block.pathRules) ? block.pathRules : [];
  pathRules.forEach((entry, index) => {
    if (!isRecord(entry) || !isRecord(entry.rule)) return; // non-object shapes are the spine's findings
    problems.push(...rulePayloadProblems(`markdown.frontmatter.pathRules[${index}].rule`, entry.rule));
  });
  return problems;
}

// The installed harness release the config's top-level `version` must match.
// Null when package.json is unreadable or carries no version string — the
// comparison is then impossible and skipped (never guessed), mirroring
// GEN-002's config-version rule.
async function harnessVersionOf(ctx: RuleContext): Promise<string | null> {
  const pkg = await tryReadJSON(ctx, PACKAGE_JSON);
  return isRecord(pkg) && typeof pkg.version === 'string' ? pkg.version : null;
}

// Locate markdown.frontmatter under the consumer contract. Returns the block
// to govern by, DEFAULT_CONFIG when the file or block is legitimately absent,
// or null when the config is present but broken — in which case the floor
// governs NOTHING and GEN-002 / frontmatter-config-valid carry the loud error.
// The readFile probe distinguishes absent from unparseable, since readJSON
// throws on both.
async function resolveBlock(ctx: RuleContext): Promise<Record<string, unknown> | null> {
  const raw = await tryReadFile(ctx, CONFIG_PATH);
  if (raw === null) return DEFAULT_CONFIG; // no config file — the zero-config default
  const config = await tryReadJSON(ctx, CONFIG_PATH);
  if (!isRecord(config)) return null; // present but unparseable (or a non-object root)
  if (typeof config.version !== 'string' || !SEMVER_RE.test(config.version)) return null; // stamp missing or malformed — present but invalid
  const harnessVersion = await harnessVersionOf(ctx);
  if (harnessVersion !== null && config.version !== harnessVersion) return null; // version skew — never interpret another release's data
  const md = config.markdown;
  if (md === undefined) return DEFAULT_CONFIG; // namespace absent in a healthy envelope — default
  if (!isRecord(md)) return null;
  const block = md.frontmatter;
  if (block === undefined) return DEFAULT_CONFIG; // block absent in a healthy file — default
  if (!isRecord(block) || !blockSpineOk(block) || payloadProblems(block).length > 0) return null;
  return block;
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

// `description` is optional by default; an entry's rule opts into requiring it
// via requireDescription. The cap applies whenever a description is present.
function checkDescription(emit: Emit, file: string, fm: string, rule: Record<string, unknown>): void {
  const desc = getFrontmatterValue(fm, 'description');
  if (!desc) {
    if (rule.requireDescription === true) {
      emit({
        message: `Governed file is missing 'description', which the matched entry requires (GEN-003 [frontmatter-floor]).`,
        file,
      });
    }
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

// `tags`, when present, is a comma-separated list; each tag kebab-case and
// within the entry's cap. Must be a single-line comma-separated string, not a
// YAML list format (block list or inline array). No closed set, no count limit.
function checkTags(emit: Emit, file: string, fm: string, rule: Record<string, unknown>): void {
  const tagsMatch = fm.match(/^tags[ \t]*:(.*)$/m);
  if (!tagsMatch) return;

  const afterKey = tagsMatch[1].trim();

  // Check if tags is formatted as a YAML list/array:
  // 1. Inline array or list item on the same line: tags: [a, b] or tags: - a
  // 2. Block list on subsequent lines: tags:\n  - a
  const index = tagsMatch.index!;
  const restOfFm = fm.slice(index);
  const nextKeyMatch = restOfFm.slice(tagsMatch[0].length).match(/\r?\n[a-zA-Z0-9_-]+[ \t]*:/);
  const tagsSection = nextKeyMatch ? restOfFm.slice(0, tagsMatch[0].length + nextKeyMatch.index!) : restOfFm;

  const isList =
    afterKey.startsWith('[') ||
    afterKey.startsWith('-') ||
    /^\r?\n[ \t]*-[ \t]+/m.test(tagsSection.slice(tagsMatch[0].length));

  if (isList) {
    emit({
      message: `Governed file 'tags' must be a comma-separated string, not a YAML list (GEN-003 [frontmatter-floor]).`,
      file,
    });
    return;
  }

  const raw = getFrontmatterValue(fm, 'tags');
  if (!raw) return;
  const cap = isPositiveInt(rule.maxTag) ? (rule.maxTag as number) : DEFAULT_MAX_TAG;
  for (const tag of raw.split(',').map((t) => t.trim())) {
    if (!KEBAB_RE.test(tag)) {
      emit({
        message: `Governed file tag '${tag}' must be kebab-case — lowercase alphanumerics joined by single hyphens (GEN-003 [frontmatter-floor]).`,
        file,
      });
      continue;
    }
    if (tag.length > cap) {
      emit({
        message: `Governed file tag '${tag}' is ${tag.length} chars, exceeding the matched entry's ${cap}-char cap (GEN-003 [frontmatter-floor]).`,
        file,
      });
    }
  }
}

async function checkFloor(
  ctx: RuleContext,
  file: string,
  entry: Record<string, unknown>,
  draftEscape: boolean,
): Promise<void> {
  // Policy lives in the entry's rule payload; the tier is spine data. An entry
  // without a payload is an open governed entry — the baseline floor applies.
  const rule = isRecord(entry.rule) ? entry.rule : {};
  // Per-entry tier resolved to the matching report channel — one code path, no
  // second rule. A missing tier falls to violation (error).
  const emit: Emit = (detail) =>
    entry.severity === WARNING_TIER ? ctx.report.warning(detail) : ctx.report.violation(detail);
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
      message: `Governed file has no YAML frontmatter block — the floor requires type + ${labelDesc(label)} (GEN-003 [frontmatter-floor]).`,
      file,
    });
    return;
  }
  checkType(emit, file, getFrontmatterValue(fm, 'type'), rule, draftEscape);
  checkLabel(emit, file, fm, label, rule);
  checkDescription(emit, file, fm, rule);
  checkTags(emit, file, fm, rule);
}

export default {
  rules: {
    'frontmatter-config-valid': {
      description:
        "The markdown.frontmatter block's own vocabulary is well-formed — payload only, complementing GEN-002's domain-blind spine: each pathRules entry's `rule` is closed to {allowedTypes (kebab-case strings), label (name|title), requireDescription (boolean), maxLabel/maxDescription/maxTag (positive integers)} with unknown keys rejected (closes the maxDescriptions-typo hole that silently weakened the floor), and `settings` is closed to {draftEscape (boolean)}. No-ops when the config file, its markdown namespace, or the frontmatter block is absent; spine-shape findings stay GEN-002's.",
      severity: 'error',
      async check(ctx) {
        const config = await tryReadJSON(ctx, CONFIG_PATH);
        if (!isRecord(config)) return;
        const md = config.markdown;
        if (!isRecord(md)) return;
        const block = md.frontmatter;
        if (!isRecord(block)) return;
        for (const problem of payloadProblems(block)) {
          ctx.report.violation({
            message: `Harness config ${problem} (GEN-003 [frontmatter-config-valid]).`,
            file: CONFIG_PATH,
          });
        }
      },
    },

    'frontmatter-floor': {
      description:
        "Every governed markdown file, resolved to its pathRules entry by FileSet arithmetic (glob include − exclude) first-match-wins — or to the built-in default when the config file or its markdown.frontmatter block is absent — carries the OKF floor: a kebab-case type (checked against the entry rule's allowedTypes, plus draft when settings.draftEscape is on), exactly the pinned label (name xor title, default cap 64), an optional description (required when the entry's rule sets requireDescription, default cap 1024), and optional comma-separated kebab-case tags (default cap 30 each). An exempt entry claims and waives; an excluded file falls through. Under unmatched: 'error', every in-coverage file no entry claims is a violation. All-or-nothing consumer contract: an unparseable config, a version stamp that is missing or skewed against the installed harness release, or a spine- or payload-invalid block governs NOTHING — GEN-002 and frontmatter-config-valid are the loud gate. Violations emit at the matched entry's tier (default error).",
      severity: 'error',
      async check(ctx) {
        const block = await resolveBlock(ctx);
        if (block === null) return; // broken config — governs nothing, loudly gated elsewhere
        const settings = isRecord(block.settings) ? block.settings : {};
        const draftEscape = settings.draftEscape === true;
        const pathRules = Array.isArray(block.pathRules) ? block.pathRules : [];
        const claimed = new Set<string>();
        for (const entry of pathRules) {
          if (!isRecord(entry)) continue;
          for (const file of await fileSetFiles(ctx, entry)) {
            if (claimed.has(file)) continue; // an earlier entry owns it (first-match-wins)
            claimed.add(file);
            if (entry.exempt === true) continue; // claims and waives — floor off for this entry
            await checkFloor(ctx, file, entry, draftEscape);
          }
        }
        // The strict posture: coverage − claimed = files the config forgot.
        // Always at the error tier — an unclaimed file has no entry to carry one.
        if (block.unmatched === 'error' && isRecord(block.coverage)) {
          for (const file of await fileSetFiles(ctx, block.coverage)) {
            if (claimed.has(file)) continue;
            ctx.report.violation({
              message: `File is inside the frontmatter block's coverage but matched no pathRules entry — add a governing entry, an exempt carve-out, or a coverage exclude (GEN-003 [frontmatter-floor]).`,
              file,
            });
          }
        }
      },
    },
  },
} satisfies RuleSet;
