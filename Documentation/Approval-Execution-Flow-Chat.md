# Approval & Execution Flow: Chat App Agentic Flow

## Overview

The user initiates a conversation in the built-in Chat UI. The AI classifies the query, and for complex tasks enters an agentic loop that calls MCP tools (connectors). When `run-code` is called, the fingerprint system registers a pending call and races the MCP response against an approval resolution. The approval UI appears inline in the chat.

---

## Full Flow Diagram

```
User types message in Thread composer
    |
@assistant-ui/react runtime                        [thread.tsx]
    |
AIChatAdapter.run()                                [src/renderer/services/ai-chat-adapter.ts]
    |
checkConnectionRequirements()                      -> connection-detection-service.ts
    |-- MISSING CONNECTIONS -> ConnectionRequirementsMessage UI
    |   User can "Connect" each service or "Continue anyway"
    |-- ALL GOOD:
classifyQueryComplexity()
    |-- 'simple'     -> streaming response (done)
    |-- 'web-search' -> handleWebSearch() -> Electron API
    |-- 'agentic'    -> handleWithAbilityCalling()
```

---

## Agentic Loop Detail

```
handleWithAbilityCalling()                         [ai-chat-adapter.ts]
    | LOOP (max 10 iterations)
    |
    |-- 1. Stream AI response
    |      AI returns JSON: {"ability": "tool-name", "parameters": {...}}
    |
    |-- 2. Extract ability calls from response
    |      foundAbilityCallsInResponse() parses JSON blocks
    |
    |-- 3. Execute each ability
    |      useMCPIntegration.executeAbilityCall()   [mcp-tool-integration.ts]
    |          |
    |          useMcpClient.callTool()              [useMcpClient.ts]
    |              | StreamableHTTPClientTransport w/ Bearer auth
    |              MCP Server executes tool
    |
    |-- 4. FOR run-code SPECIFICALLY:
    |      generateFingerprint(explanation)          [pending-tool-calls.ts]
    |      registerPendingCall('run-code', fingerprint)
    |      Promise.race([
    |          mcpClient.callTool(name, args),       // Normal MCP path
    |          pending.promise                        // Approval resolution path
    |      ])
    |      Winner resolves first
    |
    |-- 5. Store results
    |      runCodeResultContext.addResult()           [run-code-result-context.ts]
    |      Summarize if > 25k tokens (extract IDs, URLs, endpoints)
    |
    |-- 6. Feed results back to AI
    |      AI analyzes output, decides next step
    |
    |-- 7. Check completion
    |      isTaskComplete() -> break or continue loop
    |
Final AI response yielded to Thread UI
```

---

## Inline Approval (run-code)

When `run-code` triggers an approval request, it flows through the External Approval mechanism (see `Approval-Execution-Flow-External-MCP.md`) but is intercepted inline:

```
1. AI calls run-code ability
   |-- generateFingerprint(explanation_of_code)
   |-- registerPendingCall('run-code', fingerprint)
   |-- Waits via Promise.race

2. Main process receives approval request via WebSocket
   |-- Creates Message in IndexedDB
   |-- Sends 'websocket-message' IPC to renderer

3. useGlobalWebSocketListeners checks isFromOurApp(explanation)
   |-- Fingerprint MATCHES -> dispatch 'chat-approval-message' custom event
   |-- (Stays inline in chat, no navigation)

4. ChatPage catches event -> sets currentApprovalMessage
   |-- ApprovalChatMessage renders inline
   |-- Shows: code | explanation | risk level | output tabs
   |-- Approve / Reject buttons

5. User clicks Approve:
   ChatPage.handleApprove()
   |-- updateMessage(id, { status: 'approved' })     [database-service.ts]
   |-- sendMessageResponse(updatedMessage)            [preload.ts IPC]
   |-- Build CallToolResult from codespaceResponse
   |-- resolvePendingCall('run-code', result)          [pending-tool-calls.ts]

6. resolvePendingCall() resolves the Promise.race
   |-- AI receives result immediately
   |-- Agentic loop continues to next iteration
```

