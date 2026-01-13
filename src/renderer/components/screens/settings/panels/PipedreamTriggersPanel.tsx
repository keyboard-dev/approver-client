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
  secret?: boolean
  alertType?: string
  content?: string
  options?: string[]
  min?: number
  max?: number
}

interface TriggerApp {
  id: string
  name_slug: string
  name: string
  auth_type: string
  description?: string
  img_src?: string
}

interface Trigger {
  name: string
  description: string
  component_type: string
  version: string
  key: string
  configurable_props: ConfigurableProp[]
  app?: TriggerApp
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

interface ScheduleTrigger {
  scheduleType: 'daily' | 'weekly' | 'custom-interval'
  label: string
  description: string
}

// Hardcoded schedule trigger options
const SCHEDULE_TRIGGER_OPTIONS: ScheduleTrigger[] = [
  {
    scheduleType: 'daily',
    label: 'Daily',
    description: 'Run every day at a specific time',
  },
  {
    scheduleType: 'weekly',
    label: 'Weekly',
    description: 'Run every week on a specific day and time',
  },
  {
    scheduleType: 'custom-interval',
    label: 'Interval',
    description: 'Run at regular intervals (e.g., every 15 minutes)',
  },
]

interface AppWithTriggers {
  id: string
  name: string
  nameSlug: string
  logoUrl?: string
  description?: string
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
  const [selectedScheduleTrigger, setSelectedScheduleTrigger] = useState<ScheduleTrigger | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleLabel, setScheduleLabel] = useState('')
  const [scheduleTasks, setScheduleTasks] = useState<TriggerTask[]>([])
  const [scheduleHour, setScheduleHour] = useState('9')
  const [scheduleMinute, setScheduleMinute] = useState('0')
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState('1')
  const [scheduleInterval, setScheduleInterval] = useState('15')
  const [appsWithTriggers, setAppsWithTriggers] = useState<AppWithTriggers[]>([])
  const [isLoadingApps, setIsLoadingApps] = useState(false)
  const [connectedPipedreamApps, setConnectedPipedreamApps] = useState<Array<{ id: string, name: string, nameSlug: string }>>([])
  const [showConnectPrompt, setShowConnectPrompt] = useState(false)
  const [promptAppName, setPromptAppName] = useState('')

