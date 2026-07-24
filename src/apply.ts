import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
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
 * gitignore → install → write configs → copy asset bundles → symlink into them
 * → run commands. Install precedes the run-commands because their binaries
 * (husky — the only shell-out left after ADR-0005 v4 retired `archgate init`)
 * must exist first; symlinks are created after the copy so their targets already
 * exist in the copied tree, and both precede the commands so a hook that runs
 * `archgate check` sees the materialised workspace.
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
  copyAssetStep(actions, ctx);
  symlinkStep(actions, ctx);
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

/**
 * Copy a bundled-asset (sub)tree into the Target (ADR-0010 §5). `from` is an
 * absolute path into the CLI's captured bundle (always under
 * `assets/core-bundle/`, #48); `to` is Target-relative (always under
 * `.archgate/`). The bundle is Tool-owned, so existing files are overwritten
 * (`force`) on every run.
 *
 * The copy is **unconditional** — there is no self-apply special case. Because
 * the source is always the committed asset and the destination always the
 * Target's `.archgate/`, the two never coincide, so the same `cpSync(force)` runs
 * for self-apply and a foreign Target alike (ADR-0010 §1/§4 v2). This is what
 * makes the self-apply dogfood the actual overwrite test rather than a skipped
 * no-op: the CI freshness guard keeps the asset byte-equal to canonical, so on a
 * committed state the overwrite yields a clean `git diff`.
 */
function copyAssetStep(actions: Action[], ctx: Resolved): void {
  for (const action of ofKind(actions, 'copyAsset')) {
    const dest = join(ctx.cwd, action.to);
    ctx.log(`copy   ${action.to} (from bundled asset)`);
    if (ctx.dryRun) continue;
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(action.from, dest, { recursive: true, force: true });
  }
}

function symlinkStep(actions: Action[], ctx: Resolved): void {
  for (const action of ofKind(actions, 'symlink')) symlinkOne(action, ctx);
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
 * Create a REAL relative symlink, replacing whatever is already at the path so a
 * re-run is idempotent (Tool-owned). It never falls back to copying the target's
 * body: a copy would let `archgate check` open the file and invert its
 * `adr-claude-rules-symlink` rule, turning every ADR into a false violation
 * (ADR-0010 §5). A creation failure — e.g. Windows without Developer Mode
 * (deferred, #4) — is wrapped and rethrown so it surfaces loudly instead of
 * degrading silently.
 */
function symlinkOne(action: Extract<Action, { kind: 'symlink' }>, ctx: Resolved): void {
  ctx.log(`symlink ${action.path} -> ${action.target}`);
  if (ctx.dryRun) return;
  const link = join(ctx.cwd, action.path);
  try {
    mkdirSync(dirname(link), { recursive: true });
    rmSync(link, { force: true });
    symlinkSync(action.target, link);
  } catch (cause) {
    throw new Error(
      `symlink ${action.path} -> ${action.target} failed: a real symlink is required ` +
        `(a copied file would invert archgate's adr-claude-rules-symlink check); this ` +
        `platform may need elevated permissions, e.g. Windows Developer Mode (#4)`,
      { cause },
    );
  }
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
