import type { ConnectedAccountsService } from './connected-accounts-service'
import type { ExternalTokenSource, ExternalTokenSourceConfig, TokenResult } from './external-token-source'

/**
 * Connected Accounts Token Source
 *
 * Fetches tokens from Auth0 Token Vault via the Connected Accounts service.
 * This is the first implementation of the ExternalTokenSource interface.
 */
export class ConnectedAccountsTokenSource implements ExternalTokenSource {
  readonly config: ExternalTokenSourceConfig = {
    name: 'connected-accounts',
    priority: 10, // First external source to check
  }

  constructor(
    private connectedAccountsService: ConnectedAccountsService,
    private getAccessToken: () => Promise<string | null>,
  ) {}

  async canProvideToken(providerId: string): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken()
      if (!accessToken) {
        return false
      }

      const accounts = await this.connectedAccountsService.getConnectedAccounts(accessToken)
      if (!accounts.success) {
        return false
      }

      // Normalize provider ID for comparison (handle both formats)
      const normalizedProviderId = providerId.toLowerCase().replace(/_/g, '-')

      return accounts.accounts.some(
        account => account.connection.toLowerCase() === normalizedProviderId,
      )
    }
    catch (error) {
      return false
    }
  }

  async getToken(providerId: string): Promise<TokenResult> {
    try {
      const accessToken = await this.getAccessToken()
      if (!accessToken) {
        return {
          success: false,
          error: 'No access token available for connected accounts',
        }
      }

      // Normalize provider ID (convert underscores to hyphens)
      const normalizedProviderId = providerId.toLowerCase().replace(/_/g, '-')

      // Fetch the token from the token vault
      const tokenResponse = await this.connectedAccountsService.getToken(
        normalizedProviderId,
        accessToken,
      )

      if (!tokenResponse.success || !tokenResponse.token) {
        return {
          success: false,
          error: tokenResponse.error || 'Failed to fetch token from connected accounts',
        }
      }

      // Get account info for additional metadata
      const accountsResponse = await this.connectedAccountsService.getConnectedAccounts(accessToken)
      const account = accountsResponse.accounts.find(
        acc => acc.connection.toLowerCase() === normalizedProviderId,
      )

      return {
        success: true,
        token: tokenResponse.token,
        user: account
          ? {
              email: account.connection,
              name: account.connection,
            }
          : undefined,
        providerName: account?.connection || normalizedProviderId,
        metadata: {
          source: 'connected-accounts',
          tokenType: tokenResponse.token_type || '',
          expiresIn: tokenResponse.expires_in || 0,
          scope: tokenResponse.scope || '',
          accountId: account?.id,
          scopes: account?.scopes,
          createdAt: account?.created_at,
        },
      }
    }
    catch (error) {
      return {
        success: false,
        error: `Failed to get token from connected accounts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  async getAvailableProviders(): Promise<string[]> {
    try {
      const accessToken = await this.getAccessToken()
      if (!accessToken) {
        return []
      }

      const accounts = await this.connectedAccountsService.getConnectedAccounts(accessToken)
      if (!accounts.success) {
        return []
      }

      // Return normalized provider IDs
      return accounts.accounts.map(account =>
        account.connection.toLowerCase().replace(/-/g, '_'),
      )
    }
    catch (error) {
      return []
    }
  }
}
