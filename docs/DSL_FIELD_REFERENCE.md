# Loom DSL 字段参考 v0.5

适用 `agent-dsl/v1alpha2`。先读[主规范](AGENT_DSL_SPEC.md)理解任务闭环，再查本手册；引用白名单与图见[依赖模型](DEPENDENCY_MODEL.md)。本手册覆盖所有公开字段、数组和联合分支，不包括用户内嵌 JSON Schema 自定义的业务属性。

## 阅读约定

- 路径相对于章节对象，[] 表示数组成员；引用的对象在独立章节展开。
- 必填指父对象存在时不能省略；联合分支及业务能力可以增加条件必填要求。
- 默认 — 表示 Schema 未声明默认值，不等于 false、空集合或无限制。
- default 是 Schema 注解，由 normalize 物化；当前检查不修改清单。
- S＝结构校验，L＝解析/归一/链接，P＝策略，R＝运行，B＝构建；所有字段都受 S 检查，表中只强调后续用途。
- 未知字段拒绝；实验能力也要满足内部必填规则。字段合法不表示 adapter 已存在。
- id：小写字母起始，后续字母/数字/连字符。组件 id 与 tool.spec.name 的下划线调用名不是同一种引用。
- semver：三段数字及可选预发布后缀；当前不接受范围、latest 或 +build。
- relativePath：禁止绝对路径、~ 和 .. 路径段，运行时仍须检查 symlink。local/registry 组件资产相对组件根；inline 和 resource 路径相对项目根。
- envName：大写环境变量名，不填变量值或凭据。
- 可选 effects：filesystem.read、filesystem.write、process.exec、network.egress、knowledge.candidate_write、artifact.write、external.write。它们是动作请求，不是授权。
- allow presets：readonly、git_add_commit、python_tools、drawio、controlled_cli；deny presets：network、install、git_push、rm_rf、inline_code、dangerous_git、production_write。精确行为由固定版本 adapter 提供；名称不构成隔离证明。

## 1. 顶层 Agent

<!-- dsl-schema: root -->

面向任务的声明式 Agent：身份、显式能力、角色绑定、单向依赖和默认拒绝；不代表运行时已经实现。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| apiVersion | 固定 "agent-dsl/v1alpha2" | 必填 | — | L/B | 语言契约版本固定为 agent-dsl/v1alpha2；不接受旧版流程与岗位反向绑定。 |
| kind | 固定 "Agent" | 必填 | — | L/B | 根对象类型，固定为 Agent；与组件 kind 和资源 kind 属于不同命名空间。 |
| metadata | metadata | 必填 | — | L/B | Agent 身份、业务目的和发布版本，用于索引、产物命名和追溯。 |
| identity | identity | 必填 | — | L/B | 所有席位共享的角色说明、能力边界和结构化红线；文字不直接授予权限。 |
| runtime | runtime | 必填 | — | L/B | 选择 Pi 目标及固定版本适配器，用于生成装订代码与锁定运行条件。 |
| resources | array<resource> | 可选 | [] | L/B | 登记被组件访问的文件、知识、数据库、服务或程序；声明不会自动加载或授权。 |
| components | array<component>；最少项 1 | 必填 | — | L/B | 带 id、版本、来源的能力清单，按九种 kind 校验各自 spec。 |
| assembly | assembly | 可选 | — | L/B | 可选的共享能力包；只装 skill/tool/bridge/knowledge，无顺序、策略或角色绑定。 |
| seats | array<seat> | 可选 | [] | L/B | 可复用岗位配置目录；不反向登记任务，不自动构成进程或权限隔离。 |
| gate | gate | 必填 | — | L/B | Agent 权限上界，默认拒绝；与环境策略、资源访问模式和组件需求共同决定允许动作。 |
| knowledge | knowledge | 可选 | — | L/B | 统一知识根目录、候选写入和人工晋级约定；不等于某一个 knowledge 组件。 |
| memory | memory | 可选 | — | L/B | 跨会话记忆适配配置；无记忆需求时省略，并保持 runtime memory 为 none。 |
| evolution | evolution | 可选 | — | L/B | 从执行经验生成待审候选的配置；不允许自动改写正式能力或安全边界。 |
| coms | coms | 可选 | — | L/B | Agent 间会诊及文件交付配置；多 seat 本身不意味着必须启用通信。 |
| launch | launch | 可选 | — | L/B | 启动宿主并选择一个 task 或自由对话 seat；不创建定时器和外部订阅。 |
| settings | settings | 可选 | — | L/B | 模型、主题和加载偏好；不能覆盖 gate 或凭空引入未声明组件。 |
| tasks | array<task>；最少项 1 | 可选 | — | L/B | 可重复调用的业务任务目录，不是运行实例；任务输入、结果、执行配置及交付契约独立于工具。 |

## 2. 身份登记

<!-- dsl-schema: metadata -->

Agent 的稳定身份、业务目的、显示信息和独立发布版本。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| id | id | 必填 | — | L/B | Agent 稳定标识，供工作区、打包和审计引用；不要使用中文或下划线。 |
| name | string；最短 1 | 必填 | — | L/B | 人读名称，例如“制度问答助手”，用于展示而非引用解析。 |
| purpose | string；最短 1 | 必填 | — | L/B | 一句话说明业务任务及交付价值，区别于详细角色指令。 |
| version | semver | 必填 | — | L/B | Agent 清单的业务发布版本；修改语言版本应改 apiVersion。 |
| domain | string；最短 1 | 可选 | — | L/B | 业务域分类标签，例如 credit；不产生权限或知识域绑定。 |
| icon | string；最短 1 | 可选 | — | L/B | UI 图标提示；具体图标标识由 UI 适配器解释，Schema 不验证图标存在。 |
| color | string；pattern: `^#[0-9a-fA-F]{6}$` | 可选 | — | L/B | 展示色，六位十六进制；不接受颜色名称。 |
| team | relativePath | 可选 | — | L/B | 团队描述文件位置，用于组织上下文；文件内部格式不是本 DSL 定义，不能把它当作隐式授权。 |

