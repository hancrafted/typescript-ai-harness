import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  it('installs pinned archgate before the run-commands, ordered archgate init then husky (interactive)', async () => {
    await run(FULL, { cwd, exec }); // no --yes → interactive

    const install = npmInstall();
    expect(install?.args).toEqual(expect.arrayContaining(['install', '--save-dev']));
    for (const dep of ['typescript', 'eslint', 'prettier', 'vitest', 'husky', 'lint-staged']) {
      expect(install?.args).toContain(dep);
    }
    // archgate is version-pinned, not installed bare/latest (US-14/15).
    expect(install?.args.some((a) => a.startsWith('archgate@'))).toBe(true);
    expect(install?.args).not.toContain('archgate');

    const cmdLine = (c: { command: string; args: string[] }) => `${c.command} ${c.args.join(' ')}`;
    const archgateIdx = calls.findIndex((c) => cmdLine(c) === 'npx archgate init');
    const huskyIdx = calls.findIndex((c) => cmdLine(c) === 'npx husky');
    expect(archgateIdx).toBeGreaterThanOrEqual(0);
    expect(huskyIdx).toBeGreaterThan(archgateIdx);
    // install precedes the run-commands (their binaries must exist first).
    expect(calls.findIndex((c) => c.args[0] === 'install')).toBeLessThan(archgateIdx);
  });
});

describe('run — archgate interactive (no --yes)', () => {
  it('shells out to bare `archgate init` and direct-writes nothing itself', async () => {
    await run(FULL, { cwd, exec });
    // Interactive: archgate owns onboarding via its own init; the tool writes no
    // snapshot files (with a stubbed exec, init is a no-op, so none appear).
    expect(calls.some((c) => `${c.command} ${c.args.join(' ')}` === 'npx archgate init')).toBe(true);
    expect(has('.archgate/config.json')).toBe(false);
    expect(has('.claude/settings.local.json')).toBe(false);
    expect(has('.archgate/adrs/.gitkeep')).toBe(false);
    // No `--editor`: archgate drives its own editor prompt.
    expect(calls.some((c) => c.args.includes('--editor'))).toBe(false);
  });
});

describe('run — archgate headless direct-write (--yes)', () => {
  it('seeds config, Claude settings, and the rules.d.ts ignore, never shelling out', async () => {
    await run(FULL, { cwd, exec, yes: true });

    const config = JSON.parse(read('.archgate/config.json'));
    expect(config.domains).toEqual({});
    expect(config.baseBranch).toBe('origin/main');

    const settings = JSON.parse(read('.claude/settings.local.json'));
    expect(settings.agent).toBe('archgate:developer');
    expect(settings.permissions.allow).toContain('Skill(archgate:adr-author)');

    expect(read('.gitignore')).toContain('.archgate/rules.d.ts');
    // Headless never invokes `archgate init`.
    expect(calls.some((c) => c.args.includes('init'))).toBe(false);
  });

  it('seeds an empty adrs/ dir (valid workspace) without an example ADR', async () => {
    await run(FULL, { cwd, exec, yes: true });
    // The adrs/ dir must exist — `archgate check` keys off it, not config.json —
    // but starts clean: a .gitkeep, no ADR content (US-9, US-16).
    expect(has('.archgate/adrs/.gitkeep')).toBe(true);
    expect(readdirSync(join(cwd, '.archgate/adrs')).some((f) => f.endsWith('.md'))).toBe(false);
  });

  it('omits the parts archgate regenerates or the developer authors', async () => {
    await run(FULL, { cwd, exec, yes: true });
    expect(has('.archgate/rules.d.ts')).toBe(false); // @generated by `archgate check`
    expect(has('.archgate/lint')).toBe(false); // no doc-only placeholder dir
  });

  it('writes no .archgate/ or Claude settings when archgate is not selected', async () => {
    await run({ integrations: ['vitest'], vitest: {} }, { cwd, exec, yes: true });
    expect(has('.archgate')).toBe(false);
    expect(has('.claude/settings.local.json')).toBe(false);
  });
});

describe('run — dry run', () => {
  it('reports the plan but writes nothing and runs no command', async () => {
    const { actions } = await run(FULL, { cwd, exec, dryRun: true, yes: true });
    expect(actions.length).toBeGreaterThan(0);
    expect(has('package.json')).toBe(false);
    expect(has('eslint.config.mjs')).toBe(false);
    expect(has('.archgate/config.json')).toBe(false);
    expect(has('.claude/settings.local.json')).toBe(false);
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
    writeFileSync(join(cwd, '.archgate/config.json'), cfg);
    writeFileSync(join(cwd, '.claude/settings.local.json'), settings);

    await run(FULL, { cwd, exec, yes: true });
    expect(read('.archgate/config.json')).toBe(cfg); // never clobbered
    expect(read('.claude/settings.local.json')).toBe(settings);
  });
});
