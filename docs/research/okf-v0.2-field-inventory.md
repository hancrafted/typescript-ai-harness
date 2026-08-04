---
type: research
title: "OKF v0.2 frontmatter field inventory"
description: "Field-by-field inventory of Open Knowledge Format v0.2 frontmatter with each field's requiredness quoted verbatim from the spec, the diff against the GEN-003 floor, OKF's versioning and extensibility story, and the v0.1 to v0.2 changes."
tags: okf, frontmatter, governance, research
---

# OKF v0.2 frontmatter field inventory

Research for [#84](https://github.com/hancrafted/typescript-ai-harness/issues/84), part of map [#83](https://github.com/hancrafted/typescript-ai-harness/issues/83).

## Sources and how they were read

Everything below is read from the spec text itself, not from any summary of it.

| Source | What it is | Retrieved |
| --- | --- | --- |
| [`okf/SPEC.md`](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) @ [`3fcbb9f`](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/3fcbb9f828c2f23d109c855ee403c3a4c81f3a96/okf/SPEC.md) | The normative v0.2 spec. Header reads **"Version 0.2"** (the v0.1 header's "— Draft" qualifier is gone). | 2026-08-04 |
| [`okf/SPEC.md` @ `ee67a5c`](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/ee67a5ca27044ebe7c38385f5b6cffc2305a9c1a/okf/SPEC.md) | The v0.1 spec, still reachable in git history. Used to verify §13's own account of the v0.1 → v0.2 diff rather than trusting it. | 2026-08-04 |
| [`okf/src/reference_agent/bundle/document.py`](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/src/reference_agent/bundle/document.py) | Google's first-party reference implementation — the only executable statement of requiredness that exists. | 2026-08-04 |
| [`okf/bundles/*`](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf/bundles) | Four first-party sample bundles, used as evidence of de-facto practice. | 2026-08-04 |

Three facts about the sources that matter more than they look:

1. **The spec moved.** `GEN-003-frontmatter`'s References section cites `https://github.com/google/open-knowledge-format`. That repo **404s** (verified against the GitHub API). OKF's canonical home is now the `okf/` subdirectory of `GoogleCloudPlatform/knowledge-catalog`. The ADR family must re-point this citation.
2. **Section numbers are not stable across versions.** v0.2 renumbered everything from §5 onward: v0.1's §9 Conformance is v0.2's §11, v0.1's §11 Versioning is v0.2's §12, v0.1's §5 Cross-linking is v0.2's §6. A citation of the form "OKF §9" written against v0.1 now points at Log files. **Cite by heading text or pin a commit SHA, never by bare section number.**
3. **The churn window is six weeks.** v0.1 landed 2026-06-12 (`ee67a5c`, PR #28); v0.2 replaced it 2026-07-24 (`780fe9d`, PR #227). Two spec versions in six weeks is the churn rate the ADR family is designing against.

## 1. Field inventory

Anchors are fragments on `okf/SPEC.md`. Nested keys are written dotted; `[]` marks a list element.

### 1.1 Core and recommended (§4.1)

| Field | Type | Requiredness — spec's own wording | Group | Anchor |
| --- | --- | --- | --- | --- |
| `type` | string — "A short string identifying the kind of concept" | Listed under the heading **"Required:"**; inline comment `# REQUIRED`; "`type` is the **only always-required key**; a concept carrying just `type` is fully conformant (§11)." Conformance §11.2: "Every frontmatter block contains a non-empty `type` field." | core/required | [#41-frontmatter](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#41-frontmatter), [#11-conformance](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#11-conformance) |
| `title` | string | Listed under **"Recommended:"**; inline comment `title: <Optional display name>`. "If omitted, consumers MAY derive a title from the filename." | recommended | [#41-frontmatter](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#41-frontmatter) |
| `description` | string — "A single sentence summarizing the concept" | **"Recommended:"**; inline comment `<Optional one-line summary>`. | recommended | [#41-frontmatter](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#41-frontmatter) |
| `resource` | URI / path string (§6.2: absolute URL, bundle-relative path beginning `/`, or relative path) | **"Recommended:"**; inline comment `<Optional canonical URI for the underlying asset>`. "Absent for concepts that describe abstract ideas rather than physical resources." | recommended | [#41-frontmatter](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#41-frontmatter), [#62-path-valued-fields](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#62-path-valued-fields) |
| `tags` | **YAML list** of strings — "A YAML list of short strings for cross-cutting categorization"; sample `tags: [<tag>, <tag>, ...]` | **"Recommended:"**; inline comment `# Optional`. | recommended | [#41-frontmatter](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#41-frontmatter) |

Extension keys, same section: "**Extensions:** Producers MAY include any additional keys. Consumers SHOULD preserve unknown keys when round-tripping and MUST NOT reject documents with unrecognized fields."

### 1.2 Provenance family (§5.1)

The whole family is gated by the §5 preamble: "These frontmatter families make 'where did this come from,' 'how much should I trust it,' and 'is it still current' answerable from frontmatter. **All are optional.** Their absence carries meaning: an unverified concept is distinguishable from a verified one, but is never rejected (§11)." §4.1 restates it: "The **optional** provenance, trust, and lifecycle families (§5) … may also appear."

| Field | Type | Requiredness — spec's own wording | Group | Anchor |
| --- | --- | --- | --- | --- |
| `sources` | list of mappings | Family-level: "All are optional" (§5 preamble); "The optional provenance … families" (§4.1). | provenance | [#51-provenance-sources](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#51-provenance-sources) |
| `sources[].resource` | path/URI string **or** scope descriptor ("for example `all queries in BigQuery project X`") | "**REQUIRED within an entry.**" — conditional: required only once the entry exists. | provenance | [#51-provenance-sources](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#51-provenance-sources) |
| `sources[].id` | string | "**Optional.** A stable key used to attribute individual claims (see below). **SHOULD be present when the body cites the source.**" — optional with a conditional SHOULD. | provenance | [#51-provenance-sources](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#51-provenance-sources) |
| `sources[].title` | string | "**Optional.** Human-readable label for the source." | provenance | [#51-provenance-sources](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#51-provenance-sources) |
| `sources[].author` | actor string (§7 convention) | "**Each signal is optional** and lives on a `sources` entry: `author`: Who or what produced the source, in the actor convention (§7). An authority signal." | provenance (credibility signal) | [#51-provenance-sources](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#51-provenance-sources) |
| `sources[].usage_count` | integer | "**Each signal is optional**" — "How often `resource` was exercised … over `usage_window`. An adoption and liveness signal." | provenance (credibility signal) | [#51-provenance-sources](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#51-provenance-sources) |
| `sources[].last_modified` | date, `YYYY-MM-DD` | "**Each signal is optional**" — "When the source itself last changed (`YYYY-MM-DD`). A recency signal, distinct from `generated.at` (§5.2)." | provenance (credibility signal) | [#51-provenance-sources](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#51-provenance-sources) |
| `usage_window` | mapping `{ from, to }` of dates | "**Each signal is optional**"; structurally: "Written once as a **sibling of `sources`**, it frames every `usage_count` with a `{ from, to }` date range. A single entry MAY carry its own `usage_window` to override the shared one." | provenance (credibility signal) | [#51-provenance-sources](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#51-provenance-sources) |
| `usage_window.from` / `usage_window.to` | date | **Spec is silent.** No MUST/SHOULD/REQUIRED/Optional marker on either sub-key; the shape is only shown by example (`usage_window: { from: 2026-06-01, to: 2026-06-30 }`). See §2.3. | provenance | [#51-provenance-sources](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#51-provenance-sources) |

Note `usage_window` is a **top-level** key in the two-key-deep sense — it sits beside `sources`, not inside it, except when overriding per entry. Both placements are legal.

### 1.3 Trust family (§5.2)

| Field | Type | Requiredness — spec's own wording | Group | Anchor |
| --- | --- | --- | --- | --- |
| `generated` | mapping `{ by, at }` | Family-level "All are optional" (§5 preamble). | trust | [#52-trust-generated-and-verified](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#52-trust-generated-and-verified) |
| `generated.by` | actor string (§7) | "**REQUIRED within `generated`.** An actor (§7)." | trust | [#52-trust-generated-and-verified](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#52-trust-generated-and-verified) |
| `generated.at` | ISO 8601 datetime | **Spec is silent.** Full text: "`generated.at`: An ISO 8601 datetime marking the content's last meaningful change. Consumers use it to tell a recent edit from a stale fact." No requiredness marker, in a bullet list where the sibling `by` is explicitly marked REQUIRED. See §2.3. | trust | [#52-trust-generated-and-verified](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#52-trust-generated-and-verified) |
| `verified` | list of `{ by, at }` mappings, or a single bare mapping | Family-level "All are optional". Shape MUST: "A single verifier MAY be written as one `{ by, at }` mapping without the list dash. **Consumers MUST treat a bare mapping as a one-element list.**" Restated as a conformance MUST in §11. | trust | [#52-trust-generated-and-verified](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#52-trust-generated-and-verified) |
| `verified[].by` | actor string (§7) | **No explicit marker.** "`verified`: A list of verification events, **each with** `by` (an actor) and `at` (an ISO 8601 datetime)." §7 adds a producer MUST on the value's *form*, not its presence: "Consumers that classify trust (§5.3) key off the `human:` prefix, so producers **MUST** use it for hand-authored or human-confirmed content." | trust | [#52-trust-generated-and-verified](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#52-trust-generated-and-verified), [#7-actor-convention](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#7-actor-convention) |
| `verified[].at` | ISO 8601 datetime | **No explicit marker** — same "each with `by` … and `at`" sentence. "'How recently' is the latest `at`." | trust | [#52-trust-generated-and-verified](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#52-trust-generated-and-verified) |

Derived, not stored — no field of its own: **trust tier** is computed from `verified` (§5.3: "No `verified` key ⇒ unverified. `verified` by non-`human:` actors only ⇒ machine-confirmed. `verified` by a `human:<id>` actor ⇒ human-reviewed"), and **credibility** is likewise inferred, never stored: "It does not store a credibility score: a score is subjective, unportable across consumers, and goes stale" (§5.1). Any ADR that adds a `trust_tier` or `credibility` key would be inventing a field OKF deliberately refused.

### 1.4 Lifecycle family (§5.4, §5.5)

| Field | Type | Requiredness — spec's own wording | Group | Anchor |
| --- | --- | --- | --- | --- |
| `status` | enum: `draft` \| `stable` \| `deprecated` | Family-level "All are optional"; explicit default: "**Absent `status` ⇒ `stable`.**" Values: "`draft`: not yet reviewed; possibly incomplete. `stable`: default; ready for consumption. `deprecated`: kept for links and history; no longer current." | lifecycle | [#54-lifecycle-status](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#54-lifecycle-status) |
| `stale_after` | absolute date, `YYYY-MM-DD` | "**Optional.** An absolute date (`YYYY-MM-DD`). A concept is stale when `today >= stale_after`." | lifecycle | [#55-lifecycle-stale_after](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#55-lifecycle-stale_after) |

### 1.5 Computation family (§10.2) — `type: Attested Computation` only

Scope sentence: "The contract is the concept's top-level frontmatter. In addition to the provenance, trust, and lifecycle families (§5), an Attested Computation concept carries: …"

| Field | Type | Requiredness — spec's own wording | Group | Anchor |
| --- | --- | --- | --- | --- |
| `runtime` | string — example values `bigquery`, `postgres`, `dbt`, `python`, `Looker` | "**REQUIRED for this type.** The single field that says how to run the computation, and so how the executor and attester interpret it and what `parameters` mean." — conditional on `type: Attested Computation`. | computation (type-conditional) | [#102-contract-fields](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#102-contract-fields) |
| `parameters` | list of mappings — "Each entry: `{ name, type, required }`" | **No explicit marker.** "A list of the typed, named holes the agent may fill. … Binding semantics follow `runtime`." | computation | [#102-contract-fields](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#102-contract-fields) |
| `parameters[].name` / `.type` / `.required` | string / string (`integer`, `string`, …) / boolean | **No explicit markers**; the shape is given only as `{ name, type, required }` plus examples. Note the collision hazard: `required` is itself an OKF *field name* here. | computation | [#102-contract-fields](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#102-contract-fields) |
| `computation` | path string (§6.2) | "**Optional.** A path (§6.2) to a file holding the computation, used instead of an inline body fence (see §10.3). **Absent ⇒ the body `# Computation` fence is the computation.**" | computation | [#102-contract-fields](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#102-contract-fields), [#103-the-computation](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#103-the-computation) |
| `executor` | mapping `{ resource, receipt }` | **No explicit marker.** "How the computation is run." | computation | [#102-contract-fields](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#102-contract-fields) |
| `executor.resource` | path string (§6.2) | **No explicit marker.** "`resource` names run instructions or code; a runner (an agent, or deterministic consumer code) follows it." | computation | [#102-contract-fields](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#102-contract-fields) |
| `executor.receipt` | list of field names, e.g. `[job_id, executed_sql, result]` | **No explicit marker.** "`receipt` declares the fields a run must return, the evidence the attester inspects." | computation | [#102-contract-fields](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#102-contract-fields) |
| `attester` | mapping `{ resource }` | **No explicit marker.** "The deterministic check." | computation | [#102-contract-fields](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#102-contract-fields) |
| `attester.resource` | path string (§6.2) | **No explicit marker.** "`resource` names code (no LLM) that takes a receipt and returns a verdict. It is meant to run consumer-side." | computation | [#102-contract-fields](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#102-contract-fields) |

### 1.6 Bundle-level field — not a concept field

| Field | Type | Requiredness — spec's own wording | Group | Anchor |
| --- | --- | --- | --- | --- |
| `okf_version` | string, quoted: `okf_version: "0.2"` | "Bundles **MAY** declare the version they target with `okf_version: "0.2"` in a bundle-root `index.md` frontmatter block (**the only place frontmatter is permitted in an `index.md`**)." §8 restates: "Index files contain no frontmatter, with one exception: a bundle-root `index.md` MAY carry an `okf_version` key (§12)." | versioning (bundle scope, not concept scope) | [#12-versioning](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#12-versioning), [#8-index-files](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md#8-index-files) |

### 1.7 Counts

- **17 named keys at frontmatter top level**: 16 concept-document keys (`type`, `title`, `description`, `resource`, `tags`, `sources`, `usage_window`, `generated`, `verified`, `status`, `stale_after`, `runtime`, `parameters`, `computation`, `executor`, `attester`) plus `okf_version`, which is bundle-root-`index.md`-only.
- **18 nested keys**: 6 under `sources[]`, 2 under `usage_window`, 2 under `generated`, 2 under `verified[]`, 3 under `parameters[]`, 2 under `executor`, 1 under `attester`.
- **Unconditionally required: exactly 1** — `type`.
- **Conditionally required with explicit REQUIRED language: 3** — `sources[].resource` ("REQUIRED within an entry"), `generated.by` ("REQUIRED within `generated`"), `runtime` ("REQUIRED for this type").
- **Recommended: 4** — `title`, `description`, `resource`, `tags`. (`sources[].id` carries a conditional SHOULD, not a Recommended label.)
- **Provenance / trust / lifecycle: 6 top-level keys and 12 nested keys** — provenance 2 + 8 (`sources` + `usage_window`), trust 2 + 4 (`generated`, `verified`), lifecycle 2 + 0 (`status`, `stale_after`).
- **Computation: 5 top-level keys and 6 nested**, all gated on `type: Attested Computation`.

## 2. Reading the requiredness vocabulary

### 2.1 v0.2 uses two vocabularies at once, and only one of them is normative

The spec mixes RFC-2119-style keywords (MUST, MUST NOT, SHOULD, MAY, REQUIRED) with prose labels ("Required:", "Recommended:", "Optional."). It never defines the keywords or claims RFC 2119. The two vocabularies land in different places:

- **RFC-2119 keywords are aimed overwhelmingly at consumers, not producers.** Nearly every MUST in the document constrains what a reader may *reject*, not what a writer must *emit*: "consumers MUST tolerate unknown types gracefully" (§4.1), "Consumers MUST tolerate broken links" (§6.1), "consumers MUST NOT reject it" (§5.3), "MUST NOT reject a concept for missing any optional family" (§11).
- **Per-field requiredness is carried by the prose labels** — the "Required:" / "Recommended:" headings in §4.1, the word "Optional." opening a bullet, and the phrases "REQUIRED within an entry" / "REQUIRED within `generated`" / "REQUIRED for this type".

The one place the two vocabularies are stitched together is the conformance section, and it is unambiguous. §11: "A bundle is **conformant** with OKF v0.2 if: 1. Every non-reserved `.md` file in the tree contains a parseable YAML frontmatter block. 2. Every frontmatter block contains a non-empty `type` field. 3. Every reserved filename (`index.md`, `log.md`) follows the structure in §8 and §9 respectively when present."

**Nothing but `type` appears in the conformance test.** §4.1 says it in one sentence: "`type` is the only always-required key; a concept carrying just `type` is fully conformant (§11)."

### 2.2 The reference implementation agrees, in code

Google's own consumer encodes exactly one required key — [`document.py`](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/src/reference_agent/bundle/document.py):

```python
# OKF v0.2 §11: `type` is the only always-required frontmatter key.
REQUIRED_FRONTMATTER_KEYS = ("type",)
```

`OKFDocument.validate()` checks that tuple and nothing else. No first-party validator anywhere in the repo enforces `title`, `description`, `generated`, or `verified`. That is the strongest available evidence for how the spec's authors expect requiredness to be mechanized.

**Consequence for #83's standing constraint** ("defaults derive from OKF's requiredness"): only `type` earns `error` by derivation. Every recommended field derives `warning` at most, and every provenance/trust/lifecycle/computation field derives `off`-or-`warning` — because §11 forbids a *consumer* from rejecting on their absence, and §5's preamble makes their absence load-bearing information ("Their absence carries meaning: an unverified concept is distinguishable from a verified one"). An `error`-tier default on, say, `generated` would not be a strict reading of OKF; it would be a harness policy choice that OKF's conformance section actively contradicts, and it would fire in every third-party repo on install.

### 2.3 Where the spec is genuinely ambiguous — do not guess

These fields have **no requiredness marker at all**, and the omission is meaningful because the spec marks siblings explicitly in the very same bullet list. Any bucketing here is our inference, not OKF's statement:

1. **`generated.at`** — `generated.by` is marked "REQUIRED within `generated`"; `at` in the next bullet is not marked. Two readings are defensible: (a) the omission is deliberate and `at` is optional, so `generated: { by: ... }` alone is legal; (b) the omission is an editorial slip, since §13.1 names the replacement field pair as "`generated: { by, at }`" and every example in the spec and every sample bundle carries both. **Unresolved.**
2. **`verified[].by` and `verified[].at`** — described only as "each with `by` … and `at`". Reads like a structural requirement, but no REQUIRED/MUST is attached. Note that §5.3's trust-tier derivation only reads `by`, and the reference implementation's `normalize_verified()` keeps any mapping regardless of which keys it holds. **Unresolved.**
3. **`usage_window.from` / `.to`** — shape shown by example only.
4. **The whole `parameters` / `executor` / `attester` group** — `runtime` is the only computation field marked REQUIRED; `parameters`, `executor`, `attester` and all their sub-keys carry no marker, even though §10.5's consumer walkthrough is unusable without them ("the executor runs the bound computation and returns a receipt shaped by `executor.receipt`"). Whether an Attested Computation without an `attester` is conformant is **not answered by the spec**. §11 says yes (it has a `type`); §10 reads as though no.

Recommended handling: for all four, ship `off` by default and let the config raise them. Deriving an `error` from a field the spec never marked is exactly the failure mode #84 was written to prevent.

### 2.4 One more nuance worth not smoothing over

`title`, `description`, `resource` and `tags` sit under a heading that says "**Recommended:**" while their own inline comments in the same code block say "Optional". Both readings agree on the load-bearing point — none of them is required — but the spec does not offer a distinct "recommended" conformance tier that a linter could bind a severity to. There is no sentence anywhere in v0.2 of the form "producers SHOULD include `title`". The word "Recommended" is a section heading, not a normative statement. So a `warning` default on the recommended four is a defensible harness choice, not a derivation.

## 3. Question 4 — diff against today's GEN-003 floor

Today's floor (`.archgate/adrs/GEN-003-frontmatter.md` §2) is: `type` always required and kebab-case, optionally constrained to a closed `allowedTypes` set; a label that is exactly one of `name` **xor** `title`, non-empty, capped at `maxLabel`; `description` optional unless `requireDescription`; `tags` optional as a comma-separated kebab-case list.

**`type` is still the sole mandatory field.** v0.2 did not move the required set. Confirmed twice over: §4.1's "`type` is the only always-required key" and §11's three-clause conformance test. GEN-003's central premise survives OKF v0.2 intact, and so does the ADR's rejected-alternatives reasoning about a bespoke anchor key. What follows are the mismatches around it.

**Conflicts (GEN-003 is stricter than OKF, in ways OKF explicitly forbids for consumers):**

1. **`type` casing.** GEN-003 mandates kebab-case. OKF's own example values are Title Case with spaces: `BigQuery Table`, `BigQuery Dataset`, `API Endpoint`, `Metric`, `Playbook`, `Reference`, `Attested Computation` (§4.1). v0.2 also mints a new type value, `Attested Computation` (§10.1), in that same style. **GEN-003's kebab-case rule rejects every type value the spec itself demonstrates.** This is the sharpest conflict in the diff: an ADR family claiming to *adopt* OKF cannot also require kebab-case without saying plainly that it is narrowing the spec, and why.
2. **Closed `allowedTypes`.** OKF: "Type values are **not** registered centrally … consumers MUST tolerate unknown types gracefully, typically by treating them as generic concepts" (§4.1), reinforced by §11's "consumers MUST NOT reject a bundle because of … Unknown `type` values." A closed set enforced at `error` is precisely the rejection OKF forbids. The defensible framing is that the harness is a **repo governance linter, not an OKF bundle consumer** — it governs authorship inside one repo rather than consuming foreign bundles — but the ADR family has to state that distinction explicitly, or the OKF grounding is decorative.
3. **A mandatory non-empty label.** GEN-003 requires exactly one of `name`/`title`, non-empty. OKF makes `title` recommended-at-most and hands consumers an explicit fallback: "If omitted, consumers MAY derive a title from the filename" (§4.1). Requiring it is a harness addition, not an OKF requirement.

**`name` is not an OKF field.** v0.2 has no `name` key anywhere — the display-label key is `title`, full stop. GEN-003's `name` xor `title` is a harness invention (it accommodates the Agent Skills `name` field, per the config's `.claude/agents/*.md` entry). Two things follow. First, the ADR family should stop describing the label pair as OKF-grounded. Second, `name` is an **unnamespaced extension key**, and §12's compatibility policy lets any future minor version claim a new optional key — including `name`. There is no reserved prefix protecting us (see §4 below).

**One retype: `tags`.** OKF v0.2 is a YAML list — "A YAML list of short strings", sample `tags: [<tag>, <tag>, ...]`, and every sample bundle writes `tags: [finance, revenue, attested]`. GEN-003 specifies a comma-separated string. Both parse as YAML but they are different value types, so a governed file that satisfies GEN-003 today (`tags: governance, frontmatter`) is *not* what an OKF consumer expects, and vice versa. OKF also imposes no kebab-case constraint and no cap on tags. This is the only true retype in the diff, and it is a migration item: adopting OKF's list form breaks every currently-dogfooded `tags:` line in this repo.

**Additions — everything below is absent from GEN-003's floor.** Recommended: `resource`. Provenance: `sources` with `resource`/`id`/`title`/`author`/`usage_count`/`last_modified`, plus `usage_window`. Trust: `generated` (`by`, `at`), `verified` (`by`, `at`). Lifecycle: `status`, `stale_after`. Computation: `runtime`, `parameters`, `computation`, `executor`, `attester`. Bundle: `okf_version`.

**Nothing is dropped.** No key in GEN-003's floor was removed or renamed by v0.2. The only OKF field ever retired is `timestamp`, which GEN-003 never adopted (see §5).

**Two structural clauses GEN-003 has no vocabulary for, and which need a decision:**

1. **Reserved filenames.** §3.1: `index.md` and `log.md` "MUST NOT be used for concept documents." §8: "Index files contain no frontmatter, with one exception: a bundle-root `index.md` MAY carry an `okf_version` key." So in an OKF-conformant tree, an `index.md` must **not** carry frontmatter — the inverse of the frontmatter floor. This repo already has `.archgate/INDEX.md` governed with `allowedTypes: ["index"]` and `requireDescription: true`, i.e. mandatory frontmatter on an index file. Reconcilable (the two `index.md` roles are unrelated, and case differs), but the ADR family should say so on purpose rather than trip over it later, and the built-in zero-config default should not require frontmatter on a file OKF says must not have any.
2. **A per-file `type` semantic mismatch.** OKF's `type` classifies a *concept* (a table, a metric, a playbook). GEN-003's `type` classifies a *document role in a repo* (`adr`, `design-adr`, `agent-doc`, `claude-md`). Same key, same "kind of thing" slot, different universe of values. Worth an explicit sentence, because it explains why the harness's values are kebab-case slugs while OKF's are prose nouns.

**GEN-003's own `draft` escape hatch now collides with an OKF field value.** `settings.draftEscape` lets a file declare `type: draft`. OKF v0.2 introduces `status: draft` (§5.4) as the canonical way to say "not yet reviewed; possibly incomplete." If the family adopts `status`, `type: draft` and `status: draft` mean nearly the same thing in two different keys. Folding the escape hatch into `status` is the OKF-native move; keeping both needs a justification.

## 4. Question 5 — versioning and extensibility

**Yes, there is a version handle, and it is nearly unusable for our purpose.** `okf_version` exists (§12: "Bundles MAY declare the version they target with `okf_version: "0.2"`"), but with three hard limits:

1. **MAY, never MUST.** An OKF document that declares no version is fully conformant. A consumer therefore cannot rely on the handle being present; §12 tells it what to do instead — "Consumers that do not understand the declared version SHOULD attempt best-effort consumption rather than refusing the bundle."
2. **Wrong granularity.** It is legal *only* in a bundle-root `index.md` — "the only place frontmatter is permitted in an `index.md`" (§12), restated in §8. **There is no way inside OKF v0.2 for a concept document to declare which OKF version it targets.** Per-file version pinning is not merely discouraged; the spec forbids frontmatter in the one file type that carries the key, everywhere except the bundle root.
3. **Dead in practice.** Verified by authenticated GitHub code search across `GoogleCloudPlatform/knowledge-catalog`: `okf_version` occurs in exactly **one** file, `okf/SPEC.md`. None of the four first-party sample bundles' root `index.md` files carry frontmatter at all (checked `acme_retail`, `ga4`, `crypto_bitcoin`, `stackoverflow`). The reference agent neither writes nor reads it — no occurrence in `bundle/index.py`, `bundle/document.py`, or the agent's authoring prompt. Google ships four bundles claiming v0.2 conformance and not one declares a version.

**There is no conformance-level or profile concept.** §11 is a single binary predicate ("A bundle is conformant with OKF v0.2 if: 1 … 2 … 3 …"). No core/extended profiles, no levels, no per-family conformance classes. So a claim like "this repo is OKF-v0.2-core-conformant" has no basis in the spec; the only in-spec claim is conformant or not.

**The extension mechanism is documented but namespace-free.** §4.1: "Producers MAY include any additional keys. Consumers SHOULD preserve unknown keys when round-tripping and MUST NOT reject documents with unrecognized fields." That is the whole mechanism. **No prefix convention, no `x-` reservation, no reverse-DNS namespacing, no reserved-key list.** Two consequences:

- Harness-specific keys are unambiguously legal, and OKF-conformant consumers must preserve rather than strip them.
- They are **collision-prone by design**. §12 says a minor bump "introduces backward-compatible additions (new optional fields …)", so v0.3 may claim any unclaimed key name. `name` is the live example: it is an extension key in our floor today, and nothing stops OKF v0.3 from defining `name` with different semantics. Choosing an unlikely-to-collide prefix for harness-only keys is a decision the ADR family should make deliberately, since OKF will not make it for us.

**Is "a v0.3 bump is a minimal refactor" structurally achievable?** Partly — and the honest answer is that the spec's promise and the spec's behaviour disagree.

- **The promise supports it.** §12: minor bumps are "backward-compatible additions (new optional fields, new conventional section headings)"; only a major bump "may make breaking changes (renaming required fields, changing reserved filenames)". If OKF keeps that promise, v0.3 costs us new optional fields at low severity and nothing else.
- **The precedent contradicts it.** v0.2 is self-described as "a minor version bump under §12, **except for two deliberate breaking changes** called out below because they rename or retire v0.1 fields" (§13). The single existing data point for an OKF minor bump is a minor bump that broke compatibility. Designing on the promise alone is designing on one broken promise.
- **And the section numbers moved anyway** (see Sources note 2). Even a purely additive v0.3 can renumber sections and invalidate every `§N` citation in the ADR family.

Practical read for the ADR family: the "minimal refactor" property has to be engineered on our side, not inherited. Concretely — keep the per-field table and its severities in *config* rather than in prose; cite the spec by heading text plus a pinned commit SHA rather than by section number; and record our own targeted OKF version somewhere we control, since `okf_version` cannot travel on a concept document. It would be self-deception to call an `okf_version` key on our files "OKF's version handle": the spec permits it only as an extension key, in exactly the same unnamespaced, collision-prone way it permits any other custom key.

## 5. Question 6 — what changed from v0.1 to v0.2

§13 gives the spec's own account. I verified it against the v0.1 text at `ee67a5c` and found it accurate but **incomplete** — three real changes are not listed.

**Breaking, per §13.1 (both confirmed against the v0.1 text):**

1. **`timestamp` is retired.** v0.1 §4.1 listed `timestamp` — "ISO 8601 datetime of last meaningful change" — as the fifth Recommended field. v0.2 removes it. §13.1: "**`timestamp` is superseded by `generated.at`.** A concept's last content change is now recorded as `generated: { by, at }` (§5.2). Consumers MAY fall back to a legacy `timestamp` when `generated` is absent." So a *field rename plus a retype*: a flat scalar became a nested mapping, and the fallback is MAY, not MUST.
2. **The `# Citations` body list is retired.** v0.1 had a whole normative section for it (v0.1 §8, plus `# Citations` in the conventional-headings table). v0.2 deletes the section and the heading. §13.1: "**The body `# Citations` list is superseded by `sources`.** Provenance moves to frontmatter (§5.1). Consumers SHOULD read `sources` and MAY still parse a legacy `# Citations` body list for v0.1 documents." Structurally the bigger move: provenance migrated from *body prose* into *frontmatter*, and per-claim attribution changed from numbered `[1]` entries to markdown footnotes keyed on `sources[].id` (§5.1: "Labels are keyed rather than positional (`sources[0]`) because agents constantly rewrite these documents: a positional index misattributes silently the moment the list is reordered").

**Additive, per §13.2:** the `sources` family with its credibility signals (`author`, `usage_count`, `last_modified`) and the `usage_window` sibling; `generated`; `verified`; `status`; `stale_after`; the new concept type `Attested Computation` with `runtime`, `parameters`, `computation`, `executor`, `attester`; the new conventional body heading `# Computation`; and the actor convention for `generated.by` / `verified[].by`. §13.2's framing: "Their absence yields a plain v0.1 concept."

**Carried forward unchanged, per §13.2:** "bundle structure, reserved filenames, the required `type`, recommended `title`/`description`/`resource`/`tags`, cross-linking, index files, log files, permissive conformance."

**Changes §13 does not mention (found by diffing the two texts directly):**

1. **A conformance keyword was strengthened.** v0.1 §4.1: "Consumers SHOULD preserve unknown keys when round-tripping and **SHOULD NOT** reject documents with unrecognized fields." v0.2 §4.1: "… and **MUST NOT** reject documents with unrecognized fields." A SHOULD NOT became a MUST NOT, in the extension clause, unlisted in the changelog. Directly relevant to us: tolerance of extension keys hardened from advisory to mandatory.
2. **The Recommended list lost its ordering.** v0.1's heading was "**Recommended (in priority order):**"; v0.2's is just "**Recommended:**". Any scheme that graded severity by "priority order" lost its footing.
3. **Sections were renumbered and one was deleted.** v0.1 §10 "Relationship to other formats" is gone from v0.2. Everything from v0.1 §5 onward shifted (Cross-linking §5→§6, Index §6→§8, Log §7→§9, Conformance §9→§11, Versioning §11→§12), and v0.2 adds §6.2 path-valued fields, §6.3 the `references/` convention, §7 the actor convention, §10 attested computations, and §12's "Considered and deferred". The header also dropped v0.1's "— Draft" qualifier.

**How much churn to design for.** One minor bump renamed one field, retired one body section, moved provenance from body to frontmatter, strengthened a conformance keyword, renumbered every section from the middle onward, and added ten new keys — in six weeks, while explicitly claiming to be a backward-compatible minor bump. The `_after`/`_count`/`_modified` snake_case of the new fields versus the flat scalars of v0.1 also signals a spec still settling its own naming conventions. Design for renames within minor versions, not just additions.

## 6. Implications for the ADR family (#83)

Findings that bear directly on how the family is split and what its defaults are:

1. **Only `type` derives `error`.** Everything else derives `warning` or `off` from OKF's own conformance language (§2.2). A field table with more than one `error` default is making harness policy, and should be labelled as such in the ADR rather than attributed to OKF.
2. **Four field groups have no requiredness statement at all** (§2.3). They need an explicit "spec is silent, we default to `off`" line, not a bucketing.
3. **Three live conflicts between GEN-003 and OKF** (§3): kebab-case `type` versus OKF's Title Case examples, closed `allowedTypes` versus "consumers MUST tolerate unknown types", and the invented `name` key. Each needs an explicit narrowing rationale — the linter-not-consumer distinction is the argument, and it should be written down once, in whichever ADR owns the anchor.
4. **`tags` is a breaking migration**, not an addition (§3): comma-separated string to YAML list touches every dogfooded frontmatter block in this repo.
5. **`status: draft` overlaps `settings.draftEscape`** (§3) — one of the two should go.
6. **`okf_version` cannot ride on concept documents** (§4). Whatever version handle the family adopts is our own extension key, and should be described that way.
7. **The natural seam in the spec is family-shaped, and it is a clean 3-way split**: (a) the anchor and the recommended set — §4.1, the only place a required field lives; (b) provenance/trust/lifecycle — §5, uniformly optional, uniformly "absence carries meaning", the group whose severities are pure config; (c) the computation family — §10, gated on a single `type` value, the group most likely to churn, and the one the spec itself has already deferred parts of ("The following are intentionally left to a future revision: the full runtime protocol … the attester ABI, portability, and sandboxing … Attestation caching", §12). That grouping matches OKF's own section structure, which is also the boundary a v0.3 bump is most likely to respect. Nothing found here argues against a 2–3 ADR split; the evidence mildly favours 3, with (c) isolated precisely because it is the least settled part of the spec.
