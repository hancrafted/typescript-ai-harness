import { ARCHGATE_VERSION } from '../../harness-config';

/**
 * The `archgate init --editor claude` snapshot, captured against the pinned
 * version (ADR-0005). archgate exposes no non-interactive `init`, so rather than
 * shell out we emit this surface directly — a `--yes` run then stays headless
 * and controlled. When bumping the pin, re-capture the snapshot and change
 * `ARCHGATE_VERSION` in `harness.config.json` (its single source — the Harness
 * build config, ADR-0010 §2).
 */

/**
 * The pinned archgate version, re-exported from the Harness build config so the
 * snapshot has a named coupling point. The Dependency is pinned rather than
 * installed latest (a deliberate deviation from the "install latest" convention
 * — ADR-0005); the deferred drift test (#4) reuses it to diff against real
 * `archgate init`.
 */
export { ARCHGATE_VERSION };

/** `npm install --save-dev` spec for the pinned archgate Dependency. */
export const ARCHGATE_DEP = `archgate@${ARCHGATE_VERSION}`;

/**
 * Seeded `.archgate/config.json`. Empty `domains` — the five ADR domains
 * (ARCH/BE/DATA/FE/GEN) are archgate built-ins available with zero config — and
 * a static `origin/main` base branch. Detection of the actual base branch is
 * deliberately not reintroduced at apply time (ADR-0005 / #5 out of scope). A
 * Seeded config file: written only when absent, never clobbered.
 */
export const archgateConfig = (): string => `${JSON.stringify({ domains: {}, baseBranch: 'origin/main' }, null, 2)}\n`;

/**
 * Seeded `.claude/settings.local.json`: archgate's Claude settings verbatim —
 * the `archgate:developer` agent plus the allowed archgate skills. Wires the
 * editor to archgate's agent/skills once the developer runs `archgate plugin
 * install`; inert until then. A Seeded config file (write-if-absent) so a
 * developer's own agent/permission customisations survive a re-run.
 */
export const claudeSettingsLocal = (): string =>
  `${JSON.stringify(
    {
      agent: 'archgate:developer',
      permissions: {
        allow: ['Skill(archgate:architect)', 'Skill(archgate:quality-manager)', 'Skill(archgate:adr-author)'],
        deny: [],
      },
    },
    null,
    2,
  )}\n`;

/**
 * Append-only `.prettierignore` entry for archgate's generated `rules.d.ts`. The
 * file is committed and seeded as a Tool-owned bundle member (ADR-0005 v5) so a
 * Target type-checks its own ADR rules from the first run — but it is `@generated`
 * in archgate's own style and does not conform to the seeded prettier config, so
 * it is excluded from `prettier --check`, never reformatted (a reformat would
 * drift from what `archgate check` regenerates). Replaces v4's `.gitignore` entry.
 */
export const RULES_DTS_PRETTIER_IGNORE = ['.archgate/rules.d.ts'];
