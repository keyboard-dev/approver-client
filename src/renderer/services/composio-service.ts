/**
 * Composio Service
 *
 * Service layer for Composio operations.
 * All API calls are routed through IPC handlers to the main process.
 */

// =============================================================================
// Types
// =============================================================================

export interface ComposioApp {
  slug: string
  appId: string
  appKey: string
  name: string
  description?: string
  logo?: string
  categories?: string[]
  enabled: boolean
  toolkit: {
    slug: string
  }
  meta?: {
    category?: string
    description?: string
    logo?: string
    triggerCount?: number
    actionCount?: number
  }
}

export interface ComposioConnectedAccount {
  id: string
  appName: string
  status: 'active' | 'inactive' | 'error'
  integrationId: string
  connectionParams?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  toolkit: {
    slug: string
  }
}

export interface ComposioTrigger {
  id: string
  name: string
  description?: string
  appName: string
  appKey: string
  config?: Record<string, unknown>
  status: 'active' | 'paused'
  connectedAccountId: string
  composioTriggerId?: string
  encryptionEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface ComposioAvailableTrigger {
  slug: string
  name: string
  description?: string
  instructions?: string
  toolkit: {
    logo: string
    slug: string
    name: string
  }
  payload: {
    description?: string
    properties: Record<string, unknown>
    required?: string[]
    title: string
    type: string
  }
  config: {
    description?: string
    properties: Record<string, unknown>
    title: string
    type: string
  }
  version: string
}

export interface ComposioTriggerTask {
  id: string
  deployedTriggerId: string
  keyboardShortcutIds: string[]
  cloudCredentials: string[]
  ask?: string
  createdAt: string
  updatedAt: string
}

export interface InitiateConnectionRequest {
  appName: string
  redirectUrl?: string
  authConfig?: Record<string, unknown>
}

export interface InitiateConnectionResponse {
  success: boolean
  data?: {
    connectionUrl: string
    connectionId: string
  }
  error?: string
}

export interface ListAccountsResponse {
  success: boolean
  data?: {
    items: ComposioConnectedAccount[]
    totalCount: number
  }
  error?: string
}

export interface GetAccountResponse {
  success: boolean
  data?: ComposioConnectedAccount
  error?: string
}

export interface DeleteAccountResponse {
  success: boolean
  error?: string
}

export interface SyncAccountsResponse {
  success: boolean
  data?: {
    synced: number
    created: number
    updated: number
  }
  error?: string
}

export interface DeployTriggerRequest {
  connectedAccountId: string
  triggerName: string
  appName: string
  config?: Record<string, unknown>
  encryptionEnabled?: boolean
  tasks?: Array<{
    keyboardShortcutIds?: string[]
    cloudCredentials?: string[]
    ask?: string
  }>
}

export interface DeployTriggerResponse {
  success: boolean
  data?: {
    trigger: ComposioTrigger
    composioResponse?: unknown
  }
  error?: string
}

export interface ListTriggersResponse {
  success: boolean
  data?: {
    items: ComposioTrigger[]
    totalCount: number
  }
  error?: string
}

export interface GetTriggerResponse {
  success: boolean
  data?: ComposioTrigger
  error?: string
}

export interface UpdateTriggerResponse {
  success: boolean
  data?: ComposioTrigger
  error?: string
}

export interface PauseTriggerResponse {
  success: boolean
  error?: string
}

export interface ResumeTriggerResponse {
  success: boolean
  error?: string
}

export interface DeleteTriggerResponse {
  success: boolean
  error?: string
}

export interface ListAvailableTriggersResponse {
  success: boolean
  data?: ComposioAvailableTrigger[]
  error?: string
}

export interface GetTriggerConfigResponse {
  success: boolean
  data?: {
    config: {
      description?: string
      properties: Record<string, unknown>
      required?: string[]
      title: string
      type: string
    }
  }
  error?: string
}

export interface CreateTaskResponse {
  success: boolean
  data?: ComposioTriggerTask
  error?: string
}

export interface ListTasksResponse {
  success: boolean
  data?: {
    items: ComposioTriggerTask[]
  }
  error?: string
}

export interface GetTaskResponse {
  success: boolean
  data?: ComposioTriggerTask
  error?: string
}

export interface UpdateTaskResponse {
  success: boolean
  data?: ComposioTriggerTask
  error?: string
}

export interface DeleteTaskResponse {
  success: boolean
  error?: string
}

export interface ListAppsResponse {
  success: boolean
  data?: {
    items: ComposioApp[]
    totalCount: number
  }
  error?: string
}

export interface ListCategoriesResponse {
  success: boolean
  data?: {
    items: string[]
  }
  error?: string
}

export interface GetAppResponse {
  success: boolean
  data?: ComposioApp
  error?: string
}

// =============================================================================
// Helper Functions
// =============================================================================
// (No helper functions needed - IPC handlers return properly typed responses)

// =============================================================================
// Connected Accounts API Functions
// =============================================================================

/**
 * Initiate a connection to an external service.
 */
export async function initiateConnection(
  request: InitiateConnectionRequest,
): Promise<InitiateConnectionResponse> {
  return window.electronAPI.initiateComposioConnection(request) as Promise<InitiateConnectionResponse>
}

/**
 * List connected accounts for the current user.
 */
export async function listConnectedAccounts(params?: {
  appName?: string
  status?: string
}): Promise<ListAccountsResponse> {
  return window.electronAPI.listComposioConnectedAccounts(params) as Promise<ListAccountsResponse>
}

/**
 * Get a specific connected account.
 */
export async function getConnectedAccount(accountId: string): Promise<GetAccountResponse> {
  return window.electronAPI.getComposioConnectedAccount(accountId) as Promise<GetAccountResponse>
}

/**
 * Delete a connected account.
 */
export async function deleteConnectedAccount(accountId: string): Promise<DeleteAccountResponse> {
  return window.electronAPI.deleteComposioConnectedAccount(accountId) as Promise<DeleteAccountResponse>
}

/**
 * Sync connected accounts from Composio API.
 */
export async function syncConnectedAccounts(): Promise<SyncAccountsResponse> {
  return window.electronAPI.syncComposioConnectedAccounts() as Promise<SyncAccountsResponse>
}

// =============================================================================
// Triggers API Functions
// =============================================================================

/**
 * Deploy a new trigger.
 */
export async function deployTrigger(
  request: DeployTriggerRequest,
): Promise<DeployTriggerResponse> {
  return window.electronAPI.deployComposioTrigger(request) as Promise<DeployTriggerResponse>
}

/**
 * List deployed triggers for the authenticated user.
 */
export async function listTriggers(params?: {
  appName?: string
  status?: string
}): Promise<ListTriggersResponse> {
  return window.electronAPI.listComposioTriggers(params) as Promise<ListTriggersResponse>
}

/**
 * Get a specific deployed trigger.
 */
export async function getTrigger(triggerId: string): Promise<GetTriggerResponse> {
  return window.electronAPI.getComposioTrigger(triggerId) as Promise<GetTriggerResponse>
}

/**
 * Update trigger configuration.
 */
export async function updateTriggerConfig(
  triggerId: string,
  config: Record<string, unknown>,
): Promise<UpdateTriggerResponse> {
  return window.electronAPI.updateComposioTriggerConfig(triggerId, config) as Promise<UpdateTriggerResponse>
}

/**
 * Pause a trigger.
 */
export async function pauseTrigger(triggerId: string): Promise<PauseTriggerResponse> {
  return window.electronAPI.pauseComposioTrigger(triggerId) as Promise<PauseTriggerResponse>
}

/**
 * Resume a paused trigger.
 */
export async function resumeTrigger(triggerId: string): Promise<ResumeTriggerResponse> {
  return window.electronAPI.resumeComposioTrigger(triggerId) as Promise<ResumeTriggerResponse>
}

/**
 * Delete a deployed trigger.
 */
export async function deleteTrigger(triggerId: string): Promise<DeleteTriggerResponse> {
  return window.electronAPI.deleteComposioTrigger(triggerId) as Promise<DeleteTriggerResponse>
}

/**
 * List available trigger types for an app.
 */
export async function listAvailableTriggers(appName: string): Promise<ListAvailableTriggersResponse> {
  return window.electronAPI.listComposioAvailableTriggers(appName) as Promise<ListAvailableTriggersResponse>
}

/**
 * Get configuration schema for a specific trigger.
 */
export async function getTriggerConfig(triggerName: string): Promise<GetTriggerConfigResponse> {
  return window.electronAPI.getComposioTriggerConfig(triggerName) as Promise<GetTriggerConfigResponse>
}

// =============================================================================
// Trigger Tasks API Functions
// =============================================================================

/**
 * Create a new trigger task.
 */
export async function createTriggerTask(
  triggerId: string,
  task: {
    keyboardShortcutIds?: string[]
    cloudCredentials?: string[]
    ask?: string
  },
): Promise<CreateTaskResponse> {
  return window.electronAPI.createComposioTriggerTask(triggerId, task) as Promise<CreateTaskResponse>
}

/**
 * List tasks for a trigger.
 */
export async function listTriggerTasks(triggerId: string): Promise<ListTasksResponse> {
  return window.electronAPI.listComposioTriggerTasks(triggerId) as Promise<ListTasksResponse>
}

/**
 * Get a specific trigger task.
 */
export async function getTriggerTask(taskId: string): Promise<GetTaskResponse> {
  return window.electronAPI.getComposioTriggerTask(taskId) as Promise<GetTaskResponse>
}

/**
 * Update a trigger task.
 */
export async function updateTriggerTask(
  taskId: string,
  updates: {
    keyboardShortcutIds?: string[]
    cloudCredentials?: string[]
    ask?: string
  },
): Promise<UpdateTaskResponse> {
  return window.electronAPI.updateComposioTriggerTask(taskId, updates) as Promise<UpdateTaskResponse>
}

/**
 * Delete a trigger task.
 */
export async function deleteTriggerTask(taskId: string): Promise<DeleteTaskResponse> {
  return window.electronAPI.deleteComposioTriggerTask(taskId) as Promise<DeleteTaskResponse>
}

// =============================================================================
// Apps API Functions
// =============================================================================

/**
 * List available apps/toolkits in Composio.
 */
export async function listApps(params?: {
  search?: string
  category?: string
  limit?: number
  supportsTriggers?: boolean
}): Promise<ListAppsResponse> {
  return window.electronAPI.listComposioApps(params) as Promise<ListAppsResponse>
}

/**
 * List app categories.
 */
export async function listAppCategories(): Promise<ListCategoriesResponse> {
  return window.electronAPI.listComposioAppCategories() as Promise<ListCategoriesResponse>
}

/**
 * Get details of a specific app/toolkit.
 */
export async function getApp(appSlug: string): Promise<GetAppResponse> {
  return window.electronAPI.getComposioApp(appSlug) as Promise<GetAppResponse>
}

/**
 * Open the Composio connection URL in the system browser.
 */
export async function openConnectionUrl(appName: string): Promise<void> {
  const result = await initiateConnection({ appName })

  if (result.success && result.data?.connectionUrl) {
    window.electronAPI.openExternalUrl(result.data.connectionUrl)
  }
  else {
    throw new Error(result.error || 'Failed to initiate connection')
  }
}

// =============================================================================
// Export Service Object
// =============================================================================

export const composioService = {
  // Connected Accounts
  initiateConnection,
  listConnectedAccounts,
  getConnectedAccount,
  deleteConnectedAccount,
  syncConnectedAccounts,
  openConnectionUrl,

  // Triggers
  deployTrigger,
  listTriggers,
  getTrigger,
  updateTriggerConfig,
  pauseTrigger,
  resumeTrigger,
  deleteTrigger,
  listAvailableTriggers,
  getTriggerConfig,

  // Trigger Tasks
  createTriggerTask,
  listTriggerTasks,
  getTriggerTask,
  updateTriggerTask,
  deleteTriggerTask,

  // Apps
  listApps,
  listAppCategories,
  getApp,
}

export default composioService
