# Executor WebSocket Integration

## Overview

The approver-client now acts as a **WebSocket client** that connects to the codespace-executor's WebSocket server. This allows the approver-client to receive approval requests from the executor and send back approval/rejection responses.

## Authentication

The connection uses **GitHub token authentication** instead of the previous WebSocket key system.

### Connection Headers

The approver-client connects with the following headers:
```typescript
{
  'Authorization': `Bearer ${githubToken}`,
  'X-GitHub-Token': githubToken,
  'User-Agent': 'KeyboardApproverClient/1.0'
}
```

### Token Source

The GitHub token comes from the **onboarding provider** stored in the per-provider token storage:
- Token path: `~/.keyboard-mcp-tokens/onboarding.json`
- This is the same token used for GitHub fork creation during onboarding

## Architecture

### Approver-Client (WebSocket Client)

**File:** `src/websocket-client-to-executor.ts`

- Connects to `ws://127.0.0.1:4000` (executor WebSocket server)
- Uses GitHub token for authentication
- Auto-reconnects on disconnect (up to 10 attempts)
- Sends approval/rejection responses back to executor

**Key Methods:**
- `setGitHubToken(token)` - Set authentication token and connect
- `sendApproval(messageId, feedback)` - Send approval response
- `sendRejection(messageId, feedback)` - Send rejection response
- `disconnect()` - Clean disconnect

### Codespace-Executor (WebSocket Server)

**File:** `src/web-socket.ts`

- Listens on `ws://127.0.0.1:4000`
- Accepts connections authenticated with:
  - GitHub token (new method)
  - WebSocket key (legacy support)
- Broadcasts messages to all connected clients
- Handles approval-response messages from approver-client

## Message Flow

### 1. Code Execution Request
```
codespace-executor receives code execution request
      ↓
Creates approval message with risk level
      ↓
Broadcasts to all WebSocket clients (including approver-client)
```

### 2. Approval in UI
```
approver-client receives message via WebSocket
      ↓
Displays in Electron UI for user review
      ↓
User clicks Approve/Reject
      ↓
approver-client sends approval-response back to executor
      ↓
executor updates message status and continues execution
```

## Connection Lifecycle

### Initialization
1. App starts and initializes OAuth provider system
2. Tries to load onboarding GitHub token
3. If token exists, connects to executor immediately
4. If no token, waits for GitHub authentication

### After GitHub Onboarding
1. User completes GitHub onboarding
2. Token is stored in per-provider storage
3. `setGitHubToken()` is called with the new token
4. WebSocket client connects to executor

### Reconnection
- Auto-reconnects on disconnect
- Up to 10 reconnection attempts with 5-second delays
- Resets attempt count when successfully connected
- Won't reconnect if token is not available

## Message Types

### From Executor → Approver-Client

**websocket-message**
```json
{
  "type": "websocket-message",
  "message": {
    "id": "message-id",
    "title": "Security Evaluation Request",
    "body": "Code execution approval needed",
    "status": "pending",
    "risk_level": "medium"
  }
}
```

**collection-share-request**
```json
{
  "type": "collection-share-request",
  "data": { /* collection data */ }
}
```

**prompter-request**
```json
{
  "type": "prompter-request",
  "data": { /* prompt data */ }
}
```

### From Approver-Client → Executor

**approval-response**
```json
{
  "type": "approval-response",
  "id": "message-id",
  "status": "approved",
  "feedback": "Optional feedback text",
  "timestamp": 1234567890
}
```

## IPC Handlers

New IPC handlers for renderer process:

- `get-executor-connection-status` - Check if connected to executor
- `reconnect-to-executor` - Force reconnect to executor
- `disconnect-from-executor` - Disconnect from executor

## Configuration

### Executor Port
Both systems must agree on the port:
- **Executor:** `WS_PORT = 4000`
- **Approver-Client:** `EXECUTOR_WS_PORT = 4000`

### Localhost Only
Both systems enforce localhost-only connections for security:
- `127.0.0.1`
- `::1`
- `::ffff:127.0.0.1`

## Benefits

1. **Unified Approval Flow** - All approvals go through one UI
2. **Real-time Communication** - Immediate approval/rejection feedback
3. **Multiple Clients** - Executor can have multiple approver-clients connected
4. **Automatic Reconnection** - Resilient to temporary disconnections
5. **Secure Authentication** - Uses existing GitHub token infrastructure

## Testing

To test the integration:

1. Start codespace-executor with WebSocket server
2. Start approver-client
3. Complete GitHub onboarding in approver-client
4. Check connection status (should show "connected")
5. Trigger a code execution in executor
6. Approval request should appear in approver-client UI
7. Approve/reject and verify executor receives response

## Troubleshooting

**Connection fails:**
- Check that codespace-executor is running on port 4000
- Verify GitHub onboarding token exists
- Check console logs for authentication errors

**Messages not appearing:**
- Verify WebSocket connection is established
- Check message type handling in `handleExecutorMessage()`
- Review executor broadcast logic

**Auto-reconnect not working:**
- Check if GitHub token is still valid
- Verify reconnection attempts haven't exceeded max (10)
- Look for token refresh errors

