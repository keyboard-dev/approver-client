/**
 * External Token Source Interface
 *
 * This abstraction allows the system to fetch tokens from multiple external sources
 * (Auth0 Token Vault, AWS Secrets Manager, WorkOS, etc.) without modifying client code.
 *
 * Clients use: KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_{PROVIDER_NAME}
 * Server routes to appropriate source based on configuration.
 */

export interface ExternalTokenSourceConfig {
  name: string
  priority: number // Lower number = higher priority (checked first)
}

export interface TokenResult {
  success: boolean
  token?: string
  user?: {
    email?: string
    name?: string
    [key: string]: unknown
  }
  providerName?: string
  metadata?: Record<string, unknown>
  error?: string
  scope?: string
  expires_in?: number
  token_type?: string
  access_token?: string
  refresh_token?: string
  id_token?: string
  expires_at?: number
  created_at?: number
  updated_at?: number
}

export interface ExternalTokenSource {
  readonly config: ExternalTokenSourceConfig

  /**
   * Check if this source can provide a token for the given provider
   */
  canProvideToken(providerId: string): Promise<boolean>

  /**
   * Fetch token for the given provider
   */
  getToken(providerId: string): Promise<TokenResult>

  /**
   * Get list of available provider IDs from this source
   */
  getAvailableProviders(): Promise<string[]>
}

/**
 * Registry for managing multiple external token sources
 */
export class ExternalTokenSourceRegistry {
  private sources: ExternalTokenSource[] = []

  /**
   * Register a new token source
   */
  registerSource(source: ExternalTokenSource): void {
    this.sources.push(source)
    // Sort by priority (lower number = higher priority)
    this.sources.sort((a, b) => a.config.priority - b.config.priority)
  }

  /**
   * Unregister a token source
   */
  unregisterSource(name: string): void {
    this.sources = this.sources.filter(s => s.config.name !== name)
  }

  /**
   * Extract provider ID from token name if it matches a known pattern
   */
  private extractProviderIdFromTokenName(tokenName: string): { providerId: string, type: string } | null {
    const normalized = tokenName.toLowerCase().trim()

    // Check for KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_* pattern
    const connectedAccountPrefix = 'keyboard_connected_account_token_for_'
    if (normalized.startsWith(connectedAccountPrefix)) {
      // Extract and normalize the provider ID
      const providerId = normalized.substring(connectedAccountPrefix.length)
      return {
        providerId: providerId.replace(/_/g, '-'),
        type: 'connected_account',
      }
    }

    return null
  }

  /**
   * Get token from the first source that can provide it
   * Automatically detects token type from token name pattern
   */
  async getToken(providerId: string): Promise<TokenResult> {
    // First, check if the providerId is actually a full token name that needs extraction
    const extracted = this.extractProviderIdFromTokenName(providerId)
    const actualProviderId = extracted ? extracted.providerId : providerId
    const tokenType = extracted ? extracted.type : undefined

    for (const source of this.sources) {
      try {
        // If we detected a specific token type, we can add logic here to filter sources
        // For now, try all sources in priority order
        const canProvide = await source.canProvideToken(actualProviderId)
        console.log('canProvide', canProvide)
        if (canProvide) {
          const result = await source.getToken(actualProviderId)
          console.log('result', result)
          if (result.success && result.token) {
            console.log('result', result)
            // Add token type and actual provider ID metadata if detected
            if (tokenType || actualProviderId !== providerId) {
              result.metadata = result.metadata || {}
              if (tokenType) {
                result.metadata.tokenType = tokenType
              }
              if (actualProviderId !== providerId) {
                result.metadata.actualProviderId = actualProviderId
              }
            }
            return result
          }
        }
      }
      catch (error) {
        console.warn(`External token source ${source.config.name} failed for ${actualProviderId}:`, error)
        // Continue to next source
      }
    }

    return {
      success: false,
      error: `No external source can provide token for provider: ${actualProviderId}`,
    }
  }

  /**
   * Get all available provider IDs from all sources
   */
  async getAllAvailableProviders(): Promise<Array<{ providerId: string, sourceName: string }>> {
    const allProviders: Array<{ providerId: string, sourceName: string }> = []

    for (const source of this.sources) {
      try {
        const providers = await source.getAvailableProviders()
        for (const providerId of providers) {
          allProviders.push({
            providerId,
            sourceName: source.config.name,
          })
        }
      }
      catch (error) {
        console.warn(`Failed to get providers from ${source.config.name}:`, error)
      }
    }

    return allProviders
  }

  /**
   * Get all available token names in the format expected by clients
   */
  async getAllAvailableTokenNames(): Promise<string[]> {
    const providers = await this.getAllAvailableProviders()
    return providers.map(({ providerId }) =>
      `KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_${providerId.toUpperCase().replace(/-/g, '_')}`,
    )
  }

  /**
   * Get registered sources
   */
  getSources(): ExternalTokenSource[] {
    return [...this.sources]
  }
}
