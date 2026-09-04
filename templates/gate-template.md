# Agent DSL Gate 模板

> `gate` 是硬边界层。
> 它回答的问题不是“Agent 应该怎么做”，而是：**无论 Agent 怎么想，哪些事都不能做？哪些事只能按白名单做？**

---

## 1. Gate 的职责

`gate` 负责把自然语言红线变成可执行约束：

- 哪些路径可以写
- 哪些路径完全不可访问
- 哪些 shell 命令允许
- 哪些 shell 命令禁止
- 哪些危险动作要重定向到安全工具
- 是否允许联网 / webhook / git push
- knowledge 是否只能写 candidate
- 参数里出现重定向、tee、mkdir、rm 时如何校验路径

一句话：

> **identity 写红线，gate 执行红线。**

---

## 2. 字段总览

```yaml
gate:
  filesystem: {}
  bash: {}
  egress: {}
  zero_access: []
  knowledge_write: {}
```

---

## 3. filesystem

`filesystem` 控制文件写入和删除。

```yaml
gate:
  filesystem:
    write_allow:
      - workspace/**
      - knowledge/**/candidate_*.json
    delete_rule: single_candidate_only
    param_check: true
```

字段说明：

| 字段 | 说明 |
|---|---|
| `write_allow` | 允许写入的路径 glob；未列出默认禁止 |
| `delete_rule` | 删除策略：`single_candidate_only` / `none` / `free` |
| `param_check` | 是否对重定向、tee、mkdir、rm 等参数做路径校验 |

建议：
- 默认只放 `workspace/**`
- 知识沉淀只放 `candidate_*`
- 正式知识、源码、生产配置默认禁止写
- `param_check` 默认开启

---

## 4. bash

`bash` 控制 shell 命令白名单、黑名单和安全重定向。

```yaml
gate:
  bash:
    allow_presets: [readonly, python_tools]
    deny_presets: [network, install, git_push, rm_rf, inline_code]
    allow:
      - "^just [a-z0-9-]+$"
    deny: []
    redirects:
      - pattern: "^java -cp.*jca.jar"
        message: 图谱构建请走 te_graph 工具
        use_tool: te_graph
```

字段说明：

| 字段 | 说明 |
|---|---|
| `allow_presets` | 平台内置白名单组合 |
| `deny_presets` | 平台内置黑名单组合 |
| `allow` | 自定义允许命令正则 |
| `deny` | 自定义禁止命令正则 |
| `redirects` | 危险命令的安全替代指引 |

常用 preset：

| preset | 含义 |
|---|---|
| `readonly` | 只读命令，如 ls/find/rg/git status |
| `python_tools` | 受控 Python 工具脚本 |
| `git_add_commit` | 允许本地 add/commit，不允许 push |
| `drawio` | 允许图形导出相关命令 |
| `controlled_cli` | 允许受控业务 CLI |
| `network` | 禁 curl/wget/ssh 等联网 |
| `install` | 禁 npm/pip/brew 等安装 |
| `git_push` | 禁 git push |
| `rm_rf` | 禁破坏性删除 |
| `inline_code` | 禁 `python -c` / `node -e` 等不可审计内联代码 |
| `dangerous_git` | 禁 reset/clean/rebase 等危险 git |
| `production_write` | 禁疑似生产写操作 |

---

## 5. egress

`egress` 控制对外输出。

```yaml
gate:
  egress:
    policy: deny_all
    allow: []
```

可选策略：
- `deny_all`：默认，不允许对外访问
- `whitelist`：只允许白名单端点

示例：值班 Agent 可以允许通知 webhook，但仍禁止生产写操作。

```yaml
gate:
  egress:
    policy: whitelist
    allow:
      - https://hooks.example.com/batch-duty/**
```

建议：
- 默认 `deny_all`
- webhook 白名单要精确
- git push 一般仍应由人工执行

---

## 6. zero_access

`zero_access` 表示连读都不允许的路径或资源。

```yaml
gate:
  zero_access:
    - .env
    - secrets/**
    - production/**
```

建议：
- 密钥目录放这里
- 生产配置放这里
- 高风险产物目录放这里

