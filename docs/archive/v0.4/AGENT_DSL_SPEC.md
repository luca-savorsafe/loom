# Loom Agent DSL 规范 v0.4

> API：`agent-dsl/v1alpha1`。Alpha 阶段允许破坏性调整，不承诺兼容 v0.3；已有清单参见[迁移指南](../../MIGRATION_V0_3_TO_V0_4.md)。

Loom 把 Agent 定义为：**一组强类型组件 + 明确的能力集合 + 可执行工作流 + 资源与边界策略 + 可审计构建信息**。

本文面向配置编写者与编译器/运行时实现者。首次使用先读第 2、3、7、16 节，理解元素选择和组合；查找某一配置的类型、默认值、条件和错误行为时阅读 [DSL 字段参考](DSL_FIELD_REFERENCE.md)。该参考逐项覆盖顶层、组件公共字段、九种 kind 的 spec 及全部嵌套配置。

文中 YAML 分为完整清单和配置片段。`spec:` 片段需要放入对应 kind 的完整组件，涉及的 id 也须在清单中定义。结构图中的空对象只是目录示意，不是合法的起步清单。可直接做静态校验的完整示例见 [纯指导](../../../examples/legacy/v0.4/guidance.agent.yaml)、[FAQ 查询](../../../examples/legacy/v0.4/minimal-faq.agent.yaml)和[数据资产工作台](../../../examples/legacy/v0.4/data-asset.agent.yaml)。这些例子展示声明契约，不意味着引用的运行时和业务程序已提供。

## 1. 规范状态与术语

本文件定义跨字段语义，[JSON Schema](../../../schema/versions/agent-v1alpha1.schema.json) 定义可机器校验的结构。两者共同构成规范；任何不一致都属于发布阻断错误，不设“文档覆盖 Schema”或“Schema 覆盖文档”的隐式优先级。

关键词：

- **MUST / 必须**：违反即 validate 或 lint error。
- **SHOULD / 应该**：违反产生 warn，除非给出显式豁免。
- **MAY / 可以**：可选能力。
- **组件**：带版本、来源、接口、依赖和 effects 的可装配单元。
- **resource**：文件、知识、数据库、服务或可执行文件等受控资源。
- **effect**：组件运行需要的外部能力，不代表已经获权。
- **Canonical Agent IR**：归一化后的编译器内部唯一输入。

“必填”需要区分两个层次：Schema 的必填是对象结构要求；业务条件必填是某项能力启用后才产生的引用或运行要求。例如 `seats` 在根 Schema 中可省略，但一个 workflow 指定了 seat 就必须能解析到它。实验能力仍可包含必填字段，“实验”不是免检标志。

规范要求、当前校验器已覆盖的行为、未来运行时必须实现的行为分别列于第 17 节。不要将 MUST 理解为“本仓库已经有代码强制执行”。

## 2. 设计原则

### 2.1 Components-first

业务能力只在 `components` 声明。平台生成装订层，不生成业务逻辑本体。

### 2.2 一个事实只声明一次

| 语义 | 唯一声明面 |
|---|---|
| 静态依赖 | `component.requires` |
| 所需外部能力 | `component.effects` |
| 组件集合 | `assembly.groups` |
| seat 可见性 | `seat.groups` |
| phase、顺序、循环、人审 | workflow component |
| LLM 操作说明 | skill component |
| 启动入口 | `launch.entries` |

assembly 不表达运行顺序，skill 不复制 workflow 图，group 不反向绑定 seat。

### 2.3 事实、判断和强制分离

- bridge 负责确定性查询、计算和校验，必须 `facts_only: true`。
- LLM 负责解释、归纳、选择工具和提出建议。
- gate 与运行环境负责强制边界。

### 2.4 默认拒绝

组件的 `effects` 是权限请求，不是授权。可复用组件不得扩大 Agent 权限。

```text
effective = requested ∩ agent_grants ∩ environment_grants − denies
```

### 2.5 候选隔离

知识、技能和经验的自动产出不得直接进入正式运行面。Agent 只生成 candidate，人类批准后才能 promote。

### 2.6 声明怎样变成一次执行

配置编写者声明期望能力、资源和约束；编译器将引用绑定到具体实现；运行时根据模型请求和 workflow 状态调用已授权的能力。YAML 不是脚本，排列组件或把某个词写进 `guide` 不会自动执行动作。

| 阶段 | 对配置编写者意味着什么 | 实现者必须处理什么 |
|---|---|---|
| 解析与结构校验 | 字段、类型和 kind 使用正确 | YAML 重复键、未知属性、必填、联合类型、内嵌 Schema |
| 来源解析与锁定 | 本地路径可找到，版本明确 | 解析组件和 runtime，校验来源和内容摘要 |
| 归一与链接 | 引用都指向预期对象 | 默认值物化、组件图、seat 能力视图、workflow 归属 |
| 语义与策略检查 | 所需动作确实可被允许 | 传递依赖、数据和路径限制、生命周期、审批要求 |
| 代码生成与打包 | 得到可启动、可追踪的产物 | 只消费 IR，生成接口与策略装订，记录 provenance |
| 运行 | 工具在正确阶段执行并返回结果 | 输入校验、权限检查、隔离调用、结果校验、事件和审计 |

以制度检索为例：seat 暴露 `fq_doc_search` → 模型提交参数 → tool 校验参数并定位 bridge action → gate 检查资源和实际动作 → bridge 返回事实 → tool 校验结果 → skill 指导如何解释事实 → workflow（如果配置）消费完成事件。这里 tool/bridge 的依赖由 `requires` 声明，先后阶段由 workflow 声明，文字回答方式由 skill 声明。

### 2.7 所有权与引用名称

一个对象可以有多个名称，但每类引用只有一个明确目标：

