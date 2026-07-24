/// <reference path="../rules.d.ts" />

// Sibling test for GEN-003-frontmatter.rules.ts — pass and fail path for the
// two rules `frontmatter-config-valid` (the block's payload vocabulary) and
// `frontmatter-floor` (the consumer), exercised through check(ctx) against an
// in-memory RuleContext. readFile/readJSON serve the root harness config
// .typescript-ai-harness.json: omit `config` to model an absent one
// (both throw ENOENT → the built-in DEFAULT applies); pass `brokenJson` for a
// present-but-unparseable one (readFile succeeds, readJSON throws → the floor
// governs NOTHING). readJSON also serves package.json at the fixtures'
// MOCK_HARNESS_VERSION — the installed harness release the config's top-level
// `version` must match. Canonical pass/fail configs come from the shared
// conformance fixtures, which GEN-002-harness-config.rules.test.ts consumes
// too — the drift tripwire between the envelope validator and this consumer.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FRONTMATTER,
  DEPTH_VIOLATION_CONFIG,
  MOCK_HARNESS_VERSION,
  PAYLOAD_TYPO_CONFIG,
  RETIRED_KEY_CONFIG,
  SPINE_INVALID_CONFIG,
  STRICT_CONFIG,
  UNDECLARED_BLOCK_CONFIG,
  VALID_CONFIG,
  VERSION_MALFORMED_CONFIG,
  VERSION_MISMATCH_CONFIG,
  VERSION_MISSING_CONFIG,
} from '../harness-config-fixtures';
import ruleSet, { DEFAULT_CONFIG } from './GEN-003-frontmatter.rules';

interface Reported {
  message: string;
  file?: string;
}

const CONFIG_PATH = '.typescript-ai-harness.json';

// Minimal glob → RegExp for the mock ctx: `**/` spans zero or more whole
// segments (so docs/**/*.md matches docs/guide.md too), `**` spans anything,
// `*` stays within one segment.
function globToRegExp(pattern: string): RegExp {
  const GLOBSTAR_SLASH = '\u0000';
  const GLOBSTAR = '\u0001';
  const p = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, GLOBSTAR_SLASH)
    .replace(/\*\*/g, GLOBSTAR)
    .replace(/\*/g, '[^/]*')
    .split(GLOBSTAR_SLASH)
    .join('(?:.*/)?')
    .split(GLOBSTAR)
    .join('.*');
  return new RegExp(`^${p}$`);
}

// `symlinks` model archgate's non-following file reader: ctx.glob lists them but
// ctx.readFile throws. `config` is served by readJSON at the config path (and
// its JSON text by readFile — the floor's absent-vs-broken probe); omit it
// entirely to model an absent config. `brokenJson` models a present config that
// fails to parse: readFile succeeds, readJSON throws. `packageVersion`
// overrides the harness release the mock package.json serves (`null` models an
// unreadable one).
function makeCtx(
  files: Record<string, string>,
  opts?: { config?: unknown; symlinks?: string[]; brokenJson?: boolean; packageVersion?: string | null },
) {
  const violations: Reported[] = [];
  const warnings: Reported[] = [];
  const packageVersion = opts?.packageVersion === undefined ? MOCK_HARNESS_VERSION : opts.packageVersion;
  const symlinks = opts?.symlinks ?? [];
  const present = opts !== undefined && ('config' in opts || opts.brokenJson === true);
  const allPaths = [...Object.keys(files), ...symlinks];
  const ctx = {
    projectRoot: '/repo',
    scopedFiles: allPaths,
    changedFiles: [],
    async glob(pattern: string) {
      const re = globToRegExp(pattern);
      return allPaths.filter((f) => re.test(f));
    },
    async readFile(path: string) {
      if (path === CONFIG_PATH && present) {
        return opts?.brokenJson ? '{ "markdown": ' : JSON.stringify(opts?.config);
      }
      if (path in files) return files[path];
      if (symlinks.includes(path)) throw new Error(`ELOOP: not followed: ${path}`);
      throw new Error(`ENOENT: ${path}`);
    },
    async readJSON(path: string) {
      if (path === CONFIG_PATH && present) {
        if (opts?.brokenJson) throw new SyntaxError('Unexpected end of JSON input');
        return opts?.config;
      }
      if (path === 'package.json' && packageVersion !== null) return { version: packageVersion };
      throw new Error(`ENOENT: ${path}`);
    },
    report: {
      violation: (d: Reported) => violations.push(d),
      warning: (d: Reported) => warnings.push(d),
      info: () => {},
    },
  } as unknown as RuleContext;
  return { ctx, violations, warnings };
}

