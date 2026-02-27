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

## Flow 2: Chat App Agentic Flow (User -> AI -> Native Tool Calling -> Approve -> Continue)

Uses **native Anthropic tool calling** — the model decides when and which tools to invoke via structured `tool_use` blocks in the SSE stream. No query classification, no JSON parsing from text, no completion heuristics.

### Architecture

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
    |
contextService.buildEnhancedSystemPrompt()         -> context-service.ts
    |
ProviderFormats.anthropic.convertTools()           -> mcp-tool-integration.ts
    | Converts MCP abilities -> Anthropic tool schema (name, description, input_schema)
    | Tools deduplicated by name in keyboard.ts before sending to API
    |
handleNativeToolCalling(messages, tools)           [ai-chat-adapter.ts]
    | LOOP (max 10 iterations)
    |
    |-- streamWithToolSupport()
    |     | IPC -> main.ts 'send-ai-message-stream'
    |     | main.ts -> KeyboardProvider.streamMessage()  [keyboard.ts]
    |     |   | Transforms tool_use/tool_result content blocks to text
    |     |   |   (API Zod schema only accepts string/text/image content)
    |     |   | Deduplicates tools by name
    |     |   | POST to keyboard.dev/api/ai/inference (SSE stream)
    |     |   | Parses SSE events:
    |     |   |   content_block_start (tool_use) -> StreamEvent tool_use_start
    |     |   |   content_block_delta (input_json_delta) -> StreamEvent tool_use_delta
    |     |   |   content_block_delta (text) -> yield text string
    |     |   |   content_block_stop -> StreamEvent tool_use_end
    |     |   |   message_delta (stop_reason) -> StreamEvent message_end
    |     |   |   error -> throw Error (surfaces to user)
    |     |
    |     | Renderer accumulates tool calls from stream events
    |     | Returns: { text, toolCalls: [{id, name, input}], stopReason }
    |
    |-- If stopReason != 'tool_use' -> stream final text to UI, DONE
    |
    |-- For each tool call:
    |     | Yield tool-call part to UI (in-progress, spinner shown)
    |     |
    |     useMCPIntegration.executeAbilityCall()   [mcp-tool-integration.ts]
    |         |
    |         |-- web-search: routed locally via webSearchTool
    |         |-- run-code: Promise.race with approval system
    |         |     generateFingerprint(explanation)        [pending-tool-calls.ts]
    |         |     registerPendingCall('run-code', fingerprint)
    |         |     Promise.race([
    |         |       mcpClient.callTool(),    -- MCP server path
    |         |       pending.promise,          -- approval resolution path
    |         |       timeoutPromise (10 min),  -- prevents infinite hang
    |         |     ])
    |         |-- all other tools: mcpClient.callTool() directly
    |         |
    |         |-- On connection error:
    |         |     Auto-reconnect via mcpClient.retry()
    |         |     Wait up to 15s, then retry tool call once
    |         |
    |     | Yield tool-call part to UI (completed, with result)
    |     |
    |     Store results in runCodeResultContext       [run-code-result-context.ts]
    |     Summarize if > 25k tokens
    |
    |-- Build conversation history:
    |     assistant message: [{type:'text', text}, {type:'tool_use', id, name, input}]
    |     user message: [{type:'tool_result', tool_use_id, content}]
    |     (Flattened to text strings in keyboard.ts for API compatibility)
    |
    |-- Continue loop (model decides if more tools needed)
    |
