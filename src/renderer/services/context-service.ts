import { CodespaceInfo, Script } from '../../types'
import { generatePlanningToken, toolsToAbilities } from './ability-tools'
import type { MCPAbilityFunction } from './mcp-tool-integration'
import type { PipedreamAccount } from './pipedream-service'
import { runCodeResultContext } from './run-code-result-context'

export interface UserTokensResponse {
  tokensAvailable?: string[]
  error?: string
}

// Composio connected account from /api/composio/accounts
export interface ComposioAccountContext {
  id: string
  status: string
  toolkit: {
    slug: string
  }
  isDisabled: boolean
  createdAt: string
  updatedAt: string
}

export interface ExecutorConnectionInfo {
  connected: boolean
  target?: {
    type: 'localhost' | 'codespace'
    url: string
    name?: string
    codespaceName?: string
  }
}

export interface EnhancedContext {
  planningToken: string
  userTokens: string[]
  codespaceInfo: CodespaceInfo | null
  executorConnection: ExecutorConnectionInfo | null
  selectedScripts: Script[]
  pipedreamAccounts: PipedreamAccount[]
  composioAccounts: ComposioAccountContext[]
}

export class ContextService {
  private mcpFunctions: MCPAbilityFunction[] = []
  private selectedScripts: Script[] = []

  /**
   * Set MCP functions for the context service
   */
  setMCPFunctions(functions: MCPAbilityFunction[]): void {
    this.mcpFunctions = functions
  }

  /**
   * Set selected scripts for the context service
   */
  setSelectedScripts(scripts: Script[]): void {
    this.selectedScripts = scripts
  }

  /**
   * Get MCP tools filtered out from toolsToAbilities
   */
  private getFilteredMCPTools(): MCPAbilityFunction[] {
    const keyboardAbilityNames = new Set<string>()

    // Extract all ability names from toolsToAbilities
    Object.values(toolsToAbilities.categories).forEach((abilities) => {
      abilities.forEach((ability) => {
        keyboardAbilityNames.add(ability.command)
      })
    })

    // Filter out tools that are in toolsToAbilities
    return this.mcpFunctions.filter(func =>
      keyboardAbilityNames.has(func.function.name),
    )
  }

  /**
   * Get comprehensive context for AI system prompt
   * Always fetches fresh data to ensure up-to-date connected accounts
   */
  async getEnhancedContext(): Promise<EnhancedContext> {
    // Generate new planning token
    const planningToken = generatePlanningToken()

    // Fetch user tokens, codespace info, executor connection, pipedream accounts, and composio accounts in parallel
    const [userTokens, codespaceInfo, executorConnection, pipedreamAccounts, composioAccounts] = await Promise.allSettled([
      this.fetchUserTokens(),
      this.fetchCodespaceInfo(),
      this.fetchExecutorConnection(),
      this.fetchPipedreamAccounts(),
      this.fetchComposioAccounts(),
    ])

    return {
      planningToken,
      userTokens: userTokens.status === 'fulfilled' ? userTokens.value : [],
      codespaceInfo: codespaceInfo.status === 'fulfilled' ? codespaceInfo.value : null,
      executorConnection: executorConnection.status === 'fulfilled' ? executorConnection.value : null,
      selectedScripts: this.selectedScripts,
      pipedreamAccounts: pipedreamAccounts.status === 'fulfilled' ? pipedreamAccounts.value : [],
      composioAccounts: composioAccounts.status === 'fulfilled' ? composioAccounts.value : [],
    }
  }

  /**
   * Get connected accounts for connection requirement checks
   * Lightweight method that uses cached context without building full system prompt
   */
  async getConnectedAccounts(): Promise<{
    pipedream: PipedreamAccount[]
    composio: ComposioAccountContext[]
  }> {
    const context = await this.getEnhancedContext()
    return {
      pipedream: context.pipedreamAccounts,
      composio: context.composioAccounts,
    }
  }

