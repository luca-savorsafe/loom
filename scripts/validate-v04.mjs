import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import {parse, parseAllDocuments} from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(root, "schema/versions/agent-v1alpha1.schema.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

if (schema.properties?.apiVersion?.const !== "agent-dsl/v1alpha1") {
  throw new Error("schema apiVersion must be agent-dsl/v1alpha1");
}

const ajv = new Ajv2020({allErrors: true, strict: true});
if (!ajv.validateSchema(schema)) {
  throw new Error(`invalid JSON Schema:\n${ajv.errorsText(ajv.errors, {separator: "\n"})}`);
}
const validate = ajv.compile(schema);

// Walk public properties without expanding references: each referenced definition
// has its own reference section. Boolean branches only enforce presence/exclusion.
function publicFields(node, prefix = "") {
  const fields = [];
  if (!node || typeof node !== "object") return fields;
  for (const [name, child] of Object.entries(node.properties ?? {})) {
    if (!child || typeof child !== "object") continue;
    const fieldPath = prefix ? `${prefix}.${name}` : name;
    fields.push({path: fieldPath, schema: child});
    fields.push(...publicFields(child, fieldPath));
  }
  if (node.items) fields.push(...publicFields(node.items, `${prefix}[]`));
  for (const keyword of ["oneOf", "allOf", "anyOf"]) {
    for (const child of node[keyword] ?? []) fields.push(...publicFields(child, prefix));
  }
  return fields;
}

function publicSchemaSections(contract) {
  const sections = {root: contract};
  const variants = new Set(
    (contract.$defs.component.oneOf ?? []).map((variant) => variant.$ref?.split("/").at(-1)),
  );
  for (const [name, definition] of Object.entries(contract.$defs)) {
    // Kind wrappers repeat the common "kind/spec" fields; document their spec
    // definitions instead, while the root kind catalog checks every variant.
    if (!variants.has(name) && publicFields(definition).length > 0) {
      sections[name] = definition;
    }
  }
  return sections;
}

function checkSchemaDescriptions(contract = schema) {
  const missing = [];
  for (const [section, definition] of Object.entries(publicSchemaSections(contract))) {
    if (!definition.description?.trim()) missing.push(section);
    for (const field of publicFields(definition)) {
      if (!field.schema.description?.trim()) missing.push(`${section}.${field.path}`);
    }
  }
  return [...new Set(missing)];
}

function referenceSections(referenceText) {
  const sections = new Map();
  let fields;
  for (const line of referenceText.split("\n")) {
    const marker = line.match(/^<!-- dsl-schema: ([A-Za-z]+) -->$/);
    if (marker) {
      if (sections.has(marker[1])) throw new Error(`duplicate reference section: ${marker[1]}`);
      fields = new Map();
      sections.set(marker[1], fields);
      continue;
    }
    if (!fields || !line.startsWith("| ")) continue;
    const columns = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (columns.length !== 6 || columns[0] === "字段") continue;
    fields.set(columns[0], columns[5]);
  }
  return sections;
}

function checkDocumentationCoverage(referenceText, contract = schema) {
  const missing = [];
  const sections = referenceSections(referenceText);
  for (const [name, definition] of Object.entries(publicSchemaSections(contract))) {
    const documented = sections.get(name);
    if (!documented) {
      missing.push(`section ${name}`);
      continue;
    }
    const fieldNames = new Set(publicFields(definition).map((field) => field.path));
    for (const fieldName of fieldNames) {
      const explanation = documented.get(fieldName);
      if (!explanation || explanation.length < 8) missing.push(`${name}.${fieldName}`);
    }
    for (const fieldName of documented.keys()) {
      if (!fieldNames.has(fieldName)) missing.push(`unknown documented field ${name}.${fieldName}`);
    }
  }
  for (const kind of contract.$defs.componentBase.properties.kind.enum) {
    if (!referenceText.includes(`<!-- dsl-kind: ${kind} -->`)) missing.push(`kind ${kind}`);
  }
  return missing;
}

function checkDocumentationRegressions(referenceText) {
  const errors = [];
  // New nested configuration must not pass merely because its parent is documented.
  const addedField = structuredClone(schema);
  addedField.$defs.toolSpec.properties.execution.properties.retry_limit = {
    type: "integer", description: "Regression-only probe; never written to the DSL Schema.",
  };
  if (!checkDocumentationCoverage(referenceText, addedField).includes("toolSpec.execution.retry_limit")) {
    errors.push("documentation coverage did not reject a new nested field");
  }
  const removedDescription = structuredClone(schema);
  delete removedDescription.$defs.toolSpec.properties.binding.properties.action.description;
  if (!checkSchemaDescriptions(removedDescription).includes("toolSpec.binding.action")) {
    errors.push("description coverage did not reject a missing nested description");
  }
  const removedRow = referenceText.split("\n").filter((line) => !line.startsWith("| binding.action |")).join("\n");
  if (!checkDocumentationCoverage(removedRow).includes("toolSpec.binding.action")) {
    errors.push("documentation coverage did not reject a removed field row");
  }
  if (!checkDocumentationCoverage(referenceText.replace("<!-- dsl-kind: review -->", "")).includes("kind review")) {
    errors.push("documentation coverage did not reject a missing kind section");
  }
  return errors;
}

function duplicateIds(items = []) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  return [...duplicates];
}