| 引用位置 | 目标 | 常见误解 |
|---|---|---|
| `requires[type=component/tool/skill/knowledge].ref` | 组件 `id`，并校验要求的 kind | 把 tool 的调用名填到 ref |
| `requires[type=bridge].ref`、`tool.spec.binding.bridge` | bridge 组件 `id` | 使用 bridge.spec.name 替代 |
| `binding.action`、bridge dependency action | `bridge.spec.actions` 的一个成员 | 动作声明了但绑定拼写不同 |
| `skill.spec.tools[]`、`transition.tool`、`review.checks[].tool` | `tool.spec.name` | 填成 tool 组件 id |
| `assembly.groups[].components[]` | 组件 `id` | 把 resource id 当组件 |
| `seat.groups[]` | group `id` | 把组件列表直接复制到 seat |
| `seat.persona_ref` | persona 组件 `id` | 同时再声明 persona 正文 |
| `workflow.spec.seat`、`launch.entries[].seat` | seat `id` | 默认存在一个未声明的 default |
| `launch.entries[].workflow` | workflow 组件 `id` | 使用 workflow 的人读描述 |
| `requires[type=resource].ref` | resource `id` | 把路径写在 ref |

组件 id 在所有 kind 之间唯一；资源、group、seat 各有自己的命名空间。`metadata.version` 是 Agent 发布版本，组件 version 是能力发布版本，runtime.version 是宿主契约版本，apiVersion 是语言版本，四者不要求同步递增。

## 3. 顶层结构

```yaml
apiVersion: agent-dsl/v1alpha1
kind: Agent
metadata: {}
identity: {}
runtime: {}
resources: []
components: []
assembly: {}
seats: []
gate: {}
knowledge: {}
memory: {}
evolution: {}
coms: {}
launch: {}
settings: {}
```

必填块为 `apiVersion/kind/metadata/identity/runtime/components/assembly/gate`。`memory/evolution/coms` 为实验块。

### 3.1 顶层元素为什么存在

| 元素 | 用途和必要性 | 使用场景；省略的含义 |
|---|---|---|
| apiVersion | 必填，选择解释整份清单的语言契约 | 每份清单均配置；不能用业务版本替代 |
| kind | 必填，区分文档类型，当前只有 Agent | 每份清单均配置；不要与组件类型混淆 |
| metadata | 必填，提供可发布、可检索、可追溯的身份 | 所有 Agent 都有业务目的和稳定 id |
| identity | 必填，描述共享角色与业务边界 | 所有 seat 的全局身份；不负责注册工具 |
| runtime | 必填，声明执行宿主和适配器 | 决定构建目标，当前仅 Pi |
| resources | 有外部资源依赖时使用，根 Schema 可选 | 文档目录、数据库、服务、可执行程序；省略不自动发现资源 |
| components | 必填且非空，描述可组合能力 | 按任务选择 kind；并非九种都需要 |
| assembly | 必填，形成可复用的静态能力集合 | 最小 Agent 一组即可；不承担排序或审批 |
| seats | workflow 或启动入口需要明确归属时配置 | 单一助手通常一席；多职责和可见能力不同才多席 |
| gate | 必填，限制整个 Agent 的实际动作 | 纯指导场景可显式关闭所有外部动作 |
| knowledge | 管理 Agent 知识资产生命周期时配置 | 组织候选/正式资产和引用来源；仅读用户输入时可省略 |
| memory | 可选、实验，跨会话保留筛选后信息 | 确有持久记忆需求才开启；不是工具日志仓库 |
| evolution | 可选、实验，从经验形成待审改进候选 | 反复任务和人工评审渠道具备时使用 |
| coms | 可选、实验，独立 Agent 之间会诊 | 多 seat 不等于必须通信；省略不自动查找外部 Agent |
| launch | 输出具名可启动入口时配置 | 单席、全席、特定流程入口；缺失时不承诺默认入口 |
| settings | 可选，模型、UI 与加载偏好 | 可依赖宿主偏好；不能利用设置扩大权限 |

### 3.2 最小化配置的规则

从一项业务能力开始，先配置必填顶层块和一个 skill；需要启动时加一个 seat 和 launch。只有模型需要外部操作才增加 tool/bridge/resource；只有需要强制状态或审批才增加 workflow。需要受管资产时再增加 knowledge/output/review，能内联的短 persona 不必再拆组件。

这区分了“必须有某个顶层容器”和“必须安装某种能力”。`components` 必填不表示 tool 必填；`gate` 必填不表示 gate 组件必填；`assembly.groups[].mode: review` 也不表示有 review 执行器。

## 4. metadata 与 identity

metadata 面向维护、发布和索引，identity 面向模型和业务沟通。`purpose` 概括为什么存在这个 Agent，`role` 说明它以什么职责提供服务，`can/cannot` 说明承接范围，`red_lines` 连接不可越过的业务边界与可执行控制。图标、颜色和名称只影响展示；稳定 id 与 version 参与引用和追溯。

适用场景：一个数据资产工作台可包含查询、沉淀和审查三个 seat，共享同一 identity；每席用 persona 强调职责差异。不要在 persona 中重复整份身份和权限，也不要把“可以查询数据库”误解为已经声明 resource 或授予访问权。字段详表见[字段参考第 2、3 节](DSL_FIELD_REFERENCE.md)。

```yaml
metadata:
  id: data-asset
  name: 信贷数据资产管理
  purpose: 管理契约、语义、血缘和画像
  version: 0.4.0
  domain: credit
  team: team.json

identity:
  role: 你是数据资产工作台。
  red_lines:
    - id: production-readonly
      statement: 生产库只读
      enforced_by: [resource:risk-db]
  can: [查询字段口径]
  cannot: [执行生产写操作]
```

`red_lines` 不再是无法校验的纯文本列表。每条红线必须有稳定 id，并通过 `enforced_by` 引用以下控制之一：

- `gate.<section>`；
- `resource:<resource-id>`；
- `runtime:<control-id>`。

编译器只校验引用闭环，不尝试用 LLM 判断两段自然语言是否等价。结构化控制是安全事实源，`statement` 是人读镜像。

## 5. runtime 与 resources

### 5.1 Runtime

runtime 解决“这个声明由谁运行”。选择 `headless` 适用于后台或测试，`tui` 适用于终端交互；二者不改变审批要求。一个 Pi runtime 下的不同 bridge 可以使用不同语言。memory/evolution 的 adapter 只在对应需求存在时选择，版本要能被工具链实际解析。

