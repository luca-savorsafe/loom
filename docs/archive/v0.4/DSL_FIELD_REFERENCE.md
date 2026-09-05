# Loom DSL 字段参考 v0.4

适用版本：`agent-dsl/v1alpha1`。本手册逐项解释配置，配合 [主规范](AGENT_DSL_SPEC.md) 的建模场景使用。机器结构由 [JSON Schema](../../../schema/versions/agent-v1alpha1.schema.json) 校验；本文所述运行时行为是实现契约，不能据此认为当前仓库已经实现编译器、审批服务或 sandbox。

## 阅读约定

表中的字段路径相对于所在章节。例如 tool 章节的 `binding.bridge` 对应 `components[kind=tool].spec.binding.bridge`；`[]` 表示数组成员。每节的表覆盖对象本身及其嵌套配置；引用其他定义时另设专节。内嵌 `inputSchema/outputSchema` 是使用者提供的 JSON Schema，内部业务字段由使用者定义，不属于 Loom 固定字段。

- **必填**：父对象存在时，该字段不能省略。父对象是否必须出现由上一级决定。
- **条件**：联合类型选择、引用关系或所需能力使其必填。表中区分 Schema 约束与后续语义校验。
- **可选**：没有需求时省略。省略、空对象、空数组与 `null` 不等价。
- **实验**是能力成熟度，不等于可选性；实验对象内部仍有必填字段。
- **默认 `—`**：Schema 未声明默认值，不能自行假定为 `false`、空串或无限制。安全敏感配置缺失时，运行时仍须遵守默认拒绝。
- `[]/none/single_line/true` 等已声明默认值由 normalize 物化，当前 Ajv 检查不替清单填值。

生效阶段：`S`＝解析和 Schema；`L`＝解析来源、归一和引用链接；`P`＝策略和跨字段校验；`R`＝运行；`B`＝生成、验证、打包。所有表项都受 S 检查，阶段列只强调后续用途。

错误约定：类型、必填、枚举、范围和未知键错误由 Schema 拒绝；引用缺失和跨字段冲突由语义检查拒绝；路径逃逸、权限不足、失效审批和敏感数据由运行时拒绝；执行失败返回契约化错误。当前检查脚本的实际覆盖见主规范“实现状态”，未覆盖项不等于允许项。

通用类型：`id` 为小写字母起始、后接小写字母/数字/连字符；`action` 允许小写字母/数字/下划线；`tool-name` 符合 `<prefix>_<action>`。版本字段目前接受 `major.minor.patch` 及可选预发布后缀，Schema 不支持 `+build` 元数据、版本范围或 `latest`。`relative-path` 禁止 `/`、`~` 起始及 `..` 路径段，解析时仍须检查真实路径和符号链接。环境变量名为大写字母起始，后续允许大写字母/数字/下划线；填写变量名，不填写变量值。

## 1. 顶层清单

<!-- dsl-schema: root -->

根文档描述一个 Agent。必填配置组成可校验的声明，完整可启动交付还需要合法 seat 和 launch。`components` 和 `assembly.groups` 必须非空；Schema 允许不含启动入口的声明用于静态检查，不自动创建默认席位。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| apiVersion | const | 必填 | — | S/L | 选择语言语义版本，固定为 agent-dsl/v1alpha1；不是 Agent 业务版本。旧版清单须先迁移。 |
| kind | const | 必填 | — | S | 根对象类型，固定为 Agent；与组件 kind 和资源 kind 属于不同命名空间。 |
| metadata | object | 必填 | — | L/B | Agent 身份、业务目的和发布版本，用于索引、产物命名和追溯。 |
| identity | object | 必填 | — | L/P/R | 所有席位共享的角色说明、能力边界和结构化红线；文字不直接授予权限。 |
| runtime | object | 必填 | — | L/B/R | 选择 Pi 目标及固定版本适配器，用于生成装订代码与锁定运行条件。 |
| resources | resource[] | 可选；存在资源依赖时条件必填 | [] | L/P/R | 登记被组件访问的文件、知识、数据库、服务或程序；声明不会自动加载或授权。 |
| components | component[] | 必填，至少 1 项 | — | L/B/R | 带 id、版本、来源的能力清单，按九种 kind 校验各自 spec。 |
| assembly | object | 必填 | — | L | 将组件组织为具名静态能力集合，供 seat 引用；不产生执行顺序。 |
| seats | seat[] | 可选；workflow/单席入口引用时条件必填 | [] | L/P/R | 同一 Agent 内的角色与能力视图；每个 seat 有自己的 group 集合和 persona。 |
| gate | object | 必填 | — | P/R | Agent 权限上界，默认拒绝；与环境策略、资源访问模式和组件需求共同决定允许动作。 |
| knowledge | object | 可选；管理 Agent 知识生命周期时使用 | — | P/R/B | 统一知识根目录、候选写入和人工晋级约定；不等于某一个 knowledge 组件。 |
| memory | object，实验 | 可选 | — | L/P/R | 跨会话记忆适配配置；无记忆需求时省略，并保持 runtime memory 为 none。 |
| evolution | object，实验 | 可选 | — | L/P/R | 从执行经验生成待审候选的配置；不允许自动改写正式能力或安全边界。 |
| coms | object，实验 | 可选 | — | L/P/R | Agent 间会诊及文件交付配置；多 seat 本身不意味着必须启用通信。 |
| launch | object | 可选；生成具名启动入口时使用 | — | L/B/R | 声明 Pi 启动参数、启动哪些 seat、可选 workflow 和通信开关。 |
| settings | object | 可选 | — | B/R | 模型、主题和加载偏好；不能覆盖 gate 或凭空引入未声明组件。 |

完整入门清单见 [最小纯指导 Agent](../../../examples/legacy/v0.4/guidance.agent.yaml)，带工具的完整清单见 [FAQ](../../../examples/legacy/v0.4/minimal-faq.agent.yaml)。不要复制 `metadata: {}` 等结构示意当作合法配置。

## 2. metadata：识别与发布

<!-- dsl-schema: metadata -->

配置编写者用它描述“这是谁、做什么”；实现者用它记录版本和产物来源。中文显示名可调整，稳定 id 不应随 UI 文案改变。`metadata.version`、`runtime.version`、`components[].version` 各自独立。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| id | id | 必填 | — | L/B | Agent 稳定标识，供工作区、打包和审计引用；不要使用中文或下划线。 |
| name | 非空 string | 必填 | — | B/R | 人读名称，例如“制度问答助手”，用于展示而非引用解析。 |
| purpose | 非空 string | 必填 | — | B/R | 一句话说明业务任务及交付价值，区别于详细角色指令。 |
| version | version | 必填 | — | L/B | Agent 清单的业务发布版本；修改语言版本应改 apiVersion。 |
| domain | 非空 string | 可选 | — | B | 业务域分类标签，例如 credit；不产生权限或知识域绑定。 |
| icon | 非空 string | 可选 | — | B/R | UI 图标提示；具体图标标识由 UI 适配器解释，Schema 不验证图标存在。 |
| color | #RRGGBB string | 可选 | — | B/R | 展示色，六位十六进制；不接受颜色名称。 |
| team | relative-path | 可选 | — | L/B | 团队描述文件位置，用于组织上下文；文件内部格式不是本 DSL 定义，不能把它当作隐式授权。 |

