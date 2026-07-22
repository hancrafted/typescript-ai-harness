// Canonical harness-config conformance fixtures, imported by BOTH
// .archgate/adrs/GEN-002-harness-config.rules.test.ts (the envelope/shape
// validator) and .archgate/adrs/GEN-003-frontmatter.rules.test.ts (the payload
// validator and floor consumer). One shared input set is the drift tripwire
// for the evaluator-copy hazard: what GEN-002 accepts, GEN-003 must consume;
// what either rejects, the floor must refuse to govern by (the all-or-nothing
// consumer contract, GEN-002 §3). Each fixture states its two-sided contract.

/** The harness release the MOCK package.json serves in both rules tests —
 * deliberately NOT this repo's real version, proving the rules read the
 * source of truth (`package.json` `.version`) instead of hardcoding one. */
export const MOCK_HARNESS_VERSION = '1.2.3';

/** Fully valid config exercising every spine feature: settings, an
 * entry-level exclude (fall-through), an exempt entry, a multi-glob include
 * with a warning tier, and an open governed entry (no `rule` payload).
 * GEN-002: all four rules pass. GEN-003: frontmatter-config-valid passes and
 * the floor governs by it. */
export const VALID_CONFIG: Harness.Config = {
  version: MOCK_HARNESS_VERSION,
  markdown: {
    frontmatter: {
      unmatched: 'exempt',
      settings: { draftEscape: true },
      pathRules: [
        {
          include: ['docs/adr/*.md'],
          exclude: ['docs/adr/DRAFT-*.md'],
          rule: { allowedTypes: ['design-adr'], label: 'title', requireDescription: true, maxTag: 40 },
        },
        { include: ['.claude/agents/*.md'], rule: { allowedTypes: ['agent'], label: 'name', maxDescription: 4096 } },
        { include: ['.agents/**'], exempt: true },
        { include: ['README.md', 'AGENTS.md'], severity: 'warning', rule: { label: 'title' } },
        { include: ['notes/**/*.md'] },
      ],
    },
  },
};

/** The strict posture: unmatched 'error' with a coverage FileSet (its own
 * exclude carves files out of the governed universe entirely). GEN-002: all
 * four rules pass. GEN-003: the floor errors on every in-coverage file no
 * entry claims. */
export const STRICT_CONFIG: Harness.Config = {
  version: MOCK_HARNESS_VERSION,
  markdown: {
    frontmatter: {
      unmatched: 'error',
      coverage: { include: ['docs/**/*.md'], exclude: ['docs/legacy/**'] },
      pathRules: [
        { include: ['docs/adr/*.md'], rule: { allowedTypes: ['design-adr'], label: 'title' } },
        { include: ['docs/tmp/**'], exempt: true },
      ],
    },
  },
};

/** Spine-invalid: unmatched 'error' without the coverage FileSet it requires.
 * GEN-002: config-shape-valid fails. GEN-003: frontmatter-config-valid stays
 * silent (the payload is fine — the spine is GEN-002's finding) and the floor
 * governs nothing. */
export const SPINE_INVALID_CONFIG = {
  version: MOCK_HARNESS_VERSION,
  markdown: {
    frontmatter: {
      unmatched: 'error',
      pathRules: [{ include: ['docs/adr/*.md'], rule: { allowedTypes: ['design-adr'], label: 'title' } }],
    },
  },
};

/** Payload-invalid but spine-valid: 'maxDescriptions' is a typo of
 * maxDescription — the silently-weakened-floor hole. GEN-002: all four rules
 * pass (payloads are opaque to the spine; the boundary proof). GEN-003:
 * frontmatter-config-valid fails and the floor governs nothing. */
export const PAYLOAD_TYPO_CONFIG = {
  version: MOCK_HARNESS_VERSION,
  markdown: {
    frontmatter: {
      pathRules: [
        { include: ['docs/adr/*.md'], rule: { allowedTypes: ['design-adr'], label: 'title', maxDescriptions: 2048 } },
      ],
    },
  },
};

/** Version skew: a well-formed config stamped for another harness release.
 * GEN-002: config-version fails naming the migrate step. GEN-003: the floor
 * governs nothing (a config authored for another release is never
 * reinterpreted under this one's semantics). */
export const VERSION_MISMATCH_CONFIG = {
  version: '9.9.9',
  markdown: {
    frontmatter: { pathRules: [{ include: ['docs/adr/*.md'], rule: { label: 'title' } }] },
  },
};

/** No version stamp at all — an envelope violation, not a healthy absence.
 * GEN-002: config-version fails requiring the stamp. GEN-003: the floor
 * governs nothing (the all-or-nothing contract: present but invalid). */
export const VERSION_MISSING_CONFIG = {
  markdown: {
    frontmatter: { pathRules: [{ include: ['docs/adr/*.md'], rule: { label: 'title' } }] },
  },
};

/** A stamp that is a string but not semver-shaped. GEN-002: config-version
 * fails on shape — even when package.json yields no version to compare
 * against. GEN-003: the floor governs nothing, on the same shape check. */
export const VERSION_MALFORMED_CONFIG = {
  version: 'banana',
  markdown: {
    frontmatter: { pathRules: [{ include: ['docs/adr/*.md'], rule: { label: 'title' } }] },
  },
};

/** The retired pre-restructure format: top-level 'adr' key, flat entries with
 * 'match', no version stamp. GEN-002: config-version fails (no stamp) and
 * config-shape-valid fails ('adr.frontmatter' is not a declared block).
 * GEN-003: the floor governs nothing — a present-but-invalid config is never
 * best-effort interpreted, and GEN-002 carries the loud errors. */
export const RETIRED_KEY_CONFIG = {
  adr: {
    frontmatter: {
      unmatched: 'exempt',
      draftEscape: true,
      pathRules: [{ match: 'docs/adr/*.md', allowedTypes: ['design-adr'], label: 'title' }],
    },
  },
};

/** Block-name typo ('frontmater') — the silent-fallback hole. GEN-002:
 * config-shape-valid fails ('markdown.frontmater' matches no fence-declared
 * path). GEN-003: the 'frontmatter' block is absent in a healthy envelope, so
 * the floor falls back to the built-in default — loudly flagged, never
 * silently interpreted. */
export const UNDECLARED_BLOCK_CONFIG = {
  version: MOCK_HARNESS_VERSION,
  markdown: {
    frontmater: { pathRules: [{ include: ['docs/adr/*.md'] }] },
  },
};

/** A namespace no fence declares: project-local governance must extend the
 * config by adding its own fence (plus an owning ADR) to
 * harness-config-extension.d.ts — free-floating top-level keys are gone.
 * GEN-002: config-shape-valid fails ('acmeGovernance.reviewers' matches no
 * declared path). GEN-003: unaffected ('markdown' absent → default). */
export const UNDECLARED_NAMESPACE_CONFIG = {
  version: MOCK_HARNESS_VERSION,
  acmeGovernance: { reviewers: { pathRules: [] } },
};

/** A third key level below the block — the depth guard: the config shape is
 * `{ version, [namespace]: { [block]: ConfigBlock } }`, a ConfigBlock exactly
 * two levels deep. GEN-002: config-shape-valid fails (the nested map is not a
 * spine key and pathRules is missing). GEN-003: the floor governs nothing
 * (spine-invalid block). */
export const DEPTH_VIOLATION_CONFIG = {
  version: MOCK_HARNESS_VERSION,
  markdown: {
    frontmatter: {
      frontmatter: { pathRules: [{ include: ['docs/adr/*.md'] }] },
    },
  },
};
