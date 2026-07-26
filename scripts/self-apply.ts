// Self-apply dogfood (ADR-0010 §4, the ADR-0010 Definition of Done). Runs the
// CLI's own install path against THIS repository — the harness dogfooding its
// own install — so the Core governance bundle it materialises reproduces the
// committed source (this repo is not a Target project; it self-applies). The
// bundle is Tool-owned: `.archgate/**` is overwritten from the captured asset
// and each `.claude/rules/<id>.md` symlink is recreated, with NO skip-self
// special case (ADR-0010 §1 v2) — self-apply reads the same asset and runs the
// same `cpSync(force)` a foreign Target does. The CI guard (ci.yml) runs this,
// then fails on any `.archgate/**` / `.claude/rules/` diff, which is what turns
// the dogfood into the actual overwrite test rather than a skipped no-op.
//
// Local use: `npm run self-apply && git diff -- .archgate .claude/rules` — a
// clean diff is the pass. Re-run to reconcile the committed bundle after editing
// any governed ADR (then commit both `.archgate/` and the re-captured asset).
//
// `exec` is stubbed to install nothing: the clean-diff DoD is scoped to the on-disk
// bundle (`.archgate/**` + `.claude/rules/`), which `npm install` never touches;
// archgate is already a pinned devDependency, so a real install would only add
// network flakiness to a determinism guard. The write-if-absent seeds
// (`.typescript-ai-harness.json`, `.archgate/config.json`,
// `.claude/settings.local.json`) are inert too — they already exist here, so the
// install skips them. Repo-local release tooling — never shipped into Target
// projects (ADR-0003).
import { projectRootOf } from '../src/bundle';
import { run } from '../src/run';
import type { Exec } from '../src/types';

const repoRoot = projectRootOf(import.meta.url); // scripts/ -> repo root

// Record the intended install for the log, shell out to nothing (see header).
const noInstallExec: Exec = async (command, args) => {
  console.log(`skip   ${command} ${args.join(' ')} (self-apply installs no deps)`);
};

const { actions } = await run(
  { integrations: ['archgate'], archgate: {} },
  { cwd: repoRoot, exec: noInstallExec, yes: true, log: (message) => console.log(message) },
);

console.log(
  `✓ self-apply: applied ${actions.length} action(s) — Core bundle written from the committed asset. ` +
    'Verify with `git diff -- .archgate .claude/rules` (a clean diff is the pass).',
);
