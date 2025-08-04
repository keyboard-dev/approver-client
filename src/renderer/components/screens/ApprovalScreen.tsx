import React from 'react'
import { Message } from '../../../preload'

interface ApprovalScreenProps {
  message: Message
  onBack?: () => void
  onApprove?: (messageId: string) => void
  onReject?: (messageId: string) => void
}

export const ApprovalScreen: React.FC<ApprovalScreenProps> = ({
  message,
  onBack,
  onApprove,
  onReject,
}) => {
  return (
    <div
      className="flex flex-col w-[581px] h-[702px] bg-red-500"
    >
      lorem ipsum dolor sit amet
    </div>
  )
}
