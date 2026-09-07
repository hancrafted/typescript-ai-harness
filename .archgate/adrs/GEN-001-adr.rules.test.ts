/// <reference path="../rules.d.ts" />

// Sibling test for GEN-001-adr.rules.ts — pass and fail path per rule.

import { describe, expect, it } from 'vitest';
import ruleSet from './GEN-001-adr.rules';

interface Reported {
  message: string;
  file?: string;
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split('**')
    .map((chunk) =>
      chunk
        .split('*')
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('[^/]*'),
    )
    .join('.*');
  return new RegExp(`^${escaped}$`);
}

function makeCtx(files: Record<string, string>, opts?: { config?: unknown }) {
  const violations: Reported[] = [];
  const warnings: Reported[] = [];
  const allPaths = [...Object.keys(files)];
  const ctx = {
    projectRoot: '/repo',
    scopedFiles: allPaths,
    changedFiles: [],
    async glob(pattern: string) {
      const re = globToRegExp(pattern);
      return allPaths.filter((f) => re.test(f));
    },
    async readFile(path: string) {
      if (path in files) return files[path];
      throw new Error(`ENOENT: ${path}`);
    },
    async readJSON(path: string) {
      if (path === '.archgate/config.json') return opts?.config ?? { domains: {} };
      throw new Error(`ENOENT: ${path}`);
    },
    report: {
      violation: (d: Reported) => violations.push(d),
      warning: (d: Reported) => warnings.push(d),
      info: () => {},
    },
  } as unknown as RuleContext;
  return { ctx, violations, warnings };
}

const ADR_PATH = '.archgate/adrs/GEN-001-adr.md';
const RULES_PATH = '.archgate/adrs/GEN-001-adr.rules.ts';

const FM = `---
type: adr
id: GEN-001
title: "ADR Contract"
domain: general
rules: true
files: [".archgate/adrs/**/*.{md,ts}"]
paths: [".archgate/adrs/**/*.md"]
description: "A well-formed fixture ADR."
---`;

const BODY = `
# ADR Contract

## Context

Why.

## Decision

Decided.

## Do's and Don'ts

Do this.

## Consequences

So.

## Compliance and Enforcement

Enforced.

## References

Links.
`;

const VALID_ADR = `${FM}\n${BODY}`;

function passingFiles(): Record<string, string> {
  return {
    [ADR_PATH]: VALID_ADR,
    [RULES_PATH]: 'export default { rules: {} };',
  };
}

const rules = ruleSet.rules;

describe('adr-frontmatter', () => {
  it('passes a well-formed ADR', async () => {
    // ARRANGE
    const { ctx, violations } = makeCtx(passingFiles());
    // ACT
    await rules['adr-frontmatter'].check(ctx);
    // ASSERT
    expect(violations).toEqual([]);
  });

  it("fails when type is not 'adr'", async () => {
    // ARRANGE
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('type: adr', 'type: spec');
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-frontmatter'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /type.*must be 'adr'/.test(v.message))).toBe(true);
  });

  it('fails when type is not the first key', async () => {
    // ARRANGE
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('type: adr\nid: GEN-001', 'id: GEN-001\ntype: adr');
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-frontmatter'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /must lead with 'type'/.test(v.message))).toBe(true);
  });

  it('fails when files: is absent', async () => {
    // ARRANGE
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('files: [".archgate/adrs/**/*.{md,ts}"]\n', '');
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-frontmatter'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /empty required key 'files'/.test(v.message))).toBe(true);
  });

  it('fails when files: is an empty value', async () => {
    // ARRANGE
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('files: [".archgate/adrs/**/*.{md,ts}"]', 'files:');
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-frontmatter'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /empty required key 'files'/.test(v.message))).toBe(true);
  });

  // description is required here and not upstream — it is what .archgate/INDEX.md carries.
  it('fails when description: is absent', async () => {
    // ARRANGE
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('description: "A well-formed fixture ADR."\n', '');
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-frontmatter'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /empty required key 'description'/.test(v.message))).toBe(true);
  });

  it('passes when keys after type are in arbitrary order', async () => {
    // ARRANGE
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace(
      'files: [".archgate/adrs/**/*.{md,ts}"]\npaths: [".archgate/adrs/**/*.md"]',
      'paths: [".archgate/adrs/**/*.md"]\nfiles: [".archgate/adrs/**/*.{md,ts}"]',
    );
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-frontmatter'].check(ctx);
    // ASSERT
    expect(violations).toEqual([]);
  });

  it('fails when rules: true has no sibling .rules.ts', async () => {
    // ARRANGE
    const files = passingFiles();
    delete files[RULES_PATH];
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-frontmatter'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /sibling.*does not exist/.test(v.message))).toBe(true);
  });
});

