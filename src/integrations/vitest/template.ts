/**
 * Minimal vitest config. Explicit imports (no `globals: true`) keep the target's
 * tsconfig types clean. v8 coverage provider is available but not enabled by
 * default (reporters/thresholds are a deferred sub-option).
 */
export function vitestConfig(): string {
  return `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
    },
  },
});
`;
}
