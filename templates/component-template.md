# v0.5 组件模板

适用 agent-dsl/v1alpha2。以下为独立组件片段，不是完整清单；引用对象必须另行定义。能力分组只允许 skill/tool/bridge/knowledge。

## skill

```yaml
- id: author-guide
  kind: skill
  version: 1.0.0
  source:
    type: inline
  spec:
    name: author-guide
    description: 基于事实起草
    guide: 先检索，再起草；候选写入不代表正式发布。
    tools:
      - policy_read
      - candidate_write
  requires:
    - type: tool
      ref: read-tool
    - type: tool
      ref: write-tool
  effects: []
```

## tool

```yaml
- id: read-tool
  kind: tool
  version: 1.0.0
  source:
    type: inline
  spec:
    name: policy_read
    description: 读取制度事实
    inputSchema:
      type: object
    outputSchema:
      type: string
    binding:
      bridge: read-bridge
      action: read
  requires:
    - type: bridge
      ref: read-bridge
      action: read
  effects: []
```

## bridge

```yaml
- id: read-bridge
  kind: bridge
  version: 1.0.0
  source:
    type: inline
  spec:
    name: reader
    runtime: python
    entrypoint: bridges/read.py
    facts_only: true
    actions:
      - read
  requires:
    - type: knowledge
      ref: policy-domain
    - type: resource
      ref: policies
  effects:
    - filesystem.read
```

## knowledge

```yaml
- id: policy-domain
  kind: knowledge
  version: 1.0.0
  source:
    type: inline
  spec:
    domain: policy
  requires:
    - type: resource
      ref: policies
  effects: []
```

## workflow

```yaml
- id: revision-flow
  kind: workflow
  version: 1.0.0
  source:
    type: inline
  spec:
    name: revision
    roles:
      - author
      - reviewer
    initial: draft
    terminal:
      - done
    phases:
      - id: draft
        role: author
        tools:
          - policy_read
          - candidate_write
      - id: review
        role: reviewer
        tools:
          - policy_read
      - id: approve
        role: reviewer
      - id: done
        role: reviewer
    transitions:
      - from: draft
        to: review
        on: tool_succeeded
        tool: candidate_write
      - from: review
        to: approve
        on: phase_completed
      - from: review
        to: draft
        on: manual
      - from: approve
        to: done
        on: approval_granted
    loops:
      - from: review
        to: draft
        on: manual
        max_rounds: 2
    human_checkpoints:
      - phase: approve
        required: true
        prompt: 确认候选稿与检查意见；本批准不授权正式发布
        approval: one_time
  requires:
    - type: tool
      ref: read-tool
    - type: tool
      ref: write-tool
  effects: []
```

## persona

```yaml
- id: evidence-persona
  kind: persona
  version: 1.0.0
  source:
    type: inline
  effects: []
  spec:
    name: evidence-persona
    content: 以证据为依据，明确不确定性
```

## gate

```yaml
- id: protect-secrets
  kind: gate
  version: 1.0.0
  source:
    type: inline
  spec:
    zero_access:
      - .env
      - secrets/**
  requires: []
  effects: []
```

## output

```yaml
- id: candidate-report
  kind: output
  version: 1.0.0
  source:
    type: inline
  spec:
    name: candidate-report
    path: workspace/candidates/candidate_policy.md
    media_type: text/markdown
    lifecycle: candidate
    publish: atomic_file
  requires: []
  effects:
    - artifact.write
```

## review

```yaml
- id: result-shape
  kind: review
  version: 1.0.0
  source:
    type: inline
  spec:
    checks:
      - id: result-contract
        kind: schema
        severity: error
  requires: []
  effects: []
```
