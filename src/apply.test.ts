import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apply } from './apply';
import { summarize } from './summary';
import type { Action, Exec } from './types';

// Mock node:fs so only symlinkSync is overridable per-test (it delegates to the
// real implementation by default); every other fs call stays real. This lets one
// test force the exact symlinkSync failure the acceptance criterion names — the
// Windows-without-Developer-Mode EPERM (deferred, #4) — which cannot be provoked
// on POSIX without elevated-permission trickery.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, symlinkSync: vi.fn(actual.symlinkSync) };
});

// apply() is the single IO chokepoint (ADR-0004). These tests drive it directly
// with the two new Action kinds against real temp dirs — the slice #46 must make
// verifiable on its own, with no integration and no captured asset behind it.

let cwd: string; // the Target
let asset: string; // a stand-in for the CLI's bundled asset (an arbitrary fixture dir)
let exec: Exec;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'harness-target-'));
  asset = mkdtempSync(join(tmpdir(), 'harness-asset-'));
  exec = vi.fn(async () => undefined);
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
  rmSync(asset, { recursive: true, force: true });
});

const run = (actions: Action[], dryRun = false): Promise<void> => apply(actions, { cwd, exec, dryRun });
const abs = (relative: string): string => join(cwd, relative);

describe('apply — copyAsset', () => {
  it('recursively copies a file tree into the Target', async () => {
    mkdirSync(join(asset, 'adrs'), { recursive: true });
    writeFileSync(join(asset, 'adrs', 'GEN-001.md'), '# one');
    writeFileSync(join(asset, 'top.txt'), 'top');

    await run([{ kind: 'copyAsset', from: asset, to: '.archgate' }]);

    expect(readFileSync(abs('.archgate/adrs/GEN-001.md'), 'utf8')).toBe('# one');
    expect(readFileSync(abs('.archgate/top.txt'), 'utf8')).toBe('top');
  });

  it('overwrites an existing file on re-run (Tool-owned bundle, ADR-0010 §4)', async () => {
    writeFileSync(join(asset, 'f.txt'), 'fresh');
    mkdirSync(abs('bundle'), { recursive: true });
    writeFileSync(abs('bundle/f.txt'), 'stale');

    await run([{ kind: 'copyAsset', from: asset, to: 'bundle' }]);

    expect(readFileSync(abs('bundle/f.txt'), 'utf8')).toBe('fresh');
  });

  it('runs the real overwrite on a self-apply-shaped action (from asset → to .archgate, #48)', async () => {
    // Self-apply now reads the committed asset (assets/core-bundle), never the
    // live canonical .archgate/, so `from` and `to` are always distinct paths and
    // the same cpSync(force) a foreign Target runs executes here too — no skip
    // (ADR-0010 §1/§4 v2). The freshness guard keeps the asset byte-equal to
    // canonical, so on a committed state this overwrite is a clean no-op diff;
    // here the bytes differ to prove the copy actually happened.
    mkdirSync(join(asset, 'core-bundle', 'adrs'), { recursive: true });
    writeFileSync(join(asset, 'core-bundle', 'adrs', 'GEN-001.md'), '# from asset');
    mkdirSync(abs('.archgate/adrs'), { recursive: true });
    writeFileSync(abs('.archgate/adrs/GEN-001.md'), '# stale canonical');

    await run([
      { kind: 'copyAsset', from: join(asset, 'core-bundle', 'adrs', 'GEN-001.md'), to: '.archgate/adrs/GEN-001.md' },
    ]);

    expect(readFileSync(abs('.archgate/adrs/GEN-001.md'), 'utf8')).toBe('# from asset'); // overwritten
  });
});

