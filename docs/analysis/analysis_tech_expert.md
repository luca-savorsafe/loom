# CreditWeaveAI / agent_tech_expert —— 结构化分析报告

> 分析对象：`/Users/mac/worker/code/ai-example/CreditWeaveAI/agent_tech_expert`
> 所属仓：CreditWeaveAI（多坐席 monorepo，兄弟坐席：agent_data_asset、agent_batch_duty、agent_design_doc 等）

---

## 1. 智能体定位与业务领域

**定位**：「信贷技术专家坐席」——整个信贷源码库（`financial-cloud/any-product-all` 等，160 模块、21,758 个 Java 文件）与技术架构的**活字典**。

- **主要服务对象**：其他坐席的会诊（coms P2P 通道）：数据资产、批量值班、风险策略、模型开发、测试工程、后端开发坐席；其次是人的直接对话（pi TUI）。
- **业务领域**：消费信贷核心系统——放款/还款/逾期日终/计提/核销/联合贷/催收/规则引擎/Spring Batch 批处理。
- **能答**：代码层事实——加工逻辑、枚举语义、写入路径、依赖关系、幂等性、断点机制、上游 vs 加工鉴别、设计/需求依据（`《文档名》§章节`）。
- **不答**（硬约束）：
  1. **业务语义**代码判断不了的 → 明说「需业务方确认」并登记 unknown（不猜）；
  2. **运行时状态**（Job 现在跑到哪、当前缺失率）→ 路由给值班/数据资产坐席，不代查不转发。
- **里程碑状态**（README.md）：M0 骨架 → M1 枚举词典 17,840 条 + 12 个 te_* 工具 → M2 coms 会诊 → M3 Job 读写面 → M4 意图文档索引 386 篇，全部 ✅；P2/经验层（M5）待续。

---

## 2. 组件清单

### 2.1 Persona（人设，运行态事实源）
| 文件 | 职责 |
|---|---|
| `.pi/APPEND_SYSTEM.md` | 单一人设：能力边界、不答什么、引用出处规范、知识所有权边界（防与 agent_data_asset 双写）、会诊纪律 6 条、硬边界清单。与 `docs/CREDIT_EXPERT_KNOWLEDGE.md` §1.3/§1.4 一字不改同步。 |

### 2.2 Skills（软引导）
| 文件 | 职责 |
|---|---|
| `.pi/skills/credit-tech-expert/SKILL.md` | 查证与回答工作流：**六层查证顺序**（知识→图谱→源码→画像→文档→组织回答），命中即停；防失控软规则（同工具 3 次失败即停、不写他人交付物、>50 行原文不进回答）；完成判据。 |
| `.pi/skills/credit-tech-expert/references/answer-contract.md` | **answer-contract**：固定五段式回答模板（结论/证据/依据/边界/需业务方确认）及每段纪律。 |
| `.pi/skills/credit-tech-expert/references/monorepo-map.md` | **monorepo-map**：any-product-all 模块导览（高频锚点表含 file:line、同名常量陷阱表、批处理结构常识、仓外相关库、使用纪律「先定位模块再 grep」）。 |

### 2.3 Extensions（pi 扩展，L2 工具层 + L4 硬边界）
| 文件 | 职责 |
|---|---|
| `extensions/te-gate.ts` | **硬边界（L4）**：tool_call 钩子拦截 write/edit/bash。全库只读；仅放行 `workspace/` 与 `knowledge/**/candidate_*`；bash 白名单（只读命令 + git 只读/add/commit + `python3 <脚本>.py`）；DENIED 正则拦联网/装包/危险 git/rm -rf/图谱裸构建/`python -c` 内联代码。拦截记录写 `te-gate-log`。 |
| `extensions/tech-expert-agent.ts` | **工具层（L2）**：注册 12 个 te_* 工具（见下），每个工具对应查证顺序的一层，返回结构化 JSON + 下一步提示。 |
| `extensions/te-workflow-core.ts` | **共享基础设施**：`makeBridge`（统一进程外调用 python bridge，解析 BridgeResult JSON）、`toToolResult`、`Workflow`（phase 状态机 + 状态栏进度：查知识/查图谱/查源码/查画像/查文档 5 phase）、路径解析（seatRoot/adaRoot/repoRoot/.venv python）。 |
| `extensions/coms.ts` | **坐席间 P2P 通信**（1,617 行，vendored 自 quant-research）：unix socket/named pipe，`~/.pi/coms/projects/<project>/agents/<name>.json` 注册发现；prompt/response/ping 信封；coms_send/list/get/await 工具；收到会诊后本轮最终 assistant 消息自动打包回传。 |
| `extensions/themeMap.ts` | 按扩展名映射 TUI 主题（`.pi/themes/*.json`），本坐席未配置专属主题（fallback 调色板）。 |

