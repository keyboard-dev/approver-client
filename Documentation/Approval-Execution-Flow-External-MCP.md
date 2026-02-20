# Approval & Execution Flow: External MCP Clients

## Overview

External MCP clients (Claude Web, Claude Desktop, or any WebSocket-connected client) send approval requests to this app via WebSocket. The app displays the request, the user approves or rejects, and the response is sent back to the external client. Auto-approve rules can bypass the UI entirely.

---

## Full Flow Diagram

```
External Client (Claude Web / Claude Desktop)
    |
    | WebSocket connection (port 4002)
    v
ExecutorWebSocketClient.connectToTarget()          [src/websocket-client-to-executor.ts]
    | ws.on('message', data)
    | JSON parse -> this.onMessageReceived(message)
    v
main.ts: handleExecutorMessage()                   [src/main.ts ~L711]
    | switch(message.type)
    |-- 'websocket-message'      -> handleIncomingMessage(message.message)
    |-- 'collection-share-request' -> handleCollectionShareRequest()
    |-- 'prompter-request'       -> send to renderer
    |-- 'prompt-response'        -> send to renderer
    v
main.ts: handleIncomingMessage()                   [src/main.ts ~L1493]
    | Sets default status = 'pending'
    | Shows desktop notification
    |
    |-- AUTO-APPROVE CHECK:
    |   |
    |   |-- For 'Security Evaluation Request':
    |   |   Compare message.risk_level against automaticCodeApproval setting
    |   |   (low/medium/high threshold)
    |   |
    |   |-- For 'code response approval':
    |   |   Check automaticResponseApproval setting
    |   |   (always / success-only / never)
    |   |
    |   |-- If auto-approved:
    |   |   status = 'approved'
    |   |   handleApproveMessage() -> sendApproval() back via WebSocket
    |   |   (User never sees the request)
    |   |
    |   |-- If NOT auto-approved:
    |       windowManager.showWindow()  (bring app to foreground)
    |       Continue to renderer...
    v
windowManager.sendMessage('websocket-message', message)
    | IPC from main -> renderer
    v
preload.ts: onWebSocketMessage(callback)           [src/preload.ts]
    | ipcRenderer.on('websocket-message')
    v
useGlobalWebSocketListeners()                      [src/renderer/hooks/useGlobalWebSocketListeners.ts]
    |
    |-- 1. Check authentication
    |-- 2. Determine current route (on /chat or not?)
    |-- 3. Check isFromOurApp(message.explanation)   [pending-tool-calls.ts]
    |       Uses fingerprint matching against registered pending calls
    |
    |-- ROUTING DECISION:
    |   |
    |   |-- FROM OUR APP + on chat route:
    |   |   Dispatch custom event 'chat-approval-message'
    |   |   (Handled inline by ChatPage - see Chat flow doc)
    |   |
    |   |-- FROM EXTERNAL CLIENT (or not on chat route):
    |   |   Navigate to /messages/${message.id}
    |   |   (Full-screen approval view)
    |
    |-- 4. Store in database
    |   addMessage(messageWithThread)                [database-service.ts]
    |   Associates threadId + threadTitle from currentThreadRef
    v
Message stored in IndexedDB, UI rendered
```

---

## Message Types

### Security Evaluation Request (Pre-execution approval)

```json
{
  "id": "uuid",
  "title": "Security Evaluation Request",
  "code": "const result = await fetch(...)",
  "explanation": "This code calls the GitHub API to list repositories",
  "risk_level": "low" | "medium" | "high",
  "status": "pending"
}
```

### Code Response Approval (Post-execution approval)

```json
{
  "id": "uuid",
  "title": "code response approval",
  "codespaceResponse": {
    "data": {
      "stdout": "...",
      "stderr": "..."
    }
  },
  "status": "pending"
}
```

---

## Display: Full-Screen View

Route: `/messages/:messageId`

```
MessageDetailScreen                                [src/renderer/components/screens/MessageDetailScreen.tsx]
    |
    |-- For 'Security Evaluation Request':
    |   ApprovalPanel                              [src/renderer/components/screens/ApprovalPanel.tsx]
    |   Shows: code, explanation, risk level badge
    |   Actions: Approve / Reject
    |
    |-- For 'code response approval':
        CodeResponseApprovalPanel                  [src/renderer/components/screens/CodeResponseApprovalPanel.tsx]
        Shows: stdout, stderr, execution details
        Actions: Approve / Reject
```

## Display: Inline Chat View

Route: `/chat` or `/chat/:messageId`

```
ChatPage                                           [src/renderer/components/screens/ChatPage.tsx]
    | Listens for 'chat-approval-message' custom event
    | OR loads from messageId URL param via IndexedDB
    v
ApprovalChatMessage                                [src/renderer/components/ApprovalChatMessage.tsx]
    |-- Tabs: Explanation | Code | Output
    |-- Risk level badge: low (green) | medium (yellow) | high (red)
    |-- Status: pending (clock) | approved (check) | rejected (X)
    |-- Full-screen modal option for detailed review
    |-- Approve / Reject buttons (only when status = 'pending')
    |-- Fade-out animation after action
```

---

## Approve / Reject Response Flow

