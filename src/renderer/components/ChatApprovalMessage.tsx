import { ChevronDown, ChevronRight, Shield, Clock, CheckCircle, XCircle } from 'lucide-react'
import React, { useState } from 'react'
import { Message } from '../../types'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader } from './ui/card'
import { Badge } from './ui/badge'
import { useWebSocketConnection } from '../hooks/useWebSocketConnection'
import { useAuth } from '../hooks/useAuth'

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
  const { connectionStatus, connectToBestCodespace } = useWebSocketConnection(authStatus, isSkippingAuth)

  const {
    id,
    explanation,
    code,
    risk_level,
    status,
    timestamp,
  } = message

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
      // Ensure we have a connection before approving
      if (connectionStatus === 'disconnected') {
        await connectToBestCodespace()
      }
      await onApprove(id)
    } catch (error) {
      console.error('Failed to approve message:', error)
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    setIsRejecting(true)
    try {
      // Ensure we have a connection before rejecting
      if (connectionStatus === 'disconnected') {
        await connectToBestCodespace()
      }
      await onReject(id)
    } catch (error) {
      console.error('Failed to reject message:', error)
    } finally {
      setIsRejecting(false)
    }
  }

  const createdAt = new Date(timestamp).toLocaleString()

  return (
    <Card className={`border-l-4 border-l-orange-400 ${riskLevelBgColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-orange-500" />
            <div>
              <h3 className="font-semibold text-sm">Security Approval Required</h3>
              <p className="text-xs text-gray-500">{createdAt}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={risk_level === 'low' ? 'secondary' : risk_level === 'medium' ? 'outline' : 'destructive'} className={riskLevelColor}>
              {risk_level} risk
            </Badge>
            {getStatusIcon()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Explanation */}
        <div className="p-3 bg-white rounded-md border">
          <h4 className="font-medium text-sm mb-2">What the AI wants to do:</h4>
          <p className="text-sm text-gray-700">{explanation}</p>
        </div>

        {/* Expandable code section */}
        {code && (
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
              {isApproving ? 'Approving...' : 'Approve'}
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
              {status === 'approved' ? 'Code execution approved' : 'Code execution rejected'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}