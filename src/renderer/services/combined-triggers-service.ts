/**
 * Combined Triggers Service
 *
 * Service for fetching and combining triggers from both Composio and Pipedream.
 * Normalizes trigger data into a unified format with platform badges.
 */

import type { CombinedApp } from './combined-apps-service'
import * as composioService from './composio-service'
import * as pipedreamService from './pipedream-service'

// =============================================================================
// Types
// =============================================================================

export type TriggerPlatform = 'composio' | 'pipedream'

export interface TriggerConfigProperty {
  type: string
  title: string
  description?: string
  default?: unknown
  required?: boolean
  options?: Array<{ label: string, value: string }>
}

export interface CombinedTrigger {
  // Unified identifier
  id: string
  name: string
  description?: string
  version?: string

  // Platform info
  platform: TriggerPlatform
  platformSlug: string // The app slug used by this platform

  // App info
  appName: string
  appLogo?: string

  // Configuration schema (normalized)
  config: {
    properties: Record<string, TriggerConfigProperty>
    required: string[]
  }

  // Original data from each platform
  composioData?: composioService.ComposioAvailableTrigger
  pipedreamData?: pipedreamService.PipedreamTrigger
}

export interface CombinedTriggersResponse {
  success: boolean
  triggers: CombinedTrigger[]
  composioCount: number
  pipedreamCount: number
  error?: string
}

// =============================================================================
// Normalization Functions
// =============================================================================

/**
 * Normalize a Composio trigger to the unified format.
 */
function normalizeComposioTrigger(
  trigger: composioService.ComposioAvailableTrigger,
  appSlug: string,
): CombinedTrigger {
  // Convert Composio config properties to unified format
  const properties: Record<string, TriggerConfigProperty> = {}
  const required: string[] = []

  if (trigger.config?.properties) {
    for (const [key, value] of Object.entries(trigger.config.properties)) {
      const prop = value as {
        type?: string
        title?: string
        description?: string
        default?: unknown
        enum?: unknown[]
      }
      properties[key] = {
        type: prop.type || 'string',
        title: prop.title || key,
        description: prop.description,
        default: prop.default,
        options: prop.enum?.map(v => ({ label: String(v), value: String(v) })),
      }
    }
  }

  // Extract required fields
  if (trigger.config && 'required' in trigger.config) {
    const configRequired = (trigger.config as { required?: string[] }).required
    if (configRequired) {
      required.push(...configRequired)
    }
  }

  return {
    id: trigger.slug,
    name: trigger.name,
    description: trigger.description,
    version: trigger.version,
    platform: 'composio',
    platformSlug: appSlug,
    appName: trigger.toolkit?.name || appSlug,
    appLogo: trigger.toolkit?.logo,
    config: { properties, required },
    composioData: trigger,
  }
}

/**
 * Normalize a Pipedream trigger to the unified format.
 */
function normalizePipedreamTrigger(
  trigger: pipedreamService.PipedreamTrigger,
): CombinedTrigger {
  // Convert Pipedream configurable_props to unified format
  const properties: Record<string, TriggerConfigProperty> = {}
  const required: string[] = []

  if (trigger.configurable_props) {
    for (const prop of trigger.configurable_props) {
      properties[prop.name] = {
        type: prop.type,
        title: prop.label,
        description: prop.description,
        default: prop.default,
        options: prop.options,
      }

      if (!prop.optional) {
        required.push(prop.name)
      }
    }
  }

  return {
    id: trigger.key,
    name: trigger.name,
    description: trigger.description,
    version: trigger.version,
    platform: 'pipedream',
    platformSlug: trigger.app.name_slug,
    appName: trigger.app.name,
    appLogo: trigger.app.img_src,
    config: { properties, required },
    pipedreamData: trigger,
  }
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Fetch triggers from both platforms for a combined app.
 * Uses the appropriate slug for each platform.
 */
export async function fetchCombinedTriggers(
  app: CombinedApp,
): Promise<CombinedTriggersResponse> {
  const triggers: CombinedTrigger[] = []
  let composioCount = 0
  let pipedreamCount = 0
  const errors: string[] = []

  // DEBUG: Log the app data
  const promises: Promise<void>[] = []

  // Fetch from Composio if app is available there
  if (app.composioSlug && app.platforms.includes('composio')) {
    promises.push(
      composioService.listAvailableTriggers(app.composioSlug)
        .then((response) => {
          if (response.success && response.data) {
            for (const trigger of response.data) {
              triggers.push(normalizeComposioTrigger(trigger, app.composioSlug!))
            }
            composioCount = response.data.length
          }
        })
        .catch((err) => {
          errors.push(`Composio: ${err instanceof Error ? err.message : 'Failed to fetch triggers'}`)
        }),
    )
  }
  else {
  }

  // Fetch from Pipedream if app is available there
  if (app.pipedreamSlug && app.platforms.includes('pipedream')) {
    promises.push(
      pipedreamService.listTriggers(app.pipedreamSlug)
        .then((response) => {
          if (response.success && response.triggers) {
            for (const trigger of response.triggers) {
              triggers.push(normalizePipedreamTrigger(trigger))
            }
            pipedreamCount = response.triggers.length
          }
        })
        .catch((err) => {
          errors.push(`Pipedream: ${err instanceof Error ? err.message : 'Failed to fetch triggers'}`)
        }),
    )
  }
  else {
  }

  // Wait for all requests to complete
  await Promise.all(promises)

  triggers.sort((a, b) => a.name.localeCompare(b.name))

  return {
    success: errors.length === 0 || triggers.length > 0,
    triggers,
    composioCount,
    pipedreamCount,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  }
}

/**
 * Fetch triggers from a single platform using the app slug.
 */
export async function fetchTriggersForPlatform(
  platform: TriggerPlatform,
  appSlug: string,
): Promise<CombinedTriggersResponse> {
  const triggers: CombinedTrigger[] = []

  try {
    if (platform === 'composio') {
      const response = await composioService.listAvailableTriggers(appSlug)
      if (response.success && response.data) {
        for (const trigger of response.data) {
          triggers.push(normalizeComposioTrigger(trigger, appSlug))
        }
      }
      return {
        success: true,
        triggers,
        composioCount: triggers.length,
        pipedreamCount: 0,
      }
    }
    else {
      const response = await pipedreamService.listTriggers(appSlug)
      if (response.success && response.triggers) {
        for (const trigger of response.triggers) {
          triggers.push(normalizePipedreamTrigger(trigger))
        }
      }
      return {
        success: true,
        triggers,
        composioCount: 0,
        pipedreamCount: triggers.length,
      }
    }
  }
  catch (error) {
    return {
      success: false,
      triggers: [],
      composioCount: 0,
      pipedreamCount: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch triggers',
    }
  }
}

// =============================================================================
// Export Service Object
// =============================================================================

export const combinedTriggersService = {
  fetchCombinedTriggers,
  fetchTriggersForPlatform,
  normalizeComposioTrigger,
  normalizePipedreamTrigger,
}

export default combinedTriggersService
