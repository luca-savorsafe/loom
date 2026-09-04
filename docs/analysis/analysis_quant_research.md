# quant-research 智能体项目分析报告

> 项目路径：`/Users/mac/worker/code/my-ai/dataquant/quant-research`
> 运行时：Pi Coding Agent CLI（pi）+ Bun ≥1.3.2（extension runtime）+ Python 3.13（bridge）
> 所属 monorepo：`dataquant/`（平级目录含 `financialdataset`、`quant-feature`、`quant-backtest`、`quant-core`、`strategy-registry`、`quant-web`、`pi-web` 等）

---

## 1. 智能体定位与业务领域

**定位**：dataquant 量化平台中**唯一允许 LLM** 的 AI 投研层，一个**对话式量化研究工作台**（v2）。不是自动流水线，而是"人机对话协作"的多轮研究助手——用户用自然语言驱动，agent 每步可观测、每轮停下等人、产出可审计候选。

**业务领域**：A 股 / ETF 量化投研，两条研究线：

1. **因子研究（factor-research）**：挖掘/筛选候选因子，用 `qb factor-scan` 按 Rank IC/ICIR 排行（非 PIT 安全的初筛 triage），产出 shortlist 交给 `quant-feature` 固化为 PIT-safe polars 脚本。
2. **策略研究（strategy-research）**：把论文/文章（pdf/txt/md/html）变成可回测的策略 YAML 草稿，跑 `qb backtest` 多轮迭代，直到通过 OOS test 触发 `qb publish-candidate`。

**核心边界哲学**：数据采集、特征计算、回测、每日执行都是**确定性引擎**（不含 LLM）；agent 只读消费 + 受控写 + 触发不越权。设计口诀（`docs/GRAPH_ENGINEERING_SYNTHESIS.md`）：**"agent 不生产交付物，确定性系统生产交付物，agent 只做路由和判断"**。

---

## 2. 组件清单

### 2.1 Persona（`.pi/persona/`，2 个）

| 文件 | 职责 |
|------|------|
| `.pi/persona/factor.md` | 因子研究专用会话人设（`just pi-factor` 经 `--append-system-prompt` 加载）。职责：只用 `fs_*` 工具做因子研究；草稿脚本边界（polars-native、禁 pandas/shift(-n)、必须过 `fs_validate_script`）；coms 跨席位**只读咨询**协议（回应 strategy 席位的因子可行性询问）；诚实原则与边界。 |
| `.pi/persona/strategy.md` | 策略研究专用会话人设（`just pi-strategy` 加载）。职责：只用 `sr_*` 工具；消费 factor 侧草稿 feature run 时必须标注"基于未固化草稿因子"；`sr_research_ml`（ML 探针，永不可晋升）归本席位；可经 coms 向 `factor` 席位咨询缺因子问题；诚实证伪优先、OOS 纪律。 |

两个 persona 是**同一工作台的 focused-context 入口**，避免两类研究在一个上下文里互相污染。全局人设另有 `.pi/APPEND_SYSTEM.md`（见 2.5）。

### 2.2 Skills（`.pi/skills/`，2 个）

| Skill | 文件 | 职责 |
|-------|------|------|
| `factor-research` | `.pi/skills/factor-research/SKILL.md` | 因子研究工作流软引导：⓪list→①inspect→②design→③write→④scan→⑤analyze→⑥iterate 六阶段 + 可选⑦⑧⑨草稿固化分支（write_script→validate→compute_draft）；AKQuant 因子表达式语法（TS/CS/EL 三类函数）；Loop 协议（每轮停下问用户、≥3 个 \|ICIR\|>0.03 候选即完成、连续 3 轮无改善防失控）；shortlist 产出格式；核心认知（factor-scan 非 PIT、多重检验偏差）。 |
| └ references | `.pi/skills/factor-research/references/fs-tool-usage.md` | `fs_*` 工具权威手册：工具→桥→CLI 映射表、每个工具参数/产物/错误修法表、"工具失败重试工具不绕过"纪律、退出边界速记。 |
| `strategy-research` | `.pi/skills/strategy-research/SKILL.md` | 策略研究工作流软引导：①read→②survey→③draft→④backtest→⑤analyze→⑥iterate→⑦report；论文结构化提取范式（TL;DR/Problem/Approach/Evidence/Limitations→策略假设）；策略 YAML 要点（必从权威模板起步、`rules` 必须同时有 buy/sell、元信息只进 `metadata`、`_vN` 版本命名规范、symbol 后缀 `.SH/.SZ`）；Loop 协议（首轮回测必须 `split=all`、进 test 前提、OOS 一次性、诚实证伪、防失控）。 |
| └ references | `.pi/skills/strategy-research/references/qb-tool-usage.md` | `sr_*` 工具权威手册：含 `sr_backtest`/`sr_analyze`/`sr_publish`/`sr_research_ml`（model_spec/label_spec 完整 schema）/`sr_report` 的参数与错误修法。 |
| └ references | `.pi/skills/strategy-research/references/dsl-engine-semantics.md` | **策略 DSL ↔ 引擎语义契约（运行手册）**——见 §3.3。 |