describe('apply — symlink', () => {
  const linkAction: Action = {
    kind: 'symlink',
    path: '.claude/rules/GEN-001.md',
    target: '../../.archgate/adrs/GEN-001.md',
  };

  const seedCanonical = (): void => {
    mkdirSync(abs('.archgate/adrs'), { recursive: true });
    writeFileSync(abs('.archgate/adrs/GEN-001.md'), '# canonical');
  };

  it('creates a REAL relative symlink, not a copied file', async () => {
    seedCanonical();

    await run([linkAction]);

    const link = abs('.claude/rules/GEN-001.md');
    expect(lstatSync(link).isSymbolicLink()).toBe(true); // a real symlink, per the acceptance criterion
    expect(readlinkSync(link)).toBe('../../.archgate/adrs/GEN-001.md'); // relative, stored verbatim
    expect(readFileSync(link, 'utf8')).toBe('# canonical'); // resolves through to the canonical ADR
  });

  it('is idempotent — a re-run replaces the link without EEXIST', async () => {
    seedCanonical();

    await run([linkAction]);
    await expect(run([linkAction])).resolves.toBeUndefined();

    expect(lstatSync(abs('.claude/rules/GEN-001.md')).isSymbolicLink()).toBe(true);
  });

  it('replaces a stale regular file at the link path with a symlink', async () => {
    seedCanonical();
    mkdirSync(abs('.claude/rules'), { recursive: true });
    writeFileSync(abs('.claude/rules/GEN-001.md'), 'stale copied body'); // a wrong, real file from a prior state

    await run([linkAction]);

    expect(lstatSync(abs('.claude/rules/GEN-001.md')).isSymbolicLink()).toBe(true);
  });

  it('fails loudly when symlinkSync itself errors (e.g. Windows w/o Developer Mode), never copying instead', async () => {
    seedCanonical();
    const eperm = Object.assign(new Error('operation not permitted, symlink'), { code: 'EPERM' });
    vi.mocked(symlinkSync).mockImplementationOnce(() => {
      throw eperm;
    });

    await expect(run([linkAction])).rejects.toThrow(/symlink .* failed/i);

    // The real symlink-creation branch failed, and there is no copied-body
    // fallback: the link path holds nothing (a copy would invert archgate's rule).
    expect(existsSync(abs('.claude/rules/GEN-001.md'))).toBe(false);
  });

  it('aborts loudly when the link directory cannot be created, leaving no fallback file', async () => {
    // A creation-precondition failure (not symlinkSync itself): the link's parent
    // is a FILE, so its containing directory cannot be made. Still a loud reject
    // with no silent copied-body fallback.
    writeFileSync(abs('blocker'), 'i am a file');

    await expect(run([{ kind: 'symlink', path: 'blocker/GEN-001.md', target: '../x.md' }])).rejects.toThrow(
      /symlink .* failed/i,
    );

    expect(existsSync(abs('blocker/GEN-001.md'))).toBe(false); // no fallback file was written
    expect(readFileSync(abs('blocker'), 'utf8')).toBe('i am a file'); // nothing was clobbered
  });
});

describe('apply — ensureGitRepo', () => {
  it('inits a git repo when the Target is not inside one (archgate needs a work tree)', async () => {
    // The fresh temp Target has no enclosing repo, so the very first step inits one
    // before any file is written — otherwise archgate cannot see the symlinks.
    await run([]);

    expect(exec).toHaveBeenCalledWith('git', ['init', '--quiet'], { cwd });
  });

  it('skips git init when the Target is already inside a work tree', async () => {
    mkdirSync(abs('.git')); // pretend cwd is a repo root

    await run([]);

    expect(exec).not.toHaveBeenCalledWith('git', ['init', '--quiet'], { cwd });
  });

  it('does not init under --dry-run — it only previews the intent', async () => {
    await run([], true);

    expect(exec).not.toHaveBeenCalled();
    expect(existsSync(abs('.git'))).toBe(false);
  });
});

describe('apply — dry-run touches nothing', () => {
  it('previews copyAsset and symlink but writes neither', async () => {
    writeFileSync(join(asset, 'f.txt'), 'x');
    const actions: Action[] = [
      { kind: 'copyAsset', from: asset, to: 'bundle' },
      { kind: 'symlink', path: '.claude/rules/GEN-001.md', target: '../../.archgate/adrs/GEN-001.md' },
    ];

    await run(actions, true);

    expect(existsSync(abs('bundle'))).toBe(false);
    expect(existsSync(abs('.claude/rules/GEN-001.md'))).toBe(false);

    // ...but both are still described for the preview.
    const lines = summarize(actions);
    expect(lines.some((line) => line.includes('bundle'))).toBe(true);
    expect(lines.some((line) => line.includes('.claude/rules/GEN-001.md'))).toBe(true);
  });
});
