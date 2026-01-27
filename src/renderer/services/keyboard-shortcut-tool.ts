/**
 * Keyboard Shortcut Script Template Tool for MCP integration
 * Handles save and update operations for keyboard shortcut script templates
 * directly from the renderer process via API calls
 */

const API_URL = 'https://api.keyboard.dev'

export interface ScriptInputSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object'
    description: string
    title: string
    required?: boolean
    default?: unknown
    options?: string[]
    items?: ScriptInputSchema
  }
}

export interface SaveScriptParams {
  name: string
  description: string
  schema: ScriptInputSchema
  script: string
  tags?: string[]
}

export interface UpdateScriptParams {
  id: string
  name?: string
  description?: string
  schema?: ScriptInputSchema
  script?: string
  tags?: string[]
}

export interface ScriptToolResult {
  success: boolean
  id?: string
  error?: string
  message?: string
}

/**
 * Simple encryption using XOR with a key derived from the encryption key
 * This matches the encryption used in keyboard-shortcuts.ts
 */
async function encryptScript(script: string): Promise<string> {
  try {
    const encryptionKey = await window.electronAPI?.getEncryptionKey?.()
    if (!encryptionKey) {
      // If no encryption key, return base64 encoded
      return btoa(unescape(encodeURIComponent(script)))
    }

    // Create a simple XOR encryption
    const keyBytes = new TextEncoder().encode(encryptionKey)
    const scriptBytes = new TextEncoder().encode(script)
    const encrypted = new Uint8Array(scriptBytes.length)

    for (let i = 0; i < scriptBytes.length; i++) {
      encrypted[i] = scriptBytes[i] ^ keyBytes[i % keyBytes.length]
    }

    // Convert to base64
    return btoa(String.fromCharCode(...encrypted))
  }
  catch (error) {
    // Fallback to base64 encoding
    return btoa(unescape(encodeURIComponent(script)))
  }
}

export class KeyboardShortcutTool {
  /**
   * Save a new keyboard shortcut script template
   */
  async saveScript(params: SaveScriptParams): Promise<ScriptToolResult> {
    try {
      // Validate required parameters
      if (!params.name?.trim()) {
        throw new Error('Name parameter is required and cannot be empty')
      }
      if (!params.description?.trim()) {
        throw new Error('Description parameter is required and cannot be empty')
      }
      if (!params.script?.trim()) {
        throw new Error('Script parameter is required and cannot be empty')
      }

      // Get access token
      const token = await window.electronAPI?.getAccessToken?.()
      if (!token) {
        throw new Error('Not authenticated. Please log in first.')
      }

      // Encrypt the script before sending
      const encryptedScript = await encryptScript(params.script)

      // Make API call to save script
      const response = await fetch(`${API_URL}/api/scripts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: params.name,
          description: params.description,
          schema: params.schema || {},
          script: encryptedScript,
          tags: params.tags || [],
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      return {
        success: true,
        id: result.id,
        message: `Script "${params.name}" saved successfully with ID: ${result.id}`,
      }
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Update an existing keyboard shortcut script template
   */
  async updateScript(params: UpdateScriptParams): Promise<ScriptToolResult> {
    try {
      // Validate required parameters
      if (!params.id?.trim()) {
        throw new Error('Script ID is required')
      }

      // Check that at least one update field is provided
      const hasUpdates = params.name || params.description || params.schema || params.script || params.tags
      if (!hasUpdates) {
        throw new Error('At least one field to update must be provided (name, description, schema, script, or tags)')
      }

      // Get access token
      const token = await window.electronAPI?.getAccessToken?.()
      if (!token) {
        throw new Error('Not authenticated. Please log in first.')
      }

      // Build updates object
      const updates: Record<string, unknown> = {}
      if (params.name !== undefined) updates.name = params.name
      if (params.description !== undefined) updates.description = params.description
      if (params.schema !== undefined) updates.schema = params.schema
      if (params.tags !== undefined) updates.tags = params.tags

      // Encrypt script if being updated
      if (params.script !== undefined) {
        updates.script = await encryptScript(params.script)
      }

      // Make API call to update script
      const response = await fetch(`${API_URL}/api/scripts/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      return {
        success: true,
        id: params.id,
        message: `Script ${params.id} updated successfully`,
      }
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }
}

// Export singleton instance
export const keyboardShortcutTool = new KeyboardShortcutTool()
