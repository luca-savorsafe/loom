# agent_batch_duty 结构化分析报告

> 分析对象：`/Users/mac/worker/code/ai-example/CreditWeaveAI/agent_batch_duty`
> 当前状态：**设计完成，骨架占位，尚未实现**（README 与设计文档均明确标注）。真正的行为契约在设计文档 `docs/BATCH_DUTY_DESIGN.md`，目录下的代码文件大多是占位骨架。

---

## 1. 智能体定位与业务领域

- **定位**：信贷核心系统的「批量任务值班坐席」——跑批监控、异常诊断、处置建议。
- **业务领域**：信贷核心系统（实测标的 any-product-all：160 模块、1470 个 Spring Batch Job）的**多库 Spring Batch 作业运维**。
- **做三件事 + 报一件事**（`docs/BATCH_DUTY_DESIGN.md` §1.2）：
  1. **盯**：确定性采集多库运行状态，按规则检测 5 类异常（断批/龟批/漏跑/阻塞/数据异常），不靠 LLM 判断「是否异常」。
  2. **析**：命中异常后 LLM 结合调度依赖 + 代码结构底图，给影响面与根因线索。
  3. **荐**：产出处置建议单（重跑/跳过/上报 + 置信度 + 依据）。
  4. **报**：git push 建议单 + 通知（邮件/飞书/微信 webhook）。
- **红线（第一原则）**：Agent 对业务系统**只读**，禁止触发/停止/重跑/跳过批任务，禁止写生产库；跳过/重跑按钮永远在调度平台由人执行。输出侧放开（git push + 通知）。
- **自动化边界**（`team.json`）：`A（只读推送型）`——诊断+建议产出即推送，不设坐席内审批。
- **架构蓝本**：复用 `../agent_data_asset/` 的三层模式（pi 席位 extensions + 确定性 bridge tools + gate 硬边界）。代码底图来自 `java-code-analyzer` / `java-codegraph` skill 的 CSV 图谱（消费方，非生产者）。

---

## 2. 组件清单

### 2.1 persona

- **没有 `.pi/persona/` 目录**（尚未创建）。人设目前全部落在 `.pi/APPEND_SYSTEM.md`。
- 设计文档 §10 规划了 `.pi/persona/{watch,diagnose}.md`（两个席位各自的人设），未实现。
- 团队级身份在 `../team.json` 的 `seats[]` 中（SSOT）：`id: batch-duty`，`cname: batch-duty`，`purpose: 跑批监控、异常诊断、处置建议`，`icon: 🖥️`，`color: #d64550`。team.json 自带 `_sync_rule`：角色变更先改 team.json，再同步 persona / justfile `--cname/--purpose`，PR 同审。

### 2.2 prompts（APPEND_SYSTEM）

文件：`.pi/APPEND_SYSTEM.md`（全文约 40 行，是唯一已实现的人设文件）

- 角色声明：「批量任务值班坐席」，负责多库 Spring Batch 监控/诊断/建议。
- **红线（硬边界）**：只读业务系统、产出处置建议单交人工执行、输出侧放开（git push + 通知）。
- **能做什么**：确定性采集 + 5 类异常检测；LLM 结合依赖 + 代码底图做影响分析；出带置信度的建议。
- **不做什么**：不启停批任务、不写生产库、不猜业务结论（判断不了登记 unknown 升级给人）。
- **会诊关系**：直问 `tech-expert`（代码层事实：Job 读写面/幂等性/断点机制）、直问 `data-asset`（数据口径/表结构/PII 策略）。

### 2.3 skills

目录：`.pi/skills/batch-duty/SKILL.md`（唯一 skill，骨架占位）

- 定义值班工作流四段：
  1. **监控采集**：连多库采 Spring Batch 状态，结构化输出 `job_id / status / start_time / duration / exit_code`。
  2. **异常检测（5 类规则）**：断批（`exit_code != COMPLETED`）、龟批（`duration > baseline * 3`）、漏跑（scheduled but not started）、阻塞（dependency chain broken）、数据异常（row_count 偏离基线）。
  3. **诊断**：断因三分流（上游数据 → 系统资源 → 代码逻辑）+ 会诊 tech-expert / data-asset。
  4. **建议**：处置建议单 JSON（`action / confidence / reason / rollback`），git push + 通知推送。
