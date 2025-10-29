import React, { useCallback, useEffect, useRef, useState } from 'react'
import Toggle from '../../../ui/Toggle'

export const AdvancedPanel: React.FC = () => {
  const [fullCodeExecution, setFullCodeExecution] = useState(false)
  const [fullCodeExecutionDisabled, setFullCodeExecutionDisabled] = useState(true)
  const [appVersion, setAppVersion] = useState<string>('Loading...')
  const [installDate, setInstallDate] = useState<Date | null>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const loadFullCodeExecutionSetting = async () => {
    const value = await window.electronAPI.getFullCodeExecution()
    setFullCodeExecution(value)
    setFullCodeExecutionDisabled(false)
  }

  const handleChangeFullCodeExecutionSetting = useCallback(async (checked: boolean) => {
    // Execute change immediately
    await window.electronAPI.setFullCodeExecution(checked)
    setFullCodeExecution(checked) // Update local state immediately for better UX

    // Disable further changes
    setFullCodeExecutionDisabled(true)

    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    // Re-enable after debounce period
    debounceTimeoutRef.current = setTimeout(async () => {
      await loadFullCodeExecutionSetting() // Ensure consistency with backend
      setFullCodeExecutionDisabled(false)
    }, 300)
  }, [])

  useEffect(() => {
    loadFullCodeExecutionSetting()

    // Load app version
    window.electronAPI.getAppVersion().then(version => {
      setAppVersion(version)
    }).catch(error => {
      console.error('Failed to get app version:', error)
      setAppVersion('Unknown')
    })

    // Load install date
    window.electronAPI.getVersionInstallDate().then(date => {
      setInstallDate(date)
    }).catch(error => {
      console.error('Failed to get install date:', error)
    })
  }, [])

  return (
    <div
      className="grow shrink min-w-0 h-full py-[0.5rem] flex flex-col gap-[0.63rem]"
    >
      <div className="text-[1.13rem] px-[0.94rem]">
        Advanced
      </div>

      <div
        className="p-[0.94rem] border border-[#E5E5E5] rounded-[0.38rem] flex flex-col"
      >
        <div
          className="flex gap-[0.63rem]"
        >
          <div
            className="flex flex-col gap-[0.63rem] shrink grow basis-0 min-w-0"
          >
            <div>
              Full code execution
            </div>
            <div
              className="text-[#737373]"
            >
              Enable full code execution mode. When enabled, creates a configuration file at ~/.keyboard-mcp/full-code-execution.
            </div>
          </div>
          <div
            className="px-[0.63rem] py-[0.38rem] border border-[#E5E5E5] rounded-[0.25rem] flex gap-[0.38rem] items-center whitespace-nowrap w-fit h-fit"
          >
            <div>
              {fullCodeExecution ? 'Enabled' : 'Disabled'}
            </div>
            <Toggle
              disabled={fullCodeExecutionDisabled}
              isChecked={fullCodeExecution}
              onChange={handleChangeFullCodeExecutionSetting}
            />
          </div>
        </div>
      </div>

      {/* Version Information */}
      <div
        className="p-[0.94rem] border border-[#E5E5E5] rounded-[0.38rem] flex flex-col gap-[0.63rem]"
      >
        <div className="font-semibold">
          Version Information
        </div>
        <div className="flex flex-col gap-[0.38rem]">
          <div className="flex justify-between items-center">
            <span className="text-[#737373]">Current Version:</span>
            <span className="font-mono">{appVersion}</span>
          </div>
          {installDate && (
            <div className="flex justify-between items-center">
              <span className="text-[#737373]">Installed:</span>
              <span className="text-sm">{installDate.toLocaleString()}</span>
            </div>
          )}
        </div>
        <div className="text-xs text-[#737373] mt-2">
          The app automatically checks for updates. You'll be notified when a new version is available.
        </div>
      </div>
    </div>
  )
}
