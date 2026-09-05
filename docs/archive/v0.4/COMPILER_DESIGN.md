# Loom Agent Compiler Design

> 状态：v0.4 / `agent-dsl/v1alpha1`
>
> 目标：把声明式 Agent 清单编译为可运行、可审计、可复现的 bundle。编译器只生成装订层，不生成业务逻辑。

## 1. 编译边界

输入包括根清单、组件源码、受信组件仓库与固定版本运行时；输出包括可运行 bundle、锁文件、构建证明与冒烟测试。

```text
agent.yaml + component sources + trusted runtime
                         │
                         ▼
 parse/schema → resolve/lock → normalize/link → semantic/policy validate
                         │
                         ▼
                 Canonical IR（唯一中间模型）
                         │
                         ▼
                 codegen → verify → package
```

所有后端只能读取 Canonical IR。禁止代码生成器重新解释原始 YAML，否则不同后端会产生不同语义。

平台负责解析、依赖锁定、语义校验、策略求值、装订代码、构建证明和 smoke test。开发者负责组件实现、工作流、业务边界和候选资产。平台不猜测缺失的业务逻辑，也不替代人工审批。

## 2. 阶段与产物

| 阶段 | 主要职责 | 产物 |
|---|---|---|
| parse/schema | YAML 解析、JSON Schema 校验、嵌套 tool schema 校验 | Parsed Manifest |
| resolve/lock | 解析 local/registry/inline 来源、校验摘要、固定版本 | `agent.lock` |
| normalize/link | 展开默认值与内联项、建立引用图、去除语法差异 | Canonical IR |
| semantic/policy validate | 跨引用、图、生命周期、授权和红线检查 | Diagnostics + Effective Policy |
| codegen | 仅从 IR 生成运行时装订层 | Staging Bundle |
| verify | 类型检查、单测、契约测试、smoke、安全断言 | Verification Report |
| package | 原子封装、生成摘要与 provenance | `dist/<agent-id>/` |

任何 `error` 都必须在 codegen 前终止。`warn` 不改变运行语义，并可由 CI 配置为失败。

## 3. Canonical IR

Canonical IR 是编译器内部唯一事实源，建议采用带版本的 JSON 数据结构：

```yaml
irVersion: loom.ir/v1alpha1
agent: {}
runtime: {}
resources: {}
components: {}
dependencyGraph: {}
groups: {}
seats: {}
workflows: {}
effectivePolicy: {}
knowledge: {}
launch: {}
provenance: {}
```

归一规则：

- 所有 map 按稳定 key 排序，数组保持规范定义的顺序语义；
- `inline` 组件保留显式组件 id；内容摘要用于锁定和追溯，不替换公开引用标识；
- 默认值在 IR 中显式展开；
- 所有引用转换为解析后的内部 id，不保留模糊名称；
- `requires` 是组件依赖边的唯一来源；
- workflow 是阶段、流转、循环和人工确认的唯一来源；
- gate 求值得到 `effectivePolicy`，后端不得自行合并权限；
- experimental 区块保持隔离，未启用适配器时不得影响稳定核心。

## 4. 解析与锁定

组件来源只有三种：

- `local`：工作区相对路径；
- `registry`：组件名与精确版本；
- `inline`：定义已位于清单的 `spec` 中。

`agent.lock` 至少记录：

```yaml
lockVersion: loom.lock/v1alpha1
compiler: 0.4.0
schema: agent-dsl/v1alpha1
runtime:
  name: pi
  version: 0.1.0
components:
  demo-tool:
    source: { type: local, path: components/demo-tool }
    digest: sha256:...
```

registry 解析必须固定到精确版本和不可变摘要。默认构建不允许从漂移的分支、`latest` 或未校验 URL 取组件。

## 5. 语义校验

JSON Schema 只检查结构。编译器还必须检查：

