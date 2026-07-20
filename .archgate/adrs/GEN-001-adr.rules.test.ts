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

// `symlinks` model archgate's behavior: ctx.glob lists them but ctx.readFile
// throws (archgate does not follow symlinks). Regular entries live in `files`.
function makeCtx(files: Record<string, string>, opts?: { config?: unknown; symlinks?: string[] }) {
  const violations: Reported[] = [];
  const warnings: Reported[] = [];
  const symlinks = opts?.symlinks ?? [];
  const allPaths = [...Object.keys(files), ...symlinks];
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
      if (symlinks.includes(path)) throw new Error(`ELOOP: not followed: ${path}`);
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
const LINK_PATH = '.claude/rules/gen-001-adr.md';

const FM = `---
type: adr
id: GEN-001
title: "ADR Contract"
domain: general
rules: true
paths: [".archgate/adrs/**/*.md"]
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
    const { ctx, violations } = makeCtx(passingFiles());
    await rules['adr-frontmatter'].check(ctx);
    expect(violations).toEqual([]);
  });

  it("fails when type is not 'adr'", async () => {
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('type: adr', 'type: spec');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-frontmatter'].check(ctx);
    expect(violations.some((v) => /type.*must be 'adr'/.test(v.message))).toBe(true);
  });

  it('fails when the field order is wrong', async () => {
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('type: adr\nid: GEN-001', 'id: GEN-001\ntype: adr');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-frontmatter'].check(ctx);
    expect(violations.some((v) => /field order must be/.test(v.message))).toBe(true);
  });

  it('fails when rules: true has no sibling .rules.ts', async () => {
    const files = passingFiles();
    delete files[RULES_PATH];
    const { ctx, violations } = makeCtx(files);
    await rules['adr-frontmatter'].check(ctx);
    expect(violations.some((v) => /sibling.*does not exist/.test(v.message))).toBe(true);
  });
});

describe('adr-required-sections', () => {
  it('passes when all six sections are present', async () => {
    const { ctx, violations } = makeCtx(passingFiles());
    await rules['adr-required-sections'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails when a section is missing', async () => {
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('## References\n\nLinks.\n', '');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-required-sections'].check(ctx);
    expect(violations.some((v) => /missing the mandatory section '## References'/.test(v.message))).toBe(true);
  });
});

describe('adr-claude-rules-symlink', () => {
  it('passes when a scoped ADR has a runtime symlink', async () => {
    const { ctx, violations } = makeCtx(passingFiles(), { symlinks: [LINK_PATH] });
    await rules['adr-claude-rules-symlink'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails when a scoped ADR has no runtime symlink', async () => {
    const { ctx, violations } = makeCtx(passingFiles());
    await rules['adr-claude-rules-symlink'].check(ctx);
    expect(violations.some((v) => /no runtime symlink/.test(v.message))).toBe(true);
  });

  it('fails when the runtime entry is a regular file (a copy), not a symlink', async () => {
    const { ctx, violations } = makeCtx({ ...passingFiles(), [LINK_PATH]: VALID_ADR });
    await rules['adr-claude-rules-symlink'].check(ctx);
    expect(violations.some((v) => /is a regular file/.test(v.message))).toBe(true);
  });

  it('fails when an ADR with empty paths still has a runtime entry', async () => {
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('paths: [".archgate/adrs/**/*.md"]', 'paths: []');
    const { ctx, violations } = makeCtx(files, { symlinks: [LINK_PATH] });
    await rules['adr-claude-rules-symlink'].check(ctx);
    expect(violations.some((v) => /a runtime entry exists/.test(v.message))).toBe(true);
  });

  it('fails on an orphaned ADR-named runtime symlink', async () => {
    const { ctx, violations } = makeCtx(passingFiles(), {
      symlinks: [LINK_PATH, '.claude/rules/gen-999-ghost.md'],
    });
    await rules['adr-claude-rules-symlink'].check(ctx);
    expect(violations.some((v) => /has no backing ADR/.test(v.message))).toBe(true);
  });
});
