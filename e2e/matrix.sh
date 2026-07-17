#!/usr/bin/env bash
# Phase 2: prove `verify` fails exactly when it should, per installed selection.
# No `set -e`: we WANT to observe non-zero exits. Every step records EXIT/EXPECT.
#
# Cases (husky is in every selection because it OWNS the `verify` script — a
# selection without husky has no `verify` at all; verify then composes only the
# other selected integrations, which is the US-35 behaviour under test):
#   full            [eslint prettier vitest husky] — per-check isolation + commit block (Case E)
#   eslint-only     [eslint husky]                 — verify = eslint . && tsc --noEmit
#   eslint-prettier [eslint prettier husky]        — + prettier, + eslint-config-prettier composed
#   vitest-only     [vitest husky]                 — verify = tsc --noEmit && vitest run

WT="/Users/han/Developer/ai-harness-setup/.claude/worktrees/harness-e2e"
BASE="/tmp/harness-e2e"
ANS="$WT/e2e/answers"
LOGS="$WT/e2e/logs"
mkdir -p "$LOGS"
SUMMARY="$LOGS/matrix-summary.txt"
: > "$SUMMARY"

say ()    { echo "$@" | tee -a "$SUMMARY"; }
record () { echo "RESULT | case=$1 | step=$2 | EXIT=$3 | EXPECT=$4" | tee -a "$SUMMARY"; }

init_target () { # dir
  rm -rf "$1"; mkdir -p "$1/src"
  git -C "$1" init -q
  git -C "$1" config user.email "e2e@example.com"
  git -C "$1" config user.name "e2e"
}
seam_install () { # dir answers log
  ( cd "$WT" && npx tsx e2e/install.ts "$1" "$ANS/$2" ) > "$LOGS/$3" 2>&1
  say "install $(basename "$1") rc=$? (log: $3)"
}
show_verify () { # dir
  say "  verify        = $(node -e "process.stdout.write(String(require('$1/package.json').scripts.verify||'<none>'))")"
  say "  verify:commit = $(node -e "process.stdout.write(String(require('$1/package.json').scripts['verify:commit']||'<none>'))")"
}
run_in ()  { ( cd "$1" && shift && eval "$@" ) >/dev/null 2>&1; echo $?; }        # silent, returns exit
log_in ()  { ( cd "$1" && shift; log="$1"; shift && eval "$@" ) ; }               # (unused helper)

ctrl_notest ()   { printf 'export const answer = 42;\n' > "$1/src/index.ts"; }
ctrl_withtest () {
  printf 'export const answer = 42;\n' > "$1/src/index.ts"
  cat > "$1/src/control.test.ts" <<'EOF'
import { expect, test } from 'vitest';

test('control passes', () => {
  expect(1 + 1).toBe(2);
});
EOF
}
fx_eslint ()  {
  cat > "$1/src/eslint-fail.ts" <<'EOF'
export function addFour(a: number, b: number, c: number, d: number): number {
  return a + b + c + d;
}
EOF
}
fx_prettier () { printf "export const gap =    'x';\n" > "$1/src/prettier-fail.ts"; }
fx_tsc ()      { printf "export const count: number = 'not a number';\n" > "$1/src/tsc-fail.ts"; }
fx_vitest ()   {
  cat > "$1/src/vitest-fail.test.ts" <<'EOF'
import { expect, test } from 'vitest';

test('deliberate failure', () => {
  expect(1 + 1).toBe(3);
});
EOF
}

# helper: run a command in dir, tee to a log, record RESULT
step () { # case step dir expect logname cmd...
  local c="$1" s="$2" d="$3" e="$4" l="$5"; shift 5
  ( cd "$d" && eval "$@" ) > "$LOGS/$l" 2>&1
  record "$c" "$s" "$?" "$e"
}