1. component、resource、group、seat id 在各自命名空间内唯一；所有 component kind 共用组件命名空间；
2. 所有引用存在且类型匹配；
3. tool binding 指向 bridge 已声明的 action，并与 `requires` 一致；
4. skill.tools 指向存在的 tool name；
5. workflow 的 initial、transition、loop、checkpoint 引用已声明 phase；
6. loop 有硬上限 `max_rounds`；
7. seat 引用的 group 和 persona 存在；
8. launch 引用有效，并且单席与多席配置互斥；
9. candidate 输出与 `knowledge_write.paths`、生命周期一致；
10. 每条结构化 red line 至少有一个可解析的 `enforced_by`；
11. effects 与最终授权相容；
12. 稳定字段不得依赖未启用的 experimental 能力。

诊断必须结构化并定位到源文件：

```json
{
  "code": "LOOM-E2204",
  "severity": "error",
  "path": "/components/2/spec/binding/action",
  "message": "bridge action 'query' does not exist",
  "related": ["/components/1/spec/actions"]
}
```

不要用静默覆盖、隐式降级或“选最后一个声明”解决冲突。

## 6. 权限求值

组件声明 `effects` 只是能力需求，不是授权。运行时权限按以下公式计算：

```text
effective = requested ∩ agent_grants ∩ environment_grants − denies
```

规则：

- 默认拒绝；
- deny 永远优先，不能被组件或 Agent 清单移除；
- `write_allow`、命令白名单和 egress 白名单是上界，不是建议；
- 环境可继续收窄，不能放大 Agent 权限；
- `facts_only: true` 是 bridge 的结构约束；
- 数据标签在进入 prompt 和输出前分别执行阻断或脱敏；
- tool 调用前检查 effect、资源、路径和参数，调用后记录结果摘要与审计事件。

策略冲突必须失败。例如组件请求 `network.egress`，但 egress 为 `deny_all`；或候选输出路径不在 gate 白名单内。

## 7. 代码生成

建议生成：

- `.pi/APPEND_SYSTEM.md`
- `.pi/persona/*.md`
- `.pi/skills/*`
- `extensions/*-agent.ts`
- `extensions/*-gate.ts`
- `extensions/*-workflow-core.ts`
- `.pi/settings.json`
- `.env.example`
- `Smokefile`

生成原则：

- 只生成装订层和适配器，不生成 bridge 业务逻辑；
- 输出路径固定且先写 staging，再原子替换；
- 相同 IR、编译器和运行时版本应得到相同摘要；
- generated 文件带来源和版本标记，但不嵌入密钥；
- 失败时不留下半成品 bundle。

## 8. 验证与构建证明

`verify` 至少覆盖：

- 生成代码类型检查；
- tool 输入/输出契约测试；
- bridge facts-only 与超时行为；
- workflow 正常、回退、循环上限和 checkpoint；
- gate 对未授权写入、命令、网络和敏感数据的拒绝；
- 最小启动与健康检查。

`BUILDINFO.json` 至少记录：

```json
{
  "compiler": "0.4.0",
  "schema": "agent-dsl/v1alpha1",
  "irDigest": "sha256:...",
  "lockDigest": "sha256:...",
  "runtime": {"name": "pi", "version": "0.1.0"},
  "effectivePolicyDigest": "sha256:...",
  "outputs": [{"path": "extensions/demo-agent.ts", "digest": "sha256:..."}],
  "verification": {"status": "passed"}
}
```

## 9. CLI 与 MVP

统一命令名为 `loom`：

```text
loom validate agent.yaml
loom lint agent.yaml
loom build agent.yaml
loom smoke dist/demo-agent
```

MVP 只实现：本地/内联组件、单 runtime、结构与语义校验、策略求值、确定性 codegen、smoke 和构建证明。registry、分布式通信、长期记忆、自动演化先保持 experimental，不进入主编译链。

## 10. 非目标

- 不做通用工作流编排平台；
- 不在 DSL 中嵌入任意脚本；
- 不允许 runtime 自行补全缺失依赖；
- 不以自然语言承诺替代可执行 gate；
- 不为假想后端提前抽象插件系统。

这条边界让 v0.4 足够完整，同时避免把第一版做成一个无法验证的“万能 Agent 操作系统”。
