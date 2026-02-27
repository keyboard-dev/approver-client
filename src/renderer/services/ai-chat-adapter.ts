import type { ChatModelAdapter } from '@assistant-ui/react'
import type { StreamEvent } from '../../ai-provider/index'
import { Script } from '../../types'
import { searchCombinedApps } from './combined-apps-service'
import { analyzeCredentialRequirements } from './connection-detection-service'
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

export interface MissingConnectionInfo {
  id: string
  name: string
  icon: string
  source: 'pipedream' | 'composio' | 'local'
  searchTerms?: string[] // Search terms for app connector search
}

export interface ConnectionCheckResult {
  hasAllConnections: boolean
  missingConnections: MissingConnectionInfo[]
  detectedServices: string[]
  /** AI reasoning explaining why connections are needed */
  reasoning?: string
}

interface ToolCallAccumulator {
  id: string
  name: string
  jsonParts: string[]
}

interface StreamResult {
  text: string
  toolCalls: Array<{ id: string, name: string, input: Record<string, unknown> }>
  stopReason: string
}

export class AIChatAdapter implements ChatModelAdapter {
  private currentProvider: AIProviderSelection = { provider: 'openai', model: 'gpt-3.5-turbo', mcpEnabled: false }
  private mcpIntegration: ReturnType<typeof useMCPIntegration> | null = null
  private setToolExecutionState?: (isExecuting: boolean, toolName?: string) => void
  private maxAgenticIterations = 10
  private onTaskProgress?: (progress: { step: number, totalSteps: number, currentAction: string, isComplete: boolean }) => void
  private pingInterval: NodeJS.Timeout | null = null
  private isToolsExecuting = false
  private onThreadTitleGenerated?: (title: string) => void
  private titleGeneratedForThread = false
  private onMissingConnectionsDetected?: (result: ConnectionCheckResult) => void
  private skipConnectionCheck = false
  private lastUserMessageForConnectionCheck: string | null = null

  constructor(provider: string = 'openai', model?: string, mcpEnabled: boolean = false) {
    this.currentProvider = { provider, model, mcpEnabled }
  }

  setMissingConnectionsCallback(callback: (result: ConnectionCheckResult) => void) {
    this.onMissingConnectionsDetected = callback
  }

  setSkipConnectionCheck(skip: boolean) {
    this.skipConnectionCheck = skip
  }

  getLastConnectionCheckMessage(): string | null {
    return this.lastUserMessageForConnectionCheck
  }

