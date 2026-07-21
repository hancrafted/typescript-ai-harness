/// <reference path="../rules.d.ts" />

// Sibling test for GEN-002-harness-config.rules.ts — pass and fail path for the
// three envelope rules `config-json-parses`, `config-namespace-registered` and
// `config-spine-valid`, exercised through check(ctx) against an in-memory
// RuleContext. readFile/readJSON serve the root harness config
// .typescript-ai-harness.json: omit everything to model an absent config (both
// throw ENOENT), pass `manifest` for a parseable one, or `brokenJson` for a
// present-but-unparseable one (readFile succeeds, readJSON throws). Canonical
// pass/fail configs come from the shared conformance fixtures, which
// GEN-003-frontmatter.rules.test.ts consumes too — the drift tripwire between
// the spine validator and the block consumer.

import { describe, expect, it } from 'vitest';
import {
  FREE_TOP_LEVEL_CONFIG,
  PAYLOAD_TYPO_CONFIG,
  RETIRED_KEY_CONFIG,
  SPINE_INVALID_CONFIG,
  STRICT_CONFIG,
  UNREGISTERED_BLOCK_CONFIG,
  VALID_CONFIG,
  VERSION_MISMATCH_CONFIG,
} from '../../test/fixtures/harness-config-fixtures';
import ruleSet from './GEN-002-harness-config.rules';

interface Reported {
  message: string;
  file?: string;
}

const CONFIG_PATH = '.typescript-ai-harness.json';

