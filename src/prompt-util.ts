import { cancel, isCancel } from '@clack/prompts';

/**
 * Unwrap a `@clack/prompts` result, or exit cleanly if the user cancelled
 * (Ctrl-C / Esc). Centralizes the cancel-guard the interactive layer would
 * otherwise repeat at every prompt.
 */
export function orExit<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('Cancelled.');
    process.exit(0);
  }
  return value;
}
