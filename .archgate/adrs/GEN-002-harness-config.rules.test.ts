/// <reference path="../rules.d.ts" />

// Sibling test for GEN-002-harness-config.rules.ts — pass and fail path for the
// single rule `frontmatter-config-valid`, exercised through check(ctx) against
// an in-memory RuleContext. readJSON serves the root harness config
// .typescript-ai-harness.json; omit it entirely to model an absent config
// (readJSON throws ENOENT), which the rule must no-op on.

import { describe, expect, it } from 'vitest';
import ruleSet from './GEN-002-harness-config.rules';

interface Reported {
  message: string;
  file?: string;
}

// This rule reads only readJSON at the config path — no glob/readFile needed —
// but the seam mirrors the sibling floor test's makeCtx for consistency.
function makeCtx(opts?: { manifest?: unknown }) {
  const violations: Reported[] = [];
  const warnings: Reported[] = [];
  const ctx = {
    projectRoot: '/repo',
    scopedFiles: [],
    changedFiles: [],
    async glob() {
      return [];
    },
    async readFile(path: string) {
      throw new Error(`ENOENT: ${path}`);
    },
    async readJSON(path: string) {
      if (path === '.typescript-ai-harness.json') {
        if (opts && 'manifest' in opts) return opts.manifest;
        throw new Error('ENOENT: .typescript-ai-harness.json');
      }
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

// Build a harness config whose adr.frontmatter carries the given pathRules plus
// any extras (unmatched, draftEscape).
function manifest(pathRules: unknown[], extra: Record<string, unknown> = {}): unknown {
  return { adr: { frontmatter: { pathRules, ...extra } } };
}

const configValid = ruleSet.rules['frontmatter-config-valid'];

describe('frontmatter-config-valid', () => {
  const goodManifest = manifest(
    [
      { match: 'docs/adr/*.md', allowedTypes: ['design-adr'], label: 'title' },
      { match: '.claude/agents/*.md', allowedTypes: ['agent'], label: 'name', maxDescription: 4096 },
      { match: '.agents/**', exempt: true },
      { match: ['README.md', 'AGENTS.md'], label: 'title', severity: 'warning' },
    ],
    { unmatched: 'exempt', draftEscape: true },
  );

  it('passes a well-formed harness config', async () => {
    const { ctx, violations } = makeCtx({ manifest: goodManifest });
    await configValid.check(ctx);
    expect(violations).toEqual([]);
  });

  it('no-ops when the config file is absent', async () => {
    const { ctx, violations } = makeCtx();
    await configValid.check(ctx);
    expect(violations).toEqual([]);
  });

  it('no-ops when adr.frontmatter is absent', async () => {
    const { ctx, violations } = makeCtx({ manifest: { adr: {} } });
    await configValid.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails when pathRules is not an array', async () => {
    const { ctx, violations } = makeCtx({ manifest: { adr: { frontmatter: { pathRules: 'nope' } } } });
    await configValid.check(ctx);
    expect(violations.some((v) => /pathRules must be an array/.test(v.message))).toBe(true);
  });

  it('fails when an entry lacks a match glob', async () => {
    const { ctx, violations } = makeCtx({ manifest: manifest([{ label: 'title' }]) });
    await configValid.check(ctx);
    expect(violations.some((v) => /match must be a non-empty glob/.test(v.message))).toBe(true);
  });

  it('fails on an invalid label', async () => {
    const { ctx, violations } = makeCtx({ manifest: manifest([{ match: 'x.md', label: 'heading' }]) });
    await configValid.check(ctx);
    expect(violations.some((v) => /label must be 'name' or 'title'/.test(v.message))).toBe(true);
  });

  it('fails on an invalid entry tier', async () => {
    const { ctx, violations } = makeCtx({ manifest: manifest([{ match: 'x.md', severity: 'fatal' }]) });
    await configValid.check(ctx);
    expect(violations.some((v) => /\.severity must be 'error' or 'warning'/.test(v.message))).toBe(true);
  });

  it('fails on non-kebab allowedTypes', async () => {
    const { ctx, violations } = makeCtx({ manifest: manifest([{ match: 'x.md', allowedTypes: ['Design ADR'] }]) });
    await configValid.check(ctx);
    expect(violations.some((v) => /allowedTypes must be an array of kebab/.test(v.message))).toBe(true);
  });

  it('fails on a non-integer maxDescription', async () => {
    const { ctx, violations } = makeCtx({ manifest: manifest([{ match: 'x.md', maxDescription: -3 }]) });
    await configValid.check(ctx);
    expect(violations.some((v) => /maxDescription must be a positive integer/.test(v.message))).toBe(true);
  });

  it('fails on a non-integer maxLabel', async () => {
    const { ctx, violations } = makeCtx({ manifest: manifest([{ match: 'x.md', maxLabel: 12.5 }]) });
    await configValid.check(ctx);
    expect(violations.some((v) => /maxLabel must be a positive integer/.test(v.message))).toBe(true);
  });

  it('fails on a non-boolean exempt', async () => {
    const { ctx, violations } = makeCtx({ manifest: manifest([{ match: 'x.md', exempt: 'yes' }]) });
    await configValid.check(ctx);
    expect(violations.some((v) => /exempt must be a boolean/.test(v.message))).toBe(true);
  });

  it('fails on an invalid unmatched default', async () => {
    const { ctx, violations } = makeCtx({ manifest: manifest([{ match: 'x.md' }], { unmatched: 'govern' }) });
    await configValid.check(ctx);
    expect(violations.some((v) => /unmatched must be 'exempt'/.test(v.message))).toBe(true);
  });

  it('fails on a non-boolean draftEscape', async () => {
    const { ctx, violations } = makeCtx({ manifest: manifest([{ match: 'x.md' }], { draftEscape: 'yes' }) });
    await configValid.check(ctx);
    expect(violations.some((v) => /draftEscape must be a boolean/.test(v.message))).toBe(true);
  });
});
