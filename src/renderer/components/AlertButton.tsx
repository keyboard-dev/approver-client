import { useEffect, useState } from 'react'
import bellIconUrl from '../../../assets/icon-bell.svg'
import { GroupedProviderStatus, useOAuthProviders } from '../hooks/useOAuthProviders'
import { getProviderIcon } from '../utils/providerUtils'
import { ButtonDesigned } from './ui/ButtonDesigned'
import { DropdownMenuDesigned } from './ui/DropdownMenuDesigned'

const AlertButton = () => {
  const { getGroupedProviders, refreshProvider } = useOAuthProviders()
  const [groupedProviders, setGroupedProviders] = useState<GroupedProviderStatus>(getGroupedProviders())
  const { expired } = groupedProviders

  const alertCount = expired.length

  useEffect(() => {
    setGroupedProviders(getGroupedProviders())
  }, [getGroupedProviders])

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
    expired.map((provider) => {
      return (
        <div
          className="px-[0.63rem] py-[0.75rem] border-t border-[#E5E5E5]"
          key={`expired-provider-${provider.providerId}`}
        >
          <div
            className="flex justify-between items-center border-l-2 border-[#D23535] px-[0.63rem]"
          >
            <div className="flex items-center gap-[0.63rem]">
              <img src={getProviderIcon(undefined, provider.providerId)} alt={provider.providerId} className="w-4 h-4" />

              {provider.providerId}
            </div>

            <ButtonDesigned
              variant="primary-black"
              className="px-[0.63rem] py-[0.38rem] rounded-full"
              onClick={() => {
                refreshProvider(provider.providerId)
              }}
            >
              Refresh
            </ButtonDesigned>
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
