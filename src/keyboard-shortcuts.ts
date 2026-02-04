import { z } from 'zod'
import { decrypt, encrypt } from './encryption'

// Get API URL from environment or default to empty string
const getApiUrl = () => {
  return process.env.API_URL || 'http://localhost:4000'
}

// Type definitions for API responses
interface ApiResponse {
  success: boolean
  message?: string
  [key: string]: unknown
}

interface ScriptApiResponse extends ApiResponse {
  id: string
  script: ScriptTemplate
}

interface ScriptsListApiResponse extends ApiResponse {
  scripts: Array<{
    id: string
    name: string
    description: string
    schema: ScriptInputSchema
    script: string
    tags: string[]
    userId?: string
    createdAt?: string
    updatedAt?: string
  }>
}

interface SearchScriptsApiResponse extends ApiResponse {
  scripts: Array<{
    id: string
    name: string
    description: string
    schema: ScriptInputSchema
    script: string
    tags: string[]
    userId?: string
    createdAt?: string
    updatedAt?: string
  }>
}

// Helper function to make authenticated API requests to external service
async function makeAuthenticatedRequest(
  endpoint: string,
  token: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, unknown>,
): Promise<unknown> {
  const apiUrl = getApiUrl()
  if (!apiUrl) {
    throw new Error('API_URL environment variable is not set')
  }

  const url = `${apiUrl}${endpoint}`
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as Record<string, unknown>
    throw new Error((errorData.message as string) || `HTTP ${response.status}: ${response.statusText}`)
  }

  return await response.json()
}

// Schema definition for script inputs
export interface ScriptInputSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object'
    description: string
    title: string
    required?: boolean
    default?: unknown
    options?: string[] // For enum-like inputs
    items?: ScriptInputSchema // For array/object types
  }
}

// Types for script management
export interface ScriptTemplate {
  id?: string
  name: string
  description: string // What the script does
  schema: ScriptInputSchema // Input validation schema
  script: string // The actual script/code
  tags: string[]
  userId?: string
  createdAt?: string
  updatedAt?: string
}

export interface ExecutableScript {
  script: string
  inputs: Record<string, unknown>
  interpolated: string
}

