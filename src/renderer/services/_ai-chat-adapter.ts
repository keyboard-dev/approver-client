import type { ChatModelAdapter } from '@assistant-ui/react'
import type { StreamEvent } from '../../ai-provider/index'
import { Script } from '../../types'
import { contextService } from './context-service'
import { ProviderFormats, useMCPIntegration } from './mcp-tool-integration'
import { runCodeResultContext } from './run-code-result-context'

interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{ type: string, [key: string]: unknown }>
}

interface AIProviderSelection {
  provider: string
  model?: string
  mcpEnabled?: boolean
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

export class AIChatAdapter implements ChatModelAdapter {
  private currentProvider: AIProviderSelection = { provider: 'openai', model: 'gpt-3.5-turbo', mcpEnabled: false }
  private mcpIntegration: ReturnType<typeof useMCPIntegration> | null = null
  private setToolExecutionState?: (isExecuting: boolean, toolName?: string) => void
  private maxAgenticIterations = 10
  private pingInterval: NodeJS.Timeout | null = null
  private isToolsExecuting = false
  private onThreadTitleGenerated?: (title: string) => void
  private titleGeneratedForThread = false
  private thinkingConfig?: { type: 'enabled', budget_tokens: number }

  constructor(provider: string = 'openai', model?: string, mcpEnabled: boolean = false) {
    this.currentProvider = { provider, model, mcpEnabled }
  }

  setThreadTitleCallback(callback: (title: string) => void) {
    this.onThreadTitleGenerated = callback
  }

  resetTitleGeneration() {
    this.titleGeneratedForThread = false
  }

  setProvider(provider: string, model?: string, mcpEnabled?: boolean) {
    this.currentProvider = {
      provider,
      model,
      mcpEnabled: mcpEnabled ?? this.currentProvider.mcpEnabled,
    }
  }

  setMCPIntegration(mcpIntegration: ReturnType<typeof useMCPIntegration> | null) {
    this.mcpIntegration = mcpIntegration
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

  private startPeriodicPing() {
    if (this.pingInterval) {
      return
    }
    this.pingInterval = setInterval(async () => {
      try {
        await window.electronAPI.sendManualPing()
      }
      catch {
        // Silent fail
      }
    }, 10000)
  }

  private stopPeriodicPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private updateToolExecutionState(isExecuting: boolean, toolName?: string) {
    const wasExecuting = this.isToolsExecuting
    this.isToolsExecuting = isExecuting
    this.setToolExecutionState?.(isExecuting, toolName)
    if (isExecuting && !wasExecuting) {
      this.startPeriodicPing()
    }
    else if (!isExecuting && wasExecuting) {
      this.stopPeriodicPing()
    }
  }

  private cleanup() {
    this.stopPeriodicPing()
  }

  private async generateThreadTitle(userMessage: string): Promise<void> {
    if (this.titleGeneratedForThread || !this.onThreadTitleGenerated) {
      return
    }
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
      if (title && title.length > 0) {
        this.onThreadTitleGenerated(title)
      }
    }
    catch {
      // Silently fail
    }
  }

