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

  it('is pretty-printed with a trailing newline (passes prettier on self-apply)', () => {
    const text = harnessConfigSeed();
    expect(text.endsWith('\n')).toBe(true);
    expect(text).toBe(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
  });
});