```
User clicks Approve or Reject
    v
ApprovalChatMessage calls onApprove(id) or onReject(id)
    v
ChatPage.handleApprove()                           [ChatPage.tsx ~L113]
    |-- updateMessage(id, { status: 'approved' })  [database-service.ts]
    |-- window.electronAPI.sendMessageResponse(updatedMessage)
    |
    |-- For 'code response approval' specifically:
    |   Build CallToolResult from codespaceResponse.data
    |   resolvePendingCall('run-code', toolResult)  [pending-tool-calls.ts]
    |   (This resolves the Promise.race in the Chat agentic flow)
    |
    |-- Clear approval UI state
    v
preload.ts: sendMessageResponse()                  [src/preload.ts]
    | ipcRenderer.invoke('send-message-response', message, feedback)
    v
main.ts: 'send-message-response' handler           [src/main.ts ~L1791]
    |-- this.sendWebSocketResponse(message)         (for WS clients)
    |-- if executorWSClient exists:
    |   |-- approved  -> executorWSClient.sendApproval(id, feedback)
    |   |-- rejected  -> executorWSClient.sendRejection(id, feedback)
    v
ExecutorWebSocketClient                            [src/websocket-client-to-executor.ts ~L747]
    |
    |-- sendApproval(messageId, feedback):
    |   ws.send({
    |     type: 'approval-response',
    |     id: messageId,
    |     status: 'approved',
    |     feedback: feedback,
    |     timestamp: Date.now()
    |   })
    |
    |-- sendRejection(messageId, feedback):
        ws.send({
          type: 'approval-response',
          id: messageId,
          status: 'rejected',
          feedback: feedback,
          timestamp: Date.now()
        })
    v
Response received by External Client
```

---

## Auto-Approve Logic

Located in `main.ts: handleIncomingMessage()`:

### Security Evaluation Requests

Setting: `automaticCodeApproval` (configured in Settings UI)

| Setting Value | Behavior |
|--------------|----------|
| `'high'` | Auto-approve low, medium, and high risk |
| `'medium'` | Auto-approve low and medium risk |
| `'low'` | Auto-approve low risk only |
| `'none'` (default) | Never auto-approve, always show UI |

### Code Response Approvals

Setting: `automaticResponseApproval` (configured in Settings UI)

| Setting Value | Behavior |
|--------------|----------|
| `'always'` | Auto-approve all responses |
| `'success'` | Auto-approve only if stderr is empty |
| `'never'` (default) | Never auto-approve, always show UI |

---

## Database Storage

All messages are persisted in IndexedDB via `database-service.ts`:

```
Database: 'keyboard-approver-db'
Store: 'messages'
    keyPath: 'id'
    Indexes: 'status', 'timestamp'

Operations:
    addMessage(message)           -- store with default status 'pending'
    updateMessage(id, updates)    -- merge updates (lodash merge)
    getMessage(id)                -- fetch single
    getMessages(status?)          -- fetch by status filter
    deleteMessage(id)             -- remove
```

---

## Files Required

| File | Role |
|------|------|
| `src/websocket-client-to-executor.ts` | WebSocket client -- connects to executor, receives messages, sends approval/rejection responses |
| `src/main.ts` | Main process -- message routing, auto-approve logic, IPC handlers for send-message-response |
| `src/preload.ts` | IPC bridge -- exposes `sendMessageResponse()`, `onWebSocketMessage()` to renderer |
| `src/renderer/hooks/useGlobalWebSocketListeners.ts` | Renderer-side listener -- routes messages to inline chat or full-screen based on fingerprint |
| `src/renderer/services/pending-tool-calls.ts` | Fingerprint system -- `isFromOurApp()`, `generateFingerprint()`, `resolvePendingCall()` |
| `src/renderer/services/database-service.ts` | IndexedDB persistence for all approval messages |
| `src/renderer/components/ApprovalChatMessage.tsx` | Approval UI component -- tabs, risk level, approve/reject buttons |
| `src/renderer/components/screens/ChatPage.tsx` | Chat route handler -- approve/reject logic, custom event listener |
| `src/renderer/components/screens/MessageDetailScreen.tsx` | Full-screen route handler -- routes to correct approval panel |
| `src/renderer/components/screens/ApprovalPanel.tsx` | Full-screen UI for Security Evaluation Requests |
| `src/renderer/components/screens/CodeResponseApprovalPanel.tsx` | Full-screen UI for Code Response Approvals |

---

## Deprecated Code in This Flow

These exist in `preload.ts` but are superseded by `sendMessageResponse()`:

```typescript
// @deprecated - use sendMessageResponse() instead
approveMessage(messageId: string): Promise<void>
rejectMessage(messageId: string): Promise<void>
```

Safe to remove once confirmed no legacy clients call them.

---

## Key Concepts

### Fingerprint-Based Routing
When `useGlobalWebSocketListeners` receives a message, it calls `isFromOurApp(message.explanation)` which checks if the explanation's fingerprint (base64 of normalized text) matches any registered pending call. This determines whether the message is displayed inline in chat (from our agentic flow) or in a full-screen view (from an external client).

### WebSocket Protocol
- **Inbound**: Messages arrive as JSON with `type`, `title`, `code`, `explanation`, `risk_level`, `codespaceResponse` fields
- **Outbound**: Responses sent as `{ type: 'approval-response', id, status, feedback, timestamp }`

### Desktop Notifications
All incoming messages trigger a system notification via the main process, ensuring the user is alerted even when the app is in the background.
