import React from 'react'
import iconGearUrl from '../../../../assets/icon-gear.svg'
import { Message } from '../../../preload'

interface ApprovalScreenProps {
  message: Message
  // todo reflect status of websocket and user authentication
  // websocket started
  // user is authenticated
  systemStatus: string
  onBack?: () => void
  onApprove?: (messageId: string) => void
  onReject?: (messageId: string) => void
  onOptionClick?: () => void
}

export const ApprovalScreen: React.FC<ApprovalScreenProps> = ({
  message,
  systemStatus,
  onBack,
  onApprove,
  onReject,
  onOptionClick,
}) => {
  const {
    risk_level,
    status,
    timestamp,
  } = message

  let riskLevelTextColor, riskLevelBgColor
  switch (risk_level) {
    case 'low':
      riskLevelTextColor = '#7BB750'
      riskLevelBgColor = '#98C379'
      break
    case 'medium':
      riskLevelTextColor = '#E9AA34'
      riskLevelBgColor = '#E5C07B'
      break
    case 'high':
      riskLevelTextColor = '#E06C75'
      riskLevelBgColor = '#E06C75'
      break
  }

  return (
    <div
      className="flex flex-col w-full min-h-screen bg-transparent draggable rounded-[0.5rem] p-[0.63rem] pt-0 items-center text-[0.88rem]"
    >
      <div className="flex w-full -h-[1.56rem] mx-[1.25rem] my-[0.5rem] justify-between">
        <div />
        <div
          className="px-[0.75rem] py-[0.25rem] rounded-full bg-[#BFBFBF] flex items-center gap-[0.63rem]"
        >
          <div
            className="w-[10px] h-[10px] rounded-full bg-[#7BB750]"
          />
          <div
            className="text-[#737373]"
          >
            All systems are
            {' '}
            <span className="text-[#7BB750] font-semibold">
              normal
            </span>
          </div>
        </div>
        <button
          onClick={onOptionClick}
          className="px-[0.5rem] py-[0.25rem] rounded-full bg-[#BFBFBF] not-draggable"
        >
          <img src={iconGearUrl} alt="Settings" className="w-4 h-4" />
        </button>
      </div>

      <div
        className="flex flex-col w-full flex-grow bg-white rounded-[0.5rem] px-[0.63rem] py-[0.75rem] not-draggable gap-[0.63rem] items-start"
      >
        <button
          onClick={onBack}
          className="py-[0.31rem] mt-[-0.31rem] px-[0.31rem] text-[#737373]"
        >
          &lt; All requests
        </button>

        <div
          className="text-[#171717] text-[1.25rem] font-bold"
        >
          Security evaluation request
        </div>

        <div
          className="rounded-[0.38rem] border border-[#E5E5E5] w-full px-[0.63rem] py-[0.44rem] flex justify-between"
        >
          {risk_level
            && (
              <div>
                <div
                  className="text-[#737373]"
                >
                  Risk level
                </div>
                <div
                  className="rounded-full px-[0.5rem] py-[0.25rem] w-fit capitalize"
                  style={{
                    color: riskLevelTextColor,
                    backgroundColor: `${riskLevelBgColor}26`,
                  }}
                >
                  {risk_level}
                </div>
              </div>
            )}

          <div>
            Status
          </div>
          <div>
            Created
          </div>
        </div>
      </div>
    </div>
  )
}