```yaml
metadata:
  id: policy-assistant
  name: 制度问答助手
  purpose: 带出处解答制度问题
  version: 1.0.0
```

## 3. identity：共享角色与红线说明

<!-- dsl-schema: identity -->

identity 作用于整个 Agent；persona 提供某个 seat 的角色差异；skill 提供某项任务的操作方法。三者发生冲突时不能由 persona 或 skill 放宽顶层红线。`can` 是对外能力描述，不是工具注册清单；`cannot` 是文字边界，需要 gate 或资源限制支撑。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| role | 非空 string | 必填 | — | R | Agent 全局业务身份与职责，进入共享角色上下文；避免把具体工具实现写在这里。 |
| red_lines | object[] | 必填，至少 1 项 | — | P/R | 可追踪的不可越过边界集合；声明的控制须存在，但存在不代表自然语言语义已获证明。 |
| red_lines[].id | id | 必填 | — | L/B | 红线稳定标识，在当前 Agent 红线集合内唯一，用于审计定位。 |
| red_lines[].statement | 非空 string | 必填 | — | R/B | 对人解释禁止事项及原因；模型文本不构成强制机制。 |
| red_lines[].enforced_by | string[] | 必填，非空且不重复 | — | L/P | 控制引用：gate.<section>、resource:<id> 或 runtime:<control-id>；运行时控制目录须由固定版本适配器提供。 |
| can | 非空 string[] | 必填 | — | R | 能提供的业务服务，供用户和模型理解；不会自动授予外部动作权限。 |
| cannot | 非空 string[] | 必填 | — | R | 明确不承接的任务或限制，补足角色边界，不能替代 gate。 |
| consult | object | 可选 | — | R | 需要其他 Agent 专长时的会诊指引；无协作需求可省略。 |
| consult.voice | string | 可选 | — | R | 会诊后如何以统一口吻向用户答复的软指引。 |
| consult.routes | object[] | 可选 | — | L/R | 主题到外部目标的咨询映射；由通信适配器解析目标，不是 workflow 的执行路由。 |
| consult.routes[].topic | 非空 string | 必填 | — | R | 适合转交的业务主题，例如代码层事实；不是可执行条件表达式。 |
| consult.routes[].target | id | 必填 | — | L/R | 外部 Agent 标识；不要求等于本地 seat id，解析由启用的 coms 适配器负责。 |
| consult.unknown_policy | 非空 string | 可选 | — | R | 事实不足、目标不可用时如何说明未知、登记问题或交还用户。 |
| output_style | string | 可选 | — | R | 全局语言、引用与表达方式偏好；结构化产物契约另由 output 定义。 |

```yaml
identity:
  role: 你负责解释制度，不替用户作审批决定。
  red_lines:
    - id: no-file-write
      statement: 不修改任何文件
      enforced_by: [gate.filesystem]
  can: [解释用户提供的制度]
  cannot: [代替审批人批准]
```

`gate.filesystem` 的引用只能证明该配置块存在；必须继续检查它的 `write_allow` 是否真为空。当前测试不证明红线含义与 gate 完全等价。

## 4. runtime：执行目标

<!-- dsl-schema: runtime -->

runtime 是整个 Agent 的宿主；bridge.runtime 则是某个确定性程序的解释器。Pi Agent 可以同时调用 Python bridge 和 Node bridge。选择 adapter 只是声明需求，运行时还需实际实现并可用。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| kind | const pi | 必填 | — | L/B | v0.4 唯一的 Agent 执行目标，决定生成代码后端。 |
| version | version | 必填 | — | L/B/R | 固定宿主契约版本并进入 lock；示例版本不代表该版本运行时已发布。 |
| adapters | object | 必填 | — | L/B | 选择宿主扩展接口组合；不负责业务组件依赖。 |
| adapters.memory | none/openviking | 可选；启用对应 memory 时条件必填 | none | L/R | 长期记忆适配器；memory.backend=openviking 时必须匹配。 |
| adapters.evolution | none/self-evolve | 可选；开启 evolution 时条件必填 | none | L/R | 候选经验生成适配器；evolution.enabled=true 时必须为 self-evolve。 |
| adapters.ui | tui/headless | 必填 | — | B/R | 终端交互或无界面运行；headless 不自动批准人工 checkpoint。 |
| adapters.execution | const extensions | 必填 | — | B/R | 通过 Pi extensions 装载执行能力，当前无其他后端。 |

```yaml
runtime:
  kind: pi
  version: 0.4.0
  adapters: {ui: headless, execution: extensions}
```

## 5. resources[]：受控外部资源

<!-- dsl-schema: resource -->

resource 描述“访问哪里及其权限、数据性质”；bridge 描述“怎样访问”；knowledge component 描述“消费哪个知识域及其结构”。同一个数据库应登记一次，由多个组件通过依赖引用。资源 access 是上界，不能突破环境凭据和顶层 gate。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| id | id | 必填 | — | L | 资源标识，在 resources 内唯一；用于 requires 和 resource:<id> 控制引用。 |
| kind | enum | 必填 | — | L/P/R | filesystem＝普通目录文件；knowledge＝知识存储；database＝数据源；service＝服务端点；executable＝程序资源。 |
| access | enum | 必填 | — | P/R | read_only＝只读；read_write＝资源可读写上界；execute＝执行程序；invoke＝调用服务，不等于无副作用。 |
| locator | object，四选一 | 必填 | — | L/R | 资源定位方式，必须且只能出现 path/path_env/connection_env/endpoint 之一。 |
| locator.path | relative-path | 选择静态本地路径时必填 | — | L/P | 项目内路径；解析后检查符号链接，不能指向项目外未授权位置。 |
| locator.path_env | env-name | 选择部署路径时必填 | — | L/P/R | 保存资源根路径的环境变量名，适用于不同部署的受管挂载；变量值仍须环境授权。 |
| locator.connection_env | env-name | 选择连接配置时必填 | — | L/P/R | 保存数据库等连接信息的变量名，不直接暴露连接字符串。 |
| locator.endpoint | 非空 string | 选择服务地址时必填 | — | L/P/R | 不含凭据的服务地址；Schema 只验非空，协议、重定向和目的地由适配器/gate 校验。 |
| credential_env | env-name | 需要独立凭据时配置 | — | P/R | 凭据变量名，仅注入显式依赖资源的执行组件；不写入 prompt 或构建产物。 |
| data_labels | enum[]，唯一 | 可选 | [] | P/R | public/internal/confidential/pii/secret；表达数据分级，空数组表示未标注而不是已证明公开。 |

