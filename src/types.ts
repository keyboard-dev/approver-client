export interface Message {
  id: string
  title: string
  body: string
  timestamp: number
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  sender?: string
  read?: boolean
  status?: 'pending' | 'approved' | 'rejected'
  feedback?: string
  requiresResponse?: boolean
  codeEval?: boolean
  code?: string
  explanation?: string
  type?: string
  risk_level?: 'low' | 'medium' | 'high'
  providers?: string[]
  codespaceResponse?: { data: Record<string, unknown> & { stdout?: string, stderr?: string } }
  /** The chat thread ID this message originated from */
  threadId?: string
  /** The title of the chat thread this message originated from */
  threadTitle?: string
  /** Whether this message originated from our app (matched via fingerprint) */
  isFromOurApp?: boolean
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  expires_at: number
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    profile_picture?: string
  }
}

export interface PKCEParams {
  codeVerifier: string
  codeChallenge: string
  state: string
}

export interface AuthorizeResponse {
  authorization_url: string
  state: string
  redirect_uri: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  exp: number
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    profile_picture?: string
  }
}

export interface ErrorResponse {
  error?: string
  error_description?: string
}

export interface TemplateVariableSchema {
  type: string
  description?: string
  default?: unknown
  required?: boolean
}

export interface CollectionRequest {
  title: string
  description: string
  community: boolean
  from_the_team: boolean
  keyboard_api_keys_required: string[]
  provider_user_tokens_required: string[]
  api_services: string[]
  script_code: string
  template_variables_schema: Record<string, TemplateVariableSchema>
}

export interface ShareMessage {
  id: string
  type: 'collection-share'
  title: string
  body: string
  timestamp: number
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  sender?: string
  read?: boolean
  status?: 'pending' | 'approved' | 'rejected'
  requiresResponse?: boolean
  collectionRequest: CollectionRequest
}

export interface Script {
  id: string
  name: string
  description: string
  tags?: string[]
  services?: string[]
  isExpanded?: boolean
  schema?: Record<string, TemplateVariableSchema>
  script?: string
}

export interface CodespaceInfo {
  packageJson?: Record<string, unknown>
  environmentVariableKeys?: string[] // not actual environment variables, but the key namesthat are available in the codespace
  docResources?: Record<string, unknown>
  success: boolean
  error?: { message: string }
  status?: number
}
