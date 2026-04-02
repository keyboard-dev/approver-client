'use client'

import { ComponentPropsWithRef, forwardRef } from 'react'
import { Slottable } from '@radix-ui/react-slot'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../ui/tooltip'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

export type TooltipIconButtonProps = ComponentPropsWithRef<typeof Button> & {
  tooltip: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  tooltipClassName?: string
}

export const TooltipIconButton = forwardRef<
  HTMLButtonElement,
  TooltipIconButtonProps
>(({ children, tooltip, side = 'bottom', className, tooltipClassName, ...rest }, ref) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          {...rest}
          className={cn('aui-button-icon size-6 p-1', className)}
          ref={ref}
        >
          <Slottable>{children}</Slottable>
          <span className="aui-sr-only sr-only">{tooltip}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side} className={tooltipClassName}>{tooltip}</TooltipContent>
    </Tooltip>
  )
})

TooltipIconButton.displayName = 'TooltipIconButton'