---

## 7. knowledge_write

`knowledge_write` 控制知识资产写入策略。

```yaml
gate:
  knowledge_write:
    candidate_only: true
```

建议：
- 默认 `candidate_only: true`
- 正式 promote 必须人工执行
- agent 不能直接覆盖正式知识

---

## 8. 常见 Gate 模式

### 8.1 完全只读型

适合 FAQ / 制度问答 / 代码只读查询。

```yaml
gate:
  filesystem:
    write_allow: []
    delete_rule: none
    param_check: true
  bash:
    allow_presets: [readonly, python_tools]
    deny_presets: [network, install, git_push, rm_rf, inline_code, dangerous_git]
  egress:
    policy: deny_all
  knowledge_write:
    candidate_only: true
```

### 8.2 workspace 输出型

适合设计文档、报告生成、实验草稿。

```yaml
gate:
  filesystem:
    write_allow:
      - workspace/**
    delete_rule: none
    param_check: true
  bash:
    allow_presets: [readonly, python_tools, drawio]
    deny_presets: [network, install, git_push, rm_rf, inline_code]
  egress:
    policy: deny_all
```

### 8.3 candidate 知识沉淀型

适合数据资产、技术专家、知识治理。

```yaml
gate:
  filesystem:
    write_allow:
      - workspace/**
      - knowledge/**/candidate_*.json
    delete_rule: single_candidate_only
    param_check: true
  bash:
    allow_presets: [readonly, python_tools, git_add_commit]
    deny_presets: [network, install, git_push, rm_rf, inline_code, dangerous_git]
  egress:
    policy: deny_all
  knowledge_write:
    candidate_only: true
```

### 8.4 受控研究型

适合 quant-research：允许写研究产物，但禁止晋升和生产。

```yaml
gate:
  filesystem:
    write_allow:
      - outputs/**
      - strategy-registry/drafts/**
      - workspace/**
    delete_rule: none
    param_check: true
  bash:
    allow_presets: [readonly, python_tools, controlled_cli]
    deny_presets: [network, install, git_push, rm_rf, inline_code, dangerous_git, production_write]
    redirects:
      - pattern: "^qb promote"
        message: 晋升必须人工执行；研究态只能生成 draft/candidate
  egress:
    policy: deny_all
```

### 8.5 值班通知型

适合 batch-duty：生产只读，但允许发送通知。

```yaml
gate:
  filesystem:
    write_allow:
      - workspace/**
      - advisories/**
    delete_rule: none
    param_check: true
  bash:
    allow_presets: [readonly, python_tools]
    deny_presets: [install, rm_rf, inline_code, dangerous_git, production_write]
    redirects:
      - pattern: "^.*rerun.*$"
        message: 重跑/跳过只能由人在调度平台执行；Agent 只能出建议单
  egress:
    policy: whitelist
    allow:
      - https://hooks.example.com/batch-duty/**
```

---

## 9. Lint 规则建议

编译器应至少检查：

- `identity.red_lines` 每条都能映射到 gate 规则
- `readonly=false` 的 tool 必须有 `filesystem.write_allow` 支撑
- `knowledge.lifecycle.agent_write=candidate_only` 时，gate 必须只放 candidate 路径
- `egress.policy=whitelist` 时 allow 不得为空
- 禁止把密钥、`.env`、生产配置放进 write_allow
- 禁止同时出现 `deny_presets: [git_push]` 和 `allow: ["git push..."]` 的矛盾配置
- `param_check` 缺省应视为 true
- 任何 promote / publish / register / production write 都必须有 checkpoint

---

## 10. 最佳实践

- 红线不要只写在 `identity.red_lines`，必须落到 gate
- gate 默认收紧，再按业务最小放行
- 能走受控 tool 就不要放裸 shell 命令
- 允许写 workspace，不等于允许写源码
- 允许发通知，不等于允许执行业务动作
- 拦截信息要可恢复：告诉 Agent 应该改用哪个工具或路径

---

## 11. 一句话总结

**gate 是智能体的安全边界；它把“不能做”从 prompt 约束变成运行时强制。**
