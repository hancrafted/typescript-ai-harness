# AI Harness Setup

An interactive CLI that installs and configures external dependencies as a standard dev-tooling **harness** for agentic engineering environments, so each new Node/TypeScript project doesn't re-derive the same boilerplate.

## Language

**Harness**:
The full set of Integrations installed into a target project — the external dev-tooling dependencies plus the scripts and config that wire them together for an agentic engineering workflow.
_Avoid_: setup, boilerplate, toolkit

**Integration**:
A self-contained module that installs and configures one harness capability — wrapping one or more Dependencies, its config template(s), its sub-options, and its `package.json` patch. The five current Integrations: archgate, eslint, prettier, vitest, husky.
_Avoid_: feature, tool, plugin

**Dependency**:
A raw external npm package the tool installs (e.g. `eslint`, `archgate`, `lint-staged`, `tsx`). One Integration may pull several.
_Avoid_: library (when precision between the package and the Integration matters)

**sub-option**:
A nested choice within an Integration (e.g. eslint's clean-code rules, husky's hooks). The extension point where Integrations grow over time.
_Avoid_: option (reserved for `@clack/prompts` list items), flag

**Target project**:
The external project the harness is installed into. Distinct from this tool's own repo (which self-applies the harness — see ADR-0003).
_Avoid_: destination, consumer, client

**Tool-owned config file**:
A config file the tool writes and fully overwrites on re-run (`eslint.config.js`, the prettier config, `vitest.config.ts`, `.husky/*`, `.archgate/*`). Contrast with `package.json`, which is surgically merged, never overwritten.
_Avoid_: generated file, output file
