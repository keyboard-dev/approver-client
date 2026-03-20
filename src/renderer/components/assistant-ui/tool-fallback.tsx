import type { ToolCallMessagePartComponent } from '@assistant-ui/react'
import { CheckIcon, LoaderCircle, XCircle } from 'lucide-react'
import { useMcpClientContext } from '../../services/mcp-client-context'
import { McpAppHost } from './mcp-app-host'
import { GenericToolPart } from './tool-parts'

export const ToolFallback: ToolCallMessagePartComponent = ({
  toolName,
  args,
  result,
  isError,
}) => {
  const isRunning = result === undefined
  const isFailed = isError && !isRunning

  // Check if this tool has an MCP App UI widget
  let resourceUri: string | undefined
  try {
    const ctx = useMcpClientContext()
    resourceUri = ctx.toolResourceMap.get(toolName)
  }
  catch {
    // Context not available — no widget rendering
  }

  // Render MCP App widget if tool has a UI resource
  if (resourceUri) {
    return (
      <div className={`aui-tool-fallback-root mb-4 flex w-full flex-col gap-3 rounded-lg border py-3 ${isFailed ? 'border-red-300 bg-red-50/50' : ''}`}>
        <div className="aui-tool-fallback-header flex items-center gap-2 px-4">
          {isRunning
            ? <LoaderCircle className="aui-tool-fallback-icon size-4 animate-spin text-blue-500" />
            : isFailed
              ? <XCircle className="aui-tool-fallback-icon size-4 text-red-500" />
              : <CheckIcon className="aui-tool-fallback-icon size-4 text-green-600" />}
          <p className="aui-tool-fallback-title flex-grow text-sm">
            {isRunning ? 'Running' : isFailed ? 'Failed' : 'Used tool'}
            :
            {' '}
            <b>{toolName}</b>
          </p>
        </div>
        <div className="px-4">
          <McpAppHost
            resourceUri={resourceUri}
            toolArgs={args as Record<string, unknown> ?? {}}
            toolResult={typeof result === 'string' ? result : result !== undefined ? JSON.stringify(result, null, 2) : undefined}
            toolName={toolName}
          />
        </div>
      </div>
    )
  }

  // Non-widget tools: render GenericToolPart for rich inline display
  return <GenericToolPart toolName={toolName} argsText={typeof args === 'object' ? JSON.stringify(args) : ''} result={result} isError={isError} />
}
