import React, { useCallback, useEffect, useRef, useState } from 'react'
import Toggle from '../../../ui/Toggle'

export const AdvancedPanel: React.FC = () => {
  const [fullCodeExecution, setFullCodeExecution] = useState(false)
  const [fullCodeExecutionDisabled, setFullCodeExecutionDisabled] = useState(true)
  const [executionPreference, setExecutionPreference] = useState<'github-codespace' | 'keyboard-environment'>('github-codespace')
  const [executionPreferenceDisabled, setExecutionPreferenceDisabled] = useState(true)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const executionPreferenceDebounceRef = useRef<NodeJS.Timeout | null>(null)

  const loadFullCodeExecutionSetting = async () => {
    const value = await window.electronAPI.getFullCodeExecution()
    setFullCodeExecution(value)
    setFullCodeExecutionDisabled(false)
  }

  const loadExecutionPreferenceSetting = async () => {
    const result = await window.electronAPI.getExecutionPreference()
    if (result.preference && !result.error) {
      setExecutionPreference(result.preference as 'github-codespace' | 'keyboard-environment')
    }
    setExecutionPreferenceDisabled(false)
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

  const handleChangeExecutionPreferenceSetting = useCallback(async (checked: boolean) => {
    const newPreference = checked ? 'keyboard-environment' : 'github-codespace'

    // Execute change immediately
    const result = await window.electronAPI.setExecutionPreference(newPreference)
    if (result.success) {
      setExecutionPreference(newPreference) // Update local state immediately for better UX
    }

    // Disable further changes
    setExecutionPreferenceDisabled(true)

    // Clear any existing timeout
    if (executionPreferenceDebounceRef.current) {
      clearTimeout(executionPreferenceDebounceRef.current)
    }

    // Re-enable after debounce period
    executionPreferenceDebounceRef.current = setTimeout(async () => {
      await loadExecutionPreferenceSetting() // Ensure consistency with backend
      setExecutionPreferenceDisabled(false)
    }, 300)
  }, [])

  useEffect(() => {
    loadFullCodeExecutionSetting()
    loadExecutionPreferenceSetting()
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
              Execution Environment
            </div>
            <div
              className="text-[#737373]"
            >
              Choose where code execution should run. GitHub Codespace uses your GitHub Codespace as an execution, while Keyboard Environment uses a managed keyboard environment for you.
            </div>
          </div>
          <div
            className="px-[0.63rem] py-[0.38rem] border border-[#E5E5E5] rounded-[0.25rem] flex gap-[0.38rem] items-center whitespace-nowrap w-fit h-fit"
          >
            <div>
              {executionPreference === 'keyboard-environment' ? 'Keyboard Environment' : 'GitHub Codespace'}
            </div>
            <Toggle
              disabled={executionPreferenceDisabled}
              isChecked={executionPreference === 'keyboard-environment'}
              onChange={handleChangeExecutionPreferenceSetting}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
