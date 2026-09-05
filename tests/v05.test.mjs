import assert from "node:assert/strict";
import fs from "node:fs";
import {parse} from "yaml";
import Ajv2020 from "ajv/dist/2020.js";

const schema = JSON.parse(fs.readFileSync(new URL("../schema/agent.schema.json", import.meta.url)));
assert.equal(schema.properties.apiVersion.const, "agent-dsl/v1alpha2", "new task contract needs a distinct API version");
const {validateAgent} = await import("../scripts/validate-agent.mjs");
const ajv = new Ajv2020({allErrors: true, strict: true});
const validate = ajv.compile(schema);
const base = parse(fs.readFileSync(new URL("../examples/legacy/v0.4/guidance.agent.yaml", import.meta.url), "utf8"));
base.apiVersion = "agent-dsl/v1alpha2";
delete base.assembly;
delete base.seats;
base.tasks = [{id: "answer", objective: "解释材料", components: ["answer-skill"],
  inputSchema: {type: "object", required: ["question"], properties: {question: {type: "string"}}},
  resultSchema: {type: "string"}, interaction: {mode: "interactive", on_missing_input: "ask"},
  delivery: {mode: "caller"}}];
base.launch.entries = [{name: "answer", task: "answer", coms: false}];
let count = 0;
function check(label, mutate, code) {
  const doc = structuredClone(base); mutate(doc);
  const errors = validate(doc) ? validateAgent(doc) : [{code: "SCHEMA", message: ajv.errorsText(validate.errors)}];
  if (code) assert.ok(errors.some(e => e.code === code), `${label}: wanted ${code}, got ${JSON.stringify(errors)}`);
  else assert.deepEqual(errors, [], label);
  count++;
}
function component(id, kind, spec, requires = [], effects = []) {
  return {id, kind, version: "1.0.0", source: {type: "inline"}, spec, requires, effects};
}
function toolPair(d) {
  d.resources = [{id: "docs", kind: "filesystem", access: "read_only", locator: {path: "knowledge"}}];
  d.components.push(component("read-bridge", "bridge", {name: "reader", runtime: "python", entrypoint: "read.py", facts_only: true, actions: ["read"]}, [{type: "resource", ref: "docs"}], ["filesystem.read"]));
  d.components.push(component("read-tool", "tool", {name: "doc_read", description: "Read", inputSchema: {type: "object"}, outputSchema: {type: "string"}, binding: {bridge: "read-bridge", action: "read"}}, [{type: "bridge", ref: "read-bridge", action: "read"}]));
}
function flow(d) {
  toolPair(d); d.tasks[0].components.push("read-tool");
  d.components.push(component("flow", "workflow", {name: "flow", roles: ["executor"], initial: "read", terminal: ["done"], phases: [{id: "read", role: "executor", tools: ["doc_read"]}, {id: "done", role: "executor"}], transitions: [{from: "read", to: "done", on: "tool_succeeded", tool: "doc_read"}]}, [{type: "tool", ref: "read-tool"}]));
  d.tasks[0].workflow = "flow";
}
check("minimal task, no seat or assembly", () => {});
check("explicit free conversation seat", d => {delete d.tasks; d.seats=[{id:"chat",persona:"解释资料",components:["answer-skill"],mode:"read_only"}];d.launch.entries=[{name:"chat",seat:"chat",coms:false}];});
check("task execution alternatives conflict", d => {d.tasks[0].seat = "writer";}, "SCHEMA");
check("missing execution context never exposes all components", d => {delete d.tasks[0].components;}, "SCHEMA");
check("background task cannot ask", d => {d.tasks[0].interaction.mode = "non_interactive";}, "SCHEMA");
check("launch cannot override task context", d => {d.launch.entries[0].seat = "writer";}, "SCHEMA");
check("unknown task", d => {d.launch.entries[0].task = "missing";}, "REF");
check("task id uniqueness", d => {d.tasks.push(structuredClone(d.tasks[0]));}, "DUPLICATE");
check("task embedded schema must be valid", d => {d.tasks[0].inputSchema = {type: "made-up"};}, "EMBEDDED_SCHEMA");
check("red line cannot reference inherited object property", d => {d.identity.red_lines[0].enforced_by=["gate.constructor"];}, "REF");
check("valid JSON Schema is not rejected by Ajv lint preferences", d => {d.tasks[0].inputSchema={properties:{question:{type:"string"}}};});
check("components cannot select workflow as capability", d => {flow(d); d.tasks[0].components.push("flow");}, "LAYER");
check("no upward generic dependency", d => {flow(d); d.components[0].requires = [{type: "component", ref: "flow"}];}, "LAYER");
check("dependency cycle is rejected", d => {d.components[0].requires = [{type: "skill", ref: "answer-skill"}];}, "CYCLE");
check("valid tool and role-neutral workflow", flow);
check("tool.phase removed", d => {flow(d); d.components.find(c=>c.kind==="tool").spec.phase="read";}, "SCHEMA");
check("workflow.seat removed", d => {flow(d);d.components.find(c=>c.kind==="workflow").spec.seat="chat";}, "SCHEMA");
check("role binding mismatch", d => {flow(d);d.components.find(c=>c.kind==="workflow").spec.roles=["writer"];}, "ROLE");
check("workflow cannot borrow other role tools", d => {flow(d);d.tasks[0].components=["answer-skill"];}, "VISIBILITY");
check("declared use must have requires edge", d => {flow(d);d.components.find(c=>c.kind==="workflow").requires=[];}, "DEPENDENCY");
check("binding must match action dependency", d => {flow(d);d.components.find(c=>c.kind==="tool").requires=[];}, "DEPENDENCY");
check("wrong bridge kind gives diagnostic, not crash", d => {toolPair(d);d.components.find(c=>c.kind==="tool").requires=[{type:"bridge",ref:"answer-skill",action:"read"}];}, "REF");
check("unbounded control cycle", d => {flow(d);const w=d.components.find(c=>c.kind==="workflow").spec;w.transitions.push({from:"read",to:"read",on:"manual"});}, "FLOW_CYCLE");
check("bounded retry references concrete transition", d => {flow(d);const w=d.components.find(c=>c.kind==="workflow").spec;w.transitions.push({from:"read",to:"read",on:"tool_failed",tool:"doc_read"});w.loops=[{from:"read",to:"read",on:"tool_failed",tool:"doc_read",max_rounds:2}];});
check("orphan loop rejected", d => {flow(d);d.components.find(c=>c.kind==="workflow").spec.loops=[{from:"read",to:"read",on:"manual",max_rounds:2}];}, "FLOW");
check("terminal phase cannot have outgoing edge", d => {flow(d);d.components.find(c=>c.kind==="workflow").spec.transitions.push({from:"done",to:"read",on:"manual"});}, "FLOW");
check("assembly cannot contain policy", d => {d.components.push(component("deny","gate",{zero_access:["secrets/**"]}));d.assembly={groups:[{id:"group",components:["deny"],mode:"main"}]};}, "LAYER");
check("seat has one capability selection", d => {d.seats=[{id:"chat",persona:"解释",components:["answer-skill"],groups:["group"],mode:"read_only"}];}, "SCHEMA");
check("readonly checks transitive effects", d => {toolPair(d);d.components.find(c=>c.kind==="bridge").effects=["filesystem.write"];d.gate.filesystem.write_allow=["workspace/**"];d.seats=[{id:"reader",persona:"只读",components:["read-tool"],mode:"read_only"}];}, "READ_ONLY");
check("review binding target is explicit", d => {d.components.push(component("quality","review",{checks:[{id:"shape",kind:"schema",severity:"error"}]}));d.tasks[0].acceptance=[{review:"quality",target:"result"}];});
check("acceptance does not grant new effects", d => {d.gate.filesystem.write_allow=["workspace/**"];d.components.push(component("quality","review",{checks:[{id:"shape",kind:"schema",severity:"error"}]},[],["filesystem.write"]));d.tasks[0].acceptance=[{review:"quality",target:"result"}];}, "VISIBILITY");
check("unknown review target", d => {d.components.push(component("quality","review",{checks:[{id:"shape",kind:"schema",severity:"error"}]}));d.tasks[0].acceptance=[{review:"quality",target:"missing"}];}, "REF");
check("custom review needs checker tool", d => {d.components.push(component("quality","review",{checks:[{id:"check",kind:"custom",severity:"error"}]}));}, "DEPENDENCY");
check("multirole acceptance needs explicit executor", d => {flow(d);delete d.tasks[0].components;d.tasks[0].roles=[{id:"author",responsibility:"解释",components:["answer-skill","read-tool"]},{id:"reviewer",responsibility:"检查",components:["answer-skill"]}];const w=d.components.find(c=>c.kind==="workflow").spec;w.roles=["author","reviewer"];w.phases[0].role="author";w.phases[1].role="reviewer";d.components.push(component("quality","review",{checks:[{id:"shape",kind:"schema",severity:"error"}]}));d.tasks[0].acceptance=[{review:"quality",target:"result"}];}, "ROLE");
const input = ajv.compile(base.tasks[0].inputSchema);
assert.equal(input({question:"Explain"}),true); assert.equal(input({}),false);
const result = ajv.compile(base.tasks[0].resultSchema);
assert.equal(result("Answer"),true); assert.equal(result({answer:"Answer"}),false);
console.log(`${count} v0.5 contract cases and 4 task-instance assertions passed`);
