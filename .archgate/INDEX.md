---
type: index
title: "ADR Index"
description: "Progressive disclosure index for ADRs in .archgate/adrs, with each ADR's steer glob and what it owns."
tags: index-adr
---

# Architecture Decision Records

- **[GEN-001: ADR Contract](./GEN-001-adr.md)**:
    - `Trigger`: `[".archgate/adrs/**/*.{md,ts}"]`
    - The shape contract every ADR under .archgate/adrs/ obeys: frontmatter bundle and order, six canonical sections, authoring discipline, a size budget, and companion rules-file duties.
- **[GEN-002: ADR Symlink for Claude Code Rules](./GEN-002-adr-symlink-claude-rules.md)**:
    - `Trigger`: `[".archgate/adrs/**/*.md"]`
    - The runtime channel that loads a governing ADR into agent context on Read: one .claude/rules symlink per scoped ADR, no orphans, and pointer-ness as a review duty.
