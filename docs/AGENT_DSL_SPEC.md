# Loom Agent DSL 规范 v0.5

适用 API：`agent-dsl/v1alpha2`。本版包含破坏性结构调整，旧版资料见[迁移说明](MIGRATION_V0_4_TO_V0_5.md)和[v0.4 归档](archive/v0.4/AGENT_DSL_SPEC.md)。runtime.version 是独立宿主版本，不随本文件版本自动升级。

本文、[字段参考](DSL_FIELD_REFERENCE.md)、[依赖边界](DEPENDENCY_MODEL.md)和 [Schema](../schema/agent.schema.json)共同构成契约。冲突必须修正，不设隐式优先级。MUST 表示实现必须满足，SHOULD 表示建议，MAY 表示按需；不把规范要求等同于仓库已有运行引擎。

## 1. 先理解这个 Agent 如何完成业务

一个 Agent 为谁解决什么问题，接收什么任务，在什么环境中，使用哪些能力和资源，遵守哪些边界，按什么过程完成工作，与谁交互，交付什么结果，并用什么标准确认完成。

| 用户的问题 | 唯一声明面 | 说明 |
|---|---|---|
| 你是谁、职责是什么 | identity；按需 persona/任务角色 | 全局身份、复用岗位与任务分工不互相扩大边界 |
| 长期目标是什么 | metadata.purpose | Agent 的业务目的 |
| 这项业务目标是什么 | task.objective | 自然语言目标不等于可证明成功条件 |
| 能做什么 | components；task/role/seat 的能力选择 | 组件登记不自动全部暴露 |
| 输入是什么 | task.inputSchema | 不等于单次工具调用参数 |
| 结果是什么 | task.resultSchema、task.outputs | 业务结果与受管文件产物分开 |
| 谁触发 | 部署接入器选择 task | 对话、API、事件、定时器均须鉴权和输入映射 |
| 如何交互 | task.interaction | 允许追问或输入不合格即失败 |
| 在哪执行 | runtime、部署环境 | 宿主、适配器；隔离必须真实实现 |
| 需要什么资料 | resources、knowledge 组件 | 资源位置与业务知识结构分开 |
| 按什么方法和流程 | skill、workflow | 方法是软指导，流程是强制控制 |
| 谁负责哪部分 | task.roles；按需复用 seat | 单执行者不需要角色表 |
| 什么不能做 | identity.red_lines、gate、环境 | 文字与真正强制措施分开 |
| 如何评估 | 结果 Schema、task.acceptance → review | 默认结构校验，额外业务检查可选 |
| 如何告诉别人 | task.delivery、受信接入通道 | 返回调用方；外部发布另需明确执行器与权限 |
| 怎样判断结束 | workflow.terminal 或受信执行完成 | 完成执行后仍需验收及返回，不把三者混同 |

### 1.1 定义、执行与部署分开

- **Agent**：助手整体的身份、能力目录与边界。
- **task**：可反复调用的一类业务服务，不是待办步骤。
- **role**：一项协作任务内的职责分工，名字在任务内有效。
- **seat**：可跨任务复用的岗位身份与能力配置，不是员工实例、入口或安全沙箱。
- **run**：一次真实请求的执行记录，状态不回写 DSL。
- **部署绑定**：把对话、URL、消息或定时器映射到任务的环境配置，不属于业务流程图。

比如“制度差异分析”task 可以被反复调用；一个“制度顾问”seat 可以被问答、差异分析等任务复用。多种岗位都有能力办同一业务不等于一次任务由它们共同办理；协作必须通过 task.roles 和 workflow 明确分工与交接。

### 1.2 三种复杂度，按需选择

| 场景 | 最少配置 |
|---|---|
| 自由对话 | identity、能力、gate，以及显式 seat 自由对话入口；不要求 task |
| 一项明确业务 | task 直接选择能力，输入、结果、交互与返回；无需 seat/assembly |
| 专业岗位复用 | task.seat 引用岗位，多个任务复用同一配置 |
| 多角色协作 | task.roles + workflow，角色直接选能力或复用 seat |
| 能力包复用 | 有多个岗位共享能力时再加 assembly |

不要为简单任务凑齐九种组件或创建无意义的默认岗位。无 tasks 不表示已有任务级结果契约；没有能力选择不能回退到“全部组件”。

