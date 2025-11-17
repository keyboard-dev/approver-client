import React from 'react'
import { cn } from '../../lib/utils'

const ACTIVE_COLOR = '#5093B7'
const INACTIVE_COLOR = '#C5C5C5'
export const Toggle: React.FC<{
  className?: string
  disabled?: boolean
  isChecked: boolean
  onChange: (checked: boolean) => void
}> = ({
  className,
  disabled = false,
  isChecked,
  onChange,
}) => {
  return (
    <div
      className={cn(
        'border rounded-full w-fit h-fit',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className,
      )}
      style={{
        backgroundColor: isChecked ? ACTIVE_COLOR : INACTIVE_COLOR,
        borderColor: isChecked ? ACTIVE_COLOR : INACTIVE_COLOR,
        paddingLeft: isChecked ? '0.63rem' : '0',
        paddingRight: isChecked ? '0' : '0.63rem',
        transition: 'all 0.2s ease-in-out',
      }}
      onClick={() => {
        if (disabled) return
        onChange(!isChecked)
      }}
    >
      <div
        className="bg-[#FFF] rounded-full w-[0.81rem] h-[0.81rem]"
      />
    </div>
  )
}

export default Toggle
