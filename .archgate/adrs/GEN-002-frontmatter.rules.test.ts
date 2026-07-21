/// <reference path="../rules.d.ts" />

// Sibling test for GEN-002-frontmatter.rules.ts — pass and fail path per rule,
// exercised through each rule's check(ctx) against an in-memory RuleContext.
// The seam mirrors GEN-001's makeCtx, extended so readJSON serves the root
// manifest .typescript-ai-harness.json.

import { describe, expect, it } from 'vitest';
import ruleSet from './GEN-002-frontmatter.rules';

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
// ctx.readFile throws. `manifest` is served by readJSON at the manifest path;
// omit it entirely to model an absent manifest (readJSON throws ENOENT).
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

// Build a manifest whose adr.frontmatter carries the given zones plus any extras
// (unmatched, draftEscape).
function manifest(zones: unknown[], extra: Record<string, unknown> = {}): unknown {
  return { adr: { frontmatter: { zones, ...extra } } };
}

// Build a governed markdown file from frontmatter lines.
function md(frontmatterLines: string): string {
  return `---\n${frontmatterLines}\n---\n\n# Heading\n\nBody text.\n`;
}

const configValid = ruleSet.rules['frontmatter-config-valid'];
const floor = ruleSet.rules['frontmatter-floor'];

describe('frontmatter-config-valid', () => {
  const goodManifest = manifest(
    [
      { match: 'docs/adr/*.md', allowedTypes: ['design-adr'], label: 'title' },
      { match: '.claude/agents/*.md', allowedTypes: ['agent'], label: 'name', maxDescription: 4096 },
      { match: '.agents/**', exempt: true },
      { match: ['README.md', 'AGENTS.md'], label: 'title', severity: 'warning' },
    ],
    { unmatched: 'exempt', draftEscape: true },
  );

  it('passes a well-formed manifest', async () => {
    const { ctx, violations } = makeCtx({}, { manifest: goodManifest });
    await configValid.check(ctx);
    expect(violations).toEqual([]);
  });

  it('no-ops when the manifest is absent', async () => {
    const { ctx, violations } = makeCtx({});
    await configValid.check(ctx);
    expect(violations).toEqual([]);
  });

  it('no-ops when adr.frontmatter is absent', async () => {
    const { ctx, violations } = makeCtx({}, { manifest: { adr: {} } });
    await configValid.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails when zones is not an array', async () => {
    const { ctx, violations } = makeCtx({}, { manifest: { adr: { frontmatter: { zones: 'nope' } } } });
    await configValid.check(ctx);
    expect(violations.some((v) => /zones must be an array/.test(v.message))).toBe(true);
  });

  it('fails when a zone lacks a match glob', async () => {
    const { ctx, violations } = makeCtx({}, { manifest: manifest([{ label: 'title' }]) });
    await configValid.check(ctx);
    expect(violations.some((v) => /match must be a non-empty glob/.test(v.message))).toBe(true);
  });

  it('fails on an invalid label', async () => {
    const { ctx, violations } = makeCtx({}, { manifest: manifest([{ match: 'x.md', label: 'heading' }]) });
    await configValid.check(ctx);
    expect(violations.some((v) => /label must be 'name' or 'title'/.test(v.message))).toBe(true);
  });

  it('fails on an invalid zone tier', async () => {
    const { ctx, violations } = makeCtx({}, { manifest: manifest([{ match: 'x.md', severity: 'fatal' }]) });
    await configValid.check(ctx);
    expect(violations.some((v) => /\.severity must be 'error' or 'warning'/.test(v.message))).toBe(true);
  });

  it('fails on non-kebab allowedTypes', async () => {
    const { ctx, violations } = makeCtx({}, { manifest: manifest([{ match: 'x.md', allowedTypes: ['Design ADR'] }]) });
    await configValid.check(ctx);
    expect(violations.some((v) => /allowedTypes must be an array of kebab/.test(v.message))).toBe(true);
  });

  it('fails on a non-integer maxDescription', async () => {
    const { ctx, violations } = makeCtx({}, { manifest: manifest([{ match: 'x.md', maxDescription: -3 }]) });
    await configValid.check(ctx);
    expect(violations.some((v) => /maxDescription must be a positive integer/.test(v.message))).toBe(true);
  });

  it('fails on a non-integer maxLabel', async () => {
    const { ctx, violations } = makeCtx({}, { manifest: manifest([{ match: 'x.md', maxLabel: 12.5 }]) });
    await configValid.check(ctx);
    expect(violations.some((v) => /maxLabel must be a positive integer/.test(v.message))).toBe(true);
  });

  it('fails on a non-boolean exempt', async () => {
    const { ctx, violations } = makeCtx({}, { manifest: manifest([{ match: 'x.md', exempt: 'yes' }]) });
    await configValid.check(ctx);
    expect(violations.some((v) => /exempt must be a boolean/.test(v.message))).toBe(true);
  });

  it('fails on an invalid unmatched default', async () => {
    const { ctx, violations } = makeCtx({}, { manifest: manifest([{ match: 'x.md' }], { unmatched: 'govern' }) });
    await configValid.check(ctx);
    expect(violations.some((v) => /unmatched must be 'exempt'/.test(v.message))).toBe(true);
  });

  it('fails on a non-boolean draftEscape', async () => {
    const { ctx, violations } = makeCtx({}, { manifest: manifest([{ match: 'x.md' }], { draftEscape: 'yes' }) });
    await configValid.check(ctx);
    expect(violations.some((v) => /draftEscape must be a boolean/.test(v.message))).toBe(true);
  });
});