// Script interpolation function - now works with schema-based inputs
export function interpolateScript(script: string, inputs: Record<string, unknown>): ExecutableScript {
  let interpolated = script

  for (const [key, value] of Object.entries(inputs)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')

    let serializedValue: string

    // Check if the variable is being used in a JavaScript context
    const matches = script.match(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'))
    if (matches) {
      // Look at the surrounding context to determine how to serialize
      const contextRegex = new RegExp(`[\\w\\s]*:\\s*\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
      const isInObjectContext = contextRegex.test(script)

      if (typeof value === 'string' && !isInObjectContext) {
        serializedValue = value
      }
      else if ((typeof value === 'object' && value !== null) || Array.isArray(value)) {
        serializedValue = JSON.stringify(value, null, 2)
      }
      else {
        serializedValue = String(value)
      }
    }
    else {
      serializedValue = (typeof value === 'object' && value !== null) ? JSON.stringify(value, null, 2) : String(value)
    }

    interpolated = interpolated.replace(regex, serializedValue)
  }

  return {
    script,
    inputs,
    interpolated,
  }
}

// Extract variable names from script
export function extractVariables(script: string): string[] {
  const regex = /\{\{\s*(\w+)\s*\}\}/g
  const variables: string[] = []
  let match

  while ((match = regex.exec(script)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1])
    }
  }

  return variables
}

// Validate inputs against schema
export function validateInputs(inputs: Record<string, unknown>, schema: ScriptInputSchema): { valid: boolean, errors: string[] } {
  const errors: string[] = []

  // Check required fields
  for (const [key, fieldSchema] of Object.entries(schema)) {
    if (fieldSchema.required && (inputs[key] === undefined || inputs[key] === null)) {
      errors.push(`Required field '${key}' is missing`)
      continue
    }

    if (inputs[key] !== undefined && inputs[key] !== null) {
      // Type validation
      const value = inputs[key]
      const expectedType = fieldSchema.type

      switch (expectedType) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push(`Field '${key}' must be a string`)
          }
          break
        case 'number':
          if (typeof value !== 'number') {
            errors.push(`Field '${key}' must be a number`)
          }
          break
        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`Field '${key}' must be a boolean`)
          }
          break
        case 'array':
          if (!Array.isArray(value)) {
            errors.push(`Field '${key}' must be an array`)
          }
          break
        case 'object':
          if (typeof value !== 'object' || Array.isArray(value)) {
            errors.push(`Field '${key}' must be an object`)
          }
          break
      }

      // Options validation
      if (fieldSchema.options && !fieldSchema.options.includes(String(value))) {
        errors.push(`Field '${key}' must be one of: ${fieldSchema.options.join(', ')}`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

// Save script template via external API
export async function saveScriptTemplate(
  scriptData: Omit<ScriptTemplate, 'id' | 'createdAt' | 'updatedAt'>,
  token: string,
): Promise<{ success: boolean, id?: string, error?: string }> {
  try {
    // Encrypt the script before sending to external API
    const encryptedScript = encrypt(scriptData.script)

    const response = await makeAuthenticatedRequest(
      '/api/scripts',
      token,
      'POST',
      {
        name: scriptData.name,
        description: scriptData.description,
        schema: scriptData.schema,
        script: encryptedScript, // Send encrypted script to external API
        tags: scriptData.tags,
      },
    ) as ScriptApiResponse

    return { success: true, id: response.id }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Retrieve script template via external API
export async function getScriptTemplate(
  id: string,
  token: string,
): Promise<{ success: boolean, script?: ScriptTemplate, error?: string }> {
  try {
    const response = await makeAuthenticatedRequest(`/api/scripts/${id}`, token) as ScriptApiResponse

    // Decrypt the script after receiving from external API
    const decryptedScript = decrypt(response.script.script)

    const script: ScriptTemplate = {
      ...response.script,
      script: decryptedScript, // Replace encrypted script with decrypted version
    }

    return { success: true, script }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// List all script templates via external API
export async function listScriptTemplates(
  token: string,
  tags?: string[],
): Promise<{ success: boolean, scripts?: ScriptTemplate[], error?: string }> {
  try {
    let endpoint = '/api/scripts'
    if (tags && tags.length > 0) {
      endpoint += `?tags=${tags.join(',')}`
    }

    const response = await makeAuthenticatedRequest(endpoint, token) as ScriptsListApiResponse

    // Decrypt all script contents
    const decryptedScripts = response.scripts.map((script: ScriptsListApiResponse['scripts'][0]) => {
      try {
        return {
          ...script,
          script: decrypt(script.script), // Decrypt each script
        }
      }
      catch (decryptError) {
      }

      const justScriptInfo: Partial<ScriptsListApiResponse['scripts'][0]> = { ...script }
      delete justScriptInfo.script
      try {
        return {
          ...justScriptInfo,
        }
      }
      catch (decryptError) {
        return {
          ...justScriptInfo,
        }
      }
    })

    return { success: true, scripts: decryptedScripts as ScriptTemplate[] }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Update script template via external API
export async function updateScriptTemplate(
  id: string,
  token: string,
  updates: Partial<Omit<ScriptTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
): Promise<{ success: boolean, error?: string }> {
  try {
    // Encrypt script if it's being updated
    const encryptedUpdates = { ...updates }
    if (updates.script !== undefined) {
      encryptedUpdates.script = encrypt(updates.script)
    }

    await makeAuthenticatedRequest(`/api/scripts/${id}`, token, 'PUT', encryptedUpdates)

    return { success: true }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Delete script template via local REST API
export async function deleteScriptTemplate(
  id: string,
  token: string,
): Promise<{ success: boolean, error?: string }> {
  try {
    await makeAuthenticatedRequest(`/api/scripts/${id}`, token, 'DELETE')

    return { success: true }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Search script templates via external API
export async function searchScriptTemplates(
  token: string,
  searchTerm: string,
): Promise<{ success: boolean, scripts?: ScriptTemplate[], error?: string }> {
  try {
    const response = await makeAuthenticatedRequest(
      `/api/scripts/search?q=${encodeURIComponent(searchTerm)}`,
      token,
    ) as SearchScriptsApiResponse

    // Decrypt all script contents
    const decryptedScripts = response.scripts.map((script: SearchScriptsApiResponse['scripts'][0]) => {
      try {
        return {
          ...script,
          script: decrypt(script.script), // Decrypt each script
        }
      }
      catch (decryptError) {
      }

      const justScriptInfo: Partial<SearchScriptsApiResponse['scripts'][0]> = { ...script }
      delete justScriptInfo.script
      return justScriptInfo
    })

    return { success: true, scripts: decryptedScripts as ScriptTemplate[] }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Type for interpolation result
interface InterpolationResult {
  success: boolean
  scriptId: string
  scriptName: string
  scriptDescription: string
  template: string
  variables: Record<string, unknown>
  interpolatedCode: string
  availableVariables: string[]
  tags: string[]
}

// Interpolate script via external API (with local processing)
export async function interpolateScriptViaAPI(
  id: string,
  token: string,
  variables: Record<string, unknown>,
): Promise<{ success: boolean, result?: InterpolationResult, error?: string }> {
  try {
    // First get the script template (already decrypted by getScriptTemplate)
    const templateResult = await getScriptTemplate(id, token)
    if (!templateResult.success) {
      return { success: false, error: templateResult.error }
    }

    const script = templateResult.script!

    // Validate variables against schema if schema exists
    if (script.schema && Object.keys(script.schema).length > 0) {
      const validation = validateInputs(variables, script.schema)
      if (!validation.valid) {
        return {
          success: false,
          error: `Variable validation failed: ${validation.errors.join(', ')}`,
        }
      }
    }

    // Interpolate locally (script is already decrypted from getScriptTemplate)
    const interpolated = interpolateScript(script.script, variables)

    // Return the same format as the API would
    const result: InterpolationResult = {
      success: true,
      scriptId: id,
      scriptName: script.name,
      scriptDescription: script.description,
      template: script.script,
      variables: variables,
      interpolatedCode: interpolated.interpolated,
      availableVariables: Object.keys(script.schema || {}),
      tags: script.tags,
    }

    return { success: true, result }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Alternative function that uses the API endpoint for interpolation
export async function interpolateScriptViaAPIEndpoint(
  id: string,
  token: string,
  variables: Record<string, unknown>,
): Promise<{ success: boolean, result?: InterpolationResult, error?: string }> {
  try {
    const response = await makeAuthenticatedRequest(
      `/api/scripts/${id}/interpolate`,
      token,
      'POST',
      { variables },
    ) as { result: InterpolationResult }

    return { success: true, result: response.result }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Validation schemas for MCP tools (using raw shape format)
export const SaveScriptSchema = {
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  schema: z.record(z.string(), z.object({
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
    description: z.string(),
    title: z.string(),
    required: z.boolean().optional(),
    default: z.any().optional(),
    options: z.array(z.string()).optional(),
    items: z.any().optional(), // Recursive schema for arrays/objects
  })).describe('Input schema defining the structure of inputs the script expects'),
  script: z.string().min(1, 'Script code is required'),
  tags: z.array(z.string()).optional().default([]),
}

export const GetScriptSchema = {
  id: z.string().min(1, 'Script ID is required'),
}

export const UpdateScriptSchema = {
  id: z.string().min(1, 'Script ID is required'),
  name: z.string().optional(),
  description: z.string().optional(),
  schema: z.record(z.string(), z.object({
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
    description: z.string(),
    title: z.string(),
    required: z.boolean().optional(),
    default: z.any().optional(),
    options: z.array(z.string()).optional(),
    items: z.any().optional(),
  })).optional(),
  script: z.string().optional(),
  tags: z.array(z.string()).optional(),
}

export const DeleteScriptSchema = {
  id: z.string().min(1, 'Script ID is required'),
}

export const ListScriptsSchema = {
  tags: z.array(z.string()).optional(),
}

export const SearchScriptsSchema = {
  searchTerm: z.string().min(1, 'Search term is required'),
}

export const ExecuteScriptSchema = {
  id: z.string().min(1, 'Script ID is required'),
  inputs: z.record(z.string(), z.any()).describe('Input values for the script based on its schema'),
}

export const InterpolateScriptSchema = {
  id: z.string().min(1, 'Script ID is required'),
  variables: z.record(z.string(), z.any()).describe('Variable values to interpolate into the script template'),
}