### 2.3 Extensions（`extensions/`，7 个 .ts）

| 扩展 | 行数 | 职责 |
|------|------|------|
| `factor-research.ts` | 365 | 注册 8 个 `fs_*` custom tool：`fs_list_datasets`（⓪，直连 `qf datasets`）、`fs_inspect_dataset`（①，`qf inspect-silver`）、`fs_write_library`（③，写 `outputs/factor_libraries/*.yaml`）、`fs_scan`（④，经 `tools/factor_scan_bridge.py` 调 `qb factor-scan`）、`fs_analyze`（⑤）、`fs_write_script`/`fs_validate_script`/`fs_compute_draft`（⑦⑧⑨草稿固化分支，写 `quant-feature/feature_scripts/<id>/`，工具内先做禁 import/未来窗口本地拦截）；注册 `/factor-status` 命令；实例化一个 factor 流 Workflow widget。 |
| `strategy-research.ts` | 581 | 注册 8 个 `sr_*` custom tool：`sr_read_material`（①，经 `read_material.py`，pdf 分级抽取含 OCR）、`sr_list_features`（②，`qf describe`，支持列 feature set/自动取最新 run）、`sr_write_draft`（③，写 `strategy-registry/drafts/<id>/` + 可选 `precheck_draft.py` 预检 symbol/因子列）、`sr_backtest`（④，经 `qb_bridge.py` 做 validate+backtest）、`sr_analyze`（⑤，经 `report_bridge.py collect` 确定性回读 metrics 并格式化对比表+明细）、`sr_research_ml`（ML 探针，含 help=true 内置用法文本）、`sr_report`（经 `report_bridge.py publish` 原子发布研究报告）、`sr_publish`（`qb publish-candidate`）；注册 `/strategy-status`。 |
| `quant-workflow-core.ts` | 354 | 两个研究扩展的共享基建：`Workflow` 类（阶段模型 + 单行进度 widget + 状态栏 + `tool_execution_*` hook 驱动阶段推进 + round 计数）、`makeRunners`（`pi.exec` 封装 `python3` bridge / CLI 调用，600s 超时）、路径解析助手（`repoRoot`/`qbCli`/`qfCli`/`resolveDraft`/`resolveDataPath`/`resolveMaterial`）、`combineOutput`（合并 stdout+stderr，宽截断 6000 字符防 agent 绕过工具）、`foldMarginWarnings`（折叠 AKQuant 保证金告警刷屏）。 |
| `quant-gate.ts` | 554 | **硬边界层**。拦截 `tool_call`（write/edit/bash/read/grep/find/ls）：写只放 `outputs/` + `strategy-registry/drafts/` + `feature_scripts/<id>/`；bash 白名单（只读命令 + `python3 tools/*.py` + 受控 `qf`/`qb` 子命令）；硬禁 `qf register/retire`、`qb promote`、联网（curl/wget）、装包、`git push`；裸调 `qb backtest/factor-scan/publish-candidate/research-ml` 给**可恢复重定向**（不 abort，提示改用对应工具）；git 命令给可恢复拒绝并附人工提交指引；读研究材料（research_materials/ 或仓库外的 doc 文件）被软重定向到 `sr_read_material`。规则来自 `.pi/damage-control-rules.yaml`，违规记入 `quant-gate-log`。 |
| `coms.ts` | 1617 | 跨会话点对点消息（本机 unix socket/named pipe + `~/.pi/coms/` 注册表）。工具：`coms_list`/`coms_send`/`coms_get`/`coms_await`；ping/keepalive 心跳、`/coms` 命令、座位池 widget。身份可由 `--cname` flag 或 `PI_COMS_NAME/PURPOSE/PROJECT/COLOR` 环境变量提供（pi-web 路径靠环境变量）。 |
| `theme-cycler.ts` | 181 | UI 小工具：Ctrl+X/Ctrl+Q 切换主题、`/theme` 命令、色板 widget。 |
| `themeMap.ts` | 107 | 每个扩展的默认主题映射（`.pi/themes/` 11 个主题），`applyExtensionDefaults()` 在 session_start 时应用。 |

