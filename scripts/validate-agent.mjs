import Ajv2020 from "ajv/dist/2020.js";

const capabilityKinds = new Set(["skill", "tool", "bridge", "knowledge"]);
const allowed = {
  skill: new Set(["tool", "knowledge"]), tool: new Set(["bridge"]),
  bridge: new Set(["knowledge", "resource"]), knowledge: new Set(["resource"]),
  workflow: new Set(["skill", "tool", "bridge", "knowledge", "review"]),
  review: new Set(["tool"]), output: new Set(), persona: new Set(), gate: new Set(),
};
const writes = new Set(["filesystem.write", "artifact.write", "knowledge.candidate_write", "external.write"]);
const embedded = new Ajv2020({allErrors: true, strict: false});
const eventKey = e => JSON.stringify([e.from, e.to, e.on, e.tool ?? null]);

// Input must already pass the v1alpha2 structural Schema. This is a static
// contract checker, not a resolver, scheduler, sandbox or policy engine.
export function validateAgent(doc) {
  const errors = [];
  const fail = (code, path, message) => errors.push({code, path, message});
  const cs = doc.components, seats = doc.seats ?? [], tasks = doc.tasks ?? [];
  const groups = doc.assembly?.groups ?? [], resources = doc.resources ?? [];
  function index(items, path) {
    const map = new Map();
    items.forEach((x, i) => {if (map.has(x.id)) fail("DUPLICATE", `${path}/${i}/id`, `duplicate id '${x.id}'`); map.set(x.id, x);});
    return map;
  }
  const C = index(cs, "/components"), S = index(seats, "/seats"), T = index(tasks, "/tasks");
  const G = index(groups, "/assembly/groups"), R = index(resources, "/resources");
  index(doc.identity.red_lines, "/identity/red_lines");
  const U = new Map();
  cs.forEach((c,i) => {if(c.kind === "tool") {if(U.has(c.spec.name)) fail("DUPLICATE", `/components/${i}/spec/name`, "duplicate tool call name"); U.set(c.spec.name,c);}});
  function target(map, id, kind, path) {
    const value = map.get(id);
    if (!value || (kind && value.kind !== kind)) {fail("REF", path, `unknown ${kind ?? "reference"} '${id}'`); return null;}
    return value;
  }
  function schema(value, path) {
    if (!embedded.validateSchema(value)) fail("EMBEDDED_SCHEMA", path, embedded.errorsText(embedded.errors));
    else {
      // Standalone schemas may use local refs, but not ambient/network refs.
      try {new Ajv2020({strict: false, validateFormats: false}).compile(value);} catch(e) {fail("EMBEDDED_SCHEMA",path,e.message);}
    }
  }
  function useTool(owner, name, path) {
    const t = target(U, name, "tool", path);
    if (t && !(owner.requires ?? []).some(d => ["tool","component"].includes(d.type) && d.ref === t.id)) {
      fail("DEPENDENCY", path, `tool '${name}' needs an explicit matching requires edge`);
    }
    return t;
  }
  const graph = new Map(cs.map(c => [c.id, []]));
  cs.forEach((c,i) => {
    const p = `/components/${i}`;
    (c.requires ?? []).forEach((dep,j) => {
      const q = `${p}/requires/${j}`;
      if (dep.type === "runtime") return; // Resolved against fixed runtime capability catalog at build time.
      const t = dep.type === "resource" ? target(R,dep.ref,null,q) : target(C,dep.ref,dep.type === "component" ? null : dep.type,q);
      if (!t) return;
      const kind = dep.type === "resource" ? "resource" : t.kind;
      if (!allowed[c.kind].has(kind)) fail("LAYER",q,`${c.kind} cannot depend on ${kind}`);
      if (dep.type !== "resource") graph.get(c.id).push(t.id);
      if (dep.type === "bridge" && !t.spec.actions?.includes(dep.action)) fail("REF",q,"unknown bridge action");
    });
    if (c.kind === "tool") {
      schema(c.spec.inputSchema,`${p}/spec/inputSchema`); schema(c.spec.outputSchema,`${p}/spec/outputSchema`);
      const b = target(C,c.spec.binding.bridge,"bridge",`${p}/spec/binding/bridge`);
      if (b && !b.spec.actions.includes(c.spec.binding.action)) fail("REF",`${p}/spec/binding/action`,"unknown action");
      if (!(c.requires ?? []).some(d => d.type === "bridge" && d.ref === c.spec.binding.bridge && d.action === c.spec.binding.action)) fail("DEPENDENCY",`${p}/spec/binding`,"binding requires identical bridge/action dependency");
    }
    if (c.kind === "skill") (c.spec.tools ?? []).forEach((n,j) => useTool(c,n,`${p}/spec/tools/${j}`));
    if (c.kind === "review") {
      index(c.spec.checks,`${p}/spec/checks`);
      c.spec.checks.forEach((check,j) => {
        if (check.tool) useTool(c,check.tool,`${p}/spec/checks/${j}/tool`);
        else if (check.kind === "custom") fail("DEPENDENCY",`${p}/spec/checks/${j}`,"custom review requires a checker tool");
      });
    }
  });
  function cycles(g, code, path) {
    const active = new Set(), done = new Set();
    function visit(id, trail) {
      if(active.has(id)) {fail(code,path,[...trail,id].join(" -> "));return;}
      if(done.has(id)) return;
      active.add(id); for(const next of g.get(id) ?? []) visit(next,[...trail,id]); active.delete(id);done.add(id);
    }
    for(const id of g.keys()) visit(id,[]);
  }
  cycles(graph,"CYCLE","/components");
  function closure(ids) {
    const found = new Set(), pending = [...ids];
    while(pending.length) {const id=pending.pop();if(found.has(id)||!C.has(id))continue;found.add(id);pending.push(...(graph.get(id)??[]));}
    return found;
  }
  function select(ids,path) {
    ids.forEach((id,i) => {const c=target(C,id,null,`${path}/${i}`);if(c&&!capabilityKinds.has(c.kind))fail("LAYER",`${path}/${i}`,`${c.kind} is not an execution capability`);});
    return closure(ids);
  }
  groups.forEach((g,i) => select(g.components,`/assembly/groups/${i}/components`));
  const seatScopes = new Map();
  seats.forEach((s,i) => {
    const p=`/seats/${i}`, ids=[...(s.components??[])];
    (s.groups??[]).forEach((id,j)=>{const g=target(G,id,null,`${p}/groups/${j}`);if(g)ids.push(...g.components);});
    if(s.persona_ref)target(C,s.persona_ref,"persona",`${p}/persona_ref`);
    const scope=select(ids,`${p}/components`);seatScopes.set(s.id,scope);
    if(s.mode==="read_only")for(const id of scope)if((C.get(id).effects??[]).some(e=>writes.has(e)))fail("READ_ONLY",p,`write effect in dependency closure: ${id}`);
  });
  function scopeFor(x,path) {
    if(x.seat) {target(S,x.seat,null,`${path}/seat`);return seatScopes.get(x.seat)??new Set();}
    return select(x.components??[],`${path}/components`);
  }
  const workflows=cs.filter(c=>c.kind==="workflow");
  workflows.forEach(w => {
    const p=`/components/${cs.indexOf(w)}/spec`, spec=w.spec;
    const phases=index(spec.phases,`${p}/phases`), roles=new Set(spec.roles), terminals=new Set(spec.terminal);
    target(phases,spec.initial,null,`${p}/initial`);
    spec.terminal.forEach((id,i)=>target(phases,id,null,`${p}/terminal/${i}`));
    spec.phases.forEach((phase,i)=>{
      if(!roles.has(phase.role))fail("ROLE",`${p}/phases/${i}/role`,"unknown workflow role slot");
      (phase.tools??[]).forEach((n,j)=>useTool(w,n,`${p}/phases/${i}/tools/${j}`));
    });
    const edges=spec.transitions??[], loops=spec.loops??[], bounded=new Set(loops.map(eventKey));
    const edgeKeys=new Set(), dispatchKeys=new Set();
    edges.forEach((e,i)=>{
      const q=`${p}/transitions/${i}`;
      target(phases,e.from,null,q+"/from");target(phases,e.to,null,q+"/to");
      if(terminals.has(e.from))fail("FLOW",q,"terminal phase cannot have outgoing transitions");
      const toolEvent=["tool_succeeded","tool_failed"].includes(e.on);
      if(toolEvent!==Boolean(e.tool))fail("FLOW",q,"tool events require tool, other events forbid it");
      if(e.tool) {
        useTool(w,e.tool,q+"/tool");
        if(!(phases.get(e.from)?.tools??[]).includes(e.tool))fail("FLOW",q,"event tool is not allowed in source phase");
      }
      const dispatch=JSON.stringify([e.from,e.on,e.tool??null]);
      if(dispatchKeys.has(dispatch))fail("FLOW",q,"ambiguous event transitions");
      dispatchKeys.add(dispatch);edgeKeys.add(eventKey(e));
    });
    const loopKeys=new Set();
    loops.forEach((l,i)=>{const key=eventKey(l);if(!edgeKeys.has(key))fail("FLOW",`${p}/loops/${i}`,"loop must bound an existing exact transition");if(loopKeys.has(key))fail("DUPLICATE",`${p}/loops/${i}`,"duplicate loop bound");loopKeys.add(key);});
    const unbounded=new Map(spec.phases.map(ph=>[ph.id,[]]));
    for(const e of edges)if(!bounded.has(eventKey(e))&&unbounded.has(e.from))unbounded.get(e.from).push(e.to);
    cycles(unbounded,"FLOW_CYCLE",`${p}/transitions`);
    function reachable(start, reverse=false) {const seen=new Set(start);let changed=true;while(changed){changed=false;for(const e of edges){const a=reverse?e.to:e.from,b=reverse?e.from:e.to;if(seen.has(a)&&!seen.has(b)){seen.add(b);changed=true;}}}return seen;}
    const reached=reachable([spec.initial]), canFinish=reachable(spec.terminal,true);
    for(const ph of spec.phases)if(!reached.has(ph.id)||!canFinish.has(ph.id))fail("FLOW",`${p}/phases`,`phase '${ph.id}' is unreachable or cannot reach a terminal`);
    const checkpoints=new Set();
    (spec.human_checkpoints??[]).forEach((h,i)=>{
      target(phases,h.phase,null,`${p}/human_checkpoints/${i}/phase`);
      if(checkpoints.has(h.phase))fail("DUPLICATE",`${p}/human_checkpoints/${i}`,"one checkpoint per phase");checkpoints.add(h.phase);
      if(terminals.has(h.phase)||!edges.some(e=>e.from===h.phase))fail("FLOW",`${p}/human_checkpoints/${i}`,"checkpoint needs an outgoing approval transition");
      if(edges.some(e=>e.from===h.phase&&e.on!=="approval_granted"))fail("FLOW",`${p}/human_checkpoints/${i}`,"all checkpoint exits require approval_granted");
    });
    for(const e of edges)if(e.on==="approval_granted"&&!checkpoints.has(e.from))fail("FLOW",`${p}/transitions`,"approval event requires a checkpoint");
  });
  tasks.forEach((t,i)=>{
    const p=`/tasks/${i}`;
    schema(t.inputSchema,p+"/inputSchema");schema(t.resultSchema,p+"/resultSchema");
    const contexts=new Map();
    if(t.roles) {index(t.roles,p+"/roles");t.roles.forEach((r,j)=>contexts.set(r.id,scopeFor(r,`${p}/roles/${j}`)));}
    else contexts.set("executor",scopeFor(t,p));
    const outputs=new Set(t.outputs??[]);
    (t.outputs??[]).forEach((id,j)=>{target(C,id,"output",`${p}/outputs/${j}`);if(id==="result")fail("REF",`${p}/outputs/${j}`,"result is reserved for the task result");});
    if(t.workflow) {
      const w=target(C,t.workflow,"workflow",p+"/workflow");
      if(w) {
        if(w.spec.roles.length!==contexts.size||w.spec.roles.some(r=>!contexts.has(r)))fail("ROLE",p+"/workflow","workflow slots and task execution roles must match exactly");
        for(const phase of w.spec.phases)for(const name of phase.tools??[]){const tool=U.get(name);if(tool&&!contexts.get(phase.role)?.has(tool.id))fail("VISIBILITY",p+"/workflow",`role '${phase.role}' cannot use '${name}'`);}
      }
    }
    (t.acceptance??[]).forEach((a,j)=>{
      const q=`${p}/acceptance/${j}`, role=a.role??"executor", scope=contexts.get(role);
      if((t.roles&&!a.role)||!scope)fail("ROLE",q+"/role","acceptance requires an existing explicit multi-role executor");
      if(a.target!=="result"&&!outputs.has(a.target))fail("REF",q+"/target","acceptance target must be result or a declared task output");
      const review=target(C,a.review,"review",q+"/review");
      if(review&&scope)for(const id of closure([review.id]))if(id!==review.id&&!scope.has(id))fail("VISIBILITY",q,`review needs unavailable capability '${id}'`);
      if(review&&scope) {
        const availableEffects=new Set([...scope].flatMap(id=>C.get(id).effects??[]));
        if((review.effects??[]).some(effect=>!availableEffects.has(effect)))fail("VISIBILITY",q,"review cannot add effects to its execution context");
      }
    });
  });
  const entries=doc.launch?.entries??[], names=new Set();
  entries.forEach((e,i)=>{const p=`/launch/entries/${i}`;if(names.has(e.name))fail("DUPLICATE",p,"duplicate entry name");names.add(e.name);if(e.task)target(T,e.task,null,p+"/task");if(e.seat)target(S,e.seat,null,p+"/seat");if(e.coms&&!doc.coms)fail("REF",p+"/coms","enabled communication needs top-level coms");});
  doc.identity.red_lines.forEach((r,i)=>(r.enforced_by??[]).forEach((control,j)=>{
    const p=`/identity/red_lines/${i}/enforced_by/${j}`;
    if(control.startsWith("resource:"))target(R,control.slice(9),null,p);
    if(control.startsWith("gate.")&&!Object.hasOwn(doc.gate,control.slice(5)))fail("REF",p,"missing gate control section");
  }));
  const effects=new Set(cs.flatMap(c=>c.effects??[])), gate=doc.gate;
  if(effects.has("network.egress")&&gate.egress.policy==="deny_all")fail("POLICY","/gate/egress","network requested but denied");
  if([...effects].some(e=>["filesystem.write","artifact.write"].includes(e))&&!gate.filesystem.write_allow.length)fail("POLICY","/gate/filesystem","write effect requires nonempty write scope");
  if(effects.has("knowledge.candidate_write")&&!gate.knowledge_write)fail("POLICY","/gate/knowledge_write","candidate write requires candidate policy");
  if(effects.has("process.exec")&&!(gate.bash.allow_presets?.length||gate.bash.allow?.length))fail("POLICY","/gate/bash","process execution has no command grant");
  return errors;
}