**12 个 te_* 工具**（tech-expert-agent.ts）：
| 工具 | 层 | 职责 |
|---|---|---|
| `te_lookup_enum` | ①知识 | 枚举/常量词典查询（knowledge/enums/），miss 回退实时 grep |
| `te_defects` | ①知识 | 缺陷 + playbooks 双域检索（处置禁区） |
| `te_events` | ①知识 | 历史事件时间线（上游 vs 加工鉴别） |
| `te_trace_field` | ①+③ | 字段追溯：先 agent_data_asset 契约（带版本），miss 走代码取证 |
| `te_job_io` | ①+② | Job 读写面：先 knowledge/batch_jobs/ 标注清单，miss 走图谱拓扑 |
| `te_impact` | ②图谱 | 影响面 BFS（表→SQL→Mapper→调用链→端点），强制标 static-snapshot |
| `te_graph` | ②图谱 | 图谱生命周期唯一入口（status/build/list/switch/prune/resolve） |
| `te_code_search` | ③源码 | 实时 grep（code_bridge），返回 file:line |
| `te_profile` | ④画像 | 数据画像（db_bridge，降级路径，凭据不注入本坐席） |
| `te_doc_search` | ⑤文档 | 意图文档章节检索（knowledge/documents/ 索引） |
| `te_register_unknown` | ⑥写 | 登记业务待确认项 → `knowledge/unknowns/candidate_unknown_U*.json` |
| `te_distill` | ⑥写 | 会诊回流蒸馏 → 各域 `candidate_*.json`（仅有的两个写工具） |

### 2.4 Tools（L3 确定性执行层，python）
| 文件 | 职责 |
|---|---|
| `tools/knowledge_store.py` | knowledge/ 只读查询（domains/list/get/search/candidates），M0 起可用 |
| `tools/enum_dict_builder.py` | 枚举词典构建：扫 Java `static final` + enum 块，带注释与 file:line 出处；同名跨模块不合并标 `ambiguous=true`；build 保留人工修订（merge by name+value+file） |
| `tools/batch_io_builder.py` | Job 读写面骨架：从 CSV 图谱 job→step→component→method→sqlstatement 派生 reads/writes；写入模式/断点由人工标注 |
| `tools/graph_registry.py` | CSV 图谱版本注册表：`workspace/graphs/<repo>/<branch>__<commit>/` + `current.json` 原子指针；漂移检测、锁互斥 build、每分支留 3 版 |
| `tools/doc_index_builder.py` | 意图文档索引：md 解析 heading、docx 解 zip/XML 提标题，pdf/xlsx 只索引文件名；产出 index.json + topics.json |
| `tools/ada_contract.py` | 只读引用 `../agent_data_asset/knowledge/` 契约（list/get/field/search），带版本与 -candidate 标注，不复制不修订 |
| （复用，非自有） | `../agent_data_asset/tools/code_bridge.py`、`code_index_bridge.py`、`db_bridge.py` —— 绝对路径直调，不拷贝不 fork |

### 2.5 Knowledge（专家自有知识，git 管理）
`knowledge/` 目录（`manifest.json` 记录 42 个文件的 sha256/生成时间）：
| 子目录 | 内容 | 样例 |
|---|---|---|
| `enums/` | 22 个模块 JSON，17,840 条枚举常量 | `anytxn-cf-parent.json`（TransBizConstant 三套口径） |
| `batch_jobs/` | 9 个 Job 读写面清单（6 个计提批已标注，含 idempotent/write_pattern/checkpoint） | `dayEndJob.json`（tasklet 内联→图谱不可达，标 skeleton） |
| `defects/` | 已知缺陷 | `defect-batch-intermediate-state.json` |
| `events/` | 事件时间线 | `event-2026-03-gateway-subsidy.json` |
| `playbooks/` | 处置禁区：forbidden + reason + correct + evidence | `pb-001.json`（否决手工 UPDATE 批中间态） |
| `documents/` | 意图文档索引 386 篇 | `index.json`、`topics.json` |
| `unknowns/` | 业务待确认项（含已 resolve 回填） | `candidate_unknown_U20260729100955.json`（plan_status 缺 6，已由 agent_data_asset 契约修正并 promote） |
| （空缺） | `glossary/`、`products/` 在 DOMAINS 常量中声明但目录未建 | — |

