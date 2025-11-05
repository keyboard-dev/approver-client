import React, { useState } from 'react'
import { Check, X, AlertCircle, Code } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

interface ToolCallPart {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  result?: unknown
  isError?: boolean
}

interface ToolCallRendererProps {
  toolCall: ToolCallPart
}

export const ToolCallRenderer: React.FC<ToolCallRendererProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')

  const handleApprove = () => {
    setStatus('approved')
    // Here you would actually call the tool
    console.log('Tool approved:', toolCall)
  }

  const handleReject = () => {
    setStatus('rejected')
    console.log('Tool rejected:', toolCall)
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-gray-600" />
          <span className="font-medium text-sm">{toolCall.toolName}</span>
          {status === 'approved' && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
              Approved
            </span>
          )}
          {status === 'rejected' && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
              Rejected
            </span>
          )}
          {status === 'pending' && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
              Pending Approval
            </span>
          )}
        </div>
        <AlertCircle className="h-4 w-4 text-gray-400" />
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-3 space-y-3">
          {/* Arguments */}
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Arguments:</div>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>

          {/* Result if available */}
          {toolCall.result && (
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Result:</div>
              <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}

          {/* Action buttons */}
          {status === 'pending' && (
            <div className="flex gap-2">
              <Button
                onClick={handleApprove}
                size="sm"
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                onClick={handleReject}
                size="sm"
                variant="destructive"
                className="flex-1"
              >
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
