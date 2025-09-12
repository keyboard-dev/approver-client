import { useEffect, useRef, useState } from 'react'
import downArrowIconUrl from '../../../../assets/icon-arrow-down.svg'
import { cn } from '../../lib/utils'

export const Dropdown = <T extends string>({
  className,
  disabled = false,
  keyPrefix = '',
  onChange,
  options,
  value,
}: {
  className?: string
  disabled?: boolean
  keyPrefix?: string
  onChange: (value: T) => void
  options: readonly T[]
  value: T
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [minWidth, setMinWidth] = useState<number | 'auto'>(0)
  const dropdownRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Create a temporary button element with the same classes as the actual dropdown
    const tempElement = document.createElement('button')
    tempElement.className = 'relative border border-[#E5E5E5] rounded-[0.25rem] px-[0.63rem] py-[0.38rem] w-fit h-fit flex items-center justify-between gap-[0.38rem] capitalize font-inter'

    // Set additional styles to ensure consistent measurement
    tempElement.style.position = 'absolute'
    tempElement.style.visibility = 'hidden'
    tempElement.style.whiteSpace = 'nowrap'
    tempElement.style.zIndex = '-1000'

    // Create text span
    const textSpan = document.createElement('span')

    // Create image element
    const imgElement = document.createElement('img')
    imgElement.src = downArrowIconUrl
    imgElement.alt = 'down-arrow'

    tempElement.appendChild(textSpan)
    tempElement.appendChild(imgElement)
    document.body.appendChild(tempElement)

    const maxWidth = options.reduce((max, option) => {
      textSpan.textContent = option
      return Math.max(max, tempElement.offsetWidth)
    }, 0)

    document.body.removeChild(tempElement)
    setMinWidth(maxWidth)
  }, [options])

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
    <button
      ref={dropdownRef}
      className={cn(
        'relative border border-[#E5E5E5] rounded-[0.25rem] px-[0.63rem] py-[0.38rem] w-fit h-fit flex items-center justify-between gap-[0.38rem] capitalize',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        setIsOpen(!isOpen)
      }}
      style={{ minWidth }}
    >
      {value}
      <img
        src={downArrowIconUrl}
        alt="down-arrow"
        className={cn(
          'transition-transform duration-200 ease-out',
          isOpen ? 'rotate-180' : 'rotate-0',
        )}
      />

      <div
        className={cn(
          'absolute top-[calc(100%+2px)] left-0 w-fit bg-white border border-[#E5E5E5] rounded-[0.25rem] z-10',
          'transition-all duration-200 ease-out origin-top',
          isOpen && !disabled
            ? 'scale-y-100 opacity-100 translate-y-0'
            : 'scale-y-0 opacity-0 -translate-y-1 pointer-events-none',
        )}
      >
        {options.map(option => (
          <button
            key={`${keyPrefix}-dropdown-option-${option}`}
            onClick={() => {
              onChange(option)
              setIsOpen(false)
            }}
            className="w-full px-[0.63rem] py-[0.38rem] text-left hover:bg-gray-100 whitespace-nowrap capitalize"
          >
            {option}
          </button>
        ))}
      </div>
    </button>
  )
}