########################### CASE: full ###########################
say ""; say "===================== CASE full ====================="
FULL="$BASE/full"; init_target "$FULL"
seam_install "$FULL" "full.json" "install-full.log"
show_verify "$FULL"
ctrl_withtest "$FULL"
step full control                 "$FULL" pass full-control.log        'npm run verify'
# eslint break (isolated)
fx_eslint "$FULL"
step full verify-eslint-break     "$FULL" fail full-eslint-verify.log  'npm run verify'
step full eslint-cmd              "$FULL" fail full-eslint-cmd.log      'npx eslint .'
rm -f "$FULL/src/eslint-fail.ts"
# prettier break (isolated) — eslint must still pass (eslint-config-prettier)
fx_prettier "$FULL"
step full verify-prettier-break   "$FULL" fail full-prettier-verify.log 'npm run verify'
step full prettier-cmd            "$FULL" fail full-prettier-cmd.log    'npx prettier --check .'
step full eslint-isolation        "$FULL" pass full-prettier-eslint.log 'npx eslint .'
rm -f "$FULL/src/prettier-fail.ts"
# tsc break (isolated)
fx_tsc "$FULL"
step full verify-tsc-break        "$FULL" fail full-tsc-verify.log      'npm run verify'
step full tsc-cmd                 "$FULL" fail full-tsc-cmd.log         'npx tsc --noEmit'
step full eslint-isolation-tsc    "$FULL" pass full-tsc-eslint.log      'npx eslint .'
rm -f "$FULL/src/tsc-fail.ts"
# vitest break (isolated)
fx_vitest "$FULL"
step full verify-vitest-break     "$FULL" fail full-vitest-verify.log   'npm run verify'
step full vitest-cmd              "$FULL" fail full-vitest-cmd.log      'npx vitest run'
rm -f "$FULL/src/vitest-fail.test.ts"
# CASE E: husky commit gate — clean tree commits, broken tree is blocked
step full commit-clean-tree       "$FULL" pass full-commit-clean.log    'git add -A && git commit -q -m "chore: initial green harness"'
fx_tsc "$FULL"
step full commit-broken-tree      "$FULL" fail full-commit-broken.log   'git add -A && git commit -q -m "chore: intentionally broken tree"'
rm -f "$FULL/src/tsc-fail.ts"

########################### CASE: eslint-only ###########################
say ""; say "================= CASE eslint-only =================="
EO="$BASE/eslint-only"; init_target "$EO"
seam_install "$EO" "eslint-only.json" "install-eslint-only.log"
show_verify "$EO"
ctrl_notest "$EO"
step eslint-only control          "$EO" pass eo-control.log   'npm run verify'
fx_eslint "$EO"
step eslint-only verify-fail      "$EO" fail eo-verify.log    'npm run verify'
rm -f "$EO/src/eslint-fail.ts"

########################### CASE: eslint-prettier ###########################
say ""; say "=============== CASE eslint-prettier ================"
EP="$BASE/eslint-prettier"; init_target "$EP"
seam_install "$EP" "eslint-prettier.json" "install-eslint-prettier.log"
show_verify "$EP"
say "  eslint-config-prettier composed? $(grep -c 'eslintConfigPrettier' "$EP/eslint.config.mjs") match(es) in eslint.config.mjs"
ctrl_notest "$EP"
step eslint-prettier control      "$EP" pass ep-control.log   'npm run verify'
fx_prettier "$EP"
step eslint-prettier verify-fail  "$EP" fail ep-verify.log    'npm run verify'
step eslint-prettier eslint-isolation "$EP" pass ep-eslint.log 'npx eslint .'
rm -f "$EP/src/prettier-fail.ts"

########################### CASE: vitest-only ###########################
say ""; say "================= CASE vitest-only =================="
VO="$BASE/vitest-only"; init_target "$VO"
seam_install "$VO" "vitest-only.json" "install-vitest-only.log"
show_verify "$VO"
ctrl_withtest "$VO"
step vitest-only control          "$VO" pass vo-control.log   'npm run verify'
fx_vitest "$VO"
step vitest-only verify-fail      "$VO" fail vo-verify.log    'npm run verify'
rm -f "$VO/src/vitest-fail.test.ts"

say ""; say "===================== DONE ====================="
