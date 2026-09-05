# Loom v0.3 → v0.4 迁移指南

v0.4 使用 `agent-dsl/v1alpha1`，是一次有意的破坏性收敛。迁移目标不是逐字段改名，而是消除重复事实源，让清单可以确定性编译。

## 1. 迁移顺序

1. 把 `apiVersion` 改为 `agent-dsl/v1alpha1`；
2. 补全 runtime、结构化 identity 和顶层 default-deny gate；
3. 将每个 component 转成按 kind 判别的 `spec`；
4. 把依赖统一迁到 `requires`，把能力需求迁到 `effects`；
5. 把动态顺序、循环和确认点统一迁到 workflow；
6. 将 assembly 缩减为 groups，再由 seat 引用 groups；
7. 修正 launch 与实验块；
8. 执行 `npm test`，再运行未来的 `loom validate/lint`。

## 2. 版本与来源

旧写法：

```yaml
apiVersion: agent-dsl/v1
source: local:./components/search
```

新写法：

```yaml
apiVersion: agent-dsl/v1alpha1
source:
  type: local
  path: components/search
```

registry 必须同时声明精确版本：

```yaml
source: {type: registry, name: shared-search, version: 1.2.0}
```

## 3. 组件契约

旧的自由形态 `provides`、`policy.readonly` 和单值 `side_effect` 被移除：

```yaml
# v0.3
provides:
  tool: faq_search
policy:
  readonly: true
  side_effect: none
```

改为 kind-specific spec 与 effect 集合：

```yaml
# v0.4
kind: tool
spec:
  name: faq_search
  description: 检索 FAQ
  inputSchema: {type: object}
  outputSchema: {type: object}
  binding: {bridge: faq-bridge, action: search}
requires:
  - {type: bridge, ref: faq-bridge, action: search}
effects: []
```

`effects` 是组件的能力请求，不是授权。真实副作用发生在哪个组件，就在哪个组件声明；通常 bridge 声明文件、进程或网络 effect，tool 只声明自己的直接 effect。

## 4. Assembly 与 Workflow

删除 assembly 中的 `entrypoints/routes/checkpoints`，也删除 group 内的 `seat`。这些字段曾与 requires、workflow、seat 重复。

```yaml
# v0.4
assembly:
  groups:
    - id: faq-main
      components: [faq-tool, faq-bridge, faq-skill, faq-flow]
      mode: main

seats:
  - id: default
    persona: 你是 FAQ 助手。
    groups: [faq-main]
    mode: read_only
```

所有运行顺序进入 workflow：

```yaml
spec:
  name: faq-flow
  seat: default
  initial: search
  phases: [{id: search}, {id: answer}]
  transitions:
    - {from: search, to: answer, on: tool_succeeded, tool: faq_search}
  loops: []
  human_checkpoints:
    - phase: answer
      required: true
      approval: one_time
      prompt: 确认证据充分
```

迁移注意：

- checkpoint 字段统一为 `phase`，不再使用 `at`；
- loop 使用硬上限 `max_rounds`，不再使用软上限；
- `when` 只保留人读说明，不能当脚本或表达式执行；
- skill 删除 phase 列表，只保留 guide、tools、guardrails 和 references。

## 5. Identity 与 Gate

红线从字符串改为可追踪对象：

```yaml
identity:
  red_lines:
    - id: production-readonly
      statement: 生产库只读
      enforced_by: [resource:risk-db, gate.bash]
```

gate 必须显式默认拒绝：

```yaml
gate:
  default: deny
  filesystem:
    write_allow: []
    delete_rule: none
    param_check: true
  bash:
    allow_presets: [readonly]
    deny_presets: [network, install, git_push, rm_rf, inline_code, dangerous_git, production_write]
  egress:
    policy: deny_all
```

关键变化：

- `production_write` 已纳入合法 deny preset；
- `egress.policy: whitelist` 必须有非空 allow；
- candidate 写入同时需要 component effect、filesystem 白名单和 `knowledge_write`；
- reusable gate component 只能增加 deny，不能携带 allow。

## 6. Seat 与 Launch

seat 的内联 `persona` 与 `persona_ref` 严格二选一。每个 seat 必须声明 `groups` 和 `mode`。

launch 改为具名 entries：

```yaml
launch:
  binary: pi
  base_flags: [-ne, -ns, -nc]
  entries:
    - name: faq
      seat: default
      workflow: faq-flow
      coms: false
```

entry 使用 `seat: <id>` 或 `seats: all` 二选一。单 seat entry 的 workflow 必须属于该 seat。

## 7. 实验块

memory、evolution、coms 和远程 registry 尚不属于稳定 runtime 承诺。只有 memory、evolution、coms 三个顶层块定义了 `experimental_acknowledged`，保留这些块时必须设为 `true`，并确认所选 runtime adapter 支持对应能力。registry source 未定义此字段，不得添加；其解析、锁定与供应链校验需要 resolver 明确支持。不能把实验能力作为核心构建成功的前置条件。

## 8. 完成判据

- 正例通过结构与语义校验；
- 不再出现 `provides`、`policy.readonly`、`side_effect`、assembly routes/checkpoints；
- tool binding 与 requires、bridge actions 三者一致；
- workflow phase 全部可达，loop 有硬上限；
- effect 被 Agent gate 和部署环境共同授权；
- candidate 不能绕过人工 promote；
- 生成的 lock 和 BUILDINFO 能追溯 runtime、组件、有效策略和输出摘要。

v0.4 不提供自动迁移器。Alpha 阶段保留清晰错误和本指南，比维护一套会掩盖语义冲突的兼容层更安全。
