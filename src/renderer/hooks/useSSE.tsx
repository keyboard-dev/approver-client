import { useCallback, useEffect, useRef, useState } from 'react'
import { SSEBackgroundService, CodespaceData } from '../../services/SSEBackgroundService'
import { useAuth } from './useAuth'

interface SSEState {
  connected: boolean
  reconnectAttempts: number
  lastEvent: string | null
  error: string | null
}

interface UseSSEReturn {
  sseState: SSEState
  sseService: SSEBackgroundService | null
  connect: () => void
  disconnect: () => void
}

export const useSSE = (
  serverUrl: string,
  onCodespaceOnline?: (codespace: CodespaceData) => void,
  onCodespaceOffline?: (codespace: CodespaceData) => void,
): UseSSEReturn => {
  const { authStatus } = useAuth()
  const [sseState, setSSEState] = useState<SSEState>({
    connected: false,
    reconnectAttempts: 0,
    lastEvent: null,
    error: null,
  })

  const sseServiceRef = useRef<SSEBackgroundService | null>(null)

  // Initialize SSE service
  useEffect(() => {
    if (!sseServiceRef.current) {
      sseServiceRef.current = new SSEBackgroundService({
        serverUrl,
        maxReconnectAttempts: 10,
        reconnectDelay: 3000,
        heartbeatInterval: 30000,
      })

      // Set up event listeners
      const service = sseServiceRef.current

      service.on('connected', () => {
        setSSEState(prev => ({
          ...prev,
          connected: true,
          error: null,
          lastEvent: 'connected',
        }))
      })

      service.on('disconnected', () => {
        setSSEState(prev => ({
          ...prev,
          connected: false,
          lastEvent: 'disconnected',
        }))
      })

      service.on('error', (error) => {
        setSSEState(prev => ({
          ...prev,
          error: error.message || 'SSE connection error',
          lastEvent: 'error',
        }))
      })

      service.on('codespace-online', (codespace: CodespaceData) => {
        setSSEState(prev => ({
          ...prev,
          lastEvent: `codespace-online: ${codespace.name}`,
        }))
        onCodespaceOnline?.(codespace)
      })

      service.on('codespace-offline', (codespace: CodespaceData) => {
        setSSEState(prev => ({
          ...prev,
          lastEvent: `codespace-offline: ${codespace.name}`,
        }))
        onCodespaceOffline?.(codespace)
      })

      service.on('max-reconnect-attempts-reached', () => {
        setSSEState(prev => ({
          ...prev,
          error: 'Maximum reconnection attempts reached',
          lastEvent: 'max-reconnect-attempts-reached',
        }))
      })
    }

    return () => {
      if (sseServiceRef.current) {
        sseServiceRef.current.disconnect()
        sseServiceRef.current.removeAllListeners()
      }
    }
  }, [serverUrl, onCodespaceOnline, onCodespaceOffline])

  // Handle auth changes
  useEffect(() => {
    if (sseServiceRef.current) {
      if (authStatus.authenticated && authStatus.user) {
        // Get OAuth token - this would need to be adapted based on your token storage
        // For now, we'll need to get the token from your OAuth system
        getOAuthToken().then((token) => {
          if (token && sseServiceRef.current) {
            sseServiceRef.current.setAuthToken(token)
          }
        }).catch((error) => {
        })
      }
      else {
        sseServiceRef.current.setAuthToken(null)
      }
    }
  }, [authStatus])

  // Update reconnect attempts periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (sseServiceRef.current) {
        const status = sseServiceRef.current.getConnectionStatus()
        setSSEState(prev => ({
          ...prev,
          connected: status.connected,
          reconnectAttempts: status.reconnectAttempts,
        }))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Helper function to get OAuth token from main process
  const getOAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      // Use the existing IPC call to get access token from main process
      const token = await window.electronAPI.getAccessToken()
      return token
    }
    catch (error) {
      return null
    }
  }, [])

  const connect = useCallback(() => {
    if (sseServiceRef.current) {
      sseServiceRef.current.connect()
    }
  }, [])

  const disconnect = useCallback(() => {
    if (sseServiceRef.current) {
      sseServiceRef.current.disconnect()
    }
  }, [])

  return {
    sseState,
    sseService: sseServiceRef.current,
    connect,
    disconnect,
  }
}
