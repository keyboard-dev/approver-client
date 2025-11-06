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
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5-turbo models',
    placeholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models',
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini Pro models',
    placeholder: 'AIza...',
    helpUrl: 'https://makersuite.google.com/app/apikey',
  },
] as const

export const AIProvidersPanel: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [providerStatus, setProviderStatus] = useState<AIProviderKey[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const loadProviderStatus = async () => {
    try {
      const status = await window.electronAPI.getAIProviderKeys()
      setProviderStatus(status)
    } catch (error) {
      console.error('Failed to load AI provider status:', error)
    }
  }

  useEffect(() => {
    loadProviderStatus()
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
    } catch (error) {
      setErrors(prev => ({ 
        ...prev, 
        [provider]: error instanceof Error ? error.message : 'Failed to save API key'
      }))
    } finally {
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
      } else {
        setErrors(prev => ({ ...prev, [provider]: result.error || 'Connection failed' }))
      }
    } catch (error) {
      setErrors(prev => ({ 
        ...prev, 
        [provider]: error instanceof Error ? error.message : 'Connection test failed'
      }))
    } finally {
      setTesting(null)
    }
  }

  const handleDeleteKey = async (provider: string) => {
    try {
      await window.electronAPI.removeAIProviderKey(provider)
      await loadProviderStatus()
      setDeleteConfirmation(null)
    } catch (error) {
      console.error('Failed to delete API key:', error)
    }
  }

  const getProviderConfig = (providerId: string) => {
    return providerStatus.find(p => p.provider === providerId)
  }

  return (
    <div className="grow shrink min-w-0 h-full py-[0.5rem] flex flex-col gap-[0.63rem]">
      <div className="px-[0.94rem] text-[1.13rem]">
        AI Providers
      </div>

      <div className="px-[0.94rem] text-[#737373] text-sm">
        Configure API keys for AI providers to enable chat functionality. Keys are stored securely and encrypted on your device.
      </div>

      <div className="flex flex-col gap-[1rem]">
        {AI_PROVIDERS.map(provider => {
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
                    {isConfigured && (
                      <span className="text-green-600 text-sm">✓ Configured</span>
                    )}
                  </div>
                  <div className="text-[#737373] text-sm">{provider.description}</div>
                </div>
                <a 
                  href={provider.helpUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Get API Key →
                </a>
              </div>

              {!isConfigured ? (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder={provider.placeholder}
                      value={apiKeys[provider.id] || ''}
                      onChange={(e) => handleKeyChange(provider.id, e.target.value)}
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
              ) : (
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
                  
                  <ButtonDesigned
                    onClick={() => setDeleteConfirmation(provider.id)}
                    className="px-4 py-2"
                    variant="destructive"
                    hasBorder
                  >
                    Remove Key
                  </ButtonDesigned>
                </div>
              )}

              {hasError && isConfigured && (
                <div className="text-red-600 text-sm">
                  {errors[provider.id]}
                </div>
              )}
            </div>
          )
        })}
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