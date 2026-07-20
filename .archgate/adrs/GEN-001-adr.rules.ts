/// <reference path="../rules.d.ts" />

// GEN-001 — ADR Contract: the meta-rules governing ADR markdown files under
// .archgate/adrs/ and their .claude/rules runtime-loading symlinks. All three
// rules are errors (GEN-001 §5); there is no migration epoch. Ratcheting to a
// fuller shape ceremony happens via ADR amendment only.

const ADR_MD_GLOB = '.archgate/adrs/*.md';
const RULES_GLOB = '.archgate/adrs/*.rules.ts';
const CLAUDE_RULES_GLOB = '.claude/rules/*.md';
const ADR_BASENAME_RE = /^([A-Z]+-\d{3})-.+\.md$/;
// Lowercased ADR-shaped basename, as it appears under .claude/rules/.
const CLAUDE_ADR_LINK_RE = /^[a-z]+-\d{3}-.+\.md$/;
const BUILTIN_DOMAINS = ['architecture', 'backend', 'data', 'frontend', 'general'];
const REQUIRED_KEYS = ['type', 'id', 'title', 'domain', 'rules'];
const FIELD_ORDER = ['type', 'id', 'title', 'domain', 'rules', 'paths'];
const REQUIRED_SECTIONS = [
  '## Context',
  '## Decision',
  "## Do's and Don'ts",
  '## Consequences',
  '## Compliance and Enforcement',
  '## References',
];

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
// an empty flow array `[]`. Block-form (`paths:\n  - "…"`) counts as empty here
// by design — this repo authors `paths:` inline, matching the archgate ADR
// convention the field-order check assumes.
function hasNonEmptyPaths(fm: string): boolean {
  const val = getFrontmatterValue(fm, 'paths');
  return val !== null && val !== '' && !/^\[\s*\]$/.test(val);
}

// Expected runtime symlink path for an ADR file: the basename, lowercased.
function symlinkPathFor(file: string): string {
  return `.claude/rules/${basename(file).toLowerCase()}`;
}

async function tryReadFile(ctx: RuleContext, path: string): Promise<string | null> {
  try {
    return await ctx.readFile(path);
  } catch {
    return null;
  }
}

