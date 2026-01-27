import type { ChatModelAdapter } from '@assistant-ui/react'
import { Script } from '../../types'
import { contextService } from './context-service'
import { useMCPIntegration } from './mcp-tool-integration'

interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface AIProviderSelection {
  provider: string
  model?: string
  mcpEnabled?: boolean
}

export class AIChatAdapter implements ChatModelAdapter {
  private currentProvider: AIProviderSelection = { provider: 'openai', model: 'gpt-3.5-turbo', mcpEnabled: false }
  private mcpIntegration: ReturnType<typeof useMCPIntegration> | null = null
  private setToolExecutionState?: (isExecuting: boolean, toolName?: string) => void
  private maxAgenticIterations = 10
  private onTaskProgress?: (progress: { step: number, totalSteps: number, currentAction: string, isComplete: boolean }) => void
  private pingInterval: NodeJS.Timeout | null = null
  private isToolsExecuting = false

  constructor(provider: string = 'openai', model?: string, mcpEnabled: boolean = false) {
    this.currentProvider = { provider, model, mcpEnabled }
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
      console.log('[classifyQueryComplexity] Haiku raw response:', response)
      console.log('[classifyQueryComplexity] Parsed classification:', classification)

      if (classification === 'simple') return 'simple'
      if (classification === 'web-search') return 'web-search'
      return 'agentic'
    }
    catch (error) {
      console.error('[classifyQueryComplexity] Error:', error)
      // On error, default to agentic (safer to have tools available)
      return 'agentic'
    }
  }

  private async* handleWebSearch(aiMessages: AIMessage[], abortSignal?: AbortSignal): AsyncGenerator<{ content: [{ type: 'text', text: string }] }, void, unknown> {
    const lastUserMessage = aiMessages[aiMessages.length - 1]
    const userQuery = lastUserMessage?.content || ''

    // Get current date for context
    const now = new Date()
    const currentDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    let accumulatedResponse = `🔍 **Searching the web...**\n_Current date: ${currentDate}_`
    yield {
      content: [{ type: 'text' as const, text: accumulatedResponse }],
    }

    try {
      this.updateToolExecutionState(true, 'web-search')

      // Check for abort before API call
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      console.log('[handleWebSearch] Calling web-search-general with query:', userQuery)

      // Call the new general web search endpoint
      const searchResult = await window.electronAPI.webSearchGeneral(userQuery)

      console.log('[handleWebSearch] Search result:', searchResult)

      accumulatedResponse += '\n\n✅ **Search complete!**'
      yield {
        content: [{ type: 'text' as const, text: accumulatedResponse }],
      }

      // Extract the text response and citations from the result
      // The response structure is: { response: { content: [...] } }
      const contentArray = (searchResult as any).response?.content || searchResult.content || []

      // Concatenate all text blocks and collect all citations
      let responseText = ''
      const allCitations: Array<{ url: string, title: string }> = []
      const seenUrls = new Set<string>()

      for (const item of contentArray) {
        if (item.type === 'text' && item.text) {
          responseText += item.text
          // Collect citations from each text block
          if (item.citations && Array.isArray(item.citations)) {
            for (const citation of item.citations) {
              // Deduplicate citations by URL
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

      // Format the response with citations
      let formattedResponse = `${accumulatedResponse}\n\n---\n\n${responseText}`

      // Add sources section if there are citations
      if (allCitations.length > 0) {
        formattedResponse += '\n\n---\n\n**Sources:**'
        for (const citation of allCitations) {
          formattedResponse += `\n- [${citation.title}](${citation.url})`
        }
      }

      yield {
        content: [{ type: 'text' as const, text: formattedResponse }],
      }
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      accumulatedResponse += `\n\n❌ **Search failed:** ${errorMessage}`
      yield {
        content: [{ type: 'text' as const, text: accumulatedResponse }],
      }
    }
    finally {
      this.updateToolExecutionState(false)
    }
  }

  private hasMoreAbilityCallsInResponse(response: string): boolean {
    const jsonPattern = /```json\s*(.*?)\s*```/gs
    const jsonMatches = Array.from(response.matchAll(jsonPattern))

    for (const match of jsonMatches) {
      try {
        const parsed = JSON.parse(match[1])
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
    const jsonPattern = /```json\s*(.*?)\s*```/gs
    const jsonMatches = Array.from(response.matchAll(jsonPattern))
    const abilityCalls: Array<{ ability: string, parameters: Record<string, unknown> }> = []

    for (const match of jsonMatches) {
      try {
        const jsonContent = match[1]
        const parsed = JSON.parse(jsonContent)

        if (parsed.ability && typeof parsed.ability === 'string') {
          abilityCalls.push({
            ability: parsed.ability,
            parameters: parsed.parameters || {},
          })
        }
      }
      catch (error) {
        // Skip invalid JSON
      }
    }
    return abilityCalls
  }

  private async* streamAIResponseWithProgress(
    messages: AIMessage[],
    progressPrefix: string,
    currentAccumulated: string,
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
      // Immediately yield progress indicator to show we're starting (before API latency)
      yield {
        text: `${currentAccumulated}\n\n${progressPrefix} ⏳`,
        isComplete: false,
      }
      
      // Start the stream
      await window.electronAPI.sendAIMessageStream(
        this.currentProvider.provider,
        messages,
        { model: this.currentProvider.model },
      )

      let lastYieldedLength = 0  // How much we've actually shown to UI
      const CHARS_PER_YIELD = 15  // Release ~15 chars at a time for smooth typing effect
      const YIELD_INTERVAL = 20  // ms between yields when smoothing
      
      // Process stream and yield updates with token smoothing
      while (!streamComplete || lastYieldedLength < fullResponse.length) {
        if (abortSignal?.aborted) {
          throw new Error('Request was aborted')
        }

        if (streamError) {
          throw streamError
        }

        // Smooth token release: yield content incrementally
        if (fullResponse.length > lastYieldedLength) {
          // Calculate how much new content to yield this iteration
          const availableNewContent = fullResponse.length - lastYieldedLength
          const charsToYield = Math.min(CHARS_PER_YIELD, availableNewContent)
          const newYieldLength = lastYieldedLength + charsToYield
          
          const displayContent = fullResponse.substring(0, newYieldLength)
          const charCount = newYieldLength > 100
            ? ` (${newYieldLength} chars)`
            : ''
          const displayText = newYieldLength > 300
            ? `${displayContent.substring(0, 300)}...`
            : displayContent

          const prefixWithCount = `${progressPrefix}${charCount}`
          const updatedText = `${currentAccumulated}\n\n${prefixWithCount}\n${displayText}`
          yield { text: updatedText, isComplete: false }
          lastYieldedLength = newYieldLength
          
          // Short delay for smooth typing effect
          await new Promise(resolve => setTimeout(resolve, YIELD_INTERVAL))
        } else {
          // No new content yet, poll at normal rate
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }

      // Smooth out any remaining content that wasn't yielded during the loop
      while (lastYieldedLength < fullResponse.length) {
        const availableNewContent = fullResponse.length - lastYieldedLength
        const charsToYield = Math.min(CHARS_PER_YIELD, availableNewContent)
        const newYieldLength = lastYieldedLength + charsToYield
        
        const displayContent = fullResponse.substring(0, newYieldLength)
        const charCount = newYieldLength > 100 ? ` (${newYieldLength} chars)` : ''
        const displayText = newYieldLength > 300
          ? `${displayContent.substring(0, 300)}...`
          : displayContent

        const prefixWithCount = `${progressPrefix}${charCount}`
        yield {
          text: `${currentAccumulated}\n\n${prefixWithCount}\n${displayText}`,
          isComplete: false,
        }
        lastYieldedLength = newYieldLength
        
        await new Promise(resolve => setTimeout(resolve, YIELD_INTERVAL))
      }
      
      // Final yield with complete response
      yield {
        text: `${currentAccumulated}\n\n${progressPrefix}\n${fullResponse}`,
        isComplete: true,
      }

      return fullResponse
    }
    finally {
      // Clean up event listeners
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
    let finalResponse = ''
    let abilitiesRan = ''
    let accumulatedResponse = ''

    // Agentic loop - continue until task is complete or max iterations reached
    while (currentIteration < this.maxAgenticIterations) {
      currentIteration++

      // Report progress and yield update
      this.onTaskProgress?.({
        step: currentIteration,
        totalSteps: this.maxAgenticIterations,
        currentAction: `Processing step ${currentIteration}`,
        isComplete: false,
      })

      const progressUpdate = `🔄 **Iteration ${currentIteration}/${this.maxAgenticIterations}**: Processing step ${currentIteration} of agentic workflow...`
      accumulatedResponse = progressUpdate
      yield {
        content: [{ type: 'text' as const, text: accumulatedResponse }],
      }

      // Check abort signal
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      // Send enhanced message with context
      const enhancedMessages = conversationHistory

      // Stream the AI reasoning response
      let toolChoiceResponse = ''
      for await (const update of this.streamAIResponseWithProgress(
        enhancedMessages,
        '🧠 **Analyzing which tools to use...**',
        accumulatedResponse,
        abortSignal,
      )) {
        yield {
          content: [{ type: 'text' as const, text: update.text }],
        }
        if (update.isComplete) {
          toolChoiceResponse = update.text.split('🧠 **Analyzing which tools to use...**\n')[1] || ''
          accumulatedResponse = update.text
        }
      }

      // Check if the first response already contains ability calls
      // This fixes the regression where the AI produces ability JSON in the first response
      // but the code previously made an unnecessary second call that could lose the abilities
      const firstResponseAbilityCalls = this.foundAbilityCallsInResponse(toolChoiceResponse)

      let response = ''
      if (firstResponseAbilityCalls.length > 0) {
        // First response already has ability calls - use it directly, skip second AI call
        response = toolChoiceResponse
      } else {
        // No abilities in first response - make second call to plan tool execution
        const selectedTools = this.preContextPrompt([{ role: 'user', content: toolChoiceResponse }])

        // Show transition indicator before next API call
        accumulatedResponse += '\n\n⏳ _Preparing next step..._'
        yield {
          content: [{ type: 'text' as const, text: accumulatedResponse }],
        }

        // Stream the tool selection and planning response
        for await (const update of this.streamAIResponseWithProgress(
          selectedTools,
          '🎯 **Planning tool execution...**',
          accumulatedResponse.replace('\n\n⏳ _Preparing next step..._', ''),  // Remove transition indicator
          abortSignal,
        )) {
          yield {
            content: [{ type: 'text' as const, text: update.text }],
          }
          if (update.isComplete) {
            response = update.text.split('🎯 **Planning tool execution...**\n')[1] || ''
            accumulatedResponse = update.text
          }
        }
      }

      finalResponse = response

      const abilityCalls = this.foundAbilityCallsInResponse(response)

      // If no abilities to execute, check if task is complete
      if (abilityCalls.length === 0) {
        if (this.isTaskComplete(response)) {
          this.onTaskProgress?.({
            step: currentIteration,
            totalSteps: this.maxAgenticIterations,
            currentAction: 'Task completed successfully',
            isComplete: true,
          })
          accumulatedResponse += '\n\n✅ **Task Completed Successfully!**'
          yield {
            content: [{ type: 'text' as const, text: accumulatedResponse }],
          }
          break
        }
        else {
          // AI didn't call abilities but task might not be complete
          conversationHistory.push({
            role: 'assistant',
            content: response,
          })
          conversationHistory.push({
            role: 'user',
            content: 'Please continue working on the original request or indicate if you need more information to complete the task.',
          })
          accumulatedResponse += '\n\n🔄 **Continuing to next iteration...**'
          yield {
            content: [{ type: 'text' as const, text: accumulatedResponse }],
          }
          continue
        }
      }

      // Execute abilities with streaming updates
      accumulatedResponse += `\n\n🔧 **Executing ${abilityCalls.length} tool(s):**`
      yield {
        content: [{ type: 'text' as const, text: accumulatedResponse }],
      }

      // Execute each ability and yield updates in real-time
      for (const abilityCall of abilityCalls) {
        const { ability: abilityName, parameters } = abilityCall

        const startMessage = `- **${abilityName}**: Starting execution...`
        accumulatedResponse += `\n${startMessage}`
        yield {
          content: [{ type: 'text' as const, text: accumulatedResponse }],
        }

        this.onTaskProgress?.({
          step: currentIteration,
          totalSteps: this.maxAgenticIterations,
          currentAction: `Executing ${abilityName}`,
          isComplete: false,
        })

        const abilityExists = this.mcpIntegration?.functions.some(f => f.function.name === abilityName)

        if (abilityExists && this.mcpIntegration) {
          try {
            this.updateToolExecutionState(true, abilityName)

            // Execute the ability with periodic UI updates
            const executionPromise = this.mcpIntegration.executeAbilityCall(abilityName, parameters)
            
            // Yield periodic progress updates while waiting for execution
            let executionComplete = false
            let executionResult: any = null
            let executionError: Error | null = null
            
            executionPromise
              .then(result => {
                executionResult = result
                executionComplete = true
              })
              .catch(err => {
                executionError = err
                executionComplete = true
              })
            
            // Show animated progress while waiting - include elapsed time for visibility
            let loopCount = 0
            const startTime = Date.now()
            while (!executionComplete) {
              loopCount++
              
              const elapsedSec = Math.floor((Date.now() - startTime) / 1000)
              const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'][loopCount % 10]
              
              // Update the last line with visible progress (elapsed time + spinner)
              const lines = accumulatedResponse.split('\n')
              lines[lines.length - 1] = `- **${abilityName}**: ${spinner} Running... (${elapsedSec}s)`
              const animatedResponse = lines.join('\n')
              
              yield {
                content: [{ type: 'text' as const, text: animatedResponse }],
              }
              
              await new Promise(resolve => setTimeout(resolve, 300))  // Faster updates for smoother animation
            }
            
            if (executionError) {
              throw executionError
            }

            const resultSummary = `✅ **${abilityName}** completed successfully`
            // Replace the "Executing..." line with success message
            const lines = accumulatedResponse.split('\n')
            lines[lines.length - 1] = resultSummary
            accumulatedResponse = lines.join('\n')
            yield {
              content: [{ type: 'text' as const, text: accumulatedResponse }],
            }

            abilitiesRan += `\n\n🚀 **${abilityName}** executed`
            // Properly serialize the result - executionResult is an object
            const resultString = typeof executionResult === 'object'
              ? JSON.stringify(executionResult, null, 2)
              : String(executionResult)
            abilitiesRan += `\n**Result:** ${resultString}`

            if (abortSignal?.aborted) {
              throw new Error('Request was aborted')
            }
          }
          catch (error) {
            const errorMessage = `❌ **${abilityName}** failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            accumulatedResponse += `\n${errorMessage}`
            yield {
              content: [{ type: 'text' as const, text: accumulatedResponse }],
            }
            abilitiesRan += `\n\n❌ **Error:** Failed to execute ${abilityName} - ${error instanceof Error ? error.message : 'Unknown error'}`
          }
          finally {
            this.updateToolExecutionState(false)
          }
        }
        else {
          const searchResult = this.mcpIntegration?.searchAbilities(abilityName, 3)
          if (searchResult && searchResult.matches.length > 0) {
            const suggestions = searchResult.matches.map(m => m.ability.name).join(', ')
            const errorMessage = `⚠️ **${abilityName}** not found. Similar: ${suggestions}`
            accumulatedResponse += `\n${errorMessage}`
            yield {
              content: [{ type: 'text' as const, text: accumulatedResponse }],
            }
            abilitiesRan += `\n\n⚠️ **Error:** Ability '${abilityName}' not found. Similar abilities: ${suggestions}`
          }
          else {
            const errorMessage = `⚠️ **${abilityName}** not found`
            accumulatedResponse += `\n${errorMessage}`
            yield {
              content: [{ type: 'text' as const, text: accumulatedResponse }],
            }
            abilitiesRan += `\n\n⚠️ **Error:** Ability '${abilityName}' not found`
          }
        }
      }

      // Update accumulated response with tool results summary
      accumulatedResponse += `\n\n📊 **Tool Results:**\n${abilitiesRan.substring(0, 200)}${abilitiesRan.length > 200 ? '...' : ''}`
      yield {
        content: [{ type: 'text' as const, text: accumulatedResponse }],
      }

      // Show transition indicator before analyzing results (there will be API latency)
      accumulatedResponse += '\n\n⏳ _Analyzing results..._'
      yield {
        content: [{ type: 'text' as const, text: accumulatedResponse }],
      }

      // Add conversation history for next iteration
      conversationHistory.push({
        role: 'assistant',
        content: `${response} here is result of abilities I just ran ${JSON.stringify(abilitiesRan, null, 2)}`,
      })

      conversationHistory.push({
        role: 'user',
        content: `Nice, please analyze your results and either:\n1. Continue working by calling more abilities if needed, OR\n2. Provide your final response if the task is now complete.\n\nMake sure to clearly indicate when the task is complete.`,
      })
    }

    // If we've reached max iterations, indicate this
    if (currentIteration >= this.maxAgenticIterations) {
      finalResponse += `\n\n⚠️ **Note:** Reached maximum number of agentic iterations (${this.maxAgenticIterations}). The task may not be fully complete.`
      this.onTaskProgress?.({
        step: currentIteration,
        totalSteps: this.maxAgenticIterations,
        currentAction: 'Maximum iterations reached',
        isComplete: false,
      })

      accumulatedResponse += '\n\n⚠️ **Maximum iterations reached**'
      yield {
        content: [{ type: 'text' as const, text: accumulatedResponse }],
      }
    }
    conversationHistory.push({
      role: 'assistant',
      content: 'the task is complete',
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

    let analysisResponse = ''
    for await (const update of this.streamAIResponseWithProgress(
      analysisPrompt,
      '🔍 **Analyzing execution results...**',
      accumulatedResponse,
      abortSignal,
    )) {
      yield {
        content: [{ type: 'text' as const, text: update.text }],
      }
      if (update.isComplete) {
        analysisResponse = update.text.split('🔍 **Analyzing execution results...**\n')[1] || ''
        accumulatedResponse = update.text
      }
    }

    // Format the complete response with collapsible JSON results
    const formattedResponse = `

## Analysis
${analysisResponse}`

    // Yield final complete response
    yield {
      content: [{ type: 'text' as const, text: formattedResponse }],
    }
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

      // Inject enhanced context into system prompt for keyboard provider
      if (this.currentProvider.provider === 'keyboard' && this.currentProvider.mcpEnabled && aiMessages.length > 0) {
        try {
          // Get the user's message for context
          const lastUserMessage = aiMessages[aiMessages.length - 1]
          if (lastUserMessage?.role === 'user') {
            // Get enhanced context with planning token, user tokens, and codespace info
            const enhancedSystemPrompt = await contextService.buildEnhancedSystemPrompt(lastUserMessage.content)
            console.log('enhancedSystemPrompt', enhancedSystemPrompt)
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
      console.log('[run] mcpEnabled:', this.currentProvider.mcpEnabled, 'abilitiesAvailable:', abilitiesAvailable.length)

      if (this.currentProvider.mcpEnabled && abilitiesAvailable.length > 0) {
        // Classify query complexity first to route to appropriate handler
        const queryType = await this.classifyQueryComplexity(aiMessages)
        console.log('[run] Query type classification result:', queryType)

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
        const CHARS_PER_YIELD = 15  // Smooth typing effect
        const YIELD_INTERVAL = 20  // ms between yields
        
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
          } else {
            // No new content yet, poll at normal rate
            await new Promise(resolve => setTimeout(resolve, 50))
          }
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

export const createAnthropicAdapter = (model: string = 'claude-sonnet-4-5', mcpEnabled: boolean = false) =>
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