### 2.6 Prompts / Settings
- **prompts**：无独立 prompts 目录；提示词即 `.pi/APPEND_SYSTEM.md`（--append-system-prompt 挂载）+ SKILL.md。
- **settings**：`.pi/settings.json` 仅声明两个扩展相对路径（te-gate、tech-expert-agent）；运行态组装实际由 justfile 命令行完成。
- **justfile**：`just te` 是唯一形态——`pi -ne -ns -nc`（关掉自动发现，保证 docs/README 不进运行态）+ 显式 `-e` 挂 3 个扩展 + `--skill` 挂技能 + `--append-system-prompt` 挂人设 + `--cname tech-expert --project credit`（coms 身份）。另有 te-ext-only（排障）、te-build-enums/batchio/docindex（知识构建，人工命令）、te-knowledge（只读查询）。

---

## 3. 组件间引用与组合

### 3.1 运行态组装链
```
just te
  └─ pi -ne -ns -nc                      # 关自动发现（关键约定）
      ├─ --append-system-prompt .pi/APPEND_SYSTEM.md   (L0 人设)
      ├─ --skill .pi/skills/credit-tech-expert          (L0 工作流 + references 按需读)
      ├─ -e extensions/te-gate.ts                       (L4 硬边界，最先拦)
      ├─ -e extensions/tech-expert-agent.ts             (L2 12 个 te_* 工具)
      │     └─ import te-workflow-core.ts → makeBridge → ../.venv/bin/python3
      │         ├─ 本仓 tools/*.py（knowledge_store/graph_registry/ada_contract/...）
      │         └─ ../agent_data_asset/tools/*_bridge.py（code/code_index/db，绝对路径复用）
      └─ -e extensions/coms.ts  --cname tech-expert --project credit   (P2P 会诊)
```

### 3.2 answer-contract 是什么
定义于 `.pi/skills/credit-tech-expert/references/answer-contract.md`，是**每次回答（人或会诊）必须遵守的固定五段式输出契约**：
1. **结论**：一句代码层事实，不含推测（"可能/应该是"降级到边界段）；
2. **证据**：可点验的 file:line / 契约版本（含 -candidate 状态）/ 画像表名+时间窗；结构面必标 `static-snapshot @ <commit>`；
3. **依据**：仅"为什么"类问题出现——`《文档名》§章节`，与代码 file:line 组成**双锚点**（代码证明怎么做，文档证明为什么）；
4. **边界**：不可省略，写明本次取证覆盖范围（查了哪几层、快照多旧、哪些没查）；
5. **需业务方确认**：出现时必带 `te_register_unknown` 返回的 unknown 编号（如 U20260729100955），提问方可凭编号回填。

在 coms 会诊场景，本轮最终 assistant 消息即五段式回答，由 coms.ts 自动打包回传给提问坐席；其他坐席的交付物（契约/建议单）会引用这些出处，构成跨坐席证据链。

### 3.3 monorepo-map 是什么
`.pi/skills/credit-tech-expert/references/monorepo-map.md`——any-product-all **160 模块的人工导览图**，解决"在 21,758 个 Java 文件里乱翻"的问题：
- **高频锚点表**：模块 → 职责 → 关键类 file:line（均经验收验证），如 `RepaymentPlanServiceImpl.java:1644`、`TransBizConstant.java:531-538`；
- **同名常量陷阱表**：三个 `TransBizConstant.java`（transaction/investor/unionloan）+ `CallTxnStatus`（催收口径）+ `BusinessStatusEnum`（API 展示口径）——回答必须带模块语境；
- **批处理结构常识**：计提批家族命名规律 `<资方>LoanInterestProvisionJob`、tasklet 型 Job 图谱不可达、文件驱动批先查 .ok；
- **使用纪律**：先定位模块再 grep，禁止全仓盲搜；检索范围必须写进回答的边界段；错漏经 te_distill 回流扩充。