---

## Connection Requirements Check

Before the agentic loop starts, the adapter checks if the user has the necessary service connections:

```
checkConnectionRequirements()
    |
analyzeCredentialRequirements()                    [connection-detection-service.ts]
    | AI analyzes conversation history to detect needed services
    |
searchCombinedApps()                               (pipedream + composio search)
    | Finds matching connectors
    |
Check local providers
    |
Returns ConnectionCheckResult:
    { missingConnections[], reasoning, hasAllRequired }
    |
If missing:
    onMissingConnectionsDetected() callback
    -> useMCPEnhancedChat sets showConnectionPrompt = true
    -> ConnectionRequirementsMessage renders in chat
    -> User connects or dismisses
    -> Thread-scoped: stored in localStorage per threadId (1hr expiry)
```

---

## State Management: useMCPEnhancedChat

Central hook that manages all MCP/agentic state for the chat:

```
Key State:
- adapter: AIChatAdapter                    (AI provider interface)
- mcpEnabled / mcpConnected / mcpAbilities  (MCP connection status)
- isExecutingAbility / currentAbility       (current tool execution)
- executions: AbilityExecution[]            (all tool call history)
- isAgenticMode / agenticProgress           (step/totalSteps/currentAction)
- abilityMessages                           (intermediate execution messages)
- missingConnections                        (thread-scoped connection requirements)
- showConnectionPrompt / connectionReasoning (UI triggers)

Key Functions:
- setMCPEnabled()                           toggle MCP on/off
- setAgenticMode()                          enable agentic workflow
- addExecution(name, params)                register tool call
- updateExecution(id, updates)              track execution progress
- clearConnectionPrompt()                   dismiss missing connections UI
- skipConnectionCheckOnce()                 continue without connections
- getContinuationMessage()                  get AI message after dismissing prompt
- refreshMCPConnection()                    retry MCP connection
```

---

## Files Required

| File | Role |
|------|------|
| `src/renderer/components/assistant-ui/thread.tsx` | Main chat UI (Thread primitives, sidebar, composer) |
| `src/renderer/components/AssistantUIChat.tsx` | Chat wrapper, provider selection, runtime setup |
| `src/renderer/components/AssistantUIChatContent.tsx` | Inner chat content (near-duplicate of above -- consolidation candidate) |
| `src/renderer/hooks/useMCPEnhancedChat.ts` | MCP state management (abilities, executions, agentic mode) |
| `src/renderer/services/ai-chat-adapter.ts` | **Core engine** -- query classification, agentic loop, connection checks |
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
| `src/renderer/components/ApprovalChatMessage.tsx` | Shared with External flow |
| `src/renderer/components/screens/ChatPage.tsx` | Shared with External flow |

---

## Key Concepts

### Fingerprint System
When chat calls `run-code`, it base64-encodes the `explanation_of_code` as a fingerprint. When an approval arrives via WebSocket, `isFromOurApp()` checks if the fingerprint matches a registered pending call. This is how the app distinguishes its own agentic requests from external client requests.

### Promise.race Pattern
For `run-code` calls, the app races two promises:
1. `mcpClient.callTool()` -- the normal MCP server response
2. `pending.promise` -- resolved when an approval message arrives and matches the fingerprint

Whichever completes first wins. This allows the approval to short-circuit the MCP timeout.

### Provider Format Conversion
Tool definitions are converted per-provider:
- **OpenAI**: `{ type: "function", function: { name, arguments } }`
- **Anthropic**: `{ name, description, input_schema }`
- **Gemini**: `{ function_declarations: [{ name, description, parameters }] }`

### Thread-Scoped Connection State
Connection requirements are stored in localStorage keyed by `keyboard_thread_connection_requirements` + `currentThreadRef.threadId`. Auto-restored when switching threads. Expires after 1 hour.