## 2. 每个结构的一句话说明

| 结构 | 用途 |
|---|---|
| apiVersion | 选择解释配置的语言规则 |
| kind | 声明这是 Agent 文档 |
| metadata | 登记名称、标识、版本和长期目的 |
| identity | 说明整体身份、职责及不可越过的业务边界 |
| runtime | 选择宿主和适配器 |
| resources | 登记资料、系统与程序的位置、访问模式和数据标签 |
| components | 登记能力、流程、知识及契约单元，不自动执行它们 |
| tasks | 定义对外业务的输入、结果、分工和验收 |
| seats | 复用岗位身份与能力配置，不反向登记任务 |
| assembly | 把经常一起使用的执行能力组成包 |
| gate | 限制实际动作，默认拒绝 |
| knowledge | 管理知识的候选、正式资产和来源追溯 |
| memory | 按需保留跨会话信息，实验能力 |
| evolution | 从经验生成待审核的改进候选，实验能力 |
| coms | 接入其他 Agent 的受信通信，实验能力 |
| launch | 启动宿主并选择 task 或自由对话 seat |
| settings | 模型、显示与加载偏好，不是授权 |

必填顶层块：apiVersion、kind、metadata、identity、runtime、components、gate。assembly、seats、tasks 均按实际需求配置；launch 是可启动入口契约，无入口的声明可以静态校验但不承诺默认启动。

## 3. 任务契约：task

task 的业务字段是 id、objective、inputSchema、resultSchema、interaction、delivery。额外验收 acceptance、文件 outputs 和 workflow 按需使用。具体字段、类型及默认值见[逐字段参考](DSL_FIELD_REFERENCE.md)。

执行配置严格三选一：

1. components：直接选择 skill/tool/bridge/knowledge 能力，继承 Agent identity。
2. seat：选择一个岗位；岗位的 persona 在 identity 内补充职责，不能覆盖红线。
3. roles：至少两个业务角色，每个角色有 id、responsibility，并在 seat/components 中二选一；必须配置 workflow。

单执行者角色槽位固定为 executor；多角色任务的 id 集合必须与 workflow.roles 完全相同。roles 是分工，不是动态路由或自动并发。

```yaml
tasks:
  - id: explain
    objective: 基于用户提供的材料解释问题
    components: [answer-skill]
    inputSchema:
      type: object
      required: [question]
      properties:
        question: {type: string, minLength: 1}
    resultSchema: {type: string}
    interaction: {mode: interactive, on_missing_input: ask}
    delivery: {mode: caller}
```

这是片段，需要完整组件及 Agent 根结构。完整最小例子见[纯指导任务](../examples/guidance.agent.yaml)。

### 3.1 输入、交互和返回

inputSchema/resultSchema 是独立 JSON Schema，可以为对象或布尔 Schema；工具有自己的 inputSchema/outputSchema。实例验证永远不能省略，true Schema 表示作者选择不限制结构，不表示权限放开。内嵌 Schema 使用 Draft 2020-12，支持其内部引用，不自动下载外部引用；format 在静态工具中按注解处理，不宣称已完成邮件、URI 等格式断言。不要把校验库额外的 lint 偏好当成 JSON Schema 语法要求。

interactive + ask 允许追问补齐输入；non_interactive 只能 fail。输入未通过前不执行业务副作用，修正后重新验证。ask 是同一请求的受信交互，不通过猜测补全重要参数。

delivery.mode 目前仅 caller：由接入器把结果返回原调用通道。调用人的身份和目的地来自鉴权上下文，不能信任输入中的“管理员”或模型生成的接收地址。调用者仍需获得访问任务和返回数据的权限；静态清单不是接入鉴权实现。

### 3.2 产物与验收

review 自身声明的 effects 也不能超出验收执行角色已选择能力的 effects；引用检查契约不是新增权限的通道。真实动作仍须经过 gate 与环境授权。

task.outputs 引用 output 组件 id；保留 result 表示整个任务业务结果，因此 output id 不得在任务 outputs 中使用 result。output 不反向依赖生产它的程序，实际内容和路径必须由生产能力与运行记录关联。

acceptance 每项有 review、target，可选 role。target 是 result 或该 task.outputs 中的 id。多角色任务必须显式给出 role，单执行者省略等同 executor；不合并全部角色权限执行检查。检查工具及依赖必须在对应角色能力闭包中。