## 3. 共享身份

<!-- dsl-schema: identity -->

全局业务角色、对外能力及可追溯红线的文字与控制引用。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| role | string；最短 1 | 必填 | — | P/R | Agent 全局业务身份与职责，进入共享角色上下文；避免把具体工具实现写在这里。 |
| red_lines | array<object>；最少项 1 | 必填 | — | P/R | 可追踪的不可越过边界集合；声明的控制须存在，但存在不代表自然语言语义已获证明。 |
| red_lines[].id | id | 必填 | — | P/R | 红线稳定标识，在当前 Agent 红线集合内唯一，用于审计定位。 |
| red_lines[].statement | string；最短 1 | 必填 | — | P/R | 对人解释禁止事项及原因；模型文本不构成强制机制。 |
| red_lines[].enforced_by | array<string；pattern: `^(?:gate\.[a-z0-9_.-]+&#124;resource:[a-z][a-z0-9-]*&#124;runtime:[a-z][a-z0-9-]*)$`>；最少项 1；唯一 | 必填 | — | P/R | 控制引用：gate.<section>、resource:<id> 或 runtime:<control-id>；运行时控制目录须由固定版本适配器提供。 |
| can | array<string；最短 1>；最少项 1 | 必填 | — | P/R | 能提供的业务服务，供用户和模型理解；不会自动授予外部动作权限。 |
| cannot | array<string；最短 1>；最少项 1 | 必填 | — | P/R | 明确不承接的任务或限制，补足角色边界，不能替代 gate。 |
| consult | object | 可选 | — | P/R | 需要其他 Agent 专长时的会诊指引；无协作需求可省略。 |
| consult.voice | string | 可选 | — | P/R | 会诊后如何以统一口吻向用户答复的软指引。 |
| consult.routes | array<object> | 可选 | — | P/R | 主题到外部目标的咨询映射；由通信适配器解析目标，不是 workflow 的执行路由。 |
| consult.routes[].topic | string；最短 1 | 必填 | — | P/R | 适合转交的业务主题，例如代码层事实；不是可执行条件表达式。 |
| consult.routes[].target | id | 必填 | — | P/R | 外部 Agent 标识；不要求等于本地 seat id，解析由启用的 coms 适配器负责。 |
| consult.unknown_policy | string；最短 1 | 可选 | — | P/R | 事实不足、目标不可用时如何说明未知、登记问题或交还用户。 |
| output_style | string | 可选 | — | P/R | 全局语言、引用与表达方式偏好；结构化产物契约另由 output 定义。 |

## 4. 运行宿主

<!-- dsl-schema: runtime -->

Pi 执行目标、固定运行版本和扩展适配器组合。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| kind | 固定 "pi" | 必填 | — | L/B/R | 当前仅定义 Pi 执行目标，决定生成代码后端；不表示宿主已安装。 |
| version | semver | 必填 | — | L/B/R | 固定宿主契约版本并进入 lock；示例版本不代表该版本运行时已发布。 |
| adapters | object | 必填 | — | L/B/R | 选择宿主扩展接口组合；不负责业务组件依赖。 |
| adapters.memory | 枚举 none / openviking | 可选 | "none" | L/B/R | 长期记忆适配器；memory.backend=openviking 时必须匹配。 |
| adapters.evolution | 枚举 none / self-evolve | 可选 | "none" | L/B/R | 候选经验生成适配器；evolution.enabled=true 时必须为 self-evolve。 |
| adapters.ui | 枚举 tui / headless | 必填 | — | L/B/R | 终端交互或无界面运行；headless 不自动批准人工 checkpoint。 |
| adapters.execution | 固定 "extensions" | 必填 | — | L/B/R | 通过 Pi extensions 装载执行能力，当前无其他后端。 |

## 5. 受控资源

<!-- dsl-schema: resource -->

组件显式依赖的外部事实或执行资源，包含定位、访问上界和数据标签。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| id | id | 必填 | — | L/P/R | 资源标识，在 resources 内唯一；用于 requires 和 resource:<id> 控制引用。 |
| kind | 枚举 filesystem / knowledge / database / service / executable | 必填 | — | L/P/R | filesystem＝普通目录文件；knowledge＝知识存储；database＝数据源；service＝服务端点；executable＝程序资源。 |
| access | 枚举 read_only / read_write / execute / invoke | 必填 | — | L/P/R | read_only＝只读；read_write＝资源可读写上界；execute＝执行程序；invoke＝调用服务，不等于无副作用。 |
| locator | object | 必填 | — | L/P/R | 资源定位方式，必须且只能出现 path/path_env/connection_env/endpoint 之一。 |
| locator.path | relativePath | 可选 | — | L/P/R | 项目内路径；解析后检查符号链接，不能指向项目外未授权位置。 |
| locator.path_env | envName | 可选 | — | L/P/R | 保存资源根路径的环境变量名，适用于不同部署的受管挂载；变量值仍须环境授权。 |
| locator.connection_env | envName | 可选 | — | L/P/R | 保存数据库等连接信息的变量名，不直接暴露连接字符串。 |
| locator.endpoint | string；最短 1 | 可选 | — | L/P/R | 不含凭据的服务地址；Schema 只验非空，协议、重定向和目的地由适配器/gate 校验。 |
| credential_env | envName | 可选 | — | L/P/R | 凭据变量名，仅注入显式依赖资源的执行组件；不写入 prompt 或构建产物。 |
| data_labels | array<枚举 public / internal / confidential / pii / secret>；唯一 | 可选 | [] | L/P/R | public/internal/confidential/pii/secret；表达数据分级，空数组表示未标注而不是已证明公开。 |

## 6. 组件来源

<!-- dsl-schema: componentSource -->

