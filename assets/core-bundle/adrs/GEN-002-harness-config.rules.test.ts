/// <reference path="../rules.d.ts" />

// Sibling test for GEN-002-harness-config.rules.ts — pass and fail path for
// the four envelope rules `config-json-parses`, `config-extension-fenced`,
// `config-version` and `config-shape-valid`, exercised through check(ctx)
// against an in-memory RuleContext. readFile/readJSON serve three paths: the
// root harness config .typescript-ai-harness.json (omit `config` to model an
// absent one, pass `brokenJson` for a present-but-unparseable one), the config
// extension .archgate/harness-config-extension.d.ts (defaults to a canonical
// two-fence source; pass `extension` to override, `null` to model absence),
// and package.json (defaults to the fixtures' MOCK_HARNESS_VERSION — deliberately
// not this repo's real version — `null` models an unreadable one; its `name`
// defaults to the harness's own so config-version's equality check fires, and a
// foreign target overrides `packageName`). Canonical
// pass/fail configs come from the shared conformance fixtures, which
// GEN-003-frontmatter.rules.test.ts consumes too — the drift tripwire between
// the envelope validator and the block consumer. A final suite runs the rules
// against the REAL repo files, so breaking the live extension fences, config,
// or version stamp fails here as well as in archgate check.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEPTH_VIOLATION_CONFIG,
  EXCLUDE_FILES_LITERAL_INCLUDE_CONFIG,
  MOCK_HARNESS_VERSION,
  PAYLOAD_TYPO_CONFIG,
  RETIRED_KEY_CONFIG,
  SPINE_INVALID_CONFIG,
  STRICT_CONFIG,
  UNDECLARED_BLOCK_CONFIG,
  UNDECLARED_NAMESPACE_CONFIG,
  VALID_CONFIG,
  VERSION_MALFORMED_CONFIG,
  VERSION_MISMATCH_CONFIG,
  VERSION_MISSING_CONFIG,
} from '../harness-config-fixtures';
import ruleSet from './GEN-002-harness-config.rules';

interface Reported {
  message: string;
  file?: string;
}

const CONFIG_PATH = '.typescript-ai-harness.json';
const PACKAGE_JSON = 'package.json';
const EXTENSION_DTS = '.archgate/harness-config-extension.d.ts';
// The harness's own package name — the identity that makes config-version's
// equality check fire. The mock's package.json defaults to it (the dogfood/self
// case); a foreign target overrides `packageName`.
const HARNESS_PACKAGE_NAME = '@hancrafted/typescript-ai-harness';

// A canonical extension source: two fences from two owning ADRs. The second
// declares a block no test config carries — a declared path absent from the
// config is always fine (the owner's built-in default applies).
const VALID_EXTENSION = [
  '/// <reference path="./harness-config-core.d.ts" />',
  'declare namespace Harness {',
  '  // GEN-003-START: markdown.frontmatter',
  '  interface FrontmatterRule {',
  '    allowedTypes?: string[];',
  '  }',
  '  interface Markdown {',
  '    frontmatter?: ConfigBlock<FrontmatterRule>;',
  '  }',
  '  interface Config {',
  '    markdown?: Markdown;',
  '  }',
  '  // GEN-003-END',
  '  // GEN-009-START: markdown.links',
  '  interface Links {',
  '    links?: ConfigBlock;',
  '  }',
  '  // GEN-009-END',
  '}',
].join('\n');