Final response yielded to Thread UI with all tool-call parts visible
```

### Chain of Thought UI

Tool calls are rendered in the assistant message via `MessagePrimitive.Parts`:
- `ToolFallback` component shows each tool call as a collapsible card
- **In-progress**: blue border, spinning LoaderCircle icon, "Running: toolName"
- **Completed**: green CheckIcon, "Used tool: toolName", expandable args + result
- **Error**: red styling with error message
- Tool parts accumulate across loop iterations — all visible in the final message

### MCP Connection Resilience

The MCP client (`useMcpClient.ts`) has 3 layers of auto-reconnect:
1. **Transport error/close handlers**: Exponential backoff reconnect (1s -> 2s -> 4s -> ... -> 15s max)
2. **Health check interval (15s)**: Background check that client/transport refs are alive
3. **Inline reconnect in callTool()**: If client is null or call fails with connection error, reconnect + retry once before throwing

### Debug Logging

All logs use `[NativeToolCall]` prefix for easy filtering in DevTools / terminal:
- `[NativeToolCall][IPC]` — main process IPC handler (stream start/end/error)
- `[NativeToolCall][Keyboard]` — keyboard provider (request details, SSE events, raw chunks)
- `[NativeToolCall][Stream]` — renderer stream handling (tool_use_start, message_end, completion summary)
- `[NativeToolCall][Loop]` — agentic loop (iteration, tool calls, results, conversation size)
- `[NativeToolCall][MCP]` — MCP reconnection attempts
- `[MCP]` — low-level MCP client connection state

### Files required for Flow 2

| File | Role |
|------|------|
| `src/renderer/components/assistant-ui/thread.tsx` | Main chat UI (Thread primitives, sidebar, composer) |
| `src/renderer/components/assistant-ui/tool-fallback.tsx` | Tool call UI (in-progress spinner, completed result, collapsible) |
| `src/renderer/components/AssistantUIChat.tsx` | Chat wrapper, provider selection, runtime setup |
| `src/renderer/components/AssistantUIChatContent.tsx` | Inner chat content (nearly identical to AssistantUIChat) |
| `src/renderer/hooks/useMCPEnhancedChat.ts` | MCP state management (abilities, executions, agentic mode) |
| `src/renderer/services/ai-chat-adapter.ts` | Core engine -- native tool calling loop, connection checks |
| `src/ai-provider/providers/keyboard.ts` | SSE stream parser, tool dedup, message transformation |
| `src/renderer/services/mcp-tool-integration.ts` | Tool execution, approval race, auto-reconnect retry, provider format conversion |
| `src/renderer/hooks/useMcpClient.ts` | Low-level MCP connection (StreamableHTTP, auth, 3-layer reconnect) |
| `src/renderer/services/pending-tool-calls.ts` | Fingerprint + pending call race mechanism |
| `src/renderer/services/context-service.ts` | System prompt builder, planning tokens |
| `src/renderer/services/run-code-result-context.ts` | Result storage + smart summarization |
| `src/renderer/services/connection-detection-service.ts` | AI-powered connection requirement analysis |
| `src/renderer/services/tool-cache-service.ts` | Tool cache fallback when MCP disconnects |
| `src/renderer/services/ability-discovery.ts` | Fuzzy tool search |
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

- **Native tool calling**: The AI model decides tool use via structured `tool_use` blocks in the SSE stream (Anthropic native format). No query classification or JSON extraction from text — the model natively returns tool calls when it wants to use a tool, and `stop_reason: 'tool_use'` signals the loop to execute tools and continue.
- **Message transformation**: The Keyboard API's Zod schema only accepts string or text/image content blocks. `keyboard.ts` transforms `tool_use` and `tool_result` content blocks into text representations before sending (e.g., `[Used tool: run-code({...})]`, `[Tool result for toolu_xxx]: content`).
- **Tool deduplication**: Tools are deduplicated by name in `keyboard.ts` before sending to the API (Anthropic requires unique tool names).
- **Chain of thought UI**: Tool calls are yielded as `tool-call` content parts to `@assistant-ui/react`, rendered by `ToolFallback` with in-progress/completed/error states. Parts accumulate across loop iterations so all steps are visible in the final message.
- **Fingerprint system**: When chat calls `run-code`, it base64-encodes the explanation text as a fingerprint. When an approval arrives via WebSocket, `isFromOurApp()` checks if the fingerprint matches a pending call. This is how the app knows whether an approval came from its own agentic flow vs an external client.
- **Promise.race pattern with timeout**: For `run-code` tool calls, the app races the MCP server response against the approval resolution and a 10-minute timeout. Whichever completes first wins. The timeout prevents infinite hangs if both paths fail.
- **3-layer MCP reconnect**: (1) Transport error/close handlers with exponential backoff, (2) 15s health check interval verifying client refs are alive, (3) Inline reconnect in `callTool()` — reconnects and retries once before throwing.
- **Auto-approve**: Main process can auto-approve based on risk_level (low/medium/high) for security evaluations and success-only/always/never for code responses, configured in settings.
- **Thread-scoped state**: Connection requirements are stored per-thread in localStorage with 1-hour expiry.
