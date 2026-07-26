import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HARNESS_VERSION } from './harness-config';
import { run } from './run';
import type { Answers, Exec } from './types';

// The workhorse seam: run() against a temp dir with a stubbed exec, so tests
// assert the harness a target ends up with — files, package.json, invoked
// commands — never the internal Action[] shape (Testing Decisions).

let cwd: string;
let calls: { command: string; args: string[] }[];
let exec: Exec;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'harness-'));
  calls = [];
  exec = vi.fn(async (command: string, args: string[]) => {
    calls.push({ command, args });
  });
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

interface PkgShape {
  name: string;
  version?: string;
  dependencies?: Record<string, string>;
  scripts: Record<string, string>;
}

const read = (relative: string): string => readFileSync(join(cwd, relative), 'utf8');
const has = (relative: string): boolean => existsSync(join(cwd, relative));
const readPkg = (): PkgShape => JSON.parse(read('package.json')) as PkgShape;
const npmInstall = (): { command: string; args: string[] } | undefined =>
  calls.find((c) => c.command === 'npm' && c.args[0] === 'install');

const FULL: Answers = {
  integrations: ['archgate', 'eslint', 'prettier', 'vitest', 'husky'],
  eslint: { rules: ['complexity', 'max-lines-per-function', 'max-params', 'max-depth', 'max-lines'] },
  prettier: { importSort: 'organize-imports' },
  vitest: {},
  husky: { hooks: ['pre-commit', 'pre-push'] },
};

describe('run — materialized files', () => {
  it('writes each tool-owned config with the chosen sub-options injected', async () => {
    await run(FULL, { cwd, exec });

    const eslintConfig = read('eslint.config.mjs');
    expect(eslintConfig).toContain("import tseslint from 'typescript-eslint'");
    expect(eslintConfig).toContain('complexity');
    expect(eslintConfig).toContain('max-lines-per-function');

    const prettierConfig = JSON.parse(read('.prettierrc.json'));
    expect(prettierConfig.printWidth).toBe(120);
    expect(prettierConfig.plugins).toEqual(['prettier-plugin-organize-imports']);

    expect(JSON.parse(read('.lintstagedrc.json'))['*.ts']).toEqual(['eslint --fix', 'prettier --write']);
    expect(read('vitest.config.ts')).toContain("provider: 'v8'");
    expect(read('.husky/pre-commit')).toContain('verify:commit');
    expect(read('.husky/pre-push')).toContain('npm run verify');
    expect(has('.husky/commit-msg')).toBe(false); // deselected by default
    expect(has('tsconfig.json')).toBe(true);
    expect(read('.prettierignore')).toContain('coverage');
    expect(read('.gitignore')).toContain('node_modules/');
    expect(read('.gitignore')).toContain('.env');
    expect(read('.gitignore')).toContain('coverage/');
  });

  it('writes commit-msg hook only when selected', async () => {
    await run({ ...FULL, husky: { hooks: ['commit-msg'] } }, { cwd, exec });
    expect(read('.husky/commit-msg')).toContain('Conventional Commits');
    expect(has('.husky/pre-commit')).toBe(false);
  });
});

describe('run — package.json surgical merge', () => {
  it('sets the tool scripts and preserves everything else', async () => {
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({
        name: 'my-project',
        version: '1.2.3',
        dependencies: { left: '^1.0.0' },
        scripts: { start: 'node server.js' },
      }),
    );

    await run(FULL, { cwd, exec });
    const pkg = readPkg();

    expect(pkg.name).toBe('my-project');
    expect(pkg.version).toBe('1.2.3');
    expect(pkg.dependencies).toEqual({ left: '^1.0.0' });
    expect(pkg.scripts.start).toBe('node server.js');
    expect(pkg.scripts.verify).toBeDefined();
    expect(pkg.scripts['verify:commit']).toBeDefined();
    expect(pkg.scripts.prepare).toBe('husky');
    expect(pkg.scripts.format).toBe('prettier --write .');
    expect(pkg.scripts.test).toBe('vitest run');
  });

  it('auto-inits a minimal package.json when none exists', async () => {
    await run(FULL, { cwd, exec });
    const pkg = readPkg();
    expect(pkg.name).toBe(basename(cwd));
    expect(pkg.scripts.verify).toBeDefined();
  });
});

