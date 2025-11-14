import React, { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ResultsDialog } from './ResultsDialog'
import type { AbilityExecution } from '../hooks/useMCPEnhancedChat'

interface AbilityExecutionCardProps {
  execution: AbilityExecution
}

export const AbilityExecutionCard: React.FC<AbilityExecutionCardProps> = ({ execution }) => {
  const [expandedSection, setExpandedSection] = useState<'parameters' | 'results' | null>(null)
  const [showFullResults, setShowFullResults] = useState(false)

  const getStatusIcon = () => {
    switch (execution.status) {
      case 'executing':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
    }
  }

  const getStatusColor = () => {
    switch (execution.status) {
      case 'executing':
        return 'bg-blue-50 border-blue-200'
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
    }
  }

  const getDuration = () => {
    if (!execution.endTime) return null
    const duration = execution.endTime - execution.startTime
    return `${duration}ms`
  }

  const toggleSection = (section: 'parameters' | 'results') => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const formatJson = (data: any) => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  return (
    <Card className={`mb-2 border ${getStatusColor()}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <h4 className="font-medium text-sm">{execution.abilityName}</h4>
            <Badge variant="outline" className="text-xs">
              {execution.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {getDuration() && <span>{getDuration()}</span>}
            {execution.provider && (
              <span className="text-xs bg-gray-100 px-1 rounded">{execution.provider}</span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Parameters Section */}
        <div className="mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-8 px-2"
            onClick={() => toggleSection('parameters')}
          >
            <span className="text-xs font-medium">Parameters</span>
            {expandedSection === 'parameters' ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </Button>
          
          {expandedSection === 'parameters' && (
            <div className="mt-2 bg-gray-50 rounded p-2 border">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-32">
                {formatJson(execution.parameters)}
              </pre>
            </div>
          )}
        </div>

        {/* Results Section */}
        {(execution.response || execution.error) && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between h-8 px-2"
              onClick={() => toggleSection('results')}
            >
              <span className="text-xs font-medium">
                {execution.status === 'error' ? 'Error' : 'Results'}
              </span>
              {expandedSection === 'results' ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </Button>
            
            {expandedSection === 'results' && (
              <div className="mt-2">
                {execution.error && (
                  <div className="bg-red-50 rounded p-2 border border-red-200 mb-2">
                    <p className="text-xs text-red-700 font-medium mb-1">Error:</p>
                    <pre className="text-xs text-red-600 whitespace-pre-wrap overflow-auto max-h-32">
                      {execution.error}
                    </pre>
                  </div>
                )}
                
                {execution.response && (
                  <div className="bg-gray-50 rounded p-2 border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-600 font-medium">Response:</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-6 px-2"
                        onClick={() => setShowFullResults(true)}
                      >
                        View Full Results
                      </Button>
                    </div>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-48">
                      {formatJson(execution.response)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      {/* Results Dialog */}
      <ResultsDialog
        execution={execution}
        isOpen={showFullResults}
        onClose={() => setShowFullResults(false)}
      />
    </Card>
  )
}