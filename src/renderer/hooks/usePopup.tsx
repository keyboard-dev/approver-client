import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react'
import { Confirmation } from '../components/ui/Confirmation'

interface PopupConfig {
  cancelText?: string
  confirmText?: string
  description?: string
  disabled?: boolean
  onCancel?: () => void
  onConfirm?: () => void | Promise<void>
  relative?: boolean
  title?: string
}

interface PopupContextType {
  hidePopup: () => void
  isVisible: boolean
  showPopup: (config: PopupConfig) => void
}

const PopupContext = createContext<PopupContextType | undefined>(undefined)

export const PopupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [popupConfig, setPopupConfig] = useState<PopupConfig>({})

  const showPopup = useCallback((config: PopupConfig) => {
    setPopupConfig(config)
    setIsVisible(true)
  }, [])

  const hidePopup = useCallback(() => {
    setIsVisible(false)
    setPopupConfig({})
  }, [])

  // const handleConfirm = useCallback(async () => {
  //   if (popupConfig.onConfirm) {
  //     try {
  //       await popupConfig.onConfirm()
  //     }
  //     catch (error) {
  //       console.error('Error in popup confirm handler:', error)
  //     }
  //   }
  //   hidePopup()
  // }, [popupConfig.onConfirm, hidePopup])

  // const handleCancel = useCallback(() => {
  //   if (popupConfig.onCancel) {
  //     popupConfig.onCancel()
  //   }
  //   hidePopup()
  // }, [popupConfig.onCancel, hidePopup])

  const contextValue: PopupContextType = {
    showPopup,
    hidePopup,
    isVisible,
  }

  return (
    <PopupContext.Provider value={contextValue}>
      {children}
      {isVisible && (
        <Confirmation
          cancelText={popupConfig.cancelText}
          confirmText={popupConfig.confirmText}
          description={popupConfig.description}
          disabled={popupConfig.disabled}
          onCancel={popupConfig.onCancel}
          onConfirm={popupConfig.onConfirm}
          relative={popupConfig.relative}
          title={popupConfig.title}
        />
      )}
    </PopupContext.Provider>
  )
}

export const usePopup = () => {
  const context = useContext(PopupContext)
  if (context === undefined) {
    throw new Error('usePopup must be used within a PopupProvider')
  }

  return {
    showPopup: context.showPopup,
    hidePopup: context.hidePopup,
    isVisible: context.isVisible,
    // Convenience methods for common use cases
    showConfirmation: (config: Omit<PopupConfig, 'onCancel'> & { onConfirm: () => void | Promise<void> }) => {
      context.showPopup({
        ...config,
        onCancel: context.hidePopup,
      })
    },
    showAlert: (config: Omit<PopupConfig, 'onConfirm' | 'onCancel'>) => {
      context.showPopup({
        ...config,
        confirmText: config.confirmText || 'OK',
        onConfirm: context.hidePopup,
      })
    },
  }
}

// Type exports for convenience
export type { PopupConfig }