### 3.4 知识流（写路径）
```
会诊发现 ──te_distill / te_register_unknown──▶ knowledge/**/candidate_*.json
                                                    │（人工采纳 = 去掉 candidate_ 前缀，gate 强制坐席不可写正式文件）
查询路径：te_* 工具先查正式知识（命中即停，绝不重复考证）──▶ 图谱（标快照）──▶ 源码（file:line）──▶ 画像/文档
```
- 跨坐席边界：`ada_contract.py` 只读引用 agent_data_asset 契约（带版本号）；发现矛盾 → 提 unknown 而非自行修订（实例：U20260729100955 推动契约补 6=账单分期并 promote v0.1.0）。
- 图谱资产：`graph_registry.py` 管 `workspace/graphs/`（gitignore 派生物）版本化生命周期；`te_graph` 是唯一 build 入口，裸调 `java -cp jca.jar` 被 gate 正则拦截。

---

## 4. 该项目特有的约定 / 模式

1. **「坐席」多智能体 monorepo 组织**：每个 agent_* 是一个独立 pi 项目，自带 `.pi/` + `extensions/` + `tools/` + `knowledge/` + `justfile`；坐席间经 coms（unix socket P2P）会诊，产物交接走文件系统（消息只传路径指针，不塞大段原文）。
2. **`-ne -ns -nc` 显式组装**：关掉 pi 的扩展/技能/上下文自动发现，一切经 justfile 命令行显式挂载——保证 `docs/`、README 等设计文档**不进入运行态上下文**。
3. **L0/L2/L3/L4 分层**：L0 软引导（人设+技能）、L2 工具层（TS 扩展）、L3 确定性执行（python bridge，统一 BridgeResult JSON）、L4 硬边界（gate 正则在工具调用前拦截）——软规则可以被模型违反，硬边界不能。
4. **bridge 复用不 fork**：agent_data_asset 的 code_bridge/code_index_bridge/db_bridge 以绝对路径进程外直调，随对方演进自动跟随。
5. **candidate → 人工采纳生命周期**：坐席唯一写权限是 `knowledge/**/candidate_*` 与 `workspace/`；「去 candidate_ 前缀」是人工动作（gate 连 `knowledge promote` 命令都拦）。「三次才成坑」——同一缺陷被多次独立踩到才蒸馏。
6. **证据链文化**：一切结论带出处（file:line / 契约版本 / 快照 commit / 文档章节）；`static-snapshot @ <commit>` 强制标注图谱是快照非运行时事实；漂移 >20 commit 前置警告。
7. **诚实未知（unknown 登记）是核心特性而非失败**：业务语义判断不了 → `te_register_unknown` 产出编号，成为跨坐席协作的待办队列（已产出 6 个 unknown，3 个真实推动了契约修正）。
8. **docs ↔ .pi 双向同步纪律**：APPEND_SYSTEM.md 与 CREDIT_EXPERT_KNOWLEDGE.md §1.3/§1.4 一字不改同步；answer-contract.md 与 IMPLEMENTATION_PLAN.md §3.3 同步；改动流程 = 改 docs 设计 → 同步 .pi → PR 同审。
9. **里程碑驱动（M0-M4）+ 真题验收**：每个里程碑用真实会诊题验收（如 pb-001 否决手工 UPDATE、贴息双锚点），验收产出直接回填知识库。
10. **所有权边界防双写**：湖表字段语义/PII/生产凭据归 agent_data_asset；本坐席默认不持有 DB 凭据（te_profile 失败是设计行为），画像需求建议走 coms 会诊。

---

## 5. 关键文件路径速查

- 人设：`.pi/APPEND_SYSTEM.md`
- 工作流：`.pi/skills/credit-tech-expert/SKILL.md`（查证顺序六层）
- 回答契约：`.pi/skills/credit-tech-expert/references/answer-contract.md`
- 模块导览：`.pi/skills/credit-tech-expert/references/monorepo-map.md`
- 工具层：`extensions/tech-expert-agent.ts`（12 个 te_* 工具）
- 硬边界：`extensions/te-gate.ts`
- 共享设施：`extensions/te-workflow-core.ts`
- 会诊通信：`extensions/coms.ts`
- 知识构建：`tools/{enum_dict_builder,batch_io_builder,doc_index_builder,graph_registry}.py`
- 设计文档：`docs/CREDIT_EXPERT_KNOWLEDGE.md`（六层知识模型）、`docs/IMPLEMENTATION_PLAN.md`（M0-M4 方案）
- 启动入口：`justfile`（`just te`）
