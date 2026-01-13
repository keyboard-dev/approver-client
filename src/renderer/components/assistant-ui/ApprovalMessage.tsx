import type { FC } from 'react'
import { Message } from '../../../types'
import { ApprovalChatMessage } from '../ApprovalChatMessage'

interface ApprovalMessageProps {
  currentApprovalMessage?: Message
  onApproveMessage?: (message: Message) => void
  onRejectMessage?: (message: Message) => void
  onClearMessage?: () => void
}

export const ApprovalMessage: FC<ApprovalMessageProps> = ({
  currentApprovalMessage,
  onApproveMessage,
  onRejectMessage,
  onClearMessage,
}) => {
  if (!currentApprovalMessage) {
    return null
  }

  return (
    <ApprovalChatMessage
      message={currentApprovalMessage}
      onApprove={async () => {
        if (onApproveMessage) {
          await onApproveMessage(currentApprovalMessage)
        }
      }}
      onReject={async () => {
        if (onRejectMessage) {
          await onRejectMessage(currentApprovalMessage)
        }
      }}
      onComplete={() => {
        if (onClearMessage) {
          onClearMessage()
        }
      }}
    />
  )
}
