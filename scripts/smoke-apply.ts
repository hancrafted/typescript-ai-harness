// Real-apply foreign-target smoke — the regression guard for the class of
// breakage that shipped in 0.1.1: a fresh install whose `archgate check` fails
// even though the install succeeded. The dry-run `smoke.ts` never applies and
// this repo's own `archgate check` always runs inside a git tree with a matching
// version, so neither sees the foreign-target path. This one does: it applies the
// real plan into a throwaway NON-git dir carrying a foreign `package.json`, then
// runs `archgate check` against it and asserts a clean report.
//
// The clean report alone cannot tell a live contract from a dead one — a
// silently disabled contract is *also* clean (issue #71). So after the baseline
// the smoke seeds a deliberately non-conformant ADR and asserts `archgate check`
// now FAILS, proving GEN-001 actually governs a foreign Target and did not skip
// it on a false version skew.
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
const CORE_LINKS = ['gen-001-adr.md'];

// The negative control's payload. Frontmatter is deliberately CORRECT — the five
// required keys, in GEN-001's order, and `rules: false` so no sibling .rules.ts is
// owed — because the file has to parse before the contract can reject it. What is
// wrong is structural: `## References` is missing from the six canonical sections.
const NEGATIVE_CONTROL_ADR = `---
type: adr
id: SMK-001
title: "Apply-smoke negative control"
domain: general
rules: false
---

# Apply-smoke negative control

## Context

Planted by the apply smoke to prove GEN-001 governs a foreign Target. Deliberately
missing its \`## References\` section.

## Decision

### 1. Anchor

1. This ADR exists to be rejected.

## Do's and Don'ts

### Do's

1. **DO** expect \`archgate check\` to fail while this file is present.

### Don'ts

1. **DON'T** add the missing section — that is the whole assertion.

## Consequences

None; the file is deleted with the temp Target.

## Compliance and Enforcement

\`adr-required-sections\`, at error tier.
`;

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

// (d) the negative control. Seeded AFTER the clean baseline, so the smoke is a
// live test of GEN-001 rather than of an empty rule set — a disabled contract
// (issue #71) would leave the check green here too.
//
// Observed on a real apply, which is the only reason this file is trusted to be
// the right shape: pass:false, errors:1, unparsedAdrs:[], exit 1, with
// `adr-required-sections` reporting "ADR is missing the mandatory section
// '## References' (GEN-001 [adr-required-sections])".
//
// Parsing cleanly is the whole trick. An ADR malformed in its *frontmatter* fails
// archgate's schema and drops into the advisory `unparsedAdrs` instead, leaving
// the run at {"pass":true,"total":0} and exit 0 — which this control would read as
// a dead contract. `--strict` is the only flag that fails on that advisory, and
// the check below passes no flags, so the planted file must parse and THEN break a
// rule.
function seedNonConformant(cwd: string): void {
  writeFileSync(join(cwd, '.archgate/adrs/SMK-001-negative-control.md'), NEGATIVE_CONTROL_ADR);
}

// The load-bearing negative assertion: with a rule-violating ADR present,
// archgate check MUST now fail (non-zero exit — the same exit-code signal
// assertArchgateClean reads, not stdout). A clean report here would prove GEN-001
// is silently dead on a foreign Target.
function assertArchgateFails(cwd: string): void {
  const check = spawnSync(ARCHGATE, ['check'], { cwd, encoding: 'utf8' });
  if (check.status === 0) {
    fail(
      'archgate check passed on a foreign Target carrying an ADR with no `## References` section — ' +
        "either GEN-001 is silently disabled (issue #71), or the planted ADR failed archgate's " +
        'schema and dropped out into the advisory `unparsedAdrs`, which leaves a bare `check` at ' +
        'exit 0. Re-run with `--strict` to tell the two apart.',
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
      'and GEN-001 rejects an ADR missing a mandatory section (live on a foreign Target).',
  );
}

main();
