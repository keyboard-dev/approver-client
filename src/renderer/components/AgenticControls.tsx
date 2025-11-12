import React from 'react'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Bot, BotOff, Settings } from 'lucide-react'

interface AgenticControlsProps {
  isAgenticMode: boolean
  onToggleAgenticMode: (enabled: boolean) => void
  mcpEnabled: boolean
  mcpConnected: boolean
  mcpTools: number
  onToggleMCP: (enabled: boolean) => void
  onRefreshMCP: () => void
}

export const AgenticControls: React.FC<AgenticControlsProps> = ({
  isAgenticMode,
  onToggleAgenticMode,
  mcpEnabled,
  mcpConnected,
  mcpTools,
  onToggleMCP,
  onRefreshMCP,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mx-2 mb-4 dark:bg-gray-800 dark:border-gray-700">
      <div className="space-y-4">
        {/* Agentic Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isAgenticMode ? (
              <Bot className="h-4 w-4 text-blue-500" />
            ) : (
              <BotOff className="h-4 w-4 text-gray-400" />
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Agentic Mode
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                AI will work continuously until task completion
              </p>
            </div>
          </div>
          <Switch
            checked={isAgenticMode}
            onCheckedChange={onToggleAgenticMode}
            disabled={!mcpEnabled || !mcpConnected}
          />
        </div>

        {/* MCP Integration Status */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Settings className="h-4 w-4 text-gray-500" />
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  MCP Integration
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {mcpConnected
                    ? `Connected • ${mcpTools} abilities available`
                    : 'Disconnected • No abilities available'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={mcpEnabled}
                onCheckedChange={onToggleMCP}
              />
              {mcpEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefreshMCP}
                  className="px-2 py-1 text-xs"
                >
                  Refresh
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center space-x-2 text-xs">
          <div
            className={`w-2 h-2 rounded-full ${
              mcpConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-gray-500 dark:text-gray-400">
            {mcpConnected ? 'Ready for agentic operation' : 'MCP connection required'}
          </span>
        </div>
      </div>
    </div>
  )
}