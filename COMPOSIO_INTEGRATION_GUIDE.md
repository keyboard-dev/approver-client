# Composio Integration Guide

This guide explains how to complete the Composio integration in your Electron application.

## What Has Been Implemented

### Frontend (Electron Renderer Process)

✅ **Service Layer** (`src/renderer/services/composio-service.ts`)
- Complete API client for all Composio endpoints
- Type-safe TypeScript interfaces
- Error handling and response parsing
- Uses existing `window.electronAPI.getAccessToken()` for authentication
- Uses existing `window.electronAPI.openExternalUrl()` for OAuth flows

✅ **React Hook** (`src/renderer/hooks/useComposio.ts`)
- State management for connected accounts, apps, triggers
- CRUD operations with loading and error states
- Debounced search functionality
- Automatic data refresh on mount

✅ **UI Component** (`src/renderer/components/screens/settings/panels/ComposioTriggersPanel.tsx`)
- Complete settings panel UI
- App search and discovery
- Account connection management
- Trigger deployment with task configuration
- Trigger pause/resume/delete operations
- Task management with keyboard shortcuts and cloud credentials

✅ **Settings Integration** (`src/renderer/components/screens/settings/SettingsScreen.tsx`)
- Added "Composio" tab to settings
- Integrated ComposioTriggersPanel

### IPC Handlers

✅ **No New IPC Handlers Required!**
- Composio service uses direct HTTP calls to backend API
- Leverages existing IPC handlers:
  - `window.electronAPI.getAccessToken()` - for JWT authentication
  - `window.electronAPI.openExternalUrl()` - for OAuth redirects
  - `window.electronAPI.getScripts()` - for keyboard shortcuts
  - `window.electronAPI.getAdditionalConnectedAccounts()` - for cloud credentials

## What You Need to Implement (Backend/Server)

### 1. Backend API Routes (Already Done ✅)

You've already created the Express routes in your server:

```typescript
// Your server already has:
import { createComposioRoutes } from './composio-routes.js'
import { createComposioWebhookRoutes } from './composio-webhooks.js'

// Mount routes in your Express app:
app.use('/api/composio', createComposioRoutes(verifyJWTMiddleware))
app.use('/composio', createComposioWebhookRoutes())
```

### 2. Composio Client Configuration

Ensure your Composio client is properly configured with your API key:

```typescript
// composio/client.ts
import { Composio } from 'composio-core'

let composioClient: Composio | null = null

export function getComposioClient(): Composio {
  if (!composioClient) {
    const apiKey = process.env.COMPOSIO_API_KEY
    if (!apiKey) {
      throw new Error('COMPOSIO_API_KEY environment variable is not set')
    }
    composioClient = new Composio(apiKey)
  }
  return composioClient
}

export function isComposioConfigured(): boolean {
  return !!process.env.COMPOSIO_API_KEY
}
```

### 3. Database Schema

Ensure you have the necessary database tables for:

#### Connected Accounts
```sql
CREATE TABLE composio_connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  app_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  integration_id TEXT NOT NULL,
  connection_params JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Triggers
```sql
CREATE TABLE composio_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  app_name TEXT NOT NULL,
  app_key TEXT NOT NULL,
  config JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  connected_account_id UUID REFERENCES composio_connected_accounts(id),
  composio_trigger_id TEXT,
  encryption_enabled BOOLEAN DEFAULT true,
  encryption_key TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Trigger Tasks
```sql
CREATE TABLE composio_trigger_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployed_trigger_id UUID NOT NULL REFERENCES composio_triggers(id) ON DELETE CASCADE,
  keyboard_shortcut_ids TEXT[] DEFAULT '{}',
  cloud_credentials TEXT[] DEFAULT '{}',
  ask TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Webhook Secrets
```sql
CREATE TABLE composio_webhook_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployed_trigger_id UUID NOT NULL REFERENCES composio_triggers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  secret_value TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  rotation_count INTEGER DEFAULT 0
);
```

### 4. Environment Variables

Add to your `.env` file:

```bash
# Composio Configuration
COMPOSIO_API_KEY=your_composio_api_key_here

# Your existing variables...
```

## Architecture Overview

### Data Flow

1. **User searches for apps** → Frontend calls `/api/composio/apps` → Backend queries Composio SDK → Returns available apps

2. **User connects account** → Frontend calls `/api/composio/accounts/connect` → Backend initiates OAuth → Returns redirect URL → Opens in browser

3. **User deploys trigger** → Frontend calls `/api/composio/triggers` → Backend:
   - Creates trigger in Composio
   - Generates webhook secret
   - Stores trigger in database
   - Creates associated tasks

4. **Webhook receives event** → Composio sends webhook to `/composio/events?secret=xxx` → Backend:
   - Validates secret
   - Retrieves trigger and tasks
   - Executes keyboard shortcuts
   - Runs AI prompts
   - Provides cloud credentials

### Security

- **JWT Authentication**: All API endpoints require valid JWT tokens
- **Webhook Secrets**: Cryptographically secure secrets with automatic rotation
- **Encryption**: Sensitive trigger data can be encrypted
- **Rate Limiting**: Applied to all endpoints
- **User Isolation**: All operations are scoped to authenticated user

## Testing the Integration

### 1. Start Your Application

```bash
# Start your backend server
npm run dev