### 2.4 Tools（`tools/`，5 个 Python bridge）

全部是**确定性桥**，被 quant-gate 以 `python3 tools/*.py` 白名单放行，每次调用写 JSON 日志到 `outputs/*_logs/`：

| 文件 | 职责 |
|------|------|
| `tools/factor_scan_bridge.py`（268 行） | 桥接 `qb factor-scan`：子命令 `scan`（读 Silver 或 feature run，输出 ICIR 排行榜，产物固定到 `../outputs/factor_scan/`）和 `top`（复读已有 scan run 排行榜，不重算）。 |
| `tools/qb_bridge.py`（257 行） | 桥接 `qb` CLI：`validate`/`backtest`（`--split`/`--one-shot`）/`batch`/`publish`（`publish-candidate`）。草稿强制在 `strategy-registry/drafts/` 下；OOS 一次性由 qb 自身经 `strategy_lineage_id + test_window_id` 强制。 |
| `tools/read_material.py`（315 行） | 读研究材料为纯文本：pdf（pdfplumber→pdftotext→扫描件 OCR 分级）/txt/md/html；上限 120k 字符防爆上下文；只读。 |
| `tools/report_bridge.py`（524 行） | 研究报告桥：`collect`（从 run 目录确定性抽取 canonical metrics，LLM 永不手填数字）+ `publish`（按平台原子发布协议写 `outputs/research_reports/date=/run_id=/`：report.md/report.json/evidence.json/manifest.json+file_hashes/`_SUCCESS` 最后写）。 |
| `tools/precheck_draft.py`（167 行） | 策略草稿预检：symbol 是否存在（并给 `.XSHG→.SH` 后缀修正建议）、引用的因子列是否真实存在于 feature run。诊断非门禁。 |

注：`tools/__pycache__/` 里有一个 `knowledge_io.cpython-313.pyc` 但**源码 `knowledge_io.py` 已不存在**（残留编译缓存，项目内无引用）。

### 2.5 Prompts / Settings / Damage-control

| 组件 | 文件 | 内容 |
|------|------|------|
| 全局人设 | `.pi/APPEND_SYSTEM.md` | 工作台总人设：两类研究介绍 + "先 read 对应 SKILL.md"；平台角色与边界（只读消费/受控写/绝不写/触发不越权）；**研究态诚实原则**（IC/ICIR 是初筛信号非证据、不编造数字、不声称已晋升、中文自由文本+原文保持代码/YAML/symbol）；多轮协作（每轮停下等指令）。 |
| Settings | `.pi/settings.json` | `defaultModel: deepseek-v4-pro`；自动加载 5 个扩展（factor-research、strategy-research、quant-gate、theme-cycler、coms——**quant-workflow-core 是被 import 的共享模块，不单独加载**）。 |
| Damage-control | `.pi/damage-control-rules.yaml` | quant-gate 的规则数据：`bashToolPatterns`（通用破坏性模式 + pi-quant 专属：禁 git push/curl/wget/pip/npm/brew install/docker rm/tmux kill 等）；`zeroAccessPaths`（`strategy-registry/{candidates,paper_trading,production}/`、`feature_scripts/registry.yaml`、各类密钥/凭据）；`readOnlyPaths`（`financialdataset/`、`quant-backtest/`、`outputs/features/`、`config/`、`.pi/skills/` 等）；`noDeletePaths`（`.pi/agent-memory/`、`.git/`、`README.md`、`AGENTS.md` 等）。 |
| 主题 | `.pi/themes/*.json`（11 个） | TUI 主题（catppuccin-mocha/cyberpunk/dracula/…），由 themeMap/theme-cycler 使用。 |
| Web 座位数据 | `.pi-web/{factor,strategy}/projects.json` | pi-web 每座位隔离的 `PI_WEB_DATA_DIR`，登记本项目路径。 |

