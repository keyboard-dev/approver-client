import React from 'react'
import { cn } from '../../../../lib/utils'
import { type ThemeMode, useTheme } from '../../../../hooks/useTheme'

// =============================================================================
// Theme Thumbnail
// =============================================================================

function ThemeThumbnail({ mode }: { mode: ThemeMode }) {
  if (mode === 'light') {
    return (
      <div className="w-full h-[86px] rounded-[8px] bg-white border border-[#e5e5e5] overflow-hidden flex flex-col">
        <div className="h-[20px] bg-[#f5f5f5] border-b border-[#e5e5e5] flex items-center px-2">
          <div className="w-[32px] h-[5px] rounded-full bg-[#d9d9d9]" />
        </div>
        <div className="flex-1 p-2 flex flex-col gap-[5px]">
          <div className="w-3/4 h-[4px] rounded-full bg-[#e5e5e5]" />
          <div className="w-1/2 h-[4px] rounded-full bg-[#e5e5e5]" />
          <div className="w-2/3 h-[4px] rounded-full bg-[#e5e5e5]" />
          <div className="w-[40px] h-[14px] rounded-[4px] bg-[#f0f0f0] border border-[#e5e5e5] mt-auto" />
        </div>
        <div className="flex justify-end px-2 pb-2">
          <div className="w-[10px] h-[10px] rounded-full bg-[#99A0FF]" />
        </div>
      </div>
    )
  }

  if (mode === 'dark') {
    return (
      <div className="w-full h-[86px] rounded-[8px] bg-[#1f1f1f] border border-[#2e2e2e] overflow-hidden flex flex-col">
        <div className="h-[20px] bg-[#2a2a2a] border-b border-[#333] flex items-center px-2">
          <div className="w-[32px] h-[5px] rounded-full bg-[#3a3a3a]" />
        </div>
        <div className="flex-1 p-2 flex flex-col gap-[5px]">
          <div className="w-3/4 h-[4px] rounded-full bg-[#333]" />
          <div className="w-1/2 h-[4px] rounded-full bg-[#333]" />
          <div className="w-2/3 h-[4px] rounded-full bg-[#333]" />
          <div className="w-[40px] h-[14px] rounded-[4px] bg-[#2a2a2a] border border-[#333] mt-auto" />
        </div>
        <div className="flex justify-end px-2 pb-2">
          <div className="w-[10px] h-[10px] rounded-full bg-[#99A0FF]" />
        </div>
      </div>
    )
  }

  // Auto: left half dark, right half light
  return (
    <div className="w-full h-[86px] rounded-[8px] overflow-hidden border border-[#d0d0d0] flex flex-col relative">
      {/* Background split */}
      <div className="absolute inset-0 flex">
        <div className="w-1/2 bg-[#1f1f1f]" />
        <div className="w-1/2 bg-white" />
      </div>
      {/* Top bar split */}
      <div className="relative h-[20px] flex border-b border-[#d0d0d0] z-10">
        <div className="w-1/2 bg-[#2a2a2a] flex items-center pl-2">
          <div className="w-[16px] h-[5px] rounded-full bg-[#3a3a3a]" />
        </div>
        <div className="w-1/2 bg-[#f5f5f5] flex items-center pr-2 justify-end">
          <div className="w-[16px] h-[5px] rounded-full bg-[#d9d9d9]" />
        </div>
      </div>
      {/* Content split */}
      <div className="relative flex-1 flex z-10">
        {/* Dark side */}
        <div className="w-1/2 p-2 flex flex-col gap-[5px]">
          <div className="w-full h-[4px] rounded-full bg-[#333]" />
          <div className="w-3/4 h-[4px] rounded-full bg-[#333]" />
        </div>
        {/* Light side */}
        <div className="w-1/2 p-2 flex flex-col gap-[5px]">
          <div className="w-full h-[4px] rounded-full bg-[#e5e5e5]" />
          <div className="w-3/4 h-[4px] rounded-full bg-[#e5e5e5]" />
        </div>
      </div>
      {/* Bottom dot */}
      <div className="relative flex justify-end px-2 pb-2 z-10">
        <div className="w-[10px] h-[10px] rounded-full bg-[#99A0FF]" />
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'auto', label: 'Auto' },
  { value: 'dark', label: 'Dark' },
]

export const AppearancePanel: React.FC = () => {
  const { theme, setTheme } = useTheme()

  return (
    <div className="relative grow shrink min-w-0 h-full p-[16px] flex flex-col gap-4">
      <div className="shrink-0">
        <div className="text-lg font-medium">Appearance</div>
        <div className="text-[#737373] dark:text-[#a9a9a9] text-sm">
          Customize how Keyboard looks on your device.
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-sm font-medium text-[#171717] dark:text-[#f5f5f5]">Color mode</div>
        <div className="flex gap-4">
          {OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className="flex flex-col gap-2 items-center"
            >
              <div
                className={cn(
                  'w-[120px] rounded-[10px] p-[3px] transition-all',
                  theme === value
                    ? 'ring-2 ring-[#99A0FF]'
                    : 'ring-1 ring-transparent hover:ring-[#d0d0d0] dark:hover:ring-[#3a3a3a]',
                )}
              >
                <ThemeThumbnail mode={value} />
              </div>
              <span
                className={cn(
                  'text-sm',
                  theme === value
                    ? 'text-[#171717] dark:text-[#f5f5f5] font-medium'
                    : 'text-[#737373] dark:text-[#a9a9a9]',
                )}
              >
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AppearancePanel
