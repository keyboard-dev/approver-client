/**
 * Connection Detection Service
 *
 * Uses AI classification to detect which app connections are required
 * based on the user's message. Dynamically fetches app info from
 * Composio and Pipedream APIs instead of using hardcoded mappings.
 */

import { CombinedApp, searchCombinedApps } from './combined-apps-service'

// =============================================================================
// Types
// =============================================================================

export interface ServiceInfo {
  id: string
  name: string
  pipedreamSlug?: string
  composioSlug?: string
  localProviderId?: string
  icon: string
}

export interface RequiredConnection {
  service: ServiceInfo
  source: 'pipedream' | 'composio' | 'local'
  isConnected: boolean
  connectUrl?: string
}

export interface ConnectionDetectionResult {
  requiredConnections: RequiredConnection[]
  hasAllConnections: boolean
  missingConnections: RequiredConnection[]
}

export interface CredentialAnalysisResult {
  likelyHasCredentials: boolean
  searchTermsIfNoCredentials: string[]
}

// Local providers that have special OAuth handling
const LOCAL_PROVIDER_IDS: Record<string, string> = {
  google: 'google',
  gmail: 'google',
  googlecalendar: 'google',
  googlesheets: 'google',
  googledrive: 'google',
  googledocs: 'google',
  googleslides: 'google',
  github: 'github',
  slack: 'slack',
  microsoft: 'microsoft',
  outlook: 'microsoft',
  microsoftteams: 'microsoft',
}

// Cache for app lookups to avoid repeated API calls
const appCache = new Map<string, CombinedApp>()
let allAppsCache: CombinedApp[] | null = null
let allAppsCacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalize app name for matching (lowercase, no spaces/underscores/hyphens)
 */
function normalizeAppName(name: string): string {
  return name.toLowerCase().replace(/[\s_-]/g, '')
}

/**
 * Get all apps from cache or fetch from APIs
 */
async function getAllApps(): Promise<CombinedApp[]> {
  const now = Date.now()

  // Return cache if still valid
  if (allAppsCache && (now - allAppsCacheTime) < CACHE_TTL) {
    return allAppsCache
  }

  // Fetch fresh data
  const response = await searchCombinedApps('', false)
  if (response.success && response.apps) {
    allAppsCache = response.apps
    allAppsCacheTime = now

    // Populate individual app cache
    for (const app of response.apps) {
      appCache.set(app.id, app)
      appCache.set(normalizeAppName(app.name), app)
      if (app.composioSlug) {
        appCache.set(normalizeAppName(app.composioSlug), app)
      }
      if (app.pipedreamSlug) {
        appCache.set(normalizeAppName(app.pipedreamSlug), app)
      }
    }

    return response.apps
  }

  return allAppsCache || []
}

/**
 * Look up an app by name/slug from the combined apps service
 */
async function lookupApp(nameOrSlug: string): Promise<CombinedApp | undefined> {
  const normalized = normalizeAppName(nameOrSlug)

  // Check cache first
  if (appCache.has(normalized)) {
    return appCache.get(normalized)
  }

  // Try to search for the specific app
  const response = await searchCombinedApps(nameOrSlug, false)
  if (response.success && response.apps.length > 0) {
    // Find exact or best match
    const exactMatch = response.apps.find(
      app =>
        normalizeAppName(app.name) === normalized
        || normalizeAppName(app.composioSlug || '') === normalized
        || normalizeAppName(app.pipedreamSlug || '') === normalized,
    )

    const matchedApp = exactMatch || response.apps[0]

    // Cache the result
    appCache.set(normalized, matchedApp)

    return matchedApp
  }

  return undefined
}

/**
 * Convert a CombinedApp to ServiceInfo format
 */
