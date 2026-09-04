# agent_data_asset 智能体项目分析报告

> 分析对象：`/Users/mac/worker/code/ai-example/CreditWeaveAI/agent_data_asset`
> 分析日期：2026（基于当前仓库快照）

---

## 1. 智能体定位与业务领域

**定位**：信贷数据**元数据/数据标准**管理坐席（coms 坐席名 `data-asset`，team.json 角色 `data-asset`）。正式名称 **CreditData Agent**——CreditData 信贷数据资产平台的对话式数据标准工作台。

**业务领域**：信贷（credit）行业的数据资产治理。服务对象是三类人：

| 工作流 | 使用者 | 场景 | 产出 |
|---|---|---|---|
| A 查询流（copilot） | 风险/催收/财务/监管开发（数据消费者） | 「某字段能不能用/怎么用」 | 只读问答，带引用 |
| B 沉淀流（steward） | 数据开发（数据生产者） | 把一张表的口径/标准沉淀为候选契约 | candidate 契约 + 字段目录 |
| C 语义梳理流（curator） | 数据平台/治理（整理者） | 跨表批量收敛同义字段为概念层 + 数据体检 | candidate 语义 catalog/mapping + issues |

**核心信条**（README.md:1-4）：
- 数据访问：生产库为唯一事实源（`tools/db_bridge.py` + `db.py`，凭据走 `RISK_DB_URL`/`MYSQL_*`）。
- 持久资产：知识层（`knowledge/`，Git 管理的单一事实源，纯确定性、不触库、不用 RAG/向量库）。
- 架构：三层半固定架构（skill 软引导 / ds_* 工具半固定 / rd-gate 硬边界）。

---

## 2. 组件清单

### 2.1 Persona（`.pi/persona/`）— 三份席位人设，聚焦模式用

| 文件 | 职责 |
|---|---|
| `.pi/persona/copilot.md` | 查询席位人设：遵循 `risk-dev-copilot` skill，只读问答 + 会诊协议（coms 形态下呼 `tech-expert` 要代码层事实） |
| `.pi/persona/steward.md` | 沉淀席位人设：遵循 `knowledge-steward` skill，单表沉淀 candidate 契约，`ds_validate` 必过 |
| `.pi/persona/curator.md` | 语义梳理席位人设：遵循 `semantic-curator` skill，只产 candidate + issues，pending_owner 只上报不拍板 |

另有一份全局人设 `.pi/APPEND_SYSTEM.md`（CreditData Agent 工作台总人设），定义三条工作流、硬规矩、输出风格、会诊协议（coms 坐席 `data-asset` 的对外纪律 5 条）。聚焦席位启动时（`just rd-copilot` 等）用 persona 文件替代 APPEND_SYSTEM 作为 `--append-system-prompt`。

### 2.2 Skills（`.pi/skills/`）— 软引导层

| Skill | 文件 | 职责 |
|---|---|---|
| `risk-dev-copilot` | `.pi/skills/risk-dev-copilot/SKILL.md` | 查询流引导：5 phase（locate→retrieve→rule-check→answer→impact）、答案可信度分层（契约>candidate>field_catalog draft>语义层）、会诊路由 |
| `knowledge-steward` | `.pi/skills/knowledge-steward/SKILL.md` | 沉淀流引导：6 phase（explore→inspect→draft→mapping→validate→handoff）、双源探索纪律（DB + 代码必备）、归一类型词汇表硬纪律、代码口径多轮召回启发式、验证披露纪律 |
| `semantic-curator` | `.pi/skills/semantic-curator/SKILL.md` | 语义梳理流引导：6 phase（scope→cluster→propose→detect→triage→handoff）、问题三分类（就地修复/上报 Owner/转 ETL） |
| `drawio-skill` | `.pi/skills/drawio-skill/SKILL.md` + references/ + scripts/ + styles/ | 通用画图 skill（drawio XML 生成 + CLI 导出 PNG/SVG/PDF），三席位共用；**本项目定制**：图统一写 `knowledge/diagrams/`（gate 只放行该目录），明文 PII 不入图 |
| `_shared/gate.md` | `.pi/skills/_shared/gate.md` | rd-gate 边界速查（三席位共享）：写文件白名单/黑名单、bash 白名单/黑名单、三条铁律、常见误区 |
| `_shared/knowledge-model.md` | `.pi/skills/_shared/knowledge-model.md` | knowledge 数据模型与使用规范：目录结构、candidate 命名规范、契约/概念/映射 JSON 格式骨架、origin+role 分层双轴、两个硬约束（type 须与生产库一致、missing_in_db 加 `db_synced:false`）、validate 常见报错 |
| `_shared/review-report-template.md` | `.pi/skills/_shared/review-report-template.md` | 候选交付审核报告模板（Agent 手写 `candidate_<table>.md`，11 段结构，口径结论必带 file:line 出处，非第二事实源） |

