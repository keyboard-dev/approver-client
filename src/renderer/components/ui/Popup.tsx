import React, { useEffect, useRef, useState } from 'react'
import { usePopup } from '../../hooks/usePopup'
import { useWindowDimensions } from '../../hooks/useWindowDimensions'
import { cn } from '../../lib/utils'

export const Popup: React.FC<{
  children: React.ReactNode
  onCancel?: () => void
  relative?: boolean
  className?: string
}> = ({
  children,
  onCancel,
  relative,
  className,
}) => {
  const { hidePopup } = usePopup()
  const { height } = useWindowDimensions()

  const [justify, setJustify] = useState<'justify-start' | 'justify-center' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    if (containerRef.current.clientHeight > height) {
      setJustify('justify-start')
    }
    else {
      setJustify('justify-center')
    }
  }, [containerRef, height])

  const containerClasses = relative
    ? 'absolute pt-[25%] justify-start w-full h-full'
    : `fixed bg-[rgba(0,0,0,0.4)] ${justify || 'justify-center'}`

  // Hide the popup until we've calculated the correct positioning
  const isPositioningCalculated = relative || justify !== null
  const visibilityClass = isPositioningCalculated ? 'opacity-100' : 'opacity-0'

  return (
    <div
      className={cn(
        'inset-0 backdrop-blur-[2px] flex flex-col items-center z-30 overflow-y-auto',
        containerClasses,
        className,
        visibilityClass,
      )}
      onClick={onCancel || hidePopup}
    >
      <div
        ref={containerRef}
        className="max-w-[24.63rem] flex flex-col p-[1.25rem] gap-[1.25rem] border border-[#E5E5E5] bg-[#FFF] rounded-[0.38rem] max-h-full overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
