/**
 * Pipedream Panel Component
 *
 * UI for managing Pipedream OAuth connections and integrated services.
 * Allows users to connect to 1000+ services through Pipedream.
 */

import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Alert } from './ui/alert'
import type { PipedreamAccount } from '../../pipedream-client'

interface PipedreamPanelProps {
  onConnect: () => void
  onDisconnect: (accountId: string) => void
  onCreateConnection: (app: string) => void
  onRefreshAccounts: () => void
  accounts: PipedreamAccount[]
  isConfigured: boolean
  isLoading: boolean
  error?: string
}

// Popular services that users might want to connect
const POPULAR_SERVICES = [
  { id: 'google_drive', name: 'Google Drive', icon: '📁' },
  { id: 'github', name: 'GitHub', icon: '🐙' },
  { id: 'notion', name: 'Notion', icon: '📝' },
  { id: 'slack', name: 'Slack', icon: '💬' },
  { id: 'google_sheets', name: 'Google Sheets', icon: '📊' },
  { id: 'dropbox', name: 'Dropbox', icon: '📦' },
  { id: 'trello', name: 'Trello', icon: '📋' },
  { id: 'asana', name: 'Asana', icon: '✓' },
  { id: 'airtable', name: 'Airtable', icon: '🗂️' },
  { id: 'google_calendar', name: 'Google Calendar', icon: '📅' },
]

export function PipedreamPanel({
  onConnect,
  onDisconnect,
  onCreateConnection,
  onRefreshAccounts,
  accounts,
  isConfigured,
  isLoading,
  error,
}: PipedreamPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedService, setSelectedService] = useState<string | null>(null)

  // Filter services based on search query
  const filteredServices = POPULAR_SERVICES.filter(service =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Check if a service is already connected
  const isServiceConnected = (serviceId: string): boolean => {
    return accounts.some(account => account.app === serviceId)
  }

  // Get account for a service
  const getServiceAccount = (serviceId: string): PipedreamAccount | undefined => {
    return accounts.find(account => account.app === serviceId)
  }

  // Handle service connection
  const handleServiceClick = (serviceId: string) => {
    const isConnected = isServiceConnected(serviceId)

    if (isConnected) {
      setSelectedService(serviceId)
    } else {
      onCreateConnection(serviceId)
    }
  }

  return (
    <div className="pipedream-panel p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Pipedream Connections</h2>
          <p className="text-sm text-gray-500">
            Connect to 1000+ services through Pipedream
          </p>
        </div>
        {isConfigured && (
          <Button
            onClick={onRefreshAccounts}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <span className="font-medium">Error:</span> {error}
        </Alert>
      )}

      {/* Configuration Status */}
      {!isConfigured ? (
        <Card className="p-6 text-center space-y-4">
          <div className="text-4xl">🔌</div>
          <div>
            <h3 className="font-semibold mb-2">Connect Pipedream</h3>
            <p className="text-sm text-gray-500 mb-4">
              Authenticate with Pipedream to start connecting services
            </p>
            <Button onClick={onConnect} disabled={isLoading}>
              {isLoading ? 'Connecting...' : 'Connect Pipedream'}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Connected Accounts Summary */}
          {accounts.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 font-semibold">
                    {accounts.length}
                  </span>
                  <span className="text-sm text-blue-700">
                    service{accounts.length !== 1 ? 's' : ''} connected
                  </span>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  Active
                </Badge>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Popular Services Grid */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Popular Services
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {filteredServices.map((service) => {
                const isConnected = isServiceConnected(service.id)
                const account = getServiceAccount(service.id)

                return (
                  <Card
                    key={service.id}
                    className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                      isConnected
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => handleServiceClick(service.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="text-2xl">{service.icon}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">
                            {service.name}
                          </h4>
                          {isConnected && (
                            <Badge
                              variant="secondary"
                              className="mt-1 bg-green-100 text-green-700 text-xs"
                            >
                              Connected
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            {filteredServices.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No services found matching "{searchQuery}"</p>
              </div>
            )}
          </div>

          {/* Connected Accounts List */}
          {accounts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Connected Accounts
              </h3>
              <div className="space-y-2">
                {accounts.map((account) => (
                  <Card key={account.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            account.healthy !== false
                              ? 'bg-green-500'
                              : 'bg-red-500'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm">
                            {account.app.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </h4>
                          <p className="text-xs text-gray-500">
                            Connected {new Date(account.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDisconnect(account.id)
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Disconnect
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Custom Service Connection */}
          <Card className="p-4 bg-gray-50">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                Don't see your service?
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const customApp = prompt('Enter the service ID (e.g., salesforce, hubspot):')
                  if (customApp) {
                    onCreateConnection(customApp)
                  }
                }}
              >
                Connect Custom Service
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
