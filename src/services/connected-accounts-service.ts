import fetch from 'node-fetch'
import type { TokenResult } from './external-token-source'

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
  auth_session: string
  connect_code: string
  redirect_uri: string
}

export interface CompleteConnectionResponse {
  success: boolean
  message: string
  data?: unknown
}

export interface SocialProvider {
  name: string
  strategy: string
  scopes: string[]
  icon?: string
}

export interface SocialProvidersResponse {
  success: boolean
  providers: SocialProvider[]
  count: number
  message: string
}

export interface ConnectedAccount {
  id: string
  connection: string
  access_type: string
  scopes: string[]
  created_at: string
  icon?: string
}

export interface ConnectedAccountsResponse {
  success: boolean
  accounts: ConnectedAccount[]
}

export interface DeleteAccountResponse {
  success: boolean
  message: string
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
    token: string,
  ): Promise<InitiateConnectionResponse> {
    const response = await fetch(
      `${this.tokenVaultUrl}/api/token-vault/connected-accounts/initiate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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

  async completeConnection(
    request: CompleteConnectionRequest, token: string,
  ): Promise<CompleteConnectionResponse> {
    const response = await fetch(
      `${this.tokenVaultUrl}/api/token-vault/connected-accounts/complete`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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

  async getSocialProviders(accessToken: string): Promise<SocialProvidersResponse> {
    const response = await fetch(
      `${this.tokenVaultUrl}/api/token-vault/connected-accounts/social-providers`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as SocialProvidersResponse

    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch social providers')
    }

    return data
  }

  async getConnectedAccounts(accessToken: string): Promise<ConnectedAccountsResponse> {
    const response = await fetch(
      `${this.tokenVaultUrl}/api/token-vault/connected-accounts`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as ConnectedAccountsResponse

    if (!data.success) {
      throw new Error('Failed to fetch connected accounts')
    }

    return data
  }

  async deleteAccount(accountId: string, accessToken: string): Promise<DeleteAccountResponse> {
    const response = await fetch(
      `${this.tokenVaultUrl}/api/token-vault/connected-accounts/${accountId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as DeleteAccountResponse

    if (!data.success) {
      throw new Error(data.message || 'Failed to delete account')
    }

    return data
  }

  async getAvailableTokenNames(accessToken: string): Promise<string[]> {
    try {
      const connectedAccountsResponse = await this.getConnectedAccounts(accessToken)

      if (!connectedAccountsResponse.success) {
        return []
      }

      return connectedAccountsResponse.accounts.map(account =>
        `KEYBOARD_PROVIDER_USER_TOKEN_FOR_${account.connection.toUpperCase().replace(/-/g, '_')}_STORED_IN_CLOUD`,
      )
    }
    catch {
      return []
    }
  }

  async getToken(connection: string, accessToken: string): Promise<TokenResult> {
    let cleanConnection = connection
    if (cleanConnection.endsWith('_stored_in_cloud')) {
      cleanConnection = cleanConnection.substring(0, cleanConnection.length - '_stored_in_cloud'.length)
    }
    const response = await fetch(
      `${this.tokenVaultUrl}/api/token-vault/connected-accounts/credentials`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          connection: cleanConnection,
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as {
      success: boolean
      message: string
      credentials?: {
        access_token: string
        expires_in?: number
        scope?: string
        token_type?: string
      }
    }
    const tokenResult = {
      success: data.success,
      token: data.credentials?.access_token,
      expires_in: data.credentials?.expires_in,
      scope: data.credentials?.scope,
      token_type: data.credentials?.token_type,
    } as TokenResult

    if (!tokenResult.success) {
      throw new Error(tokenResult.error || 'Failed to fetch token')
    }

    return tokenResult
  }
}
