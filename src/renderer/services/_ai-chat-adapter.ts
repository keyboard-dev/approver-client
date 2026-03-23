import type { ChatModelAdapter } from '@assistant-ui/react'
import type { StreamEvent } from '../../ai-provider/index'
import { Script } from '../../types'
import { contextService } from './context-service'
import { ProviderFormats, useMCPIntegration } from './mcp-tool-integration'
import { runCodeResultContext } from './run-code-result-context'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{ type: string, [key: string]: unknown }>
}

interface ToolCallAccumulator {
  id: string
  name: string
  jsonParts: string[]
}

interface StreamResult {
  text: string
  toolCalls: Array<{ id: string, name: string, input: Record<string, unknown>, inputTruncated?: boolean }>
  stopReason: string
}

interface ToolCallPart {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  argsText: string
  result?: string
  isError?: boolean
}

interface ActivityEntry {
  name: string
  phase: 'running' | 'complete' | 'error'
  startedAt: number
  completedAt?: number
  result?: string
}

// Content parts yielded to the UI
type ContentPart = { type: string, [key: string]: unknown }

// The 4 MCP tools this adapter uses
const ENABLED_TOOLS = ['run-code', 'web-search', 'list-connected-accounts', 'connect-reconnect-accounts']

// Streaming config — yield at the natural SSE cadence, no artificial character throttling
const YIELD_INTERVAL = 30 // ms between UI yields (matches SSE chunk arrival rate)

// ─── Adapter ────────────────────────────────────────────────────────────────

export class AIChatAdapter implements ChatModelAdapter {
  private provider = 'keyboard'
  private model?: string
  private mcpEnabled = true
  private mcpIntegration: ReturnType<typeof useMCPIntegration> | null = null
  private setToolExecutionState?: (isExecuting: boolean, toolName?: string) => void
  private pingInterval: NodeJS.Timeout | null = null
  private isToolsExecuting = false
  private onThreadTitleGenerated?: (title: string) => void
  private titleGeneratedForThread = false
  private thinkingConfig?: { type: 'enabled', budget_tokens: number }
  private maxIterations = 10

  constructor(provider = 'keyboard', model?: string, mcpEnabled = true) {
    this.provider = provider
    this.model = model
    this.mcpEnabled = mcpEnabled
  }

  // ─── Public configuration ───────────────────────────────────────────────

  setProvider(provider: string, model?: string, mcpEnabled?: boolean) {
    this.provider = provider
    this.model = model
    this.mcpEnabled = mcpEnabled ?? this.mcpEnabled
  }

  setMCPIntegration(integration: ReturnType<typeof useMCPIntegration> | null) {
    this.mcpIntegration = integration
  }

  setToolExecutionTracker(tracker: (isExecuting: boolean, toolName?: string) => void) {
    this.setToolExecutionState = tracker
  }

  setThinking(config?: { type: 'enabled', budget_tokens: number }) {
    this.thinkingConfig = config
  }

  setSelectedScripts(scripts: Script[]) {
    contextService.setSelectedScripts(scripts)
  }

  setThreadTitleCallback(callback: (title: string) => void) {
    this.onThreadTitleGenerated = callback
  }

  resetTitleGeneration() {
    this.titleGeneratedForThread = false
  }

  // ─── Main entry point ───────────────────────────────────────────────────

