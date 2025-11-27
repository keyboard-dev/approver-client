import Editor from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import lazyTheme from 'monaco-themes/themes/Lazy.json'
import React, { useEffect, useState } from 'react'

import { Message } from '../../../types'

import redCautionIconUrl from '../../../../assets/icon-caution-red.svg'
import blueCheckIconUrl from '../../../../assets/icon-check-blue.svg'
import checkIconUrl from '../../../../assets/icon-check.svg'
import clockIconUrl from '../../../../assets/icon-clock.svg'
import codeIconUrl from '../../../../assets/icon-code.svg'
import informationIconUrl from '../../../../assets/icon-information.svg'
import thinkingIconUrl from '../../../../assets/icon-thinking.svg'
import greyXIconUrl from '../../../../assets/icon-x-grey.svg'
import xIconUrl from '../../../../assets/icon-x.svg'

import { useOAuthProviders } from '../../hooks/useOAuthProviders'
import { useWindowDimensions } from '../../hooks/useWindowDimensions'
import { getProviderIcon } from '../../utils/providerUtils'
import { ButtonDesigned } from '../ui/ButtonDesigned'
import { TooltipDesigned } from '../ui/TooltipDesigned'

interface ApprovalScreenProps {
  message: Message
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
  const {
    getProviderId,
    providers: oauthProviders,
    reconnectProvider,
    refreshProvider,
  } = useOAuthProviders()

  const [activeTab, setActiveTab] = useState<'code' | 'explanation'>('explanation')
  const [isFontLoaded, setIsFontLoaded] = useState(false)

  const { isThin } = useWindowDimensions()

  const { providers: providerNames = [] } = message

  useEffect(() => {
    providerNames.forEach((providerName) => {
      const providerId = getProviderId(providerName)
      if (!providerId) {
        return
      }
      const providerStatus = oauthProviders[providerId]
      if (!providerStatus || !providerStatus.expired) {
        return
      }
      refreshProvider(providerId)
    })
  }, [providerNames, oauthProviders, refreshProvider, getProviderId])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    // Wait for Fira Code font to load before initializing Monaco Editor
    const checkFontLoaded = async () => {
      try {
        await document.fonts.load('400 16px "Fira Code"')
        // Small delay to ensure font is fully rendered
        timeoutId = setTimeout(() => setIsFontLoaded(true), 100)
      }
      catch {
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

  const getProviderBox = (providerName: string) => {
    const providerId = getProviderId(providerName)
    if (!providerId) {
      return null
    }
    const oauthProvider = oauthProviders[providerId]
    // oauthProvider.expired = true // temp test
    // let className = 'p-[0.38rem] border border-[#CCC] rounded-[0.5rem]'
    const appearance = (
      <div
        key={`approval-panel-provider-${providerId}`}
        className="p-[0.38rem] border border-[#CCC] rounded-[0.5rem]"
      >
        <img
          src={getProviderIcon(undefined, providerId)}
          alt={providerId}
          className="w-[1rem] h-[1rem]"
        />
      </div>
    )

    let element = appearance
    if (!oauthProvider || oauthProvider.expired) {
      element = (
        <TooltipDesigned
          key={`approval-panel-provider-${providerId}-tooltip`}
          className="relative w-fit h-fit"
          tooltipClassName="top-[1.5rem] left-[0.5rem]"
          position="bottom-right"
          tooltipText={(
            <div
              className="p-[0.63rem] flex flex-col gap-[0.31rem] w-[14.75rem]"
            >
              <div
                className="text-[#000] font-semibold"
              >
                Token is expired!
              </div>
              <div
                className="text-[#737373] text-[0.75rem]"
              >
                You must re-authenticate this token in order to use the connector.
              </div>

              <ButtonDesigned
                className="rounded-full w-fit px-[0.63rem] py-[0.38rem]"
                variant="primary-black"
                onClick={() => {
                  reconnectProvider(providerId)
                }}
              >
                Refresh token
              </ButtonDesigned>

            </div>
          )}
        >
          <div
            className="opacity-25"
          >
            {appearance}
          </div>
          <img
            src={redCautionIconUrl}
            alt="expired"
            className="absolute bottom-0 right-[-0.25rem] w-[0.75rem] h-[0.65rem] z-10"
          />
        </TooltipDesigned>
      )
    }

    return element
  }

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

      {Boolean(providerNames.length) && (
        <div
          className="rounded-[0.38rem] border border-[#E5E5E5] w-full px-[0.63rem] py-[0.44rem] flex gap-[0.63rem] items-center"
        >
          <img src={informationIconUrl} alt="info" className="w-[1.5rem] h-[1.5rem] p-[0.13rem]" />
          <div
            className="flex flex-col gap-[0.31rem] w-full"
          >
            <div
              className="text-[#171717] w-full"
            >
              Required connectors
            </div>

            <div
              className="flex gap-[0.25rem] w-full"
            >
              {providerNames.map(providerName => (
                getProviderBox(providerName)
              ))}
            </div>
          </div>
        </div>
      )}

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