```yaml
runtime:
  kind: pi
  version: 0.4.0
  adapters:
    memory: none
    evolution: none
    ui: tui
    execution: extensions
```

v0.4 只定义 Pi 目标。runtime 版本必须进入 lock 和 BUILDINFO。Schema 中的 `default` 只是注解；normalize 阶段必须物化所有默认值。

### 5.2 Resources

resources 解决“事实与程序在哪里、允许怎样访问、包含什么等级的数据”。文件目录、知识存储、数据库连接、HTTP 服务和程序入口分别建模，便于同一资源复用和凭据隔离。只用用户当前输入的纯指导 Agent 可不配置 resources。单纯登记数据库不会自动生成查询工具，更不会让所有 seat 自动获得该连接。

```yaml
resources:
  - id: risk-db
    kind: database
    access: read_only
    locator: {connection_env: RISK_DB_URL}
    data_labels: [confidential, pii]
```

本地 resource 的 locator 只能使用相对路径或环境变量名；service 可以声明不含凭据的 endpoint。不得把凭据值写进 DSL。凭据只注入到显式依赖该 resource 的组件。

资源类型：`filesystem/knowledge/database/service/executable`。访问模式：`read_only/read_write/execute/invoke`。

数据标签：`public/internal/confidential/pii/secret`。memory、evolution、日志和最终输出必须遵守 gate 的数据规则。

## 6. 组件公共契约

组件是独立描述、复用与验证的能力单元。只有需要独立版本、权限边界、共享或契约测试时才拆分，不需要把每个自然语言步骤都变成组件。`source` 回答实现来自哪里，`spec` 回答提供什么，`requires` 回答需要谁，`effects` 回答自身动作需要哪类外部能力。

```yaml
components:
  - id: faq-answer-skill
    kind: skill
    version: 0.4.0
    source: {type: inline}
    spec:
      name: faq-answer
      description: 基于证据回答
      guide: 先检索，再回答。
    requires: []
    effects: []
    tests: [tests/faq-answer-skill.contract.yaml]
```

公共字段：

| 字段 | 要求 |
|---|---|
| `id` | Agent 内唯一、稳定 |
| `kind` | 九种 kind 之一 |
| `version` | SemVer |
| `source` | local / registry / inline 判别联合 |
| `spec` | 由 kind 决定的强类型对象 |
| `requires` | typed dependency；不得使用含义不明的自由字符串 |
| `effects` | 所需能力集合，可为空 |
| `tests` | 可选的组件测试入口 |

### 6.1 Source

以下是三个独立备选片段，实际组件只选择一种来源：

```yaml
source: {type: local, path: components/faq-bridge}
---
source: {type: registry, name: faq-tool, version: 1.2.0}
---
source: {type: inline}
```

- local 路径必须位于项目根内；resolve 后使用 canonical path 防止 `..` 和 symlink 逃逸。
- registry 必须指定精确版本。Alpha 阶段只定义结构，远程解析仍属实验能力。
- inline 内容直接位于强类型 `spec`，不再存在第二个 `inline` 字段，也不生成“匿名但又有 id”的矛盾模型。

### 6.2 Requires

```yaml
requires:
  - {type: bridge, ref: faq-bridge, action: doc_search}
  - {type: resource, ref: policy-documents}
  - {type: runtime, ref: workflow-core}
```

支持 `component/tool/bridge/skill/knowledge/resource/runtime`。所有引用在 link 阶段解析，缺失或歧义均为 error。

### 6.3 Effects

允许值：

```text
filesystem.read
filesystem.write
process.exec
network.egress
knowledge.candidate_write
artifact.write
external.write
```

effects 是集合，解决单值 `side_effect` 无法表示“写文件并通知外部”的问题。`readonly` 从 effects 和 resource access 推导，不再重复声明。

`effects` 描述直接动作：薄 tool wrapper 可为 `[]`，其 bridge 声明 `filesystem.read/process.exec`。运行时实际需求必须合并依赖闭包，不能因最外层 effects 为空就跳过 gate。也不要把副作用机械复制到每个 skill/workflow：阅读说明文本本身没有写文件副作用。具体枚举的用途和对应授权维度见[字段参考第 6.3 节](DSL_FIELD_REFERENCE.md)。

## 7. 九种组件

kind 表示职责，不是必装模块。以下各节说明建模决策；每个 spec 字段的类型、条件、默认值和校验阶段均在[字段参考第 7–15 节](DSL_FIELD_REFERENCE.md)给出。

| kind | 回答的问题 | 何时需要 | 何时可以省略 |
|---|---|---|---|
| tool | 模型可以调用什么接口？ | 要让模型发起受控操作 | 纯文本指导，不调用外部能力 |
| bridge | 操作如何获取事实或执行计算？ | tool 需要确定性实现，当前每个 tool 都必须绑定 bridge | 没有这类操作 |
| skill | 模型应采用什么方法完成任务？ | 方法需要明确、复用和版本化 | 方法足够短且已由角色/用户输入充分表达 |
| workflow | 当前在哪一步、什么事件允许推进？ | 需要状态、有限回退或人审 | 无强制阶段的开放式任务 |
| knowledge | 这项知识能力属于什么域、符合什么结构？ | 领域知识独立维护与复用 | 只读取普通资源或用户输入 |
| persona | 哪种席位角色要复用？ | 多席或跨 Agent 共用角色正文 | 一个短 seat.persona 足够 |
| gate | 哪组附加限制要随组件复用？ | 多处共享拒绝约束 | 顶层 gate 可直接描述全部边界 |
| output | 哪个交付物要被追踪和验证？ | 产物有稳定路径、生命周期或发布方式 | 临时文件，无治理需要 |
| review | 哪些机器检查决定交付质量？ | 需要结构、引用、事实或资产验收 | 简单自检指引足够且不声称强制质量门禁 |

### 7.1 tool

tool 是模型选择和调用的接口，必要性来自“模型必须触发一次外部操作”。例如搜索制度、查询字段口径、校验候选契约。它把参数结构、能力描述与底层实现隔开，使模型无需理解 shell、连接字符串或程序目录。