  /**
   * Stream an AI response, handling both text and tool_use events.
   * Yields text updates for smooth streaming. Returns the complete result.
   */
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
    /** Shared ref: the streaming loop populates this with partial tool args as they arrive */
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
      }
      else {
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
              // console.log('[NativeToolCall][delta]', acc.name, 'chunk:', event)
              // Update shared ref with partial args for live UI rendering
              if (toolArgsRef && acc) {
                const existing = toolArgsRef.get(acc.id)
                if (existing) {
                  existing.partialJson = acc.jsonParts.join('')
                }
              }
            }
            break
          }
          case 'tool_use_end': // Block complete, input already accumulated
            break
          case 'message_end':
            stopReason = event.stop_reason
            break
        }
      }
    }

    const handleEnd = () => {
      streamComplete = true
    }
    const handleError = (err: string) => {
      streamError = new Error(err)
      streamComplete = true
    }

    window.electronAPI.onAIStreamChunk(handleChunk)
    window.electronAPI.onAIStreamEnd(handleEnd)
    window.electronAPI.onAIStreamError(handleError)

    try {
      // console.log('[NativeToolCall][stream-start]', JSON.stringify(messages))
      await window.electronAPI.sendAIMessageStream(
        this.currentProvider.provider,
        messages,
        { model: modelOverride || this.currentProvider.model, tools, thinking: this.thinkingConfig },
      )

      while (!streamComplete) {
        if (abortSignal?.aborted) {
          throw new Error('Request was aborted')
        }
        if (streamError) {
          throw streamError
        }
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
          try {
            input = JSON.parse(jsonStr)
          }
          catch {
            inputTruncated = true // JSON was incomplete due to max_tokens truncation
          }
        }
        toolCalls.push({ id: acc.id, name: acc.name, input, inputTruncated })
      }

      return { text: fullText, toolCalls, stopReason }
    }
    finally {
      window.electronAPI.removeAIStreamListeners()
    }
  }

  /**
   * Build an HTML-comment marker for tool activity state (parsed by SmartText).
   */
  private buildToolActivityMarker(
    iteration: number,
    phase: 'running' | 'complete',
    entries: Array<{ name: string, phase: 'running' | 'complete' | 'error', startedAt: number, completedAt?: number, result?: string }>,
  ): string {
    const data = { iteration, phase, tools: entries }
    return `<!--TOOL_ACTIVITY_JSON\n${JSON.stringify(data)}\nTOOL_ACTIVITY_JSON_END-->`
  }

  /**
   * Native tool calling loop. The model decides when to use tools via structured tool_use blocks.
   * No classification, no JSON parsing from text, no completion heuristics needed.
   */
  private async* handleNativeToolCalling(
    aiMessages: AIMessage[],
    tools: Array<{ name: string, description: string, input_schema: Record<string, unknown> }>,
    abortSignal?: AbortSignal,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): AsyncGenerator<{ content: any[] }, void, unknown> {
    if (!this.mcpIntegration) {
      throw new Error('MCP integration not available')
    }

    const conversationHistory: AIMessage[] = [...aiMessages]
    let currentIteration = 0

    // Extract the user's original goal for evaluation context
    const lastUserMsg = aiMessages.findLast(m => m.role === 'user')
    const userGoal = typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg?.content)
        ? lastUserMsg.content.filter((p: { type: string }) => p.type === 'text').map((p: { text?: string }) => p.text || '').join(' ')
        : ''

    // Track all completed tool calls for the UI across iterations
    const completedToolParts: Array<{
      type: 'tool-call'
      toolCallId: string
      toolName: string
      args: Record<string, unknown>
      argsText: string
      result?: string
      isError?: boolean
    }> = []

    // Track tool activity entries for the smart panel
    const toolActivityEntries: Array<{ name: string, phase: 'running' | 'complete' | 'error', startedAt: number, completedAt?: number, result?: string }> = []

    // Only do the deliverable verification re-entry once to prevent infinite loops
    let deliverableCheckDone = false

    yield { content: [{ type: 'text' as const, text: '' }] }

    while (currentIteration < this.maxAgenticIterations) {
      currentIteration++
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      // Stream the AI response, yielding text to the UI in real-time
      let streamingText = ''
      let streamingThinking = ''
      const pendingStreamTools: Array<{ id: string, name: string }> = []
      const streamingToolArgs = new Map<string, { id: string, name: string, partialJson: string }>()
      let streamResult: StreamResult | null = null
      let streamError: Error | null = null
      let lastYieldedTextLen = 0
      const CHARS_PER_YIELD = 15
      const YIELD_INTERVAL_ACTIVE = 20
      const YIELD_INTERVAL_IDLE = 50

      this.streamWithToolSupport(
        conversationHistory, tools, abortSignal, undefined,
        {
          onText: (text) => { streamingText = text },
          onToolStart: (id, name) => { pendingStreamTools.push({ id, name }) },
          onThinking: (text) => { streamingThinking = text },
        },
        streamingToolArgs,
      ).then((r) => { streamResult = r }).catch((e) => { streamError = e as Error })

      // Poll and yield streaming text + pending tool indicators to the UI
      // Keep looping until stream is done AND all buffered text has been shown
      while ((!streamResult && !streamError) || (streamResult && lastYieldedTextLen < streamingText.length)) {
        if (abortSignal?.aborted) throw new Error('Request was aborted')
        const liveContent: Array<{ type: string, [key: string]: unknown }> = [...completedToolParts]

        // Build text: include persisted activity marker for completed tools + current streaming content
        let textPart = ''

        // Persisted activity marker for tools from previous iterations
        if (toolActivityEntries.length > 0) {
          textPart += this.buildToolActivityMarker(currentIteration, 'running', toolActivityEntries)
        }

        // When model is building tool calls, yield partial tool-call parts for RunCodeDisplay
        if (pendingStreamTools.length > 0) {
          if (streamingText) {
            const charsToShow = Math.min(lastYieldedTextLen + CHARS_PER_YIELD, streamingText.length)
            lastYieldedTextLen = charsToShow
            textPart += (textPart ? '\n\n' : '') + streamingText.substring(0, charsToShow)
          }

          // Yield partial tool-call parts so RunCodeToolPart can show code as it streams
          for (const st of pendingStreamTools) {
            const partial = streamingToolArgs.get(st.id)
            if (partial?.partialJson) {
              let partialArgs: Record<string, unknown> = {}
              try { partialArgs = JSON.parse(partial.partialJson) }
              catch { /* partial JSON — use argsText fallback */ }
              liveContent.push({
                type: 'tool-call' as const,
                toolCallId: st.id,
                toolName: st.name,
                args: partialArgs,
                argsText: partial.partialJson,
                result: undefined,
                isError: undefined,
              })
            }
          }
        }
        else if (streamingText) {
          const charsToShow = Math.min(lastYieldedTextLen + CHARS_PER_YIELD, streamingText.length)
          lastYieldedTextLen = charsToShow
          textPart += (textPart ? '\n\n' : '') + streamingText.substring(0, charsToShow)
        }

        if (streamingThinking) {
          liveContent.push({ type: 'reasoning' as const, text: streamingThinking })
        }
        if (textPart) {
          liveContent.push({ type: 'text' as const, text: textPart })
        }

        yield { content: liveContent }
        const hasUnshownContent = lastYieldedTextLen < streamingText.length
        await new Promise(resolve => setTimeout(resolve, hasUnshownContent ? YIELD_INTERVAL_ACTIVE : YIELD_INTERVAL_IDLE))
      }

      if (streamError) throw streamError
      const result = streamResult!

      // console.log('[NativeToolCall][stream-result]', {
      //   iteration: currentIteration,
      //   textLength: result.text.length,
      //   toolCallCount: result.toolCalls.length,
      //   stopReason: result.stopReason,
      // })

      // If no tool calls, this is the final response (text already streamed above)
      // When stopReason is max_tokens but tool calls exist, the model wanted to use tools — execute them
      if (result.toolCalls.length === 0 || (result.stopReason !== 'tool_use' && result.stopReason !== 'max_tokens')) {
        const responseText = result.text || ''

        // Empty response = likely API/connection/payload issue — retry once before fallback
        if (!responseText && currentIteration <= 2) {
          continue
        }

        const displayText = responseText || 'I encountered an issue processing your request. This may be due to a connection interruption. Please try again.'

        // Build persisted activity marker so tool history stays visible in the final message
        const activityPrefix = toolActivityEntries.length > 0
          ? this.buildToolActivityMarker(currentIteration, 'complete', toolActivityEntries) + '\n\n'
          : ''

        const finalContent: Array<{ type: string, [key: string]: unknown }> = [
          ...completedToolParts,
        ]

        // Text was already streamed in real-time, yield final state with reasoning part
        if (streamingThinking) {
          finalContent.push({ type: 'reasoning' as const, text: streamingThinking })
        }
        yield { content: [...finalContent, { type: 'text' as const, text: activityPrefix + displayText }] }

        // Deliverable verification: if tools were used, let the model check whether the
        // last result contains a concrete deliverable. If not, re-enter the loop so it
        // can do a GET/verification call.
        if (completedToolParts.length > 0 && userGoal && !deliverableCheckDone) {
          deliverableCheckDone = true
          const latestResult = runCodeResultContext.getLatestResult()
          if (latestResult) {
            const resultPreview = latestResult.wasSummarized
              ? latestResult.summary.slice(0, 2000)
              : latestResult.fullResult.slice(0, 2000)

            conversationHistory.push({ role: 'assistant', content: displayText })
            conversationHistory.push({
              role: 'user',
              content: `Look at the last tool result:\n\n${resultPreview}\n\nDoes it contain a concrete deliverable (a URL, resource ID, structured data, or image)? If yes, present it to the user. If not, use run-code to do a GET request or verification call to retrieve/confirm the deliverable.`,
            })
            continue // Re-enter the agentic while loop
          }
        }

        return
      }

      // Build assistant message with text + tool_use content blocks
      const assistantContent: Array<{ type: string, [key: string]: unknown }> = []
      if (result.text) {
        // console.log('[NativeToolCall][assistant-content] Text:', result.text)
        assistantContent.push({ type: 'text', text: result.text })
      }
      for (const tc of result.toolCalls) {
        // console.log('[NativeToolCall][assistant-content] Tool call:', tc)
        assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input })
      }
      conversationHistory.push({ role: 'assistant', content: assistantContent })
      const toolResults: Array<{ type: 'tool_result', tool_use_id: string, content: string }> = []

      for (const tc of result.toolCalls) {
        // Add in-progress tool call to UI immediately (no result yet)
        const toolPart = {
          type: 'tool-call' as const,
          toolCallId: tc.id,
          toolName: tc.name,
          args: tc.input,
          argsText: JSON.stringify(tc.input, null, 2),
          result: undefined as string | undefined,
          isError: undefined as boolean | undefined,
        }
        completedToolParts.push(toolPart)

        // Track this tool as running in the activity panel
        const activityEntry: { name: string, phase: 'running' | 'complete' | 'error', startedAt: number, completedAt?: number, result?: string } = { name: tc.name, phase: 'running', startedAt: Date.now() }
        toolActivityEntries.push(activityEntry)

        // Skip execution of truncated tool calls — they'll fail with empty/partial input anyway
        if (tc.inputTruncated) {
          toolPart.result = 'Tool input was truncated due to response length limits. Please retry with smaller code.'
          toolPart.isError = true
          activityEntry.phase = 'error'
          activityEntry.completedAt = Date.now()
          toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: toolPart.result })
          const errorMarker = this.buildToolActivityMarker(currentIteration, 'running', toolActivityEntries)
          yield { content: [...completedToolParts, { type: 'text' as const, text: errorMarker }] }
          continue
        }

        try {
          if (!this.mcpIntegration) {
            throw new Error('MCP integration lost during agentic flow — connection may have dropped')
          }
          this.updateToolExecutionState(true, tc.name)

          // For interactive widget tools, start execution BEFORE yielding UI
          // so the server creates the pending request before the widget iframe
          // loads and calls fetch-accounts-data to get the blockingRequestId.
          const interactiveWidgetTools = ['connect-reconnect-accounts']
          let executionPromise: Promise<string | { summary: string, tokenCount: number, wasFiltered: boolean }> | null = null

          if (interactiveWidgetTools.includes(tc.name)) {
            executionPromise = this.mcpIntegration.executeAbilityCall(tc.name, tc.input)
            // Small delay so the MCP server processes the request before the widget loads
            await new Promise(resolve => setTimeout(resolve, 200))
          }

          // Yield current state so UI shows tool as in-progress with activity panel
          const runningMarker = this.buildToolActivityMarker(currentIteration, 'running', toolActivityEntries)
          yield { content: [...completedToolParts, { type: 'text' as const, text: runningMarker }] }

          // Execute tool (for interactive widget tools, the promise was already started above)
          const executionResult = executionPromise
            ? await executionPromise
            : await this.mcpIntegration.executeAbilityCall(tc.name, tc.input)

          const resultString = typeof executionResult === 'object'
            ? JSON.stringify(executionResult, null, 2)
            : String(executionResult)

          const storedResult = runCodeResultContext.storeResult(tc.name, resultString)
          const contextContent = storedResult.wasSummarized ? storedResult.summary : resultString

          // Update the tool part with result
          toolPart.result = contextContent

          // Mark activity entry as complete
          activityEntry.phase = 'complete'
          activityEntry.completedAt = Date.now()
          activityEntry.result = contextContent.slice(0, 2000)

          toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: contextContent })
          const completedMarker = this.buildToolActivityMarker(currentIteration, 'running', toolActivityEntries)
          yield { content: [...completedToolParts, { type: 'text' as const, text: completedMarker }] }
        }
        catch (error) {
          const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          toolPart.result = errorMsg
          toolPart.isError = true

          // Mark activity entry as error
          activityEntry.phase = 'error'
          activityEntry.completedAt = Date.now()
          activityEntry.result = errorMsg

          toolResults.push({
            type: 'tool_result',
            tool_use_id: tc.id,
            content: errorMsg,
          })

          // Yield updated state so UI shows error
          const errorMarker = this.buildToolActivityMarker(currentIteration, 'running', toolActivityEntries)
          yield { content: [...completedToolParts, { type: 'text' as const, text: errorMarker }] }
        }
        finally {
          this.updateToolExecutionState(false)
        }

        if (abortSignal?.aborted) {
          throw new Error('Request was aborted')
        }
      }

      // If all tools errored and assistant had no text, add context so the model
      // doesn't see a text-less assistant message (which can cause empty responses)
      if (toolResults.every(tr => tr.content.startsWith('Error:')) && !result.text) {
        assistantContent.unshift({ type: 'text', text: 'I attempted to use tools but encountered errors.' })
      }

      // Add tool results as a user message (Anthropic format)
      conversationHistory.push({ role: 'user', content: toolResults })

      // If any tool calls had truncated input, inject a corrective hint so the model generates smaller code
      const hadTruncation = result.toolCalls.some(tc => tc.inputTruncated)
      if (hadTruncation) {
        conversationHistory.push({
          role: 'user',
          content: 'Note: Your previous response was too long and got truncated, which caused incomplete tool input. Please break your work into smaller steps — generate less code per tool call. For example, create the resource first, then populate data in a separate call.',
        })
      }
    }

    // Max iterations reached — get a final summary
    const finalResult = await this.streamWithToolSupport(conversationHistory, undefined, abortSignal)
    const finalContent: Array<{ type: string, [key: string]: unknown }> = [...completedToolParts]
    const CHARS_PER_YIELD = 15
    const YIELD_INTERVAL = 20
    let yielded = 0
    while (yielded < finalResult.text.length) {
      const end = Math.min(yielded + CHARS_PER_YIELD, finalResult.text.length)
      yield { content: [...finalContent, { type: 'text' as const, text: finalResult.text.substring(0, end) }] }
      yielded = end
      await new Promise(resolve => setTimeout(resolve, YIELD_INTERVAL))
    }
  }

  /**
   * Convert @assistant-ui/react messages to AIMessage[], preserving tool-call history.
   * assistant-ui stores tool calls as { type: 'tool-call', toolCallId, toolName, args, result }.
   * We convert these to Anthropic-format tool_use blocks on the assistant message,
   * and synthesize a following user message with tool_result blocks so the model
   * retains full context of prior tool interactions across turns.
   */
  private convertMessagesToAI(messages: any[]): AIMessage[] {
    const aiMessages: AIMessage[] = []

    for (const message of messages) {
      const role = message.role as 'user' | 'assistant' | 'system'
      const parts: any[] = message.content || []

      if (role === 'assistant') {
        const textParts = parts.filter((c: any) => c.type === 'text')
        const toolCallParts = parts.filter((c: any) => c.type === 'tool-call')

        if (toolCallParts.length > 0) {
          // Build assistant message with text + tool_use content blocks
          const contentBlocks: Array<{ type: string, [key: string]: unknown }> = []
          for (const tp of textParts) {
            if (tp.text) contentBlocks.push({ type: 'text', text: tp.text })
          }
          for (const tc of toolCallParts) {
            contentBlocks.push({
              type: 'tool_use',
              id: tc.toolCallId,
              name: tc.toolName,
              input: tc.args || {},
            })
          }
          aiMessages.push({ role: 'assistant', content: contentBlocks })

          // Synthesize a user message with tool_result blocks
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
          // Plain text assistant message
          const textContent = textParts.map((c: any) => c.text || '').join('') || ''
          aiMessages.push({ role, content: textContent })
        }
      }
      else {
        // User and system messages — extract text as before
        const textContent = parts.find?.((c: any) => c.type === 'text')?.text
          || (typeof message.content === 'string' ? message.content : '')
        aiMessages.push({ role, content: textContent })
      }
    }

    return aiMessages
  }

  async* run({ messages, abortSignal }: any) {
    try {
      const aiMessages = this.convertMessagesToAI(messages as any[])

      // Generate thread title on first user message
      const userMessages = aiMessages.filter(m => m.role === 'user')
      if (userMessages.length === 1 && userMessages[0]?.content) {
        this.generateThreadTitle(userMessages[0].content as string)
      }

      // Inject enhanced context into system prompt
      if (this.currentProvider.provider === 'keyboard' && this.currentProvider.mcpEnabled && aiMessages.length > 0) {
        try {
          const lastUserMessage = aiMessages[aiMessages.length - 1]
          if (lastUserMessage?.role === 'user') {
            const enhancedSystemPrompt = await contextService.buildEnhancedSystemPrompt(lastUserMessage.content as string)
            const existingSystemIndex = aiMessages.findIndex(m => m.role === 'system')
            if (existingSystemIndex >= 0) {
              aiMessages[existingSystemIndex].content = enhancedSystemPrompt
            }
            else {
              aiMessages.unshift({ role: 'system', content: enhancedSystemPrompt })
            }
          }
        }
        catch {
          // Silent fail
        }
      }

      // Check provider is configured
      const providerStatus = await window.electronAPI.getAIProviderKeys()
      const currentProviderStatus = providerStatus.find(p => p.provider === this.currentProvider.provider)
      if (!currentProviderStatus?.configured && this.currentProvider.provider !== 'keyboard') {
        yield { content: [{ type: 'text' as const, text: `${this.currentProvider.provider} is not configured. Please set up your API key in Settings > AI Providers.` }] }
        return
      }

      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      // Native tool calling — no classification needed, model decides
      const abilitiesAvailable = this.mcpIntegration?.functions || []
      if (this.currentProvider.mcpEnabled && abilitiesAvailable.length > 0) {
        // Filter out tools whose data is already provided in the system prompt
        // to prevent the model from making redundant calls before getting to actual work
        const redundantTools = new Set([
          'required-starting-context-information',
          'connect-websocket',
          'fetch-accounts-data',
        ])
        const filteredAbilities = abilitiesAvailable.filter(
          a => !redundantTools.has(a.function.name),
        )

        // Tool selection: use Haiku to pick only relevant tools for this request
        let selectedAbilities = filteredAbilities
        try {
          const lastUserMsg = aiMessages.findLast(m => m.role === 'user')
          const userQuery = typeof lastUserMsg?.content === 'string'
            ? lastUserMsg.content
            : Array.isArray(lastUserMsg?.content)
              ? (lastUserMsg.content as Array<{ type: string, text?: string }>).filter(p => p.type === 'text').map(p => p.text || '').join(' ')
              : ''

          if (userQuery && filteredAbilities.length > 8) {
            const toolList = filteredAbilities.map(a =>
              `- ${a.function.name}: ${(a.function.description || '').slice(0, 120)}`,
            ).join('\n')

            console.log('what is the tool list', toolList)

            const selectorResult = await this.streamWithToolSupport(
              [
                {
                  role: 'system',
                  content: `You are a tool selector. Given a user request and a list of available tools, return ONLY a JSON array of tool names that are needed to complete the request. Include tools the task might need across multiple steps (e.g. if building something, include both create and deploy tools). Be inclusive rather than exclusive — it's better to include an extra tool than to miss one needed. Return valid JSON only, no explanation.`,
                },
                {
                  role: 'user',
                  content: `User request: "${userQuery.slice(0, 500)}"\n\nAvailable tools:\n${toolList}\n\nReturn JSON array of relevant tool names:`,
                },
              ],
              undefined,
              abortSignal,
              'claude-haiku-4-5-20251001',
            )

            let selectedNames: string[] = []
            try {
              let jsonStr = selectorResult.text.trim()
              const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
              if (fenceMatch) jsonStr = fenceMatch[1].trim()
              selectedNames = JSON.parse(jsonStr)
            }
            catch {
            }

            if (Array.isArray(selectedNames) && selectedNames.length > 0) {
              const nameSet = new Set(selectedNames)
              const matched = filteredAbilities.filter(a => nameSet.has(a.function.name))
              if (matched.length > 0) {
                selectedAbilities = matched
              }
            }
          }
        }
        catch (selectorErr) {
        }
        const relevantAbilities = ["run-code", "web-search", "list-connected-accounts", "connect-reconnect-accounts"];
        const abilitiesToUse = abilitiesAvailable.filter(a => relevantAbilities.includes(a.function.name))
        const nativeTools = ProviderFormats.anthropic.convertTools(abilitiesToUse) as Array<{ name: string, description: string, input_schema: Record<string, unknown> }>
        for await (const result of this.handleNativeToolCalling(aiMessages, nativeTools, abortSignal)) {
          yield result
        }
        return
      }

      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      // Simple streaming (no tools) — for non-MCP providers or when no tools available
      const streamResult = await this.streamWithToolSupport(aiMessages, undefined, abortSignal)

      const CHARS_PER_YIELD = 15
      const YIELD_INTERVAL = 20
      let yielded = 0
      while (yielded < streamResult.text.length) {
        const end = Math.min(yielded + CHARS_PER_YIELD, streamResult.text.length)
        yield { content: [{ type: 'text' as const, text: streamResult.text.substring(0, end) }] }
        yielded = end
        await new Promise(resolve => setTimeout(resolve, YIELD_INTERVAL))
      }
    }
    catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      yield { content: [{ type: 'text' as const, text: `Error: ${errorMessage}` }] }
    }
    finally {
      this.cleanup()
    }
  }
}
