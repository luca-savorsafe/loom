# Loom DSL 完整说明体系设计

## 1. 目标

把现有 Loom DSL 从“可校验的字段契约”扩充为同时服务以下两类读者的完整规范：

- DSL 配置编写者：能够判断该用哪个元素、是否必须配置、如何组合，以及常见错误；
- 编译器和运行时实现者：能够确定字段在哪个阶段生效、如何归一、需要执行哪些跨字段校验，以及失败时采取什么行为。

本次只增强说明体系和 Schema 文档元数据，不增加新的 DSL 能力，不改变现有有效清单的结构和语义。

## 2. 当前问题

当前 `AGENT_DSL_SPEC.md` 已定义核心原则和主要结构，但仍有以下缺口：

1. 顶层元素缺少统一的用途、必要性、生效阶段和适用场景说明；
2. 九种 component kind 的说明深度不一致，其中 knowledge、persona、gate、output、review 只有概括性描述；
3. 字段表只覆盖组件公共字段，没有覆盖所有嵌套配置；
4. 示例多为缩写片段，但缺少“为什么选它、不选相邻元素”的决策指导；
5. 编写者视角与实现者视角混在同一段落，不利于查阅；
6. JSON Schema 能验证结构，但多数公开字段没有足够的 `title/description`，编辑器无法提供有用提示；
7. 缺少文档覆盖检查，后续新增字段可能再次出现“Schema 已有、规范未解释”的漂移。

## 3. 采用方案

采用“主规范自包含 + 字段参考附录 + Schema 内嵌说明”的三层结构。

### 3.1 主规范

`docs/AGENT_DSL_SPEC.md` 继续作为规范入口，并保证单独阅读即可理解：

- DSL 的心智模型和执行生命周期；
- 顶层元素的职责、必要性与关系；
- 九种 component kind 的用途、边界、使用场景；
- 典型组合模式与选择规则；
- 规范性跨字段语义和错误处理。

主规范不重复罗列每个叶子字段的全部枚举细节，而是链接字段参考。

### 3.2 字段参考

新增 `docs/DSL_FIELD_REFERENCE.md`，作为逐字段查阅手册。它必须覆盖 JSON Schema 中所有公开配置字段，并明确：

| 维度 | 内容 |
|---|---|
| 路径 | 例如 `components[].spec.binding.bridge` |
| 类型 | string、integer、boolean、enum、array、object |
| 必要性 | 必填、条件必填、可选、实验 |
| 默认值 | 无默认值或 normalize 后默认值 |
| 用途 | 字段解决的问题 |
| 生效阶段 | parse、resolve、link、runtime、package |
| 约束 | 格式、范围、互斥、引用和安全限制 |
| 失败行为 | Schema error、lint error、runtime deny 等 |

字段参考按顶层块和 component kind 分节，不按 JSON Schema 内部 `$defs` 顺序机械展开。

### 3.3 JSON Schema 说明

为公开 object 和 property 补充简洁的 `title/description`，供 IDE、表单生成器和编译器诊断使用。Schema 描述只陈述机器相关事实，不复制长篇教程。

## 4. 必要性分级

所有顶层元素和 component kind 使用统一分级：

- **核心必填**：每个 Agent 都必须配置；
- **条件必填**：启用某种能力或引用关系时必须配置；
- **可选**：没有该需求时应省略；
- **实验**：结构已定义，但运行时能力不属于稳定承诺。

顶层元素分级如下：

| 元素 | 分级 | 用途摘要 |
|---|---|---|
| `apiVersion` | 核心必填 | 选择 DSL 语义版本 |
| `kind` | 核心必填 | 标识文档类型 |
| `metadata` | 核心必填 | 稳定身份、版本和归属信息 |
| `identity` | 核心必填 | 对外角色、能力声明和红线镜像 |
| `runtime` | 核心必填 | 指定执行目标和适配器 |
| `resources` | 条件必填 | 声明外部文件、知识、数据库、服务和程序 |
| `components` | 核心必填 | 声明业务能力单元 |
| `assembly` | 核心必填 | 将组件组成静态能力集合 |
| `seats` | 条件必填 | 需要运行入口或 workflow 归属时声明能力视图 |
| `gate` | 核心必填 | 定义 Agent 级权限上界 |
| `knowledge` | 条件必填 | 管理知识目录和 candidate 生命周期 |
| `memory` | 实验 | 配置跨会话记忆后端 |
| `evolution` | 实验 | 配置受控候选演化流程 |
| `coms` | 实验 | 配置 Agent 间消息交付 |
| `launch` | 条件必填 | 生成可启动 bundle 时定义入口 |
| `settings` | 可选 | 配置不改变业务语义的运行偏好 |

## 5. Component kind 说明模板

九种 kind 都按照同一结构扩写：

1. 一句话定义；
2. 为什么存在；
3. 必要性；
4. 典型使用场景；
5. 不应使用的场景；
6. 输入、输出和依赖；
7. `spec` 字段表；
8. effects 与授权关系；
9. 编译和运行时行为；
10. 最小合法示例；
11. 常见错误；
12. 与相邻 kind 的区别。

九种 kind 的定位如下：

