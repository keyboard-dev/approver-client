import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GroupedProviderStatus, useOAuthProviders } from '../hooks/useOAuthProviders'

/*
 * REACT ROUTER MIGRATION NOTE:
 *
 * This component uses React Router's useNavigate() to navigate to the Settings > Connectors page
 * when users click on expired connector warnings.
 */

const StatusDisplay = () => {
  const navigate = useNavigate()
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

  const handleClick = () => {
    if (expired.length > 0) {
      navigate('/settings/Connectors')
    }
  }

  const isClickable = expired.length > 0

  return (
    <div
      className={`px-[0.75rem] py-[0.25rem] rounded-full bg-[#EBEBEB] flex items-center gap-[0.63rem] ${
        isClickable ? 'cursor-pointer hover:bg-[#E0E0E0] transition-colors not-draggable' : ''
      }`}
      onClick={handleClick}
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

        <span
          className={`text-[${statusColor}] font-semibold`}
          style={{ color: statusColor }}
        >
          {coloredText}
        </span>
      </div>
    </div>
  )
}

export default StatusDisplay
