---
status: amended 2026-07-20 — publishing enabled (see ADR-0009)
---

# Distribute via GitHub git-spec + tsx in development; publish a bundled `dist/` to npm for consumers

During active development the tool is run with `npx github:hancrafted/typescript-ai-harness`, which clones the repo and executes its `bin` — a small `.mjs` launcher that registers `tsx` (a dev-time dependency) and imports `src/cli.ts` directly, so contributors need no compile step and the repo ships source. For end users the tool is **also published to npm** as `@hancrafted/typescript-ai-harness`: a single bundled `dist/cli.mjs` (release process in [ADR-0009](0009-ci-cd-and-npm-release.md)), so `npx @hancrafted/typescript-ai-harness` runs one small tarball with **zero runtime dependency installs**. The two paths coexist: git-spec + tsx for the dev inner loop, bundled npm publish for consumers.

## Considered Options

- **git-spec + tsx (dev inner loop, chosen):** zero build/publish friction, always-latest; costs cold-start latency (clone + install on each run) and risks pulling the tool's own harness devDependencies on every invocation.
- **npm publish + bundled `dist/` (consumer path, now chosen):** clean `npx @hancrafted/typescript-ai-harness`, slim/fast installs, zero runtime deps; costs a build + publish pipeline. Originally deferred here as "a later add-on, not an either/or", and enabled once the shape stabilised (see Update).
- **Raw single-file URL:** not possible — `npx` cannot execute an arbitrary raw file URL, and `tsx` does not fetch URLs.

## Consequences

- Runtime dependencies (prompt library only, post-amendment) must stay minimal and firewalled from the harness devDependencies, or git-spec cold starts balloon.
- Any `prepare` script (e.g. `husky`) must be guarded so it does not run for consumers installing via git-spec.
- Two bin entry paths now coexist: dev runs `src/cli.ts` through the tsx launcher; the published package's `bin` points at the bundled `dist/cli.mjs`. `tsx` is therefore a **devDependency**, not a runtime dependency of the published tarball.

## Update — 2026-07-20: publishing enabled

The original "no build, no publish — for now" stance is lifted. The tool now publishes to npm as a **single-file bundle** (`tsup` → `dist/cli.mjs`, `files: ["dist"]`), and `tsx` moves from `dependencies` to `devDependencies`. The build / test / publish pipeline, release ritual, and auth model are recorded in **[ADR-0009](0009-ci-cd-and-npm-release.md)**. The git-spec + tsx dev inner loop is unchanged.
