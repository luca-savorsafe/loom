# v0.5 流程模板

流程声明角色槽位，task 绑定实际岗位。工具不声明 phase；phase.tools 明确允许工具。以下引用需放入完整 Agent。

```yaml
id: revision-flow
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

loops 精确匹配现有转移，不创建额外边。删除受限边后必须无环；terminal 无外出边，人审阶段所有出口必须是 approval_granted。计数、角色交接和审批凭证须由 runtime 实现。