- 设计文档 §10 还规划了 `batch-watch` / `batch-diagnose` 两个独立 skill 和 `_shared/gate.md` 共享模板，均未实现（当前只有一个 `batch-duty` skill）。

### 2.4 extensions（pi 扩展，提供 tool / gate）

目录：`extensions/`，共 4 个文件，其中 2 个是指向 `_shared` 的符号链接：

| 文件 | 状态 | 职责 |
|---|---|---|
| `extensions/batch-duty-gate.ts` | 骨架（仅导出 `name`） | 硬边界：生产只读红线、禁批任务控制命令、bash/写放行白名单。设计文档 §6 有完整规则（实现参考 `rd-gate.ts` / `dd-gate.ts`） |
| `extensions/batch-duty-agent.ts` | 骨架（仅导出 `name`） | 值班坐席逻辑（实现参考 `tech-expert-agent.ts` / `copilot-agent.ts`） |
| `extensions/coms.ts` | 符号链接 → `../../_shared/extensions/coms.ts`（已实现，跨项目共享） | 本机 agent 间 P2P 消息：unix socket + `~/.pi/coms/projects/<project>/agents/*.json` 注册表；提供 `coms_list/send/get/await` 工具、`agent_end` 自动回包、`/coms` 命令。值班场景的关键：外部 Python bridge 可直接当 socket client 写 `prompt` 信封唤醒 watch-agent |
| `extensions/themeMap.ts` | 符号链接 → `../../_shared/extensions/themeMap.ts` | 按扩展文件名映射 TUI 主题（`.pi/themes/<name>.json`），`applyExtensionDefaults` 在 session_start 自动套主题 |

设计文档 §4.1/§10 规划但尚未创建的扩展：
- `bp-gate.ts`（= 现在的 batch-duty-gate.ts 的完整版）
- `bp-workflow-core.ts`（沿用 agent_data_asset 的 `rd-workflow-core.ts`：Workflow 进度 + `runBridge` + `toToolResult` 共享设施）
- `watch-agent.ts` / `diagnose-agent.ts`（两个常驻独立终端席位）
- `coms-net.ts`（远程面：Bun HTTP/SSE hub，供手机值班 AI 跨网接入）

### 2.5 tools（确定性 bridge）

目录：`tools/` 当前**只有 `.gitkeep`**，全部待实现。设计文档 §4/§10 规划（纯 Python、无 LLM、可复现）：

| 规划文件 | 职责 | 数据源 |
|---|---|---|
| `batch_bridge.py` | 委派入口（对应 agent_data_asset 的 `knowledge_bridge.py`） | — |
| `batch_monitor_bridge.py` | 多库 `BATCH_*` 表聚合 + 5 类异常检测 + 内置 `coms_client`（命中断批且状态跃迁时向 watch-agent 发 prompt 信封）；由外部调度平台每 5 分钟拉起 | 源① |
| `schedule_bridge.py` | 读自研调度触发表 + 依赖表（漏调度 + 阻塞面） | 源②③ |
| `codegraph_bridge.py` | 查 java-codegraph CSV 底图（batch / batch-io / blast / feign-deps） | 源④ |
| `probe_bridge.py` | 业务表只读探查 + 上游文件元信息检查 | 源⑤⑥ |
| `log_bridge.py` | 跑批日志检索（job name + business_date + 时间窗，只回命中片段） | 源⑦ |
| `notify_bridge.py` | git push + 邮件/飞书/微信 webhook（白名单端点） | — |
| `diagnose_bridge.py` | 多源汇总，产出结构化诊断包 | 汇总 |

> 注意：README 中的 tools 清单（`monitor_bridge.py` / `anomaly_detect.py` / `advisory_bridge.py`）与设计文档 §10 的命名不完全一致——README 更简，设计文档为准。

### 2.6 knowledge

目录：`knowledge/` 当前**只有 `.gitkeep`**，全部待实现。

