import { join, posix } from 'node:path';
import { readBundleLayout, resolveBundleRoot } from '../../bundle';
import { ADR_CORE, supportingFiles } from '../../harness-config';
import type { Action, Integration } from '../../types';
import { ARCHGATE_DEP, archgateConfig, claudeSettingsLocal, harnessConfigSeed, RULES_DTS_IGNORE } from './template';

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
 *   run to bring a brownfield Target to the current governance release.
 * - `symlink` per core ADR — a real `.claude/rules/<name>.md` back to the ADR
 *   (GEN-001 §6). Real-symlink-only; a copy would invert `adr-claude-rules-symlink`.
 * - `writeFile` (write-if-absent) — the **Seeded** `.typescript-ai-harness.json`
 *   (the harness config, GEN-002/003: the default frontmatter block stamped with
 *   this harness release), `.archgate/config.json`, and
 *   `.claude/settings.local.json`, so a developer's own edits survive a re-run.
 *   Seeding the harness config materialises exactly the policy GEN-003 applies
 *   by default (a behaviour no-op) but makes it visible and editable (ADR-0010 §6).
 * - `appendLines` — the `.archgate/rules.d.ts` gitignore entry (that file is
 *   `@generated` by `archgate check`, so it is ignored, never written).
 *
 * Deliberately not written: `rules.d.ts`, a `lint/` placeholder, and — retired in
 * v4 — the empty `.archgate/adrs/.gitkeep` (the directory now holds real, governed
 * ADRs). No global `~/.claude` plugin install; the `archgate plugin install`
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
      { kind: 'writeFile', path: '.typescript-ai-harness.json', contents: harnessConfigSeed(), overwrite: false },
      { kind: 'writeFile', path: '.archgate/config.json', contents: archgateConfig(), overwrite: false },
      { kind: 'writeFile', path: '.claude/settings.local.json', contents: claudeSettingsLocal(), overwrite: false },
      { kind: 'appendLines', path: '.gitignore', lines: RULES_DTS_IGNORE },
    ];
  },
};
