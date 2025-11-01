import React, { useEffect, useState } from 'react'
import { CheckCircle, WifiOff, Wifi, RefreshCw, AlertCircle, Clock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

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

  const fetchConnectionStatus = async () => {
    setIsLoading(true)
    try {
      const status = await window.electronAPI.getExecutorConnectionStatus()
      setConnectionStatus(status)
      setLastChecked(new Date())
    } catch (error) {
      console.error('Failed to fetch connection status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReconnect = async () => {
    setIsReconnecting(true)
    try {
      const success = await window.electronAPI.reconnectToExecutor()
      if (success) {
        // Refresh status after successful reconnection
        await fetchConnectionStatus()
      }
    } catch (error) {
      console.error('Failed to reconnect:', error)
    } finally {
      setIsReconnecting(false)
    }
  }

  const handleConnectToBestCodespace = async () => {
    setIsReconnecting(true)
    try {
      const success = await window.electronAPI.connectToBestCodespace()
      if (success) {
        await fetchConnectionStatus()
      }
    } catch (error) {
      console.error('Failed to connect to best codespace:', error)
    } finally {
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            WebSocket Connection Status
          </DialogTitle>
          <DialogDescription>
            Current status of the WebSocket connection to the code executor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Main Status Alert */}
          <Alert variant={getStatusVariant()}>
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div className="flex-1">
                <AlertTitle className="mb-1">{getStatusText()}</AlertTitle>
                <AlertDescription>
                  {connectionStatus?.connected && connectionStatus.target
                    ? `Connected to ${formatTargetName(connectionStatus.target)}`
                    : 'No active WebSocket connection found'}
                </AlertDescription>
              </div>
            </div>
          </Alert>

          {/* Connection Details */}
          {connectionStatus && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-700">Status</div>
                  <Badge variant={connectionStatus.connected ? 'default' : 'destructive'}>
                    {connectionStatus.connected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                
                {connectionStatus.target && (
                  <div>
                    <div className="font-medium text-gray-700">Type</div>
                    <Badge variant="outline">
                      {connectionStatus.target.type === 'localhost' ? 'Local' : 'Codespace'}
                    </Badge>
                  </div>
                )}
              </div>

              {connectionStatus.target && (
                <div className="space-y-2 text-sm">
                  <div>
                    <div className="font-medium text-gray-700">Target</div>
                    <div className="text-gray-600 break-all">
                      {formatTargetName(connectionStatus.target)}
                    </div>
                  </div>
                  
                  {connectionStatus.target.codespaceName && (
                    <div>
                      <div className="font-medium text-gray-700">Codespace Name</div>
                      <div className="text-gray-600 font-mono text-xs">
                        {connectionStatus.target.codespaceName}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <div className="font-medium text-gray-700">URL</div>
                    <div className="text-gray-600 font-mono text-xs break-all">
                      {connectionStatus.target.url}
                    </div>
                  </div>
                </div>
              )}

              <div className="text-sm">
                <div className="font-medium text-gray-700">Last Checked</div>
                <div className="text-gray-600 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatConnectionTime()}
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

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchConnectionStatus}
            disabled={isLoading || isReconnecting}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          {!connectionStatus?.connected && (
            <>
              <Button
                variant="outline"
                onClick={handleReconnect}
                disabled={isLoading || isReconnecting}
              >
                <Wifi className="h-4 w-4 mr-2" />
                Reconnect
              </Button>
              
              <Button
                onClick={handleConnectToBestCodespace}
                disabled={isLoading || isReconnecting}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Connect to Codespace
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}