### 2.6 Knowledge / Docs

- **Skill 内 references/**（见 2.2）是运行时按需 `read` 的权威知识：工具手册 + DSL 引擎语义。
- **外部权威模板**（skill 指引 agent 去读，位于 monorepo 平级项目）：`quant-feature/templates/feature_set_example/`（特征脚本模板）、`strategy-registry/templates/strategy_v1_final_example.yaml`（策略 YAML 模板）、`strategy-registry/schemas/strategy.schema.json`、`strategy-registry/model_specs/etf_select_v2_demo/`。
- `docs/`（设计文档，非运行时知识）：
  - `docs/DETAILED_DESIGN_V2.md`（399 行）——权威设计：定位、设计哲学、**三层半固定架构**、Agent 工具交互友好契约（§2.1，工具返回必须含人读文本+结构化 details 字段）、两个研究 agent。
  - `docs/DETAILED_DESIGN_APPENDIX.md`（249 行）——草稿态因子闭环 + 单 skill 入口 + coms 咨询的动因与设计（已落地回填进 V2）。
  - `docs/GRAPH_ENGINEERING_SYNTHESIS.md`（362 行）——定位文档：与 pi-dynamic-workflows 的关系、"企业级稳定交付"北极星。
  - `docs/PI_WEB_SEATS.md`（117 行）——pi-web 浏览器多座位运行方式。
  - `docs/USAGE_EXAMPLES.md`（276 行）——用户使用示例。

---

## 3. 组件间引用与组合关系

### 3.1 三层半固定架构（核心组合模式）

```
第一层 SKILL（软引导）   .pi/skills/*/SKILL.md + references/   —— "该怎么做"
第二层 CUSTOM TOOL（结构） extensions/factor-research.ts / strategy-research.ts
                        （共享 quant-workflow-core.ts）        —— "每步结构化可观测"
第三层 QUANT-GATE（硬边界） extensions/quant-gate.ts
                        + .pi/damage-control-rules.yaml        —— "不该做的做不了"
```

顺序**不强制**——agent 可跳步/回退；gate 保证越界做不了。

### 3.2 Persona ↔ Skill ↔ Extension 对应关系

| 入口（justfile） | Persona | Skill | Extension（显式 `-e`） | coms 座位 |
|---|---|---|---|---|
| `just pi` | APPEND_SYSTEM.md（settings.json 自动加载 5 扩展，两个 skill 按需 read） | 两个都可触发 | 全部 5 个 | 随机名 |
| `just pi-factor` | `.pi/persona/factor.md`（`--append-system-prompt`） | `factor-research` | `factor-research.ts` + quant-gate + theme-cycler + coms（`-ne` 关掉自动发现） | `--cname factor` |
| `just pi-strategy` | `.pi/persona/strategy.md` | `strategy-research` | `strategy-research.ts` + quant-gate + theme-cycler + coms | `--cname strategy` |

- Persona 明确要求"先 `read` 对应 SKILL.md"，SKILL.md 要求"先 read references/ 工具手册"——**三级渐进式 prompt 加载**（persona → SKILL → references），节省上下文。
- `quant-workflow-core.ts` 被两个研究扩展 `import`，不在 settings.json 单独登记。

### 3.3 dsl-engine 是什么

项目里**没有一个叫 dsl-engine 的组件**；它指的是 **v1 策略 DSL ↔ 引擎语义契约**，即 `.pi/skills/strategy-research/references/dsl-engine-semantics.md` 描述的语义层：

- 策略以声明式 **YAML DSL** 表达（`strategy-registry/schemas/strategy.schema.json` 定义）。
- **策略语义住在 monorepo 平级的 `quant-core`**（`decide()` / `compute_score()` / evaluator），回测与每日执行共用同一套 `decide()`（按构造一致）；**AKQuant 只负责撮合/T+1/成本/记账**；`quant-backtest` 的 adapter 只做"翻译+接线"。
- 该手册记录 schema 看不出来的关键语义：轮动是**每日**而非月度（`rebalance.frequency` 不被消费）、持仓数只认 `portfolio.max_assets`（`selection.top_n` 无效）、`score>0` 才入选、`rank_by:"score"` 指 score 块总分、三种 weighting（`equal_weight`/`score_weight`/`risk_weight`）、fill_buffer 0.97、ETF 免印花税、`min_commission` 是金额、只有 `buy.timing` 被消费、T+1、账户级硬风控 vs 软风控两层、无法用 DSL 表达的诚实边界（组合优化/月度调仓/调仓阈值不支持）。
- 参数扫描经 `patch_v1_dsl` 把 `{param}` 模板写回 DSL。

### 3.4 数据/产物流向（跨组件）

```
financialdataset(Silver, 只读)
   │ fs_list_datasets / fs_inspect_dataset (qf datasets / inspect-silver)
   ▼
