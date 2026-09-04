# agent_design_doc 项目深度分析报告

> 分析对象：`/Users/mac/worker/code/ai-example/CreditWeaveAI/agent_design_doc`
> 项目自描述：「基于 pi + skill + extension + gate 的对话式设计文档工作台」

---

## 1. 智能体定位与业务领域

**DesignDoc Agent（信贷设计文档撰写坐席，cname `design-doc`）**——信贷智能体团队（CreditWeaveAI）中的工程交付层坐席之一，负责把「设计文档编写」变成一条**可验证、可约束、可复用**的管线：

- **业务领域**：银行信贷系统（北京农商银行互联网贷款：凤凰e借、受托支付、财政贴息等）。输入是业务需求 docx（`input/`），输出是技术设计文档（md + drawio 图 + docx/pptx + 评审报告）。
- **核心痛点与解法**：
  1. 凭空编架构 → 架构事实必须来自真实 Java 代码的静态分析（java-codegraph 图谱），且文档事实句必须带 `@fact` 机器可重验断言；
  2. 图文分离 → 正文与 drawio 图在同一流程产出并机器校验引用一致；
  3. 格式返工 → 章节完整性由工具对照章节模型强制检查；
  4. 产出无约束 → AI 只写 `workspace/`，硬闸门（gate）拦截一切越界。
- **团队位置**（仓根 `team.json`，SSOT）：坐席 id `design-doc`，工程交付层，自动化边界 B（文档由人评审定稿）。与其他坐席为平等 P2P 关系，经 coms 网络会诊：上游咨询 `tech-expert`（代码层事实/设计意图）与 `data-asset`（湖表字段口径/契约）。
- 架构样板为同仓库的 `agent_data_asset/`（同构 pi 工作台），图谱单一 owner 是 `agent_tech_expert/`。

---

## 2. 组件清单

### 2.1 Persona（席位人设，`.pi/persona/`）

| 文件 | 席位 | 职责 |
|---|---|---|
| `.pi/persona/researcher.md` | 采事实席位 | 用 java-codegraph 从真实代码抽结构事实（端点/调用链/影响面/血缘/拓扑），事实 JSON + facts.md 落 `workspace/<任务>/research/`；只读消费 tech-expert 共享图谱，不自行 build |
| `.pi/persona/author.md` | 写作席位 | 基于 research 事实写 outline.md → 按 doc-model 逐节成文 → drawio 出图 → docx/pptx 定稿；不注册工具，靠 skill 软引导 |
| `.pi/persona/reviewer.md` | 评审席位 | 确定性检查（gating，机器判生死）+ 语义评审（advisory，只出意见不改档位）分层纪律；只读 workspace 不改文档，输出三档结论报告 |

总人设（追加进 system prompt）：
- `.pi/APPEND_SYSTEM.md` — DesignDoc Agent 是谁、三条工作流、硬规矩、输出风格、**会诊协议**（coms 坐席 `design-doc`：问 tech-expert / data-asset 的纪律、unknown 编号处理、诚实标注快照/候选）。

### 2.2 Skills（软引导工作流，`.pi/skills/`）

| 目录 | 职责 | 关键文件 |
|---|---|---|
| `design-research/` | 采事实流：scan（registry status/resolve）→ query（按章节需要选 17 个 codegraph action）→ handoff（JSON + facts.md） | `SKILL.md` |
| `design-author/` | 写作流：outline → draft → diagram（drawio）→ build（docx/pptx）；含 @fact 两级事实标注规则、node/python 定稿通道与依赖自检纪律 | `SKILL.md` |
| `design-review/` | 评审流：sections → figrefs → facts → report；gating vs advisory 分层语义、三档结论判据 | `SKILL.md` |
| `drawio-skill/` | **vendored** 出图 skill（v1.14.0）：生成 .drawio XML、draw.io CLI 导出 PNG/SVG/PDF | `SKILL.md`、`scripts/`（validate.py、autolayout.py、shapesearch.py 等）、`references/`、`styles/`、`data/` |
| `java-codegraph/` | **vendored** Java 代码图谱 skill：Spoon 全量分析产 25 张 CSV，`graph_query.py` 只读秒级查询 17 个 action；build 归 tech-expert | `SKILL.md`、`scripts/graph_query.py`、`bin/jca.jar` |
| `_shared/` | 三 skill 共享知识（见 2.4 knowledge） | `gate.md`、`doc-model.md`、`fact-claims.md`、`review-report-template.md` |
| 全局 skill（不在本目录） | `$HOME/.agents/skills/docx`、`$HOME/.agents/skills/pptx` — docx/pptx 定稿，justfile 挂载 | — |

