# Loom（Agent DSL）文档导航

> 这里是 Agent DSL 的设计文档目录。
> 推荐按“先理解模型，再看模板，再看示例，最后看编译器”的顺序阅读。

![Agent DSL 模型全景](../diagrams/model-overview.drawio.png)

> 规范中的图均可编辑：`../diagrams/` 下同时保存 `.drawio` 源文件与内嵌 XML 的 `.drawio.png`
> （可直接用 draw.io 打开修改）。

---

## 1. 推荐阅读顺序

### 第一步：读总规范

- [`AGENT_DSL_SPEC.md`](AGENT_DSL_SPEC.md)

先理解整体模型：

```text
identity → components → assembly → gate → knowledge → compiler
```

重点看：
- DSL 为什么不是 prompt 配置
- components-first 是什么意思
- 开发者和平台分别负责什么
- assembly 为什么必须显式存在
- knowledge（知识资产）与 memory（会话记忆）的分层

---

### 第二步：读组件模板

- [`templates/component-template.md`](../templates/component-template.md)

用于理解组件怎么拆：
- tool
- bridge
- skill
- workflow
- knowledge
- gate

重点看：
- 组件只声明能力
- 业务逻辑由开发者写
- 平台只生成装订层

---

### 第三步：读 assembly 模板

- [`templates/assembly-template.md`](../templates/assembly-template.md)

用于理解组件怎么组织：
- entrypoints
- groups
- routes
- checkpoints
- notes

重点看：
- components 是零件
- assembly 是组织关系
- compiler 是装配器

---

### 第四步：读 workflow 模板

- [`templates/workflow-template.md`](../templates/workflow-template.md)

用于理解阶段和循环：
- phases
- transitions
- loops
- human_checkpoints
- widget

重点看：
- assembly 管组件组织
- workflow 管阶段推进
- skill 管软引导

---

### 第五步：读 gate 模板

- [`templates/gate-template.md`](../templates/gate-template.md)

用于理解硬边界：
- filesystem
- bash
- egress
- zero_access
- knowledge_write

重点看：
- identity 写红线
- gate 执行红线
- 红线必须有运行时硬约束兜底

---

### 第六步：读示例

- [`examples/minimal-faq.agent.yaml`](../examples/minimal-faq.agent.yaml)
- [`examples/data-asset.agent.yaml`](../examples/data-asset.agent.yaml)

建议先读 `minimal-faq.agent.yaml`，再读 `data-asset.agent.yaml`。

---

### 第七步：读编译器设计

- [`COMPILER_DESIGN.md`](COMPILER_DESIGN.md)

用于理解平台如何把 DSL 编译成可运行智能体：

```text
resolve → validate → lint → link → codegen → package
```

---

### 第八步：查 schema

- [`schema/agent.schema.json`](../schema/agent.schema.json)

用于实现校验器、IDE 补全、CI 检查。

---

## 2. 文档结构总览

| 文件 | 用途 | 读者 |
|---|---|---|
| `AGENT_DSL_SPEC.md` | 总规范 | 所有人 |
| `COMPILER_DESIGN.md` | 编译器设计 | 平台开发者 |
| `../schema/agent.schema.json` | JSON Schema | 工具链 / CI / IDE |
| `../templates/component-template.md` | 组件模板 | Agent 开发者 |
| `../templates/assembly-template.md` | 组件组织模板 | Agent 开发者 |
| `../templates/workflow-template.md` | 工作流模板 | Agent 开发者 |
| `../templates/gate-template.md` | 硬边界模板 | Agent 开发者 / 安全评审 |
| `../examples/minimal-faq.agent.yaml` | 最小示例 | 新手 |
| `../examples/data-asset.agent.yaml` | 复杂示例 | 有经验开发者 |
| `../diagrams/` | 规范插图（.drawio 源 + 可编辑 PNG） | 所有人 |

---

## 3. 开发者落地顺序

开发一个新 Agent，建议按这个顺序：

1. 写 `metadata` 和 `identity`
2. 拆 `components`
3. 用 `assembly` 组织组件
4. 用 skill 组件写软引导
5. 用 workflow 组件写阶段和循环
6. 用 `seats` 投影出席位
6. 用 `gate` 收紧硬边界
7. 用 `knowledge` 定义知识资产生命周期
8. 用 `launch` 定义启动入口
9. 跑 schema 校验和 lint
10. 编译成 bundle 并 smoke test

---

## 4. 一句话心智模型

```text
components  = 我有哪些业务能力（九种 kind，唯一能力声明面）
assembly    = 这些能力怎么组织成系统
skill 组件  = LLM 应该怎么使用这些能力
workflow 组件 = 阶段如何推进、回退、循环
knowledge   = 哪些产物沉淀为资产（被批准的事实）
memory      = 会话上下文与长期记忆（runtime 适配层，如 OpenViking）
evolution   = 经验如何长成新组件（采集自动、进化人工、候选隔离）
gate        = 哪些事绝对不能做
compiler    = 把声明编译成可运行智能体
```

---

## 5. 当前建议实现优先级

MVP 阶段优先做：

1. schema validate
2. lint 红线↔gate、tool↔bridge、assembly 引用闭环
3. codegen 生成 `.pi` / `extensions` / `justfile`
4. smoke test

暂缓：
- 完整 registry
- 远程 publish
- 复杂 override
- 多 runtime 生成

---

## 6. 总结

Agent DSL 的目标不是生成聊天机器人，而是让开发者用声明式方式构造：

- 可组合的业务组件
- 可校验的组织关系
- 可观测的阶段工作流
- 可强制执行的安全边界
- 可沉淀、可复用、可审计的业务资产
