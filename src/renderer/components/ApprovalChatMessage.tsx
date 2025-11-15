// Note: MessagePrimitive.Root removed - this component is now designed to be used within ThreadPrimitive.Messages
import { ChevronDown, ChevronRight, Shield, Clock, CheckCircle, XCircle } from 'lucide-react'
import React, { useState } from 'react'
import { Message } from '../../types'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

interface ApprovalChatMessageProps {
  message: Message
  onApprove: (messageId: string) => void
  onReject: (messageId: string) => void
  onViewFullDetails: (message: Message) => void
}

export const ApprovalChatMessage: React.FC<ApprovalChatMessageProps> = ({
  message,
  onApprove,
  onReject,
  onViewFullDetails,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)

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

  // Risk level styling
  let riskLevelColor, riskLevelBgColor
  switch (risk_level) {
    case 'low':
      riskLevelColor = 'text-green-600'
      riskLevelBgColor = 'bg-green-50'
      break
    case 'medium':
      riskLevelColor = 'text-yellow-600'
      riskLevelBgColor = 'bg-yellow-50'
      break
    case 'high':
      riskLevelColor = 'text-red-600'
      riskLevelBgColor = 'bg-red-50'
      break
    default:
      riskLevelColor = 'text-gray-600'
      riskLevelBgColor = 'bg-gray-50'
  }

  // Status icon
  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      await onApprove(id)
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    setIsRejecting(true)
    try {
      await onReject(id)
    } finally {
      setIsRejecting(false)
    }
  }

  const createdAt = new Date(timestamp).toLocaleString()

  return (
    <div
      className="mx-auto w-full max-w-[var(--thread-max-width)] animate-in py-4 duration-150 ease-out fade-in slide-in-from-bottom-1"
      data-role="system"
    >
        <div className={`rounded-3xl p-4 ${isCodeResponseApproval ? 'bg-blue-50 border-l-4 border-l-blue-400' : 'bg-orange-50 border-l-4 border-l-orange-400'}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className={`w-4 h-4 ${isCodeResponseApproval ? 'text-blue-500' : 'text-orange-500'}`} />
              <span className="font-semibold text-sm">
                {isCodeResponseApproval ? 'Code Execution Approval' : 'Security Approval'}
              </span>
              {getStatusIcon()}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={risk_level === 'low' ? 'secondary' : risk_level === 'medium' ? 'outline' : 'destructive'} className={`text-xs ${riskLevelColor}`}>
                {risk_level} risk
              </Badge>
              <span className="text-xs text-gray-500">{createdAt}</span>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-3">
            {/* Explanation for Security Evaluation Request */}
            {!isCodeResponseApproval && explanation && (
              <div className="p-2 bg-white rounded border">
                <div className="text-xs font-medium text-gray-600 mb-1">What the AI wants to do:</div>
                <div className="text-sm text-gray-700">{explanation}</div>
              </div>
            )}

            {/* Code Execution Results */}
            {isCodeResponseApproval && codespaceResponse?.data && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-700">Code Execution Results:</div>
                
                {/* Standard Output */}
                {codespaceResponse.data.stdout && (
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-1">Output:</div>
                    <pre className="text-xs bg-gray-100 p-2 rounded border overflow-x-auto max-h-20 text-gray-800">
                      {codespaceResponse.data.stdout}
                    </pre>
                  </div>
                )}

                {/* Error Output */}
                {codespaceResponse.data.stderr && (
                  <div>
                    <div className="text-xs font-medium text-red-600 mb-1">Error Output:</div>
                    <pre className="text-xs bg-red-50 border border-red-200 p-2 rounded overflow-x-auto max-h-20 text-red-800">
                      {codespaceResponse.data.stderr}
                    </pre>
                  </div>
                )}

                {!codespaceResponse.data.stdout && !codespaceResponse.data.stderr && (
                  <div className="text-xs text-gray-500 italic">No output available</div>
                )}
              </div>
            )}

            {/* Expandable code section for Security Evaluation */}
            {!isCodeResponseApproval && code && (
              <div className="border rounded">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-full flex items-center justify-between p-2 text-left bg-gray-50 hover:bg-gray-100 rounded-t"
                >
                  <span className="text-xs font-medium">Generated Code</span>
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                {isExpanded && (
                  <div className="p-2 border-t bg-white">
                    <pre className="text-xs bg-gray-900 text-gray-100 p-2 rounded overflow-x-auto max-h-32">
                      <code>{code}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          {status === 'pending' && (
            <div className="flex items-center gap-2 mt-3 pt-2 border-t">
              <Button
                onClick={handleReject}
                variant="outline"
                size="sm"
                disabled={isRejecting || isApproving}
                className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-7 px-2"
              >
                {isRejecting ? 'Rejecting...' : 'Reject'}
              </Button>
              <Button
                onClick={handleApprove}
                size="sm"
                disabled={isApproving || isRejecting}
                className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-2"
              >
                {isApproving 
                  ? 'Approving...' 
                  : isCodeResponseApproval 
                    ? 'Approve Execution' 
                    : 'Approve'}
              </Button>
              <Button
                onClick={() => onViewFullDetails(message)}
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-800 text-xs h-7 px-2"
              >
                Full Details
              </Button>
            </div>
          )}

          {/* Status message for completed approvals */}
          {status !== 'pending' && (
            <div className="mt-3 pt-2 border-t">
              <div className="text-xs text-gray-600 flex items-center gap-2">
                {getStatusIcon()}
                {status === 'approved' 
                  ? (isCodeResponseApproval ? 'Code execution approved' : 'Security request approved')
                  : (isCodeResponseApproval ? 'Code execution rejected' : 'Security request rejected')
                }
              </div>
            </div>
          )}
        </div>
    </div>
  )
}