```yaml
resources:
  - id: policies
    kind: filesystem
    access: read_only
    locator: {path: documents}
    data_labels: [internal]
```

建议组合：database+read_only+connection_env，filesystem+read_only/read_write+path/path_env，executable+execute+path/path_env，service+invoke+endpoint。Schema 尚未强制这些组合；实现者应拒绝自己不能正确解释的组合。读取带 PII 的资源即使为只读，也仍需执行数据阻断与脱敏。

## 6. components[]：公共字段

<!-- dsl-schema: componentBase -->

每个组件都有自己的身份、来源和契约。九种 kind 并非九个必须安装的模块；按需求选用。声明出现在 components 中不代表所有 seat 都能看到它。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| id | id | 必填 | — | L/B | 清单内组件标识，各 kind 共用组件命名空间；binding、requires 和 group 通常引用此 id。 |
| kind | enum | 必填 | — | S/L/B | tool/bridge/skill/workflow/knowledge/persona/gate/output/review；决定 spec 的结构与执行职责。 |
| version | version | 必填 | — | L/B | 组件契约版本；registry 来源版本应一致，锁定文件另记录内容摘要。 |
| source | source union | 必填 | — | L/B | 组件来自项目目录、固定 registry 包或清单内声明；详见来源联合。 |
| description | string | 可选 | — | B | 给维护者看的说明；不同于 tool/skill.spec.description 面向模型的能力描述。 |
| spec | object | 必填 | — | L/B/R | kind 专属契约；不能把某 kind 的字段放到其他 kind，也不能任意增加实现参数。 |
| requires | dependency[] | 可选；有外部依赖时应显式填写 | [] | L/P | 静态依赖边唯一来源；顺序不表示执行次序，tool binding 的 bridge/action 必须同步出现。 |
| effects | effect[]，唯一 | 必填，可空 | — | P/R | 组件直接动作所需能力；effects=[] 不消除依赖组件的副作用，授权必须检查传递依赖闭包。 |
| tests | relative-path[] | 可选；出现时至少 1 项 | — | L/B | 组件契约测试入口路径；具体执行器由工具链约定，Schema 不执行测试文件。 |

### 6.1 source 来源联合

<!-- dsl-schema: componentSource -->

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| type | local/registry/inline | 必填 | — | L | 选择互斥来源分支；local 适合项目实现，inline 适合小型纯声明，registry 适合版本化复用且仍属实验。 |
| path | relative-path | local 必填 | — | L/B | 本地组件目录，用于收集实现和资产；registry/inline 不接受此字段。 |
| name | id | registry 必填 | — | L | 注册包名；不是 tool 的模型调用名。local/inline 不接受此字段。 |
| version | version | registry 必填 | — | L/B | 精确注册包版本，禁止漂移版本范围；解析后还应锁摘要。 |

```yaml
source: {type: local, path: components/policy-bridge}
```

替换为 `{type: inline}` 表示声明在当前 `spec` 中，不会生成缺失的 Python/Node 业务实现。registry 结构为 `{type: registry, name: policy-search, version: 1.0.0}`。组件 id 始终保留，不因使用 inline 变成匿名组件。

### 6.2 requires 依赖联合

<!-- dsl-schema: simpleDependency -->

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| type | component/tool/skill/knowledge/resource/runtime | 必填 | — | L | 声明目标命名空间和类型；component 可引用任意 kind，tool/skill/knowledge 进一步限制目标 kind。 |
| ref | id | 必填 | — | L | 引用组件 id、资源 id 或运行时能力 id；type=tool 仍引用组件 id，不引用 spec.name。 |

<!-- dsl-schema: dependency -->

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| type | const bridge | bridge 分支必填 | — | L | 选择 bridge action 依赖；其他类型使用前述简单依赖，不携带 action。 |
| ref | id | bridge 分支必填 | — | L | 目标 bridge 的组件 id；目标必须确为 bridge。 |
| action | action | bridge 分支必填 | — | L | 需要的确定性操作，必须在目标 bridge.spec.actions 中声明。 |

```yaml
requires:
  - {type: bridge, ref: policy-bridge, action: search}
  - {type: resource, ref: policies}
```

`type: runtime` 引用固定版本 runtime 提供的控制目录；当前脚本跳过该目录解析，不能用任意字符串假装运行时已提供能力。

### 6.3 effects 枚举

| 值 | 表达的直接动作 | 典型组件 | 必须同时满足的边界 |
|---|---|---|---|
| filesystem.read | 读取受管文件 | bridge、knowledge | resource 访问范围、zero_access、环境目录权限 |
| filesystem.write | 写入或修改普通文件 | bridge | write_allow、资源写权限、环境策略；删除另看 delete_rule |
| process.exec | 启动程序或解释器 | bridge | bash/受控执行授权、参数检查、sandbox |
| network.egress | 建立外部网络访问 | bridge | egress 白名单与环境网络策略；不等于可写外部状态 |
| knowledge.candidate_write | 写入待审知识候选 | candidate bridge | candidate-only、候选路径、write_allow、人工 promote 隔离 |
| artifact.write | 生成受管交付物 | output 或产物 bridge | 产物路径白名单与生命周期规则 |
| external.write | 改变外部系统状态 | 发布 bridge | 明确外部授权、资源与环境许可，必要的人审；network.egress 单独不足以授权 |

这些能力可能同时出现，例如访问服务并写入记录需要网络和外部写入能力。`facts_only` 不等于只读；确定性程序同样可能写 candidate。

## 7. tool.spec：模型可调用接口

<!-- dsl-kind: tool -->
<!-- dsl-schema: toolSpec -->

