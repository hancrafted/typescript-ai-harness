// Seam 2 — built-bundle boot-smoke (Testing Decisions, ADR-0009). Spawns the
// *published artifact* — dist/cli.mjs, executed directly so its shebang and
// executable bit are exercised — with `--dry-run --yes` in a throwaway working
// directory, then asserts a clean exit and a coherent plan preview. `--dry-run`
// routes through the preview-only path, which never calls apply: no filesystem
// mutation, no Integration run-commands (not even `archgate init`), no network —
// so the smoke is deterministic and hang-free. This is the only check that
// exercises the bundle rather than source; a bad entry, a dropped import, or a
// broken shebang surfaces here instead of at publish time. Repo-local release
// tooling — never shipped into Target projects (ADR-0003).
//
// Runs *after* `npm run build` (see ci.yml), so it lives outside `npm run
// verify` and outside the default `vitest run` include.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.mjs');

interface BinResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function fail(message: string): never {
  console.error(`✗ boot-smoke: ${message}`);
  process.exit(1);
}

function runBin(cwd: string): BinResult {
  // 30s ceiling: the --dry-run path finishes in well under a second, so a timeout
  // means the bundle hung (e.g. a regression reintroduced a prompt) — fail fast
  // in CI rather than block the job.
  const result = spawnSync(BIN, ['--dry-run', '--yes'], { cwd, encoding: 'utf8', timeout: 30_000 });
  if (result.error) {
    const missing = (result.error as NodeJS.ErrnoException).code === 'ENOENT';
    fail(`could not run ${BIN} — ${result.error.message}${missing ? ' (did you run `npm run build`?)' : ''}`);
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function assertClean(result: BinResult, cwd: string): void {
  if (result.status !== 0) fail(`built bin exited with ${result.status ?? 'a signal'}\n${result.stderr}`);
  if (!result.stdout.includes('Planned changes (dry run)')) fail('built bin printed no dry-run plan preview');
  // The full, unique dry-run outro — the short form also matches the interactive
  // abort outro, so pin the whole line to prove it took the preview-only path.
  if (!result.stdout.includes('Dry run — nothing was changed.'))
    fail('built bin did not reach the dry-run-only outro (did it apply?)');
  const leftover = readdirSync(cwd);
  if (leftover.length > 0) fail(`--dry-run mutated the working dir: ${leftover.join(', ')}`);
}

function main(): void {
  const cwd = mkdtempSync(join(tmpdir(), 'harness-smoke-'));
  try {
    assertClean(runBin(cwd), cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
  console.log('✓ boot-smoke: built bin booted, printed a coherent dry-run plan, and mutated nothing.');
}

main();
