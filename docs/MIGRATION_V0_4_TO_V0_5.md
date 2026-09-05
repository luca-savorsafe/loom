# v0.4 → v0.5 迁移指南

v0.4 使用 agent-dsl/v1alpha1；v0.5 使用 agent-dsl/v1alpha2。此迁移有破坏性变化，不能只改 apiVersion。旧 Schema 保存在 [agent-v1alpha1.schema.json](../schema/versions/agent-v1alpha1.schema.json)，旧规范在 [v0.4 归档](archive/v0.4/AGENT_DSL_SPEC.md)，旧样例在 [legacy/v0.4](../examples/legacy/v0.4/)。

## 1. 迁移映射

| 旧写法 | 新写法 | 原因 |
|---|---|---|
| 无统一业务契约 | 按需 tasks | 明确输入、结果、交互与验收；自由对话仍可无 tasks |
| 每份 Agent 必须 assembly | 有能力包复用时才配置 | 简单 task 直接 components |
| seat 只能 groups | groups/components 二选一 | 不为单岗位强建分组 |
| workflow.spec.seat | workflow.roles + task 执行绑定 | 流程不反向依赖岗位 |
| tool.spec.phase | workflow.phases[].tools | 工具不反向知道业务阶段 |
| phase 只有 id | phase 增加 role | 明确局部执行角色 |
| 隐含流程结束 | 显式 terminal 阶段 | 区分进入终态、完成、验收、交付 |
| 独立 loop 描述 | loop 精确匹配 transition 的 from/to/on/tool | 回边有事件、有次数，删除受限边后无环 |
| group 包含 workflow/output/review/gate | task 引用流程、产物和检查；gate 全局收紧 | 分组只包含执行能力 |
| launch seat + workflow，或 seats=all | task 或自由对话 seat 二选一 | 不重复任务内部绑定，不隐式启动所有角色 |
| 泛型 component 任意依赖 | 源 kind/目标 kind 白名单 | 不允许通过通用引用绕过分层 |
| 路径基准不统一 | local/registry 组件资产相对组件根；inline 相对项目根 | 不静默尝试多个位置 |

## 2. 操作顺序

1. 保存旧清单和旧工具链，不覆盖线上部署。
2. 从现有入口梳理一项业务的 objective、inputSchema、resultSchema、interaction、delivery。
3. 单执行者选择 task.components 或 task.seat；真正协作才用 roles，且至少两项。
4. 从 group 移出流程、产物、检查、persona 和 gate；保留能力组件及其 requires。
5. workflow 声明 roles/terminal，phase 声明 role/tools；单执行者流程使用 executor 槽位。
6. 把旧 tool.phase 迁移到对应流程的 phase.tools，保留正确 tool requires。
7. 给每条业务回边声明明确事件和上限；审批阶段只允许 approval_granted 出口。
8. outputs 显式列出产物，acceptance 引用 review/target；多角色验收必须指定 role。
9. launch 选择 task；如果保持自由对话则只选 seat，不能携带 workflow。
10. 修改 apiVersion，运行新契约校验和实际宿主验证后再切换部署。

迁移不是字段自动替换：旧流程没有明确终态、角色或成功条件时，需要业务作者判断。不会自动把同一个旧 seat 拆成两个所谓“独立审查者”，也不会自动给任意角色全部能力。

## 3. 兼容与验证

npm test 同时验证历史 v0.4 和现行 v0.5。旧负例仍由旧 Schema 检查；新测试使用合法 v1alpha2 基线再变异，并匹配预期 code。runtime.version 与组件 version 不必改成 0.5.0，只有其真实契约变更才修改。

已知仍需实现：真实 resolver/codegen、角色交接、检查器、审批凭证、状态恢复和外部交付。文档迁移完成不等于业务部署可运行。Draw.io 保持历史版本，不能用旧图解释新字段。
