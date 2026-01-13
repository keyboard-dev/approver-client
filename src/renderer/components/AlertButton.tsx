import { useEffect, useRef, useState } from 'react'
import bellIconUrl from '../../../assets/icon-bell.svg'
import { GroupedProviderStatus, useOAuthProviders } from '../hooks/useOAuthProviders'
import { getProviderIcon } from '../utils/providerUtils'
import { ButtonDesigned } from './ui/ButtonDesigned'
import { DropdownMenuDesigned } from './ui/DropdownMenuDesigned'

const AlertButton = () => {
  const { getGroupedProviders, reconnectProvider, refreshAllExpiredProviders } = useOAuthProviders()
  const [groupedProviders, setGroupedProviders] = useState<GroupedProviderStatus>(getGroupedProviders())
  const { expired } = groupedProviders

  // Track if we've attempted to auto-refresh expired providers
  const hasAttemptedRefresh = useRef(false)
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false)

  const alertCount = expired.length

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
        .catch((error) => {
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

  const handleExpireTokensForTesting = async () => {
    try {
      const count = await window.electronAPI.expireAllTokensForTesting()
      setGroupedProviders(getGroupedProviders())
    }
    catch (error) {
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
    <div
      className="px-[0.63rem] py-[0.75rem] border-t border-[#E5E5E5] hidden"
      key="test-expire-tokens"
    >
      <ButtonDesigned
        variant="secondary"
        className="w-full px-[0.63rem] py-[0.38rem] text-[0.75rem]"
        onClick={handleExpireTokensForTesting}
      >
        🧪 Expire All Tokens (Test)
      </ButtonDesigned>
    </div>,
    expired.map((provider) => {
      return (
        <div
          className="px-[0.63rem] py-[0.75rem] border-t border-[#E5E5E5]"
          key={`expired-provider-${provider.providerId}`}
        >
          <div
            className="border-l-2 border-[#D23535] px-[0.63rem]"
          >
            <div className="flex flex-col">
              <div
                className="flex justify-between items-center"
              >
                <div className="flex items-center gap-[0.63rem]">
                  <img src={getProviderIcon(undefined, provider.providerId)} alt={provider.providerId} className="w-4 h-4" />

                  <span className="text-black text-semibold">
                    Expired
                  </span>
                </div>

                <ButtonDesigned
                  variant="primary-black"
                  className="px-[0.63rem] py-[0.38rem] rounded-full"
                  onClick={() => {
                    reconnectProvider(provider.providerId)
                  }}
                >
                  Reconnect
                </ButtonDesigned>
              </div>

              <div>
                Your
                {' '}
                {provider.providerId}
                {' '}
                connector has expired.
              </div>
            </div>
          </div>

        </div>
      )
    }),
  ]

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