describe('run — cross-Integration composition', () => {
  it('verify / verify:commit contain only the selected Integrations', async () => {
    await run(
      {
        integrations: ['eslint', 'vitest', 'husky'],
        eslint: { rules: ['complexity'] },
        vitest: {},
        husky: { hooks: ['pre-commit', 'pre-push'] },
      },
      { cwd, exec },
    );
    const pkg = readPkg();
    expect(pkg.scripts.verify).toBe('eslint . && tsc --noEmit && vitest run');
    expect(pkg.scripts['verify:commit']).toBe('lint-staged && tsc --noEmit && vitest run');
  });

  it('appends eslint-config-prettier only when both eslint and prettier are selected', async () => {
    await run({ integrations: ['eslint'], eslint: { rules: ['complexity'] } }, { cwd, exec });
    expect(read('eslint.config.mjs')).not.toContain('eslint-config-prettier');
    expect(npmInstall()?.args).not.toContain('eslint-config-prettier');
  });

  it('adds eslint-config-prettier when both are present', async () => {
    await run(
      { integrations: ['eslint', 'prettier'], eslint: { rules: ['complexity'] }, prettier: { importSort: 'off' } },
      { cwd, exec },
    );
    const config = read('eslint.config.mjs');
    expect(config).toContain('eslintConfigPrettier');
    expect(npmInstall()?.args).toContain('eslint-config-prettier');
    // Imports must be in organize-imports order so a fresh target passes
    // prettier --check before its first format: @eslint/js < eslint-config-prettier < typescript-eslint.
    expect(config.indexOf("'eslint-config-prettier'")).toBeLessThan(config.indexOf("'typescript-eslint'"));
  });
});

describe('run — eslint rule injection', () => {
  it('injects only the selected clean-code rules', async () => {
    await run({ integrations: ['eslint'], eslint: { rules: ['complexity', 'max-depth'] } }, { cwd, exec });
    const config = read('eslint.config.mjs');
    // Assert the base tier (rules mapped to a value), not the test tier (which
    // always turns max-lines-per-function / max-lines 'off').
    expect(config).toContain("complexity: ['error', 7]");
    expect(config).toContain("'max-depth': ['error', 3]");
    expect(config).not.toContain('max-params');
    expect(config).not.toContain("'max-lines-per-function': ['error'");
  });
});

describe('run — external commands', () => {
  it('installs pinned archgate and never shells out to `archgate init` (v4 direct-write)', async () => {
    await run(FULL, { cwd, exec }); // no --yes → interactive

    const install = npmInstall();
    expect(install?.args).toEqual(expect.arrayContaining(['install', '--save-dev']));
    for (const dep of ['typescript', 'eslint', 'prettier', 'vitest', 'husky', 'lint-staged']) {
      expect(install?.args).toContain(dep);
    }
    // archgate is version-pinned, not installed bare/latest (US-14/15).
    expect(install?.args.some((a) => a.startsWith('archgate@'))).toBe(true);
    expect(install?.args).not.toContain('archgate');

    // v4 retired the `archgate init` shell-out; husky's `npx husky` is the only
    // run-command left, and install still precedes it (its binary must exist).
    const cmdLine = (c: { command: string; args: string[] }) => `${c.command} ${c.args.join(' ')}`;
    expect(calls.some((c) => cmdLine(c) === 'npx archgate init')).toBe(false);
    const huskyIdx = calls.findIndex((c) => cmdLine(c) === 'npx husky');
    expect(huskyIdx).toBeGreaterThanOrEqual(0);
    expect(calls.findIndex((c) => c.args[0] === 'install')).toBeLessThan(huskyIdx);
  });
});

