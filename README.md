# dsh-local-subagent-ask

中文 · English

## 中文

**本地子代理询问闸门**：一个 DeepSeek Harness (DSH) 插件。

### 用途

在单 slot 的本地推理引擎（如 Strata + llama.cpp 服务，单引擎实例）上，创建子代理会和主流抢占同一个引擎，可能把主流掐断（主流在收到完成事件之前结束）。

本插件在**建子代理的工具调用执行前**拦截，判定条件唯一且简单：

- **当前模型的实际调用地址是本地 `127.0.0.1:8080`（可配置）** → 弹出中文询问卡片：「当前在本地模型上（Strata 单 slot），建子代理会抢占引擎、可能掐断主流。允许吗？」
  - 选择**允许** → 放行同一次调用，子代理直接建成；
  - 选择**拒绝**（或无法询问）→ 不创建子代理，主会话正常继续（fail-closed）。
- **当前模型走在线地址**（如 `api.deepseek.com`、`127.0.0.1:8317`）→ 不拦截，直接创建。

要点：

- 判定只看**调用地址**，不看模型名称、不看 DSH 版本、不用其他任何条件。
- 读取的是 session 的 `requestHeader` 实时 provider（GUI 切换模型后立刻生效），不是会话启动时固化的 provider。
- 地址不可读时 fail-closed：走询问。
- **在审批模式（ask）下走原生审批卡片；在完全权限模式（danger-full-access，审批策略 never）下改走 userQuestions 问题卡**——因为审批服务在 never 策略下会跳过一切询问界面直接自动拒绝。两种模式行为一致。
- 拦 `subagent` 与 `subagent_fork`（工具名可配置），不挂 `subagent/start`（拦不住创建）。

### 安装

```bash
dsh plugin --profile web add /path/to/dsh-local-subagent-ask
```

装完**重启 harness**（插件在重启后的 composition 里加载），重启后：

- 本地模型发起子代理 → 弹中文询问；
- 在线模型发起子代理 → 直接创建。

卸载：

```bash
dsh plugin --profile web remove dsh-local-subagent-ask
```

### 配置（插件 config，可选项）

在 profile 的插件 config 里（默认值即开箱可用）：

```yaml
- id: local-subagent-ask
  name: dsh-local-subagent-ask
  config:
    toolNames: [subagent, subagent_fork]      # 要拦的工具名
    localEndpoints: ['127.0.0.1:8080', 'localhost:8080']  # 视为"本地"的主机:端口
```

### 依赖

- `@deepseek-ai/cordis` ^4.0.4、`@deepseek-ai/schemastery` ^3.18.4（peer，由 harness 提供）
- 注入的服务：`llm`、`settings`、`approval`、`userQuestions`（DSH 内置）

## English

**Local Subagent Ask Gate**: a DeepSeek Harness (DSH) plugin.

### Purpose

On a single-slot local inference engine (e.g. Strata + llama.cpp serving one engine instance), creating a subagent contends for the same engine with the main stream and can cut the main stream off (the stream ends before its completion event).

The plugin intercepts **subagent-creating tool calls before execution**. The single check is the endpoint the current model's requests actually go to:

- **Local `127.0.0.1:8080` (configurable)** → an ask card pops: "You are on a local model (Strata single slot). Creating a subagent will contend for the same engine and may cut off the main stream. Allow?"
  - Allow → the same call proceeds, the subagent is created;
  - Deny (or ask unavailable) → no subagent is created, the main session continues normally (fail-closed).
- **Online endpoint** (e.g. `api.deepseek.com`, `127.0.0.1:8317`) → no interception, the subagent is created directly.

Key properties:

- The check is the **request endpoint only** — not the model name, not the DSH version, no other conditions.
- It reads the session's live `requestHeader` provider (takes effect immediately after a GUI model switch), not the provider frozen at session start.
- Endpoint unreadable → fail-closed: ask.
- **Works in approval mode (`ask`) via the native approval card, and in full-access mode (danger-full-access, approval policy `never`) via the userQuestions question card** — the approval service auto-rejects asks under `never`, so the plugin routes asks through the question UI there. Both modes behave the same.
- Intercepts `subagent` and `subagent_fork` (tool names configurable); does not hook `subagent/start` (cannot block creation).

### Install

```bash
dsh plugin --profile web add /path/to/dsh-local-subagent-ask
```

**Restart the harness** afterwards (the plugin loads in the composition built after install), then:

- subagent on a local model → ask card pops;
- subagent on an online model → created directly, no card.

Uninstall:

```bash
dsh plugin --profile web remove dsh-local-subagent-ask
```

### Config (plugin `config`, optional — defaults work out of the box)

```yaml
- id: local-subagent-ask
  name: dsh-local-subagent-ask
  config:
    toolNames: [subagent, subagent_fork]                     # tools to gate
    localEndpoints: ['127.0.0.1:8080', 'localhost:8080']     # host:port treated as local
```

### Requirements

- `@deepseek-ai/cordis` ^4.0.4, `@deepseek-ai/schemastery` ^3.18.4 (peer deps, provided by the harness)
- Injected services: `llm`, `settings`, `approval`, `userQuestions` (DSH built-ins)
