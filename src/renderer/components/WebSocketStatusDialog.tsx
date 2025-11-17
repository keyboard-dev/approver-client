import { AlertCircle, CheckCircle, Clock, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

interface ConnectionTarget {
  type: 'localhost' | 'codespace'
  url: string
  name?: string
  codespaceName?: string
}

interface ConnectionStatus {
  connected: boolean
  target?: ConnectionTarget
}

interface WebSocketStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const WebSocketStatusDialog: React.FC<WebSocketStatusDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [isReconnecting, setIsReconnecting] = useState(false)

  // Fetch connection status when dialog opens
  useEffect(() => {
    if (open) {
      fetchConnectionStatus()
    }
  }, [open])

  // Real-time WebSocket event listeners for automatic status updates
  useEffect(() => {
    if (!open) return // Only listen when dialog is open

    const handleWebSocketConnected = () => {
      fetchConnectionStatus()
    }

    const handleWebSocketDisconnected = () => {
      fetchConnectionStatus()
    }

    const handleWebSocketReconnecting = () => {
      // Update local state to show reconnecting without full fetch
      setIsReconnecting(true)
    }

    const handleWebSocketError = () => {
      fetchConnectionStatus()
    }

    // Set up event listeners
    window.electronAPI.onWebSocketConnected(handleWebSocketConnected)
    window.electronAPI.onWebSocketDisconnected(handleWebSocketDisconnected)
    window.electronAPI.onWebSocketReconnecting(handleWebSocketReconnecting)
    window.electronAPI.onWebSocketError(handleWebSocketError)

    // Cleanup listeners when dialog closes or component unmounts
    return () => {
      window.electronAPI.removeAllListeners('websocket-connected')
      window.electronAPI.removeAllListeners('websocket-disconnected')
      window.electronAPI.removeAllListeners('websocket-reconnecting')
      window.electronAPI.removeAllListeners('websocket-error')
    }
  }, [open]) // Re-setup listeners when dialog open state changes

  const fetchConnectionStatus = async () => {
    setIsLoading(true)
    try {
      const status = await window.electronAPI.getExecutorConnectionStatus()
      setConnectionStatus(status)
      setLastChecked(new Date())
      // Reset reconnecting state when we get fresh status
      setIsReconnecting(false)
    }
    catch (error) {
      console.error('Failed to fetch connection status:', error)
    }
    finally {
      setIsLoading(false)
    }
  }

  // const handleReconnect = async () => {
  //   setIsReconnecting(true)
  //   try {
  //     const success = await window.electronAPI.reconnectToExecutor()
  //     if (success) {
  //       // Refresh status after successful reconnection
  //       await fetchConnectionStatus()
  //     }
  //   }
  //   catch (error) {
  //     console.error('Failed to reconnect:', error)
  //   }
  //   finally {
  //     setIsReconnecting(false)
  //   }
  // }

  const handleConnectToBestCodespace = async () => {
    setIsReconnecting(true)
    try {
      const success = await window.electronAPI.connectToBestCodespace()
      if (success) {
        await fetchConnectionStatus()
      }
    }
    catch (error) {
      console.error('Failed to connect to best codespace:', error)
    }
    finally {
      setIsReconnecting(false)
    }
  }

  const getStatusIcon = () => {
    if (isLoading || isReconnecting) {
      return <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
    }

    if (!connectionStatus?.connected) {
      return <WifiOff className="h-5 w-5 text-red-500" />
    }

    return <CheckCircle className="h-5 w-5 text-green-500" />
  }

  const getStatusText = () => {
    if (isLoading) return 'Checking connection...'
    if (isReconnecting) return 'Reconnecting...'
    if (!connectionStatus?.connected) return 'Disconnected'
    return 'Connected'
  }

  const getStatusVariant = (): 'default' | 'destructive' => {
    if (!connectionStatus?.connected) return 'destructive'
    return 'default'
  }

  const formatTargetName = (target: ConnectionTarget) => {
    if (target.type === 'localhost') {
      return 'Local Development Server'
    }
    return target.name || target.codespaceName || 'GitHub Codespace'
  }

  const formatConnectionTime = () => {
    if (!lastChecked) return 'Unknown'
    return lastChecked.toLocaleString()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            WebSocket Connection Status
          </DialogTitle>
          <DialogDescription>
            Current status of the WebSocket connection to the code executor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 min-h-0 overflow-hidden">
          {/* Main Status Alert */}
          <Alert variant={getStatusVariant()}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getStatusIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <AlertTitle className="mb-1">{getStatusText()}</AlertTitle>
                <AlertDescription className="break-words">
                  {connectionStatus?.connected && connectionStatus.target
                    ? `Connected to ${formatTargetName(connectionStatus.target)}`
                    : 'No active WebSocket connection found'}
                </AlertDescription>
              </div>
            </div>
          </Alert>

          {/* Connection Details */}
          {connectionStatus && (
            <div className="space-y-3 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-gray-700">Status</div>
                  <Badge variant={connectionStatus.connected ? 'default' : 'destructive'} className="text-xs">
                    {connectionStatus.connected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>

                {connectionStatus.target && (
                  <div className="min-w-0">
                    <div className="font-medium text-gray-700">Type</div>
                    <Badge variant="outline" className="text-xs">
                      {connectionStatus.target.type === 'localhost' ? 'Local' : 'Codespace'}
                    </Badge>
                  </div>
                )}
              </div>

              {connectionStatus.target && (
                <div className="space-y-2 text-sm min-w-0">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-700">Target</div>
                    <div className="text-gray-600 break-words text-xs">
                      {formatTargetName(connectionStatus.target)}
                    </div>
                  </div>

                  {connectionStatus.target.codespaceName && (
                    <div className="min-w-0">
                      <div className="font-medium text-gray-700">Codespace Name</div>
                      <div className="text-gray-600 font-mono text-xs break-all">
                        {connectionStatus.target.codespaceName}
                      </div>
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="font-medium text-gray-700">URL</div>
                    <div className="text-gray-600 font-mono text-xs break-all">
                      {connectionStatus.target.url}
                    </div>
                  </div>
                </div>
              )}

              <div className="text-sm min-w-0">
                <div className="font-medium text-gray-700">Last Checked</div>
                <div className="text-gray-600 flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  <span className="break-words">{formatConnectionTime()}</span>
                </div>
              </div>
            </div>
          )}

          {/* No Connection Info Available */}
          {!connectionStatus && !isLoading && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Connection Information</AlertTitle>
              <AlertDescription>
                Unable to retrieve connection status. Click refresh to try again.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={fetchConnectionStatus}
            disabled={isLoading || isReconnecting}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {!connectionStatus?.connected && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {/* <Button
                variant="outline"
                onClick={handleReconnect}
                disabled={isLoading || isReconnecting}
                className="w-full sm:w-auto"
              >
                <Wifi className="h-4 w-4 mr-2" />
                Reconnect
              </Button> */}

              <Button
                onClick={handleConnectToBestCodespace}
                disabled={isLoading || isReconnecting}
                className="w-full sm:w-auto"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Connect to Codespace
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