### 2.3 Extensions / Tools（硬约束与注册工具，`extensions/`）

| 文件 | 类型 | 职责 |
|---|---|---|
| `extensions/dd-gate.ts`（195 行） | 硬边界闸门 | 订阅 `tool_call` 拦截 write/edit/bash：写只放行 `workspace/`；bash 白名单（只读命令 + git add/commit + graph_query.py + python3/node 脚本 + markitdown + drawio/dot/pandoc + open 图档 + mkdir workspace）+ 黑名单（联网/装包/危险 git/rm -rf）+ **参数级校验**（重定向/tee 目标、mkdir/rm 路径必须落 workspace）；硬拦 `graph_registry.py build/switch/prune/bootstrap`（图谱单一 owner） |
| `extensions/reviewer-agent.ts`（378 行） | 评审工具注册（只读） | 注册 3 个工具：`dd_check_sections`（对照 doc-model 5 个★必备章节）、`dd_check_figrefs`（正文引用图必须存在于 diagrams/）、`dd_check_facts`（提取 `@fact` 断言→重跑 `graph_query.py` 比对 expect/forbid 子串；图谱不可用=fail 未验证，绝不静默跳过） |
| `extensions/coms.ts`（1617 行，vendored） | P2P 会诊网络 | 坐席间直问直达：unix socket/命名管道 + `~/.pi/coms/projects/<project>/agents/<name>.json` 注册发现；注册工具 `coms_list` / `coms_send` / `coms_get` / `coms_await`；ping/keepalive、/coms 命令、live pool widget |
| `extensions/themeMap.ts`（107 行，vendored） | 主题映射 | 按扩展文件名映射 `.pi/themes/*.json` 主题（当前 map 未含 dd 条目，走 fallback） |

**工具注册总原则**（README + 设计文档 §4.2）：**复用现成 skill 的能力一律不注册工具**（researcher 复用 java-codegraph、author 复用 drawio/docx/pptx，纯 skill 软引导）；**只有 Agent 特有、无现成 skill 的逻辑才注册工具**（reviewer 的三个校验器）。

### 2.4 Knowledge / 共享知识

| 文件 | 职责 |
|---|---|
| `.pi/skills/_shared/gate.md` | 给 LLM 看的 gate 规则说明（写白名单/禁项/bash 放行/图谱单一 owner/被拦后怎么办），强制实现指向 `extensions/dd-gate.ts` |
| `.pi/skills/_shared/doc-model.md` | 设计文档章节模型：10 章、5 个★必备（背景与目标/总体架构/详细设计/非功能需求/风险与边界），每章标注对应 codegraph action 事实来源 |
| `.pi/skills/_shared/fact-claims.md` | `@fact` 断言语法（`<!-- @fact {"action","target","expect"/"forbid","note"} -->`）：哪些内容必须标、检查语义（expect 全中 + forbid 全不中、未验证=不通过）、快照漂移边界 |
| `.pi/skills/_shared/review-report-template.md` | 评审报告统一模板：三档结论 + ①②③ 检查结果表 + advisory 意见段 + 问题清单 + 事实来源核查提示项 |
| `.sourcemuse/` | 外部工具生成的源码快照缓存（gitignore）：jrx 批调度/dataflow 源码、quartz.sql、zeppelin 示例等，作只读参考资料 |
| `docs/design-doc-agent-design.md` | 本 Agent 自身的设计文档（354 行）：背景/原则/五件套/三席位/gate 设计/端到端链/五阶段实施路线/风险（**AI 禁写此目录**） |
| `input/*.docx` | 4 份业务需求输入（凤凰e借受托支付财政贴息、互联网合作贷款优化、自动审计校验、自营产品客户运营） |

### 2.5 Prompts

- **System prompt 追加**：`.pi/APPEND_SYSTEM.md`（总人设）；聚焦席位模式用 `.pi/persona/*.md` 直接作 `--append-system-prompt`。
- **Skill 提示**：各 `SKILL.md`（软引导工作流，「可跳步」）。
- 无独立 prompts/ 目录——提示层 = APPEND_SYSTEM + persona + SKILL.md 三层。

### 2.6 Settings

- `.pi/settings.json`：仅声明加载两个扩展（相对路径）：
  ```json
  { "extensions": ["../extensions/dd-gate.ts", "../extensions/reviewer-agent.ts"] }
  ```
  （coms.ts 不在 settings 里，由 `just dd` 命令行 `-e` 挂载。）