验收固定在交付前，error 阻断交付，warn/info 记录；输入和结果结构校验始终执行。schema 类型检查 result 时使用 task.resultSchema；若目标是文件或其他检查类型，适配器须提供明确执行契约，缺失即报告能力不支持。不能把 review 名称当作检查器已经存在的证据。

验收只读取明确目标。检查报告及产物通过受信数据交接提供给检查上下文，文件访问仍需路径和数据授权；绑定 target 不授予任意文件读取权。读取权限、真实文件摘要及执行器装配必须由运行时验证。

## 4. 岗位、分组和角色各司其职

seat 是 Agent 级可复用岗位配置，含 persona/persona_ref 二选一、groups/components 二选一及 mode。standard 不授予写权；read_only 必须检查整个能力依赖闭包没有写类 effects。

assembly.groups 只包含 skill/tool/bridge/knowledge。它不包含 workflow、review、output、persona、gate，不嵌套其他 group，不定义流程或策略局部作用域。需要 persona 时由 seat.persona_ref 引用；检查与产物由 task 声明，流程由 task.workflow 引用。

task.roles 声明“本业务需要什么分工”；role.seat 表示“这项分工采用什么岗位配置”。task 一侧维护绑定，不存在 seat.tasks 或组件对 task/seat 的反向依赖。

| 制度修订中的对象 | 配置意义 |
|---|---|
| author 角色 | 此任务负责候选起草 |
| writer seat | 可复用的起草职责、检索与写候选能力 |
| reviewer 角色 | 此任务负责证据复核 |
| checker seat | 可复用的只读检查配置 |
| read-policy group | 两个岗位按需共享的查询能力包 |
| gate | 不论角色如何选择，都不得修改正式制度 |

同一 seat 被引用多次，只共享定义；run 内角色上下文独立。需要不同凭据、独立审查或进程隔离时必须由部署验证，不能仅靠角色名称证明。

## 5. 组件分类与依赖方向

组件是有 id、kind、version、source、spec 的声明单元。requires 是能力依赖目录；effects 是外部动作请求，不是授权；tests 是组件契约测试资产位置。id 引用组件对象，tool.spec.name 是模型调用名，两者不可混用。

| kind | 为什么存在、何时使用 | 不应承担什么 |
|---|---|---|
| skill | 可复用的模型操作方法；例如检索后按证据回答 | 强制审批、运行状态或权限 |
| tool | 具有参数结果契约的模型调用入口；绑定 bridge/action | task 输入输出、业务流程 |
| bridge | 执行确定性查询、计算、验证或受控写入 | 调度 task、调用上层工具、作模型判断 |
| knowledge | 可复用知识域及条目结构，按资源获取内容 | 全局存储政策、自动授权和长期记忆 |
| workflow | 有版本的阶段和角色槽位定义，控制交接和批准 | 固定某个 Agent seat 或把工具配置反向绑定 phase |
| persona | 多处需要复用的角色正文，简单时直接 seat.persona | 认证、权限或流程 |
| gate | 跨配置复用的附加禁止规则 | allow 授权或隐藏的局部策略 |
| output | 有位置、格式、生命周期的受管产物 | 生成程序、审批和送达回执 |
| review | 可执行质量检查及严重度 | 自动定位所有结果、代替人类批准 |

bridge.facts_only 表示执行确定性动作而非生成业务判断，不等于只读。生成的候选正文可以由模型提供，bridge 只负责按输入契约安全写入；写权限仍必须明确。

skill.tools、workflow.phases[].tools、review.checks[].tool 使用工具调用名，必须与 requires 的组件 id 边一致。tool.binding 需要完全一致的 bridge/action 依赖。generic component 引用不能绕过依赖白名单。

source 支持 inline/local/registry，registry 必须精确版本且仍需要 resolver 实现。组件资产路径：local/registry 的 entrypoint、references、schema、builder、tests 相对于解析后的组件根；inline 相对于项目根。resource 路径相对于项目根。解析后校验 canonical path，不依次尝试多个基准。所有 source 内容完整性由构建锁定，不由名字证明。

## 6. 流程：定义角色接口，不知道岗位

