/**
 * Keyboard Shortcut Script Template Tool for MCP integration
 * Handles save and update operations for keyboard shortcut script templates
 * via IPC to the main process (where encryption is handled securely)
 */

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

export class KeyboardShortcutTool {
  /**
   * Save a new keyboard shortcut script template via IPC
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

      // Call main process via IPC (encryption happens there)
      const result = await window.electronAPI.saveScriptTemplate({
        name: params.name,
        description: params.description,
        schema: params.schema || {},
        script: params.script,
        tags: params.tags || [],
      })

      if (result.success) {
        return {
          success: true,
          id: result.id,
          message: `Script "${params.name}" saved successfully with ID: ${result.id}`,
        }
      }
      else {
        return {
          success: false,
          error: result.error || 'Failed to save script template',
        }
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
   * Update an existing keyboard shortcut script template via IPC
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

      // Build updates object
      const updates: {
        name?: string
        description?: string
        schema?: Record<string, unknown>
        script?: string
        tags?: string[]
      } = {}
      if (params.name !== undefined) updates.name = params.name
      if (params.description !== undefined) updates.description = params.description
      if (params.schema !== undefined) updates.schema = params.schema
      if (params.script !== undefined) updates.script = params.script
      if (params.tags !== undefined) updates.tags = params.tags

      // Call main process via IPC (encryption happens there)
      const result = await window.electronAPI.updateScriptTemplate(params.id, updates)

      if (result.success) {
        return {
          success: true,
          id: params.id,
          message: `Script ${params.id} updated successfully`,
        }
      }
      else {
        return {
          success: false,
          error: result.error || 'Failed to update script template',
        }
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
