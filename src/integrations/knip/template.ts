import type { IntegrationId } from '../../types';

/**
 * knip's `knip.json`. Zero-config auto-detection already resolves entry points
 * from `package.json` (main/bin/exports) and `*.test.ts`, so we set only
 * `project` (the file universe to check) plus `ignoreExportsUsedInFile` (don't
 * flag an export that is only consumed inside its own file).
 *
 * When archgate is also selected, its `.archgate/adrs/*.rules.ts` files are
 * executed by `archgate check` rather than imported, so they are declared as
 * entry points (and folded into `project`) to keep them off the "unused"
 * report — the same cross-Integration composition eslint uses for prettier
 * (ADR-0008). Assembled as prettier-clean JSON (inline arrays, no trailing
 * comma) so the file passes a target's own `prettier --check .`.
 */
export function knipConfig(selected: IntegrationId[]): string {
  const withArchgate = selected.includes('archgate');
  const project = ['src/**/*.ts', '*.ts'];
  if (withArchgate) project.push('.archgate/**/*.ts');

  const lines = ['"$schema": "https://unpkg.com/knip@6/schema.json"'];
  if (withArchgate) lines.push('"entry": [".archgate/adrs/*.rules.ts"]');
  lines.push(`"project": [${project.map((glob) => `"${glob}"`).join(', ')}]`);
  lines.push('"ignoreExportsUsedInFile": true');

  return `{\n${lines.map((line) => `  ${line}`).join(',\n')}\n}\n`;
}