- README 规划：`job_manifest.json`（Job 清单与 SLA）、`dependency_graph.json`（调度依赖拓扑）、`playbooks/`（处置预案）。
- 设计文档 §10 规划：`knowledge/batch_baseline/*.json`（耗时基线等本地派生，gate 放行写的白名单路径之一）。
- 真正的一手知识其实是**外部七源**（设计文档 §2，「七源盘点已完成」）：
  1. Spring Batch `BATCH_*` 元数据表（多库）——监控主力
  2. 自研调度触发表（计划/SLA/责任人）
  3. 自研调度依赖表（DAG 边）
  4. java-code-analyzer CSV 代码底图（Job→表/服务/影响面）
  5. 业务库只读副本（已脱敏）
  6. 上游文件目录（文件驱动批前置条件）
  7. 跑批日志（文件 / ELK / Loki）
- **命门**：`job_name ⇄ 调度id ⇄ 库` 三源 join key 映射表（§2.8），对不上则整个 Agent 不成立，是阶段 0 前置任务。

### 2.7 settings

文件：`.pi/settings.json`，极简：

```json
{ "model": null, "theme": "nord" }
```

- `model: null` = 用 pi 默认模型；`theme: nord`（但 themeMap.ts 的 THEME_MAP 里**没有** batch-duty 相关条目，主题映射尚未接线）。

### 2.8 justfile（dev loop 入口）

文件：`justfile`（全部命令目前都是 echo 占位）

| 命令 | 用途 |
|---|---|
| `just bp` | 全席位交互式坐席（pi TUI + coms 常开）。占位中已写明实现后的真实启动命令，是理解加载方式的关键：`pi -ne -ns -nc -e extensions/batch-duty-agent.ts -e extensions/batch-duty-gate.ts -e extensions/coms.ts --skill .pi/skills/batch-duty --append-system-prompt .pi/APPEND_SYSTEM.md --cname batch-duty --purpose "..." --project credit` |
| `just bp-monitor` | 监控席位（只盯不诊，安静模式无 coms）——待实现 |
| `just bp-diagnose` | 诊断席位（分析+建议）——待实现 |
| `just design` | `cat docs/BATCH_DUTY_DESIGN.md | head -100` |

仓根运行方式：`just -f agent_batch_duty/justfile <cmd>`。

---

## 3. 各组件之间的引用与组合

### 3.1 加载链路（启动时如何拼装）

```
justfile (bp)
  └─ pi CLI
       ├─ --append-system-prompt .pi/APPEND_SYSTEM.md     → 人设注入 system prompt
       ├─ --skill .pi/skills/batch-duty                    → 工作流技能（SKILL.md）
       ├─ -e extensions/batch-duty-agent.ts               → 坐席逻辑（注册 bp_* 工具）
       ├─ -e extensions/batch-duty-gate.ts                → 硬边界（拦截越界 bash/写）
       ├─ -e extensions/coms.ts (symlink → _shared)       → 通信平面（注册 coms_* 工具）
       ├─ --cname batch-duty --purpose "..." --project credit
       │     → coms 身份；--project 必须与 bridge 脚本查注册表用的 project 完全一致
       └─ .pi/settings.json                                → theme/model
```

### 3.2 运行时数据流（设计稿，§4.2.3）

```
外部调度平台 ─每5分钟─▶ tools/batch_monitor_bridge.py（无 LLM）
                            │ 扫多库 BATCH_* + 5类确定性检测
                            │ 命中且状态跃迁 → 直连 unix socket 写 prompt 信封
                            ▼
                      watch-agent（常驻 pi 进程，coms.ts）
                            │ pi.sendMessage(triggerTurn) 自动唤醒一个 turn
                            │ 总览/分诊 → coms_send target=diagnose-agent + coms_await
                            ▼
                      diagnose-agent（常驻 pi 进程）
                            │ bp_log/bp_io/bp_file/bp_data/bp_impact → 各 bridge
                            │ bp_advise 出建议单 → bp_notify（git push + webhook）
                            ▼
                      runbook/advice_*.md + 通知（邮件/飞书/微信）
手机值班 AI ── coms-net.ts (HTTP/SSE hub, bearer token) ──▶ watch/diagnose
```

### 3.3 skill / knowledge / extension 的引用关系

