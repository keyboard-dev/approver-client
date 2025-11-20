import type { ChatModelAdapter } from '@assistant-ui/react'
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
  private attempts = 5
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

  private startPeriodicPing() {
    if (this.pingInterval) {
      return // Already running
    }

    console.log('🏓 Starting periodic ping during tool execution')
    this.pingInterval = setInterval(async () => {
      try {
        const result = await window.electronAPI.sendManualPing()
        console.log('🏓 Periodic ping result:', {
          success: result.success,
          connected: result.connectionHealth.connected,
          timeSinceLastActivity: result.connectionHealth.timeSinceLastActivity,
        })

        if (!result.success) {
          console.warn('⚠️ Periodic ping failed:', result.error)
        }
      }
      catch (error) {
        console.error('❌ Periodic ping error:', error)
      }
    }, 10000) // 10 seconds
  }

  private stopPeriodicPing() {
    if (this.pingInterval) {
      console.log('🏓 Stopping periodic ping')
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

  private findMatchedAbilities(aiMessages: AIMessage[]) {
    const messagesToCheck = [...aiMessages]
    // can we check all the messages to see if they mention any of the abilities, if they do we should return an array of abilities that are mentioned with the full ability name and description
    const abilities = this.mcpIntegration?.functions || []
    const matchedAbilities = []
    if (!abilities) return []
    for (const message of messagesToCheck) {
      for (const ability of abilities) {
        if (message.content.includes(ability.function.name)) {
          matchedAbilities.push({
            name: ability.function.name,
            description: ability.function.description,
            parameters: ability.function.parameters,
          })
        }
      }
    }
    return matchedAbilities
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
          console.log('full parsed ability call', parsed)
          abilityCalls.push({
            ability: parsed.ability,
            parameters: parsed.parameters || {},
          })
        }
      }
      catch (error) {
        console.log('⚠️ Failed to parse JSON block:', error)
      }
    }
    return abilityCalls
  }

  private async executeAbilityCalls(abilityCalls: Array<{ ability: string, parameters: Record<string, unknown> }>, currentIteration: number, originalUserMessage: AIMessage, abortSignal?: AbortSignal) {
    if (!this.mcpIntegration) {
      throw new Error('MCP integration not available')
    }

    let abilityResults = ''
    for (const abilityCall of abilityCalls) {
      const { ability: abilityName, parameters } = abilityCall
      console.log(`🔧 Executing: ${abilityName}`)

      this.onTaskProgress?.({
        step: currentIteration,
        totalSteps: this.maxAgenticIterations,
        currentAction: `Executing ${abilityName}`,
        isComplete: false,
      })

      const abilityExists = this.mcpIntegration.functions.some(f => f.function.name === abilityName)

      if (abilityExists) {
        try {
          this.updateToolExecutionState(true, abilityName)

          // Execute with context-aware processing options
          const processingOptions = {
            maxTokens: 300, // Limit result size for efficient context
            contextKeywords: this.extractKeywords(originalUserMessage.content),
            filterSensitiveData: true,
          }

          console.log('🔧 Processing options:', processingOptions)

          const processedResult = await this.mcpIntegration.executeAbilityCall(abilityName, parameters, processingOptions)

          abilityResults += `\n\n🚀 **${abilityName}** executed`
          // if (processedResult.wasFiltered) {
          //   abilityResults += ` (${processedResult.filterReason})`
          // }
          abilityResults += `\n**Result ${processedResult}`

          // Check abort signal after tool execution
          if (abortSignal?.aborted) {
            throw new Error('Request was aborted')
          }
        }
        catch (error) {
          abilityResults += `\n\n❌ **Error:** Failed to execute ${abilityName} - ${error instanceof Error ? error.message : 'Unknown error'}`
        }
        finally {
          this.updateToolExecutionState(false)
        }
      }
      else {
        // If ability not found, search for similar ones
        const searchResult = this.mcpIntegration.searchAbilities(abilityName, 3)
        if (searchResult.matches.length > 0) {
          const suggestions = searchResult.matches.map(m => m.ability.name).join(', ')
          abilityResults += `\n\n⚠️ **Error:** Ability '${abilityName}' not found. Similar abilities: ${suggestions}`
        }
        else {
          abilityResults += `\n\n⚠️ **Error:** Ability '${abilityName}' not found`
        }
      }
    }
    return abilityResults
  }

  private async executeAbilityCallsWithStreaming(
    abilityCalls: Array<{ ability: string, parameters: Record<string, unknown> }>,
    currentIteration: number,
    originalUserMessage: AIMessage,
    abortSignal?: AbortSignal,
    onUpdate?: (update: string) => void,
  ) {
    if (!this.mcpIntegration) {
      throw new Error('MCP integration not available')
    }

    let abilityResults = ''
    for (const abilityCall of abilityCalls) {
      const { ability: abilityName, parameters } = abilityCall
      console.log(`🔧 Executing: ${abilityName}`)

      const updateMessage = `- **${abilityName}**: Starting execution...`
      onUpdate?.(updateMessage)

      this.onTaskProgress?.({
        step: currentIteration,
        totalSteps: this.maxAgenticIterations,
        currentAction: `Executing ${abilityName}`,
        isComplete: false,
      })

      const abilityExists = this.mcpIntegration.functions.some(f => f.function.name === abilityName)

      if (abilityExists) {
        try {
          this.updateToolExecutionState(true, abilityName)

          const processingOptions = {
            maxTokens: 300,
            contextKeywords: this.extractKeywords(originalUserMessage.content),
            filterSensitiveData: true,
          }

          const processedResult = await this.mcpIntegration.executeAbilityCall(abilityName, parameters, processingOptions)

          const resultSummary = `✅ **${abilityName}** completed successfully`
          onUpdate?.(resultSummary)

          abilityResults += `\n\n🚀 **${abilityName}** executed`
          abilityResults += `\n**Result ${processedResult}`

          if (abortSignal?.aborted) {
            throw new Error('Request was aborted')
          }
        }
        catch (error) {
          const errorMessage = `❌ **${abilityName}** failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          onUpdate?.(errorMessage)
          abilityResults += `\n\n❌ **Error:** Failed to execute ${abilityName} - ${error instanceof Error ? error.message : 'Unknown error'}`
        }
        finally {
          this.updateToolExecutionState(false)
        }
      }
      else {
        const searchResult = this.mcpIntegration.searchAbilities(abilityName, 3)
        if (searchResult.matches.length > 0) {
          const suggestions = searchResult.matches.map(m => m.ability.name).join(', ')
          const errorMessage = `⚠️ **${abilityName}** not found. Similar: ${suggestions}`
          onUpdate?.(errorMessage)
          abilityResults += `\n\n⚠️ **Error:** Ability '${abilityName}' not found. Similar abilities: ${suggestions}`
        }
        else {
          const errorMessage = `⚠️ **${abilityName}** not found`
          onUpdate?.(errorMessage)
          abilityResults += `\n\n⚠️ **Error:** Ability '${abilityName}' not found`
        }
      }
    }
    return abilityResults
  }

  private async* streamAIResponseWithProgress(
    messages: AIMessage[],
    progressPrefix: string,
    currentAccumulated: string,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<{ text: string, isComplete: boolean }, string, unknown> {
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

      let lastLength = 0
      // Process stream and yield updates
      while (!streamComplete) {
        if (abortSignal?.aborted) {
          throw new Error('Request was aborted')
        }

        if (streamError) {
          throw streamError
        }

        // If we have new content, yield it
        if (fullResponse.length > lastLength) {
          const charCount = fullResponse.length > 100
            ? ` (${fullResponse.length} chars)`
            : ''
          const displayText = fullResponse.length > 300
            ? `${fullResponse.substring(0, 300)}...`
            : fullResponse

          const prefixWithCount = `${progressPrefix}${charCount}`
          const updatedText = `${currentAccumulated}\n\n${prefixWithCount}\n${displayText}`
          yield { text: updatedText, isComplete: false }
          lastLength = fullResponse.length
        }

        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 50))
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
      console.log(`🔄 Agentic Iteration ${currentIteration}/${this.maxAgenticIterations}`)

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

      const selectedTools = this.preContextPrompt([{ role: 'user', content: toolChoiceResponse }])

      // Stream the tool selection and planning response
      let response = ''
      for await (const update of this.streamAIResponseWithProgress(
        selectedTools,
        '🎯 **Planning tool execution...**',
        accumulatedResponse,
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

      console.log('📥 AI Response:', response)
      finalResponse = response

      const abilityCalls = this.foundAbilityCallsInResponse(response)

      // If no abilities to execute, check if task is complete
      if (abilityCalls.length === 0) {
        if (this.isTaskComplete(response)) {
          console.log('✅ Task completed - no more abilities needed')
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

      const abilityResults = await this.executeAbilityCallsWithStreaming(abilityCalls, currentIteration, originalUserMessage, abortSignal, (update) => {
        accumulatedResponse += `\n${update}`
        // Note: We can't yield from inside this callback due to generator constraints
        // Updates will be reflected in the next yield
      })

      abilitiesRan += abilityResults

      // Update accumulated response with tool results
      accumulatedResponse += `\n\n📊 **Tool Results:**\n${abilityResults.substring(0, 200)}${abilityResults.length > 200 ? '...' : ''}`
      yield {
        content: [{ type: 'text' as const, text: accumulatedResponse }],
      }

      // Add conversation history for next iteration
      conversationHistory.push({
        role: 'assistant',
        content: `${response} here is result of abilities I just ran ${JSON.stringify(abilityResults, null, 2)}`,
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
    // Stream AI analysis of the results
    //     const analysisPrompt = [...conversationHistory, {
    //       role: 'user' as const,
    //       content: `Please analyze the following execution results and provide a clear summary:

    // **Original Request:** ${originalUserMessage.content}

    // **AI Response:** ${finalResponse}

    // **Execution Results:**
    // ${abilitiesRan}

    // Provide a concise analysis covering:
    // 1. What was accomplished
    // 2. Key results or outputs
    // 3. Whether the original request was fully satisfied
    // 4. Any important findings or next steps

    // Keep it clear and actionable.`,
    //     }]

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

  private formatAbilityResultsAsJSON(abilitiesRan: string): string {
    try {
      // Parse the ability results and format as clean JSON
      const lines = abilitiesRan.split('\n').filter(line => line.trim())
      const results = []

      for (const line of lines) {
        const match = line.match(/^(\d+)\.\s*(.+):\s*(.+)$/)
        if (match) {
          const [, index, ability, result] = match
          results.push({
            step: parseInt(index),
            ability: ability.trim(),
            result: result.trim(),
            timestamp: new Date().toISOString(),
          })
        }
        else {
          // Fallback for non-standard format
          results.push({
            raw_output: line.trim(),
            timestamp: new Date().toISOString(),
          })
        }
      }

      return JSON.stringify({ execution_results: results }, null, 2)
    }
    catch {
      // Fallback to simple JSON structure
      return JSON.stringify({
        execution_results: [
          {
            raw_output: abilitiesRan,
            error: 'Failed to parse structured results',
            timestamp: new Date().toISOString(),
          },
        ],
      }, null, 2)
    }
  }

  private async getAbilityResultsAnalysis(finalResponse: string, abilitiesRan: string, originalRequest: string): Promise<string> {
    try {
      const analysisPrompt = [{
        role: 'user' as const,
        content: `Please analyze the following execution results and provide a clear summary:

**Original Request:** ${originalRequest}

**AI Response:** ${finalResponse}

**Execution Results:**
${abilitiesRan}

Provide a concise analysis covering:
1. What was accomplished
2. Key results or outputs
3. Whether the original request was fully satisfied
4. Any important findings or next steps

Keep it clear and actionable.`,
      }]

      const analysis = await window.electronAPI.sendAIMessage(
        this.currentProvider.provider,
        analysisPrompt,
        { model: this.currentProvider.model },
      )

      return analysis
    }
    catch (error) {
      console.error('Failed to get AI analysis:', error)
      return `**Summary**: ${abilitiesRan.split('\n').length} abilities were executed. See detailed results above.`
    }
  }

  async* run({ messages, abortSignal }: { messages: readonly Array<{ role: string, content: Array<{ type: string, text?: string }> }>, abortSignal?: AbortSignal }) {
    try {
      console.log('🔧 AI Chat Adapter run() called with messages:', messages.length)

      console.log('🔧 Messages:', messages)

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
          console.log('🔄 Injecting enhanced context for keyboard provider')

          // Get the user's message for context
          const lastUserMessage = aiMessages[aiMessages.length - 1]
          if (lastUserMessage?.role === 'user') {
            // Get enhanced context with planning token, user tokens, and codespace info

            const enhancedSystemPrompt = await contextService.buildEnhancedSystemPrompt(lastUserMessage.content)
            console.log('🔧 Enhanced system prompt:', enhancedSystemPrompt)

            // Check if there's already a system message
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

            console.log('✅ Enhanced context injected successfully')
          }
        }
        catch (error) {
          console.error('❌ Failed to inject enhanced context:', error)
          // Continue with original messages if context injection fails
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
      if (this.currentProvider.mcpEnabled && this.mcpIntegration?.isConnected) {
        for await (const result of this.handleWithAbilityCalling(aiMessages, abortSignal)) {
          yield result
        }
        return
      }

      console.log('🔧 About to call sendAIMessageStream with provider:', this.currentProvider.provider)
      console.log('🔧 AI Messages count:', aiMessages.length)
      console.log('🔧 AI Messages:', aiMessages)

      // Check abort signal again before streaming
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      // Set up streaming event handlers
      let accumulatedText = ''
      let streamComplete = false
      let streamError: Error | null = null

      const handleChunk = (chunk: string) => {
        console.log('🔧 Received chunk:', chunk)
        accumulatedText += chunk
      }

      const handleEnd = () => {
        console.log('🔧 Stream ended')
        streamComplete = true
      }

      const handleError = (error: string) => {
        console.log('🔧 Stream error:', error)
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

        console.log('🔧 Stream started, waiting for chunks...')

        // Process chunks as they arrive
        let lastTextLength = 0
        while (!streamComplete) {
          if (abortSignal?.aborted) {
            throw new Error('Request was aborted')
          }

          if (streamError) {
            throw streamError
          }

          // If we have new text, yield it
          if (accumulatedText.length > lastTextLength) {
            console.log('🔧 Yielding accumulated text:', accumulatedText)
            yield {
              content: [{ type: 'text' as const, text: accumulatedText }],
            }
            lastTextLength = accumulatedText.length
          }

          // Wait a bit before checking again
          await new Promise(resolve => setTimeout(resolve, 50))
        }

        // Yield final text if any
        if (accumulatedText.length > lastTextLength) {
          console.log('🔧 Yielding final text:', accumulatedText)
          yield {
            content: [{ type: 'text' as const, text: accumulatedText }],
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
    console.error('Failed to check provider availability:', error)
    return []
  }
}
