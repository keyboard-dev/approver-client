/**
 * Connection Detection Service
 *
 * Uses AI classification to detect which app connections are required
 * based on the user's message. Returns a list of services that need
 * to be connected before the task can be executed.
 */

// Known services and their common aliases/keywords for quick matching
export const SERVICE_MAPPINGS: Record<string, ServiceInfo> = {
  // Productivity & Notes
  notion: {
    id: 'notion',
    name: 'Notion',
    aliases: ['notion', 'notion.so'],
    pipedreamSlug: 'notion',
    composioSlug: 'notion',
    icon: 'https://cdn.worldvectorlogo.com/logos/notion-logo-1.svg',
  },
  linear: {
    id: 'linear',
    name: 'Linear',
    aliases: ['linear', 'linear.app'],
    pipedreamSlug: 'linear_app',
    composioSlug: 'linear',
    icon: 'https://cdn.worldvectorlogo.com/logos/linear-1.svg',
  },
  asana: {
    id: 'asana',
    name: 'Asana',
    aliases: ['asana'],
    pipedreamSlug: 'asana',
    composioSlug: 'asana',
    icon: 'https://cdn.worldvectorlogo.com/logos/asana-logo.svg',
  },
  trello: {
    id: 'trello',
    name: 'Trello',
    aliases: ['trello'],
    pipedreamSlug: 'trello',
    composioSlug: 'trello',
    icon: 'https://cdn.worldvectorlogo.com/logos/trello.svg',
  },
  jira: {
    id: 'jira',
    name: 'Jira',
    aliases: ['jira', 'atlassian jira'],
    pipedreamSlug: 'jira',
    composioSlug: 'jira',
    icon: 'https://cdn.worldvectorlogo.com/logos/jira-1.svg',
  },

  // Communication
  slack: {
    id: 'slack',
    name: 'Slack',
    aliases: ['slack'],
    pipedreamSlug: 'slack',
    composioSlug: 'slack',
    localProviderId: 'slack',
    icon: 'https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg',
  },
  discord: {
    id: 'discord',
    name: 'Discord',
    aliases: ['discord'],
    pipedreamSlug: 'discord',
    composioSlug: 'discord',
    icon: 'https://cdn.worldvectorlogo.com/logos/discord-6.svg',
  },
  teams: {
    id: 'teams',
    name: 'Microsoft Teams',
    aliases: ['teams', 'microsoft teams', 'ms teams'],
    pipedreamSlug: 'microsoft_teams',
    composioSlug: 'microsoftteams',
    icon: 'https://cdn.worldvectorlogo.com/logos/microsoft-teams-1.svg',
  },

  // Google Suite
  google: {
    id: 'google',
    name: 'Google',
    aliases: ['google', 'gmail', 'google drive', 'google docs', 'google sheets', 'google calendar', 'google slides'],
    pipedreamSlug: 'google',
    composioSlug: 'googlesheets',
    localProviderId: 'google',
    icon: 'https://cdn.worldvectorlogo.com/logos/google-icon.svg',
  },
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    aliases: ['gmail', 'google mail'],
    pipedreamSlug: 'gmail',
    composioSlug: 'gmail',
    localProviderId: 'google',
    icon: 'https://cdn.worldvectorlogo.com/logos/gmail-icon-2.svg',
  },
  googlecalendar: {
    id: 'googlecalendar',
    name: 'Google Calendar',
    aliases: ['google calendar', 'gcal'],
    pipedreamSlug: 'google_calendar',
    composioSlug: 'googlecalendar',
    localProviderId: 'google',
    icon: 'https://cdn.worldvectorlogo.com/logos/google-calendar-2020.svg',
  },
  googlesheets: {
    id: 'googlesheets',
    name: 'Google Sheets',
    aliases: ['google sheets', 'sheets', 'spreadsheet'],
    pipedreamSlug: 'google_sheets',
    composioSlug: 'googlesheets',
    localProviderId: 'google',
    icon: 'https://cdn.worldvectorlogo.com/logos/google-sheets-logo-icon.svg',
  },
  googledrive: {
    id: 'googledrive',
    name: 'Google Drive',
    aliases: ['google drive', 'drive'],
    pipedreamSlug: 'google_drive',
    composioSlug: 'googledrive',
    localProviderId: 'google',
    icon: 'https://cdn.worldvectorlogo.com/logos/google-drive-icon.svg',
  },

  // Development
  github: {
    id: 'github',
    name: 'GitHub',
    aliases: ['github', 'gh'],
    pipedreamSlug: 'github',
    composioSlug: 'github',
    localProviderId: 'github',
    icon: 'https://cdn.worldvectorlogo.com/logos/github-icon-1.svg',
  },
  gitlab: {
    id: 'gitlab',
    name: 'GitLab',
    aliases: ['gitlab'],
    pipedreamSlug: 'gitlab',
    composioSlug: 'gitlab',
    icon: 'https://cdn.worldvectorlogo.com/logos/gitlab.svg',
  },

  // CRM & Sales
  salesforce: {
    id: 'salesforce',
    name: 'Salesforce',
    aliases: ['salesforce', 'sfdc'],
    pipedreamSlug: 'salesforce_rest_api',
    composioSlug: 'salesforce',
    icon: 'https://cdn.worldvectorlogo.com/logos/salesforce-2.svg',
  },
  hubspot: {
    id: 'hubspot',
    name: 'HubSpot',
    aliases: ['hubspot'],
    pipedreamSlug: 'hubspot',
    composioSlug: 'hubspot',
    icon: 'https://cdn.worldvectorlogo.com/logos/hubspot.svg',
  },

  // Social Media
  twitter: {
    id: 'twitter',
    name: 'Twitter/X',
    aliases: ['twitter', 'x', 'tweet'],
    pipedreamSlug: 'twitter',
    composioSlug: 'twitter',
    icon: 'https://cdn.worldvectorlogo.com/logos/x-2.svg',
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    aliases: ['linkedin'],
    pipedreamSlug: 'linkedin',
    composioSlug: 'linkedin',
    icon: 'https://cdn.worldvectorlogo.com/logos/linkedin-icon-2.svg',
  },

  // Finance
  stripe: {
    id: 'stripe',
    name: 'Stripe',
    aliases: ['stripe', 'payment'],
    pipedreamSlug: 'stripe',
    composioSlug: 'stripe',
    icon: 'https://cdn.worldvectorlogo.com/logos/stripe-4.svg',
  },
  quickbooks: {
    id: 'quickbooks',
    name: 'QuickBooks',
    aliases: ['quickbooks', 'qb'],
    pipedreamSlug: 'quickbooks',
    composioSlug: 'quickbooks',
    icon: 'https://cdn.worldvectorlogo.com/logos/quickbooks-2.svg',
  },

  // Design
  figma: {
    id: 'figma',
    name: 'Figma',
    aliases: ['figma'],
    pipedreamSlug: 'figma',
    composioSlug: 'figma',
    icon: 'https://cdn.worldvectorlogo.com/logos/figma-icon.svg',
  },

  // Storage
  dropbox: {
    id: 'dropbox',
    name: 'Dropbox',
    aliases: ['dropbox'],
    pipedreamSlug: 'dropbox',
    composioSlug: 'dropbox',
    icon: 'https://cdn.worldvectorlogo.com/logos/dropbox-1.svg',
  },

  // Email Marketing
  mailchimp: {
    id: 'mailchimp',
    name: 'Mailchimp',
    aliases: ['mailchimp'],
    pipedreamSlug: 'mailchimp',
    composioSlug: 'mailchimp',
    icon: 'https://cdn.worldvectorlogo.com/logos/mailchimp-freddie-icon.svg',
  },

  // Forms & Surveys
  typeform: {
    id: 'typeform',
    name: 'Typeform',
    aliases: ['typeform'],
    pipedreamSlug: 'typeform',
    composioSlug: 'typeform',
    icon: 'https://cdn.worldvectorlogo.com/logos/typeform-1.svg',
  },

  // Calendar
  calendly: {
    id: 'calendly',
    name: 'Calendly',
    aliases: ['calendly'],
    pipedreamSlug: 'calendly',
    composioSlug: 'calendly',
    icon: 'https://cdn.worldvectorlogo.com/logos/calendly-1.svg',
  },

  // AI Services
  openai: {
    id: 'openai',
    name: 'OpenAI',
    aliases: ['openai', 'chatgpt', 'gpt'],
    pipedreamSlug: 'openai',
    composioSlug: 'openai',
    icon: 'https://cdn.worldvectorlogo.com/logos/openai-2.svg',
  },

  // Microsoft
  microsoft: {
    id: 'microsoft',
    name: 'Microsoft',
    aliases: ['microsoft', 'outlook', 'office 365', 'o365'],
    pipedreamSlug: 'microsoft_outlook',
    composioSlug: 'microsoftoutlook',
    localProviderId: 'microsoft',
    icon: 'https://cdn.worldvectorlogo.com/logos/microsoft-icon.svg',
  },

  // Airtable
  airtable: {
    id: 'airtable',
    name: 'Airtable',
    aliases: ['airtable'],
    pipedreamSlug: 'airtable',
    composioSlug: 'airtable',
    icon: 'https://cdn.worldvectorlogo.com/logos/airtable.svg',
  },

  // Zapier alternative - Monday.com
  monday: {
    id: 'monday',
    name: 'Monday.com',
    aliases: ['monday', 'monday.com'],
    pipedreamSlug: 'monday',
    composioSlug: 'monday',
    icon: 'https://cdn.worldvectorlogo.com/logos/monday-1.svg',
  },

  // Zoom
  zoom: {
    id: 'zoom',
    name: 'Zoom',
    aliases: ['zoom', 'zoom meeting'],
    pipedreamSlug: 'zoom',
    composioSlug: 'zoom',
    icon: 'https://cdn.worldvectorlogo.com/logos/zoom-communications-logo.svg',
  },

  // Intercom
  intercom: {
    id: 'intercom',
    name: 'Intercom',
    aliases: ['intercom'],
    pipedreamSlug: 'intercom',
    composioSlug: 'intercom',
    icon: 'https://cdn.worldvectorlogo.com/logos/intercom-1.svg',
  },

  // Zendesk
  zendesk: {
    id: 'zendesk',
    name: 'Zendesk',
    aliases: ['zendesk'],
    pipedreamSlug: 'zendesk',
    composioSlug: 'zendesk',
    icon: 'https://cdn.worldvectorlogo.com/logos/zendesk-1.svg',
  },
}