  /**
   * Build enhanced system prompt with all context
   */
  async buildEnhancedSystemPrompt(userMessage: string): Promise<string> {
    const context = await this.getEnhancedContext()
    const userTokensList = context.userTokens.length > 0
      ? context.userTokens.map(token => `- ${token}`).join('\n')
      : '- No user tokens currently available'

    const codespaceDetails = context.codespaceInfo
      ? JSON.stringify({
          packageJson: context.codespaceInfo.packageJson,
          environmentVariableKeys: context.codespaceInfo.environmentVariableKeys, // not actual environment variables, but the key namesthat are available in the codespace
          docResources: context.codespaceInfo.docResources,
        }, null, 2)
      : 'No codespace information available'

    // Build service URL section
    const serviceUrlSection = context.executorConnection?.target?.url
      ? `
SERVICE EXECUTION URL:
${context.executorConnection.target.url}

Note: This is the actual URL of the code execution service. The service type is "${context.executorConnection.target.type}"${context.executorConnection.target.codespaceName ? ` (codespace: ${context.executorConnection.target.codespaceName})` : ''}.`
      : ''

    const abilitiesList = JSON.stringify(toolsToAbilities, null, 2)

    // Get selected scripts list
    const selectedScriptsList = context.selectedScripts.length > 0
      ? context.selectedScripts.map(script => ({
          id: script.id,
          name: script.name,
          description: script.description,
          tags: script.tags,
          services: script.services,
          schema: script.schema,
          availableVariables: script.schema ? Object.keys(script.schema) : [],
        }))
      : []

    const selectedScriptsSection = selectedScriptsList.length > 0
      ? `

SELECTED SCRIPTS CONTEXT:
${JSON.stringify(selectedScriptsList, null, 2)}

Note: These scripts are available for reference during run-code execution. You can use their IDs, names, descriptions, metadata, and variable schemas when planning and executing code. The 'schema' field defines the input variables each script expects, and 'availableVariables' lists the variable names that can be used with run-code execution.`
      : ''

    // Get filtered MCP tools (excluding keyboard abilities)
    const filteredMCPTools = this.getFilteredMCPTools()
    const additionalToolsList = filteredMCPTools.length > 0
      ? filteredMCPTools.map(func => ({
          name: func.function.name,
          description: func.function.description,
          parameters: func.function.parameters,
        }))
      : []

    const additionalToolsSection = additionalToolsList.length > 0
      ? `

ADDITIONAL MCP TOOLS AVAILABLE:
${JSON.stringify(additionalToolsList, null, 2)}

Note: These are additional MCP tools beyond the core keyboard abilities. You can call these using the same JSON format.`
      : ''

    // Build Pipedream connected accounts section
    const pipedreamAccountsList = context.pipedreamAccounts.length > 0
      ? context.pipedreamAccounts.map(account => ({
          accountId: account.id,
          accountName: account.name,
          appName: account.app.name,
          appSlug: account.app.nameSlug,
          healthy: account.healthy,
        }))
      : []

    const pipedreamAccountsSection = pipedreamAccountsList.length > 0
      ? `

PIPEDREAM CONNECTED ACCOUNTS:
${JSON.stringify(pipedreamAccountsList, null, 2)}

Note: Use the accountId when making API calls that require a connected account reference (e.g., for Pipedream triggers or actions that need account authentication).`
      : ''

    // Build Composio connected accounts section
    const composioAccountsList = context.composioAccounts.length > 0
      ? context.composioAccounts
          .filter(account => account.status === 'ACTIVE' && !account.isDisabled)
          .map(account => ({
            accountId: account.id,
            appName: account.toolkit.slug,
            status: account.status,
          }))
      : []

    const composioAccountsSection = composioAccountsList.length > 0
      ? `

COMPOSIO CONNECTED ACCOUNTS:
${JSON.stringify(composioAccountsList, null, 2)}

Note: These are Composio-managed OAuth connections. The appName (toolkit slug) identifies the service (e.g., "slack", "github", "googlecalendar"). Use the accountId when deploying Composio triggers or making authenticated API calls through Composio.`
      : ''

    // Get previous run-code execution results for context
    const previousResultsContext = runCodeResultContext.getExtractedDataSummary()
    const previousResultsSection = previousResultsContext
      ? `

PREVIOUS EXECUTION CONTEXT:
${previousResultsContext}

Note: These IDs, URLs, and data values are from previous tool executions in this session. Use them when making follow-up API calls or referencing created resources.`
      : ''

    return `You are a helpful AI assistant with access to a secure code execution environment.  Any code you will try to execute will also be reviewed by a human before execution so you can execute and write code with confidence.

This is a real planning token to pass the run-code ability.  Make sure to use it when calling the run-code ability.
PLANNING TOKEN: ${context.planningToken}, you can actually don't need it anymore but it's here for reference.

We call this information the required_starting_context_information, and would be equivalent to the data you would use for required-starting-context-information tool.

<required_starting_context_information>
Here are actual user token environment variables that you can leverage in your code.  Just avoid console.loging their full values.  



AVAILABLE USER TOKENS:
${userTokensList}

Here is information about the actual code execution environment.  This is where you will execute your code.  Additionally there will be a list of other environment variables that you can leverage in your code.

CODESPACE INFORMATION:
${codespaceDetails}${serviceUrlSection}${selectedScriptsSection}

API RESEARCH GUIDANCE:
- Use the web-search ability to find official documentation and examples
- Always research API documentation when working with external services
- Use web-search ability to find official documentation and examples
- Look for code examples, best practices, and common patterns
- Check for rate limits, authentication requirements, and error handling
- Only after you tried to use the web-search ability, and it didn't work, then you can use the run-code ability to execute code but the idea is to use the web-search ability first.

Full abilities description and schema:
${abilitiesList}${additionalToolsSection}${pipedreamAccountsSection}${composioAccountsSection}${previousResultsSection}

INSTRUCTIONS:
- You can execute abilities directly using JSON format: {"ability": "ability-name", "parameters": {...}}
- Planning token is automatically provided above - DO NOT use the 'plan' ability, go directly to 'run-code'
- Use the planning token provided above when calling run-code abilities
- Research APIs and documentation before implementing solutions
- Be proactive in suggesting relevant abilities for the user's task
- Always provide clear explanations of what you're doing and why
- Try to break down tasks into different instances of the run-code abilities to make it easier to understand and execute for example
if you need fetch data from one service and then call another service, you can break it down into two run-code abilities.
- If no abilities are required and it is more conversational feel free to respond conversationally without ability use

</required_starting_context_information>

USER REQUEST: ${userMessage}`
  }

