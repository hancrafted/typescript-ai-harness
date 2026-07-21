/// <reference path="../rules.d.ts" />

// Sibling test for GEN-003-frontmatter.rules.ts — pass and fail path for the
// single rule `frontmatter-floor`, exercised through check(ctx) against an
// in-memory RuleContext. The seam mirrors GEN-001's makeCtx, extended so
// readJSON serves the root harness config .typescript-ai-harness.json; omit the
// manifest to model an absent config, which exercises the built-in DEFAULT.

import { describe, expect, it } from 'vitest';
import ruleSet from './GEN-003-frontmatter.rules';

interface Reported {
  message: string;
  file?: string;
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split('**')
    .map((chunk) =>
      chunk
        .split('*')
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('[^/]*'),
    )
    .join('.*');
  return new RegExp(`^${escaped}$`);
}

// `symlinks` model archgate's non-following file reader: ctx.glob lists them but
// ctx.readFile throws. `manifest` is served by readJSON at the config path; omit
// it entirely to model an absent config (readJSON throws ENOENT → DEFAULT).
function makeCtx(files: Record<string, string>, opts?: { manifest?: unknown; symlinks?: string[] }) {
  const violations: Reported[] = [];
  const warnings: Reported[] = [];
  const symlinks = opts?.symlinks ?? [];
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
      if (path in files) return files[path];
      if (symlinks.includes(path)) throw new Error(`ELOOP: not followed: ${path}`);
      throw new Error(`ENOENT: ${path}`);
    },
    async readJSON(path: string) {
      if (path === '.typescript-ai-harness.json') {
        if (opts && 'manifest' in opts) return opts.manifest;
        throw new Error('ENOENT: .typescript-ai-harness.json');
      }
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

// Build a harness config whose adr.frontmatter carries the given pathRules plus
// any extras (unmatched, draftEscape).
function manifest(pathRules: unknown[], extra: Record<string, unknown> = {}): unknown {
  return { adr: { frontmatter: { pathRules, ...extra } } };
}

// Build a governed markdown file from frontmatter lines.
function md(frontmatterLines: string): string {
  return `---\n${frontmatterLines}\n---\n\n# Heading\n\nBody text.\n`;
}

const floor = ruleSet.rules['frontmatter-floor'];

describe('frontmatter-floor', () => {
  const adrRules = manifest([{ match: 'docs/adr/*.md', allowedTypes: ['design-adr'], label: 'title' }]);

  it('passes a conformant governed file', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A decision"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: adrRules });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails a governed file with no frontmatter block', async () => {
    const files = { 'docs/adr/a.md': '# Just a heading\n\nNo frontmatter.\n' };
    const { ctx, violations } = makeCtx(files, { manifest: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /no YAML frontmatter block/.test(v.message))).toBe(true);
  });

  it('fails when type is missing', async () => {
    const files = { 'docs/adr/a.md': md('title: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /missing the required 'type' key/.test(v.message))).toBe(true);
  });

  it('fails when type is not kebab-case', async () => {
    const files = { 'docs/adr/a.md': md('type: DesignADR\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /must be kebab-case/.test(v.message))).toBe(true);
  });

  it('fails when type is outside the entry allowedTypes', async () => {
    const files = { 'docs/adr/a.md': md('type: adr\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /is not one of the matched entry's allowed types/.test(v.message))).toBe(true);
  });

  it('accepts type: draft when draftEscape is on', async () => {
    const dm = manifest([{ match: 'docs/adr/*.md', allowedTypes: ['design-adr'], label: 'title' }], {
      draftEscape: true,
    });
    const files = { 'docs/adr/a.md': md('type: draft\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: dm });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('rejects type: draft when draftEscape is off', async () => {
    const files = { 'docs/adr/a.md': md('type: draft\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /is not one of the matched entry's allowed types/.test(v.message))).toBe(true);
  });

  it('accepts any kebab type in a membership-open entry (no allowedTypes)', async () => {
    const openRules = manifest([{ match: 'docs/adr/*.md', label: 'title' }]);
    const files = { 'docs/adr/a.md': md('type: anything-goes\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: openRules });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails when the pinned label is missing', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /must carry 'title'/.test(v.message))).toBe(true);
  });

  it('fails when the other label is also present', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"\nname: "a"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /carries 'name' but the matched entry pins 'title'/.test(v.message))).toBe(true);
  });

  it('fails when the file uses the wrong label for the entry', async () => {
    const nameRules = manifest([{ match: '.claude/agents/*.md', allowedTypes: ['agent'], label: 'name' }]);
    const files = { '.claude/agents/s.md': md('type: agent\ntitle: "S"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: nameRules });
    await floor.check(ctx);
    expect(violations.some((v) => /must carry 'name'/.test(v.message))).toBe(true);
  });

  it('fails when description is missing', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"') };
    const { ctx, violations } = makeCtx(files, { manifest: adrRules });
    await floor.check(ctx);
    expect(violations.some((v) => /missing the required 'description' key/.test(v.message))).toBe(true);
  });

  it('fails when the label exceeds the default 64-char cap', async () => {
    const long = 'x'.repeat(65);
    const files = { 'docs/adr/a.md': md(`type: design-adr\ntitle: "${long}"\ndescription: "Why."`) };
    const { ctx, violations } = makeCtx(files, { manifest: adrRules });
    await floor.check(ctx);
    expect(
      violations.some((v) => /'title' is 65 chars, exceeding the matched entry's 64-char cap/.test(v.message)),
    ).toBe(true);
  });

  it('fails when description exceeds the default 1024-char cap', async () => {
    const long = 'x'.repeat(1025);
    const files = { 'docs/adr/a.md': md(`type: design-adr\ntitle: "A"\ndescription: "${long}"`) };
    const { ctx, violations } = makeCtx(files, { manifest: adrRules });
    await floor.check(ctx);
    expect(
      violations.some((v) =>
        /'description' is 1025 chars, exceeding the matched entry's 1024-char cap/.test(v.message),
      ),
    ).toBe(true);
  });

  it('passes a long description when the entry raises maxDescription', async () => {
    const long = 'x'.repeat(1500);
    const agentRules = manifest([
      { match: '.claude/agents/*.md', allowedTypes: ['agent'], label: 'name', maxDescription: 4096 },
    ]);
    const files = { '.claude/agents/s.md': md(`type: agent\nname: "Scarlet"\ndescription: "${long}"`) };
    const { ctx, violations } = makeCtx(files, { manifest: agentRules });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('in a label-open entry, fails when neither name nor title is present', async () => {
    const openRules = manifest([{ match: 'docs/adr/*.md' }]);
    const files = { 'docs/adr/a.md': md('type: design-adr\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: openRules });
    await floor.check(ctx);
    expect(violations.some((v) => /must carry exactly one of 'name' or 'title'/.test(v.message))).toBe(true);
  });

  it('in a label-open entry, fails when both name and title are present', async () => {
    const openRules = manifest([{ match: 'docs/adr/*.md' }]);
    const files = { 'docs/adr/a.md': md('type: design-adr\nname: "a"\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: openRules });
    await floor.check(ctx);
    expect(violations.some((v) => /carries both 'name' and 'title'/.test(v.message))).toBe(true);
  });

  it('resolves a file to the first matching entry (exempt first wins → no floor)', async () => {
    const m = manifest([
      { match: 'docs/adr/a.md', exempt: true },
      { match: 'docs/adr/*.md', allowedTypes: ['design-adr'], label: 'title' },
    ]);
    const files = { 'docs/adr/a.md': '# no frontmatter\n' };
    const { ctx, violations } = makeCtx(files, { manifest: m });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('resolves a file to the first matching entry (governed first wins → floor applies)', async () => {
    const m = manifest([
      { match: 'docs/adr/*.md', allowedTypes: ['design-adr'], label: 'title' },
      { match: 'docs/adr/a.md', exempt: true },
    ]);
    const files = { 'docs/adr/a.md': '# no frontmatter\n' };
    const { ctx, violations } = makeCtx(files, { manifest: m });
    await floor.check(ctx);
    expect(violations.some((v) => /no YAML frontmatter block/.test(v.message))).toBe(true);
  });

  it('applies only the first entry membership when two governed entries overlap', async () => {
    const m = manifest([
      { match: 'docs/adr/*.md', allowedTypes: ['design-adr'], label: 'title' },
      { match: 'docs/adr/*.md', allowedTypes: ['other'], label: 'title' },
    ]);
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: m });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('leaves an unmatched file ungoverned', async () => {
    const files = { 'src/notes.md': '# no frontmatter, unmatched\n' };
    const { ctx, violations } = makeCtx(files, { manifest: adrRules });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('skips a governed file that cannot be read (a symlink)', async () => {
    const { ctx, violations } = makeCtx({}, { manifest: adrRules, symlinks: ['docs/adr/link.md'] });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('emits at the warning tier when the matched entry sets severity: warning', async () => {
    const warnRules = manifest([
      { match: 'docs/adr/*.md', allowedTypes: ['design-adr'], label: 'title', severity: 'warning' },
    ]);
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"') }; // missing description
    const { ctx, violations, warnings } = makeCtx(files, { manifest: warnRules });
    await floor.check(ctx);
    expect(violations).toEqual([]);
    expect(warnings.some((w) => /missing the required 'description' key/.test(w.message))).toBe(true);
  });

  it('emits at the error tier by default', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"') }; // missing description
    const { ctx, violations, warnings } = makeCtx(files, { manifest: adrRules });
    await floor.check(ctx);
    expect(warnings).toEqual([]);
    expect(violations.some((v) => /missing the required 'description' key/.test(v.message))).toBe(true);
  });

  it('governs nothing when a present config declares an empty pathRules array', async () => {
    const files = { 'README.md': md('type: readme\ntitle: "R"') }; // would fail the default, but config replaces it
    const { ctx, violations } = makeCtx(files, { manifest: manifest([]) });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('a present config replaces the built-in default outright', async () => {
    // Config governs only docs/adr; README (a default path) is now unmatched and
    // ungoverned even though it would fail the default (wrong type, no description).
    const m = manifest([{ match: 'docs/adr/*.md', allowedTypes: ['design-adr'], label: 'title' }]);
    const files = { 'README.md': md('type: readme\ntitle: "R"') };
    const { ctx, violations } = makeCtx(files, { manifest: m });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });
});

describe('frontmatter-floor built-in default (no harness config)', () => {
  it('governs .archgate/adrs/*.md by the default when the config is absent', async () => {
    const files = { '.archgate/adrs/GEN-009-x.md': md('type: adr\ntitle: "X"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files); // no manifest → DEFAULT applies
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails a default-governed ADR that is missing its description', async () => {
    const files = { '.archgate/adrs/GEN-009-x.md': md('type: adr\ntitle: "X"') };
    const { ctx, violations } = makeCtx(files);
    await floor.check(ctx);
    expect(violations.some((v) => /missing the required 'description' key/.test(v.message))).toBe(true);
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

  it('leaves a path outside the default ungoverned when the config is absent', async () => {
    const files = { 'docs/adr/a.md': md('type: nope') }; // not a default pathRule
    const { ctx, violations } = makeCtx(files);
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });
});