factor-research: fs_write_library → outputs/factor_libraries/*.yaml
   │ fs_scan → tools/factor_scan_bridge.py → qb factor-scan
   ▼
outputs/factor_scan/scan_*/ (ICIR 排行, pit_safe=false/promotable=false)
   │ shortlist 值得深入 + 用户点头
   ▼
fs_write_script → quant-feature/feature_scripts/<id>/ (草稿脚本)
   │ fs_validate_script (qf validate-script: schema+安全+无泄漏+单测)
   ▼ fs_compute_draft (qf compute --draft)
outputs/features/feature_set_id=<id>/draft=true/run_id=<rid>/ (草稿 run)
   │ strategy-research: sr_list_features (qf describe)
   ▼
sr_write_draft → strategy-registry/drafts/<id>/strategy.yaml (+precheck_draft 预检)
   │ sr_backtest → tools/qb_bridge.py → qb validate + qb backtest --split
   ▼
outputs/backtests/strategy_id=<id>/run_id=<rid>/ (metrics.yaml/validation.json/…)
   │ sr_analyze → report_bridge collect (确定性回读) → 迭代
   │ val 过门槛 + 全周期稳健 + 用户确认 → split=test one_shot → sr_publish → qb publish-candidate
   ▼
strategy-registry/candidates/ (只有 qb 能写)
   │ 研究完结 → sr_report → report_bridge publish
   ▼
