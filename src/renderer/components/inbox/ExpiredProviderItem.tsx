import React from 'react'
import type { ExpiredProviderNotification } from '../../hooks/useInbox'
import { useInbox } from '../../hooks/useInbox'
import { useOAuthProviders } from '../../hooks/useOAuthProviders'
import { getProviderIcon } from '../../utils/providerUtils'
import { ButtonDesigned } from '../ui/ButtonDesigned'

interface ExpiredProviderItemProps {
  notification: ExpiredProviderNotification
}

export const ExpiredProviderItem: React.FC<ExpiredProviderItemProps> = ({ notification }) => {
  const { reconnectProvider } = useOAuthProviders()
  const { removeNotification, markAsRead } = useInbox()

  const handleReconnect = () => {
    markAsRead(notification.id)
    reconnectProvider(notification.providerId)
    // Remove after initiating reconnect - the provider status will update
    removeNotification(notification.id)
  }

  return (
    <div className="px-[0.63rem] py-[0.75rem] border-t border-[#E5E5E5]">
      <div className="border-l-2 border-[#D23535] px-[0.63rem]">
        <div className="flex flex-col">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-[0.63rem]">
              <img
                src={getProviderIcon(undefined, notification.providerId)}
                alt={notification.providerId}
                className="w-4 h-4"
              />
              <span className="text-black font-semibold">
                Expired
              </span>
            </div>
            <ButtonDesigned
              variant="primary-black"
              className="px-[0.63rem] py-[0.38rem] rounded-full text-xs"
              onClick={handleReconnect}
            >
              Reconnect
            </ButtonDesigned>
          </div>
          <div className="text-sm text-[#525252] mt-1">
            Your
            {' '}
            <span className="font-medium">{notification.providerId}</span>
            {' '}
            connector has expired.
          </div>
        </div>
      </div>
    </div>
  )
}