当模型需要主动调用检索、分析、校验等动作时使用 tool。模型只需理解输入、输出和描述；真正执行由 bridge 负责。纯文字指导通常无需 tool。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| name | tool-name | 必填 | — | L/R | 模型看到的调用名，例如 fq_doc_search；与组件 id 区别，供 skill.tools 和 transition.tool 引用。 |
| description | 非空 string | 必填 | — | R | 说明什么时候调用、解决什么问题及限制，供模型选择；避免泛化为“执行任何任务”。 |
| inputSchema | object | 必填 | — | S/R | 参数 JSON Schema；除检查对象类型外还须验证 Schema 本身，调用前验证实际参数。 |
| outputSchema | object | 必填 | — | S/R | 返回结果 JSON Schema；适配器在成功交付结果前验证输出，不能只验证输入。 |
| binding | object | 必填 | — | L/R | 显式绑定一个 bridge action；不接受任意命令字符串。 |
| binding.bridge | id | 必填 | — | L | 目标 bridge 组件 id，必须在 components 内存在且类型匹配。 |
| binding.action | action | 必填 | — | L/R | 目标动作名，与 bridge.actions 和 requires 中 action 一致。 |
| phase | id | 可选 | — | L/R | 主要工作阶段标注，须在适用 workflow 内存在；不是流转规则，也没有自动授权含义。 |
| execution | object | 可选 | — | P/R | 单次执行约束；省略时使用受版本管理的宿主执行策略，不表示无限等待。 |
| execution.timeout_seconds | integer 1–3600 | execution 存在时必填 | — | R | 单次调用时限，超时需终止或隔离执行并返回失败；不表示整个 workflow 总时长。 |
| execution.idempotent | boolean | execution 存在时必填 | — | R | 声明相同请求重复执行是否安全；不是幂等实现，更不自动启用重试。 |

```yaml
spec:
  name: fq_doc_search
  description: 检索制度出处
  inputSchema: {type: object}
  outputSchema: {type: object}
  binding: {bridge: faq-bridge, action: search}
  execution: {timeout_seconds: 30, idempotent: true}
```

实际项目应收紧业务参数和返回 envelope，而不是长期保留 `{type: object}`。Loom 当前没有统一 error envelope 的独立 Schema，`status/summary/details` 等要求需由组件输出契约和 runtime 契约测试落实。

## 8. bridge.spec：确定性执行体

<!-- dsl-kind: bridge -->
<!-- dsl-schema: bridgeSpec -->

检索、数据库查询、规则计算、转换和校验适合 bridge。让模型推理、规划或生成文字的逻辑应放在 skill/Agent 层。一个 bridge 可含多个 action，但只建议聚合同一权限边界的 action。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| name | action 格式 string | 必填 | — | L/B | 执行模块逻辑名；binding 仍引用组件 id，不用该名称定位。 |
| runtime | python/node/binary | 必填 | — | L/B/R | 执行体解释器或二进制类型；与 Agent 顶层 runtime.kind=pi 独立。 |
| entrypoint | relative-path | 必填 | — | L/B/R | 可执行实现入口；打包时必须存在，inline 来源也不会自动生成此文件。当前 Schema 不解决组件根/项目根基准，见主规范路径边界。 |
| facts_only | const true | 必填 | — | P/R | 承诺只做确定性事实访问与业务计算，不调用 LLM；声明本身不能证明实现遵守，需要测试和隔离。 |
| actions | action[]，非空唯一 | 必填 | — | L/R | 暴露的操作集合，供 tool binding 精确引用；数组顺序不表示调用顺序。 |

```yaml
spec:
  name: faq_bridge
  runtime: python
  entrypoint: tools/faq.py
  facts_only: true
  actions: [search]
```

运行时负责超时、stdout 结构化结果、stderr 诊断、凭据注入和 sandbox。外部数据库更新会改变结果，因此确定性指“同一实现、参数和事实快照下的计算”，不承诺不同时间查询结果相同。

## 9. skill.spec：操作方法

<!-- dsl-kind: skill -->
<!-- dsl-schema: skillSpec -->

用于可复用分析步骤、领域操作手册和回答要求。纯解释或无强制阶段任务可以只使用 skill；技能文本不负责保存状态或批准操作。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| name | id | 必填 | — | L/B/R | 技能逻辑名，用于加载和展示；静态 requires 引用组件 id。 |
| description | 非空 string | 必填 | — | R | 说明适用任务和触发场景，帮助选择这项操作方法。 |
| guide | 非空 string | 必填 | — | R | 实际操作指引，如先检索证据再回答；是文本内容而不是待执行脚本或路径。 |
| tools | tool-name[]，唯一 | 可选 | — | L/R | 指引会使用的模型工具名；须存在并在 seat 中可见，不授予新的可见性。 |
| guardrails | 非空 string 元素数组 | 可选 | — | R | 操作注意事项和停止建议，属于软约束；强制限制放 gate/workflow。 |
| references | relative-path[]，唯一 | 可选 | — | L/B/R | 配套参考文档位置，不是内嵌全文；适配器应核对存在性与访问范围。 |

```yaml
spec:
  name: evidence-answer
  description: 基于用户资料解释问题
  guide: 区分资料原文与推断，无法证明的结论标为未知。
```

## 10. workflow.spec：阶段图

<!-- dsl-kind: workflow -->
<!-- dsl-schema: workflowSpec -->

需要保存进度、失败回退、有限迭代或人工确认时使用。普通开放式对话无需为每句话建立一个 phase。phase 是业务阶段，不是一次模型 token 生成或一次程序函数调用。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| name | id | 必填 | — | L/B/R | 流程逻辑名，组件引用仍使用组件 id。 |
| seat | id | 必填 | — | L/R | 拥有此流程状态的席位，必须存在；不能把另一个 seat 的工具直接拿来调用。 |
| initial | id | 必填 | — | L/R | 初始 phase，必须在 phases 中；phases 数组第一项不自动成为初态。 |
| widget | single_line/panel/none | 可选 | single_line | B/R | 进度的单行、面板或隐藏展示，不改变执行语义。 |
| phases | object[]，非空 | 必填 | — | L/R | 阶段目录，用于状态定位；数组顺序本身不生成 transitions。 |
| phases[].id | id | 必填 | — | L/R | 同一 workflow 内唯一的阶段 id，供 initial/transition/loop/checkpoint 引用。 |
| phases[].description | string | 可选 | — | R/B | 阶段职责说明；不是自动完成条件。 |
| transitions | transition[] | 可选 | [] | L/R | 事件驱动的显式转移，含起点、终点、事件及可选 tool。 |
| loops | loop[] | 可选 | [] | L/R | 回退/迭代的方向和硬次数上限；when 不可当作机器判断表达式。 |
| human_checkpoints | checkpoint[] | 可选 | [] | P/R | 必须等待真实人工批准的阶段闸门；无审批需求时省略。 |

```yaml
spec:
  name: answer-flow
  seat: default
  initial: read
  phases: [{id: read}, {id: answer}]
  transitions:
    - {from: read, to: answer, on: phase_completed}
```

### 10.1 transitions[]

