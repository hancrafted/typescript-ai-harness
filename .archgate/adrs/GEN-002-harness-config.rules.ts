/// <reference path="../rules.d.ts" />
/// <reference path="../harness-config.d.ts" />

// GEN-002 — Harness Config: the envelope contract for the root harness config
// `.typescript-ai-harness.json`. Three rules guard the file's integrity without
// ever learning a block's domain vocabulary: `config-json-parses` (a present
// file MUST be parseable JSON — a syntax error is an error, never a silent fall
// back to defaults), `config-namespace-registered` (retired top-level keys are
// tombstoned; `markdown` carries the format version stamp and only registered
// blocks), and `config-spine-valid` (every registered path-scoped block
// satisfies the generic spine — unmatched/coverage/settings/pathRules and the
// FileSet grammar — while `rule` payloads and `settings` contents stay opaque:
// their schemas belong to the block's owning ADR, e.g. GEN-003 for
// `markdown.frontmatter`). All rules DECLARE the error tier per GEN-001 §7 and
// no-op when the config file is absent, so the contract ships pre-seed.
const CONFIG_PATH = '.typescript-ai-harness.json';
const CURRENT_FORMAT_VERSION = 1;

// The closed block registry: every key under `markdown` except the reserved
// format metadata must be one of these. Adding a block = one line here plus an
// owning ADR; the owner defines the block's payload schema, interpretation and
// built-in default. `path-scoped` blocks satisfy the full spine; `freeform`
// blocks (future) are only required to be JSON objects.
const REGISTERED_BLOCKS: Record<string, { owner: string; shape: 'path-scoped' | 'freeform' }> = {
  frontmatter: { owner: 'GEN-003', shape: 'path-scoped' },
};

// Keys under `markdown` that are format metadata, never blocks.
const RESERVED_KEYS = ['version'];

// Tombstones for retired keys: a config still using one gets the rename named
// in the violation instead of a silent fall-back to built-in defaults.
const RETIRED_TOP_KEYS: Record<string, string> = {
  adr: "renamed to 'markdown' in config format v1 — move its blocks under 'markdown' and stamp version: 1",
};
const RETIRED_ENTRY_KEYS: Record<string, string> = {
  match: "renamed to 'include' (always an array of globs) in config format v1",
};

const VALID_UNMATCHED = ['exempt', 'error'];
// The tiers a pathRules entry may declare. A bare list — never a
// `severity:`-prefixed literal — so GEN-001's adr-error-tier scan does not read
// this rules file as declaring a non-error rule.
const VALID_ENTRY_TIERS = ['error', 'warning'];