export interface ServiceInfo {
  id: string
  name: string
  aliases: string[]
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
      console.log('[CredentialAnalysis] AI result:', result)
      return {
        likelyHasCredentials: result.likelyHasCredentials === true,
        searchTermsIfNoCredentials: Array.isArray(result.searchTermsIfNoCredentials)
          ? result.searchTermsIfNoCredentials
          : [],
      }
    }

    // Default to optimistic if parsing fails
    console.log('[CredentialAnalysis] Failed to parse AI response, defaulting to optimistic')
    return { likelyHasCredentials: true, searchTermsIfNoCredentials: [] }
  }
  catch (error) {
    console.error('[CredentialAnalysis] Analysis failed:', error)
    // Default to optimistic on error
    return { likelyHasCredentials: true, searchTermsIfNoCredentials: [] }
  }
}

/**
 * Quick keyword-based detection for common services
 * Returns service IDs found in the message
 */
function quickKeywordDetection(message: string): string[] {
  const lowerMessage = message.toLowerCase()
  const detectedServices: string[] = []

  for (const [serviceId, serviceInfo] of Object.entries(SERVICE_MAPPINGS)) {
    for (const alias of serviceInfo.aliases) {
      // Use word boundary matching to avoid false positives
      const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (regex.test(lowerMessage)) {
        if (!detectedServices.includes(serviceId)) {
          detectedServices.push(serviceId)
        }
        break
      }
    }
  }

  return detectedServices
}

