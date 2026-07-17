---
status: proposed
---

# Inter-Integration dependency resolution (deferred)

Some options are only meaningful for a *combination* of selected Integrations — e.g. `eslint-config-prettier` matters only when eslint **and** prettier are both selected. Today these cross-Integration effects are handled **imperatively and ad hoc**: an Integration's `plan()` / `promptSubOptions()` reads the overall selection from `ctx` and branches. There is currently exactly one such instance (eslint + prettier), plus the `verify` / lint-staged composition the husky Integration owns.

A future declarative mechanism is envisioned: a map of `condition → additional options/actions` (e.g. "when both eslint + prettier are selected → surface further options"), centralising the combination matrix instead of scattering `if (selected.includes(...))` across Integrations.

**Decision: defer.** With a single instance, building a declarative dependency-resolution engine now would be premature and would contradict the "no declarative engine for what `if` handles" guardrail (ADR-0004). Keep cross-Integration coupling imperative until 2–3 real instances exist to generalise from.

## Open questions (resolve when picked up)

- **Where does the logic live** — inside each Integration (imperative, but scattered, and an Integration must "know" about others) vs a central rules/dependency layer above the registry (declarative, whole matrix visible)?
- **Silent vs surfaced** — should combination-conditional effects be silent actions (today's `eslint-config-prettier` auto-append) or surfaced as extra prompts the user opts into?
- **Relationship to the prompt model (ADR-0004)** — conditional prompts already nest imperatively; a dependency map would sit as a layer above that.

## Consequences

- Until resolved, add cross-Integration effects imperatively in the relevant Integration's `plan()`, reading the selection from `ctx`.
