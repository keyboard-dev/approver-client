import type { ToolCallMessagePartComponent } from '@assistant-ui/react'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/button'

export const ToolFallback: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const isRunning = result === undefined
  return (
    <div className={`aui-tool-fallback-root mb-4 flex w-full flex-col gap-3 rounded-lg border py-3 ${isRunning ? 'border-blue-300 bg-blue-50/50' : ''}`}>
      <div className="aui-tool-fallback-header flex items-center gap-2 px-4">
        {isRunning
          ? <LoaderCircle className="aui-tool-fallback-icon size-4 animate-spin text-blue-500" />
          : <CheckIcon className="aui-tool-fallback-icon size-4 text-green-600" />}
        <p className="aui-tool-fallback-title flex-grow text-sm">
          {isRunning ? 'Running' : 'Used tool'}
          :
          {' '}
          <b>{toolName}</b>
        </p>
        <Button onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />}
        </Button>
      </div>
      {!isCollapsed && (
        <div className="aui-tool-fallback-content flex flex-col gap-2 border-t pt-2">
          <div className="aui-tool-fallback-args-root px-4">
            <pre className="aui-tool-fallback-args-value whitespace-pre-wrap text-xs text-muted-foreground">
              {argsText}
            </pre>
          </div>
          {result !== undefined && (
            <div className="aui-tool-fallback-result-root border-t border-dashed px-4 pt-2">
              <p className="aui-tool-fallback-result-header text-xs font-semibold">
                Result:
              </p>
              <pre className="aui-tool-fallback-result-content whitespace-pre-wrap overflow-x-auto rounded-lg bg-black p-3 text-xs text-white max-h-[300px] overflow-y-auto">
                <code>
                  {typeof result === 'string'
                    ? result
                    : JSON.stringify(result, null, 2)}
                </code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
