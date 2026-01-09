import { X } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import useComposio from '../../../../hooks/useComposio'
import { deployTrigger, type ComposioApp, type ComposioAvailableTrigger } from '../../../../services/composio-service'
import { Button } from '../../../ui/button'

export const ComposioTriggersPanel: React.FC = () => {
  const {
    accounts,
    accountsLoading,
    accountsError,
    apps,
    appsLoading,
    appsError,
    searchQuery,
    setSearchQuery,
    connectingApp,
    disconnectingAccountId,
    availableTriggers,
    availableTriggersLoading,
    availableTriggersError,
    triggerConfig,
    triggerConfigLoading,
    triggerConfigError,
    refreshAccounts,
    connectApp,
    disconnectAccount,
    fetchAppsWithTriggers,
    fetchAvailableTriggers,
    clearAvailableTriggers,
    fetchTriggerConfig,
    clearTriggerConfig,
  } = useComposio()

  const [selectedApp, setSelectedApp] = useState<ComposioApp | null>(null)
  const [selectedTrigger, setSelectedTrigger] = useState<ComposioAvailableTrigger | null>(null)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showTriggersModal, setShowTriggersModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, unknown>>({})
  const [deployingTrigger, setDeployingTrigger] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)

  useEffect(() => {
    refreshAccounts()
    fetchAppsWithTriggers()
  }, [])

  const handleAppClick = async (app: ComposioApp) => {
    const appSlug = app.slug || app.name

    // Debug: Log what we're checking
    const connectedAccount = accounts.find(acc => acc.toolkit.slug
      === appSlug)
    if (!connectedAccount) {
      setSelectedApp(app)
      setShowAccountModal(true)
      setConnectionError(null)
    }
    else {
      setSelectedApp(app)
      setShowTriggersModal(true)
      await fetchAvailableTriggers(appSlug)
    }
  }

  const handleConnectApp = async (app: ComposioApp) => {
    try {
      setConnectionError(null)
      const appSlug = app.slug || app.name
      if (!appSlug) {
        throw new Error('Could not determine app identifier')
      }
      await connectApp(appSlug)
      setShowAccountModal(false)
      setSelectedApp(null)
      await refreshAccounts()
    }
    catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Failed to connect account')
    }
  }

  const handleDisconnectAccount = async (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to disconnect this account?')) {
      await disconnectAccount(accountId)
      refreshAccounts()
    }
  }

  const handleTriggerClick = async (trigger: ComposioAvailableTrigger) => {
    setSelectedTrigger(trigger)
    setShowConfigModal(true)
    setShowTriggersModal(false)
    await fetchTriggerConfig(trigger.slug)

    // Set default values from config schema
    if (trigger.config?.properties) {
      const defaults: Record<string, unknown> = {}
      Object.entries(trigger.config.properties).forEach(([key, value]) => {
        const propValue = value as { default?: unknown }
        if (propValue.default !== undefined) {
          defaults[key] = propValue.default
        }
      })
      setConfigValues(defaults)
    }
  }

  const isAppConnected = (app: ComposioApp) => {
    const appSlug = app.slug || app.name
    return accounts.some(acc => acc.appName === appSlug && acc.status === 'active')
  }

  const handleDeployTrigger = async () => {
    if (!selectedTrigger || !selectedApp) return

    const appSlug = selectedApp.slug || selectedApp.name
    const connectedAccount = accounts.find(acc => acc.toolkit.slug === appSlug)

    if (!connectedAccount) {
      setDeployError('No connected account found for this app')
      return
    }

    setDeployingTrigger(true)
    setDeployError(null)

    try {
      const response = await deployTrigger({
        connectedAccountId: connectedAccount.id,
        triggerName: selectedTrigger.slug,
        appName: appSlug,
        config: configValues,
        encryptionEnabled: true,
      })

      if (response.success) {
        // Success! Close modal and show success message
        setShowConfigModal(false)
        setSelectedTrigger(null)
        setSelectedApp(null)
        setConfigValues({})
        clearTriggerConfig()
        alert('Trigger deployed successfully!')
      }
      else {
        setDeployError(response.error || 'Failed to deploy trigger')
      }
    }
    catch (error) {
      setDeployError(error instanceof Error ? error.message : 'Failed to deploy trigger')
    }
    finally {
      setDeployingTrigger(false)
    }
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      <div className="p-6 border-b border-[#E5E5E5]">
        <h2 className="text-[1.25rem] font-bold mb-4">Composio Triggers</h2>
        <p className="text-[#737373] mb-6">
          Connect your accounts and configure triggers. Composio integrates with 250+ apps.
        </p>

        <div className="flex gap-3 mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search apps (e.g., Slack, GitHub, Google Drive)"
            className="flex-1 px-4 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#171717]"
            disabled={appsLoading}
          />
        </div>

        {(appsError || accountsError) && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {appsError || accountsError}
          </div>
        )}
      </div>

      {/* Connected Accounts Section */}
      <div className="p-6 border-b border-[#E5E5E5]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#171717]">Connected Accounts</h3>
          {accountsLoading && <span className="text-sm text-[#737373]">Loading...</span>}
        </div>

        {accounts.length === 0 && !accountsLoading && (
          <div className="text-sm text-[#737373] py-4">
            No accounts connected yet. Connect an app below to get started.
          </div>
        )}

        {accounts.length > 0 && (
          <div className="space-y-2">
            {accounts.map(account => (
              <div
                key={account.id}
                className="flex items-center justify-between p-3 border border-[#E5E5E5] rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${account.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div>
                    <div className="font-medium text-[#171717]">{account.appName}</div>
                    <div className="text-xs text-[#737373]">
                      Connected
                      {' '}
                      {new Date(account.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={e => handleDisconnectAccount(account.id, e)}
                  disabled={disconnectingAccountId === account.id}
                >
                  {disconnectingAccountId === account.id ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Apps Section */}
      {appsLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#737373]">Loading apps...</div>
        </div>
      )}

      {!appsLoading && apps.length === 0 && !appsError && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-[#737373]">
            {searchQuery ? `No apps found for "${searchQuery}"` : 'No apps available'}
          </div>
        </div>
      )}

      {!appsLoading && apps.length > 0 && (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mb-4 text-sm text-[#737373]">
            Found
            {' '}
            {apps.length}
            {' '}
            app
            {apps.length !== 1 ? 's' : ''}
            {' '}
            with triggers
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {apps.map((app) => {
              const connected = isAppConnected(app)
              return (
                <button
                  key={app.slug || app.name}
                  onClick={() => handleAppClick(app)}
                  className="text-left p-4 border border-[#E5E5E5] rounded-lg hover:border-[#171717] hover:shadow-sm transition-all relative"
                >
                  {connected && (
                    <div className="absolute top-2 right-2">
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Connected
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    {app.logo && (
                      <img src={app.logo} alt={app.name} className="w-10 h-10 rounded" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-[#171717] mb-1">{app.name}</h3>
                      {app.description && (
                        <p className="text-sm text-[#737373] line-clamp-2">{app.description}</p>
                      )}
                      {app.categories && app.categories.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {app.categories.slice(0, 2).map(cat => (
                            <span key={cat} className="text-xs px-2 py-1 bg-[#F5F5F5] rounded">
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <svg
                      className="w-5 h-5 text-[#737373] flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Connect Account Modal */}
      {showAccountModal && selectedApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Connect
                {' '}
                {selectedApp.name}
              </h3>
              <button
                onClick={() => {
                  setShowAccountModal(false)
                  setSelectedApp(null)
                  setConnectionError(null)
                }}
                className="text-[#737373] hover:text-[#171717]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-[#737373] mb-4">
                You need to connect your
                {' '}
                {selectedApp.name}
                {' '}
                account before you can configure triggers.
              </p>
              {selectedApp.logo && (
                <img src={selectedApp.logo} alt={selectedApp.name} className="w-16 h-16 rounded mx-auto mb-4" />
              )}
              {connectionError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {connectionError}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAccountModal(false)
                  setSelectedApp(null)
                  setConnectionError(null)
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleConnectApp(selectedApp)}
                disabled={connectingApp === selectedApp.appKey}
                className="flex-1"
              >
                {connectingApp === selectedApp.appKey ? 'Connecting...' : 'Connect Account'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Available Triggers Modal */}
      {showTriggersModal && selectedApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {selectedApp.name}
                  {' '}
                  Triggers
                </h3>
                <p className="text-sm text-[#737373]">Select a trigger to configure</p>
              </div>
              <button
                onClick={() => {
                  setShowTriggersModal(false)
                  setSelectedApp(null)
                  clearAvailableTriggers()
                }}
                className="text-[#737373] hover:text-[#171717]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {availableTriggersLoading && (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-[#737373]">Loading triggers...</div>
              </div>
            )}

            {availableTriggersError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
                {availableTriggersError}
              </div>
            )}

            {!availableTriggersLoading && availableTriggers.length === 0 && !availableTriggersError && (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-center text-[#737373]">
                  No triggers available for this app
                </div>
              </div>
            )}

            {!availableTriggersLoading && availableTriggers.length > 0 && (
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-3">
                  {availableTriggers.map(trigger => (
                    <button
                      key={trigger.slug}
                      onClick={() => handleTriggerClick(trigger)}
                      className="w-full text-left p-4 border border-[#E5E5E5] rounded-lg hover:border-[#171717] hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-3">
                        {trigger.toolkit?.logo && (
                          <img
                            src={trigger.toolkit.logo}
                            alt={trigger.toolkit.name}
                            className="w-8 h-8 rounded flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-semibold text-[#171717]">
                              {trigger.name}
                            </h4>
                            <svg
                              className="w-5 h-5 text-[#737373] flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          {trigger.description && (
                            <p className="text-sm text-[#737373] mb-2 line-clamp-2">{trigger.description}</p>
                          )}
                          {trigger.instructions && (
                            <p className="text-xs text-[#A3A3A3] mb-2 line-clamp-2 italic">{trigger.instructions}</p>
                          )}
                          <div className="flex gap-2 flex-wrap items-center">
                            <span className="text-xs px-2 py-1 bg-[#F5F5F5] rounded font-mono">
                              {trigger.slug}
                            </span>
                            {trigger.version && (
                              <span className="text-xs text-[#A3A3A3]">
                                v
                                {trigger.version}
                              </span>
                            )}
                            {trigger.config?.properties && (
                              <span className="text-xs text-[#A3A3A3]">
                                {Object.keys(trigger.config.properties).length}
                                {' '}
                                config options
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-[#E5E5E5]">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTriggersModal(false)
                  setSelectedApp(null)
                  clearAvailableTriggers()
                }}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Trigger Configuration Modal */}
      {showConfigModal && selectedTrigger && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">
                  Configure
                  {' '}
                  {selectedTrigger.name}
                </h3>
                <p className="text-sm text-[#737373]">Set up your trigger configuration</p>
              </div>
              <button
                onClick={() => {
                  setShowConfigModal(false)
                  setSelectedTrigger(null)
                  setConfigValues({})
                  setDeployError(null)
                  clearTriggerConfig()
                }}
                className="text-[#737373] hover:text-[#171717]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {triggerConfigLoading && (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-[#737373]">Loading configuration...</div>
              </div>
            )}

            {triggerConfigError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
                {triggerConfigError}
              </div>
            )}

            {deployError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
                {deployError}
              </div>
            )}

            {(!triggerConfigLoading && triggerConfig?.properties)
              ? (
                  <div className="flex-1 overflow-y-auto">
                    <div className="space-y-4">
                      {selectedTrigger.instructions && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                          <p className="font-medium mb-1">Instructions:</p>
                          <p>{selectedTrigger.instructions}</p>
                        </div>
                      )}

                      {Object.entries(triggerConfig.properties).map(([key, propSchema]) => {
                        const schema = propSchema as {
                          type?: string
                          title?: string
                          description?: string
                          default?: unknown
                          examples?: unknown[]
                          minimum?: number
                          maximum?: number
                          enum?: unknown[]
                        }
                        const required = (triggerConfig as { required?: string[] }).required || []
                        const isRequired = required.includes(key)

                        const renderField = () => {
                          if (schema.type === 'boolean') {
                            return (
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={Boolean(configValues[key] ?? schema.default ?? false)}
                                  onChange={e => setConfigValues(prev => ({ ...prev, [key]: e.target.checked }))}
                                  className="w-4 h-4 rounded border-[#E5E5E5]"
                                />
                                <span className="text-sm text-[#737373]">
                                  {schema.description || 'Enable this option'}
                                </span>
                              </div>
                            )
                          }
                          if (schema.type === 'number' || schema.type === 'integer') {
                            return (
                              <input
                                type="number"
                                value={String(configValues[key] ?? schema.default ?? '')}
                                onChange={e => setConfigValues(prev => ({ ...prev, [key]: schema.type === 'integer' ? parseInt(e.target.value) : parseFloat(e.target.value) }))}
                                min={schema.minimum}
                                max={schema.maximum}
                                placeholder={schema.examples?.[0] ? String(schema.examples[0]) : ''}
                                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#171717]"
                                required={isRequired}
                              />
                            )
                          }
                          if (schema.enum) {
                            return (
                              <select
                                value={String(configValues[key] ?? schema.default ?? '')}
                                onChange={e => setConfigValues(prev => ({ ...prev, [key]: e.target.value }))}
                                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#171717]"
                                required={isRequired}
                              >
                                <option value="">Select an option</option>
                                {schema.enum.map(option => (
                                  <option key={String(option)} value={String(option)}>
                                    {String(option)}
                                  </option>
                                ))}
                              </select>
                            )
                          }
                          return (
                            <input
                              type="text"
                              value={String(configValues[key] ?? schema.default ?? '')}
                              onChange={e => setConfigValues(prev => ({ ...prev, [key]: e.target.value }))}
                              placeholder={schema.examples?.[0] ? String(schema.examples[0]) : ''}
                              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#171717]"
                              required={isRequired}
                            />
                          )
                        }

                        return (
                          <div key={key} className="space-y-2">
                            <label className="block text-sm font-medium text-[#171717]">
                              {schema.title || key}
                              {isRequired && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {schema.description && (
                              <p className="text-xs text-[#737373]">{schema.description}</p>
                            )}
                            {renderField()}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              : null}

            <div className="mt-6 pt-4 border-t border-[#E5E5E5] flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfigModal(false)
                  setShowTriggersModal(true)
                  setSelectedTrigger(null)
                  setConfigValues({})
                  setDeployError(null)
                }}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleDeployTrigger}
                disabled={triggerConfigLoading || deployingTrigger}
                className="flex-1"
              >
                {deployingTrigger ? 'Deploying...' : 'Deploy Trigger'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
