import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import {validateAgent} from "./validate-agent.mjs";
import {parse, parseAllDocuments} from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(root, "schema/agent.schema.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

if (schema.properties?.apiVersion?.const !== "agent-dsl/v1alpha2") {
  throw new Error("schema apiVersion must be agent-dsl/v1alpha2");
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
    fields.set(columns[0], {meaning: columns[5], type: columns[1]});
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
      const explanation = documented.get(fieldName)?.meaning;
      if (!explanation || explanation.length < 8) missing.push(`${name}.${fieldName}`);
    }
    // A union's repeated field must document every branch, not just the first.
    for (const field of publicFields(definition)) {
      const values = field.schema.enum ?? (field.schema.const !== undefined ? [field.schema.const] : []);
      for (const value of values) {
        if (!documented.get(field.path)?.type.includes(String(value))) {
          missing.push(`undocumented value ${name}.${field.path}=${value}`);
        }
      }
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
  const missingUnionValue = referenceText.replace("枚举 deny_all / whitelist", "固定 deny_all");
  if (!checkDocumentationCoverage(missingUnionValue).includes("undocumented value egress.policy=whitelist")) {
    errors.push("documentation coverage did not reject a missing union branch value");
  }
  return errors;
}

function validateManifest(document) {
  if (!validate(document)) return [{code: "SCHEMA", path: "", message: ajv.errorsText(validate.errors)}];
  return validateAgent(document);
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
  "docs/AGENT_DSL_SPEC.md",
  "docs/DSL_FIELD_REFERENCE.md",
  ...fs.readdirSync(path.join(root, "templates"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `templates/${name}`),
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
const fieldReferencePath = path.join(root, "docs/DSL_FIELD_REFERENCE.md");
if (!fs.existsSync(fieldReferencePath)) {
  failures.push("docs/DSL_FIELD_REFERENCE.md is missing");
} else {
  const referenceText = fs.readFileSync(fieldReferencePath, "utf8");
  const missingFields = checkDocumentationCoverage(referenceText);
  if (missingFields.length > 0) failures.push(`documentation coverage missing:\n${missingFields.join("\n")}`);
  failures.push(...checkDocumentationRegressions(referenceText));
}
for (const file of yamlFiles(path.join(root, "examples"))) {
  const errors = validateManifest(readYaml(file));
  if (errors.length > 0) failures.push(`${path.relative(root, file)} should be valid:\n${errors.map(e => JSON.stringify(e)).join("\n")}`);
}

if (failures.length > 0) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log("all schema, semantic, and documentation conformance checks passed");
