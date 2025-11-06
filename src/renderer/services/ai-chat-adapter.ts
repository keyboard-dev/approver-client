import type { ChatModelAdapter } from '@assistant-ui/react'
import { useMCPIntegration, type MCPToolFunction } from './mcp-tool-integration'
import { useState, useCallback, useRef } from 'react'

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
      mcpEnabled: mcpEnabled ?? this.currentProvider.mcpEnabled 
    }
  }

  setMCPIntegration(mcpIntegration: ReturnType<typeof useMCPIntegration> | null) {
    this.mcpIntegration = mcpIntegration
  }

  private async handleWithToolCalling(aiMessages: AIMessage[], abortSignal?: AbortSignal) {
    if (!this.mcpIntegration) {
      throw new Error('MCP integration not available')
    }

    // For now, implement a simple approach: send initial message and check if AI mentions tool usage
    // In a full implementation, this would need provider-specific function calling support
    
    // Add instruction to use tools when needed
    const enhancedMessages = [...aiMessages]
    const lastUserMessage = enhancedMessages[enhancedMessages.length - 1]
    if (lastUserMessage?.role === 'user') {
      lastUserMessage.content += '\n\n(Note: If you need to use any of the available tools to answer this question, please explicitly mention which tool you would call and with what parameters. I can execute it for you.)'
    }

    // Send enhanced message
    const response = await window.electronAPI.sendAIMessage(
      this.currentProvider.provider,
      enhancedMessages,
      { model: this.currentProvider.model },
    )

    // Check abort signal
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted')
    }

    // Simple tool detection - look for tool call patterns in response
    const toolCallMatches = response.match(/(?:call|use|execute)\s+(?:tool\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:with|using)?\s*(?:parameters?)?[:\s]*\{([^}]*)\}/gi)
    
    if (toolCallMatches && this.mcpIntegration.functions.length > 0) {
      // Try to extract and execute tool calls
      let enhancedResponse = response
      
      for (const match of toolCallMatches) {
        try {
          // Parse tool call (this is a simple implementation)
          const toolMatch = match.match(/(?:call|use|execute)\s+(?:tool\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:with|using)?\s*(?:parameters?)?[:\s]*\{([^}]*)\}/i)
          if (toolMatch) {
            const toolName = toolMatch[1]
            const paramsStr = toolMatch[2] || '{}'
            
            // Check if tool exists
            const toolExists = this.mcpIntegration.functions.some(f => f.function.name === toolName)
            if (toolExists) {
              try {
                // Parse parameters (simple JSON parsing)
                const params = JSON.parse('{' + paramsStr + '}')
                
                // Execute tool
                const toolResult = await this.mcpIntegration.executeToolCall(toolName, params)
                
                // Add tool result to response
                enhancedResponse += `\n\n**Tool Execution Result:**\n${toolResult}`
                
                // Check abort signal after tool execution
                if (abortSignal?.aborted) {
                  throw new Error('Request was aborted')
                }
              } catch (parseError) {
                enhancedResponse += `\n\n**Tool Execution Error:** Failed to parse parameters for ${toolName}`
              }
            }
          }
        } catch (error) {
          console.error('Error executing tool call:', error)
        }
      }
      
      return {
        content: [{ type: 'text' as const, text: enhancedResponse }],
      }
    }

    // No tools called, return original response
    return {
      content: [{ type: 'text' as const, text: response }],
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

      // Add MCP tools system message if enabled and available
      if (this.currentProvider.mcpEnabled && this.mcpIntegration?.isConnected) {
        const toolsSystemMessage = this.mcpIntegration.getToolsSystemMessage()
        if (toolsSystemMessage) {
          // Check if there's already a system message
          const existingSystemIndex = aiMessages.findIndex(m => m.role === 'system')
          if (existingSystemIndex >= 0) {
            // Append to existing system message
            aiMessages[existingSystemIndex].content += '\n\n' + toolsSystemMessage
          } else {
            // Add new system message at the beginning
            aiMessages.unshift({
              role: 'system',
              content: toolsSystemMessage,
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

      // Handle MCP tool calling if enabled
      if (this.currentProvider.mcpEnabled && this.mcpIntegration?.isConnected) {
        return await this.handleWithToolCalling(aiMessages, abortSignal)
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