export default {
  rules: {
    'adr-frontmatter': {
      description:
        "ADR frontmatter: type/id/title/domain/rules present non-empty, exact field order type→id→title→domain→rules→paths, type is 'adr', id matches filename prefix, domain registered, rules:true ⇔ sibling .rules.ts.",
      severity: 'error',
      async check(ctx) {
        let registered = BUILTIN_DOMAINS;
        try {
          const cfg = (await ctx.readJSON('.archgate/config.json')) as { domains?: Record<string, string> };
          registered = [...BUILTIN_DOMAINS, ...Object.keys(cfg?.domains ?? {})];
        } catch {
          // config.json optional — built-ins only
        }
        const files = adrFiles(await ctx.glob(ADR_MD_GLOB));
        const allRules = await ctx.glob(RULES_GLOB);
        for (const file of files) {
          const content = await ctx.readFile(file);
          const fm = extractFrontmatter(content);
          if (fm === null) {
            ctx.report.violation({ message: `ADR has no YAML frontmatter block (GEN-001 [adr-frontmatter]).`, file });
            continue;
          }
          for (const key of REQUIRED_KEYS) {
            const val = getFrontmatterValue(fm, key);
            if (val === null || val === '') {
              ctx.report.violation({
                message: `ADR frontmatter is missing or has an empty required key '${key}' (GEN-001 [adr-frontmatter]).`,
                file,
              });
            }
          }
          const present = FIELD_ORDER.filter((k) => new RegExp(`^${k}[ \\t]*:`, 'm').test(fm));
          const actual = fm
            .split(/\r?\n/)
            .map((l) => l.match(/^([a-z]+)[ \t]*:/)?.[1])
            .filter((k): k is string => k !== undefined && FIELD_ORDER.includes(k));
          if (actual.join(',') !== present.join(',')) {
            ctx.report.violation({
              message: `ADR frontmatter field order must be type → id → title → domain → rules → paths, found ${actual.join(' → ')} (GEN-001 [adr-frontmatter]).`,
              file,
            });
          }
          const type = getFrontmatterValue(fm, 'type');
          if (type !== null && type !== 'adr') {
            ctx.report.violation({
              message: `ADR frontmatter 'type' must be 'adr', found '${type}' (GEN-001 [adr-frontmatter]).`,
              file,
            });
          }
          const id = getFrontmatterValue(fm, 'id');
          if (id && !basename(file).startsWith(`${id}-`)) {
            ctx.report.violation({
              message: `ADR id '${id}' does not match the filename prefix of '${basename(file)}' (GEN-001 [adr-frontmatter]).`,
              file,
            });
          }
          const domain = getFrontmatterValue(fm, 'domain');
          if (domain && !registered.includes(domain)) {
            ctx.report.violation({
              message: `ADR domain '${domain}' is not a registered domain (GEN-001 [adr-frontmatter]).`,
              file,
            });
          }
          const rulesVal = getFrontmatterValue(fm, 'rules');
          const sibling = file.replace(/\.md$/, '.rules.ts');
          const hasSibling = allRules.includes(sibling);
          if (rulesVal === 'true' && !hasSibling) {
            ctx.report.violation({
              message: `ADR declares rules: true but sibling '${basename(sibling)}' does not exist (GEN-001 [adr-frontmatter]).`,
              file,
            });
          }
          if (rulesVal !== 'true' && hasSibling) {
            ctx.report.violation({
              message: `Sibling '${basename(sibling)}' exists but the ADR does not declare rules: true (GEN-001 [adr-frontmatter]).`,
              file,
            });
          }
        }
      },
    },

    'adr-required-sections': {
      description:
        "Every ADR carries the six canonical H2 sections: Context, Decision, Do's and Don'ts, Consequences, Compliance and Enforcement, References (presence only).",
      severity: 'error',
      async check(ctx) {
        const files = adrFiles(await ctx.glob(ADR_MD_GLOB));
        for (const file of files) {
          const content = await ctx.readFile(file);
          for (const heading of REQUIRED_SECTIONS) {
            const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (!new RegExp(`^${esc}[ \\t]*$`, 'm').test(content)) {
              ctx.report.violation({
                message: `ADR is missing the mandatory section '${heading}' (GEN-001 [adr-required-sections]).`,
                file,
              });
            }
          }
        }
      },
    },

    'adr-claude-rules-symlink': {
      description:
        'Every ADR with a non-empty paths: has a .claude/rules/<basename-lowercased>.md symlink (a pointer, never a copied body) to it; an ADR with empty/absent paths: has none; no orphaned ADR symlink lingers.',
      severity: 'error',
      // archgate's file API does not follow symlinks: ctx.glob lists a symlink
      // but ctx.readFile throws on it. That signature IS the check — a
      // glob-listed entry that readFile cannot open is a symlink (correct); one
      // it can open is a regular file, i.e. a forbidden copy.
      async check(ctx) {
        const files = adrFiles(await ctx.glob(ADR_MD_GLOB));
        const entries = new Set(await ctx.glob(CLAUDE_RULES_GLOB));
        const isSymlink = async (path: string): Promise<boolean> => (await tryReadFile(ctx, path)) === null;
        const expected = new Set<string>();
        for (const file of files) {
          const fm = extractFrontmatter(await ctx.readFile(file)) ?? '';
          const link = symlinkPathFor(file);
          if (hasNonEmptyPaths(fm)) {
            expected.add(link);
            if (!entries.has(link)) {
              ctx.report.violation({
                message: `ADR declares paths: but has no runtime symlink — create '${link}' as a symlink to the ADR (GEN-001 [adr-claude-rules-symlink]).`,
                file,
              });
            } else if (!(await isSymlink(link))) {
              ctx.report.violation({
                message: `Runtime entry '${link}' is a regular file — it MUST be a symlink to the ADR, never a copied body (GEN-001 [adr-claude-rules-symlink]).`,
                file,
              });
            }
          } else if (entries.has(link)) {
            ctx.report.violation({
              message: `ADR has empty/absent paths: but a runtime entry exists at '${link}' — remove it (GEN-001 [adr-claude-rules-symlink]).`,
              file,
            });
          }
        }
        for (const entry of entries) {
          if (expected.has(entry)) continue;
          if (!CLAUDE_ADR_LINK_RE.test(basename(entry))) continue; // not an ADR-shaped name — leave shared/hand-written rules alone
          if (await isSymlink(entry)) {
            ctx.report.violation({
              message: `Runtime symlink '${entry}' has no backing ADR with a non-empty paths: — remove the orphan (GEN-001 [adr-claude-rules-symlink]).`,
              file: entry,
            });
          }
        }
      },
    },
  },
} satisfies RuleSet;