  async* run({ messages, abortSignal }: any) {
    try {
      const aiMessages = this.convertMessagesToAI(messages as any[])

      // Generate thread title on first user message (fire and forget)
      const userMessages = aiMessages.filter(m => m.role === 'user')
      if (userMessages.length === 1 && userMessages[0]?.content) {
        this.generateThreadTitle(userMessages[0].content as string)
      }

      // Inject system prompt with MCP context
      if (this.mcpEnabled) {
        await this.injectSystemPrompt(aiMessages)
      }

      // Get MCP tools
      const tools = this.getEnabledTools()

      if (tools.length > 0 && this.mcpEnabled) {
        // Agentic mode: stream + execute tools in a loop
        yield* this.agenticLoop(aiMessages, tools, abortSignal)
      }
      else {
        // Simple mode: just stream text
        yield* this.streamText(aiMessages, abortSignal)
      }
    }
    catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err
      const msg = err instanceof Error ? err.message : 'Unknown error occurred'
      yield { content: [{ type: 'text' as const, text: `Error: ${msg}` }] }
    }
    finally {
      this.stopPeriodicPing()
    }
  }

  // ─── Agentic loop ──────────────────────────────────────────────────────
  //
  // Pipeline per iteration:
  //   1. Stream AI response (text + tool_use blocks), yielding live content
  //   2. If no tool calls → final response, done
  //   3. Execute each tool call, yielding progress to UI
  //   4. Append results to conversation history
  //   5. Continue loop (model decides if more tools needed)

  private async* agenticLoop(
    aiMessages: AIMessage[],
    tools: Array<{ name: string, description: string, input_schema: Record<string, unknown> }>,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<{ content: ContentPart[] }, void, unknown> {
    if (!this.mcpIntegration) throw new Error('MCP integration not available')

    const history: AIMessage[] = [...aiMessages]
    const completedToolParts: ToolCallPart[] = []
    const activityEntries: ActivityEntry[] = []
    let deliverableCheckDone = false

    yield { content: [{ type: 'text' as const, text: '' }] }

    for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
      this.checkAbort(abortSignal)

      // ── Phase 1: Stream AI response ────────────────────────────────
      const { result, thinkingText } = yield* this.streamAndYield(
        history, tools, abortSignal, completedToolParts, activityEntries, iteration,
      )

      // ── Phase 2: Check if we're done ───────────────────────────────
      const hasToolCalls = result.toolCalls.length > 0
      const wantsTools = result.stopReason === 'tool_use' || result.stopReason === 'max_tokens'

      if (!hasToolCalls || !wantsTools) {
        // Final response — yield with activity summary
        yield* this.yieldFinalResponse(
          result, thinkingText, completedToolParts, activityEntries,
          iteration, history, deliverableCheckDone,
        )

        // Deliverable verification: check if we should re-enter the loop
        if (completedToolParts.length > 0 && !deliverableCheckDone) {
          const shouldContinue = this.injectDeliverableCheck(history, result.text, aiMessages)
          if (shouldContinue) {
            deliverableCheckDone = true
            continue
          }
        }
        return
      }

      // ── Phase 3: Execute tool calls ────────────────────────────────
      const toolResults = yield* this.executeToolCalls(
        result, completedToolParts, activityEntries, iteration, abortSignal,
      )

      // ── Phase 4: Update conversation history ───────────────────────
      this.appendToolTurn(history, result, toolResults)
    }

    // Max iterations reached — get final summary without tools
    yield* this.streamText(history, abortSignal, completedToolParts)
  }

  // ─── Stream AI response and yield live content ──────────────────────────

  private async* streamAndYield(
    history: AIMessage[],
    tools: Array<{ name: string, description: string, input_schema: Record<string, unknown> }>,
    abortSignal: AbortSignal | undefined,
    completedToolParts: ToolCallPart[],
    activityEntries: ActivityEntry[],
    iteration: number,
  ): AsyncGenerator<{ content: ContentPart[] }, { result: StreamResult, thinkingText: string }, unknown> {
    let streamingText = ''
    let streamingThinking = ''
    const pendingTools: Array<{ id: string, name: string }> = []
    const toolArgsMap = new Map<string, { id: string, name: string, partialJson: string }>()
    let streamResult: StreamResult | null = null
    let streamError: Error | null = null
    let lastYieldedLen = 0

    // Start streaming (non-blocking)
    this.streamWithToolSupport(
      history, tools, abortSignal, undefined,
      {
        onText: (text) => { streamingText = text },
        onToolStart: (id, name) => { pendingTools.push({ id, name }) },
        onThinking: (text) => { streamingThinking = text },
      },
      toolArgsMap,
    ).then((r) => { streamResult = r }).catch((e) => { streamError = e as Error })

    // Yield live content as it arrives — no character throttling.
    // SSE chunks arrive at a natural cadence (~10-50 chars every few ms).
    // We yield ALL new text each tick so the UI stays in sync with the stream.
    while ((!streamResult && !streamError) || (streamResult && lastYieldedLen < streamingText.length)) {
      this.checkAbort(abortSignal)

      const content: ContentPart[] = [...completedToolParts]
      let textPart = ''

      // Activity marker from previous iterations
      if (activityEntries.length > 0) {
        textPart += this.buildActivityMarker(iteration, 'running', activityEntries)
      }

      // Yield ALL new text that arrived since last tick (no artificial metering)
      if (streamingText.length > lastYieldedLen) {
        lastYieldedLen = streamingText.length
        // console.log('what is the streaming text', streamingText)
        textPart += (textPart ? '\n\n' : '') + streamingText
      }

      // Partial tool call args (for RunCodeDisplay streaming)
      for (const tool of pendingTools) {
        const partial = toolArgsMap.get(tool.id)
        if (partial?.partialJson) {
          let args: Record<string, unknown> = {}
          try { args = JSON.parse(partial.partialJson) }
          catch { /* partial JSON */ }
          content.push({
            type: 'tool-call' as const,
            toolCallId: tool.id,
            toolName: tool.name,
            args,
            argsText: partial.partialJson,
            result: undefined,
            isError: undefined,
          })
        }
      }

      if (streamingThinking) {
        content.push({ type: 'reasoning' as const, text: streamingThinking })
      }
      if (textPart) {
        content.push({ type: 'text' as const, text: textPart })
      }

      yield { content }
      await new Promise(resolve => setTimeout(resolve, YIELD_INTERVAL))
    }

    if (streamError) throw streamError

    return { result: streamResult!, thinkingText: streamingThinking }
  }

  // ─── Execute tool calls and yield progress ──────────────────────────────

  private async* executeToolCalls(
    result: StreamResult,
    completedToolParts: ToolCallPart[],
    activityEntries: ActivityEntry[],
    iteration: number,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<
    { content: ContentPart[] },
    Array<{ type: 'tool_result', tool_use_id: string, content: string }>,
    unknown
  > {
    const toolResults: Array<{ type: 'tool_result', tool_use_id: string, content: string }> = []

    for (const tc of result.toolCalls) {
      const toolPart: ToolCallPart = {
        type: 'tool-call',
        toolCallId: tc.id,
        toolName: tc.name,
        args: tc.input,
        argsText: JSON.stringify(tc.input, null, 2),
      }
      completedToolParts.push(toolPart)

      const activity: ActivityEntry = { name: tc.name, phase: 'running', startedAt: Date.now() }
      activityEntries.push(activity)

      // Handle truncated input
      if (tc.inputTruncated) {
        const errorMsg = 'Tool input was truncated due to response length limits. Please retry with smaller code.'
        this.markToolError(toolPart, activity, errorMsg)
        toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: errorMsg })
        yield { content: [...completedToolParts, { type: 'text' as const, text: this.buildActivityMarker(iteration, 'running', activityEntries) }] }
        continue
      }

      try {
        if (!this.mcpIntegration) throw new Error('MCP integration lost — connection may have dropped')
        this.updateToolExecution(true, tc.name)

        // Interactive widget tools need early execution (before UI yields)
        const isInteractive = tc.name === 'connect-reconnect-accounts'
        let executionPromise: Promise<string | { summary: string, tokenCount: number, wasFiltered: boolean }> | null = null

        if (isInteractive) {
          executionPromise = this.mcpIntegration.executeAbilityCall(tc.name, tc.input)
          await new Promise(resolve => setTimeout(resolve, 200))
        }

        // Show tool as in-progress
        yield { content: [...completedToolParts, { type: 'text' as const, text: this.buildActivityMarker(iteration, 'running', activityEntries) }] }
        const executionResult = executionPromise
          ? await executionPromise
          : await this.mcpIntegration.executeAbilityCall(tc.name, tc.input)

        const resultString = typeof executionResult === 'object'
          ? JSON.stringify(executionResult, null, 2)
          : String(executionResult)

        const stored = runCodeResultContext.storeResult(tc.name, resultString)
        const contextContent = stored.wasSummarized ? stored.summary : resultString

        // Mark complete
        toolPart.result = contextContent
        activity.phase = 'complete'
        activity.completedAt = Date.now()
        activity.result = contextContent.slice(0, 2000)

        toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: contextContent })
        yield { content: [...completedToolParts, { type: 'text' as const, text: this.buildActivityMarker(iteration, 'running', activityEntries) }] }
      }
      catch (error) {
        const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        this.markToolError(toolPart, activity, errorMsg)
        toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: errorMsg })
        yield { content: [...completedToolParts, { type: 'text' as const, text: this.buildActivityMarker(iteration, 'running', activityEntries) }] }
      }
      finally {
        this.updateToolExecution(false)
      }

      this.checkAbort(abortSignal)
    }

    return toolResults
  }

  // ─── Yield final text response ──────────────────────────────────────────

  private async* yieldFinalResponse(
    result: StreamResult,
    thinkingText: string,
    completedToolParts: ToolCallPart[],
    activityEntries: ActivityEntry[],
    iteration: number,
    history: AIMessage[],
    deliverableCheckDone: boolean,
  ): AsyncGenerator<{ content: ContentPart[] }, void, unknown> {
    const responseText = result.text || 'I encountered an issue processing your request. This may be due to a connection interruption. Please try again.'

    const activityPrefix = activityEntries.length > 0
      ? this.buildActivityMarker(iteration, 'complete', activityEntries) + '\n\n'
      : ''

    const content: ContentPart[] = [...completedToolParts]
    if (thinkingText) {
      content.push({ type: 'reasoning' as const, text: thinkingText })
    }
    content.push({ type: 'text' as const, text: activityPrefix + responseText })

    yield { content }
  }

  // ─── SSE Stream handler ─────────────────────────────────────────────────
  //
  // Manages the IPC bridge to the main process for SSE streaming.
  // Accumulates text + tool_use events and returns the complete result.

  private async streamWithToolSupport(
    messages: AIMessage[],
    tools: Array<{ name: string, description: string, input_schema: Record<string, unknown> }> | undefined,
    abortSignal: AbortSignal | undefined,
    modelOverride?: string,
    callbacks?: {
      onText?: (fullText: string) => void
      onToolStart?: (id: string, name: string) => void
      onThinking?: (fullThinking: string) => void
    },
    toolArgsRef?: Map<string, { id: string, name: string, partialJson: string }>,
  ): Promise<StreamResult> {
    window.electronAPI.removeAIStreamListeners()

    let fullText = ''
    let thinkingText = ''
    let streamComplete = false
    let streamError: Error | null = null
    let stopReason = 'end_turn'
    const toolCallMap = new Map<number, ToolCallAccumulator>()
    let currentToolIndex = -1

    const handleChunk = (chunk: string | Record<string, unknown>) => {
      if (typeof chunk === 'string') {
        fullText += chunk
        callbacks?.onText?.(fullText)
        return
      }

      const event = chunk as unknown as StreamEvent
      switch (event.type) {
        case 'text':
          fullText += event.text
          callbacks?.onText?.(fullText)
          break
        case 'thinking_delta':
          thinkingText += event.text
          callbacks?.onThinking?.(thinkingText)
          break
        case 'tool_use_start': {
          currentToolIndex++
          toolCallMap.set(currentToolIndex, { id: event.id, name: event.name, jsonParts: [] })
          if (toolArgsRef) toolArgsRef.set(event.id, { id: event.id, name: event.name, partialJson: '' })
          callbacks?.onToolStart?.(event.id, event.name)
          break
        }
        case 'tool_use_delta': {
          const idx = parseInt(event.id, 10)
          const acc = toolCallMap.get(idx) || toolCallMap.get(currentToolIndex)
          if (acc) {
            acc.jsonParts.push(event.json)
            if (toolArgsRef) {
              const existing = toolArgsRef.get(acc.id)
              if (existing) existing.partialJson = acc.jsonParts.join('')
            }
          }
          break
        }
        case 'tool_use_end':
          break
        case 'message_end':
          stopReason = event.stop_reason
          break
      }
    }

    window.electronAPI.onAIStreamChunk(handleChunk)
    window.electronAPI.onAIStreamEnd(() => { streamComplete = true })
    window.electronAPI.onAIStreamError((err: string) => { streamError = new Error(err); streamComplete = true })

    try {
      await window.electronAPI.sendAIMessageStream(
        this.provider,
        messages,
        { model: modelOverride || this.model, tools, thinking: this.thinkingConfig },
      )

      while (!streamComplete) {
        if (abortSignal?.aborted) throw new Error('Request was aborted')
        if (streamError) throw streamError
        await new Promise(resolve => setTimeout(resolve, 30))
      }

      if (streamError) throw streamError

      // Parse accumulated tool calls
      const toolCalls: StreamResult['toolCalls'] = []
      for (const acc of toolCallMap.values()) {
        let input: Record<string, unknown> = {}
        let inputTruncated = false
        const jsonStr = acc.jsonParts.join('')
        if (jsonStr) {
          try { input = JSON.parse(jsonStr) }
          catch { inputTruncated = true }
        }
        toolCalls.push({ id: acc.id, name: acc.name, input, inputTruncated })
      }

      return { text: fullText, toolCalls, stopReason }
    }
    finally {
      window.electronAPI.removeAIStreamListeners()
    }
  }

  // ─── Simple text streaming (no tools) ───────────────────────────────────

  private async* streamText(
    messages: AIMessage[],
    abortSignal?: AbortSignal,
    prefixParts: ContentPart[] = [],
  ): AsyncGenerator<{ content: ContentPart[] }, void, unknown> {
    // Stream with live text updates — same pattern as streamAndYield
    let streamingText = ''
    let streamResult: StreamResult | null = null
    let streamError: Error | null = null
    let lastYieldedLen = 0

    this.streamWithToolSupport(
      messages, undefined, abortSignal, undefined,
      { onText: (text) => { streamingText = text } },
    ).then((r) => { streamResult = r }).catch((e) => { streamError = e as Error })

    while ((!streamResult && !streamError) || (streamResult && lastYieldedLen < streamingText.length)) {
      this.checkAbort(abortSignal)
      if (streamingText.length > lastYieldedLen) {
        lastYieldedLen = streamingText.length
        yield { content: [...prefixParts, { type: 'text' as const, text: streamingText }] }
      }
      await new Promise(resolve => setTimeout(resolve, YIELD_INTERVAL))
    }

    if (streamError) throw streamError
  }

  // ─── Conversation history helpers ───────────────────────────────────────

  private appendToolTurn(
    history: AIMessage[],
    result: StreamResult,
    toolResults: Array<{ type: 'tool_result', tool_use_id: string, content: string }>,
  ) {
    // Build assistant message with text + tool_use blocks
    const assistantContent: Array<{ type: string, [key: string]: unknown }> = []
    if (result.text) assistantContent.push({ type: 'text', text: result.text })
    for (const tc of result.toolCalls) {
      assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input })
    }

    // If all tools errored with no text, add context to avoid empty assistant message
    if (toolResults.every(tr => tr.content.startsWith('Error:')) && !result.text) {
      assistantContent.unshift({ type: 'text', text: 'I attempted to use tools but encountered errors.' })
    }

    history.push({ role: 'assistant', content: assistantContent })
    history.push({ role: 'user', content: toolResults })

    // If any tool calls had truncated input, hint the model to use smaller code
    if (result.toolCalls.some(tc => tc.inputTruncated)) {
      history.push({
        role: 'user',
        content: 'Note: Your previous response was too long and got truncated, which caused incomplete tool input. Please break your work into smaller steps.',
      })
    }
  }

  private injectDeliverableCheck(history: AIMessage[], responseText: string, originalMessages: AIMessage[]): boolean {
    const lastUserMsg = originalMessages.findLast(m => m.role === 'user')
    const userGoal = typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg?.content)
        ? lastUserMsg.content.filter((p: { type: string }) => p.type === 'text').map((p: { text?: string }) => p.text || '').join(' ')
        : ''

    if (!userGoal) return false

    const latestResult = runCodeResultContext.getLatestResult()
    if (!latestResult) return false

    const preview = latestResult.wasSummarized
      ? latestResult.summary.slice(0, 2000)
      : latestResult.fullResult.slice(0, 2000)

    history.push({ role: 'assistant', content: responseText || '' })
    history.push({
      role: 'user',
      content: `Look at the last tool result:\n\n${preview}\n\nDoes it contain a concrete deliverable (a URL, resource ID, structured data, or image)? If yes, present it to the user. If not, use run-code to do a GET request or verification call to retrieve/confirm the deliverable.`,
    })
    return true
  }

  // ─── Message conversion ─────────────────────────────────────────────────
  //
  // Converts @assistant-ui/react messages to Anthropic-format AIMessages.
  // Preserves tool-call history across turns.

  private convertMessagesToAI(messages: any[]): AIMessage[] {
    const aiMessages: AIMessage[] = []

    for (const message of messages) {
      const role = message.role as 'user' | 'assistant' | 'system'
      const parts: any[] = message.content || []

      if (role === 'assistant') {
        const textParts = parts.filter((c: any) => c.type === 'text')
        const toolCallParts = parts.filter((c: any) => c.type === 'tool-call')

        if (toolCallParts.length > 0) {
          const contentBlocks: Array<{ type: string, [key: string]: unknown }> = []
          for (const tp of textParts) {
            if (tp.text) contentBlocks.push({ type: 'text', text: tp.text })
          }
          for (const tc of toolCallParts) {
            contentBlocks.push({ type: 'tool_use', id: tc.toolCallId, name: tc.toolName, input: tc.args || {} })
          }
          aiMessages.push({ role: 'assistant', content: contentBlocks })

          const toolResults = toolCallParts
            .filter((tc: any) => tc.result !== undefined)
            .map((tc: any) => ({
              type: 'tool_result',
              tool_use_id: tc.toolCallId,
              content: typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result),
            }))
          if (toolResults.length > 0) {
            aiMessages.push({ role: 'user', content: toolResults })
          }
        }
        else {
          aiMessages.push({ role, content: textParts.map((c: any) => c.text || '').join('') || '' })
        }
      }
      else {
        const textContent = parts.find?.((c: any) => c.type === 'text')?.text
          || (typeof message.content === 'string' ? message.content : '')
        aiMessages.push({ role, content: textContent })
      }
    }

    return aiMessages
  }

  // ─── Tool helpers ───────────────────────────────────────────────────────

  private getEnabledTools(): Array<{ name: string, description: string, input_schema: Record<string, unknown> }> {
    const allAbilities = this.mcpIntegration?.functions || []
    const filtered = allAbilities.filter(a => ENABLED_TOOLS.includes(a.function.name))
    return ProviderFormats.anthropic.convertTools(filtered) as Array<{ name: string, description: string, input_schema: Record<string, unknown> }>
  }

  private markToolError(toolPart: ToolCallPart, activity: ActivityEntry, errorMsg: string) {
    toolPart.result = errorMsg
    toolPart.isError = true
    activity.phase = 'error'
    activity.completedAt = Date.now()
    activity.result = errorMsg
  }

  // ─── UI markers ────────────────────────────────────────────────────────

  private buildActivityMarker(iteration: number, phase: 'running' | 'complete', entries: ActivityEntry[]): string {
    return `<!--TOOL_ACTIVITY_JSON\n${JSON.stringify({ iteration, phase, tools: entries })}\nTOOL_ACTIVITY_JSON_END-->`
  }

  // ─── System prompt injection ────────────────────────────────────────────

  private async injectSystemPrompt(aiMessages: AIMessage[]) {
    try {
      const lastUserMessage = aiMessages.findLast(m => m.role === 'user')
      if (!lastUserMessage) return

      const userContent = typeof lastUserMessage.content === 'string'
        ? lastUserMessage.content
        : ''
      if (!userContent) return

      const enhancedPrompt = await contextService.buildEnhancedSystemPrompt(userContent)
      const existingIdx = aiMessages.findIndex(m => m.role === 'system')
      if (existingIdx >= 0) {
        aiMessages[existingIdx].content = enhancedPrompt
      }
      else {
        aiMessages.unshift({ role: 'system', content: enhancedPrompt })
      }
    }
    catch {
      // Silent fail — adapter works without enhanced context
    }
  }

  // ─── Thread title generation ────────────────────────────────────────────

  private async generateThreadTitle(userMessage: string) {
    if (this.titleGeneratedForThread || !this.onThreadTitleGenerated) return
    this.titleGeneratedForThread = true
    try {
      const response = await window.electronAPI.sendAIMessage(
        'keyboard',
        [
          { role: 'system', content: 'Generate a brief 3-6 word title for this chat based on the user message. Return ONLY the title, no quotes or punctuation.' },
          { role: 'user', content: userMessage },
        ],
        { model: 'claude-haiku-4-5-20251001' },
      )
      const title = response?.trim()
      if (title) this.onThreadTitleGenerated(title)
    }
    catch { /* silent */ }
  }

  // ─── Periodic ping (keeps WS alive during tool execution) ──────────────

  private updateToolExecution(isExecuting: boolean, toolName?: string) {
    const wasExecuting = this.isToolsExecuting
    this.isToolsExecuting = isExecuting
    this.setToolExecutionState?.(isExecuting, toolName)
    if (isExecuting && !wasExecuting) this.startPeriodicPing()
    else if (!isExecuting && wasExecuting) this.stopPeriodicPing()
  }

  private startPeriodicPing() {
    if (this.pingInterval) return
    this.pingInterval = setInterval(async () => {
      try { await window.electronAPI.sendManualPing() }
      catch { /* silent */ }
    }, 10000)
  }

  private stopPeriodicPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  // ─── Utilities ──────────────────────────────────────────────────────────

  private checkAbort(signal?: AbortSignal) {
    if (signal?.aborted) throw new Error('Request was aborted')
  }
}