输入是模型提供的结构化参数；输出是符合 outputSchema 的结果。依赖至少包含与 binding 一致的 bridge action。`spec.name` 是模型调用名，`id` 是组件引用名。编译器负责核对绑定和 Schema；运行时负责校验真实参数、检查权限、调用 bridge 并验证结果。

不适用场景：解释“回答必须带出处”应写 skill，而不是创建一个没有确定性动作的工具；执行任意字符串命令也不宜包装成万能 tool。tool 的直接 effects 可为空，但其依赖动作仍受完整授权检查。常见错误是只写 `binding` 而漏 `requires`，或把“幂等”声明当作已经实现重试去重。

```yaml
- id: fq-tool
  kind: tool
  version: 0.4.0
  source: {type: inline}
  spec:
    name: fq_doc_search
    description: 制度章节检索
    inputSchema: {type: object}
    outputSchema: {type: object}
    binding: {bridge: faq-bridge, action: doc_search}
    phase: search
    execution: {timeout_seconds: 30, idempotent: true}
  requires:
    - {type: bridge, ref: faq-bridge, action: doc_search}
  effects: []
```

要求：

- tool name 遵守 `<prefix>_<action>`；
- input/output 必须是有效 JSON Schema；
- binding 必须与 requires 及 bridge actions 一致；
- bridge 返回值必须通过 outputSchema；
- 统一 envelope 至少包含 `status/summary/details`，错误可带 `error_kind/recovery_hint`。

### 7.2 bridge

bridge 是可测试的确定性业务执行体，将事实访问与模型判断分开。适用于数据库检索、代码索引、规则检测、格式转换、候选文件写入等。当前 tool 契约必须绑定 bridge，所以只要声明 tool，就至少需要一个对应 bridge。

输入来自受控 tool action 和参数，输出是单次结构化结果；资源与程序依赖显式写在 requires。编译阶段检查入口、语言、action 和依赖，运行阶段执行超时、最小环境变量注入、sandbox 和输出协议。输入输出对象的实际格式由 tool 和适配器契约约束。

`facts_only: true` 表示不调用 LLM，不等于不写文件；写 candidate 的 bridge 仍然可以 facts-only。外部源会变化，确定性是同一实现、参数和事实快照下的计算性质。需要开放式推理或文字生成时使用 skill/Agent 层。常见错误是同一个 bridge 混入只读查询、生产写入和外部发布，让只读调用继承过大的权限。

```yaml
- id: faq-bridge
  kind: bridge
  version: 0.4.0
  source: {type: local, path: components/faq-bridge}
  spec:
    name: faq_bridge
    runtime: python
    entrypoint: bridge.py
    facts_only: true
    actions: [doc_search]
  effects: [filesystem.read, process.exec]
```

bridge 禁止调用 LLM。实现必须单次输出一个 JSON envelope，stderr 用于诊断。进程必须受超时、最小环境变量注入和运行时 sandbox 约束。

不同权限边界的 action 应拆分到不同 bridge，避免只读 action 继承 candidate-write 或生产访问权。

### 7.3 skill

skill 是 LLM 操作说明，不拥有 phase 图：

当领域方法需要被明确传达、复用和版本化时使用，例如“先定位原文，区分原文与推断，再带出处回答”。它的输入是当前任务和可见上下文，产出是模型行为与回答，而非固定类型的函数返回值。依赖可列出所需 tool/knowledge，guide 是正文，references 是配套文件路径。

一个纯指导 Agent 可以以 skill 为唯一业务组件；但不是所有组件组合都必须带 skill。编译器将技能装入所选 seat 的上下文或技能资产，运行时由模型参考执行。它自己的直接 effects 通常为空，工具调用的副作用由依赖闭包承担。

不应把“必须批准后执行”“最多三轮”只写在 guardrails 然后声称已硬性保证；需要强制执行时用 workflow/gate。常见错误是复制 phases 到 guide 并让两处分别维护，或 tools 列表写了不存在、不可见的模型工具名。

```yaml
spec:
  name: faq-answer
  description: 制度问答引导
  guide: 检索后基于出处回答；未命中返回 unknown。
  tools: [fq_doc_search]
  guardrails: [同一工具连续三次失败即停止]
  references: [references/answer-contract.md]
```

### 7.4 workflow

workflow 是运行顺序、状态和人工闸门的唯一事实源：

当任务具有可观察的业务状态、审批或有限回退时使用，例如“探索 → 草拟 → 校验 → 人工交付”。输入是可信工具结果和交互事件，输出是状态变化、等待批准或完成/失败；依赖是阶段内需要的可见组件，归属由 seat 明确指定。

workflow 的必要性来自对执行过程的控制，而非步骤数量。一个十步但无需强制状态的指导也可以只用 skill；一个两步但第二步必须批准的操作则需要 workflow 和 gate。编译器验证图和引用，运行时保存当前阶段及循环计数，拦截未获批准的推进。图描述本身通常没有直接外部副作用。

不适用场景：将每次工具调用都机械变成 phase，或把 group.mode 当转移条件。常见错误是以 phases 数组顺序替代 transitions；只写 loop.when 文本就期望自动判断；将执行前审批放到已经发生动作的阶段末尾。loop 的触发、恢复和审批作用范围的实现边界见第 17.2 节。

```yaml
spec:
  name: faq-flow
  seat: default
  initial: search
  phases:
    - {id: search}
    - {id: answer}
  transitions:
    - {from: search, to: answer, on: tool_succeeded, tool: fq_doc_search}
  loops: []
  human_checkpoints: []
```

标准状态：

```text
idle → running → waiting_approval → running → completed
                   └──────────────→ canceled
running ──────────────────────────→ failed
```

规则：

- `initial/from/to/checkpoint.phase/tool.phase` 必须引用存在的 phase；
- transition `on` 是可执行事件；`when` 只是人读说明，不得当表达式执行；
- loop 必须有 `max_rounds` 硬上限；
- checkpoint 统一使用 `phase`，`required` 只能为 true，`approval` 必须为 `one_time`；
- 模型文本不能解除 checkpoint，必须由 runtime/UI 签发绑定 action digest 的一次性批准凭证。

