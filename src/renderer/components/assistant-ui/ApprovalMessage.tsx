import type { FC } from 'react'
import { useEffect } from 'react'
import { Message } from '../../../types'
import { ApprovalChatMessage } from '../ApprovalChatMessage'

interface ApprovalMessageProps {
  currentApprovalMessage?: Message
  onApproveMessage?: (message: Message) => void
  onRejectMessage?: (message: Message) => void
  onViewFullDetails?: (message: Message) => void
}

export const ApprovalMessage: FC<ApprovalMessageProps> = ({
  currentApprovalMessage,
  onApproveMessage,
  onRejectMessage,
  onViewFullDetails,
}) => {
  useEffect(() => {
    console.log('[ApprovalMessage] Component rendered with message:', currentApprovalMessage)
    if (currentApprovalMessage) {
      console.log('[ApprovalMessage] Message details:', currentApprovalMessage)
    }
  }, [currentApprovalMessage])

  if (!currentApprovalMessage) {
    return null
  }

  return (
    <ApprovalChatMessage
      message={currentApprovalMessage}
      onApprove={async (messageId) => {
        console.log('[ApprovalMessage] Approve triggered for message:', messageId)
        if (onApproveMessage) {
          await onApproveMessage(currentApprovalMessage)
        }
      }}
      onReject={async (messageId) => {
        console.log('[ApprovalMessage] Reject triggered for message:', messageId)
        if (onRejectMessage) {
          await onRejectMessage(currentApprovalMessage)
        }
      }}
      onViewFullDetails={onViewFullDetails || (() => {
        console.log('[ApprovalMessage] View full details:', currentApprovalMessage)
      })}
    />
  )
}
