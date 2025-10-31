import React, { useCallback, useEffect, useRef } from 'react'
import { useSSE } from '../hooks/useSSE'
import { ExecutorWebSocketClient } from '../../websocket-client-to-executor'
import { CodespaceData } from '../../services/SSEBackgroundService'

interface SSEWebSocketIntegrationProps {
  serverUrl: string
  executorClient: ExecutorWebSocketClient | null
}

export const SSEWebSocketIntegration: React.FC<SSEWebSocketIntegrationProps> = ({
  serverUrl,
  executorClient,
}) => {
  const executorClientRef = useRef(executorClient)

  // Update ref when prop changes
  useEffect(() => {
    executorClientRef.current = executorClient
  }, [executorClient])

  // Handle codespace online events from SSE
  const handleCodespaceOnline = useCallback((codespace: CodespaceData) => {
    console.log('🚀 SSE: Codespace online, attempting WebSocket connection:', codespace.name)
    
    if (executorClientRef.current) {
      // Attempt to connect to the codespace WebSocket
      executorClientRef.current.connectFromSSEEvent(codespace)
        .then(success => {
          if (success) {
            console.log('✅ Successfully connected to codespace WebSocket:', codespace.name)
          } else {
            console.log('⏸️ SSE connection attempt declined (staying with current connection):', codespace.name)
          }
        })
        .catch(error => {
          console.error('❌ Error connecting to codespace WebSocket:', error)
          // Could emit error event here for UI to handle
        })
    } else {
      console.warn('⚠️ No executor client available for SSE-triggered connection')
    }
  }, [])

  // Handle codespace offline events from SSE
  const handleCodespaceOffline = useCallback((codespace: CodespaceData) => {
    console.log('🔽 SSE: Codespace offline:', codespace.name)
    
    // If the current connection is to this codespace, we might want to disconnect
    // or attempt to reconnect to localhost/other codespaces
    if (executorClientRef.current) {
      const connectionInfo = executorClientRef.current.getConnectionInfo()
      if (connectionInfo.connected && 
          connectionInfo.target?.type === 'codespace' && 
          connectionInfo.target?.codespaceName === codespace.name) {
        console.log('🔌 Current codespace went offline, falling back to auto-discovery')
        
        // Trigger reconnection which will auto-discover available options
        executorClientRef.current.reconnect()
          .catch(error => {
            console.error('❌ Error during reconnection after codespace offline:', error)
          })
      }
    }
  }, [])

  // Initialize SSE connection with event handlers
  const { sseState, sseService } = useSSE(
    serverUrl,
    handleCodespaceOnline,
    handleCodespaceOffline
  )

  // Log SSE connection state changes for debugging
  useEffect(() => {
    if (sseState.lastEvent) {
      console.log('🔔 SSE Event last event')
    }
  }, [sseState.lastEvent])

  // This component doesn't render any UI - it's purely for integration
  // You could return a status indicator if needed
  return null
}

export default SSEWebSocketIntegration