workflow 声明 roles、initial、terminal、phases。每个 phase 必须声明局部 role，可选 tools；没有 tools 表示该阶段不允许模型工具调用。task 负责把槽位绑定到执行配置，且每个阶段工具必须在绑定角色能力闭包中。

```yaml
spec:
  name: answer-flow
  roles: [executor]
  initial: search
  terminal: [answer]
  phases:
    - {id: search, role: executor, tools: [fq_doc_search]}
    - {id: answer, role: executor}
  transitions:
    - {from: search, to: answer, on: tool_succeeded, tool: fq_doc_search}
```

流程本身可以放在 components 中作为可版本化资产，但不能装入能力 group。只有需要强制阶段、交接或审批才使用；十步文字建议也可以只是 skill。

### 6.1 完成、事件与有界回退

- initial、terminal、转移端点和 checkpoint.phase 必须存在，阶段必须可从 initial 到达且能够到达成功终态。
- terminal 阶段仍需完成该阶段工作，不是进入即自动成功；受信 executor 发出 phase_completed 后才结束流程执行。之后继续任务结果校验和验收。
- 同一 from/on/tool 只允许一个目标，when 仅是人读解释，不作为条件表达式。
- tool_succeeded/tool_failed 必须指定源阶段允许的工具；其他事件禁止 tool。
- loops 不创造第二种转移：它以 from/to/on/tool 精确匹配一条 transitions 边，设置 max_rounds。
- 移除所有有次数上限的边后，阶段图必须无环，确保所有业务循环都受限。
- 次数按 run 和完整回边标识计数，恢复不能清零；达到上限后匹配该边的事件导致迭代上限失败，不静默绕过。
- manual 来自受信 UI/控制通道；业务程序返回文本不能伪造 manual、phase_completed 或 approval_granted。

### 6.2 人审与交接

checkpoint.phase 表示离开该阶段前等待真实人工批准；该阶段的所有出口必须是 approval_granted，不能另留未审批路径。审批绑定 run、当前阶段、待执行动作摘要及一次性凭证，过期或重放拒绝；批准不扩大 gate。

写动作应放在批准之后的阶段，不能先写再补审。terminal 阶段不允许设置出口批准闸门。拒绝审批和取消事件导致受信运行控制结束任务，不通过模型文本把结果标为成功。

跨角色交接仅传递明确阶段结果、产物引用和必要上下文，不合并历史对话或凭据。当前静态 Schema 不定义通用数据映射语言；运行时要提供固定交接信封、标签检查和审计，否则不能声称多角色协作已支持。

## 7. 资源与三种知识声明

| 声明 | 问题 | 制度助手的例子 |
|---|---|---|
| resources，含 kind=knowledge | 在哪里，如何访问 | 制度目录路径、只读、内部数据标签 |
| knowledge 组件 | 是什么知识，按什么结构组织 | 报销规则域，条目 Schema、生效日期 |
| 顶层 knowledge | 如何维护和晋级 | candidate 前缀、来源清单、人工 promote |

普通文件读取可以只有 resource + bridge，不必补 knowledge 组件。知识组件不会自动建立搜索服务；schema/builder 路径不是调用授权。顶层知识政策不决定工具注册，也不读取某个 task 来改变规则。

resource 支持 filesystem/knowledge/database/service/executable，access 支持 read_only/read_write/execute/invoke；枚举合法不代替资源 kind 与真实执行协议校验。凭据填环境变量名或无凭据端点，不写真实密钥；凭据仅交给显式依赖该资源的执行者。

knowledge 生命周期约束、resource 只读模式和 gate 写路径必须同时成立。free、workspace_only 等旧有结构值不等于取消 gate 或人审。正式知识晋级在独立的人类授权上下文执行；候选写入和人工确认不自动发布。

## 8. 权限是横向约束，不是反向依赖

有效动作需同时满足：声明的 effects、角色能力闭包、Agent gate、环境授权、资源模式、数据与生命周期限制；deny 优先。不能把自然语言 can 当授权，不能把 resource 登记当所有岗位可访问。

所有声明的 gate 组件作为全局附加拒绝包生效，不放入 group，不推断 seat-local 作用域。规则收窄后应重新检查已选择能力是否可执行；运行时仍按实际动作检查。

