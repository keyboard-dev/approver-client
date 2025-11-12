import React from 'react'
import { CheckCircle, Clock, Cog, AlertCircle } from 'lucide-react'
import { AgenticProgress } from '../hooks/useMCPEnhancedChat'

interface AgenticStatusIndicatorProps {
  isAgenticMode: boolean
  agenticProgress?: AgenticProgress
  isExecutingTool: boolean
  currentTool?: string
}

export const AgenticStatusIndicator: React.FC<AgenticStatusIndicatorProps> = ({
  isAgenticMode,
  agenticProgress,
  isExecutingTool,
  currentTool,
}) => {
  if (!isAgenticMode && !isExecutingTool) {
    return null
  }

  const getStatusIcon = () => {
    if (agenticProgress?.isComplete) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    }
    if (isExecutingTool) {
      return <Cog className="h-4 w-4 text-blue-500 animate-spin" />
    }
    if (agenticProgress) {
      return <Clock className="h-4 w-4 text-orange-500" />
    }
    return <AlertCircle className="h-4 w-4 text-gray-500" />
  }

  const getStatusText = () => {
    if (agenticProgress?.isComplete) {
      return "Task completed successfully"
    }
    if (isExecutingTool && currentTool) {
      return `Executing: ${currentTool}`
    }
    if (agenticProgress) {
      return agenticProgress.currentAction
    }
    if (isAgenticMode) {
      return "Agentic mode enabled"
    }
    return "Processing..."
  }

  const getProgressBar = () => {
    if (!agenticProgress) return null
    
    const progressPercent = (agenticProgress.step / agenticProgress.totalSteps) * 100

    return (
      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
        <div 
          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>
    )
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mx-2 mb-4 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center space-x-2">
        {getStatusIcon()}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {getStatusText()}
        </span>
        {agenticProgress && !agenticProgress.isComplete && (
          <span className="text-xs text-gray-500 ml-auto">
            Step {agenticProgress.step} of {agenticProgress.totalSteps}
          </span>
        )}
      </div>
      {getProgressBar()}
    </div>
  )
}