### 7.5 knowledge

声明知识域、Schema 和可选 builder；Agent 级 `knowledge` 块管理生命周期。knowledge component 不授予写权。

当 FAQ、术语、字段契约、规则库等需要独立维护、装配或复用时使用。它的价值是让“领域知识”成为有版本的依赖，而不是把所有知识全文塞入 identity。输入是知识资产，输出是可供其他组件消费的领域内容或索引约定；数据读取通常由 bridge 实现。

`domain` 标识知识域，`schema` 描述条目结构，`builder` 指向可选构建程序。编译器收集和验证资产引用；运行时通过检索/消费组件读取，不因 knowledge 声明自动建立检索服务。资产读取可声明 filesystem.read；builder 引用本身不能获得 process.exec 权限。

没有独立知识资产时可省略，例如只解释用户粘贴的文本。常见错误是把资源位置写成 domain，或者以为 knowledge 组件就是长期 memory。前者应写 resource，后者是跨会话经验保留适配器。

```yaml
- id: faq-knowledge
  kind: knowledge
  source: {type: inline}
  version: 1.0.0
  effects: []
  spec: {domain: faq}
```

该最小组件只声明领域，不读取文件；实际资产使用时补充来源、Schema 或 resource 依赖。

### 7.6 persona

声明可复用 persona 的 `name/content`。seat 的 `persona` 与 `persona_ref` 必须严格二选一。

persona 表达某个 seat 的职责、视角和语言风格，例如查询员、候选维护者、事实审查员。多个 seat 或 Agent 共用且需要独立版本时值得拆组件；一个简单席位直接使用 `seat.persona` 即可。

输入是配置正文，输出是供模型使用的角色上下文，不产生事实或外部动作。name 是逻辑名称，content 是角色正文，seat 通过组件 id 引用。编译器解析 persona_ref 并装订角色文本；运行时在全局 identity 边界内使用它。直接 effects 一般为空。

不要用 persona 保存完整工作流、凭据或授权，也不要因为角色名叫“管理员”就扩大权限。常见错误是 persona_ref 和 persona 同时出现，或对全局不能执行的任务在席位角色中重新允诺。

```yaml
- id: evidence-reviewer
  kind: persona
  source: {type: inline}
  version: 1.0.0
  effects: []
  spec:
    name: evidence-reviewer
    content: 检查结论是否有证据支撑，并明确指出无法核实的部分。
```

### 7.7 gate

可复用 gate component 只能声明限制：bash deny preset、zero-access 路径、禁止数据标签。它不得携带 allow 规则。

当多个 Agent 共享同一套“禁安装、禁推送、禁访问 secrets”等边界时，用组件封装可减少重复。只有一个 Agent 的少量规则直接写顶层 gate 更简单。区别在于：顶层 gate 是必填授权上界，gate 组件是可选的附加拒绝包。

输入是限制集合，输出是合并进有效策略的拒绝规则；不是模型可调用工具。编译器记录规则来源并收窄策略，运行时每次授权时执行合并结果。组件自身不读取或写入业务资源，effects 通常为空。

常见错误是向 gate 组件添加 allow，或把它放入某 group 后假定已经具备独立 seat 策略作用域。当前规范不定义通用嵌套策略语言；局部隔离需要明确的运行时契约，不能靠组织标签推导。

```yaml
- id: protected-files
  kind: gate
  source: {type: inline}
  version: 1.0.0
  effects: []
  spec: {zero_access: [secrets/**]}
```

### 7.8 output

声明 `name/path/media_type/lifecycle/publish`。生命周期为 `ephemeral/draft/candidate/promoted`；发布方式为 `atomic_file/git_pr/webhook`。对应 effect 和 gate 授权仍必须成立。

当结果需要被交付、追踪、校验或晋级时使用，例如 Markdown 报告、候选 JSON 契约和审查附件。输入是生产者生成的内容，输出是可识别的产物描述和实际文件；它定义交付契约，但不替开发者实现生产逻辑。

编译器检查产物路径、生命周期和所需能力，运行时由生成/发布组件写入并校验结果。一般文件交付使用 artifact.write；外部发布还需要对应资源、网络/外部写权限及适配器。常见错误是只写 publish=webhook 就以为有了目标地址和鉴权，或将 lifecycle 改为 promoted 来绕过人审。

临时中间文件通常无需 output。正式文件先采用 atomic_file；PR/webhook 在 v0.4 只定义方式标签，其远端交付协议仍属于待实现能力。

```yaml
- id: report-output
  kind: output
  source: {type: inline}
  version: 1.0.0
  effects: [artifact.write]
  spec:
    name: evidence-report
    path: workspace/report.md
    media_type: text/markdown
    lifecycle: draft
    publish: atomic_file
```

该片段需要顶层 gate 允许产物路径及实际生产组件，不能单独代表可运行的报告生成器。

### 7.9 review

声明机器检查项及 `error/warn/info` 严重度。error 阻断对应 workflow transition；warn/info 只进入报告。

适用于要证明“结构有效、引用存在、事实有出处、资产完整”的交付过程。输入是待检查产物/事实上下文，输出是带检查项 id 和严重度的结果。与人工 checkpoint 的区别是：review 提供质量证据，checkpoint 提供真实批准，二者不能替代。

checks.kind 选择检查类别，checks.tool 可以绑定已声明的检查工具。编译器解析检查器并确定交付绑定，运行时执行检查并处理 error/warn/info。纯检查器自身可没有外部副作用，其工具/资源读取依赖仍须授权。

不应为每个简单回答都引入独立 review 组件；也不能把模型“我已核实”当作机器校验。常见错误是配置 custom 却没有可用执行器，或没有明确绑定产物和阶段就假定所有输出都会自动检查。当前代码生成尚未实现完整绑定，需显式确认适配器能力。

```yaml
- id: evidence-review
  kind: review
  source: {type: inline}
  version: 1.0.0
  effects: []
  spec:
    checks:
      - {id: source-present, kind: citations, severity: error}
```

最小结构可通过 Schema；运行时仍必须提供 citations 执行器和检查对象。

## 8. assembly 与 seats

### 8.1 Assembly