- `.pi/themes/*.json`：11 个 pi TUI 主题。
- `package.json` + `bun.lock`：node 依赖 docx ^9.7.1 / pptxgenjs ^4.0.1（bun 管理）。
- `.gitignore`：`workspace/*`（产物不入库）、`.sourcemuse/`、`node_modules/`。
- `tools/check-node-deps.js` / `tools/check-py-deps.py`：环境自检正规通道（gate 拦 `node -e`/`python -c` 内联代码「不可审计」，自检必须走脚本文件）。

---

## 3. 组件间引用与组合关系

### 3.1 三 persona ↔ 三 skill 一一对应

| 席位 persona | 对应 skill | 能力来源（复用 skill） | 注册工具 |
|---|---|---|---|
| researcher.md | design-research/SKILL.md | java-codegraph skill（`graph_query.py` 17 action） | 无 |
| author.md | design-author/SKILL.md | drawio-skill + docx + pptx skill | 无 |
| reviewer.md | design-review/SKILL.md | — | `dd_check_sections` / `dd_check_figrefs` / `dd_check_facts`（reviewer-agent.ts） |

每个 persona 末尾写明「工作流细节见 design-xxx skill」；每个 SKILL.md 标题标注所属席位（如「design-research — 采事实流（researcher 席位）」），形成 persona（是谁/纪律）↔ skill（怎么走/步骤）的双向引用。

### 3.2 `_shared/` 复用方式

- **doc-model.md**：author 写作时的章节依据（design-author SKILL.md 引用），reviewer `dd_check_sections` 的默认必备章节（reviewer-agent.ts 中 `DEFAULT_REQUIRED` 与其 5 个★章节硬编码一致）。
- **fact-claims.md**：design-author 要求事实句附 `@fact` 断言（"写断言前先跑一次查询按真实输出写 expect"）→ design-review 的 `dd_check_facts` 按同一语法提取并重验 → 语法单一事实源。
- **review-report-template.md**：design-review SKILL.md 第④步直接引用，reviewer persona 也要求复用。
- **gate.md**：三个 SKILL.md 末尾「硬边界」段统一链接 `../_shared/gate.md`；gate.md 又指向强制实现 `extensions/dd-gate.ts`（规则说明与代码实现分离）。

### 3.3 Review gate 流程（评审闸门闭环）

```
author 产 workspace/<任务>/<任务>.md（事实句带 <!-- @fact {...} --> 断言）
        │
reviewer（design-review skill 软引导，4 步）:
  ① dd_check_sections  ── 对照 doc-model ★ 章节（缺=不通过）
  ② dd_check_figrefs   ── 引用图必须存在于 diagrams/（断裂=不通过）
  ③ dd_check_facts     ── 逐条重跑 graph_query.py，expect 全中+forbid 全不中
                          断言不符=不通过；图谱不可用=不通过(未验证)，不静默跳过
  ④ 按 _shared/review-report-template.md 出报告
        │
  结论三档：✅通过 / ⚠️警告(可发) / ❌不通过(需返工，问题清单交回 author)
  报告存 workspace/<任务>/review-report.md
  语义评审(advisory) 只写意见段，不改结论档位——最终判官是读文档的人
```

关键设计：把「文档是否凭空编架构」从 LLM 语感判断**降格为确定性检索对比**（`dd_check_facts` 重跑 codegraph 查询做子串比对）。

### 3.4 外部依赖链（跨坐席）

- **图谱单一 owner**：信贷代码图谱由 `agent_tech_expert/tools/graph_registry.py` 统一构建/版本管理；design-research ① scan 调 `../agent_tech_expert/tools/graph_registry.py status/resolve`；`just cg*` 命令经 registry resolve 共享图谱目录；`dd-gate.ts` 硬拦 registry 写 action；reviewer-agent.ts 内 `GRAPH_REGISTRY = ../agent_tech_expert/tools/graph_registry.py` 作 csv 解析兜底。缺失/过期 → coms 请 tech-expert 重建。
- **coms 会诊**：APPEND_SYSTEM.md「会诊协议」定义 design-doc 坐席问 tech-expert（代码语义/设计意图，拿 file:line 出处）、问 data-asset（字段口径以契约为准）的纪律。

---

## 4. 项目特有的约定/模式