outputs/research_reports/date=<d>/run_id=<rid>/ (原子发布, quant-web 可消费)
```

### 3.5 coms 跨席位咨询（只读协议）

- strategy 席位缺论文因子时 `coms_send(target="factor", ...)` → factor 席位就地用 `fs_inspect_dataset`+`fs_scan` 回答可行性，必要时出草稿 run。
- **交付走文件系统**：coms 只传路径指针，不塞产物内容；**人工闸门不经 coms**（不能请求对方 `qf register`/`qb promote`）；**一问一答一交付**，不做多轮自动编排。
- pi-web 浏览器座位（`just web-factor`/`web-strategy`，端口 8504/8514）经 `PI_COMS_*` 环境变量获得同一身份，与 TUI 席位互通。

---

## 4. 项目特有约定/模式

1. **研究态 vs 固化态严格分层**：一切 agent 产物都标 `draft=true`/`pit_safe=false`/`promotable=false`/`promotion_eligible=false`；正式生效必须人工命令（`qf register` 登记因子、`qb promote` 晋升策略）——agent **永远无法自我固化/自我晋升**，且由 quant-gate 硬拦 + qb/qf 引擎侧再强制（双保险）。
2. **工具失败→修参数重试同一工具，绝不绕过**：skill/references 反复强调不得改用裸 `qb`/`qf` 或手写 python 旁路；gate 对裸调给**可恢复重定向**（不 abort，提示用哪个工具）。同一工具连续 3 次失败才停下报告。
3. **数字不编造，确定性回读**：所有 IC/ICIR/metrics 必须来自工具实际输出；`sr_analyze`/`sr_report` 的指标由 `report_bridge` 从 run 目录**确定性读取**，LLM 只写叙述字段（thesis/root_cause/conclusion 等），论文作者声称的数字单独标注为 `paper_benchmark`。
4. **OOS 一次性纪律**：test split 只能碰一次，由 qb 经 `strategy_lineage_id + test_window_id` 强制；首轮回测必须 `split=all` 看全周期（防止 val 短窗"虚假繁荣"）；诚实证伪优先于调参刷分。
5. **Loop 协议（多轮控制）**：每轮 scan/backtest 后展示结果+解读并**停下问用户**；完成判据（如 ≥3 个 |ICIR|>0.03）；防失控（连续 N 轮无改善→建议换向，防过拟合）。
6. **产物路径由桥固定**：所有 bridge 强制 `--output`/`--output-root` 到 monorepo 根 `outputs/`，防裸命令在子项目内造成产物碎片；原子发布协议（manifest+file_hashes，`_SUCCESS` 最后写）。
7. **策略版本谱系命名**：`<语义名>_v<N>`（如 `etf_ols_momentum_rotation_v1`），结构性迭代升版本新建目录、参数微调不升版本；`_vN` 与 `strategy.version`（语义化）、引擎 `strategy_lineage_id` 三者独立。
8. **语言约定**：自由文本用中文；代码/YAML key/字段名/symbol/日期/路径保持原样；symbol 用数据真实后缀（`.SH`/`.SZ`，不抄论文的 `.XSHG/.XSHE`）。
9. **渐进式知识加载**：APPEND_SYSTEM/persona → SKILL.md → references/*.md → 外部权威模板，每层都写清"何时读哪个文件"，并显式禁止逆向引擎源码（"不确定时以手册为准，不要逆向 qb/qf/bridge 源码"）。
10. **focused context 双席位**：同类研究一个会话，通过 justfile 用 `-ne` + 显式 `-e` 控制扩展加载面 + `--append-system-prompt` 挂 persona + `--cname` 定 coms 座位——同一套扩展按入口组合出三种形态（合并 TUI / 独立 TUI / 浏览器座位）。
11. **widget 可观测**：每个研究流一个单行阶段 widget（`quant-workflow-<flowKey>`）+ 状态栏，由 `tool_execution_start/end` hook 按 `toolPhase` 映射自动推进，TUI 不可用 setWidget 时静默降级（Web 兼容）。
12. **v1→v2 演进**：旧 DAG+多 agent 编排归档为 git tag `quant-research-v1-archive`，当前 v2 是"对话式 + 三层半固定"，明确不派生 headless 子进程、跨会话仅 coms 只读咨询。

---

## 5. 文件路径速查（关键入口）

| 用途 | 路径 |
|------|------|
| 总入口说明 | `README.md` |
| 全局人设 | `.pi/APPEND_SYSTEM.md` |
| 扩展加载与模型 | `.pi/settings.json` |
| gate 规则数据 | `.pi/damage-control-rules.yaml` |
| 因子 skill | `.pi/skills/factor-research/SKILL.md` + `references/fs-tool-usage.md` |
| 策略 skill | `.pi/skills/strategy-research/SKILL.md` + `references/qb-tool-usage.md` + `references/dsl-engine-semantics.md` |
| 专用会话人设 | `.pi/persona/factor.md` / `.pi/persona/strategy.md` |
| 因子工具实现 | `extensions/factor-research.ts`（+共享 `extensions/quant-workflow-core.ts`） |
| 策略工具实现 | `extensions/strategy-research.ts` |
| 硬边界 | `extensions/quant-gate.ts` |
| 跨会话通信 | `extensions/coms.ts` |
| CLI 桥 | `tools/factor_scan_bridge.py` / `tools/qb_bridge.py` / `tools/read_material.py` / `tools/report_bridge.py` / `tools/precheck_draft.py` |
| 启动命令 | `justfile`（`pi` / `pi-factor` / `pi-strategy` / `web-factor` / `web-strategy` / `factor-scan`） |
| 权威设计 | `docs/DETAILED_DESIGN_V2.md`（+`DETAILED_DESIGN_APPENDIX.md`） |