assembly 解决“哪些能力应一起提供”。例如查询 group 放查询工具和回答 skill，维护 group 放探索、候选生成、验证工具。group.mode 是集合用途标签，main/optional/fallback/review 不会自动调度或改变权限。

每个 Agent 至少一组。一个组件可被多组引用，其依赖只在 requires 中维护；重复放入组不会复制实例或扩大授权。数组先后也不代表调用顺序。

```yaml
assembly:
  groups:
    - id: faq-path
      components: [fq-tool, faq-bridge, faq-answer-skill, faq-flow]
      mode: main
```

assembly 只负责命名组件集合。它不含 `routes/checkpoints/seat`。依赖、运行顺序、人工闸门分别由 requires 和 workflow 声明。

### 8.2 Seats

seat 解决“谁以什么角色看到哪些能力”。同一 Agent 的只读查询者和候选维护者有不同的能力视图，因此适合拆席；仅输出风格略有不同可优先保留单席。每席 persona/ persona_ref 二选一，group 列表决定直接能力，requires 决定其依赖闭包。

`standard` 表示没有 read_only 这一额外限制，不能因此自动写文件。seat 是逻辑职责单位，不自动提供独立操作系统用户或进程隔离。需要真正隔离生产凭据和写能力时，应由运行时与部署环境一起完成。

```yaml
seats:
  - id: default
    persona: 你是制度问答席位。
    groups: [faq-path]
    mode: read_only
    coms: quiet
```

seat 只定义 persona、可见 group 和投影模式。`read_only` seat 暴露的依赖闭包不得含写类 effects。

## 9. Gate

gate 解决“无论模型选择什么动作，最终最多允许做什么”。它是每个 Agent 的必填配置。文件规则控制路径和删除；bash 控制执行入口及参数；egress 控制目的地；knowledge_write 限制候选写入；data 控制信息进入模型和最终输出。选择某 preset 需要实际 runtime 提供精确定义。

只读资源、只读 seat 和文件 deny 是不同层次：资源限制目标能力，seat 限制能力闭包，gate 限制实际动作，环境提供最终强制执行。不能认为 read_only 已自动脱敏，也不能认为 bash.deny_presets 中的 network 能拦截程序内部的一切网络连接。全部字段和 preset 用途见[字段参考第 18 节](DSL_FIELD_REFERENCE.md)。

```yaml
gate:
  default: deny
  filesystem:
    write_allow: []
    delete_rule: none
    param_check: true
    zero_access: [.env, secrets/**]
  bash:
    allow_presets: [readonly, python_tools]
    deny_presets: [network, install, git_push, rm_rf, inline_code, dangerous_git, production_write]
  egress:
    policy: deny_all
  data:
    deny_prompt_labels: [pii, secret]
    redact_output_labels: [pii, secret]
```

### 9.1 合并语义

- 所有 deny 和 zero-access 取并集；
- reusable gate 只能收紧；
- allow 必须同时被 Agent gate 和 environment gate 接受；
- component effect 不在有效授权中则 link error；
- 每项有效规则及来源写入 BUILDINFO。

### 9.2 强制要求

- 路径在 realpath/canonical path 后校验；
- shell 自定义正则是 escape hatch，结构化 preset 优先；
- egress whitelist 不得为空，`deny_all` 不得携带非空 allow；
- `production_write` 是合法 deny preset；
- `candidate_only` 的 paths 必须被 filesystem.write_allow 覆盖，反之不一定成立；
- gate extension、bridge sandbox、数据库只读凭据和环境网络策略必须共同执行。仅靠 Prompt 或 tool hook 不构成完整权限系统。

## 10. Knowledge 生命周期

顶层 knowledge 解决“整个 Agent 怎样管理知识资产”。它包含根目录、写入模式、候选前缀、晋级操作和引用治理。只有管理这类资产时才需要；普通文件读取可以只配置 resource 和 bridge。

knowledge component 是某个领域知识的版本化能力；顶层 knowledge 是这些资产的共同生命周期；gate.knowledge_write 是真正的写入边界。例如 contracts 组件规定字段契约结构，顶层知识目录组织 candidate 文件，gate 限制维护者只能写 candidate，独立人工命令负责 promote。

Schema 还保留 `workspace_only/free` 写入模式，但它们不授予越过 gate 的权限，也不取消正式晋级审批。当前实现尚未完整验证这类组合，使用时应以候选隔离为基线，而非通过宽松枚举推断授权。

```yaml
knowledge:
  root: knowledge
  lifecycle:
    agent_write: candidate_only
    candidate_prefix: candidate_
    promote:
      command: loom knowledge promote
      post_validate: true
    manifest: true
  citations:
    require_source: true
    drift_check: true
```

promote 命令必须被 Agent gate 拦截，只允许人在独立权限上下文中执行。manifest 至少记录文件摘要和 source revision。

## 11. 实验能力

### 11.1 memory

用途是跨会话保留经过筛选的偏好或可复用背景。知识库保存业务事实，memory 保存会话间需要延续的信息，两者不应混成原始工具结果归档。没有持续记忆需求时省略该块，adapter 保持 none；启用 openviking 时需解析服务配置、保留等级和输入数据过滤。

memory 是 runtime adapter，不是业务组件。使用时必须：

- `experimental_acknowledged: true`；
- runtime adapter 与 backend 一致；
- `capture_tool_results: false`；
- retention 只允许 `public/internal`，直到数据分类和脱敏实现完备。

### 11.2 evolution

用途是在重复任务中整理可能有用的方法改进，输出待审候选。它适用于已经具备轨迹治理和人工 review 的系统；对一次性任务通常没有必要。capture 的调用门槛、字符上限和候选数限制控制采集规模，不是要求 Agent 为满足指标额外调用工具。

evolution 默认关闭。开启时必须挂 `self-evolve` adapter、显式确认实验状态并配置人工 review。候选不得自动写回 components、identity、gate 或边界文件。

### 11.3 coms

用途是独立 Agent 之间会诊与产物指针交付，例如向技术专家询问代码事实。单一 Agent 的多 seat 能力视图不必默认转成分布式通信。project 提供消息命名空间，delivery 规定文件交接，auto_reply 表示回包偏好。实际发现、鉴权、去环和可靠投递需由通信适配器定义。

