import { AlertCircle, CheckCircle, ChevronDown, Clock, Eye, X, XCircle, Zap } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Script } from '../../../../../main'
import useComposio from '../../../../hooks/useComposio'
import { deployTrigger, listTriggerTasks } from '../../../../services/composio-service'
import {
  type TriggerSource,
  type UnifiedTrigger,
  type UnifiedTriggerApp,
  listUnifiedTriggerApps,
  searchUnifiedTriggers,
} from '../../../../services/unified-triggers-service'
import { Button } from '../../../ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu'

// ============== TYPE DEFINITIONS ==============

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

interface DeployedPipedreamTrigger {
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

interface ScheduleTrigger {
  scheduleType: 'daily' | 'weekly' | 'custom-interval'
  label: string
  description: string
}

interface UnifiedDeployedTrigger {
  source: TriggerSource
  id: string
  name: string
  description?: string
  appName: string
  status: string
  createdAt: string
  // Pipedream-specific
  pipedreamTrigger?: DeployedPipedreamTrigger
  // Composio-specific
  composioTrigger?: {
    id: string
    name: string
    description?: string
    appName: string
    appKey?: string
    status: string
    createdAt: string
    connectedAccountId?: string
  }
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

// Source badge component
const SourceBadge: React.FC<{ source: TriggerSource }> = ({ source }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
    source === 'pipedream'
      ? 'bg-orange-100 text-orange-700 border border-orange-200'
      : 'bg-purple-100 text-purple-700 border border-purple-200'
  }`}
  >
    <Zap className="w-3 h-3" />
    {source === 'pipedream' ? 'Pipedream' : 'Composio'}
  </span>
)

// Connection status indicator
const ConnectionStatus: React.FC<{ isConnected: boolean, isActive?: boolean }> = ({ isConnected, isActive = true }) => (
  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
    isConnected && isActive
      ? 'bg-green-50 text-green-700 border border-green-200'
      : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
  }`}
  >
    {isConnected && isActive
      ? (
          <>
            <CheckCircle className="w-3 h-3" />
            Connected
          </>
        )
      : (
          <>
            <AlertCircle className="w-3 h-3" />
            {isConnected ? 'Expired' : 'Not connected'}
          </>
        )}
  </div>
)