local、registry、inline 三种互斥来源；来源与业务能力契约分离。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| type | 枚举 local / registry / inline | 必填 | — | L/B | 选择互斥来源分支；local 适合项目实现，inline 适合小型纯声明，registry 适合版本化复用且仍属实验。 |
| path | relativePath | local 必填，其他禁止 | — | L/B | 本地组件目录，用于收集实现和资产；registry/inline 不接受此字段。 |
| name | id | registry 必填，其他禁止 | — | L/B | 注册包名；不是 tool 的模型调用名。local/inline 不接受此字段。 |
| version | semver | registry 必填，其他禁止 | — | L/B | 精确注册包版本，禁止漂移版本范围；解析后还应锁摘要。 |

## 7. 普通依赖

<!-- dsl-schema: simpleDependency -->

引用一个组件、资源或固定版本运行时能力；type 指定引用命名空间。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| type | 枚举 component / tool / skill / knowledge / resource / runtime | 必填 | — | L | 目标命名空间与 kind；component 通用引用也须经过源/目标 kind 白名单检查，不允许向上引用。 |
| ref | id | 必填 | — | L | 引用组件 id、资源 id 或运行时能力 id；type=tool 仍引用组件 id，不引用 spec.name。 |

## 8. bridge 动作依赖

<!-- dsl-schema: dependency -->

组件能力依赖的声明；bridge 分支精确声明 action，task/seat 组合引用不写回 requires。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| type | 固定 "bridge" | 必填，按联合分支 | — | L | 选择 bridge action 依赖；其他类型使用前述简单依赖，不携带 action。 |
| ref | id | 必填，按联合分支 | — | L | 目标 bridge 的组件 id；目标必须确为 bridge。 |
| action | actionName | 必填，按联合分支 | — | L | 需要的确定性操作，必须在目标 bridge.spec.actions 中声明。 |

## 9. 组件公共字段

<!-- dsl-schema: componentBase -->

所有九种组件共享的身份、来源、契约、依赖、直接能力需求和测试入口。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| id | id | 必填 | — | L/B | 清单内组件标识，各 kind 共用组件命名空间；binding、requires 和 group 通常引用此 id。 |
| kind | 枚举 tool / bridge / skill / workflow / knowledge / persona / gate / output / review | 必填 | — | L/B | tool/bridge/skill/workflow/knowledge/persona/gate/output/review；决定 spec 的结构与执行职责。 |
| version | semver | 必填 | — | L/B | 组件契约版本；registry 来源版本应一致，锁定文件另记录内容摘要。 |
| source | componentSource | 必填 | — | L/B | 组件来自项目目录、固定 registry 包或清单内声明；详见来源联合。 |
| description | string | 可选 | — | L/B | 给维护者看的说明；不同于 tool/skill.spec.description 面向模型的能力描述。 |
| spec | object | 必填 | — | L/B | kind 专属契约；不能把某 kind 的字段放到其他 kind，也不能任意增加实现参数。 |
| requires | array<dependency> | 可选 | [] | L/B | 组件能力依赖边的唯一来源；task/seat 的组合引用另行定义，数组顺序不是执行顺序，binding 必须匹配。 |
| effects | array<effect>；唯一 | 必填 | — | L/B | 组件直接动作所需能力；effects=[] 不消除依赖组件的副作用，授权必须检查传递依赖闭包。 |
| tests | array<relativePath>；最少项 1 | 可选 | — | L/B | 组件契约测试入口路径；具体执行器由工具链约定，Schema 不执行测试文件。 |

## 10. tool 模型接口

<!-- dsl-schema: toolSpec -->

<!-- dsl-kind: tool -->

模型可调用接口：描述何时调用、参数和结果契约，以及确定性 bridge 绑定。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| name | string；pattern: `^[a-z][a-z0-9_]*_[a-z0-9_]+$` | 必填 | — | L/R | 模型看到的调用名，例如 fq_doc_search；与组件 id 区别，供 skill.tools 和 transition.tool 引用。 |
| description | string；最短 1 | 必填 | — | L/R | 说明什么时候调用、解决什么问题及限制，供模型选择；避免泛化为“执行任何任务”。 |
| inputSchema | object | 必填 | — | L/R | 参数 JSON Schema；除检查对象类型外还须验证 Schema 本身，调用前验证实际参数。 |
| outputSchema | object | 必填 | — | L/R | 返回结果 JSON Schema；适配器在成功交付结果前验证输出，不能只验证输入。 |
| binding | object | 必填 | — | L/R | 显式绑定一个 bridge action；不接受任意命令字符串。 |
| binding.bridge | id | 必填 | — | L/R | 目标 bridge 组件 id，必须在 components 内存在且类型匹配。 |
| binding.action | actionName | 必填 | — | L/R | 目标动作名，与 bridge.actions 和 requires 中 action 一致。 |
| execution | object | 可选 | — | L/R | 单次执行约束；省略时使用受版本管理的宿主执行策略，不表示无限等待。 |
| execution.timeout_seconds | integer；下限 1；上限 3600 | 必填 | — | L/R | 单次调用时限，超时需终止或隔离执行并返回失败；不表示整个 workflow 总时长。 |
| execution.idempotent | boolean | 必填 | — | L/R | 声明相同请求重复执行是否安全；不是幂等实现，更不自动启用重试。 |

## 11. bridge 确定性执行

<!-- dsl-schema: bridgeSpec -->

<!-- dsl-kind: bridge -->

确定性事实访问和业务计算的执行模块，不调用 LLM，副作用仍须声明和授权。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| name | string；pattern: `^[a-z][a-z0-9_]*$` | 必填 | — | L/R | 执行模块逻辑名；binding 仍引用组件 id，不用该名称定位。 |
| runtime | 枚举 python / node / binary | 必填 | — | L/R | 执行体解释器或二进制类型；与 Agent 顶层 runtime.kind=pi 独立。 |
| entrypoint | relativePath | 必填 | — | L/R | 可执行实现入口；local/registry 相对组件根，inline 相对项目根；打包验证存在性和真实路径，不自动生成程序。 |
| facts_only | 固定 true | 必填 | — | L/R | 承诺只做确定性事实访问与业务计算，不调用 LLM；声明本身不能证明实现遵守，需要测试和隔离。 |
| actions | array<actionName>；最少项 1；唯一 | 必填 | — | L/R | 暴露的操作集合，供 tool binding 精确引用；数组顺序不表示调用顺序。 |