### 2.3 Extensions / Tools（`extensions/`）— 工具层 + 硬边界层

pi（`@earendil-works/pi-coding-agent`）TypeScript 扩展，经 `.pi/settings.json` 自动加载 4 个（copilot/steward/curator/rd-gate），`coms.ts` 由 justfile 显式 `-e` 加载。

| 文件 | 职责 |
|---|---|
| `extensions/copilot-agent.ts`（121 行） | 查询席位扩展。注册 5 个只读工具 `ds_explain_field / ds_check_leakage / ds_impact / ds_ancestry / ds_concept` + `rd-summary` 命令；5 phase Workflow |
| `extensions/steward-agent.ts`（239 行） | 沉淀席位扩展。注册 `ds_db_explore / ds_code_explore / ds_code_index / ds_inspect_schema / ds_suggest_contract / ds_suggest_mapping / ds_align_contract / ds_validate`；6 phase Workflow |
| `extensions/curator-agent.ts`（104 行） | 语义梳理席位扩展。注册 `ds_sem_suggest / ds_sem_handoff`（后者用 `writeFileSync` 直接落盘 candidate_semantic_catalog/mapping.json + semantic_issues.json）；6 phase Workflow |
| `extensions/rd-workflow-core.ts`（182 行） | 共享基础设施：`Workflow` 类（phase 状态机 + `tool_execution_start/end` 钩子自动翻转 + `ctx.ui.setStatus` 单行进度）、`makeBridge`（统一子进程调 `tools/knowledge_bridge.py`，解析 JSON envelope；Python 解析优先级 `RD_PYTHON` > 仓根 `.venv` > 系统 python3）、`toToolResult`（统一工具返回契约 status/summary/next_actions/details）、路径解析 `pkgRoot/knowledgeRoot/bridgePath` |
| `extensions/rd-gate.ts`（153 行） | 硬边界。`pi.on("tool_call")` 拦截 write/edit/bash：write 白名单=knowledge/ 下 `candidate_*`（必须在 contracts/ 或 semantic/ 子目录）、`semantic_issues.json`、`diagrams/`；bash 白名单=只读命令 + git 只读/add/commit + `python3 tools/*.py` + rdp knowledge 只读子命令 + drawio/dot + `rm` 单个 candidate_*；黑名单=联网/装包/git push 及破坏性 git/knowledge publish/rm -rf。拦截记 `rd-gate-log` |
| `extensions/coms.ts`（1617 行） | 坐席间 P2P 消息（unix socket/named pipe + `~/.pi/coms/projects/<project>/agents/<name>.json` 注册表）。工具 `coms_list/send/get/await`，身份经 `--cname data-asset --purpose ... --project credit`（justfile `rd` 命令注入）或 `PI_COMS_*` 环境变量 |
| `extensions/themeMap.ts`（107 行） | 按扩展文件名映射 `.pi/themes/*.json` 主题（当前 map 主要是 quant-* 主题，本包扩展未显式配置） |

