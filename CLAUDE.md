# Approver Client Architecture

## Overview

Electron app with two main flows: receiving external approval requests (Claude Web/Desktop) and running agentic chat with MCP connectors. Both flows share a fingerprint-based bridge for identifying and resolving pending tool calls.

## Build & Run

```bash
npm install
npm run dev        # development mode
npm run build      # production build
```

## Flow 1: External Approval (Claude Web/Desktop -> Approve -> Response)

```
External Client (Claude Web/Desktop)
    | WebSocket (port 4002)
ExecutorWebSocketClient.connectToTarget()          [src/websocket-client-to-executor.ts]
    | ws.on('message')
main.ts: handleExecutorMessage()                   [src/main.ts ~L711]
    |
main.ts: handleIncomingMessage()                   [src/main.ts ~L1493]
    | auto-approve check (risk_level vs settings)
    |-- AUTO-APPROVED -> handleApproveMessage() -> sendApproval() back via WS
    |-- NEEDS REVIEW:
windowManager.sendMessage('websocket-message')
    | IPC bridge
preload.ts: onWebSocketMessage()                   [src/preload.ts]
    |
useGlobalWebSocketListeners()                      [src/renderer/hooks/useGlobalWebSocketListeners.ts]
    | checks isFromOurApp() via fingerprint
    |-- FROM OUR APP + on chat route -> dispatch 'chat-approval-message' event (inline)
    |-- FROM EXTERNAL -> navigate to /messages/:id (full-screen)
    |
database-service.ts: addMessage()                  [src/renderer/services/database-service.ts]
```

### Display paths

- **Full-screen**: `/messages/:messageId` -> `MessageDetailScreen` -> `ApprovalPanel` or `CodeResponseApprovalPanel`
- **Inline chat**: `/chat` -> `ChatPage` listens for `chat-approval-message` event -> `ApprovalChatMessage`

### User approves/rejects

```
ApprovalChatMessage -> onApprove/onReject
    |
ChatPage.handleApprove()                           [src/renderer/components/screens/ChatPage.tsx ~L113]
    | updates IndexedDB + resolvePendingCall() for code responses
window.electronAPI.sendMessageResponse()           [src/preload.ts]
    | IPC
main.ts: 'send-message-response' handler           [src/main.ts ~L1791]
    |
executorWSClient.sendApproval()/sendRejection()    [src/websocket-client-to-executor.ts ~L747]
    | WebSocket
Back to External Client
```

### Two message types

- `'Security Evaluation Request'` -- code + explanation + risk_level (before execution)
- `'code response approval'` -- stdout/stderr results (after execution)

### Files required for Flow 1

| File | Role |
|------|------|
| `src/websocket-client-to-executor.ts` | WS client, send/receive |
| `src/main.ts` | Message routing, auto-approve logic, IPC handlers |
| `src/preload.ts` | IPC bridge (sendMessageResponse, onWebSocketMessage) |
| `src/renderer/hooks/useGlobalWebSocketListeners.ts` | Renderer-side WS listener |
| `src/renderer/services/pending-tool-calls.ts` | Fingerprint system (isFromOurApp, resolvePendingCall) |
| `src/renderer/services/database-service.ts` | IndexedDB message storage |
| `src/renderer/components/ApprovalChatMessage.tsx` | Approval UI (tabs, risk, buttons) |
| `src/renderer/components/screens/ChatPage.tsx` | Chat-route approval handling |
| `src/renderer/components/screens/MessageDetailScreen.tsx` | Full-screen approval view |
| `src/renderer/components/screens/ApprovalPanel.tsx` | Full-screen security eval UI |
| `src/renderer/components/screens/CodeResponseApprovalPanel.tsx` | Full-screen code response UI |

---

## Flow 2: Chat App Agentic Flow (User -> AI -> MCP Tools -> Approve -> Continue)

```
User types message in Thread composer
    |
@assistant-ui/react runtime                        [thread.tsx]
    |
AIChatAdapter.run()                                [src/renderer/services/ai-chat-adapter.ts]
    |
checkConnectionRequirements()                      -> connection-detection-service.ts
    |-- MISSING CONNECTIONS -> ConnectionRequirementsMessage UI
    |-- ALL GOOD:
classifyQueryComplexity()
    |-- 'simple' -> streaming response (done)
    |-- 'web-search' -> handleWebSearch() -> Electron API
    |-- 'agentic':
handleWithAbilityCalling()                         [ai-chat-adapter.ts]
    | LOOP (max 10 iterations)
    |-- Stream AI response -> extract {"ability", "parameters"} JSON
    |-- For each ability:
    |     useMCPIntegration.executeAbilityCall()   [mcp-tool-integration.ts]
    |         useMcpClient.callTool()              [useMcpClient.ts]
    |         MCP Server executes tool
    |
    |   FOR run-code SPECIFICALLY:
    |       generateFingerprint(explanation)        [pending-tool-calls.ts]
    |       registerPendingCall('run-code', fingerprint)
    |       Promise.race([mcpClient.callTool(), pending.promise])
    |           -> approval arrives via Flow 1 mechanism
    |           -> resolvePendingCall() resolves the race
    |
    |-- Store results in runCodeResultContext       [run-code-result-context.ts]
    |-- Summarize if > 25k tokens
    |-- Feed results back to AI
    |-- Check isTaskComplete() -> break or continue
    |
Final AI response yielded to Thread UI
```

### Files required for Flow 2

