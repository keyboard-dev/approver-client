# Composio Main.ts IPC Handlers Implementation Guide

This guide shows you how to implement the IPC handlers in `main.ts` for Composio integration.

## Overview

All Composio API calls go through IPC handlers in the main process. This ensures:
- **Security**: Access tokens are handled securely in the main process
- **Consistency**: Follows the same pattern as Pipedream triggers
- **Centralization**: All backend communication happens in one place

## Implementation

Add these IPC handlers to your `main.ts` file. Look for where the Pipedream handlers are defined and add the Composio handlers in a similar location.

### Helper Function (Add Once)

First, add a helper function to make API calls with authentication:

```typescript
/**
 * Helper function to make authenticated API calls to the backend
 */
async function makeAuthenticatedApiCall(
  url: string,
  options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    body?: unknown
  } = { method: 'GET' },
): Promise<{ success: boolean, data?: unknown, error?: string }> {
  try {
    // Get the access token (you likely have this function already for Pipedream)
    const accessToken = await getAccessToken() // Replace with your actual token getter

    const headers: HeadersInit = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    const fetchOptions: RequestInit = {
      method: options.method,
      headers,
    }

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body)
    }

    const response = await fetch(url, fetchOptions)
    
    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `HTTP ${response.status}`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.message || errorJson.error || errorMessage
      }
      catch {
        errorMessage = errorText || errorMessage
      }
      return { success: false, error: errorMessage }
    }

    const data = await response.json()
    return data
  }
  catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}
```

### Configuration

Add configuration at the top of your main.ts file:

```typescript
const API_BASE = process.env.API_BASE_URL || 'https://api.keyboard.dev'
const COMPOSIO_API_BASE = `${API_BASE}/api/composio`
```

### IPC Handlers

Add these handlers to your `ipcMain.handle()` registrations:

```typescript
// =============================================================================
// Composio - Connected Accounts
// =============================================================================

ipcMain.handle('initiate-composio-connection', async (_event, request: {
  appName: string
  redirectUrl?: string
  authConfig?: Record<string, unknown>
}) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/accounts/connect`, {
    method: 'POST',
    body: request,
  })
})

ipcMain.handle('list-composio-connected-accounts', async (_event, params?: {
  appName?: string
  status?: string
}) => {
  const queryParams = new URLSearchParams()
  if (params?.appName) queryParams.set('appName', params.appName)
  if (params?.status) queryParams.set('status', params.status)
  
  const url = `${COMPOSIO_API_BASE}/accounts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
  return makeAuthenticatedApiCall(url, { method: 'GET' })
})

ipcMain.handle('get-composio-connected-account', async (_event, accountId: string) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/accounts/${accountId}`, {
    method: 'GET',
  })
})

ipcMain.handle('delete-composio-connected-account', async (_event, accountId: string) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/accounts/${accountId}`, {
    method: 'DELETE',
  })
})

ipcMain.handle('sync-composio-connected-accounts', async () => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/accounts/sync`, {
    method: 'POST',
  })
})

// =============================================================================
// Composio - Triggers
// =============================================================================

ipcMain.handle('deploy-composio-trigger', async (_event, config: {
  connectedAccountId: string
  triggerName: string
  appName: string
  config?: Record<string, unknown>
  encryptionEnabled?: boolean
  tasks?: Array<{
    keyboardShortcutIds?: string[]
    cloudCredentials?: string[]
    ask?: string
  }>
}) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/triggers`, {
    method: 'POST',
    body: config,
  })
})

ipcMain.handle('list-composio-triggers', async (_event, params?: {
  appName?: string
  status?: string
}) => {
  const queryParams = new URLSearchParams()
  if (params?.appName) queryParams.set('appName', params.appName)
  if (params?.status) queryParams.set('status', params.status)
  
  const url = `${COMPOSIO_API_BASE}/triggers${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
  return makeAuthenticatedApiCall(url, { method: 'GET' })
})

ipcMain.handle('get-composio-trigger', async (_event, triggerId: string) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/triggers/${triggerId}`, {
    method: 'GET',
  })
})

ipcMain.handle('update-composio-trigger-config', async (_event, triggerId: string, config: Record<string, unknown>) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/triggers/${triggerId}`, {
    method: 'PATCH',
    body: { config },
  })
})

ipcMain.handle('pause-composio-trigger', async (_event, triggerId: string) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/triggers/${triggerId}/pause`, {
    method: 'POST',
  })
})

ipcMain.handle('resume-composio-trigger', async (_event, triggerId: string) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/triggers/${triggerId}/resume`, {
    method: 'POST',
  })
})

