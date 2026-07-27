import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FRONTMATTER } from '../../../.archgate/harness-config-fixtures';
import { HARNESS_VERSION } from '../../harness-config';
import { harnessConfigSeed, SEED_FRONTMATTER } from './template';

// Unit-level guards for the harness-config seed (#49). The materialised-file
// behaviour (write-if-absent, seed-once, dry-run) is asserted through run() in
// run.test.ts; here we pin the seed's *content* to its shared source and cover
// the pure version-note predicate.

describe('harness config seed — keep-honest', () => {
  // This side of the drift tripwire (rationale on SEED_FRONTMATTER in
  // template.ts): pin the CLI copy to the shared fixture; GEN-003's rules test
  // pins its own DEFAULT_CONFIG to the same fixture, so a drift in any copy fails.
  it('seeds exactly the shared DEFAULT_FRONTMATTER fixture', () => {
    expect(SEED_FRONTMATTER).toEqual(DEFAULT_FRONTMATTER);
  });

  it('carries only the four core entries — none of this repo project-specific ones (#14)', () => {
    const includes = SEED_FRONTMATTER.pathRules.flatMap((entry) => entry.include);
    expect(includes).toEqual(['.archgate/adrs/*.md', 'README.md', 'AGENTS.md', 'CLAUDE.md']);
    for (const projectSpecific of ['docs/adr', 'docs/agents', '.claude/agents', 'CONTEXT.md']) {
      expect(includes.some((glob) => glob.includes(projectSpecific))).toBe(false);
    }
  });
});

describe('harnessConfigSeed — the seeded envelope', () => {
  it('stamps the harness release version over the default frontmatter block', () => {
    const seed = JSON.parse(harnessConfigSeed()) as {
      version: string;
      markdown: { frontmatter: unknown };
    };
    expect(seed.version).toBe(HARNESS_VERSION);
    expect(seed.markdown.frontmatter).toEqual(DEFAULT_FRONTMATTER);
  });

  it('is a prettier fixpoint with one rule per line (clean diff on self-apply)', async () => {
    const text = harnessConfigSeed();
    expect(text.endsWith('\n')).toBe(true);

    // The real contract behind the seed's shape: a self-applied config must
    // round-trip through the repo's own prettier untouched. Assert that against
    // the resolved config rather than a hand-rolled JSON.stringify proxy.
    const options = (await resolveConfig(fileURLToPath(import.meta.url))) ?? {};
    expect(await format(text, { ...options, parser: 'json' })).toBe(text);

    // Each default frontmatter rule is collapsed onto a single line (the seed
    // feedback that motivated this format); the envelope stays expanded around them.
    const ruleLines = text.split('\n').filter((line) => line.trimStart().startsWith('{ "include":'));
    expect(ruleLines).toHaveLength(SEED_FRONTMATTER.pathRules.length);
  });
});
