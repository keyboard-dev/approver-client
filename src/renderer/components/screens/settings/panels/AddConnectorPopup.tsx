/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useState } from 'react'
import { OAuthProviderConfig } from '../../../../../provider-storage'
import { Popup } from '../../../ui/Popup'
import { Tooltip } from '../../../ui/tooltip'

interface ProviderTemplate {
  name: string
  icon: string
  authorizationUrl: string
  tokenUrl: string
  userInfoUrl?: string
  scopes: string
  usePKCE: boolean
  additionalParams?: Record<string, unknown>
}

interface ManualProviderFormProps {
  onSave: (config: Omit<OAuthProviderConfig, 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
  initialConfig: OAuthProviderConfig | null
  isEditing?: boolean
}

export const AddConnectorPopup: React.FC<ManualProviderFormProps> = ({
  onSave,
  onCancel,
  initialConfig,
  isEditing = false,
}) => {
  const [config, setConfig] = useState({
    id: initialConfig?.id || '',
    name: initialConfig?.name || '',
    icon: initialConfig?.iconSrc || '🔗',
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
        catch {
          throw new Error('Invalid JSON in additional parameters')
        }
      }

      // Create provider config
      const providerConfig = {
        id: config.id,
        name: config.name,
        iconSrc: config.icon,
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

  const fillTemplate = (template: ProviderTemplate) => {
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
    <Popup
      onCancel={onCancel}
    >
      <div
        className="flex flex-col gap-[1rem]"
      >
        <div
          className="text-[1rem] text-[#000] font-semibold"
        >
          Add a custom connector
        </div>

        <div
          className="flex flex-col gap-[0.75rem]"
        >
          <div
            className="flex flex-col gap-[0.38rem]"
          >
            <div
              className="text-[#000]"
            >
              Connector name
              {' '}
              <span className="text-[#D23535]">
                *
              </span>
            </div>

            <div
              className="text-[#737373]"
            >
              A name for this connector, e.g., “My Salesforce”.
            </div>

            <input
              className="border border-[#CCC] rounded-[0.38rem] px-[0.63rem] py-[0.38rem]"
              value={config.name}
              onChange={e => setConfig(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div
            className="flex flex-col gap-[0.38rem]"
          >
            <div
              className="text-[#000]"
            >
              Client ID
              {' '}
              <span className="text-[#D23535]">
                *
              </span>
            </div>

            <div
              className="text-[#737373]"
            >
              Provided by the service you’re connecting to.
            </div>

            <input
              className="border border-[#CCC] rounded-[0.38rem] px-[0.63rem] py-[0.38rem]"
              value={config.clientId}
              onChange={e => setConfig(prev => ({ ...prev, clientId: e.target.value }))}
            />
          </div>

          <div
            className="flex flex-col gap-[0.38rem]"
          >
            <div
              className="text-[#000] flex gap-[0.25rem] items-center"
            >
              Client secret (optional for PKCE flows)
              <Tooltip
                position="bottom"
                tooltipText="PKCE (Proof Key for Code Exchange) is a security method that doesn’t require storing a client secret."
                tooltipClassName="w-[15.75rem]"
              />
            </div>

            <div
              className="text-[#737373]"
            >
              Used to authenticate your app with the service.
            </div>

            <input
              className="border border-[#CCC] rounded-[0.38rem] px-[0.63rem] py-[0.38rem]"
              value={config.clientSecret}
              onChange={e => setConfig(prev => ({
                ...prev,
                clientSecret: e.target.value,
                usePKCE: e.target.value.trim() === '',
              }))}
              placeholder="Leave blank if using PKCE."
            />
          </div>

        </div>

        <div>
          buttons
        </div>
      </div>
    </Popup>
  )
}
