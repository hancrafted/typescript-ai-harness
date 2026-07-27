import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isInsideGitWorkTree } from './git';

// isInsideGitWorkTree drives apply()'s auto git init: it must see an *enclosing*
// work tree (so a subdirectory Target of an existing repo is never re-inited and
// nested) and report a truly repo-less dir as outside. Temp dirs live under the
// OS tmp root, which is not itself a git work tree.

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'harness-git-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('isInsideGitWorkTree', () => {
  it('is false for a directory with no enclosing repo', () => {
    expect(isInsideGitWorkTree(root)).toBe(false);
  });

  it('is true when the directory itself holds a .git directory', () => {
    mkdirSync(join(root, '.git'));
    expect(isInsideGitWorkTree(root)).toBe(true);
  });

  it('is true when .git is a file (worktree / submodule)', () => {
    writeFileSync(join(root, '.git'), 'gitdir: /elsewhere/.git/worktrees/x\n');
    expect(isInsideGitWorkTree(root)).toBe(true);
  });

  it('is true for a subdirectory of a repo — so apply never nests a new repo', () => {
    mkdirSync(join(root, '.git'));
    const sub = join(root, 'packages', 'app');
    mkdirSync(sub, { recursive: true });
    expect(isInsideGitWorkTree(sub)).toBe(true);
  });
});
