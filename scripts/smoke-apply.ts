// Real-apply foreign-target smoke — the regression guard for the class of
// breakage that shipped in 0.1.1: a fresh install whose `archgate check` fails
// even though the install succeeded. The dry-run `smoke.ts` never applies and
// this repo's own `archgate check` always runs inside a git tree with a matching
// version, so neither sees the foreign-target path. This one does: it applies the
// real plan into a throwaway NON-git dir carrying a foreign `package.json`, then
// runs `archgate check` against it and asserts a clean report.
//
// The clean report alone cannot tell a live floor from a dead one — a silently
// disabled floor is *also* clean (issue #71). So after the baseline the smoke
// seeds a deliberately non-conformant governed file and asserts `archgate check`
// now FAILS, proving GEN-003's frontmatter floor actually governs a foreign
// Target and did not skip it on a false version skew.
//
// `exec` runs `git` for real (so the auto-init actually creates the `.git` that
// makes archgate surface the `.claude/rules` symlinks) but no-ops the toolchain
// install and husky — `archgate check` needs neither, and skipping them keeps the
// smoke offline, fast, and deterministic. archgate check runs from THIS repo's
// pinned binary against the temp dir, so the Target needs nothing installed.
// Repo-local release tooling — never shipped into Target projects (ADR-0003).
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registry } from '../src/integrations/registry';
import { run } from '../src/run';
import type { Exec } from '../src/types';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHGATE = join(REPO, 'node_modules', '.bin', 'archgate');
const CORE_LINKS = ['gen-001-adr.md', 'gen-002-harness-config.md', 'gen-003-frontmatter.md'];

// Real git, no-op everything else — see the header.
const exec: Exec = async (command, args, { cwd }) => {
  if (command !== 'git') return;
  const result = spawnSync(command, args, { cwd, stdio: 'ignore' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} exited with ${result.status ?? 'a signal'}`);
};

function fail(message: string): never {
  console.error(`✗ smoke-apply: ${message}`);
  process.exit(1);
}

// A foreign Target: package.json names the app (not the harness) at 0.0.0 — the
// exact config-version case that used to false-fail on a fresh install.
function seedForeignTarget(cwd: string): void {
  const pkg = { name: 'harness-apply-smoke-target', version: '0.0.0', private: true };
  writeFileSync(join(cwd, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
}

// (a) the non-git Target was given a work tree; (b) each ADR is a real symlink.
function assertMaterialised(cwd: string): void {
  if (!existsSync(join(cwd, '.git'))) fail('CLI did not initialise a git repository in a non-git Target');
  for (const link of CORE_LINKS) {
    const path = join(cwd, '.claude/rules', link);
    if (!existsSync(path) || !lstatSync(path).isSymbolicLink()) fail(`missing runtime symlink .claude/rules/${link}`);
  }
}

// (c) the load-bearing assertion: this repo's pinned archgate binary reports a
// clean check against the Target. The exit code is the signal — non-zero on any
// error-tier violation (it is what rejects a release commit), zero when clean —
// so we do not parse stdout, whose shape shifts with archgate's optional perf
// `warn:` lines that a slower runner emits ahead of the JSON.
function assertArchgateClean(cwd: string): void {
  const check = spawnSync(ARCHGATE, ['check'], { cwd, encoding: 'utf8' });
  if (check.status !== 0) {
    fail(
      `archgate check failed in a fresh foreign Target — the shipped bug (exit ${check.status ?? 'signal'}):\n` +
        `${check.stdout}\n${check.stderr}`,
    );
  }
}

// (d) the negative control: README.md carries a docs-typed entry in the seeded
// default, so one with no frontmatter is a frontmatter-floor violation. Seeding
// it AFTER the clean baseline turns the smoke into a live test of the floor — a
// disabled floor (issue #71) would leave the check green here too.
function seedNonConformant(cwd: string): void {
  writeFileSync(join(cwd, 'README.md'), '# No frontmatter — the frontmatter floor must reject this.\n');
}

// The load-bearing negative assertion: with a non-conformant governed file
// present, archgate check MUST now fail (non-zero exit — the same exit-code
// signal assertArchgateClean reads, not stdout). A clean report here would prove
// the floor is silently dead on a foreign Target.
function assertArchgateFails(cwd: string): void {
  const check = spawnSync(ARCHGATE, ['check'], { cwd, encoding: 'utf8' });
  if (check.status === 0) {
    fail(
      'archgate check passed on a foreign Target carrying an unfrontmattered README.md — ' +
        'the frontmatter floor is silently disabled (issue #71).',
    );
  }
}

async function main(): Promise<void> {
  const cwd = mkdtempSync(join(tmpdir(), 'harness-apply-smoke-'));
  try {
    seedForeignTarget(cwd);
    await run({ integrations: registry.map((integration) => integration.id) }, { cwd, exec, yes: true });
    assertMaterialised(cwd);
    assertArchgateClean(cwd);
    seedNonConformant(cwd);
    assertArchgateFails(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
  console.log(
    '✓ smoke-apply: fresh non-git foreign Target — git inited, ADRs symlinked, archgate check clean, ' +
      'and the frontmatter floor rejects a non-conformant governed file (live on a foreign Target).',
  );
}

main();
