import { CodespaceInfo, Script } from '../../types'
import { generatePlanningToken } from './ability-tools'
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
  private selectedScripts: Script[] = []

  /**
   * Set selected scripts for the context service
   */
  setSelectedScripts(scripts: Script[]): void {
    this.selectedScripts = scripts
  }

  /**
   * Get comprehensive context for AI system prompt
   * Always fetches fresh data to ensure up-to-date connected accounts
   */
  async getEnhancedContext(): Promise<EnhancedContext> {
    // Generate new planning token
    const planningToken = generatePlanningToken()

    // Fetch user tokens, codespace info, executor connection, pipedream accounts, composio accounts, and connector notes in parallel
    const [userTokens, codespaceInfo, executorConnection, pipedreamAccounts, composioAccounts] = await Promise.allSettled([
      this.fetchUserTokens(),
      this.fetchCodespaceInfo(),
      this.fetchExecutorConnection(),
      this.fetchPipedreamAccounts(),
      this.fetchComposioAccounts(),
    ])
    // Also refresh connector notes cache (fire and forget, non-critical)
    await fetchConnectorNotes().catch(() => {})

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

    // Build Pipedream connected accounts section
    const pipedreamAccountsList = context.pipedreamAccounts.length > 0
      ? context.pipedreamAccounts.map((account) => {
          const note = getConnectorNote('pipedream', account.app.nameSlug)
          return {
            accountId: account.id,
            accountName: account.name,
            appName: account.app.name,
            appSlug: account.app.nameSlug,
            healthy: account.healthy,
            ...(note ? { userNotes: note } : {}),
          }
        })
      : []

    const pipedreamAccountsSection = pipedreamAccountsList.length > 0
      ? `

PIPEDREAM CONNECTED ACCOUNTS:
${JSON.stringify(pipedreamAccountsList, null, 2)}

Note: Use the accountId when making API calls that require a connected account reference (e.g., for Pipedream triggers or actions that need account authentication). If an account has "userNotes", follow those instructions carefully when using that service.`
      : ''

    // Build Composio connected accounts section
    const composioAccountsList = context.composioAccounts.length > 0
      ? context.composioAccounts
          .filter(account => account.status === 'ACTIVE' && !account.isDisabled)
          .map((account) => {
            const note = getConnectorNote('composio', account.toolkit.slug)
            return {
              accountId: account.id,
              appName: account.toolkit.slug,
              status: account.status,
              ...(note ? { userNotes: note } : {}),
            }
          })
      : []

    const composioAccountsSection = composioAccountsList.length > 0
      ? `

COMPOSIO CONNECTED ACCOUNTS:
${JSON.stringify(composioAccountsList, null, 2)}

Note: These are Composio-managed OAuth connections. Use the accountId with the Composio proxy "endpoint" field. If an account has "userNotes", follow those instructions carefully when using that service.

MICROSOFT ACCOUNTS (share_point, excel, onedrive, outlook, teams): Do NOT use the Microsoft Graph API (graph.microsoft.com). Use the SharePoint REST API instead — e.g., endpoint: "https://{tenant}.sharepoint.com/_api/web/lists" or "https://{tenant}.sharepoint.com/_api/web/GetFolderByServerRelativeUrl('/path')/Files/add(url='file.xlsx',overwrite=true)".`
      : ''

    // Build Local provider connected accounts section
    const localProviderStatus = await window.electronAPI?.getProviderAuthStatus?.().catch(() => ({})) as Record<string, { authenticated?: boolean }> || {}
    const localAccountsList = Object.entries(localProviderStatus)
      .filter(([, status]) => status?.authenticated)
      .map(([provider]) => {
        const note = getConnectorNote('local', provider)
        return {
          provider,
          source: 'local',
          ...(note ? { userNotes: note } : {}),
        }
      })

    const localAccountsSection = localAccountsList.length > 0
      ? `

LOCAL CONNECTED ACCOUNTS (OAuth provider tokens managed by Keyboard):
${JSON.stringify(localAccountsList, null, 2)}

Note: These are locally authenticated OAuth providers. The user has granted access through Keyboard's OAuth flow. Use the corresponding KEYBOARD_PROVIDER_USER_TOKEN_FOR_<PROVIDER> environment variable when making API calls. If an account has "userNotes", follow those instructions carefully when using that service.`
      : ''

    // Get previous run-code execution results for context
    const previousResultsContext = runCodeResultContext.getExtractedDataSummary()
    const previousResultsSection = previousResultsContext
      ? `

PREVIOUS EXECUTION CONTEXT:
${previousResultsContext}

Note: These IDs, URLs, and data values are from previous tool executions in this session. Use them when making follow-up API calls or referencing created resources.`
      : ''

    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    return `You are a helpful AI assistant with access to a secure code execution environment.  Any code you will try to execute will also be reviewed by a human before execution so you can execute and write code with confidence.

TODAY'S DATE: ${currentDate}
When using web-search, always include the current year or date in your query when searching for recent or latest information (e.g. "latest AI news ${new Date().getFullYear()}" not just "latest AI news").

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

${pipedreamAccountsSection}${composioAccountsSection}${localAccountsSection}${previousResultsSection}

INSTRUCTIONS:
- IMPORTANT: All context (connected accounts, tokens, codespace info) is already provided above. Do NOT call tools like required-starting-context-information, list-connected-accounts, connect-websocket, or fetch-accounts-data — that data is already here. Jump directly to the action tool (e.g., run-code) to accomplish the user's task.
- Planning token is automatically provided above - use it when calling run-code
- Break down complex tasks into multiple run-code calls when appropriate
- If no tools are needed, respond conversationally
- When fetching data and unsure about response structure, return the whole response (excluding sensitive headers, JWTs, or API keys)
- BE ACTION-ORIENTED: When you have enough context to complete a task, execute it immediately by calling the appropriate tool in your FIRST response. Do NOT just describe what you plan to do — actually do it. For example, if asked to "create a Notion page", call run-code right away instead of saying "Let me create that for you" without a tool call. Only ask clarifying questions if truly necessary information is missing. Bias toward action over narration.

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
    catch {
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
    catch {
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

// =============================================================================
// Connector Notes - API-backed per-account notes for AI context
// =============================================================================

export interface ConnectorNote {
  id: string
  source: string
  appSlug: string
  note: string
  createdAt: string
  updatedAt: string
}

// In-memory cache of notes, refreshed on each fetch
let cachedNotes: ConnectorNote[] = []

export async function fetchConnectorNotes(): Promise<ConnectorNote[]> {
  try {
    const result = await window.electronAPI.getConnectorNotes()
    if (result.success && result.notes) {
      cachedNotes = result.notes
      return cachedNotes
    }
    return cachedNotes
  }
  catch {
    return cachedNotes
  }
}

export function getConnectorNote(source: string, appSlug: string): string {
  const match = cachedNotes.find(
    n => n.source === source && n.appSlug === appSlug.toLowerCase(),
  )
  return match?.note || ''
}

export async function setConnectorNote(source: string, appSlug: string, note: string): Promise<void> {
  if (note.trim()) {
    await window.electronAPI.upsertConnectorNote(source, appSlug.toLowerCase(), note.trim())
  }
  else {
    await window.electronAPI.deleteConnectorNote(source, appSlug.toLowerCase())
  }
  // Refresh cache
  await fetchConnectorNotes()
}

// Export singleton instance
export const contextService = new ContextService()
