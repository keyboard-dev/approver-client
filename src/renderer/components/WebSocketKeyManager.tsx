import React, { useState, useEffect } from 'react'

import { Button } from './ui/button'
import { Card } from './ui/card'

interface WebSocketKeyInfo {
  key: string | null
  createdAt: number | null
  keyFile: string
}

interface WebSocketKeyManagerProps {
  className?: string
}

const WebSocketKeyManager: React.FC<WebSocketKeyManagerProps> = ({ className = '' }) => {
  const [keyInfo, setKeyInfo] = useState<WebSocketKeyInfo>({ key: null, createdAt: null, keyFile: '' })
  const [connectionUrl, setConnectionUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [showFullKey, setShowFullKey] = useState(false)

  useEffect(() => {
    loadKeyInfo()

    const handleKeyGenerated = (_event: unknown, data: { key: string, createdAt: number }) => {
      setKeyInfo(prev => ({
        ...prev,
        key: data.key,
        createdAt: data.createdAt,
      }))
      loadConnectionUrl()
    }

    window.electronAPI.onWSKeyGenerated(handleKeyGenerated)

    return () => {
      window.electronAPI.removeAllListeners('ws-key-generated')
    }
  }, [])

  const loadKeyInfo = async () => {
    try {
      const info = await window.electronAPI.getWSKeyInfo()
      setKeyInfo(info)
      loadConnectionUrl()
    }
    catch (error) {
      console.error('Error loading key info:', error)
    }
  }

  const loadConnectionUrl = async () => {
    try {
      const url = await window.electronAPI.getWSConnectionUrl()
      setConnectionUrl(url)
    }
    catch (error) {
      console.error('Error loading connection URL:', error)
    }
  }

  const handleRegenerateKey = async () => {
    const confirmRegenerate = confirm(
      'Are you sure you want to regenerate the WebSocket key? This will invalidate all existing connections.',
    )

    if (!confirmRegenerate) {
      return
    }

    setIsLoading(true)
    try {
      const result = await window.electronAPI.regenerateWSKey()
      setKeyInfo(prev => ({
        ...prev,
        key: result.key,
        createdAt: result.createdAt,
      }))
      loadConnectionUrl()
    }
    catch (error) {
      console.error('Error regenerating key:', error)
    }
    finally {
      setIsLoading(false)
    }
  }

  const handleCopyKey = async () => {
    if (!keyInfo.key) return

    try {
      await navigator.clipboard.writeText(keyInfo.key)
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
    catch (error) {
      console.error('Error copying key:', error)
      setCopyStatus('error')
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }

  const handleCopyUrl = async () => {
    if (!connectionUrl) return

    try {
      await navigator.clipboard.writeText(connectionUrl)
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
    catch (error) {
      console.error('Error copying URL:', error)
      setCopyStatus('error')
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Unknown'
    return new Date(timestamp).toLocaleString()
  }

  const truncateKey = (key: string | null) => {
    if (!key) return 'Not available'
    if (showFullKey) return key
    return `${key.substring(0, 8)}...${key.substring(key.length - 8)}`
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">WebSocket Connection Key</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {keyInfo.key ? '🔐 Secure' : '⚠️ No Key'}
            </span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Connection Key
            </label>
            <div className="flex items-center space-x-2">
              <code className="flex-1 bg-white px-3 py-2 rounded border text-sm font-mono">
                {truncateKey(keyInfo.key)}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFullKey(!showFullKey)}
                disabled={!keyInfo.key}
              >
                {showFullKey ? 'Hide' : 'Show'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyKey}
                disabled={!keyInfo.key}
              >
                {copyStatus === 'copied' ? '✓ Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Connection URL
            </label>
            <div className="flex items-center space-x-2">
              <code className="flex-1 bg-white px-3 py-2 rounded border text-sm font-mono break-all">
                {connectionUrl || 'Not available'}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyUrl}
                disabled={!connectionUrl}
              >
                Copy URL
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Created:
            {' '}
            {formatDate(keyInfo.createdAt)}
          </span>
          <span>
            Auto-regenerates every 30 days
          </span>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">How to Use</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• Copy the connection URL above</p>
            <p>• Use it in your client applications to connect securely</p>
            <p>• Only applications with this key can connect to the approver</p>
            <p>• The key is stored securely on your local machine</p>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-500">
            Key file:
            {' '}
            <code className="text-xs">{keyInfo.keyFile}</code>
          </div>
          <Button
            variant="outline"
            onClick={handleRegenerateKey}
            disabled={isLoading}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {isLoading ? 'Regenerating...' : 'Regenerate Key'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default WebSocketKeyManager
