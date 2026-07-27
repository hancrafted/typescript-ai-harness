import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * True when `cwd` is anywhere inside a git work tree, found by walking up for a
 * `.git` entry — a directory in a normal clone, a file in a worktree or
 * submodule. This is the discovery git itself does (minus `GIT_DIR`/`GIT_WORK_TREE`
 * env overrides, irrelevant to a fresh install).
 *
 * The harness needs a git work tree: archgate's file walk only surfaces the
 * `.claude/rules/*.md` symlinks when git tracks the tree, so outside a repo
 * `adr-claude-rules-symlink` false-fails on the (present) symlinks. `apply()`
 * inits a repo when this returns false — checking for an *enclosing* work tree,
 * not just `cwd/.git`, so a Target that is a subdirectory of an existing repo is
 * never given a nested repo of its own.
 */
export function isInsideGitWorkTree(cwd: string): boolean {
  let dir = cwd;
  for (;;) {
    if (existsSync(join(dir, '.git'))) return true;
    const parent = dirname(dir);
    if (parent === dir) return false; // reached the filesystem root
    dir = parent;
  }
}
