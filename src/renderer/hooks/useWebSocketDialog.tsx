import { useState, useCallback } from 'react'

export interface UseWebSocketDialogReturn {
  showDialog: boolean
  openDialog: () => void
  closeDialog: () => void
  toggleDialog: () => void
}

export const useWebSocketDialog = (): UseWebSocketDialogReturn => {
  const [showDialog, setShowDialog] = useState(false)

  const openDialog = useCallback(() => {
    setShowDialog(true)
  }, [])

  const closeDialog = useCallback(() => {
    setShowDialog(false)
  }, [])

  const toggleDialog = useCallback(() => {
    setShowDialog(prev => !prev)
  }, [])

  return {
    showDialog,
    openDialog,
    closeDialog,
    toggleDialog,
  }
}