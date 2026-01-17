import React, { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Card } from './ui/card'

interface EncryptionKeyInfo {
  key: string | null
  createdAt: number | null
  keyFile: string
  source: 'environment' | 'generated' | null
}

interface EncryptionKeyManagerProps {
  className?: string
}

const EncryptionKeyManager: React.FC<EncryptionKeyManagerProps> = ({ className = '' }) => {
  const [keyInfo, setKeyInfo] = useState<EncryptionKeyInfo>({ key: null, createdAt: null, keyFile: '', source: null })
  const [isLoading, setIsLoading] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [showFullKey, setShowFullKey] = useState(false)

  // Load initial key info
  useEffect(() => {
    loadKeyInfo()

    // Listen for key generation events
    const handleKeyGenerated = (_event: unknown, data: { key: string, createdAt: number, source: string }) => {
      setKeyInfo(prev => ({
        ...prev,
        key: data.key,
        createdAt: data.createdAt,
        source: data.source as 'environment' | 'generated',
      }))
    }

    window.electronAPI.onEncryptionKeyGenerated(handleKeyGenerated)

    return () => {
      window.electronAPI.removeAllListeners('encryption-key-generated')
    }
  }, [])

  const loadKeyInfo = async () => {
    try {
      const info = await window.electronAPI.getEncryptionKeyInfo()
      setKeyInfo(info)
    }
    catch (error) {
    }
  }

  const handleRegenerateKey = async () => {
    if (keyInfo.source === 'environment') {
      alert('Cannot regenerate encryption key when using environment variable. Please remove the ENCRYPTION_KEY environment variable to use a generated key.')
      return
    }

    if (!confirm('Are you sure you want to regenerate the encryption key? This will invalidate all previously encrypted data.')) {
      return
    }

    setIsLoading(true)
    try {
      const result = await window.electronAPI.regenerateEncryptionKey()
      setKeyInfo(prev => ({
        ...prev,
        key: result.key,
        createdAt: result.createdAt,
        source: result.source as 'environment' | 'generated',
      }))
    }
    catch (error) {
      alert('Failed to regenerate encryption key. Check console for details.')
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

  const getSourceBadge = (source: 'environment' | 'generated' | null) => {
    switch (source) {
      case 'environment':
        return '🌍 Environment Variable'
      case 'generated':
        return '🔧 Generated'
      default:
        return '❓ Unknown'
    }
  }

  const getSourceDescription = (source: 'environment' | 'generated' | null) => {
    switch (source) {
      case 'environment':
        return 'This key is loaded from the ENCRYPTION_KEY environment variable and takes priority over generated keys.'
      case 'generated':
        return 'This key was automatically generated and stored securely on your local machine.'
      default:
        return 'Unable to determine key source.'
    }
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Encryption Key</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {keyInfo.key ? '🔐 Active' : '⚠️ No Key'}
            </span>
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
              {getSourceBadge(keyInfo.source)}
            </span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Active Encryption Key
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

          <div className="text-sm text-gray-600">
            <p className="font-medium mb-1">Key Source:</p>
            <p>{getSourceDescription(keyInfo.source)}</p>
          </div>
        </div>

        {keyInfo.source === 'generated' && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Created:
              {' '}
              {formatDate(keyInfo.createdAt)}
            </span>
            <span>
              Auto-regenerates every 365 days
            </span>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">Key Priority</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>
              •
              <strong>Environment Variable:</strong>
              {' '}
              ENCRYPTION_KEY takes highest priority
            </p>
            <p>
              •
              <strong>Generated Key:</strong>
              {' '}
              Used when no environment variable is set
            </p>
            <p>
              •
              <strong>Security:</strong>
              {' '}
              All keys are 32-byte AES-256 keys
            </p>
            <p>
              •
              <strong>Storage:</strong>
              {' '}
              Generated keys are stored securely on your local machine
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-500">
            {keyInfo.source === 'generated' && (
              <>
                Key file:
                <code className="text-xs">{keyInfo.keyFile}</code>
              </>
            )}
            {keyInfo.source === 'environment' && (
              <>
                Using environment variable:
                <code className="text-xs">ENCRYPTION_KEY</code>
              </>
            )}
          </div>
          <Button
            variant="outline"
            onClick={handleRegenerateKey}
            disabled={isLoading || keyInfo.source === 'environment'}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {isLoading ? 'Regenerating...' : 'Regenerate Key'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default EncryptionKeyManager
