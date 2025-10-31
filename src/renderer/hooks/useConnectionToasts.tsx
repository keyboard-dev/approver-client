import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Loader2, CheckCircle, XCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react'

export interface ConnectionToastOptions {
  duration?: number
  dismissible?: boolean
}

export const useConnectionToasts = () => {
  const activeToastIds = useRef<{
    connecting?: string | number
    reconnecting?: string | number
  }>({})

  const dismissActiveToasts = useCallback(() => {
    if (activeToastIds.current.connecting) {
      toast.dismiss(activeToastIds.current.connecting)
      activeToastIds.current.connecting = undefined
    }
    if (activeToastIds.current.reconnecting) {
      toast.dismiss(activeToastIds.current.reconnecting)
      activeToastIds.current.reconnecting = undefined
    }
  }, [])

  const showConnectedToast = useCallback((target: string, options: ConnectionToastOptions = {}) => {
    dismissActiveToasts()
    
    return toast.success(
      <div className="flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <div>
          <div className="font-medium">Connected</div>
          <div className="text-sm text-gray-600">Connected to {target}</div>
        </div>
      </div>,
      {
        duration: options.duration ?? 3000,
        ...options,
      }
    )
  }, [dismissActiveToasts])

  const showReconnectingToast = useCallback((options: ConnectionToastOptions = {}) => {
    dismissActiveToasts()
    
    const toastId = toast.loading(
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <div>
          <div className="font-medium">Reconnecting</div>
          <div className="text-sm text-gray-600">Attempting to reconnect to WebSocket...</div>
        </div>
      </div>,
      {
        duration: Infinity, // Keep visible until manually dismissed
        ...options,
      }
    )
    
    activeToastIds.current.reconnecting = toastId
    return toastId
  }, [dismissActiveToasts])

  const showSwitchingToast = useCallback((from: string, to: string, options: ConnectionToastOptions = {}) => {
    dismissActiveToasts()
    
    const toastId = toast.loading(
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-orange-600" />
        <div>
          <div className="font-medium">Switching Connection</div>
          <div className="text-sm text-gray-600">From {from} to {to}...</div>
        </div>
      </div>,
      {
        duration: options.duration ?? 5000,
        ...options,
      }
    )
    
    activeToastIds.current.connecting = toastId
    return toastId
  }, [dismissActiveToasts])

  const showDisconnectedToast = useCallback((reason?: string, options: ConnectionToastOptions = {}) => {
    dismissActiveToasts()
    
    return toast.error(
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 text-red-600" />
        <div>
          <div className="font-medium">Disconnected</div>
          <div className="text-sm text-gray-600">
            {reason || 'WebSocket connection lost'}
          </div>
        </div>
      </div>,
      {
        duration: options.duration ?? 5000,
        ...options,
      }
    )
  }, [dismissActiveToasts])

  const showConnectionFailedToast = useCallback((target: string, error?: string, options: ConnectionToastOptions = {}) => {
    dismissActiveToasts()
    
    return toast.error(
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 text-red-600" />
        <div>
          <div className="font-medium">Connection Failed</div>
          <div className="text-sm text-gray-600">
            Failed to connect to {target}
            {error && (
              <div className="text-xs text-gray-500 mt-1">{error}</div>
            )}
          </div>
        </div>
      </div>,
      {
        duration: options.duration ?? 5000,
        ...options,
      }
    )
  }, [dismissActiveToasts])

  const showConnectingToast = useCallback((target: string, options: ConnectionToastOptions = {}) => {
    dismissActiveToasts()
    
    const toastId = toast.loading(
      <div className="flex items-center gap-2">
        <Wifi className="h-4 w-4 animate-pulse text-blue-600" />
        <div>
          <div className="font-medium">Connecting</div>
          <div className="text-sm text-gray-600">Connecting to {target}...</div>
        </div>
      </div>,
      {
        duration: options.duration ?? 10000,
        ...options,
      }
    )
    
    activeToastIds.current.connecting = toastId
    return toastId
  }, [dismissActiveToasts])

  return {
    showConnectedToast,
    showReconnectingToast,
    showSwitchingToast,
    showDisconnectedToast,
    showConnectionFailedToast,
    showConnectingToast,
    dismissActiveToasts,
  }
}