<!-- dsl-schema: transition -->

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| from | id | 必填 | — | L/R | 转移起点，必须是当前流程内存在的阶段，运行时必须等于当前 phase。 |
| to | id | 必填 | — | L/R | 转移终点，必须在相同 workflow 中存在。 |
| on | enum | 必填 | — | L/R | phase_completed/tool_succeeded/tool_failed/approval_granted/manual；事件来自可信执行或交互通道，不执行 when 文本。 |
| tool | tool-name | 工具成功/失败事件时语义必填 | — | L/R | 绑定事件所属的模型工具名；其他事件不应配置此项。 |
| when | string | 可选 | — | R/B | 人读的业务原因或条件解释，不作为可执行表达式，不应据此触发转移。 |

`phase_completed` 表示运行时确认阶段完成；`tool_succeeded/tool_failed` 只响应指定工具的结果；`approval_granted` 需实际批准事件；`manual` 需显式交互事件。阶段的业务完成判据必须由组件和运行时协议提供，文字“已完成”不是普遍可信证据。

### 10.2 loops[]

<!-- dsl-schema: loop -->

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| from | id | 必填 | — | L/R | 回退起点，必须属于当前 workflow。 |
| to | id | 必填 | — | L/R | 重新进入的阶段；回边应与可解释的转移事件对应。 |
| max_rounds | integer 1–100 | 必填 | — | R | 允许的迭代硬上限，不能用软建议替代；计数须随运行状态保存。 |
| when | 非空 string | 可选 | — | R/B | 解释为什么迭代，不定义机器触发条件；单独配置此文字不足以实现自主循环。 |

本版本尚未完整定义“仅 loop 无 transition”的触发协议、不同回边共享计数或恢复计数存储。编译器实现前必须固定这些运行时约定；当前图可达性检查通过不代表循环能执行。

### 10.3 human_checkpoints[]

<!-- dsl-schema: humanCheckpoint -->

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| phase | id | 必填 | — | L/R | 需要等待批准的阶段；按当前模板在离开阶段前检查，不能保护已在阶段内发生的写入。 |
| required | const true | 必填 | — | P/R | 此闸门不可由模型选择跳过；无需人审时应删除该 checkpoint 而非填 false。 |
| prompt | 非空 string | 必填 | — | R | 向审批人展示的批准事项、影响与证据；不要只写“继续吗”。 |
| approval | const one_time | 必填 | — | P/R | 一次性批准，由运行时/UI 绑定待执行动作摘要；不能重放旧批准或接受 Agent 消息代批。 |
| action | id | 可选 | — | L/P/R | 批准事项的逻辑标识；当前未定义独立 action 注册表，不能擅自解释成 bridge action 或增加授权。 |

```yaml
human_checkpoints:
  - phase: review
    required: true
    approval: one_time
    prompt: 请检查候选差异和校验报告，确认是否交付。
```

需要执行前批准时，将 checkpoint 放在准备/审查阶段，批准后再进入执行阶段。机器校验通过与人类批准是两种不同证据。

## 11. knowledge.spec：可装配知识域

<!-- dsl-kind: knowledge -->
<!-- dsl-schema: knowledgeSpec -->

知识域需要独立维护、复用或按 Schema 验证时使用，如 FAQ、字段契约和术语库。只有一段提示文字时可写在 skill/identity；单纯需要读文件时可以只声明 resource。此组件不自动提供检索工具或向量数据库。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| domain | id | 必填 | — | L/R/B | 该知识组件描述的领域标识，如 faq/contracts；不等于资源路径或数据库名。 |
| schema | relative-path | 可选 | — | L/B/R | 验证知识条目结构的 Schema 文件路径；有结构化资产时配置，纯文本知识可省略。 |
| builder | relative-path | 可选 | — | L/B | 构建或索引程序入口位置；引用本身不授予执行权，也不表示构建时自动运行。 |

```yaml
spec: {domain: faq, schema: knowledge/faq.schema.json}
```

源数据位置通过 resource/组件来源声明；跨域生命周期通过顶层 knowledge 管理。builder 的调用参数、产物协议目前不由这三个字段完整定义。

## 12. persona.spec：复用席位身份

<!-- dsl-kind: persona -->
<!-- dsl-schema: personaSpec -->

多 seat 或多个 Agent 需要复用、版本化角色说明时使用。单个短 persona 直接写 `seat.persona` 更简单。persona 不应包含新的 gate 授权或复制完整操作手册。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| name | id | 必填 | — | L/B | persona 的逻辑名，用于展示和打包；seat.persona_ref 引用组件 id。 |
| content | 非空 string | 必填 | — | R | 席位职责、语气、专业视角和对外表达正文；不得放宽全局 identity 或 gate。 |

```yaml
spec: {name: reviewer, content: 你负责检查证据和结论的一致性，不代替审批人决定。}
```

## 13. gate.spec：可复用限制

<!-- dsl-kind: gate -->
<!-- dsl-schema: gateRestrictionSpec -->

复用一组限制时使用；若只有一个 Agent，可直接使用顶层 gate。组件只能增加拒绝，不能提供允许规则。当前顶层策略是 Agent 级的，不能假设放在某 group 中就自动成为只作用于该 seat 的局部策略。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| bash_deny_presets | deny-preset[]，非空唯一 | 可选；三个限制字段至少一个 | — | P/R | 附加命令拒绝集合，与 Agent 及环境 deny 合并；network 仅表示命令层禁网规则。 |
| zero_access | 非空 string[]，唯一 | 可选；三个限制字段至少一个 | — | P/R | 附加禁止读写的路径模式，与现有禁止范围取并集。 |
| deny_data_labels | confidential/pii/secret 数组，非空唯一 | 可选；三个限制字段至少一个 | — | P/R | 附加禁止处理的数据标签，不能通过顶层 allow 抵消；具体处理通道由数据适配器落实。 |

```yaml
spec:
  bash_deny_presets: [install, git_push]
  zero_access: [secrets/**]
```

## 14. output.spec：受管产物

<!-- dsl-kind: output -->
<!-- dsl-schema: outputSpec -->

报告、candidate、审查材料等需要稳定路径、生命周期或发布方式时使用。一次性草稿和工具临时文件通常无需单独 output。声明 output 不会自动完成写入、PR 或 webhook 投递。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| name | id | 必填 | — | L/B | 产物逻辑名，用于交付清单与审计；不是文件路径。 |
| path | relative-path | 必填 | — | P/R/B | 产物在受管工作区的路径，即使通过 PR/webhook 发布也需描述本地产物；必须被写权限覆盖。 |
| media_type | type/subtype string | 必填 | — | R/B | 内容格式提示，例如 text/markdown、application/json；Schema 仅验证基本形式，不检查内容真实性。 |
| lifecycle | ephemeral/draft/candidate/promoted | 必填 | — | P/R | 临时、草稿、待审候选或已晋级状态声明；标为 promoted 不会执行审批或晋级。 |
| publish | atomic_file/git_pr/webhook | 必填 | — | L/P/R | 交付方式：原子文件、PR 或 webhook；后两者需要适配器与明确外部权限，当前 spec 未定义远端目标字段。 |

