/**
 * Combined App Search Modal
 *
 * Modal for searching and selecting apps/triggers using the unified triggers API
 * that combines both Pipedream and Composio triggers.
 */

import { ArrowLeft, Search, X, Zap } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import {
  type TriggerSource,
  type UnifiedTrigger,
  type UnifiedTriggerApp,
  listUnifiedTriggerApps,
  searchUnifiedTriggers,
} from '../../../../services/unified-triggers-service'
import { Button } from '../../../ui/button'

interface CombinedAppSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTrigger: (trigger: UnifiedTrigger, appName: string) => void
}

type ModalView = 'apps' | 'triggers'

// Source badge component
const SourceBadge: React.FC<{ source: TriggerSource }> = ({ source }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
    source === 'pipedream'
      ? 'bg-orange-100 text-orange-700 border border-orange-200'
      : 'bg-purple-100 text-purple-700 border border-purple-200'
  }`}
  >
    <Zap className="w-3 h-3" />
    {source === 'pipedream' ? 'Pipedream' : 'Composio'}
  </span>
)

export const CombinedAppSearchModal: React.FC<CombinedAppSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectTrigger,
}) => {
  const [view, setView] = useState<ModalView>('apps')
  const [searchQuery, setSearchQuery] = useState('')
  const [apps, setApps] = useState<UnifiedTriggerApp[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Triggers state
  const [selectedAppName, setSelectedAppName] = useState<string>('')
  const [triggers, setTriggers] = useState<UnifiedTrigger[]>([])
  const [triggersLoading, setTriggersLoading] = useState(false)
  const [triggersError, setTriggersError] = useState<string | null>(null)
  const [composioCount, setComposioCount] = useState(0)
  const [pipedreamCount, setPipedreamCount] = useState(0)

  useEffect(() => {
    if (isOpen) {
      loadApps()
      // Reset state when modal opens
      setView('apps')
      setSelectedAppName('')
      setTriggers([])
      setSearchQuery('')
    }
  }, [isOpen])

  const loadApps = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await listUnifiedTriggerApps()
      if (response.success && response.apps) {
        setApps(response.apps)
      }
      else {
        setError(response.error || 'Failed to load apps')
      }
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load apps')
    }
    finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setSelectedAppName(searchQuery.trim())
    setView('triggers')
    await loadTriggers(searchQuery.trim())
  }

  const handleAppClick = async (app: UnifiedTriggerApp) => {
    setSelectedAppName(app.displayName)
    setView('triggers')
    await loadTriggers(app.displayName)
  }

  const loadTriggers = async (appName: string) => {
    setTriggersLoading(true)
    setTriggersError(null)
    setTriggers([])
    setComposioCount(0)
    setPipedreamCount(0)

    try {
      const response = await searchUnifiedTriggers(appName)
      if (response.success && response.triggers) {
        setTriggers(response.triggers)
        if (response.sources) {
          setComposioCount(response.sources.composio?.count || 0)
          setPipedreamCount(response.sources.pipedream?.count || 0)
        }
      }
      else {
        setTriggersError(response.error || 'Failed to load triggers')
      }
    }
    catch (err) {
      setTriggersError(err instanceof Error ? err.message : 'Failed to load triggers')
    }
    finally {
      setTriggersLoading(false)
    }
  }

  const handleBackToApps = () => {
    setView('apps')
    setSelectedAppName('')
    setTriggers([])
    setTriggersError(null)
  }

  const handleTriggerClick = (trigger: UnifiedTrigger) => {
    onSelectTrigger(trigger, selectedAppName)
  }

  const handleClose = () => {
    setView('apps')
    setSelectedAppName('')
    setTriggers([])
    setSearchQuery('')
    onClose()
  }

  if (!isOpen) return null

  // Triggers View
  if (view === 'triggers') {
    const firstTriggerLogo = triggers.length > 0 ? triggers[0].appInfo?.logoUrl : undefined

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToApps}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ArrowLeft className="w-5 h-5 text-[#737373]" />
              </button>
              <div className="flex items-center gap-3">
                {firstTriggerLogo && (
                  <img
                    src={firstTriggerLogo}
                    alt={selectedAppName}
                    className="w-10 h-10 rounded"
                  />
                )}
                <div>
                  <h3 className="text-lg font-semibold">
                    {selectedAppName}
                    {' '}
                    Triggers
                  </h3>
                  <p className="text-sm text-[#737373]">
                    Select a trigger to configure
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-[#737373] hover:text-[#171717]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Platform counts */}
          {!triggersLoading && triggers.length > 0 && (
            <div className="flex gap-3 mb-4">
              {composioCount > 0 && (
                <span className="text-sm text-[#737373]">
                  <span className="font-medium text-purple-700">{composioCount}</span>
                  {' '}
                  from Composio
                </span>
              )}
              {pipedreamCount > 0 && (
                <span className="text-sm text-[#737373]">
                  <span className="font-medium text-orange-700">{pipedreamCount}</span>
                  {' '}
                  from Pipedream
                </span>
              )}
            </div>
          )}

          {/* Error Display */}
          {triggersError && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
              {triggersError}
            </div>
          )}

          {/* Triggers List */}
          <div className="flex-1 overflow-y-auto">
            {triggersLoading
              ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-[#737373]">Loading triggers from both platforms...</div>
                  </div>
                )
              : triggers.length === 0
                ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center text-[#737373]">
                        No triggers available for
                        {' '}
                        {selectedAppName}
                      </div>
                    </div>
                  )
                : (
                    <div className="space-y-3">
                      {triggers.map(trigger => (
                        <button
                          key={`${trigger.source}-${trigger.id}`}
                          onClick={() => handleTriggerClick(trigger)}
                          className="w-full text-left p-4 border border-[#E5E5E5] rounded-lg hover:border-[#171717] hover:shadow-sm transition-all"
                        >
                          <div className="flex items-start gap-3">
                            {trigger.appInfo?.logoUrl && (
                              <img
                                src={trigger.appInfo.logoUrl}
                                alt={trigger.appDisplayName}
                                className="w-8 h-8 rounded flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-[#171717]">
                                    {trigger.name}
                                  </h4>
                                  <SourceBadge source={trigger.source} />
                                </div>
                                <svg
                                  className="w-5 h-5 text-[#737373] flex-shrink-0"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                              {trigger.description && (
                                <p className="text-sm text-[#737373] mb-2 line-clamp-2">{trigger.description}</p>
                              )}
                              <div className="flex gap-2 flex-wrap items-center">
                                <span className="text-xs px-2 py-1 bg-[#F5F5F5] rounded font-mono">
                                  {trigger.id}
                                </span>
                                {Object.keys(trigger.config.properties).length > 0 && (
                                  <span className="text-xs text-[#A3A3A3]">
                                    {Object.keys(trigger.config.properties).length}
                                    {' '}
                                    config options
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-[#E5E5E5]">
            <Button
              variant="outline"
              onClick={handleBackToApps}
              className="w-full"
            >
              Back to Apps
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Apps View (Main search modal)
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Search for App</h3>
            <p className="text-sm text-[#737373]">Find triggers from Composio and Pipedream</p>
          </div>
          <button
            onClick={handleClose}
            className="text-[#737373] hover:text-[#171717]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#737373]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Enter app name (e.g., slack, github, google sheets)"
              className="w-full pl-10 pr-4 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#171717]"
              disabled={loading}
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={loading || !searchQuery.trim()}
          >
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Apps Grid */}
        <div className="flex-1 overflow-y-auto">
          {loading && apps.length === 0
            ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-[#737373]">Loading apps...</div>
                </div>
              )
            : apps.length === 0
              ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center text-[#737373]">
                      Enter a search term to find apps with triggers.
                    </div>
                  </div>
                )
              : (
                  <>
                    <div className="mb-4 text-sm text-[#737373]">
                      {apps.length}
                      {' '}
                      supported app
                      {apps.length !== 1 ? 's' : ''}
                      {' '}
                      with triggers
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {apps.map(app => (
                        <button
                          key={app.displayName}
                          onClick={() => handleAppClick(app)}
                          className="text-left p-4 border border-[#E5E5E5] rounded-lg hover:border-[#171717] hover:shadow-md transition-all"
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-[#171717] mb-1">{app.displayName}</h4>
                            </div>
                          </div>

                          {/* Platform Badges */}
                          <div className="flex gap-2 flex-wrap">
                            {app.composioSlug && (
                              <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                                <Zap className="w-3 h-3" />
                                Composio
                              </span>
                            )}
                            {app.pipedreamSlug && (
                              <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                                <Zap className="w-3 h-3" />
                                Pipedream
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
        </div>
      </div>
    </div>
  )
}

export default CombinedAppSearchModal
