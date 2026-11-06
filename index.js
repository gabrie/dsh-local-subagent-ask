import z from '@deepseek-ai/schemastery'

export const inject = ['llm', 'settings', 'approval', 'userQuestions']

export const Config = z.object({
  toolNames: z.array(z.string()).default(['subagent', 'subagent_fork']),
  localEndpoints: z.array(z.string()).default(['127.0.0.1:8080', 'localhost:8080']),
})

const ASK_TEXT = '当前在本地模型上（Strata 单 slot），建子代理会抢占引擎、可能掐断主流。允许吗？'
const ASK_EN = 'You are on a local model (Strata single slot). Creating a subagent will contend for the same engine and may cut off the main stream. Allow?'
const APPROVE_LABEL = '允许'
const DENY_LABEL = '拒绝'

/**
 * Ask channel for approval policy 'never' (danger-full-access): the approval
 * service auto-rejects asks there, so ask through userQuestions (the question
 * card UI) and map the answer to allow/deny. Fail-closed on any failure.
 */
const askViaQuestions = async (ctx, exec) => {
  try {
    const answer = await ctx.userQuestions.ask({
      questions: [
        {
          id: 'local-subagent-ask',
          question: ASK_TEXT,
          header: '子代理询问',
          options: [{ label: APPROVE_LABEL }, { label: DENY_LABEL }],
        },
      ],
      agent: exec.agent,
    })
    const selected = answer?.answers?.find((a) => a.id === 'local-subagent-ask')?.selected ?? []
    if (selected.includes(APPROVE_LABEL)) return { kind: 'allow' }
    return { kind: 'deny', reason: `${ASK_TEXT}（用户选择拒绝，未创建子代理）` }
  } catch {
    return { kind: 'deny', reason: `${ASK_TEXT}（无法询问，未创建子代理）` }
  }
}

/** Resolve the endpoint a provider route's requests go to. */
const endpointOf = (ctx, provider) => {
  const forms = ctx.settings.describe()
  const sectionOf = (ns) => {
    const form = forms.find((f) => f.ns === ns)
    return form ? form.value ?? form.user ?? form.base : undefined
  }
  const entry = ctx.llm.listConfigurableProviders().find((e) => e.provider === provider)
  if (entry) {
    let profile = sectionOf(entry.settingsNs)
    for (const key of entry.settingsPath) profile = profile?.[key]
    return profile?.baseURL ?? entry.defaultBaseURL
  }
  const section = sectionOf(provider)
  return section?.baseURL
}

const isLocalEndpoint = (url, endpoints) => {
  if (url === undefined) return true // 地址不可读 → fail-closed，走询问
  try {
    const u = new URL(url)
    const port = u.port || (u.protocol === 'https:' ? '443' : '80')
    return endpoints.includes(`${u.hostname}:${port}`)
  } catch {
    return true
  }
}

export function apply(ctx, config) {
  const toolNames = new Set(config?.toolNames ?? ['subagent', 'subagent_fork'])
  const endpoints = config?.localEndpoints ?? ['127.0.0.1:8080', 'localhost:8080']
  ctx.effect(function* () {
    yield ctx.on('tools/pre-execute', async (exec, next) => {
      if (!toolNames.has(exec.name)) return next()
      const provider =
        exec.agent?.session?.requestHeader()?.config?.provider ??
        exec.agent?.options?.provider
      const local = provider === undefined
        ? true
        : isLocalEndpoint(endpointOf(ctx, provider), endpoints)
      if (!local) return next()
      const session = exec.agent?.session
      const policy = session && ctx.approval ? ctx.approval.overrideOf(session) ?? 'ask' : 'ask'
      const askDecision = { kind: 'ask', reason: ASK_TEXT, displayReason: { zh: ASK_TEXT, 'zh-CN': ASK_TEXT, en: ASK_EN } }
      if (policy === 'never') return askViaQuestions(ctx, exec)
      return askDecision
    })
  })
}
