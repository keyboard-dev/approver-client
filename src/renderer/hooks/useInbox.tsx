import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// =============================================================================
// Types
// =============================================================================

export interface UpdateAvailableNotification {
  type: 'update-available'
  id: string
  version: string
  releaseDate?: string
  releaseNotes?: string
  createdAt: number
  read: boolean
}

export interface UpdateDownloadingNotification {
  type: 'update-downloading'
  id: string
  version: string
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
  createdAt: number
  read: boolean
}

export interface UpdateDownloadedNotification {
  type: 'update-downloaded'
  id: string
  version: string
  releaseDate?: string
  releaseNotes?: string
  createdAt: number
  read: boolean
}

export interface ExpiredProviderNotification {
  type: 'expired-provider'
  id: string
  providerId: string
  createdAt: number
  read: boolean
}

export interface GenericNotification {
  type: 'generic'
  id: string
  title: string
  message: string
  variant?: 'info' | 'warning' | 'error' | 'success'
  action?: {
    label: string
    onClick: () => void
  }
  createdAt: number
  read: boolean
}

export type InboxNotification
  = | UpdateAvailableNotification
    | UpdateDownloadingNotification
    | UpdateDownloadedNotification
    | ExpiredProviderNotification
    | GenericNotification

// =============================================================================
// Context
// =============================================================================

interface InboxContextValue {
  notifications: InboxNotification[]
  unreadCount: number
  addNotification: (notification: Omit<InboxNotification, 'id' | 'createdAt' | 'read'>) => void
  removeNotification: (id: string) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
  // Update-specific helpers
  updateInfo: {
    available: UpdateAvailableNotification | null
    downloading: UpdateDownloadingNotification | null
    downloaded: UpdateDownloadedNotification | null
  }
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
}

const InboxContext = createContext<InboxContextValue | null>(null)