describe('adr-size-budget', () => {
  it('passes an ADR under the budget', async () => {
    // ARRANGE
    const { ctx, violations } = makeCtx(passingFiles());
    // ACT
    await rules['adr-size-budget'].check(ctx);
    // ASSERT
    expect(violations).toEqual([]);
  });

  it('fails an ADR over the budget', async () => {
    // ARRANGE
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR + 'x'.repeat(12_000);
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-size-budget'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /over the 12000-character budget/.test(v.message))).toBe(true);
  });

  it('counts astral rule markers as one character each', async () => {
    // ARRANGE
    // 11_999 code points + one 📜 (two UTF-16 units) is 12_000 by wc -m and
    // 12_001 by String.length — the budget must agree with wc -m.
    const files = passingFiles();
    files[ADR_PATH] = 'a'.repeat(11_999) + '\u{1F4DC}';
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-size-budget'].check(ctx);
    // ASSERT
    expect(violations).toEqual([]);
  });
});

describe('adr-required-sections', () => {
  it('passes when all six sections are present', async () => {
    // ARRANGE
    const { ctx, violations } = makeCtx(passingFiles());
    // ACT
    await rules['adr-required-sections'].check(ctx);
    // ASSERT
    expect(violations).toEqual([]);
  });

  it('fails when a section is missing', async () => {
    // ARRANGE
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('## References\n\nLinks.\n', '');
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-required-sections'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /missing the mandatory section '## References'/.test(v.message))).toBe(true);
  });
});

// ---- Shape-grammar (§5) and companion rules-file (§6) rules ----

const TEST_PATH = '.archgate/adrs/GEN-001-adr.rules.test.ts';

// A companion rules file whose single rule key is what the marker tests reference.
const DEMO_RULES = "export default { rules: { 'demo-rule': { async check() {} } } };";

// Build an ADR from a custom Decision and Do's/Don'ts body; the other sections are trivial.
function adrWith(decision: string, dosDonts: string): string {
  return `${FM}

# T

## Context

Why.

## Decision

${decision}

## Do's and Don'ts

${dosDonts}

## Consequences

So.

## Compliance and Enforcement

Enforced.

## References

Links.
`;
}

describe('adr-numbered-decision', () => {
  it('passes numbered anchors with sequential per-anchor lists', async () => {
    // ARRANGE
    const decision = '### 1. First\n\n1. Alpha.\n2. Beta.\n\n### 2. Second\n\nProse only.';
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith(decision, '1. **DO** x.') });
    // ACT
    await rules['adr-numbered-decision'].check(ctx);
    // ASSERT
    expect(violations).toEqual([]);
  });

  it('fails on an unordered first-level bullet inside an anchor', async () => {
    // ARRANGE
    const decision = '### 1. First\n\n- loose bullet';
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith(decision, '1. **DO** x.') });
    // ACT
    await rules['adr-numbered-decision'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /unordered first-level bullet/.test(v.message))).toBe(true);
  });
});

describe('adr-numbered-dos-donts', () => {
  it("passes headed DO and DON'T blocks each ordered from 1", async () => {
    // ARRANGE
    const dosDonts = "### Do's\n\n1. **DO** a.\n2. **DO** b.\n\n### Don'ts\n\n1. **DON'T** c.\n2. **DON'T** d.";
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith('1. Decided.', dosDonts) });
    // ACT
    await rules['adr-numbered-dos-donts'].check(ctx);
    // ASSERT
    expect(violations).toEqual([]);
  });

  it('fails on a non-sequential DO block', async () => {
    // ARRANGE
    const dosDonts = "### Do's\n\n1. **DO** a.\n3. **DO** b.\n\n### Don'ts\n\n1. **DON'T** c.";
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith('1. Decided.', dosDonts) });
    // ACT
    await rules['adr-numbered-dos-donts'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /DO block numbering must be sequential/.test(v.message))).toBe(true);
  });

  it('fails bare adjacent lists that lack the subsection headings', async () => {
    // ARRANGE
    const dosDonts = "1. **DO** a.\n\n1. **DON'T** c.";
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith('1. Decided.', dosDonts) });
    // ACT
    await rules['adr-numbered-dos-donts'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /exactly one "### Do's" subsection heading, found 0/.test(v.message))).toBe(true);
    expect(violations.some((v) => /exactly one "### Don'ts" subsection heading, found 0/.test(v.message))).toBe(true);
  });

  it("fails when ### Don'ts precedes ### Do's", async () => {
    // ARRANGE
    const dosDonts = "### Don'ts\n\n1. **DON'T** c.\n\n### Do's\n\n1. **DO** a.";
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith('1. Decided.', dosDonts) });
    // ACT
    await rules['adr-numbered-dos-donts'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /"### Do's" must precede "### Don'ts"/.test(v.message))).toBe(true);
  });

  it('fails an item filed under the wrong subsection', async () => {
    // ARRANGE
    const dosDonts = "### Do's\n\n1. **DO** a.\n2. **DON'T** stray.\n\n### Don'ts\n\n1. **DON'T** c.";
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith('1. Decided.', dosDonts) });
    // ACT
    await rules['adr-numbered-dos-donts'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /sits outside the "### Don'ts" subsection/.test(v.message))).toBe(true);
  });
});