## 12. skill 操作方法

<!-- dsl-schema: skillSpec -->

<!-- dsl-kind: skill -->

供 LLM 使用的操作方法、工具引用与软约束，不提供强制阶段状态或授权。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| name | id | 必填 | — | L/R | 技能逻辑名，用于加载和展示；静态 requires 引用组件 id。 |
| description | string；最短 1 | 必填 | — | L/R | 说明适用任务和触发场景，帮助选择这项操作方法。 |
| guide | string；最短 1 | 必填 | — | L/R | 实际操作指引，如先检索证据再回答；是文本内容而不是待执行脚本或路径。 |
| tools | array<string；pattern: `^[a-z][a-z0-9_]*_[a-z0-9_]+$`>；唯一 | 可选 | — | L/R | 指引会使用的模型工具名；须存在并在实际任务执行角色的能力闭包中，不授予新的可见性。 |
| guardrails | array<string；最短 1> | 可选 | — | L/R | 操作注意事项和停止建议，属于软约束；强制限制放 gate/workflow。 |
| references | array<relativePath>；唯一 | 可选 | — | L/R | 配套参考文档位置，不是内嵌全文；适配器应核对存在性与访问范围。 |

## 13. workflow 流程接口

<!-- dsl-schema: workflowSpec -->

<!-- dsl-kind: workflow -->

可复用角色槽位与事件驱动阶段图；task 绑定岗位，工具不反向知道阶段。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| name | id | 必填 | — | L/R | 流程逻辑名，组件引用仍使用组件 id。 |
| initial | id | 必填 | — | L/R | 初始 phase，必须在 phases 中；phases 数组第一项不自动成为初态。 |
| widget | 枚举 single_line / panel / none | 可选 | "single_line" | L/R | 进度的单行、面板或隐藏展示，不改变执行语义。 |
| phases | array<object>；最少项 1 | 必填 | — | L/R | 阶段目录，用于状态定位；数组顺序本身不生成 transitions。 |
| phases[].id | id | 必填 | — | L/R | 同一 workflow 内唯一的阶段 id，供 initial/transition/loop/checkpoint 引用。 |
| phases[].description | string | 可选 | — | L/R | 阶段职责说明；不是自动完成条件。 |
| phases[].role | id | 必填 | — | L/R | 阶段执行角色，必须为本流程声明的局部槽位，不是 Agent seat id。 |
| phases[].tools | array<string；pattern: `^[a-z][a-z0-9_]*_[a-z0-9_]+$`>；唯一 | 可选 | [] | L/R | 此阶段允许调用的模型工具名；须在 requires 和绑定角色能力闭包中，省略表示不允许工具调用。 |
| transitions | array<transition> | 可选 | [] | L/R | 事件驱动的显式转移，含起点、终点、事件及可选 tool。 |
| loops | array<loop> | 可选 | [] | L/R | 回退/迭代的方向和硬次数上限；when 不可当作机器判断表达式。 |
| human_checkpoints | array<humanCheckpoint> | 可选 | [] | L/R | 必须等待真实人工批准的阶段闸门；无审批需求时省略。 |
| roles | array<id>；最少项 1；唯一 | 必填 | — | L/R | 流程局部角色槽位名；单执行者任务要求仅 executor，多角色任务须精确匹配角色集合。 |
| terminal | array<id>；最少项 1；唯一 | 必填 | — | L/R | 成功终态阶段集合；终态无外出边，完成后仍须结果校验和任务验收。 |

## 14. 可信事件转移

<!-- dsl-schema: transition -->

当前阶段在可信事件发生后转到目标阶段；when 仅作人读说明。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| from | id | 必填 | — | L/R | 转移起点，必须是当前流程内存在的阶段，运行时必须等于当前 phase。 |
| to | id | 必填 | — | L/R | 转移终点，必须在相同 workflow 中存在。 |
| on | 枚举 phase_completed / tool_succeeded / tool_failed / approval_granted / manual | 必填 | — | L/R | phase_completed/tool_succeeded/tool_failed/approval_granted/manual；事件来自可信执行或交互通道，不执行 when 文本。 |
| tool | string；pattern: `^[a-z][a-z0-9_]*_[a-z0-9_]+$` | 可选 | — | L/R | 绑定事件所属的模型工具名；其他事件不应配置此项。 |
| when | string | 可选 | — | L/R | 人读的业务原因或条件解释，不作为可执行表达式，不应据此触发转移。 |

## 15. 有界回边

<!-- dsl-schema: loop -->

给一个明确匹配 from/to/on/tool 的转移加次数上限；删除所有受限边后阶段图必须无环。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| from | id | 必填 | — | L/R | 回退起点，必须属于当前 workflow。 |
| to | id | 必填 | — | L/R | 重新进入的阶段；回边应与可解释的转移事件对应。 |
| max_rounds | integer；下限 1；上限 100 | 必填 | — | L/R | 该回边每次运行最多执行的次数，1 到 100；恢复必须保留计数，达到上限不能再推进该边。 |
| when | string；最短 1 | 可选 | — | L/R | 仅解释回退理由，不决定是否回退；机器触发使用 on 与可选 tool。 |
| on | 枚举 phase_completed / tool_succeeded / tool_failed / approval_granted / manual | 必填 | — | L/R | phase_completed/tool_succeeded/tool_failed/approval_granted/manual；事件来自可信执行或交互通道，不执行 when 文本。 |
| tool | string；pattern: `^[a-z][a-z0-9_]*_[a-z0-9_]+$` | 可选 | — | L/R | 绑定事件所属的模型工具名；其他事件不应配置此项。 |

