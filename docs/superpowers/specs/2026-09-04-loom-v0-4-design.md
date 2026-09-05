# Loom v0.4 规范收敛设计

## 目标

在不改变 Loom「components-first + 编译式装配 + 硬边界」核心方向的前提下，把 v0.3 从概念规范收敛为可机器校验、可确定编译、可验证安全边界的 `v1alpha1` 契约。

## 设计决策

### 1. 一个事实只声明一次

- `component.requires` 只表达静态依赖。
- `assembly.groups` 只表达组件集合；不再表达运行顺序或人工确认点。
- `seat.groups` 是 seat 与 group 归属的唯一声明面。
- workflow 是 phase、transition、loop、人工确认点的唯一声明面。
- skill 只保存 LLM 操作指引，不声明或复制 workflow phase 图。
- launch 是启动入口的唯一声明面。

### 2. 组件采用按 kind 判别的强类型契约

组件公共字段为 `id/kind/source/version/spec/requires/effects/tests`。`spec` 由 `kind` 决定，Schema 使用 `oneOf + const` 校验。`tool` 必须有输入、输出 Schema 和 bridge binding；`bridge` 必须声明 actions 且 `facts_only: true`；其他 kind 也有最小可执行结构。

### 3. 权限需求与权限授予分离

组件的 `effects` 只声明所需副作用，不授予权限。Agent 级 `gate` 与运行环境提供授权上限，可复用 gate 组件只能进一步收紧。有效权限遵循：

```text
effective = requested ∩ agent_grants ∩ environment_grants − denies
```

任何未被授权的 effect 在 link 阶段报错。`readonly` 和单值 `side_effect` 被删除，避免重复与无法表达复合副作用。

### 4. 结构化控制替代自然语言猜测

`identity.red_lines` 改为带 `id/statement/enforced_by` 的对象。编译器只校验控制引用是否存在，不尝试理解自然语言是否等价。normalize 阶段为有效 gate 规则生成稳定内部 id，并将规则及来源写入 BUILDINFO。

### 5. Canonical Agent IR 是 codegen 的唯一输入

流水线调整为：

```text
parse/schema → resolve/lock → normalize/link → semantic/policy validate
→ codegen → verify/package
```

normalize 物化默认值并生成 Canonical Agent IR。codegen 不得再次读取并解释原始 YAML。BUILDINFO 记录 compiler/runtime/schema 版本、输入摘要、组件来源、有效策略和输出摘要。

### 6. 实验能力隔离

`memory/evolution/coms/registry` 保留设计，但在 `v1alpha1` 标注 experimental。稳定 MVP 只承诺 local/inline 组件、Pi runtime、tool/bridge/skill/workflow/knowledge/gate/seat/launch。`output/review/persona/gate` 组件仍有强类型 Schema，是否生成完整运行时代码由 compiler capability 决定。

## Workflow 运行语义

- workflow 必须声明非空 phases 和唯一 `initial`。
- transition 使用结构化 `on` 事件；`when` 仅为人读说明，不视为可执行条件。
- loop 必须有 `max_rounds` 硬上限。
- 人工确认点统一使用 `phase`，并产生 `waiting_approval` 状态。
- approval 必须由运行时生成的一次性批准凭证完成，普通模型文本不能解除闸门。
- 标准状态为 `idle/running/waiting_approval/completed/failed/canceled`。

## 安全边界

- gate 默认拒绝；Schema 默认值只作说明，normalize 必须写入实际默认值。
- 本地路径必须限制在项目根内并经过 canonical path 校验。
- shell 正则为 escape hatch；主授权通过结构化 preset 与受控工具完成。
- 远程数据库、API、webhook 等通过 `resources` 声明访问模式和 credential env 引用。
- 凭据只注入到声明依赖该 resource 的组件。
- memory/evolution 默认不捕获工具原始结果；数据分级与脱敏未实现前不得捕获 PII/secret。

## 兼容与版本

- 对外版本改为 `agent-dsl/v1alpha1`，规范文档版本为 v0.4。
- alpha 阶段不提供 v0.3 自动迁移器，只提供迁移说明和清晰错误。
- CLI 统一为 `loom`。
- registry source 必须包含精确版本；解析结果和内容摘要写入 `agent.lock`。

## 不在本轮范围

- 多 runtime codegen。
- 通用策略语言或自定义表达式执行器。
- 完整远程 registry、签名服务和 SAT 版本求解。
- 自动启用 evolution 产物。
- 自研 agent-to-agent 传输协议。

## 验收标准

1. 主规范、Schema、模板、示例使用同一字段名和 CLI 名。
2. 每种 component kind 都由 Schema 判别并校验最小契约。
3. 非法 checkpoint、非法 preset、缺少 tool binding、双 persona、空 whitelist 等被拒绝。
4. 示例不再重复声明 workflow 顺序，不再含跨 seat 的模糊 route。
5. Schema 自身、正例和负例进入自动校验脚本。
6. 文档明确区分已定义契约与尚未实现的 runtime 能力。
