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
  integrations: ['archgate', 'eslint', 'prettier', 'vitest', 'knip', 'husky', 'trivy'],
  eslint: { rules: ['complexity', 'max-lines-per-function', 'max-params', 'max-depth', 'max-lines'] },
  prettier: { importSort: 'organize-imports' },
  vitest: {},
  husky: { hooks: ['pre-commit', 'pre-push'] },
  knip: {},
  trivy: {},
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

describe('run — knip integration', () => {
  it('installs knip, writes knip.json, adds the script, and joins the verify chain', async () => {
    await run(FULL, { cwd, exec });
    expect(npmInstall()?.args).toContain('knip');
    expect(readPkg().scripts.knip).toBe('knip');
    // Composed by husky as a pre-push gate (not verify:commit, not lint-staged).
    expect(readPkg().scripts.verify).toContain('&& knip');
    expect(readPkg().scripts['verify:commit']).not.toContain('knip');
    // archgate is selected in FULL, so its executed-but-unimported rules files
    // are declared as entry points (ADR-0008 cross-Integration composition).
    const config = JSON.parse(read('knip.json'));
    expect(config.entry).toEqual(['.archgate/adrs/*.rules.ts']);
    expect(config.project).toContain('.archgate/**/*.ts');
    expect(config.ignoreExportsUsedInFile).toBe(true);
  });

  it('omits the archgate entry point when archgate is not selected', async () => {
    await run({ integrations: ['knip'], knip: {} }, { cwd, exec });
    const config = JSON.parse(read('knip.json'));
    expect(config.entry).toBeUndefined();
    expect(config.project).toEqual(['src/**/*.ts', '*.ts']);
  });
});