export const TriggersPanel: React.FC = () => {
  // ============== COMPOSIO HOOK ==============
  const {
    accounts: composioAccounts,
    triggers: composioDeployedTriggers,
    triggersLoading: composioTriggersLoading,
    pausingTriggerId: composioPausingTriggerId,
    resumingTriggerId: composioResumingTriggerId,
    deletingTriggerId: composioDeletingTriggerId,
    refreshAccounts: refreshComposioAccounts,
    connectApp: connectComposioApp,
    checkAppAccountStatus: checkComposioAccountStatus,
    clearAccountStatus: clearComposioAccountStatus,
    refreshTriggers: refreshComposioTriggers,
    pauseTriggerAction: pauseComposioTrigger,
    resumeTriggerAction: resumeComposioTrigger,
    deleteTriggerAction: deleteComposioTrigger,
    accountStatus: composioAccountStatus,
    accountStatusLoading: composioAccountStatusLoading,
  } = useComposio()

  // ============== LOCAL STATE ==============
  // General
  const [appName, setAppName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Unified triggers state
  const [unifiedAvailableTriggers, setUnifiedAvailableTriggers] = useState<UnifiedTrigger[]>([])
  const [composioTriggerCount, setComposioTriggerCount] = useState(0)
  const [pipedreamTriggerCount, setPipedreamTriggerCount] = useState(0)

  // Pipedream deployed triggers state
  const [deployedPipedreamTriggers, setDeployedPipedreamTriggers] = useState<DeployedPipedreamTrigger[]>([])
  const [isLoadingPipedreamDeployed, setIsLoadingPipedreamDeployed] = useState(false)

  // Unified apps list
  const [unifiedApps, setUnifiedApps] = useState<UnifiedTriggerApp[]>([])
  const [isLoadingApps, setIsLoadingApps] = useState(false)

  // Connected accounts (Pipedream)
  const [connectedPipedreamApps, setConnectedPipedreamApps] = useState<Array<{ id: string, name: string, nameSlug: string }>>([])

  // Token status (Pipedream)
  const [isTokenStored, setIsTokenStored] = useState<boolean | null>(null)
  const [isCheckingToken, setIsCheckingToken] = useState(true)
  const [isStoringToken, setIsStoringToken] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)

  // Selected trigger state (unified)
  const [selectedUnifiedTrigger, setSelectedUnifiedTrigger] = useState<UnifiedTrigger | null>(null)
  const [selectedApp, setSelectedApp] = useState<{ name: string, slug: string, logoUrl?: string, source?: TriggerSource } | null>(null)

  // Modals
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showTriggersModal, setShowTriggersModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showConnectPrompt, setShowConnectPrompt] = useState(false)
  const [showAccountStatusModal, setShowAccountStatusModal] = useState(false)
  const [showViewTasksModal, setShowViewTasksModal] = useState(false)
  const [viewingTasksTrigger, setViewingTasksTrigger] = useState<UnifiedDeployedTrigger | null>(null)
  const [viewingTasks, setViewingTasks] = useState<TriggerTask[]>([])
  const [isLoadingViewTasks, setIsLoadingViewTasks] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTaskData, setEditingTaskData] = useState<TriggerTask | null>(null)
  const [isSavingTask, setIsSavingTask] = useState(false)
  const [promptAppName, setPromptAppName] = useState('')
  const [promptSource, setPromptSource] = useState<TriggerSource>('pipedream')

  // Config values
  const [configValues, setConfigValues] = useState<Record<string, unknown>>({})

  // Deploy state
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null)

  // Tasks
  const [tasks, setTasks] = useState<TriggerTask[]>([])
  const [showTasksSection, setShowTasksSection] = useState(false)
  const [availableScripts, setAvailableScripts] = useState<Script[]>([])
  const [availableCredentials, setAvailableCredentials] = useState<Array<{ id: string, connection: string, icon?: string }>>([])
  const [availablePipedreamAccounts, setAvailablePipedreamAccounts] = useState<string[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)

  // Schedule trigger state
  const [selectedScheduleTrigger, setSelectedScheduleTrigger] = useState<ScheduleTrigger | null>(null)
  const [scheduleLabel, setScheduleLabel] = useState('')
  const [scheduleTasks, setScheduleTasks] = useState<TriggerTask[]>([])
  const [scheduleHour, setScheduleHour] = useState('9')
  const [scheduleMinute, setScheduleMinute] = useState('0')
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState('1')
  const [scheduleInterval, setScheduleInterval] = useState('15')

  // ============== UNIFIED DATA ==============

  // Combine deployed triggers from both sources
  const unifiedDeployedTriggers: UnifiedDeployedTrigger[] = [
    ...deployedPipedreamTriggers.map(t => ({
      source: 'pipedream' as TriggerSource,
      id: t.id,
      name: t.triggerAction,
      description: undefined,
      appName: t.appName,
      status: t.status,
      createdAt: t.createdAt,
      pipedreamTrigger: t,
    })),
    ...composioDeployedTriggers.map(t => ({
      source: 'composio' as TriggerSource,
      id: t.id,
      name: t.name,
      description: t.description,
      appName: t.appName,
      status: t.status,
      createdAt: t.createdAt,
      composioTrigger: t,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // ============== INITIAL LOAD ==============

  useEffect(() => {
    checkTokenStatus()
    refreshComposioAccounts()
    loadUnifiedApps()
  }, [])

  useEffect(() => {
    if (isTokenStored === true) {
      loadDeployedPipedreamTriggers()
      loadTaskOptions()
      loadConnectedPipedreamAccounts()
    }
    refreshComposioTriggers()
  }, [isTokenStored])

  // ============== TOKEN STATUS ==============

  const checkTokenStatus = async () => {
    setIsCheckingToken(true)
    setTokenError(null)
    try {
      const response = await window.electronAPI.checkUserTokenStatus()
      if (response.success && response.data) {
        const data = response.data as { stored: boolean }
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

  // ============== LOAD FUNCTIONS ==============

  const loadUnifiedApps = async () => {
    setIsLoadingApps(true)
    try {
      const response = await listUnifiedTriggerApps()
      if (response.success && response.apps) {
        // Take first 12 apps for popular apps display
        setUnifiedApps(response.apps.slice(0, 12))
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
          app: { id: string, name: string, nameSlug: string }
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

  const loadDeployedPipedreamTriggers = async () => {
    setIsLoadingPipedreamDeployed(true)
    try {
      const response = await window.electronAPI.getDeployedPipedreamTriggers(true)
      if (response.success && response.data) {
        const data = response.data as { triggers: DeployedPipedreamTrigger[] }
        setDeployedPipedreamTriggers(data.triggers || [])
      }
    }
    catch {
      // Silently fail
    }
    finally {
      setIsLoadingPipedreamDeployed(false)
    }
  }

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

  // ============== CONNECTION CHECKS ==============

  const checkPipedreamAppConnected = (appSlug: string): boolean => {
    return connectedPipedreamApps.some(app =>
      app.nameSlug.toLowerCase() === appSlug.toLowerCase(),
    )
  }

  const checkComposioAppConnected = (appSlug: string): { connected: boolean, active: boolean } => {
    const account = composioAccounts.find(acc =>
      acc.appName?.toLowerCase() === appSlug.toLowerCase()
      || acc.toolkit?.slug?.toLowerCase() === appSlug.toLowerCase(),
    )
    return {
      connected: !!account,
      active: account?.status === 'active',
    }
  }

  // ============== SEARCH / POPULAR APP CLICK ==============

  const handleSearch = async (searchAppName?: string) => {
    const searchApp = searchAppName || appName.trim()
    if (!searchApp) {
      setError('Please enter an app name')
      return
    }

    setIsLoading(true)
    setError(null)
    setUnifiedAvailableTriggers([])
    setComposioTriggerCount(0)
    setPipedreamTriggerCount(0)

    try {
      const response = await searchUnifiedTriggers(searchApp)

      if (response.success && response.triggers) {
        setUnifiedAvailableTriggers(response.triggers)
        if (response.sources) {
          setComposioTriggerCount(response.sources.composio?.count || 0)
          setPipedreamTriggerCount(response.sources.pipedream?.count || 0)
        }
      }
      else {
        setError(response.error || 'Failed to search triggers')
      }

      // Set selected app for the modal
      setSelectedApp({
        name: response.app || searchApp,
        slug: searchApp,
      })

      // Show the triggers modal
      setShowTriggersModal(true)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    }
    finally {
      setIsLoading(false)
    }
  }

  const handlePopularAppClick = (app: UnifiedTriggerApp) => {
    setAppName(app.displayName)
    handleSearch(app.displayName)
  }

  // ============== TRIGGER CLICK HANDLERS ==============

  const handleUnifiedTriggerClick = async (trigger: UnifiedTrigger) => {
    const appSlugToCheck = trigger.sourceSlug || selectedApp?.slug || appName

    if (trigger.source === 'pipedream') {
      // Check Pipedream connection
      if (!checkPipedreamAppConnected(appSlugToCheck)) {
        setPromptAppName(trigger.appDisplayName || appSlugToCheck)
        setPromptSource('pipedream')
        setShowConnectPrompt(true)
        setShowTriggersModal(false)
        return
      }
    }
    else {
      // Check Composio connection
      const status = await checkComposioAccountStatus(appSlugToCheck)
      if (!status || !status.hasAccount || !status.isActive) {
        setSelectedUnifiedTrigger(trigger)
        setPromptAppName(trigger.appDisplayName || appSlugToCheck)
        setPromptSource('composio')
        setShowTriggersModal(false)
        setShowAccountStatusModal(true)
        return
      }
    }

    // Connection is active - proceed to config modal
    setSelectedUnifiedTrigger(trigger)
    setShowConfigModal(true)
    setShowTriggersModal(false)

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
    else {
      setConfigValues({})
    }

    setDeploySuccess(null)
    setError(null)
    setTasks([])
    setShowTasksSection(false)
    loadTaskOptions()
  }

  // ============== CONNECT HANDLERS ==============

  const handleConnectPipedreamApp = async (appSlug: string) => {
    try {
      const response = await window.electronAPI.openPipedreamConnectLink(appSlug)
      if (response.success) {
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

  const handleConnectComposioApp = async (appSlug: string) => {
    try {
      await connectComposioApp(appSlug)
      await refreshComposioAccounts()
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect account')
    }
  }

  const handleReconnectFromStatusModal = async () => {
    if (!selectedApp) return

    try {
      setError(null)
      if (promptSource === 'composio') {
        await connectComposioApp(selectedApp.slug)
        await refreshComposioAccounts()
      }
      else {
        await handleConnectPipedreamApp(selectedApp.slug)
      }
      setShowAccountStatusModal(false)
      clearComposioAccountStatus()
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reconnect account')
    }
  }

  // ============== DEPLOY HANDLERS ==============

  const extractAppName = (appSlug: string): string => {
    return appSlug.replace(/_v\d+$/, '')
  }

  const handleConfigChange = (propName: string, value: unknown) => {
    setConfigValues(prev => ({
      ...prev,
      [propName]: value,
    }))
  }

  const handleDeploy = async () => {
    if (!selectedUnifiedTrigger) return

    if (selectedUnifiedTrigger.source === 'pipedream') {
      await handleDeployPipedream()
    }
    else {
      await handleDeployComposio()
    }
  }

  const handleDeployPipedream = async () => {
    if (!selectedUnifiedTrigger) return

    setIsDeploying(true)
    setError(null)
    setDeploySuccess(null)

    try {
      const appSlugToCheck = selectedUnifiedTrigger.sourceSlug || selectedApp?.slug || appName
      if (!checkPipedreamAppConnected(appSlugToCheck)) {
        setPromptAppName(selectedUnifiedTrigger.appDisplayName || appSlugToCheck)
        setPromptSource('pipedream')
        setShowConnectPrompt(true)
        setIsDeploying(false)
        return
      }

      // Check required fields
      const required = selectedUnifiedTrigger.config?.required || []
      const missingProps = required.filter((prop) => {
        const value = configValues[prop]
        return value === undefined || value === null || value === ''
      })

      if (missingProps.length > 0) {
        const propLabels = missingProps.map((prop) => {
          const propConfig = selectedUnifiedTrigger.config?.properties?.[prop]
          return (propConfig as { title?: string })?.title || prop
        })
        setError(`Please fill in all required fields: ${propLabels.join(', ')}`)
        return
      }

      const currentAppSlug = selectedUnifiedTrigger.sourceSlug || selectedApp?.slug || appName

      // Build configured props with app placeholder
      const configuredProps: Record<string, unknown> = { ...configValues }
      const appNameClean = extractAppName(currentAppSlug)
      // Add the app connection placeholder if needed
      if (selectedUnifiedTrigger.config?.properties) {
        const hasAppProp = Object.entries(selectedUnifiedTrigger.config.properties).some(
          ([, value]) => (value as { type?: string }).type === 'app',
        )
        if (hasAppProp) {
          const appPropName = Object.entries(selectedUnifiedTrigger.config.properties).find(
            ([, value]) => (value as { type?: string }).type === 'app',
          )?.[0]
          if (appPropName) {
            configuredProps[appPropName] = `{{connect.${appNameClean}}}`
          }
        }
      }

      const tasksToSend = tasks.map(task => ({
        keyboard_shortcut_ids: task.keyboard_shortcut_ids || [],
        cloud_credentials: task.cloud_credentials || [],
        pipedream_proxy_apps: task.pipedream_proxy_apps || [],
        ask: task.ask || null,
      }))

      const response = await window.electronAPI.deployPipedreamTrigger({
        componentKey: selectedUnifiedTrigger.id,
        appName: appNameClean,
        appSlug: currentAppSlug,
        configuredProps,
        tasks: tasksToSend,
      })

      if (response.success) {
        setDeploySuccess('Trigger deployed successfully!')
        setTimeout(() => {
          handleCloseConfigModal()
          loadDeployedPipedreamTriggers()
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

  const handleDeployComposio = async () => {
    if (!selectedUnifiedTrigger || !selectedApp) return

    const appSlug = selectedUnifiedTrigger.sourceSlug || selectedApp.slug

    const connectedAccount = composioAccounts.find(acc =>
      acc.appName?.toLowerCase() === appSlug.toLowerCase()
      || acc.toolkit?.slug?.toLowerCase() === appSlug.toLowerCase(),
    )

    if (!connectedAccount) {
      setError('No connected account found for this app')
      return
    }

    setIsDeploying(true)
    setError(null)
    setDeploySuccess(null)

    try {
      const tasksToSend = tasks
        .filter(task => task.ask || (task.keyboard_shortcut_ids && task.keyboard_shortcut_ids.length > 0) || (task.cloud_credentials && task.cloud_credentials.length > 0) || (task.pipedream_proxy_apps && task.pipedream_proxy_apps.length > 0))
        .map(task => ({
          keyboardShortcutIds: task.keyboard_shortcut_ids || [],
          cloudCredentials: task.cloud_credentials || [],
          pipedreamProxyApps: task.pipedream_proxy_apps || [],
          ask: task.ask || undefined,
        }))

      const response = await deployTrigger({
        connectedAccountId: connectedAccount.id,
        triggerName: selectedUnifiedTrigger.id,
        appName: appSlug,
        config: configValues,
        encryptionEnabled: true,
        tasks: tasksToSend.length > 0 ? tasksToSend : undefined,
      })

      if (response.success) {
        setDeploySuccess('Trigger deployed successfully!')
        setTimeout(() => {
          handleCloseConfigModal()
          refreshComposioTriggers()
        }, 2000)
      }
      else {
        setError(response.error || 'Failed to deploy trigger')
      }
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy trigger')
    }
    finally {
      setIsDeploying(false)
    }
  }

  // ============== DELETE HANDLERS ==============

  const handleDeleteDeployedTrigger = async (trigger: UnifiedDeployedTrigger) => {
    if (!confirm('Are you sure you want to delete this trigger?')) return

    try {
      if (trigger.source === 'pipedream') {
        const response = await window.electronAPI.deleteDeployedPipedreamTrigger(trigger.id)
        if (response.success) {
          await loadDeployedPipedreamTriggers()
        }
        else {
          alert(`Failed to delete trigger: ${response.error || 'Unknown error'}`)
        }
      }
      else {
        await deleteComposioTrigger(trigger.id)
      }
    }
    catch (err) {
      alert(`Failed to delete trigger: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handlePauseResumeTrigger = async (trigger: UnifiedDeployedTrigger) => {
    if (trigger.source !== 'composio') return

    try {
      if (trigger.status === 'active') {
        await pauseComposioTrigger(trigger.id)
      }
      else {
        await resumeComposioTrigger(trigger.id)
      }
    }
    catch (err) {
      alert(`Failed to ${trigger.status === 'active' ? 'pause' : 'resume'} trigger: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // ============== VIEW TASKS HANDLER ==============

  const handleViewTasks = async (trigger: UnifiedDeployedTrigger) => {
    setViewingTasksTrigger(trigger)
    setShowViewTasksModal(true)
    setIsLoadingViewTasks(true)
    setViewingTasks([])

    try {
      if (trigger.source === 'pipedream' && trigger.pipedreamTrigger?.tasks) {
        // For Pipedream, tasks are already included in the trigger
        setViewingTasks(trigger.pipedreamTrigger.tasks)
      }
      else if (trigger.source === 'composio') {
        // For Composio, fetch tasks from API
        console.log("this is the trigger", trigger)
        const response = await listTriggerTasks(trigger.id)
        console.log("this is the response", response)

        if (response.success) {
          // Handle different possible response structures
          type TaskData = {
            id?: string
            deployedTriggerId?: string
            keyboardShortcutIds?: string[]
            keyboard_shortcut_ids?: string[]
            cloudCredentials?: string[]
            cloud_credentials?: string[]
            pipedreamProxyApps?: string[]
            pipedream_proxy_apps?: string[]
            ask?: string
            createdAt?: string
            updatedAt?: string
          }

          let tasksArray: TaskData[] = []

          // Check various possible response structures
          const data = response.data as { items?: TaskData[], tasks?: TaskData[] } | TaskData[] | undefined
          if (data) {
            if (Array.isArray(data)) {
              // data is directly an array
              tasksArray = data
            }
            else if (Array.isArray(data.items)) {
              // data.items is an array
              tasksArray = data.items
            }
            else if (Array.isArray(data.tasks)) {
              // data.tasks is an array
              tasksArray = data.tasks
            }
          }

          // Map to TriggerTask format (handle both camelCase and snake_case)
          const mappedTasks: TriggerTask[] = tasksArray.map(t => ({
            id: t.id,
            deployedTriggerId: t.deployedTriggerId,
            keyboard_shortcut_ids: t.keyboardShortcutIds || t.keyboard_shortcut_ids,
            cloud_credentials: t.cloudCredentials || t.cloud_credentials,
            pipedream_proxy_apps: t.pipedreamProxyApps || t.pipedream_proxy_apps,
            ask: t.ask,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          }))
          setViewingTasks(mappedTasks)
        }
      }
    }
    catch {
      // Error loading tasks - silent fail, empty tasks array shown
    }
    finally {
      setIsLoadingViewTasks(false)
    }
  }

  const handleCloseViewTasksModal = () => {
    setShowViewTasksModal(false)
    setViewingTasksTrigger(null)
    setViewingTasks([])
    setEditingTaskId(null)
    setEditingTaskData(null)
  }

  const handleStartEditTask = (task: TriggerTask) => {
    setEditingTaskId(task.id || null)
    setEditingTaskData({ ...task })
  }

  const handleCancelEditTask = () => {
    setEditingTaskId(null)
    setEditingTaskData(null)
  }

  const handleUpdateEditingTask = (field: keyof TriggerTask, value: unknown) => {
    if (editingTaskData) {
      setEditingTaskData({ ...editingTaskData, [field]: value })
    }
  }

  const handleSaveTask = async () => {
    if (!editingTaskData || !editingTaskId) return

    setIsSavingTask(true)
    try {
      const updates = {
        keyboardShortcutIds: editingTaskData.keyboard_shortcut_ids,
        cloudCredentials: editingTaskData.cloud_credentials,
        pipedreamProxyApps: editingTaskData.pipedream_proxy_apps,
        ask: editingTaskData.ask || undefined,
      }

      const response = await window.electronAPI.updateComposioTriggerTask(editingTaskId, updates)

      if (response.success) {
        // Update the local state with the edited task
        setViewingTasks(prev => prev.map(t =>
          t.id === editingTaskId ? { ...t, ...editingTaskData } : t,
        ))
        setEditingTaskId(null)
        setEditingTaskData(null)
      }
      else {
        setError(response.error || 'Failed to update task')
      }
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task')
    }
    finally {
      setIsSavingTask(false)
    }
  }

  // ============== MODAL HANDLERS ==============

  const handleCloseConfigModal = () => {
    setShowConfigModal(false)
    setSelectedUnifiedTrigger(null)
    setConfigValues({})
    setDeploySuccess(null)
    setError(null)
    setTasks([])
    setShowTasksSection(false)
  }

  const handleCloseTriggersModal = () => {
    setShowTriggersModal(false)
    setUnifiedAvailableTriggers([])
    setComposioTriggerCount(0)
    setPipedreamTriggerCount(0)
  }

  // ============== SCHEDULE TRIGGER HANDLERS ==============

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
    loadTaskOptions()
  }

  const handleCloseScheduleModal = () => {
    setShowScheduleModal(false)
    setSelectedScheduleTrigger(null)
    setScheduleLabel('')
    setScheduleTasks([])
    setDeploySuccess(null)
    setError(null)
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
          loadDeployedPipedreamTriggers()
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

  // ============== TASK HANDLERS ==============

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

  // ============== KEY HANDLERS ==============

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // ============== RENDER CONFIG INPUT ==============

  const renderConfigInput = (propName: string, propConfig: Record<string, unknown>) => {
    const value = configValues[propName]
    const type = propConfig.type as string
    const enumValues = propConfig.enum as string[] | undefined
    const options = propConfig.options as Array<{ label: string, value: string }> | undefined

    // Handle enum/options
    if (enumValues && enumValues.length > 0) {
      return (
        <select
          value={(value as string) || ''}
          onChange={e => handleConfigChange(propName, e.target.value)}
          className="w-full px-3 py-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-2 focus:ring-[#171717]"
        >
          <option value="">Select...</option>
          {enumValues.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }

    if (options && options.length > 0) {
      return (
        <select
          value={(value as string) || ''}
          onChange={e => handleConfigChange(propName, e.target.value)}
          className="w-full px-3 py-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-2 focus:ring-[#171717]"
        >
          <option value="">Select...</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )
    }

    switch (type) {
      case 'boolean':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(value as boolean) || false}
              onChange={e => handleConfigChange(propName, e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-[#737373]">Enable</span>
          </label>
        )
      case 'number':
      case 'integer':
        return (
          <input
            type="number"
            value={(value as number) ?? ''}
            onChange={e => handleConfigChange(propName, e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder={propConfig.default !== undefined ? String(propConfig.default) : ''}
            className="w-full px-3 py-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-2 focus:ring-[#171717]"
          />
        )
      case 'array':
      case 'string[]':
        return (
          <input
            type="text"
            value={Array.isArray(value) ? value.join(', ') : ''}
            onChange={e => handleConfigChange(propName, e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            placeholder="Enter comma-separated values"
            className="w-full px-3 py-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-2 focus:ring-[#171717]"
          />
        )
      default:
        return (
          <input
            type="text"
            value={(value as string) || ''}
            onChange={e => handleConfigChange(propName, e.target.value)}
            placeholder={propConfig.default !== undefined ? String(propConfig.default) : ''}
            className="w-full px-3 py-2 border border-[#E5E5E5] rounded focus:outline-none focus:ring-2 focus:ring-[#171717]"
          />
        )
    }
  }

  // ============== RENDER TASK SECTION ==============

  const renderTaskSection = (
    taskList: TriggerTask[],
    updateFn: (index: number, field: keyof TriggerTask, value: unknown) => void,
    removeFn: (index: number) => void,
    addFn: () => void,
  ) => (
    <div className="space-y-4">
      {taskList.map((task, index) => (
        <div key={index} className="p-4 border border-[#E5E5E5] rounded-lg bg-white">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm">
              Task
              {index + 1}
            </span>
            <button onClick={() => removeFn(index)} className="text-red-600 hover:text-red-700 text-sm">
              Remove
            </button>
          </div>

          <div className="space-y-3">
            {/* Keyboard Shortcuts */}
            {/* <div>
              <label className="text-xs text-[#737373] mb-2 block">Keyboard Shortcuts</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between text-sm h-auto min-h-[2.5rem] py-2" disabled={isLoadingOptions}>
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
                    <div className="px-2 py-3 text-sm text-[#737373]">No shortcuts available</div>
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
                          updateFn(index, 'keyboard_shortcut_ids', newIds)
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
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {script?.name || id}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-blue-900"
                          onClick={() => {
                            const newIds = (task.keyboard_shortcut_ids || []).filter(i => i !== id)
                            updateFn(index, 'keyboard_shortcut_ids', newIds)
                          }}
                        />
                      </span>
                    )
                  })}
                </div>
              )}
            </div> */}

            {/* Cloud Credentials */}
            {/* <div>
              <label className="text-xs text-[#737373] mb-2 block">Cloud Credentials</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between text-sm h-auto min-h-[2.5rem] py-2" disabled={isLoadingOptions}>
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
                    <div className="px-2 py-3 text-sm text-[#737373]">No connected accounts</div>
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
                          updateFn(index, 'cloud_credentials', newCreds)
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {cred.icon && <img src={cred.icon} alt="" className="w-4 h-4" />}
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
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                        {cred?.connection || id}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-green-900"
                          onClick={() => {
                            const newCreds = (task.cloud_credentials || []).filter(i => i !== id)
                            updateFn(index, 'cloud_credentials', newCreds)
                          }}
                        />
                      </span>
                    )
                  })}
                </div>
              )}
            </div> */}

            {/* Pipedream Proxy Apps */}
            <div>
              <label className="text-xs text-[#737373] mb-2 block">Pipedream Proxy Apps</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between text-sm h-auto min-h-[2.5rem] py-2" disabled={isLoadingOptions}>
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
                    <div className="px-2 py-3 text-sm text-[#737373]">No Pipedream apps connected</div>
                  )}
                  {availablePipedreamAccounts && availablePipedreamAccounts.map((appNameItem) => {
                    const isSelected = task.pipedream_proxy_apps?.includes(appNameItem) || false
                    return (
                      <DropdownMenuCheckboxItem
                        key={appNameItem}
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          const currentApps = task.pipedream_proxy_apps || []
                          const newApps = checked
                            ? [...currentApps, appNameItem]
                            : currentApps.filter(name => name !== appNameItem)
                          updateFn(index, 'pipedream_proxy_apps', newApps)
                        }}
                      >
                        <span className="font-medium">{appNameItem}</span>
                      </DropdownMenuCheckboxItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              {task.pipedream_proxy_apps && task.pipedream_proxy_apps.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {task.pipedream_proxy_apps.map(appNameItem => (
                    <span key={appNameItem} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                      {appNameItem}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-purple-900"
                        onClick={() => {
                          const newApps = (task.pipedream_proxy_apps || []).filter(name => name !== appNameItem)
                          updateFn(index, 'pipedream_proxy_apps', newApps)
                        }}
                      />
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* AI Prompt */}
            <div>
              <label className="text-xs text-[#737373] mb-1 block">AI Prompt (optional)</label>
              <textarea
                value={task.ask || ''}
                onChange={e => updateFn(index, 'ask', e.target.value)}
                placeholder="Enter an AI prompt or question..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded focus:outline-none focus:ring-2 focus:ring-[#171717]"
              />
            </div>
          </div>
        </div>
      ))}

      <button onClick={addFn} className="text-sm text-blue-600 hover:text-blue-700">
        + Add
        {' '}
        {taskList.length > 0 ? 'Another ' : ''}
        Task
      </button>
    </div>
  )

  // ============== LOADING STATE ==============

  if (isCheckingToken) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full p-6">
        <div className="text-[#737373] mb-2">Loading triggers...</div>
      </div>
    )
  }

  // ============== MAIN RENDER ==============

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      <div className="p-6">
        <h2 className="text-[1.25rem] font-bold mb-4">Triggers</h2>
        <p className="text-[#737373] mb-6">
          Deploy schedule triggers or webhook triggers powered by Pipedream and Composio.
        </p>

        {/* Token setup notice if not stored */}
        {isTokenStored === false && (
          <div className="mb-6 p-4 border border-amber-200 bg-amber-50 rounded-lg">
            <h4 className="font-semibold text-amber-900 mb-2">Enable Pipedream Integration</h4>
            <p className="text-sm text-amber-800 mb-3">
              To use Pipedream webhook triggers, you need to enable access by storing your refresh token securely.
            </p>
            <button
              onClick={async () => {
                try {
                  await storeRefreshToken()
                }
                catch {
                  // Error handled in storeRefreshToken
                }
              }}
              disabled={isStoringToken}
              className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:bg-amber-400 transition-colors text-sm"
            >
              {isStoringToken ? 'Enabling...' : 'Enable Pipedream'}
            </button>
            {tokenError && <p className="text-red-600 text-sm mt-2">{tokenError}</p>}
          </div>
        )}

        {/* Schedule Triggers Section */}
        {isTokenStored && (
          <div className="mb-6 p-4 border border-[#E5E5E5] rounded-lg bg-[#FAFAFA]">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-[#737373]" />
              <h3 className="font-semibold text-[#171717]">Schedule Triggers</h3>
              <SourceBadge source="pipedream" />
            </div>
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
        )}

        {/* Webhook Triggers Section */}
        <div className="border-t border-[#E5E5E5] pt-6">
          <h3 className="font-semibold text-[#171717] mb-3">Webhook Triggers</h3>
          <p className="text-[#737373] mb-4">
            Browse popular apps or search for webhook triggers
          </p>

          {/* Popular Apps Grid */}
          {isLoadingApps ? (
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
          ) : unifiedApps.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-[#171717] mb-3">Popular Apps with Triggers</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {unifiedApps.map((app) => {
                  const pipedreamConnected = app.pipedreamSlug ? checkPipedreamAppConnected(app.pipedreamSlug) : false
                  const composioStatus = app.composioSlug ? checkComposioAppConnected(app.composioSlug) : { connected: false, active: false }
                  const isConnected = pipedreamConnected || composioStatus.connected

                  return (
                    <button
                      key={app.displayName}
                      onClick={() => handlePopularAppClick(app)}
                      disabled={isLoading}
                      className="flex items-center gap-2 p-3 border border-[#E5E5E5] rounded-lg hover:border-[#171717] hover:shadow-sm transition-all bg-white disabled:opacity-50 disabled:cursor-not-allowed relative"
                    >
                      {/* Connection indicator */}
                      {isConnected && (
                        <div className="absolute top-1 right-1">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        </div>
                      )}
                      <div className="w-6 h-6 flex-shrink-0">
                        {/* Prefer Pipedream logo, fallback to Composio, then generic logoUrl */}
                        {(app.pipedreamLogoUrl || app.composioLogoUrl || app.logoUrl)
                          ? (
                              <img
                                src={app.pipedreamLogoUrl || app.composioLogoUrl || app.logoUrl}
                                alt={app.displayName}
                                className="w-full h-full object-contain rounded"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                  const parent = (e.target as HTMLImageElement).parentElement
                                  if (parent) {
                                    parent.classList.add('bg-[#F5F5F5]', 'flex', 'items-center', 'justify-center', 'text-[#737373]', 'text-xs', 'font-bold')
                                    parent.textContent = app.displayName.charAt(0)
                                  }
                                }}
                              />
                            )
                          : (
                              <div className="w-full h-full bg-[#F5F5F5] rounded flex items-center justify-center text-[#737373] text-xs font-bold">
                                {app.displayName.charAt(0)}
                              </div>
                            )}
                      </div>
                      <span className="text-sm font-medium text-[#171717] truncate">{app.displayName}</span>
                    </button>
                  )
                })}
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
                placeholder="Enter app name (e.g., slack, github, google sheets)"
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
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Deployed Triggers Section */}
      {unifiedDeployedTriggers.length > 0 && (
        <div className="px-6 pb-6 border-b border-[#E5E5E5]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#171717]">
              Deployed Triggers (
              {unifiedDeployedTriggers.length}
              )
            </h3>
            <button
              onClick={() => {
                loadDeployedPipedreamTriggers()
                refreshComposioTriggers()
              }}
              disabled={isLoadingPipedreamDeployed || composioTriggersLoading}
              className="text-sm text-[#737373] hover:text-[#171717] disabled:opacity-50"
            >
              {isLoadingPipedreamDeployed || composioTriggersLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <div className="space-y-2">
            {unifiedDeployedTriggers.map(trigger => (
              <div
                key={`${trigger.source}-${trigger.id}`}
                className="p-3 border border-[#E5E5E5] rounded-lg bg-[#FAFAFA]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm text-[#171717]">
                        {trigger.name}
                      </span>
                      <SourceBadge source={trigger.source} />
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          trigger.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {trigger.status}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs text-[#737373] flex-wrap">
                      <span>
                        App:
                        {trigger.appName}
                      </span>
                      <span>
                        Deployed:
                        {new Date(trigger.createdAt).toLocaleDateString()}
                      </span>
                      {trigger.pipedreamTrigger?.tasks && trigger.pipedreamTrigger.tasks.length > 0 && (
                        <span className="text-blue-600">
                          Tasks:
                          {' '}
                          {trigger.pipedreamTrigger.tasks.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-3">
                    <button
                      onClick={() => handleViewTasks(trigger)}
                      className="text-xs px-3 py-1 border border-blue-200 text-blue-600 rounded hover:bg-blue-50 transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      View Task
                    </button>
                    {trigger.source === 'composio' && (
                      <button
                        onClick={() => handlePauseResumeTrigger(trigger)}
                        disabled={composioPausingTriggerId === trigger.id || composioResumingTriggerId === trigger.id}
                        className="text-xs px-3 py-1 border border-[#E5E5E5] rounded hover:bg-white transition-colors disabled:opacity-50"
                      >
                        {composioPausingTriggerId === trigger.id || composioResumingTriggerId === trigger.id
                          ? '...'
                          : trigger.status === 'active' ? 'Pause' : 'Resume'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteDeployedTrigger(trigger)}
                      disabled={composioDeletingTriggerId === trigger.id}
                      className="text-xs px-3 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {composioDeletingTriggerId === trigger.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Triggers Modal */}
      {showTriggersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] m-4 flex flex-col">
            <div className="p-6 border-b border-[#E5E5E5] flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-[#171717] mb-2">
                  Available Triggers for
                  {' '}
                  {selectedApp?.name}
                </h3>
                <p className="text-sm text-[#737373]">
                  {unifiedAvailableTriggers.length}
                  {' '}
                  trigger
                  {unifiedAvailableTriggers.length !== 1 ? 's' : ''}
                  {' '}
                  found
                  {composioTriggerCount > 0 && pipedreamTriggerCount > 0 && (
                    <>
                      {' '}
                      (
                      {composioTriggerCount}
                      {' '}
                      Composio,
                      {pipedreamTriggerCount}
                      {' '}
                      Pipedream)
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={handleCloseTriggersModal}
                className="text-[#737373] hover:text-[#171717] ml-4"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-[#737373]">Loading triggers...</div>
                </div>
              )}

              {!isLoading && unifiedAvailableTriggers.length === 0 && (
                <div className="text-center py-8 text-[#737373]">
                  No triggers found for this app
                </div>
              )}

              {!isLoading && unifiedAvailableTriggers.length > 0 && (
                <div className="space-y-3">
                  {unifiedAvailableTriggers.map((trigger) => {
                    // Connection status
                    const appSlug = trigger.sourceSlug || selectedApp?.slug || ''
                    const pipedreamConnected = trigger.source === 'pipedream' ? checkPipedreamAppConnected(appSlug) : false
                    const composioStatus = trigger.source === 'composio' ? checkComposioAppConnected(appSlug) : { connected: false, active: false }
                    const isConnected = trigger.source === 'pipedream' ? pipedreamConnected : composioStatus.connected
                    const isActive = trigger.source === 'pipedream' ? true : composioStatus.active

                    return (
                      <button
                        key={`${trigger.source}-${trigger.id}`}
                        onClick={() => handleUnifiedTriggerClick(trigger)}
                        className="w-full text-left p-4 border border-[#E5E5E5] rounded-lg hover:border-[#171717] hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* App Logo */}
                            <div className="w-10 h-10 flex-shrink-0">
                              {trigger.appInfo?.logoUrl
                                ? (
                                    <img
                                      src={trigger.appInfo.logoUrl}
                                      alt={trigger.appDisplayName}
                                      className="w-full h-full object-contain rounded"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                        const parent = (e.target as HTMLImageElement).parentElement
                                        if (parent) {
                                          parent.classList.add('bg-[#F5F5F5]', 'flex', 'items-center', 'justify-center', 'text-[#737373]', 'text-sm', 'font-bold')
                                          parent.textContent = trigger.appDisplayName?.charAt(0) || trigger.app?.charAt(0) || '?'
                                        }
                                      }}
                                    />
                                  )
                                : (
                                    <div className="w-full h-full bg-[#F5F5F5] rounded flex items-center justify-center text-[#737373] text-sm font-bold">
                                      {trigger.appDisplayName?.charAt(0) || trigger.app?.charAt(0) || '?'}
                                    </div>
                                  )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h4 className="font-semibold text-[#171717]">{trigger.name}</h4>
                                <SourceBadge source={trigger.source} />
                              </div>
                              <p className="text-sm text-[#737373] mb-2 line-clamp-2">{trigger.description}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <ConnectionStatus isConnected={isConnected} isActive={isActive} />
                            <svg
                              className="w-5 h-5 text-[#737373]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfigModal && selectedUnifiedTrigger && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] m-4 flex flex-col">
            <div className="p-6 border-b border-[#E5E5E5] flex items-start justify-between">
              <div className="flex items-center gap-4 flex-1">
                {/* App Logo */}
                <div className="w-12 h-12 flex-shrink-0">
                  {selectedUnifiedTrigger.appInfo?.logoUrl
                    ? (
                        <img
                          src={selectedUnifiedTrigger.appInfo.logoUrl}
                          alt={selectedUnifiedTrigger.appDisplayName}
                          className="w-full h-full object-contain rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                            const parent = (e.target as HTMLImageElement).parentElement
                            if (parent) {
                              parent.classList.add('bg-[#F5F5F5]', 'flex', 'items-center', 'justify-center', 'text-[#737373]', 'text-lg', 'font-bold')
                              parent.textContent = selectedUnifiedTrigger.appDisplayName?.charAt(0) || selectedUnifiedTrigger.app?.charAt(0) || '?'
                            }
                          }}
                        />
                      )
                    : (
                        <div className="w-full h-full bg-[#F5F5F5] rounded flex items-center justify-center text-[#737373] text-lg font-bold">
                          {selectedUnifiedTrigger.appDisplayName?.charAt(0) || selectedUnifiedTrigger.app?.charAt(0) || '?'}
                        </div>
                      )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-[#171717]">{selectedUnifiedTrigger.name}</h3>
                    <SourceBadge source={selectedUnifiedTrigger.source} />
                  </div>
                  <p className="text-sm text-[#737373]">{selectedUnifiedTrigger.description}</p>
                </div>
              </div>
              <button onClick={handleCloseConfigModal} className="text-[#737373] hover:text-[#171717] ml-4">
                <X className="w-6 h-6" />
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

              {/* Transparency Notice */}
              <div className="mb-4 p-4 border border-amber-200 bg-amber-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 mb-1">Transparency Notice</p>
                    <p className="text-sm text-amber-800">
                      Webhook events will be processed through
                      {' '}
                      {selectedUnifiedTrigger.source === 'pipedream' ? 'Pipedream\'s' : 'Composio\'s'}
                      {' '}
                      service before reaching our service.
                    </p>
                  </div>
                </div>
              </div>

              {/* Configuration */}
              {selectedUnifiedTrigger.config?.properties && Object.keys(selectedUnifiedTrigger.config.properties).length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-[#171717] mb-3">Configuration</h4>
                  <div className="space-y-4">
                    {Object.entries(selectedUnifiedTrigger.config.properties).map(([key, propConfig]) => {
                      const config = propConfig as Record<string, unknown>
                      // Skip app-type props and system props
                      if (config.type === 'app' || key === 'db' || key === 'http' || key === 'pipedreamApiKey') {
                        return null
                      }

                      const isRequired = selectedUnifiedTrigger.config?.required?.includes(key)

                      return (
                        <div key={key} className="p-4 border border-[#E5E5E5] rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#171717]">{(config.title as string) || key}</span>
                              {isRequired && (
                                <span className="text-xs text-red-600 px-2 py-0.5 bg-red-50 rounded">Required</span>
                              )}
                            </div>
                            <span className="text-xs font-mono text-[#737373] px-2 py-1 bg-[#F5F5F5] rounded">
                              {config.type as string}
                            </span>
                          </div>
                          {config.description && (
                            <p className="text-sm text-[#737373] mb-3">{config.description as string}</p>
                          )}
                          {renderConfigInput(key, config)}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {(!selectedUnifiedTrigger.config?.properties || Object.keys(selectedUnifiedTrigger.config.properties).filter((k) => {
                const c = selectedUnifiedTrigger.config?.properties?.[k] as Record<string, unknown> | undefined
                return c?.type !== 'app' && k !== 'db' && k !== 'http' && k !== 'pipedreamApiKey'
              }).length === 0) && (
                <div className="mb-6 p-4 bg-[#F5F5F5] rounded-lg text-center">
                  <p className="text-sm text-[#737373]">
                    No configuration needed. This trigger uses default settings.
                  </p>
                </div>
              )}

              {/* Tasks Section */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-[#171717]">Trigger Tasks (Optional)</h4>
                  {!showTasksSection && (
                    <button onClick={addTask} className="text-sm text-blue-600 hover:text-blue-700">
                      + Add Task
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#737373] mb-3">
                  Define tasks to execute when this trigger fires (keyboard shortcuts, AI prompts, etc.)
                </p>

                {showTasksSection && renderTaskSection(tasks, updateTask, removeTask, addTask)}
              </div>
            </div>

            <div className="p-6 border-t border-[#E5E5E5] flex justify-end gap-3">
              <button
                onClick={handleCloseConfigModal}
                disabled={isDeploying}
                className="px-6 py-2 border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeploy}
                disabled={isDeploying || !!deploySuccess}
                className="px-6 py-2 bg-[#171717] text-white rounded-lg hover:bg-[#404040] transition-colors disabled:bg-[#A3A3A3]"
              >
                {isDeploying ? 'Deploying...' : deploySuccess ? 'Deployed!' : 'Deploy Trigger'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect Prompt Modal */}
      {showConnectPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4 p-6">
            <h3 className="text-lg font-bold text-[#171717] mb-4">
              Connect
              {promptAppName}
            </h3>
            <p className="text-sm text-[#737373] mb-6">
              You need to connect your
              {' '}
              {promptAppName}
              {' '}
              account
              {' '}
              {promptSource === 'pipedream' ? 'via Pipedream' : 'via Composio'}
              {' '}
              before deploying this trigger.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConnectPrompt(false)
                  setShowTriggersModal(true)
                }}
                className="px-4 py-2 border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (promptSource === 'pipedream') {
                    await handleConnectPipedreamApp(extractAppName(selectedApp?.slug || appName))
                  }
                  else {
                    await handleConnectComposioApp(selectedApp?.slug || appName)
                  }
                  setShowConnectPrompt(false)
                }}
                className="px-4 py-2 bg-[#171717] text-white rounded-lg hover:bg-[#404040] transition-colors"
              >
                Connect Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Status Modal (Composio) */}
      {showAccountStatusModal && composioAccountStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              {composioAccountStatus.isActive
                ? (
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  )
                : composioAccountStatus.hasAccount
                  ? (
                      <AlertCircle className="w-8 h-8 text-yellow-500" />
                    )
                  : (
                      <XCircle className="w-8 h-8 text-red-500" />
                    )}
              <h3 className="text-lg font-bold text-[#171717]">
                {composioAccountStatus.isActive
                  ? 'Account Active'
                  : composioAccountStatus.hasAccount
                    ? 'Account Expired'
                    : 'Account Not Connected'}
              </h3>
            </div>

            <p className="text-sm text-[#737373] mb-6">
              {composioAccountStatus.isActive
                ? 'Your account is connected and active.'
                : composioAccountStatus.hasAccount
                  ? 'Your account connection has expired. Please reconnect to continue.'
                  : 'You need to connect your account before deploying this trigger.'}
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAccountStatusModal(false)
                  clearComposioAccountStatus()
                  setSelectedUnifiedTrigger(null)
                }}
                className="px-4 py-2 border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5] transition-colors"
              >
                Cancel
              </button>
              {!composioAccountStatus.isActive && (
                <button
                  onClick={handleReconnectFromStatusModal}
                  disabled={composioAccountStatusLoading}
                  className="px-4 py-2 bg-[#171717] text-white rounded-lg hover:bg-[#404040] transition-colors disabled:bg-[#A3A3A3]"
                >
                  {composioAccountStatusLoading ? 'Connecting...' : 'Connect Account'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && selectedScheduleTrigger && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] m-4 flex flex-col">
            <div className="p-6 border-b border-[#E5E5E5] flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-[#171717]">
                    {selectedScheduleTrigger.label}
                    {' '}
                    Schedule Trigger
                  </h3>
                  <SourceBadge source="pipedream" />
                </div>
                <p className="text-sm text-[#737373]">{selectedScheduleTrigger.description}</p>
              </div>
              <button onClick={handleCloseScheduleModal} className="text-[#737373] hover:text-[#171717] ml-4">
                <X className="w-6 h-6" />
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

              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3">Schedule Configuration</h4>

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
                        <span className="font-mono">{buildCronExpression('custom-interval')}</span>
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
                      <button onClick={addScheduleTask} className="text-sm text-blue-600 hover:text-blue-700">
                        + Add Task
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#737373] mb-3">
                    Define tasks to execute when this schedule triggers
                  </p>

                  {scheduleTasks.length > 0 && renderTaskSection(scheduleTasks, updateScheduleTask, removeScheduleTask, addScheduleTask)}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#E5E5E5] flex justify-end gap-3">
              <button
                onClick={handleCloseScheduleModal}
                disabled={isDeploying}
                className="px-6 py-2 border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeployScheduleTrigger}
                disabled={isDeploying || !!deploySuccess}
                className="px-6 py-2 bg-[#171717] text-white rounded-lg hover:bg-[#404040] transition-colors disabled:bg-[#A3A3A3]"
              >
                {isDeploying ? 'Deploying...' : deploySuccess ? 'Deployed!' : 'Deploy Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Tasks Modal */}
      {showViewTasksModal && viewingTasksTrigger && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] m-4 flex flex-col">
            <div className="p-6 border-b border-[#E5E5E5] flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-[#171717]">
                    Tasks for
                    {' '}
                    {viewingTasksTrigger.name}
                  </h3>
                  <SourceBadge source={viewingTasksTrigger.source} />
                </div>
                <p className="text-sm text-[#737373]">
                  App:
                  {' '}
                  {viewingTasksTrigger.appName}
                </p>
              </div>
              <button
                onClick={handleCloseViewTasksModal}
                className="text-[#737373] hover:text-[#171717] ml-4"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingViewTasks
                ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-[#737373]">Loading tasks...</div>
                    </div>
                  )
                : viewingTasks.length === 0
                  ? (
                      <div className="text-center py-8 text-[#737373]">
                        No tasks configured for this trigger
                      </div>
                    )
                  : (
                      <div className="space-y-4">
                        {viewingTasks.map((task, index) => {
                          const isEditing = editingTaskId === task.id
                          const taskData = isEditing && editingTaskData ? editingTaskData : task

                          return (
                            <div
                              key={task.id || index}
                              className={`p-4 border rounded-lg ${isEditing ? 'border-blue-300 bg-blue-50' : 'border-[#E5E5E5] bg-[#FAFAFA]'}`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <span className="font-semibold text-sm text-[#171717]">
                                  Task
                                  {' '}
                                  {index + 1}
                                  {isEditing && <span className="ml-2 text-blue-600 text-xs">(Editing)</span>}
                                </span>
                                <div className="flex items-center gap-2">
                                  {task.createdAt && (
                                    <span className="text-xs text-[#737373]">
                                      Created:
                                      {' '}
                                      {new Date(task.createdAt).toLocaleDateString()}
                                    </span>
                                  )}
                                  {!isEditing && task.id && (
                                    <button
                                      onClick={() => handleStartEditTask(task)}
                                      className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
                                    >
                                      Edit
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isEditing
                                ? (
                                    /* Edit Mode - reuse same component as create */
                                    <div>
                                      {renderTaskSection(
                                        [taskData],
                                        (_idx, field, value) => handleUpdateEditingTask(field, value),
                                        () => handleCancelEditTask(),
                                        () => {},
                                      )}
                                      <div className="flex justify-end gap-2 pt-2">
                                        <button
                                          onClick={handleCancelEditTask}
                                          className="px-3 py-1.5 text-sm text-[#737373] hover:text-[#171717] transition-colors"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={handleSaveTask}
                                          disabled={isSavingTask}
                                          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-blue-300"
                                        >
                                          {isSavingTask ? 'Saving...' : 'Save'}
                                        </button>
                                      </div>
                                    </div>
                                  )
                                : (
                                    /* View Mode */
                                    <>
                                      {task.ask && (
                                        <div className="mb-3">
                                          <div className="text-xs font-medium text-[#737373] mb-1">AI Prompt:</div>
                                          <div className="p-2 bg-white border border-[#E5E5E5] rounded text-sm text-[#171717]">
                                            {task.ask}
                                          </div>
                                        </div>
                                      )}

                                      {task.keyboard_shortcut_ids && task.keyboard_shortcut_ids.length > 0 && (
                                        <div className="mb-3">
                                          <div className="text-xs font-medium text-[#737373] mb-1">Keyboard Shortcuts:</div>
                                          <div className="flex flex-wrap gap-1">
                                            {task.keyboard_shortcut_ids.map((id, idx) => (
                                              <span
                                                key={idx}
                                                className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                                              >
                                                {id}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {task.cloud_credentials && task.cloud_credentials.length > 0 && (
                                        <div className="mb-3">
                                          <div className="text-xs font-medium text-[#737373] mb-1">Cloud Credentials:</div>
                                          <div className="flex flex-wrap gap-1">
                                            {task.cloud_credentials.map((cred, idx) => (
                                              <span
                                                key={idx}
                                                className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded"
                                              >
                                                {cred}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {task.pipedream_proxy_apps && task.pipedream_proxy_apps.length > 0 && (
                                        <div>
                                          <div className="text-xs font-medium text-[#737373] mb-1">Pipedream Proxy Apps:</div>
                                          <div className="flex flex-wrap gap-1">
                                            {task.pipedream_proxy_apps.map((app, idx) => (
                                              <span
                                                key={idx}
                                                className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded"
                                              >
                                                {app}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                            </div>
                          )
                        })}
                      </div>
                    )}
            </div>

            <div className="p-4 border-t border-[#E5E5E5] flex justify-end">
              <button
                onClick={handleCloseViewTasksModal}
                className="px-4 py-2 text-sm text-[#737373] hover:text-[#171717] transition-colors"
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
