import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adrTrio, captureBundle, projectRootOf, readBundleLayout, resolveBundleRoot, selectBundleRoot } from './bundle';

// The bundle module is the seam #47 must make verifiable on its own: the
// dev-vs-shipped root choice, the per-ADR trio discovery, and the byte-faithful
// capture — all driven directly, against real temp dirs where IO is involved.

describe('projectRootOf', () => {
  it('returns the directory two levels above the module (which sits one level under the root)', () => {
    expect(projectRootOf('file:///repo/src/bundle.ts')).toBe('/repo');
    expect(projectRootOf('file:///pkg/dist/cli.mjs')).toBe('/pkg');
  });
});

describe('selectBundleRoot — always the committed asset (#48 always-overwrite)', () => {
  it('returns the assets/core-bundle root and never probes the filesystem, so a live .archgate/ is never chosen (dev, self-apply, published install alike)', () => {
    // The install reads the committed asset in every context, so self-apply runs
    // the same real cpSync(force) overwrite a foreign Target does — no
    // canonical-vs-asset branch, no skip. .archgate/ is the authoring workspace,
    // not what the install reads (ADR-0010 §1 v2). The function takes no `exists`
    // probe, so ".archgate/ present" is structurally unrepresentable, not a
    // second case to assert.
    const root = '/proj';
    expect(selectBundleRoot(root)).toBe(join(root, 'assets', 'core-bundle'));
  });
});

describe('resolveBundleRoot — resolves the committed asset in dev, self-apply, and published installs alike', () => {
  it('returns a real assets/core-bundle root that actually holds the adrs/ tree', () => {
    const root = resolveBundleRoot();
    expect(root.endsWith(join('assets', 'core-bundle'))).toBe(true);
    expect(existsSync(join(root, 'adrs'))).toBe(true);
  });
});

describe('adrTrio', () => {
  const listing = [
    'GEN-001-adr.md',
    'GEN-001-adr.rules.ts',
    'GEN-001-adr.rules.test.ts',
    'GEN-002-harness-config.md',
    'GEN-002-harness-config.rules.ts',
    'GEN-002-harness-config.rules.test.ts',
  ];

  it('returns exactly the .md + .rules.ts + .rules.test.ts for one id, ignoring other ids', () => {
    expect(adrTrio('GEN-001', listing)).toEqual([
      'GEN-001-adr.md',
      'GEN-001-adr.rules.ts',
      'GEN-001-adr.rules.test.ts',
    ]);
  });

  it('does not confuse a prefix neighbour (GEN-001 vs a hypothetical GEN-0010)', () => {
    expect(adrTrio('GEN-001', [...listing, 'GEN-0010-other.md'])).toHaveLength(3);
  });

  it('throws loudly when the trio is incomplete — a half-authored ADR must not ship', () => {
    expect(() => adrTrio('GEN-001', ['GEN-001-adr.md', 'GEN-001-adr.rules.ts'])).toThrow(/GEN-001/);
  });

  it('throws when the id is absent from the listing', () => {
    expect(() => adrTrio('GEN-404', listing)).toThrow(/GEN-404/);
  });
});

describe('readBundleLayout', () => {
  let root: string;
  const trio = (slug: string): string[] => [`${slug}.md`, `${slug}.rules.ts`, `${slug}.rules.test.ts`];
  const seed = (...files: string[]): void => {
    const adrs = join(root, 'adrs');
    mkdirSync(adrs, { recursive: true });
    for (const file of files) writeFileSync(join(adrs, file), '');
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'harness-layout-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('enumerates each core ADR trio (adrs/-relative, forward-slash) then the supporting files', () => {
    seed(...trio('GEN-001-adr'), ...trio('GEN-002-harness-config'));
    writeFileSync(join(root, 'support.d.ts'), '');

    const { files } = readBundleLayout(root, ['GEN-001', 'GEN-002'], ['support.d.ts']);

    expect(files).toEqual([
      'adrs/GEN-001-adr.md',
      'adrs/GEN-001-adr.rules.ts',
      'adrs/GEN-001-adr.rules.test.ts',
      'adrs/GEN-002-harness-config.md',
      'adrs/GEN-002-harness-config.rules.ts',
      'adrs/GEN-002-harness-config.rules.test.ts',
      'support.d.ts',
    ]);
  });

  it('exposes each core ADR .md basename for the .claude/rules symlinks, in ADR_CORE order', () => {
    seed(...trio('GEN-001-adr'), ...trio('GEN-002-harness-config'));

    const { adrDocs } = readBundleLayout(root, ['GEN-002', 'GEN-001'], []);

    expect(adrDocs).toEqual(['GEN-002-harness-config.md', 'GEN-001-adr.md']);
  });

  it('enumerates from the explicit ADR_CORE list, not whatever sits in adrs/ (no leakage, ADR-0010 §2)', () => {
    seed(...trio('GEN-001-adr'), ...trio('GEN-999-stray'));

    const { files, adrDocs } = readBundleLayout(root, ['GEN-001'], []);

    expect(files).toEqual(['adrs/GEN-001-adr.md', 'adrs/GEN-001-adr.rules.ts', 'adrs/GEN-001-adr.rules.test.ts']);
    expect(adrDocs).toEqual(['GEN-001-adr.md']);
  });

  it('propagates the loud trio failure when a core member is missing', () => {
    seed('GEN-001-adr.md'); // trio incomplete — only the .md, no rules siblings

    expect(() => readBundleLayout(root, ['GEN-001'], [])).toThrow(/GEN-001/);
  });
});

