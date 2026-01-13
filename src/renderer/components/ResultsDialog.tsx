import React, { useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import type { AbilityExecution } from '../hooks/useMCPEnhancedChat'

interface ResultsDialogProps {
  execution: AbilityExecution
  isOpen: boolean
  onClose: () => void
}

export const ResultsDialog: React.FC<ResultsDialogProps> = ({ execution, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false)

  const formatJson = (data: any) => {
    try {
      return JSON.stringify(data, null, 2)
    }
    catch {
      return String(data)
    }
  }

  const copyToClipboard = async () => {
    try {
      const content = execution.response ? formatJson(execution.response) : execution.error || ''
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    catch (error) {
    }
  }

  const getResponseSize = () => {
    const content = execution.response ? formatJson(execution.response) : execution.error || ''
    const bytes = new Blob([content]).size
    if (bytes < 1024) return `${bytes} bytes`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[80vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <DialogTitle className="text-lg font-semibold">
              {execution.abilityName}
              {' '}
              - Full Results
            </DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              {execution.status === 'error' ? 'Error Details' : 'Response Data'}
              {' '}
              •
              {getResponseSize()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              className="flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {execution.error
            ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 h-full overflow-auto">
                  <h4 className="text-red-800 font-medium mb-2">Error Details:</h4>
                  <pre className="text-red-700 text-sm whitespace-pre-wrap font-mono">
                    {execution.error}
                  </pre>
                </div>
              )
            : execution.response
              ? (
                  <div className="bg-gray-50 border rounded-lg p-4 h-full overflow-auto">
                    <h4 className="text-gray-800 font-medium mb-2">Response Data:</h4>
                    <pre className="text-gray-800 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                      {formatJson(execution.response)}
                    </pre>
                  </div>
                )
              : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>No response data available</p>
                  </div>
                )}
        </div>

        {/* Additional metadata */}
        <div className="border-t pt-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Status:</span>
              <span className={`ml-2 font-medium ${
                execution.status === 'success'
                  ? 'text-green-600'
                  : execution.status === 'error' ? 'text-red-600' : 'text-blue-600'
              }`}
              >
                {execution.status}
              </span>
            </div>
            {execution.duration && (
              <div>
                <span className="text-gray-500">Duration:</span>
                <span className="ml-2 font-mono">
                  {execution.duration}
                  ms
                </span>
              </div>
            )}
            {execution.provider && (
              <div>
                <span className="text-gray-500">Provider:</span>
                <span className="ml-2 font-mono">{execution.provider}</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Timestamp:</span>
              <span className="ml-2 font-mono">
                {new Date(execution.startTime).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