  clearLastConnectionCheckMessage() {
    this.lastUserMessageForConnectionCheck = null
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

  setTaskProgressTracker(tracker: (progress: { step: number, totalSteps: number, currentAction: string, isComplete: boolean }) => void) {
    this.onTaskProgress = tracker
  }

  setSelectedScripts(scripts: Script[]) {
    contextService.setSelectedScripts(scripts)
  }

  async checkConnectionRequirements(conversationHistory: Array<{ role: 'user' | 'assistant' | 'system', content: string }>): Promise<ConnectionCheckResult> {
    try {
      const connectedAccounts = await contextService.getConnectedAccounts()
      const localStatus = await window.electronAPI?.getProviderAuthStatus?.().catch(() => ({}))
      const providerStatus = (localStatus || {}) as Record<string, { authenticated?: boolean }>

      const accountsForAnalysis = [
        ...connectedAccounts.pipedream.map(a => ({
          id: a.id,
          app: a.app?.nameSlug || a.app?.name || 'unknown',
          name: a.name,
        })),
        ...connectedAccounts.composio
          .filter(a => a.status === 'ACTIVE')
          .map(a => ({
            id: a.id,
            app: a.toolkit?.slug || 'unknown',
          })),
        ...Object.entries(providerStatus)
          .filter(([, status]) => status?.authenticated)
          .map(([provider]) => ({
            id: `local_${provider}`,
            app: provider,
          })),
      ]

      const analysis = await analyzeCredentialRequirements(conversationHistory, accountsForAnalysis)

      if (analysis.likelyHasCredentials) {
        return { hasAllConnections: true, missingConnections: [], detectedServices: [] }
      }

      if (analysis.searchTermsIfNoCredentials.length > 0) {
        const searchTerms = analysis.searchTermsIfNoCredentials
        const missingConnections: MissingConnectionInfo[] = []

        const matchesSearchTerms = (name: string, id: string): boolean => {
          const nameLower = name.toLowerCase()
          const idLower = id.toLowerCase()
          return searchTerms.some((term) => {
            const termLower = term.toLowerCase()
            return nameLower.includes(termLower) || idLower.includes(termLower) || termLower.includes(nameLower)
          })
        }

        const localProviders = await import('./local-providers-service').then(m => m.getLocalProviders())
        for (const provider of localProviders) {
          if (matchesSearchTerms(provider.name, provider.id)) {
            missingConnections.push({ id: provider.id, name: provider.name, icon: provider.icon, source: 'local' })
          }
        }

        const searchPromises = searchTerms.map(term => searchCombinedApps(term, false))
        const results = await Promise.all(searchPromises)
        const seenPipedream = new Set<string>()
        const seenComposio = new Set<string>()

        for (const result of results) {
          if (result.success && result.apps) {
            for (const app of result.apps) {
              if (app.platforms.includes('pipedream') && app.pipedreamSlug && !seenPipedream.has(app.pipedreamSlug)) {
                seenPipedream.add(app.pipedreamSlug)
                missingConnections.push({ id: app.pipedreamSlug, name: app.name, icon: app.pipedreamData?.logoUrl || app.logo || '', source: 'pipedream' })
              }
              if (app.platforms.includes('composio') && app.composioSlug && !seenComposio.has(app.composioSlug)) {
                seenComposio.add(app.composioSlug)
                missingConnections.push({ id: app.composioSlug, name: app.name, icon: app.composioData?.meta?.logo || app.logo || '', source: 'composio' })
              }
            }
          }
        }

        if (missingConnections.length > 0) {
          return { hasAllConnections: false, missingConnections: missingConnections.slice(0, 6), detectedServices: searchTerms, reasoning: analysis.reasoning }
        }
      }

      return {
        hasAllConnections: false,
        missingConnections: [{ id: 'required_connection', name: 'Required Connection', icon: '', source: 'pipedream', searchTerms: analysis.searchTermsIfNoCredentials }],
        detectedServices: analysis.searchTermsIfNoCredentials,
        reasoning: analysis.reasoning,
      }
    }
    catch {
      return { hasAllConnections: true, missingConnections: [], detectedServices: [] }
    }
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
  ): Promise<StreamResult> {
    window.electronAPI.removeAIStreamListeners()

    let fullText = ''
    let streamComplete = false
    let streamError: Error | null = null
    let stopReason = 'end_turn'
    const toolCallMap = new Map<number, ToolCallAccumulator>()
    let currentToolIndex = -1

    const handleChunk = (chunk: string | Record<string, unknown>) => {
      if (typeof chunk === 'string') {
        fullText += chunk
      }
      else {
        const event = chunk as unknown as StreamEvent
        switch (event.type) {
          case 'text':
            fullText += event.text
            break
          case 'tool_use_start': {
            console.log('[NativeToolCall][Stream] tool_use_start:', event.name, event.id)
            currentToolIndex++
            toolCallMap.set(currentToolIndex, { id: event.id, name: event.name, jsonParts: [] })
            break
          }
          case 'tool_use_delta': {
            const idx = parseInt(event.id, 10)
            const acc = toolCallMap.get(idx) || toolCallMap.get(currentToolIndex)
            if (acc) acc.jsonParts.push(event.json)
            break
          }
          case 'tool_use_end': // Block complete, input already accumulated
            break
          case 'message_end':
            console.log('[NativeToolCall][Stream] message_end, stop_reason:', event.stop_reason)
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
      await window.electronAPI.sendAIMessageStream(
        this.currentProvider.provider,
        messages,
        { model: this.currentProvider.model, tools },
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
        const jsonStr = acc.jsonParts.join('')
        if (jsonStr) {
          try {
            input = JSON.parse(jsonStr)
          }
          catch {
            // Invalid JSON accumulated
          }
        }
        toolCalls.push({ id: acc.id, name: acc.name, input })
      }

      console.log('[NativeToolCall][Stream] Complete:', {
        textLength: fullText.length,
        toolCallCount: toolCalls.length,
        toolNames: toolCalls.map(tc => tc.name),
        stopReason,
      })

      return { text: fullText, toolCalls, stopReason }
    }
    finally {
      window.electronAPI.removeAIStreamListeners()
    }
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

    yield { content: [{ type: 'text' as const, text: '' }] }

    while (currentIteration < this.maxAgenticIterations) {
      currentIteration++
      console.log(`[NativeToolCall][Loop] Iteration ${currentIteration}/${this.maxAgenticIterations}`)

      this.onTaskProgress?.({
        step: currentIteration,
        totalSteps: this.maxAgenticIterations,
        currentAction: currentIteration === 1 ? 'Analyzing your request...' : 'Continuing...',
        isComplete: false,
      })

      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      // Stream the AI response with tools, yielding text updates to the UI
      const result = await this.streamWithToolSupport(
        conversationHistory,
        tools,
        abortSignal,
      )

      // If no tool calls, this is the final response — stream it to the user
      if (result.toolCalls.length === 0 || result.stopReason !== 'tool_use') {
        console.log('[NativeToolCall][Loop] Done - no more tool calls, stop_reason:', result.stopReason)
        // Build final content: all completed tool-call parts + final text
        const finalContent: Array<{ type: string, [key: string]: unknown }> = [
          ...completedToolParts,
        ]

        // If we got an empty response, provide feedback instead of a blank message
        const responseText = result.text || 'I encountered an issue processing your request. This may be due to a connection interruption. Please try again.'

        // Stream the final text with smooth typing effect
        const CHARS_PER_YIELD = 15
        const YIELD_INTERVAL = 20
        let yielded = 0
        while (yielded < responseText.length) {
          const end = Math.min(yielded + CHARS_PER_YIELD, responseText.length)
          yield { content: [...finalContent, { type: 'text' as const, text: responseText.substring(0, end) }] }
          yielded = end
          await new Promise(resolve => setTimeout(resolve, YIELD_INTERVAL))
        }

        this.onTaskProgress?.({
          step: currentIteration,
          totalSteps: this.maxAgenticIterations,
          currentAction: 'Task completed',
          isComplete: true,
        })
        return
      }

      // Build assistant message with text + tool_use content blocks
      const assistantContent: Array<{ type: string, [key: string]: unknown }> = []
      if (result.text) {
        assistantContent.push({ type: 'text', text: result.text })
      }
      for (const tc of result.toolCalls) {
        assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input })
      }
      conversationHistory.push({ role: 'assistant', content: assistantContent })
      console.log('[NativeToolCall][Loop] Tool calls:', result.toolCalls.map(tc => ({
        name: tc.name, inputKeys: Object.keys(tc.input),
      })))

      // Execute each tool call
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

        // Yield current state so UI shows tool as in-progress
        yield { content: [...completedToolParts, { type: 'text' as const, text: '' }] }

        this.onTaskProgress?.({
          step: currentIteration,
          totalSteps: this.maxAgenticIterations,
          currentAction: `Running ${tc.name}...`,
          isComplete: false,
        })

        try {
          if (!this.mcpIntegration) {
            throw new Error('MCP integration lost during agentic flow — connection may have dropped')
          }
          this.updateToolExecutionState(true, tc.name)
          const executionResult = await this.mcpIntegration.executeAbilityCall(tc.name, tc.input)

          const resultString = typeof executionResult === 'object'
            ? JSON.stringify(executionResult, null, 2)
            : String(executionResult)

          const storedResult = runCodeResultContext.storeResult(tc.name, resultString)
          const contextContent = storedResult.wasSummarized ? storedResult.summary : resultString

          // Update the tool part with result
          toolPart.result = contextContent

          toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: contextContent })
          console.log(`[NativeToolCall][Loop] ${tc.name} result: ${contextContent.length} chars, summarized=${storedResult.wasSummarized}`)

          // Yield updated state so UI shows tool result
          yield { content: [...completedToolParts, { type: 'text' as const, text: '' }] }

          this.onTaskProgress?.({
            step: currentIteration,
            totalSteps: this.maxAgenticIterations,
            currentAction: `Completed ${tc.name}`,
            isComplete: false,
          })
        }
        catch (error) {
          console.error(`[NativeToolCall][Loop] ${tc.name} error:`, error instanceof Error ? error.message : 'Unknown')
          const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          toolPart.result = errorMsg
          toolPart.isError = true
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tc.id,
            content: errorMsg,
          })