// ADR-0005 v4: interactive and --yes emit the same Actions, so both are asserted
// against one identical set of expectations. The bundle is copied from this repo's
// committed assets/core-bundle asset (resolveBundleRoot always returns the asset,
// #48) — kept byte-equal to canonical by the freshness guard — so the target ends
// up with the real GEN-001/002/003 trios and .claude/rules symlinks, and each
// copyAsset.from points into the asset, not the live .archgate/.
describe.each([
  { label: 'interactive (no --yes)', yes: false },
  { label: 'headless (--yes)', yes: true },
])('run — archgate v4 unified direct-write · $label', ({ yes }) => {
  const CORE = ['GEN-001-adr', 'GEN-002-harness-config', 'GEN-003-frontmatter'];

  it('materialises each core ADR trio + supporting files under .archgate/, never shelling out', async () => {
    await run(FULL, { cwd, exec, yes });

    for (const id of CORE) {
      expect(has(`.archgate/adrs/${id}.md`)).toBe(true);
      expect(has(`.archgate/adrs/${id}.rules.ts`)).toBe(true);
      expect(has(`.archgate/adrs/${id}.rules.test.ts`)).toBe(true);
    }
    expect(has('.archgate/harness-config-core.d.ts')).toBe(true);
    expect(has('.archgate/harness-config-extension.d.ts')).toBe(true);
    expect(has('.archgate/harness-config-fixtures.ts')).toBe(true);
    // Neither mode invokes `archgate init` or passes `--editor` (editor fixed to claude).
    expect(calls.some((c) => c.args.includes('init'))).toBe(false);
    expect(calls.some((c) => c.args.includes('--editor'))).toBe(false);
  });

  it('links each ADR into .claude/rules/ as a REAL symlink, not a copied body (adr-claude-rules-symlink)', async () => {
    await run(FULL, { cwd, exec, yes });

    const link = join(cwd, '.claude/rules/gen-001-adr.md');
    expect(lstatSync(link).isSymbolicLink()).toBe(true); // a copy would invert archgate's rule
    expect(readlinkSync(link)).toBe('../../.archgate/adrs/GEN-001-adr.md'); // relative, stored verbatim
    expect(readFileSync(link, 'utf8')).toBe(read('.archgate/adrs/GEN-001-adr.md')); // resolves through
    // Lowercased basename, matching how the symlink is created and what archgate's
    // adr-claude-rules-symlink rule expects — uppercase here only passed on a
    // case-insensitive macOS FS and broke on case-sensitive Linux CI.
    for (const id of CORE) expect(has(`.claude/rules/${id.toLowerCase()}.md`)).toBe(true);
  });

  it('seeds config.json + Claude settings (write-if-absent) and the rules.d.ts ignore', async () => {
    await run(FULL, { cwd, exec, yes });

    const config = JSON.parse(read('.archgate/config.json'));
    expect(config.domains).toEqual({});
    expect(config.baseBranch).toBe('origin/main');

    const settings = JSON.parse(read('.claude/settings.local.json'));
    expect(settings.agent).toBe('archgate:developer');
    expect(settings.permissions.allow).toContain('Skill(archgate:adr-author)');

    expect(read('.gitignore')).toContain('.archgate/rules.d.ts');
  });

  it('seeds .typescript-ai-harness.json from GEN-003 default frontmatter + a version stamp', async () => {
    await run(FULL, { cwd, exec, yes });

    const harnessConfig = JSON.parse(read('.typescript-ai-harness.json'));
    // Stamped with the harness release (GEN-002 §1.4), not the target's version.
    expect(harnessConfig.version).toBe(HARNESS_VERSION);
    // The materialised block is GEN-003's built-in default, verbatim: unmatched
    // exempt + the four root-or-specific entries, so seeding is a behaviour no-op.
    const block = harnessConfig.markdown.frontmatter;
    expect(block.unmatched).toBe('exempt');
    expect(block.pathRules.flatMap((entry: { include: string[] }) => entry.include)).toEqual([
      '.archgate/adrs/*.md',
      'README.md',
      'AGENTS.md',
      'CLAUDE.md',
    ]);
  });

  it('retires the empty adrs/.gitkeep — the dir now holds real, governed ADRs', async () => {
    await run(FULL, { cwd, exec, yes });
    expect(has('.archgate/adrs/.gitkeep')).toBe(false);
    expect(readdirSync(join(cwd, '.archgate/adrs')).some((f) => f.endsWith('.md'))).toBe(true);
  });

  it('omits the parts archgate regenerates or the developer authors', async () => {
    await run(FULL, { cwd, exec, yes });
    expect(has('.archgate/rules.d.ts')).toBe(false); // @generated by `archgate check`
    expect(has('.archgate/lint')).toBe(false); // no doc-only placeholder dir
  });
});

