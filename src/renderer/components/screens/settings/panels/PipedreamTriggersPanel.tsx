import { ChevronDown, X } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Script } from '../../../../../main'
import { Button } from '../../../ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu'

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

interface TriggerTask {
  id?: string
  deployedTriggerId?: string
  keyboard_shortcut_ids?: string[]
  cloud_credentials?: string[]
  pipedream_proxy_apps?: string[]
  ask?: string | null
  createdAt?: string
  updatedAt?: string
}

interface DeployedTrigger {
  id: string
  triggerId: string
  triggerAction: string
  appName: string
  appSlug: string
  status: string
  configuredProps: Record<string, unknown>
  tasks?: TriggerTask[]
  createdAt: string
  updatedAt: string
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
  const [configValues, setConfigValues] = useState<Record<string, unknown>>({})
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null)
  const [deployedTriggers, setDeployedTriggers] = useState<DeployedTrigger[]>([])
  const [isLoadingDeployed, setIsLoadingDeployed] = useState(false)
  const [tasks, setTasks] = useState<TriggerTask[]>([])
  const [showTasksSection, setShowTasksSection] = useState(false)
  const [selectedDeployedTrigger, setSelectedDeployedTrigger] = useState<DeployedTrigger | null>(null)
  const [showTasksModal, setShowTasksModal] = useState(false)
  const [availableScripts, setAvailableScripts] = useState<Script[]>([])
  const [availableCredentials, setAvailableCredentials] = useState<Array<{ id: string, connection: string, icon?: string }>>([])
  const [availablePipedreamAccounts, setAvailablePipedreamAccounts] = useState<string[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [isTokenStored, setIsTokenStored] = useState<boolean | null>(null)
  const [isCheckingToken, setIsCheckingToken] = useState(true)
  const [isStoringToken, setIsStoringToken] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)

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
    setConfigValues({})
    setDeploySuccess(null)
    setError(null)
    setTasks([])
    setShowTasksSection(false)
  }

  const handleCloseModal = () => {
    setShowConfigModal(false)
    setSelectedTrigger(null)
    setConfigValues({})
    setDeploySuccess(null)
    setError(null)
    setTasks([])
    setShowTasksSection(false)
  }

  const handleCloseTasksModal = () => {
    setShowTasksModal(false)
    setSelectedDeployedTrigger(null)
  }

  const extractAppName = (appSlug: string): string => {
    return appSlug.replace(/_v\d+$/, '')
  }

  const handleConfigChange = (propName: string, value: unknown) => {
    setConfigValues(prev => ({
      ...prev,
      [propName]: value,
    }))
  }

  const getUserConfigurableProps = (props: ConfigurableProp[]): ConfigurableProp[] => {
    const systemTypes = ['app', '$.service.db', '$.interface.timer', '$.interface.apphook']
    return props.filter(prop => !systemTypes.includes(prop.type))
  }

  const handleDeploy = async () => {
    if (!selectedTrigger) return

    setIsDeploying(true)
    setError(null)
    setDeploySuccess(null)

    try {
      const userConfigurableProps = getUserConfigurableProps(selectedTrigger.configurable_props)

      const requiredProps = userConfigurableProps.filter(prop => !prop.optional)
      const missingProps = requiredProps.filter((prop) => {
        const value = configValues[prop.name]
        return value === undefined || value === null || value === ''
      })

      if (missingProps.length > 0) {
        setError(`Please fill in all required fields: ${missingProps.map(p => p.label || p.name).join(', ')}`)
        return
      }

      const configuredProps = Object.keys(configValues).length > 0 ? configValues : undefined
      const tasksToSend = tasks.map(task => ({
        keyboard_shortcut_ids: task.keyboard_shortcut_ids || [],
        cloud_credentials: task.cloud_credentials || [],
        pipedream_proxy_apps: task.pipedream_proxy_apps || [],
        ask: task.ask || null,
      }))

      const response = await window.electronAPI.deployPipedreamTrigger({
        componentKey: selectedTrigger.key,
        appName: extractAppName(appName),
        appSlug: appName,
        ...(configuredProps && { configuredProps }),
        tasks: tasksToSend,
      })

      if (response.success) {
        setDeploySuccess('Trigger deployed successfully!')
        setTimeout(() => {
          handleCloseModal()
        }, 2000)
      }
      else {
        setError(response.error || 'Failed to deploy trigger')
      }
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    }
    finally {
      setIsDeploying(false)
    }
  }

  const renderConfigInput = (prop: ConfigurableProp) => {
    const value = configValues[prop.name]

    switch (prop.type) {
      case 'string':
        return (
          <input
            type="text"
            value={(value as string) || ''}
            onChange={e => handleConfigChange(prop.name, e.target.value)}
            placeholder={prop.default ? String(prop.default) : ''}
            className="w-full px-3 py-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-2 focus:ring-[#171717]"
          />
        )
      case 'string[]':
        return (
          <input
            type="text"
            value={Array.isArray(value) ? value.join(', ') : ''}
            onChange={e => handleConfigChange(prop.name, e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            placeholder="Enter comma-separated values"
            className="w-full px-3 py-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-2 focus:ring-[#171717]"
          />
        )
      case 'boolean':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(value as boolean) || false}
              onChange={e => handleConfigChange(prop.name, e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-[#737373]">
              {prop.default !== undefined ? `Default: ${String(prop.default)}` : 'Enable'}
            </span>
          </label>
        )
      case 'number':
        return (
          <input
            type="number"
            value={(value as number) || ''}
            onChange={e => handleConfigChange(prop.name, parseFloat(e.target.value))}
            placeholder={prop.default ? String(prop.default) : ''}
            className="w-full px-3 py-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-2 focus:ring-[#171717]"
          />
        )
      default:
        return (
          <input
            type="text"
            value={value ? String(value) : ''}
            onChange={e => handleConfigChange(prop.name, e.target.value)}
            placeholder={prop.default ? String(prop.default) : ''}
            className="w-full px-3 py-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-2 focus:ring-[#171717]"
          />
        )
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const loadDeployedTriggers = async () => {
    setIsLoadingDeployed(true)
    try {
      const response = await window.electronAPI.getDeployedPipedreamTriggers(true)
      if (response.success && response.data) {
        const data = response.data as { triggers: DeployedTrigger[] }
        setDeployedTriggers(data.triggers || [])
      }
    }
    catch {
      // Silently fail - deployed triggers is a secondary feature
    }
    finally {
      setIsLoadingDeployed(false)
    }
  }

  const addTask = () => {
    setTasks([...tasks, {
      keyboard_shortcut_ids: [],
      cloud_credentials: [],
      pipedream_proxy_apps: [],
      ask: '',
    }])
    setShowTasksSection(true)
  }

  const removeTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index))
    if (tasks.length === 1) {
      setShowTasksSection(false)
    }
  }

  const updateTask = (index: number, field: keyof TriggerTask, value: unknown) => {
    const newTasks = [...tasks]
    newTasks[index] = { ...newTasks[index], [field]: value }
    setTasks(newTasks)
  }

  const handleShowTasks = (trigger: DeployedTrigger) => {
    setSelectedDeployedTrigger(trigger)
    setShowTasksModal(true)
  }

  const handleDeleteTrigger = async (triggerId: string) => {
    if (!confirm('Are you sure you want to delete this trigger?')) {
      return
    }

    try {
      const response = await window.electronAPI.deleteDeployedPipedreamTrigger(triggerId)
      if (response.success) {
        await loadDeployedTriggers()
      }
      else {
        alert(`Failed to delete trigger: ${response.error || 'Unknown error'}`)
      }
    }
    catch (err) {
      alert(`Failed to delete trigger: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  useEffect(() => {
    checkTokenStatus()
  }, [])

  useEffect(() => {
    if (isTokenStored === true) {
      loadDeployedTriggers()
      loadTaskOptions()
    }
  }, [isTokenStored])

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

  const checkTokenStatus = async () => {
    setIsCheckingToken(true)
    setTokenError(null)
    try {
      const response = await window.electronAPI.checkUserTokenStatus()

      if (response.success && response.data) {
        const data = response.data as { stored: boolean, message?: string }
        setIsTokenStored(data.stored)
      }
      else {
        throw new Error(response.error || 'Failed to check token status')
      }
    }
    catch (err) {
      setIsTokenStored(false)
      setTokenError(err instanceof Error ? err.message : 'Failed to check token status')
    }
    finally {
      setIsCheckingToken(false)
    }
  }

  const storeRefreshToken = async () => {
    setIsStoringToken(true)
    setTokenError(null)
    try {
      const response = await window.electronAPI.storeUserRefreshToken()

      if (response.success) {
        setIsTokenStored(true)
        setTokenError(null)
      }
      else {
        throw new Error(response.error || 'Failed to store token')
      }
    }
    catch (err) {
      setTokenError(err instanceof Error ? err.message : 'Failed to store refresh token')
      throw err
    }
    finally {
      setIsStoringToken(false)
    }
  }

  if (isCheckingToken) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full p-6">
        <div className="text-[#737373] mb-2">Checking token status...</div>
      </div>
    )
  }

  if (isTokenStored === false) {
    return (
      <div className="flex flex-col w-full h-full overflow-hidden">
        <div className="p-6">
          <h2 className="text-[1.25rem] font-bold mb-4">Pipedream Webhook Triggers</h2>
          <p className="text-[#737373] mb-6">
            To use Pipedream webhook triggers, you need to enable access by storing your refresh token securely on our backend.
          </p>

          {tokenError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {tokenError}
            </div>
          )}

          <div className="mb-6 p-6 border border-[#E5E5E5] rounded-lg bg-[#FAFAFA]">
            <h3 className="font-semibold text-[#171717] mb-3">Enable Pipedream Integration</h3>
            <p className="text-sm text-[#737373] mb-4">
              Click the button below to enable Pipedream webhook triggers. This will securely store your refresh token on the backend, allowing you to create and manage webhook triggers.
            </p>
            <button
              onClick={async () => {
                try {
                  await storeRefreshToken()
                }
                catch {
                  // Error already handled in storeRefreshToken
                }
              }}
              disabled={isStoringToken}
              className="px-6 py-3 bg-[#171717] text-white rounded-lg hover:bg-[#404040] disabled:bg-[#A3A3A3] disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isStoringToken ? 'Enabling...' : 'Enable Pipedream Triggers'}
            </button>
          </div>

          <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">What happens when you enable?</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Your refresh token will be securely stored on the backend</li>
              <li>You'll be able to search and deploy webhook triggers</li>
              <li>Triggers will be able to execute your keyboard shortcuts and workflows</li>
              <li>You can disable this at any time</li>
            </ul>
          </div>
        </div>
      </div>
    )
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

      {deployedTriggers.length > 0 && (
        <div className="px-6 pb-6 border-b border-[#E5E5E5]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#171717]">
              Deployed Triggers (
              {deployedTriggers.length}
              )
            </h3>
            <button
              onClick={loadDeployedTriggers}
              disabled={isLoadingDeployed}
              className="text-sm text-[#737373] hover:text-[#171717] disabled:opacity-50"
            >
              {isLoadingDeployed ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <div className="space-y-2">
            {deployedTriggers.map(deployed => (
              <div
                key={deployed.id}
                className="p-3 border border-[#E5E5E5] rounded-lg bg-[#FAFAFA]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-[#171717]">
                        {deployed.triggerAction}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          deployed.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {deployed.status}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs text-[#737373]">
                      <span>
                        App:
                        {' '}
                        {deployed.appName}
                      </span>
                      <span>
                        ID:
                        {' '}
                        {deployed.triggerId}
                      </span>
                      <span>
                        Deployed:
                        {' '}
                        {new Date(deployed.createdAt).toLocaleDateString()}
                      </span>
                      {deployed.tasks && deployed.tasks.length > 0 && (
                        <span className="text-blue-600">
                          Tasks:
                          {' '}
                          {deployed.tasks.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {deployed.tasks && deployed.tasks.length > 0 && (
                      <button
                        onClick={() => handleShowTasks(deployed)}
                        className="text-xs px-3 py-1 border border-[#E5E5E5] rounded hover:bg-white transition-colors"
                      >
                        View Tasks
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteTrigger(deployed.id)}
                      className="text-xs px-3 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              {deploySuccess && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                  {deploySuccess}
                </div>
              )}

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

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
                  <div className="flex">
                    <span className="text-[#737373] w-32">App:</span>
                    <span className="text-[#171717]">{extractAppName(appName)}</span>
                  </div>
                </div>
              </div>

              {(() => {
                const userConfigProps = getUserConfigurableProps(selectedTrigger.configurable_props)
                const systemProps = selectedTrigger.configurable_props.filter(prop =>
                  !userConfigProps.includes(prop),
                )

                return (
                  <>
                    {userConfigProps.length > 0 && (
                      <div className="mb-6">
                        <h4 className="font-semibold text-[#171717] mb-3">Configuration</h4>
                        <div className="space-y-4">
                          {userConfigProps.map((prop, index) => (
                            <div key={`${prop.name}-${index}`} className="p-4 border border-[#E5E5E5] rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-[#171717]">{prop.label || prop.name}</span>
                                  {!prop.optional && (
                                    <span className="text-xs text-red-600 px-2 py-0.5 bg-red-50 rounded">Required</span>
                                  )}
                                  {prop.optional && (
                                    <span className="text-xs text-[#737373] px-2 py-0.5 bg-[#F5F5F5] rounded">Optional</span>
                                  )}
                                </div>
                                <span className="text-xs font-mono text-[#737373] px-2 py-1 bg-[#F5F5F5] rounded">
                                  {prop.type}
                                </span>
                              </div>
                              {prop.description && (
                                <p className="text-sm text-[#737373] mb-3">{prop.description}</p>
                              )}
                              {renderConfigInput(prop)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {systemProps.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-[#171717] mb-3">System Properties</h4>
                        <p className="text-xs text-[#737373] mb-3">These properties are automatically configured by the system.</p>
                        <div className="space-y-4">
                          {systemProps.map((prop, index) => (
                            <div key={`${prop.name}-${index}`} className="p-4 bg-[#F5F5F5] rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-[#171717]">{prop.label || prop.name}</span>
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
                    )}

                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-[#171717]">Trigger Tasks (Optional)</h4>
                        {!showTasksSection && (
                          <button
                            onClick={addTask}
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            + Add Task
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-[#737373] mb-3">
                        Define tasks to execute when this trigger fires (keyboard shortcuts, AI prompts, etc.)
                      </p>

                      {showTasksSection && (
                        <div className="space-y-4">
                          {tasks.map((task, index) => (
                            <div key={index} className="p-4 border border-[#E5E5E5] rounded-lg bg-white">
                              <div className="flex items-center justify-between mb-3">
                                <span className="font-semibold text-sm">
                                  Task
                                  {index + 1}
                                </span>
                                <button
                                  onClick={() => removeTask(index)}
                                  className="text-red-600 hover:text-red-700 text-sm"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="space-y-3">
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
                                        {task.keyboard_shortcut_ids && task.keyboard_shortcut_ids.length > 0
                                          ? `${task.keyboard_shortcut_ids.length} selected`
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
                                        const isSelected = task.keyboard_shortcut_ids?.includes(script.id) || false
                                        return (
                                          <DropdownMenuCheckboxItem
                                            key={script.id}
                                            checked={isSelected}
                                            onCheckedChange={(checked) => {
                                              const currentIds = task.keyboard_shortcut_ids || []
                                              const newIds = checked
                                                ? [...currentIds, script.id]
                                                : currentIds.filter(id => id !== script.id)
                                              updateTask(index, 'keyboard_shortcut_ids', newIds)
                                            }}
                                          >
                                            <div className="flex flex-col">
                                              <span className="font-medium">{script.name}</span>
                                              <span className="text-xs text-[#737373]">{script.description}</span>
                                            </div>
                                          </DropdownMenuCheckboxItem>
                                        )
                                      })}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  {task.keyboard_shortcut_ids && task.keyboard_shortcut_ids.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {task.keyboard_shortcut_ids.map((id) => {
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
                                                const newIds = (task.keyboard_shortcut_ids || []).filter(i => i !== id)
                                                updateTask(index, 'keyboard_shortcut_ids', newIds)
                                              }}
                                            />
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>

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
                                        {task.cloud_credentials && task.cloud_credentials.length > 0
                                          ? `${task.cloud_credentials.length} selected`
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
                                        const isSelected = task.cloud_credentials?.includes(cred.id) || false
                                        return (
                                          <DropdownMenuCheckboxItem
                                            key={cred.id}
                                            checked={isSelected}
                                            onCheckedChange={(checked) => {
                                              const currentCreds = task.cloud_credentials || []
                                              const newCreds = checked
                                                ? [...currentCreds, cred.id]
                                                : currentCreds.filter(id => id !== cred.id)
                                              updateTask(index, 'cloud_credentials', newCreds)
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
                                  {task.cloud_credentials && task.cloud_credentials.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {task.cloud_credentials.map((id) => {
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
                                                const newCreds = (task.cloud_credentials || []).filter(i => i !== id)
                                                updateTask(index, 'cloud_credentials', newCreds)
                                              }}
                                            />
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>

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
                                        {task.pipedream_proxy_apps && task.pipedream_proxy_apps.length > 0
                                          ? `${task.pipedream_proxy_apps.length} selected`
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
                                        const isSelected = task.pipedream_proxy_apps?.includes(appName) || false
                                        return (
                                          <DropdownMenuCheckboxItem
                                            key={appName}
                                            checked={isSelected}
                                            onCheckedChange={(checked) => {
                                              const currentApps = task.pipedream_proxy_apps || []
                                              const newApps = checked
                                                ? [...currentApps, appName]
                                                : currentApps.filter(name => name !== appName)
                                              updateTask(index, 'pipedream_proxy_apps', newApps)
                                            }}
                                          >
                                            <div className="flex flex-col">
                                              <span className="font-medium">{appName}</span>
                                            </div>
                                          </DropdownMenuCheckboxItem>
                                        )
                                      })}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  {task.pipedream_proxy_apps && task.pipedream_proxy_apps.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {task.pipedream_proxy_apps.map((appName) => {
                                        return (
                                          <span
                                            key={appName}
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs"
                                          >
                                            {appName}
                                            <X
                                              className="h-3 w-3 cursor-pointer hover:text-purple-900"
                                              onClick={() => {
                                                const newApps = (task.pipedream_proxy_apps || []).filter(name => name !== appName)
                                                updateTask(index, 'pipedream_proxy_apps', newApps)
                                              }}
                                            />
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>

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
                  </>
                )
              })()}
            </div>

            <div className="p-6 border-t border-[#E5E5E5] flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                disabled={isDeploying}
                className="px-6 py-2 border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Close
              </button>
              <button
                onClick={handleDeploy}
                disabled={isDeploying || !!deploySuccess}
                className="px-6 py-2 bg-[#171717] text-white rounded-lg hover:bg-[#404040] transition-colors disabled:bg-[#A3A3A3] disabled:cursor-not-allowed"
              >
                {isDeploying ? 'Deploying...' : deploySuccess ? 'Deployed!' : 'Deploy Trigger'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTasksModal && selectedDeployedTrigger && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] m-4 flex flex-col">
            <div className="p-6 border-b border-[#E5E5E5] flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-[#171717] mb-2">
                  Tasks for
                  {' '}
                  {selectedDeployedTrigger.triggerAction}
                </h3>
                <p className="text-sm text-[#737373]">
                  {selectedDeployedTrigger.tasks?.length || 0}
                  {' '}
                  task(s) configured
                </p>
              </div>
              <button
                onClick={handleCloseTasksModal}
                className="text-[#737373] hover:text-[#171717] ml-4"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {selectedDeployedTrigger.tasks && selectedDeployedTrigger.tasks.length > 0
                ? (
                    <div className="space-y-4">
                      {selectedDeployedTrigger.tasks.map((task, index) => (
                        <div key={task.id || index} className="p-4 border border-[#E5E5E5] rounded-lg bg-[#FAFAFA]">
                          <div className="mb-3">
                            <span className="font-semibold text-[#171717]">
                              Task
                              {' '}
                              {index + 1}
                            </span>
                            {task.id && (
                              <span className="ml-2 text-xs text-[#737373]">
                                ID:
                                {' '}
                                {task.id}
                              </span>
                            )}
                          </div>

                          <div className="space-y-3 text-sm">
                            {task.keyboard_shortcut_ids && task.keyboard_shortcut_ids.length > 0 && (
                              <div>
                                <span className="text-[#737373]">Keyboard Shortcuts:</span>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {task.keyboard_shortcut_ids.map((id, i) => (
                                    <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                      {id}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {task.cloud_credentials && task.cloud_credentials.length > 0 && (
                              <div>
                                <span className="text-[#737373]">Cloud Credentials:</span>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {task.cloud_credentials.map((cred, i) => (
                                    <span key={i} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                      {cred}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {task.pipedream_proxy_apps && task.pipedream_proxy_apps.length > 0 && (
                              <div>
                                <span className="text-[#737373]">Pipedream Proxy Apps:</span>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {task.pipedream_proxy_apps.map((app, i) => (
                                    <span key={i} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                      {app}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {task.ask && (
                              <div>
                                <span className="text-[#737373]">AI Prompt:</span>
                                <div className="mt-1 p-3 bg-white rounded border border-[#E5E5E5] text-[#171717]">
                                  {task.ask}
                                </div>
                              </div>
                            )}

                            {task.createdAt && (
                              <div className="text-xs text-[#737373] pt-2 border-t border-[#E5E5E5]">
                                Created:
                                {' '}
                                {new Date(task.createdAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                : (
                    <div className="text-center text-[#737373] py-8">
                      No tasks configured for this trigger
                    </div>
                  )}
            </div>

            <div className="p-6 border-t border-[#E5E5E5] flex justify-end">
              <button
                onClick={handleCloseTasksModal}
                className="px-6 py-2 border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
