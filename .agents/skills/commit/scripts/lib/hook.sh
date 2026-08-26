# The canonical `.husky/commit-msg` body, kept in one place because two install
# flows write it: `../setup-husky` here, and the TypeScript AI harness's husky
# Integration from its own repository. If they ever disagree, commits are judged
# differently depending on how the repository was set up — so this function is
# the single definition, and `../../assets/setup-husky.md` reproduces it verbatim
# for the harness to copy.
#
# Sourced by ../setup-husky. Not executable on its own.

# The two paths the gate can live at. Fixed, not searched: the first is where
# `npx skills add` puts the skill, the second is a checkout of the skill's own
# repository.
GATE_INSTALLED_PATH='.agents/skills/commit/scripts/commit-msg'
GATE_REPO_PATH='skills/commit/scripts/commit-msg'

# gate_candidate_paths — the two paths, in probe order, one per line. The pair
# travels together everywhere it is used, so it is emitted from one place.
gate_candidate_paths() {
  printf '%s\n%s\n' "$GATE_INSTALLED_PATH" "$GATE_REPO_PATH"
}

# gate_hook_body — written to `.husky/commit-msg`. No shebang: husky runs this
# file with `sh -e`.
gate_hook_body() {
  cat <<HOOK
# Managed by the \`commit\` skill — rewritten by \`/commit --setup-husky\`.
# Edit the skill's contract, not this file.
#
# Delegates to the gate that ships inside the skill, so the enforced contract
# and the documented contract cannot drift apart.
root=\$(git rev-parse --show-toplevel) || exit 1

for gate in '$GATE_INSTALLED_PATH' '$GATE_REPO_PATH'; do
  if [ -f "\$root/\$gate" ]; then
    exec sh "\$root/\$gate" "\$1"
  fi
done

echo "✖ commit gate not found — the commit skill is not installed where this hook expects it." >&2
echo "  looked for: $GATE_INSTALLED_PATH" >&2
echo "         and: $GATE_REPO_PATH" >&2
echo "  install it with: npx skills add hancrafted/skills" >&2
echo "  project scope, and never --copy — copy mode breaks the single canonical path." >&2
exit 1
HOOK
}
