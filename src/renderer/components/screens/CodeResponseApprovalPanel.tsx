import Editor from '@monaco-editor/react'
import { Separator } from '@radix-ui/react-separator'
import { CheckCircle, Wifi, WifiOff, XCircle } from 'lucide-react'
import * as monaco from 'monaco-editor'
import lazyTheme from 'monaco-themes/themes/Lazy.json'
import React, { useCallback, useEffect, useState } from 'react'

import blueCheckIconUrl from '../../../../assets/icon-check-blue.svg'
import greyXIconUrl from '../../../../assets/icon-x-grey.svg'
import { Message } from '../../../types'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { ButtonDesigned } from '../ui/ButtonDesigned'
import { Card, CardHeader, CardTitle } from '../ui/card'
import { Textarea } from '../ui/textarea'

interface CodeResponseApprovalPanelProps {
  message: Message
  onApprove: () => Promise<void>
  onReject: () => Promise<void>
  onBack: () => void
  connectionStatus: 'connected' | 'disconnected' | 'connecting'
}

const handleEditorWillMount = (monacoInstance: typeof monaco) => {
  monacoInstance.editor.defineTheme('lazy', lazyTheme as monaco.editor.IStandaloneThemeData)
}

const getEditorOptions = (): monaco.editor.IStandaloneEditorConstructionOptions => ({
  automaticLayout: true,
  fontFamily: '"Fira Code", monospace',
  fontSize: 14,
  fontWeight: '400',
  lineHeight: 1.5,
  lineNumbersMinChars: 0,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on',
})

// Utility function to convert to sentence case
const toSentenceCase = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

// Utility function to sanitize unusual line terminators
const sanitizeLineTerminators = (text: string | undefined): string => {
  if (!text) return ''
  // Replace Unicode Line Separator (U+2028) and Paragraph Separator (U+2029) with standard newlines
  return text.replace(/[\u2028\u2029]/g, '\n')
}