describe('adr-rule-mentions', () => {
  const decision = '### 1. Thing (📜 Rule: `demo-rule`)\n\n1. Body.';

  it('passes when a rule is marked on both sides with an aligned back-reference', async () => {
    // ARRANGE
    const dosDonts = "1. **DO** it. (Decision 1, 📜 Rule: `demo-rule`)\n\n1. **DON'T** not.";
    const files = { [ADR_PATH]: adrWith(decision, dosDonts), [RULES_PATH]: DEMO_RULES };
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-rule-mentions'].check(ctx);
    // ASSERT
    expect(violations).toEqual([]);
  });

  it("fails when the Do's/Don'ts-side marker is missing", async () => {
    // ARRANGE
    const dosDonts = "1. **DO** it.\n\n1. **DON'T** not.";
    const files = { [ADR_PATH]: adrWith(decision, dosDonts), [RULES_PATH]: DEMO_RULES };
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-rule-mentions'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /needs its marker \(Decision <N>/.test(v.message))).toBe(true);
  });
});

describe('adr-rules-test-sibling', () => {
  it('passes when a rules file has its sibling test', async () => {
    // ARRANGE
    const { ctx, violations } = makeCtx({ [RULES_PATH]: DEMO_RULES, [TEST_PATH]: '' });
    // ACT
    await rules['adr-rules-test-sibling'].check(ctx);
    // ASSERT
    expect(violations).toEqual([]);
  });

  it('fails when the sibling test is absent', async () => {
    // ARRANGE
    const { ctx, violations } = makeCtx({ [RULES_PATH]: DEMO_RULES });
    // ACT
    await rules['adr-rules-test-sibling'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /no sibling test/.test(v.message))).toBe(true);
  });
});

describe('adr-message-provenance', () => {
  it('passes when every rule embeds its provenance tag', async () => {
    // ARRANGE
    const src =
      "export default { rules: { 'demo-rule': { async check(ctx) { ctx.report.violation({ message: '(GEN-001 [demo-rule])' }); } } } };";
    const { ctx, violations } = makeCtx({ [RULES_PATH]: src });
    // ACT
    await rules['adr-message-provenance'].check(ctx);
    // ASSERT
    expect(violations).toEqual([]);
  });

  it('fails when a rule omits its provenance tag', async () => {
    // ARRANGE
    const src =
      "export default { rules: { 'demo-rule': { async check(ctx) { ctx.report.violation({ message: 'no tag here' }); } } } };";
    const { ctx, violations } = makeCtx({ [RULES_PATH]: src });
    // ACT
    await rules['adr-message-provenance'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /must embed the provenance literal/.test(v.message))).toBe(true);
  });
});

describe('adr-rule-mentions (reverse direction)', () => {
  it('fails when a marker names a rule the rules file does not declare', async () => {
    // ARRANGE
    const decision = '### 1. Thing (📜 Rule: `demo-rule`)\n\nAlso ghosted. (📜 Rule: `ghost-rule`)\n\n1. Body.';
    const dosDonts = "1. **DO** it. (Decision 1, 📜 Rule: `demo-rule`)\n\n1. **DON'T** skip.";
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith(decision, dosDonts), [RULES_PATH]: DEMO_RULES });
    // ACT
    await rules['adr-rule-mentions'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /names rule 'ghost-rule' but no such rule exists/.test(v.message))).toBe(true);
  });

  it('flags markers as phantoms when the ADR has no rules file at all', async () => {
    // ARRANGE
    const decision = '### 1. Thing (📜 Rule: `demo-rule`)\n\n1. Body.';
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith(decision, '1. **DO** x.') });
    // ACT
    await rules['adr-rule-mentions'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /names rule 'demo-rule' but no such rule exists/.test(v.message))).toBe(true);
  });
});

