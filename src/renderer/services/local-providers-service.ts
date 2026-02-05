/**
 * Local Providers Service
 *
 * Dynamically fetches and caches local OAuth providers from the Keyboard API.
 * Used to determine if an app (e.g., Google Sheets, GitHub) has a local
 * provider available, so we can show "Local" source instead of Pipedream/Composio.
 */

import { getProviderIcon } from '../utils/providerUtils'

// =============================================================================
// Types
// =============================================================================

export interface LocalProvider {
  id: string
  name: string
  icon: string
  configured: boolean
}

// =============================================================================
// Cache
// =============================================================================

let cachedProviders: LocalProvider[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// =============================================================================
// API Functions
// =============================================================================

/**
 * Fetch all local providers from the Keyboard API
 * Results are cached for 5 minutes
 */
export async function getLocalProviders(): Promise<LocalProvider[]> {
  const now = Date.now()

  // Return cache if still valid
  if (cachedProviders && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('[local-providers-service] Returning cached providers:', cachedProviders.map(p => p.id))
    return cachedProviders
  }

  try {
    console.log('[local-providers-service] Fetching local providers from Keyboard API...')

    // Ensure keyboard-api server exists
    const serverProviders = await window.electronAPI.getServerProviders()
    let keyboardApiServer = serverProviders.find(s => s.id === 'keyboard-api')

    if (!keyboardApiServer) {
      console.log('[local-providers-service] keyboard-api server not found, adding it...')
      const newServer = {
        id: 'keyboard-api',
        name: 'Keyboard API',
        url: 'https://api.keyboard.dev',
      }
      await window.electronAPI.addServerProvider(newServer)
    }

    // Fetch providers
    const fetchedProviders = await window.electronAPI.fetchServerProviders('keyboard-api')
    console.log('[local-providers-service] Raw fetched providers:', fetchedProviders)

    if (fetchedProviders && fetchedProviders.length > 0) {
      cachedProviders = fetchedProviders
        .map((p: { name: string, logoUrl?: string, configured: boolean }) => ({
          id: p.name.toLowerCase(),
          name: p.name.charAt(0).toUpperCase() + p.name.slice(1),
          icon: getProviderIcon(p.logoUrl, p.name),
          configured: p.configured,
        }))
        .filter(p => p.name.toLowerCase() !== 'onboarding')

      console.log('[local-providers-service] Processed providers:', cachedProviders.map(p => ({ id: p.id, name: p.name, configured: p.configured })))
      cacheTimestamp = now
      return cachedProviders
    }
  }
  catch (error) {
    console.error('[local-providers-service] Error fetching providers:', error)
    // Fall through to fallback
  }

  // Fallback to known default providers
  console.log('[local-providers-service] Using fallback providers')
  cachedProviders = [
    { id: 'google', name: 'Google', icon: getProviderIcon(undefined, 'google'), configured: true },
    { id: 'github', name: 'GitHub', icon: getProviderIcon(undefined, 'github'), configured: true },
    { id: 'microsoft', name: 'Microsoft', icon: getProviderIcon(undefined, 'microsoft'), configured: true },
    { id: 'slack', name: 'Slack', icon: getProviderIcon(undefined, 'slack'), configured: true },
  ]
  cacheTimestamp = now
  return cachedProviders
}

/**
 * Check if an app name matches a local provider (fuzzy match)
 * e.g., "Google Sheets" matches "google", "GitHub" matches "github"
 */
export async function isLocalProvider(appName: string): Promise<boolean> {
  const providerId = await getLocalProviderId(appName)
  return providerId !== null
}

/**
 * Get the local provider ID for an app name (fuzzy match)
 * Returns null if no local provider matches
 *
 * Matching logic:
 * - "google" matches "google"
 * - "googlesheets" matches "google" (contains)
 * - "gmail" matches "google" (contains)
 * - "github" matches "github" (exact)
 */
export async function getLocalProviderId(appName: string): Promise<string | null> {
  if (!appName) {
    return null
  }

  const providers = await getLocalProviders()
  const normalized = appName.toLowerCase().replace(/[\s_-]/g, '')

  console.log(`[local-providers-service] getLocalProviderId("${appName}") - normalized: "${normalized}"`)
  console.log(`[local-providers-service] Available provider IDs:`, providers.map(p => p.id))

  // First try exact match
  const exactMatch = providers.find(p => p.id === normalized)
  if (exactMatch) {
    console.log(`[local-providers-service] Exact match found: "${exactMatch.id}"`)
    return exactMatch.id
  }

  // Then try fuzzy match (app name contains provider id)
  const fuzzyMatch = providers.find((p) => {
    const providerNorm = p.id.toLowerCase()
    // "googlesheets" contains "google", "microsoftteams" contains "microsoft"
    return normalized.includes(providerNorm)
  })

  if (fuzzyMatch) {
    console.log(`[local-providers-service] Fuzzy match found: "${fuzzyMatch.id}" (appName "${normalized}" contains "${fuzzyMatch.id}")`)
  }
  else {
    console.log(`[local-providers-service] No match found for "${normalized}"`)
  }

  return fuzzyMatch?.id || null
}

/**
 * Get full provider info for an app name
 * Returns the provider with icon, name, etc.
 */
export async function getLocalProviderInfo(appName: string): Promise<LocalProvider | null> {
  const providers = await getLocalProviders()
  const providerId = await getLocalProviderId(appName)

  if (!providerId) return null

  return providers.find(p => p.id === providerId) || null
}

/**
 * Clear the provider cache (useful for testing or forcing refresh)
 */
export function clearLocalProvidersCache(): void {
  cachedProviders = null
  cacheTimestamp = 0
}
