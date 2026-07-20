import { spawn } from 'node:child_process';
import type { Exec } from './types';

/**
 * Real command runner: inherits stdio so `npm install` / `archgate init` /
 * `npx husky` output streams to the user (and interactive `archgate init` can
 * prompt), and rejects on a non-zero exit. Injected as `exec` into
 * `apply()`; tests substitute a spy so nothing shells out or hits the network.
 */
export const realExec: Exec = (command, args, { cwd }) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'null'}`));
    });
  });
