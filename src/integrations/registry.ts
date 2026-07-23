import type { Integration } from '../types';
import { archgate } from './archgate';
import { eslint } from './eslint';
import { husky } from './husky';
import { prettier } from './prettier';
import { vitest } from './vitest';

/**
 * The explicit, hand-maintained registry (ADR-0004). Order matters: it drives
 * the prompt order and the emission order of the composed plan — archgate lays
 * down the governance bundle before husky's `npx husky` run-command (the only
 * shell-out left after ADR-0005 v4 retired `archgate init`). Adding an
 * Integration = new folder + one line here.
 */
export const registry: Integration[] = [archgate, eslint, prettier, vitest, husky];
