import { GithubService } from './Github'

interface GitHubCodespace {
  id: number
  name: string
  display_name?: string
  environment_id?: string
  owner: {
    login: string
    id: number
    avatar_url: string
  }
  billable_owner: {
    login: string
    id: number
  }
  repository: {
    id: number
    name: string
    full_name: string
    private: boolean
  }
  machine: {
    name: string
    display_name: string
    operating_system: string
    storage_in_bytes: number
    memory_in_bytes: number
    cpus: number
  }
  devcontainer_path?: string
  prebuild: boolean
  created_at: string
  updated_at: string
  last_used_at: string
  state: 'Unknown' | 'Created' | 'Queued' | 'Provisioning' | 'Available' | 'Awaiting' | 'Unavailable' | 'Deleted' | 'Moved' | 'Shutdown' | 'Archived' | 'Starting' | 'ShuttingDown' | 'Failed' | 'Exporting' | 'Rebuilding'
  url: string
  git_status: {
    ahead?: number
    behind?: number
    has_unpushed_changes?: boolean
    has_uncommitted_changes?: boolean
    ref?: string
  }
  location: string
  idle_timeout_minutes?: number
  retention_period_minutes?: number
  retention_expires_at?: string
  web_url: string
  machines_url: string
  start_url: string
  stop_url: string
  recent_folders: string[]
}

interface GitHubCodespacePort {
  port: number
  url?: string
  label?: string
  visibility: 'private' | 'org' | 'public'
}

export interface CodespaceConnectionInfo {
  codespace: GitHubCodespace
  websocketUrl?: string
  available: boolean
  error?: string
}

export class GitHubCodespacesService {
  private githubService: GithubService

  constructor(githubService: GithubService) {
    this.githubService = githubService
  }

  /**
   * List all codespaces for the authenticated user
   */
  async listCodespaces(): Promise<GitHubCodespace[]> {
    try {
      const response = await this.makeRequest<{ codespaces: GitHubCodespace[] }>('/user/codespaces')
      return response.codespaces || []
    }
    catch (error) {
      console.error('Failed to list codespaces:', error)
      return []
    }
  }

  /**
   * Get a specific codespace by name
   */
  async getCodespace(codespaceName: string): Promise<GitHubCodespace | null> {
    try {
      return await this.makeRequest<GitHubCodespace>(`/user/codespaces/${codespaceName}`)
    }
    catch (error) {
      console.error(`Failed to get codespace ${codespaceName}:`, error)
      return null
    }
  }

  /**
   * Get active (running) codespaces
   */
  async getActiveCodespaces(): Promise<GitHubCodespace[]> {
    const codespaces = await this.listCodespaces()
    return codespaces.filter(cs => cs.state === 'Available')
  }

  /**
   * Get port forwarding information for a codespace
   */
  async getCodespacePorts(codespaceName: string): Promise<GitHubCodespacePort[]> {
    try {
      const response = await this.makeRequest<{ ports: GitHubCodespacePort[] }>(`/user/codespaces/${codespaceName}/ports`)
      return response.ports || []
    }
    catch (error) {
      console.error(`Failed to get ports for codespace ${codespaceName}:`, error)
      return []
    }
  }

  /**
   * Check if a codespace has port 4002 forwarded (WebSocket server port)
   */
  async checkWebSocketPort(codespaceName: string): Promise<{ available: boolean, url?: string, fallbackUrl?: string }> {
    const ports = await this.getCodespacePorts(codespaceName)
    const port4002 = ports.find(p => p.port === 4002)

    if (port4002 && port4002.url) {
      const websocketUrl = port4002.url.replace('https://', 'wss://').replace('http://', 'ws://')
      return {
        available: true,
        url: websocketUrl,
      }
    }

    // If port is not explicitly forwarded, try to generate the URL anyway
    // This might work if the codespace has automatic port forwarding enabled
    try {
      const codespace = await this.getCodespace(codespaceName)
      if (codespace) {
        const fallbackUrl = this.generateWebSocketUrl(codespace, 4002)
        return {
          available: false, // Mark as not available since it's not explicitly forwarded
          fallbackUrl: fallbackUrl,
        }
      }
    }
    catch (error) {
      console.error(`Failed to generate fallback URL for ${codespaceName}:`, error)
    }

    return { available: false }
  }

