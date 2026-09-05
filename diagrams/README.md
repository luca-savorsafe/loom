# Loom Mermaid 图集

本目录的图以 Markdown 中的 Mermaid 代码块维护；它们是现行 `agent-dsl/v1alpha2` 说明的一部分。更新 DSL 结构时，先更新 Schema、[主规范](../docs/AGENT_DSL_SPEC.md)、[依赖模型](../docs/DEPENDENCY_MODEL.md)，再同步本目录对应图。

| 图 | 说明 |
|---|---|
| [整体模型](01-agent-model.md) | Agent、task、role、seat、组件、资源与 gate 的职责关系 |
| [依赖边界](02-dependency-boundaries.md) | 允许的静态引用与策略约束流 |
| [能力装配](03-capability-assembly.md) | 直接能力、岗位与能力包的三种组合方式 |
| [编译与运行](04-compile-and-run.md) | 从静态清单到一次 run 的阶段划分 |
| [知识候选生命周期](05-knowledge-lifecycle.md) | 资源、知识域、候选、人工晋级与运行边界 |

`bak/` 保存停止维护前的 Draw.io 源文件及 PNG 导出，仅供历史追溯；不再作为当前规范或新增图的编辑入口。
