# Files Safe to Remove

These files have 0 imports across the entire codebase and can be deleted without breaking anything.

---

## Unused Hooks (4 files)

| File | Why it's dead |
|------|---------------|
| `src/renderer/hooks/useAdditionalConnectedAccounts.ts` | Never imported anywhere |
| `src/renderer/hooks/useCustomIntegrations.ts` | Never imported anywhere |
| `src/renderer/hooks/useCurrentThread.ts` | Replaced by `currentThreadRef` in ChatPage.tsx |
| `src/renderer/hooks/useConnectionRequirements.ts` | Logic moved into `useMCPEnhancedChat.ts` |

## Unused Components (7 files)

| File | Why it's dead |
|------|---------------|
| `src/renderer/components/CopilotKitChat.tsx` | Legacy alternative chat implementation, never rendered |
| `src/renderer/components/TailwindTest.tsx` | Test/demo artifact, never rendered |
| `src/renderer/components/AgenticControls.tsx` | Superseded by thread sidebar controls |
| `src/renderer/components/CodespaceSelector.tsx` | Replaced by auto-connect in `useWebSocketConnection` |
| `src/renderer/components/EncryptionKeyManager.tsx` | Legacy, never rendered |
| `src/renderer/components/WebSocketKeyManager.tsx` | Legacy, never rendered |
| `src/renderer/components/UpdateNotification.tsx` | Legacy, never rendered |

---

## Deprecated Code to Clean Up

These are not separate files but dead code inside existing files:

### preload.ts -- Deprecated IPC handlers

```typescript
// These two methods are marked @deprecated, superseded by sendMessageResponse()
approveMessage(messageId: string): Promise<void>
rejectMessage(messageId: string): Promise<void>
```

Remove once confirmed no legacy clients depend on them.

---

## Consolidation Candidates

Not dead code, but duplication that should be merged:

| Files | Issue | Recommendation |
|-------|-------|----------------|
| `AssistantUIChat.tsx` + `AssistantUIChatContent.tsx` | Nearly identical logic | Merge into a single component |
| `MCPChatComponent.tsx` | Legacy fallback for raw MCP debug (provider = 'mcp') | Remove unless you need a raw MCP debug interface |