| 边界 | 强制位置 |
|---|---|
| 路径及符号链接逃逸 | 运行时 realpath 后与允许范围比较 |
| 命令及参数 | 结构化执行器、命令策略、进程隔离 |
| 网络目的地 | sandbox/环境网络策略，不只检查 shell 命令名 |
| 数据标签与脱敏 | 输入、工具返回、记忆、交接、日志和最终输出 |
| resource 只读 | 数据库只读凭据及资源执行适配器 |
| candidate 与正式晋级 | 路径、生命周期规则和独立人工权限 |

identity.red_lines.enforced_by 是控制存在性索引，不证明文字与控制语义等价；resource 不反向引用 gate，gate 不依赖 task。完整关系图和禁止引用见[依赖模型](DEPENDENCY_MODEL.md)。

## 9. 触发、运行记录与交付

task 是被调用的定义，不自动触发。接入器鉴权、选择 task、映射输入后，由运行时创建 run。聊天意图识别可以建议任务，但不能凭模型建议越权启动写操作。

最小请求信封由 task_id、request_id、input 构成；受信 identity 和回复通道不由业务 input 自报。task_id 必须可解析，调用者必须获准调用；request_id 用于关联，幂等仍需部署明确去重作用域、期限和结果重放规则，不能仅凭字段宣称已支持。

定时器的时间、时区、消息订阅及 URL 由部署绑定管理，本版不提供调度 DSL。adapter 启动时必须验证映射、输入契约及目标 task；不支持触发源则拒绝，不静默忽略。

运行记录分别保存 execution（运行/待输入/待审批/成功/失败/取消）、evaluation（未检查/通过/未通过）、delivery（未尝试/已接受/失败/未知）。具体宿主编码可映射，但不得把未知送达标为成功。任务结果交付前必须结构有效且无 error 验收；输出文件生成不等于外部发布。

output.publish 的 git_pr/webhook 仍是受适配器约束的方式标签，目标、凭据、幂等与回执必须完整配置于受信执行环境。没有可用契约时报告能力不支持，不能把 caller 返回当作 PR 已创建。

## 10. 编译、版本与实现状态

解析 → 版本选择 → Schema → 引用类别 → 静态 DAG → 能力闭包 → 角色接口 → 流程/验收 → 策略及环境 → 归一 IR → 构建与运行验证。

| 本仓库已静态检查 | 仍需运行时/构建实现 |
|---|---|
| 结构、内嵌 Schema、局部引用、id 唯一 | 来源解析、资产真实存在、版本与摘要锁定 |
| task 选择互斥、角色槽位、验收目标和检查能力 | 真实角色调度、隔离、交接、检查器执行 |
| 引用白名单、组件 DAG、只读闭包 | 路径、网络、资源与环境策略求交 |
| 事件、终态、有界回退、审批出口结构 | 可信事件、一次性批准、计数恢复和取消 |
| 文档字段覆盖、样例语法、任务实例测试 | 真正 codegen、smoke、交付回执与线上效果 |

当前检查器不证明任意业务目标已达成，也不证明已实现完整安全系统。错误含 code/path/message，规范要求构建或运行诊断进一步给出修复建议及关联 run。实现在能力不支持时必须明确失败。

memory/evolution/coms 仍属实验，相关块必须 experimental_acknowledged=true；registry 和扩展 kind 没有这个字段。配置合法不是适配器存在性的证明。evolution 只能输出待审下一版本候选，不在当前运行中改写依赖图和权限。

## 11. 配置顺序与完整示例

1. 明确身份、业务目的、结果及红线。
2. 登记资源，声明最小能力和依赖。
3. 声明 task 输入、结果和显式能力选择。
4. 有复用需求才抽 seat，有共享能力包才抽 assembly。
5. 有分工才加 roles，有强制流程才加 workflow。
6. 按需声明 output、review 并绑定验收执行角色。
7. 配置 gate、入口及部署能力，验证静态契约再做真实运行验证。

- [最小纯指导](../examples/guidance.agent.yaml)：一个 skill，一个 task，无 seat 和 assembly。
- [FAQ 岗位复用](../examples/minimal-faq.agent.yaml)：两项业务复用同一岗位及角色无关流程。
- [多角色候选维护](../examples/data-asset.agent.yaml)：起草与只读审查、候选产物、人审和有界回退。

样例中的程序、资源目录及宿主适配器需自行提供；它们是完整声明样例，不是开箱即用的业务部署。