# Start your Electron app
npm start
```

### 2. Navigate to Settings

1. Open the Electron app
2. Go to Settings
3. Click on the "Composio" tab

### 3. Test the Flow

1. **Search for Apps**
   - Type "Slack" or "GitHub" in the search box
   - Verify apps appear

2. **Connect an Account**
   - Click on an app
   - Click "Connect New Account"
   - Complete OAuth flow in browser
   - Verify account appears in "Connected Accounts"

3. **Deploy a Trigger**
   - Search and select an app with connected account
   - Select the account
   - Choose a trigger type
   - (Optional) Add tasks with keyboard shortcuts
   - Click "Deploy Trigger"
   - Verify trigger appears in "Deployed Triggers"

4. **Test Webhook**
   - Trigger the event in the connected app
   - Verify webhook is received in server logs
   - Verify tasks are executed (keyboard shortcuts run, etc.)

## API Endpoints Summary

### Connected Accounts
- `POST /api/composio/accounts/connect` - Initiate connection
- `GET /api/composio/accounts` - List accounts
- `GET /api/composio/accounts/:id` - Get account
- `DELETE /api/composio/accounts/:id` - Delete account
- `POST /api/composio/accounts/sync` - Sync accounts from Composio

### Triggers
- `POST /api/composio/triggers` - Deploy trigger
- `GET /api/composio/triggers` - List triggers
- `GET /api/composio/triggers/:id` - Get trigger
- `PATCH /api/composio/triggers/:id` - Update trigger config
- `POST /api/composio/triggers/:id/pause` - Pause trigger
- `POST /api/composio/triggers/:id/resume` - Resume trigger
- `DELETE /api/composio/triggers/:id` - Delete trigger
- `GET /api/composio/triggers/available/:appName` - List available triggers

### Trigger Tasks
- `POST /api/composio/triggers/:id/tasks` - Create task
- `GET /api/composio/triggers/:id/tasks` - List tasks
- `GET /api/composio/tasks/:id` - Get task
- `PATCH /api/composio/tasks/:id` - Update task
- `DELETE /api/composio/tasks/:id` - Delete task

### Apps
- `GET /api/composio/apps` - List apps
- `GET /api/composio/apps/categories` - List categories
- `GET /api/composio/apps/:appSlug` - Get app details

### Webhooks (No JWT required)
- `POST /composio/events?secret=xxx` - Receive webhook events
- `GET /composio/health` - Health check

## Troubleshooting

### "Composio integration is not configured"

**Solution**: Ensure `COMPOSIO_API_KEY` is set in your environment variables.

### "No apps appearing in search"

**Possible causes**:
- Composio API key is invalid
- Network issues
- Backend not running

**Solution**: Check server logs and verify API key.

### "Failed to connect account"

**Possible causes**:
- OAuth redirect URL not configured in Composio dashboard
- Browser blocking popups

**Solution**: Configure OAuth redirect URLs in Composio dashboard.

### "Webhook not receiving events"

**Possible causes**:
- Webhook URL not publicly accessible
- Webhook secret mismatch
- Trigger not properly deployed in Composio

**Solution**: 
- Use ngrok or similar for local development
- Verify webhook secret in database matches URL parameter
- Check Composio dashboard for trigger status

## Next Steps

1. **Add webhook URL to Composio dashboard** - Configure your public webhook endpoint
2. **Test with real integrations** - Try connecting Slack, GitHub, etc.
3. **Monitor webhook events** - Add logging to track incoming webhooks
4. **Implement error handling** - Add retry logic for failed webhook processing
5. **Add user notifications** - Notify users when triggers fire successfully

## Resources

- [Composio Documentation](https://docs.composio.dev/)
- [Composio SDK Reference](https://docs.composio.dev/sdk/typescript)
- [Your Composio Dashboard](https://app.composio.dev/)

## Support

If you encounter any issues:

1. Check the server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure database migrations have been run
4. Review the Composio API documentation
5. Check the Electron console for frontend errors

---

**🎉 That's it! Your Composio integration is ready to use.**

The frontend is fully implemented and will work automatically once your backend endpoints are configured and the database is set up.
