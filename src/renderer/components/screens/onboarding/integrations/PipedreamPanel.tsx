/**
 * PipedreamPanel
 *
 * Pipedream integrations panel for the integrations onboarding step.
 * Users can search 3,000+ apps, connect new accounts, and manage existing connections.
 */

import { RefreshCw, Search, Trash2, X } from 'lucide-react'
import React, { useState } from 'react'

import squaresIconUrl from '../../../../../../assets/icon-squares.svg'
import { usePipedream } from '../../../../hooks/usePipedream'
import { usePopup } from '../../../../hooks/usePopup'
import { PipedreamAccount, PipedreamApp } from '../../../../services/pipedream-service'
import { ButtonDesigned } from '../../../ui/ButtonDesigned'
import { Confirmation } from '../../../ui/Confirmation'

// =============================================================================
// Sub-components
// =============================================================================

interface AppCardProps {
  app: PipedreamApp
  isConnecting: boolean
  onConnect: () => void
}

const AppCard: React.FC<AppCardProps> = ({ app, isConnecting, onConnect }) => {
  return (
    <div className="flex items-center justify-between p-3 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg border border-neutral-200 flex items-center justify-center overflow-hidden bg-white">
          {app.logoUrl
            ? (
                <img
                  src={app.logoUrl}
                  alt={app.name}
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = squaresIconUrl
                  }}
                />
              )
            : (
                <img src={squaresIconUrl} alt={app.name} className="w-6 h-6" />
              )}
        </div>
        <div>
          <div className="font-medium text-neutral-900 text-[14px]">{app.name}</div>
          {app.description && (
            <div className="text-sm text-neutral-500 line-clamp-1 max-w-[280px]">
              {app.description}
            </div>
          )}
        </div>
      </div>
      <ButtonDesigned
        variant="clear"
        hasBorder
        className="px-4 py-2 shrink-0 text-[14px]"
        disabled={isConnecting}
        onClick={onConnect}
      >
        {isConnecting ? 'Connecting...' : 'Connect'}
      </ButtonDesigned>
    </div>
  )
}

interface ConnectedAccountCardProps {
  account: PipedreamAccount
  isDisconnecting: boolean
  onDisconnect: () => void
}

const ConnectedAccountCard: React.FC<ConnectedAccountCardProps> = ({
  account,
  isDisconnecting,
  onDisconnect,
}) => {
  return (
    <div className="flex items-center justify-between p-3 border border-neutral-200 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg border border-neutral-200 flex items-center justify-center overflow-hidden bg-white">
          {account.app.logoUrl
            ? (
                <img
                  src={account.app.logoUrl}
                  alt={account.app.name}
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = squaresIconUrl
                  }}
                />
              )
            : (
                <img src={squaresIconUrl} alt={account.app.name} className="w-6 h-6" />
              )}
        </div>
        <div>
          <div className="font-medium text-neutral-900 text-[14px]">{account.app.name}</div>
          <div className="text-sm text-neutral-500">
            {account.name}
            {!account.healthy && (
              <span className="ml-2 text-red-600">• Needs reconnection</span>
            )}
          </div>
        </div>
      </div>
      <ButtonDesigned
        variant="clear"
        className="px-3 py-2 text-red-600 hover:bg-red-50 shrink-0"
        disabled={isDisconnecting}
        onClick={onDisconnect}
      >
        {isDisconnecting
          ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            )
          : (
              <Trash2 className="w-4 h-4" />
            )}
      </ButtonDesigned>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

interface PipedreamPanelProps {
  isAuthenticated: boolean
}

