// Canonical harness-config conformance fixtures, imported by BOTH
// .archgate/adrs/GEN-002-harness-config.rules.test.ts (the spine validator) and
// .archgate/adrs/GEN-003-frontmatter.rules.test.ts (the payload validator and
// floor consumer). One shared input set is the drift tripwire for the
// evaluator-copy hazard: what GEN-002 accepts, GEN-003 must consume; what
// either rejects, the floor must refuse to govern by (the all-or-nothing
// consumer contract, GEN-002 §3). Each fixture states its two-sided contract.

/** Fully valid v1 config exercising every spine feature: settings, an
 * entry-level exclude (fall-through), an exempt entry, a multi-glob include
 * with a warning tier, and an open governed entry (no `rule` payload).
 * GEN-002: all three rules pass. GEN-003: frontmatter-config-valid passes and
 * the floor governs by it. */
export const VALID_CONFIG: Harness.Config = {
  markdown: {
    version: 1,
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
 * three rules pass. GEN-003: the floor errors on every in-coverage file no
 * entry claims. */
export const STRICT_CONFIG: Harness.Config = {
  markdown: {
    version: 1,
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
 * GEN-002: config-spine-valid fails. GEN-003: frontmatter-config-valid stays
 * silent (the payload is fine — the spine is GEN-002's finding) and the floor
 * governs nothing. */
export const SPINE_INVALID_CONFIG = {
  markdown: {
    version: 1,
    frontmatter: {
      unmatched: 'error',
      pathRules: [{ include: ['docs/adr/*.md'], rule: { allowedTypes: ['design-adr'], label: 'title' } }],
    },
  },
};

/** Payload-invalid but spine-valid: 'maxDescriptions' is a typo of
 * maxDescription — the silently-weakened-floor hole. GEN-002: all three rules
 * pass (payloads are opaque to the spine; the boundary proof). GEN-003:
 * frontmatter-config-valid fails and the floor governs nothing. */
export const PAYLOAD_TYPO_CONFIG = {
  markdown: {
    version: 1,
    frontmatter: {
      pathRules: [
        { include: ['docs/adr/*.md'], rule: { allowedTypes: ['design-adr'], label: 'title', maxDescriptions: 2048 } },
      ],
    },
  },
};

/** Format skew: a well-formed config stamped with an unknown future version.
 * GEN-002: config-namespace-registered fails naming the migrate step.
 * GEN-003: the floor governs nothing (v1 semantics must not be applied to a
 * config authored for another format). */
export const VERSION_MISMATCH_CONFIG = {
  markdown: {
    version: 2,
    frontmatter: { pathRules: [{ include: ['docs/adr/*.md'], rule: { label: 'title' } }] },
  },
};

/** The retired pre-v1 format: top-level 'adr' key, flat entries with 'match'.
 * GEN-002: config-namespace-registered fails with the rename tombstone.
 * GEN-003: 'markdown' is absent, so the floor falls back to the built-in
 * default — loudly flagged, never silently interpreted. */
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
 * config-namespace-registered fails (unregistered block). GEN-003: the
 * 'frontmatter' block is absent, so the floor falls back to the built-in
 * default — loudly flagged, never silently interpreted. */
export const UNREGISTERED_BLOCK_CONFIG = {
  markdown: {
    version: 1,
    frontmater: { pathRules: [{ include: ['docs/adr/*.md'] }] },
  },
};

/** Free top-level keys are the consumer-extension surface (GEN-002 §2): keys
 * beside 'markdown' are not the spine's business. GEN-002: all three rules
 * pass. GEN-003: unaffected. */
export const FREE_TOP_LEVEL_CONFIG = {
  markdown: {
    version: 1,
    frontmatter: { pathRules: [{ include: ['docs/adr/*.md'], rule: { label: 'title' } }] },
  },
  acmeGovernance: { reviewers: 2 },
};
