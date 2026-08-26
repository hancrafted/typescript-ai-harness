# Why the commit contract is shaped this way

Evidence base for the `commit` skill, gathered 2026-08-22. Read it before
changing the contract — most of the design is a response to a specific published
finding, and several obvious "improvements" are things the evidence argues
against.

## Bottom line

Git trailers are the right substrate for machine-readable commit provenance, and
rationale is the scarcest artifact in real repository history — so the strategy
is sound. But the one direct test of format enforcement found it correlates with
**less** informative messages, not more. That single finding is why this gate
checks shape and never substance, and why the skill spends its instruction
budget on prose quality instead of adding more machine-checkable fields.

Two things the evidence says the strategy has not yet solved: squash-merge
destroys per-commit trailers on the dominant hosting workflow, and there is no
hard enforcement point on github.com.

## The findings that shaped the contract

**1. Structure does not create information, and may substitute for it.** Islam &
Zacchiroli (EASE 2026) rated 50,673 security commits from 1999 to October 2025:
Conventional-Commits-compliant messages were rated poor **49.73%** of the time
versus **30.53%** for non-compliant, and good only **7.89%** versus **22.85%**
(p < 0.05). Their conclusion: "CCS guidelines alone appear insufficient to raise
informativeness of security commit message."

_Caveat, and it matters:_ the compliant subsample is roughly 1,850 of 50,673
commits, it is security commits only, and it is a correlation — compliance may
mark projects that automate messages rather than compliance causing poor ones.
Treat it as a strong warning against equating a passing gate with a good message,
not as proof that convention harms.

_What it changed:_ the gate is shape-only by design. It never scores prose, and
the skill states outright that the diff carries the what while the body must
carry the why. Resist adding checks that appear to measure substance — they would
manufacture exactly the false confidence this finding describes.

**2. Trailers are a genuine first-class primitive; nothing else is.** Git ships
`interpret-trailers --parse` and `git log --format='%(trailers:key=X,valueonly)'`,
so `Source:` needs no new format and no sidecar. Two precedents prove the pattern
scales: Gerrit's `Change-Id`, injected by a `commit-msg` hook and surviving
rebase and cherry-pick, and the DCO — one trailer, one regex, enforced across
millions of contributions with deliberate remediation escape hatches.

_What it changed:_ the gate hands the raw file to git's own parser rather than
grepping for `Source:`. A text search cannot distinguish a real trailer from a
line that merely looks like one, so the gate and `git log` would eventually
disagree. Git notes were rejected outright: not pushed or fetched by default,
`notes.rewriteRef` has no default so rebase silently drops them, and GitHub
withdrew notes rendering in 2010.

**3. Links rot on a measured curve, so a reference alone is not a record.** Of
18.2M links in commit messages across 23,110 repositories, **70% of distinct
links suffer decay**, and 14% of the evolution-prone subset become outright
unavailable. Git's own `SubmittingPatches` reached the same conclusion by
judgement decades earlier: "make sure your explanation can be understood without
external resources… instead of giving a URL, summarize the relevant points."

_What it changed:_ the `Source:` value is `<canonical ref> | <prompt summary>`,
and the skill asks for both when both exist. The reference is an index; the
summary is the durable part.

**4. Never record a model as an author.** The Linux kernel's coding-assistants
policy is explicit: "AI agents MUST NOT add Signed-off-by tags. Only humans can
legally certify the Developer Certificate of Origin (DCO)." Provenance goes in a
separate, purpose-built trailer — `Assisted-by: AGENT_NAME:MODEL_VERSION [TOOL1]
[TOOL2]`, e.g. `Assisted-by: Claude:claude-3-opus coccinelle sparse`. Git's own
docs define `Co-authored-by` as "people exchanged drafts of a patch" — human
semantics. The US Copyright Office (88 FR 16190) advises against listing an AI as
author or co-author. Microsoft auto-added `Co-authored-by: Copilot` in VS Code
1.110 and reverted to opt-in in 1.119 after backlash.

_What it changed:_ the skill's rule that the agent never names itself as a
co-author, stated as an active instruction because harnesses append one by
default and may instruct it outright. Human `Co-Authored-By` stays valid.