// Build a harness config at the mock harness release whose markdown.frontmatter
// block carries the given pathRules plus any block-level extras (unmatched,
// coverage, settings).
function harnessConfig(pathRules: unknown[], extra: Record<string, unknown> = {}): unknown {
  return { version: MOCK_HARNESS_VERSION, markdown: { frontmatter: { pathRules, ...extra } } };
}

// Build a governed markdown file from frontmatter lines.
function md(frontmatterLines: string): string {
  return `---\n${frontmatterLines}\n---\n\n# Heading\n\nBody text.\n`;
}

const configValid = ruleSet.rules['frontmatter-config-valid'];
const floor = ruleSet.rules['frontmatter-floor'];

describe('frontmatter-config-valid', () => {
  it('passes the canonical valid configs', async () => {
    for (const m of [VALID_CONFIG, STRICT_CONFIG]) {
      const { ctx, violations } = makeCtx({}, { config: m });
      await configValid.check(ctx);
      expect(violations).toEqual([]);
    }
  });

  it('no-ops when the config file, namespace, or block is absent', async () => {
    for (const opts of [
      undefined,
      { config: { version: MOCK_HARNESS_VERSION, markdown: {} } },
      { config: RETIRED_KEY_CONFIG },
    ]) {
      const { ctx, violations } = makeCtx({}, opts);
      await configValid.check(ctx);
      expect(violations).toEqual([]);
    }
  });

  it('stays silent on a spine-invalid block — the spine is GEN-002 findings', async () => {
    const { ctx, violations } = makeCtx({}, { config: SPINE_INVALID_CONFIG });
    await configValid.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails an unknown rule payload key (the maxDescriptions typo hole)', async () => {
    const { ctx, violations } = makeCtx({}, { config: PAYLOAD_TYPO_CONFIG });
    await configValid.check(ctx);
    expect(violations.some((v) => /maxDescriptions' is not a frontmatter rule key/.test(v.message))).toBe(true);
  });

  it('fails non-kebab allowedTypes', async () => {
    const m = harnessConfig([{ include: ['x.md'], rule: { allowedTypes: ['Design ADR'] } }]);
    const { ctx, violations } = makeCtx({}, { config: m });
    await configValid.check(ctx);
    expect(violations.some((v) => /allowedTypes' must be an array of kebab-case type strings/.test(v.message))).toBe(
      true,
    );
  });

  it('fails an invalid label pin', async () => {
    const m = harnessConfig([{ include: ['x.md'], rule: { label: 'heading' } }]);
    const { ctx, violations } = makeCtx({}, { config: m });
    await configValid.check(ctx);
    expect(violations.some((v) => /label' must be 'name' or 'title'/.test(v.message))).toBe(true);
  });

  it('fails a non-boolean requireDescription', async () => {
    const m = harnessConfig([{ include: ['x.md'], rule: { requireDescription: 'yes' } }]);
    const { ctx, violations } = makeCtx({}, { config: m });
    await configValid.check(ctx);
    expect(violations.some((v) => /requireDescription' must be a boolean/.test(v.message))).toBe(true);
  });

  it('fails non-positive-integer caps', async () => {
    for (const rule of [{ maxLabel: 12.5 }, { maxDescription: -3 }, { maxTag: 0 }]) {
      const { ctx, violations } = makeCtx({}, { config: harnessConfig([{ include: ['x.md'], rule }]) });
      await configValid.check(ctx);
      expect(violations.some((v) => /must be a positive integer/.test(v.message))).toBe(true);
    }
  });

  it('fails an unknown settings key', async () => {
    const m = harnessConfig([{ include: ['x.md'] }], { settings: { draftEscap: true } });
    const { ctx, violations } = makeCtx({}, { config: m });
    await configValid.check(ctx);
    expect(violations.some((v) => /draftEscap' is not a frontmatter setting/.test(v.message))).toBe(true);
  });

  it('fails a non-boolean draftEscape', async () => {
    const m = harnessConfig([{ include: ['x.md'] }], { settings: { draftEscape: 'yes' } });
    const { ctx, violations } = makeCtx({}, { config: m });
    await configValid.check(ctx);
    expect(violations.some((v) => /draftEscape' must be a boolean/.test(v.message))).toBe(true);
  });
});

describe('frontmatter-floor', () => {
  const adrRules = harnessConfig([
    { include: ['docs/adr/*.md'], rule: { allowedTypes: ['design-adr'], label: 'title' } },
  ]);

  it('passes a conformant governed file', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A decision"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails a governed file with no frontmatter block', async () => {
    const files = { 'docs/adr/a.md': '# Just a heading\n\nNo frontmatter.\n' };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /no YAML frontmatter block/.test(v.message))).toBe(true);
  });

  it('fails when type is missing', async () => {
    const files = { 'docs/adr/a.md': md('title: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /missing the required 'type' key/.test(v.message))).toBe(true);
  });

  it('fails when type is not kebab-case', async () => {
    const files = { 'docs/adr/a.md': md('type: DesignADR\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /must be kebab-case/.test(v.message))).toBe(true);
  });

  it('fails when type is outside the entry allowedTypes', async () => {
    const files = { 'docs/adr/a.md': md('type: adr\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /is not one of the matched entry's allowed types/.test(v.message))).toBe(true);
  });

  it('accepts type: draft when settings.draftEscape is on', async () => {
    const dm = harnessConfig([{ include: ['docs/adr/*.md'], rule: { allowedTypes: ['design-adr'], label: 'title' } }], {
      settings: { draftEscape: true },
    });
    const files = { 'docs/adr/a.md': md('type: draft\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { config: dm });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('rejects type: draft when draftEscape is off', async () => {
    const files = { 'docs/adr/a.md': md('type: draft\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /is not one of the matched entry's allowed types/.test(v.message))).toBe(true);
  });

  it('accepts any kebab type in a membership-open entry (rule without allowedTypes)', async () => {
    const openRules = harnessConfig([{ include: ['docs/adr/*.md'], rule: { label: 'title' } }]);
    const files = { 'docs/adr/a.md': md('type: anything-goes\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { config: openRules });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails when the pinned label is missing', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /must carry 'title'/.test(v.message))).toBe(true);
  });

  it('fails when the other label is also present', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"\nname: "a"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /carries 'name' but the matched entry pins 'title'/.test(v.message))).toBe(true);
  });

  it('fails when the file uses the wrong label for the entry', async () => {
    const nameRules = harnessConfig([
      { include: ['.claude/agents/*.md'], rule: { allowedTypes: ['agent'], label: 'name' } },
    ]);
    const files = { '.claude/agents/s.md': md('type: agent\ntitle: "S"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { config: nameRules });
    await floor.check(ctx);
    expect(violations.some((v) => /must carry 'name'/.test(v.message))).toBe(true);
  });

  it('leaves description optional by default', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"') };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails a missing description when the entry rule sets requireDescription', async () => {
    const reqRules = harnessConfig([
      { include: ['docs/adr/*.md'], rule: { allowedTypes: ['design-adr'], label: 'title', requireDescription: true } },
    ]);
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"') };
    const { ctx, violations } = makeCtx(files, { config: reqRules });
    await floor.check(ctx);
    expect(violations.some((v) => /missing 'description', which the matched entry requires/.test(v.message))).toBe(
      true,
    );
  });

  it('fails when the label exceeds the default 64-char cap', async () => {
    const long = 'x'.repeat(65);
    const files = { 'docs/adr/a.md': md(`type: design-adr\ntitle: "${long}"\ndescription: "Why."`) };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(
      violations.some((v) => /'title' is 65 chars, exceeding the matched entry's 64-char cap/.test(v.message)),
    ).toBe(true);
  });

  it('fails when description exceeds the default 1024-char cap', async () => {
    const long = 'x'.repeat(1025);
    const files = { 'docs/adr/a.md': md(`type: design-adr\ntitle: "A"\ndescription: "${long}"`) };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(
      violations.some((v) =>
        /'description' is 1025 chars, exceeding the matched entry's 1024-char cap/.test(v.message),
      ),
    ).toBe(true);
  });

  it('passes a long description when the entry rule raises maxDescription', async () => {
    const long = 'x'.repeat(1500);
    const agentRules = harnessConfig([
      { include: ['.claude/agents/*.md'], rule: { allowedTypes: ['agent'], label: 'name', maxDescription: 4096 } },
    ]);
    const files = { '.claude/agents/s.md': md(`type: agent\nname: "Scarlet"\ndescription: "${long}"`) };
    const { ctx, violations } = makeCtx(files, { config: agentRules });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('accepts a valid comma-separated tags list', async () => {
    const files = {
      'docs/adr/a.md': md('type: design-adr\ntitle: "A"\ntags: governance, frontmatter-floor'),
    };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails a non-kebab tag', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"\ntags: Governance, ok') };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /tag 'Governance' must be kebab-case/.test(v.message))).toBe(true);
  });

  it('flags a trailing comma as a malformed (empty) tag', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"\ntags: governance,') };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /tag '' must be kebab-case/.test(v.message))).toBe(true);
  });

  it('fails a tag exceeding the default 30-char cap', async () => {
    const long = 'x'.repeat(31);
    const files = { 'docs/adr/a.md': md(`type: design-adr\ntitle: "A"\ntags: ${long}`) };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /is 31 chars, exceeding the matched entry's 30-char cap/.test(v.message))).toBe(true);
  });

  it('passes a long tag when the entry rule raises maxTag', async () => {
    const long = 'x'.repeat(31);
    const tagRules = harnessConfig([
      { include: ['docs/adr/*.md'], rule: { allowedTypes: ['design-adr'], label: 'title', maxTag: 64 } },
    ]);
    const files = { 'docs/adr/a.md': md(`type: design-adr\ntitle: "A"\ntags: ${long}`) };
    const { ctx, violations } = makeCtx(files, { config: tagRules });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails when tags is formatted as a YAML block list', async () => {
    const files = {
      'docs/adr/a.md': md('type: design-adr\ntitle: "A"\ntags:\n   - governance\n   - frontmatter-floor'),
    };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /must be a comma-separated string, not a YAML list/.test(v.message))).toBe(true);
  });

  it('fails when tags is formatted as a YAML inline array', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"\ntags: [governance, frontmatter-floor]') };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /must be a comma-separated string, not a YAML list/.test(v.message))).toBe(true);
  });

  it('in an open governed entry (no rule payload), fails when neither name nor title is present', async () => {
    const openRules = harnessConfig([{ include: ['docs/adr/*.md'] }]);
    const files = { 'docs/adr/a.md': md('type: design-adr\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { config: openRules });
    await floor.check(ctx);
    expect(violations.some((v) => /must carry exactly one of 'name' or 'title'/.test(v.message))).toBe(true);
  });

  it('in an open governed entry, fails when both name and title are present', async () => {
    const openRules = harnessConfig([{ include: ['docs/adr/*.md'] }]);
    const files = { 'docs/adr/a.md': md('type: design-adr\nname: "a"\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { config: openRules });
    await floor.check(ctx);
    expect(violations.some((v) => /carries both 'name' and 'title'/.test(v.message))).toBe(true);
  });

  it('resolves a file to the first matching entry (exempt first wins → no floor)', async () => {
    const m = harnessConfig([
      { include: ['docs/adr/a.md'], exempt: true },
      { include: ['docs/adr/*.md'], rule: { allowedTypes: ['design-adr'], label: 'title' } },
    ]);
    const files = { 'docs/adr/a.md': '# no frontmatter\n' };
    const { ctx, violations } = makeCtx(files, { config: m });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('resolves a file to the first matching entry (governed first wins → floor applies)', async () => {
    const m = harnessConfig([
      { include: ['docs/adr/*.md'], rule: { allowedTypes: ['design-adr'], label: 'title' } },
      { include: ['docs/adr/a.md'], exempt: true },
    ]);
    const files = { 'docs/adr/a.md': '# no frontmatter\n' };
    const { ctx, violations } = makeCtx(files, { config: m });
    await floor.check(ctx);
    expect(violations.some((v) => /no YAML frontmatter block/.test(v.message))).toBe(true);
  });

  it('applies only the first entry membership when two governed entries overlap', async () => {
    const m = harnessConfig([
      { include: ['docs/adr/*.md'], rule: { allowedTypes: ['design-adr'], label: 'title' } },
      { include: ['docs/adr/*.md'], rule: { allowedTypes: ['other'], label: 'title' } },
    ]);
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { config: m });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it("an entry's exclude makes the file fall through to a LATER entry (not exempt)", async () => {
    const m = harnessConfig([
      { include: ['docs/**/*.md'], exclude: ['docs/adr/*.md'], rule: { label: 'name' } },
      { include: ['docs/adr/*.md'], rule: { label: 'title' } },
    ]);
    // The file violates the SECOND entry's pin (title), proving the first
    // entry's exclude did not claim it and the second entry governs it.
    const files = { 'docs/adr/a.md': md('type: design-adr\nname: "a"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { config: m });
    await floor.check(ctx);
    expect(violations.some((v) => /must carry 'title'/.test(v.message))).toBe(true);
  });

  it('an excluded file matching no later entry falls to unmatched (exempt by default)', async () => {
    const m = harnessConfig([{ include: ['docs/**/*.md'], exclude: ['docs/notes.md'], rule: { label: 'title' } }]);
    const files = { 'docs/notes.md': '# no frontmatter, excluded\n' };
    const { ctx, violations } = makeCtx(files, { config: m });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('leaves an unmatched file ungoverned', async () => {
    const files = { 'src/notes.md': '# no frontmatter, unmatched\n' };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('skips a governed file that cannot be read (a symlink)', async () => {
    const { ctx, violations } = makeCtx({}, { config: adrRules, symlinks: ['docs/adr/link.md'] });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('emits at the warning tier when the matched entry sets severity: warning', async () => {
    const warnRules = harnessConfig([
      {
        include: ['docs/adr/*.md'],
        severity: 'warning',
        rule: { allowedTypes: ['design-adr'], label: 'title', requireDescription: true },
      },
    ]);
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"') }; // missing required description
    const { ctx, violations, warnings } = makeCtx(files, { config: warnRules });
    await floor.check(ctx);
    expect(violations).toEqual([]);
    expect(warnings.some((w) => /missing 'description'/.test(w.message))).toBe(true);
  });

  it('emits at the error tier by default', async () => {
    const reqRules = harnessConfig([
      { include: ['docs/adr/*.md'], rule: { allowedTypes: ['design-adr'], label: 'title', requireDescription: true } },
    ]);
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"') }; // missing required description
    const { ctx, violations, warnings } = makeCtx(files, { config: reqRules });
    await floor.check(ctx);
    expect(warnings).toEqual([]);
    expect(violations.some((v) => /missing 'description'/.test(v.message))).toBe(true);
  });

  it('governs nothing when a present config declares an empty pathRules array', async () => {
    const files = { 'README.md': md('type: readme\ntitle: "R"') }; // wrong type for the default, but config replaces it
    const { ctx, violations } = makeCtx(files, { config: harnessConfig([]) });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('a present config replaces the built-in default outright', async () => {
    // Config governs only docs/adr; README (a default path) is now unmatched and
    // ungoverned even though it would fail the default (wrong type).
    const files = { 'README.md': md('type: readme\ntitle: "R"') };
    const { ctx, violations } = makeCtx(files, { config: adrRules });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });
});

describe("frontmatter-floor coverage (unmatched: 'error')", () => {
  it('errors on an in-coverage file that no entry claims, and only on it', async () => {
    const files = {
      'docs/adr/a.md': md('type: design-adr\ntitle: "A"\ndescription: "Why."'), // claimed, conformant
      'docs/guide.md': '# unclaimed but in coverage\n', // → violation
      'docs/legacy/old.md': '# coverage-excluded\n', // outside the universe
      'docs/tmp/scratch.md': '# exempt-claimed\n', // claimed and waived
      'src/notes.md': '# outside coverage\n',
    };
    const { ctx, violations } = makeCtx(files, { config: STRICT_CONFIG });
    await floor.check(ctx);
    const coverageViolations = violations.filter((v) => /matched no pathRules entry/.test(v.message));
    expect(coverageViolations.map((v) => v.file)).toEqual(['docs/guide.md']);
    expect(violations).toEqual(coverageViolations);
  });

  it('an entry-excluded file inside coverage is NOT claimed — it surfaces as a coverage violation', async () => {
    const m = harnessConfig([{ include: ['docs/**/*.md'], exclude: ['docs/carved.md'], rule: { label: 'title' } }], {
      unmatched: 'error',
      coverage: { include: ['docs/**/*.md'] },
    });
    const files = {
      'docs/kept.md': md('type: doc\ntitle: "K"'),
      'docs/carved.md': md('type: doc\ntitle: "C"'), // excluded → unclaimed → in-coverage violation
    };
    const { ctx, violations } = makeCtx(files, { config: m });
    await floor.check(ctx);
    expect(violations.some((v) => v.file === 'docs/carved.md' && /matched no pathRules entry/.test(v.message))).toBe(
      true,
    );
    expect(violations.some((v) => v.file === 'docs/kept.md')).toBe(false);
  });
});

describe('frontmatter-floor consumer contract (all-or-nothing)', () => {
  const failingFiles = { 'docs/adr/a.md': '# no frontmatter\n', 'README.md': '# no frontmatter\n' };

  it('governs nothing when the config file is present but unparseable', async () => {
    const { ctx, violations, warnings } = makeCtx(failingFiles, { brokenJson: true });
    await floor.check(ctx);
    expect(violations).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('governs nothing on a spine-invalid block', async () => {
    const { ctx, violations } = makeCtx(failingFiles, { config: SPINE_INVALID_CONFIG });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('governs nothing on a payload-invalid block', async () => {
    const { ctx, violations } = makeCtx(failingFiles, { config: PAYLOAD_TYPO_CONFIG });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('governs nothing on a version skew against the installed harness release', async () => {
    const { ctx, violations } = makeCtx(failingFiles, { config: VERSION_MISMATCH_CONFIG });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('governs nothing when the version stamp is missing', async () => {
    const { ctx, violations } = makeCtx(failingFiles, { config: VERSION_MISSING_CONFIG });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('governs nothing on a malformed stamp, even when package.json yields no version', async () => {
    const { ctx, violations } = makeCtx(failingFiles, { config: VERSION_MALFORMED_CONFIG, packageVersion: null });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('governs nothing on the retired pre-restructure format (unstamped, undeclared keys)', async () => {
    // Present but invalid — no envelope stamp, so this consumer never
    // interprets it (not even to fall back to the default); GEN-002 carries
    // the loud config-version and config-shape-valid errors.
    const { ctx, violations } = makeCtx(failingFiles, { config: RETIRED_KEY_CONFIG });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('governs nothing on a depth-violating block (spine-invalid)', async () => {
    const { ctx, violations } = makeCtx(failingFiles, { config: DEPTH_VIOLATION_CONFIG });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('falls back to the built-in default when the block name is a typo in a healthy envelope', async () => {
    const { ctx, violations } = makeCtx(failingFiles, { config: UNDECLARED_BLOCK_CONFIG });
    await floor.check(ctx);
    expect(violations.some((v) => v.file === 'README.md')).toBe(true);
    expect(violations.some((v) => v.file === 'docs/adr/a.md')).toBe(false);
  });

  it('governs by the shared VALID_CONFIG fixture end to end', async () => {
    const files = {
      'docs/adr/good.md': md('type: design-adr\ntitle: "Good"\ndescription: "Why."'),
      'docs/adr/DRAFT-x.md': '# excluded → falls to unmatched (exempt)\n',
      '.agents/tool.md': '# exempt-claimed\n',
      'README.md': '# missing frontmatter → warning-tier entry\n',
    };
    const { ctx, violations, warnings } = makeCtx(files, { config: VALID_CONFIG });
    await floor.check(ctx);
    expect(violations).toEqual([]);
    expect(warnings.some((w) => w.file === 'README.md' && /no YAML frontmatter block/.test(w.message))).toBe(true);
  });
});

describe('frontmatter-floor built-in default (no harness config)', () => {
  // Keep-honest: this rules file hardcodes DEFAULT_CONFIG and cannot import
  // (archgate rules share no runtime code), so it is pinned to the shared
  // DEFAULT_FRONTMATTER fixture that the CLI seed is pinned to too — if this
  // default drifts, both this test and the CLI's keep-honest test fail, forcing
  // the seed to be updated in lockstep so seeding stays a behaviour no-op (#49).
  it('applies exactly the shared DEFAULT_FRONTMATTER fixture', () => {
    expect(DEFAULT_CONFIG).toEqual(DEFAULT_FRONTMATTER);
  });

  it('governs .archgate/adrs/*.md by the default when the config is absent', async () => {
    const files = { '.archgate/adrs/GEN-009-x.md': md('type: adr\ntitle: "X"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files); // no config → DEFAULT applies
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('leaves description optional under the built-in default', async () => {
    const files = { '.archgate/adrs/GEN-009-x.md': md('type: adr\ntitle: "X"') };
    const { ctx, violations } = makeCtx(files);
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails a default-governed README whose type is not docs', async () => {
    const files = { 'README.md': md('type: readme\ntitle: "R"\ndescription: "d"') };
    const { ctx, violations } = makeCtx(files);
    await floor.check(ctx);
    expect(violations.some((v) => /is not one of the matched entry's allowed types/.test(v.message))).toBe(true);
  });

  it('accepts a default-governed README with type: docs', async () => {
    const files = { 'README.md': md('type: docs\ntitle: "R"\ndescription: "d"') };
    const { ctx, violations } = makeCtx(files);
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('governs AGENTS.md and CLAUDE.md by the default', async () => {
    const files = {
      'AGENTS.md': md('type: wrong\ntitle: "A"\ndescription: "d"'),
      'CLAUDE.md': md('type: claude-md\ntitle: "C"\ndescription: "d"'),
    };
    const { ctx, violations } = makeCtx(files);
    await floor.check(ctx);
    expect(violations.some((v) => v.file === 'AGENTS.md')).toBe(true);
    expect(violations.some((v) => v.file === 'CLAUDE.md')).toBe(false);
  });

  it('applies the default when a healthy config omits the frontmatter block', async () => {
    const files = { 'README.md': md('type: readme\ntitle: "R"') }; // wrong type under the default
    const { ctx, violations } = makeCtx(files, { config: { version: MOCK_HARNESS_VERSION, markdown: {} } });
    await floor.check(ctx);
    expect(violations.some((v) => v.file === 'README.md')).toBe(true);
  });

  it('leaves a path outside the default ungoverned when the config is absent', async () => {
    const files = { 'docs/adr/a.md': md('type: nope') }; // not a default pathRule
    const { ctx, violations } = makeCtx(files);
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });
});

describe('GEN-003 report hygiene', () => {
  it('embeds the provenance tag and attribution in every message', async () => {
    const badBlock = harnessConfig([{ include: ['x.md'], rule: { maxDescriptions: 1, label: 'heading' } }], {
      settings: { draftEscape: 'yes' },
    });
    const { ctx, violations } = makeCtx({}, { config: badBlock });
    await configValid.check(ctx);
    expect(violations.length).toBeGreaterThan(1);
    for (const v of violations) {
      expect(v.message).toMatch(/\(GEN-003 \[frontmatter-config-valid\]\)\.$/);
      expect(v.file).toBe(CONFIG_PATH);
    }

    const rules = harnessConfig([
      { include: ['docs/adr/*.md'], rule: { allowedTypes: ['design-adr'], label: 'title' } },
    ]);
    const files = { 'docs/adr/a.md': md('type: Bad Type\nname: "a"\ntitle: "A"\ntags: Bad,') };
    const { ctx: floorCtx, violations: floorViolations } = makeCtx(files, { config: rules });
    await floor.check(floorCtx);
    expect(floorViolations.length).toBeGreaterThan(1);
    for (const v of floorViolations) {
      expect(v.message).toMatch(/\(GEN-003 \[frontmatter-floor\]\)\.$/);
      expect(v.file).toBe('docs/adr/a.md');
    }
  });
});
