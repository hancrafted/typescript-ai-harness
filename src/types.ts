/**
 * Shared vocabulary for the harness scaffolder.
 *
 * The nouns here mirror CONTEXT.md: an {@link Integration} installs one harness
 * capability; a {@link Ctx} carries the whole selection so an Integration can
 * make cross-Integration decisions (ADR-0008); an {@link Action} is the
 * declarative unit the central `apply()` executes (ADR-0004).
 */

export type IntegrationId = 'archgate' | 'eslint' | 'prettier' | 'vitest' | 'husky';

/** Injectable command runner — real spawn in prod, a spy in tests (Testing Decisions). */
export type Exec = (command: string, args: string[], opts: { cwd: string }) => Promise<void>;

/** The only key the tool sets/replaces inside a co-owned `package.json` (ADR-0002). */
export interface PackageJsonPatch {
  scripts?: Record<string, string>;
}

/**
 * Declarative change unit. `plan()` returns these; `apply()` executes them,
 * so overwrite / dry-run / merge logic lives in exactly one place (ADR-0004).
 */
export type Action =
  | { kind: 'writeFile'; path: string; contents: string; overwrite: boolean }
  | { kind: 'mergePackageJson'; patch: PackageJsonPatch }
  | { kind: 'appendLines'; path: string; lines: string[] }
  | { kind: 'installDeps'; dev: string[] }
  | { kind: 'runCommand'; command: string; args: string[] }
  // Copy a bundled-asset (sub)tree into the Target (ADR-0010 §5). `from` is an
  // absolute path into the CLI's captured bundle (the plan resolves it, #47/#48);
  // `to` is Target-relative. Tool-owned: overwritten on every run (ADR-0010 §4).
  | { kind: 'copyAsset'; from: string; to: string }
  // Create a REAL relative symlink at Target-relative `path`, pointing at
  // `target` — a relative path written verbatim into the link (e.g.
  // `../../.archgate/adrs/GEN-001-adr.md`). Real-symlink-only, never a copied
  // body: a copy would let archgate open the file and invert its
  // `adr-claude-rules-symlink` check, turning every ADR into a false violation
  // (ADR-0010 §5). Creation failure is loud — never a copy fallback.
  | { kind: 'symlink'; path: string; target: string };

/** Context handed to every `plan()` — notably the full selection for cross-Integration effects. */
export interface Ctx {
  cwd: string;
  selected: IntegrationId[];
  /** The `--yes` flag: headless, non-interactive. Still threaded through the plan (ADR-0005 v4), though archgate no longer branches on it — both modes direct-write the same Actions; `cli` uses it only to skip the interactive confirm. */
  yes: boolean;
}

/** archgate has no sub-options: the snapshot is fixed to editor `claude` (ADR-0005). */
export type ArchgateChoice = Record<string, never>;

export type EslintRuleId = 'complexity' | 'max-lines-per-function' | 'max-params' | 'max-depth' | 'max-lines';
export interface EslintChoice {
  rules: EslintRuleId[];
}

export type ImportSort = 'organize-imports' | 'ianvs' | 'off';
export interface PrettierChoice {
  importSort: ImportSort;
}

/** vitest has no sub-options in the MVP. */
export type VitestChoice = Record<string, never>;

export type HuskyHook = 'commit-msg' | 'pre-commit' | 'pre-push';
export interface HuskyChoice {
  hooks: HuskyHook[];
}

export type SubChoice = ArchgateChoice | EslintChoice | PrettierChoice | VitestChoice | HuskyChoice | undefined;

/**
 * A resolved set of user decisions. The interactive `@clack` layer produces
 * this; tests inject it directly to bypass the untested prompt shell.
 */
export interface Answers {
  integrations: IntegrationId[];
  archgate?: ArchgateChoice;
  eslint?: EslintChoice;
  prettier?: PrettierChoice;
  vitest?: VitestChoice;
  husky?: HuskyChoice;
}

/** A self-contained harness capability behind a uniform contract (ADR-0004). */
export interface Integration {
  id: IntegrationId;
  label: string;
  devDependencies: string[];
  /** Imperative, possibly-nested sub-option prompts (the extension point). */
  promptSubOptions?(): Promise<SubChoice>;
  /**
   * Maps a resolved choice to declarative Actions. Mutates nothing in the Target
   * and is safe for preview/dry-run; an Integration MAY read the CLI's own
   * shipped assets read-only (archgate lists its bundled Core ADRs — ADR-0010).
   * All Target IO stays in `apply()`, the single write chokepoint (ADR-0004).
   */
  plan(ctx: Ctx, choice: SubChoice): Action[];
}
