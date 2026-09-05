# v0.5 任务模板

简单任务直接选择能力；task 是一类业务，不是运行实例。以下片段需对应组件。

```yaml
tasks:
  - id: explain
    objective: 解释提供的材料，明确区分事实与推断
    inputSchema:
      type: object
      additionalProperties: false
      required:
        - question
      properties:
        question:
          type: string
          minLength: 1
    resultSchema:
      type: object
      additionalProperties: false
      required:
        - answer
        - sources
      properties:
        answer:
          type: string
        sources:
          type: array
          items:
            type: string
    interaction:
      mode: interactive
      on_missing_input: ask
    delivery:
      mode: caller
    components:
      - answer-skill
```

## 多角色任务

roles 至少两项，与 workflow 槽位完全匹配。每个 role 在 seat/components 中二选一；多角色 acceptance 显式指定执行角色，不合并全部权限。

```yaml
tasks:
  - id: revise-policy
    objective: 产生有依据、经检查及人审确认的候选稿
    inputSchema:
      type: object
      additionalProperties: false
      required:
        - question
      properties:
        question:
          type: string
          minLength: 1
    resultSchema:
      type: object
      additionalProperties: false
      required:
        - answer
        - sources
      properties:
        answer:
          type: string
        sources:
          type: array
          items:
            type: string
    interaction:
      mode: interactive
      on_missing_input: ask
    delivery:
      mode: caller
    roles:
      - id: author
        responsibility: 起草候选
        seat: writer
      - id: reviewer
        responsibility: 核对依据并整理审查意见
        seat: checker
    workflow: revision-flow
    outputs:
      - candidate-report
    acceptance:
      - review: result-shape
        target: result
        role: reviewer
```