**工具→bridge 映射**（设计文档 §7.5 表）：所有 `ds_*` 工具都经 `runBridge(cwd, action, args)` → `python tools/knowledge_bridge.py <action>` → 委派到 `knowledge/` Python 库或其他 bridge。

### 2.4 Python Bridge 层（`tools/`）— 确定性事实层

| 文件 | 职责 |
|---|---|
| `tools/knowledge_bridge.py` | **统一分发入口**。16 个 action（summary/inspect_schema/explain_field/concept/check_leakage/impact/ancestry/suggest_mapping/validate/suggest_contract/align_contract/pii_field/code_explore/db_explore/code_index），stdout 只打一个 JSON 对象（status/summary/details/error_kind/recovery_hint）。含信任分层合并逻辑（explain_field 的 trust high/medium/low） |
| `tools/db_bridge.py` | 生产库只读探索（SQLAlchemy，MySQL 为主）：list-tables/describe/profile/to-catalog。三条硬约束：只读、PII 强制脱敏（high_plain 只给聚合统计）、凭据只从环境变量读。支持 `RISK_DB_ALLOWED_DBS` 库白名单 |
| `tools/code_bridge.py` | Java/SQL 源码实时探索（tree-sitter）：grep/read/refs/field/collect/field-lineage。确定性检索不保证完备（标 coverage=partial），片段过密钥/PII 过滤；`RD_CODE_PATH` 支持本机路径或 git 地址（clone 到 `~/.cache/data-asset/code`） |
| `tools/code_index_bridge.py` | 离线代码结构图谱（java-code-analyzer/Spoon 全量静态分析 CSV）：build/status/endpoints/callers/callees/impact/sql/lineage/batch。产出标 `static-snapshot @ commit`；impact = 表→SQL→Mapper→调用链 BFS→API 端点（语法可达上界，含多态标记）。依赖 `bin/jca.jar`（57MB，不入 git） |
| `tools/contract_bridge.py` | 契约 align（契约↔生产库 schema 对齐：type_mismatch/missing_in_db/undocumented）+ suggest（生成 candidate 契约，origin/role 双轴）。类型归一唯一实现在 `db.py norm_type` |
| `tools/pii_bridge.py` | 内容级 PII 扫描+脱敏（确定性规则，不用 LLM）：字段名关键词分级（high_plain/high_hashed/medium/low）+ 中国常见 PII 值模式（手机号/身份证/银行卡/邮箱/IP）。明确约定 customer_id/loan_id 等业务标识**不算 PII** |

### 2.5 Knowledge 层（`knowledge/`）— 单一事实源

**Python 库**（纯确定性、不触库）：

| 文件 | 职责 |
|---|---|
| `knowledge/base.py` | `KnowledgeBase`：加载/精确检索 field_catalog、dataset_catalog、semantic、contracts（扁平结构，领域看 `business_domain` 字段非目录） |
| `knowledge/actions.py` | 共享只读操作（summary/field_info/concept_info/impact/ancestry/suggest_mapping），是 rdp CLI 与 knowledge_bridge 的共同后端 |
| `knowledge/lineage.py` | `LineageGraph`：igraph 血缘图，impact/ancestry/DAG 校验 |
| `knowledge/lineage_bootstrap.py` | 从 dataset_catalog + contracts + semantic_mapping 生成 `lineage/derived.json`（派生产物，勿手改） |
| `knowledge/rules.py` | `RuleEngine`：加载 `rules/*.rules.yaml`，`when` 用 simpleeval 在白名单变量（field/dataset/contract/concept/mapping/task）下求值；缺变量判 skipped 不报错 |
| `knowledge/semantic_bootstrap.py` | 三信号聚类（名字归一/同源/dtype）反向提候选概念/映射 + 检测 issue（duplicate_alias/multi_source/typo 等） |
| `knowledge/validate.py` | `validate_knowledge`：JSON Schema + 引用完整性 + 血缘 DAG 无环 + 语义映射完整性 |
| `knowledge/citations.py` | 审核报告出处机器校验：无出处结论 warning、出处漂移检查（文件存在/行号范围）、出处精确性（字段名须出现在引用行 ±3 行窗口）；源码根解析 `CREDIT_SOURCE_ROOT`/`RD_CODE_PATH` |
| `knowledge/promote.py` | **人工/CI 侧**（gate 拦 agent）：`promote_candidate`（去 candidate_ 前缀 + 去版本 -candidate 后缀 + 清理同名 .md + 晋升后全库 validate 必过）、`build_manifest`（正式资产 sha256 + git commit → manifests/knowledge_manifest.json） |