// The generic spine: closed key sets at block, FileSet and entry level.
const BLOCK_KEYS = ['unmatched', 'coverage', 'settings', 'pathRules'];
const FILESET_KEYS = ['include', 'exclude'];
const ENTRY_KEYS = ['include', 'exclude', 'exempt', 'severity', 'rule'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPositiveInt(n: unknown): boolean {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

// A FileSet list: non-empty array of non-empty glob strings.
function isGlobArray(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && x.length > 0);
}

// The parsed config, or null when the file is absent or unparseable — the
// namespace and spine rules no-op on null (`config-json-parses` owns a present
// file that fails to parse).
async function tryReadJSON(ctx: RuleContext, path: string): Promise<unknown> {
  try {
    return await ctx.readJSON(path);
  } catch {
    return null;
  }
}

// Emits one violation; the caller's emit closes over the rule's provenance tag.
type Emit = (message: string) => void;

// FileSet fields shared by coverage and pathRules entries: include required,
// exclude optional, both non-empty arrays of non-empty globs.
function checkFileSetFields(emit: Emit, where: string, obj: Record<string, unknown>): void {
  if (!isGlobArray(obj.include)) {
    emit(`'${where}.include' must be a non-empty array of non-empty glob strings`);
  }
  if (obj.exclude !== undefined && !isGlobArray(obj.exclude)) {
    emit(`'${where}.exclude' must be a non-empty array of non-empty glob strings — omit it or list at least one glob`);
  }
}

function checkCoverage(emit: Emit, where: string, block: Record<string, unknown>): void {
  if (block.unmatched === 'error' && block.coverage === undefined) {
    emit(`'${where}' declares unmatched: 'error', which requires a coverage FileSet naming the governed universe`);
  }
  if (block.coverage !== undefined && block.unmatched !== 'error') {
    emit(`'${where}.coverage' is only meaningful with unmatched: 'error' — remove it or declare that posture`);
  }
  if (block.coverage === undefined) return;
  if (!isRecord(block.coverage)) {
    emit(`'${where}.coverage' must be a FileSet object`);
    return;
  }
  for (const key of Object.keys(block.coverage)) {
    if (!FILESET_KEYS.includes(key)) {
      emit(`'${where}.coverage.${key}' is not a FileSet key — a FileSet is {include, exclude}`);
    }
  }
  checkFileSetFields(emit, `${where}.coverage`, block.coverage);
}

function checkEntrySpine(emit: Emit, where: string, entry: unknown): void {
  if (!isRecord(entry)) {
    emit(`'${where}' must be an object`);
    return;
  }
  for (const key of Object.keys(entry)) {
    if (ENTRY_KEYS.includes(key)) continue;
    const tombstone = RETIRED_ENTRY_KEYS[key];
    emit(
      tombstone
        ? `'${where}.${key}' is retired: ${tombstone}`
        : `'${where}.${key}' is not a spine entry key — entries are {include, exclude, exempt, severity, rule}; block-owned policy goes under 'rule'`,
    );
  }
  checkFileSetFields(emit, where, entry);
  if (entry.exempt !== undefined && typeof entry.exempt !== 'boolean') {
    emit(`'${where}.exempt' must be a boolean`);
  }
  if (entry.exempt === true && entry.rule !== undefined) {
    emit(`'${where}' is exempt — an exempt entry claims and waives, it must not carry 'rule'`);
  }
  if (entry.exempt === true && entry.severity !== undefined) {
    emit(`'${where}' is exempt — an exempt entry claims and waives, it must not carry 'severity'`);
  }
  if (entry.severity !== undefined && !VALID_ENTRY_TIERS.includes(entry.severity as string)) {
    emit(`'${where}.severity' must be 'error' or 'warning'`);
  }
  if (entry.rule !== undefined && !isRecord(entry.rule)) {
    emit(`'${where}.rule' must be a JSON object (its schema belongs to the block's owning ADR)`);
  }
}

// The generic, domain-blind spine of one path-scoped block. Never inspects
// inside `rule` or `settings` — those belong to the block's owner.
function checkBlockSpine(emit: Emit, where: string, block: Record<string, unknown>): void {
  for (const key of Object.keys(block)) {
    if (!BLOCK_KEYS.includes(key)) {
      emit(
        `'${where}.${key}' is not a spine key — a block is {unmatched, coverage, settings, pathRules}; block-owned knobs go under 'settings'`,
      );
    }
  }
  if (block.unmatched !== undefined && !VALID_UNMATCHED.includes(block.unmatched as string)) {
    emit(`'${where}.unmatched' must be 'exempt' or 'error'`);
  }
  checkCoverage(emit, where, block);
  if (block.settings !== undefined && !isRecord(block.settings)) {
    emit(`'${where}.settings' must be a JSON object (its keys belong to the block's owning ADR)`);
  }
  if (!Array.isArray(block.pathRules)) {
    emit(`'${where}.pathRules' must be an array`);
    return;
  }
  block.pathRules.forEach((entry, index) => checkEntrySpine(emit, `${where}.pathRules[${index}]`, entry));
}

export default {
  rules: {
    'config-json-parses': {
      description:
        'A present harness config .typescript-ai-harness.json MUST be parseable JSON. Closes the silent-degradation hole where a syntax error made every consumer fall back to its built-in default with zero errors — a broken config must fail loudly, not govern silently. No-ops when the file is absent (pre-seed).',
      severity: 'error',
      async check(ctx) {
        try {
          await ctx.readFile(CONFIG_PATH);
        } catch {
          return; // absent — nothing to parse, the contract ships pre-seed
        }
        try {
          await ctx.readJSON(CONFIG_PATH);
        } catch {
          ctx.report.violation({
            message: `Harness config exists but is not parseable JSON — fix the syntax error; until it parses, no block governs anything (GEN-002 [config-json-parses]).`,
            file: CONFIG_PATH,
          });
        }
      },
    },

    'config-namespace-registered': {
      description:
        "The config's namespaces are registered: retired top-level keys (adr) error with their rename tombstone; when `markdown` exists it MUST carry `version` (a positive integer equal to the current format version — a mismatch names the migrate step) and every other key under it MUST be a registered block. Closes the block-name-typo hole where `frontmater` silently fell back to the built-in default. Other top-level keys stay free — the consumer-extension surface. No-ops when the config is absent or unparseable.",
      severity: 'error',
      async check(ctx) {
        const emit: Emit = (message) =>
          ctx.report.violation({ message: `${message} (GEN-002 [config-namespace-registered]).`, file: CONFIG_PATH });
        const config = await tryReadJSON(ctx, CONFIG_PATH);
        if (config === null) return; // absent or unparseable — config-json-parses owns the latter
        if (!isRecord(config)) {
          emit('Harness config root must be a JSON object');
          return;
        }
        for (const [key, tombstone] of Object.entries(RETIRED_TOP_KEYS)) {
          if (key in config) emit(`Harness config top-level key '${key}' is retired: ${tombstone}`);
        }
        const md = config.markdown;
        if (md === undefined) return;
        if (!isRecord(md)) {
          emit(`Harness config 'markdown' must be a JSON object`);
          return;
        }
        if (md.version === undefined) {
          emit(
            `Harness config 'markdown.version' is required — stamp the config format version (currently ${CURRENT_FORMAT_VERSION})`,
          );
        } else if (!isPositiveInt(md.version)) {
          emit(`Harness config 'markdown.version' must be a positive integer`);
        } else if (md.version !== CURRENT_FORMAT_VERSION) {
          emit(
            `Harness config 'markdown.version' is ${md.version} but this contract reads format ${CURRENT_FORMAT_VERSION} — run the interactive migrate step to upgrade the config`,
          );
        }
        for (const key of Object.keys(md)) {
          if (RESERVED_KEYS.includes(key) || key in REGISTERED_BLOCKS) continue;
          emit(
            `Harness config 'markdown.${key}' is not a registered block — registered blocks: ${Object.keys(REGISTERED_BLOCKS).join(', ')}. A typo here would otherwise silently fall back to the block's built-in default`,
          );
        }
      },
    },

    'config-spine-valid': {
      description:
        "Every registered path-scoped block under `markdown` satisfies the generic spine, domain-blind: closed block keys {unmatched, coverage, settings, pathRules}; unmatched is 'exempt' or 'error'; a coverage FileSet is present iff unmatched is 'error'; FileSets are {include, exclude} with include a non-empty array of non-empty globs; entries are closed to {include, exclude, exempt, severity, rule}; an exempt entry carries neither rule nor severity; the entry tier is 'error' or 'warning'. The `rule` payload and `settings` contents stay opaque — their schemas belong to the block's owning ADR (frontmatter: GEN-003). No-ops when the config is absent or unparseable.",
      severity: 'error',
      async check(ctx) {
        const emit: Emit = (message) =>
          ctx.report.violation({
            message: `Harness config ${message} (GEN-002 [config-spine-valid]).`,
            file: CONFIG_PATH,
          });
        const config = await tryReadJSON(ctx, CONFIG_PATH);
        if (config === null || !isRecord(config)) return; // json-parses / namespace rule own these
        const md = config.markdown;
        if (!isRecord(md)) return;
        for (const [name, spec] of Object.entries(REGISTERED_BLOCKS)) {
          const where = `markdown.${name}`;
          const block = md[name];
          if (block === undefined) continue;
          if (!isRecord(block)) {
            emit(`'${where}' must be a JSON object`);
            continue;
          }
          if (spec.shape === 'path-scoped') checkBlockSpine(emit, where, block);
        }
      },
    },
  },
} satisfies RuleSet;
