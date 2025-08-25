import React from 'react'
import { cn } from '../../lib/utils'

const PRIMARY_BUTTON_CLASS = 'text-[#5093B7] bg-[#E4EBEF] hover:bg-[#D5E0E6] active:bg-[#C5D4DD] disabled:bg-[#E4EBEF] disabled:text-[#5093B7]'
const SECONDARY_BUTTON_CLASS = 'text-[#737373] bg-[#F3F3F3] hover:bg-[#E6E6E6] active:bg-[#D9D9D9] disabled:bg-[#F3F3F3] disabled:text-[#D9D9D9]'
const DESTRUCTIVE_BUTTON_CLASS = 'text-[#D23535] hover:text-[#FFF] bg-[#F7F7F7] hover:bg-[#D23535] disabled:bg-[#F7F7F7] disabled:text-[#D9D9D9]'

export const ButtonDesigned: React.FC<{
  children: React.ReactNode
  className?: string
  disabled?: boolean
  hasBorder?: boolean
  onClick: () => void
  variant: 'primary' | 'secondary' | 'destructive'
}> = ({
  children,
  className,
  disabled,
  hasBorder,
  onClick,
  variant,
}) => {
  let variantClass = ''
  switch (variant) {
    case 'primary':
      variantClass = PRIMARY_BUTTON_CLASS
      break
    case 'secondary':
      variantClass = SECONDARY_BUTTON_CLASS
      break
    case 'destructive':
      variantClass = DESTRUCTIVE_BUTTON_CLASS
      break
  }
  const borderClass = hasBorder ? 'border border-[#CCC]' : 'border border-transparent'

  return (
    <button
      className={cn(
        'gap-[0.31rem] rounded-[0.25rem] p-[0.5rem] items-center justify-center disabled:cursor-not-allowed',
        variantClass,
        borderClass,
        className,
      )}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