**数据资产**（Git 管理）：

```
knowledge/
├── schemas/                        7 个 JSON Schema（dataset_contract / field_catalog /
│                                   knowledge_manifest / lineage / rules / semantic_catalog / semantic_mapping）
├── field_catalog.json              字段目录（bootstrap 从生产库生成，draft，人工细化）
├── dataset_catalog.json            数据集目录
├── contracts/                      扁平结构；当前仅 2 个 candidate：
│                                   candidate_cm_customer_first_level.{json,md}
│                                   candidate_cm_customer_second_level.{json,md}
│                                   （示例契约字段带 source: "CmCustomerFirstLevel.java:19" 出处）
├── semantic/                       semantic_catalog.json（当前空 concepts:[]）/
│                                   semantic_mapping.json / candidate_semantic_catalog.json
├── lineage/                        derived.json（生成物）+ manual.field_derives.json（人工补充）
├── rules/                          10 个 *.rules.yaml：leakage_core/pii_core（核心红线）+
│                                   leakage/modeling_usage/channel/contactability/device/ledger/
│                                   repayment/share（业务口径），扁平共存，applies_to 选择器控制适用性
└── diagrams/                       drawio 图产物（派生、gitignore）
```

规则样例（`knowledge/rules/leakage_core.rules.yaml`）：`core_pit_time_leak`（`field.available_time > dataset.as_of_date` → PIT 泄漏，severity error）、`core_label_as_training_feature`、`core_decision_outcome_as_feature`（既有决策产物禁作训练特征）。

### 2.6 Prompts / Settings

| 组件 | 内容 |
|---|---|
| `.pi/APPEND_SYSTEM.md` | 全局系统提示追加（全席位 `just rd` 用）：三流定义、硬规矩 5 条、输出风格、会诊协议 5 条纪律 |
| `.pi/persona/*.md` | 聚焦席位的系统提示（见 §2.1） |
| `.pi/settings.json` | 仅声明 4 个 extensions 自动加载路径（`../extensions/*.ts`）；`.pi/themes/` 11 个主题 JSON |
| `.pi/skills/*/SKILL.md` | skill frontmatter（name/description）经 `--skill` 参数加载 |

### 2.7 其他入口

| 文件 | 职责 |
|---|---|
| `__main__.py` / `app/cli.py` / `app/commands/knowledge.py` | `rdp` CLI（人读前端）：`rdp knowledge validate/summary/search/field/concept/impact/ancestry/suggest-mapping/promote/manifest/lineage-bootstrap` |
| `db.py`（86 行） | 生产库连接唯一实现（`db_url`/`get_engine`/`describe_table`/`norm_type`） |
| `bootstrap.py`（154 行） | 生产库 schema → field_catalog 骨架摄入器（**唯一触库的知识生产者**，默认信贷主链路 8 表，`--all` 全库跳过 batch_/tl_/tmp_） |
| `.env` / `.env.example` | 凭据与路径配置（RD_CODE_PATH、RD_CODE_INDEX_DIR、RD_JCA_JAR、RISK_DB_URL/MYSQL_*、RISK_DB_ALLOWED_DBS、RD_PYTHON 等），.env 已 gitignore |
| `tests/` | 7 个 pytest 文件（bridges/citations/e2e_sink/knowledge/lineage_bootstrap/promote/semantic_bootstrap） |
| `docs/` | AGENT_DATA_ASSET_DESIGN.md（1738 行主设计文档，§7 是 Agent 设计）+ SEMANTIC_LAYER_METHOD.md + CODE_BRIDGE_IMPACT_ACTION.md |
| `justfile` | 入口编排（见 §5） |

