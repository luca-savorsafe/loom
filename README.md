# Loom 🧵

**把身份、业务任务、能力和边界织成可验证的智能体声明。**

Loom 是声明式 Agent 构建框架的规范与静态校验项目。一个 Agent 提供若干业务任务；简单任务直接选择能力，复杂任务按角色和流程分工；seat 与 assembly 是可选的复用手段。

当前契约：**v0.5 / agent-dsl/v1alpha2**。完整 resolver、codegen、运行调度和隔离仍需实现，不把配置校验通过当作已成功部署。

## 从这里开始

- [主规范](docs/AGENT_DSL_SPEC.md)：你是谁、承接什么、怎么执行、怎样交付和验收。
- [依赖关系图与职责](docs/DEPENDENCY_MODEL.md)：任务、角色、岗位、组件、资源和策略各司其职。
- [Mermaid 图集](diagrams/README.md)：整体模型、依赖边界、装配、运行与知识生命周期。
- [逐字段参考](docs/DSL_FIELD_REFERENCE.md)与 [Schema](schema/agent.schema.json)。
- [最小任务](examples/guidance.agent.yaml)、[岗位复用](examples/minimal-faq.agent.yaml)、[多角色协作](examples/data-asset.agent.yaml)。
- [编译器设计](docs/COMPILER_DESIGN.md)、[迁移指南](docs/MIGRATION_V0_4_TO_V0_5.md)、[完整导航](docs/README.md)。

## 核心原则

- 静态依赖有类型、单向、无环；流程可以显式有界回退。
- task 是业务契约，role 是分工，seat 是岗位配置，run 是一次执行。
- 组件登记不自动暴露；分组不调度；岗位不等于沙箱。
- effects 请求能力，gate 与资源/环境共同授权，deny 优先。
- 人工批准来自真实受信通道，不由模型文字替代。
- 执行完成、检查通过、结果送达分别记录。
- 知识先生成候选，正式晋级需独立人工授权。

## 检查

```bash
npm install
npm test
```

同时验证历史 v0.4 和现行 v0.5，包含 Schema、引用与分层、角色/流程、文档覆盖及完整静态样例。正式业务程序和 adapter 不随样例提供。

## 图示维护方式

现行图只维护 [Markdown Mermaid 图集](diagrams/README.md)。历史 Draw.io 源文件和 PNG 导出已移入 `diagrams/bak/`，仅用于追溯，不再作为规范图或编辑入口。
