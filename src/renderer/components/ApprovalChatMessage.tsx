import React, { useState } from 'react'
import blueCheckIconUrl from '../../../assets/icon-check-blue.svg'
import checkIconUrl from '../../../assets/icon-check.svg'
import clockIconUrl from '../../../assets/icon-clock.svg'
import codeIconUrl from '../../../assets/icon-code.svg'
import squaresIconUrl from '../../../assets/icon-squares.svg'
import thinkingIconUrl from '../../../assets/icon-thinking.svg'
import greyXIconUrl from '../../../assets/icon-x-grey.svg'
import xIconUrl from '../../../assets/icon-x.svg'
import { Message } from '../../types'
import { ButtonDesigned } from './ui/ButtonDesigned'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { TooltipDesigned } from './ui/TooltipDesigned'

interface ApprovalChatMessageProps {
  message: Message
  onApprove: (messageId: string) => void
  onReject: (messageId: string) => void
  onComplete?: () => void
}

export const ApprovalChatMessage: React.FC<ApprovalChatMessageProps> = ({
  message,
  onApprove,
  onReject,
  onComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'explanation' | 'code' | 'output'>('explanation')
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [isHidden, setIsHidden] = useState(false)

  const {
    id,
    explanation,
    code,
    risk_level,
    status,
    timestamp,
    title,
    codespaceResponse,
  } = message

  // Determine if this is a code response approval
  const isCodeResponseApproval = title === 'code response approval'

  // Risk level styling - matching ApprovalScreen
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
    default:
      riskLevelTextColor = '#737373'
      riskLevelBgColor = '#F3F3F3'
  }

  // Status icon - matching ApprovalScreen
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
    default:
      statusIconUrl = clockIconUrl
  }

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      await onApprove(id)
      setIsHidden(true)
      setIsFullScreen(false)
      if (onComplete) {
        setTimeout(() => onComplete(), 300)
      }
    }
    finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    setIsRejecting(true)
    try {
      await onReject(id)
      setIsHidden(true)
      setIsFullScreen(false)
      if (onComplete) {
        setTimeout(() => onComplete(), 300)
      }
    }
    finally {
      setIsRejecting(false)
    }
  }

  const createdAt = new Date(timestamp).toLocaleString()

  // Hide component after action is completed
  if (isHidden) {
    return null
  }

  // Render content component (used in both compact and full-screen views)
  const renderContent = () => (
    <>
      {/* Info Bar */}
      <div className="rounded-[0.38rem] border border-[#E5E5E5] w-full px-[0.63rem] py-[0.44rem] flex justify-between text-[0.75rem]">
        {risk_level && (
          <div>
            <div className="text-[#737373] mb-1">Risk level</div>
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

        {status && (
          <div>
            <div className="text-[#737373] mb-1">Status</div>
            <div className="flex items-center gap-[0.25rem] capitalize">
              <img src={statusIconUrl} alt="Status" className="w-[0.75rem] h-[0.75rem]" />
              {status}
            </div>
          </div>
        )}

        <div>
          <div className="text-[#737373] mb-1">Created</div>
          <div className="text-[0.7rem]">{createdAt}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex w-full gap-[0.31rem] border border-[#E5E5E5] rounded-[0.38rem] bg-[#F3F3F3] p-[0.25rem] text-[#737373] font-semibold text-[0.75rem]">
        <button
          onClick={() => setActiveTab('explanation')}
          className={`grow basis-0 flex items-center justify-center py-[0.5rem] rounded-[0.25rem] gap-[0.31rem] border-none outline-none ${
            activeTab === 'explanation'
              ? 'bg-white'
              : 'hover:bg-[#E6E6E6]'
          }`}
        >
          <img src={thinkingIconUrl} alt="thinking" className="w-[0.75rem] h-[0.75rem]" />
          {isCodeResponseApproval ? 'Output' : 'What the model wants to do'}
        </button>
        {!isCodeResponseApproval && code && (
          <button
            onClick={() => setActiveTab('code')}
            className={`grow basis-0 flex items-center justify-center py-[0.5rem] rounded-[0.25rem] gap-[0.31rem] border-none outline-none ${
              activeTab === 'code'
                ? 'bg-white'
                : 'hover:bg-[#E6E6E6]'
            }`}
          >
            <img src={codeIconUrl} alt="code" className="w-[0.75rem] h-[0.75rem]" />
            Generated script
          </button>
        )}
      </div>

      {/* Content */}
      {activeTab === 'explanation' && !isCodeResponseApproval && explanation && (
        <div className="p-[0.75rem] border border-[#E5E5E5] rounded-[0.38rem] w-full text-[0.88rem] max-h-[400px] overflow-auto">
          {explanation}
        </div>
      )}

      {activeTab === 'explanation' && isCodeResponseApproval && codespaceResponse?.data && (
        <div className="border border-[#E5E5E5] rounded-[0.38rem] w-full max-h-[400px] overflow-auto">
          <div className="p-[0.75rem]">
            {codespaceResponse.data.stdout && (
              <div className="mb-3">
                <div className="text-[0.75rem] font-medium text-[#737373] mb-1">Output:</div>
                <pre className="text-[0.75rem] bg-[#F3F3F3] p-2 rounded overflow-x-auto">
                  {codespaceResponse.data.stdout}
                </pre>
              </div>
            )}
            {codespaceResponse.data.stderr && (
              <div>
                <div className="text-[0.75rem] font-medium mb-1" style={{ color: '#E06C75' }}>
                  Error Output:
                </div>
                <pre className="text-[0.75rem] p-2 rounded overflow-x-auto" style={{ backgroundColor: '#E06C7526', color: '#E06C75' }}>
                  {codespaceResponse.data.stderr}
                </pre>
              </div>
            )}
            {!codespaceResponse.data.stdout && !codespaceResponse.data.stderr && (
              <div className="text-[0.75rem] text-[#737373] italic">No output available</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'code' && code && (
        <div className="border border-[#E5E5E5] rounded-[0.38rem] w-full max-h-[400px] overflow-auto">
          <pre className="text-[0.75rem] p-[0.75rem] overflow-x-auto bg-[#282c34] text-[#abb2bf] font-mono">
            <code>{code}</code>
          </pre>
        </div>
      )}

      {/* Actions */}
      {status === 'pending' && (
        <div className="w-full flex flex-col gap-[0.5rem]">
          <div className="w-full flex gap-[0.31rem]">
            <ButtonDesigned
              variant="secondary"
              onClick={handleReject}
              disabled={isRejecting || isApproving}
              className="grow shrink basis-0 min-w-0 flex gap-[0.31rem] items-center justify-center"
            >
              <img src={greyXIconUrl} alt="x" className="w-[0.75rem] h-[0.75rem]" />
              {isRejecting ? 'Rejecting...' : 'Reject'}
            </ButtonDesigned>

            <ButtonDesigned
              variant="primary-black"
              onClick={handleApprove}
              disabled={isApproving || isRejecting}
              className="grow shrink basis-0 min-w-0 flex gap-[0.31rem] items-center justify-center"
            >
              <img src={blueCheckIconUrl} alt="check" className="w-[0.75rem] h-[0.75rem] brightness-0 invert" />
              {isApproving
                ? 'Approving...'
                : isCodeResponseApproval
                  ? 'Approve execution'
                  : 'Approve script execution'}
            </ButtonDesigned>
          </div>

          <div className="text-[#737373] text-[0.75rem] text-center w-full">
            AI can make mistakes. Always review before approving.
          </div>
        </div>
      )}

      {/* Status message for completed approvals */}
      {status !== 'pending' && (
        <div className="w-full pt-2 border-t border-[#E5E5E5]">
          <div className="text-[0.75rem] text-[#737373] flex items-center gap-2">
            <img src={statusIconUrl} alt="Status" className="w-[0.75rem] h-[0.75rem]" />
            {status === 'approved'
              ? (isCodeResponseApproval ? 'Code execution approved' : 'Security request approved')
              : (isCodeResponseApproval ? 'Code execution rejected' : 'Security request rejected')}
          </div>
        </div>
      )}
    </>
  )

  return (
    <>
      {/* Compact View */}
      <div
        className="mx-auto w-full max-w-[var(--thread-max-width)] animate-in py-2 duration-150 ease-out fade-in slide-in-from-bottom-1"
        data-role="system"
      >
        <div className="rounded-[0.38rem] border border-[#E5E5E5] bg-white p-[0.63rem] flex flex-col gap-[0.5rem]">
          {/* Title with Expand Button */}
          <div className="flex items-center justify-between">
            <div className="font-bold text-[1rem]">
              {isCodeResponseApproval ? 'Code execution approval' : 'Security evaluation request'}
            </div>
            <TooltipDesigned tooltipText="Expand to full screen">
              <button
                onClick={() => setIsFullScreen(true)}
                className="p-[0.31rem] rounded hover:bg-[#F3F3F3] transition-colors"
                type="button"
              >
                <img src={squaresIconUrl} alt="Expand" className="w-[0.75rem] h-[0.75rem]" />
              </button>
            </TooltipDesigned>
          </div>

          {/* Compact content with limited height */}
          {renderContent()}
        </div>
      </div>

      {/* Full-Screen Dialog */}
      <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
        <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-[1.25rem] font-bold">
              {isCodeResponseApproval ? 'Code execution approval' : 'Security evaluation request'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-[0.5rem] mt-4">
            {renderContent()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
