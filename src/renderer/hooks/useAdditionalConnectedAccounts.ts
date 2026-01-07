/**
 * useAdditionalConnectedAccounts Hook
 *
 * React hook for managing additional connected accounts from Token Vault.
 * Handles fetching accounts, refreshing, and state management.
 */

import { useCallback, useEffect, useState } from 'react'

// =============================================================================
// Types
// =============================================================================

export interface AdditionalConnectedAccount {
  id: string
  connection: string
  access_type: string
  scopes: string[]
  created_at: string
  icon?: string
  // Derived fields for display compatibility
  name: string
  displayName: string
}

interface UseAdditionalConnectedAccountsState {
  // Connected accounts
  accounts: AdditionalConnectedAccount[]
  accountsLoading: boolean
  accountsError: string | null

  // Disconnection state
  disconnectingAccountId: string | null
}

interface UseAdditionalConnectedAccountsActions {
  // Fetch data
  refreshAccounts: () => Promise<void>

  // Disconnect (placeholder for future implementation)
  disconnectAccount: (accountId: string) => Promise<void>
}

export type UseAdditionalConnectedAccountsReturn = UseAdditionalConnectedAccountsState & UseAdditionalConnectedAccountsActions

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Transform raw account data to display format
 */
function transformAccount(account: {
  id: string
  connection: string
  access_type: string
  scopes: string[]
  created_at: string
  icon?: string
}): AdditionalConnectedAccount {
  // Parse connection name (e.g., "google-oauth2" -> "Google")
  const connectionParts = account.connection.split('-')
  const providerName = connectionParts[0]
  const displayName = providerName.charAt(0).toUpperCase() + providerName.slice(1)

  return {
    ...account,
    name: account.connection,
    displayName,
  }
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAdditionalConnectedAccounts(): UseAdditionalConnectedAccountsReturn {
  // Connected accounts state
  const [accounts, setAccounts] = useState<AdditionalConnectedAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState<string | null>(null)

  // Disconnection state
  const [disconnectingAccountId, setDisconnectingAccountId] = useState<string | null>(null)

  // ==========================================================================
  // Fetch Functions
  // ==========================================================================

  const refreshAccounts = useCallback(async () => {
    setAccountsLoading(true)
    setAccountsError(null)

    try {
      const response = await window.electronAPI.getAdditionalConnectedAccounts()

      if (response.success) {
        const transformedAccounts = response.accounts.map(transformAccount)
        setAccounts(transformedAccounts)
      }
      else {
        setAccountsError('Failed to load additional connected accounts')
        setAccounts([])
      }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load additional connected accounts'
      setAccountsError(message)
      setAccounts([])
    }
    finally {
      setAccountsLoading(false)
    }
  }, [])

  // ==========================================================================
  // Disconnect Function
  // ==========================================================================

  const disconnectAccount = useCallback(async (accountId: string) => {
    setDisconnectingAccountId(accountId)

    try {
      const response = await window.electronAPI.deleteAdditionalAccount(accountId)

      if (!response.success) {
        throw new Error(response.message || 'Failed to delete account')
      }

      // Refresh the accounts list after successful deletion
      await refreshAccounts()
    }
    catch (error) {
      setAccountsError(error instanceof Error ? error.message : 'Failed to delete account')
      throw error
    }
    finally {
      setDisconnectingAccountId(null)
    }
  }, [refreshAccounts])

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Load accounts on mount
  useEffect(() => {
    refreshAccounts()
  }, [refreshAccounts])

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // State
    accounts,
    accountsLoading,
    accountsError,
    disconnectingAccountId,

    // Actions
    refreshAccounts,
    disconnectAccount,
  }
}

export default useAdditionalConnectedAccounts