  /**
   * Fetch available user tokens from current session
   */
  private async fetchUserTokens(): Promise<string[]> {
    try {
      // Try to get tokens from the current WebSocket session via electron API
      const tokensResponse = await window.electronAPI?.getUserTokens?.() as UserTokensResponse | undefined

      if (tokensResponse?.tokensAvailable) {
        return tokensResponse.tokensAvailable
      }

      return []
    }
    catch (error) {
      return []
    }
  }

  /**
   * Fetch codespace information using GitHub PAT token
   */
  private async fetchCodespaceInfo(): Promise<CodespaceInfo | null> {
    try {
      // Get codespace info via electron API
      const codespaceInfo = await window.electronAPI?.getCodespaceInfo?.()

      if (codespaceInfo?.packageJson) {
        return codespaceInfo
      }

      return null
    }
    catch (error) {
      return null
    }
  }

  /**
   * Fetch executor connection status (includes service URL)
   */
  private async fetchExecutorConnection(): Promise<ExecutorConnectionInfo | null> {
    try {
      const status = await window.electronAPI?.getExecutorConnectionStatus?.()
      if (status) {
        return status
      }
      return null
    }
    catch {
      return null
    }
  }

  /**
   * Fetch Pipedream connected accounts
   */
  private async fetchPipedreamAccounts(): Promise<PipedreamAccount[]> {
    try {
      const response = await window.electronAPI?.fetchPipedreamAccountsDetailed?.()
      if (response?.success && response?.data) {
        const data = response.data as { accounts?: PipedreamAccount[] }
        if (data.accounts) {
          return data.accounts
        }
      }
      return []
    }
    catch {
      return []
    }
  }

  /**
   * Fetch Composio connected accounts
   */
  private async fetchComposioAccounts(): Promise<ComposioAccountContext[]> {
    try {
      const response = await window.electronAPI?.listComposioConnectedAccounts?.()
      if (response?.success && response?.data) {
        const data = response.data as { items?: ComposioAccountContext[] }
        if (data.items) {
          return data.items
        }
      }
      return []
    }
    catch {
      return []
    }
  }
}

// Export singleton instance
export const contextService = new ContextService()
