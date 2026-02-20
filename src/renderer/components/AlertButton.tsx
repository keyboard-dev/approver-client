import { useEffect, useRef, useState } from 'react'
import bellIconUrl from '../../../assets/icon-bell.svg'
import type { InboxNotification } from '../hooks/useInbox'
import { useInbox } from '../hooks/useInbox'
import { GroupedProviderStatus, useOAuthProviders } from '../hooks/useOAuthProviders'
import {
    ExpiredProviderItem,
    GenericNotificationItem,
    UpdateAvailableItem,
    UpdateDownloadedItem,
    UpdateDownloadingItem,
} from './inbox'
import { ButtonDesigned } from './ui/ButtonDesigned'
import { DropdownMenuDesigned } from './ui/DropdownMenuDesigned'

const AlertButton = () => {
  const { getGroupedProviders, refreshAllExpiredProviders } = useOAuthProviders()
  const { notifications, unreadCount, addNotification, markAllAsRead } = useInbox()
  const [groupedProviders, setGroupedProviders] = useState<GroupedProviderStatus>(getGroupedProviders())
  const { expired } = groupedProviders

  // Track if we've attempted to auto-refresh expired providers
  const hasAttemptedRefresh = useRef(false)
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false)
  const prevExpiredRef = useRef<string[]>([])

  // Sync expired providers with grouped providers
  useEffect(() => {
    setGroupedProviders(getGroupedProviders())
  }, [getGroupedProviders])

  // Auto-refresh expired providers before showing them in notifications
  useEffect(() => {
    if (expired.length > 0 && !hasAttemptedRefresh.current && !isAutoRefreshing) {
      hasAttemptedRefresh.current = true
      setIsAutoRefreshing(true)

      // Attempt to refresh all expired providers silently
      refreshAllExpiredProviders()
        .then(() => {
          // Re-fetch providers after refresh attempt
          setGroupedProviders(getGroupedProviders())
        })
        .catch(() => {
          // Silent failure - just log to console
        })
        .finally(() => {
          setIsAutoRefreshing(false)
        })
    }
  }, [expired.length, isAutoRefreshing, refreshAllExpiredProviders, getGroupedProviders])

  // Reset the refresh attempt flag when all expired providers become authenticated
  useEffect(() => {
    if (expired.length === 0 && hasAttemptedRefresh.current) {
      hasAttemptedRefresh.current = false
    }
  }, [expired.length])

  // Sync expired providers to inbox notifications
  useEffect(() => {
    const currentExpiredIds = expired.map(p => p.providerId)
    const prevExpiredIds = prevExpiredRef.current

    // Add new expired providers to inbox
    for (const provider of expired) {
      if (!prevExpiredIds.includes(provider.providerId)) {
        addNotification({
          type: 'expired-provider',
          providerId: provider.providerId,
        })
      }
    }

    prevExpiredRef.current = currentExpiredIds
  }, [expired, addNotification])

  // Calculate total alert count (inbox notifications + any not yet synced)
  const alertCount = unreadCount

  // Render notification items based on type
  const renderNotificationItem = (notification: InboxNotification) => {
    switch (notification.type) {
      case 'update-available':
        return <UpdateAvailableItem key={notification.id} notification={notification} />
      case 'update-downloading':
        return <UpdateDownloadingItem key={notification.id} notification={notification} />
      case 'update-downloaded':
        return <UpdateDownloadedItem key={notification.id} notification={notification} />
      case 'expired-provider':
        return <ExpiredProviderItem key={notification.id} notification={notification} />
      case 'generic':
        return <GenericNotificationItem key={notification.id} notification={notification} />
      default:
        return null
    }
  }

  const items = [
    <div
      className="px-[1.25rem] py-[0.63rem]"
      key="inbox"
    >
      <span
        className="text-black text-[1rem] font-semibold"
      >
        inbox
        {' '}
      </span>
      <span className="text-[#737373] text-[0.88rem]">
        (
        {' '}
        {alertCount}
        {' '}
        unread
        )
      </span>
    </div>,
    // Render all notifications from the inbox
    ...notifications.map(notification => renderNotificationItem(notification)),
    // Show empty state if no notifications
    notifications.length === 0 && (
      <div
        className="px-[1.25rem] py-[1rem] border-t border-[#E5E5E5] text-center text-[#737373] text-sm"
        key="empty-state"
      >
        No notifications
      </div>
    ),
    // Mark all as read button (only show if there are unread notifications)
    alertCount > 0 && (
      <div
        className="px-[0.63rem] py-[0.5rem] border-t border-[#E5E5E5]"
        key="mark-all-read"
      >
        <button
          type="button"
          className="w-full text-center text-xs text-[#737373] hover:text-[#525252]"
          onClick={markAllAsRead}
        >
          Mark all as read
        </button>
      </div>
    ),
  ].filter(Boolean)

  return (
    <DropdownMenuDesigned
      dropdownClassName="w-[20.31rem]"
      position="bottom-left"
      trigger={(
        <ButtonDesigned
          className="px-[0.5rem] py-[0.25rem] rounded-full not-draggable"
          variant="secondary"
        >
          <img src={bellIconUrl} alt="alert" className="w-4 h-4" />
          {alertCount > 0 && (
            <div className="absolute top-0 right-0 px-[0.25rem] py-[0.06rem] bg-[#D23535] rounded-full text-[#F7F7F7] text-[0.63rem] flex items-center justify-center">
              {alertCount}
            </div>
          )}
        </ButtonDesigned>
      )}
      items={items}
    />
  )
}

export default AlertButton
