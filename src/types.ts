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
  codespaceResponse?: { data: Record<string, unknown> & { stdout?: string, stderr?: string } }
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
