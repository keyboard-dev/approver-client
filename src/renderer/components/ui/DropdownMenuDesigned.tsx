import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

type DropdownPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'

export const DropdownMenuDesigned = ({
  className,
  disabled = false,
  dropdownClassName,
  items,
  position = 'bottom-right',
  trigger,
}: {
  className?: string
  disabled?: boolean
  dropdownClassName?: string
  items: React.ReactNode[]
  position?: DropdownPosition
  trigger: React.ReactNode
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Clickaway listener to close dropdown when clicking outside
  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickAway)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickAway)
    }
  }, [isOpen])

  return (
    <div
      ref={dropdownRef}
      className={cn(
        'relative w-fit h-fit',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <div
        onClick={() => {
          if (disabled) return
          setIsOpen(!isOpen)
        }}
        className={cn('flex', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
      >
        {trigger}
      </div>

      <div
        className={cn(
          'absolute w-fit bg-white border border-[#E5E5E5] rounded-[0.25rem] z-10',
          'transition-all duration-200 ease-out',
          // Vertical positioning
          position.startsWith('bottom-') ? 'top-[calc(100%+2px)]' : 'bottom-[calc(100%+2px)]',
          // Horizontal positioning
          position.endsWith('-left') ? 'right-0' : 'left-0',
          // Animation origin based on position
          position === 'bottom-left' && 'origin-top-right',
          position === 'bottom-right' && 'origin-top-left',
          position === 'top-left' && 'origin-bottom-right',
          position === 'top-right' && 'origin-bottom-left',
          // Animation states
          isOpen && !disabled
            ? 'scale-y-100 opacity-100 translate-y-0'
            : 'scale-y-0 opacity-0 -translate-y-1 pointer-events-none',
          dropdownClassName,
        )}
      >
        {items.map(item => (
          item
        ))}
      </div>
    </div>
  )
}