ipcMain.handle('delete-composio-trigger', async (_event, triggerId: string) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/triggers/${triggerId}`, {
    method: 'DELETE',
  })
})

ipcMain.handle('list-composio-available-triggers', async (_event, appName: string) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/triggers/available/${appName}`, {
    method: 'GET',
  })
})

// =============================================================================
// Composio - Trigger Tasks
// =============================================================================

ipcMain.handle('create-composio-trigger-task', async (_event, triggerId: string, task: {
  keyboardShortcutIds?: string[]
  cloudCredentials?: string[]
  ask?: string
}) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/triggers/${triggerId}/tasks`, {
    method: 'POST',
    body: task,
  })
})

ipcMain.handle('list-composio-trigger-tasks', async (_event, triggerId: string) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/triggers/${triggerId}/tasks`, {
    method: 'GET',
  })
})

ipcMain.handle('get-composio-trigger-task', async (_event, taskId: string) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/tasks/${taskId}`, {
    method: 'GET',
  })
})

ipcMain.handle('update-composio-trigger-task', async (_event, taskId: string, updates: {
  keyboardShortcutIds?: string[]
  cloudCredentials?: string[]
  ask?: string
}) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/tasks/${taskId}`, {
    method: 'PATCH',
    body: updates,
  })
})

ipcMain.handle('delete-composio-trigger-task', async (_event, taskId: string) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/tasks/${taskId}`, {
    method: 'DELETE',
  })
})

// =============================================================================
// Composio - Apps
// =============================================================================

ipcMain.handle('list-composio-apps', async (_event, params?: {
  search?: string
  category?: string
  limit?: number
  supportsTriggers?: boolean
}) => {
  const queryParams = new URLSearchParams()
  if (params?.search) queryParams.set('search', params.search)
  if (params?.category) queryParams.set('category', params.category)
  if (params?.limit) queryParams.set('limit', params.limit.toString())
  if (params?.supportsTriggers !== undefined) {
    queryParams.set('supportsTriggers', params.supportsTriggers.toString())
  }
  
  const url = `${COMPOSIO_API_BASE}/apps${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
  return makeAuthenticatedApiCall(url, { method: 'GET' })
})

ipcMain.handle('list-composio-app-categories', async () => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/apps/categories`, {
    method: 'GET',
  })
})

ipcMain.handle('get-composio-app', async (_event, appSlug: string) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/apps/${appSlug}`, {
    method: 'GET',
  })
})
```

## Location in main.ts

Add these handlers in a logical place in your `main.ts` file:

1. Look for where you have `ipcMain.handle('fetch-pipedream-triggers', ...)`
2. Add the Composio handlers right after all the Pipedream handlers
3. Keep them grouped together for easy maintenance

## Example Location

```typescript
// ... other handlers ...

// =============================================================================
// Pipedream Triggers (existing)
// =============================================================================

ipcMain.handle('fetch-pipedream-triggers', async (_event, app: string) => {
  // ... existing pipedream code ...
})

// ... more pipedream handlers ...

// =============================================================================
// Composio Integration (NEW - add here)
// =============================================================================

ipcMain.handle('initiate-composio-connection', async (_event, request: {
  appName: string
  redirectUrl?: string
  authConfig?: Record<string, unknown>
}) => {
  return makeAuthenticatedApiCall(`${COMPOSIO_API_BASE}/accounts/connect`, {
    method: 'POST',
    body: request,
  })
})

// ... rest of composio handlers ...
```

## Testing the Handlers

After implementing, test each handler:

1. **Test Connection**: Try initiating a connection
2. **Test List Accounts**: Verify accounts are fetched
3. **Test Deploy Trigger**: Deploy a simple trigger
4. **Test List Apps**: Search for apps

## Troubleshooting

### "Handler not registered" error
- Make sure all handlers are registered before `app.whenReady()`
- Check that handler names match exactly (e.g., 'initiate-composio-connection')

### "No access token" error
- Verify `getAccessToken()` function is working
- Check that user is authenticated before making calls

### API errors
- Check that `API_BASE_URL` points to your backend
- Verify backend routes are mounted correctly
- Check server logs for detailed error messages

## Complete!

Once you've added these handlers, the Composio integration will work seamlessly. The frontend is already configured to use these IPC handlers via the service layer.
