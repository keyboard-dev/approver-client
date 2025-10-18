import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { CodespaceConnectionInfo } from '../../github-codespaces'
import { ConnectionTarget } from '../../websocket-client-to-executor'

interface CodespaceSelectorProps {
  connectionInfo: { connected: boolean, target?: ConnectionTarget }
  codespaces: CodespaceConnectionInfo[]
  loading: boolean
  onConnectToCodespace: (codespaceName: string) => Promise<boolean>
  onConnectToLocalhost: () => void
  onRefreshCodespaces: () => Promise<void>
  onDisconnect: () => void
}

const CodespaceSelector: React.FC<CodespaceSelectorProps> = ({
  connectionInfo,
  codespaces,
  loading,
  onConnectToCodespace,
  onConnectToLocalhost,
  onRefreshCodespaces,
  onDisconnect,
}) => {
  const [connecting, setConnecting] = useState<string | null>(null)

  const handleConnectToCodespace = async (codespaceName: string) => {
    setConnecting(codespaceName)
    try {
      await onConnectToCodespace(codespaceName)
    }
    finally {
      setConnecting(null)
    }
  }

  const handleConnectToLocalhost = () => {
    setConnecting('localhost')
    try {
      onConnectToLocalhost()
    }
    finally {
      setConnecting(null)
    }
  }

  const formatLastUsed = (lastUsedAt: string) => {
    const date = new Date(lastUsedAt)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`
    }
    else if (diffMinutes < 1440) {
      return `${Math.floor(diffMinutes / 60)}h ago`
    }
    else {
      return `${Math.floor(diffMinutes / 1440)}d ago`
    }
  }

  const getStatusBadge = (codespace: CodespaceConnectionInfo) => {
    if (codespace.available) {
      return <Badge variant="default" className="bg-green-500 text-white">Available</Badge>
    }
    else {
      return <Badge variant="destructive">No WebSocket</Badge>
    }
  }

  const getConnectionBadge = (target?: ConnectionTarget) => {
    if (!target) return null

    if (target.type === 'localhost') {
      return <Badge variant="secondary">Connected to Localhost</Badge>
    }
    else {
      return (
        <Badge variant="default" className="bg-blue-500 text-white">
          Connected to
          {target.name}
        </Badge>
      )
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>WebSocket Connection</CardTitle>
            <CardDescription>
              Connect to a GitHub Codespace or localhost executor
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {connectionInfo.connected && getConnectionBadge(connectionInfo.target)}
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshCodespaces}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
            {connectionInfo.connected && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onDisconnect}
              >
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Localhost Option */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Localhost</h4>
              <p className="text-sm text-muted-foreground">
                Connect to local executor on port 4000
              </p>
            </div>
            <div className="flex items-center gap-2">
              {connectionInfo.connected && connectionInfo.target?.type === 'localhost' && (
                <Badge variant="default" className="bg-green-500 text-white">Connected</Badge>
              )}
              <Button
                size="sm"
                onClick={handleConnectToLocalhost}
                disabled={connecting === 'localhost' || (connectionInfo.connected && connectionInfo.target?.type === 'localhost')}
              >
                {connecting === 'localhost' ? 'Connecting...' : 'Connect'}
              </Button>
            </div>
          </div>
        </div>

        {/* Codespaces */}
        {codespaces.length > 0
          ? (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">GitHub Codespaces</h4>
                {codespaces.map(info => (
                  <div key={info.codespace.name} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">
                            {info.codespace.display_name || info.codespace.name}
                          </h4>
                          {getStatusBadge(info)}
                          {connectionInfo.connected && connectionInfo.target?.codespaceName === info.codespace.name && (
                            <Badge variant="default" className="bg-green-500 text-white">Connected</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{info.codespace.repository.full_name}</span>
                          <span>•</span>
                          <span>{formatLastUsed(info.codespace.last_used_at)}</span>
                          <span>•</span>
                          <span className="capitalize">{info.codespace.state.toLowerCase()}</span>
                        </div>
                        {!info.available && info.error && (
                          <p className="text-xs text-red-500 mt-1">{info.error}</p>
                        )}
                        {info.websocketUrl && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                            {info.websocketUrl}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          onClick={() => handleConnectToCodespace(info.codespace.name)}
                          disabled={
                            !info.available
                            || connecting === info.codespace.name
                            || (connectionInfo.connected && connectionInfo.target?.codespaceName === info.codespace.name)
                          }
                        >
                          {connecting === info.codespace.name ? 'Connecting...' : 'Connect'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          : loading
            ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Loading codespaces...</p>
                </div>
              )
            : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No active codespaces found</p>
                  <p className="text-xs mt-1">
                    Make sure you have running codespaces with port 4000 forwarded
                  </p>
                </div>
              )}
      </CardContent>
    </Card>
  )
}

export default CodespaceSelector
