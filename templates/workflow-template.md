# Agent DSL Workflow 组件模板

> `workflow` 组件是阶段图。
> 它回答的问题不是“组件如何摆放”，而是：**这个智能体在每一阶段该做什么、何时回退、何时停下给人确认？**

---

## 1. Workflow 组件的职责

workflow 组件负责描述一个 seat 内部的阶段推进方式：

- 当前处于哪个 phase
- phase 的推荐顺序是什么
- 哪些 phase 之间可以回退
- 哪些节点需要人工确认
- 哪些 phase 是循环迭代的一部分
- 哪些 phase 对应可观测状态

一句话：

> **assembly 管组件组织，workflow 组件管阶段与循环，skill 组件管软引导。**

---

## 2. 组件形态

workflow 是九种组件 kind 之一，声明在 `components` 里：

```yaml
components:
  - id: demo-flow
    kind: workflow
    source: "inline:"        # 或 local:./components/demo-flow
    provides:
      workflow:
        name: demo-flow        # 工作流名字
        seat: default          # 归属 seat
        widget: single_line    # single_line / panel / none
        phases: []             # phase 顺序
        transitions: []        # phase 之间的流转
        loops: []              # 循环或回退
        human_checkpoints: []  # 人工确认点
```

> 下文示例为可读性只展示 `provides.workflow` 的内容，省略组件包装层。

---

## 3. phases

`phases` 是工作流的主顺序。

```yaml
workflow:
  name: faq-flow
  seat: default
  widget: single_line
  phases: [locate, answer]
```

建议：
- phase 名字尽量短、稳定、语义清楚
- phase 顺序应该符合真实工作节奏
- 不要把组件 id 当 phase id 直接照搬，除非它确实就是一个阶段

---

## 4. transitions

`transitions` 描述 phase 之间的显式流转。

```yaml
workflow:
  name: research-flow
  seat: researcher
  phases: [inspect, design, write, scan, analyze]
  transitions:
    - from: inspect
      to: design
    - from: scan
      to: analyze
```

字段说明：

| 字段 | 说明 |
|---|---|
| `from` | 起始 phase |
| `to` | 目标 phase |
| `when` | 可选，何时走这条边 |

建议：
- 主路径写成明确的 transitions
- 可选路径不要和主路径混在一起
- review 类 phase 可以单独用 transition 标出

---

## 5. loops

`loops` 描述回退、循环、反复迭代。

```yaml
workflow:
  name: research-flow
  seat: researcher
  phases: [inspect, design, write, scan, analyze]
  loops:
    - from: analyze
      to: design
      until: 用户要求继续迭代
      max_rounds_soft: 3
```

建议：
- 循环要有软上限
- 循环条件要能被人理解
- 不要让循环变成无限调参器

---

## 6. human_checkpoints

`human_checkpoints` 描述必须停下来确认的点。

```yaml
workflow:
  name: publish-flow
  seat: steward
  phases: [draft, validate, publish]
  human_checkpoints:
    - phase: validate
      required: true
      prompt: validate 0 errors 后再进入交付
```

建议：
- 写生产、promote、publish、register 前必须有人工确认
- 高风险路径必须强制停顿
- 研究类工作流每轮输出结果后最好停一下问用户

---

## 7. widget

`widget` 只是可观测性呈现方式，不影响工作流语义。

可选值：`single_line`（日常坐席）/ `panel`（复杂多阶段）/ `none`（极简或 headless）。

---

## 8. 三种常见模式

### 8.1 只读问答型

```yaml
workflow:
  name: faq-flow
  seat: default
  widget: single_line
  phases: [search, answer]
  human_checkpoints:
    - phase: answer
      required: true
      prompt: 查不到就明确说不知道，不允许猜测
```

### 8.2 候选沉淀型

```yaml
workflow:
  name: steward-flow
  seat: steward
  widget: panel
  phases: [explore, draft, validate]
  transitions:
    - from: explore
      to: draft
    - from: draft
      to: validate
  human_checkpoints:
    - phase: validate
      required: true
      prompt: validate 0 errors 才能交付
```

### 8.3 研究迭代型

```yaml
workflow:
  name: research-flow
  seat: researcher
  widget: panel
  phases: [inspect, design, write, scan, analyze]
  transitions:
    - from: inspect
      to: design
    - from: design
      to: write
    - from: write
      to: scan
    - from: scan
      to: analyze
  loops:
    - from: analyze
      to: design
      until: 用户要求继续迭代，或指标还可改善
      max_rounds_soft: 3
  human_checkpoints:
    - phase: analyze
      required: true
      prompt: 每轮分析后必须停下展示结果，询问用户是否继续
```

---

## 9. Lint 规则建议

编译器应至少检查：

- `phases` 非空
- `transitions` / `loops` 引用的 phase 必须存在
- `human_checkpoints.phase` 必须存在
- `seat` 必须能匹配到实际席位
- `widget` 必须是允许值之一
- 研究类 workflow 应有回退或循环
- 高风险 workflow 应有人工确认点
- tool 组件声明的 `phase` 必须能在所属 workflow 的 phases 中找到

---

## 10. 最佳实践

- 不要让 workflow 组件替代 assembly：workflow 管阶段，assembly 管组件组织
- 不要让 workflow 组件替代 skill 组件：skill 管软引导，workflow 管状态与顺序
- 不要把 phase 命名得过于抽象：要能看出该阶段在做什么
- 不要把人工确认点藏进 prompt：必须显式写在 human_checkpoints
- 不要让循环没有软上限：要能停、能问、能回退

---

## 11. 一句话总结

**workflow 组件是开发者对阶段推进方式的显式承诺；平台根据这个承诺做状态管理、可观测性和校验。**
