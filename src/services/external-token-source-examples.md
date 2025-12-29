# External Token Source Examples

This document shows how to add new external token sources (AWS Secrets Manager, WorkOS, etc.) without modifying client code.

## Architecture Overview

The system uses a **registry pattern** where multiple token sources can be registered and queried in priority order:

1. **Local Providers** (KEYBOARD_PROVIDER_USER_TOKEN_FOR_*) - Direct OAuth flows
2. **External Sources** (KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_*) - Multiple backends:
   - Connected Accounts (Auth0 Token Vault) - Priority 10
   - AWS Secrets Manager (Future) - Priority 20
   - WorkOS Pipes (Future) - Priority 30
   - Custom sources...

## Adding a New Token Source

### Example 1: AWS Secrets Manager

```typescript
// src/services/aws-secrets-token-source.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import type { ExternalTokenSource, TokenResult, ExternalTokenSourceConfig } from './external-token-source'

export class AWSSecretsTokenSource implements ExternalTokenSource {
  readonly config: ExternalTokenSourceConfig = {
    name: 'aws-secrets-manager',
    priority: 20, // Checked after connected accounts
  }

  private client: SecretsManagerClient

  constructor(
    private region: string,
    private secretPrefix: string = 'keyboard/provider-tokens/',
  ) {
    this.client = new SecretsManagerClient({ region })
  }

  async canProvideToken(providerId: string): Promise<boolean> {
    try {
      const secretName = `${this.secretPrefix}${providerId}`
      await this.client.send(new GetSecretValueCommand({ SecretId: secretName }))
      return true
    } catch {
      return false
    }
  }

  async getToken(providerId: string): Promise<TokenResult> {
    try {
      const secretName = `${this.secretPrefix}${providerId}`
      const response = await this.client.send(
        new GetSecretValueCommand({ SecretId: secretName })
      )

      if (!response.SecretString) {
        return { success: false, error: 'Secret has no string value' }
      }

      const secret = JSON.parse(response.SecretString)

      return {
        success: true,
        token: secret.access_token,
        user: secret.user,
        providerName: secret.provider_name || providerId,
        metadata: {
          source: 'aws-secrets-manager',
          region: this.region,
          secretArn: response.ARN,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: `AWS Secrets Manager error: ${error instanceof Error ? error.message : 'Unknown'}`,
      }
    }
  }

  async getAvailableProviders(): Promise<string[]> {
    // List secrets with the prefix and extract provider IDs
    // Implementation depends on your AWS setup
    return []
  }
}
```

### Example 2: WorkOS Pipes

```typescript
// src/services/workos-token-source.ts
import type { ExternalTokenSource, TokenResult, ExternalTokenSourceConfig } from './external-token-source'

export class WorkOSTokenSource implements ExternalTokenSource {
  readonly config: ExternalTokenSourceConfig = {
    name: 'workos',
    priority: 30,
  }

  constructor(
    private apiKey: string,
    private baseUrl: string = 'https://api.workos.com',
  ) {}

  async canProvideToken(providerId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/connections/${providerId}/status`,
        {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        }
      )
      return response.ok
    } catch {
      return false
    }
  }

  async getToken(providerId: string): Promise<TokenResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/connections/${providerId}/token`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        return {
          success: false,
          error: `WorkOS API error: ${response.status}`,
        }
      }

      const data = await response.json()

      return {
        success: true,
        token: data.access_token,
        user: data.user,
        providerName: data.provider_name || providerId,
        metadata: {
          source: 'workos',
          expiresAt: data.expires_at,
          scopes: data.scopes,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: `WorkOS error: ${error instanceof Error ? error.message : 'Unknown'}`,
      }
    }
  }

  async getAvailableProviders(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/connections`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })

      if (!response.ok) return []

      const data = await response.json()
      return data.connections.map((c: any) => c.provider_id)
    } catch {
      return []
    }
  }
}
```

## Registering New Sources

In `oauth-service.ts`, add your new source during initialization:

```typescript
async initializeOAuthProviderSystem(): Promise<void> {
  try {
    // ... existing code ...

    // Initialize external token source registry
    this.externalTokenSourceRegistry = new ExternalTokenSourceRegistry()

    // Register connected accounts (priority 10)
    if (this.getConnectedAccountsService) {
      const service = this.getConnectedAccountsService()
      const connectedAccountsTokenSource = new ConnectedAccountsTokenSource(
        service as ConnectedAccountsService,
        this.getMainAccessToken,
      )
      this.externalTokenSourceRegistry.registerSource(connectedAccountsTokenSource)
    }

    // Register AWS Secrets Manager (priority 20)
    if (process.env.AWS_REGION) {
      const awsSecretsSource = new AWSSecretsTokenSource(
        process.env.AWS_REGION,
        process.env.AWS_SECRET_PREFIX,
      )
      this.externalTokenSourceRegistry.registerSource(awsSecretsSource)
    }

    // Register WorkOS (priority 30)
    if (process.env.WORKOS_API_KEY) {
      const workosSource = new WorkOSTokenSource(process.env.WORKOS_API_KEY)
      this.externalTokenSourceRegistry.registerSource(workosSource)
    }

    // ... rest of initialization ...
  }
}
```

## Client Usage (No Changes Required!)

The client code remains exactly the same regardless of which backend provides the token:

```typescript
// Client receives token names from all sources
const tokensAvailable = [
  'KEYBOARD_PROVIDER_USER_TOKEN_FOR_GOOGLE',           // Local OAuth
  'KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_GITHUB',       // Auth0 Token Vault
  'KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_SALESFORCE',   // AWS Secrets Manager
  'KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_SLACK',        // WorkOS
]

// Same request works for all sources
for (const tokenName of user_tokens_used) {
  const providerId = tokenName.replace('KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_', '')
  
  const tokens = await wsManager?.sendAndWaitForTokenResponse({
    type: 'request-provider-token',
    providerId: providerId.toLowerCase().replace(/_/g, '-'),
    requestId: `${providerId}-${Date.now()}`,
  }, 40000)
  
  userTokenValues[tokenName] = tokens.token
}
```

## Benefits

1. **No Client Changes**: Add new token sources without updating client code
2. **Priority System**: Control which source is checked first
3. **Fallback Chain**: Automatically tries next source if one fails
4. **Unified Interface**: All sources use the same `ExternalTokenSource` interface
5. **Easy Testing**: Mock individual sources for testing
6. **Extensible**: Add unlimited sources (HashiCorp Vault, Azure Key Vault, etc.)

## Token Name Convention

All external sources use: `KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_{PROVIDER_NAME}`

This distinguishes them from local OAuth providers while keeping a consistent naming scheme.

