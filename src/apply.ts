import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ensurePackageJson, mergePackageJson } from './package-json';
import type { Action, Exec } from './types';

export interface ApplyOpts {
  cwd: string;
  exec: Exec;
  dryRun?: boolean;
  log?: (message: string) => void;
}

interface Resolved {
  cwd: string;
  exec: Exec;
  dryRun: boolean;
  log: (message: string) => void;
}

/** Narrow an Action[] to a single kind, preserving emission order. */
const ofKind = <K extends Action['kind']>(actions: Action[], kind: K): Extract<Action, { kind: K }>[] =>
  actions.filter((a): a is Extract<Action, { kind: K }> => a.kind === kind);

/**
 * The single executor for every declarative Action (ADR-0004). Steps run in a
 * fixed canonical order regardless of emission order: merge package.json →
 * gitignore → install → write configs → run commands. Install precedes the
 * run-commands because their binaries (archgate, husky) must exist first.
 * `dryRun` reports every intended change and touches nothing (ADR-0002).
 */
export async function apply(actions: Action[], opts: ApplyOpts): Promise<void> {
  const ctx: Resolved = {
    cwd: opts.cwd,
    exec: opts.exec,
    dryRun: opts.dryRun ?? false,
    log: opts.log ?? (() => undefined),
  };
  ensurePkgStep(ctx);
  mergeStep(actions, ctx);
  appendStep(actions, ctx);
  await installStep(actions, ctx);
  writeStep(actions, ctx);
  await commandStep(actions, ctx);
}

function ensurePkgStep(ctx: Resolved): void {
  const absent = !existsSync(join(ctx.cwd, 'package.json'));
  if (!absent) return;
  ctx.log('init   package.json (minimal)');
  if (!ctx.dryRun) ensurePackageJson(ctx.cwd);
}

function mergeStep(actions: Action[], ctx: Resolved): void {
  const patches = ofKind(actions, 'mergePackageJson').map((a) => a.patch);
  if (!patches.length) return;
  const keys = patches.flatMap((p) => Object.keys(p.scripts ?? {}));
  ctx.log(`merge  package.json scripts: ${keys.join(', ')}`);
  if (!ctx.dryRun) mergePackageJson(ctx.cwd, patches);
}

function appendStep(actions: Action[], ctx: Resolved): void {
  for (const action of ofKind(actions, 'appendLines')) {
    ctx.log(`append ${action.path} += ${[...new Set(action.lines)].join(', ')}`);
    if (!ctx.dryRun) appendMissingLines(ctx.cwd, action.path, action.lines);
  }
}

async function installStep(actions: Action[], ctx: Resolved): Promise<void> {
  const dev = [...new Set(ofKind(actions, 'installDeps').flatMap((a) => a.dev))];
  if (!dev.length) return;
  ctx.log(`install npm i -D ${dev.join(' ')}`);
  if (!ctx.dryRun) await ctx.exec('npm', ['install', '--save-dev', ...dev], { cwd: ctx.cwd });
}

function writeStep(actions: Action[], ctx: Resolved): void {
  for (const action of ofKind(actions, 'writeFile')) writeOne(action, ctx);
}

async function commandStep(actions: Action[], ctx: Resolved): Promise<void> {
  for (const action of ofKind(actions, 'runCommand')) {
    ctx.log(`run    ${action.command} ${action.args.join(' ')}`);
    if (!ctx.dryRun) await ctx.exec(action.command, action.args, { cwd: ctx.cwd });
  }
}

function writeOne(action: Extract<Action, { kind: 'writeFile' }>, ctx: Resolved): void {
  const target = join(ctx.cwd, action.path);
  if (!action.overwrite && existsSync(target)) {
    ctx.log(`skip   ${action.path} (exists, not overwritten)`);
    return;
  }
  ctx.log(`write  ${action.path}`);
  if (ctx.dryRun) return;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, action.contents, { mode: action.path.startsWith('.husky/') ? 0o755 : 0o644 });
}

/**
 * Append only the entries not already present; never overwrite the file
 * (ADR-0002). Used for shared, user-extendable ignore files (`.gitignore`,
 * `.prettierignore`) so a re-run preserves the user's own additions.
 */
function appendMissingLines(cwd: string, relativePath: string, lines: string[]): void {
  const path = join(cwd, relativePath);
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const present = new Set(existing.split('\n').map((line) => line.trim()));
  const missing = [...new Set(lines)].filter((line) => !present.has(line.trim()));
  if (!missing.length) return;
  const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
  appendFileSync(path, `${prefix}${missing.join('\n')}\n`);
}
