// Core bundle capture (ADR-0010 §1). Stages the canonical governed source in
// `.archgate/` into the committed `assets/core-bundle/` asset the CLI ships,
// reading membership from the Harness build config (`ADR_CORE` +
// `supportingFiles`). Wired into `prepack` so `npm pack`/`npm publish` always
// carry a fresh asset, and CI-gated (ci.yml) so the committed copy cannot lag
// its source. Repo-local release tooling — never shipped into Target projects
// (ADR-0003); the heavy lifting lives in the unit-covered `src/bundle.ts`.
import { join } from 'node:path';
import { captureBundle, projectRootOf } from '../src/bundle';
import { ADR_CORE, supportingFiles } from '../src/harness-config';

const repoRoot = projectRootOf(import.meta.url); // scripts/ -> repo root

const written = captureBundle({
  canonical: join(repoRoot, '.archgate'),
  assetRoot: join(repoRoot, 'assets', 'core-bundle'),
  core: ADR_CORE,
  supporting: supportingFiles,
});

console.log(`captured ${written.length} file(s) into assets/core-bundle`);
