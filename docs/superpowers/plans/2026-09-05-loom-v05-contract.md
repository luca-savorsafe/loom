# Loom v0.5 契约实施计划

**Goal:** 将已确认的任务、角色与岗位分层落实为可校验的 v1alpha2 文档契约，保留 v1alpha1 历史资料。

**Architecture:** 一个新增 tasks 顶层块；显式执行配置与局部角色；组件引用白名单与 DAG；workflow 向下声明工具、由 task 绑定岗位；策略独立求值。只实现静态规范工具，不实现运行引擎。

**Tech Stack:** Markdown、JSON Schema、YAML、Node.js、Ajv。

在用户已有工作区继续修改，不提交、不改 Draw.io，保留 .gitignore 用户改动。

- [x] 保存 v0.4 Schema、正例、文档与校验脚本快照；旧版测试继续运行。
- [x] 先建立 v1alpha2 的任务选择、角色、依赖类别与循环、只读闭包、验收、入口和事件回退测试，确认新契约未实现时失败。
- [x] 新 Schema 移除 workflow.seat/tool.phase；增加 tasks、role、phase.role/tools、终态及显式有界回边；seat 支持直接组件。
- [x] 增加独立语义校验模块与具体错误路径，覆盖引用白名单、闭包、流程图及验收绑定。
- [x] 重写规范入口及依赖边界文档，保留并更新逐字段手册；更新模板、编译器说明、迁移说明和导航。
- [x] 更新最小、复用岗位、多角色样例，验证旧版与新版正反例、文档覆盖、示例语法及任务实例。
- [x] 最后检查文档链接、旧字段残留、变更范围和 whitespace；按实际结果回填计划。

验证命令：`npm test`、`git diff --check`、`git status --short diagrams`。测试中的无效变体必须断言特定错误 code，不以任意失败充当预期失败。

## 验收记录

- API 使用 agent-dsl/v1alpha2，旧版 v1alpha1 Schema、3 个正例、7 个反例和文档独立保留。
- 现行 3 个完整样例、34 个契约案例、4 个任务输入结果实例断言通过。
- Schema 元数据、逐字段说明、枚举/联合分支覆盖和 5 种文档破坏变体检查通过。
- 引用验收契约扩大 effects、继承属性冒充红线控制、合法内嵌 Schema 被 lint 误拒绝均先复现失败，再修正并回归。
- JSON 文件解析及全部 Markdown 本地链接检查通过；git diff --check 无错误，diagrams 无变更，用户 .gitignore 的 /.idea/ 修改保留。
- 只读独立审查因工具额度中断，已返回的问题线索由主执行者复现并修正；不宣称完成完整外部独立审查。
- 交付范围是规范、静态校验和样例，不是可部署业务运行引擎。