export const CodeResponseApprovalPanel: React.FC<CodeResponseApprovalPanelProps> = ({
  message,
  onApprove,
  onReject,
  onBack,
  connectionStatus,
}) => {
  const [feedback, setFeedback] = useState(message.feedback || '')
  const [showFeedback, setShowFeedback] = useState(false)
  const [isFontLoaded, setIsFontLoaded] = useState(false)

  // Font loading effect
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    const checkFontLoaded = async () => {
      try {
        await document.fonts.load('400 16px "Fira Code"')
        timeoutId = setTimeout(() => setIsFontLoaded(true), 100)
      }
      catch {
        setIsFontLoaded(true)
      }
    }

    checkFontLoaded()

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  const getStatusIcon = useCallback((status?: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }, [])

  const getStatusBadge = useCallback((status?: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>
      default:
        return <Badge variant="outline">New</Badge>
    }
  }, [])

  const getPriorityBadge = useCallback((priority?: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High Priority</Badge>
      case 'normal':
        return <Badge variant="secondary">Normal</Badge>
      case 'low':
        return <Badge variant="outline">Low Priority</Badge>
      default:
        return null
    }
  }, [])

  const handleApprove = async () => {
    await onApprove()
  }

  const handleReject = async () => {
    await onReject()
  }

  const { codespaceResponse } = message
  const codespaceResponseData = codespaceResponse?.data
  const hasError = Boolean(codespaceResponseData?.stderr)

  return (
    <Card className="w-full h-full flex flex-col gap-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}>
            ← Back to Messages
          </Button>
          <div className="flex items-center space-x-3">
            {/* Connection Status Badge */}
            <Badge
              variant={connectionStatus === 'connected' ? 'default' : 'destructive'}
              className={`connection-status-badge flex items-center space-x-2 px-3 py-2 ${
                connectionStatus === 'connected'
                  ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100'
                  : 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100'
              }`}
            >
              {connectionStatus === 'connected'
                ? (
                    <Wifi className="h-3 w-3" />
                  )
                : (
                    <WifiOff className="h-3 w-3" />
                  )}
              <span className="text-xs font-medium">
                {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
              </span>
            </Badge>
            <div className="flex items-center space-x-2">
              {getStatusIcon(message.status)}
              {getStatusBadge(message.status)}
            </div>
          </div>
        </div>
        <CardTitle className="text-2xl font-bold mt-4">
          {toSentenceCase(message.title)}
        </CardTitle>
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <span>
            From:
            {message.sender || 'Unknown'}
          </span>
          <span>•</span>
          <span>{new Date(message.timestamp).toLocaleString()}</span>
          {message.priority && (
            <>
              <span>•</span>
              {getPriorityBadge(message.priority)}
            </>
          )}
        </div>
      </CardHeader>
      <div className="p-6 grow shrink flex flex-col">
        {/* Message Body */}
        <div className="grow shrink flex flex-col">
          <h3 className="text-lg font-semibold mb-2">Request Details</h3>
          <div className="bg-gray-100 p-4 rounded-lg grow shrink overflow-hidden flex flex-col">
            {/* Standard Output */}
            <div className="mb-2 grow shrink flex flex-col">
              <div className="text-sm font-medium text-gray-700 mb-1">Output:</div>
              <div className="border border-gray-200 rounded grow shrink">
                {isFontLoaded
                  ? (
                      <Editor
                        className="grow shrink min-h-24"
                        language="plaintext"
                        defaultValue="No output"
                        value={sanitizeLineTerminators(codespaceResponseData?.stdout)}
                        onChange={(value) => {
                          if (codespaceResponseData) {
                            codespaceResponseData.stdout = value
                          }
                        }}
                        theme="lazy"
                        beforeMount={handleEditorWillMount}
                        options={getEditorOptions()}
                      />
                    )
                  : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        Loading editor...
                      </div>
                    )}
              </div>
            </div>

            {/* Error Output */}
            {hasError && (
              <div className="mt-2 grow shrink flex flex-col">
                <div className="text-sm font-medium text-red-700 mb-1">
                  Error Output (Please review to see if there are any sensitive content):
                </div>
                <div className="border border-red-200 rounded bg-red-50 grow shrink">
                  {isFontLoaded
                    ? (
                        <Editor
                          className="min-h-24"
                          language="plaintext"
                          value={sanitizeLineTerminators(codespaceResponseData?.stderr)}
                          onChange={(value) => {
                            if (codespaceResponseData) {
                              codespaceResponseData.stderr = value
                            }
                          }}
                          theme="lazy"
                          beforeMount={handleEditorWillMount}
                          options={getEditorOptions()}
                        />
                      )
                    : (
                        <div className="flex items-center justify-center h-full text-red-500">
                          Loading editor...
                        </div>
                      )}
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        {message.status === 'pending' || !message.status
          ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Actions Required</h3>

                {/* Feedback Section Toggle */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="show-feedback"
                    checked={showFeedback}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setShowFeedback(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="show-feedback" className="text-sm">
                    Add feedback/comments
                  </label>
                </div>

                {/* Feedback Textarea */}
                {showFeedback && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Feedback</label>
                    <Textarea
                      placeholder="Enter your feedback or comments..."
                      value={feedback}
                      onChange={e => setFeedback(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="w-full flex gap-[0.31rem]">
                  <ButtonDesigned
                    variant="secondary"
                    onClick={handleReject}
                    className="grow shrink basis-0 min-w-0 flex gap-[0.31rem] items-center justify-center"
                  >
                    <img src={greyXIconUrl} alt="x" className="w-[0.75rem] h-[0.75rem]" />
                    Reject
                  </ButtonDesigned>
                  <ButtonDesigned
                    variant="primary-black"
                    onClick={handleApprove}
                    className="grow shrink basis-0 min-w-0 flex gap-[0.31rem] items-center justify-center"
                  >
                    <img src={blueCheckIconUrl} alt="check" className="w-[0.75rem] h-[0.75rem] brightness-0 invert" />
                    Approve execution
                  </ButtonDesigned>
                </div>
              </div>
            )
          : (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Status</h3>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(message.status)}
                  <span className="text-sm">
                    This request has been
                    {' '}
                    {message.status}
                  </span>
                </div>

                {message.feedback && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Feedback</label>
                    <div className="bg-gray-100 p-3 rounded-lg text-sm">
                      {message.feedback}
                    </div>
                  </div>
                )}
              </div>
            )}
      </div>
    </Card>
  )
}