          // Yield updated state so UI shows error
          yield { content: [...completedToolParts, { type: 'text' as const, text: '' }] }
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
      console.log(`[NativeToolCall][Loop] Conversation now has ${conversationHistory.length} messages`)
    }

    // Max iterations reached — get a final summary
    console.log('[NativeToolCall][Loop] Max iterations reached, getting final summary')
    this.onTaskProgress?.({
      step: this.maxAgenticIterations,
      totalSteps: this.maxAgenticIterations,
      currentAction: 'Preparing final response...',
      isComplete: false,
    })

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

    this.onTaskProgress?.({
      step: this.maxAgenticIterations,
      totalSteps: this.maxAgenticIterations,
      currentAction: 'Task completed',
      isComplete: true,
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async* run({ messages, abortSignal }: any) {
    try {
      const aiMessages: AIMessage[] = (messages as any[]).map((message: any) => {
        const textContent = message.content?.find((c: any) => c.type === 'text')?.text || ''
        return {
          role: message.role as 'user' | 'assistant' | 'system',
          content: textContent,
        }
      })

      // Generate thread title on first user message
      const userMessages = aiMessages.filter(m => m.role === 'user')
      if (userMessages.length === 1 && userMessages[0]?.content) {
        this.generateThreadTitle(userMessages[0].content as string)
      }

      // Check for missing connections (keyboard provider with MCP)
      if (this.currentProvider.provider === 'keyboard' && this.currentProvider.mcpEnabled && !this.skipConnectionCheck) {
        const lastUserMessage = aiMessages.filter(m => m.role === 'user').pop()
        if (lastUserMessage?.content) {
          const connectionResult = await this.checkConnectionRequirements(
            aiMessages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' })),
          )
          if (!connectionResult.hasAllConnections && connectionResult.missingConnections.length > 0) {
            this.lastUserMessageForConnectionCheck = lastUserMessage.content as string
            this.onMissingConnectionsDetected?.(connectionResult)
            const serviceNames = connectionResult.missingConnections.map(c => c.name).join(', ')
            yield {
              content: [{
                type: 'text' as const,
                text: `I don't have access to ${serviceNames} tools - I'm currently missing some app connections.\n\nTo complete your request, I would need access to the following services. Please connect them using the prompts above, then try again.`,
              }],
            }
            return
          }
        }
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
        this.skipConnectionCheck = false
        const nativeTools = ProviderFormats.anthropic.convertTools(abilitiesAvailable) as Array<{ name: string, description: string, input_schema: Record<string, unknown> }>
        console.log('[NativeToolCall] Starting with', abilitiesAvailable.length, 'tools:', abilitiesAvailable.map(f => f.function.name))
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
