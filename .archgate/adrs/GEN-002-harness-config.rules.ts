/// <reference path="../rules.d.ts" />
/// <reference path="../harness-config-core.d.ts" />

// GEN-002 — Harness Config: the envelope contract for the root harness config
// `.typescript-ai-harness.json`. Four rules guard the file's integrity while
// staying fully domain-blind — this file hardcodes NO namespace and NO block
// name; the legal keys come from the block owners' own fences:
//   - `config-json-parses`: a present file MUST be parseable JSON — a syntax
//     error is an error, never a silent fall-back to defaults.
//   - `config-extension-fenced`: the config extension
//     `.archgate/harness-config-extension.d.ts` follows the fence grammar —
//     balanced `<ADR-ID>-START`/`-END` markers, each START declaring one
//     well-formed, unique `namespace.block` path. The union of declared paths
//     is the config's closed set of legal keys (the registry lives in the
//     extension file the block owners edit, never here).
//   - `config-version`: the top-level `version` is a required, semver-shaped
//     string; it is equality-checked against `package.json` `.version` only
//     where that project IS the harness (dogfooding), the sole place the two
//     name the same release. A foreign target carries the stamp for the migrate
//     engine (#68) but is never equality-checked here.
//   - `config-shape-valid`: the config is `{version, [namespace]: {[block]:
//     ConfigBlock}}` — every present `namespace.block` key matches a declared
//     fence path, sits exactly two key levels deep, and satisfies the generic
//     spine; `rule` payloads and `settings` contents stay opaque (their
//     schemas belong to the block's owning ADR).
// All rules DECLARE the error tier per GEN-001 §7 and no-op when the config
// file is absent, so the contract ships pre-seed.
const CONFIG_PATH = '.typescript-ai-harness.json';
const PACKAGE_JSON = 'package.json';
const EXTENSION_DTS = '.archgate/harness-config-extension.d.ts';

// The harness's own package name. The exact-match envelope is only meaningful
// where `package.json` names the harness itself — there the stamp and the
// package version are the same release. In any other project `package.json` is
// the target app's, not the harness's, and the harness is unresolvable under
// ephemeral `npx`, so equality is skipped until the migrate engine (#68).
const HARNESS_PACKAGE_NAME = '@hancrafted/typescript-ai-harness';

// The envelope's single reserved top-level key; every other top-level key is a
// namespace holding blocks.
const VERSION_KEY = 'version';

// The practical core of the semver grammar — enough to keep the stamp's shape
// honest even when package.json yields nothing to compare against.
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

