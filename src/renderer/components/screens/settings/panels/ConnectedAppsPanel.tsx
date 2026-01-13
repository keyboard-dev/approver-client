/**
 * ConnectedAppsPanel (Pipedream Integrations)
 *
 * Settings panel for managing Pipedream connected apps.
 * Users can search 3,000+ apps, connect new accounts, and disconnect existing ones.
 * Shows productivity apps by default when no search query is entered.
 */

import { RefreshCw, Search, Trash2, X } from 'lucide-react'
import React, { useState } from 'react'

import squaresIconUrl from '../../../../../../assets/icon-squares.svg'
import { useAuth } from '../../../../hooks/useAuth'
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
    <div className="flex items-center justify-between p-3 border border-[#E5E5E5] rounded-lg hover:border-[#CCC] transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg border border-[#E5E5E5] flex items-center justify-center overflow-hidden bg-white">
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
          <div className="font-medium text-[#171717]">{app.name}</div>
          {app.description && (
            <div className="text-sm text-[#737373] line-clamp-1 max-w-[300px]">
              {app.description}
            </div>
          )}
        </div>
      </div>
      <ButtonDesigned
        variant="clear"
        hasBorder
        className="px-4 py-2 shrink-0"
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
    <div className="flex items-center justify-between p-3 border border-[#E5E5E5] rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg border border-[#E5E5E5] flex items-center justify-center overflow-hidden bg-white">
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
          <div className="font-medium text-[#171717]">{account.app.name}</div>
          <div className="text-sm text-[#737373]">
            {account.name}
            {!account.healthy && (
              <span className="ml-2 text-[#D23535]">• Needs reconnection</span>
            )}
          </div>
        </div>
      </div>
      <ButtonDesigned
        variant="clear"
        className="px-3 py-2 text-[#D23535] hover:bg-[#FEE] shrink-0"
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

export const ConnectedAppsPanel: React.FC = () => {
  const { isAuthenticated, isSkippingAuth } = useAuth()
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

  // ==========================================================================
  // Handlers
  // ==========================================================================

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
        }
      },
      onCancel: hidePopup,
    })
  }

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="relative grow shrink min-w-0 h-full py-2 flex flex-col gap-4 overflow-auto">
      {/* Auth Gate */}
      {(!isAuthenticated || isSkippingAuth) && (
        <Confirmation
          confirmText="Authenticate"
          description="You must be signed in to connect apps."
          onConfirm={window.electronAPI.startOAuth}
          relative
          title="Pipedream Integrations"
        />
      )}

      {/* Header */}
      <div className="px-4">
        <div className="text-lg font-medium">Pipedream Integrations</div>
        <div className="text-[#737373] text-sm">
          Connect your accounts to let Keyboard access external services on your behalf.
          {' '}
          <button
            className="underline"
            onClick={() => window.electronAPI.openExternalUrl('https://docs.keyboard.dev/')}
          >
            Learn more
          </button>
        </div>
      </div>

      {/* Search Section */}
      <div className="px-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
          <input
            type="text"
            placeholder="Search 3,000+ apps (Slack, Notion, Google Sheets...)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#5093B7] focus:ring-1 focus:ring-[#5093B7] text-sm"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#171717]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {(connectError || appsError) && (
        <div className="px-4">
          <div className="p-3 bg-[#FEE] border border-[#D23535] rounded-lg text-[#D23535] text-sm">
            {connectError || appsError}
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchQuery && (
        <div className="px-4">
          <div className="text-sm font-medium mb-2 text-[#737373]">
            {appsLoading
              ? 'Searching...'
              : `${apps.length} app${apps.length !== 1 ? 's' : ''} found`}
          </div>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
            {apps.map(app => (
              <AppCard
                key={app.id}
                app={app}
                isConnecting={connectingApp === app.nameSlug}
                onConnect={() => handleConnect(app.nameSlug)}
              />
            ))}
            {!appsLoading && apps.length === 0 && searchQuery && (
              <div className="text-center py-6 text-[#737373]">
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
        <div className="px-4">
          <div className="text-sm font-medium mb-2 text-[#737373]">
            {defaultAppsLoading
              ? 'Loading productivity apps...'
              : 'Productivity Apps'}
          </div>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
            {defaultApps.map(app => (
              <AppCard
                key={app.id}
                app={app}
                isConnecting={connectingApp === app.nameSlug}
                onConnect={() => handleConnect(app.nameSlug)}
              />
            ))}
            {!defaultAppsLoading && defaultApps.length === 0 && (
              <div className="text-center py-6 text-[#737373]">
                No productivity apps available
              </div>
            )}
          </div>
        </div>
      )}

      {/* Divider */}
      {accounts.length > 0 && (
        <div className="px-4">
          <div className="h-px bg-[#E5E5E5]" />
        </div>
      )}

      {/* Connected Accounts Section */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-[#737373]">
            Connected Accounts (
            {accounts.length}
            )
          </div>
          <button
            onClick={() => refreshAccounts()}
            disabled={accountsLoading}
            className="text-[#737373] hover:text-[#171717] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${accountsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {accountsError && (
          <div className="p-3 bg-[#FEE] border border-[#D23535] rounded-lg text-[#D23535] text-sm mb-2">
            {accountsError}
          </div>
        )}

        {accountsLoading && accounts.length === 0
          ? (
              <div className="text-center py-8 text-[#737373]">
                Loading connected accounts...
              </div>
            )
          : accounts.length === 0
            ? (
                <div className="text-center py-8 border border-dashed border-[#E5E5E5] rounded-lg">
                  <div className="text-[#737373] mb-2">No connected accounts yet</div>
                  <div className="text-sm text-[#A3A3A3]">
                    Search for an app above to get started
                  </div>
                </div>
              )
            : (
                <div className="flex flex-col gap-2">
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
      <div className="px-4 mt-auto pt-4">
        <div className="text-xs text-[#A3A3A3]">
          Powered by
          {' '}
          <button
            className="underline"
            onClick={() => window.electronAPI.openExternalUrl('https://pipedream.com')}
          >
            Pipedream Connect
          </button>
          . Your credentials are securely managed and never stored locally.
        </div>
      </div>
    </div>
  )
}

export default ConnectedAppsPanel