```yaml
spec:
  name: report
  path: workspace/report.md
  media_type: text/markdown
  lifecycle: draft
  publish: atomic_file
```

优先采用 atomic_file。git_pr/webhook 的目标、认证、重试、幂等和回执需由实现适配器提供，现有 Schema 不能完整描述这些协议。

## 15. review.spec：机器检查

<!-- dsl-kind: review -->
<!-- dsl-schema: reviewSpec -->

交付需要验证格式、事实、引用或资产完整性时使用。review 的检查结果是质量证据；人工 checkpoint 是授权证据。普通回答不一定需要独立 review 组件，skill 中的自检指引也不能冒充机器检查。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| checks | object[]，非空 | 必填 | — | L/R/B | 机器检查集合，每项需指定检查类别与失败严重性。 |
| checks[].id | id | 必填 | — | L/B | 检查项稳定标识，便于报告定位和比较多次结果。 |
| checks[].kind | schema/citations/facts/artifact/custom | 必填 | — | L/R | 分别检查结构、出处、事实、产物或自定义规则；不能仅凭名称推定执行器已安装。 |
| checks[].tool | tool-name | 可选；需要工具执行时配置 | — | L/R | 承担检查的已声明工具；custom 等无内置执行器场景必须由适配器解析具体执行者。 |
| checks[].severity | error/warn/info | 必填 | — | R/B | error 阻断相应交付/转移，warn 提醒，info 记录；严重度不产生执行授权。 |

```yaml
spec:
  checks:
    - {id: evidence, kind: citations, severity: error}
```

此最小片段仅结构合法，运行时需存在 citations 检查器。当前 spec 未包含 review 到 output/phase 的完整绑定字段，codegen 支持前不能把“有 review 组件”视为所有交付均受检。

## 16. assembly：静态组合

<!-- dsl-schema: assembly -->

将一起暴露的能力组织起来，减少 seat 重复列组件。一个 group 可以被多个 seat 复用；只有 group 归属不产生新的依赖边，也不会定时调用其中的组件。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| groups | object[]，非空 | 必填 | — | L | 能力集合列表，至少一组；直接成员与依赖闭包需要分别理解。 |
| groups[].id | id | 必填 | — | L | group 标识，在 assembly 内唯一，供 seats[].groups 引用。 |
| groups[].components | id[]，非空唯一 | 必填 | — | L | 直接成员的组件 id；其依赖由 requires 补全，不在此复制执行顺序。 |
| groups[].mode | main/optional/fallback/review | 必填 | — | L/B | 集合业务用途标记：主能力、按需、备用、审查；不是调度器或路由条件。 |
| groups[].description | string | 可选 | — | B/R | 给维护者解释能力集合用途及边界。 |
| notes | string[] | 可选 | — | B | 装配说明和审计备注，无可执行语义。 |

```yaml
assembly:
  groups:
    - {id: main, components: [answer-skill], mode: main}
```

fallback group 并不自动在失败时调用；需由 workflow 事件和有权使用工具的 seat 实现对应流程。

## 17. seats[]：角色与能力视图

<!-- dsl-schema: seat -->

当角色、可见工具或只读边界不同，应拆 seat；仅提示语长短不同通常不必拆。seat 是逻辑视图，不保证对应独立操作系统进程、账户或数据库连接。需要权限隔离时还须部署独立环境约束。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| id | id | 必填 | — | L/R | 席位稳定标识，在 seats 内唯一，供 workflow.seat 与 launch.entry.seat 引用。 |
| name | 非空 string | 可选 | — | R | 人读席位名称，供 UI 展示。 |
| persona | 非空 string | 与 persona_ref 严格二选一 | — | R | 简单席位的内联角色正文，无需额外 persona 组件。 |
| persona_ref | id | 与 persona 严格二选一 | — | L/R | 可复用 persona 的组件 id，目标 kind 必须为 persona。 |
| groups | id[]，非空唯一 | 必填 | — | L/P/R | 该 seat 使用的 group 集合；工具可见性和权限需求由集合与传递依赖解析。 |
| mode | read_only/standard | 必填 | — | P/R | read_only 的依赖闭包不可含写 effect；standard 仅取消此额外限制，不授予写权。 |
| coms | active/quiet | 可选 | — | R | 席位会诊参与偏好，不替代入口和顶层通信配置；省略时无 Schema 默认承诺。 |

```yaml
seats:
  - id: default
    persona: 你负责基于证据回答。
    groups: [main]
    mode: read_only
```

## 18. gate：运行权限上界

<!-- dsl-schema: gate -->

每个 Agent 都必须声明 gate，即使纯指导 Agent 也可以显式关闭文件写入、程序执行和联网。preset 与正则的匹配需要实际 runtime 实现；仅有 YAML 不会改变宿主操作系统权限。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| default | const deny | 必填 | — | P/R | 未获得明确授权时拒绝；不能因为 allow 数组为空就改为无限制。 |
| filesystem | object | 必填 | — | P/R | 文件写入、删除与绝对禁止访问范围。 |
| filesystem.write_allow | string[]，唯一 | 必填，可空 | — | P/R | 允许写入路径模式；空数组禁止写入，匹配仍不能覆盖 zero_access。 |
| filesystem.delete_rule | single_candidate_only/none/free | 必填 | — | P/R | 单个候选删除、禁止删除或无额外单候选限制；free 仍须满足路径和环境授权。 |
| filesystem.param_check | const true | 必填 | — | R | 检查目标路径、参数、重定向和符号链接等；禁止关闭参数检查。 |
| filesystem.zero_access | string[]，唯一 | 可选 | — | P/R | 完全禁止读写的路径模式，优先于任何允许规则。 |
| bash | object | 必填 | — | P/R | 程序执行的允许、拒绝和安全替代提示规则，需与 sandbox 配合。 |
| bash.allow_presets | allow-preset[]，唯一 | 必填，可空 | — | P/R | 引用固定版本 runtime 提供的允许命令集，不是任意程序白名单。 |
| bash.allow | 非空 string 元素数组，唯一 | 可选 | — | P/R | 自定义命令允许正则；表达灵活但风险较高，不能绕过参数与 deny 检查。 |
| bash.deny_presets | deny-preset[]，唯一 | 必填，可空 | — | P/R | 固定命令拒绝集，任何命中均优先拒绝。 |
| bash.deny | 非空 string 元素数组，唯一 | 可选 | — | P/R | 自定义拒绝正则，与 preset 拒绝集合共同生效。 |
| bash.redirects | object[] | 可选 | — | R | 为不适当命令提供受控工具替代指引；不是 shell 重定向执行许可。 |
| bash.redirects[].pattern | 非空 string | 必填 | — | P/R | 匹配需替代命令的正则，编译器/运行时必须检查正则有效性。 |
| bash.redirects[].message | 非空 string | 必填 | — | R | 告知为什么应使用受控工具的解释。 |
| bash.redirects[].use_tool | tool-name | 可选 | — | L/R | 建议替代工具名，必须能被当前 seat 使用；提示不自动调用工具或授予权限。 |
| egress | egress union | 必填 | — | P/R | 对外连接目的地策略；与 bash 禁网规则属于不同执行层。 |
| knowledge_write | object | 候选知识写入时语义需要 | — | P/R | 对知识写入附加 candidate-only 限制；不单独提供文件写权。 |
| knowledge_write.mode | const candidate_only | knowledge_write 存在时必填 | — | P/R | Agent 只能写待审候选，正式 promote 由独立人工权限执行。 |
| knowledge_write.paths | string[]，非空唯一 | knowledge_write 存在时必填 | — | P/R | 允许候选路径模式，须同时被 filesystem.write_allow 覆盖。 |
| data | object | 可选；处理敏感资源时需要相应控制 | — | P/R | prompt 输入阻断和输出脱敏规则；未配置不代表数据已脱敏。 |
| data.deny_prompt_labels | confidential/pii/secret 数组，唯一 | 可选 | — | P/R | 不得进入模型上下文的数据标签，必须在构造 prompt 前执行。 |
| data.redact_output_labels | confidential/pii/secret 数组，唯一 | 可选 | — | P/R | 输出前需要脱敏的标签；日志、记忆和衍生产物也不能旁路此限制。 |

