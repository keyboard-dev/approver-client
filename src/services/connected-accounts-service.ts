import fetch from 'node-fetch'

export interface InitiateConnectionRequest {
  connection: string
  scopes: string[]
  redirect_uri: string
}

export interface InitiateConnectionResponse {
  success: boolean
  message: string
  data: {
    state: string
    auth_session: string
    connect_uri: string
    session_id: string
    expires_in: number
  }
}

export interface CompleteConnectionRequest {
  session_id: string
  connect_code: string
}

export interface CompleteConnectionResponse {
  success: boolean
  message: string
  data?: unknown
}

export interface ConnectedAccountsServiceConfig {
  tokenVaultUrl: string
}

export class ConnectedAccountsService {
  private tokenVaultUrl: string

  constructor(config: ConnectedAccountsServiceConfig) {
    this.tokenVaultUrl = config.tokenVaultUrl
  }

  async initiateConnection(
    request: InitiateConnectionRequest,
  ): Promise<InitiateConnectionResponse> {
    try {
      const response = await fetch(
        `${this.tokenVaultUrl}/api/token-vault/connected-accounts/initiate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json() as InitiateConnectionResponse

      if (!data.success) {
        throw new Error(data.message || 'Failed to initiate connection')
      }

      return data
    }
    catch (error) {
      console.error('❌ Failed to initiate connected account:', error)
      throw error
    }
  }

  async completeConnection(
    request: CompleteConnectionRequest,
  ): Promise<CompleteConnectionResponse> {
    try {
      const response = await fetch(
        `${this.tokenVaultUrl}/api/token-vault/connected-accounts/complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json() as CompleteConnectionResponse

      if (!data.success) {
        throw new Error(data.message || 'Failed to complete connection')
      }

      return data
    }
    catch (error) {
      console.error('❌ Failed to complete connected account:', error)
      throw error
    }
  }
}
