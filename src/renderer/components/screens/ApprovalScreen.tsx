import { ArrowLeft, Check, ChevronDown, Clock, Code, MessageCircle, Settings, X } from 'lucide-react'
import React, { useState } from 'react'
import { Message } from '../../../preload'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'

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
  console.log('==================')
  const [expandedSections, setExpandedSections] = useState({
    explanation: true,
    script: true,
  })

  const toggleSection = (section: 'explanation' | 'script') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = String(date.getFullYear()).slice(-2)
    const hours = date.getHours()
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'pm' : 'am'
    const displayHours = hours % 12 || 12

    return `${month}/${day}/${year}, ${displayHours}:${minutes}${ampm}`
  }

  const getRiskLevelColor = (priority?: string) => {
    switch (priority) {
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'normal':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />
      case 'approved':
        return <Check className="w-4 h-4" />
      case 'rejected':
        return <X className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-600">All systems are normal</span>
          </div>
          <Settings className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white px-6 py-4 border-b">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All requests
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Title */}
          <h1 className="text-2xl font-semibold text-gray-900 mb-8">
            fdsiofjdiopfjeqwiopfjewoipf
            Security evaluation request
          </h1>

          {/* Status Card */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-8">
                <div>
                  <div className="text-sm text-gray-500 mb-2">Risk level</div>
                  <Badge
                    className={`${getRiskLevelColor(message.priority)} capitalize font-medium`}
                    variant="outline"
                  >
                    {message.priority || 'Unknown'}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-2">Status</div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(message.status)}
                    <span className="font-medium capitalize">
                      {message.status || 'Pending'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-2">Created</div>
                  <div className="font-medium">
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content Sections */}
          <div className="space-y-4 mb-8">
            {/* What the model wants to do */}
            <Card>
              <CardContent className="p-0">
                <button
                  onClick={() => toggleSection('explanation')}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">What the model wants to do</span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedSections.explanation ? 'transform rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedSections.explanation && (
                  <div className="px-6 pb-6 border-t border-gray-100">
                    <div className="pt-4 text-gray-700 leading-relaxed">
                      {message.explanation || message.body || 'No explanation provided.'}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Generated script */}
            <Card>
              <CardContent className="p-0">
                <button
                  onClick={() => toggleSection('script')}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Code className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Generated script</span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedSections.script ? 'transform rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedSections.script && (
                  <div className="px-6 pb-6 border-t border-gray-100">
                    <div className="pt-4 bg-gray-50 rounded-lg p-4 font-mono text-sm -mx-2">
                      <pre className="whitespace-pre-wrap text-gray-800">
                        {message.code || 'No script provided.'}
                      </pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Description */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="prose max-w-none text-gray-700 leading-relaxed">
                {message.explanation || message.body || 'This script will create a Linear ticket using their GraphQL API. It first fetches all teams to find the "Dev-Docs Design" team (or a similar team if not found), then fetches all users to find "Kayley" for assignment. Finally, it creates an issue with the title "Test123" and description "This is just a test" using the IssueCreate mutation. The script includes comprehensive error handling and logging to show the process and results.'}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => onReject?.(message.id)}
              className="flex items-center gap-2 px-6"
            >
              <X className="w-4 h-4" />
              Reject
            </Button>
            <Button
              onClick={() => onApprove?.(message.id)}
              className="flex items-center gap-2 px-6 bg-blue-600 hover:bg-blue-700"
            >
              <Check className="w-4 h-4" />
              Approve script execution
            </Button>
          </div>

          {/* Footer Disclaimer */}
          <div className="text-center mt-8">
            <p className="text-sm text-gray-500">
              AI can make mistakes. Always review before approving.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