describe('captureBundle — stages a byte-faithful, Tool-owned mirror', () => {
  let canonical: string;
  let assetRoot: string;

  const seedTrio = (id: string, slug: string): void => {
    const adrs = join(canonical, 'adrs');
    mkdirSync(adrs, { recursive: true });
    writeFileSync(join(adrs, `${id}-${slug}.md`), `# ${id}`);
    writeFileSync(join(adrs, `${id}-${slug}.rules.ts`), `export default { id: '${id}' };`);
    writeFileSync(join(adrs, `${id}-${slug}.rules.test.ts`), `test('${id}', () => {});`);
  };

  beforeEach(() => {
    canonical = mkdtempSync(join(tmpdir(), 'harness-canonical-'));
    assetRoot = mkdtempSync(join(tmpdir(), 'harness-asset-'));
  });

  afterEach(() => {
    rmSync(canonical, { recursive: true, force: true });
    rmSync(assetRoot, { recursive: true, force: true });
  });

  it('copies each core ADR trio and every supporting file, byte for byte', () => {
    seedTrio('GEN-001', 'adr');
    writeFileSync(join(canonical, 'support.d.ts'), 'declare const x: number;');

    const written = captureBundle({ canonical, assetRoot, core: ['GEN-001'], supporting: ['support.d.ts'] });

    expect(written).toHaveLength(4); // trio (3) + one supporting file
    expect(readFileSync(join(assetRoot, 'adrs', 'GEN-001-adr.md'), 'utf8')).toBe('# GEN-001');
    expect(readFileSync(join(assetRoot, 'adrs', 'GEN-001-adr.rules.ts'), 'utf8')).toBe(
      "export default { id: 'GEN-001' };",
    );
    expect(readFileSync(join(assetRoot, 'adrs', 'GEN-001-adr.rules.test.ts'), 'utf8')).toBe(
      "test('GEN-001', () => {});",
    );
    expect(readFileSync(join(assetRoot, 'support.d.ts'), 'utf8')).toBe('declare const x: number;');
  });

  it('is a full rebuild: a stale file left in the asset from a prior capture is gone (Tool-owned, ADR-0010 §4)', () => {
    seedTrio('GEN-001', 'adr');
    mkdirSync(join(assetRoot, 'adrs'), { recursive: true });
    writeFileSync(join(assetRoot, 'adrs', 'GEN-999-dropped.md'), 'a member removed from ADR_CORE');

    captureBundle({ canonical, assetRoot, core: ['GEN-001'], supporting: [] });

    expect(existsSync(join(assetRoot, 'adrs', 'GEN-999-dropped.md'))).toBe(false);
    expect(existsSync(join(assetRoot, 'adrs', 'GEN-001-adr.md'))).toBe(true);
  });

  it('re-running is idempotent — a second capture reproduces byte-identical output', () => {
    seedTrio('GEN-001', 'adr');
    captureBundle({ canonical, assetRoot, core: ['GEN-001'], supporting: [] });
    const first = readFileSync(join(assetRoot, 'adrs', 'GEN-001-adr.md'), 'utf8');

    captureBundle({ canonical, assetRoot, core: ['GEN-001'], supporting: [] });

    expect(readFileSync(join(assetRoot, 'adrs', 'GEN-001-adr.md'), 'utf8')).toBe(first);
  });

  it('propagates the loud trio failure so a broken ADR_CORE aborts the capture', () => {
    seedTrio('GEN-001', 'adr');
    rmSync(join(canonical, 'adrs', 'GEN-001-adr.rules.test.ts'));

    expect(() => captureBundle({ canonical, assetRoot, core: ['GEN-001'], supporting: [] })).toThrow(/GEN-001/);
  });
});
