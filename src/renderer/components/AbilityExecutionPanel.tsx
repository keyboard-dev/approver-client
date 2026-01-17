import React, { useState } from 'react'
import { X, Code, Activity, ChevronUp, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { AbilityExecutionCard } from './AbilityExecutionCard'
import type { AbilityExecution } from '../hooks/useMCPEnhancedChat'

interface AbilityExecutionPanelProps {
  executions: AbilityExecution[]
  isVisible: boolean
  onClose: () => void
  currentStep?: number
  totalSteps?: number
  currentAction?: string
}

export const AbilityExecutionPanel: React.FC<AbilityExecutionPanelProps> = ({
  executions,
  isVisible,
  onClose,
  currentStep,
  totalSteps,
  currentAction,
}) => {
  const [isMinimized, setIsMinimized] = useState(false)

  if (!isVisible) return null

  const activeExecutions = executions.filter(e => e.status === 'executing')
  const completedExecutions = executions.filter(e => e.status !== 'executing')
  const totalExecutions = executions.length
  const successfulExecutions = executions.filter(e => e.status === 'success').length
  const failedExecutions = executions.filter(e => e.status === 'error').length

  return (
    <div className="fixed top-4 right-4 w-96 max-h-[80vh] z-50">
      <Card className="shadow-lg border-2 border-blue-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">Ability Executions</CardTitle>
              {totalExecutions > 0 && (
                <Badge variant="outline" className="text-xs">
                  {totalExecutions}
                  {' '}
                  total
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 h-8 w-8"
              >
                {isMinimized
                  ? (
                      <ChevronUp className="w-4 h-4" />
                    )
                  : (
                      <ChevronDown className="w-4 h-4" />
                    )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="p-1 h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Progress Summary */}
          {!isMinimized && (currentStep !== undefined && totalSteps !== undefined) && (
            <div className="mt-2 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>
                  Step
                  {currentStep}
                  {' '}
                  of
                  {totalSteps}
                </span>
                <span>
                  {Math.round((currentStep / totalSteps) * 100)}
                  %
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
              </div>
              {currentAction && (
                <p className="text-xs text-gray-600 italic">{currentAction}</p>
              )}
            </div>
          )}

          {/* Execution Stats */}
          {!isMinimized && totalExecutions > 0 && (
            <div className="flex gap-2 mt-2">
              {activeExecutions.length > 0 && (
                <Badge className="bg-blue-100 text-blue-800 text-xs">
                  {activeExecutions.length}
                  {' '}
                  executing
                </Badge>
              )}
              {successfulExecutions > 0 && (
                <Badge className="bg-green-100 text-green-800 text-xs">
                  {successfulExecutions}
                  {' '}
                  success
                </Badge>
              )}
              {failedExecutions > 0 && (
                <Badge className="bg-red-100 text-red-800 text-xs">
                  {failedExecutions}
                  {' '}
                  failed
                </Badge>
              )}
            </div>
          )}
        </CardHeader>

        {!isMinimized && (
          <CardContent className="pt-0">
            {totalExecutions === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Code className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No ability executions yet</p>
                <p className="text-xs">Abilities will appear here during agentic workflows</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {/* Active Executions First */}
                {activeExecutions.map(execution => (
                  <AbilityExecutionCard
                    key={execution.id}
                    execution={execution}
                  />
                ))}

                {/* Completed Executions */}
                {completedExecutions.map(execution => (
                  <AbilityExecutionCard
                    key={execution.id}
                    execution={execution}
                  />
                ))}
              </div>
            )}

            {totalExecutions > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    // Clear executions - we can add this functionality later
                  }}
                >
                  Clear History
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
