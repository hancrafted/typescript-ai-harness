# Pure predicates over the text of a commit message. Nothing here touches git,
# the filesystem, or the environment — every function reads its arguments and
# writes to stdout, so each one is exercisable in isolation.
#
# Sourced by ../commit-msg. Not executable on its own.

# The eleven Conventional Commit types the contract admits.
GATE_TYPES='feat|fix|docs|refactor|chore|style|test|perf|build|ci|revert'

# Keep a Changelog v1.1.0's six categories. A closed set, so the body stays
# machine-readable for a future changelog generator.
GATE_CATEGORIES='Added|Changed|Deprecated|Removed|Fixed|Security'

# rules_line <text> <n> — line <n> of <text>, empty if there is no such line.
rules_line() {
  printf '%s\n' "$1" | sed -n "$2p"
}

# rules_body <message> — everything after the header and its blank line, with any
# leading blank lines dropped. Where the body starts is this module's business,
# so callers never re-encode it.
rules_body() {
  printf '%s\n' "$1" | sed -n '3,$p' | sed '/./,$!d'
}

# rules_header_ok <message> — `type(scope)!?: subject` on line 1, blank line 2.
# `!` is tolerated in both positions it can occupy and given no meaning.
rules_header_ok() {
  rules_line "$1" 1 | grep -Eq "^($GATE_TYPES)(\([^)]+\))?!?: .+" || return 1
  [ -z "$(rules_line "$1" 2)" ]
}

# rules_body_problem <message> — prints why the body fails and returns 1, or
# prints nothing and returns 0.
#
# Shape only, never sequence: a numbered item is any line starting with
# digits-dot-space. Mis-numbering renders fine and breaks nothing downstream, so
# getting it right is the skill's job rather than the gate's.
#
# Fenced lines (``` or ~~~) are quotation, not shape: a quoted `### ` heading is
# neither judged against the six categories nor counted as satisfying them.
rules_body_problem() {
  printf '%s\n' "$1" | awk -v cats="$GATE_CATEGORIES" '
    function problem(msg) { print msg; failed = 1; exit 1 }
    function no_item(name) { return "`### " name "` has no numbered item beneath it" }
    BEGIN {
      split(cats, list, "[|]")
      for (i in list) valid[list[i]] = 1
      shown = cats
      gsub(/\|/, ", ", shown)
    }
    /^(```|~~~)/ { fence = !fence; next }
    fence { next }
    /^### / {
      name = substr($0, 5)
      sub(/[ \t]+$/, "", name)
      if (!(name in valid)) problem("`### " name "` is not one of: " shown)
      if (pending != "") problem(no_item(pending))
      headings++
      pending = name
      next
    }
    /^[0-9]+\. / { pending = ""; next }
    END {
      if (failed) exit 1
      if (pending != "") { print no_item(pending); exit 1 }
      if (!headings) { print "no `### <category>` heading found"; exit 1 }
    }
  '
}

# rules_source_problem <value> — prints why one `Source:` value is unusable and
# returns 1, or prints nothing and returns 0.
#
# The value is `<canonical ref> | <prompt summary>`. Either part alone is valid,
# so long as one of them carries something. The *form* of the reference is
# delegated to the consuming repository's tracker documentation, which is what
# keeps the contract tracker-agnostic — with one exception the gate can check
# without knowing anything about the tracker: a bare issue number, with or
# without its `#`.
rules_source_problem() {
  if [ -z "$(printf '%s' "$1" | tr -d '|[:space:]')" ]; then
    printf 'the value is empty\n'
    return 1
  fi
  _rules_ref=$(printf '%s' "${1%%|*}" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
  if printf '%s' "$_rules_ref" | grep -Eq '^#?[0-9]+$'; then
    printf 'the reference `%s` is a bare issue number, which resolves to nothing in a fork, a\n' "$_rules_ref"
    printf 'mirror, or a corpus — expand it to a full URL\n'
    return 1
  fi
  return 0
}

# rules_is_autosquash <header> — `fixup!` / `squash!`, so --autosquash keeps
# working.
rules_is_autosquash() {
  case "$1" in
    'fixup!'* | 'squash!'*) return 0 ;;
    *) return 1 ;;
  esac
}

# rules_checkable_message <message> <comment-string> — <message> reduced to the
# lines a verdict can rest on: the scissors cut line and everything after it
# removed, git's own comment lines dropped, and CRLF endings normalised.
#
# A comment line is the comment string followed by a space or the end of the
# line, which is the form git generates. That is what lets the body's `### Added`
# survive even when the comment string is `#`.
#
# This is deliberately *not* a claim about what git will store — on the `-m` and
# `-F` paths git uses `cleanup=whitespace` and keeps comment lines. It does not
# have to be: a dropped line is neither a `### ` heading nor a numbered item, so
# no verdict can turn on one. They go because they would otherwise flood the
# diagnostics with git's own template.
rules_checkable_message() {
  printf '%s\n' "$1" | awk -v c="$2" '
    { sub(/\r$/, "") }
    index($0, c) == 1 {
      rest = substr($0, length(c) + 1)
      if (rest ~ /^[ \t]*-+[ \t]*>8[ \t]*-+[ \t]*$/) exit
      if (rest == "" || substr(rest, 1, 1) == " ") next
    }
    { print }
  '
}

# rules_has_git_comment_lines <message> <comment-string> — whether git wrote a
# comment template into this message, which means an editor ran and `cleanup=strip`
# will run after this hook returns. `-m` and `-F` never produce one.
#
# Matching requires the comment string to be followed by a space or the end of
# the line, which is the form git generates. That is what separates git's own
# `# Please enter…` from the body's `### Added` — the latter would otherwise look
# like a comment under the default configuration and defeat the check.
rules_has_git_comment_lines() {
  printf '%s\n' "$1" | awk -v c="$2" '
    index($0, c) == 1 &&
      (length($0) == length(c) || substr($0, length(c) + 1, 1) == " ") { found = 1 }
    END { exit found ? 0 : 1 }
  '
}

# rules_comment_string_eats_headings <comment-string> — whether git's cleanup
# will delete the body's `### <category>` headings, because they begin with the
# very character git treats as a comment. `auto` is safe: git then picks a
# character the message does not already use.
rules_comment_string_eats_headings() {
  case "$1" in
    '#'*) return 0 ;;
    *) return 1 ;;
  esac
}