**5. Rationale is the scarcest thing in history, which is why any of this is
worth doing.** LaToza & Myers surveyed 179 professional developers for 371 hard
questions; the most-reported categories concern intent and rationale — "why was
it done this way?" Tian et al. (ICSE 2022) found roughly **44%** of messages
could be improved on why or what, and an ICSE 2023 follow-up found quality
declining over time while developers believe it is improving. Agents are
unusually cheap message authors, so the historical excuse dissolves.

## Open risks the contract does not yet address

**Squash-merge is hostile to the whole scheme.** GitHub does not preserve
intermediate commits, can replace bodies wholesale via repository settings, and
mangles or duplicates trailer blocks in practice. Git recognises a trailer block
only as one contiguous group at the end, so a single stray blank line yields
_zero_ trailers. Teams have noticed: `amannn/action-semantic-pull-request` lints
the **PR title** precisely because squash makes the title the commit message.
Either mandate merge-commit or rebase-merge, or define the squash commit as the
unit of record and verify the trunk commit rather than the branch commit.

**There is no hard enforcement point on github.com.** Pre-receive hooks exist
only on GitHub Enterprise Server. GitLab push rules can regex commit messages but
are Premium/Ultimate and are bypassed during fork sync. Client hooks are not
versioned by git, need a per-clone install, and yield to `--no-verify`. CI is the
pragmatic layer this skill has not yet wired.

**Rebase-safe correlation is unsolved.** `Source:` survives rebase but not
squash. A Gerrit-style stable ID is the proven answer if per-change identity ever
needs to survive both.

**The agent-side benefit is plausible and unquantified.** Anthropic's own
guidance points agents at git history, and products index it (Augment's Context
Lineage, `ctx`), but no controlled study shows history-as-context improves agent
task success, and Augment publishes no benchmarks. Do not oversell it.

**Messages drift from code.** Message–code inconsistency is measurable, and LLM
detectors are imperfect at it (CodeFuse-CommitEval: ~86% recall but 63.8%
specificity). Retrieved history is evidence to corroborate against code, not
ground truth.

## What survives contact with real teams

Kubernetes deliberately requires **no** conventional commits, capturing release
notes from a fenced `release-note` block in the PR body plus labels. The kernel's
`checkpatch.pl` machine-checks message structure but states "Checkpatch is not
always right. Your judgement takes precedence." DCO is the one genuinely
successful machine-checked trailer, and it succeeds by checking exactly one
thing. Keep a Changelog — whose six categories this contract borrows — says in
its own doctrine that "changelogs are for humans, not machines."

The pattern: machine-check the narrow, mechanically decidable thing; leave
semantics to review. That is the line this gate already sits on.

## Running the skill on small local models

For a Qwen3-27B/32B-class model, the constraint most likely to be dropped is the
one that matters most here — the trailing `Source:` trailer.

Qwen3-32B scores 83.2 on IFEval strict-prompt, but a stricter re-evaluation put
leading models including Qwen3-32B below **50%** once constraints compose rather
than appear singly. ComplexBench shows the same collapse; a procedural-execution
study measured first-answer accuracy falling from 61% at 5 steps to 20% at 95,
with another ~18-point penalty for referencing a variable more than one step
back. Most pointedly, a 2026 study of constraint-level error shifts found
built-in reasoning modes **improve** format compliance but **hurt** compliance
with negated instructions and with constraints placed last — which is precisely
where a trailer requirement lives.

Measures, most effective first. The first three are already in place:

1. **An external validator with a retry loop** rather than model discipline. The
   gate catches the exact failures these benchmarks predict, whatever the model
   understood. Already the design.
2. **One fully worked example message.** Concrete examples beat abstract rule
   lists below roughly 70B parameters. Present in the contract section, and it
   deliberately ends on the `Source:` trailer.
3. **Positive phrasing over prohibition.** Negated instructions are the most
   consistently flagged weakness across FollowBench, ComplexBench and the
   error-shift study. The skill states the allow-list — `git commit -F <draft>`
   and nothing else — beside the `--no-verify` guardrail.
4. **Feed the steps one at a time** rather than the whole file; accuracy collapses
   with step count and dependency depth.
