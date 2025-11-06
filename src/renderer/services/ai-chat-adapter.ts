import type { ChatModelAdapter } from '@assistant-ui/react'
import { useMCPIntegration } from './mcp-tool-integration'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatResponse {
  message: string
  success: boolean
  error?: string
}

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
  }

  private async handleAbilityDiscovery(discoveryMatches: RegExpMatchArray[], response: string) {
    console.log('🚀 Processing keyboard.dev-ability discovery requests...')

    let enhancedResponse = response

    for (let i = 0; i < discoveryMatches.length; i++) {
      const match = discoveryMatches[i]
      const abilityName = match[1] // Ability name is always capture group 1
      console.log(`🔍 Discovering keyboard.dev-ability ${i + 1}/${discoveryMatches.length}: ${abilityName}`)

      try {
        // Check if ability exists in our MCP integration
        const ability = this.mcpIntegration?.tools.find(t => t.name === abilityName)

        if (ability) {
          console.log('✅ keyboard.dev-ability found:', abilityName)

          // Format ability schema for AI
          const abilitySchema = this.formatAbilitySchema(ability)

          // Replace the discovery pattern with the ability schema
          enhancedResponse = enhancedResponse.replace(
            match[0], // Replace **{{ability-name}}**
            `\n\n🚀 **keyboard.dev-ability Discovery: ${abilityName}**\n\n${abilitySchema}\n\nYou can now call this keyboard.dev-ability using the format: \`${abilityName}({parameter: value})\` with the parameters described above.`,
          )

          console.log('✅ keyboard.dev-ability schema provided for:', abilityName)
        }
        else {
          console.warn('⚠️ keyboard.dev-ability not found:', abilityName)
          const availableAbilities = this.mcpIntegration?.tools.map(t => t.name) || []

          enhancedResponse = enhancedResponse.replace(
            match[0],
            `\n\n❌ **keyboard.dev-ability Not Found: ${abilityName}**\n\nAvailable keyboard.dev-abilities: ${availableAbilities.join(', ')}`,
          )
        }
      }
      catch (error) {
        console.error('❌ Error processing keyboard.dev-ability discovery:', error)
        enhancedResponse = enhancedResponse.replace(
          match[0],
          `\n\n❌ **keyboard.dev-ability Discovery Error:** ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }

    console.log('✅ keyboard.dev-ability discovery processing completed')
    return {
      content: [{ type: 'text' as const, text: enhancedResponse }],
    }
  }

  private formatAbilitySchema(ability: {
    name: string
    description?: string
    inputSchema?: {
      properties?: Record<string, any>
      required?: string[]
    }
  }): string {
    console.log('📋 Formatting schema for keyboard.dev-ability:', ability.name)

    let schema = `**Description:** ${ability.description || 'No description available'}\n\n`

    if (ability.inputSchema?.properties) {
      schema += '**Parameters:**\n'

      const properties = ability.inputSchema.properties
      const required = ability.inputSchema.required || []

      Object.keys(properties).forEach((key) => {
        const prop = properties[key]
        const isRequired = required.includes(key)
        const requiredLabel = isRequired ? ' (required)' : ' (optional)'

        schema += `- \`${key}\`${requiredLabel}: ${prop.description || prop.type || 'string'}\n`

        if (prop.enum) {
          schema += `  - Allowed values: ${prop.enum.join(', ')}\n`
        }
        if (prop.default !== undefined) {
          schema += `  - Default: ${prop.default}\n`
        }
      })
    }
    else {
      schema += '**Parameters:** None required\n'
    }

    return schema
  }

  private detectAbilityMentions(response: string): string[] {
    console.log('🚨 DEBUG: detectAbilityMentions called with response length:', response.length)

    if (!this.mcpIntegration?.functions) {
      console.log('🚨 DEBUG: No MCP integration or functions available')
      return []
    }

    const abilityNames = this.mcpIntegration.functions.map(f => f.function.name)
    console.log('🚨 DEBUG: Available ability names:', abilityNames)

    const mentionedAbilities = abilityNames.filter((name) => {
      const isIncluded = response.includes(name)
      console.log(`🚨 DEBUG: Checking "${name}" in response: ${isIncluded}`)
      return isIncluded
    })

    console.log('🔍 Detected ability mentions in response:', mentionedAbilities)
    return mentionedAbilities
  }

  private hasAbilityContextInMessages(abilityName: string, messages: readonly any[]): boolean {
    console.log(`🚨 DEBUG: Checking messages for existing context of: ${abilityName}`)
    console.log(`🚨 DEBUG: Messages to check: ${messages.length}`)

    // Check if any message already contains context for this ability
    const hasContext = messages.some((message, index) => {
      if (message.content) {
        // Handle both string and array content formats
        const contentStr = typeof message.content === 'string'
          ? message.content
          : Array.isArray(message.content)
            ? message.content.map(c => c.text || c.content || '').join(' ')
            : ''

        const contextPattern = `keyboard.dev-ability Context: ${abilityName}`
        const hasThisContext = contentStr.includes(contextPattern)

        if (hasThisContext) {
          console.log(`🚨 DEBUG: Found existing context in message ${index}`)
        }

        return hasThisContext
      }
      return false
    })

    console.log(`🚨 DEBUG: Has existing context for ${abilityName}: ${hasContext}`)
    return hasContext
  }

  private injectAbilityContext(response: string, abilityNames: string[], messages: readonly any[]): string {
    console.log('🚨 DEBUG: injectAbilityContext called with abilities:', abilityNames)
    console.log('🚨 DEBUG: MCP Tools available?', this.mcpIntegration?.tools?.length || 0)

    let enhancedResponse = response

    for (const abilityName of abilityNames) {
      console.log(`🚨 DEBUG: Processing ability: ${abilityName}`)

      // Check if context already exists in message history
      const hasContext = this.hasAbilityContextInMessages(abilityName, messages)
      console.log(`🚨 DEBUG: Has context in messages for ${abilityName}:`, hasContext)

      if (hasContext) {
        console.log(`⏭️ Skipping ${abilityName} - context already in message history`)
        continue
      }

      // Find the ability in MCP integration
      const ability = this.mcpIntegration?.tools.find(t => t.name === abilityName)
      console.log(`🚨 DEBUG: Found ability in MCP tools for ${abilityName}:`, !!ability)

      if (!ability) {
        console.warn(`⚠️ Ability ${abilityName} not found in MCP tools`)
        console.log('🚨 DEBUG: Available MCP tools:', this.mcpIntegration?.tools?.map(t => t.name) || [])
        continue
      }

      // Format ability context
      const abilitySchema = this.formatAbilitySchema(ability)
      console.log(`🚨 DEBUG: Generated schema for ${abilityName} (length: ${abilitySchema.length})`)

      // Inject context into response
      const contextToAdd = `\n\n🚀 **keyboard.dev-ability Context: ${abilityName}**\n\n${abilitySchema}\n\n**Usage Note:** When ready to execute, call this ability with proper parameter values in JSON format.`
      enhancedResponse += contextToAdd

      console.log(`✅ Injected context for ability: ${abilityName}`)
      console.log(`🚨 DEBUG: Context added (length: ${contextToAdd.length})`)
    }

    console.log(`🚨 DEBUG: Final enhanced response length: ${enhancedResponse.length} (original: ${response.length})`)
    return enhancedResponse
  }

  private isTemplateText(text: string): boolean {
    // Check for template/example indicators
    const templateIndicators = [
      'You can call',
      'Example',
      'Usage Note',
      '{parameter: value}',
      'parameter: value',
      '{...}',
      'with parameters described above',
    ]

    const lowerText = text.toLowerCase()
    return templateIndicators.some(indicator => lowerText.includes(indicator.toLowerCase()))
  }

  private async handleWithAbilityCalling(aiMessages: AIMessage[], abortSignal?: AbortSignal) {
    if (!this.mcpIntegration) {
      throw new Error('MCP integration not available')
    }

    console.log('🚀 keyboard.dev-ability Calling: Starting enhanced ability calling flow')
    console.log('📋 Available keyboard.dev abilities:', this.mcpIntegration.functions.length)
    console.log('🚀 Available ability names:', this.mcpIntegration.functions.map(f => f.function.name))

    // For now, implement a simple approach: send initial message and check if AI mentions ability usage
    // In a full implementation, this would need provider-specific function calling support

    // Add instruction for two-stage keyboard.dev-ability discovery
    const enhancedMessages = [...aiMessages]
    const lastUserMessage = enhancedMessages[enhancedMessages.length - 1]
    if (lastUserMessage?.role === 'user') {
      // Get list of available ability names
      const availableAbilities = this.mcpIntegration.functions.map(f => f.function.name)
      const abilitiesList = availableAbilities.map(name => `- ${name}`).join('\n')

      lastUserMessage.content += `\n\n(Note: If you need to use any keyboard.dev abilities to answer this question, first discover the ability by responding with **{{ability-name}}** (e.g., **list-all-codespaces-for-repo**). I will then provide you with the ability's description and required parameters, after which you can properly call the keyboard.dev ability.

Here are the exhaustive names of keyboard.dev abilities you can call:
${abilitiesList})`
    }

    console.log('💬 Enhanced user message:', lastUserMessage?.content.slice(-200)) // Log last 200 chars

    // Send enhanced message
    console.log('📤 Sending message to AI provider:', this.currentProvider.provider)
    console.log('📤 Enhanced messages:', JSON.stringify(enhancedMessages, null, 2))
    const response = await window.electronAPI.sendAIMessage(
      this.currentProvider.provider,
      enhancedMessages,
      { model: this.currentProvider.model },
    )

    console.log('📥 AI Response received (length:', response.length, 'chars)')
    console.log('📄 AI Response preview:', response.slice(0, 500)) // Log first 500 chars

    // Check abort signal
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted')
    }

    // Auto-inject ability context when AI mentions ability names
    console.log('🔍 Scanning response for ability mentions...')
    console.log('🚨 DEBUG: Response to scan:', response)
    console.log('🚨 DEBUG: MCP Integration available?', !!this.mcpIntegration)
    console.log('🚨 DEBUG: MCP Functions available?', this.mcpIntegration?.functions?.length || 0)

    const mentionedAbilities = this.detectAbilityMentions(response)
    console.log('🚨 DEBUG: Detected abilities:', mentionedAbilities)
    console.log('🚨 DEBUG: Should inject?', mentionedAbilities.length > 0)

    let enhancedResponse = response
    if (mentionedAbilities.length > 0) {
      console.log('✅ Auto-injecting context for mentioned abilities:', mentionedAbilities)
      console.log('🚨 DEBUG: AI Messages length:', aiMessages.length)
      enhancedResponse = this.injectAbilityContext(response, mentionedAbilities, aiMessages)
      console.log('📄 Enhanced response length after context injection:', enhancedResponse.length)
      console.log('📄 Context injection preview:', enhancedResponse.slice(response.length, response.length + 200))
    }
    else {
      console.log('ℹ️ No ability mentions detected in response')
    }

    // Two-stage keyboard.dev-ability discovery approach
    console.log('🔍 Searching for ability discovery and execution patterns...')

    // Stage 1: Ability Discovery Pattern - **{{ability-name}}** or {{ability-name}}
    const discoveryPattern = /(?:\*\*)?\{\{([a-zA-Z_][a-zA-Z0-9_-]*)\}\}(?:\*\*)?/gi
    const discoveryMatches = Array.from(enhancedResponse.matchAll(discoveryPattern))

    console.log('🚀 keyboard.dev-ability discovery matches:', discoveryMatches.length)
    console.log('📋 Discovery patterns found:', discoveryMatches.map(m => m[0]))

    if (discoveryMatches.length > 0) {
      console.log('✅ keyboard.dev-ability discovery detected! Processing ability schema requests...')
      return await this.handleAbilityDiscovery(discoveryMatches, enhancedResponse)
    }

    // Stage 2: Ability Execution Patterns (more specific to avoid template matching)
    const executionPattern1 = /(?:call|use|execute)\s+(?:ability\s+)?([a-zA-Z_][a-zA-Z0-9_-]*)\s*(?:with|using)\s*(?:parameters?)?[:\s]*\{([^}]+)\}/gi
    const executionPattern2 = /^(?!.*(?:You can call|Example|Usage Note)).*([a-zA-Z_][a-zA-Z0-9_-]*)\s*\(\s*\{([^}]+)\}\s*\)/gim
    const executionPattern3 = /([a-zA-Z_][a-zA-Z0-9_-]*)\s*\(\s*([^)]*?='[^']*'[^)]*)\)/gi

    let abilityCallMatches: RegExpMatchArray[] = []

    // Filter out template/example matches
    const allMatches1 = Array.from(enhancedResponse.matchAll(executionPattern1))
    const allMatches2 = Array.from(enhancedResponse.matchAll(executionPattern2))
    const allMatches3 = Array.from(enhancedResponse.matchAll(executionPattern3))

    const execMatches1 = allMatches1.filter(match => !this.isTemplateText(match[0]))
    const execMatches2 = allMatches2.filter(match => !this.isTemplateText(match[0]))
    const execMatches3 = allMatches3.filter(match => !this.isTemplateText(match[0]))

    abilityCallMatches = [...execMatches1, ...execMatches2, ...execMatches3]

    // Pattern 4: Simple bare tool name detection using string includes
    if (abilityCallMatches.length === 0 && this.mcpIntegration?.functions?.length) {
      console.log('🔍 No regex matches found, checking for bare tool names...')
      const availableTools = this.mcpIntegration.functions.map(f => f.function.name)

      for (const toolName of availableTools) {
        if (enhancedResponse.includes(toolName)) {
          console.log(`✅ Found bare tool name: ${toolName}`)
          // Add as a match with empty parameters (toolName, toolName, '')
          abilityCallMatches.push([toolName, toolName, ''])
          break // Only match first tool found to avoid duplicates
        }
      }
    }

    console.log('🎯 keyboard.dev-ability execution matches found:')
    console.log('  - Execution pattern 1:', execMatches1.length)
    console.log('  - Execution pattern 2:', execMatches2.length)
    console.log('  - Execution pattern 3 (Gemini format):', execMatches3.length)
    console.log('  - Bare tool name detection:', abilityCallMatches.length - execMatches1.length - execMatches2.length - execMatches3.length)
    console.log('  - Total execution matches:', abilityCallMatches.length)
    console.log('📋 Execution matches:', abilityCallMatches.map(m => m[0]))

    if (abilityCallMatches && this.mcpIntegration.functions.length > 0) {
      console.log('✅ keyboard.dev-ability calls detected! Processing', abilityCallMatches.length, 'potential ability calls...')

      // Try to extract and execute keyboard.dev-ability calls
      let enhancedResponse = response

      for (let i = 0; i < abilityCallMatches.length; i++) {
        const match = abilityCallMatches[i]
        console.log(`🚀 Processing keyboard.dev-ability call ${i + 1}/${abilityCallMatches.length}:`, match[0])

        try {
          // Extract ability name and parameters from the match
          const abilityName = match[1] // Ability name is always capture group 1
          const paramsStr = match[2] || '' // Parameters are capture group 2
          console.log('🚀 Extracted keyboard.dev-ability name:', abilityName)
          console.log('📋 Extracted parameters string:', paramsStr)

          // Check if ability exists
          const abilityExists = this.mcpIntegration.functions.some(f => f.function.name === abilityName)
          console.log('🔍 keyboard.dev-ability exists check:', abilityExists)
          console.log('📚 Available abilities for reference:', this.mcpIntegration.functions.map(f => f.function.name))

          if (abilityExists) {
            try {
              // Validate parameters are not template placeholders
              if (this.isTemplateText(paramsStr)) {
                console.log('⏭️ Skipping template parameter text:', paramsStr)
                continue
              }

              // Parse parameters with better error handling
              let params: Record<string, unknown> = {}

              if (paramsStr.trim()) {
                console.log('🔄 Parsing parameters string:', paramsStr)

                // Check if it's Gemini's key='value' format
                if (paramsStr.includes('=') && !paramsStr.includes(':')) {
                  console.log('🎯 Detected Gemini-style parameters (key=\'value\')')
                  try {
                    // Parse key='value', key2='value2' format
                    const matches = paramsStr.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*'([^']*)'/g)
                    if (matches) {
                      matches.forEach((match) => {
                        const [, key, value] = match.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*'([^']*)'/) || []
                        if (key && value !== undefined) {
                          params[key] = value
                        }
                      })
                      console.log('✅ Successfully parsed Gemini parameters:', params)
                    }
                  }
                  catch (geminiError) {
                    console.warn('⚠️ Failed to parse Gemini-style parameters:', geminiError)
                    // Fall back to JSON parsing
                    const jsonStr = paramsStr.startsWith('{') ? paramsStr : '{' + paramsStr + '}'
                    params = JSON.parse(jsonStr)
                  }
                }
                else {
                  // Try to parse as JSON, with various fallback strategies
                  const jsonStr = paramsStr.startsWith('{') ? paramsStr : '{' + paramsStr + '}'
                  console.log('🔄 Parsing parameters as JSON:', jsonStr)

                  try {
                    params = JSON.parse(jsonStr)
                  }
                  catch {
                    // Try with quotes around unquoted keys
                    const quotedStr = jsonStr.replace(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '"$1":')
                    console.log('🔄 Retry parsing with quoted keys:', quotedStr)
                    params = JSON.parse(quotedStr)
                  }
                }
              }
              else {
                console.log('🔄 No parameters provided, using empty object for bare tool name')
              }

              console.log('✅ Successfully parsed parameters:', params)

              // Add UI feedback for ability execution
              enhancedResponse += `\n\n🚀 **Executing keyboard.dev-ability: ${abilityName}**\n📋 Parameters: ${JSON.stringify(params, null, 2)}\n`

              // Execute ability
              console.log('🚀 Executing keyboard.dev-ability:', abilityName, 'with parameters:', params)
              const startTime = performance.now()
              const abilityResult = await this.mcpIntegration.executeToolCall(abilityName, params)
              const executionTime = Math.round(performance.now() - startTime)

              console.log('✅ keyboard.dev-ability execution completed in', executionTime, 'ms')
              console.log('📊 Ability result (first 500 chars):', String(abilityResult).slice(0, 500))

              // Add ability result to response with execution feedback
              enhancedResponse += `✅ **Execution completed** (${executionTime}ms)\n\n**Result:**\n${abilityResult}`

              // Check abort signal after tool execution
              if (abortSignal?.aborted) {
                throw new Error('Request was aborted')
              }
            }
            catch (parseError) {
              console.error('❌ Parameter parsing failed:', parseError)
              enhancedResponse += `\n\n❌ **keyboard.dev-ability Execution Error:** Failed to parse parameters for ${abilityName}\nError: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
            }
          }
          else {
            console.warn('⚠️ keyboard.dev-ability not found:', abilityName)
            enhancedResponse += `\n\n⚠️ **keyboard.dev-ability Error:** Ability '${abilityName}' not found. Available abilities: ${this.mcpIntegration.functions.map(f => f.function.name).join(', ')}`
          }
        }
        catch (error) {
          console.error('❌ Error processing keyboard.dev-ability call:', error)
          enhancedResponse += `\n\n❌ **keyboard.dev-ability Processing Error:** ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        }
      }

      console.log('🎉 keyboard.dev-ability calling flow completed. Enhanced response length:', enhancedResponse.length)
      return {
        content: [{ type: 'text' as const, text: enhancedResponse }],
      }
    }
    else {
      console.log('ℹ️ No keyboard.dev-ability calls detected in AI response')
    }

    // No abilities called, return enhanced response (may include auto-injected context)
    return {
      content: [{ type: 'text' as const, text: enhancedResponse }],
    }
  }

  async run({ messages, abortSignal }: { messages: readonly any[], abortSignal?: AbortSignal }) {
    try {
      // Convert assistant-ui messages to our AI provider format
      const aiMessages: AIMessage[] = messages.map((message: any) => {
        // Get the text content from message
        const textContent = message.content
          ?.find((c: any) => c.type === 'text')?.text || ''

        return {
          role: message.role as 'user' | 'assistant' | 'system',
          content: textContent,
        }
      })

      // Special handling for MCP provider (legacy)
      if (this.currentProvider.provider === 'mcp') {
        return {
          content: [{
            type: 'text' as const,
            text: `🔌 MCP Provider: This provider uses the Model Context Protocol. Please use the MCP chat component for full functionality.`,
          }],
        }
      }

      // Add keyboard.dev abilities system message if enabled and available
      if (this.currentProvider.mcpEnabled && this.mcpIntegration?.isConnected) {
        const abilitiesSystemMessage = this.mcpIntegration.getToolsSystemMessage()
        if (abilitiesSystemMessage) {
          // Check if there's already a system message
          const existingSystemIndex = aiMessages.findIndex(m => m.role === 'system')
          if (existingSystemIndex >= 0) {
            // Append to existing system message
            aiMessages[existingSystemIndex].content += '\n\n' + abilitiesSystemMessage
          }
          else {
            // Add new system message at the beginning
            aiMessages.unshift({
              role: 'system',
              content: abilitiesSystemMessage,
            })
          }
        }
      }

      // Check if provider is configured
      const providerStatus = await window.electronAPI.getAIProviderKeys()
      const currentProviderStatus = providerStatus.find(p => p.provider === this.currentProvider.provider)

      if (!currentProviderStatus?.configured) {
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
        return await this.handleWithAbilityCalling(aiMessages, abortSignal)
      }

      // Send message to AI provider (without tools)
      const response = await window.electronAPI.sendAIMessage(
        this.currentProvider.provider,
        aiMessages,
        { model: this.currentProvider.model },
      )

      // Check abort signal again after async operation
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      // Return the response in the correct format
      return {
        content: [{ type: 'text' as const, text: response }],
      }
    }
    catch (error) {
      // Handle abort errors gracefully
      if (error instanceof Error && error.name === 'AbortError') {
        throw error // Re-throw abort errors
      }

      // Handle other errors gracefully
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

      return {
        content: [{
          type: 'text' as const,
          text: `❌ Error: ${errorMessage}`,
        }],
      }
    }
  }
}

// Helper to create adapters for different providers
export const createOpenAIAdapter = (model: string = 'gpt-3.5-turbo', mcpEnabled: boolean = false) =>
  new AIChatAdapter('openai', model, mcpEnabled)

export const createAnthropicAdapter = (model: string = 'claude-3-sonnet-20240229', mcpEnabled: boolean = false) =>
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
