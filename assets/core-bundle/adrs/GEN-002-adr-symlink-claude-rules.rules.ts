/// <reference path="../rules.d.ts" />

// GEN-002 — Runtime Rule Loading: the .claude/rules symlink set that loads a
// governing ADR into agent context on Read. One entry per ADR with a non-empty
// paths:, none for an unscoped ADR, and no orphan left behind. Presence only —
// archgate's reader resolves symlinks, so a copied body is indistinguishable
// from a pointer (GEN-002 §1.4, a review duty). Runs at error (GEN-001 §7).
// Self-contained by design: archgate forbids imports between rules files.
const ADR_MD_GLOB = '.archgate/adrs/*.md';
const CLAUDE_RULES_GLOB = '.claude/rules/*.md';
const ADR_BASENAME_RE = /^([A-Z]+-\d{3})-.+\.md$/;
// Lowercased ADR-shaped basename, as it appears under .claude/rules/.
const CLAUDE_ADR_LINK_RE = /^[a-z]+-\d{3}-.+\.md$/;

function basename(p: string): string {
  return p.split('/').pop() ?? p;
}

function adrFiles(files: string[]): string[] {
  return files.filter((f) => ADR_BASENAME_RE.test(basename(f)));
}

function extractFrontmatter(content: string): string | null {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
}

function getFrontmatterValue(fm: string, key: string): string | null {
  const re = new RegExp(`^${key}[ \\t]*:[ \\t]*(.*)$`, 'm');
  const m = fm.match(re);
  if (!m) return null;
  return m[1]
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

// A non-empty `paths:` is present when the key exists with a value that is not
// an empty flow array `[]`. Block-form counts as empty here by design — GEN-001
// requires the inline flow form, and a block value parses as no scope at all.
function hasNonEmptyPaths(fm: string): boolean {
  const val = getFrontmatterValue(fm, 'paths');
  return val !== null && val !== '' && !/^\[\s*\]$/.test(val);
}

// Expected runtime entry path for an ADR file: the basename, lowercased.
function symlinkPathFor(file: string): string {
  return `.claude/rules/${basename(file).toLowerCase()}`;
}

export default {
  rules: {
    'adr-claude-rules-symlink': {
      description:
        'Every ADR with a non-empty paths: has a .claude/rules/<basename-lowercased>.md runtime entry; an ADR with empty/absent paths: has none; no orphaned ADR-named entry lingers. Presence only — the reader resolves symlinks, so a copied body is indistinguishable from a pointer.',
      severity: 'error',
      async check(ctx) {
        const files = adrFiles(await ctx.glob(ADR_MD_GLOB));
        const entries = new Set(await ctx.glob(CLAUDE_RULES_GLOB));
        const expected = new Set<string>();
        for (const file of files) {
          const fm = extractFrontmatter(await ctx.readFile(file)) ?? '';
          const link = symlinkPathFor(file);
          if (hasNonEmptyPaths(fm)) {
            expected.add(link);
            if (!entries.has(link)) {
              ctx.report.violation({
                message: `ADR declares paths: but has no runtime symlink — create '${link}' as a symlink to the ADR (GEN-002 [adr-claude-rules-symlink]).`,
                file,
              });
            }
          } else if (entries.has(link)) {
            ctx.report.violation({
              message: `ADR has empty/absent paths: but a runtime entry exists at '${link}' — remove it, or write paths: as an inline flow list if the ADR was meant to be scoped (GEN-002 [adr-claude-rules-symlink]).`,
              file,
            });
          }
        }
        for (const entry of entries) {
          if (expected.has(entry)) continue;
          if (!CLAUDE_ADR_LINK_RE.test(basename(entry))) continue; // hand-written, non-ADR-named rule file — leave it alone
          ctx.report.violation({
            message: `Runtime symlink '${entry}' has no backing ADR with a non-empty paths: — remove the orphan (GEN-002 [adr-claude-rules-symlink]).`,
            file: entry,
          });
        }
      },
    },
  },
} satisfies RuleSet;
