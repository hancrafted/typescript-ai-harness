/// <reference path="../rules.d.ts" />

// GEN-001 — ADR Contract: the meta-rules governing ADR markdown files under
// .archgate/adrs/ and their companion .rules.ts files — frontmatter bundle and
// order, the six canonical sections, the size budget, the shape grammar, and
// the rules-file duties. The .claude/rules runtime-loading channel is GEN-002's.
// All rules run at error (GEN-001 §7); there is no migration epoch — an ADR
// conforms fully or the build fails. Further rules or a tier change land only by
// deliberate ADR amendment.
const ADR_MD_GLOB = '.archgate/adrs/*.md';
const RULES_GLOB = '.archgate/adrs/*.rules.ts';
const ADRS_DIR = '.archgate/adrs/';
const ADR_BASENAME_RE = /^([A-Z]+-\d{3})-.+\.md$/;
const RULES_BASENAME_RE = /^[A-Z]+-\d{3}-.+\.rules\.ts$/;
const RULES_TEST_BASENAME_RE = /^[A-Z]+-\d{3}-.+\.rules\.test\.ts$/;
const BUILTIN_DOMAINS = ['architecture', 'backend', 'data', 'frontend', 'general'];
// `description` is required here and not upstream: it is the text `.archgate/INDEX.md`
// carries for each ADR, so an absent one silently empties an index entry.
const REQUIRED_KEYS = ['type', 'id', 'title', 'domain', 'rules', 'files', 'description'];
// The two glob-valued keys adr-glob-inline governs; both must be flow lists.
const GLOB_KEYS = ['files', 'paths'];
// GEN-001 §4.1 — Windsurf's published cap, the strictest hard limit among the
// five vendors that publish one. Counted in code points, matching `wc -m`.
const MAX_ADR_CHARS = 12_000;
const REQUIRED_SECTIONS = [
  '## Context',
  '## Decision',
  "## Do's and Don'ts",
  '## Consequences',
  '## Compliance and Enforcement',
  '## References',
];
// Subsection headings inside ## Do's and Don'ts — the structural break that
// makes the Don'ts ordered list restart at 1 when rendered; bare adjacent
// ordered lists merge and the Don'ts number on from the Do's.
const DOS_HEADING_RE = /^### Do's[ \t]*$/;
const DONTS_HEADING_RE = /^### Don'ts[ \t]*$/;

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

async function tryReadFile(ctx: RuleContext, path: string): Promise<string | null> {
  try {
    return await ctx.readFile(path);
  } catch {
    return null;
  }
}

