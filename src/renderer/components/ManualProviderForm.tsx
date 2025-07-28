import React, { useState } from 'react'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Textarea } from '../../components/ui/textarea'

interface ManualProviderFormProps {
  onSave: (config: any) => Promise<void>
  onCancel: () => void
  initialConfig?: any
  isEditing?: boolean
}

export const ManualProviderForm: React.FC<ManualProviderFormProps> = ({
  onSave,
  onCancel,
  initialConfig,
  isEditing = false,
}) => {
  const [config, setConfig] = useState({
    id: initialConfig?.id || '',
    name: initialConfig?.name || '',
    icon: initialConfig?.icon || '🔗',
    clientId: initialConfig?.clientId || '',
    clientSecret: initialConfig?.clientSecret || '',
    authorizationUrl: initialConfig?.authorizationUrl || '',
    tokenUrl: initialConfig?.tokenUrl || '',
    userInfoUrl: initialConfig?.userInfoUrl || '',
    scopes: initialConfig?.scopes?.join(', ') || '',
    usePKCE: initialConfig?.usePKCE ?? true,
    redirectUri: initialConfig?.redirectUri || 'http://localhost:8082/callback',
    additionalParams: JSON.stringify(initialConfig?.additionalParams || {}, null, 2),
    isCustom: true,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // Validate required fields
      if (!config.id || !config.name || !config.clientId || !config.authorizationUrl || !config.tokenUrl) {
        throw new Error('Please fill in all required fields')
      }

      // Parse additional params
      let additionalParams = {}
      if (config.additionalParams.trim()) {
        try {
          additionalParams = JSON.parse(config.additionalParams)
        }
        catch (err) {
          throw new Error('Invalid JSON in additional parameters')
        }
      }

      // Create provider config
      const providerConfig = {
        id: config.id,
        name: config.name,
        icon: config.icon,
        clientId: config.clientId,
        clientSecret: config.clientSecret || undefined,
        authorizationUrl: config.authorizationUrl,
        tokenUrl: config.tokenUrl,
        userInfoUrl: config.userInfoUrl || undefined,
        scopes: config.scopes.split(',').map(s => s.trim()).filter(s => s),
        usePKCE: config.usePKCE,
        redirectUri: config.redirectUri,
        additionalParams: Object.keys(additionalParams).length > 0 ? additionalParams : undefined,
        isCustom: true,
      }

      await onSave(providerConfig)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
    finally {
      setIsLoading(false)
    }
  }

  const popularProviders = [
    {
      name: 'Google',
      icon: '🔍',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v1/userinfo',
      scopes: 'openid, email, profile',
      usePKCE: true,
      additionalParams: { access_type: 'offline', prompt: 'consent' },
    },
    {
      name: 'GitHub',
      icon: '🐙',
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user',
      scopes: 'user:email, repo',
      usePKCE: false,
    },
    {
      name: 'Microsoft',
      icon: '🪟',
      authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      scopes: 'openid, profile, email, User.Read',
      usePKCE: true,
    },
    {
      name: 'Discord',
      icon: '💬',
      authorizationUrl: 'https://discord.com/api/oauth2/authorize',
      tokenUrl: 'https://discord.com/api/oauth2/token',
      userInfoUrl: 'https://discord.com/api/users/@me',
      scopes: 'identify, email',
      usePKCE: true,
    },
  ]

  const fillTemplate = (template: any) => {
    setConfig(prev => ({
      ...prev,
      name: template.name,
      icon: template.icon,
      authorizationUrl: template.authorizationUrl,
      tokenUrl: template.tokenUrl,
      userInfoUrl: template.userInfoUrl || '',
      scopes: template.scopes,
      usePKCE: template.usePKCE,
      additionalParams: JSON.stringify(template.additionalParams || {}, null, 2),
      id: prev.id || template.name.toLowerCase(),
    }))
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">
          {isEditing ? 'Edit OAuth Provider' : 'Add Custom OAuth Provider'}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Configure a custom OAuth provider by filling in the details below
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {!isEditing && (
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-2">Quick Templates</h4>
          <div className="grid grid-cols-2 gap-2">
            {popularProviders.map(provider => (
              <Button
                key={provider.name}
                variant="outline"
                size="sm"
                onClick={() => fillTemplate(provider)}
                className="flex items-center justify-start"
              >
                <span className="mr-2">{provider.icon}</span>
                {provider.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Provider ID
              {' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={config.id}
              onChange={e => setConfig(prev => ({ ...prev, id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="e.g., google"
              disabled={isEditing}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Unique identifier (cannot be changed after creation)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Display Name
              {' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={config.name}
              onChange={e => setConfig(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="e.g., Google"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Icon</label>
            <input
              type="text"
              value={config.icon}
              onChange={e => setConfig(prev => ({ ...prev, icon: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="🔗"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Redirect URI</label>
            <input
              type="url"
              value={config.redirectUri}
              onChange={e => setConfig(prev => ({ ...prev, redirectUri: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="http://localhost:8082/callback"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Client ID
              {' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={config.clientId}
              onChange={e => setConfig(prev => ({ ...prev, clientId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="Your OAuth app client ID"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Client Secret</label>
            <input
              type="password"
              value={config.clientSecret}
              onChange={e => setConfig(prev => ({ ...prev, clientSecret: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="Optional for PKCE flows"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Authorization URL
            {' '}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={config.authorizationUrl}
            onChange={e => setConfig(prev => ({ ...prev, authorizationUrl: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="https://provider.com/oauth/authorize"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Token URL
            {' '}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={config.tokenUrl}
            onChange={e => setConfig(prev => ({ ...prev, tokenUrl: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="https://provider.com/oauth/token"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">User Info URL</label>
          <input
            type="url"
            value={config.userInfoUrl}
            onChange={e => setConfig(prev => ({ ...prev, userInfoUrl: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="https://provider.com/user (optional)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Scopes</label>
          <input
            type="text"
            value={config.scopes}
            onChange={e => setConfig(prev => ({ ...prev, scopes: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="openid, email, profile (comma-separated)"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="usePKCE"
            checked={config.usePKCE}
            onChange={e => setConfig(prev => ({ ...prev, usePKCE: e.target.checked }))}
            className="mr-2"
          />
          <label htmlFor="usePKCE" className="text-sm">
            Use PKCE (Recommended for security)
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Additional Parameters (JSON)</label>
          <Textarea
            value={config.additionalParams}
            onChange={e => setConfig(prev => ({ ...prev, additionalParams: e.target.value }))}
            className="w-full text-sm font-mono"
            rows={3}
            placeholder='{"access_type": "offline", "prompt": "consent"}'
          />
          <p className="text-xs text-gray-500 mt-1">
            Optional extra parameters to include in the authorization request
          </p>
        </div>

        <div className="flex items-center gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? '⏳ Saving...' : (isEditing ? '💾 Update Provider' : '✅ Add Provider')}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}
