import type { ExportedMessageRepository, ExportedMessageRepositoryItem } from '@assistant-ui/react'
import { databaseService } from './database-service'

/** Ensure DB is ready before any operation */
async function ensureDB() {
  await databaseService.initialize()
}

/**
 * Creates a ThreadHistoryAdapter for a specific thread, backed by IndexedDB.
 * Passed to useLocalRuntime({ adapters: { history } }) to persist messages.
 */
export function createThreadHistoryAdapter(threadId: string) {
  return {
    async load(): Promise<ExportedMessageRepository & { unstable_resume?: boolean }> {
      await ensureDB()
      const records = await databaseService.loadChatMessages(threadId)
      const threads = await databaseService.listChatThreads()
      const thread = threads.find(t => t.remoteId === threadId)

      return {
        headId: thread?.headId ?? null,
        messages: records.map(r => ({
          message: deserializeMessage(r.message),
          parentId: r.parentId,
        })),
      }
    },

    async append(item: ExportedMessageRepositoryItem) {
      await ensureDB()
      // Ensure a thread record exists for headId tracking
      const threads = await databaseService.listChatThreads()
      if (!threads.find(t => t.remoteId === threadId)) {
        await databaseService.putChatThread({
          remoteId: threadId,
          status: 'regular',
          createdAt: Date.now(),
        })
      }
      await databaseService.appendChatMessage({
        threadId,
        messageId: item.message.id,
        parentId: item.parentId,
        message: serializeMessage(item.message),
      })
      await databaseService.saveChatHead(threadId, item.message.id)
    },
  }
}

// ── Serialization helpers ─────────────────────────────────────────────
// ThreadMessage contains Date objects which need special handling.

function serializeMessage(msg: any): any {
  return JSON.parse(JSON.stringify(msg, (_key, value) => {
    if (value instanceof Date) return { __date__: value.toISOString() }
    return value
  }))
}

function deserializeMessage(data: any): any {
  return JSON.parse(JSON.stringify(data), (_key, value) => {
    if (value && typeof value === 'object' && value.__date__) {
      return new Date(value.__date__)
    }
    return value
  })
}
