import Editor from '@monaco-editor/react'
import React, { useState } from 'react'

import { Message } from '../../../preload'

import blueCheckIconUrl from '../../../../assets/icon-check-blue.svg'
import checkIconUrl from '../../../../assets/icon-check.svg'
import clockIconUrl from '../../../../assets/icon-clock.svg'
import codeIconUrl from '../../../../assets/icon-code.svg'
import iconGearUrl from '../../../../assets/icon-gear.svg'
import thinkingIconUrl from '../../../../assets/icon-thinking.svg'
import greyXIconUrl from '../../../../assets/icon-x-grey.svg'
import xIconUrl from '../../../../assets/icon-x.svg'

interface ApprovalScreenProps {
  message: Message
  // todo reflect status of websocket and user authentication
  // websocket started
  // user is authenticated
  systemStatus: string
  onApprove: () => void
  onBack: () => void
  onOptionClick: () => void
  onReject: () => void
}

export const ApprovalScreen: React.FC<ApprovalScreenProps> = ({
  message,
  onApprove,
  onBack,
  onOptionClick,
  onReject,
}) => {
  const [activeTab, setActiveTab] = useState<'code' | 'explaination'>('explaination')
  const [edittedCode, setEdittedCode] = useState<string>(message.code || '')

  const {
    code,
    explaination,
    risk_level,
    status,
    timestamp,
  } = message

  let riskLevelTextColor, riskLevelBgColor
  switch (risk_level) {
    case 'low':
      riskLevelTextColor = '#7BB750'
      riskLevelBgColor = '#98C37926'
      break
    case 'medium':
      riskLevelTextColor = '#E9AA34'
      riskLevelBgColor = '#E5C07B26'
      break
    case 'high':
      riskLevelTextColor = '#E06C75'
      riskLevelBgColor = '#E06C7526'
      break
  }

  let statusIconUrl
  switch (status) {
    case 'pending':
      statusIconUrl = clockIconUrl
      break
    case 'approved':
      statusIconUrl = checkIconUrl
      break
    case 'rejected':
      statusIconUrl = xIconUrl
      break
  }

  const createdAt = new Date(timestamp).toLocaleString()

  return (
    <div
      className="flex flex-col w-full h-screen bg-transparent draggable rounded-[0.5rem] p-[0.63rem] pt-0 items-center text-[0.88rem] text-[#171717]"
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
        className="flex flex-col w-full grow min-h-0 bg-white rounded-[0.5rem] px-[0.63rem] py-[0.75rem] not-draggable gap-[0.63rem] items-start"
      >
        <button
          onClick={onBack}
          className="py-[0.31rem] mt-[-0.31rem] px-[0.31rem] text-[#737373]"
        >
          &lt; All requests
        </button>

        <div
          className="text-[1.25rem] font-bold"
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
                    backgroundColor: riskLevelBgColor,
                  }}
                >
                  {risk_level}
                </div>
              </div>
            )}

          {status
            && (
              <div>
                <div
                  className="text-[#737373]"
                >
                  Status
                </div>
                <div
                  className="flex items-center gap-[0.25rem] capitalize"
                >
                  <img src={statusIconUrl} alt="Status" className="w-[0.75rem] h-[0.75rem] m-[0.19rem]" />
                  {status}
                </div>
              </div>
            )}

          <div>
            <div
              className="text-[#737373]"
            >
              Created
            </div>
            <div>
              {createdAt}
            </div>
          </div>
        </div>

        <div
          className="flex w-full border border-[#E5E5E5] rounded-[0.38rem] bg-[#F3F3F3] p-[0.25rem] text-[#737373] font-semibold"
        >
          <button
            onClick={() => setActiveTab('explaination')}
            className="grow basis-0 flex items-center justify-center py-[0.5rem] rounded-[0.25rem] gap-[0.31rem] border-none outline-none"
            style={
              activeTab === 'explaination'
                ? {
                    backgroundColor: 'white',
                  }
                : {}
            }
          >
            <img src={thinkingIconUrl} alt="thinking" className="w-[1rem] h-[1rem] m-[0.19rem]" />
            What the model wants to do
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className="grow basis-0 flex items-center justify-center py-[0.5rem] rounded-[0.25rem] gap-[0.31rem] border-none outline-none"
            style={
              activeTab === 'code'
                ? {
                    backgroundColor: 'white',
                  }
                : {}
            }
          >
            <img src={codeIconUrl} alt="code" className="w-[1rem] h-[1rem] m-[0.19rem]" />
            Generated script
          </button>
        </div>

        {activeTab === 'explaination' && (
          <div
            className="p-[0.75rem] border border-[#E5E5E5] rounded-[0.38rem] w-full grow overflow-auto min-h-0"
          >
            {explaination}
          </div>
        )}

        {activeTab === 'code' && code && (
          // <Prism
          //   className="border border-[#E5E5E5] rounded-[0.38rem] w-full grow min-h-0"
          //   language="tsx"
          //   style={oneLight}
          //   customStyle={{
          //     backgroundColor: 'transparent',
          //     padding: '0.75rem',
          //     margin: 0,
          //     fontFamily: 'Fira Code, monospace',
          //   }}
          //   showLineNumbers
          //   lineNumberStyle={{
          //     minWidth: '2.5rem',
          //   }}
          //   wrapLongLines
          // >
          //   {code}
          // </Prism>
          <Editor
            // height="100%"
            defaultLanguage="typescript"
            defaultValue={edittedCode}
            onChange={value => setEdittedCode(value || '')}
            theme="light"
            options={{
              minimap: {
                enabled: false,
              },
              fontFamily: 'Fira Code, monospace',
            }}
            className="border border-[#E5E5E5] rounded-[0.38rem] w-full grow min-h-0 overflow-auto"
            wrapperProps={{
              className: 'border border-[#E5E5E5] rounded-[0.38rem] w-full grow min-h-0 overflow-auto',
            }}
          />
        )}

        {status === 'pending' && (
          <div
            className="w-full flex flex-col gap-[0.5rem]"
          >
            <div
              className="w-full flex gap-[0.31rem]"
            >
              <button
                className="bg-[#F3F3F3] text-[#737373] grow basis-0 flex gap-[0.31rem] rounded-[0.25rem] p-[0.5rem] items-center justify-center border-none outline-none"
                onClick={onReject}
              >
                <img src={greyXIconUrl} alt="x" className="w-[0.75rem] h-[0.75rem]" />
                Reject
              </button>

              <button
                className="bg-[#5093B726] text-[#5093B7] grow basis-0 flex gap-[0.31rem] rounded-[0.25rem] p-[0.5rem] items-center justify-center border-none outline-none"
                onClick={onApprove}
              >
                <img src={blueCheckIconUrl} alt="check" className="w-[0.75rem] h-[0.75rem]" />
                Approve
              </button>
            </div>

            <div
              className="text-[#737373] text-[0.75rem] text-center w-full"
            >
              AI can make mistakes. Always review before approving.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
