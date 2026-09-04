# Agent DSL 组件模板

> 这是给开发者直接复用的起步模板。
> 核心原则：**组件写能力，assembly 写组织，compiler 做编译。**

---

## 1. 使用方式

建议按下面顺序写：

1. 先定义 `metadata`
2. 再定义 `identity`
3. 再拆 `components`
4. 再写 `assembly`
5. 再补 `seats` 与其余组件（skill / workflow / knowledge / gate 等）
6. 最后收紧 `gate` / `knowledge` / `launch`

其中 workflow 的详细写法建议配合 `templates/workflow-template.md` 一起看。

---

## 2. 通用组件骨架

```yaml
apiVersion: agent-dsl/v1
kind: Agent

metadata:
  id: demo-agent
  name: 演示智能体
  purpose: 演示用 DSL 模板
  version: 0.1.0

identity:
  role: |
    你是一个演示智能体。
  red_lines:
    - 只读源禁止写
  can:
    - 检索
    - 分析
  cannot:
    - 不猜测事实

components: []
assembly: {}
seats: []
gate: {}
knowledge: {}
coms: {}
launch: {}
settings: {}
```

---

## 3. tool 组件模板

**用途**：给 LLM 暴露一个受控入口。

```yaml
components:
  - id: demo-tool
    kind: tool
    source: local:./components/demo-tool
    version: 1.0.0
    description: 演示工具
    provides:
      tool: demo_tool
    requires:
      - bridge: demo_bridge.run
    policy:
      readonly: true
```

**建议**：
- 只放参数校验和调用绑定
- 不放真实业务逻辑
- 写清只读性和输入输出

---

## 4. bridge 组件模板

**用途**：执行确定性逻辑。

```yaml
components:
  - id: demo-bridge
    kind: bridge
    source: local:./components/demo-bridge
    version: 1.0.0
    description: 演示桥接层
    provides:
      bridge: demo_bridge.run
    policy:
      readonly: true
```

**建议**：
- 检索、计算、校验、规则判断放这里
- 必须 facts-only
- 不要把 LLM 推断塞进 bridge

---

## 5. skill 组件模板

**用途**：写工作流软引导。

```yaml
components:
  - id: demo-skill
    kind: skill
    source: local:./components/demo-skill
    version: 1.0.0
    description: 演示工作流引导
    provides:
      skill: demo-skill
```

**建议**：
- 写 phase
- 写 guardrails
- 写完成判据
- 写参考说明

---

## 6. workflow 组件模板

**用途**：把阶段、回退、循环、人工确认点说清楚。更完整的组织方式见 `templates/workflow-template.md`。

```yaml
components:
  - id: demo-flow
    kind: workflow
    source: local:./components/demo-flow
    version: 1.0.0
    description: 演示流程
    provides:
      workflow: demo-flow
```

**建议**：
- 把循环显式化
- 把人工确认点显式化
- 把主路径和 fallback 分开写

---

## 7. knowledge 组件模板

**用途**：管理知识资产。

```yaml
components:
  - id: demo-knowledge
    kind: knowledge
    source: local:./components/demo-knowledge
    version: 1.0.0
    description: 演示知识库
    provides:
      knowledge: demo
```

**建议**：
- 写明 schema
- 写明 candidate 生命周期
- 写明 builder / promote 方式

---

## 8. gate 组件模板

**用途**：定义硬边界。

```yaml
components:
  - id: demo-gate
    kind: gate
    source: local:./components/demo-gate
    version: 1.0.0
    description: 演示边界规则
    provides:
      gate: demo-gate
```

**建议**：
- 写清可写路径
- 写清禁止命令
- 写清 egress 策略
- 写清 candidate-only 规则

---

## 9. assembly 模板

**用途**：把组件组织成一个可运行系统。

```yaml
assembly:
  entrypoints:
    - demo-tool
  groups:
    - name: main-path
      seat: default
      components: [demo-tool, demo-bridge, demo-skill]
      mode: main
  routes:
    - from: demo-tool
      to: demo-skill
      kind: main
  checkpoints:
    - at: demo-skill
      required: true
      prompt: 命中结果后再输出最终结论
  notes:
    - components 是零件，assembly 是组织关系
```

**建议**：
- entrypoints 定义入口
- groups 定义组织块
- routes 定义流向
- checkpoints 定义人工确认点

---

## 10. 最后检查清单

在提交前至少确认这些问题：

- 组件是否拆得足够清楚？
- 组织关系是否显式？
- 有没有把业务逻辑塞进 bridge 之外的地方？
- gate 是否覆盖红线？
- workflow 是否支持回退/循环？
- candidate 资产是否只写 candidate 路径？
- 输出是否可追溯、可审计？

---

## 11. 一句话总结

**组件负责能力，assembly 负责编排，gate 负责边界，compiler 负责把这一切变成可运行智能体。**
