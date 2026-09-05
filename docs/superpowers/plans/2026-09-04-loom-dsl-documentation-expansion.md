# Loom DSL Documentation Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Turn the Loom v0.4 DSL specification into a self-contained modeling guide plus an exhaustive field reference for both manifest authors and compiler/runtime implementers.

**Architecture:** Keep `AGENT_DSL_SPEC.md` as the normative, readable entry point; add `DSL_FIELD_REFERENCE.md` as the exhaustive lookup surface; add concise Schema descriptions for IDEs. Extend the existing test harness so public Schema properties and all component kinds cannot be added without documentation metadata and reference coverage.

**Tech Stack:** Markdown, YAML, JSON Schema Draft 2020-12, Node.js, Ajv.

---

### Task 1: Add failing documentation coverage checks

**Files:**
- Modify: `scripts/validate-schema.mjs`
- Test: `npm test`

- [x] **Step 1: Add a recursive public-Schema description check**

Implement `checkSchemaDescriptions(schema)` over public root/definition sections, recursively checking `properties`, `items`, `oneOf`, `allOf`, and `anyOf`. Referenced definitions are checked in their own sections without repeatedly expanding `$ref`. Report every public property without a non-empty `description`.

- [x] **Step 2: Add documentation section checks**

Read `docs/DSL_FIELD_REFERENCE.md` and require machine-readable markers in these exact forms:

```markdown
<!-- dsl-schema: metadata -->
<!-- dsl-kind: tool -->
<!-- dsl-schema: toolSpec -->
```

Require all root properties, all nine component kinds, all component common fields, and all nested kind-specific `spec` fields. Use each section's field-table first column as the explicit path index, rather than maintaining duplicate hidden per-field markers. Four in-memory mutation checks verify detection of added fields and removed descriptions, rows, and kind markers.

- [x] **Step 3: Run the test and verify red state**

Run:

```bash
npm test
```

Expected: FAIL because `DSL_FIELD_REFERENCE.md` does not exist and existing Schema properties lack descriptions.

### Task 2: Add Schema documentation metadata

**Files:**
- Modify: `schema/agent.schema.json`
- Test: `npm test`

- [x] **Step 1: Document the root contract**

Add concise `title` and `description` values to the root Schema and every root property: `apiVersion/kind/metadata/identity/runtime/resources/components/assembly/seats/gate/knowledge/memory/evolution/coms/launch/settings`.

- [x] **Step 2: Document shared types**

Add descriptions to public fields in metadata, identity, red lines, runtime adapters, resources, component source, dependency, effect-bearing component base, transitions, loops, checkpoints, assembly, seats, gate, knowledge lifecycle, memory, evolution, coms, launch, and settings.

- [x] **Step 3: Document all kind-specific specs**

Add descriptions to every property of tool, bridge, skill, workflow, knowledge, persona, reusable gate, output, and review specs. Descriptions must state runtime meaning, not merely repeat the field name.

- [x] **Step 4: Keep the DSL shape unchanged**

Confirm that only documentation keywords (`title`, `description`, and where useful `deprecated`) are added. Do not add fields, enum values, defaults, or validation constraints.

### Task 3: Create the exhaustive field reference

**Files:**
- Create: `docs/DSL_FIELD_REFERENCE.md`
- Test: `npm test`

- [x] **Step 1: Add reading conventions**

Define the necessity levels `核心必填/条件必填/可选/实验`, lifecycle stages `parse/resolve/link/policy/runtime/package`, error classes, path notation, and the distinction between Schema defaults and normalized values.

- [x] **Step 2: Document all top-level blocks**

For each top-level block, include its marker, purpose, necessity, when to use, when to omit, ownership boundary, and a field table with path/type/required/default/stage/meaning/constraints/failure behavior.

- [x] **Step 3: Document shared component fields and unions**

Cover `id/kind/version/source/description/spec/requires/effects/tests`, all source variants, dependency variants, effect values, resource kinds/access modes/locators/data labels, and their linking semantics.

