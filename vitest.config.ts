import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.{test,spec}.ts'],
    // The captured Core bundle asset mirrors `.archgate/` byte-for-byte, so it
    // carries copies of the `*.rules.test.ts` files. Those copies resolve their
    // fixtures and real-repo reads relative to `.archgate/`, not the asset, so
    // running them here would fail — exclude the asset, exactly as the canonical
    // source is the only governed copy (ADR-0010 §1).
    exclude: [...configDefaults.exclude, 'assets/**'],
    coverage: {
      provider: 'v8',
    },
  },
});