  /**
   * Create or update port forwarding for a codespace
   */
  async createPortForwarding(codespaceName: string, port: number, visibility: 'private' | 'org' | 'public' = 'private', label?: string): Promise<GitHubCodespacePort | null> {
    try {
      return await this.makeRequest<GitHubCodespacePort>(`/user/codespaces/${codespaceName}/ports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          port,
          visibility,
          label,
        }),
      })
    }
    catch (error) {
      console.error(`Failed to create port forwarding for ${codespaceName}:${port}:`, error)
      return null
    }
  }

  /**
   * Update port forwarding visibility
   */
  async updatePortForwarding(codespaceName: string, port: number, visibility: 'private' | 'org' | 'public', label?: string): Promise<GitHubCodespacePort | null> {
    try {
      return await this.makeRequest<GitHubCodespacePort>(`/user/codespaces/${codespaceName}/ports/${port}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          visibility,
          label,
        }),
      })
    }
    catch (error) {
      console.error(`Failed to update port forwarding for ${codespaceName}:${port}:`, error)
      return null
    }
  }

  /**
   * Ensure WebSocket port is properly forwarded
   */
  async ensureWebSocketPort(codespaceName: string): Promise<{ success: boolean, url?: string, error?: string }> {
    try {
      // First check if port is already forwarded
      const portCheck = await this.checkWebSocketPort(codespaceName)
      if (portCheck.available && portCheck.url) {
        return { success: true, url: portCheck.url }
      }

      // Try to create port forwarding
      const port = await this.createPortForwarding(codespaceName, 4002, 'private', 'WebSocket Server')
      if (port && port.url) {
        const websocketUrl = port.url.replace('https://', 'wss://').replace('http://', 'ws://')
        return { success: true, url: websocketUrl }
      }

      // If creating port forwarding failed, try the fallback URL
      if (portCheck.fallbackUrl) {
        return {
          success: false,
          url: portCheck.fallbackUrl,
          error: 'Port not explicitly forwarded, using fallback URL',
        }
      }

      return { success: false, error: 'Unable to create port forwarding' }
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get WebSocket connection info for all active codespaces
   */
  async getCodespaceConnectionInfo(): Promise<CodespaceConnectionInfo[]> {
    const activeCodespaces = await this.getActiveCodespaces()
    const connectionInfo: CodespaceConnectionInfo[] = []

    for (const codespace of activeCodespaces) {
      try {
        const portInfo = await this.checkWebSocketPort(codespace.name)

        connectionInfo.push({
          codespace,
          websocketUrl: portInfo.url || portInfo.fallbackUrl,
          available: portInfo.available,
          error: portInfo.available ? undefined : 'WebSocket port 4002 not forwarded',
        })
      }
      catch (error) {
        connectionInfo.push({
          codespace,
          available: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return connectionInfo
  }

  /**
   * Find the best codespace to connect to automatically
   * Prioritizes:
   * 1. Codespaces owned by the current user
   * 2. Recently used codespaces
   * 3. Codespaces with WebSocket port available
   */
  async findBestCodespace(): Promise<CodespaceConnectionInfo | null> {
    try {
      const currentUser = await (this.githubService as any).getCurrentUser()
      if (!currentUser) {
        console.error('Cannot determine current user for codespace selection')
        return null
      }

      const allConnectionInfo = await this.getCodespaceConnectionInfo()

      if (allConnectionInfo.length === 0) {
        console.log('No active codespaces found')
        return null
      }

      // Filter to only user-owned codespaces
      const ownedCodespaces = allConnectionInfo.filter(info =>
        info.codespace.owner.login === currentUser.login,
      )

      if (ownedCodespaces.length === 0) {
        console.log('No user-owned codespaces found')
        return null
      }

      // Sort by preference:
      // 1. Available WebSocket port first
      // 2. Most recently used
      const sortedCodespaces = ownedCodespaces.sort((a, b) => {
        // First, prioritize available WebSocket connections
        if (a.available && !b.available) return -1
        if (!a.available && b.available) return 1

        // Then sort by most recently used
        const aLastUsed = new Date(a.codespace.last_used_at).getTime()
        const bLastUsed = new Date(b.codespace.last_used_at).getTime()
        return bLastUsed - aLastUsed
      })

      const bestCodespace = sortedCodespaces[0]
      console.log(`🎯 Best codespace found: ${bestCodespace.codespace.name} (${bestCodespace.available ? 'WebSocket available' : 'WebSocket needs setup'})`)

      return bestCodespace
    }
    catch (error) {
      console.error('Failed to find best codespace:', error)
      return null
    }
  }

  /**
   * Automatically discover and prepare the best codespace for connection
   * This will attempt to set up port forwarding if needed
   */
  async discoverAndPrepareCodespace(): Promise<{ codespace: CodespaceConnectionInfo, websocketUrl: string } | null> {
    try {
      const bestCodespace = await this.findBestCodespace()
      if (!bestCodespace) {
        return null
      }

      // If WebSocket is already available, use it
      if (bestCodespace.available && bestCodespace.websocketUrl) {
        return {
          codespace: bestCodespace,
          websocketUrl: bestCodespace.websocketUrl,
        }
      }

      // Try to ensure WebSocket port is set up
      console.log(`🔧 Setting up WebSocket port for codespace: ${bestCodespace.codespace.name}`)
      const portSetup = await this.ensureWebSocketPort(bestCodespace.codespace.name)

      if (portSetup.success && portSetup.url) {
        return {
          codespace: {
            ...bestCodespace,
            websocketUrl: portSetup.url,
            available: true,
          },
          websocketUrl: portSetup.url,
        }
      }

      // Fall back to generated URL if we have one
      if (portSetup.url) {
        console.log(`⚠️ Using fallback WebSocket URL for ${bestCodespace.codespace.name}`)
        return {
          codespace: {
            ...bestCodespace,
            websocketUrl: portSetup.url,
            available: false, // Mark as not fully available since it's a fallback
          },
          websocketUrl: portSetup.url,
        }
      }

      console.error(`❌ Cannot set up WebSocket for codespace: ${bestCodespace.codespace.name}`)
      return null
    }
    catch (error) {
      console.error('Failed to discover and prepare codespace:', error)
      return null
    }
  }

  /**
   * Start a codespace
   */
  async startCodespace(codespaceName: string): Promise<GitHubCodespace | null> {
    try {
      return await this.makeRequest<GitHubCodespace>(`/user/codespaces/${codespaceName}/start`, {
        method: 'POST',
      })
    }
    catch (error) {
      console.error(`Failed to start codespace ${codespaceName}:`, error)
      return null
    }
  }

  /**
   * Stop a codespace
   */
  async stopCodespace(codespaceName: string): Promise<GitHubCodespace | null> {
    try {
      return await this.makeRequest<GitHubCodespace>(`/user/codespaces/${codespaceName}/stop`, {
        method: 'POST',
      })
    }
    catch (error) {
      console.error(`Failed to stop codespace ${codespaceName}:`, error)
      return null
    }
  }

  /**
   * Test WebSocket connectivity to a codespace
   */
  async testWebSocketConnection(websocketUrl: string): Promise<{ connected: boolean, error?: string }> {
    return new Promise((resolve) => {
      try {
        const WebSocket = require('ws')
        const ws = new (WebSocket as any)(websocketUrl, {
          headers: {
            'Authorization': `Bearer ${(this.githubService as any).token}`,
            'User-Agent': 'KeyboardApproverClient/1.0',
          },
        })

        const timeout = setTimeout(() => {
          ws.close()
          resolve({ connected: false, error: 'Connection timeout' })
        }, 5000)

        ws.on('open', () => {
          clearTimeout(timeout)
          ws.close()
          resolve({ connected: true })
        })

        ws.on('error', (error: Error) => {
          clearTimeout(timeout)
          resolve({ connected: false, error: error.message })
        })
      }
      catch (error) {
        resolve({
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  }

  /**
   * Generate a codespace WebSocket URL from the web URL
   */
  generateWebSocketUrl(codespace: GitHubCodespace, port: number = 4002): string {
    // Extract the codespace domain from the web_url
    // Example: https://expert-train-abc123.github.dev -> wss://expert-train-abc123-4002.app.github.dev
    const match = codespace.web_url.match(/https:\/\/([^.]+)\.github\.dev/)
    if (match) {
      const codespaceName = match[1]
      return `wss://${codespaceName}-${port}.app.github.dev`
    }

    throw new Error(`Cannot generate WebSocket URL from codespace web_url: ${codespace.web_url}`)
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Use the existing GitHub service's makeRequest method
    return (this.githubService as any).makeRequest(endpoint, options)
  }

  /**
   * Check if the GitHub service is authenticated
   */
  isAuthenticated(): boolean {
    return this.githubService.isAuthenticated()
  }
}
