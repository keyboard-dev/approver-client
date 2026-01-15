import { AlertCircle, CheckCircle, ChevronDown, X, XCircle } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Script } from '../../../../../main'
import useComposio from '../../../../hooks/useComposio'
import { deployTrigger, type ComposioApp, type ComposioAvailableTrigger } from '../../../../services/composio-service'
import { Button } from '../../../ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu'

interface ComposioTask {
  keyboardShortcutIds?: string[]
  cloudCredentials?: string[]
  pipedreamProxyApps?: string[]
  ask?: string
}

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
    accountStatus,
    accountStatusLoading,
    accountStatusError,
    triggers,
    triggersLoading,
    triggersError,
    pausingTriggerId,
    resumingTriggerId,
    deletingTriggerId,
    refreshAccounts,
    connectApp,
    disconnectAccount,
    fetchAppsWithTriggers,
    fetchAvailableTriggers,
    clearAvailableTriggers,
    fetchTriggerConfig,
    clearTriggerConfig,
    checkAppAccountStatus,
    clearAccountStatus,
    refreshTriggers,
    pauseTriggerAction,
    resumeTriggerAction,
    deleteTriggerAction,
  } = useComposio()

  const [selectedApp, setSelectedApp] = useState<ComposioApp | null>(null)
  const [selectedTrigger, setSelectedTrigger] = useState<ComposioAvailableTrigger | null>(null)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showTriggersModal, setShowTriggersModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showAccountStatusModal, setShowAccountStatusModal] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, unknown>>({})
  const [deployingTrigger, setDeployingTrigger] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)

  // Task state
  const [tasks, setTasks] = useState<ComposioTask[]>([])
  const [showTasksSection, setShowTasksSection] = useState(false)
  const [availableScripts, setAvailableScripts] = useState<Script[]>([])
  const [availableCredentials, setAvailableCredentials] = useState<Array<{ id: string, connection: string, icon?: string }>>([])
  const [availablePipedreamAccounts, setAvailablePipedreamAccounts] = useState<string[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)

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
    if (!selectedApp) return

    const appSlug = selectedApp.slug || selectedApp.name

    // Check account status first before proceeding
    const status = await checkAppAccountStatus(appSlug)

    if (!status || !status.hasAccount || !status.isActive) {
      // Account is not connected or expired - show status modal
      setSelectedTrigger(trigger)
      setShowTriggersModal(false)
      setShowAccountStatusModal(true)
      return
    }

    // Account is active - proceed to config modal
    setSelectedTrigger(trigger)
    setShowConfigModal(true)
    setShowTriggersModal(false)

    // Reset tasks and load options
    setTasks([])
    setShowTasksSection(false)
    loadTaskOptions()

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

  const handleReconnectFromStatusModal = async () => {
    if (!selectedApp) return

    try {
      setConnectionError(null)
      const appSlug = selectedApp.slug || selectedApp.name
      await connectApp(appSlug)
      setShowAccountStatusModal(false)
      clearAccountStatus()
      // Refresh accounts and let user try again
      await refreshAccounts()
    }
    catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Failed to reconnect account')
    }
  }

  const handleCloseAccountStatusModal = () => {
    setShowAccountStatusModal(false)
    setSelectedTrigger(null)
    clearAccountStatus()
    setConnectionError(null)
  }

  // Load available scripts, credentials, and Pipedream accounts for task configuration
  const loadTaskOptions = async () => {
    setIsLoadingOptions(true)
    try {
      const [scriptsResponse, accountsResponse, pipedreamAppNames] = await Promise.all([
        window.electronAPI.getScripts(),
        window.electronAPI.getAdditionalConnectedAccounts(),
        window.electronAPI.fetchPipedreamAccounts(),
      ])

      setAvailableScripts(Array.isArray(scriptsResponse) ? scriptsResponse : [])

      if (accountsResponse.success && Array.isArray(accountsResponse.accounts)) {
        setAvailableCredentials(accountsResponse.accounts)
      }
      else {
        setAvailableCredentials([])
      }

      setAvailablePipedreamAccounts(Array.isArray(pipedreamAppNames) ? pipedreamAppNames : [])
    }
    catch {
      setAvailableScripts([])
      setAvailableCredentials([])
      setAvailablePipedreamAccounts([])
    }
    finally {
      setIsLoadingOptions(false)
    }
  }

  // Task management functions
  const addTask = () => {
    setTasks([...tasks, { keyboardShortcutIds: [], cloudCredentials: [], pipedreamProxyApps: [], ask: '' }])
  }

  const removeTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index))
  }

  const updateTask = (index: number, field: keyof ComposioTask, value: unknown) => {
    const newTasks = [...tasks]
    newTasks[index] = { ...newTasks[index], [field]: value }
    setTasks(newTasks)
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
      // Filter out empty tasks and format for API
      const tasksToSend = tasks
        .filter(task => task.ask || (task.keyboardShortcutIds && task.keyboardShortcutIds.length > 0) || (task.cloudCredentials && task.cloudCredentials.length > 0) || (task.pipedreamProxyApps && task.pipedreamProxyApps.length > 0))
        .map(task => ({
          keyboardShortcutIds: task.keyboardShortcutIds || [],
          cloudCredentials: task.cloudCredentials || [],
          pipedreamProxyApps: task.pipedreamProxyApps || [],
          ask: task.ask || undefined,
        }))

      const response = await deployTrigger({
        connectedAccountId: connectedAccount.id,
        triggerName: selectedTrigger.slug,
        appName: appSlug,
        config: configValues,
        encryptionEnabled: true,
        tasks: tasksToSend.length > 0 ? tasksToSend : undefined,
      })

      if (response.success) {
        // Success! Close modal and show success message
        setShowConfigModal(false)
        setSelectedTrigger(null)
        setSelectedApp(null)
        setConfigValues({})
        setTasks([])
        setShowTasksSection(false)
        clearTriggerConfig()
        alert('Trigger deployed successfully!')
        // Refresh the deployed triggers list
        await refreshTriggers()
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

  const handleDeleteTrigger = async (triggerId: string) => {
    if (!confirm('Are you sure you want to delete this trigger? This action cannot be undone.')) {
      return
    }

    try {
      await deleteTriggerAction(triggerId)
    }
    catch (error) {
      alert(`Failed to delete trigger: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handlePauseTrigger = async (triggerId: string) => {
    try {
      await pauseTriggerAction(triggerId)
    }
    catch (error) {
      alert(`Failed to pause trigger: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleResumeTrigger = async (triggerId: string) => {
    try {
      await resumeTriggerAction(triggerId)
    }
    catch (error) {
      alert(`Failed to resume trigger: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

      {/* Deployed Triggers Section */}
      <div className="px-6 pb-6 border-b border-[#E5E5E5]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-[#171717]">
            Deployed Triggers
            {triggers.length > 0 && (
              <>
                {' '}
                (
                {triggers.length}
                )
              </>
            )}
          </h3>
          <button
            onClick={refreshTriggers}
            disabled={triggersLoading}
            className="text-sm text-[#737373] hover:text-[#171717] disabled:opacity-50"
          >
            {triggersLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {triggersError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {triggersError}
          </div>
        )}

        {triggersLoading && triggers.length === 0
          ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-[#737373]">Loading deployed triggers...</div>
              </div>
            )
          : triggers.length === 0
            ? (
                <div className="text-sm text-[#737373] py-4">
                  No deployed triggers yet. Configure a trigger above to get started.
                </div>
              )
            : (
                <div className="space-y-2">
                  {triggers.map(trigger => (
                    <div
                      key={trigger.id}
                      className="p-3 border border-[#E5E5E5] rounded-lg bg-[#FAFAFA]"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-[#171717]">{trigger.name}</h4>
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              trigger.status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                            >
                              {trigger.status}
                            </span>
                          </div>
                          {trigger.description && (
                            <p className="text-sm text-[#737373] mb-2">{trigger.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-[#A3A3A3]">
                            <span>
                              App:
                              {' '}
                              {trigger.appName}
                            </span>
                            <span>•</span>
                            <span>
                              Created
                              {' '}
                              {new Date(trigger.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          {trigger.status === 'active'
                            ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePauseTrigger(trigger.id)}
                                  disabled={pausingTriggerId === trigger.id}
                                >
                                  {pausingTriggerId === trigger.id ? 'Pausing...' : 'Pause'}
                                </Button>
                              )
                            : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleResumeTrigger(trigger.id)}
                                  disabled={resumingTriggerId === trigger.id}
                                >
                                  {resumingTriggerId === trigger.id ? 'Resuming...' : 'Resume'}
                                </Button>
                              )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteTrigger(trigger.id)}
                            disabled={deletingTriggerId === trigger.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {deletingTriggerId === trigger.id ? 'Deleting...' : 'Delete'}
                          </Button>
                        </div>
                      </div>
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

            <div className="flex-1 overflow-y-auto">
              {!triggerConfigLoading && Boolean(triggerConfig?.properties) && (
                <div className="space-y-4">
                  {selectedTrigger.instructions && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                      <p className="font-medium mb-1">Instructions:</p>
                      <p>{selectedTrigger.instructions}</p>
                    </div>
                  )}

                  {Object.entries(triggerConfig!.properties as Record<string, unknown>).map(([key, propSchema]) => {
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
              )}

              {/* Tasks Section */}
              <div className="mt-6 pt-4 border-t border-[#E5E5E5]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-[#171717]">Tasks</h4>
                  <button
                    onClick={() => {
                      if (!showTasksSection && tasks.length === 0) {
                      // When showing tasks for the first time, add an initial task
                        setTasks([{ keyboardShortcutIds: [], cloudCredentials: [], pipedreamProxyApps: [], ask: '' }])
                      }
                      setShowTasksSection(!showTasksSection)
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {showTasksSection ? 'Hide Tasks' : 'Add Tasks'}
                  </button>
                </div>
                <p className="text-xs text-[#737373] mb-3">
                  Define tasks to execute when this trigger fires (keyboard shortcuts, AI prompts, etc.)
                </p>

                {showTasksSection && (
                  <div className="space-y-4">
                    {tasks.map((task, index) => (
                      <div key={index} className="p-4 border border-[#E5E5E5] rounded-lg relative">
                        <button
                          onClick={() => removeTask(index)}
                          className="absolute top-2 right-2 text-[#737373] hover:text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>

                        <div className="space-y-4 pr-6">
                          {/* Keyboard Shortcuts */}
                          <div>
                            <label className="text-xs text-[#737373] mb-2 block">
                              Keyboard Shortcuts
                            </label>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-between text-sm h-auto min-h-[2.5rem] py-2"
                                  disabled={isLoadingOptions}
                                >
                                  {task.keyboardShortcutIds && task.keyboardShortcutIds.length > 0
                                    ? `${task.keyboardShortcutIds.length} selected`
                                    : 'Select shortcuts...'}
                                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-80 max-h-80 overflow-y-auto">
                                <DropdownMenuLabel>Available Shortcuts</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {(!availableScripts || availableScripts.length === 0) && (
                                  <div className="px-2 py-3 text-sm text-[#737373]">
                                    No shortcuts available
                                  </div>
                                )}
                                {availableScripts && availableScripts.map((script) => {
                                  const isSelected = task.keyboardShortcutIds?.includes(script.id) || false
                                  return (
                                    <DropdownMenuCheckboxItem
                                      key={script.id}
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        const currentIds = task.keyboardShortcutIds || []
                                        const newIds = checked
                                          ? [...currentIds, script.id]
                                          : currentIds.filter(id => id !== script.id)
                                        updateTask(index, 'keyboardShortcutIds', newIds)
                                      }}
                                    >
                                      <span className="truncate">{script.name}</span>
                                    </DropdownMenuCheckboxItem>
                                  )
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {task.keyboardShortcutIds && task.keyboardShortcutIds.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {task.keyboardShortcutIds.map((id) => {
                                  const script = availableScripts?.find(s => s.id === id)
                                  return (
                                    <span
                                      key={id}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                                    >
                                      {script?.name || id}
                                      <X
                                        className="h-3 w-3 cursor-pointer hover:text-blue-900"
                                        onClick={() => {
                                          const newIds = (task.keyboardShortcutIds || []).filter(i => i !== id)
                                          updateTask(index, 'keyboardShortcutIds', newIds)
                                        }}
                                      />
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </div>

                          {/* Cloud Credentials */}
                          <div>
                            <label className="text-xs text-[#737373] mb-2 block">
                              Cloud Credentials
                            </label>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-between text-sm h-auto min-h-[2.5rem] py-2"
                                  disabled={isLoadingOptions}
                                >
                                  {task.cloudCredentials && task.cloudCredentials.length > 0
                                    ? `${task.cloudCredentials.length} selected`
                                    : 'Select credentials...'}
                                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-80 max-h-80 overflow-y-auto">
                                <DropdownMenuLabel>Connected Accounts</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {(!availableCredentials || availableCredentials.length === 0) && (
                                  <div className="px-2 py-3 text-sm text-[#737373]">
                                    No connected accounts
                                  </div>
                                )}
                                {availableCredentials && availableCredentials.map((cred) => {
                                  const isSelected = task.cloudCredentials?.includes(cred.id) || false
                                  return (
                                    <DropdownMenuCheckboxItem
                                      key={cred.id}
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        const currentCreds = task.cloudCredentials || []
                                        const newCreds = checked
                                          ? [...currentCreds, cred.id]
                                          : currentCreds.filter(id => id !== cred.id)
                                        updateTask(index, 'cloudCredentials', newCreds)
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        {cred.icon && (
                                          <img src={cred.icon} alt="" className="w-4 h-4" />
                                        )}
                                        <span>{cred.connection}</span>
                                      </div>
                                    </DropdownMenuCheckboxItem>
                                  )
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {task.cloudCredentials && task.cloudCredentials.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {task.cloudCredentials.map((id) => {
                                  const cred = availableCredentials?.find(c => c.id === id)
                                  return (
                                    <span
                                      key={id}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs"
                                    >
                                      {cred?.connection || id}
                                      <X
                                        className="h-3 w-3 cursor-pointer hover:text-green-900"
                                        onClick={() => {
                                          const newCreds = (task.cloudCredentials || []).filter(i => i !== id)
                                          updateTask(index, 'cloudCredentials', newCreds)
                                        }}
                                      />
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </div>

                          {/* Pipedream Proxy Apps */}
                          <div>
                            <label className="text-xs text-[#737373] mb-2 block">
                              Pipedream Proxy Apps
                            </label>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-between text-sm h-auto min-h-[2.5rem] py-2"
                                  disabled={isLoadingOptions}
                                >
                                  {task.pipedreamProxyApps && task.pipedreamProxyApps.length > 0
                                    ? `${task.pipedreamProxyApps.length} selected`
                                    : 'Select Pipedream apps...'}
                                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-80 max-h-80 overflow-y-auto">
                                <DropdownMenuLabel>Pipedream Connected Apps</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {(!availablePipedreamAccounts || availablePipedreamAccounts.length === 0) && (
                                  <div className="px-2 py-3 text-sm text-[#737373]">
                                    No Pipedream apps connected
                                  </div>
                                )}
                                {availablePipedreamAccounts && availablePipedreamAccounts.map((appName) => {
                                  const isSelected = task.pipedreamProxyApps?.includes(appName) || false
                                  return (
                                    <DropdownMenuCheckboxItem
                                      key={appName}
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        const currentApps = task.pipedreamProxyApps || []
                                        const newApps = checked
                                          ? [...currentApps, appName]
                                          : currentApps.filter(name => name !== appName)
                                        updateTask(index, 'pipedreamProxyApps', newApps)
                                      }}
                                    >
                                      <span className="truncate">{appName}</span>
                                    </DropdownMenuCheckboxItem>
                                  )
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {task.pipedreamProxyApps && task.pipedreamProxyApps.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {task.pipedreamProxyApps.map((appName) => {
                                  return (
                                    <span
                                      key={appName}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs"
                                    >
                                      {appName}
                                      <X
                                        className="h-3 w-3 cursor-pointer hover:text-purple-900"
                                        onClick={() => {
                                          const newApps = (task.pipedreamProxyApps || []).filter(name => name !== appName)
                                          updateTask(index, 'pipedreamProxyApps', newApps)
                                        }}
                                      />
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </div>

                          {/* AI Prompt */}
                          <div>
                            <label className="text-xs text-[#737373] mb-1 block">
                              AI Prompt (optional)
                            </label>
                            <textarea
                              value={task.ask || ''}
                              onChange={e => updateTask(index, 'ask', e.target.value)}
                              placeholder="Enter an AI prompt or question..."
                              rows={3}
                              className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded focus:outline-none focus:ring-2 focus:ring-[#171717]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={addTask}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Add Another Task
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#E5E5E5] flex gap-3 flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfigModal(false)
                  setShowTriggersModal(true)
                  setSelectedTrigger(null)
                  setConfigValues({})
                  setTasks([])
                  setShowTasksSection(false)
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

      {/* Account Status Modal - Shown when account is expired/inactive */}
      {showAccountStatusModal && selectedApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Connection Status</h3>
              <button
                onClick={handleCloseAccountStatusModal}
                className="text-[#737373] hover:text-[#171717]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {accountStatusLoading
              ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-[#737373]">Checking connection status...</div>
                  </div>
                )
              : (
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      {selectedApp.logo && (
                        <img src={selectedApp.logo} alt={selectedApp.name} className="w-12 h-12 rounded" />
                      )}
                      <div>
                        <h4 className="font-semibold text-[#171717]">{selectedApp.name}</h4>
                        {selectedTrigger && (
                          <p className="text-sm text-[#737373]">{selectedTrigger.name}</p>
                        )}
                      </div>
                    </div>

                    {/* Status Display */}
                    <div className={`p-4 rounded-lg border ${
                      accountStatus?.isActive
                        ? 'bg-green-50 border-green-200'
                        : accountStatus?.hasAccount
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-red-50 border-red-200'
                    }`}
                    >
                      <div className="flex items-start gap-3">
                        {accountStatus?.isActive
                          ? (
                              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            )
                          : accountStatus?.hasAccount
                            ? (
                                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                              )
                            : (
                                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                              )}
                        <div>
                          <p className={`font-medium ${
                            accountStatus?.isActive
                              ? 'text-green-800'
                              : accountStatus?.hasAccount
                                ? 'text-yellow-800'
                                : 'text-red-800'
                          }`}
                          >
                            {accountStatus?.isActive
                              ? 'Active'
                              : accountStatus?.hasAccount
                                ? `Status: ${accountStatus.status}`
                                : 'Not Connected'}
                          </p>
                          <p className={`text-sm mt-1 ${
                            accountStatus?.isActive
                              ? 'text-green-700'
                              : accountStatus?.hasAccount
                                ? 'text-yellow-700'
                                : 'text-red-700'
                          }`}
                          >
                            {accountStatus?.message || 'Unable to determine account status'}
                          </p>
                          {accountStatus?.updatedAt && (
                            <p className="text-xs mt-2 text-[#737373]">
                              Last updated:
                              {' '}
                              {new Date(accountStatus.updatedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {accountStatusError && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        {accountStatusError}
                      </div>
                    )}

                    {connectionError && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        {connectionError}
                      </div>
                    )}

                    {!accountStatus?.isActive && (
                      <p className="mt-4 text-sm text-[#737373]">
                        Your connection to
                        {' '}
                        {selectedApp.name}
                        {' '}
                        {accountStatus?.hasAccount ? 'has expired or is inactive' : 'is not set up'}
                        . Please reconnect to continue setting up this trigger.
                      </p>
                    )}
                  </div>
                )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleCloseAccountStatusModal}
                className="flex-1"
              >
                Cancel
              </Button>
              {!accountStatus?.isActive && (
                <Button
                  onClick={handleReconnectFromStatusModal}
                  disabled={connectingApp === (selectedApp.slug || selectedApp.name)}
                  className="flex-1"
                >
                  {connectingApp === (selectedApp.slug || selectedApp.name) ? 'Connecting...' : 'Reconnect Account'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
