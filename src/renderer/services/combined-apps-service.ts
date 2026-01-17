/**
 * Combined Apps Service
 *
 * Service for searching and combining apps from both Composio and Pipedream.
 * Normalizes app data and handles platform-specific slug differences.
 */

import * as composioService from './composio-service'
import * as pipedreamService from './pipedream-service'

// =============================================================================
// Types
// =============================================================================

export type AppPlatform = 'composio' | 'pipedream'

export interface CombinedApp {
  // Unified identifier (normalized name)
  id: string
  name: string
  description?: string
  logo?: string
  categories?: string[]

  // Platform availability
  platforms: AppPlatform[]

  // Platform-specific slugs (to handle google_sheets vs googlesheets)
  composioSlug?: string
  pipedreamSlug?: string

  // Original data from each platform
  composioData?: composioService.ComposioApp
  pipedreamData?: pipedreamService.PipedreamApp
}

export interface CombinedAppsResponse {
  success: boolean
  apps: CombinedApp[]
  error?: string
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalize app name to create a unified identifier.
 * Removes spaces, underscores, hyphens, and converts to lowercase.
 */
function normalizeAppName(name: string): string {
  return name.toLowerCase().replace(/[\s_-]/g, '')
}

/**
 * Merge apps from different platforms based on normalized name matching.
 */
function mergeApps(
  composioApps: composioService.ComposioApp[],
  pipedreamApps: pipedreamService.PipedreamApp[],
): CombinedApp[] {
  const appsMap = new Map<string, CombinedApp>()

  for (const composioApp of composioApps) {
    const normalizedId = normalizeAppName(composioApp.name)
    const composioSlug = composioApp.slug || composioApp.name
    const app: CombinedApp = {
      id: normalizedId,
      name: composioApp.name,
      description: composioApp.description,
      logo: composioApp.logo,
      categories: composioApp.categories,
      platforms: ['composio'],
      composioSlug,
      composioData: composioApp,
    }
    appsMap.set(normalizedId, app)
  }

  // Add or merge Pipedream apps
  for (const pipedreamApp of pipedreamApps) {
    const normalizedId = normalizeAppName(pipedreamApp.name)
    const existingApp = appsMap.get(normalizedId)

    if (existingApp) {
      // Merge with existing Composio app
      existingApp.platforms.push('pipedream')
      existingApp.pipedreamSlug = pipedreamApp.nameSlug
      existingApp.pipedreamData = pipedreamApp

      if (!existingApp.logo && pipedreamApp.logoUrl) {
        existingApp.logo = pipedreamApp.logoUrl
      }

      // Merge categories
      if (pipedreamApp.categories) {
        const existingCategories = new Set(existingApp.categories || [])
        for (const cat of pipedreamApp.categories) {
          existingCategories.add(cat)
        }
        existingApp.categories = Array.from(existingCategories)
      }
    }
    else {
      // Add new Pipedream-only app
      const app: CombinedApp = {
        id: normalizedId,
        name: pipedreamApp.name,
        description: pipedreamApp.description,
        logo: pipedreamApp.logoUrl,
        categories: pipedreamApp.categories,
        platforms: ['pipedream'],
        pipedreamSlug: pipedreamApp.nameSlug,
        pipedreamData: pipedreamApp,
      }
      appsMap.set(normalizedId, app)
    }
  }

  // Convert map to array and sort by name
  const result = Array.from(appsMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  return result
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Search for apps across both Composio and Pipedream platforms.
 * Returns a unified list with platform badges.
 */

export async function popularAppTriggers(
  query?: string,
  supportsTriggers = true,
): Promise<CombinedAppsResponse> {
  try {
    // Fetch from both platforms in parallel
    const [pipedreamResponse] = await Promise.all([
      pipedreamService.listApps(query, 100, undefined, 'featured_weight', 'desc', supportsTriggers).catch(() => ({
        success: false,
        apps: [],
      })),
    ])

    const pipedreamApps = pipedreamResponse.success ? pipedreamResponse.apps : []

    // Merge and normalize apps
    const combinedApps = mergeApps([], pipedreamApps)

    return {
      success: true,
      apps: combinedApps,
    }
  }
  catch (error) {
    return {
      success: false,
      apps: [],
      error: error instanceof Error ? error.message : 'Failed to search apps',
    }
  }
}

export async function searchCombinedApps(
  query?: string,
  supportsTriggers = true,
): Promise<CombinedAppsResponse> {
  try {
    // Fetch from both platforms in parallel
    const [composioResponse, pipedreamResponse] = await Promise.all([
      composioService.listApps({
        search: query,
        limit: 100,
        supportsTriggers,
      }).catch(() => ({
        success: false,
        data: { items: [] },
      })),
      pipedreamService.listApps(query, 100, undefined, 'featured_weight', 'desc', supportsTriggers).catch(() => ({
        success: false,
        apps: [],
      })),
    ])

    const composioApps = composioResponse.success && composioResponse.data?.items ? composioResponse.data.items : []
    const pipedreamApps = pipedreamResponse.success ? pipedreamResponse.apps : []

    // Merge and normalize apps
    const combinedApps = mergeApps(composioApps, pipedreamApps)

    return {
      success: true,
      apps: combinedApps,
    }
  }
  catch (error) {
    return {
      success: false,
      apps: [],
      error: error instanceof Error ? error.message : 'Failed to search apps',
    }
  }
}

/**
 * Get platform-specific slug for an app.
 */
export function getAppSlug(app: CombinedApp, platform: AppPlatform): string | undefined {
  return platform === 'composio' ? app.composioSlug : app.pipedreamSlug
}

// =============================================================================
// Export Service Object
// =============================================================================

export const combinedAppsService = {
  searchCombinedApps,
  getAppSlug,
  normalizeAppName,
}

export default combinedAppsService
