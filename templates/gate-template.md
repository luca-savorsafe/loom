# v0.5 权限模板

以下是默认拒绝、仅允许候选写入的策略片段；需搭配明确资源与执行能力。

```yaml
gate:
  default: deny
  filesystem:
    write_allow:
      - workspace/candidates/**
    delete_rule: none
    param_check: true
    zero_access:
      - .env
      - secrets/**
  bash:
    allow_presets:
      - python_tools
    deny_presets:
      - git_push
      - production_write
  egress:
    policy: deny_all
  knowledge_write:
    mode: candidate_only
    paths:
      - workspace/candidates/**
```

zero_access 禁止所有访问，不是只禁止写入。附加 gate 组件在 Agent 全局生效，不能放到 group 猜测局部作用域。真实隔离仍需 sandbox、只读凭据、参数与网络检查。
