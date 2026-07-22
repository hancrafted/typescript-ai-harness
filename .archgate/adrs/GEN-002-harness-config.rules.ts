/// <reference path="../rules.d.ts" />

// GEN-002 — Harness Config: guards the shape of the root harness config
// `.typescript-ai-harness.json`. One rule, `frontmatter-config-valid`, validates
// the `adr.frontmatter` block — pathRules array, per-entry match / allowedTypes /
// label / severity / requireDescription / caps, unmatched, draftEscape — so a malformed config
// surfaces as an error rather than silently disabling the floor. The rule
// DECLARES the error tier per GEN-001 §7 and no-ops when the config file or its
// adr.frontmatter block is absent, so the contract is safe to ship pre-seed. The
// floor that consumes this config lives in GEN-003.
const CONFIG_PATH = '.typescript-ai-harness.json';

const VALID_LABELS = ['name', 'title'];
// The tiers a pathRules entry may declare. Written as a bare list — never as a
// `severity:`-prefixed literal — so GEN-001's adr-error-tier scan does not read
// this rules file as declaring a non-error rule.
const VALID_ENTRY_TIERS = ['error', 'warning'];
const VALID_UNMATCHED = ['exempt'];

// A kebab-case token: lowercase alphanumerics in one-or-more hyphen-joined
// segments (e.g. `adr`, `design-adr`, `agents-md`).
const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function tryReadJSON(ctx: RuleContext, path: string): Promise<unknown> {
  try {
    return await ctx.readJSON(path);
  } catch {
    return null;
  }
}

// The `adr.frontmatter` block of the harness config, or null when the config —
// or that block — is absent or the wrong shape. The rule keys its no-op off a
// null here.
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

function isMatch(m: unknown): boolean {
  if (typeof m === 'string') return m.length > 0;
  return Array.isArray(m) && m.length > 0 && m.every((x) => typeof x === 'string' && x.length > 0);
}

function isKebabArray(a: unknown): boolean {
  return Array.isArray(a) && a.every((x) => typeof x === 'string' && KEBAB_RE.test(x));
}

function validatePathRule(ctx: RuleContext, entry: unknown, index: number): void {
  const where = `pathRules[${index}]`;
  if (!entry || typeof entry !== 'object') {
    ctx.report.violation({
      message: `Harness config ${where} must be an object (GEN-002 [frontmatter-config-valid]).`,
      file: CONFIG_PATH,
    });
    return;
  }
  const rule = entry as Record<string, unknown>;
  if (!isMatch(rule.match)) {
    ctx.report.violation({
      message: `Harness config ${where}.match must be a non-empty glob string or array of glob strings (GEN-002 [frontmatter-config-valid]).`,
      file: CONFIG_PATH,
    });
  }
  if (rule.exempt !== undefined && typeof rule.exempt !== 'boolean') {
    ctx.report.violation({
      message: `Harness config ${where}.exempt must be a boolean (GEN-002 [frontmatter-config-valid]).`,
      file: CONFIG_PATH,
    });
  }
  if (rule.allowedTypes !== undefined && !isKebabArray(rule.allowedTypes)) {
    ctx.report.violation({
      message: `Harness config ${where}.allowedTypes must be an array of kebab-case type strings (GEN-002 [frontmatter-config-valid]).`,
      file: CONFIG_PATH,
    });
  }
  if (rule.label !== undefined && !VALID_LABELS.includes(rule.label as string)) {
    ctx.report.violation({
      message: `Harness config ${where}.label must be 'name' or 'title' (GEN-002 [frontmatter-config-valid]).`,
      file: CONFIG_PATH,
    });
  }
  if (rule.severity !== undefined && !VALID_ENTRY_TIERS.includes(rule.severity as string)) {
    ctx.report.violation({
      message: `Harness config ${where}.severity must be 'error' or 'warning' (GEN-002 [frontmatter-config-valid]).`,
      file: CONFIG_PATH,
    });
  }
  if (rule.requireDescription !== undefined && typeof rule.requireDescription !== 'boolean') {
    ctx.report.violation({
      message: `Harness config ${where}.requireDescription must be a boolean (GEN-002 [frontmatter-config-valid]).`,
      file: CONFIG_PATH,
    });
  }
  if (rule.maxTag !== undefined && !isPositiveInt(rule.maxTag)) {
    ctx.report.violation({
      message: `Harness config ${where}.maxTag must be a positive integer (GEN-002 [frontmatter-config-valid]).`,
      file: CONFIG_PATH,
    });
  }
  if (rule.maxLabel !== undefined && !isPositiveInt(rule.maxLabel)) {
    ctx.report.violation({
      message: `Harness config ${where}.maxLabel must be a positive integer (GEN-002 [frontmatter-config-valid]).`,
      file: CONFIG_PATH,
    });
  }
  if (rule.maxDescription !== undefined && !isPositiveInt(rule.maxDescription)) {
    ctx.report.violation({
      message: `Harness config ${where}.maxDescription must be a positive integer (GEN-002 [frontmatter-config-valid]).`,
      file: CONFIG_PATH,
    });
  }
}

export default {
  rules: {
    'frontmatter-config-valid': {
      description:
        "The harness config's adr.frontmatter block is well-formed: pathRules is an array; each entry has a match glob; optional allowedTypes are kebab strings; label is name|title; the entry severity is error|warning; requireDescription is a boolean; maxLabel/maxDescription/maxTag are positive integers; unmatched and draftEscape are valid. Guards enforcement integrity — a malformed config surfaces as an error rather than silently disabling the floor. No-ops when the config file or its adr.frontmatter block is absent.",
      severity: 'error',
      async check(ctx) {
        const fm = frontmatterConfig(await tryReadJSON(ctx, CONFIG_PATH));
        if (fm === null) return; // config or adr.frontmatter absent — nothing to validate
        if (fm.unmatched !== undefined && !VALID_UNMATCHED.includes(fm.unmatched as string)) {
          ctx.report.violation({
            message: `Harness config adr.frontmatter.unmatched must be 'exempt' (GEN-002 [frontmatter-config-valid]).`,
            file: CONFIG_PATH,
          });
        }
        if (fm.draftEscape !== undefined && typeof fm.draftEscape !== 'boolean') {
          ctx.report.violation({
            message: `Harness config adr.frontmatter.draftEscape must be a boolean (GEN-002 [frontmatter-config-valid]).`,
            file: CONFIG_PATH,
          });
        }
        if (!Array.isArray(fm.pathRules)) {
          ctx.report.violation({
            message: `Harness config adr.frontmatter.pathRules must be an array (GEN-002 [frontmatter-config-valid]).`,
            file: CONFIG_PATH,
          });
          return;
        }
        fm.pathRules.forEach((entry, index) => validatePathRule(ctx, entry, index));
      },
    },
  },
} satisfies RuleSet;