## 16. 真实人工批准

<!-- dsl-schema: humanCheckpoint -->

阶段离开前等待一次真实人工批准的闸门，模型文本和 coms 消息不能替代批准。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| phase | id | 必填 | — | P/R | 需要等待批准的阶段；按当前模板在离开阶段前检查，不能保护已在阶段内发生的写入。 |
| required | 固定 true | 必填 | — | P/R | 此闸门不可由模型选择跳过；无需人审时应删除该 checkpoint 而非填 false。 |
| prompt | string；最短 1 | 必填 | — | P/R | 向审批人展示的批准事项、影响与证据；不要只写“继续吗”。 |
| approval | 固定 "one_time" | 必填 | — | P/R | 一次性批准，由运行时/UI 绑定待执行动作摘要；不能重放旧批准或接受 Agent 消息代批。 |
| action | id | 可选 | — | P/R | 批准事项的逻辑标识；当前未定义独立 action 注册表，不能擅自解释成 bridge action 或增加授权。 |

## 17. knowledge 知识域组件

<!-- dsl-schema: knowledgeSpec -->

<!-- dsl-kind: knowledge -->

可装配知识域的标识、结构 Schema 和可选构建入口，不自动提供检索或写权限。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| domain | id | 必填 | — | L/B/R | 该知识组件描述的领域标识，如 faq/contracts；不等于资源路径或数据库名。 |
| schema | relativePath | 可选 | — | L/B/R | 验证知识条目结构的 Schema 文件路径；有结构化资产时配置，纯文本知识可省略。 |
| builder | relativePath | 可选 | — | L/B/R | 构建或索引程序入口位置；引用本身不授予执行权，也不表示构建时自动运行。 |

## 18. persona 角色正文

<!-- dsl-schema: personaSpec -->

<!-- dsl-kind: persona -->

可复用的席位角色正文；全局 identity 和 gate 边界不能被其放宽。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| name | id | 必填 | — | L/R | persona 的逻辑名，用于展示和打包；seat.persona_ref 引用组件 id。 |
| content | string；最短 1 | 必填 | — | L/R | 席位职责、语气、专业视角和对外表达正文；不得放宽全局 identity 或 gate。 |

## 19. gate 附加拒绝组件

<!-- dsl-schema: gateRestrictionSpec -->

<!-- dsl-kind: gate -->

可复用的附加拒绝规则；不接受 allow，也不扩大 Agent 权限。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| bash_deny_presets | array<denyPreset>；最少项 1；唯一 | 可选 | — | P/R | 附加命令拒绝集合，与 Agent 及环境 deny 合并；network 仅表示命令层禁网规则。 |
| zero_access | array<string；最短 1>；最少项 1；唯一 | 可选 | — | P/R | 附加禁止读写的路径模式，与现有禁止范围取并集。 |
| deny_data_labels | array<枚举 confidential / pii / secret>；最少项 1；唯一 | 可选 | — | P/R | 附加禁止处理的数据标签，不能通过顶层 allow 抵消；具体处理通道由数据适配器落实。 |

## 20. output 受管产物

<!-- dsl-schema: outputSpec -->

<!-- dsl-kind: output -->

需要明确路径、格式、生命周期和发布方式的交付物声明。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| name | id | 必填 | — | P/B/R | 产物逻辑名，用于交付清单与审计；不是文件路径。 |
| path | relativePath | 必填 | — | P/B/R | 产物在受管工作区的路径，即使通过 PR/webhook 发布也需描述本地产物；必须被写权限覆盖。 |
| media_type | string；pattern: `^[^/]+/[^/]+$` | 必填 | — | P/B/R | 内容格式提示，例如 text/markdown、application/json；Schema 仅验证基本形式，不检查内容真实性。 |
| lifecycle | 枚举 ephemeral / draft / candidate / promoted | 必填 | — | P/B/R | 临时、草稿、待审候选或已晋级状态声明；标为 promoted 不会执行审批或晋级。 |
| publish | 枚举 atomic_file / git_pr / webhook | 必填 | — | P/B/R | 交付方式：原子文件、PR 或 webhook；后两者需要适配器与明确外部权限，当前 spec 未定义远端目标字段。 |

## 21. review 机器检查

<!-- dsl-schema: reviewSpec -->

<!-- dsl-kind: review -->

机器质量检查集合；执行器和交付绑定仍需实现适配器支持，不能代替人工批准。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| checks | array<object>；最少项 1 | 必填 | — | L/R | 机器检查集合，每项需指定检查类别与失败严重性。 |
| checks[].id | id | 必填 | — | L/R | 检查项稳定标识，便于报告定位和比较多次结果。 |
| checks[].kind | 枚举 schema / citations / facts / artifact / custom | 必填 | — | L/R | 分别检查结构、出处、事实、产物或自定义规则；不能仅凭名称推定执行器已安装。 |
| checks[].tool | string；pattern: `^[a-z][a-z0-9_]*_[a-z0-9_]+$` | 可选 | — | L/R | 承担检查的已声明工具；custom 等无内置执行器场景必须由适配器解析具体执行者。 |
| checks[].severity | 枚举 error / warn / info | 必填 | — | L/R | error 阻断相应交付/转移，warn 提醒，info 记录；严重度不产生执行授权。 |

## 22. 共享能力包

<!-- dsl-schema: assembly -->

只定义静态能力集合，由 seat 分配可见性，不定义执行顺序。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| groups | array<object>；最少项 1 | 必填 | — | L | 能力集合列表，至少一组；直接成员与依赖闭包需要分别理解。 |
| groups[].id | id | 必填 | — | L | group 标识，在 assembly 内唯一，供 seats[].groups 引用。 |
| groups[].components | array<id>；最少项 1；唯一 | 必填 | — | L | 静态能力成员，仅 skill/tool/bridge/knowledge；不包含 workflow/review/output/gate/persona 或其他 group。 |
| groups[].mode | 枚举 main / optional / fallback / review | 必填 | — | L | 集合业务用途标记：主能力、按需、备用、审查；不是调度器或路由条件。 |
| groups[].description | string | 可选 | — | L | 给维护者解释能力集合用途及边界。 |
| notes | array<string> | 可选 | — | L | 装配说明和审计备注，无可执行语义。 |

