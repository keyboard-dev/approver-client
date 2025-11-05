import { useEffect, useState } from 'react'
import { GroupedProviderStatus, useOAuthProviders } from '../hooks/useOAuthProviders'

const StatusDisplay = () => {
  // OAuth providers hook is available for future use

  const { getGroupedProviders } = useOAuthProviders()

  const [groupedProviders, setGroupedProviders] = useState<GroupedProviderStatus>(getGroupedProviders())

  useEffect(() => {
    setGroupedProviders(getGroupedProviders())
  }, [getGroupedProviders])

  const { expired } = groupedProviders

  let statusColor = '#0B8A1C'
  let text = 'All systems are'
  let coloredText = 'normal'

  if (expired.length) {
    statusColor = '#D23535'
    text = 'You have expired connectors —'
    coloredText = 'click to review'
  }

  console.log('groupedProviders', groupedProviders)

  return (
    <div
      className="px-[0.75rem] py-[0.25rem] rounded-full bg-[#EBEBEB] flex items-center gap-[0.63rem]"
    >
      <div
        className={`w-[10px] h-[10px] rounded-full bg-[${statusColor}]`}
        style={{ backgroundColor: statusColor }}
      />
      <div
        className="text-[#737373]"
      >
        {text}
        {' '}
        <span className={`text-[${statusColor}] font-semibold`}>
          {coloredText}
        </span>
      </div>
    </div>
  )
}

export default StatusDisplay