1. **「软引导 + 硬约束」双层架构**：SKILL.md 教 LLM 该怎么走（明示「可跳步」），dd-gate.ts 定绝对不行（绕不过）；设计文档 §2 明确列为设计原则。
2. **单进程多席位**：一个 pi 进程承载三席位，角色「在对话中声明」切换；`just dd` 全席位形态（APPEND_SYSTEM 总人设 + coms 常开），`just dd-research/dd-author/dd-review` 聚焦席位（只带该 persona + 安静模式无 coms）。
3. **工具注册极简主义**：「复用现成 skill 的能力一律不注册工具」——researcher/author 零工具，仅 reviewer 注册 3 个校验器（Agent 特有逻辑）。
4. **workspace 产出隔离**：一切产出落 `workspace/<任务名>/`（research/ + outline.md + <任务名>.md + diagrams/ + .docx/.pptx + review-report.md），gitignore 可随时重建；`docs/` 是仓库自身文档目录，AI 禁写——两目录职责硬分离。
5. **@fact 事实断言机制**：事实句 = 可机器重验的确定性声明（HTML 注释内嵌 JSON），是本项目最有特色的模式——文档正确性可回归。
6. **gating vs advisory 评审分层**：确定性检查机器判生死（reviewer「无权放水」），语义意见只供人参考不改档位。
7. **参数级 gate 校验**：不止命令白名单，还解析重定向/tee/mkdir/rm 的路径参数防 `../workspace` 逃逸；拦 `node -e`/`python3 -c` 内联代码（不可审计）并给出正规自检通道（`tools/check-*.js/py`）。
8. **图谱单一 owner + 静态分析上界声明**：事实必须带 manifest commit/时间来源；影响面/血缘结论统一标「静态分析上界，需人工复核」；unknown 业务语义编号化列「风险与边界」待确认。
9. **vendored skill 惯例**：java-codegraph / drawio-skill / coms.ts / themeMap.ts 拷贝入库（与 agent_data_asset 同版本），docx/pptx 走 `~/.agents/skills` 全局挂载（justfile 显式 `--skill`）。
10. **诚实标注体系**：快照标 `static-snapshot @ commit`、候选标 `-candidate`、建议显式写「建议」「目标」不伪装事实。
11. **coms 坐席身份 CLI 注入**：`just dd` 用 `--cname design-doc --purpose "..." --project credit` 注入会诊身份，与 `team.json` SSOT 同步。

---

## 5. 关键文件索引

| 路径 | 行数 | 说明 |
|---|---|---|
| `agent_design_doc/README.md` | 125 | 项目入口：定位、命令、架构表、硬边界、状态 |
| `agent_design_doc/.pi/APPEND_SYSTEM.md` | 47 | 总人设 + 会诊协议 |
| `agent_design_doc/.pi/persona/{researcher,author,reviewer}.md` | ~20 each | 三席位人设 |
| `agent_design_doc/.pi/skills/design-{research,author,review}/SKILL.md` | — | 三工作流软引导 |
| `agent_design_doc/.pi/skills/_shared/{gate,doc-model,fact-claims,review-report-template}.md` | — | 共享知识四件套 |
| `agent_design_doc/extensions/dd-gate.ts` | 195 | 硬边界闸门 |
| `agent_design_doc/extensions/reviewer-agent.ts` | 378 | 三个 dd_check_* 工具 |
| `agent_design_doc/extensions/coms.ts` | 1617 | vendored 会诊网络 |
| `agent_design_doc/extensions/themeMap.ts` | 107 | 主题映射 |
| `agent_design_doc/justfile` | 91 | dd/dd-research/dd-author/dd-review/cg-*/env-check/ext-check |
| `agent_design_doc/docs/design-doc-agent-design.md` | 354 | Agent 自身设计文档（含实施路线五阶段） |
| `agent_design_doc/tools/check-{node-deps.js,py-deps.py}` | 20/31 | 依赖自检正规通道 |
| `agent_design_doc/workspace/fh-ejie-tiedpay-subsidy*/` | — | 两个已产出实例（凤凰e借受托支付财政贴息），含 research/*.json+facts.md、outline.md、正文 md（22 条 @fact）、diagrams/*.drawio+png、成品 docx |
| `agent_design_doc/.pi/settings.json` | 6 | 挂载 dd-gate + reviewer-agent |
| 仓根 `team.json` | — | 团队 SSOT，`design-doc` 坐席定义 |

**已产出实例佐证闭环**：`workspace/fh-ejie-tiedpay-subsidy/` 的 facts.md 标注图谱 `static-snapshot @ 6532a682de35`、outline.md 每节标注事实依据文件、正文含 22 条 `@fact` 断言、diagrams/ 含架构/ER/流程/时序四类 drawio+png——完整跑通「采事实→成文→出图→定稿→评审」管线。