## 23. 可复用岗位

<!-- dsl-schema: seat -->

可跨任务复用的岗位身份、能力选择及只读限制；不是入口或运行实例。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| id | id | 必填 | — | L/P/R | 岗位稳定标识，在 seats 内唯一，供 task、任务角色或自由对话入口引用。 |
| name | string；最短 1 | 可选 | — | L/P/R | 人读席位名称，供 UI 展示。 |
| persona | string；最短 1 | 对应联合二选一 | — | L/P/R | 简单席位的内联角色正文，无需额外 persona 组件。 |
| persona_ref | id | 对应联合二选一 | — | L/P/R | 可复用 persona 的组件 id，目标 kind 必须为 persona。 |
| groups | array<id>；最少项 1；唯一 | 对应联合二选一 | — | L/P/R | 该 seat 使用的 group 集合；工具可见性和权限需求由集合与传递依赖解析。 |
| mode | 枚举 read_only / standard | 必填 | — | L/P/R | read_only 的依赖闭包不可含写 effect；standard 仅取消此额外限制，不授予写权。 |
| coms | 枚举 active / quiet | 可选 | — | L/P/R | 席位会诊参与偏好，不替代入口和顶层通信配置；省略时无 Schema 默认承诺。 |
| components | array<id>；最少项 1；唯一 | 对应联合二选一 | — | L/P/R | 直接选择 skill/tool/bridge/knowledge 的组件 id，与 groups 严格二选一；依赖闭包由 requires 展开。 |

## 24. Agent 授权上界

<!-- dsl-schema: gate -->

Agent 级默认拒绝策略上界，与资源和环境策略共同授权实际动作。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| default | 固定 "deny" | 必填 | — | P/R | 未获得明确授权时拒绝；不能因为 allow 数组为空就改为无限制。 |
| filesystem | object | 必填 | — | P/R | 文件写入、删除与绝对禁止访问范围。 |
| filesystem.write_allow | array<string；最短 1>；唯一 | 必填 | — | P/R | 允许写入路径模式；空数组禁止写入，匹配仍不能覆盖 zero_access。 |
| filesystem.delete_rule | 枚举 single_candidate_only / none / free | 必填 | — | P/R | 单个候选删除、禁止删除或无额外单候选限制；free 仍须满足路径和环境授权。 |
| filesystem.param_check | 固定 true | 必填 | — | P/R | 检查目标路径、参数、重定向和符号链接等；禁止关闭参数检查。 |
| filesystem.zero_access | array<string；最短 1>；唯一 | 可选 | — | P/R | 完全禁止读写的路径模式，优先于任何允许规则。 |
| bash | object | 必填 | — | P/R | 程序执行的允许、拒绝和安全替代提示规则，需与 sandbox 配合。 |
| bash.allow_presets | array<allowPreset>；唯一 | 必填 | — | P/R | 引用固定版本 runtime 提供的允许命令集，不是任意程序白名单。 |
| bash.allow | array<string；最短 1>；唯一 | 可选 | — | P/R | 自定义命令允许正则；表达灵活但风险较高，不能绕过参数与 deny 检查。 |
| bash.deny_presets | array<denyPreset>；唯一 | 必填 | — | P/R | 固定命令拒绝集，任何命中均优先拒绝。 |
| bash.deny | array<string；最短 1>；唯一 | 可选 | — | P/R | 自定义拒绝正则，与 preset 拒绝集合共同生效。 |
| bash.redirects | array<object> | 可选 | — | P/R | 为不适当命令提供受控工具替代指引；不是 shell 重定向执行许可。 |
| bash.redirects[].pattern | string；最短 1 | 必填 | — | P/R | 匹配需替代命令的正则，编译器/运行时必须检查正则有效性。 |
| bash.redirects[].message | string；最短 1 | 必填 | — | P/R | 告知为什么应使用受控工具的解释。 |
| bash.redirects[].use_tool | string；pattern: `^[a-z][a-z0-9_]*_[a-z0-9_]+$` | 可选 | — | P/R | 诊断提示中的替代工具名，只能建议当前执行角色可用的工具；不形成自动调用或新增授权。 |
| egress | egress | 必填 | — | P/R | 对外连接目的地策略；与 bash 禁网规则属于不同执行层。 |
| knowledge_write | object | 可选 | — | P/R | 对知识写入附加 candidate-only 限制；不单独提供文件写权。 |
| knowledge_write.mode | 固定 "candidate_only" | 必填 | — | P/R | Agent 只能写待审候选，正式 promote 由独立人工权限执行。 |
| knowledge_write.paths | array<string；最短 1>；最少项 1；唯一 | 必填 | — | P/R | 允许候选路径模式，须同时被 filesystem.write_allow 覆盖。 |
| data | object | 可选 | — | P/R | prompt 输入阻断和输出脱敏规则；未配置不代表数据已脱敏。 |
| data.deny_prompt_labels | array<枚举 confidential / pii / secret>；唯一 | 可选 | — | P/R | 不得进入模型上下文的数据标签，必须在构造 prompt 前执行。 |
| data.redact_output_labels | array<枚举 confidential / pii / secret>；唯一 | 可选 | — | P/R | 输出前需要脱敏的标签；日志、记忆和衍生产物也不能旁路此限制。 |

## 25. 网络目的地规则

<!-- dsl-schema: egress -->

拒绝全部或仅允许非空白名单目的地的互斥出网配置。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| policy | 枚举 deny_all / whitelist | 必填 | — | P/R | deny_all 禁止对外连接；whitelist 只允许明确目的地，并仍接受环境进一步收窄。 |
| allow | array<非空 string>；whitelist 唯一且非空；deny_all 只能空 | whitelist 必填；deny_all 可省略 | — | P/R | 受控目的地或 resource:<id> 引用，禁止空白名单假装已授权；字符串语法细化由适配器负责。 |