- [x] **Step 4: Document every kind-specific field**

Add one section and marker per kind. Include every `spec` property, its conditional rules, references, execution semantics, and error behavior.

- [x] **Step 5: Document all remaining nested configurations**

Cover assembly groups, seats, gate filesystem/bash/egress/knowledge/data controls, knowledge lifecycle/citations, memory, evolution capture/review, coms, launch entries, and settings.

- [x] **Step 6: Add compact legal examples**

Provide one minimal legal YAML fragment for every top-level block and kind. Fragments must use the current `agent-dsl/v1alpha1` names and must not introduce unsupported fields.

### Task 4: Expand the normative modeling guide

**Files:**
- Modify: `docs/AGENT_DSL_SPEC.md`

- [x] **Step 1: Add the execution mental model**

Explain declaration, resolution, normalization, linking, policy evaluation, runtime enforcement, and packaging from both author and implementer perspectives.

- [x] **Step 2: Add a top-level element catalog**

For all sixteen top-level elements, explain purpose, necessity, use/omit scenarios, relationships, lifecycle stage, and omission consequences. Link each section to the exhaustive reference.

- [x] **Step 3: Expand all nine kind sections equally**

Each section must include definition, rationale, necessity, use cases, anti-use cases, inputs/outputs/dependencies, effects, compiler/runtime behavior, minimal example, common errors, and comparison with neighboring kinds.

- [x] **Step 4: Add modeling decision guides**

Add decision rules for tool vs bridge vs skill, skill vs workflow, top-level gate vs gate component, knowledge component vs knowledge lifecycle, inline persona vs persona component, output vs ordinary file, review vs checkpoint, and single vs multi-seat.

- [x] **Step 5: Add composition patterns**

Document five patterns: pure guidance, read-only fact query, controlled workflow, candidate knowledge curation, and multi-seat collaboration. Each pattern must list the minimum elements and elements that should be omitted.

- [x] **Step 6: Separate normative rules from guidance**

Use MUST/SHOULD/MAY consistently. Mark explanatory recommendations as guidance and keep experimental capability status explicit.

### Task 5: Update navigation and run full verification

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/superpowers/plans/2026-09-04-loom-dsl-documentation-expansion.md`
- Verify: all modified files

- [x] **Step 1: Add documentation links**

Link the field reference from both README files and explain when to read the main specification versus the reference.

- [x] **Step 2: Run the complete test suite twice**

Run `npm test` twice. Expected both times:

```text
all schema, semantic, and documentation conformance checks passed
```

- [x] **Step 3: Verify file formats and stale syntax**

Parse all JSON and YAML files. Search normative documents, templates, and examples for stale active fields such as `provides`, `side_effect`, `readonly:`, assembly routes/checkpoints, and checkpoint `at`.

- [x] **Step 4: Verify scope and whitespace**

Run `git diff --check`, verify `git status --short diagrams` is empty, and confirm the pre-existing `.gitignore` change is untouched.

- [x] **Step 5: Mark this plan complete**

Change every completed checkbox to `[x]` only after its corresponding command or inspection succeeds.

No commits are included in this plan because the work is being performed directly on the user-owned `main` working tree, which already contains an unrelated `.gitignore` change, and the user did not request commits.

## Verification record

- Added `examples/guidance.agent.yaml` for the smallest useful no-tool composition.
- Schema comparison against the pre-expansion snapshot, recursively excluding only `title` and `description`, is identical; no structural contract changed in this expansion.
- Three positive manifests, seven negative manifests, field coverage and four documentation mutations pass.
- All 63 YAML fragments in the main specification, field reference and templates parse; this check is included in `npm test`.
- Relative documentation links and all project JSON files were checked. Remaining `side_effect` text explains the retired field rather than using it.
- `git diff --check` passes; `diagrams/` has no changes; the pre-existing `/.idea/` ignore entry is preserved.
- Runtime protocol gaps are explicitly documented, not implemented or treated as stable capabilities.
