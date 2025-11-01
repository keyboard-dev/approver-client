import { useState, useCallback, useEffect, useRef } from 'react'
import { useConnectionToasts } from './useConnectionToasts'

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

export interface UseWebSocketConnectionReturn {
  connectionStatus: ConnectionStatus
  isConnectingToCodespace: boolean
  connectToBestCodespace: () => Promise<void>
  reconnectToExecutor: () => Promise<void>
}

export const useWebSocketConnection = (
  authStatus: { authenticated: boolean },
  isSkippingAuth: boolean
): UseWebSocketConnectionReturn => {
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [isConnectingToCodespace, setIsConnectingToCodespace] = useState(false)

  // Use refs to track state without causing re-renders
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Toast notifications for connection events
  const {
    showConnectingToast,
    showConnectedToast,
    showReconnectingToast,
    showSwitchingToast,
    showDisconnectedToast,
    showConnectionFailedToast,
  } = useConnectionToasts()

  // Debounced connection status update
  const updateConnectionStatus = useCallback((status: ConnectionStatus) => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
    }

    connectionTimeoutRef.current = setTimeout(() => {
      setConnectionStatus(status)
    }, 100) // Small debounce to prevent rapid flickering
  }, [])

  // Initialize connection status on app start
  useEffect(() => {
    const initializeConnectionStatus = async () => {
      try {
        const status = await window.electronAPI.getExecutorConnectionStatus()
        updateConnectionStatus(status.connected ? 'connected' : 'disconnected')
      } catch (error) {
        console.error('Failed to check initial connection status:', error)
      }
    }

    if (authStatus.authenticated || isSkippingAuth) {
      initializeConnectionStatus()
    }
  }, [authStatus.authenticated, isSkippingAuth, updateConnectionStatus])

  // WebSocket event handlers
  useEffect(() => {
    const handleWebSocketConnecting = (_event: unknown, data: { target: string, type: string }) => {
      showConnectingToast(data.target)
    }

    const handleWebSocketConnected = (_event: unknown, data: { target: string, type: string, codespaceName?: string }) => {
      showConnectedToast(data.target)
      updateConnectionStatus('connected')
    }

    const handleWebSocketDisconnected = (_event: unknown, data: { target: string, type: string }) => {
      showDisconnectedToast(`Disconnected from ${data.target}`)
      updateConnectionStatus('disconnected')
    }

    const handleWebSocketReconnecting = (_event: unknown, data: { attempt: number, maxAttempts: number }) => {
      showReconnectingToast()
    }

    const handleWebSocketSwitching = (_event: unknown, data: { from: string, to: string }) => {
      showSwitchingToast(data.from, data.to)
    }

    const handleWebSocketError = (_event: unknown, data: { target: string, type: string, error: string }) => {
      showConnectionFailedToast(data.target, data.error)
      updateConnectionStatus('disconnected')
    }

    // Set up WebSocket event listeners
    window.electronAPI.onWebSocketConnecting(handleWebSocketConnecting)
    window.electronAPI.onWebSocketConnected(handleWebSocketConnected)
    window.electronAPI.onWebSocketDisconnected(handleWebSocketDisconnected)
    window.electronAPI.onWebSocketReconnecting(handleWebSocketReconnecting)
    window.electronAPI.onWebSocketSwitching(handleWebSocketSwitching)
    window.electronAPI.onWebSocketError(handleWebSocketError)

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI.removeAllListeners('websocket-connecting')
      window.electronAPI.removeAllListeners('websocket-connected')
      window.electronAPI.removeAllListeners('websocket-disconnected')
      window.electronAPI.removeAllListeners('websocket-reconnecting')
      window.electronAPI.removeAllListeners('websocket-switching')
      window.electronAPI.removeAllListeners('websocket-error')

      // Clean up timeouts
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current)
      }
    }
  }, [
    updateConnectionStatus,
    showConnectingToast,
    showConnectedToast,
    showReconnectingToast,
    showSwitchingToast,
    showDisconnectedToast,
    showConnectionFailedToast,
  ])

  // Connect to best codespace
  const connectToBestCodespace = useCallback(async () => {
    if (!authStatus.authenticated) return

    setIsConnectingToCodespace(true)
    try {
      const success = await window.electronAPI.connectToBestCodespace()
      if (success) {
        updateConnectionStatus('connected')
      }
    } catch (error) {
      console.error('Failed to connect to best codespace:', error)
    } finally {
      setIsConnectingToCodespace(false)
    }
  }, [authStatus.authenticated, updateConnectionStatus])

  // Reconnect to executor
  const reconnectToExecutor = useCallback(async () => {
    try {
      const success = await window.electronAPI.reconnectToExecutor()
      return success
    } catch (error) {
      console.error('Failed to reconnect to executor:', error)
      return false
    }
  }, [])

  return {
    connectionStatus,
    isConnectingToCodespace,
    connectToBestCodespace,
    reconnectToExecutor,
  }
}