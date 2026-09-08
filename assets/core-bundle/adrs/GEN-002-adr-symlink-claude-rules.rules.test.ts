/// <reference path="../rules.d.ts" />

// Sibling test for GEN-002-adr-symlink-claude-rules.rules.ts — pass and fail path
// for the single rule, in both directions (missing entry and orphan entry).

import { describe, expect, it } from 'vitest';
import ruleSet from './GEN-002-adr-symlink-claude-rules.rules';

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
function makeCtx(files: Record<string, string>, opts?: { symlinks?: string[] }) {
  const violations: Reported[] = [];
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
    report: {
      violation: (d: Reported) => violations.push(d),
      warning: () => {},
      info: () => {},
    },
  } as unknown as RuleContext;
  return { ctx, violations };
}

const ADR_PATH = '.archgate/adrs/GEN-002-adr-symlink-claude-rules.md';
const LINK_PATH = '.claude/rules/gen-002-adr-symlink-claude-rules.md';

const SCOPED_ADR = `---
type: adr
id: GEN-002
title: "ADR Symlink for Claude Code Rules"
domain: general
rules: true
files: [".archgate/adrs/**/*.md"]
paths: [".archgate/adrs/**/*.md"]
---

# ADR Symlink for Claude Code Rules
`;

function passingFiles(): Record<string, string> {
  return { [ADR_PATH]: SCOPED_ADR };
}

// Every message the rule can emit, named here so an assertion below reads as a
// claim about the rule rather than a regex a reader has to decode. Joining the
// messages before matching keeps the failure output rich: it prints what the
// rule DID say, which `.some(...)` collapsed to a bare `false`.
const NO_SYMLINK = /no runtime symlink/;
const UNSCOPED_ENTRY = /a runtime entry exists/;
const ORPHAN_ENTRY = /has no backing ADR/;
const PROVENANCE = '(GEN-002 [adr-claude-rules-symlink])';

const rule = ruleSet.rules['adr-claude-rules-symlink'];

const messagesOf = (violations: Reported[]) => violations.map((v) => v.message).join('\n');

describe('adr-claude-rules-symlink', () => {
  it('passes when a scoped ADR has a runtime symlink', async () => {
    // ARRANGE
    const { ctx, violations } = makeCtx(passingFiles(), { symlinks: [LINK_PATH] });
    // ACT
    await rule.check(ctx);
    // ASSERT
    expect(violations).toEqual([]);
  });

  it('fails when a scoped ADR has no runtime symlink', async () => {
    // ARRANGE
    const { ctx, violations } = makeCtx(passingFiles());
    // ACT
    await rule.check(ctx);
    // ASSERT
    expect(messagesOf(violations)).toMatch(NO_SYMLINK);
  });

  it('fails when an ADR with empty paths still has a runtime entry', async () => {
    // ARRANGE
    const files = passingFiles();
    files[ADR_PATH] = SCOPED_ADR.replace('paths: [".archgate/adrs/**/*.md"]', 'paths: []');
    const { ctx, violations } = makeCtx(files, { symlinks: [LINK_PATH] });
    // ACT
    await rule.check(ctx);
    // ASSERT
    expect(messagesOf(violations)).toMatch(UNSCOPED_ENTRY);
  });

  it('fails on an orphaned ADR-named runtime symlink', async () => {
    // ARRANGE
    const { ctx, violations } = makeCtx(passingFiles(), {
      symlinks: [LINK_PATH, '.claude/rules/gen-999-ghost.md'],
    });
    // ACT
    await rule.check(ctx);
    // ASSERT
    expect(messagesOf(violations)).toMatch(ORPHAN_ENTRY);
  });

  it('leaves a hand-written, non-ADR-named rule file alone', async () => {
    // ARRANGE
    const { ctx, violations } = makeCtx(passingFiles(), {
      symlinks: [LINK_PATH, '.claude/rules/house-style.md'],
    });
    // ACT
    await rule.check(ctx);
    // ASSERT
    expect(violations).toEqual([]);
  });

  it('carries the GEN-002 provenance tag in its messages', async () => {
    // ARRANGE
    const { ctx, violations } = makeCtx(passingFiles());
    // ACT
    await rule.check(ctx);
    // ASSERT
    expect(messagesOf(violations)).toContain(PROVENANCE);
  });
});
