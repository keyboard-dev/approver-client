# Fallback Implementation Tests

## Overview

This document tests the fallback implementation for handling `KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_*` token names when sent as `providerId`.

## Implementation Details

### Helper Method
```typescript
private extractProviderIdFromTokenName(tokenName: string): string | null {
  const normalized = tokenName.toLowerCase().trim()
  const externalPrefix = 'keyboard_connected_account_token_for_'
  
  if (normalized.startsWith(externalPrefix)) {
    const providerId = normalized.substring(externalPrefix.length)
    return providerId.replace(/_/g, '-')
  }
  
  return null
}
```

### Fallback Logic in Token Request Handlers
```typescript
// Strategy 2b: Fallback - check if providerId is actually a full token name
if (!externalResult.success && !externalResult.token) {
  const extractedProviderId = this.extractProviderIdFromTokenName(providerId)
  if (extractedProviderId) {
    externalResult = await this.externalTokenSourceRegistry.getToken(extractedProviderId)
    if (externalResult.success && externalResult.token) {
      actualProviderId = extractedProviderId
    }
  }
}
```

## Test Cases

### Test 1: Local Provider (Existing Behavior - Should Not Change)

**Input:**
```typescript
{
  type: 'request-provider-token',
  providerId: 'google',
  requestId: 'test-1'
}
```

**Expected Flow:**
1. Try local provider with `'google'` → ✅ Found
2. Return token from local storage
3. No fallback triggered

**Expected Response:**
```typescript
{
  type: 'provider-auth-token',
  providerId: 'google',
  token: 'encrypted-token',
  source: 'local-provider',
  ...
}
```

### Test 2: External Provider with Correct Format

**Input:**
```typescript
{
  type: 'request-provider-token',
  providerId: 'google-oauth2',
  requestId: 'test-2'
}
```

**Expected Flow:**
1. Try local provider with `'google-oauth2'` → Not found
2. Try external sources with `'google-oauth2'` → ✅ Found
3. Return token from connected accounts
4. No fallback triggered

**Expected Response:**
```typescript
{
  type: 'provider-auth-token',
  providerId: 'google-oauth2',
  token: 'encrypted-token',
  source: 'external-source',
  ...
}
```

### Test 3: Full Token Name (FALLBACK TRIGGERS)

**Input:**
```typescript
{
  type: 'request-provider-token',
  providerId: 'KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_GOOGLE_OAUTH2',
  requestId: 'test-3'
}
```

**Expected Flow:**
1. Try local provider with `'keyboard_connected_account_token_for_google_oauth2'` → Not found
2. Try external sources with `'keyboard-connected-account-token-for-google-oauth2'` → Not found
3. **FALLBACK:** Extract provider ID
   - Input: `'KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_GOOGLE_OAUTH2'`
   - Normalized: `'keyboard_connected_account_token_for_google_oauth2'`
   - Extracted: `'google-oauth2'`
4. Try external sources with `'google-oauth2'` → ✅ Found
5. Return token with extracted provider ID

**Expected Response:**
```typescript
{
  type: 'provider-auth-token',
  providerId: 'google-oauth2',  // Extracted ID, not the full token name
  token: 'encrypted-token',
  source: 'external-source',
  ...
}
```

### Test 4: Full Token Name with Underscores

**Input:**
```typescript
{
  type: 'request-provider-token',
  providerId: 'KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_SALESFORCE_SANDBOX',
  requestId: 'test-4'
}
```

**Expected Flow:**
1. Try local provider → Not found
2. Try external sources with normalized name → Not found
3. **FALLBACK:** Extract and normalize
   - Extract: `'SALESFORCE_SANDBOX'`
   - Normalize: `'salesforce-sandbox'`
4. Try external sources with `'salesforce-sandbox'` → ✅ Found

**Expected Response:**
```typescript
{
  type: 'provider-auth-token',
  providerId: 'salesforce-sandbox',
  token: 'encrypted-token',
  source: 'external-source',
  ...
}
```

### Test 5: Invalid Provider (Error Case)

**Input:**
```typescript
{
  type: 'request-provider-token',
  providerId: 'nonexistent-provider',
  requestId: 'test-5'
}
```

**Expected Flow:**
1. Try local provider with `'nonexistent-provider'` → Not found
2. Try external sources with `'nonexistent-provider'` → Not found
3. Fallback check: Not a token name format → Skip
4. Return error

**Expected Response:**
```typescript
{
  type: 'provider-auth-token',
  providerId: 'nonexistent-provider',
  error: 'No token available for this provider from any source',
  authenticated: false,
  ...
}
```

### Test 6: Local Provider Token Name (Should Not Match Fallback)

**Input:**
```typescript
{
  type: 'request-provider-token',
  providerId: 'KEYBOARD_PROVIDER_USER_TOKEN_FOR_GOOGLE',
  requestId: 'test-6'
}
```

**Expected Flow:**
1. Try local provider → Not found (wrong format)
2. Try external sources → Not found
3. Fallback check: Doesn't start with `'keyboard_connected_account_token_for_'` → Skip
4. Return error

**Expected Response:**
```typescript
{
  type: 'provider-auth-token',
  providerId: 'KEYBOARD_PROVIDER_USER_TOKEN_FOR_GOOGLE',
  error: 'No token available for this provider from any source',
  authenticated: false,
  ...
}
```

## Edge Cases

### Edge Case 1: Mixed Case Token Name
**Input:** `KeyBoArD_CoNnEcTeD_AcCoUnT_ToKeN_FoR_GoOgLe`
**Expected:** Normalizes to lowercase, extracts `'google'`, works correctly

### Edge Case 2: Token Name with Trailing/Leading Spaces
**Input:** `'  KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_GOOGLE  '`
**Expected:** Trims spaces, extracts `'google'`, works correctly

### Edge Case 3: Token Name with Extra Underscores
**Input:** `KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_MY__PROVIDER`
**Expected:** Extracts `'MY__PROVIDER'`, converts to `'my--provider'`

## Verification Checklist

- ✅ Local providers work exactly as before (no regression)
- ✅ External providers with correct format work as before
- ✅ Full token names trigger fallback correctly
- ✅ Fallback only applies to `KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_*` format
- ✅ Local provider token names do NOT trigger fallback
- ✅ Response uses extracted provider ID, not full token name
- ✅ No linting errors
- ✅ TypeScript compilation passes
- ✅ Both executor and websocket handlers updated

## Client Compatibility

The client can now send EITHER format:

**Option 1: Properly formatted (recommended)**
```typescript
const providerId = tokenName
  .replace('KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_', '')
  .toLowerCase()
  .replace(/_/g, '-')

// Result: 'google-oauth2'
```

**Option 2: Full token name (fallback handles it)**
```typescript
const providerId = tokenName
// No transformation

// Result: 'KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_GOOGLE_OAUTH2'
// Server extracts: 'google-oauth2'
```

Both work! The server is smart enough to handle both cases. 🎉