| kind | 核心用途 | 必要性 | 典型场景 |
|---|---|---|---|
| `tool` | 暴露给模型的受控调用接口 | 条件必填 | 模型需要检索、计算、校验或提交候选动作 |
| `bridge` | 执行确定性业务逻辑和事实访问 | 条件必填 | 数据库查询、代码分析、规则计算、文件转换 |
| `skill` | 提供 LLM 操作方法和软约束 | 条件必填 | 多步骤分析方法、回答规范、领域操作手册 |
| `workflow` | 管理阶段、事件、循环和人工确认 | 条件必填 | 有明确状态、回退、审批或迭代上限的任务 |
| `knowledge` | 描述可装配知识域及其结构 | 可选 | FAQ、业务契约、术语库、规则库 |
| `persona` | 复用席位身份和表达方式 | 可选 | 多 seat 共享或版本化角色定义 |
| `gate` | 提供可复用的只减不增限制 | 可选 | 某组组件统一禁网、禁止生产目录或敏感标签 |
| `output` | 声明可追踪、可验证的正式产物 | 可选 | 报告、candidate、PR、Webhook 消息 |
| `review` | 声明机器可执行的质量检查 | 可选 | Schema、事实、引用和产物交付门禁 |

特别说明以下易混关系：

- tool 是模型接口，bridge 是确定性执行体；
- skill 是软引导，workflow 是可恢复状态机；
- component gate 只收窄，顶层 gate 才定义授权上界；
- knowledge component 描述知识能力，顶层 knowledge 管理 Agent 知识生命周期；
- persona component 用于复用，`seat.persona` 用于简单内联；
- output 描述需要生命周期和交付验证的产物，普通临时文件不必建模成 output；
- review 描述机器检查，不替代人工 checkpoint。

## 6. 顶层元素说明模板

每个顶层元素至少包含：

- 解决的问题；
- 是否必需及省略后果；
- 使用和不使用场景；
- 字段表；
- 所有权边界；
- 引用关系；
- 编译阶段行为；
- 最小示例；
- 常见错误。

对于 `resources/components/assembly/seats/gate/knowledge/launch`，还需给出跨字段闭环示例，而不是孤立片段。

## 7. 建模选择指南

主规范新增决策规则：

```text
模型需要主动调用吗？
  ├─ 否 → 可能只需要 skill / knowledge
  └─ 是 → tool
          └─ 是否需要确定性执行或外部事实？
               ├─ 是 → bridge + resource
               └─ 否 → 重新检查是否真的需要 tool

任务需要跨轮保存阶段、回退或审批吗？
  ├─ 否 → skill 通常足够
  └─ 是 → workflow

产物需要生命周期、发布或机器验收吗？
  ├─ 否 → 普通 workspace 文件
  └─ 是 → output + review（按需）
```

并覆盖以下组合场景：

1. 最小纯指导 Agent；
2. 只读事实查询 Agent；
3. 带 workflow 的受控操作 Agent；
4. candidate 知识沉淀 Agent；
5. 多 seat 协作 Agent。

## 8. 实现者视角

每个元素标明其生效阶段：

- parse/schema：类型、枚举、必填和局部互斥；
- resolve/lock：source、version、文件与 registry 摘要；
- normalize/link：默认值、引用、依赖闭包、seat 能力视图；
- semantic/policy：workflow 图、effect 授权、生命周期和红线闭环；
- runtime：tool 调用、bridge sandbox、gate、checkpoint、数据标签；
- package：launch、settings、lock、BUILDINFO 和输出摘要。

失败行为统一区分：

- 配置无法解释：编译期 error；
- 配置可解释但风险较高：lint warning 或 policy error；
- 动作未获授权：runtime deny，并记录审计事件；
- 实现返回不符合契约：tool/bridge contract error；
- 实验能力不可用：显式 capability error，不静默降级。

## 9. 一致性保障

扩展现有校验脚本，增加文档覆盖清单：

- 每个顶层 property 必须出现在字段参考；
- 每个 component kind 必须有独立章节；
- 每个 kind-specific `spec` property 必须出现在字段参考；
- Schema 中新增公开字段而文档未更新时，测试失败；
- 示例继续通过结构和语义校验；
- Draw.io 图按用户要求不在本轮修改。

文档覆盖检查采用显式字段路径清单，不开发通用文档生成器，避免为了文档同步引入新的复杂工具链。

## 10. 文件变更

- 扩写 `docs/AGENT_DSL_SPEC.md`；
- 新增 `docs/DSL_FIELD_REFERENCE.md`；
- 更新 `docs/README.md` 和根 `README.md` 导航；
- 为 `schema/agent.schema.json` 的公开元素补充说明元数据；
- 扩展 `scripts/validate-schema.mjs` 的文档覆盖检查；
- 必要时更新现有 YAML 示例中的注释或说明，但不改变有效语义；
- 不修改 `diagrams/`。

## 11. 验收标准

1. 配置编写者不阅读 JSON Schema，也能判断每个元素是否需要及如何使用；
2. 实现者能从规范确定每个字段的生效阶段、归一规则和失败行为；
3. 九种 component kind 均有完整且等深度的说明；
4. 字段参考覆盖全部公开顶层字段、公共组件字段及 kind-specific spec 字段；
5. 易混元素均有明确对比和选择规则；
6. 文档没有把实验能力描述为已稳定实现；
7. Schema、正例、负例和文档覆盖测试全部通过；
8. `git diff --check` 无错误，Draw.io 文件无变更，用户原有 `.gitignore` 修改保持不动。

## 12. 非目标

- 不在本轮新增 DSL 字段或 component kind；
- 不实现完整 `loom` 编译器或 runtime；
- 不开发自动文档生成网站；
- 不修改 Draw.io 图；
- 不为每一种业务领域分别设计专用 DSL。
