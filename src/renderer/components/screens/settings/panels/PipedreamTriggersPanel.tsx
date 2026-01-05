import React, { useState } from 'react'

interface ConfigurableProp {
  name: string
  type: string
  app?: string
  label?: string
  description?: string
  default?: unknown
  optional?: boolean
  remoteOptions?: boolean
}

interface Trigger {
  name: string
  description: string
  component_type: string
  version: string
  key: string
  configurable_props: ConfigurableProp[]
}

interface TriggersResponse {
  success: boolean
  triggers?: Trigger[]
  totalCount?: number
  pageInfo?: {
    count: number
    startCursor: string
    endCursor: string
  }
}

export const PipedreamTriggersPanel: React.FC = () => {
  const [appName, setAppName] = useState('slack_v2')
  const [isLoading, setIsLoading] = useState(false)
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [selectedTrigger, setSelectedTrigger] = useState<Trigger | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showConfigModal, setShowConfigModal] = useState(false)

  const handleSearch = async () => {
    if (!appName.trim()) {
      setError('Please enter an app name')
      return
    }

    setIsLoading(true)
    setError(null)
    setTriggers([])
    setSelectedTrigger(null)

    try {
      const response = await window.electronAPI.fetchPipedreamTriggers(appName.trim())

      if (response.success && response.data) {
        const data = response.data as TriggersResponse
        if (data.triggers && data.triggers.length > 0) {
          setTriggers(data.triggers)
        }
        else {
          setError('No triggers found for this app')
        }
      }
      else {
        setError(response.error || 'Failed to fetch triggers')
      }
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    }
    finally {
      setIsLoading(false)
    }
  }

  const handleTriggerClick = (trigger: Trigger) => {
    setSelectedTrigger(trigger)
    setShowConfigModal(true)
  }

  const handleCloseModal = () => {
    setShowConfigModal(false)
    setSelectedTrigger(null)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      <div className="p-6">
        <h2 className="text-[1.25rem] font-bold mb-4">Pipedream Webhook Triggers</h2>
        <p className="text-[#737373] mb-6">
          Search for webhook triggers powered by Pipedream. Enter an app name to discover available triggers.
        </p>

        <div className="flex gap-3 mb-6">
          <input
            type="text"
            value={appName}
            onChange={e => setAppName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter app name (e.g., slack_v2, github, stripe)"
            className="flex-1 px-4 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#171717]"
            disabled={isLoading}
          />
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="px-6 py-2 bg-[#171717] text-white rounded-lg hover:bg-[#404040] disabled:bg-[#A3A3A3] disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>

      {triggers.length > 0 && (
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="mb-4 text-sm text-[#737373]">
            Found
            {' '}
            {triggers.length}
            {' '}
            trigger
            {triggers.length !== 1 ? 's' : ''}
          </div>
          <div className="space-y-3">
            {triggers.map(trigger => (
              <button
                key={trigger.key}
                onClick={() => handleTriggerClick(trigger)}
                className="w-full text-left p-4 border border-[#E5E5E5] rounded-lg hover:border-[#171717] hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#171717] mb-1">{trigger.name}</h3>
                    <p className="text-sm text-[#737373] mb-2">{trigger.description}</p>
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 bg-[#F5F5F5] rounded">
                        v
                        {trigger.version}
                      </span>
                      <span className="px-2 py-1 bg-[#F5F5F5] rounded">
                        {trigger.configurable_props.length}
                        {' '}
                        config
                        {trigger.configurable_props.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <svg
                    className="w-5 h-5 text-[#737373] flex-shrink-0 ml-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showConfigModal && selectedTrigger && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] m-4 flex flex-col">
            <div className="p-6 border-b border-[#E5E5E5] flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-[#171717] mb-2">{selectedTrigger.name}</h3>
                <p className="text-sm text-[#737373]">{selectedTrigger.description}</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-[#737373] hover:text-[#171717] ml-4"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-6">
                <h4 className="font-semibold text-[#171717] mb-2">Trigger Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex">
                    <span className="text-[#737373] w-32">Key:</span>
                    <span className="font-mono text-[#171717]">{selectedTrigger.key}</span>
                  </div>
                  <div className="flex">
                    <span className="text-[#737373] w-32">Version:</span>
                    <span className="text-[#171717]">{selectedTrigger.version}</span>
                  </div>
                  <div className="flex">
                    <span className="text-[#737373] w-32">Type:</span>
                    <span className="text-[#171717]">{selectedTrigger.component_type}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-[#171717] mb-3">Configuration Properties</h4>
                <div className="space-y-4">
                  {selectedTrigger.configurable_props.map((prop, index) => (
                    <div key={`${prop.name}-${index}`} className="p-4 bg-[#F5F5F5] rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#171717]">{prop.label || prop.name}</span>
                          {prop.optional && (
                            <span className="text-xs text-[#737373] px-2 py-0.5 bg-white rounded">Optional</span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-[#737373] px-2 py-1 bg-white rounded">
                          {prop.type}
                        </span>
                      </div>
                      {prop.description && (
                        <p className="text-sm text-[#737373] mb-2">{prop.description}</p>
                      )}
                      {prop.default !== undefined && (
                        <div className="text-xs text-[#737373]">
                          Default:
                          {' '}
                          <span className="font-mono">{JSON.stringify(prop.default)}</span>
                        </div>
                      )}
                      {prop.app && (
                        <div className="text-xs text-[#737373]">
                          App:
                          {' '}
                          <span className="font-mono">{prop.app}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#E5E5E5] flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="px-6 py-2 border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5] transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  alert('Deploy functionality will be implemented in a future update')
                }}
                className="px-6 py-2 bg-[#171717] text-white rounded-lg hover:bg-[#404040] transition-colors"
              >
                Configure & Deploy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
