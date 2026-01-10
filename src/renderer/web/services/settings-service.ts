/**
 * Web Settings Service
 *
 * Cookie-based settings storage for the web app.
 * Uses cookies for persistence as they're less sensitive than auth tokens.
 */

import type { CodeApprovalLevel, ResponseApprovalLevel } from '../../../types/settings-types'
import { COOKIE_KEYS, COOKIE_OPTIONS } from '../config'

/**
 * Set a cookie with the given options
 */
function setCookie(name: string, value: string, options = COOKIE_OPTIONS): void {
  const { maxAge, path, sameSite, secure } = options
  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`

  if (maxAge !== undefined) {
    cookieString += `; max-age=${maxAge}`
  }
  if (path) {
    cookieString += `; path=${path}`
  }
  if (sameSite) {
    cookieString += `; samesite=${sameSite}`
  }
  if (secure) {
    cookieString += '; secure'
  }

  document.cookie = cookieString
}

/**
 * Get a cookie value by name
 */
function getCookie(name: string): string | null {
  const cookies = document.cookie.split(';')

  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=')
    if (decodeURIComponent(cookieName) === name) {
      return decodeURIComponent(cookieValue)
    }
  }

  return null
}

/**
 * Delete a cookie by name
 */
function deleteCookie(name: string): void {
  document.cookie = `${encodeURIComponent(name)}=; max-age=0; path=/`
}

// Default settings values
const DEFAULT_SETTINGS = {
  showNotifications: true,
  automaticCodeApproval: 'disabled' as CodeApprovalLevel,
  automaticResponseApproval: 'always' as ResponseApprovalLevel,
  fullCodeExecution: false,
  executionPreference: undefined as string | undefined,
}

/**
 * Get all settings
 */
export function getSettings(): {
  showNotifications: boolean
  automaticCodeApproval: CodeApprovalLevel
  automaticResponseApproval: ResponseApprovalLevel
  fullCodeExecution: boolean
  settingsFile: string
  updatedAt: number | null
} {
  return {
    showNotifications: getShowNotifications(),
    automaticCodeApproval: getAutomaticCodeApproval(),
    automaticResponseApproval: getAutomaticResponseApproval(),
    fullCodeExecution: getFullCodeExecution(),
    settingsFile: 'cookies', // Indicate storage location
    updatedAt: null, // Not tracked for cookies
  }
}

/**
 * Show notifications setting
 */
export function getShowNotifications(): boolean {
  const value = getCookie(COOKIE_KEYS.SHOW_NOTIFICATIONS)
  if (value === null) return DEFAULT_SETTINGS.showNotifications
  return value === 'true'
}

export function setShowNotifications(show: boolean): void {
  setCookie(COOKIE_KEYS.SHOW_NOTIFICATIONS, show.toString())
}

/**
 * Automatic code approval setting
 */
export function getAutomaticCodeApproval(): CodeApprovalLevel {
  const value = getCookie(COOKIE_KEYS.AUTO_CODE_APPROVAL)
  if (value === null) return DEFAULT_SETTINGS.automaticCodeApproval
  return value as CodeApprovalLevel
}

export function setAutomaticCodeApproval(level: CodeApprovalLevel): void {
  setCookie(COOKIE_KEYS.AUTO_CODE_APPROVAL, level)
}

/**
 * Automatic response approval setting
 */
export function getAutomaticResponseApproval(): ResponseApprovalLevel {
  const value = getCookie(COOKIE_KEYS.AUTO_RESPONSE_APPROVAL)
  if (value === null) return DEFAULT_SETTINGS.automaticResponseApproval
  return value as ResponseApprovalLevel
}

export function setAutomaticResponseApproval(level: ResponseApprovalLevel): void {
  setCookie(COOKIE_KEYS.AUTO_RESPONSE_APPROVAL, level)
}

/**
 * Full code execution setting
 */
export function getFullCodeExecution(): boolean {
  const value = getCookie(COOKIE_KEYS.FULL_CODE_EXECUTION)
  if (value === null) return DEFAULT_SETTINGS.fullCodeExecution
  return value === 'true'
}

export function setFullCodeExecution(enabled: boolean): void {
  setCookie(COOKIE_KEYS.FULL_CODE_EXECUTION, enabled.toString())
}

/**
 * Onboarding completed setting
 */
export function checkOnboardingCompleted(): boolean {
  const value = getCookie(COOKIE_KEYS.ONBOARDING_COMPLETED)
  return value === 'true'
}

export function markOnboardingCompleted(): void {
  setCookie(COOKIE_KEYS.ONBOARDING_COMPLETED, 'true')
}

/**
 * Execution preference setting
 */
export function getExecutionPreference(): { preference?: string, error?: string } {
  const value = getCookie(COOKIE_KEYS.EXECUTION_PREFERENCE)
  return { preference: value || undefined }
}

export function setExecutionPreference(preference: string): { success: boolean, error?: string } {
  try {
    setCookie(COOKIE_KEYS.EXECUTION_PREFERENCE, preference)
    return { success: true }
  }
  catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Clear all settings cookies
 */
export function clearAllSettings(): void {
  Object.values(COOKIE_KEYS).forEach(key => deleteCookie(key))
}
