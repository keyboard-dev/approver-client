export type ExecutionPreference = 'github-codespace' | 'keyboard-environment'

export interface ExecutionPreferenceConfig {
  baseUrl?: string
  jwtToken: string
}

export interface PreferenceResponse {
  success: boolean
  preference: ExecutionPreference
  error?: string
}

export interface UpdatePreferenceResponse {
  success: boolean
  preference: ExecutionPreference
  message: string
  error?: string
}

export interface UpdatePreferenceRequest {
  preference: ExecutionPreference
}

export class ExecutionPreferenceManager {
  private readonly baseUrl: string
  private jwtToken: string

  constructor(config: ExecutionPreferenceConfig) {
    this.baseUrl = config.baseUrl || 'https://api.keyboard.dev'
    this.jwtToken = config.jwtToken
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

  async getPreference(): Promise<ExecutionPreference> {
    const response = await this.request('GET', '/api/user/preference') as PreferenceResponse
    if (!response.success) {
      throw new Error(response.error || 'Failed to retrieve user preference')
    }

    return response.preference
  }

  async updatePreference(preference: ExecutionPreference): Promise<void> {
    const requestBody: UpdatePreferenceRequest = { preference }
    const response = await this.request('PUT', '/api/user/preference', requestBody) as UpdatePreferenceResponse
    if (!response.success) {
      throw new Error(response.error || 'Failed to update user preference')
    }
  }
}