coms 仅传递消息和 artifact 指针，不能传递人工批准。未来通过 adapter 对齐标准任务生命周期；核心 DSL 不自研传输协议。

## 12. Launch 与 settings

launch 将同一清单投影为不同的具名入口，适用于“一键启动全部席位”或“只启动查询席”。`entries[].workflow` 引用具体 workflow 组件，`entries[].coms` 决定该入口是否启用通信。`base_flags` 是宿主参数而不是任意装载能力的后门，生成器应检查与配置冲突的参数。

settings 表达模型、主题和自动装载偏好。`model: null` 把模型选择交还宿主；省略 model 没有额外固定模型承诺；theme 由 UI 适配器解释；auto_load 的精确宿主映射尚需实现者明确。它们均不能修改 gate 的安全结论。完整配置见[字段参考第 23、24 节](DSL_FIELD_REFERENCE.md)。

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

每个 entry 必须在 `seat` 与 `seats: all` 中严格二选一。`workflow` 若存在，必须属于该 seat。入口名必须唯一。

## 13. 编译与产物

```text
parse/schema
  → resolve/lock
  → normalize/link
  → semantic/policy validate
  → codegen
  → verify/package
```

codegen 只能消费 Canonical Agent IR。完整职责见 [COMPILER_DESIGN.md](COMPILER_DESIGN.md)。

产物：

- 可运行 Pi bundle；
- `agent.lock`；
- `BUILDINFO.json`；
- `Smokefile`；
- 有效 gate 的机器数据和人读镜像。

## 14. 必须实现的语义校验

JSON Schema 之后，compiler 必须检查：

1. 所有 component/resource/group/seat id 及 launch entry name 在各自命名空间唯一；
2. requires、binding、group、seat 和 launch 的本地引用存在；consult 外部目标由启用的 coms adapter 解析；
3. tool binding action 存在于 bridge actions，且 requires 一致；
4. embedded input/output Schema 本身合法；
5. skill tools 在当前 seat 可见；
6. workflow phase 引用闭环且 initial 可达；
7. write/network/external effects 被 gate 和 environment 授权；
8. read-only seat 的传递依赖闭包无写类 effect；
9. identity.red_lines 的 enforced_by 引用存在；
10. knowledge candidate paths、output lifecycle 和人工 checkpoint 一致；
11. memory/evolution 不接收被 data gate 禁止的标签；
12. registry/runtime 精确版本和摘要进入 lock。

错误必须包含稳定 code、severity、JSON Pointer、message 和 remediation，例如：

```json
{
  "code": "LOOM-E-BINDING-001",
  "severity": "error",
  "path": "/components/0/spec/binding/action",
  "message": "bridge action does not exist",
  "remediation": "declare doc_search in faq-bridge.spec.actions"
}
```

## 15. MVP 边界

优先完成：

1. local/inline resolve；
2. Schema 与语义 validate；
3. capability lint 与 effective gate；
4. Canonical IR；
5. Pi codegen；
6. smoke、确定性构建和 BUILDINFO。

暂缓：多 runtime、通用策略表达式、完整远程 registry、自动 evolution、复杂多 Agent 网络和图形化编辑器。

## 16. 建模选择与典型组合

### 16.1 易混元素的选择规则

| 要表达的需求 | 使用位置 | 选择理由 |
|---|---|---|
| “你是制度顾问” | identity.role | 整个 Agent 的身份 |
| “这个席位专门找反例” | seat.persona 或 persona 组件 | 席位职责差异；需复用时才拆组件 |
| “先检索、再引用，不知道就说明” | skill.guide | 模型操作方法 |
| “检索接口接受 query，返回出处” | tool.spec | 模型调用契约 |
| “在制度目录执行索引检索” | bridge.spec + resource | 确定性程序和事实源 |
| “检索完成后才进入答复阶段” | workflow.transitions | 强制的阶段推进 |
| “把查询相关能力一起提供” | assembly.groups | 静态能力集合 |
| “查询者只能读，维护者可写候选” | seats + effects + gate + resource | 角色能力视图与实际授权要同时成立 |
| “契约条目遵守该 JSON Schema” | knowledge component | 领域知识的结构契约 |
| “候选目录不能覆盖正式知识” | 顶层 knowledge + gate.knowledge_write | 生命周期约定与可执行写入限制 |
| “复用全公司的 secrets 禁访规则” | gate component | 可装配的附加拒绝 |
| “报告是要交付的 Markdown 草稿” | output | 产物生命周期与格式 |
| “交付前检查每条引用” | review | 机器质量证据；需要可用检查器和绑定 |
| “人审后才执行下一步” | workflow checkpoint | 一次真实批准，不能用 review 成功代替 |

选择时先问业务上需要保证什么，再决定用哪个元素。要保证真实动作禁止发生，用 gate/环境；要保证阶段推进，用 workflow；要影响模型如何组织思考和语言，用 skill/persona。配置名字相近并不代表它们可互换。

### 16.2 模式一：纯指导 Agent

场景：解释用户粘贴的文本、帮助整理问题、提供某领域的思考方法，不读取外部系统。

最小业务能力是一个 inline skill，配合必填 metadata/identity/runtime/components/assembly/gate；需要启动时增加一个 seat 和 launch。gate 可设无文件写入、无命令允许、无出网。不需要 tool、bridge、knowledge、workflow 或 memory 来凑齐结构。

完整文件见 [guidance.agent.yaml](../../../examples/legacy/v0.4/guidance.agent.yaml)。其价值是证明“组件化”仍然可以简单起步；增加行为前先确认是否出现新的事实源、状态或权限需求。

### 16.3 模式二：只读事实查询

场景：制度问答、字段口径查询、代码事实检索。相较纯指导，增加 resource、bridge 和 tool，skill 说明如何使用证据。seat 使用 read_only，gate 禁写；若没有强制阶段要求，可以省略 workflow。