5. **Deny-list `--no-verify`, `-c core.hooksPath=`, and `-n` at the tool layer.**
   Agents bypassing hooks is a documented, repeatedly observed behaviour, not a
   hypothetical.
6. **Pin the reasoning mode per call** instead of inline `/think` and `/no_think`
   toggles, which are documented as sticky or ignored through Ollama.
7. **Low temperature**, and treat retry rate as a regression signal — a retry
   that returns plausible-but-wrong output is the damaging failure mode.
8. **A GBNF grammar for the message skeleton** on llama.cpp stacks (header line,
   the six heading tokens, trailer line), letting free text fill the slots. This
   converts format compliance from probabilistic to guaranteed.

## Sources

Verified directly against the primary source:

- Islam & Zacchiroli, "Security Commit Message Informativeness", EASE 2026 (RENE)
  — <https://arxiv.org/abs/2604.20461> (percentages from Table 6)
- "18 Million Links in Commit Messages: Purpose, Evolution, and Decay", EMSE —
  <https://arxiv.org/abs/2305.16591>
- Linux kernel, "Coding assistants" —
  <https://docs.kernel.org/process/coding-assistants.html>

Reported with source URLs by research agents, not individually re-verified:

- Conventional Commits v1.0.0 — <https://www.conventionalcommits.org/en/v1.0.0/>
- Keep a Changelog 1.1.0 — <https://keepachangelog.com/en/1.1.0/>
- `git interpret-trailers` — <https://git-scm.com/docs/git-interpret-trailers>
- `git notes` (no default `notes.rewriteRef`) — <https://git-scm.com/docs/git-notes>
- GitHub withdrew notes rendering — <https://github.blog/2010-08-25-git-notes-display/>
- Gerrit Change-Id — <https://gerrit-review.googlesource.com/Documentation/user-changeid.html>
- Kernel submitting-patches ("summarize, don't link") —
  <https://docs.kernel.org/process/submitting-patches.html>
- checkpatch.pl — <https://docs.kernel.org/dev-tools/checkpatch.html>
- LaToza & Myers, "Hard-to-answer questions about code", PLATEAU 2010 —
  <https://dl.acm.org/doi/10.1145/1937117.1937125>
- Tian et al., "What Makes a Good Commit Message?", ICSE 2022 —
  <https://arxiv.org/abs/2202.02974>
- "Commit Message Matters", ICSE 2023 —
  <https://dl.acm.org/doi/abs/10.1109/ICSE48619.2023.00076>
- Conventional Commits classification, ICSE 2025 —
  <https://doi.org/10.1109/ICSE55347.2025.00011>
- Pull request data loss (54.79% of PRs) —
  <https://ieeexplore.ieee.org/document/11345302/>
- CodeFuse-CommitEval — <https://arxiv.org/abs/2511.19875>
- GitHub squash-merge behaviour —
  <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges>
- No pre-receive hooks on github.com —
  <https://github.com/orgs/community/discussions/29955>
- GitLab push rules — <https://docs.gitlab.com/user/project/repository/push_rules/>
- DCO app — <https://github.com/dcoapp/app>
- Kubernetes release notes — <https://www.kubernetes.dev/docs/guide/release-notes/>
- PR-title linting — <https://github.com/amannn/action-semantic-pull-request>
- US Copyright Office AI guidance, 88 FR 16190
- VS Code Copilot attribution reversal —
  <https://www.theregister.com/2026/05/04/microsoft_reverses_ai_credit_grab/>
- Anthropic best practices (agents reading git history) —
  <https://code.claude.com/docs/en/best-practices>
- Augment Context Lineage —
  <https://www.augmentcode.com/blog/announcing-context-lineage>
- Qwen3 technical report — <https://arxiv.org/pdf/2505.09388>
- ComplexBench — <https://arxiv.org/abs/2407.03978>
- FollowBench — <https://arxiv.org/pdf/2310.20410>
- SIFo — <https://arxiv.org/pdf/2406.19999>
- Constraint-level error shifts — <https://arxiv.org/pdf/2606.09662>
- llama.cpp GBNF grammars —
  <https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md>
- Qwen3 `/think` stickiness — <https://github.com/QwenLM/Qwen3/discussions/1329>
- Agents bypassing hooks — <https://github.com/tupe12334/block-no-verify>
