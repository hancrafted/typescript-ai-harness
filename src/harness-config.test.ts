import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ADR_CORE,
  ARCHGATE_VERSION,
  HARNESS_VERSION,
  harnessConfig,
  parseHarnessConfig,
  supportingFiles,
} from './harness-config';

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
    expect(ADR_CORE).toEqual(['GEN-001']);
  });

  it('lists exactly the .archgate/-relative supporting files that exist today', () => {
    // Only the @generated rules.d.ts, which GEN-001 needs to type-check a
    // Target's own ADR .rules.ts. The four the frontmatter ADRs needed are not
    // shipped: they still govern this repo, so they live under .archgate/ and
    // stay out of the bundle.
    expect(supportingFiles).toEqual(['rules.d.ts']);
  });

  it('pins the archgate version to the release that generated the committed rules.d.ts', () => {
    // Load-bearing, and not obviously so. `archgate check` regenerates
    // .archgate/rules.d.ts from the running binary's own type surface, and
    // `npm run capture` mirrors it into assets/core-bundle/. CI installs on a
    // cold cache, so this range decides which binary regenerates the file
    // there — and npm's caret pins the minor for 0.x, making `^0.55.0` mean
    // >=0.55.0 <0.56.0. Let this drift below the version that generated the
    // committed rules.d.ts and CI's capture-freshness guard goes red on a file
    // nobody edited.
    expect(ARCHGATE_VERSION).toBe('^0.55.0');
  });

  it('exposes the harness release version from package.json (the seed stamp source)', () => {
    // The seed stamps HARNESS_VERSION into .typescript-ai-harness.json; it must
    // track package.json (npm's source of truth), never a hand-copied literal.
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(HARNESS_VERSION).toBe(pkg.version);
  });

  it('exposes a single validated object for consumers', () => {
    expect(harnessConfig).toEqual({ ADR_CORE, supportingFiles, ARCHGATE_VERSION });
  });
});

describe('harness.config.json — publish surface', () => {
  it('is excluded from the published package (the files whitelist ships dist + the captured asset)', () => {
    // The build config is metadata: consumed by the capture step and baked into
    // dist, never shipped as a file. The whitelist ships the built bundle (dist)
    // and the captured Core bundle asset (assets, #47) — and nothing else.
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      files: string[];
    };
    expect(pkg.files).toEqual(['dist', 'assets']);
    expect(pkg.files).not.toContain('harness.config.json');
  });
});