---

## 3. 组件间引用与组合方式

### 3.1 运行时调用链（一次 ds_* 工具调用）

```
LLM 调 ds_explain_field(dataset, field)
  └─ extensions/copilot-agent.ts  (pi.registerTool)
       ├─ wf.setCtx / Workflow phase 翻转 (rd-workflow-core.ts)
       └─ runBridge(cwd, "explain_field", args)               (makeBridge)
            └─ 子进程: $PYTHON tools/knowledge_bridge.py explain_field <ds> <fld>
                 └─ agent_data_asset.knowledge.actions.field_info
                      └─ knowledge/base.py KnowledgeBase（读 knowledge/*.json）
                 ← stdout JSON envelope {status, summary, details}
            ← toToolResult(res, next_actions[]) → 人读文本 + 结构化 details
```

委派链：`knowledge_bridge.py` 对 suggest_contract/align_contract/pii_field/code_explore/db_explore/code_index 分别 `import contract_bridge/pii_bridge/code_bridge/db_bridge/code_index_bridge`（同目录 `sys.path` 注入）。

### 3.2 启动组合（justfile）

- `just rd`（全席位主形态）：`pi -ne -ns -nc` + 4 个扩展 + `coms.ts` + 4 个 `--skill` + `--append-system-prompt .pi/APPEND_SYSTEM.md` + coms 身份 `--cname data-asset --purpose "..." --project credit`。
- `just rd-copilot / rd-steward / rd-curator`（聚焦席位）：`-ne` 关闭 settings.json 自动发现，只 `-e` 该席位扩展 + `rd-gate.ts`，`--append-system-prompt` 换对应 persona。
- 注意：聚焦模式不显式传 `--skill`，依赖 skill 自动发现（`.pi/skills/` 目录约定）。

### 3.3 skill ↔ 共享文件 ↔ extension 的引用

- 三份业务 SKILL.md 都在「边界」节引用 `../_shared/gate.md`，知识格式引用 `../_shared/knowledge-model.md`，交付引用 `../_shared/review-report-template.md`——**_shared/ 是三席位共享的单一事实引导**，避免三处漂移。
- SKILL.md 中描述的工具名与 extensions 里 `pi.registerTool` 的 name 一一对应（ds_* 命名约定）。
- `_shared/gate.md` 是 `rd-gate.ts` 的人读镜像（"由 extensions/rd-gate.ts 在运行时硬拦"）。

### 3.4 数据流（知识生命周期）

```
生产库 (唯一事实源)                源码库 (RD_CODE_PATH)
   │ bootstrap.py（唯一触库写入者）      │ code_bridge / code_index_bridge（只读）
   ▼                                   ▼
field_catalog.json (draft)  +  口径出处（file:line，写进契约 description/审核报告）
   │ ds_suggest_contract / ds_sem_suggest
   ▼
candidate_*.json（agent 只能写到这里，gate 硬拦）
   │ + 手写 candidate_<table>.md 审核报告（citations.py 机器核出处）
   │ ds_validate 必过（0 errors）
   ▼
人工: rdp knowledge promote（去前缀定版 + 全库 validate）→ git PR（数据+风险 Owner）
   ▼
正式契约/语义/映射（agent 永远写不了）→ rdp knowledge manifest（sha256+commit 发布清单）
   ▼
copilot 流只读消费（ds_explain_field 信任分层：契约定版 > candidate > draft）
```

---

## 4. 项目特有的约定/模式

### 4.1 三层半固定架构（沿袭 quant-research）

