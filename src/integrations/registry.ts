import type { Integration } from '../types';
import { archgate } from './archgate';
import { eslint } from './eslint';
import { husky } from './husky';
import { prettier } from './prettier';
import { vitest } from './vitest';

/**
 * The explicit, hand-maintained registry (ADR-0004). Order matters: it drives
 * the prompt order and the run-command execution order (interactive `archgate
 * init` runs before husky). Adding an Integration = new folder + one line here.
 */
export const registry: Integration[] = [archgate, eslint, prettier, vitest, husky];
