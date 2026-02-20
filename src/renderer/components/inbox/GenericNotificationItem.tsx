import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react'
import React from 'react'
import type { GenericNotification } from '../../hooks/useInbox'
import { useInbox } from '../../hooks/useInbox'
import { ButtonDesigned } from '../ui/ButtonDesigned'

interface GenericNotificationItemProps {
  notification: GenericNotification
}

const variantConfig = {
  info: {
    borderColor: 'border-[#3B82F6]',
    Icon: Info,
    iconColor: 'text-[#3B82F6]',
  },
  warning: {
    borderColor: 'border-[#F59E0B]',
    Icon: AlertCircle,
    iconColor: 'text-[#F59E0B]',
  },
  error: {
    borderColor: 'border-[#D23535]',
    Icon: XCircle,
    iconColor: 'text-[#D23535]',
  },
  success: {
    borderColor: 'border-[#22C55E]',
    Icon: CheckCircle,
    iconColor: 'text-[#22C55E]',
  },
}

export const GenericNotificationItem: React.FC<GenericNotificationItemProps> = ({ notification }) => {
  const { removeNotification, markAsRead } = useInbox()
  const variant = notification.variant ?? 'info'
  const config = variantConfig[variant]
  const { Icon } = config

  const handleAction = () => {
    markAsRead(notification.id)
    notification.action?.onClick()
  }

  const handleDismiss = () => {
    removeNotification(notification.id)
  }

  return (
    <div className="px-[0.63rem] py-[0.75rem] border-t border-[#E5E5E5]">
      <div className={`border-l-2 ${config.borderColor} px-[0.63rem]`}>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-[0.63rem]">
              <Icon className={`w-4 h-4 ${config.iconColor}`} />
              <span className="text-black font-semibold">
                {notification.title}
              </span>
            </div>
            {notification.action
              ? (
                  <ButtonDesigned
                    variant="primary-black"
                    className="px-[0.63rem] py-[0.38rem] rounded-full text-xs"
                    onClick={handleAction}
                  >
                    {notification.action.label}
                  </ButtonDesigned>
                )
              : (
                  <button
                    type="button"
                    className="text-xs text-[#737373] hover:text-[#525252]"
                    onClick={handleDismiss}
                  >
                    Dismiss
                  </button>
                )}
          </div>
          <div className="text-sm text-[#525252]">
            {notification.message}
          </div>
        </div>
      </div>
    </div>
  )
}
