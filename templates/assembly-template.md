# Agent DSL Assembly 模板

> `assembly` 是组件组织层。
> 它回答的问题不是“组件是什么”，而是：**这些组件如何组成一个可运行的智能体？**

---

## 1. Assembly 的职责

`assembly` 负责描述组件之间的逻辑关系：

- 哪些组件是入口
- 哪些组件组成主路径
- 哪些组件属于同一个 seat
- 哪些组件之间存在流向
- 哪些路径是 main / optional / fallback / review
- 哪些节点需要人工确认
- 哪些组件只是辅助能力，不进入主路径

一句话：

> **components 是零件清单，assembly 是零件之间的组织关系。**

---

## 2. 字段总览

```yaml
assembly:
  entrypoints: []     # 入口组件
  groups: []          # 组件分组，通常按 seat 或业务路径分
  routes: []          # 组件之间的流向
  checkpoints: []     # 人工确认点或强制停顿点
  notes: []           # 组织说明，给人读，也进入 BUILDINFO
```

---

## 3. entrypoints

`entrypoints` 定义 Agent 的入口组件。

```yaml
assembly:
  entrypoints:
    - fq-doc-search
    - faq-answer-skill
```

建议：
- 入口通常是 tool / skill / workflow 组件
- 不要把底层 bridge 当主入口，bridge 通常由 tool 调用
- 多入口适合多席位或多工作流 Agent

---

## 4. groups

`groups` 把组件组织成一个逻辑块。

```yaml
assembly:
  groups:
    - name: query-path
      seat: copilot
      components:
        - ds-explain-field
        - ds-check-leakage
        - ds-impact
      mode: main
```

字段说明：

| 字段 | 说明 |
|---|---|
| `name` | 逻辑分组名 |
| `seat` | 这个分组主要归属哪个 seat |
| `components` | 该分组包含哪些组件 id |
| `mode` | `main` / `optional` / `fallback` / `review` |

建议：
- 一个 seat 至少有一个 main group
- review 能力单独放 review group
- fallback 不要和 main 混在一起

---

## 5. routes

`routes` 定义组件之间的逻辑流向。

```yaml
assembly:
  routes:
    - from: ds-db-explore
      to: ds-code-index
      kind: main
    - from: ds-check-leakage
      to: ds-impact
      kind: optional
      when: 用户追问影响面时
```

字段说明：

| 字段 | 说明 |
|---|---|
| `from` | 起点组件 id |
| `to` | 终点组件 id |
| `kind` | `main` / `optional` / `fallback` / `review` |
| `when` | 可选，自然语言条件 |

建议：
- main route 表示推荐主路径
- optional route 表示按需执行
- fallback route 表示失败后的替代路径
- review route 表示进入审查或校验路径

---

## 6. checkpoints

`checkpoints` 定义人工确认点或强制停顿点。

```yaml
assembly:
  checkpoints:
    - at: ds-validate
      required: true
      prompt: validate 0 errors 才允许交付
```

字段说明：

| 字段 | 说明 |
|---|---|
| `at` | 组件 id 或 phase id |
| `required` | 是否必须停下来确认 |
| `prompt` | 给 Agent / 用户看的确认提示 |

建议：
- 写生产、promote、register、publish 前必须有 checkpoint
- 研究类 Agent 每轮扫描/回测后应有 checkpoint
- 诊断类 Agent 输出处置建议前应有 checkpoint

---

## 7. notes

`notes` 是给人和编译器报告看的说明。

```yaml
assembly:
  notes:
    - query-path 是只读问答路径
    - steward-path 是 candidate 知识沉淀路径
```

建议：
- 写清主路径和分支的业务含义
- 写清哪些路径不能自动执行
- 写清哪些节点需要人工拍板

---

## 8. 三种常见 Assembly 模式

> workflow 的阶段与循环模式，建议搭配 `templates/workflow-template.md` 一起看。

### 8.1 只读问答型

适合 FAQ、制度问答、知识库查询。

```yaml
assembly:
  entrypoints: [faq-tool]
  groups:
    - name: query-path
      seat: default
      components: [faq-tool, faq-bridge, faq-answer-skill]
      mode: main
  routes:
    - from: faq-tool
      to: faq-answer-skill
      kind: main
  checkpoints:
    - at: faq-answer-skill
      required: true
      prompt: 查不到就明确说明不知道，不允许猜测
```

### 8.2 候选沉淀型

适合数据资产、技术专家、知识沉淀。

```yaml
assembly:
  entrypoints: [explore-tool, suggest-tool]
  groups:
    - name: explore-path
      seat: steward
      components: [db-explore, code-index, suggest-contract, validate]
      mode: main
  routes:
    - from: db-explore
      to: code-index
      kind: main
    - from: code-index
      to: suggest-contract
      kind: main
    - from: suggest-contract
      to: validate
      kind: main
  checkpoints:
    - at: suggest-contract
      required: true
      prompt: candidate 只能作为草稿，正式生效必须人工 promote
    - at: validate
      required: true
      prompt: validate 0 errors 才能交付
```

### 8.3 研究迭代型

适合 quant-research、策略研究、实验型工作台。

```yaml
assembly:
  entrypoints: [inspect-tool, scan-tool]
  groups:
    - name: research-loop
      seat: researcher
      components: [inspect-tool, design-skill, write-tool, scan-tool, analyze-tool]
      mode: main
  routes:
    - from: inspect-tool
      to: design-skill
      kind: main
    - from: design-skill
      to: write-tool
      kind: main
    - from: write-tool
      to: scan-tool
      kind: main
    - from: scan-tool
      to: analyze-tool
      kind: main
    - from: analyze-tool
      to: design-skill
      kind: optional
      when: 用户要求继续迭代，或连续结果未达到阈值但仍有改进方向
  checkpoints:
    - at: analyze-tool
      required: true
      prompt: 每轮分析后必须停下展示结果，询问用户是否继续
```

---

## 9. Lint 规则建议

编译器应至少检查：

- `entrypoints` 中的组件必须存在
- `groups.components` 中的组件必须存在
- `routes.from` / `routes.to` 中的组件必须存在
- `checkpoints.at` 应能指向组件或 workflow phase
- 每个 `tool` 组件应出现在至少一个 group 中
- `mode=main` 的 group 至少有一个
- `readonly=false` 的组件必须有 gate 写权限兜底
- 涉及 promote / publish / register 的路径必须有 checkpoint

---

## 10. 最佳实践

- 不要让 assembly 替代 workflow：assembly 管组件组织，workflow 管阶段状态
- 不要让 assembly 替代 skill：skill 管 LLM 引导，assembly 管组件关系
- 不要让 routes 变成强制 DAG：它是推荐路径和校验依据，不是自动编排器
- 不要把所有组件塞进一个 main group：按 seat / 路径拆分
- 不要把人工闸门藏在 prompt 里：必须写进 checkpoints

---

## 11. 一句话总结

**assembly 是开发者对组件组织方式的显式承诺；平台根据这个承诺做校验、装配和审计。**