function validateManifest(document) {
  if (!validate(document)) {
    return [`schema: ${ajv.errorsText(validate.errors, {separator: "\n"})}`];
  }

  const errors = [];
  const components = document.components ?? [];
  const resources = document.resources ?? [];
  const groups = document.assembly?.groups ?? [];
  const seats = document.seats ?? [];
  const componentsById = new Map(components.map((item) => [item.id, item]));
  const resourcesById = new Map(resources.map((item) => [item.id, item]));
  const groupsById = new Map(groups.map((item) => [item.id, item]));
  const seatsById = new Map(seats.map((item) => [item.id, item]));
  const launchEntries = document.launch?.entries ?? [];
  const toolsByName = new Map(
    components.filter((item) => item.kind === "tool").map((item) => [item.spec.name, item]),
  );

  for (const [label, items] of [
    ["component", components],
    ["resource", resources],
    ["group", groups],
    ["seat", seats],
    ["red line", document.identity?.red_lines ?? []],
  ]) {
    for (const id of duplicateIds(items)) errors.push(`${label} id '${id}' is duplicated`);
  }
  for (const name of duplicateIds(launchEntries.map((entry) => ({id: entry.name})))) {
    errors.push(`launch entry name '${name}' is duplicated`);
  }

  for (const component of components) {
    if (component.kind === "tool") {
      for (const field of ["inputSchema", "outputSchema"]) {
        if (!ajv.validateSchema(component.spec[field])) {
          errors.push(
            `component '${component.id}' ${field} is not a valid JSON Schema: ${ajv.errorsText(ajv.errors)}`,
          );
        }
      }
    }

    for (const dependency of component.requires ?? []) {
      if (dependency.type === "runtime") continue;
      if (dependency.type === "resource") {
        if (!resourcesById.has(dependency.ref)) {
          errors.push(`component '${component.id}' requires unknown resource '${dependency.ref}'`);
        }
        continue;
      }

      const target = componentsById.get(dependency.ref);
      if (!target) {
        errors.push(`component '${component.id}' requires unknown component '${dependency.ref}'`);
        continue;
      }
      if (dependency.type !== "component" && target.kind !== dependency.type) {
        errors.push(
          `component '${component.id}' requires '${dependency.ref}' as ${dependency.type}, but it is ${target.kind}`,
        );
      }
      if (dependency.type === "bridge" && !target.spec.actions.includes(dependency.action)) {
        errors.push(
          `component '${component.id}' requires unknown bridge action '${dependency.ref}.${dependency.action}'`,
        );
      }
    }

    if (component.kind === "tool") {
      const {bridge, action} = component.spec.binding;
      const target = componentsById.get(bridge);
      if (!target || target.kind !== "bridge") {
        errors.push(`tool '${component.id}' binds unknown bridge '${bridge}'`);
      } else if (!target.spec.actions.includes(action)) {
        errors.push(`tool '${component.id}' binds unknown bridge action '${bridge}.${action}'`);
      }
      const matchingDependency = (component.requires ?? []).some(
        (item) => item.type === "bridge" && item.ref === bridge && item.action === action,
      );
      if (!matchingDependency) {
        errors.push(`tool '${component.id}' binding must have an identical bridge dependency`);
      }
    }

    if (component.kind === "skill") {
      for (const tool of component.spec.tools ?? []) {
        if (!toolsByName.has(tool)) errors.push(`skill '${component.id}' references unknown tool '${tool}'`);
      }
    }
  }

  const workflowComponents = components.filter((item) => item.kind === "workflow");
  const allPhases = new Set();
  for (const workflow of workflowComponents) {
    const phases = workflow.spec.phases.map((phase) => phase.id);
    const phaseSet = new Set(phases);
    for (const id of duplicateIds(workflow.spec.phases)) {
      errors.push(`workflow '${workflow.id}' phase '${id}' is duplicated`);
    }
    for (const phase of phases) allPhases.add(phase);
    if (!phaseSet.has(workflow.spec.initial)) {
      errors.push(`workflow '${workflow.id}' initial phase '${workflow.spec.initial}' does not exist`);
    }
    if (!seatsById.has(workflow.spec.seat)) {
      errors.push(`workflow '${workflow.id}' references unknown seat '${workflow.spec.seat}'`);
    }

    const edges = [];
    for (const transition of workflow.spec.transitions ?? []) {
      edges.push([transition.from, transition.to]);
      for (const endpoint of ["from", "to"]) {
        if (!phaseSet.has(transition[endpoint])) {
          errors.push(
            `workflow '${workflow.id}' transition ${endpoint} phase '${transition[endpoint]}' does not exist`,
          );
        }
      }
      const toolEvent = transition.on === "tool_succeeded" || transition.on === "tool_failed";
      if (toolEvent && !transition.tool) {
        errors.push(`workflow '${workflow.id}' transition '${transition.from}' requires a tool`);
      }
      if (!toolEvent && transition.tool) {
        errors.push(`workflow '${workflow.id}' transition '${transition.from}' has an unused tool`);
      }
      if (transition.tool && !toolsByName.has(transition.tool)) {
        errors.push(`workflow '${workflow.id}' references unknown tool '${transition.tool}'`);
      }
    }
    for (const loop of workflow.spec.loops ?? []) {
      edges.push([loop.from, loop.to]);
      if (!phaseSet.has(loop.from) || !phaseSet.has(loop.to)) {
        errors.push(`workflow '${workflow.id}' loop references an unknown phase`);
      }
    }
    for (const checkpoint of workflow.spec.human_checkpoints ?? []) {
      if (!phaseSet.has(checkpoint.phase)) {
        errors.push(`workflow '${workflow.id}' checkpoint phase '${checkpoint.phase}' does not exist`);
      }
    }

    const reachable = new Set([workflow.spec.initial]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [from, to] of edges) {
        if (reachable.has(from) && !reachable.has(to)) {
          reachable.add(to);
          changed = true;
        }
      }
    }
    for (const phase of phases) {
      if (!reachable.has(phase)) errors.push(`workflow '${workflow.id}' phase '${phase}' is unreachable`);
    }
  }

  for (const tool of components.filter((item) => item.kind === "tool" && item.spec.phase)) {
    if (!allPhases.has(tool.spec.phase)) {
      errors.push(`tool '${tool.id}' references unknown workflow phase '${tool.spec.phase}'`);
    }
  }

  for (const group of groups) {
    for (const componentId of group.components) {
      if (!componentsById.has(componentId)) {
        errors.push(`group '${group.id}' references unknown component '${componentId}'`);
      }
    }
  }

  for (const seat of seats) {
    for (const groupId of seat.groups) {
      if (!groupsById.has(groupId)) errors.push(`seat '${seat.id}' references unknown group '${groupId}'`);
    }
    if (seat.persona_ref) {
      const persona = componentsById.get(seat.persona_ref);
      if (!persona || persona.kind !== "persona") {
        errors.push(`seat '${seat.id}' references unknown persona '${seat.persona_ref}'`);
      }
    }
  }

  for (const entry of launchEntries) {
    if (entry.seat && !seatsById.has(entry.seat)) {
      errors.push(`launch entry '${entry.name}' references unknown seat '${entry.seat}'`);
    }
    if (entry.workflow) {
      const workflow = componentsById.get(entry.workflow);
      if (!workflow || workflow.kind !== "workflow") {
        errors.push(`launch entry '${entry.name}' references unknown workflow '${entry.workflow}'`);
      } else if (entry.seat && workflow.spec.seat !== entry.seat) {
        errors.push(`launch entry '${entry.name}' workflow belongs to a different seat`);
      }
    }
  }

  for (const redLine of document.identity.red_lines) {
    for (const control of redLine.enforced_by) {
      if (control.startsWith("resource:") && !resourcesById.has(control.slice("resource:".length))) {
        errors.push(`red line '${redLine.id}' references unknown control '${control}'`);
      }
      if (control.startsWith("gate.")) {
        const section = control.split(".")[1];
        if (!(section in document.gate)) {
          errors.push(`red line '${redLine.id}' references unknown control '${control}'`);
        }
      }
    }
  }

  const effects = new Set(components.flatMap((item) => item.effects ?? []));
  const commandGrantCount =
    (document.gate.bash.allow_presets?.length ?? 0) + (document.gate.bash.allow?.length ?? 0);
  if (effects.has("network.egress") && document.gate.egress.policy === "deny_all") {
    errors.push("network.egress is requested but gate.egress denies all destinations");
  }
  if (
    [...effects].some((effect) => ["filesystem.write", "artifact.write"].includes(effect)) &&
    document.gate.filesystem.write_allow.length === 0
  ) {
    errors.push("a write effect is requested but gate.filesystem.write_allow is empty");
  }
  if (effects.has("knowledge.candidate_write") && !document.gate.knowledge_write) {
    errors.push("knowledge.candidate_write is requested without candidate-only gate rules");
  }
  if (effects.has("process.exec") && commandGrantCount === 0) {
    errors.push("process.exec is requested but gate.bash grants no commands");
  }

  const graph = new Map(
    components.map((component) => [
      component.id,
      (component.requires ?? [])
        .filter((dependency) => dependency.type !== "resource" && dependency.type !== "runtime")
        .map((dependency) => dependency.ref)
        .filter((ref) => componentsById.has(ref)),
    ]),
  );
  const visiting = new Set();
  const visited = new Set();
  function visit(id, trail) {
    if (visiting.has(id)) {
      errors.push(`component dependency cycle: ${[...trail, id].join(" -> ")}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const target of graph.get(id) ?? []) visit(target, [...trail, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of graph.keys()) visit(id, []);

  return errors;
}

function yamlFiles(directory) {
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith(".yaml"))
    .sort()
    .map((name) => path.join(directory, name));
}

function readYaml(file) {
  return parse(fs.readFileSync(file, "utf8"));
}

const failures = [];
// Documentation fragments need valid YAML, but are not standalone manifests.
const snippetFiles = [
  "docs/archive/v0.4/AGENT_DSL_SPEC.md",
  "docs/archive/v0.4/DSL_FIELD_REFERENCE.md",
  
];
for (const file of snippetFiles) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  for (const match of text.matchAll(/```ya?ml\n([\s\S]*?)```/g)) {
    const line = text.slice(0, match.index).split("\n").length;
    for (const document of parseAllDocuments(match[1])) {
      for (const error of document.errors) failures.push(`${file}:${line} invalid YAML snippet: ${error.message}`);
    }
  }
}
const missingDescriptions = checkSchemaDescriptions();
if (missingDescriptions.length > 0) {
  failures.push(`public Schema fields missing descriptions:\n${missingDescriptions.join("\n")}`);
}
const fieldReferencePath = path.join(root, "docs/archive/v0.4/DSL_FIELD_REFERENCE.md");
if (!fs.existsSync(fieldReferencePath)) {
  failures.push("docs/DSL_FIELD_REFERENCE.md is missing");
} else {
  const referenceText = fs.readFileSync(fieldReferencePath, "utf8");
  const missingFields = checkDocumentationCoverage(referenceText);
  if (missingFields.length > 0) failures.push(`documentation coverage missing:\n${missingFields.join("\n")}`);
  failures.push(...checkDocumentationRegressions(referenceText));
}
for (const file of yamlFiles(path.join(root, "examples/legacy/v0.4"))) {
  const errors = validateManifest(readYaml(file));
  if (errors.length > 0) failures.push(`${path.relative(root, file)} should be valid:\n${errors.join("\n")}`);
}

for (const file of yamlFiles(path.join(root, "tests/fixtures/invalid"))) {
  if (validateManifest(readYaml(file)).length === 0) {
    failures.push(`${path.relative(root, file)} should be invalid but passed`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log("all schema, semantic, and documentation conformance checks passed");
