import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { PackageJsonPatch } from './types';

const pkgPath = (cwd: string): string => join(cwd, 'package.json');

/**
 * Create a minimal `package.json` when the target has none (US-4). Returns
 * whether it wrote one, so callers can report the auto-init.
 */
export function ensurePackageJson(cwd: string): boolean {
  const path = pkgPath(cwd);
  if (existsSync(path)) return false;
  const pkg = { name: basename(cwd), version: '0.0.0', private: true };
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
  return true;
}

/**
 * The Target's declared `package.json` version, or null when it has none (no
 * file, or no `version` string). Read after apply to decide whether the seeded
 * harness config's version stamp will match what archgate's `config-version`
 * rule compares against in this Target (GEN-002 §1.4).
 */
export function readPackageVersion(cwd: string): string | null {
  const path = pkgPath(cwd);
  if (!existsSync(path)) return null;
  const pkg = JSON.parse(readFileSync(path, 'utf8')) as { version?: unknown };
  return typeof pkg.version === 'string' ? pkg.version : null;
}

/**
 * Surgical, idempotent merge (ADR-0002): the tool only ever sets/replaces its
 * own `scripts` keys. The project's name, version, dependencies, own scripts,
 * and every other field are left untouched. Never overwrites the file wholesale.
 */
export function mergePackageJson(cwd: string, patches: PackageJsonPatch[]): void {
  const path = pkgPath(cwd);
  const pkg = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const scripts: Record<string, string> = { ...((pkg.scripts as Record<string, string>) ?? {}) };
  for (const patch of patches) Object.assign(scripts, patch.scripts ?? {});
  pkg.scripts = scripts;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
}