## 26. 知识生命周期

<!-- dsl-schema: knowledge -->

Agent 级知识资产根目录、候选生命周期和来源检查约定。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| root | relativePath | 必填 | — | P/R | 统一知识资产根目录；不自动创建目录或授予写入权限。 |
| lifecycle | object | 必填 | — | P/R | Agent 生成和治理知识资产的生命周期约定。 |
| lifecycle.agent_write | 枚举 candidate_only / workspace_only / free | 必填 | — | P/R | candidate_only 表示候选资产；workspace_only 表示仅工作区草稿；free 是 Schema 保留的宽松声明，仍不可越过 gate 或批准要求。 |
| lifecycle.candidate_prefix | string；最短 1 | 必填 | — | P/R | 候选文件识别前缀，如 candidate_；当前 Schema 即使 workspace_only 也要求填写。 |
| lifecycle.promote | object | 可选 | — | P/R | 面向人工的正式晋级操作约定；不是自动执行 hook。 |
| lifecycle.promote.command | string；最短 1 | 必填 | — | P/R | 人工可执行的晋级命令描述；不能据此给 Agent 开放 shell 权限。 |
| lifecycle.promote.post_validate | boolean | 必填 | — | P/R | 晋级后是否要求校验；false 只是结构允许，正式资产推荐开启并由人工工具落实。 |
| lifecycle.manifest | boolean | 必填 | — | P/R | 是否记录资产清单和来源摘要；false 不代表不需要构建 provenance。 |
| citations | object | 可选 | — | P/R | 来源与版本漂移检查配置，事实型知识建议开启。 |
| citations.require_source | boolean | 必填 | — | P/R | 是否要求引用携带来源；真实来源存在性需检查器验证。 |
| citations.drift_check | boolean | 必填 | — | P/R | 是否检查引用与源版本发生漂移；开启需要可解析的来源版本信息。 |

## 27. 实验性长期记忆

<!-- dsl-schema: memory -->

实验性跨会话记忆配置，禁止原样捕获工具结果，仅允许指定低敏等级保留。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| backend | 枚举 none / openviking | 必填 | — | P/R | 选择关闭或 OpenViking 后端；openviking 要求 runtime.adapters.memory 匹配。 |
| experimental_acknowledged | 固定 true | 必填 | — | P/R | 明确采用实验能力，不代表服务已可用或隐私控制已验证。 |
| server_env | envName | 可选 | — | P/R | 记忆服务地址的环境变量名；Schema 未要求 openviking 时必须填写，适配器须解决配置。 |
| capture_tool_results | 固定 false | 可选 | — | P/R | 显式禁止捕获工具原始结果；省略也不能被适配器解释为允许原样保存。 |
| retention_labels | array<枚举 public / internal>；唯一 | 可选 | — | P/R | 允许保留的数据等级；未填写时没有 Schema 默认清单，不应自动保留全部数据。 |

## 28. 实验性改进候选

<!-- dsl-schema: evolution -->

实验性经验候选提取及人工审核配置，不自动修改正式运行资产。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| enabled | boolean | 必填 | — | P/R | 是否启用候选演化；true 时要求 self-evolve adapter 且必须配置 review。 |
| experimental_acknowledged | 固定 true | 必填 | — | P/R | 显式确认实验能力，和 enabled 的开关含义独立。 |
| capture | object | 可选 | — | P/R | 可参与候选提取的轨迹规模限制；省略时具体行为由固定版本适配器确定。 |
| capture.min_tool_calls | integer；下限 1 | 必填 | — | P/R | 一条轨迹具备候选提取资格的最少工具调用数，不是强制调用工具次数。 |
| capture.max_trace_chars | integer；下限 0 | 必填 | — | P/R | 捕获轨迹字符上限；0 不应被当作无限制。 |
| capture.max_candidates | integer；下限 1 | 必填 | — | P/R | 候选数量上限；按轮还是按会话计量必须由适配器文档明确。 |
| capture.incremental | 固定 true | 必填 | — | P/R | 采用增量候选提取，不能整库替换正式知识；去重协议由适配器实现。 |
| review | object | 可选 | — | P/R | 人工审核候选的入口与检查项。 |
| review.trigger | 枚举 manual / pr | 必填 | — | P/R | 通过人工命令或 PR 评审，不是自动接受候选。 |
| review.checks | array<枚举 format / dedup / value>；最少项 1；唯一 | 必填 | — | P/R | 格式、重复性和价值检查选择；不代表每个选择已有实现。 |

## 29. 实验性跨 Agent 通信

<!-- dsl-schema: coms -->

实验性 Agent 会诊和文件交付配置，不能传递人工批准。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| project | id | 必填 | — | L/R | 通信项目命名空间，减少不同工作区消息混淆；不等于对方鉴权凭据。 |
| experimental_acknowledged | 固定 true | 必填 | — | L/R | 确认通信适配仍属实验。 |
| auto_reply | boolean | 可选 | true | L/R | 是否由适配器自动回包；去环、投递语义和重试仍需明确协议。 |
| delivery | 固定 "filesystem" | 必填 | — | L/R | 当前产物交接采用文件系统；不能据此推定跨主机文件已经同步。 |
| human_gates_via_coms | 固定 false | 必填 | — | L/R | 禁止将普通 Agent 消息作为人工闸门批准。 |

## 30. 启动入口

<!-- dsl-schema: launch -->

