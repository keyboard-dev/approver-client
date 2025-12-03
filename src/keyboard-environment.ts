import { ConnectionTarget } from './websocket-client-to-executor'

export interface SandboxConfig {
  image?: string
  cpuLimit?: string
  memoryLimit?: string
  timeoutMinutes?: number
}

export interface SandboxInfo {
  sessionId: string
  userId: string
  orgId: string
  status: 'pending' | 'running' | 'failed' | 'terminated'
  podName: string
  namespace: string
  createdAt: string
  expiresAt: string
  url: string
}

export interface SandboxCreateResponse {
  sessionId: string
  status: string
  url: string
  message: string
}

export interface SandboxListResponse {
  sandboxes: SandboxInfo[]
}

export interface KeyboardEnvironmentConfig {
  baseUrl?: string
  jwtToken: string
  defaultTimeout?: number
  maxRetries?: number
  retryDelay?: number
}

export class KeyboardEnvironmentManager {
  private readonly baseUrl: string
  private jwtToken: string
  private readonly defaultTimeout: number
  private readonly maxRetries: number
  private readonly retryDelay: number

  constructor(config: KeyboardEnvironmentConfig) {
    this.baseUrl = config.baseUrl || 'https://platform.keyboard.dev'
    this.jwtToken = config.jwtToken
    this.defaultTimeout = config.defaultTimeout || 60
    this.maxRetries = config.maxRetries || 3
    this.retryDelay = config.retryDelay || 2000
  }

  setJwtToken(token: string): void {
    this.jwtToken = token
  }

  private async request(method: string, path: string, body?: unknown): Promise<any> {
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.jwtToken}`,
        'Content-Type': 'application/json',
      },
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(`${this.baseUrl}${path}`, options)

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`
      try {
        const error = await response.json() as { error?: string; message?: string }
        errorMessage = error.error || error.message || errorMessage
      } catch (e) {
        // Ignore JSON parse errors, use default message
      }
      throw new Error(errorMessage)
    }

    return response.json()
  }

  async createSandbox(config: SandboxConfig = {}): Promise<SandboxCreateResponse> {
    const sandboxConfig = {
      timeoutMinutes: this.defaultTimeout,
      ...config,
    }

    return this.request('POST', '/api/sandbox/create', sandboxConfig)
  }

  async getSandboxStatus(sessionId: string): Promise<SandboxInfo> {
    return this.request('GET', `/api/sandbox/${sessionId}`)
  }

  async listUserSandboxes(): Promise<SandboxListResponse> {
    return this.request('GET', '/api/sandbox')
  }

  async deleteSandbox(sessionId: string): Promise<{ message: string }> {
    return this.request('DELETE', `/api/sandbox/${sessionId}`)
  }

  async restartSandbox(sessionId: string): Promise<{ message: string; sessionId: string; status: string }> {
    return this.request('POST', `/api/sandbox/${sessionId}/restart`)
  }

  async waitForRunning(sessionId: string, maxAttempts: number = 30): Promise<SandboxInfo> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const status = await this.getSandboxStatus(sessionId)
        
        if (status.status === 'running') {
          return status
        }
        
        if (status.status === 'failed') {
          throw new Error('Sandbox failed to start')
        }
        
        if (status.status === 'terminated') {
          throw new Error('Sandbox was terminated')
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, this.retryDelay))
      } catch (error) {
        if (i === maxAttempts - 1) {
          throw error
        }
        await new Promise(resolve => setTimeout(resolve, this.retryDelay))
      }
    }
    
    throw new Error('Timeout waiting for sandbox to be ready')
  }

  getWebSocketUrl(sessionId: string): string {
    return `wss://${sessionId}.platform.keyboard.dev/ws`
  }

  createConnectionTarget(sandboxInfo: SandboxInfo): ConnectionTarget {
    return {
      type: 'keyboard-env',
      url: this.getWebSocketUrl(sandboxInfo.sessionId),
      name: `sandbox-${sandboxInfo.sessionId.slice(0, 8)}`,
      codespaceName: sandboxInfo.sessionId,
      connectedAt: Date.now(),
      source: 'auto',
    }
  }

  async findRunningEnvironment(): Promise<SandboxInfo | null> {
    try {
      const { sandboxes } = await this.listUserSandboxes()
      
      // Find the most recently created running sandbox
      const runningSandboxes = sandboxes
        .filter(sandbox => sandbox.status === 'running')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      
      return runningSandboxes[0] || null
    } catch (error) {
      console.error('Failed to find running environment:', error)
      return null
    }
  }

  async findOrCreateEnvironment(config?: SandboxConfig): Promise<SandboxInfo> {
    // First try to find an existing running environment
    const existingEnvironment = await this.findRunningEnvironment()
    if (existingEnvironment) {
      console.log(`Using existing environment: ${existingEnvironment.sessionId}`)
      return existingEnvironment
    }

    // Create a new environment if none exists
    console.log('Creating new sandbox environment...')
    const createResponse = await this.createSandbox(config)
    
    // Wait for the new environment to be ready
    return this.waitForRunning(createResponse.sessionId)
  }

  async validateEnvironment(sessionId: string): Promise<boolean> {
    try {
      const status = await this.getSandboxStatus(sessionId)
      return status.status === 'running'
    } catch (error) {
      return false
    }
  }

  async cleanupExpiredEnvironments(): Promise<void> {
    try {
      const { sandboxes } = await this.listUserSandboxes()
      const now = new Date()
      
      const expiredSandboxes = sandboxes.filter(sandbox => {
        const expiresAt = new Date(sandbox.expiresAt)
        return expiresAt < now && (sandbox.status === 'terminated' || sandbox.status === 'failed')
      })

      for (const sandbox of expiredSandboxes) {
        try {
          await this.deleteSandbox(sandbox.sessionId)
          console.log(`Cleaned up expired sandbox: ${sandbox.sessionId}`)
        } catch (error) {
          console.error(`Failed to cleanup sandbox ${sandbox.sessionId}:`, error)
        }
      }
    } catch (error) {
      console.error('Failed to cleanup expired environments:', error)
    }
  }

  async testConnection(sessionId: string): Promise<boolean> {
    try {
      const sandboxUrl = `https://${sessionId}.platform.keyboard.dev/health`
      const response = await fetch(sandboxUrl, { method: 'GET' })
      return response.ok
    } catch (error) {
      return false
    }
  }
}