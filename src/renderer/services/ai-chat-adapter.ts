import type { ChatModelAdapter } from '@assistant-ui/react'
import { Script } from '../../types'
import { searchCombinedApps } from './combined-apps-service'
import { analyzeCredentialRequirements } from './connection-detection-service'
import { contextService } from './context-service'
import { useMCPIntegration } from './mcp-tool-integration'
import { runCodeResultContext } from './run-code-result-context'

interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
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

  /**
   * Set callback for when missing connections are detected
   */
  setMissingConnectionsCallback(callback: (result: ConnectionCheckResult) => void) {
    this.onMissingConnectionsDetected = callback
  }

  /**
   * Skip the next connection check (used when user dismisses the prompt)
   */
  setSkipConnectionCheck(skip: boolean) {
    this.skipConnectionCheck = skip
  }

  /**
   * Get the last user message that triggered a connection check
   */
  getLastConnectionCheckMessage(): string | null {
    return this.lastUserMessageForConnectionCheck
  }

  /**
   * Clear the stored connection check message
   */
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

    // Update context service with MCP functions for enhanced system prompt
    if (mcpIntegration?.functions) {
      contextService.setMCPFunctions(mcpIntegration.functions)
    }
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

  /**
   * Check if user message requires connections and if they are available
   * Uses AI-powered analysis to determine if existing credentials likely work
   *
   * @param conversationHistory - Full conversation history for context
   */
  async checkConnectionRequirements(conversationHistory: Array<{ role: 'user' | 'assistant' | 'system', content: string }>): Promise<ConnectionCheckResult> {
    try {
      // Get all connected accounts from context service (cached)
      const connectedAccounts = await contextService.getConnectedAccounts()
      const localStatus = await window.electronAPI?.getProviderAuthStatus?.().catch(() => ({}))
      const providerStatus = (localStatus || {}) as Record<string, { authenticated?: boolean }>

      // Build simplified accounts array for AI analysis
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
          .filter(([_, status]) => status?.authenticated)
          .map(([provider]) => ({
            id: `local_${provider}`,
            app: provider,
          })),
      ]

      // Pass full conversation history for proper context
      const analysis = await analyzeCredentialRequirements(conversationHistory, accountsForAnalysis)

      if (analysis.likelyHasCredentials) {
        return {
          hasAllConnections: true,
          missingConnections: [],
          detectedServices: [],
        }
      }

      // User doesn't have credentials - search combined apps + check local providers
      if (analysis.searchTermsIfNoCredentials.length > 0) {
        const searchTerms = analysis.searchTermsIfNoCredentials
        const missingConnections: MissingConnectionInfo[] = []

        // Helper to check if a name matches any search term
        const matchesSearchTerms = (name: string, id: string): boolean => {
          const nameLower = name.toLowerCase()
          const idLower = id.toLowerCase()
          return searchTerms.some((term) => {
            const termLower = term.toLowerCase()
            return nameLower.includes(termLower)
              || idLower.includes(termLower)
              || termLower.includes(nameLower)
          })
        }

        // Check local providers first - these get priority
        const localProviders = await import('./local-providers-service').then(m => m.getLocalProviders())

        for (const provider of localProviders) {
          if (matchesSearchTerms(provider.name, provider.id)) {
            missingConnections.push({
              id: provider.id,
              name: provider.name,
              icon: provider.icon,
              source: 'local',
            })
          }
        }

        // Get combined apps from pipedream/composio
        // If an app exists in both, add both as separate entries
        const searchPromises = searchTerms.map(term => searchCombinedApps(term, false))
        const results = await Promise.all(searchPromises)
        const seenPipedream = new Set<string>()
        const seenComposio = new Set<string>()

        for (const result of results) {
          if (result.success && result.apps) {
            for (const app of result.apps) {
              // Add pipedream entry if available
              if (app.platforms.includes('pipedream') && app.pipedreamSlug && !seenPipedream.has(app.pipedreamSlug)) {
                seenPipedream.add(app.pipedreamSlug)
                const icon = app.pipedreamData?.logoUrl || app.logo || ''
                missingConnections.push({
                  id: app.pipedreamSlug,
                  name: app.name,
                  icon,
                  source: 'pipedream',
                })
              }

              // Add composio entry if available
              if (app.platforms.includes('composio') && app.composioSlug && !seenComposio.has(app.composioSlug)) {
                seenComposio.add(app.composioSlug)
                const icon = app.composioData?.meta?.logo || app.logo || ''
                missingConnections.push({
                  id: app.composioSlug,
                  name: app.name,
                  icon,
                  source: 'composio',
                })
              }
            }
          }
        }

        if (missingConnections.length > 0) {
          return {
            hasAllConnections: false,
            missingConnections: missingConnections.slice(0, 6),
            detectedServices: searchTerms,
            reasoning: analysis.reasoning,
          }
        }
      }

      // Fallback: return generic connection requirement with search terms
      return {
        hasAllConnections: false,
        missingConnections: [{
          id: 'required_connection',
          name: 'Required Connection',
          icon: '',
          source: 'pipedream',
          searchTerms: analysis.searchTermsIfNoCredentials,
        }],
        detectedServices: analysis.searchTermsIfNoCredentials,
        reasoning: analysis.reasoning,
      }
    }
    catch (error) {
      return { hasAllConnections: true, missingConnections: [], detectedServices: [] }
    }
  }

  private startPeriodicPing() {
    if (this.pingInterval) {
      return // Already running
    }

    this.pingInterval = setInterval(async () => {
      try {
        const result = await window.electronAPI.sendManualPing()
        if (!result.success) {
          // Silent fail
        }
      }
      catch (error) {
        // Silent fail
      }
    }, 10000) // 10 seconds
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

    // Call the original tracker if set
    this.setToolExecutionState?.(isExecuting, toolName)

    // Start/stop periodic pinging based on execution state
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

  /**
   * Generate a thread title using AI based on the user's first message
   */
  private async generateThreadTitle(userMessage: string): Promise<void> {
    if (this.titleGeneratedForThread || !this.onThreadTitleGenerated) {
      return
    }

    this.titleGeneratedForThread = true

    try {
      const response = await window.electronAPI.sendAIMessage(
        'keyboard',
        [
          {
            role: 'system',
            content: 'Generate a brief 3-6 word title for this chat based on the user message. Return ONLY the title, no quotes or punctuation.',
          },
          { role: 'user', content: userMessage },
        ],
        { model: 'claude-haiku-4-5-20251001' },
      )

      const title = response?.trim()
      if (title && title.length > 0) {
        this.onThreadTitleGenerated(title)
      }
    }
    catch (error) {
      // Silently fail - keep default "New Chat" title
    }
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 10) // Limit to most relevant keywords
  }

  private preContextPrompt(aiMessages: AIMessage[]) {
    aiMessages[aiMessages.length - 1].content += `

      When you are ready to call an ability, please use the following JSON format:
      \`\`\`json
      {
        "ability": "ability-name",
        "parameters": {
          "param1": "value1",
          "param2": "value2",
          "param3": true,
          "param4": ["value4", "value5"],
          "param5": {
            "nested1": "value6",
            "nested2": "value7"
          }
        }
      }
      \`\`\`

       IMPORTANT: You MUST use the JSON format below to call abilities. Do NOT use XML, <function_calls>, <invoke>, or any other format. Only the JSON format
 will be recognized by the system:
      `

    return aiMessages
  }

  private isTaskComplete(response: string): boolean {
    const completionIndicators = [
      'task completed',
      'task complete',
      'finished',
      'done',
      'completed successfully',
      'all set',
      'no further action needed',
      'task accomplished',
    ]

    const lowerResponse = response.toLowerCase()
    return completionIndicators.some(indicator => lowerResponse.includes(indicator))
      || !this.hasMoreAbilityCallsInResponse(response)
  }

  async classifyQueryComplexity(aiMessages: AIMessage[]): Promise<'simple' | 'web-search' | 'agentic'> {
    try {
      const classificationSystemPrompt = `You are a query classifier. Your task is to classify whether the LAST user message in the conversation requires external tools/actions or is a simple conversational question.

Use the conversation history for context, but base your classification decision on the LAST user message only.

IMPORTANT: If the conversation history shows the assistant was about to use tools/abilities or the user is confirming a previous tool-use suggestion, classify as "agentic" even if the last message is short (e.g., "yes", "please do", "go ahead", "do it").

WEB SEARCH ONLY (respond "web-search"):
- Questions about current events, recent news, or what's happening now
- Questions needing up-to-date information (latest prices, current weather, recent announcements)
- Questions about recent developments, updates, or changes
- "What's new in...", "Latest...", "Current...", "Recent..." type questions
- Any question where the answer likely changed recently or needs fresh data

REQUIRES OTHER TOOLS (respond "agentic"):
- Running code or scripts
- API calls to specific services (not general web search)
- File operations or system tasks
- Complex multi-step tasks
- Creating, modifying, or managing resources

SIMPLE CONVERSATION (respond "simple"):
- General knowledge questions (facts that don't change frequently)
- Explanations or definitions
- Opinions or advice
- Math that can be done mentally
- Questions about the AI itself
- Historical facts or established concepts

Respond with only one word: "simple", "web-search", or "agentic"`

      // Filter to only user and assistant messages, preserving the conversation flow
      const conversationMessages = aiMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))

      const response = await window.electronAPI.sendAIMessage(
        'keyboard',
        [
          { role: 'system', content: classificationSystemPrompt },
          ...conversationMessages,
        ],
        { model: 'claude-haiku-4-5-20251001' },
      )

      const classification = response.toLowerCase().trim()
      if (classification === 'simple') return 'simple'
      if (classification === 'web-search') return 'web-search'
      return 'agentic'
    }
    catch (error) {
      return 'agentic'
    }
  }

  private async* handleWebSearch(aiMessages: AIMessage[], abortSignal?: AbortSignal): AsyncGenerator<{ content: [{ type: 'text', text: string }] }, void, unknown> {
    const lastUserMessage = aiMessages[aiMessages.length - 1]
    const userQuery = lastUserMessage?.content || ''

    // Show empty placeholder while searching
    yield { content: [{ type: 'text' as const, text: '' }] }

    this.onTaskProgress?.({
      step: 1,
      totalSteps: 1,
      currentAction: 'Searching the web...',
      isComplete: false,
    })

    try {
      this.updateToolExecutionState(true, 'web-search')

      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      const searchResult = await window.electronAPI.webSearchGeneral(userQuery)

      this.onTaskProgress?.({
        step: 1,
        totalSteps: 1,
        currentAction: 'Search complete',
        isComplete: true,
      })

      // Extract the text response and citations from the result
      const contentArray = (searchResult as any).response?.content || searchResult.content || []

      let responseText = ''
      const allCitations: Array<{ url: string, title: string }> = []
      const seenUrls = new Set<string>()

      for (const item of contentArray) {
        if (item.type === 'text' && item.text) {
          responseText += item.text
          if (item.citations && Array.isArray(item.citations)) {
            for (const citation of item.citations) {
              if (citation.url && !seenUrls.has(citation.url)) {
                seenUrls.add(citation.url)
                allCitations.push({ url: citation.url, title: citation.title || citation.url })
              }
            }
          }
        }
      }

      if (!responseText) {
        responseText = 'No results found.'
      }

      let formattedResponse = `${responseText}`

      if (allCitations.length > 0) {
        formattedResponse += '\n\n---\n\n**Sources:**'
        for (const citation of allCitations) {
          formattedResponse += `\n- [${citation.title}](${citation.url})`
        }
      }

      yield { content: [{ type: 'text' as const, text: formattedResponse }] }
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      yield { content: [{ type: 'text' as const, text: `Search failed: ${errorMessage}` }] }
    }
    finally {
      this.updateToolExecutionState(false)
    }
  }

  /**
   * Extract all JSON strings from a response that might contain ability calls.
   * Matches both fenced (```json ... ```) and raw JSON objects with "ability" key.
   */
  private extractAbilityJsonCandidates(response: string): string[] {
    const candidates: string[] = []

    const fencedPattern = /```json\s*(.*?)\s*```/gs
    for (const match of response.matchAll(fencedPattern)) {
      candidates.push(match[1])
    }

    // 2. Raw JSON objects containing "ability" (unfenced)
    const rawPattern = /\{[^{}]*"ability"\s*:\s*"[^"]+?"[^{}]*"parameters"\s*:\s*\{/g
    for (const match of response.matchAll(rawPattern)) {
      // Find the full balanced JSON object starting at this position
      const startIdx = match.index!
      let depth = 0
      let endIdx = startIdx
      for (let i = startIdx; i < response.length; i++) {
        if (response[i] === '{') depth++
        else if (response[i] === '}') {
          depth--
          if (depth === 0) {
            endIdx = i + 1
            break
          }
        }
      }
      if (depth === 0 && endIdx > startIdx) {
        const rawCandidate = response.substring(startIdx, endIdx)
        candidates.push(rawCandidate)
      }
    }

    return candidates
  }

  private hasMoreAbilityCallsInResponse(response: string): boolean {
    for (const candidate of this.extractAbilityJsonCandidates(response)) {
      try {
        const parsed = JSON.parse(candidate)
        if (parsed.ability && typeof parsed.ability === 'string') {
          return true
        }
      }
      catch {
        continue
      }
    }
    return false
  }

  private foundAbilityCallsInResponse(response: string) {
    const abilityCalls: Array<{ ability: string, parameters: Record<string, unknown> }> = []
    const seenAbilities = new Set<string>()

    for (const candidate of this.extractAbilityJsonCandidates(response)) {
      try {
        const parsed = JSON.parse(candidate)
        if (parsed.ability && typeof parsed.ability === 'string') {
          // Deduplicate in case fenced and raw match the same JSON
          const key = `${parsed.ability}:${JSON.stringify(parsed.parameters || {})}`
          if (!seenAbilities.has(key)) {
            seenAbilities.add(key)
            abilityCalls.push({
              ability: parsed.ability,
              parameters: parsed.parameters || {},
            })
          }
        }
      }
      catch {
        // Skip invalid JSON
      }
    }
    return abilityCalls
  }

  private async* streamAIResponse(
    messages: AIMessage[],
    abortSignal?: AbortSignal,
  ): AsyncGenerator<{ text: string, isComplete: boolean }, string, unknown> {
    // CRITICAL: Remove any existing listeners from previous stream iterations
    // This prevents event listener collision in the agentic loop
    window.electronAPI.removeAIStreamListeners()

    let fullResponse = ''
    let streamComplete = false
    let streamError: Error | null = null

    const handleChunk = (chunk: string) => {
      fullResponse += chunk
    }

    const handleEnd = () => {
      streamComplete = true
    }

    const handleError = (error: string) => {
      streamError = new Error(error)
      streamComplete = true
    }

    // Set up event listeners
    window.electronAPI.onAIStreamChunk(handleChunk)
    window.electronAPI.onAIStreamEnd(handleEnd)
    window.electronAPI.onAIStreamError(handleError)

    try {
      // Start the stream
      await window.electronAPI.sendAIMessageStream(
        this.currentProvider.provider,
        messages,
        { model: this.currentProvider.model },
      )

      let lastYieldedLength = 0
      const CHARS_PER_YIELD = 15
      const YIELD_INTERVAL = 20

      // Process stream and yield updates with token smoothing
      while (!streamComplete || lastYieldedLength < fullResponse.length) {
        if (abortSignal?.aborted) {
          throw new Error('Request was aborted')
        }

        if (streamError) {
          throw streamError
        }

        if (fullResponse.length > lastYieldedLength) {
          const availableNewContent = fullResponse.length - lastYieldedLength
          const charsToYield = Math.min(CHARS_PER_YIELD, availableNewContent)
          const newYieldLength = lastYieldedLength + charsToYield

          yield { text: fullResponse.substring(0, newYieldLength), isComplete: false }
          lastYieldedLength = newYieldLength

          await new Promise(resolve => setTimeout(resolve, YIELD_INTERVAL))
        }
        else {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }

      yield { text: fullResponse, isComplete: true }

      return fullResponse
    }
    finally {
      window.electronAPI.removeAIStreamListeners()
    }
  }

  private async* handleWithAbilityCalling(aiMessages: AIMessage[], abortSignal?: AbortSignal): AsyncGenerator<{ content: [{ type: 'text', text: string }] }, void, unknown> {
    if (!this.mcpIntegration) {
      throw new Error('MCP integration not available')
    }

    const conversationHistory = [...aiMessages]
    const originalUserMessage = conversationHistory[conversationHistory.length - 1]
    let currentIteration = 0
    let abilitiesRan = ''

    // Show empty placeholder during working phase
    yield { content: [{ type: 'text' as const, text: '' }] }

    // Agentic loop - continue until task is complete or max iterations reached
    while (currentIteration < this.maxAgenticIterations) {
      currentIteration++

      this.onTaskProgress?.({
        step: currentIteration,
        totalSteps: this.maxAgenticIterations,
        currentAction: 'Analyzing your request...',
        isComplete: false,
      })

      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      // Stream AI reasoning (not displayed to user)
      let toolChoiceResponse = ''
      for await (const update of this.streamAIResponse(conversationHistory, abortSignal)) {
        if (update.isComplete) {
          toolChoiceResponse = update.text
        }
      }

      // Check if the first response already contains ability calls
      const firstResponseAbilityCalls = this.foundAbilityCallsInResponse(toolChoiceResponse)

      let response = ''
      if (firstResponseAbilityCalls.length > 0) {
        response = toolChoiceResponse
      }
      else {
        // No abilities in first response - make second call to plan tool execution
        const selectedTools = this.preContextPrompt([{ role: 'user', content: toolChoiceResponse }])

        this.onTaskProgress?.({
          step: currentIteration,
          totalSteps: this.maxAgenticIterations,
          currentAction: 'Planning tool execution...',
          isComplete: false,
        })

        for await (const update of this.streamAIResponse(selectedTools, abortSignal)) {
          if (update.isComplete) {
            response = update.text
          }
        }
      }

      const abilityCalls = this.foundAbilityCallsInResponse(response)

      // If no abilities to execute, check if task is complete
      if (abilityCalls.length === 0) {
        if (this.isTaskComplete(response)) {
          this.onTaskProgress?.({
            step: currentIteration,
            totalSteps: this.maxAgenticIterations,
            currentAction: 'Task completed',
            isComplete: true,
          })
          break
        }
        else {
          conversationHistory.push({ role: 'assistant', content: response })
          conversationHistory.push({
            role: 'user',
            content: 'Please continue working on the original request or indicate if you need more information to complete the task.',
          })
          continue
        }
      }

      // Execute abilities - progress shown via onTaskProgress only
      for (const abilityCall of abilityCalls) {
        const { ability: abilityName, parameters } = abilityCall

        this.onTaskProgress?.({
          step: currentIteration,
          totalSteps: this.maxAgenticIterations,
          currentAction: `Running ${abilityName}...`,
          isComplete: false,
        })

        const abilityExists = this.mcpIntegration?.functions.some(f => f.function.name === abilityName)

        if (abilityExists && this.mcpIntegration) {
          try {
            this.updateToolExecutionState(true, abilityName)

            const executionResult = await this.mcpIntegration.executeAbilityCall(abilityName, parameters)

            this.onTaskProgress?.({
              step: currentIteration,
              totalSteps: this.maxAgenticIterations,
              currentAction: `Completed ${abilityName}, analyzing results...`,
              isComplete: false,
            })

            abilitiesRan += `\n\n**${abilityName}** executed`
            const resultString = typeof executionResult === 'object'
              ? JSON.stringify(executionResult, null, 2)
              : String(executionResult)

            const storedResult = runCodeResultContext.storeResult(abilityName, resultString)
            const contextContent = storedResult.wasSummarized
              ? storedResult.summary
              : resultString

            abilitiesRan += `\n**Result:**\n\`\`\`json\n${contextContent}\n\`\`\``

            if (storedResult.wasSummarized) {
              abilitiesRan += `\n_[Result was large (${storedResult.tokenCount} tokens) - summarized with key data preserved.]_`
            }

            if (abortSignal?.aborted) {
              throw new Error('Request was aborted')
            }
          }
          catch (error) {
            abilitiesRan += `\n\nFailed to execute ${abilityName}: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
          finally {
            this.updateToolExecutionState(false)
          }
        }
        else {
          const searchResult = this.mcpIntegration?.searchAbilities(abilityName, 3)
          if (searchResult && searchResult.matches.length > 0) {
            const suggestions = searchResult.matches.map(m => m.ability.name).join(', ')
            abilitiesRan += `\n\nAbility '${abilityName}' not found. Similar abilities: ${suggestions}`
          }
          else {
            abilitiesRan += `\n\nAbility '${abilityName}' not found`
          }
        }
      }

      // Add conversation history for next iteration
      conversationHistory.push({
        role: 'assistant',
        content: `${response} here is result of abilities I just ran ${abilitiesRan}`,
      })
      conversationHistory.push({
        role: 'user',
        content: `Nice, please analyze your results and either:\n1. Continue working by calling more abilities if needed, OR\n2. Provide your final response if the task is now complete.\n\nMake sure to clearly indicate when the task is complete.`,
      })
    }

    // Handle max iterations
    if (currentIteration >= this.maxAgenticIterations) {
      this.onTaskProgress?.({
        step: currentIteration,
        totalSteps: this.maxAgenticIterations,
        currentAction: 'Maximum iterations reached',
        isComplete: false,
      })
    }

    conversationHistory.push({ role: 'assistant', content: 'the task is complete' })

    // Final analysis - this is the ONLY content shown in the message bubble
    this.onTaskProgress?.({
      step: currentIteration,
      totalSteps: this.maxAgenticIterations,
      currentAction: 'Preparing response...',
      isComplete: false,
    })

    const analysisPrompt = [...conversationHistory, {
      role: 'user' as const,
      content: `Please analyze the following execution results and provide a clear summary:

**Original Request:** ${originalUserMessage.content}

Provide a concise analysis covering:
1. What was accomplished
2. Key results or outputs
3. Whether the original request was fully satisfied
4. Any important findings or next steps

Keep it clear and actionable.`,
    }]

    for await (const update of this.streamAIResponse(analysisPrompt, abortSignal)) {
      yield { content: [{ type: 'text' as const, text: update.text }] }
    }

    this.onTaskProgress?.({
      step: currentIteration,
      totalSteps: this.maxAgenticIterations,
      currentAction: 'Task completed',
      isComplete: true,
    })
  }

  async* run({ messages, abortSignal }: { messages: readonly Array<{ role: string, content: Array<{ type: string, text?: string }> }>, abortSignal?: AbortSignal }) {
    try {
      // Convert assistant-ui messages to our AI provider format
      const aiMessages: AIMessage[] = messages.map((message) => {
        // Get the text content from message
        const textContent = message.content
          ?.find(c => c.type === 'text')?.text || ''

        return {
          role: message.role as 'user' | 'assistant' | 'system',
          content: textContent,
        }
      })

      // Check if this is the first user message and generate thread title
      const userMessages = aiMessages.filter(m => m.role === 'user')
      if (userMessages.length === 1 && userMessages[0]?.content) {
        // Generate title asynchronously (non-blocking)
        this.generateThreadTitle(userMessages[0].content)
      }

      // Check for missing connections before proceeding (only for keyboard provider with MCP)
      if (this.currentProvider.provider === 'keyboard' && this.currentProvider.mcpEnabled && !this.skipConnectionCheck) {
        const lastUserMessage = aiMessages.filter(m => m.role === 'user').pop()
        if (lastUserMessage?.content) {
          // Pass full conversation history for proper context understanding
          const connectionResult = await this.checkConnectionRequirements(aiMessages)

          if (!connectionResult.hasAllConnections && connectionResult.missingConnections.length > 0) {
            // Store the user message for potential "continue anyway" flow
            this.lastUserMessageForConnectionCheck = lastUserMessage.content

            // Notify callback about missing connections
            if (this.onMissingConnectionsDetected) {
              this.onMissingConnectionsDetected(connectionResult)
            }

            // Yield a response indicating missing connections
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

      // Inject enhanced context into system prompt for keyboard provider
      if (this.currentProvider.provider === 'keyboard' && this.currentProvider.mcpEnabled && aiMessages.length > 0) {
        try {
          // Get the user's message for context
          const lastUserMessage = aiMessages[aiMessages.length - 1]
          if (lastUserMessage?.role === 'user') {
            // Get enhanced context with planning token, user tokens, and codespace info
            const enhancedSystemPrompt = await contextService.buildEnhancedSystemPrompt(lastUserMessage.content)
            const existingSystemIndex = aiMessages.findIndex(m => m.role === 'system')
            if (existingSystemIndex >= 0) {
              // Replace existing system message with enhanced one
              aiMessages[existingSystemIndex].content = enhancedSystemPrompt
            }
            else {
              // Add new system message at the beginning
              aiMessages.unshift({
                role: 'system',
                content: enhancedSystemPrompt,
              })
            }
          }
        }
        catch (error) {
          // Silent fail
        }
      }

      // Special handling for MCP provider (legacy)
      if (this.currentProvider.provider === 'mcp') {
        return {
          content: [{
            type: 'text' as const,
            text: `🔌 MCP Provider: This provider uses the Model Context Protocol. Please use the MCP chat component for full functionality.`,
          }],
        }
      }

      // Check if provider is configured
      const providerStatus = await window.electronAPI.getAIProviderKeys()
      const currentProviderStatus = providerStatus.find(p => p.provider === this.currentProvider.provider)

      if (!currentProviderStatus?.configured && this.currentProvider.provider !== 'keyboard') {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ ${this.currentProvider.provider} is not configured. Please set up your API key in Settings > AI Providers.`,
          }],
        }
      }

      // Check if request was aborted
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      // Handle keyboard.dev ability calling if enabled
      const abilitiesAvailable = this.mcpIntegration?.functions || []
      if (this.currentProvider.mcpEnabled && abilitiesAvailable.length > 0) {
        // Classify query complexity first to route to appropriate handler
        let queryType = await this.classifyQueryComplexity(aiMessages)
        if (queryType === 'simple' && this.skipConnectionCheck) {
          queryType = 'agentic'
        }
        // Reset skip flag after use
        this.skipConnectionCheck = false

        if (queryType === 'web-search') {
          // Web search query - use streamlined web search workflow with current date context
          for await (const result of this.handleWebSearch(aiMessages, abortSignal)) {
            yield result
          }
          return
        }

        if (queryType === 'agentic') {
          // Complex query - use full tool-calling workflow
          for await (const result of this.handleWithAbilityCalling(aiMessages, abortSignal)) {
            yield result
          }
          return
        }
        // Simple query - fall through to regular streaming response below
      }

      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      // Set up streaming event handlers
      let accumulatedText = ''
      let streamComplete = false
      let streamError: Error | null = null

      const handleChunk = (chunk: string) => {
        accumulatedText += chunk
      }

      const handleEnd = () => {
        streamComplete = true
      }

      const handleError = (error: string) => {
        streamError = new Error(error)
        streamComplete = true
      }

      // Set up event listeners
      window.electronAPI.onAIStreamChunk(handleChunk)
      window.electronAPI.onAIStreamEnd(handleEnd)
      window.electronAPI.onAIStreamError(handleError)

      try {
        // Start the stream
        await window.electronAPI.sendAIMessageStream(
          this.currentProvider.provider,
          aiMessages,
          { model: this.currentProvider.model },
        )

        let lastYieldedLength = 0
        const CHARS_PER_YIELD = 15 // Smooth typing effect
        const YIELD_INTERVAL = 20 // ms between yields

        while (!streamComplete || lastYieldedLength < accumulatedText.length) {
          if (abortSignal?.aborted) {
            throw new Error('Request was aborted')
          }

          if (streamError) {
            throw streamError
          }

          // Smooth token release: yield content incrementally
          if (accumulatedText.length > lastYieldedLength) {
            const availableNew = accumulatedText.length - lastYieldedLength
            const charsToYield = Math.min(CHARS_PER_YIELD, availableNew)
            const newYieldLength = lastYieldedLength + charsToYield

            yield {
              content: [{ type: 'text' as const, text: accumulatedText.substring(0, newYieldLength) }],
            }
            lastYieldedLength = newYieldLength

            // Short delay for smooth typing effect
            await new Promise(resolve => setTimeout(resolve, YIELD_INTERVAL))
          }
          else {
            // No new content yet, poll at normal rate
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        }

        // Safety net: if the AI produced ability-call JSON in a "simple" response,
        // it means the classifier was wrong. Parse and execute the abilities.
        if (this.mcpIntegration && this.foundAbilityCallsInResponse(accumulatedText).length > 0) {
          // Clean up stream listeners before re-routing
          window.electronAPI.removeAIStreamListeners()
          // Re-run through the agentic handler with the accumulated context
          for await (const result of this.handleWithAbilityCalling(aiMessages, abortSignal)) {
            yield result
          }
          return
        }
      }
      finally {
        // Clean up event listeners
        window.electronAPI.removeAIStreamListeners()
      }
    }
    catch (err) {
      // Handle abort errors gracefully
      if (err instanceof Error && err.name === 'AbortError') {
        throw err // Re-throw abort errors
      }

      // Handle other errors gracefully
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'

      return {
        content: [{
          type: 'text' as const,
          text: `❌ Error: ${errorMessage}`,
        }],
      }
    }
    finally {
      // Ensure we stop pinging when the run method completes
      this.cleanup()
    }
  }
}

// Helper to create adapters for different providers
export const createOpenAIAdapter = (model: string = 'gpt-3.5-turbo', mcpEnabled: boolean = false) =>
  new AIChatAdapter('openai', model, mcpEnabled)

export const createAnthropicAdapter = (model: string = 'claude-sonnet-4-6', mcpEnabled: boolean = false) =>
  new AIChatAdapter('anthropic', model, mcpEnabled)

export const createGeminiAdapter = (model: string = 'gemini-2.5-flash', mcpEnabled: boolean = false) =>
  new AIChatAdapter('gemini', model, mcpEnabled)

export const createMCPAdapter = (model: string = 'mcp-server') =>
  new AIChatAdapter('mcp', model)

// Check provider availability function
export async function checkProviderAvailability(): Promise<Array<{ provider: string, configured: boolean }>> {
  try {
    const providerStatus = await window.electronAPI.getAIProviderKeys()
    return providerStatus || []
  }
  catch (error) {
    return []
  }
}
