# External Token Sources Implementation

## Overview

This implementation extends the token fetching system to support multiple external token sources (Connected Accounts, AWS Secrets Manager, WorkOS, etc.) without requiring client code changes.

**UPDATE:** Added intelligent fallback that handles full token names (`KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_GOOGLE`) when accidentally sent as `providerId`, eliminating the need for client-side token name parsing.

## What Was Changed

### 1. New Files Created

#### `src/services/external-token-source.ts`
- **ExternalTokenSource Interface**: Defines the contract for all token sources
- **ExternalTokenSourceRegistry**: Manages multiple token sources with priority-based fallback
- **Key Methods**:
  - `getToken(providerId)`: Fetches token from first available source
  - `getAllAvailableTokenNames()`: Returns all tokens in `KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_*` format
  - `registerSource()`: Adds new token sources dynamically

#### `src/services/connected-accounts-token-source.ts`
- **ConnectedAccountsTokenSource**: First implementation of ExternalTokenSource
- Wraps the existing ConnectedAccountsService
- Priority: 10 (checked first among external sources)

#### `src/services/external-token-source-examples.md`
- Documentation showing how to add AWS Secrets Manager, WorkOS, and other sources
- No client code changes needed when adding new sources

### 2. Modified Files

#### `src/services/connected-accounts-service.ts`
Added `getToken()` method:
```typescript
async getToken(connection: string, accessToken: string): Promise<{
  success: boolean
  message: string
  data?: {
    access_token: string
    token_type?: string
    expires_in?: number
    scope?: string
  }
}>
```

#### `src/services/oauth-service.ts`
Major changes:
1. Added `externalTokenSourceRegistry` property
2. Added `extractProviderIdFromTokenName()` helper method for intelligent fallback
3. Initialized registry in `initializeOAuthProviderSystem()`
4. Updated `handleExecutorProviderTokenRequest()` with fallback logic:
   - Try local providers first
   - Fall back to external sources
   - **NEW:** Intelligent fallback extracts provider ID from full token names
   - Return unified response
5. Updated `handleWebSocketProviderTokenRequest()` with same fallback logic
6. Updated `handleExecutorProviderStatusRequest()` to include all external tokens
7. Updated `handleWebSocketProviderStatusRequest()` to include all external tokens

## Token Fetching Flow

### Request Flow
```
Client Request (providerId: "github")
    ↓
OAuthService.handleExecutorProviderTokenRequest()
    ↓
Strategy 1: Try Local Provider Storage
    ├─ Found? → Encrypt & Return
    └─ Not Found → Continue to Strategy 2
    ↓
Strategy 2: Try External Token Sources (Priority Order)
    ├─ Connected Accounts (Priority 10)
    ├─ AWS Secrets Manager (Priority 20) [Future]
    ├─ WorkOS (Priority 30) [Future]
    └─ Custom Sources...
    ↓
Found? → Encrypt & Return
Not Found? → Return Error
```

### Token Status Flow
```
Client Request (type: "request-provider-status")
    ↓
OAuthService.handleExecutorProviderStatusRequest()
    ↓
Collect Local Tokens:
    KEYBOARD_PROVIDER_USER_TOKEN_FOR_GOOGLE
    KEYBOARD_PROVIDER_USER_TOKEN_FOR_SLACK
    ↓
Collect External Tokens:
    KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_GITHUB
    KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_TWITTER
    ↓
Combine & Return All Available Tokens
```

## Client Code Compatibility

### Before (Only Local Providers)
```typescript
const tokensAvailable = [
  'KEYBOARD_PROVIDER_USER_TOKEN_FOR_GOOGLE',
  'KEYBOARD_PROVIDER_USER_TOKEN_FOR_SLACK',
]
```

### After (Local + External Sources)
```typescript
const tokensAvailable = [
  'KEYBOARD_PROVIDER_USER_TOKEN_FOR_GOOGLE',        // Local OAuth
  'KEYBOARD_PROVIDER_USER_TOKEN_FOR_SLACK',         // Local OAuth
  'KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_GITHUB',    // Auth0 Token Vault
  'KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_TWITTER',   // Auth0 Token Vault
  'KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_SALESFORCE', // Future: AWS Secrets
]
```

### Client Request (No Changes Needed!)
```typescript
// Same code works for both local and external tokens
const tokens = await wsManager?.sendAndWaitForTokenResponse({
  type: 'request-provider-token',
  providerId: 'github',  // Works for local OR external
  requestId: 'github-123',
}, 40000)

userTokenValues['KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_GITHUB'] = tokens.token
```

## Adding New Token Sources