describe('adr-governed-files', () => {
  it('passes a flat directory of ADR bundle files', async () => {
    // ARRANGE
    const { ctx, violations } = makeCtx({ ...passingFiles(), [TEST_PATH]: '' });
    // ACT
    await rules['adr-governed-files'].check(ctx);
    // ASSERT
    expect(violations).toEqual([]);
  });

  it('fails on a stray non-ADR-shaped file', async () => {
    // ARRANGE
    const { ctx, violations } = makeCtx({ ...passingFiles(), '.archgate/adrs/notes.md': 'scratch' });
    // ACT
    await rules['adr-governed-files'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /does not match the ADR bundle shape/.test(v.message))).toBe(true);
  });

  it('fails on a file in a subdirectory', async () => {
    // ARRANGE
    const { ctx, violations } = makeCtx({ ...passingFiles(), '.archgate/adrs/sub/GEN-050-nested.md': VALID_ADR });
    // ACT
    await rules['adr-governed-files'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /sits in a subdirectory/.test(v.message))).toBe(true);
  });

  it('fails on an ADR-less rules file (silently inert)', async () => {
    // ARRANGE
    const { ctx, violations } = makeCtx({ ...passingFiles(), '.archgate/adrs/GEN-051-ghost.rules.ts': DEMO_RULES });
    // ACT
    await rules['adr-governed-files'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /has no backing ADR 'GEN-051-ghost.md'/.test(v.message))).toBe(true);
  });
});

describe('adr-glob-inline', () => {
  it('passes an inline flow list and an absent paths key', async () => {
    // ARRANGE
    const files = passingFiles();
    files['.archgate/adrs/GEN-052-scopeless.md'] = VALID_ADR.replace('paths: [".archgate/adrs/**/*.md"]\n', '').replace(
      'id: GEN-001',
      'id: GEN-052',
    );
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-glob-inline'].check(ctx);
    // ASSERT
    expect(violations).toEqual([]);
  });

  it('fails a block-style paths list', async () => {
    // ARRANGE
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('paths: [".archgate/adrs/**/*.md"]', 'paths:\n  - ".archgate/adrs/**/*.md"');
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-glob-inline'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /must be an inline flow list/.test(v.message))).toBe(true);
  });

  it('fails a block-style files list', async () => {
    // ARRANGE
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace(
      'files: [".archgate/adrs/**/*.{md,ts}"]',
      'files:\n  - ".archgate/adrs/**/*.{md,ts}"',
    );
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-glob-inline'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /'files:' must be an inline flow list/.test(v.message))).toBe(true);
  });

  it('fails a null paths value', async () => {
    // ARRANGE
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('paths: [".archgate/adrs/**/*.md"]', 'paths: null');
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-glob-inline'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /must be an inline flow list/.test(v.message))).toBe(true);
  });
});

describe('adr-error-tier', () => {
  it('passes rules declaring error severity or none', async () => {
    // ARRANGE
    const src =
      "export default { rules: { 'demo-rule': { severity: 'error', async check() {} }, 'other-rule': { async check() {} } } };";
    const { ctx, violations } = makeCtx({ [RULES_PATH]: src });
    // ACT
    await rules['adr-error-tier'].check(ctx);
    // ASSERT
    expect(violations).toEqual([]);
  });

  it('fails a warning-tier rule', async () => {
    // ARRANGE
    const src = "export default { rules: { 'demo-rule': { severity: 'warning', async check() {} } } };";
    const { ctx, violations } = makeCtx({ [RULES_PATH]: src });
    // ACT
    await rules['adr-error-tier'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /runs every rule at 'error'/.test(v.message))).toBe(true);
  });
});

describe('adr-required-sections (fenced headings)', () => {
  it('does not count a heading that only appears inside a fenced block', async () => {
    // ARRANGE
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('## References', '```md\n## References\n```');
    const { ctx, violations } = makeCtx(files);
    // ACT
    await rules['adr-required-sections'].check(ctx);
    // ASSERT
    expect(violations.some((v) => /missing the mandatory section '## References'/.test(v.message))).toBe(true);
  });
});
