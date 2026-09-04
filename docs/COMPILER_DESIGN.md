# Agent Compiler Design（agen build pipeline）

> 目标：把 `agent-dsl/v1` 规范定义的**组件化智能体**，编译为可运行 bundle。
>
> 关键变化：
> - DSL 不再只是“描述 prompt”，而是“描述组件、组件组织层、工作流、边界、知识和产物”的装配清单
> - 编译器负责 resolve / validate / lint / link / codegen / package
> - 开发者负责业务组件本体与组件组织，平台只生成装订层与运行态骨架

---

## 1. 编译模型

```text
components + assembly + agent.yaml
        │
        ▼
  resolve → validate → lint → link → codegen → package
        │
        ▼
   dist/<agent-id>/
```

### 输入

- `agent.yaml`：装配清单
- `components/`：本地业务组件
- `registry/`：共享组件
- `runtime/`：平台资产（coms / workflow-core / gate engine 等）

### 输出

- 可运行 bundle
- `agent.lock`
- `BUILDINFO.json`
- `Smokefile`

---

## 2. 编译器的职责边界

### 平台负责

- 解析组件依赖
- 校验引用完整性
- 检查架构纪律
- 校验组件组织关系（assembly）
- 生成装订代码
- 生成入口和工作区骨架
- 生成 smoke test

### 开发者负责

- 写业务组件实现
- 写组件组织关系（assembly）
- 写 skill / workflow 说明
- 写 gate 的业务边界
- 写知识内容与 candidate 资产

### 平台不负责

- 不生成业务逻辑本体
- 不替代人工审批
- 不把文档内容或规则自动“猜出来”

---

## 3. 组件模型

组件是第一公民。

推荐组件类型：

- `tool`
- `bridge`
- `skill`
- `knowledge`
- `persona`
- `gate`
- `workflow`
- `output`
- `review`

每个组件至少要声明：

- `kind`
- `source`
- `version`
- `provides`
- `requires`
- `policy`
- `tests`（可选但建议）

---

## 4. 编译流水线

### 4.1 resolve

做依赖求解：
- 本地组件
- registry 组件
- `source: "inline:"` 的内联组件（归一为匿名组件）

产物：`agent.lock`

### 4.2 validate

只校验接口，不看实现细节：
- schema 正确
- 引用存在
- tool ↔ bridge 对得上
- skill ↔ tool 对得上
- seat ↔ persona / skill 对得上
- workflow phase 与 tool.phase 对得上
- assembly 的 entrypoints / groups / routes / checkpoints 结构合法

### 4.3 lint

做架构纪律检查：
- 红线必须有 gate 兜底
- facts_only 必须为真
- 命名要符合约定
- candidate 生命周期要一致
- 不能把凭据写进 DSL
- 不允许声明了 readonly=false 却没有写权限

### 4.4 link

把组件装配到 seat / workflow / gate / assembly：
- 按 seat 分组工具
- 按 assembly.groups 组织组件
- 绑定 assembly.routes
- 绑定 assembly.checkpoints
- 合并 gate 规则（安全语义固定）：
  - `deny` / `zero_access` 取**并集**——任何来源的禁止都生效，不可被任何声明移除
  - `write_allow` 取并集，但 agent.yaml 可**收窄**不可放大（宽进严出）
  - 合并后写放行与某组件声明的 `policy.side_effect` 矛盾 → error，不静默
  - 每条规则的来源组件记入 BUILDINFO（可审计）
- 冲突检测
- 生成 BUILDINFO provenance

### 4.5 codegen

只生成装订层，不生成业务逻辑：
- `.pi/APPEND_SYSTEM.md`
- `.pi/persona/*.md`
- `.pi/skills/*`
- `extensions/*-agent.ts`
- `extensions/*-gate.ts`
- `extensions/*-workflow-core.ts`
- `justfile`
- `.pi/settings.json`
- `.env.example`

### 4.6 package

产出 `dist/<agent-id>/`，附带：
- `agent.lock`
- `BUILDINFO.json`
- `Smokefile`

---

## 5. 归一规则（唯一的一条）

本规范是**全新 components-first 设计，没有 legacy 兼容层**：

- 一切能力声明都在 `components` 里（九种 kind）；
- 语法糖（seat 内联 `persona` 文本、`source: "inline:"` 的组件内容）由编译器展开为**匿名组件**；
- 同一能力被两个组件 provide（如同名 tool/skill）→ **编译期 error**，不静默选边；
- 组件声明冲突（如 readonly 与 gate 写放行矛盾）→ error。

编译器最终只面对一张图：**组件图 + assembly 组织关系 + Agent 级策略块**。

---

## 6. 规则建议

### 6.1 组件接口要显式

每个组件要声明：
- 提供什么
- 依赖什么
- 是否只读
- 有无副作用
- 写入路径是什么

### 6.2 组件组织要显式

除了组件本体，开发者还要把组件怎么组织说清楚：
- 主路径是什么
- 哪些是可选分支
- 哪些节点需要人工确认
- 哪些组件构成一个 seat 的完整工作流
- 哪些 routes 是主链路，哪些是 fallback

`assembly` 不是平台替开发者做决定，而是开发者把决定显式化，供编译器校验与落地。

### 6.3 业务逻辑不要被平台吞掉

- bridge 实现由开发者写
- skill guide 由开发者写
- gate 业务规则由开发者声明
- 平台只做合并、校验和装订

### 6.4 运行时资产要固定

像 `coms.ts`、`workflow-core`、`gate engine`、`openviking adapter` 这些应该视为平台 runtime 资产：
- 不进组件 registry
- 不由 DSL 生成
- 只 vendored / symlink / 固定版本分发

---

## 7. 最小实现建议

如果先做 MVP，我建议只实现这四个能力：

1. `validate`
2. `lint`
3. `codegen`
4. `smoke`

先不要急着做完整 registry / override / package 管理；先让“一个 agent.yaml 能被稳定编译成可运行 bundle”成立。

---

## 8. 结论

把 Agent 看成“组件化程序”之后，DSL 的职责就清楚了：

- 不是描述聊天风格
- 而是声明业务组件、组件组织和运行边界
- 编译器负责把声明变成可运行的智能体

这才是这个规范真正可维护的地方。
