import Editor from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import lazyTheme from 'monaco-themes/themes/Lazy.json'
import React, { useEffect, useState } from 'react'

import { Message } from '../../../types'

import blueCheckIconUrl from '../../../../assets/icon-check-blue.svg'
import checkIconUrl from '../../../../assets/icon-check.svg'
import clockIconUrl from '../../../../assets/icon-clock.svg'
import codeIconUrl from '../../../../assets/icon-code.svg'
import thinkingIconUrl from '../../../../assets/icon-thinking.svg'
import greyXIconUrl from '../../../../assets/icon-x-grey.svg'
import xIconUrl from '../../../../assets/icon-x.svg'
import { useWindowDimensions } from '../../hooks/useWindowDimensions'
import { ButtonDesigned } from '../ui/ButtonDesigned'

interface ApprovalScreenProps {
  message: Message
  // todo reflect status of websocket and user authentication
  // user is authenticated
  // websocket started
  systemStatus: string
  onApprove: () => void
  onBack: () => void
  onReject: () => void
}

export const ApprovalScreen: React.FC<ApprovalScreenProps> = ({
  message,
  onApprove,
  onBack,
  onReject,
}) => {
  const [activeTab, setActiveTab] = useState<'code' | 'explanation'>('explanation')
  const [isFontLoaded, setIsFontLoaded] = useState(false)

  const { isThin } = useWindowDimensions()

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    // Wait for Fira Code font to load before initializing Monaco Editor
    const checkFontLoaded = async () => {
      try {
        await document.fonts.load('400 16px "Fira Code"')
        // Small delay to ensure font is fully rendered
        timeoutId = setTimeout(() => setIsFontLoaded(true), 100)
      }
      catch (error) {
        console.warn('Font loading failed, proceeding with fallback:', error)
        setIsFontLoaded(true)
      }
    }

    checkFontLoaded()

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  const handleEditorWillMount = (monacoInstance: typeof monaco) => {
    // monacoInstance.editor.defineTheme('github', githubTheme as monaco.editor.IStandaloneThemeData)
    monacoInstance.editor.defineTheme('lazy', lazyTheme as monaco.editor.IStandaloneThemeData)
  }

  const {
    code,
    explanation,
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
    <>
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
        className="flex w-full gap-[0.31rem] border border-[#E5E5E5] rounded-[0.38rem] bg-[#F3F3F3] p-[0.25rem] text-[#737373] font-semibold flex-wrap"
        style={{
          flexDirection: isThin ? 'column' : 'row',
        }}
      >
        <button
          onClick={() => setActiveTab('explanation')}
          className={`grow basis-0 flex items-center justify-center py-[0.5rem] rounded-[0.25rem] gap-[0.31rem] border-none outline-none ${
            activeTab === 'explanation'
              ? 'bg-white'
              : 'hover:bg-[#E6E6E6]'
          }`}
        >
          <img src={thinkingIconUrl} alt="thinking" className="w-[1rem] h-[1rem] m-[0.19rem]" />
          What the model wants to do
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={`grow basis-0 flex items-center justify-center py-[0.5rem] rounded-[0.25rem] gap-[0.31rem] border-none outline-none ${
            activeTab === 'code'
              ? 'bg-white'
              : 'hover:bg-[#E6E6E6]'
          }`}
        >
          <img src={codeIconUrl} alt="code" className="w-[1rem] h-[1rem] m-[0.19rem]" />
          Generated script
        </button>
      </div>

      {activeTab === 'explanation' && (
        <div
          className="p-[0.75rem] border border-[#E5E5E5] rounded-[0.38rem] w-full grow overflow-auto min-h-0"
        >
          {explanation}
        </div>
      )}

      {activeTab === 'code' && code && (
        <div className="border border-[#E5E5E5] rounded-[0.38rem] w-full grow min-h-0">
          {isFontLoaded
            ? (
                <Editor
                  height="100%"
                  width="100%"
                  language="javascript"
                  value={message.code}
                  onChange={value => message.code = value}
                  theme="lazy"
                  beforeMount={handleEditorWillMount}
                  options={{
                    automaticLayout: true,
                    fontFamily: '"Fira Code", monospace',
                    fontLigatures: true,
                    fontSize: 14,
                    fontWeight: '400',
                    lineHeight: 1.5,
                    lineNumbersMinChars: 0,
                    minimap: { enabled: false },
                    wordWrap: 'on',
                  }}
                />
              )
            : (
                <div className="flex items-center justify-center h-full text-[#737373]">
                  Loading editor...
                </div>
              )}
        </div>
      )}

      {status === 'pending' && (
        <div
          className="w-full flex flex-col gap-[0.5rem]"
        >
          <div
            className="w-full flex gap-[0.31rem] flex-wrap"
            style={{
              flexDirection: isThin ? 'column' : 'row',
            }}
          >
            <ButtonDesigned
              variant="secondary"
              onClick={onReject}
              className="grow shrink basis-0 min-w-0 flex gap-[0.31rem] items-center justify-center"
            >
              <img src={greyXIconUrl} alt="x" className="w-[0.75rem] h-[0.75rem]" />
              Reject
            </ButtonDesigned>

            <ButtonDesigned
              variant="primary"
              onClick={onApprove}
              className="grow shrink basis-0 min-w-0 flex gap-[0.31rem] items-center justify-center"
            >
              <img src={blueCheckIconUrl} alt="check" className="w-[0.75rem] h-[0.75rem]" />
              Approve script execution
            </ButtonDesigned>
          </div>

          <div
            className="text-[#737373] text-[0.75rem] text-center w-full"
          >
            AI can make mistakes. Always review before approving.
          </div>
        </div>
      )}
    </>
  )
}
