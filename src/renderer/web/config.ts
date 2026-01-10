/**
 * Web App Configuration
 *
 * Environment variables and configuration for running the app as a web application.
 * All values are configurable via build-time environment variables (VITE_*).
 */

// Platform detection
export const PLATFORM = import.meta.env.VITE_PLATFORM || 'electron'
export const IS_WEB = PLATFORM === 'web'

// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'https://api.keyboard.dev'

// WorkOS OAuth Configuration
export const WORKOS_CLIENT_ID = import.meta.env.VITE_WORKOS_CLIENT_ID || ''
// eslint-disable-next-line custom/no-console
console.log('WORKOS_CLIENT_ID', WORKOS_CLIENT_ID)
export const WORKOS_REDIRECT_URI = import.meta.env.VITE_WORKOS_REDIRECT_URI || `${window.location.origin}/auth/callback`
export const AUTHKIT_DOMAIN = import.meta.env.VITE_AUTHKIT_DOMAIN || 'login.keyboard.dev'

// Token Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'keyboard_access_token',
  REFRESH_TOKEN: 'keyboard_refresh_token',
  TOKEN_EXPIRES_AT: 'keyboard_token_expires_at',
  USER_INFO: 'keyboard_user_info',
} as const

// Cookie Keys for Settings
export const COOKIE_KEYS = {
  SHOW_NOTIFICATIONS: 'kb_show_notifications',
  AUTO_CODE_APPROVAL: 'kb_auto_code_approval',
  AUTO_RESPONSE_APPROVAL: 'kb_auto_response_approval',
  FULL_CODE_EXECUTION: 'kb_full_code_execution',
  ONBOARDING_COMPLETED: 'kb_onboarding_completed',
  EXECUTION_PREFERENCE: 'kb_execution_preference',
} as const

// Cookie options
export const COOKIE_OPTIONS = {
  // 30 days expiry
  maxAge: 30 * 24 * 60 * 60,
  path: '/',
  sameSite: 'lax' as const,
  secure: window.location.protocol === 'https:',
}

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH_VERIFY: '/api/auth/verify',
  AUTH_WEB_AUTHORIZE: '/api/auth/web/authorize',
  AUTH_WEB_CALLBACK: '/api/auth/web/callback',
  AUTH_WEB_REFRESH: '/api/auth/web/refresh',
  AUTH_LOGOUT: '/api/auth/logout',

  // Scripts
  SCRIPTS: '/api/scripts',

  // Credits
  CREDITS_BALANCE: '/api/credits/balance',
  CREDITS_CHECKOUT: '/api/credits/checkout',

  // Subscriptions
  SUBSCRIPTION_CHECKOUT: '/api/subscription/checkout',
  PAYMENT_STATUS: '/api/payment/status',

  // Pipedream
  PIPEDREAM_ACCOUNTS: '/api/pipedream/accounts',
  PIPEDREAM_APPS: '/api/pipedream/apps',
  PIPEDREAM_CONNECT: '/api/pipedream/connect',

  // Connected Accounts (Token Vault)
  CONNECTED_ACCOUNTS: '/api/token-vault/connected-accounts',
  CONNECTORS: '/api/token-vault/connectors',

  // User Tokens
  USER_TOKENS: '/api/user-tokens',

  // Codespaces
  CODESPACES: '/api/codespaces',
  CODESPACE_INFO: '/api/codespace/info',

  // SSE
  SSE_EVENTS: '/api/sse/events',
} as const

// Token refresh buffer (refresh 5 minutes before expiry)
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

// Type definitions for environment variables
declare global {
  interface ImportMetaEnv {
    VITE_PLATFORM?: string
    VITE_API_URL?: string
    VITE_WORKOS_CLIENT_ID?: string
    VITE_WORKOS_REDIRECT_URI?: string
    VITE_AUTHKIT_DOMAIN?: string
  }
}