function stripFences(content: string): string {
  let inFence = false;
  return content
    .split(/\r?\n/)
    .map((line) => {
      if (/^(```|~~~)/.test(line.trim())) {
        inFence = !inFence;
        return '';
      }
      return inFence ? '' : line;
    })
    .join('\n');
}

// Section body from `## <name>` to the next `## ` heading (fences stripped).
function getSection(content: string, heading: string): string | null {
  const lines = stripFences(content).split('\n');
  const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = lines.findIndex((l) => new RegExp(`^${esc}[ \\t]*$`).test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n');
}

// Decision-side marker: (📜 Rule: `<id>`) — anchored to the enclosing numbered
// ### anchor (or top-level ordered item in a list-form Decision). Do's/Don'ts-side
// marker: (Decision <N>, 📜 Rule: `<id>`) — N back-references the Decision anchor
// that carries the rule's Decision-side marker.
const DECISION_MARKER_RE = /\(📜 Rule: `([a-z0-9-]+)`\)/g;
const DD_MARKER_RE = /\(Decision (\d+), 📜 Rule: `([a-z0-9-]+)`\)/g;

// Map ruleId → anchor numbers where its Decision-side marker appears.
function decisionMarkers(section: string): Map<string, number[]> {
  const found = new Map<string, number[]>();
  const lines = section.split('\n');
  const hasAnchors = lines.some((l) => /^###\s/.test(l));
  let current = 0;
  for (const line of lines) {
    const anchor = hasAnchors ? line.match(/^###\s+(\d+)\.\s/) : line.match(/^(\d+)\.\s/);
    if (anchor) current = Number(anchor[1]);
    for (const m of line.matchAll(DECISION_MARKER_RE)) {
      const list = found.get(m[1]) ?? [];
      list.push(current);
      found.set(m[1], list);
    }
  }
  return found;
}

// Map ruleId → back-referenced Decision numbers from Do's/Don'ts markers.
function ddMarkers(section: string): Map<string, number[]> {
  const found = new Map<string, number[]>();
  for (const m of section.matchAll(DD_MARKER_RE)) {
    const list = found.get(m[2]) ?? [];
    list.push(Number(m[1]));
    found.set(m[2], list);
  }
  return found;
}

// Rule keys declared in a companion .rules.ts source — the `'<id>': {` entries.
function ruleKeysOf(rulesSource: string): string[] {
  const keys: string[] = [];
  const re = /["']([a-z0-9-]+)["'][ \t]*:[ \t]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rulesSource)) !== null) keys.push(m[1]);
  return keys;
}

// Sequentiality helper: numbers must read 1, 2, 3, … with no gap or restart.
function checkSequential(nums: number[]): boolean {
  return nums.every((n, i) => n === i + 1);
}

interface DecisionFindings {
  messages: string[];
}

function checkDecisionNumbering(section: string): DecisionFindings {
  const lines = section.split('\n');
  const anchors = lines.filter((l) => /^###\s/.test(l));
  const messages: string[] = [];
  if (anchors.length > 0) {
    const nums: number[] = [];
    for (const a of anchors) {
      const m = a.match(/^###\s+(\d+)\.\s/);
      if (!m) messages.push(`Decision anchor '${a.trim()}' is not numbered 'N.'`);
      else nums.push(Number(m[1]));
    }
    if (!checkSequential(nums)) messages.push(`Decision anchors are not sequential from 1 (found ${nums.join(',')})`);
    // First-level items inside anchors: unordered bullets flagged; ordered lists restart at 1 per anchor.
    let seq: number[] = [];
    let seenAnchor = false;
    for (const line of lines) {
      if (/^###\s/.test(line)) {
        if (seq.length > 0 && !checkSequential(seq))
          messages.push(`ordered items not sequential (found ${seq.join(',')})`);
        seq = [];
        seenAnchor = true;
        continue;
      }
      if (!seenAnchor) continue;
      if (/^[-*+]\s/.test(line))
        messages.push(`unordered first-level bullet '${line.trim().slice(0, 40)}' inside a Decision anchor`);
      const om = line.match(/^(\d+)\.\s/);
      if (om) seq.push(Number(om[1]));
    }
    if (seq.length > 0 && !checkSequential(seq)) messages.push(`ordered items not sequential (found ${seq.join(',')})`);
  } else {
    const items = lines
      .map((l) => l.match(/^(\d+)\.\s/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => Number(m[1]));
    const loose = lines.filter((l) => /^[-*+]\s/.test(l));
    if (items.length === 0)
      messages.push("Decision has neither numbered '### N.' anchors nor a top-level ordered list");
    else if (!checkSequential(items))
      messages.push(`top-level ordered list not sequential from 1 (found ${items.join(',')})`);
    if (loose.length > 0 && items.length > 0)
      messages.push('unordered top-level bullets mixed into list-form Decision');
  }
  return { messages };
}

export default {
  rules: {
    'adr-frontmatter': {
      description:
        'ADR frontmatter: type/id/title/domain/rules/files/description present non-empty, type: adr leads, id matches filename prefix, domain registered, rules:true ⇔ sibling .rules.ts.',
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
          const firstKey = fm
            .split(/\r?\n/)
            .map((l) => l.match(/^([a-z]+)[ \t]*:/)?.[1])
            .find((k): k is string => k !== undefined);
          if (firstKey !== 'type') {
            ctx.report.violation({
              message: `ADR frontmatter must lead with 'type', found '${firstKey ?? 'none'}' (GEN-001 [adr-frontmatter]).`,
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
        "Every ADR carries the six canonical H2 sections: Context, Decision, Do's and Don'ts, Consequences, Compliance and Enforcement, References (presence only, fenced code blocks don't count).",
      severity: 'error',
      async check(ctx) {
        const files = adrFiles(await ctx.glob(ADR_MD_GLOB));
        for (const file of files) {
          const content = stripFences(await ctx.readFile(file));
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

    'adr-size-budget': {
      description:
        'An ADR markdown file stays under the character budget — its whole body loads into agent context on every Read matching its paths:, so length is a cost paid per Read, not per commit.',
      severity: 'error',
      async check(ctx) {
        const files = adrFiles(await ctx.glob(ADR_MD_GLOB));
        for (const file of files) {
          // Code points, not UTF-16 units: the 📜 rule markers are astral and
          // would otherwise each count twice against the budget.
          const size = [...(await ctx.readFile(file))].length;
          if (size > MAX_ADR_CHARS) {
            ctx.report.violation({
              message: `ADR is ${size} characters, over the ${MAX_ADR_CHARS}-character budget — split Disciplines by glob into a second ADR, or compress prose to one-line imperatives (GEN-001 [adr-size-budget]).`,
              file,
            });
          }
        }
      },
    },

    'adr-rule-mentions': {
      description:
        "Each companion rule carries exactly one Decision-side marker (📜 Rule: `<id>`) in ## Decision and exactly one Do's/Don'ts-side marker (Decision <N>, 📜 Rule: `<id>`) whose N back-references the marked anchor; conversely, every marker must name a rule the companion rules file declares.",
      severity: 'error',
      async check(ctx) {
        const files = adrFiles(await ctx.glob(ADR_MD_GLOB));
        for (const file of files) {
          const sibling = file.replace(/\.md$/, '.rules.ts');
          const source = await tryReadFile(ctx, sibling);
          const content = await ctx.readFile(file);
          const dMarks = decisionMarkers(getSection(content, '## Decision') ?? '');
          const ddMarks = ddMarkers(getSection(content, "## Do's and Don'ts") ?? '');
          // No rules file: no keys to require markers for, but any marker present
          // is a phantom — it states a rule nothing enforces.
          const declared = source === null ? [] : ruleKeysOf(source);
          const declaredSet = new Set(declared);
          for (const [ruleId] of dMarks) {
            if (!declaredSet.has(ruleId)) {
              ctx.report.violation({
                message: `Decision-side marker names rule '${ruleId}' but no such rule exists in '${basename(sibling)}' — implement it or remove the marker (GEN-001 [adr-rule-mentions]).`,
                file,
              });
            }
          }
          for (const [ruleId] of ddMarks) {
            if (!declaredSet.has(ruleId)) {
              ctx.report.violation({
                message: `Do's/Don'ts marker names rule '${ruleId}' but no such rule exists in '${basename(sibling)}' — implement it or remove the marker (GEN-001 [adr-rule-mentions]).`,
                file,
              });
            }
          }
          for (const ruleId of declared) {
            const anchors = dMarks.get(ruleId) ?? [];
            if (anchors.length !== 1) {
              ctx.report.violation({
                message: `Rule '${ruleId}' needs its Decision-side marker (📜 Rule: \`${ruleId}\`) exactly once in ## Decision, found ${anchors.length} (GEN-001 [adr-rule-mentions]).`,
                file,
              });
            }
            const refs = ddMarks.get(ruleId) ?? [];
            if (refs.length !== 1) {
              ctx.report.violation({
                message: `Rule '${ruleId}' needs its marker (Decision <N>, 📜 Rule: \`${ruleId}\`) exactly once in ## Do's and Don'ts, found ${refs.length} (GEN-001 [adr-rule-mentions]).`,
                file,
              });
            }
            if (anchors.length === 1 && refs.length === 1 && refs[0] !== anchors[0]) {
              ctx.report.violation({
                message: `Rule '${ruleId}' Do's/Don'ts back-reference points at Decision ${refs[0]} but its Decision-side marker sits in anchor ${anchors[0]} (GEN-001 [adr-rule-mentions]).`,
                file,
              });
            }
          }
        }
      },
    },

    'adr-numbered-decision': {
      description:
        "Decision anchors are '### N.' sequential from 1 (or a top-level ordered list when there are no anchors); first-level items inside each anchor form a sequential ordered list, never unordered bullets.",
      severity: 'error',
      async check(ctx) {
        const files = adrFiles(await ctx.glob(ADR_MD_GLOB));
        for (const file of files) {
          const decision = getSection(await ctx.readFile(file), '## Decision');
          if (decision === null) continue; // adr-required-sections owns the missing-section finding
          for (const msg of checkDecisionNumbering(decision).messages) {
            ctx.report.violation({ message: `${msg} (GEN-001 [adr-numbered-decision]).`, file });
          }
        }
      },
    },

    'adr-numbered-dos-donts': {
      description:
        "The Do's and Don'ts section carries exactly one ### Do's and one ### Don'ts heading, Do's first; each block sits under its own heading as a sequential ordered list restarting at 1, every item keeping its bold **DO** / **DON'T** prefix.",
      severity: 'error',
      async check(ctx) {
        const files = adrFiles(await ctx.glob(ADR_MD_GLOB));
        for (const file of files) {
          const section = getSection(await ctx.readFile(file), "## Do's and Don'ts");
          if (section === null) continue;
          const lines = section.split('\n');
          const dosAt = lines.flatMap((l, i) => (DOS_HEADING_RE.test(l) ? [i] : []));
          const dontsAt = lines.flatMap((l, i) => (DONTS_HEADING_RE.test(l) ? [i] : []));
          let headingsOk = true;
          if (dosAt.length !== 1) {
            headingsOk = false;
            ctx.report.violation({
              message: `Do's and Don'ts needs exactly one "### Do's" subsection heading, found ${dosAt.length} — without the heading break the rendered numbering never restarts (GEN-001 [adr-numbered-dos-donts]).`,
              file,
            });
          }
          if (dontsAt.length !== 1) {
            headingsOk = false;
            ctx.report.violation({
              message: `Do's and Don'ts needs exactly one "### Don'ts" subsection heading, found ${dontsAt.length} — without the heading break the rendered numbering never restarts (GEN-001 [adr-numbered-dos-donts]).`,
              file,
            });
          }
          if (headingsOk && dosAt[0] > dontsAt[0]) {
            headingsOk = false;
            ctx.report.violation({
              message: `"### Do's" must precede "### Don'ts" in the Do's and Don'ts section (GEN-001 [adr-numbered-dos-donts]).`,
              file,
            });
          }
          const doNums: number[] = [];
          const dontNums: number[] = [];
          let zone: 'none' | 'dos' | 'donts' | 'other' = 'none';
          let bad = false;
          for (const line of lines) {
            if (/^###\s/.test(line)) {
              zone = DOS_HEADING_RE.test(line) ? 'dos' : DONTS_HEADING_RE.test(line) ? 'donts' : 'other';
              continue;
            }
            if (/^[-*+]\s+\*\*(DO|DON'T)\*\*/.test(line)) {
              ctx.report.violation({
                message: `Do's and Don'ts item '${line.trim().slice(0, 50)}' is an unordered bullet — blocks must be ordered lists (GEN-001 [adr-numbered-dos-donts]).`,
                file,
              });
              bad = true;
              continue;
            }
            const m = line.match(/^(\d+)\.\s+\*\*(DO|DON'T)\*\*/);
            if (!m) continue;
            const isDo = m[2] === 'DO';
            (isDo ? doNums : dontNums).push(Number(m[1]));
            if (headingsOk && zone !== (isDo ? 'dos' : 'donts')) {
              ctx.report.violation({
                message: `A **${m[2]}** item sits outside the "### ${isDo ? "Do's" : "Don'ts"}" subsection: '${line.trim().slice(0, 50)}' (GEN-001 [adr-numbered-dos-donts]).`,
                file,
              });
              bad = true;
            }
          }
          if (bad) continue;
          if (!checkSequential(doNums)) {
            ctx.report.violation({
              message: `DO block numbering must be sequential from 1, found ${doNums.join(',')} (GEN-001 [adr-numbered-dos-donts]).`,
              file,
            });
          }
          if (!checkSequential(dontNums)) {
            ctx.report.violation({
              message: `DON'T block numbering must restart at 1 and be sequential, found ${dontNums.join(',')} (GEN-001 [adr-numbered-dos-donts]).`,
              file,
            });
          }
        }
      },
    },

    'adr-rules-test-sibling': {
      description: 'Every .archgate/adrs/*.rules.ts has a sibling *.rules.test.ts.',
      severity: 'error',
      async check(ctx) {
        const rulesFiles = await ctx.glob(RULES_GLOB);
        const testFiles = await ctx.glob('.archgate/adrs/*.rules.test.ts');
        for (const rf of rulesFiles) {
          const sibling = rf.replace(/\.rules\.ts$/, '.rules.test.ts');
          if (!testFiles.includes(sibling)) {
            ctx.report.violation({
              message: `Rules file has no sibling test '${basename(sibling)}' (GEN-001 [adr-rules-test-sibling]).`,
              file: rf,
            });
          }
        }
      },
    },

    'adr-message-provenance': {
      description:
        'Every rule self-identifies in its output: for each rule key R in an <ID>-<slug>.rules.ts the source embeds the literal provenance tag (<ID> [R]).',
      severity: 'error',
      async check(ctx) {
        const rulesFiles = await ctx.glob(RULES_GLOB);
        for (const rf of rulesFiles) {
          const idMatch = basename(rf).match(/^([A-Z]+-\d{3})-/);
          if (!idMatch) continue;
          const source = await ctx.readFile(rf);
          for (const ruleId of ruleKeysOf(source)) {
            if (!source.includes(`(${idMatch[1]} [${ruleId}])`)) {
              ctx.report.violation({
                message: `Rule '${ruleId}' messages must embed the provenance literal '(${idMatch[1]} [${ruleId}])' (GEN-001 [adr-message-provenance]).`,
                file: rf,
              });
            }
          }
        }
      },
    },

    'adr-governed-files': {
      description:
        '.archgate/adrs/ is flat and fully ADR-shaped: every non-hidden file is a top-level <PREFIX>-<NNN>-<slug> .md / .rules.ts / .rules.test.ts, and every rules/test file has its backing ADR markdown — archgate discovers ADRs by frontmatter, so a misnamed or nested file may still act while this contract cannot see it.',
      severity: 'error',
      async check(ctx) {
        const entries = await ctx.glob(`${ADRS_DIR}**`);
        const present = new Set(entries);
        for (const entry of entries) {
          const base = basename(entry);
          if (base.startsWith('.')) continue; // editor/OS droppings — not governance surface
          if (entry.slice(ADRS_DIR.length).includes('/')) {
            ctx.report.violation({
              message: `'${entry}' sits in a subdirectory — .archgate/adrs/ is flat; the contract's rules do not reach nested files (GEN-001 [adr-governed-files]).`,
              file: entry,
            });
            continue;
          }
          if (RULES_BASENAME_RE.test(base) || RULES_TEST_BASENAME_RE.test(base)) {
            const backing = `${ADRS_DIR}${base.replace(/\.rules(\.test)?\.ts$/, '.md')}`;
            if (!present.has(backing)) {
              ctx.report.violation({
                message: `'${base}' has no backing ADR '${basename(backing)}' — remove it or restore the ADR; an ADR-less rules file is silently inert (GEN-001 [adr-governed-files]).`,
                file: entry,
              });
            }
            continue;
          }
          if (!ADR_BASENAME_RE.test(base)) {
            ctx.report.violation({
              message: `'${base}' does not match the ADR bundle shape <PREFIX>-<NNN>-<slug>.{md,rules.ts,rules.test.ts} — archgate may still discover it while this contract cannot govern it (GEN-001 [adr-governed-files]).`,
              file: entry,
            });
          }
        }
      },
    },

    'adr-glob-inline': {
      description:
        'files: and paths:, when present, are inline YAML flow lists (e.g. files: ["glob"]) — a bare, block-style, or null value parses as empty here and silently drops that channel\'s scope (§2). Anchored to the §2 anchor, not an item number, so renumbering cannot stale this reference.',
      severity: 'error',
      async check(ctx) {
        const files = adrFiles(await ctx.glob(ADR_MD_GLOB));
        for (const file of files) {
          const fm = extractFrontmatter(await ctx.readFile(file));
          if (fm === null) continue; // adr-frontmatter owns the missing-frontmatter finding
          for (const key of GLOB_KEYS) {
            const m = fm.match(new RegExp(`^${key}[ \\t]*:[ \\t]*(.*)$`, 'm'));
            if (m && !/^\[.*\]$/.test(m[1].trim())) {
              ctx.report.violation({
                message: `ADR '${key}:' must be an inline flow list like ${key}: ["glob"] — a bare, block-style, or null value parses as empty and silently drops the scope (GEN-001 [adr-glob-inline]).`,
                file,
              });
            }
          }
        }
      },
    },

    'adr-error-tier': {
      description:
        'Every companion rule runs at the error tier (§7): a rules file must not declare a warning- or info-tier severity.',
      severity: 'error',
      async check(ctx) {
        const rulesFiles = await ctx.glob(RULES_GLOB);
        for (const rf of rulesFiles) {
          const source = await ctx.readFile(rf);
          for (const m of source.matchAll(/severity[ \t]*:[ \t]*["'](warning|info)["']/g)) {
            ctx.report.violation({
              message: `Rules file declares a '${m[1]}' severity but GEN-001 §7 runs every rule at 'error' — change or drop it (GEN-001 [adr-error-tier]).`,
              file: rf,
            });
          }
        }
      },
    },
  },
} satisfies RuleSet;
