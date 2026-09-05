# Loom 文档导航

当前版本：**v0.5 / agent-dsl/v1alpha2**。这是声明契约与静态校验项目，不是已交付完整调度/编译/运行平台。

## 推荐阅读

1. [主规范](AGENT_DSL_SPEC.md)：从身份、任务输入到执行、交付和验收。
2. [依赖模型](DEPENDENCY_MODEL.md)：关系图、允许引用、禁止反向依赖与职责边界。
3. [字段参考](DSL_FIELD_REFERENCE.md)：每个配置的类型、必要性、默认、阶段和约束。
4. [纯指导任务](../examples/guidance.agent.yaml)：无 seat、无 assembly。
5. [FAQ 岗位复用](../examples/minimal-faq.agent.yaml)：多个任务共享岗位及流程。
6. [多角色候选维护](../examples/data-asset.agent.yaml)：分工、回退、人审、产物与验收。
7. [编译器说明](COMPILER_DESIGN.md)：静态检查与运行时契约分界。
8. [迁移指南](MIGRATION_V0_4_TO_V0_5.md)、[模板](../templates/)、[当前 Schema](../schema/agent.schema.json)。

## 一句话关系

task 定义业务，role 定义业务分工，seat 复用岗位配置，assembly 复用能力包，components 定义能力或契约，resources 登记访问对象，gate 横向限制实际动作。

task/role → seat → group → 能力 → 资源是向下组合；task 直接引用 workflow/review/output 是允许的下层契约绑定。workflow 声明角色槽位，不反向引用 task 或 seat；业务流程回退不等于静态依赖循环。

## 历史与设计记录

- [v0.4 规范归档](archive/v0.4/AGENT_DSL_SPEC.md)、[旧字段参考](archive/v0.4/DSL_FIELD_REFERENCE.md)、[旧 Schema](../schema/versions/agent-v1alpha1.schema.json)。
- [v0.3→v0.4 历史迁移](MIGRATION_V0_3_TO_V0_4.md)。
- [任务方案讨论](superpowers/specs/2026-09-05-loom-task-contract-design.md)与[依赖讨论](superpowers/specs/2026-09-05-loom-dependency-boundaries.md)保留演进记录；现行解释以以上正式规范为准。
- analysis/ 下的领域分析和 Draw.io 是历史研究，不作为 v1alpha2 配置模板。

## 验证

运行 npm test：历史正反例、现行 Schema 与样例、字段覆盖、Markdown YAML、任务语义变体及输入结果实例。

静态通过不证明业务文件存在、模型结论正确、权限实际隔离或交付成功。memory/evolution/coms 等实验适配器必须有明确能力支持，不能因配置合法静默启用。
