import { CheckCircle, ChevronDown, ChevronRight, Clock, Shield, XCircle } from 'lucide-react'
import React, { useState } from 'react'
import { Message } from '../../types'
import { useAuth } from '../hooks/useAuth'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader } from './ui/card'

interface ChatApprovalMessageProps {
  message: Message
  onApprove: (messageId: string) => void
  onReject: (messageId: string) => void
  onViewFullDetails: (message: Message) => void
}

export const ChatApprovalMessage: React.FC<ChatApprovalMessageProps> = ({
  message,
  onApprove,
  onReject,
  onViewFullDetails,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)

  // Auth and WebSocket connection management
  const { authStatus, isSkippingAuth } = useAuth()

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
      riskLevelBgColor = 'bg-green-50 border-green-200'
      break
    case 'medium':
      riskLevelColor = 'text-yellow-600'
      riskLevelBgColor = 'bg-yellow-50 border-yellow-200'
      break
    case 'high':
      riskLevelColor = 'text-red-600'
      riskLevelBgColor = 'bg-red-50 border-red-200'
      break
    default:
      riskLevelColor = 'text-gray-600'
      riskLevelBgColor = 'bg-gray-50 border-gray-200'
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
    }
    catch (error) {
    }
    finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    setIsRejecting(true)
    try {
      await onReject(id)
    }
    catch (error) {
    }
    finally {
      setIsRejecting(false)
    }
  }

  const createdAt = new Date(timestamp).toLocaleString()

  return (
    <Card className={`border-l-4 ${isCodeResponseApproval ? 'border-l-blue-400' : 'border-l-orange-400'} ${riskLevelBgColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className={`w-5 h-5 ${isCodeResponseApproval ? 'text-blue-500' : 'text-orange-500'}`} />
            <div>
              <h3 className="font-semibold text-sm">
                {isCodeResponseApproval ? 'Code Execution Approval Required' : 'Security Approval Required'}
              </h3>
              <p className="text-xs text-gray-500">{createdAt}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={risk_level === 'low' ? 'secondary' : risk_level === 'medium' ? 'outline' : 'destructive'} className={riskLevelColor}>
              {risk_level}
              {' '}
              risk
            </Badge>
            {getStatusIcon()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Explanation */}
        {!isCodeResponseApproval && explanation && (
          <div className="p-3 bg-white rounded-md border">
            <h4 className="font-medium text-sm mb-2">What the AI wants to do:</h4>
            <p className="text-sm text-gray-700">{explanation}</p>
          </div>
        )}

        {/* Code Execution Results */}
        {isCodeResponseApproval && codespaceResponse?.data && (
          <div className="space-y-3">
            <div className="p-3 bg-white rounded-md border">
              <h4 className="font-medium text-sm mb-2">Code Execution Results:</h4>

              {/* Standard Output */}
              {codespaceResponse.data.stdout && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-600 mb-1">Output:</div>
                  <pre className="text-xs bg-gray-100 p-2 rounded border overflow-x-auto max-h-32">
                    {codespaceResponse.data.stdout}
                  </pre>
                </div>
              )}

              {/* Error Output */}
              {codespaceResponse.data.stderr && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-red-600 mb-1">Error Output:</div>
                  <pre className="text-xs bg-red-50 border border-red-200 p-2 rounded overflow-x-auto max-h-32 text-red-800">
                    {codespaceResponse.data.stderr}
                  </pre>
                </div>
              )}

              {!codespaceResponse.data.stdout && !codespaceResponse.data.stderr && (
                <p className="text-sm text-gray-500 italic">No output available</p>
              )}
            </div>
          </div>
        )}

        {/* Expandable code section */}
        {!isCodeResponseApproval && code && (
          <div className="border rounded-md">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-between p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-t-md"
            >
              <span className="font-medium text-sm">Generated Code</span>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {isExpanded && (
              <div className="p-3 border-t bg-white">
                <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto max-h-40">
                  <code>{code}</code>
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Actions - only show if pending */}
        {status === 'pending' && (
          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={handleReject}
              variant="outline"
              size="sm"
              disabled={isRejecting || isApproving}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              {isRejecting ? 'Rejecting...' : 'Reject'}
            </Button>
            <Button
              onClick={handleApprove}
              size="sm"
              disabled={isApproving || isRejecting}
              className="bg-green-600 hover:bg-green-700 text-white"
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
              className="text-gray-600 hover:text-gray-800"
            >
              View Full Details
            </Button>
          </div>
        )}

        {/* Status message for completed approvals */}
        {status !== 'pending' && (
          <div className="pt-2">
            <p className="text-sm text-gray-600 flex items-center gap-2">
              {getStatusIcon()}
              {status === 'approved'
                ? (isCodeResponseApproval ? 'Code execution approved' : 'Security request approved')
                : (isCodeResponseApproval ? 'Code execution rejected' : 'Security request rejected')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
