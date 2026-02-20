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
 *
 * Fingerprint System:
 * - When our app initiates a run-code call, we generate a fingerprint from the explanation
 * - When an approval arrives, we check if it matches a stored fingerprint
 * - This lets us distinguish our app's requests from external MCP clients (e.g., Claude web)
 */

type PendingResolver = {
  resolve: (result: CallToolResult) => void
  reject: (error: Error) => void
  toolName: string
  timestamp: number
  fingerprint?: string // Optional fingerprint to identify requests from our app
}

const pendingCalls = new Map<string, PendingResolver>()

// Separate map for fingerprints to enable quick lookup
const fingerprintIndex = new Map<string, string>() // fingerprint -> pendingCallId

/**
 * Generate a fingerprint from text (typically code explanation)
 * Uses: lowercase → trim → base64 encode
 */
export function generateFingerprint(text: string): string {
  const normalized = text.toLowerCase().trim()
  // Use TextEncoder + btoa for Unicode-safe base64 encoding
  const bytes = new TextEncoder().encode(normalized)
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('')
  const fingerprint = btoa(binary)
  return fingerprint
}

/**
 * Check if an approval message matches one of our pending calls
 * Returns the pending call ID if found, null otherwise
 */
export function findPendingCallByFingerprint(explanation: string): string | null {
  const fingerprint = generateFingerprint(explanation)
  const pendingCallId = fingerprintIndex.get(fingerprint) || null
  return pendingCallId
}

/**
 * Check if an approval is from our app (has a matching fingerprint)
 */
export function isFromOurApp(explanation: string): boolean {
  return findPendingCallByFingerprint(explanation) !== null
}

/**
 * Register a new pending tool call that can be resolved by an approval
 * Returns an ID and a promise that resolves when either:
 * - The MCP server responds (normal path)
 * - An approval message with results is processed (fallback path)
 *
 * @param toolName - The name of the tool being called
 * @param fingerprint - Optional fingerprint to identify this as our app's request
 */
export function registerPendingCall(toolName: string, fingerprint?: string): {
  id: string
  promise: Promise<CallToolResult>
} {
  const id = `${toolName}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  let resolver: PendingResolver | undefined

  const promise = new Promise<CallToolResult>((resolve, reject) => {
    resolver = { resolve, reject, toolName, timestamp: Date.now(), fingerprint }
  })

  if (resolver) {
    pendingCalls.set(id, resolver)
    // Index by fingerprint for quick lookup
    if (fingerprint) {
      fingerprintIndex.set(fingerprint, id)
    }
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
      // Clean up fingerprint index
      if (resolver.fingerprint) {
        fingerprintIndex.delete(resolver.fingerprint)
      }
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
  const resolver = pendingCalls.get(id)
  if (resolver) {
    // Clean up fingerprint index
    if (resolver.fingerprint) {
      fingerprintIndex.delete(resolver.fingerprint)
    }
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
      // Clean up fingerprint index
      if (resolver.fingerprint) {
        fingerprintIndex.delete(resolver.fingerprint)
      }
    }
  }

  for (const id of staleIds) {
    pendingCalls.delete(id)
  }
}