### Step 1: Implement ExternalTokenSource Interface
```typescript
export class MyCustomTokenSource implements ExternalTokenSource {
  readonly config: ExternalTokenSourceConfig = {
    name: 'my-custom-source',
    priority: 40,
  }

  async canProvideToken(providerId: string): Promise<boolean> {
    // Check if this source has the token
  }

  async getToken(providerId: string): Promise<TokenResult> {
    // Fetch and return the token
  }

  async getAvailableProviders(): Promise<string[]> {
    // Return list of available provider IDs
  }
}
```

### Step 2: Register in OAuthService
```typescript
// In oauth-service.ts -> initializeOAuthProviderSystem()
const myCustomSource = new MyCustomTokenSource(config)
this.externalTokenSourceRegistry.registerSource(myCustomSource)
```

### Step 3: Done!
No client code changes needed. Tokens automatically appear as:
`KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_{PROVIDER_NAME}`

## Key Benefits

1. **Zero Client Changes**: Add unlimited token sources without touching client code
2. **Priority-Based Fallback**: Control which source is checked first
3. **Unified Interface**: All sources use the same contract
4. **Automatic Discovery**: Clients automatically see all available tokens
5. **Extensible**: Easy to add AWS Secrets, WorkOS, HashiCorp Vault, etc.
6. **Backward Compatible**: Existing local provider flow unchanged

## Response Format

### Token Response
```typescript
{
  type: 'provider-auth-token',
  providerId: 'github',
  token: 'encrypted-token-here',
  encrypted: true,
  encryptionMethod: 'rsa-codespace',
  timestamp: 1234567890,
  requestId: 'github-123',
  authenticated: true,
  user: { email: 'github', name: 'github' },
  providerName: 'github',
  source: 'external-source'  // or 'local-provider'
}
```

### Status Response
```typescript
{
  type: 'user-tokens-available',
  tokensAvailable: [
    'KEYBOARD_PROVIDER_USER_TOKEN_FOR_GOOGLE',
    'KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_GITHUB',
    'KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_TWITTER',
  ],
  timestamp: 1234567890,
  requestId: 'status-123',
}
```

## Intelligent Fallback Feature

### The Problem
Client code that uses `KEYBOARD_PROVIDER_USER_TOKEN_FOR_` parsing logic will send the full token name when it encounters `KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_*`:

```typescript
// Client extracts provider ID incorrectly:
const providerId = 'KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_GOOGLE'
  .replace('KEYBOARD_PROVIDER_USER_TOKEN_FOR_', '')
// Result: 'KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_GOOGLE' (unchanged!)
```

### The Solution
Server-side fallback automatically extracts the provider ID:

```typescript
// Helper method
private extractProviderIdFromTokenName(tokenName: string): string | null {
  const normalized = tokenName.toLowerCase().trim()
  const externalPrefix = 'keyboard_connected_account_token_for_'
  
  if (normalized.startsWith(externalPrefix)) {
    const providerId = normalized.substring(externalPrefix.length)
    return providerId.replace(/_/g, '-')  // google_oauth2 → google-oauth2
  }
  
  return null
}
```

### Fallback Flow

1. **Try Normal Lookup First** (preserves existing behavior)
   ```
   providerId: 'KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_GOOGLE'
   → Try local providers: Not found
   → Try external sources: Not found
   ```

2. **Trigger Fallback** (only for external token names)
   ```
   → Detect token name format
   → Extract: 'GOOGLE' → 'google'
   → Try external sources with 'google': ✅ Found!
   ```

3. **Return with Extracted ID**
   ```typescript
   {
     providerId: 'google',  // Extracted, not the full token name
     token: 'encrypted-token',
     source: 'external-source'
   }
   ```

### Benefits

✅ **Zero Client Changes** - Works with existing client code  
✅ **Conservative** - Only affects `KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_*`  
✅ **No Regression** - Local providers work exactly as before  
✅ **Backward Compatible** - Properly formatted IDs still work  
✅ **Safe** - Fallback only triggers after normal lookup fails  

### Client Compatibility

Both formats now work:

**Format 1: Properly formatted (recommended)**
```typescript
providerId: 'google-oauth2'
// Works directly
```

**Format 2: Full token name (fallback handles)**
```typescript
providerId: 'KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_GOOGLE_OAUTH2'
// Server extracts: 'google-oauth2'
```

See `FALLBACK_IMPLEMENTATION_TESTS.md` for detailed test cases.

## Future Enhancements

Potential token sources to add:
- ✅ Connected Accounts (Auth0 Token Vault) - **Implemented**
- ✅ Intelligent Fallback for Token Names - **Implemented**
- 🔜 AWS Secrets Manager
- 🔜 WorkOS Pipes
- 🔜 HashiCorp Vault
- 🔜 Azure Key Vault
- 🔜 Google Secret Manager
- 🔜 Custom API endpoints

All can be added without changing client code!

