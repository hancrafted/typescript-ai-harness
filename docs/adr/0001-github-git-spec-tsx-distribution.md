# Distribute via GitHub git-spec, run TypeScript through tsx (no build, no publish — for now)

During active development the tool is run with `npx github:hancrafted/typescript-ai-harness`, which clones the repo and executes its `bin`. The `bin` is a small `.mjs` launcher that registers `tsx` (a runtime dependency) and imports the TypeScript entry directly, so there is no compile step and we ship source. We deliberately defer npm publishing + a compiled `dist/` — which would give the clean `npx typescript-ai-harness` name and faster cold starts — until the tool stabilises.

## Considered Options

- **git-spec + tsx (chosen):** zero build/publish friction, always-latest; costs cold-start latency (clone + install on each run) and risks pulling the tool's own harness devDependencies on every invocation.
- **npm publish + compiled `dist/`:** clean `npx typescript-ai-harness`, slim/fast installs; costs a build + publish pipeline. A later add-on, not an either/or.
- **Raw single-file URL:** not possible — `npx` cannot execute an arbitrary raw file URL, and `tsx` does not fetch URLs.

## Consequences

- Runtime dependencies (prompt library + `tsx`) must stay minimal and firewalled from the harness devDependencies, or git-spec cold starts balloon.
- Any `prepare` script (e.g. `husky`) must be guarded so it does not run for consumers installing via git-spec.
- The clean `npx typescript-ai-harness` invocation requires a registry publish; until then the invocation is `npx github:hancrafted/…`.