### 18.1 egress 联合

<!-- dsl-schema: egress -->

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| policy | deny_all/whitelist | 必填 | — | P/R | deny_all 禁止对外连接；whitelist 只允许明确目的地，并仍接受环境进一步收窄。 |
| allow | string[] | whitelist 时必填非空；deny_all 时可省略或空 | — | L/P/R | 受控目的地或 resource:<id> 引用，禁止空白名单假装已授权；字符串语法细化由适配器负责。 |

### 18.2 preset 含义

| 类别 | 值 | 用途与限制 |
|---|---|---|
| allow | readonly | 只读查询命令集合；是否读敏感路径仍由文件/数据策略决定。 |
| allow | git_add_commit | 本地暂存和提交；不包括远程推送，不自动授权任务外文件。 |
| allow | python_tools | 受控 Python 入口；不表示可执行任意 Python 脚本。 |
| allow | drawio | 图形导出相关受控命令；仍需允许产物路径。 |
| allow | controlled_cli | 经适配器登记的业务 CLI；不接受任意自定义命令作为可信入口。 |
| deny | network | 拒绝网络类 shell 命令；程序内部网络访问仍由 egress 和 sandbox 控制。 |
| deny | install | 拒绝依赖/软件安装。 |
| deny | git_push | 拒绝远程推送。 |
| deny | rm_rf | 拒绝破坏性批量删除模式。 |
| deny | inline_code | 拒绝难以审计的内联代码执行。 |
| deny | dangerous_git | 拒绝危险 Git 改写/清理操作，具体命令集合由 runtime 版本固定。 |
| deny | production_write | 拒绝已识别生产写操作；不能替代数据库只读账号或服务鉴权。 |

```yaml
gate:
  default: deny
  filesystem: {write_allow: [], delete_rule: none, param_check: true}
  bash: {allow_presets: [], deny_presets: []}
  egress: {policy: deny_all}
```

这是合法的无文件写入、无命令允许、无出网配置。读取资源是否可用仍取决于 resource 和环境，不由空的 bash 列表决定。

## 19. knowledge：Agent 级知识生命周期

<!-- dsl-schema: knowledge -->

管理多个知识域的共享根目录、候选生成和正式晋级时配置。纯消费用户输入或临时文件时通常可省略。知识组件定义数据域，顶层 knowledge 定义资产治理，gate 才负责实际写权限。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| root | relative-path | 必填 | — | L/P/B | 统一知识资产根目录；不自动创建目录或授予写入权限。 |
| lifecycle | object | 必填 | — | P/R | Agent 生成和治理知识资产的生命周期约定。 |
| lifecycle.agent_write | candidate_only/workspace_only/free | 必填 | — | P/R | candidate_only 表示候选资产；workspace_only 表示仅工作区草稿；free 是 Schema 保留的宽松声明，仍不可越过 gate 或批准要求。 |
| lifecycle.candidate_prefix | 非空 string | 必填 | — | P/R | 候选文件识别前缀，如 candidate_；当前 Schema 即使 workspace_only 也要求填写。 |
| lifecycle.promote | object | 可选 | — | B/R | 面向人工的正式晋级操作约定；不是自动执行 hook。 |
| lifecycle.promote.command | 非空 string | promote 存在时必填 | — | B/R | 人工可执行的晋级命令描述；不能据此给 Agent 开放 shell 权限。 |
| lifecycle.promote.post_validate | boolean | promote 存在时必填 | — | R | 晋级后是否要求校验；false 只是结构允许，正式资产推荐开启并由人工工具落实。 |
| lifecycle.manifest | boolean | 必填 | — | B/R | 是否记录资产清单和来源摘要；false 不代表不需要构建 provenance。 |
| citations | object | 可选 | — | R/B | 来源与版本漂移检查配置，事实型知识建议开启。 |
| citations.require_source | boolean | citations 存在时必填 | — | R | 是否要求引用携带来源；真实来源存在性需检查器验证。 |
| citations.drift_check | boolean | citations 存在时必填 | — | R | 是否检查引用与源版本发生漂移；开启需要可解析的来源版本信息。 |

```yaml
knowledge:
  root: knowledge
  lifecycle:
    agent_write: candidate_only
    candidate_prefix: candidate_
    manifest: true
```

结构接受 `free` 不代表推荐使用。当前脚本没有实现所有 lifecycle 与 gate 路径组合的验证；实现者不得把该枚举解释为跳过人工 promote。

## 20. memory：实验性长期记忆

<!-- dsl-schema: memory -->

用于跨会话保存经过筛选的信息；不能把普通知识库或全部工具日志都当作记忆。省略本块且 adapter=none 是无记忆场景的常见选择。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| backend | none/openviking | 必填 | — | L/R | 选择关闭或 OpenViking 后端；openviking 要求 runtime.adapters.memory 匹配。 |
| experimental_acknowledged | const true | 必填 | — | L/B | 明确采用实验能力，不代表服务已可用或隐私控制已验证。 |
| server_env | env-name | 可选；远端后端按部署需要 | — | L/R | 记忆服务地址的环境变量名；Schema 未要求 openviking 时必须填写，适配器须解决配置。 |
| capture_tool_results | const false | 可选 | — | P/R | 显式禁止捕获工具原始结果；省略也不能被适配器解释为允许原样保存。 |
| retention_labels | public/internal 数组，唯一 | 可选 | — | P/R | 允许保留的数据等级；未填写时没有 Schema 默认清单，不应自动保留全部数据。 |

