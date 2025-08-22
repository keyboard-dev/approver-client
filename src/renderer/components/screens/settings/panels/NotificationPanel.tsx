import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Dropdown } from '../../../ui/Dropdown'
import Toggle from '../../../ui/Toggle'

export const NotificationPanel: React.FC = () => {
  const [showNotifications, setShowNotifications] = useState(false)
  const [showNotificationDisabled, setShowNotificationDisabled] = useState(true)
  const [showAutomaticCodeApproval, setShowAutomaticCodeApproval] = useState<'never' | 'low' | 'medium' | 'high'>('never')
  const [showAutomaticCodeApprovalDisabled, setShowAutomaticCodeApprovalDisabled] = useState(true)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const loadNotificationSetting = async () => {
    const value = await window.electronAPI.getShowNotifications()
    setShowNotifications(value)
    setShowNotificationDisabled(false)
  }
  const loadAutomaticCodeApprovalSetting = async () => {
    const value = await window.electronAPI.getAutomaticCodeApproval()
    setShowAutomaticCodeApproval(value)
    setShowAutomaticCodeApprovalDisabled(false)
  }

  const handleChangeNotificationSetting = useCallback(async (checked: boolean) => {
    // Execute change immediately
    await window.electronAPI.setShowNotifications(checked)
    setShowNotifications(checked) // Update local state immediately for better UX

    // Disable further changes
    setShowNotificationDisabled(true)

    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    // Re-enable after debounce period
    debounceTimeoutRef.current = setTimeout(async () => {
      await loadNotificationSetting() // Ensure consistency with backend
      setShowNotificationDisabled(false)
    }, 300)
  }, [])

  const handleChangeAutomaticCodeApprovalSetting = useCallback(async (option: 'never' | 'low' | 'medium' | 'high') => {
    // Execute change immediately
    await window.electronAPI.setAutomaticCodeApproval(option)
    setShowAutomaticCodeApproval(option) // Update local state immediately for better UX

    // Disable further changes
    setShowAutomaticCodeApprovalDisabled(true)

    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    // Re-enable after debounce period
    debounceTimeoutRef.current = setTimeout(async () => {
      await loadAutomaticCodeApprovalSetting() // Ensure consistency with backend
      setShowAutomaticCodeApprovalDisabled(false)
    }, 300)
  }, [])

  useEffect(() => {
    loadNotificationSetting()
    loadAutomaticCodeApprovalSetting()
  }, [])

  return (
    <>
      <div className="text-[1.13rem] px-[0.94rem]">
        Notifications
      </div>

      <div
        className="p-[0.94rem] border border-[#E5E5E5] rounded-[0.38rem] flex flex-col"
      >
        <div
          className="flex gap-[0.63rem]"
        >
          <div
            className="flex flex-col gap-[0.63rem]"
          >
            <div>
              Approval requests
            </div>
            <div
              className="text-[#737373]"
            >
              When Claude sends requests that require your approval to initiate (planning, code execution).
            </div>
          </div>
          <div
            className="px-[0.63rem] py-[0.38rem] border border-[#E5E5E5] rounded-[0.25rem] flex gap-[0.38rem] items-center whitespace-nowrap w-fit h-fit"
          >
            <div>
              Push on
            </div>
            <Toggle
              disabled={showNotificationDisabled}
              isChecked={showNotifications}
              onChange={handleChangeNotificationSetting}
            />
          </div>
        </div>

        <div
          className="w-full h-[0.06rem] my-[1rem] bg-[#E5E5E5]"
        />

        <div
          className="flex gap-[0.63rem]"
        >
          <div
            className="flex flex-col gap-[0.63rem]"
          >
            <div>
              Automatic code approvals
            </div>
            <div
              className="text-[#737373]"
            >
              Automatically approve script executions as they are sent to Keyboard.
            </div>
          </div>
          {/* <div
            className="px-[0.63rem] py-[0.38rem] border border-[#E5E5E5] rounded-[0.25rem] flex gap-[0.38rem] items-center whitespace-nowrap w-fit h-fit"
          > */}
          <Dropdown
            options={['never', 'low', 'medium', 'high']}
            value={showAutomaticCodeApproval}
            onChange={handleChangeAutomaticCodeApprovalSetting}
            disabled={showAutomaticCodeApprovalDisabled}
            keyPrefix="settings-notification-panel-automatic-code-approval"
          />
          {/* </div> */}
        </div>
      </div>
    </>
  )
}