具名 Pi 启动入口、共同参数、seat/workflow 选择和通信开关。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| binary | 固定 "pi" | 必填 | — | L/B/R | 启动程序固定为 Pi，与 runtime 目标一致。 |
| base_flags | array<string>；唯一 | 必填 | — | L/B/R | 所有入口共享的宿主参数；参数语义和与生成配置的冲突由运行时版本及编译器检查。 |
| entries | array<object>；最少项 1 | 必填 | — | L/B/R | 具名启动方式列表。 |
| entries[].name | id | 必填 | — | L/B/R | 启动入口的唯一名称，用于命令选择与审计定位。 |
| entries[].task | id | 严格二选一 | — | L/B/R | 任务 id，与 seat 二选一；执行配置由任务解析，不允许入口覆盖角色或流程。 |
| entries[].seat | id | 严格二选一 | — | L/B/R | 自由对话使用的岗位 id，与 task 二选一；无任务入口时不承诺任务输入结果契约。 |
| entries[].coms | boolean | 必填 | — | L/B/R | 此入口是否启用外部 Agent 通信；true 必须有顶层 coms 配置。 |

## 31. 运行偏好

<!-- dsl-schema: settings -->

模型、主题与加载偏好，不能越过声明的能力和安全边界。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| model | string,null | 可选 | — | B/R | 具体模型标识或 null 表示交由宿主配置；可用性由环境检查，Schema 不枚举供应商模型。 |
| theme | string | 可选 | — | B/R | UI 主题偏好；headless 下不影响任务语义，主题名由 UI 解释。 |
| auto_load | boolean | 可选 | — | B/R | 生成产物的自动装载偏好；当前未细化与宿主各类扫描开关的映射，不允许因此突破声明的能力边界。 |

## 32. 任务内部分工

<!-- dsl-schema: taskRole -->

一次业务所需的分工定义；每次运行创建独立角色上下文。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| id | id | 必填 | — | L/P/R | 任务局部角色 id，与 workflow 槽位匹配，不与全局 seat 混用。 |
| responsibility | string；最短 1 | 必填 | — | L/P/R | 本任务中该角色负责的业务部分；只能收窄全局身份和岗位边界。 |
| seat | id | 对应联合二选一 | — | L/P/R | 复用岗位配置，与 components 二选一。 |
| components | array<id>；最少项 1；唯一 | 对应联合二选一 | — | L/P/R | 角色直接选择的能力组件，与 seat 二选一；继承 Agent identity，不隐式获得全部能力。 |

## 33. 业务服务契约

<!-- dsl-schema: task -->

Agent 对外提供的一类业务服务；不是待办步骤、岗位或运行实例。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| id | id | 必填 | — | L/P/R | 可重复调用的任务标识，任务目录内唯一。 |
| objective | string；最短 1 | 必填 | — | L/P/R | 该业务服务要解决的问题；自然语言目标不等于机器可证明的成功标准。 |
| components | array<id>；最少项 1；唯一 | 执行配置三选一 | — | L/P/R | 单执行者直接选择能力，继承 identity；与 seat、roles 三选一。 |
| seat | id | 执行配置三选一 | — | L/P/R | 单执行者复用的岗位；与 components、roles 三选一。 |
| roles | array<taskRole>；最少项 2 | 执行配置三选一 | — | L/P/R | 协作分工，至少两项且 id 唯一；需要 workflow 明确交接，不自动并行调度。 |
| workflow | id | 多角色必填，其他可选 | — | L/P/R | workflow 组件 id；单执行者绑定 executor 槽位，多角色槽位与 roles 完全一致。 |
| inputSchema | object 或 boolean | 必填 | — | L/P/R | 整项任务的输入 JSON Schema；静态验证 Schema，运行时验证业务输入实例。 |
| resultSchema | object 或 boolean | 必填 | — | L/P/R | 整项任务结果 JSON Schema；不包括受信运行状态、鉴权身份和回执。 |
| interaction | object | 必填 | — | L/P/R | 业务交互协议，不等于 UI 主题或 Agent 间通信。 |
| interaction.mode | 枚举 interactive / non_interactive | 必填 | — | L/P/R | 是否允许在同一请求中追问；后台无人值守任务用 non_interactive。 |
| interaction.on_missing_input | 枚举 ask / fail | 必填 | — | L/P/R | 输入不足时追问或报错；ask 仅适用于 interactive，修正后重新校验完整输入。 |
| outputs | array<id>；唯一 | 可选 | [] | L/P/R | 任务声明的受管 output 组件；不是额外能力授权，生产和发布仍需执行器。 |
| acceptance | array<object>；最少项 1 | 可选 | — | L/P/R | 可选额外业务验收；输入和结果结构校验始终执行，检查失败不自动重跑写操作。 |
| acceptance[].review | id | 必填 | — | L/P/R | review 组件 id，定义检查方法及严重度。 |
| acceptance[].target | string；最短 1 | 必填 | — | L/P/R | result 表示任务结果，否则为 tasks.outputs 中的 output 组件 id；result 为保留目标名。 |
| acceptance[].role | id | 可选 | — | L/P/R | 验收执行上下文；多角色任务必填且引用局部角色，单执行者省略或为 executor。 |
| delivery | object | 必填 | — | L/P/R | 结果返回契约；生成、验收和送达状态分别记录。 |
| delivery.mode | 固定 "caller" | 必填 | — | L/P/R | 返回原受信调用通道；不接受模型自由指定接收人，外部发布经独立授权能力完成。 |

## 样例与错误定位

[无岗位单任务](../examples/guidance.agent.yaml)、[共享岗位多任务](../examples/minimal-faq.agent.yaml)、[多角色候选维护](../examples/data-asset.agent.yaml)是完整静态样例，不代表业务程序和适配器已提供。

错误 code 为 SCHEMA、REF、DUPLICATE、LAYER、DEPENDENCY、CYCLE、ROLE、VISIBILITY、READ_ONLY、EMBEDDED_SCHEMA、FLOW、FLOW_CYCLE、POLICY，并附 JSON Pointer 与原因。不要通过扩大 gate 来掩盖缺少能力或错误引用。

字段表和 dsl-schema/dsl-kind 标记是文档覆盖索引；测试验证新增字段、缺失说明、缺失行或 kind 能被发现。覆盖检查不证明所有文字语义正确，不代替运行时验证。