describe('run — trivy integration', () => {
  it('ships the security workflow as a CI-only scan (no dep, no script, not in verify)', async () => {
    await run(FULL, { cwd, exec });
    const workflow = read('.github/workflows/security.yml');
    expect(workflow).toContain('aquasecurity/trivy-action');
    expect(workflow).toContain('scan-type: fs');
    // trivy is a standalone binary, not an npm package, and stays out of verify.
    expect(npmInstall()?.args).not.toContain('trivy');
    expect(readPkg().scripts.trivy).toBeUndefined();
    expect(readPkg().scripts.verify).not.toContain('trivy');
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
// up with the real GEN-001 trio and its .claude/rules symlink, and each
// copyAsset.from points into the asset, not the live .archgate/.
describe.each([
  { label: 'interactive (no --yes)', yes: false },
  { label: 'headless (--yes)', yes: true },
])('run — archgate v4 unified direct-write · $label', ({ yes }) => {
  const CORE = ['GEN-001-adr'];

  it('materialises each core ADR trio + supporting files under .archgate/, never invoking archgate init', async () => {
    await run(FULL, { cwd, exec, yes });

    for (const id of CORE) {
      expect(has(`.archgate/adrs/${id}.md`)).toBe(true);
      expect(has(`.archgate/adrs/${id}.rules.ts`)).toBe(true);
      expect(has(`.archgate/adrs/${id}.rules.test.ts`)).toBe(true);
    }
    expect(has('.archgate/rules.d.ts')).toBe(true); // @generated types, seeded so the Target type-checks its own ADRs
    // The withdrawal's negative control. GEN-002-harness-config and
    // GEN-003-frontmatter are deleted, and so are the four supporting files they
    // needed — but a stale copyAsset or a resurrected asset would put one back
    // without failing any assertion above, and GEN-002-harness-config in
    // particular would collide with GEN-002-adr-symlink-claude-rules on its id
    // and kill archgate outright. So the absences are asserted, not implied.
    for (const id of ['GEN-002-harness-config', 'GEN-003-frontmatter']) {
      expect(has(`.archgate/adrs/${id}.md`)).toBe(false);
      expect(has(`.claude/rules/${id.toLowerCase()}.md`)).toBe(false);
    }
    for (const file of [
      'harness-config-core.d.ts',
      'harness-config-extension.d.ts',
      'harness-config-fixtures.ts',
      'frontmatter-config.md',
    ]) {
      expect(has(`.archgate/${file}`)).toBe(false);
    }
    // Neither mode invokes `archgate init` or passes `--editor` (editor fixed to
    // claude). The only bare `init` shell-out is `git init` (archgate needs a
    // work tree), so match the archgate command specifically, not any `init` arg.
    expect(calls.some((c) => `${c.command} ${c.args.join(' ')}`.includes('archgate init'))).toBe(false);
    expect(calls.some((c) => c.args.includes('--editor'))).toBe(false);
  });

  it('links each ADR into .claude/rules/ as a REAL symlink, not a copied body (adr-claude-rules-symlink)', async () => {
    await run(FULL, { cwd, exec, yes });

    const link = join(cwd, '.claude/rules/gen-001-adr.md');
    expect(lstatSync(link).isSymbolicLink()).toBe(true); // the only real symlink check left — archgate's reader resolves symlinks, so its rule cannot tell a copy from a pointer
    expect(readlinkSync(link)).toBe('../../.archgate/adrs/GEN-001-adr.md'); // relative, stored verbatim
    expect(readFileSync(link, 'utf8')).toBe(read('.archgate/adrs/GEN-001-adr.md')); // resolves through
    // Lowercased basename, matching how the symlink is created and what archgate's
    // adr-claude-rules-symlink rule expects — uppercase here only passed on a
    // case-insensitive macOS FS and broke on case-sensitive Linux CI.
    for (const id of CORE) expect(has(`.claude/rules/${id.toLowerCase()}.md`)).toBe(true);
  });

  it('seeds config.json + Claude settings (write-if-absent), and writes no rules.d.ts ignore', async () => {
    await run(FULL, { cwd, exec, yes });

    const config = JSON.parse(read('.archgate/config.json'));
    expect(config.domains).toEqual({});
    expect(config.baseBranch).toBe('origin/main');

    const settings = JSON.parse(read('.claude/settings.local.json'));
    expect(settings.agent).toBe('archgate:developer');
    expect(settings.permissions.allow).toContain('Skill(archgate:adr-author)');

    // rules.d.ts is now a committed, seeded supporting file (ADR-0005 v5), so the
    // integration no longer appends a .gitignore entry for it...
    expect(read('.gitignore')).not.toContain('.archgate/rules.d.ts');
    // ...instead it appends the file to .prettierignore, since the @generated copy
    // does not conform to the seeded prettier style and must not be reformatted.
    expect(read('.prettierignore')).toContain('.archgate/rules.d.ts');
  });

  it('writes no .typescript-ai-harness.json — the config it configured no longer ships', async () => {
    await run(FULL, { cwd, exec, yes });
    expect(has('.typescript-ai-harness.json')).toBe(false);
  });

  it('retires the empty adrs/.gitkeep — the dir now holds real, governed ADRs', async () => {
    await run(FULL, { cwd, exec, yes });
    expect(has('.archgate/adrs/.gitkeep')).toBe(false);
    expect(readdirSync(join(cwd, '.archgate/adrs')).some((f) => f.endsWith('.md'))).toBe(true);
  });

  it('omits the lint placeholder — a doc-only dir the bundle never seeds', async () => {
    await run(FULL, { cwd, exec, yes });
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
    // The seed action is gone from the plan itself, not merely unwritten — a
    // dry run previews every writeFile, so this would still be true if the
    // action survived and only the disk write were suppressed.
    expect(actions.some((a) => a.kind === 'writeFile' && a.path === '.typescript-ai-harness.json')).toBe(false);
    expect(has('package.json')).toBe(false);
    expect(has('eslint.config.mjs')).toBe(false);
    expect(has('.archgate/config.json')).toBe(false);
    expect(has('.claude/settings.local.json')).toBe(false); // … and nothing is written to disk
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
    // A hand-edit to a Tool-owned bundle file, to prove the contrast: the seed
    // is left alone while the bundle IS overwritten on the same re-run.
    writeFileSync(join(cwd, '.archgate/adrs/GEN-001-adr.md'), 'CLOBBERED');

    await run(FULL, { cwd, exec, yes: true });
    expect(read('.archgate/config.json')).toBe(cfg); // never clobbered
    expect(read('.claude/settings.local.json')).toBe(settings); // Seeded: write-once
    expect(read('.archgate/adrs/GEN-001-adr.md')).not.toBe('CLOBBERED'); // Tool-owned: overwritten
  });
});
