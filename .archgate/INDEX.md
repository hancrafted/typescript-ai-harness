---
type: index
title: "ADR Index"
description: "Progressive disclosure index for ADRs in .archgate/adrs, "
tags: index-adr
---

# Architecture Decision Records

- **[GEN-001: ADR Contract](./GEN-001-adr.md)**:
    - `Trigger`: `[".archgate/adrs/**/*.{md,ts}"]`
    - The shape and runtime-loading contract every ADR under .archgate/adrs/ obeys: frontmatter bundle and order, six canonical sections, and a .claude/rules symlink that loads the ADR into agent context on Read.
- **[GEN-002: Harness Config](./GEN-002-harness-config.md)**:
    - `Trigger`: `[".typescript-ai-harness.json", ".archgate/harness-config-core.d.ts", ".archgate/harness-config-extension.d.ts"]`
    - Owns the envelope of the root harness config `.typescript-ai-harness.json`: JSON validity, the seeded-never-patched lifecycle, the top-level semver `version` matched to the installed harness release, the fence grammar whose declared `namespace.block` paths form the closed set of legal keys, and the domain-blind generic spine every config block satisfies. Hardcodes no namespace or block name — registration and payloads are owned by block ADRs such as GEN-003.
- **[GEN-003: Frontmatter Contract](./GEN-003-frontmatter.md)**:
    - `Trigger`: `["**/*.md", ".typescript-ai-harness.json", ".archgate/harness-config-extension.d.ts"]`
    - Owns `type` repo-wide via the OKF frontmatter floor: every governed markdown file carries type + exactly one of name/title, plus optional cap-checked description and tags. Owns the harness config's `markdown.frontmatter`.