例子：[minimal-faq.agent.yaml](../../../examples/legacy/v0.4/minimal-faq.agent.yaml) 额外示范一个两阶段 workflow 和知识域组件。它是完整查询示例，不代表 FAQ 必须包含每一项。新系统可从上述更小组合开始。

只读不保证信息可随意进入模型；含 secret/PII 的事实源仍需 data gate。原文位置、版本和“没有命中”的行为应由返回契约明确。

### 16.4 模式三：受控操作流程

场景：先分析差异，经用户批准后生成工作区变更。增加 workflow，以准备、review、execute、verify 等业务阶段表达状态；在 review 离开前放 checkpoint，再进入实际执行阶段。工具 execution 描述单次超时和幂等性质，gate 限定路径和命令。

不应先执行写操作再等待阶段末尾批准；审批事项应与准备好的具体动作摘要绑定。需要持久恢复、重试或取消的部署还须实现运行时协议，不能只依靠 workflow YAML 声称已经可靠恢复。

### 16.5 模式四：候选知识沉淀

场景：探索数据和代码，生成字段契约 candidate，校验后交由人工晋级。

组合：只读资源与探索 bridge → candidate 写 bridge → tool 与 skill → 明确阶段的 workflow → 顶层 knowledge 生命周期与 gate.knowledge_write。需要追踪交付物时加入 output，需要机器验收时加入 review。正式 promote 在独立人工权限上下文执行。

先区分原始事实、模型建议与已批准知识。candidate 前缀只是命名约定，不能代替写路径控制和审批。校验器零错误只表明它检查的规则通过，不能自动证明业务结论正确。

### 16.6 模式五：多 seat 工作台

场景：查询席只读，维护席生成 candidate，审查席检查证据。将差异化能力放入不同 group，再由 seats 映射；不要在 group 中反向写 seat 或复制 workflow 路由。

例子：[data-asset.agent.yaml](../../../examples/legacy/v0.4/data-asset.agent.yaml)。其中 registry 来源和 coms 是实验展示，生产构建前需要可用适配器或改用项目内的实际组件实现。

选择多 seat 的理由应是职责或权限边界不同、能力集合显著不同，或有独立的审查责任。只是想把一个 prompt 拆短，通常先拆 skill。需要跨 Agent 会诊才引入 coms；seat 数量本身不是通信需求。

### 16.7 编写顺序

1. 写清业务目的、成功交付物及不可越过的边界。
2. 识别需要的事实源，登记 resource 及数据等级。
3. 为确定性动作编写 bridge，再为模型需要调用的动作声明 tool。
4. 用 skill 表达操作方法；确需强制状态时加入 workflow。
5. 用 group 组合能力，再按实际职责定义 seat。
6. 配置 gate，并检查每条路径的传递 effects 与资源权限。
7. 按需增加 knowledge 生命周期、output/review，再定义 launch。
8. 运行结构与语义检查，并核验当前工具链是否真正支持使用的运行能力。

## 17. 实现边界与可验证性

### 17.1 现有校验与运行契约

| 检查范围 | 当前仓库可验证的内容 | 实现者仍需完成的内容 |
|---|---|---|
| 结构 | 九种 kind、必填、枚举、联合互斥、未知字段、内嵌 tool Schema | 工具运行结果的实例校验 |
| 引用 | 大部分本地 component/resource/group/seat/launch/binding 引用 | 外部 consult、runtime 控制目录、所有执行器和引用文件存在性 |
| workflow | 阶段存在性、initial 可达性、工具事件引用、loop 上限结构 | 完成事件协议、审批令牌、循环触发、持久化恢复、取消和故障处理 |
| 权限 | 部分粗粒度 effect 与空授权冲突 | seat 可见闭包的完整校验、路径包含、symlink、命令参数、资源与环境求交、敏感数据流 |
| 构建 | 清单可解析及契约一致性 | resolve/lock、真实 codegen、构建摘要、runtime smoke |
| 文档 | 所有公开字段说明和字段参考覆盖 | 描述语义是否充分和业务建模是否合适的审查 |

因此 `npm test` 成功代表仓库内清单与规范检查通过；不代表业务 bridge 已实现、发布成功或所有安全要求已执行。主规范、字段参考和 Schema 共同构成契约，出现冲突时应修正规范并增加针对性检查。

### 17.2 尚需运行时契约明确的事项

以下是 v0.4 当前配置表达能力的边界，本轮说明不会擅自增加字段或默认值：

- **路径基准**：source.path、resource.locator.path 等项目路径明确要求项目根内解析；bridge.entrypoint、skill.references、knowledge.builder、tests 在 local/registry 组件内部相对组件根还是项目根，现有资料尚未完全统一。实现器必须固定并记录解析基准，不能依次尝试两个位置后静默选中一个。本地示例路径是说明用途，不能作为跨来源的隐式路径规则。
- **循环和完成事件**：loop 的 from/to/max_rounds 已定义，独立 loop 的触发方式、共享计数、终态完成、崩溃恢复和并发事件协议尚不完整。when 是说明文字，不足以填补这些协议。当前模板的事件和检查点约定是实现起点，不是已经运行验证的状态机。
- **review 绑定**：checks 定义检查种类和严重度，但没有独立 target/phase 字段。具体检查什么、何时阻断，必须由适配器或组件契约显式解决；不能默认扫描全部输出。
- **外部发布**：output.publish 声明方式，但 PR 仓库、webhook 地址、凭据、幂等和投递回执不在该 spec 内。没有完整适配器时应报告能力不支持，不能把文件生成当作发布成功。
- **可复用 gate 作用域**：只收窄原则明确，不能据 group 自动推导独立的 seat-local grant。实现独立隔离需要明确运行边界。
- **宽松结构值**：knowledge.lifecycle.agent_write=free、filesystem.delete_rule=free 在 Schema 中合法，但不是无限权限；仍接受生命周期、gate 和环境限制。
- **实验块参数**：memory 服务解析、evolution 捕获计量范围、coms 可靠投递和 auto_load 的宿主映射须由固定版本适配器定义。Schema 的合法枚举不是实现存在性的证明。

在实现编译器前优先补齐这些有实际需求的协议；无需为尚未使用的实验功能提前引入通用策略语言或复杂扩展系统。