// These rules read only readFile/readJSON at the config path — no glob needed.
function makeCtx(opts?: { manifest?: unknown; brokenJson?: boolean }) {
  const violations: Reported[] = [];
  const warnings: Reported[] = [];
  const present = opts !== undefined && ('manifest' in opts || opts.brokenJson === true);
  const ctx = {
    projectRoot: '/repo',
    scopedFiles: [],
    changedFiles: [],
    async glob() {
      return [];
    },
    async readFile(path: string) {
      if (path === CONFIG_PATH && present) {
        return opts?.brokenJson ? '{ "markdown": ' : JSON.stringify(opts?.manifest);
      }
      throw new Error(`ENOENT: ${path}`);
    },
    async readJSON(path: string) {
      if (path === CONFIG_PATH && present) {
        if (opts?.brokenJson) throw new SyntaxError('Unexpected end of JSON input');
        return opts?.manifest;
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

// A v1 config whose frontmatter block carries the given spine fields.
function block(fields: Record<string, unknown>): unknown {
  return { markdown: { version: 1, frontmatter: fields } };
}

// A v1 config with the given pathRules plus block-level extras.
function entries(pathRules: unknown[], extra: Record<string, unknown> = {}): unknown {
  return block({ pathRules, ...extra });
}

const jsonParses = ruleSet.rules['config-json-parses'];
const namespaceRegistered = ruleSet.rules['config-namespace-registered'];
const spineValid = ruleSet.rules['config-spine-valid'];

describe('config-json-parses', () => {
  it('no-ops when the config file is absent', async () => {
    const { ctx, violations } = makeCtx();
    await jsonParses.check(ctx);
    expect(violations).toEqual([]);
  });

  it('passes a parseable config', async () => {
    const { ctx, violations } = makeCtx({ manifest: VALID_CONFIG });
    await jsonParses.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails a present config that is not parseable JSON', async () => {
    const { ctx, violations } = makeCtx({ brokenJson: true });
    await jsonParses.check(ctx);
    expect(violations.some((v) => /not parseable JSON/.test(v.message))).toBe(true);
  });
});

describe('config-namespace-registered', () => {
  it('passes the canonical valid configs', async () => {
    for (const manifest of [VALID_CONFIG, STRICT_CONFIG, FREE_TOP_LEVEL_CONFIG]) {
      const { ctx, violations } = makeCtx({ manifest });
      await namespaceRegistered.check(ctx);
      expect(violations).toEqual([]);
    }
  });

  it('no-ops when the config file is absent', async () => {
    const { ctx, violations } = makeCtx();
    await namespaceRegistered.check(ctx);
    expect(violations).toEqual([]);
  });

  it('no-ops on unparseable JSON (config-json-parses owns that failure)', async () => {
    const { ctx, violations } = makeCtx({ brokenJson: true });
    await namespaceRegistered.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails when the config root is not a JSON object', async () => {
    const { ctx, violations } = makeCtx({ manifest: [] });
    await namespaceRegistered.check(ctx);
    expect(violations.some((v) => /root must be a JSON object/.test(v.message))).toBe(true);
  });

  it('fails the retired top-level adr key with the rename tombstone', async () => {
    const { ctx, violations } = makeCtx({ manifest: RETIRED_KEY_CONFIG });
    await namespaceRegistered.check(ctx);
    expect(violations.some((v) => /'adr' is retired/.test(v.message) && /markdown/.test(v.message))).toBe(true);
  });

  it('fails when markdown is not a JSON object', async () => {
    const { ctx, violations } = makeCtx({ manifest: { markdown: 'yes' } });
    await namespaceRegistered.check(ctx);
    expect(violations.some((v) => /'markdown' must be a JSON object/.test(v.message))).toBe(true);
  });

  it('fails when markdown lacks the version stamp', async () => {
    const { ctx, violations } = makeCtx({ manifest: { markdown: { frontmatter: { pathRules: [] } } } });
    await namespaceRegistered.check(ctx);
    expect(violations.some((v) => /'markdown.version' is required/.test(v.message))).toBe(true);
  });

  it('fails a non-positive-integer version', async () => {
    for (const version of [0, 1.5, '1']) {
      const { ctx, violations } = makeCtx({ manifest: { markdown: { version } } });
      await namespaceRegistered.check(ctx);
      expect(violations.some((v) => /'markdown.version' must be a positive integer/.test(v.message))).toBe(true);
    }
  });

  it('fails a version this contract does not read, naming the migrate step', async () => {
    const { ctx, violations } = makeCtx({ manifest: VERSION_MISMATCH_CONFIG });
    await namespaceRegistered.check(ctx);
    expect(violations.some((v) => /migrate/.test(v.message))).toBe(true);
  });

  it('fails an unregistered block name (the typo hole)', async () => {
    const { ctx, violations } = makeCtx({ manifest: UNREGISTERED_BLOCK_CONFIG });
    await namespaceRegistered.check(ctx);
    expect(violations.some((v) => /'markdown.frontmater' is not a registered block/.test(v.message))).toBe(true);
  });
});

describe('config-spine-valid', () => {
  it('passes the canonical valid configs', async () => {
    for (const manifest of [VALID_CONFIG, STRICT_CONFIG, FREE_TOP_LEVEL_CONFIG]) {
      const { ctx, violations } = makeCtx({ manifest });
      await spineValid.check(ctx);
      expect(violations).toEqual([]);
    }
  });

  it('passes garbage inside a rule payload — payloads are opaque to the spine', async () => {
    const { ctx, violations } = makeCtx({ manifest: PAYLOAD_TYPO_CONFIG });
    await spineValid.check(ctx);
    expect(violations).toEqual([]);
  });

  it('no-ops when the config file is absent or unparseable', async () => {
    for (const opts of [undefined, { brokenJson: true }]) {
      const { ctx, violations } = makeCtx(opts);
      await spineValid.check(ctx);
      expect(violations).toEqual([]);
    }
  });

  it('fails a registered block that is not a JSON object', async () => {
    const { ctx, violations } = makeCtx({ manifest: { markdown: { version: 1, frontmatter: 'x' } } });
    await spineValid.check(ctx);
    expect(violations.some((v) => /'markdown.frontmatter' must be a JSON object/.test(v.message))).toBe(true);
  });

  it('fails an unknown block-level key (draftEscape belongs under settings now)', async () => {
    const { ctx, violations } = makeCtx({ manifest: entries([{ include: ['x.md'] }], { draftEscape: true }) });
    await spineValid.check(ctx);
    expect(violations.some((v) => /'markdown.frontmatter.draftEscape' is not a spine key/.test(v.message))).toBe(true);
  });

  it('fails an invalid unmatched policy', async () => {
    const { ctx, violations } = makeCtx({ manifest: entries([{ include: ['x.md'] }], { unmatched: 'govern' }) });
    await spineValid.check(ctx);
    expect(violations.some((v) => /unmatched' must be 'exempt' or 'error'/.test(v.message))).toBe(true);
  });

  it("fails unmatched: 'error' without a coverage FileSet", async () => {
    const { ctx, violations } = makeCtx({ manifest: SPINE_INVALID_CONFIG });
    await spineValid.check(ctx);
    expect(violations.some((v) => /requires a coverage FileSet/.test(v.message))).toBe(true);
  });

  it("fails coverage without unmatched: 'error'", async () => {
    const { ctx, violations } = makeCtx({
      manifest: entries([{ include: ['x.md'] }], { coverage: { include: ['**/*.md'] } }),
    });
    await spineValid.check(ctx);
    expect(violations.some((v) => /coverage' is only meaningful with unmatched: 'error'/.test(v.message))).toBe(true);
  });

  it('fails a coverage FileSet with no include', async () => {
    const { ctx, violations } = makeCtx({
      manifest: entries([{ include: ['x.md'] }], { unmatched: 'error', coverage: {} }),
    });
    await spineValid.check(ctx);
    expect(violations.some((v) => /coverage\.include' must be a non-empty array/.test(v.message))).toBe(true);
  });

  it('fails a coverage FileSet with an unknown key', async () => {
    const { ctx, violations } = makeCtx({
      manifest: entries([{ include: ['x.md'] }], {
        unmatched: 'error',
        coverage: { include: ['**/*.md'], matches: [] },
      }),
    });
    await spineValid.check(ctx);
    expect(violations.some((v) => /'markdown.frontmatter.coverage.matches' is not a FileSet key/.test(v.message))).toBe(
      true,
    );
  });

  it('fails a non-object settings', async () => {
    const { ctx, violations } = makeCtx({ manifest: entries([{ include: ['x.md'] }], { settings: 'yes' }) });
    await spineValid.check(ctx);
    expect(violations.some((v) => /settings' must be a JSON object/.test(v.message))).toBe(true);
  });

  it('fails a missing or non-array pathRules', async () => {
    for (const fields of [{}, { pathRules: 'nope' }]) {
      const { ctx, violations } = makeCtx({ manifest: block(fields) });
      await spineValid.check(ctx);
      expect(violations.some((v) => /pathRules' must be an array/.test(v.message))).toBe(true);
    }
  });

  it('fails a non-object entry', async () => {
    const { ctx, violations } = makeCtx({ manifest: entries(['x.md']) });
    await spineValid.check(ctx);
    expect(violations.some((v) => /pathRules\[0\]' must be an object/.test(v.message))).toBe(true);
  });

  it("fails an unknown entry key (old flat domain keys belong under 'rule')", async () => {
    const { ctx, violations } = makeCtx({ manifest: entries([{ include: ['x.md'], allowedTypes: ['a'] }]) });
    await spineValid.check(ctx);
    expect(
      violations.some((v) => /allowedTypes' is not a spine entry key/.test(v.message) && /'rule'/.test(v.message)),
    ).toBe(true);
  });

  it("fails the retired 'match' key with the rename tombstone", async () => {
    const { ctx, violations } = makeCtx({ manifest: entries([{ match: 'x.md' }]) });
    await spineValid.check(ctx);
    expect(violations.some((v) => /match' is retired/.test(v.message) && /include/.test(v.message))).toBe(true);
  });

  it('fails a missing, empty, or non-array include', async () => {
    for (const entry of [{}, { include: [] }, { include: 'x.md' }, { include: ['ok', ''] }]) {
      const { ctx, violations } = makeCtx({ manifest: entries([entry]) });
      await spineValid.check(ctx);
      expect(
        violations.some((v) => /include' must be a non-empty array of non-empty glob strings/.test(v.message)),
      ).toBe(true);
    }
  });

  it('fails an invalid exclude', async () => {
    for (const exclude of [[], [1], 'x.md']) {
      const { ctx, violations } = makeCtx({ manifest: entries([{ include: ['x.md'], exclude }]) });
      await spineValid.check(ctx);
      expect(
        violations.some((v) => /exclude' must be a non-empty array of non-empty glob strings/.test(v.message)),
      ).toBe(true);
    }
  });

  it('fails a non-boolean exempt', async () => {
    const { ctx, violations } = makeCtx({ manifest: entries([{ include: ['x.md'], exempt: 'yes' }]) });
    await spineValid.check(ctx);
    expect(violations.some((v) => /exempt' must be a boolean/.test(v.message))).toBe(true);
  });

  it("fails an exempt entry that carries 'rule'", async () => {
    const { ctx, violations } = makeCtx({ manifest: entries([{ include: ['x.md'], exempt: true, rule: {} }]) });
    await spineValid.check(ctx);
    expect(violations.some((v) => /must not carry 'rule'/.test(v.message))).toBe(true);
  });

  it("fails an exempt entry that carries 'severity'", async () => {
    const { ctx, violations } = makeCtx({
      manifest: entries([{ include: ['x.md'], exempt: true, severity: 'error' }]),
    });
    await spineValid.check(ctx);
    expect(violations.some((v) => /must not carry 'severity'/.test(v.message))).toBe(true);
  });

  it('fails an invalid entry tier', async () => {
    const { ctx, violations } = makeCtx({ manifest: entries([{ include: ['x.md'], severity: 'fatal' }]) });
    await spineValid.check(ctx);
    expect(violations.some((v) => /severity' must be 'error' or 'warning'/.test(v.message))).toBe(true);
  });

  it('fails a non-object rule payload', async () => {
    const { ctx, violations } = makeCtx({ manifest: entries([{ include: ['x.md'], rule: 'strict' }]) });
    await spineValid.check(ctx);
    expect(violations.some((v) => /rule' must be a JSON object/.test(v.message))).toBe(true);
  });
});