```yaml
memory:
  backend: none
  experimental_acknowledged: true
  capture_tool_results: false
  retention_labels: []
```

该显式关闭片段结构合法；通常省略本块即可。没有 memory 就无需为形式完整配置一个真实服务。

## 21. evolution：实验性候选经验生成

<!-- dsl-schema: evolution -->

反复执行同类任务且有可靠人工审查渠道时才使用。生成的经验仍是候选，不直接改写运行中的 skill、persona、identity 或 gate。一次性任务可省略。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| enabled | boolean | 必填 | — | L/R | 是否启用候选演化；true 时要求 self-evolve adapter 且必须配置 review。 |
| experimental_acknowledged | const true | 必填 | — | L/B | 显式确认实验能力，和 enabled 的开关含义独立。 |
| capture | object | 可选 | — | P/R | 可参与候选提取的轨迹规模限制；省略时具体行为由固定版本适配器确定。 |
| capture.min_tool_calls | integer ≥1 | capture 存在时必填 | — | R | 一条轨迹具备候选提取资格的最少工具调用数，不是强制调用工具次数。 |
| capture.max_trace_chars | integer ≥0 | capture 存在时必填 | — | R | 捕获轨迹字符上限；0 不应被当作无限制。 |
| capture.max_candidates | integer ≥1 | capture 存在时必填 | — | R | 候选数量上限；按轮还是按会话计量必须由适配器文档明确。 |
| capture.incremental | const true | capture 存在时必填 | — | R | 采用增量候选提取，不能整库替换正式知识；去重协议由适配器实现。 |
| review | object | enabled=true 时 Schema 条件必填 | — | P/R | 人工审核候选的入口与检查项。 |
| review.trigger | manual/pr | review 存在时必填 | — | R | 通过人工命令或 PR 评审，不是自动接受候选。 |
| review.checks | format/dedup/value 数组，非空唯一 | review 存在时必填 | — | R | 格式、重复性和价值检查选择；不代表每个选择已有实现。 |

```yaml
evolution:
  enabled: false
  experimental_acknowledged: true
```

## 22. coms：实验性会诊与交付

<!-- dsl-schema: coms -->

需要独立 Agent 会诊时使用；同一 Agent 的几个 seat 不一定需要外部消息层。通信携带消息和产物指针，人工批准只能通过受信审批通道。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| project | id | 必填 | — | L/R | 通信项目命名空间，减少不同工作区消息混淆；不等于对方鉴权凭据。 |
| experimental_acknowledged | const true | 必填 | — | L/B | 确认通信适配仍属实验。 |
| auto_reply | boolean | 可选 | true | R | 是否由适配器自动回包；去环、投递语义和重试仍需明确协议。 |
| delivery | const filesystem | 必填 | — | R | 当前产物交接采用文件系统；不能据此推定跨主机文件已经同步。 |
| human_gates_via_coms | const false | 必填 | — | P/R | 禁止将普通 Agent 消息作为人工闸门批准。 |

```yaml
coms:
  project: policy-team
  experimental_acknowledged: true
  delivery: filesystem
  human_gates_via_coms: false
```

顶层 coms 声明通信能力，launch.entry.coms 决定入口是否启用，seat.coms 描述席位偏好。三者无法组成可用适配时不能仅因字段合法就声称会诊成功。

## 23. launch：具名运行入口

<!-- dsl-schema: launch -->

把同一 Agent 打包成“全部席位”“只读查询”“候选维护”等入口时配置。每个入口引用已声明能力；不得借 base_flags 绕过 gate 或装载未经声明的扩展。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| binary | const pi | 必填 | — | B/R | 启动程序固定为 Pi，与 runtime 目标一致。 |
| base_flags | string[]，唯一 | 必填，可空 | — | P/B | 所有入口共享的宿主参数；参数语义和与生成配置的冲突由运行时版本及编译器检查。 |
| entries | object[]，非空 | 必填 | — | L/B | 具名启动方式列表。 |
| entries[].name | id | 必填 | — | L/B | 入口名称，launch 内唯一，用于生成可调用命令。 |
| entries[].seats | const all | 与 seat 严格二选一 | — | L/B/R | 启动已声明的全部席位；不生成新 seat，也不规定并行/顺序调度。 |
| entries[].seat | id | 与 seats 严格二选一 | — | L/B/R | 启动一个已声明席位。 |
| entries[].workflow | id | 可选 | — | L/B/R | 启动时选择的 workflow 组件 id，单席入口要求流程归属一致；all+workflow 的调度语义尚未完整定义。 |
| entries[].coms | boolean | 必填 | — | L/B/R | 此入口是否启用通信；true 时需可用 coms 配置和适配器，不授权外部动作。 |

```yaml
launch:
  binary: pi
  base_flags: []
  entries:
    - {name: default, seat: default, coms: false}
```

## 24. settings：运行偏好

<!-- dsl-schema: settings -->

提供默认模型和显示偏好；即使选择了某模型，也仍需环境提供可用模型、凭据及配额。不要把审批策略或外部权限藏在 settings。

| 字段 | 类型 | 必要性 | 默认 | 阶段 | 用途、场景和约束 |
|---|---|---|---|---|---|
| model | string 或 null | 可选 | — | B/R | 具体模型标识或 null 表示交由宿主配置；可用性由环境检查，Schema 不枚举供应商模型。 |
| theme | string | 可选 | — | B/R | UI 主题偏好；headless 下不影响任务语义，主题名由 UI 解释。 |
| auto_load | boolean | 可选 | — | B/R | 生成产物的自动装载偏好；当前未细化与宿主各类扫描开关的映射，不允许因此突破声明的能力边界。 |

```yaml
settings: {model: null, theme: nord, auto_load: true}
```

## 25. 错误定位与文档维护

查询错误时，先按 JSON Pointer 找到本手册对应字段，再区分三种情况：字段形式错误，目标引用或策略不相容，运行时尚未实现该能力。不要靠删去 required 字段、改宽 egress、把 seat 改为 standard 来掩盖真正问题。

本手册的 `dsl-schema` 注释与表格首列构成覆盖索引。测试遍历 Schema 公开对象、联合分支和数组嵌套字段，要求它们有说明且出现在对应表中；新增字段必须同步补充用途说明。覆盖检查证明字段没有遗漏，不证明描述语义正确，示例和人工审查仍不可缺少。
