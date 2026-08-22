# How the gate explains itself. Diagnostics go to stderr so nothing here can be
# mistaken for part of the commit message.
#
# A rejection has to be actionable without guessing: it names which of the three
# conditions failed, what that condition wants, and what was actually written.
#
# Sourced by ../commit-msg. Not executable on its own.

gate_rejected=0

# Locals are not POSIX, so everything a sourced function keeps is prefixed to
# stay out of the entrypoint's namespace.

# gate_warn <line>... — non-blocking; the commit still goes through.
gate_warn() {
  for _report_line in "$@"; do
    printf '⚠ %s\n' "$_report_line" >&2
  done
}

# gate_reject <condition> <what-it-wants> [detail] — record and print one failed
# condition. Called once per condition, so a message failing two conditions is
# told about both.
gate_reject() {
  if [ "$gate_rejected" -eq 0 ]; then
    printf '✖ Commit message rejected by the commit gate.\n' >&2
    gate_rejected=1
  fi
  printf '\n  ✖ %s — %s\n' "$1" "$2" >&2
  if [ "$#" -ge 3 ]; then
    printf '%s\n' "$3" | sed 's/^/      /' >&2
  fi
}

# gate_abort <line>... — the gate could not run at all. Distinct from a
# rejection: nothing was judged.
gate_abort() {
  printf '✖ %s\n' "$1" >&2
  shift
  for _report_line in "$@"; do
    printf '  %s\n' "$_report_line" >&2
  done
  exit 1
}

# gate_footer — printed once, after every condition has had its say.
gate_footer() {
  printf '\n  The contract is documented in the `commit` skill: skills/commit/SKILL.md\n' >&2
}

# report_header_failure <message> — shows line 1 always, and line 2 as well when
# that is the part that broke.
report_header_failure() {
  _report_detail="types: $(printf '%s' "$GATE_TYPES" | tr '|' ' ')
got line 1: $(rules_line "$1" 1)"
  _report_second=$(rules_line "$1" 2)
  if [ -n "$_report_second" ]; then
    _report_detail="$_report_detail
got line 2: $_report_second   (must be blank)"
  fi
  gate_reject 'Header' 'Conventional Commits `type(scope)!?: subject`, then a blank line' "$_report_detail"
}

# report_body_failure <message> <problem> — echoes the body back so the mismatch
# is visible directly. Where the body starts is rules.sh's business.
report_body_failure() {
  gate_reject 'Body' 'at least one `### <category>` heading, each with a numbered item' "$2
got:
$(rules_body "$1")"
}

# report_source_failure <problem>
report_source_failure() {
  gate_reject 'Source trailer' "a usable \`Source:\` trailer git can actually parse" "$1
value: <canonical ref> | <prompt summary>   (either part alone is fine, not neither)
the trailer block must be the last paragraph, preceded by a blank line"
}
