# Loom 编译器设计 v0.5

适用 v1alpha2；[主规范](AGENT_DSL_SPEC.md)、[依赖模型](DEPENDENCY_MODEL.md)、[字段参考](DSL_FIELD_REFERENCE.md)共同定义输入契约。本仓库提供 Schema 和静态一致性检查，不包含完整编译器或运行引擎。

## 1. 三种对象，不能混存

- Source Manifest：用户维护的静态 Agent、task、role、seat、组件、资源和策略。
- Canonical Agent IR：解析和绑定后的唯一代码生成输入，不写回用户清单。
- Run Record：某次调用的身份、输入、阶段、计数、审批、检查和返回状态，不作为静态依赖。

Agent 容器拥有顶层定义不等于它对每个对象存在执行依赖。task → role/seat → group → 能力 → 资源的选择图，与组件 requires 图一起形成静态依赖；禁止向上引用。策略是约束输入，不制造反向边。

## 2. 编译阶段

| 阶段 | 输入与工作 | 失败条件 |
|---|---|---|
| parse/version | 拒绝重复 YAML 键，选择 alpha1 历史或 alpha2 新契约 | 未知版本，不猜测旧字段 |
| schema | 校验强类型对象和内嵌任务/工具 Schema | 未知字段、互斥冲突、无效内嵌 Schema |
| resolve/lock | local/inline/可用 registry；固定 runtime 和组件版本、摘要 | 不存在、逃逸、不支持 resolver |
| link | 命名空间、kind 白名单、requires 与使用位置一致 | 未知引用、跨层引用、依赖环 |
| normalize | 物化 defaults，直接能力与 group 归一为同类闭包 | 不完整能力选择，不自动暴露全部组件 |
| task bind | 单执行者 executor 或 task.roles 精确匹配 workflow.roles | 槽位缺失/多余、阶段工具不可见、验收角色缺失 |
| workflow | 阶段、终态、可信事件、审批出口、有限回边 | 不可达、无终态路径、事件歧义、无界循环 |
| policy | effects、资源模式、gate、附加拒绝及环境限制 | 无授权、无法强制的安全要求 |
| codegen | 仅消费 IR，生成角色视图、调用绑定、策略装订与入口 | 不支持 adapter，不静默绕过能力 |
| verify/package | 检查器绑定、启动 smoke、BUILDINFO、产物摘要 | 构建验证或真实运行失败 |

本地资产基准固定：source.path 相对项目根；local/registry 组件的 entrypoint、references、schema、builder、tests 相对组件根；inline 组件资产相对项目根。resource 路径相对项目根。canonical path 必须留在指定根内。不要试两个根后择一成功。

## 3. IR 应记录什么

IR 不需要新增另一份公共 DSL，内部至少保留：

- manifest API、Agent/组件/runtime 版本和解析摘要；
- namespaces：task/component/resource/group/seat 的独立索引，tool name 的唯一索引；
- component DAG：类型化 requires 边及使用位置，便于完整环诊断；
- task binding：执行角色、岗位来源、能力闭包、workflow 槽位、产物和验收对象；
- effective policy：每条许可/拒绝的来源、资源限制与环境能力证明；
- artifact provenance：生产运行、路径、内容摘要与生命周期；
- launch mapping：入口仅选择 task 或自由对话 seat，不重复流程与角色配置。

保留用户提供的显式 id；摘要用于 provenance，不生成替代业务 id。不会因为一个组件被多个 group 引用就复制配置或增加权限。

## 4. 静态校验器的范围

scripts/validate-agent.mjs 在结构校验后返回 code/path/message。覆盖引用白名单、组件环、能力闭包、read_only、角色接口、流程结构、验收绑定和部分 effects/gate 冲突。它不访问真实业务文件、不获取凭据、不执行组件代码。

scripts/validate-schema.mjs 负责当前 Schema、三个完整样例、字段说明与 Markdown YAML 检查。tests/v05.test.mjs 构造有效清单及单项错误变体，并断言具体错误 code。scripts/validate-v04.mjs 独立测试历史 Schema、归档样例和旧负例，避免用新版本拒绝所有旧文件而产生虚假通过。

## 5. 运行时必须补齐的协议

### 接入和创建运行

adapter 鉴权、验证调用者可调用目标 task、映射业务输入，创建不可混淆的 run id。request_id 用于关联；幂等键的租户/任务作用域、保留期限与结果重放由部署明确，不把标识字段误称为幂等实现。

### 角色、事件和交接

每个 run/role 有独立逻辑上下文，不能因同一 seat 被复用就共享历史或凭据。阶段工具调用带 run、phase、role 和调用 id，结果只能驱动相应阶段。角色间传递受标签约束的阶段结果和产物引用，不暴露其他角色完整权限。

terminal 是完成阶段而非进入即成功。受信完成事件后运行 task.resultSchema 和 acceptance；多角色验收明确 role，使用其能力闭包，目标绑定不发放任意文件权限。

### 回退、恢复和批准

loop 给精确转移加持久计数，采用原子状态推进避免重复事件超出上限；耗尽即失败，不重置。checkpoint 凭证绑定具体动作摘要、run 和阶段，只消费一次；人类批准不扩大 gate。取消/故障终结与成功终态分开。

### 交付与质量

执行、验收和送达状态分别记录。caller 通道由鉴权上下文提供；外部 PR/webhook 需要明确执行契约和回执。检查失败不自动重做非幂等动作。内置 citations/facts/artifact 检查器、文件目标 schema 绑定若没有实现，必须报告不支持。

## 6. 安全与非目标

默认拒绝需要 gate extension、bridge sandbox、数据库凭据和网络策略共同强制。仅检查 effects、命令名或文本红线不能构成安全证明。正式 promote 在独立人工权限上下文执行；memory/evolution/coms 不反向修改当前任务定义。

本版不实现调度服务、通用表达式、并行角色调度、自动补偿、任意业务成功证明或自修改 Agent。代码生成与部署实现必须逐项声明支持能力，不能从 Schema 可接受推断能力可运行。
