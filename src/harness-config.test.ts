import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ADR_CORE, ARCHGATE_VERSION, harnessConfig, parseHarnessConfig, supportingFiles } from './harness-config';

// The build config is validated at the parse seam, so parseHarnessConfig is the
// unit under test; the baked exports and the publish-surface invariant are
// checked against the real files so an accidental edit is caught here, not in a
// downstream capture (#47) or a shipped tarball.

const valid = {
  ADR_CORE: ['GEN-001', 'GEN-002'],
  supportingFiles: ['a.d.ts'],
  ARCHGATE_VERSION: '^1.2.3',
};

describe('parseHarnessConfig — accepts a well-formed config', () => {
  it('returns the three typed fields', () => {
    expect(parseHarnessConfig(valid)).toEqual(valid);
  });

  it('tolerates an empty supportingFiles list', () => {
    expect(parseHarnessConfig({ ...valid, supportingFiles: [] }).supportingFiles).toEqual([]);
  });
});

describe('parseHarnessConfig — rejects malformed input', () => {
  it.each([null, undefined, 'x', 42, true, []])('throws on non-object input: %p', (raw) => {
    expect(() => parseHarnessConfig(raw)).toThrow(/expected a JSON object/);
  });

  it.each([
    ['missing ADR_CORE', { ...valid, ADR_CORE: undefined }],
    ['empty ADR_CORE', { ...valid, ADR_CORE: [] }],
    ['ADR_CORE not an array', { ...valid, ADR_CORE: 'GEN-001' }],
    ['non-string ADR_CORE element', { ...valid, ADR_CORE: ['GEN-001', 2] }],
    ['empty-string ADR_CORE element', { ...valid, ADR_CORE: ['GEN-001', ''] }],
  ])('throws on %s', (_label, raw) => {
    expect(() => parseHarnessConfig(raw)).toThrow(/ADR_CORE/);
  });

  it.each([
    ['supportingFiles not an array', { ...valid, supportingFiles: 'a.d.ts' }],
    ['non-string supportingFiles element', { ...valid, supportingFiles: ['a.d.ts', 3] }],
    ['empty-string supportingFiles element', { ...valid, supportingFiles: ['a.d.ts', ''] }],
  ])('throws on %s', (_label, raw) => {
    expect(() => parseHarnessConfig(raw)).toThrow(/supportingFiles/);
  });

  it.each([
    ['missing ARCHGATE_VERSION', { ...valid, ARCHGATE_VERSION: undefined }],
    ['empty ARCHGATE_VERSION', { ...valid, ARCHGATE_VERSION: '' }],
    ['non-string ARCHGATE_VERSION', { ...valid, ARCHGATE_VERSION: 50 }],
  ])('throws on %s', (_label, raw) => {
    expect(() => parseHarnessConfig(raw)).toThrow(/ARCHGATE_VERSION/);
  });
});

describe('harness.config.json — the baked build config', () => {
  it('names the core ADR membership, ordered and explicit', () => {
    expect(ADR_CORE).toEqual(['GEN-001', 'GEN-002', 'GEN-003']);
  });

  it('lists exactly the .archgate/-relative supporting files that exist today', () => {
    // frontmatter-config.md (ADR-0010 §3) is deliberately deferred until it
    // ships alongside a dedicated frontmatter-config skill — do not add it here
    // until the file exists under .archgate/, or #47's capture breaks.
    expect(supportingFiles).toEqual([
      'harness-config-core.d.ts',
      'harness-config-extension.d.ts',
      'harness-config-fixtures.ts',
    ]);
  });

  it('pins the archgate version, unchanged from the retired template.ts constant', () => {
    expect(ARCHGATE_VERSION).toBe('^0.50.0');
  });

  it('exposes a single validated object for consumers', () => {
    expect(harnessConfig).toEqual({ ADR_CORE, supportingFiles, ARCHGATE_VERSION });
  });
});

describe('harness.config.json — publish surface', () => {
  it('is excluded from the published package (files whitelist ships only dist)', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      files: string[];
    };
    expect(pkg.files).toEqual(['dist']);
    expect(pkg.files).not.toContain('harness.config.json');
  });
});