  const handleSearch = async (appSlug?: string) => {
    const searchApp = appSlug || appName.trim()
    if (!searchApp) {
      setError('Please enter an app name')
      return
    }

    setIsLoading(true)
    setError(null)
    setTriggers([])
    setSelectedTrigger(null)

    try {
      const response = await window.electronAPI.fetchPipedreamTriggers(searchApp)

      if (response.success && response.data) {
        const data = response.data as TriggersResponse
        if (data.triggers && data.triggers.length > 0) {
          // Filter out triggers that require pipedreamApiKey (instant triggers not compatible with Connect)
          const compatibleTriggers = data.triggers.filter((trigger) => {
            const requiresApiKey = trigger.configurable_props.some(
              prop => prop.name === 'pipedreamApiKey' && !prop.optional,
            )
            return !requiresApiKey
          })

          if (compatibleTriggers.length > 0) {
            setTriggers(compatibleTriggers)
          }
          else {
            setError('No compatible triggers found for this app. Some triggers require a Pipedream API key which is not available.')
          }
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

  const handlePopularAppClick = (appSlug: string) => {
    setAppName(appSlug)
    handleSearch(appSlug)
  }

  const loadAppsWithTriggers = async () => {
    setIsLoadingApps(true)
    try {
      const response = await window.electronAPI.fetchPipedreamApps({
        hasTriggers: true,
        limit: 12,
        sortKey: 'featured_weight',
        sortDirection: 'desc',
      })

      if (response.success && response.data) {
        const data = response.data as { apps: Array<{
          id: string
          name: string
          nameSlug: string
          logoUrl?: string
          description?: string
        }> }

        const apps: AppWithTriggers[] = data.apps.map(app => ({
          id: app.id,
          name: app.name,
          nameSlug: app.nameSlug,
          logoUrl: app.logoUrl,
          description: app.description,
        }))

        setAppsWithTriggers(apps)
      }
    }
    catch {
      // Silent fail - apps grid is optional
    }
    finally {
      setIsLoadingApps(false)
    }
  }

  const loadConnectedPipedreamAccounts = async () => {
    try {
      const response = await window.electronAPI.fetchPipedreamAccountsDetailed()

      if (response.success && response.data) {
        const data = response.data as { accounts: Array<{
          id: string
          name: string
          app: {
            id: string
            name: string
            nameSlug: string
          }
        }> }

        const connectedApps = data.accounts.map(account => ({
          id: account.app.id,
          name: account.app.name,
          nameSlug: account.app.nameSlug,
        }))

        setConnectedPipedreamApps(connectedApps)
      }
    }
    catch {
      // Silent fail
    }
  }

  const checkAppConnected = (appSlug: string): boolean => {
    console.log("this the app connected", appSlug)
    return connectedPipedreamApps.some(app =>
      app.nameSlug.toLowerCase() === appSlug.toLowerCase(),
    )
  }

  const handleConnectApp = async (appSlug: string) => {
    try {
      console.log("this is the app slug in handleConnectApp", appSlug)
      const response = await window.electronAPI.openPipedreamConnectLink(appSlug)
      if (response.success) {
        // Refresh connected accounts after a delay to allow OAuth completion
        setTimeout(() => {
          loadConnectedPipedreamAccounts()
        }, 2000)
      }
      else {
        setError(response.error || 'Failed to open connect link')
      }
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate connection')
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
    // System types that Pipedream handles automatically - users never need to configure these
    const systemTypes = [
      'app', // App authentication - handled by Pipedream Connect
      '$.service.db', // Internal database for state management
      '$.interface.timer', // Polling timer - has defaults or is static
      '$.interface.http', // HTTP webhook interface - auto-configured
      '$.interface.apphook', // App-specific hooks
      'alert', // Informational alerts, not user input
    ]

    // Prop names that are internal/system-level and shouldn't be shown
    const systemPropNames = [
      'pipedreamApiKey', // Users don't have Pipedream API keys in Connect context
      'db', // Internal database reference
      'http', // HTTP interface reference
    ]

    return props.filter((prop) => {
      // Filter out system types
      if (systemTypes.includes(prop.type)) return false

      // Filter out known system prop names
      if (systemPropNames.includes(prop.name)) return false

      // Filter out props without descriptions (usually internal)
      // Exception: still show if it has a label (some valid props have labels but no descriptions)
      if (!prop.description && !prop.label) return false

      return true
    })
  }

  // Get alert/info props to display as informational notices (not input fields)
  const getAlertProps = (props: ConfigurableProp[]): ConfigurableProp[] => {
    return props.filter(prop => prop.type === 'alert' && prop.content)
  }

  // Build the full configured props including auto-injected system props
  const buildConfiguredProps = (
    props: ConfigurableProp[],
    userValues: Record<string, unknown>,
    currentAppSlug: string,
  ): Record<string, unknown> => {
    const result: Record<string, unknown> = {}

    // Process each user value and check if it should be an array
    for (const [key, value] of Object.entries(userValues)) {
      const prop = props.find(p => p.name === key)

      // Check if this prop should be an array based on:
      // 1. Type ends with '[]' (e.g., 'string[]', 'integer[]')
      // 2. Type contains array notation
      // 3. Label or description contains array notation like '[]'
      const shouldBeArray = prop && (
        prop.type.endsWith('[]')
        || prop.type.includes('[]')
        || (prop.label && prop.label.includes('[]'))
        || (prop.description && prop.description.includes('[]'))
      )

      // Convert string values to single-element arrays if needed
      if (shouldBeArray && typeof value === 'string' && value.length > 0) {
        result[key] = [value]
      }
      else {
        result[key] = value
      }
    }

    // Auto-inject app prop - Pipedream Connect resolves this to the user's connected account
    const appProp = props.find(p => p.type === 'app')
    if (appProp) {
      // Use the app slug without version suffix for the connect reference
      const appName = currentAppSlug.replace(/_v\d+$/, '')
      result[appProp.name] = `{{connect.${appName}}}`
    }

    return result
  }

  const handleDeploy = async () => {
    if (!selectedTrigger) return

    setIsDeploying(true)
    setError(null)
    setDeploySuccess(null)

    try {
      // Check if the app is connected
      const appSlugToCheck = extractAppName(appName)
      if (!checkAppConnected(appSlugToCheck)) {
        setError(null)
        setPromptAppName(selectedTrigger.app?.name || appSlugToCheck)
        setShowConnectPrompt(true)
        setIsDeploying(false)
        return
      }

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

      // Build full configured props including auto-injected app prop
      const configuredProps = buildConfiguredProps(
        selectedTrigger.configurable_props,
        configValues,
        appName,
      )

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
        configuredProps,
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

    // Handle string[] with predefined options as a multi-select
    if (prop.type === 'string[]' && prop.options && prop.options.length > 0) {
      const selectedValues = Array.isArray(value) ? value : []
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {prop.options.map((option) => {
              const isSelected = selectedValues.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    const newValues = isSelected
                      ? selectedValues.filter(v => v !== option)
                      : [...selectedValues, option]
                    handleConfigChange(prop.name, newValues)
                  }}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    isSelected
                      ? 'bg-[#171717] text-white border-[#171717]'
                      : 'bg-white text-[#737373] border-[#E5E5E5] hover:border-[#171717]'
                  }`}
                >
                  {option}
                </button>
              )
            })}
          </div>
          {selectedValues.length > 0 && (
            <p className="text-xs text-[#737373]">
              Selected:
              {' '}
              {selectedValues.join(', ')}
            </p>
          )}
        </div>
      )
    }

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
      case 'integer[]':
        return (
          <input
            type="text"
            value={Array.isArray(value) ? value.join(', ') : ''}
            onChange={(e) => {
              const values = e.target.value
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
                .map(s => parseInt(s, 10))
                .filter(n => !isNaN(n))
              handleConfigChange(prop.name, values)
            }}
            placeholder="Enter comma-separated numbers (e.g., 0, 1, 2)"
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
      case 'integer':
      case 'number':
        return (
          <div className="space-y-1">
            <input
              type="number"
              value={(value as number) ?? (prop.default as number) ?? ''}
              onChange={e => handleConfigChange(prop.name, e.target.value ? parseInt(e.target.value, 10) : undefined)}
              placeholder={prop.default !== undefined ? String(prop.default) : ''}
              min={prop.min}
              max={prop.max}
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-2 focus:ring-[#171717]"
            />
            {(prop.min !== undefined || prop.max !== undefined) && (
              <p className="text-xs text-[#737373]">
                {prop.min !== undefined && `Min: ${prop.min}`}
                {prop.min !== undefined && prop.max !== undefined && ' | '}
                {prop.max !== undefined && `Max: ${prop.max}`}
              </p>
            )}
          </div>
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

  const buildCronExpression = (scheduleType: string): string => {
    switch (scheduleType) {
      case 'daily':
        return `${scheduleMinute} ${scheduleHour} * * *`
      case 'weekly':
        return `${scheduleMinute} ${scheduleHour} * * ${scheduleDayOfWeek}`
      case 'custom-interval':
        return `*/${scheduleInterval} * * * *`
      default:
        return '0 9 * * *'
    }
  }

  const handleScheduleTriggerClick = (trigger: ScheduleTrigger) => {
    setSelectedScheduleTrigger(trigger)
    setShowScheduleModal(true)
    setScheduleLabel(trigger.label)
    setScheduleTasks([])
    setDeploySuccess(null)
    setError(null)
    setScheduleHour('9')
    setScheduleMinute('0')
    setScheduleDayOfWeek('1')
    setScheduleInterval('15')
  }

  const handleCloseScheduleModal = () => {
    setShowScheduleModal(false)
    setSelectedScheduleTrigger(null)
    setScheduleLabel('')
    setScheduleTasks([])
    setDeploySuccess(null)
    setError(null)
    setScheduleHour('9')
    setScheduleMinute('0')
    setScheduleDayOfWeek('1')
    setScheduleInterval('15')
  }

  const handleDeployScheduleTrigger = async () => {
    if (!selectedScheduleTrigger) return

    if (!scheduleLabel.trim()) {
      setError('Please enter a label')
      return
    }

    setIsDeploying(true)
    setError(null)
    setDeploySuccess(null)

    try {
      const cronExpression = buildCronExpression(selectedScheduleTrigger.scheduleType)

      const tasksToSend = scheduleTasks.map(task => ({
        keyboard_shortcut_ids: task.keyboard_shortcut_ids || [],
        cloud_credentials: task.cloud_credentials || [],
        pipedream_proxy_apps: task.pipedream_proxy_apps || [],
        ask: task.ask || null,
      }))

      const response = await window.electronAPI.deployPipedreamScheduleTrigger({
        scheduleType: selectedScheduleTrigger.scheduleType,
        cron: {
          cron: cronExpression,
          timezone: 'UTC',
        },
        label: scheduleLabel,
        tasks: tasksToSend,
      })

      if (response.success) {
        setDeploySuccess('Schedule trigger deployed successfully!')
        setTimeout(() => {
          handleCloseScheduleModal()
          loadDeployedTriggers()
        }, 2000)
      }
      else {
        setError(response.error || 'Failed to deploy schedule trigger')
      }
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    }
    finally {
      setIsDeploying(false)
    }
  }

  const addScheduleTask = () => {
    setScheduleTasks([...scheduleTasks, {
      keyboard_shortcut_ids: [],
      cloud_credentials: [],
      pipedream_proxy_apps: [],
      ask: '',
    }])
  }

  const removeScheduleTask = (index: number) => {
    setScheduleTasks(scheduleTasks.filter((_, i) => i !== index))
  }

  const updateScheduleTask = (index: number, field: keyof TriggerTask, value: unknown) => {
    const newTasks = [...scheduleTasks]
    newTasks[index] = { ...newTasks[index], [field]: value }
    setScheduleTasks(newTasks)
  }

  useEffect(() => {
    checkTokenStatus()
  }, [])

  useEffect(() => {
    if (isTokenStored === true) {
      loadDeployedTriggers()
      loadTaskOptions()
      loadAppsWithTriggers()
      loadConnectedPipedreamAccounts()
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

          <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg mb-4">
            <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Important: Transparency Notice
            </h4>
            <p className="text-sm text-amber-900 font-medium">
              Webhook events will be processed through Pipedream's service before reaching our service. This is required for the webhook integration to function properly.
            </p>
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
        <h2 className="text-[1.25rem] font-bold mb-4">Pipedream Triggers</h2>
        <p className="text-[#737373] mb-6">
          Deploy time-based schedule triggers or search for webhook triggers powered by Pipedream.
        </p>

        <div className="mb-6 p-4 border border-[#E5E5E5] rounded-lg bg-[#FAFAFA]">
          <h3 className="font-semibold text-[#171717] mb-3">Schedule Triggers</h3>
          <p className="text-sm text-[#737373] mb-4">
            Deploy time-based triggers that run on a schedule
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SCHEDULE_TRIGGER_OPTIONS.map(trigger => (
              <button
                key={trigger.scheduleType}
                onClick={() => handleScheduleTriggerClick(trigger)}
                className="p-4 border border-[#E5E5E5] rounded-lg hover:border-[#171717] hover:shadow-sm transition-all bg-white text-left"
              >
                <div className="font-semibold text-[#171717] mb-1">{trigger.label}</div>
                <div className="text-xs text-[#737373]">{trigger.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-[#E5E5E5] pt-6">
          <h3 className="font-semibold text-[#171717] mb-3">🔔 Webhook Triggers</h3>
          <p className="text-[#737373] mb-4">
            Browse popular apps or search for webhook triggers
          </p>

          {/* Popular Apps */}
          {isLoadingApps
            ? (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-[#171717] mb-3">Popular Apps</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 border border-[#E5E5E5] rounded-lg bg-[#FAFAFA] animate-pulse">
                        <div className="w-6 h-6 bg-[#E5E5E5] rounded" />
                        <div className="flex-1 h-4 bg-[#E5E5E5] rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              )
            : appsWithTriggers.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-[#171717] mb-3">Popular Apps with Triggers</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {appsWithTriggers.map(app => (
                    <button
                      key={app.id}
                      onClick={() => handlePopularAppClick(app.nameSlug)}
                      disabled={isLoading}
                      className="flex items-center gap-2 p-3 border border-[#E5E5E5] rounded-lg hover:border-[#171717] hover:shadow-sm transition-all bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                      title={app.description}
                    >
                      <div className="w-6 h-6 flex-shrink-0">
                        {app.logoUrl
                          ? (
                              <img
                                src={app.logoUrl}
                                alt={app.name}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            )
                          : (
                              <div className="w-full h-full bg-[#F5F5F5] rounded flex items-center justify-center text-[#737373] text-xs font-bold">
                                {app.name.charAt(0)}
                              </div>
                            )}
                      </div>
                      <span className="text-sm font-medium text-[#171717] truncate">{app.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          {/* Search */}
          <div>
            <h4 className="text-sm font-semibold text-[#171717] mb-3">Search for App</h4>
            <div className="flex gap-3">
              <input
                type="text"
                value={appName}
                onChange={e => setAppName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter app name (e.g., slack, github, stripe)"
                className="flex-1 px-4 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#171717]"
                disabled={isLoading}
              />
              <button
                onClick={() => handleSearch()}
                disabled={isLoading}
                className="px-6 py-2 bg-[#171717] text-white rounded-lg hover:bg-[#404040] disabled:bg-[#A3A3A3] disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
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
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {/* App Logo */}
                    {trigger.app?.img_src && (
                      <div className="w-10 h-10 flex-shrink-0 rounded-lg border border-[#E5E5E5] flex items-center justify-center overflow-hidden bg-white">
                        <img
                          src={trigger.app.img_src}
                          alt={trigger.app.name}
                          className="w-6 h-6 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      </div>
                    )}

                    {/* Trigger Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#171717]">{trigger.name}</h3>
                        {trigger.app?.name && (
                          <span className="text-xs text-[#737373] px-2 py-0.5 bg-[#F5F5F5] rounded">
                            {trigger.app.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[#737373] mb-2 line-clamp-2">{trigger.description}</p>
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
                  </div>

                  {/* Arrow Icon */}
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

              <div className="mb-4 p-4 border border-amber-200 bg-amber-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-amber-900 mb-1">Transparency Notice</p>
                    <p className="text-sm text-amber-800">
                      Webhook events will be processed through Pipedream's service before reaching our service. This is required for webhook functionality.
                    </p>
                  </div>
                </div>
              </div>

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
                const alertProps = getAlertProps(selectedTrigger.configurable_props)

                return (
                  <>
                    {/* Show informational alerts from the component */}
                    {alertProps.length > 0 && (
                      <div className="mb-6 space-y-3">
                        {alertProps.map((prop, index) => (
                          <div
                            key={`alert-${index}`}
                            className={`p-4 rounded-lg border ${
                              prop.alertType === 'warning'
                                ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                                : 'bg-blue-50 border-blue-200 text-blue-800'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                              <p className="text-sm">{prop.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

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

                    {userConfigProps.length === 0 && alertProps.length === 0 && (
                      <div className="mb-6 p-4 bg-[#F5F5F5] rounded-lg text-center">
                        <p className="text-sm text-[#737373]">
                          No configuration needed. This trigger uses default settings.
                        </p>
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

      {showScheduleModal && selectedScheduleTrigger && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] m-4 flex flex-col">
            <div className="p-6 border-b border-[#E5E5E5] flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-[#171717] mb-2">
                  {selectedScheduleTrigger.label}
                  {' '}
                  Schedule Trigger
                </h3>
                <p className="text-sm text-[#737373]">{selectedScheduleTrigger.description}</p>
              </div>
              <button
                onClick={handleCloseScheduleModal}
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

              <div className="mb-4 p-4 border border-amber-200 bg-amber-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-amber-900 mb-1">Transparency Notice</p>
                    <p className="text-sm text-amber-800">
                      Schedule events will be processed through Pipedream's service before reaching our service. This is required for schedule trigger functionality.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3">⏰ Schedule Configuration</h4>

                  {selectedScheduleTrigger.scheduleType === 'daily' && (
                    <div className="space-y-3">
                      <p className="text-sm text-blue-800 mb-2">Run every day at a specific time</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-blue-900 mb-1">Hour (0-23)</label>
                          <input
                            type="number"
                            min="0"
                            max="23"
                            value={scheduleHour}
                            onChange={e => setScheduleHour(e.target.value)}
                            className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-blue-900 mb-1">Minute (0-59)</label>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={scheduleMinute}
                            onChange={e => setScheduleMinute(e.target.value)}
                            className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>
                      <div className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                        Cron:
                        {' '}
                        <span className="font-mono">{buildCronExpression('daily')}</span>
                      </div>
                    </div>
                  )}

                  {selectedScheduleTrigger.scheduleType === 'weekly' && (
                    <div className="space-y-3">
                      <p className="text-sm text-blue-800 mb-2">Run every week on a specific day and time</p>
                      <div>
                        <label className="block text-xs font-semibold text-blue-900 mb-1">Day of Week</label>
                        <select
                          value={scheduleDayOfWeek}
                          onChange={e => setScheduleDayOfWeek(e.target.value)}
                          className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="0">Sunday</option>
                          <option value="1">Monday</option>
                          <option value="2">Tuesday</option>
                          <option value="3">Wednesday</option>
                          <option value="4">Thursday</option>
                          <option value="5">Friday</option>
                          <option value="6">Saturday</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-blue-900 mb-1">Hour (0-23)</label>
                          <input
                            type="number"
                            min="0"
                            max="23"
                            value={scheduleHour}
                            onChange={e => setScheduleHour(e.target.value)}
                            className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-blue-900 mb-1">Minute (0-59)</label>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={scheduleMinute}
                            onChange={e => setScheduleMinute(e.target.value)}
                            className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>
                      <div className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                        Cron:
                        {' '}
                        <span className="font-mono">{buildCronExpression('weekly')}</span>
                      </div>
                    </div>
                  )}

                  {selectedScheduleTrigger.scheduleType === 'custom-interval' && (
                    <div className="space-y-3">
                      <p className="text-sm text-blue-800 mb-2">Run at regular intervals</p>
                      <div>
                        <label className="block text-xs font-semibold text-blue-900 mb-1">Interval (minutes)</label>
                        <select
                          value={scheduleInterval}
                          onChange={e => setScheduleInterval(e.target.value)}
                          className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="1">Every minute</option>
                          <option value="5">Every 5 minutes</option>
                          <option value="10">Every 10 minutes</option>
                          <option value="15">Every 15 minutes</option>
                          <option value="30">Every 30 minutes</option>
                          <option value="60">Every hour</option>
                        </select>
                      </div>
                      <div className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                        Cron:
                        {' '}
                        <span className="font-mono">{buildCronExpression('interval')}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#171717] mb-2">
                    Label
                    {' '}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={scheduleLabel}
                    onChange={e => setScheduleLabel(e.target.value)}
                    placeholder="e.g., Daily morning sync"
                    className="w-full px-3 py-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-2 focus:ring-[#171717]"
                  />
                  <p className="text-xs text-[#737373] mt-1">
                    A descriptive label for this schedule trigger
                  </p>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-[#171717]">Trigger Tasks (Optional)</h4>
                    {scheduleTasks.length === 0 && (
                      <button
                        onClick={addScheduleTask}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        + Add Task
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#737373] mb-3">
                    Define tasks to execute when this schedule triggers (keyboard shortcuts, AI prompts, etc.)
                  </p>

                  {scheduleTasks.length > 0 && (
                    <div className="space-y-4">
                      {scheduleTasks.map((task, index) => (
                        <div key={index} className="p-4 border border-[#E5E5E5] rounded-lg bg-white">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold text-sm">
                              Task
                              {index + 1}
                            </span>
                            <button
                              onClick={() => removeScheduleTask(index)}
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
                                          updateScheduleTask(index, 'keyboard_shortcut_ids', newIds)
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
                                            updateScheduleTask(index, 'keyboard_shortcut_ids', newIds)
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
                                          updateScheduleTask(index, 'cloud_credentials', newCreds)
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
                                            updateScheduleTask(index, 'cloud_credentials', newCreds)
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
                                          updateScheduleTask(index, 'pipedream_proxy_apps', newApps)
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
                                            updateScheduleTask(index, 'pipedream_proxy_apps', newApps)
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
                                onChange={e => updateScheduleTask(index, 'ask', e.target.value)}
                                placeholder="Enter an AI prompt or question..."
                                rows={3}
                                className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded focus:outline-none focus:ring-2 focus:ring-[#171717]"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={addScheduleTask}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        + Add Another Task
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#E5E5E5] flex justify-end gap-3">
              <button
                onClick={handleCloseScheduleModal}
                disabled={isDeploying}
                className="px-6 py-2 border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Close
              </button>
              <button
                onClick={handleDeployScheduleTrigger}
                disabled={isDeploying || !!deploySuccess}
                className="px-6 py-2 bg-[#171717] text-white rounded-lg hover:bg-[#404040] transition-colors disabled:bg-[#A3A3A3] disabled:cursor-not-allowed"
              >
                {isDeploying ? 'Deploying...' : deploySuccess ? 'Deployed!' : 'Deploy Schedule Trigger'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect App Prompt Modal */}
      {showConnectPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4">
            <div className="p-6">
              <h3 className="text-xl font-bold text-[#171717] mb-4">Connect App Required</h3>
              <p className="text-[#737373] mb-6">
                To deploy this trigger, you need to connect your
                {' '}
                <strong>{promptAppName}</strong>
                {' '}
                account first. This allows Pipedream to access your account on your behalf.
              </p>

              <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg mb-6">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-amber-900 mb-1">Why do I need to connect?</p>
                    <p className="text-sm text-amber-800">
                      This trigger requires access to your
                      {' '}
                      {promptAppName}
                      {' '}
                      account to receive events and execute actions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowConnectPrompt(false)
                    setPromptAppName('')
                  }}
                  className="px-6 py-2 border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleConnectApp(extractAppName(appName))
                    setShowConnectPrompt(false)
                    setPromptAppName('')
                  }}
                  className="px-6 py-2 bg-[#171717] text-white rounded-lg hover:bg-[#404040] transition-colors"
                >
                  Connect
                  {' '}
                  {promptAppName}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