export const PipedreamPanel: React.FC<PipedreamPanelProps> = ({ isAuthenticated }) => {
  const { showPopup, hidePopup } = usePopup()

  const {
    accounts,
    accountsLoading,
    accountsError,
    apps,
    appsLoading,
    appsError,
    defaultApps,
    defaultAppsLoading,
    searchQuery,
    connectingApp,
    disconnectingAccountId,
    refreshAccounts,
    connectApp,
    disconnectAccount,
    setSearchQuery,
    clearSearch,
  } = usePipedream()

  const [connectError, setConnectError] = useState<string | null>(null)

  // ===========================================================================
  // Handlers
  // ===========================================================================

  const handleConnect = async (appSlug: string) => {
    setConnectError(null)
    try {
      await connectApp(appSlug)
      // Clear search after initiating connection
      clearSearch()
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect'
      setConnectError(message)
    }
  }

  const handleDisconnect = (account: PipedreamAccount) => {
    showPopup({
      description: `Are you sure you want to disconnect ${account.app.name}? You'll need to reconnect to use this app.`,
      onConfirm: async () => {
        hidePopup()
        try {
          await disconnectAccount(account.id)
        }
        catch (error) {
          console.error('Failed to disconnect:', error)
        }
      },
      onCancel: hidePopup,
    })
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  // Auth gate
  if (!isAuthenticated) {
    return (
      <div className="w-full">
        <Confirmation
          confirmText="Authenticate"
          description="You must be signed in to connect Pipedream apps."
          onConfirm={window.electronAPI.startOAuth}
          relative
          title="Pipedream Integrations"
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Search Section */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Search 3,000+ apps (Slack, Notion, Google Sheets...)"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:border-[#5093B7] focus:ring-1 focus:ring-[#5093B7] text-sm"
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error Display */}
      {(connectError || appsError) && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {connectError || appsError}
        </div>
      )}

      {/* Search Results */}
      {searchQuery && (
        <div>
          <div className="text-sm font-medium mb-2 text-neutral-500">
            {appsLoading
              ? 'Searching...'
              : `${apps.length} app${apps.length !== 1 ? 's' : ''} found`}
          </div>
          <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto">
            {apps.map(app => (
              <AppCard
                key={app.id}
                app={app}
                isConnecting={connectingApp === app.nameSlug}
                onConnect={() => handleConnect(app.nameSlug)}
              />
            ))}
            {!appsLoading && apps.length === 0 && searchQuery && (
              <div className="text-center py-6 text-neutral-500">
                No apps found for "
                {searchQuery}
                "
              </div>
            )}
          </div>
        </div>
      )}

      {/* Default Productivity Apps (when no search query) */}
      {!searchQuery && (
        <div>
          <div className="text-sm font-medium mb-2 text-neutral-500">
            {defaultAppsLoading
              ? 'Loading productivity apps...'
              : 'Popular Apps'}
          </div>
          <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto">
            {defaultApps.map(app => (
              <AppCard
                key={app.id}
                app={app}
                isConnecting={connectingApp === app.nameSlug}
                onConnect={() => handleConnect(app.nameSlug)}
              />
            ))}
            {!defaultAppsLoading && defaultApps.length === 0 && (
              <div className="text-center py-6 text-neutral-500">
                No productivity apps available
              </div>
            )}
          </div>
        </div>
      )}

      {/* Divider */}
      {accounts.length > 0 && (
        <div className="h-px bg-neutral-200" />
      )}

      {/* Connected Accounts Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-neutral-500">
            Connected Accounts (
            {accounts.length}
            )
          </div>
          <button
            onClick={() => refreshAccounts()}
            disabled={accountsLoading}
            className="text-neutral-400 hover:text-neutral-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${accountsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {accountsError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-2">
            {accountsError}
          </div>
        )}

        {accountsLoading && accounts.length === 0
          ? (
              <div className="text-center py-6 text-neutral-500">
                Loading connected accounts...
              </div>
            )
          : accounts.length === 0
            ? (
                <div className="text-center py-6 border border-dashed border-neutral-200 rounded-lg">
                  <div className="text-neutral-500 mb-1 text-sm">No connected accounts yet</div>
                  <div className="text-xs text-neutral-400">
                    Search for an app above to get started
                  </div>
                </div>
              )
            : (
                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                  {accounts.map(account => (
                    <ConnectedAccountCard
                      key={account.id}
                      account={account}
                      isDisconnecting={disconnectingAccountId === account.id}
                      onDisconnect={() => handleDisconnect(account)}
                    />
                  ))}
                </div>
              )}
      </div>

      {/* Info Footer */}
      <div className="text-xs text-neutral-400">
        Powered by
        {' '}
        <button
          className="underline hover:text-neutral-600"
          onClick={() => window.electronAPI.openExternalUrl('https://pipedream.com')}
        >
          Pipedream Connect
        </button>
        . Your credentials are securely managed.
      </div>
    </div>
  )
}

export default PipedreamPanel