/**
 * AI-based classification to detect required services
 * More accurate for complex or ambiguous requests
 */
async function aiClassifyRequiredServices(message: string): Promise<string[]> {
  try {
    const serviceList = Object.entries(SERVICE_MAPPINGS)
      .map(([id, info]) => `- ${id}: ${info.name} (${info.aliases.join(', ')})`)
      .join('\n')

    const classificationPrompt = `You are a service detection assistant. Analyze the user's message and identify which external services/apps they need to connect to accomplish their task.

Available services:
${serviceList}

User message: "${message}"

Instructions:
1. Identify ALL services mentioned or implied in the message
2. Consider the full context - if they mention "meeting notes" they might need a calendar or notes app
3. Only include services that would require API/OAuth access to complete the task
4. Return ONLY a JSON array of service IDs (lowercase), nothing else

Example responses:
- For "Review today's meeting notes on Notion and sync tasks to Linear": ["notion", "linear"]
- For "Send a Slack message about the GitHub PR": ["slack", "github"]
- For "Create a Google Sheet from Airtable data": ["googlesheets", "airtable"]

Return the JSON array:`

    const response = await window.electronAPI.sendAIMessage(
      'keyboard',
      [
        { role: 'system', content: 'You are a service detection assistant. Respond only with a valid JSON array of service IDs.' },
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
        // Filter to only known services
        return parsed.filter((id: string) => typeof id === 'string' && SERVICE_MAPPINGS[id.toLowerCase()])
          .map((id: string) => id.toLowerCase())
      }
    }

    return []
  }
  catch (error) {
    console.error('AI classification failed:', error)
    return []
  }
}

/**
 * Main detection function - uses quick keyword matching first,
 * then falls back to AI classification for better accuracy
 */
export async function detectRequiredServices(
  message: string,
  useAIClassification: boolean = true,
): Promise<string[]> {
  // First, do quick keyword detection
  const keywordResults = quickKeywordDetection(message)
  console.log('[ConnectionDetection] Keyword detection results:', keywordResults)

  // If AI classification is enabled, also run AI detection
  if (useAIClassification) {
    try {
      const aiResults = await aiClassifyRequiredServices(message)
      console.log('[ConnectionDetection] AI classification results:', aiResults)

      // Merge results, preferring AI results but including keyword matches
      const mergedSet = new Set([...keywordResults, ...aiResults])
      const finalResults = Array.from(mergedSet)
      console.log('[ConnectionDetection] Final merged results:', finalResults)
      return finalResults
    }
    catch (error) {
      console.log('[ConnectionDetection] AI classification failed, using keyword results:', error)
      // Fall back to keyword results if AI fails
      return keywordResults
    }
  }

  return keywordResults
}

/**
 * Get service info by ID
 */
export function getServiceInfo(serviceId: string): ServiceInfo | undefined {
  return SERVICE_MAPPINGS[serviceId.toLowerCase()]
}

/**
 * Get all known services
 */
export function getAllServices(): ServiceInfo[] {
  return Object.values(SERVICE_MAPPINGS)
}

// Export singleton-style functions
export const connectionDetectionService = {
  detectRequiredServices,
  getServiceInfo,
  getAllServices,
  quickKeywordDetection,
  analyzeCredentialRequirements,
  SERVICE_MAPPINGS,
}

export default connectionDetectionService
