import { join, posix } from 'node:path';
import { readBundleLayout, resolveBundleRoot } from '../../bundle';
import { ADR_CORE, supportingFiles } from '../../harness-config';
import type { Action, Integration } from '../../types';
import { ARCHGATE_DEP, archgateConfig, claudeSettingsLocal, RULES_DTS_PRETTIER_IGNORE } from './template';

/**
 * archgate Integration — **unified deterministic direct-write** (ADR-0005 v4).
 *
 * Both modes now emit the same Actions; `--yes` (`ctx.yes`) no longer branches
 * on *what* is written. v4 retired the interactive `npx archgate init` shell-out
 * for two reasons (ADR-0005 v4): `init`'s example ADR violates GEN-001 (so
 * `archgate check` would fail on a file archgate itself wrote into the very tree
 * core owns), and the shell-out is network/plugin-fragile (Zscaler on locked-down
 * Windows). Everything `init` did deterministically — seed `.archgate/config.json`
 * and `.claude/settings.local.json` — the direct-write already did itself.
 *
 * The install materialises the **Core governance bundle** (ADR-0010) into a
 * Target:
 *
 * - `installDeps` — the version-pinned archgate Dependency (`ARCHGATE_DEP`, from
 *   the Harness build config), so `check` behaviour matches the captured snapshot.
 * - `copyAsset` per bundle file — each `ADR_CORE` id's `.md` + `.rules.ts` +
 *   `.rules.test.ts` plus the supporting files, resolved from the running CLI's
 *   bundle root ({@link resolveBundleRoot}). **Tool-owned**: overwritten on every
 *   run to bring a brownfield Target to the current governance release. The
 *   supporting files include the `@generated` `.archgate/rules.d.ts` (archgate's
 *   ambient rule types) — seeded so a Target can author its **own** ADR
 *   `.rules.ts` with working types and `tsc` before its first `archgate check`,
 *   which regenerates the same file byte-for-byte under the pinned version.
 * - `symlink` per core ADR — a real `.claude/rules/<name>.md` back to the ADR
 *   (GEN-001 §6). Real-symlink-only: archgate's reader resolves symlinks, so a
 *   copy is invisible to its rule and would silently freeze the Target's context.
 * - `writeFile` (write-if-absent) — the **Seeded** `.archgate/config.json` and
 *   `.claude/settings.local.json`, so a developer's own edits survive a re-run.
 *   No `.typescript-ai-harness.json`: it configures the frontmatter governance
 *   the bundle no longer ships, so seeding one would hand a Target a config file
 *   with no reader.
 * - `appendLines` — `.archgate/rules.d.ts` into `.prettierignore` (append-only):
 *   the committed copy is `@generated` in archgate's own style, so it is excluded
 *   from `prettier --check` rather than reformatted (a reformat would drift from
 *   what `archgate check` regenerates).
 *
 * `rules.d.ts` is `@generated` by `archgate check`, but the CLI still seeds the
 * committed copy as a Tool-owned bundle file (above) so the governance workspace
 * type-checks from the first run; it is committed, not gitignored — the v4
 * `.gitignore` entry is retired (ADR-0005 v5, ADR-0002). Deliberately not written: a
 * `lint/` placeholder, and — retired in v4 — the empty `.archgate/adrs/.gitkeep`
 * (the directory now holds real, governed ADRs). No global `~/.claude` plugin
 * install; the `archgate plugin install`
 * reminder is a post-run note in **both** modes (US-13). Editor is fixed to
 * `claude`; other editors remain a deferred per-editor-snapshot slot.
 *
 * The membership enumeration reads the CLI's own bundle listing (read-only,
 * deterministic) to resolve each `ADR_CORE` id to its real trio filenames —
 * safe to run at preview/`--dry-run` time; it mutates nothing in the Target.
 */
export const archgate: Integration = {
  id: 'archgate',
  label: 'archgate — deterministic ADR governance',
  devDependencies: [ARCHGATE_DEP],

  plan() {
    const bundleRoot = resolveBundleRoot();
    const { files, adrDocs } = readBundleLayout(bundleRoot, ADR_CORE, supportingFiles);
    const copyBundle: Action[] = files.map((relative) => ({
      kind: 'copyAsset',
      from: join(bundleRoot, relative),
      to: posix.join('.archgate', relative),
    }));
    const linkRules: Action[] = adrDocs.map((md) => ({
      kind: 'symlink',
      path: posix.join('.claude/rules', md.toLowerCase()),
      target: posix.join('..', '..', '.archgate', 'adrs', md),
    }));
    return [
      { kind: 'installDeps', dev: [...this.devDependencies] },
      ...copyBundle,
      ...linkRules,
      { kind: 'writeFile', path: '.archgate/config.json', contents: archgateConfig(), overwrite: false },
      { kind: 'writeFile', path: '.claude/settings.local.json', contents: claudeSettingsLocal(), overwrite: false },
      { kind: 'appendLines', path: '.prettierignore', lines: RULES_DTS_PRETTIER_IGNORE },
    ];
  },
};