// =============================================================================
// Provider
// =============================================================================

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<InboxNotification[]>([])

  // Generate unique ID for notifications
  const generateId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // Add a notification
  const addNotification = useCallback((notification: Omit<InboxNotification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: InboxNotification = {
      ...notification,
      id: generateId(),
      createdAt: Date.now(),
      read: false,
    } as InboxNotification

    setNotifications((prev) => {
      // For update notifications, replace existing ones of the same type
      if (notification.type === 'update-available' || notification.type === 'update-downloading' || notification.type === 'update-downloaded') {
        // Remove any existing update notifications when a new update state arrives
        const filtered = prev.filter(n =>
          n.type !== 'update-available'
          && n.type !== 'update-downloading'
          && n.type !== 'update-downloaded',
        )
        return [newNotification, ...filtered]
      }

      // For expired providers, don't add duplicates
      if (notification.type === 'expired-provider') {
        const exists = prev.some(
          n => n.type === 'expired-provider' && n.providerId === notification.providerId,
        )
        if (exists) return prev
      }

      return [newNotification, ...prev]
    })
  }, [generateId])

  // Remove a notification
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  // Mark a notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n)),
    )
  }, [])

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length
  }, [notifications])

  // Get current update state
  const updateInfo = useMemo(() => {
    return {
      available: notifications.find(n => n.type === 'update-available') as UpdateAvailableNotification | null ?? null,
      downloading: notifications.find(n => n.type === 'update-downloading') as UpdateDownloadingNotification | null ?? null,
      downloaded: notifications.find(n => n.type === 'update-downloaded') as UpdateDownloadedNotification | null ?? null,
    }
  }, [notifications])

  // Download update helper
  const downloadUpdate = useCallback(async () => {
    try {
      await window.electronAPI.downloadUpdate()
    }
    catch (error) {
    }
  }, [])

  // Install update helper
  const installUpdate = useCallback(async () => {
    try {
      await window.electronAPI.quitAndInstall()
    }
    catch (error) {
    }
  }, [])

  // =============================================================================
  // Subscribe to IPC events for updates
  // =============================================================================

  useEffect(() => {
    // Listen for update available
    const handleUpdateAvailable = (_event: unknown, info: { version: string, releaseDate?: string, releaseNotes?: string }) => {
      // #region agent log
      console.log('[useInbox] Renderer received update-available event', info)
      fetch('http://127.0.0.1:7242/ingest/49b7cfe0-65b7-41f8-b323-46008774d481',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useInbox.tsx:197',message:'Renderer received update-available',data:{version:info.version,releaseDate:info.releaseDate,hasReleaseNotes:!!info.releaseNotes},timestamp:Date.now(),hypothesisId:'F,H'})}).catch(()=>{});
      // #endregion
      addNotification({
        type: 'update-available',
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      })
    }

    // Listen for download progress
    const handleDownloadProgress = (_event: unknown, progress: { percent: number, transferred: number, total: number, bytesPerSecond: number }) => {
      setNotifications((prev) => {
        // Find existing downloading notification
        const existingIdx = prev.findIndex(n => n.type === 'update-downloading')

        if (existingIdx >= 0) {
          // Update existing
          const updated = [...prev]
          updated[existingIdx] = {
            ...updated[existingIdx],
            percent: progress.percent,
            transferred: progress.transferred,
            total: progress.total,
            bytesPerSecond: progress.bytesPerSecond,
          } as UpdateDownloadingNotification
          return updated
        }
        else {
          // Find the update-available notification to get version info
          const availableNotif = prev.find(n => n.type === 'update-available') as UpdateAvailableNotification | undefined

          // Remove update-available and add downloading
          const filtered = prev.filter(n => n.type !== 'update-available')
          const newNotif: UpdateDownloadingNotification = {
            type: 'update-downloading',
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            version: availableNotif?.version ?? 'Unknown',
            percent: progress.percent,
            transferred: progress.transferred,
            total: progress.total,
            bytesPerSecond: progress.bytesPerSecond,
            createdAt: Date.now(),
            read: false,
          }
          return [newNotif, ...filtered]
        }
      })
    }

    // Listen for update downloaded
    const handleUpdateDownloaded = (_event: unknown, info: { version: string, releaseDate?: string, releaseNotes?: string }) => {
      addNotification({
        type: 'update-downloaded',
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      })
    }

    // Subscribe to events
    // #region agent log
    console.log('[useInbox] Registering update listeners')
    fetch('http://127.0.0.1:7242/ingest/49b7cfe0-65b7-41f8-b323-46008774d481',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useInbox.tsx:261',message:'Registering update listeners',data:{},timestamp:Date.now(),hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    window.electronAPI.onUpdateAvailable(handleUpdateAvailable)
    window.electronAPI.onDownloadProgress(handleDownloadProgress)
    window.electronAPI.onUpdateDownloaded(handleUpdateDownloaded)
    
    // Notify main process that renderer is ready to receive update notifications
    // #region agent log
    console.log('[useInbox] Notifying main process that renderer is ready')
    fetch('http://127.0.0.1:7242/ingest/49b7cfe0-65b7-41f8-b323-46008774d481',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useInbox.tsx:270',message:'Sending renderer-ready signal',data:{},timestamp:Date.now(),hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    window.electronAPI.notifyRendererReady()

    // Cleanup
    return () => {
      window.electronAPI.removeAllListeners('update-available')
      window.electronAPI.removeAllListeners('download-progress')
      window.electronAPI.removeAllListeners('update-downloaded')
    }
  }, [addNotification])

  const value: InboxContextValue = {
    notifications,
    unreadCount,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    updateInfo,
    downloadUpdate,
    installUpdate,
  }

  return (
    <InboxContext.Provider value={value}>
      {children}
    </InboxContext.Provider>
  )
}

// =============================================================================
// Hook
// =============================================================================

export function useInbox(): InboxContextValue {
  const context = useContext(InboxContext)
  if (!context) {
    throw new Error('useInbox must be used within an InboxProvider')
  }
  return context
}
