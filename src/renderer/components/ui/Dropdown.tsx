/* eslint-disable react/react-in-jsx-scope */

import { useEffect, useState } from 'react'
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
  const [width, setWidth] = useState<number | 'auto'>(0)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) {
      setWidth('auto')
      return
    }

    context.font = '0.88rem Inter'

    const maxWidth = options.reduce((max, option) => {
      return Math.max(max, context.measureText(option).width)
    }, 0)

    setWidth(maxWidth + (0.63 * 16 * 2))
  }, [options])

  return (
    <button
      className={cn(
        'relative border border-[#E5E5E5] px-[0.63rem] py-[0.38rem] w-fit h-fit',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        setIsOpen(!isOpen)
      }}
      style={{ width }}
    >
      {value}

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 w-fit bg-white border border-[#E5E5E5] border-t-0 z-10">
          {options.map(option => (
            <button
              key={`${keyPrefix}-dropdown-option-${option}`}
              onClick={() => {
                onChange(option)
                setIsOpen(false)
              }}
              className="block w-fit px-[0.63rem] py-[0.38rem] text-left hover:bg-gray-100 whitespace-nowrap"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </button>
  )
}
