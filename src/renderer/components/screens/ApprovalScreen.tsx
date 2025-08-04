import React from 'react'
import { Message } from '../../../preload'

interface ApprovalScreenProps {
  message: Message
  onBack?: () => void
  onApprove?: (messageId: string) => void
  onReject?: (messageId: string) => void
}

export const ApprovalScreen: React.FC<ApprovalScreenProps> = () => {
  return (
    <div
      className="flex flex-col w-full min-h-screen liquid-glass-background draggable"
    >
      lorem ipsum dolor sit amet
    </div>
  )
}