describe('run — archgate not selected', () => {
  it('writes no .archgate/ or Claude settings', async () => {
    await run({ integrations: ['vitest'], vitest: {} }, { cwd, exec, yes: true });
    expect(has('.archgate')).toBe(false);
    expect(has('.claude/settings.local.json')).toBe(false);
  });
});

describe('run — dry run', () => {
  it('reports the plan but writes nothing and runs no command', async () => {
    const { actions } = await run(FULL, { cwd, exec, dryRun: true, yes: true });
    expect(actions.length).toBeGreaterThan(0);
    // The seed action IS in the previewed plan (dry-run *previews* it) …
    expect(actions.some((a) => a.kind === 'writeFile' && a.path === '.typescript-ai-harness.json')).toBe(true);
    expect(has('package.json')).toBe(false);
    expect(has('eslint.config.mjs')).toBe(false);
    expect(has('.archgate/config.json')).toBe(false);
    expect(has('.claude/settings.local.json')).toBe(false);
    expect(has('.typescript-ai-harness.json')).toBe(false); // … but nothing is written to disk
    expect(calls).toHaveLength(0);
  });
});

describe('run — idempotency', () => {
  it('a second run overwrites tool-owned files but leaves package.json unchanged', async () => {
    await run(FULL, { cwd, exec });
    const firstPkg = read('package.json');
    const firstEslint = read('eslint.config.mjs');

    await run(FULL, { cwd, exec });
    expect(read('package.json')).toBe(firstPkg);
    expect(read('eslint.config.mjs')).toBe(firstEslint);
  });

  it('preserves a user-added .prettierignore entry across re-runs (append-only)', async () => {
    writeFileSync(join(cwd, '.prettierignore'), 'my-secret/\n');
    await run(FULL, { cwd, exec });
    await run(FULL, { cwd, exec });
    const ignore = read('.prettierignore');
    expect(ignore).toContain('my-secret/'); // user entry never clobbered
    expect(ignore).toContain('coverage'); // tool entry appended once
    expect(ignore.match(/coverage/g)).toHaveLength(1); // not duplicated on re-run
  });

  it('preserves user-modified archgate seed files across re-runs (headless, seed-once)', async () => {
    await run(FULL, { cwd, exec, yes: true });
    // The Target project grows its governance workspace after scaffolding.
    const cfg = JSON.stringify({ domains: { ARCH: { adrs: ['ARCH-001'] } }, baseBranch: 'origin/develop' }, null, 2);
    const settings = JSON.stringify({ agent: 'my-own-agent' }, null, 2);
    const harnessCfg = JSON.stringify({ version: '9.9.9', markdown: {} }, null, 2);
    writeFileSync(join(cwd, '.archgate/config.json'), cfg);
    writeFileSync(join(cwd, '.claude/settings.local.json'), settings);
    writeFileSync(join(cwd, '.typescript-ai-harness.json'), harnessCfg);
    // A hand-edit to a Tool-owned bundle file, to prove the contrast: the seed
    // is left alone while the bundle IS overwritten on the same re-run.
    writeFileSync(join(cwd, '.archgate/adrs/GEN-001-adr.md'), 'CLOBBERED');

    await run(FULL, { cwd, exec, yes: true });
    expect(read('.archgate/config.json')).toBe(cfg); // never clobbered
    expect(read('.claude/settings.local.json')).toBe(settings);
    expect(read('.typescript-ai-harness.json')).toBe(harnessCfg); // Seeded: write-once
    expect(read('.archgate/adrs/GEN-001-adr.md')).not.toBe('CLOBBERED'); // Tool-owned: overwritten
  });
});