- **skill 软引导**：推荐路径 + 完成判据 + 防失控软规则，可跳步。
- **tool 半固定**：每步入参/产物受控、phase 可观测（Workflow + setStatus widget）。
- **gate 硬边界**：无论 LLM 怎么想，越界做不了。这是风控审计要求——确定性边界不靠 prompt 自律。

### 4.2 candidate-only + promote 生命周期（核心治理闭环）

- Agent **只能写 `candidate_*`**（且必须在 contracts/ 或 semantic/ 子目录）；正式生效 = 去前缀覆盖 = **只能人工 PR**（`rdp knowledge promote` 被 gate 从 bash 拦死）。
- gate 允许 agent `git add`/`git commit` 收尾，但 **`git push` 硬拦**——推远端建 PR 由人做。
- 晋升后全库 validate 必须通过；manifest 记 sha256 + git commit 防引用漂移。

### 4.3 rd-gate 白名单/黑名单细节

- 写放行仅：`knowledge/**/candidate_*.json`、`semantic_issues.json`、`knowledge/diagrams/`、`knowledge/indexes/`。
- bash 白名单细致到「`rm` 只允许删单个 candidate_* 文件（不带 -rf/通配）」。
- 被拦时返回 `🛑 rd-gate 拦截` + reason + BLOCK_SUFFIX 指引；纪律是「原样告知用户、勿改路径重试」。
- 拦截日志写 `rd-gate-log`（pi.appendEntry）。

### 4.4 可信度分层与出处纪律

- `ds_explain_field` 返回 `trust: high/medium/low(draft)` + `sources[]`，回答必须如实转述；draft 答案必须声明「bootstrap 机械生成、未经人审」。
- 契约字段/审核报告的口径结论**必带 `file:line` 出处**；`knowledge/citations.py` 把它机器化：核对文件存在、行号未漂移、字段名出现在引用行 ±3 行窗口内（全部为 warning 不 fail，摆到 PR 台面）。
- 诚实标注约定：`static-snapshot @ commit`（code_index 快照）、`-candidate`（未定版）、coverage=partial（检索不完备）、「未追到，需 Owner 确认」（合法诚实声明）。

### 4.5 契约分层双轴（origin + role）

取代旧 medallion layer：`origin`（direct_write 直写根表 / derived 加工表，后者强制 `derivation.source_fields` + `lineage.upstream`）× `role`（detail/dimension/modeling，modeling 强制 `time_policy.as_of_date_field`，防泄漏规则适用）。

### 4.6 两个探索源硬规则（steward）

「只跑 ds_db_explore 就下业务语义结论是不完整的」——表结构给「长什么样」，代码给「是什么意思」。`ds_code_explore`（实时扫、追口径原文）与 `ds_code_index`（离线快照、追调用链/影响面）分工互补，典型组合：先 index impact 拿全景上界，再 explore collect 读片段核实。

### 4.7 语义问题三分类（curator）

- **就地修复**（fixed_in_semantic）：typo/duplicate_alias/unclear_abbr/proxy_value。
- **上报 Owner**（pending_owner）：name_conflict/semantic_ambiguity/enum_drift/multi_source——**只上报不拍板**。
- **转 ETL**（needs_etl_fix）：duplicate_physical/dead_field。

### 4.8 PII 三道防线

db_bridge 源头脱敏（high_plain 只给聚合统计）→ pii_bridge 内容级扫描（进 prompt/图/返回前再过一遍）→ gate/纪律（明文 PII 不进 prompt、不画进图、不返回原始样本值）。业务标识（customer_id/loan_id）明确不算 PII。

### 4.9 会诊协议（coms 多坐席）

- 坐席 `data-asset` 对外一个声音，三条流都可能接入站会诊。
- 代码层事实 → `coms_send tech-expert`；运行时批状态 → 值班坐席。
- 产物交接走文件系统，消息只传判断+出处指针；对方答不了的业务语义接受 unknown 编号转呈用户；不转发不代答；生产库凭据与 PII 策略归本坐席独占。

