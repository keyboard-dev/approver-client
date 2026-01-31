import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/**
 * Pending Tool Call Registry
 *
 * This registry tracks pending tool calls that can be resolved by approvals.
 * It enables a race/fallback mechanism where:
 * 1. MCP HTTP call continues waiting for server response (normal path)
 * 2. When approval message arrives with results AND user approves → resolve immediately
 * 3. Whichever completes first wins - AI gets the result
 *
 * This makes the flow resilient - not dependent on perfect MCP server ↔ executor communication.
 */

type PendingResolver = {
  resolve: (result: CallToolResult) => void
  reject: (error: Error) => void
  toolName: string
  timestamp: number
}

const pendingCalls = new Map<string, PendingResolver>()

/**
 * Register a new pending tool call that can be resolved by an approval
 * Returns an ID and a promise that resolves when either:
 * - The MCP server responds (normal path)
 * - An approval message with results is processed (fallback path)
 */
export function registerPendingCall(toolName: string): {
  id: string
  promise: Promise<CallToolResult>
} {
  const id = `${toolName}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  let resolver: PendingResolver | undefined

  const promise = new Promise<CallToolResult>((resolve, reject) => {
    resolver = { resolve, reject, toolName, timestamp: Date.now() }
  })

  if (resolver) {
    pendingCalls.set(id, resolver)
  }

  return { id, promise }
}

/**
 * Resolve a pending call for a specific tool with the given result.
 * Finds the first (oldest) pending call matching the tool name and resolves it.
 *
 * @param toolName - The name of the tool to resolve (e.g., 'run-code')
 * @param result - The CallToolResult to resolve with
 * @returns true if a pending call was found and resolved, false otherwise
 */
export function resolvePendingCall(toolName: string, result: CallToolResult): boolean {
  for (const [id, resolver] of pendingCalls) {
    if (resolver.toolName === toolName) {
      resolver.resolve(result)
      pendingCalls.delete(id)
      return true
    }
  }

  return false
}

/**
 * Remove a pending call without resolving it.
 * Used when the MCP server responds normally and we no longer need the fallback.
 *
 * @param id - The ID of the pending call to remove
 */
export function removePendingCall(id: string): void {
  if (pendingCalls.has(id)) {
    pendingCalls.delete(id)
  }
}

/**
 * Check if there are any pending calls for a specific tool
 *
 * @param toolName - The name of the tool to check
 * @returns true if there are pending calls for this tool
 */
export function hasPendingCallsForTool(toolName: string): boolean {
  for (const [, resolver] of pendingCalls) {
    if (resolver.toolName === toolName) {
      return true
    }
  }
  return false
}

/**
 * Get the count of pending calls
 */
export function getPendingCallCount(): number {
  return pendingCalls.size
}

/**
 * Clean up stale pending calls (older than specified timeout)
 * This prevents memory leaks from orphaned promises
 *
 * @param timeoutMs - Maximum age in milliseconds (default: 15 minutes)
 */
export function cleanupStaleCalls(timeoutMs: number = 15 * 60 * 1000): void {
  const now = Date.now()
  const staleIds: string[] = []

  for (const [id, resolver] of pendingCalls) {
    if (now - resolver.timestamp > timeoutMs) {
      staleIds.push(id)
      resolver.reject(new Error(`Pending call ${id} timed out after ${timeoutMs}ms`))
    }
  }

  for (const id of staleIds) {
    pendingCalls.delete(id)
  }

  if (staleIds.length > 0) {
  }
}
