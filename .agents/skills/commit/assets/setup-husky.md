# Wiring the commit gate into a repository's git hooks

Reference for `/commit --setup-husky`. One script does the whole job:

```sh
sh .agents/skills/commit/scripts/setup-husky
```

Run it from anywhere inside the target repository. It takes no arguments, is safe
to run twice, and prints every change it made. Read the summary, then commit
`.husky/commit-msg`.

Everything below is context for when a step surprises you. You do not need to
perform these steps by hand.

## What the script does

In order, stopping at the first thing that cannot be satisfied:

1. **Finds the repository root** — `git rev-parse --show-toplevel`. Aborts if
   there is none.
2. **Locates the gate**, at one of exactly two paths, in this order:
   - `.agents/skills/commit/scripts/commit-msg` — where `npx skills add` puts it.
   - `skills/commit/scripts/commit-msg` — a checkout of the skill's own repository.

   Aborts if neither exists rather than writing a hook that cannot run.

3. **Requires a `package.json`**, because husky is a Node dev dependency. Aborts
   with the manual alternative below if there is none.
4. **Installs husky** if `.husky/_` is missing: `npm install --save-dev husky`,
   sets `scripts.prepare` to `husky` (only when absent — an existing `prepare` is
   never clobbered), then `npx husky`.
5. **Writes `.husky/commit-msg`** with the body below, but only if the current
   contents differ.
6. **Sets `core.commentChar` to `;`** if it is currently `#` (or unset, which
   means `#`). See [Why `core.commentChar`](#why-corecommentchar) — without this
   the gate is self-defeating.

## The canonical hook body

Reproduced verbatim from `scripts/lib/hook.sh`. The TypeScript AI harness's husky
Integration must write **exactly this**, so a repository set up either way judges
commits identically. If the two ever diverge, `scripts/lib/hook.sh` is the
definition.

```sh
# Managed by the `commit` skill — rewritten by `/commit --setup-husky`.
# Edit the skill's contract, not this file.
#
# Delegates to the gate that ships inside the skill, so the enforced contract
# and the documented contract cannot drift apart.
root=$(git rev-parse --show-toplevel) || exit 1

for gate in '.agents/skills/commit/scripts/commit-msg' 'skills/commit/scripts/commit-msg'; do
  if [ -f "$root/$gate" ]; then
    exec sh "$root/$gate" "$1"
  fi
done

echo "✖ commit gate not found — the commit skill is not installed where this hook expects it." >&2
echo "  looked for: .agents/skills/commit/scripts/commit-msg" >&2
echo "         and: skills/commit/scripts/commit-msg" >&2
echo "  install it with: npx skills add hancrafted/skills" >&2
echo "  project scope, and never --copy — copy mode breaks the single canonical path." >&2
exit 1
```

No shebang: husky runs the file with `sh -e`. The hook delegates rather than
duplicating any checking, which is what keeps the enforced contract and the
documented contract from drifting apart.

## Installation constraints

- Install at **project scope**, which is the default. Project scope is meant to
  be committed, and that is what makes the hook work for every clone and in CI.
- **Never `--copy`.** Copy mode creates independent per-agent copies and destroys
  the single canonical path the hook depends on. The script aborts with an
  explanation rather than failing obscurely, but the fix is to reinstall without
  the flag.

## Why `core.commentChar`

The body contract requires `### <category>` headings. Under git's default
configuration those lines start with the comment character, and git's
`cleanup=strip` — which runs on the editor path, **after** `commit-msg` has
already approved the message — deletes every line that starts with it.

The result is the exact failure this gate exists to prevent: a commit that passes
the gate and is stored without its headings, permanently unmineable. Setting
`core.commentChar` to `;` makes git's own template use `;`, so the `###` headings
survive.

This is local to the clone and is not committed, so:

- The script sets it for whoever runs the setup.
- For anyone who wires the hook by hand, the gate **warns** — without blocking —
  when it sees an editor-written message whose headings are about to be stripped.
- The `-m` and `-F` paths use `cleanup=whitespace` and are unaffected, so the
  warning never fires for them.

An existing non-`#` value (including `auto`) is left alone.

The gate cannot make this blocking, because from inside `commit-msg` there is no
way to know whether git will apply `cleanup=strip` or `cleanup=whitespace` — the
signal is the presence of a comment template, which is evidence rather than proof.
Warning keeps a legitimate `-m` commit from ever being refused on a guess.

> **The harness path needs the same setting.** Both install flows write an
> identical hook body, so commits are judged identically — but a repository wired
> by the TypeScript AI harness never gets `core.commentChar` set, and so relies on
> the warning alone. Setting it belongs alongside the harness's own hook write, in
> `hancrafted/typescript-ai-harness`.

## Repositories without a `package.json`

The gate needs only POSIX shell and git, so a Python project or a notes
repository can use it — just not via husky. Wire it directly:

```sh
git config core.hooksPath .githooks
mkdir -p .githooks
cat > .githooks/commit-msg <<'HOOK'
#!/bin/sh
exec sh "$(git rev-parse --show-toplevel)/.agents/skills/commit/scripts/commit-msg" "$1"
HOOK
chmod +x .githooks/commit-msg
git config core.commentChar ';'
```

Commit `.githooks/commit-msg`. Note that `core.hooksPath` and `core.commentChar`
are per-clone settings, so each contributor runs those two `git config` lines
once.

## Troubleshooting

| Symptom                                                      | Cause                                                                                               |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `commit gate not found`                                      | Skill missing, or installed with `--copy`. Reinstall at project scope.                              |
| Hook never runs                                              | `.husky/_` missing — run `npx husky`, or `npm install` so `prepare` fires.                          |
| Commit stored without its `### ` headings                    | `core.commentChar` is still `#`. Run the setup script, or set it by hand.                           |
| Gate rejects a message whose `Source:` line is clearly there | A trailer must be the last paragraph. Move prose above it and leave a blank line before it.         |
| Merge commit blocked                                         | The merge exemption probes `MERGE_HEAD`. If `git merge` already finished, it is not a merge commit. |