function combinedAppToServiceInfo(app: CombinedApp): ServiceInfo {
  const normalizedId = normalizeAppName(app.name)

  return {
    id: normalizedId,
    name: app.name,
    pipedreamSlug: app.pipedreamSlug,
    composioSlug: app.composioSlug,
    localProviderId: LOCAL_PROVIDER_IDS[normalizedId],
    icon: app.logo || '',
  }
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * AI-powered analysis of whether user likely has required credentials
 * based on their connected accounts and the task they want to perform
 */
export async function analyzeCredentialRequirements(
  userMessage: string,
  connectedAccounts: Array<{ id: string, app: string, name?: string }>,
): Promise<CredentialAnalysisResult> {
  try {
    const accountsJson = JSON.stringify(connectedAccounts, null, 2)

    const analysisPrompt = `You are analyzing whether a user has the required app connections to complete their task.

CONNECTED ACCOUNTS (what the user already has):
${accountsJson}

USER'S REQUEST:
"${userMessage}"

Analyze whether the connected accounts likely provide the credentials needed for this task.
Consider:
- "gcal" or "google_calendar" or "google_sheets" all indicate Google OAuth access
- Similar apps from the same provider often share OAuth (e.g., any Google app = Google access)
- Exact matches are best, but related services often work

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "likelyHasCredentials": true/false,
  "searchTermsIfNoCredentials": ["term1", "term2"]
}

If likelyHasCredentials is true, searchTermsIfNoCredentials should be an empty array.
If likelyHasCredentials is false, provide search terms the user could use to find the right connector.`

    const response = await window.electronAPI.sendAIMessage(
      'keyboard',
      [
        { role: 'system', content: 'You analyze app connections. Respond only with valid JSON.' },
        { role: 'user', content: analysisPrompt },
      ],
      { model: 'claude-haiku-4-5-20251001' },
    )

    // Parse JSON response
    const jsonMatch = response.trim().match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      return {
        likelyHasCredentials: result.likelyHasCredentials === true,
        searchTermsIfNoCredentials: Array.isArray(result.searchTermsIfNoCredentials)
          ? result.searchTermsIfNoCredentials
          : [],
      }
    }

    // Default to optimistic if parsing fails
    return { likelyHasCredentials: true, searchTermsIfNoCredentials: [] }
  }
  catch (error) {
    return { likelyHasCredentials: true, searchTermsIfNoCredentials: [] }
  }
}

/**
 * AI-based classification to detect required services
 * Returns app names/slugs that the AI identifies as needed
 */
async function aiClassifyRequiredServices(message: string): Promise<string[]> {
  try {
    // Get available apps to give AI context
    const apps = await getAllApps()
    const appNames = apps.slice(0, 200).map(app => app.name).join(', ')

    const classificationPrompt = `You are a service detection assistant. Analyze the user's message and identify which external services/apps they need to connect to accomplish their task.

Some available services include (but are not limited to):
${appNames}

User message: "${message}"

Instructions:
1. Identify ALL services mentioned or implied in the message
2. Consider the full context - if they mention "meeting notes" they might need a calendar or notes app
3. Only include services that would require API/OAuth access to complete the task
4. Return the EXACT app names as they appear in the list above when possible
5. Return ONLY a JSON array of app names, nothing else

Example responses:
- For "Review today's meeting notes on Notion and sync tasks to Linear": ["Notion", "Linear"]
- For "Send a Slack message about the GitHub PR": ["Slack", "GitHub"]
- For "Create a Google Sheet from Airtable data": ["Google Sheets", "Airtable"]
- For "Post a tweet about our new feature": ["Twitter"]

Return the JSON array:`

    const response = await window.electronAPI.sendAIMessage(
      'keyboard',
      [
        { role: 'system', content: 'You are a service detection assistant. Respond only with a valid JSON array of app names.' },
        { role: 'user', content: classificationPrompt },
      ],
      { model: 'claude-haiku-4-5-20251001' },
    )

    // Parse the JSON array from the response
    const trimmed = response.trim()
    // Handle cases where AI might wrap in markdown code blocks
    const jsonMatch = trimmed.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed)) {
        return parsed.filter((name: unknown) => typeof name === 'string')
      }
    }

    return []
  }
  catch (error) {
    return []
  }
}

/**
 * Main detection function - uses AI classification to detect required services
 * and looks up the app info from APIs
 */
export async function detectRequiredServices(
  message: string,
  useAIClassification: boolean = true,
): Promise<ServiceInfo[]> {
  const detectedServices: ServiceInfo[] = []

  if (useAIClassification) {
    try {
      const aiResults = await aiClassifyRequiredServices(message)
      for (const appName of aiResults) {
        const app = await lookupApp(appName)
        if (app) {
          const serviceInfo = combinedAppToServiceInfo(app)
          // Avoid duplicates
          if (!detectedServices.find(s => s.id === serviceInfo.id)) {
            detectedServices.push(serviceInfo)
          }
        }
        else {
        }
      }
    }
    catch (error) {
    }
  }

  return detectedServices
}

/**
 * Get service info by looking up from APIs
 */
export async function getServiceInfo(nameOrSlug: string): Promise<ServiceInfo | undefined> {
  const app = await lookupApp(nameOrSlug)
  if (app) {
    return combinedAppToServiceInfo(app)
  }
  return undefined
}

/**
 * Get all available services from APIs
 */
export async function getAllServices(): Promise<ServiceInfo[]> {
  const apps = await getAllApps()
  return apps.map(combinedAppToServiceInfo)
}

/**
 * Clear the app cache (useful for testing or when refreshing data)
 */
export function clearCache(): void {
  appCache.clear()
  allAppsCache = null
  allAppsCacheTime = 0
}

// =============================================================================
// Export singleton-style functions
// =============================================================================

export const connectionDetectionService = {
  detectRequiredServices,
  getServiceInfo,
  getAllServices,
  analyzeCredentialRequirements,
  clearCache,
  lookupApp,
}

export default connectionDetectionService
