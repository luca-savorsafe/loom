# v0.5 能力包与岗位模板

只在复用时引入 assembly 和 seats。任务角色单向引用岗位，岗位不登记 tasks。分组不含流程、产物、检查或 gate。

```yaml
assembly:
  groups:
    - id: read-policy
      components:
        - read-tool
        - policy-domain
      mode: main
seats:
  - id: writer
    persona: 负责候选起草，不改正式制度
    components:
      - author-guide
    mode: standard
  - id: checker
    persona: 只读核对制度证据
    groups:
      - read-policy
    mode: read_only
```

同一 seat 可被多个 task/role 复用，但每次运行的上下文独立。read_only 要检查整个依赖闭包，standard 不表示自动获权。