### 4.10 工具返回契约（§7.6）

所有 ds_* 工具统一返回 `{status, summary, next_actions, details{payload}, error_kind?, recovery_hint?}`；区分「事实不足」（success + 需人工确认）与「执行失败」（error + error_kind）。`makeBridge` 对非 JSON 输出兜底 `cli_failure` 并提示 RD_PYTHON。

### 4.11 席位设计哲学

「席位按动作分，不按领域分」；领域用 `--domain` 参数切，不开席位。全席位单进程是主形态，聚焦席位是演进选项——扩展已按席位拆文件，切换只是 justfile 改 `-e` 加载列表，无需改代码。

---

## 5. justfile 命令速查

| 命令 | 作用 |
|---|---|
| `just rd` | 全席位 pi TUI（主形态，含 coms + 4 skills + APPEND_SYSTEM） |
| `just rd-copilot/rd-steward/rd-curator` | 聚焦单席位（persona 替换 APPEND_SYSTEM） |
| `just ext-only` | 只加载扩展测试能否启动 |
| `just validate/summary/search/suggest-mapping/bootstrap` | rdp knowledge CLI 封装 |
| `just diagram-lineage/dataflow/mapping` | 渲图（⚠️ 引用 `tools/diagram_bridge.py`，**当前仓库不存在该文件**，配方已过时——画图已由 drawio-skill 接管） |
| `just code-index-build/status/impact/endpoints/batch` | code_index_bridge 封装 |
| `just test` / `just lint` / `just ext-check` | pytest / ruff / bun build 语法自检 |

---

## 6. 观察与备注

1. **当前知识库处于早期**：contracts/ 只有 2 个 candidate（cm_customer_first/second_level），semantic_catalog.json 为空（`concepts: []`），尚无已 promote 的正式契约。
2. **justfile 有两处漂移**：`diagram-*` 配方引用的 `tools/diagram_bridge.py` 不存在；`.env.example` 头部注释还写旧包名 `risk_dataset/.env`、`~/.cache/credit_dataset/...`（设计文档 Phase 8 计划把包从 `agent_data_asset` 改名为 `credit_dataset`，说明命名经历过 risk_dataset → agent_data_asset →（计划）credit_dataset 的演变）。
3. **rd-gate.ts 的 underKnowledge 兼容三个根**：`knowledge/`、`agent_data_asset/knowledge`、`risk_dataset/knowledge`（历史包名残留兼容）。
4. **测试覆盖良好**：7 个 pytest 文件覆盖 knowledge 核心、promote、citations、bridges、e2e sink；`just ext-check` 用 bun build 做扩展语法自检。
5. **关键设计文档**：`docs/AGENT_DATA_ASSET_DESIGN.md` §6（知识库）/§7（Agent 三层架构、三条流、红线、工具表、权限矩阵、返回契约）/§7A（血缘）/§7B（drawio）/§7C（双源探索）/§8（语义层）/§12（PII）/§13（质量治理）/§15（Phase 0-8 路线图）——实现与文档高度对齐。

---

## 7. Start Here（给后续 agent 的入口建议）

1. 先读 `README.md`（全貌）+ `.pi/APPEND_SYSTEM.md`（人设与硬规矩）。
2. 理解架构读 `docs/AGENT_DATA_ASSET_DESIGN.md` §7.2（三层架构图）。
3. 改工具行为：`extensions/rd-workflow-core.ts`（bridge 机制）→ `tools/knowledge_bridge.py`（action 分发）→ 对应专业 bridge。
4. 改边界：`extensions/rd-gate.ts` + 同步 `.pi/skills/_shared/gate.md`（人读镜像必须一致）。
5. 改知识模型：`knowledge/schemas/*.schema.json` + `knowledge/validate.py` + `_shared/knowledge-model.md` 三处同步。