- **skill → 工具**：SKILL.md 的工作流步骤引用 extension 注册的工具（规划中 `bp_status / bp_anomalies / bp_job / bp_missing`（watch 席位）和 `bp_log / bp_impact / bp_rootcause / bp_io / bp_data / bp_file / bp_advise / bp_notify`（diagnose 席位），设计文档 §5）。
- **extension(tool) → bridge**：`bp_*` 工具内部经 `bp-workflow-core.ts` 的 `runBridge` 委派 `python3 tools/*_bridge.py`；bridge 输出统一诊断包 JSON（§5.3：`status/action/summary/details{...}/coverage/source/notes`）。
- **bridge → knowledge / 七源**：bridge 读 `BATCH_DB_URLS / BIZ_DB_URLS / SCHED_DB_URL / JCA_CSV_DIR / BATCH_FILE_ROOTS / BATCH_LOG_ROOTS`（`.env`）连接外部数据源；基线派生物落回 `knowledge/batch_baseline/`。
- **gate 贯穿所有**：gate 拦截 bash 白名单（只读命令 + `python3 tools/*.py` + git 只读/add/commit/push + notify_bridge），写白名单仅 `runbook/**/advice_*.md`、`runbook/**/incident_*.md`、`knowledge/batch_baseline/*.json`；出网白名单仅通知 webhook + git 远端 + coms-net hub URL。
- **会诊（agent ↔ agent）**：APPEND_SYSTEM.md 声明直问 tech-expert / data-asset；工程上通过 coms.ts（`--project credit` 同命名空间，`team.json` 的 `coms_project: "credit"`）实现。

---

## 4. 项目特有的约定 / 模式