// The fence grammar of the config extension. A marker line is
// `// <ADR-ID>-START: <namespace.block>` or `// <ADR-ID>-END`; the loose
// marker scan catches malformed variants so they error instead of being
// silently ignored, and the path grammar is two camelCase identifiers joined
// by a dot. Read by regex, never by parsing TypeScript.
const FENCE_MARKER_RE = /^[ \t]*\/\/[ \t]*([A-Z][A-Z0-9]*-\d+)-(START|END)(.*)$/;
const FENCE_PATH_RE = /^:[ \t]*([a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*)[ \t]*$/;

const VALID_UNMATCHED = ['exempt', 'error'];
// The tiers a pathRules entry may declare. A bare list — never a
// `severity:`-prefixed literal — so GEN-001's adr-error-tier scan does not read
// this rules file as declaring a non-error rule.
const VALID_ENTRY_TIERS = ['error', 'warning'];

// The generic spine: closed key sets at block, FileSet and entry level.
const BLOCK_KEYS = ['unmatched', 'coverage', 'settings', 'pathRules'];
const FILESET_KEYS = ['include', 'excludeFiles'];
const ENTRY_KEYS = ['include', 'excludeFiles', 'exempt', 'severity', 'rule'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// A FileSet list: non-empty array of non-empty glob strings.
function isGlobArray(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && x.length > 0);
}

// A glob carries a wildcard when it holds a magic char (*, ?, [, {). include
// may carry them; excludeFiles must not (it lists literal file paths) and is
// only meaningful when include carries a wildcard — a wildcard-free include
// names one file, so carving from it is contradictory (checkFileSetFields).
const GLOB_MAGIC_RE = /[*?[{]/;
function hasWildcard(patterns: string[]): boolean {
  return patterns.some((p) => GLOB_MAGIC_RE.test(p));
}

// An excludeFiles list: non-empty array of non-empty LITERAL file paths — each
// a string carrying no glob magic char. Wildcards are rejected here (the field
// lists files, never a pattern), unlike include which is a glob array.
function isLiteralFileArray(v: unknown): boolean {
  return (
    Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && x.length > 0 && !GLOB_MAGIC_RE.test(x))
  );
}

async function tryReadFile(ctx: RuleContext, path: string): Promise<string | null> {
  try {
    return await ctx.readFile(path);
  } catch {
    return null;
  }
}

// The parsed config, or null when the file is absent or unparseable — the
// version and shape rules no-op on null (`config-json-parses` owns a present
// file that fails to parse).
async function tryReadJSON(ctx: RuleContext, path: string): Promise<unknown> {
  try {
    return await ctx.readJSON(path);
  } catch {
    return null;
  }
}

// The installed harness release — the version the config must match — but ONLY
// when the project under check is the harness itself (its package.json names the
// harness). Null otherwise: a foreign target (package.json names the target app,
// not the harness), an unreadable package.json, or one carrying no version. On
// null the equality check is skipped (never guessed), while presence and shape
// of the config's own stamp stay enforced. Gating on identity, not on reading
// package.json at all, is what stops the foreign-target false mismatch.
async function harnessSelfVersion(ctx: RuleContext): Promise<string | null> {
  const pkg = await tryReadJSON(ctx, PACKAGE_JSON);
  if (!isRecord(pkg) || pkg.name !== HARNESS_PACKAGE_NAME) return null;
  return typeof pkg.version === 'string' ? pkg.version : null;
}

// Emits one violation; the caller's emit closes over the rule's provenance tag.
type Emit = (message: string) => void;

// One fence of the config extension: the owning ADR id and its declared
// `namespace.block` path.
interface Fence {
  id: string;
  path: string;
}

// Walk the extension source line by line, reporting every grammar problem via
// emit and returning the well-formed fences. `config-shape-valid` re-parses
// without an emit — malformed fences contribute no declared path there; the
// fence rule carries the loud errors.
function parseFences(source: string, emit?: Emit): Fence[] {
  const fences: Fence[] = [];
  let open: { id: string; line: number } | null = null;
  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const marker = lines[index].match(FENCE_MARKER_RE);
    if (!marker) continue;
    const [, id, kind, rest] = marker;
    const at = `line ${index + 1}`;
    if (kind === 'START') {
      if (open !== null) {
        emit?.(
          `fence '${id}' at ${at} opens inside the unclosed '${open.id}' fence from line ${open.line} — fences never nest or overlap`,
        );
      }
      open = { id, line: index + 1 };
      const path = rest.match(FENCE_PATH_RE);
      if (path === null) {
        emit?.(
          `fence '${id}' at ${at} must declare its block path — '// ${id}-START: <namespace.block>' with exactly one dot`,
        );
        continue;
      }
      const taken = fences.find((f) => f.path === path[1]);
      if (taken !== undefined) {
        emit?.(
          `fence '${id}' at ${at} re-declares '${path[1]}', already owned by '${taken.id}' — one owning fence per block`,
        );
        continue;
      }
      fences.push({ id, path: path[1] });
      continue;
    }
    if (rest.trim() !== '') {
      emit?.(`fence '${id}' at ${at} has trailing content after the END marker — '// ${id}-END' closes bare`);
    }
    if (open === null) {
      emit?.(`fence '${id}' at ${at} closes without a matching '${id}-START'`);
      continue;
    }
    if (open.id !== id) {
      emit?.(
        `fence '${id}' at ${at} closes the open '${open.id}' fence from line ${open.line} — START and END must carry the same ADR id`,
      );
    }
    open = null;
  }
  if (open !== null) {
    emit?.(`fence '${open.id}' from line ${open.line} is never closed — add '// ${open.id}-END'`);
  }
  return fences;
}

// The closed set of legal `namespace.block` config keys, derived from the
// extension file's well-formed fences. Empty when the file is absent — a
// config key can then match nothing, which is exactly right: no fence, no
// block.
async function declaredPathsOf(ctx: RuleContext): Promise<Set<string>> {
  const source = await tryReadFile(ctx, EXTENSION_DTS);
  return new Set(source === null ? [] : parseFences(source).map((f) => f.path));
}

// FileSet fields shared by coverage and pathRules entries: include required (a
// non-empty array of non-empty globs); excludeFiles optional and, when present,
// a non-empty array of non-empty LITERAL file paths (no wildcards) that is only
// meaningful when include carries a wildcard — a literal-path include names one
// file, so carving from it is contradictory (GEN-002 §3.1.4).
function checkFileSetFields(emit: Emit, where: string, obj: Record<string, unknown>): void {
  if (!isGlobArray(obj.include)) {
    emit(`'${where}.include' must be a non-empty array of non-empty glob strings`);
  }
  if (obj.excludeFiles !== undefined && !isLiteralFileArray(obj.excludeFiles)) {
    emit(
      `'${where}.excludeFiles' must be a non-empty array of non-empty literal file paths — no wildcards (*, ?, [, {); omit it or list at least one file`,
    );
  }
  if (
    obj.excludeFiles !== undefined &&
    isLiteralFileArray(obj.excludeFiles) &&
    isGlobArray(obj.include) &&
    !hasWildcard(obj.include as string[])
  ) {
    emit(
      `'${where}.excludeFiles' is only meaningful when '${where}.include' has a wildcard (*, ?, [, {) — a literal-path include matches one file, so drop excludeFiles or widen the include`,
    );
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
      emit(`'${where}.coverage.${key}' is not a FileSet key — a FileSet is {include, excludeFiles}`);
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
    if (!ENTRY_KEYS.includes(key)) {
      emit(
        `'${where}.${key}' is not a spine entry key — entries are {include, excludeFiles, exempt, severity, rule}; block-owned policy goes under 'rule'`,
      );
    }
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

// The generic, domain-blind spine of one config block. Doubles as the depth
// guard: a block is a ConfigBlock exactly two key levels deep, so a third
// nesting level fails the closed key set. Never inspects inside `rule` or
// `settings` — those belong to the block's owner.
function checkBlockSpine(emit: Emit, where: string, block: Record<string, unknown>): void {
  for (const key of Object.keys(block)) {
    if (!BLOCK_KEYS.includes(key)) {
      emit(
        `'${where}.${key}' is not a spine key — a block is {unmatched, coverage, settings, pathRules}, exactly two key levels deep (namespace.block); block-owned knobs go under 'settings', never a deeper nesting level`,
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

    'config-extension-fenced': {
      description:
        "The config extension .archgate/harness-config-extension.d.ts follows the fence grammar: each block ADR's region is delimited by '// <ADR-ID>-START: <namespace.block>' and '// <ADR-ID>-END' markers — balanced, never nested or overlapping, END matching the open START's ADR id, closing bare — and every START declares a well-formed namespace.block path, unique across fences. The union of declared paths is the config's closed set of legal keys (consumed by config-shape-valid): the block registry lives in the extension file the block owners edit, so this contract is never amended to register a block. No-ops when the extension file is absent (no fences, no registry).",
      severity: 'error',
      async check(ctx) {
        const emit: Emit = (message) =>
          ctx.report.violation({
            message: `Config extension ${message} (GEN-002 [config-extension-fenced]).`,
            file: EXTENSION_DTS,
          });
        const source = await tryReadFile(ctx, EXTENSION_DTS);
        if (source === null) return; // absent — a repo with no registered blocks
        parseFences(source, emit);
      },
    },

    'config-version': {
      description:
        "The config's top-level `version` is the compatibility envelope: required and semver-shaped everywhere. Equality against the installed harness release is enforced only where the project under check IS the harness (its package.json names the harness) — the honest pre-1.0 semantics where every release may break the format, and the sole place the stamp and package.json name the same release; a mismatch there errors naming the migrate step (loosening to semver-range compatibility arrives with it, #68). A foreign target carries the stamp for the migrate engine but is never equality-checked (its package.json is the target app's version, and the harness is unresolvable under ephemeral npx). A config authored for another release is never reinterpreted under this one's semantics. No-ops when the config is absent, unparseable, or has a non-object root (config-shape-valid owns that finding), and skips the equality check — but never the shape check — when package.json does not name the harness or yields no version to compare against.",
      severity: 'error',
      async check(ctx) {
        const emit: Emit = (message) =>
          ctx.report.violation({ message: `Harness config ${message} (GEN-002 [config-version]).`, file: CONFIG_PATH });
        const config = await tryReadJSON(ctx, CONFIG_PATH);
        if (config === null || !isRecord(config)) return;
        const harnessVersion = await harnessSelfVersion(ctx);
        const stamp = config[VERSION_KEY];
        if (stamp === undefined) {
          emit(
            `top-level 'version' is required — stamp the installed harness release${harnessVersion === null ? '' : ` ('${harnessVersion}')`}`,
          );
          return;
        }
        if (typeof stamp !== 'string' || !SEMVER_RE.test(stamp)) {
          emit(
            `top-level 'version' must be a semver string matching the installed harness release${harnessVersion === null ? '' : ` ('${harnessVersion}')`}`,
          );
          return;
        }
        if (harnessVersion !== null && stamp !== harnessVersion) {
          emit(
            `'version' is '${stamp}' but the installed harness is '${harnessVersion}' — run the migrate step to upgrade the config and restamp it`,
          );
        }
      },
    },

    'config-shape-valid': {
      description:
        "The config is `{version, [namespace]: {[block]: ConfigBlock}}`, validated domain-blind: every top-level key beside `version` is a namespace object holding blocks; every present `namespace.block` key matches a path some extension fence declares (the typo guard — a misspelled block name errors instead of silently falling back to the block's default, yet no concrete name is hardcoded here); a declared path absent from the config is fine (the owner's built-in default). Each block is a ConfigBlock exactly two key levels deep (the depth guard) satisfying the generic spine: closed block keys {unmatched, coverage, settings, pathRules}; unmatched is 'exempt' or 'error'; a coverage FileSet is present iff unmatched is 'error'; FileSets are {include, excludeFiles} with include a non-empty array of non-empty globs, and excludeFiles a non-empty array of literal file paths (no wildcards) present only when include carries a wildcard; entries are closed to {include, excludeFiles, exempt, severity, rule}; an exempt entry carries neither rule nor severity; the entry tier is 'error' or 'warning'. The `rule` payload and `settings` contents stay opaque — their schemas belong to the block's owning ADR. No-ops when the config is absent or unparseable.",
      severity: 'error',
      async check(ctx) {
        const emit: Emit = (message) =>
          ctx.report.violation({
            message: `Harness config ${message} (GEN-002 [config-shape-valid]).`,
            file: CONFIG_PATH,
          });
        const config = await tryReadJSON(ctx, CONFIG_PATH);
        if (config === null) return; // absent or unparseable — config-json-parses owns the latter
        if (!isRecord(config)) {
          emit('root must be a JSON object');
          return;
        }
        const declared = await declaredPathsOf(ctx);
        for (const [namespace, blocks] of Object.entries(config)) {
          if (namespace === VERSION_KEY) continue;
          if (!isRecord(blocks)) {
            emit(
              `'${namespace}' must be a namespace object holding config blocks — the config shape is {version, [namespace]: {[block]: …}}`,
            );
            continue;
          }
          for (const [name, block] of Object.entries(blocks)) {
            const where = `${namespace}.${name}`;
            if (!declared.has(where)) {
              const known = [...declared].sort().join(', ');
              emit(
                `'${where}' matches no block a fence in ${EXTENSION_DTS} declares${known === '' ? '' : ` (declared blocks: ${known})`} — a typo here would otherwise silently fall back to the block's built-in default`,
              );
              continue; // a key that names no block has no spine to check
            }
            if (!isRecord(block)) {
              emit(`'${where}' must be a JSON object satisfying the config block spine`);
              continue;
            }
            checkBlockSpine(emit, where, block);
          }
        }
      },
    },
  },
} satisfies RuleSet;
