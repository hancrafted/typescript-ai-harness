import type { Integration } from '../../types';
import { securityWorkflow } from './template';

/**
 * trivy scans for vulnerable dependencies, leaked secrets, and misconfigurations.
 * Because trivy is a standalone binary (no npm package), it ships purely as a
 * CI workflow — no devDependency, no `package.json` script, and deliberately not
 * in the local `verify` chain (a binary that may be absent must not break
 * `npm run verify`). No sub-options in the MVP.
 */
export const trivy: Integration = {
  id: 'trivy',
  label: 'trivy — dependency & config vulnerability scan (CI)',
  devDependencies: [],

  plan() {
    return [
      { kind: 'writeFile', path: '.github/workflows/security.yml', contents: securityWorkflow(), overwrite: true },
    ];
  },
};
