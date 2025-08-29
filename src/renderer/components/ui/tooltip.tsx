import React, { useState } from 'react'
import informationIconUrl from '../../../../assets/icon-information.svg'
import { cn } from '../../lib/utils'

export const Tooltip: React.FC<{
  children?: React.ReactNode
  className?: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  tooltipClassName?: string
  tooltipText: string | React.ReactNode
}> = ({
  children,
  className,
  position = 'bottom',
  tooltipText,
  tooltipClassName,
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)

  const getTooltipStylePositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2'
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2'
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2'
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2'
      case 'top-left':
        return 'bottom-full right-0 mb-2'
      case 'top-right':
        return 'bottom-full left-0 mb-2'
      case 'bottom-left':
        return 'top-full right-0 mt-2'
      case 'bottom-right':
        return 'top-full left-0 mt-2'
      default:
        return 'top-full left-1/2 -translate-x-1/2 mt-2'
    }
  }

  return (
    <div
      className={cn(
        'relative w-[1rem] h-[1rem] p-[0.13rem] text-[#737373]',
        className,
      )}
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
      onClick={() => setIsTooltipVisible(!isTooltipVisible)}
    >
      {children || (
        <img
          src={informationIconUrl}
          alt="Information"
          className="w-full h-full"
        />
      )}

      {isTooltipVisible && (
        <div
          className={cn(
            'absolute bg-[#FFF] border border-[#E5E5E5] rounded-[0.38rem] p-[0.63rem] text-[#171717] z-10',
            getTooltipStylePositionClasses(),
            tooltipClassName,
          )}
        >
          {tooltipText}
        </div>
      )}
    </div>
  )
}