1. **三层架构（复用 agent_data_asset）**：pi 席位（extensions）/ 确定性桥（tools/*.py，无 LLM 可复现）/ gate 硬边界。判断类逻辑（异常检测）放确定性代码，LLM 只做诊断——「是否超时/失败是阈值问题，LLM 不可靠且贵」（§8 决策表）。
2. **gate 模式（硬边界优于软提示）**：红线不靠 prompt 自觉，靠 gate 拦截。本项目的红线与 agent_data_asset 不同——**核心不是 PII（数据已脱敏）而是「只读生产 + 禁批任务控制」**；且**输出侧放开**（git push + 通知 webhook 白名单放行，`curl/wget` 不一刀切拦，按目标白名单）。
3. **双席位常驻进程模型**（区别于 agent_data_asset 的单终端多席位）：watch 与 diagnose 是两个独立常驻终端，同机经 coms.ts（unix socket）互通，手机端跨网经 coms-net.ts（HTTP/SSE hub）。
4. **无会话脚本唤醒席位（coms envelope 协议复用）**：`batch_monitor_bridge.py` 无 pi 会话，直接读 `~/.pi/coms/projects/<project>/agents/*.json` 注册表拿 socket 路径，手写一行 JSON `prompt` 信封（必填 `hops:0`、`timestamp`、`type:"prompt"`）触发 watch-agent 的 turn；`sender_endpoint` 填不存在路径实现 fire-and-forget。信封格式以 `_shared/extensions/coms.ts` 的 `isValidEnvelope` 为准。
5. **告警防风暴约定**：bridge 只在**状态跃迁**（新出现/状态变化）时发信封，绝不每轮 triggerTurn（§4.2.7、§9.8）。
6. **coms 防环约定**：`agent_end` 会把对方最后一段助手文本自动当回包，diagnose **不要**再手动 coms_send 回复；`hops` 自增 + `MAX_HOPS=5` 兜底（§4.2.5）。
7. **断因三分流**：上游数据（文件没到，等上游）→ 系统资源/数据异常 → 代码逻辑（程序异常），逐层排除，处置动作完全不同。典型诊断链：`bp_log → bp_io → bp_file → bp_data → bp_impact → bp_advise → bp_notify`。
8. **输出契约**：
   - 诊断包 JSON（§5.3）：必须带 `coverage`（partial/full）、`source`（数据源 + 快照时间/commit）、`notes`（含「静态影响面是语法可达上界」「处置需人工执行」等限定语）。
   - 处置建议单：`runbook/**/advice_*.md` + JSON 字段 `action / confidence / reason / rollback`（SKILL.md §4）。
   - 事件记录：`runbook/**/incident_*.md`。两者 git push 留痕，不依赖 LLM 记忆。
9. **unknown 升级约定**：代码判断不了的业务结论不猜，登记 unknown 升级给人（与 tech-expert 坐席同一约定）。
10. **team.json SSOT 同步规则**：坐席身份（cname/purpose/role）的唯一事实源是 `../team.json`，persona 与 justfile 的 `--cname/--purpose` 必须与之同步，PR 同审。
11. **共享资产符号链接**：`extensions/coms.ts`、`extensions/themeMap.ts` 是指向 `../_shared/extensions/` 的 symlink——跨坐席共享扩展通过 symlink 复用，不复制代码。
12. **五类异常检测（确定性规则）**：失败（status=FAILED）、超时/龟批（> 历史基线×阈值，如 P95×1.5）、卡死/僵尸（STARTED 超时且 STEP read/write_count 两轮无增长）、漏调度（触发表该跑但无 business_date 执行记录）、上游阻塞（依赖表下游卡 pending）；另有隐性故障「跑成功但 read_count 远低于历史」。
13. **落地路线原则**：「监控 Agent 的天花板由数据源决定，先摸清数据再搭 Agent」——阶段 0（数据源盘点 + join key 验证）→ 阶段 1（确定性监控层，纯 CLI）→ 阶段 2（诊断席位接 LLM + 通信平面）→ 阶段 3（实时化/看板，可选）。

---

## 5. 关键文件索引

| 文件 | 内容 |
|---|---|
| `agent_batch_duty/README.md` | 项目入口：定位、状态、目录结构、设计原则 |
| `agent_batch_duty/docs/BATCH_DUTY_DESIGN.md` | **最重要文档**（约 460 行）：七源盘点、5 类异常、三层架构、进程/通信模型、gate 规则、席位工具表、落地路线、风险 |
| `agent_batch_duty/.pi/APPEND_SYSTEM.md` | 唯一已实现的人设（红线 + 能/不能 + 会诊关系） |
| `agent_batch_duty/.pi/skills/batch-duty/SKILL.md` | 值班工作流四段（骨架） |
| `agent_batch_duty/.pi/settings.json` | `{model: null, theme: nord}` |
| `agent_batch_duty/extensions/batch-duty-gate.ts` | gate 骨架（仅导出 name，注释列红线） |
| `agent_batch_duty/extensions/batch-duty-agent.ts` | 坐席骨架（仅导出 name） |
| `agent_batch_duty/extensions/coms.ts` → `_shared/extensions/coms.ts` | 已实现的本机 P2P 通信扩展（ symlink ） |
| `agent_batch_duty/extensions/themeMap.ts` → `_shared/extensions/themeMap.ts` | 主题映射（symlink） |
| `agent_batch_duty/justfile` | `bp / bp-monitor / bp-diagnose / design`，占位 echo + 实现后的真实 pi 启动命令 |
| `agent_batch_duty/tools/`、`knowledge/`、`workspace/` | 仅 `.gitkeep`，待实现 |
| `../team.json` | 团队坐席 SSOT（batch-duty 条目 + `_sync_rule`） |
| `../agent_data_asset/` | 架构蓝本（rd-gate / rd-workflow-core / 三席位模式） |

---

## 6. 实现时需注意的空白与风险（给后续 agent）

- **README 与设计文档的命名漂移**：README 的 tools/文件名（`monitor_bridge.py` 等）与 justfile 席位名（`bp-monitor/bp-diagnose`）跟设计文档（`batch_monitor_bridge.py`、`watch-agent/diagnose-agent`、`bp-gate.ts`）不一致，实现前需对齐（以设计文档为准）。
- 设计文档 §10 规划的 `bp-workflow-core.ts`、`coms-net.ts`、`.pi/persona/`、`batch-watch/batch-diagnose` skill、`_shared/gate.md`、`runbook/`、`.env.example` 均不存在。
- `themeMap.ts` 的 THEME_MAP 中没有 batch-duty 条目（settings.json 的 `theme: nord` 是 settings 层生效，themeMap 映射未接线）。
- 前置硬依赖：`job_name ⇄ 调度id ⇄ 库` 映射（§2.8 命门）、只读账号/副本、自研调度表 DDL 盘点、`batch-io` action 需加到 java-codegraph skill。
- 已知风险（§9）：静态影响面是上界需人工收敛、代码底图快照会过期、基线冷启动、日志检索准召、告警风暴需去重/静默窗。
