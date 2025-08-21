import React, { useState } from 'react'
import Toggle from '../../../ui/Toggle'

export const NotificationPanel: React.FC = () => {
  const [approvalRequests, setApprovalRequests] = useState(true)
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
            className="px-[0.63rem] py-[0.38rem] border border-[#E5E5E5] rounded-[0.25rem] flex gap-[0.38]"
          >
            <div>
              Push on
            </div>
            <Toggle
              isChecked={approvalRequests}
              onChange={setApprovalRequests}
            />
          </div>
        </div>

        <div
          className="w-full h-[0.06rem] my-[1rem] bg-[#E5E5E5]"
        />
      </div>
    </>
  )
}
