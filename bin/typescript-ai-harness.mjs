#!/usr/bin/env node
// Tiny launcher (ADR-0001): register tsx and import the TypeScript entry
// directly, so there is no build step and we ship source. Runtime deps stay
// limited to `@clack/prompts` + `tsx`, firewalled from the harness devDeps.
import { tsImport } from 'tsx/esm/api';

await tsImport('../src/cli.ts', import.meta.url);
