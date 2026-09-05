# Loom v0.4 Spec Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge the Loom v0.3 design documents, JSON Schema, templates, and examples into one machine-verifiable `agent-dsl/v1alpha1` contract.

**Architecture:** Preserve the components-first model, introduce kind-discriminated component specifications and a Canonical Agent IR, and make workflow and policy ownership unambiguous. Keep advanced adapters experimental until the compiler core exists.

**Tech Stack:** Markdown, YAML, JSON Schema Draft 2020-12, Node.js, Ajv, YAML parser.

---

### Task 1: Add schema conformance harness

**Files:**
- Create: `package.json`
- Create: `scripts/validate-schema.mjs`
- Create: `tests/fixtures/invalid/*.agent.yaml`

- [x] Write invalid fixtures covering missing tool binding, invalid workflow checkpoint, unsupported gate preset, dual persona declarations, empty egress whitelist, invalid embedded schemas, and semantic binding failures.
- [x] Run `npm test` and verify the old Schema incorrectly accepts at least one invalid fixture.
- [x] Implement a validator that checks the Schema itself, expects all examples to pass, and expects every invalid fixture to fail.
- [x] Run `npm test`; expected result after Task 2 is `all schema and semantic conformance checks passed`.

### Task 2: Replace the permissive Schema with a typed contract

**Files:**
- Modify: `schema/agent.schema.json`

- [x] Change `apiVersion` to `agent-dsl/v1alpha1` and require non-empty components and gate sections.
- [x] Define a structured source union for local, registry, and inline sources.
- [x] Define `oneOf` component variants for all nine kinds with kind-specific `spec` objects.
- [x] Replace `readonly/side_effect` with a set of structured `effects`.
- [x] Constrain workflow phases, transitions, loops, checkpoints, seat/persona exclusivity, launch targets, egress policy, resources, memory, and evolution coupling.
- [x] Run `npm test`; expected result is all valid examples pass and every invalid fixture fails.

### Task 3: Make the normative documents match the contract

**Files:**
- Modify: `docs/AGENT_DSL_SPEC.md`
- Modify: `docs/COMPILER_DESIGN.md`
- Modify: `docs/README.md`
- Modify: `README.md`

- [x] Replace all normative `agen` CLI references with `loom` and label the API alpha; diagrams remain intentionally deferred.
- [x] Document typed component manifests, unique source ownership, Canonical Agent IR, capability-based gate evaluation, workflow states, lockfile, BUILDINFO, and error contracts.
- [x] Mark memory, evolution, coms, and remote registry as experimental.
- [x] Remove claims that are not enforceable by the current design.

### Task 4: Update templates and examples

**Files:**
- Modify: `templates/component-template.md`
- Modify: `templates/assembly-template.md`
- Modify: `templates/workflow-template.md`
- Modify: `templates/gate-template.md`
- Modify: `examples/minimal-faq.agent.yaml`
- Modify: `examples/data-asset.agent.yaml`

- [x] Convert sources, component specs, effects, resource dependencies, and structured red lines to v0.4 syntax.
- [x] Remove assembly routes/checkpoints and group-owned seat declarations.
- [x] Make workflow the sole owner of phase order and human checkpoints.
- [x] Remove phase duplication from skills and split the complex example into unambiguous seat workflows.
- [x] Run `npm test`; expected result is `all schema and semantic conformance checks passed`.

### Task 5: Cross-document verification

**Files:**
- Modify if needed: all files from Tasks 1-4

- [x] Search for stale `agent-dsl/v1`, `agen`, `side_effect`, `readonly`, `assembly.routes`, `human_checkpoints[].at`, and undocumented presets in normative text; diagram refresh is deferred by user request.
- [x] Parse every YAML and JSON file.
- [x] Run `npm test` twice and verify deterministic results.
- [x] Inspect `git diff --check`; expected result is no whitespace errors.
- [x] Confirm the pre-existing `.gitignore` change remains untouched.