describe('frontmatter-floor', () => {
  const adrZone = manifest([{ match: 'docs/adr/*.md', allowedTypes: ['design-adr'], label: 'title' }]);

  it('passes a conformant governed file', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A decision"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: adrZone });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('no-ops when the manifest is absent', async () => {
    const files = { 'docs/adr/a.md': md('type: nope') };
    const { ctx, violations } = makeCtx(files);
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails a governed file with no frontmatter block', async () => {
    const files = { 'docs/adr/a.md': '# Just a heading\n\nNo frontmatter.\n' };
    const { ctx, violations } = makeCtx(files, { manifest: adrZone });
    await floor.check(ctx);
    expect(violations.some((v) => /no YAML frontmatter block/.test(v.message))).toBe(true);
  });

  it('fails when type is missing', async () => {
    const files = { 'docs/adr/a.md': md('title: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: adrZone });
    await floor.check(ctx);
    expect(violations.some((v) => /missing the required 'type' key/.test(v.message))).toBe(true);
  });

  it('fails when type is not kebab-case', async () => {
    const files = { 'docs/adr/a.md': md('type: DesignADR\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: adrZone });
    await floor.check(ctx);
    expect(violations.some((v) => /must be kebab-case/.test(v.message))).toBe(true);
  });

  it('fails when type is outside the zone allowedTypes', async () => {
    const files = { 'docs/adr/a.md': md('type: adr\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: adrZone });
    await floor.check(ctx);
    expect(violations.some((v) => /is not one of this zone's allowed types/.test(v.message))).toBe(true);
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
    const { ctx, violations } = makeCtx(files, { manifest: adrZone });
    await floor.check(ctx);
    expect(violations.some((v) => /is not one of this zone's allowed types/.test(v.message))).toBe(true);
  });

  it('accepts any kebab type in a membership-open zone (no allowedTypes)', async () => {
    const openZone = manifest([{ match: 'docs/adr/*.md', label: 'title' }]);
    const files = { 'docs/adr/a.md': md('type: anything-goes\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: openZone });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails when the pinned label is missing', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: adrZone });
    await floor.check(ctx);
    expect(violations.some((v) => /must carry 'title'/.test(v.message))).toBe(true);
  });

  it('fails when the other label is also present', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"\nname: "a"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: adrZone });
    await floor.check(ctx);
    expect(violations.some((v) => /carries 'name' but this zone pins 'title'/.test(v.message))).toBe(true);
  });

  it('fails when the file uses the wrong label for the zone', async () => {
    const nameZone = manifest([{ match: '.claude/agents/*.md', allowedTypes: ['agent'], label: 'name' }]);
    const files = { '.claude/agents/s.md': md('type: agent\ntitle: "S"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: nameZone });
    await floor.check(ctx);
    expect(violations.some((v) => /must carry 'name'/.test(v.message))).toBe(true);
  });

  it('fails when description is missing', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"') };
    const { ctx, violations } = makeCtx(files, { manifest: adrZone });
    await floor.check(ctx);
    expect(violations.some((v) => /missing the required 'description' key/.test(v.message))).toBe(true);
  });

  it('fails when the label exceeds the default 64-char cap', async () => {
    const long = 'x'.repeat(65);
    const files = { 'docs/adr/a.md': md(`type: design-adr\ntitle: "${long}"\ndescription: "Why."`) };
    const { ctx, violations } = makeCtx(files, { manifest: adrZone });
    await floor.check(ctx);
    expect(violations.some((v) => /'title' is 65 chars, exceeding this zone's 64-char cap/.test(v.message))).toBe(true);
  });

  it('fails when description exceeds the default 1024-char cap', async () => {
    const long = 'x'.repeat(1025);
    const files = { 'docs/adr/a.md': md(`type: design-adr\ntitle: "A"\ndescription: "${long}"`) };
    const { ctx, violations } = makeCtx(files, { manifest: adrZone });
    await floor.check(ctx);
    expect(
      violations.some((v) => /'description' is 1025 chars, exceeding this zone's 1024-char cap/.test(v.message)),
    ).toBe(true);
  });

  it('passes a long description when the zone raises maxDescription', async () => {
    const long = 'x'.repeat(1500);
    const agentZone = manifest([
      { match: '.claude/agents/*.md', allowedTypes: ['agent'], label: 'name', maxDescription: 4096 },
    ]);
    const files = { '.claude/agents/s.md': md(`type: agent\nname: "Scarlet"\ndescription: "${long}"`) };
    const { ctx, violations } = makeCtx(files, { manifest: agentZone });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('in a label-open zone, fails when neither name nor title is present', async () => {
    const openZone = manifest([{ match: 'docs/adr/*.md' }]);
    const files = { 'docs/adr/a.md': md('type: design-adr\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: openZone });
    await floor.check(ctx);
    expect(violations.some((v) => /must carry exactly one of 'name' or 'title'/.test(v.message))).toBe(true);
  });

  it('in a label-open zone, fails when both name and title are present', async () => {
    const openZone = manifest([{ match: 'docs/adr/*.md' }]);
    const files = { 'docs/adr/a.md': md('type: design-adr\nname: "a"\ntitle: "A"\ndescription: "Why."') };
    const { ctx, violations } = makeCtx(files, { manifest: openZone });
    await floor.check(ctx);
    expect(violations.some((v) => /carries both 'name' and 'title'/.test(v.message))).toBe(true);
  });

  it('resolves a file to the first matching zone (exempt first wins → no floor)', async () => {
    const m = manifest([
      { match: 'docs/adr/a.md', exempt: true },
      { match: 'docs/adr/*.md', allowedTypes: ['design-adr'], label: 'title' },
    ]);
    const files = { 'docs/adr/a.md': '# no frontmatter\n' };
    const { ctx, violations } = makeCtx(files, { manifest: m });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('resolves a file to the first matching zone (governed first wins → floor applies)', async () => {
    const m = manifest([
      { match: 'docs/adr/*.md', allowedTypes: ['design-adr'], label: 'title' },
      { match: 'docs/adr/a.md', exempt: true },
    ]);
    const files = { 'docs/adr/a.md': '# no frontmatter\n' };
    const { ctx, violations } = makeCtx(files, { manifest: m });
    await floor.check(ctx);
    expect(violations.some((v) => /no YAML frontmatter block/.test(v.message))).toBe(true);
  });

  it('applies only the first zone membership when two governed zones overlap', async () => {
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
    const { ctx, violations } = makeCtx(files, { manifest: adrZone });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('skips a governed file that cannot be read (a symlink)', async () => {
    const { ctx, violations } = makeCtx({}, { manifest: adrZone, symlinks: ['docs/adr/link.md'] });
    await floor.check(ctx);
    expect(violations).toEqual([]);
  });

  it('emits at the warning tier when the matched zone sets severity: warning', async () => {
    const warnZone = manifest([
      { match: 'docs/adr/*.md', allowedTypes: ['design-adr'], label: 'title', severity: 'warning' },
    ]);
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"') }; // missing description
    const { ctx, violations, warnings } = makeCtx(files, { manifest: warnZone });
    await floor.check(ctx);
    expect(violations).toEqual([]);
    expect(warnings.some((w) => /missing the required 'description' key/.test(w.message))).toBe(true);
  });

  it('emits at the error tier by default', async () => {
    const files = { 'docs/adr/a.md': md('type: design-adr\ntitle: "A"') }; // missing description
    const { ctx, violations, warnings } = makeCtx(files, { manifest: adrZone });
    await floor.check(ctx);
    expect(warnings).toEqual([]);
    expect(violations.some((v) => /missing the required 'description' key/.test(v.message))).toBe(true);
  });
});