// These rules read only readFile/readJSON at the three paths — no glob needed.
function makeCtx(opts?: {
  config?: unknown;
  brokenJson?: boolean;
  extension?: string | null;
  packageVersion?: string | null;
  packageName?: string | null;
}) {
  const violations: Reported[] = [];
  const warnings: Reported[] = [];
  const configPresent = opts !== undefined && ('config' in opts || opts.brokenJson === true);
  const extension = opts?.extension === undefined ? VALID_EXTENSION : opts.extension;
  const packageVersion = opts?.packageVersion === undefined ? MOCK_HARNESS_VERSION : opts.packageVersion;
  // Defaults to the harness's own name so equality-check tests model the
  // dogfood/self case; a foreign target passes a different name (or null for a
  // nameless package.json), which makes harnessSelfVersion return null and the
  // equality check skip.
  const packageName = opts?.packageName === undefined ? HARNESS_PACKAGE_NAME : opts.packageName;
  const ctx = {
    projectRoot: '/repo',
    scopedFiles: [],
    changedFiles: [],
    async glob() {
      return [];
    },
    async readFile(path: string) {
      if (path === CONFIG_PATH && configPresent) {
        return opts?.brokenJson ? '{ "markdown": ' : JSON.stringify(opts?.config);
      }
      if (path === EXTENSION_DTS && extension !== null) return extension;
      throw new Error(`ENOENT: ${path}`);
    },
    async readJSON(path: string) {
      if (path === CONFIG_PATH && configPresent) {
        if (opts?.brokenJson) throw new SyntaxError('Unexpected end of JSON input');
        return opts?.config;
      }
      if (path === PACKAGE_JSON && packageVersion !== null) {
        return packageName === null ? { version: packageVersion } : { name: packageName, version: packageVersion };
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

// A config at the mock harness version whose frontmatter block carries the
// given spine fields.
function block(fields: Record<string, unknown>): unknown {
  return { version: MOCK_HARNESS_VERSION, markdown: { frontmatter: fields } };
}

// Such a config with the given pathRules plus block-level extras.
function entries(pathRules: unknown[], extra: Record<string, unknown> = {}): unknown {
  return block({ pathRules, ...extra });
}

const jsonParses = ruleSet.rules['config-json-parses'];
const extensionFenced = ruleSet.rules['config-extension-fenced'];
const configVersion = ruleSet.rules['config-version'];
const shapeValid = ruleSet.rules['config-shape-valid'];

describe('config-json-parses', () => {
  it('no-ops when the config file is absent', async () => {
    const { ctx, violations } = makeCtx();
    await jsonParses.check(ctx);
    expect(violations).toEqual([]);
  });

  it('passes a parseable config', async () => {
    const { ctx, violations } = makeCtx({ config: VALID_CONFIG });
    await jsonParses.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails a present config that is not parseable JSON', async () => {
    const { ctx, violations } = makeCtx({ brokenJson: true });
    await jsonParses.check(ctx);
    expect(violations.some((v) => /not parseable JSON/.test(v.message))).toBe(true);
  });
});

describe('config-extension-fenced', () => {
  // A minimal extension around the given marker lines — the grammar cases
  // below vary only the fences.
  function extensionWith(...lines: string[]): string {
    return ['declare namespace Harness {', ...lines.map((l) => `  ${l}`), '}'].join('\n');
  }

  it('passes the canonical two-fence extension', async () => {
    const { ctx, violations } = makeCtx({});
    await extensionFenced.check(ctx);
    expect(violations).toEqual([]);
  });

  it('no-ops when the extension file is absent', async () => {
    const { ctx, violations } = makeCtx({ extension: null });
    await extensionFenced.check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails a START that declares no block path', async () => {
    const { ctx, violations } = makeCtx({ extension: extensionWith('// GEN-003-START', '// GEN-003-END') });
    await extensionFenced.check(ctx);
    expect(violations.some((v) => /must declare its block path/.test(v.message))).toBe(true);
  });

  it('fails a malformed block path', async () => {
    for (const path of ['markdown', 'markdown.frontmatter.extra', 'Markdown.frontmatter', 'markdown.front-matter']) {
      const { ctx, violations } = makeCtx({
        extension: extensionWith(`// GEN-003-START: ${path}`, '// GEN-003-END'),
      });
      await extensionFenced.check(ctx);
      expect(violations.some((v) => /must declare its block path/.test(v.message))).toBe(true);
    }
  });

  it('fails an END without a matching START', async () => {
    const { ctx, violations } = makeCtx({ extension: extensionWith('// GEN-003-END') });
    await extensionFenced.check(ctx);
    expect(violations.some((v) => /closes without a matching 'GEN-003-START'/.test(v.message))).toBe(true);
  });

  it('fails a fence that is never closed', async () => {
    const { ctx, violations } = makeCtx({ extension: extensionWith('// GEN-003-START: markdown.frontmatter') });
    await extensionFenced.check(ctx);
    expect(violations.some((v) => /is never closed/.test(v.message))).toBe(true);
  });

  it('fails a fence opening inside another fence', async () => {
    const { ctx, violations } = makeCtx({
      extension: extensionWith(
        '// GEN-003-START: markdown.frontmatter',
        '// GEN-009-START: markdown.links',
        '// GEN-009-END',
        '// GEN-003-END',
      ),
    });
    await extensionFenced.check(ctx);
    expect(violations.some((v) => /fences never nest or overlap/.test(v.message))).toBe(true);
  });

  it('fails an END whose ADR id differs from the open START', async () => {
    const { ctx, violations } = makeCtx({
      extension: extensionWith('// GEN-003-START: markdown.frontmatter', '// GEN-009-END'),
    });
    await extensionFenced.check(ctx);
    expect(violations.some((v) => /must carry the same ADR id/.test(v.message))).toBe(true);
  });

  it('fails a path declared by two fences', async () => {
    const { ctx, violations } = makeCtx({
      extension: extensionWith(
        '// GEN-003-START: markdown.frontmatter',
        '// GEN-003-END',
        '// GEN-009-START: markdown.frontmatter',
        '// GEN-009-END',
      ),
    });
    await extensionFenced.check(ctx);
    expect(
      violations.some((v) => /re-declares 'markdown.frontmatter'.*one owning fence per block/.test(v.message)),
    ).toBe(true);
  });

  it('fails an END with trailing content', async () => {
    const { ctx, violations } = makeCtx({
      extension: extensionWith('// GEN-003-START: markdown.frontmatter', '// GEN-003-END: markdown.frontmatter'),
    });
    await extensionFenced.check(ctx);
    expect(violations.some((v) => /trailing content after the END marker/.test(v.message))).toBe(true);
  });
});

describe('config-version', () => {
  it('passes the canonical valid configs', async () => {
    for (const config of [VALID_CONFIG, STRICT_CONFIG]) {
      const { ctx, violations } = makeCtx({ config });
      await configVersion.check(ctx);
      expect(violations).toEqual([]);
    }
  });

  it('no-ops when the config is absent, unparseable, or a non-object root', async () => {
    for (const opts of [undefined, { brokenJson: true }, { config: [] }]) {
      const { ctx, violations } = makeCtx(opts);
      await configVersion.check(ctx);
      expect(violations).toEqual([]);
    }
  });

  it('fails a config without the version stamp', async () => {
    for (const config of [VERSION_MISSING_CONFIG, RETIRED_KEY_CONFIG]) {
      const { ctx, violations } = makeCtx({ config });
      await configVersion.check(ctx);
      expect(violations.some((v) => /'version' is required/.test(v.message))).toBe(true);
    }
  });

  it('fails a non-string or non-semver version (the retired integer stamp included)', async () => {
    for (const version of [1, 0.1, true, 'banana', 'v1.2.3', '1.2']) {
      const { ctx, violations } = makeCtx({ config: { version } });
      await configVersion.check(ctx);
      expect(violations.some((v) => /'version' must be a semver string/.test(v.message))).toBe(true);
    }
  });

  it('fails a version stamped for another harness release, naming the migrate step', async () => {
    const { ctx, violations } = makeCtx({ config: VERSION_MISMATCH_CONFIG });
    await configVersion.check(ctx);
    expect(violations.some((v) => /'9\.9\.9'.*'1\.2\.3'.*migrate/.test(v.message))).toBe(true);
  });

  it('reads the harness release from package.json, never a hardcoded constant', async () => {
    const { ctx, violations } = makeCtx({ config: VERSION_MISMATCH_CONFIG, packageVersion: '9.9.9' });
    await configVersion.check(ctx);
    expect(violations).toEqual([]);
  });

  it('skips the equality check when package.json yields no version — never guesses', async () => {
    const { ctx, violations } = makeCtx({ config: VERSION_MISMATCH_CONFIG, packageVersion: null });
    await configVersion.check(ctx);
    expect(violations).toEqual([]);
  });

  it('still requires the stamp itself when package.json yields no version', async () => {
    const { ctx, violations } = makeCtx({ config: VERSION_MISSING_CONFIG, packageVersion: null });
    await configVersion.check(ctx);
    expect(violations.some((v) => /'version' is required/.test(v.message))).toBe(true);
  });

  it('still enforces the semver shape when package.json yields no version', async () => {
    const { ctx, violations } = makeCtx({ config: VERSION_MALFORMED_CONFIG, packageVersion: null });
    await configVersion.check(ctx);
    expect(violations.some((v) => /'version' must be a semver string/.test(v.message))).toBe(true);
  });

  it('skips the equality check in a foreign target — package.json is not the harness', async () => {
    // The install case: config stamped with the harness release, but the target
    // app's package.json is its own (mismatched) version. Equality must not fire.
    for (const packageName of ['some-target-app', null]) {
      const { ctx, violations } = makeCtx({ config: VERSION_MISMATCH_CONFIG, packageName, packageVersion: '0.0.0' });
      await configVersion.check(ctx);
      expect(violations).toEqual([]);
    }
  });

  it('still requires the stamp and semver shape in a foreign target', async () => {
    const missing = makeCtx({
      config: VERSION_MISSING_CONFIG,
      packageName: 'some-target-app',
      packageVersion: '0.0.0',
    });
    await configVersion.check(missing.ctx);
    expect(missing.violations.some((v) => /'version' is required/.test(v.message))).toBe(true);

    const malformed = makeCtx({
      config: VERSION_MALFORMED_CONFIG,
      packageName: 'some-target-app',
      packageVersion: '0.0.0',
    });
    await configVersion.check(malformed.ctx);
    expect(malformed.violations.some((v) => /'version' must be a semver string/.test(v.message))).toBe(true);
  });
});

describe('config-shape-valid', () => {
  it('passes the canonical valid configs', async () => {
    for (const config of [VALID_CONFIG, STRICT_CONFIG]) {
      const { ctx, violations } = makeCtx({ config });
      await shapeValid.check(ctx);
      expect(violations).toEqual([]);
    }
  });

  it('passes garbage inside a rule payload — payloads are opaque to the spine', async () => {
    const { ctx, violations } = makeCtx({ config: PAYLOAD_TYPO_CONFIG });
    await shapeValid.check(ctx);
    expect(violations).toEqual([]);
  });

  it('no-ops when the config file is absent or unparseable', async () => {
    for (const opts of [undefined, { brokenJson: true }]) {
      const { ctx, violations } = makeCtx(opts);
      await shapeValid.check(ctx);
      expect(violations).toEqual([]);
    }
  });

  it('fails when the config root is not a JSON object', async () => {
    const { ctx, violations } = makeCtx({ config: [] });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /root must be a JSON object/.test(v.message))).toBe(true);
  });

  it('fails a namespace whose value is not an object of blocks', async () => {
    const { ctx, violations } = makeCtx({ config: { version: MOCK_HARNESS_VERSION, markdown: 'yes' } });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /'markdown' must be a namespace object holding config blocks/.test(v.message))).toBe(
      true,
    );
  });

  it('fails a block key no fence declares (the typo hole)', async () => {
    const { ctx, violations } = makeCtx({ config: UNDECLARED_BLOCK_CONFIG });
    await shapeValid.check(ctx);
    expect(
      violations.some(
        (v) => /'markdown.frontmater' matches no block/.test(v.message) && /markdown.frontmatter/.test(v.message),
      ),
    ).toBe(true);
  });

  it('fails a namespace no fence declares — the extension file is the whole registry', async () => {
    const { ctx, violations } = makeCtx({ config: UNDECLARED_NAMESPACE_CONFIG });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /'acmeGovernance.reviewers' matches no block/.test(v.message))).toBe(true);
  });

  it("fails the retired pre-restructure 'adr' namespace as undeclared", async () => {
    const { ctx, violations } = makeCtx({ config: RETIRED_KEY_CONFIG });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /'adr.frontmatter' matches no block/.test(v.message))).toBe(true);
  });

  it('fails every present block as undeclared when the extension file is absent', async () => {
    const { ctx, violations } = makeCtx({ config: VALID_CONFIG, extension: null });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /'markdown.frontmatter' matches no block/.test(v.message))).toBe(true);
  });

  it('fails a third key level below the block (the depth guard)', async () => {
    const { ctx, violations } = makeCtx({ config: DEPTH_VIOLATION_CONFIG });
    await shapeValid.check(ctx);
    expect(
      violations.some((v) => /'markdown.frontmatter.frontmatter' is not a spine key/.test(v.message)) &&
        violations.some((v) => /'markdown.frontmatter.pathRules' must be an array/.test(v.message)),
    ).toBe(true);
  });

  it('fails a declared block that is not a JSON object', async () => {
    const { ctx, violations } = makeCtx({ config: { version: MOCK_HARNESS_VERSION, markdown: { frontmatter: 'x' } } });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /'markdown.frontmatter' must be a JSON object/.test(v.message))).toBe(true);
  });

  it('fails an unknown block-level key (draftEscape belongs under settings)', async () => {
    const { ctx, violations } = makeCtx({ config: entries([{ include: ['x.md'] }], { draftEscape: true }) });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /'markdown.frontmatter.draftEscape' is not a spine key/.test(v.message))).toBe(true);
  });

  it('fails an invalid unmatched policy', async () => {
    const { ctx, violations } = makeCtx({ config: entries([{ include: ['x.md'] }], { unmatched: 'govern' }) });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /unmatched' must be 'exempt' or 'error'/.test(v.message))).toBe(true);
  });

  it("fails unmatched: 'error' without a coverage FileSet", async () => {
    const { ctx, violations } = makeCtx({ config: SPINE_INVALID_CONFIG });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /requires a coverage FileSet/.test(v.message))).toBe(true);
  });

  it("fails coverage without unmatched: 'error'", async () => {
    const { ctx, violations } = makeCtx({
      config: entries([{ include: ['x.md'] }], { coverage: { include: ['**/*.md'] } }),
    });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /coverage' is only meaningful with unmatched: 'error'/.test(v.message))).toBe(true);
  });

  it('fails a non-object coverage FileSet', async () => {
    const { ctx, violations } = makeCtx({
      config: entries([{ include: ['x.md'] }], { unmatched: 'error', coverage: 'docs/**' }),
    });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /coverage' must be a FileSet object/.test(v.message))).toBe(true);
  });

  it('fails a coverage FileSet with no include', async () => {
    const { ctx, violations } = makeCtx({
      config: entries([{ include: ['x.md'] }], { unmatched: 'error', coverage: {} }),
    });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /coverage\.include' must be a non-empty array/.test(v.message))).toBe(true);
  });

  it('fails a coverage FileSet with an unknown key', async () => {
    const { ctx, violations } = makeCtx({
      config: entries([{ include: ['x.md'] }], {
        unmatched: 'error',
        coverage: { include: ['**/*.md'], matches: [] },
      }),
    });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /'markdown.frontmatter.coverage.matches' is not a FileSet key/.test(v.message))).toBe(
      true,
    );
  });

  it('fails a non-object settings', async () => {
    const { ctx, violations } = makeCtx({ config: entries([{ include: ['x.md'] }], { settings: 'yes' }) });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /settings' must be a JSON object/.test(v.message))).toBe(true);
  });

  it('fails a missing or non-array pathRules', async () => {
    for (const fields of [{}, { pathRules: 'nope' }]) {
      const { ctx, violations } = makeCtx({ config: block(fields) });
      await shapeValid.check(ctx);
      expect(violations.some((v) => /pathRules' must be an array/.test(v.message))).toBe(true);
    }
  });

  it('fails a non-object entry', async () => {
    const { ctx, violations } = makeCtx({ config: entries(['x.md']) });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /pathRules\[0\]' must be an object/.test(v.message))).toBe(true);
  });

  it("fails an unknown entry key (flat domain keys belong under 'rule')", async () => {
    for (const entry of [
      { include: ['x.md'], allowedTypes: ['a'] },
      { match: 'x.md', include: ['x.md'] }, // the retired pre-restructure 'match' key
    ]) {
      const { ctx, violations } = makeCtx({ config: entries([entry]) });
      await shapeValid.check(ctx);
      expect(violations.some((v) => /is not a spine entry key/.test(v.message) && /'rule'/.test(v.message))).toBe(true);
    }
  });

  it('fails a missing, empty, or non-array include', async () => {
    for (const entry of [{}, { include: [] }, { include: 'x.md' }, { include: ['ok', ''] }]) {
      const { ctx, violations } = makeCtx({ config: entries([entry]) });
      await shapeValid.check(ctx);
      expect(
        violations.some((v) => /include' must be a non-empty array of non-empty glob strings/.test(v.message)),
      ).toBe(true);
    }
  });

  it('fails an invalid excludeFiles (wrong shape or a wildcard)', async () => {
    for (const excludeFiles of [[], [1], 'x.md', ['docs/*.md']]) {
      const { ctx, violations } = makeCtx({ config: entries([{ include: ['docs/**/*.md'], excludeFiles }]) });
      await shapeValid.check(ctx);
      expect(
        violations.some((v) =>
          /excludeFiles' must be a non-empty array of non-empty literal file paths/.test(v.message),
        ),
      ).toBe(true);
    }
  });

  it('fails excludeFiles paired with a wildcard-free include', async () => {
    const { ctx, violations } = makeCtx({ config: EXCLUDE_FILES_LITERAL_INCLUDE_CONFIG });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /excludeFiles' is only meaningful when .* has a wildcard/.test(v.message))).toBe(
      true,
    );
  });

  it('accepts excludeFiles listing a literal file when the include carries a wildcard', async () => {
    const { ctx, violations } = makeCtx({
      config: entries([{ include: ['docs/**/*.md'], excludeFiles: ['docs/index.md'] }]),
    });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /excludeFiles/.test(v.message))).toBe(false);
  });

  it('fails a coverage excludeFiles paired with a wildcard-free include', async () => {
    const { ctx, violations } = makeCtx({
      config: entries([{ include: ['docs/**/*.md'] }], {
        unmatched: 'error',
        coverage: { include: ['README.md'], excludeFiles: ['README.md'] },
      }),
    });
    await shapeValid.check(ctx);
    expect(
      violations.some((v) => /coverage\.excludeFiles' is only meaningful when .* has a wildcard/.test(v.message)),
    ).toBe(true);
  });

  it('fails a non-boolean exempt', async () => {
    const { ctx, violations } = makeCtx({ config: entries([{ include: ['x.md'], exempt: 'yes' }]) });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /exempt' must be a boolean/.test(v.message))).toBe(true);
  });

  it("fails an exempt entry that carries 'rule'", async () => {
    const { ctx, violations } = makeCtx({ config: entries([{ include: ['x.md'], exempt: true, rule: {} }]) });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /must not carry 'rule'/.test(v.message))).toBe(true);
  });

  it("fails an exempt entry that carries 'severity'", async () => {
    const { ctx, violations } = makeCtx({
      config: entries([{ include: ['x.md'], exempt: true, severity: 'error' }]),
    });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /must not carry 'severity'/.test(v.message))).toBe(true);
  });

  it('fails an invalid entry tier', async () => {
    const { ctx, violations } = makeCtx({ config: entries([{ include: ['x.md'], severity: 'fatal' }]) });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /severity' must be 'error' or 'warning'/.test(v.message))).toBe(true);
  });

  it('fails a non-object rule payload', async () => {
    const { ctx, violations } = makeCtx({ config: entries([{ include: ['x.md'], rule: 'strict' }]) });
    await shapeValid.check(ctx);
    expect(violations.some((v) => /rule' must be a JSON object/.test(v.message))).toBe(true);
  });
});

