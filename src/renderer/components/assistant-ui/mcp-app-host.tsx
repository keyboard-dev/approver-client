import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMcpClientContext } from '../../services/mcp-client-context'

interface McpAppHostProps {
  resourceUri: string
  toolArgs: Record<string, unknown>
  toolResult?: string
  toolName: string
}

export const McpAppHost: React.FC<McpAppHostProps> = ({
  resourceUri,
  toolArgs,
  toolResult,
  toolName,
}) => {
  const { callTool, readResource } = useMcpClientContext()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const bridgeRef = useRef<AppBridge | null>(null)
  const initializedRef = useRef(false)
  const sentResultRef = useRef(false)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [iframeHeight, setIframeHeight] = useState(450)

  // Stable refs for values needed in the bridge setup callback
  const callToolRef = useRef(callTool)
  callToolRef.current = callTool
  const toolArgsRef = useRef(toolArgs)
  toolArgsRef.current = toolArgs
  const toolResultRef = useRef(toolResult)
  toolResultRef.current = toolResult

  // Fetch HTML resource on mount
  useEffect(() => {
    let cancelled = false
    const fetchResource = async () => {
      try {
        const result = await readResource(resourceUri)
        if (cancelled) return
        const textContent = result.contents
          ?.filter((c: any) => c.text)
          .map((c: any) => c.text)
          .join('')
        if (textContent) {
          setHtmlContent(textContent)
        }
        else {
          setError('Empty resource content')
        }
      }
      catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load widget')
        }
      }
    }
    fetchResource()
    return () => { cancelled = true }
  }, [resourceUri, readResource])

  // Handle tool result changes - send to bridge when available
  useEffect(() => {
    if (toolResult && bridgeRef.current && initializedRef.current && !sentResultRef.current) {
      sentResultRef.current = true
      try {
        const parsed = JSON.parse(toolResult)
        bridgeRef.current.sendToolResult(parsed)
      }
      catch {
        bridgeRef.current.sendToolResult({
          content: [{ type: 'text', text: toolResult }],
        })
      }
    }
  }, [toolResult])

  // Set up AppBridge on the iframe BEFORE its content executes.
  // The widget's App.connect() fires at module load time (synchronously when srcDoc is parsed),
  // so the host must be listening for postMessages before the iframe's JS runs.
  // We use a ref callback: React calls it as soon as the <iframe> DOM node is created
  // (before srcDoc content loads), giving us time to set up the bridge.
  const iframeRefCallback = useCallback((iframe: HTMLIFrameElement | null) => {
    // Store in iframeRef for other code to access
    (iframeRef as React.MutableRefObject<HTMLIFrameElement | null>).current = iframe
    if (!iframe || bridgeRef.current) return

    const setupBridge = () => {
      if (!iframe.contentWindow || bridgeRef.current) {
        setTimeout(setupBridge, 10)
        return
      }

      try {
        const bridge = new AppBridge(
          null,
          { name: 'keyboard-approver', version: '1.0.0' },
          { openLinks: {}, serverTools: {}, logging: {} },
        )
        bridgeRef.current = bridge

        bridge.oncalltool = async (params: { name: string, arguments?: Record<string, unknown> }) => {
          try {
            const result = await callToolRef.current(params.name, params.arguments || {})
            return result
          }
          catch (e) {
            throw e
          }
        }

        bridge.onmessage = async (msg: unknown) => {
          return {}
        }

        bridge.onopenlink = async ({ url }: { url: string }) => {
          if (window.electronAPI?.openExternalUrl) {
            window.electronAPI.openExternalUrl(url)
          }
          else {
            window.open(url, '_blank', 'noopener,noreferrer')
          }
          return {}
        }

        bridge.onsizechange = ({ height }: { width?: number, height?: number }) => {
          if (height != null && height > 0) {
            setIframeHeight(Math.min(Math.max(height, 200), 800))
          }
        }

        bridge.oninitialized = () => {
          initializedRef.current = true
          bridge.sendToolInput({ arguments: toolArgsRef.current })

          const currentToolResult = toolResultRef.current
          if (currentToolResult && !sentResultRef.current) {
            sentResultRef.current = true
            try {
              bridge.sendToolResult(JSON.parse(currentToolResult))
            }
            catch {
              bridge.sendToolResult({
                content: [{ type: 'text', text: currentToolResult }],
              })
            }
          }
        }

        const transport = new PostMessageTransport(
          iframe.contentWindow,
          iframe.contentWindow,
        )
        bridge.connect(transport).then(() => {
        }).catch((err) => {
        })
      }
      catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to initialize widget')
      }
    }

    // Kick off setup on next microtask (contentWindow needs DOM attachment)
    setTimeout(setupBridge, 0)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bridgeRef.current) {
        bridgeRef.current.teardownResource({}).catch(() => {})
        bridgeRef.current = null
      }
      initializedRef.current = false
      sentResultRef.current = false
    }
  }, [])

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        Widget error:
        {' '}
        {error}
      </div>
    )
  }

  if (!htmlContent) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
        <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading
        {' '}
        {toolName}
        {' '}
        widget...
      </div>
    )
  }

  return (
    <div className="mcp-app-host w-full overflow-hidden rounded-lg border">
      <iframe
        ref={iframeRefCallback}
        srcDoc={htmlContent}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        style={{
          width: '100%',
          height: `${iframeHeight}px`,
          border: 'none',
          display: 'block',
        }}
        title={`${toolName} widget`}
      />
    </div>
  )
}