| File | Role |
|------|------|
| `src/renderer/components/assistant-ui/thread.tsx` | Main chat UI (Thread primitives, sidebar, composer) |
| `src/renderer/components/AssistantUIChat.tsx` | Chat wrapper, provider selection, runtime setup |
| `src/renderer/components/AssistantUIChatContent.tsx` | Inner chat content (nearly identical to AssistantUIChat) |
| `src/renderer/hooks/useMCPEnhancedChat.ts` | MCP state management (abilities, executions, agentic mode) |
| `src/renderer/services/ai-chat-adapter.ts` | Core engine -- query classification, agentic loop, connection checks |
| `src/renderer/services/mcp-tool-integration.ts` | Tool execution, fingerprint race, provider format conversion |
| `src/renderer/hooks/useMcpClient.ts` | Low-level MCP connection (SSE transport, auth, reconnect) |
| `src/renderer/services/pending-tool-calls.ts` | Fingerprint + pending call race mechanism |
| `src/renderer/services/context-service.ts` | System prompt builder, planning tokens |
| `src/renderer/services/run-code-result-context.ts` | Result storage + smart summarization |
| `src/renderer/services/connection-detection-service.ts` | AI-powered connection requirement analysis |
| `src/renderer/services/tool-cache-service.ts` | Tool cache fallback when MCP disconnects |
| `src/renderer/services/ability-discovery.ts` | Fuzzy tool search |
| `src/renderer/services/ability-filesystem.ts` | Ability definitions storage |
| `src/renderer/components/assistant-ui/ConnectionRequirementsMessage.tsx` | Missing connections UI |
| `src/renderer/components/assistant-ui/ApprovalMessage.tsx` | Inline approval in chat |
| `src/renderer/components/assistant-ui/ThreadTracker.tsx` | Thread ID sync to currentThreadRef |
| `src/renderer/components/AgenticStatusIndicator.tsx` | Progress bar during agentic loop |
| `src/renderer/components/ApprovalChatMessage.tsx` | Shared with Flow 1 |
| `src/renderer/components/screens/ChatPage.tsx` | Shared with Flow 1 |

---

## Shared Bridge Between Flows

| File | Shared Role |
|------|-------------|
| `pending-tool-calls.ts` | Fingerprint system identifies if approval is from our chat vs external |
| `ChatPage.tsx` | Handles approve/reject for both flows, resolvePendingCall() bridges them |
| `ApprovalChatMessage.tsx` | Same approval UI renders in both contexts |
| `database-service.ts` | All messages stored in same IndexedDB |
| `useGlobalWebSocketListeners.ts` | Routes messages to correct flow based on isFromOurApp() |

---

## Dead Code -- Safe to Remove

### Unused Hooks (0 imports)

- `src/renderer/hooks/useAdditionalConnectedAccounts.ts`
- `src/renderer/hooks/useCustomIntegrations.ts`
- `src/renderer/hooks/useCurrentThread.ts` (replaced by currentThreadRef in ChatPage)
- `src/renderer/hooks/useConnectionRequirements.ts` (logic moved into useMCPEnhancedChat)

### Unused Components (0 imports)

- `src/renderer/components/CopilotKitChat.tsx` (legacy alternative chat)
- `src/renderer/components/TailwindTest.tsx` (test/demo artifact)
- `src/renderer/components/AgenticControls.tsx` (superseded by thread sidebar)
- `src/renderer/components/CodespaceSelector.tsx` (replaced by auto-connect)
- `src/renderer/components/EncryptionKeyManager.tsx` (legacy)
- `src/renderer/components/WebSocketKeyManager.tsx` (legacy)
- `src/renderer/components/UpdateNotification.tsx` (legacy)

### Deprecated IPC Handlers (in preload.ts)

- `approveMessage()` -- superseded by sendMessageResponse()
- `rejectMessage()` -- superseded by sendMessageResponse()

### Consolidation Opportunities

- `AssistantUIChat.tsx` and `AssistantUIChatContent.tsx` have nearly identical logic -- merge into one
- `MCPChatComponent.tsx` is a legacy fallback for raw MCP debug -- remove unless needed for debugging

## Code Efficiency & Anti-Bloat Rules

This codebase must stay lean. As sessions progress, there is a real risk of inflating the codebase with redundant code, dead abstractions, and unnecessary files. Follow these rules strictly:

- **No new files unless truly necessary.** Prefer editing existing files over creating new ones. Every new file adds surface area to read, maintain, and load into context.
- **Delete what you replace.** If you refactor or move logic, remove the old version immediately. Never leave behind dead code, commented-out blocks, or "just in case" copies.
- **No speculative abstractions.** Do not create helpers, utilities, wrappers, or shared modules for something used in only one place. Wait until there are 3+ concrete consumers before extracting.
- **No duplicated logic.** Before writing new code, search the codebase for existing implementations. Reuse what exists.
- **Keep functions and components small.** If a function grows past ~50 lines, consider whether it's doing too much. But don't split just to split -- only extract when there's a clear single responsibility.
- **Clean up the Dead Code list above.** When touching files near dead code listed in this doc, take the opportunity to delete it.
- **Minimize dependencies.** Do not add new npm packages if the functionality can be achieved with existing deps or a few lines of code.
- **Context window awareness.** When making changes, keep diffs minimal and focused. Avoid reformatting unchanged code, adding unnecessary comments, or touching files unrelated to the task.

## Key Architectural Concepts

- **Fingerprint system**: When chat calls `run-code`, it base64-encodes the explanation text as a fingerprint. When an approval arrives via WebSocket, `isFromOurApp()` checks if the fingerprint matches a pending call. This is how the app knows whether an approval came from its own agentic flow vs an external client.
- **Promise.race pattern**: For `run-code` tool calls, the app races the MCP server response against the approval resolution. Whichever completes first wins.
- **Auto-approve**: Main process can auto-approve based on risk_level (low/medium/high) for security evaluations and success-only/always/never for code responses, configured in settings.
- **Thread-scoped state**: Connection requirements are stored per-thread in localStorage with 1-hour expiry.