describe('GEN-002 against the real repo files', () => {
  // A ctx over the actual working tree: breaking the live extension fences,
  // the seeded config, or the version stamp fails this suite too — not only
  // archgate check.
  function realCtx() {
    const violations: Reported[] = [];
    const repoRoot = new URL('../../', import.meta.url);
    const ctx = {
      projectRoot: '/repo',
      scopedFiles: [],
      changedFiles: [],
      async glob() {
        return [];
      },
      async readFile(path: string) {
        return readFileSync(new URL(path, repoRoot), 'utf8');
      },
      async readJSON(path: string) {
        return JSON.parse(readFileSync(new URL(path, repoRoot), 'utf8')) as unknown;
      },
      report: {
        violation: (d: Reported) => violations.push(d),
        warning: () => {},
        info: () => {},
      },
    } as unknown as RuleContext;
    return { ctx, violations };
  }

  it('the live extension, config, and version stamp satisfy all four rules', async () => {
    const { ctx, violations } = realCtx();
    for (const rule of [jsonParses, extensionFenced, configVersion, shapeValid]) {
      await rule.check(ctx);
    }
    expect(violations).toEqual([]);
  });
});

describe('GEN-002 report hygiene', () => {
  it('embeds the provenance tag and file attribution in every message', async () => {
    const broken = {
      version: 7,
      adr: {},
      markdown: { frontmater: {}, frontmatter: { unmatched: 'govern', pathRules: [{ match: 'x' }] } },
    };
    const { ctx, violations } = makeCtx({ config: broken });
    await configVersion.check(ctx);
    await shapeValid.check(ctx);
    const { ctx: parseCtx, violations: parseViolations } = makeCtx({ brokenJson: true });
    await jsonParses.check(parseCtx);
    const configSide = [...violations, ...parseViolations];
    expect(configSide.length).toBeGreaterThan(4);
    for (const v of configSide) {
      expect(v.message).toMatch(/\(GEN-002 \[config-(json-parses|version|shape-valid)\]\)\.$/);
      expect(v.file).toBe(CONFIG_PATH);
    }

    const { ctx: fenceCtx, violations: fenceViolations } = makeCtx({
      extension: 'declare namespace Harness {\n  // GEN-003-START\n}',
    });
    await extensionFenced.check(fenceCtx);
    expect(fenceViolations.length).toBeGreaterThan(1);
    for (const v of fenceViolations) {
      expect(v.message).toMatch(/\(GEN-002 \[config-extension-fenced\]\)\.$/);
      expect(v.file).toBe(EXTENSION_DTS);
    }
  });
});
