/**
 * Unified Triggers Service
 *
 * Service for fetching triggers from the unified API that combines
 * both Pipedream and Composio triggers in a single response.
 */

// =============================================================================
// Types
// =============================================================================

export type TriggerSource = 'composio' | 'pipedream'

export interface UnifiedTriggerConfig {
  properties: Record<string, {
    type?: string
    title?: string
    description?: string
    required?: boolean
    default?: unknown
    enum?: string[]
    options?: Array<{ label: string, value: string }>
  }>
  required: string[]
}

export interface UnifiedTrigger {
  id: string
  name: string
  description: string
  app: string
  appDisplayName: string
  source: TriggerSource
  sourceSlug: string
  config: UnifiedTriggerConfig
  appInfo?: {
    logoUrl?: string
    authType?: string
  }
}

export interface UnifiedTriggerSources {
  composio: { available: boolean, count: number }
  pipedream: { available: boolean, count: number }
}

export interface SearchUnifiedTriggersResponse {
  success: boolean
  app?: string
  triggers?: UnifiedTrigger[]
  sources?: UnifiedTriggerSources
  error?: string
}

export interface UnifiedTriggerApp {
  displayName: string
  composioSlug?: string
  pipedreamSlug?: string
  logoUrl?: string
  pipedreamLogoUrl?: string
  composioLogoUrl?: string
}

export interface ListUnifiedTriggerAppsResponse {
  success: boolean
  apps?: UnifiedTriggerApp[]
  count?: number
  error?: string
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Search for triggers across both Pipedream and Composio for a given app name.
 * The API accepts various formats: "Google Sheets", "google sheets", "googlesheets", "google_sheets"
 */
export async function searchUnifiedTriggers(appName: string): Promise<SearchUnifiedTriggersResponse> {
  try {
    const response = await window.electronAPI.searchUnifiedTriggers(appName)
    return response as SearchUnifiedTriggersResponse
  }
  catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search triggers',
    }
  }
}

/**
 * List all supported apps with their platform mappings.
 */
export async function listUnifiedTriggerApps(): Promise<ListUnifiedTriggerAppsResponse> {
  try {
    const response = await window.electronAPI.listUnifiedTriggerApps()
    return response as ListUnifiedTriggerAppsResponse
  }
  catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list apps',
    }
  }
}

/**
 * Get the source badge color classes for a trigger source.
 */
export function getSourceBadgeClasses(source: TriggerSource): string {
  return source === 'pipedream'
    ? 'bg-orange-100 text-orange-700 border border-orange-200'
    : 'bg-purple-100 text-purple-700 border border-purple-200'
}

/**
 * Get the source display name.
 */
export function getSourceDisplayName(source: TriggerSource): string {
  return source === 'pipedream' ? 'Pipedream' : 'Composio'
}

// =============================================================================
// Export Service Object
// =============================================================================

export const unifiedTriggersService = {
  searchUnifiedTriggers,
  listUnifiedTriggerApps,
  getSourceBadgeClasses,
  getSourceDisplayName,
}

export default unifiedTriggersService
