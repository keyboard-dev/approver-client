import React, { useEffect, useState } from 'react'
import { ButtonDesigned } from '../../../ui/ButtonDesigned'
import { Confirmation } from '../../../ui/Confirmation'

interface AIProviderKey {
  provider: string
  hasKey: boolean
  configured: boolean
}

const AI_PROVIDERS = [
  {
    id: 'keyboard',
    name: 'Keyboard (Default)',
    description: 'Claude 4.5 models via Keyboard API',
    placeholder: '',
    helpUrl: '',
    isBuiltIn: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5-turbo models',
    placeholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/api-keys',
    isBuiltIn: false,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models',
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/',
    isBuiltIn: false,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini Pro models',
    placeholder: 'AIza...',
    helpUrl: 'https://makersuite.google.com/app/apikey',
    isBuiltIn: false,
  },
] as const

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  'anthropic': 'Anthropic (Direct API)',
  'aws-bedrock': 'AWS Bedrock',
  'gcp-vertex': 'GCP Vertex AI',
  'digitalocean': 'DigitalOcean',
}

interface OrgProviderData {
  configured: boolean
  provider_type?: string
  display_name?: string
  is_active?: boolean
  allowed_models?: string[] | null
}

export const AIProvidersPanel: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [providerStatus, setProviderStatus] = useState<AIProviderKey[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [orgProvider, setOrgProvider] = useState<OrgProviderData | null>(null)

  const loadProviderStatus = async () => {
    try {
      const status = await window.electronAPI.getAIProviderKeys()
      setProviderStatus(status)
    }
    catch (error) {
    }
  }

  useEffect(() => {
    loadProviderStatus()
    window.electronAPI.getOrgAIProvider().then((result) => {
      if (result.success && result.data) {
        setOrgProvider(result.data)
      }
    }).catch(() => {})
  }, [])

  const handleKeyChange = (provider: string, value: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }))
    setErrors(prev => ({ ...prev, [provider]: '' }))
  }

  const handleSaveKey = async (provider: string) => {
    const key = apiKeys[provider]?.trim()
    if (!key) {
      setErrors(prev => ({ ...prev, [provider]: 'API key is required' }))
      return
    }

    setSaving(provider)
    try {
      await window.electronAPI.setAIProviderKey(provider, key)
      setApiKeys(prev => ({ ...prev, [provider]: '' }))
      await loadProviderStatus()
    }
    catch (error) {
      setErrors(prev => ({
        ...prev,
        [provider]: error instanceof Error ? error.message : 'Failed to save API key',
      }))
    }
    finally {
      setSaving(null)
    }
  }

  const handleTestConnection = async (provider: string) => {
    setTesting(provider)
    setErrors(prev => ({ ...prev, [provider]: '' }))

    try {
      const result = await window.electronAPI.testAIProviderConnection(provider)
      if (result.success) {
        alert(`✅ ${provider} connection successful!`)
      }
      else {
        setErrors(prev => ({ ...prev, [provider]: result.error || 'Connection failed' }))
      }
    }
    catch (error) {
      setErrors(prev => ({
        ...prev,
        [provider]: error instanceof Error ? error.message : 'Connection test failed',
      }))
    }
    finally {
      setTesting(null)
    }
  }

  const handleDeleteKey = async (provider: string) => {
    try {
      await window.electronAPI.removeAIProviderKey(provider)
      await loadProviderStatus()
      setDeleteConfirmation(null)
    }
    catch (error) {
    }
  }

  const getProviderConfig = (providerId: string) => {
    return providerStatus.find(p => p.provider === providerId)
  }

  return (
    <div className="grow shrink min-w-0 h-full py-[0.5rem] flex flex-col gap-[0.63rem] overflow-y-auto">
      <div className="px-[0.94rem] text-[1.13rem]">
        AI Providers
      </div>

      <div className="px-[0.94rem] text-[#737373] text-sm">
        Configure API keys for AI providers to enable chat functionality. Keys are stored securely and encrypted on your device.
      </div>

      <div className="flex flex-col gap-[1rem]">
        {orgProvider?.configured
          ? (
              <div className="p-[0.94rem] flex flex-col gap-[1rem] rounded-[0.38rem] bg-[rgba(80,147,183,0.15)]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {orgProvider.display_name || 'Organization AI Provider'}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                        Org Override
                      </span>
                    </div>
                    <div className="text-[#737373] text-sm">
                      {PROVIDER_TYPE_LABELS[orgProvider.provider_type || ''] || orgProvider.provider_type || 'Custom Provider'}
                    </div>
                  </div>
                  <span className="text-green-600 text-sm">
                    {orgProvider.is_active !== false ? '✓ Active' : 'Inactive'}
                  </span>
                </div>
                {orgProvider.allowed_models && orgProvider.allowed_models.length > 0 && (
                  <div className="text-sm">
                    <span className="text-[#737373]">Allowed models: </span>
                    {orgProvider.allowed_models.join(', ')}
                  </div>
                )}
              </div>
            )
          : (
              AI_PROVIDERS.map((provider) => {
                const config = getProviderConfig(provider.id)
                const isConfigured = config?.configured || false
                const hasError = !!errors[provider.id]

                return (
                  <div
                    key={provider.id}
                    className="p-[0.94rem] flex flex-col gap-[1rem] rounded-[0.38rem] bg-[rgba(80,147,183,0.15)]"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {provider.name}
                          {(isConfigured || provider.isBuiltIn) && (
                            <span className="text-green-600 text-sm">
                              ✓
                              {provider.isBuiltIn ? 'Built-in' : 'Configured'}
                            </span>
                          )}
                        </div>
                        <div className="text-[#737373] text-sm">{provider.description}</div>
                      </div>
                      {!provider.isBuiltIn && provider.helpUrl && (
                        <a
                          href={provider.helpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Get API Key →
                        </a>
                      )}
                    </div>

                    {!isConfigured && !provider.isBuiltIn
                      ? (
                          <div className="flex flex-col gap-3">
                            <div className="flex gap-2">
                              <input
                                type="password"
                                placeholder={provider.placeholder}
                                value={apiKeys[provider.id] || ''}
                                onChange={e => handleKeyChange(provider.id, e.target.value)}
                                className="flex-1 px-3 py-2 border border-[#CCC] rounded bg-white text-sm"
                                disabled={saving === provider.id}
                              />
                              <ButtonDesigned
                                onClick={() => handleSaveKey(provider.id)}
                                disabled={saving === provider.id || !apiKeys[provider.id]?.trim()}
                                className="px-4 py-2"
                                variant="primary"
                              >
                                {saving === provider.id ? 'Saving...' : 'Save'}
                              </ButtonDesigned>
                            </div>
                            {hasError && (
                              <div className="text-red-600 text-sm">
                                {errors[provider.id]}
                              </div>
                            )}
                          </div>
                        )
                      : (
                          <div className="flex gap-2">
                            <ButtonDesigned
                              onClick={() => handleTestConnection(provider.id)}
                              disabled={testing === provider.id}
                              className="px-4 py-2"
                              variant="secondary"
                              hasBorder
                            >
                              {testing === provider.id ? 'Testing...' : 'Test Connection'}
                            </ButtonDesigned>

                            {!provider.isBuiltIn && (
                              <ButtonDesigned
                                onClick={() => setDeleteConfirmation(provider.id)}
                                className="px-4 py-2"
                                variant="destructive"
                                hasBorder
                              >
                                Remove Key
                              </ButtonDesigned>
                            )}
                          </div>
                        )}

                    {hasError && isConfigured && (
                      <div className="text-red-600 text-sm">
                        {errors[provider.id]}
                      </div>
                    )}
                  </div>
                )
              })
            )}
      </div>

      {deleteConfirmation && (
        <Confirmation
          confirmText="Yes, remove key"
          description={`Are you sure you want to remove the API key for ${AI_PROVIDERS.find(p => p.id === deleteConfirmation)?.name}? This will disable chat functionality for this provider.`}
          onCancel={() => setDeleteConfirmation(null)}
          onConfirm={() => handleDeleteKey(deleteConfirmation)}
        />
      )}
    </div>
  )
}
