import { useEffect, useState } from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { ConnectionStatus, useWebSocketConnection } from '../hooks/useWebSocketConnection'

interface ConnectionTarget {
  type: 'localhost' | 'codespace'
  url: string
  name?: string
  codespaceName?: string
}

interface StatusDisplayProps {
  onClick?: () => void
}

const StatusDisplay = ({ onClick }: StatusDisplayProps) => {
  const { authStatus, isSkippingAuth } = useAuth()
  const { connectionStatus } = useWebSocketConnection(authStatus, isSkippingAuth)
  const [connectionTarget, setConnectionTarget] = useState<ConnectionTarget | null>(null)

  // Fetch current connection details
  useEffect(() => {
    const fetchConnectionInfo = async () => {
      try {
        const status = await window.electronAPI.getExecutorConnectionStatus()
        setConnectionTarget(status.target || null)
      }
      catch (error) {
        console.error('Failed to fetch connection info:', error)
      }
    }

    if (authStatus.authenticated || isSkippingAuth) {
      fetchConnectionInfo()
    }
  }, [authStatus.authenticated, isSkippingAuth, connectionStatus])

  // Update connection info on WebSocket events
  useEffect(() => {
    const handleWebSocketConnected = () => {
      fetchConnectionInfo()
    }

    const handleWebSocketDisconnected = () => {
      setConnectionTarget(null)
    }

    const fetchConnectionInfo = async () => {
      try {
        const status = await window.electronAPI.getExecutorConnectionStatus()
        setConnectionTarget(status.target || null)
      }
      catch (error) {
        console.error('Failed to fetch connection info:', error)
      }
    }

    // Set up event listeners for real-time updates
    window.electronAPI.onWebSocketConnected(handleWebSocketConnected)
    window.electronAPI.onWebSocketDisconnected(handleWebSocketDisconnected)

    return () => {
      window.electronAPI.removeAllListeners('websocket-connected')
      window.electronAPI.removeAllListeners('websocket-disconnected')
    }
  }, [])

  const getStatusColor = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected':
        return '#0B8A1C' // Green
      case 'connecting':
        return '#F59E0B' // Orange
      case 'disconnected':
      default:
        return '#D23535' // Red
    }
  }

  const getStatusIcon = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-4 w-4" />
      case 'connecting':
        return <RefreshCw className="h-4 w-4 animate-spin" />
      case 'disconnected':
      default:
        return <WifiOff className="h-4 w-4" />
    }
  }

  const getStatusText = (status: ConnectionStatus): { text: string, coloredText: string } => {
    switch (status) {
      case 'connected':
        return {
          text: 'Connected to',
          coloredText: connectionTarget ? getTargetDisplayName(connectionTarget) : 'executor',
        }
      case 'connecting':
        return {
          text: 'Connecting to',
          coloredText: 'executor...',
        }
      case 'disconnected':
      default:
        return {
          text: 'WebSocket is',
          coloredText: 'disconnected',
        }
    }
  }

  const getTargetDisplayName = (target: ConnectionTarget): string => {
    if (target.type === 'localhost') {
      return 'localhost'
    }
    return target.codespaceName || target.name || 'codespace'
  }

  const statusColor = getStatusColor(connectionStatus)
  const { text, coloredText } = getStatusText(connectionStatus)

  return (
    <div
      className="px-[0.75rem] py-[0.25rem] rounded-full bg-[#EBEBEB] flex items-center gap-[0.63rem] cursor-pointer hover:bg-[#E0E0E0] transition-colors not-draggable"
      onClick={onClick}
      title="Click to view WebSocket connection details"
    >
      <div
        className="w-[10px] h-[10px] rounded-full flex-shrink-0"
        style={{ backgroundColor: statusColor }}
      />

      <div className="flex items-center gap-[0.25rem] min-w-0">
        <div style={{ color: statusColor }} className="flex-shrink-0">
          {getStatusIcon(connectionStatus)}
        </div>

        <div className="text-[#737373]">
          {text}
          {' '}
          <span
            className="font-semibold"
            style={{ color: statusColor }}
          >
            {coloredText}
          </span>
        </div>
      </div>
    </div>
  )
}

export default StatusDisplay
