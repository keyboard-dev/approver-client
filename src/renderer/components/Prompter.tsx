import { IpcRendererEvent } from 'electron'
import { AlertCircle, ArrowLeft, CheckCircle, ChevronDown, ChevronUp, Copy, Eye, Play, RefreshCw, Search, Trash } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import githubLogoIconUrl from '../../../assets/icon-logo-github.svg'
import googleLogoIconUrl from '../../../assets/icon-logo-google.svg'
import microsoftLogoIconUrl from '../../../assets/icon-logo-microsoft.svg'
import xLogoIconUrl from '../../../assets/icon-logo-x-black.svg'
import squaresIconUrl from '../../../assets/icon-squares.svg'
import { Script } from '../../main'
import { ServerProviderInfo } from '../../oauth-providers'
import { ProviderStatus } from '../../preload'
import { OAuthProviderConfig } from '../../provider-storage'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { Checkbox } from './ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'

interface PrompterProps {
  message: unknown
  onBack?: () => void
}

export const Prompter: React.FC<PrompterProps> = ({ onBack }) => {
  const [scripts, setScripts] = useState<Script[]>([])
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [, setIsWaitingForResponse] = useState(false)
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
  const [taskDescription, setTaskDescription] = useState('')
  const [showPromptDialog, setShowPromptDialog] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState('')

  // Provider-related state
  const [providerConfigs, setProviderConfigs] = useState<OAuthProviderConfig[]>([])
  const [providerStatus, setProviderStatus] = useState<Record<string, ProviderStatus>>({})
  const [providerLoading, setProviderLoading] = useState<Record<string, boolean>>({})
  const [providerError, setProviderError] = useState<string | null>(null)

  // Server provider state
  const [servers, setServers] = useState<unknown[]>([])
  const [serverProviders, setServerProviders] = useState<Record<string, ServerProviderInfo[]>>({})

  // Load provider configurations and status
  const loadProviderData = async () => {
    try {
      const [configs, status, serverList] = await Promise.all([
        window.electronAPI.getAllProviderConfigs(),
        window.electronAPI.getProviderAuthStatus(),
        window.electronAPI.getServerProviders(),
      ])

      setProviderConfigs(configs)
      setProviderStatus(status)
      setServers(serverList)

      // Fetch providers for each server
      await Promise.all(serverList.map(server => fetchProvidersForServer(server.id)))
    }
    catch (error) {
      console.error('Error loading provider data:', error)
      setProviderError('Failed to load provider information')
    }
  }

  // Fetch providers for a specific server
  const fetchProvidersForServer = async (serverId: string) => {
    try {
      const providers = await window.electronAPI.fetchServerProviders(serverId)
      setServerProviders(prev => ({
        ...prev,
        [serverId]: providers,
      }))
    }
    catch (error) {
      console.error(`Failed to fetch providers for server ${serverId}:`, error)
      setServerProviders(prev => ({
        ...prev,
        [serverId]: [],
      }))
    }
  }

  // Get provider icon URL
  const getProviderIcon = (providerId: string) => {
    switch (providerId) {
      case 'google':
        return googleLogoIconUrl
      case 'github':
        return githubLogoIconUrl
      case 'microsoft':
        return microsoftLogoIconUrl
      case 'x':
        return xLogoIconUrl
      default:
        return squaresIconUrl
    }
  }

  // Handle provider connect
  const handleProviderConnect = async (providerId: string) => {
    setProviderLoading(prev => ({ ...prev, [providerId]: true }))
    setProviderError(null)

    try {
      await window.electronAPI.startProviderOAuth(providerId)
    }
    catch (error) {
      console.error(`Failed to connect ${providerId}:`, error)
      setProviderError(`Failed to connect to ${providerId}`)
      setProviderLoading(prev => ({ ...prev, [providerId]: false }))
    }
  }

  // Handle provider disconnect
  const handleProviderDisconnect = async (providerId: string) => {
    setProviderLoading(prev => ({ ...prev, [providerId]: true }))

    try {
      await window.electronAPI.logoutProvider(providerId)
      await loadProviderData()
    }
    catch (error) {
      console.error(`Failed to disconnect ${providerId}:`, error)
      setProviderError(`Failed to disconnect from ${providerId}`)
    }
    finally {
      setProviderLoading(prev => ({ ...prev, [providerId]: false }))
    }
  }

  // Handle server provider connect
  const handleServerProviderConnect = async (serverId: string, providerId: string) => {
    const loadingKey = `${serverId}-${providerId}`
    setProviderLoading(prev => ({ ...prev, [loadingKey]: true }))
    setProviderError(null)

    try {
      await window.electronAPI.startServerProviderOAuth(serverId, providerId)
    }
    catch (error) {
      console.error(`Failed to connect ${providerId} via server ${serverId}:`, error)
      setProviderError(`Failed to connect to ${providerId}`)
      setProviderLoading(prev => ({ ...prev, [loadingKey]: false }))
    }
  }

  useEffect(() => {
    const getScripts = async () => {
      try {
        const scripts = await window.electronAPI.getScripts()
        setScripts(scripts)
      }
      catch (error) {
        console.error('Error getting scripts:', error)
        setScripts([])
      }
    }
    getScripts()
    loadProviderData()
  }, [])

  // Listen for prompt responses from WebSocket
  useEffect(() => {
    const handlePromptResponse = (_event: IpcRendererEvent, message: { requestId?: string, prompt?: string }) => {
      // Check if this response matches our request
      if (message.requestId === currentRequestId) {
        setIsWaitingForResponse(false)
        setCurrentRequestId(null)

        // Handle the prompt response
        if (message.prompt) {
          // You can handle the prompt here - maybe show it in a dialog or process it
          // alert(`Received prompt: ${(message as { prompt: string }).prompt}`)
        }
      }
    }

    window.electronAPI.onPromptResponse(handlePromptResponse)

    return () => {
      window.electronAPI.removeAllListeners('prompt-response')
    }
  }, [currentRequestId])

  // Listen for provider auth events
  useEffect(() => {
    const handleProviderAuthSuccess = (_event: unknown, data: unknown) => {
      loadProviderData()
      // Clear loading for both direct and server providers
      setProviderLoading((prev) => {
        const updated = { ...prev }
        updated[(data as { providerId: string }).providerId] = false
        // Clear loading for any server-provider combinations
        Object.keys(updated).forEach((key) => {
          if (key.includes('-') && key.endsWith((data as { providerId: string }).providerId)) {
            updated[key] = false
          }
        })
        return updated
      })
      setProviderError(null)
    }

    const handleProviderAuthError = (_event: unknown, data: unknown) => {
      console.error('Provider auth error:', data)
      setProviderError(`${(data as { providerId: string }).providerId}: ${(data as { message?: string }).message || 'Authentication failed'}`)
      // Clear loading for both direct and server providers
      setProviderLoading((prev) => {
        const updated = { ...prev }
        updated[(data as { providerId: string }).providerId] = false
        // Clear loading for any server-provider combinations
        Object.keys(updated).forEach((key) => {
          if (key.includes('-') && key.endsWith((data as { providerId: string }).providerId)) {
            updated[key] = false
          }
        })
        return updated
      })
    }

    const handleProviderAuthLogout = () => {
      loadProviderData()
    }

    window.electronAPI.onProviderAuthSuccess(handleProviderAuthSuccess)
    window.electronAPI.onProviderAuthError(handleProviderAuthError)
    window.electronAPI.onProviderAuthLogout(handleProviderAuthLogout)

    return () => {
      window.electronAPI.removeAllListeners('provider-auth-success')
      window.electronAPI.removeAllListeners('provider-auth-error')
      window.electronAPI.removeAllListeners('provider-auth-logout')
    }
  }, [])

  const toggleScriptSelection = (scriptId: string) => {
    const newSelection = new Set(selectedScripts)
    if (newSelection.has(scriptId)) {
      newSelection.delete(scriptId)
    }
    else {
      newSelection.add(scriptId)
    }
    setSelectedScripts(newSelection)
  }

  const toggleCardExpansion = (scriptId: string) => {
    const newExpanded = new Set(expandedCards)
    if (newExpanded.has(scriptId)) {
      newExpanded.delete(scriptId)
    }
    else {
      newExpanded.add(scriptId)
    }
    setExpandedCards(newExpanded)
  }

  const filteredScripts = scripts.filter(script =>
    script.name.toLowerCase().includes(searchTerm.toLowerCase())
    || script.description.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const generatePromptText = () => {
    const selected = scripts.filter(script => selectedScripts.has(script.id))
    const scriptNames = selected.map(script => `${script.name} (${script.id})`).join(', ')
    const taskPart = taskDescription.trim() ? ` ${taskDescription}` : ''
    return `Use the keyboard shortcut scripts of ${scriptNames} and the tools of plan followed by run-code to accomplish this task:${taskPart}`
  }

  const copyPromptToClipboard = async () => {
    const promptText = generatePromptText()
    try {
      await navigator.clipboard.writeText(promptText)
      setGeneratedPrompt(promptText)
      setShowPromptDialog(true)
    }
    catch (error) {
      console.error('Failed to copy to clipboard:', error)
      // Still show dialog even if clipboard fails
      setGeneratedPrompt(promptText)
      setShowPromptDialog(true)
    }
  }

  const runSelectedScripts = async () => {
    const selected = scripts.filter(script => selectedScripts.has(script.id)).map((script) => {
      return {
        id: script.id,
        name: script.name,
        description: script.description,
      }
    })

    try {
      setIsWaitingForResponse(true)

      // Send the selected scripts to the WebSocket client and get request ID
      const requestId = await window.electronAPI.sendPromptCollectionRequest({
        scripts: selected,
        prompt: taskDescription,
        images: [],
      })
      setCurrentRequestId(requestId)

      // Don't clear selection yet - wait for response
    }
    catch (error) {
      console.error('Error sending prompt request:', error)
      setIsWaitingForResponse(false)
      alert('Error: ' + (error as Error).message)
    }
  }

  const handleDeleteScript = async (scriptId: string, scriptName: string) => {
    if (confirm(`Are you sure you want to delete the script "${scriptName}"?`)) {
      try {
        await window.electronAPI.deleteScript(scriptId)
        // Refresh the scripts list
        const updatedScripts = await window.electronAPI.getScripts()
        setScripts(updatedScripts)
        // Remove from selected scripts if it was selected
        setSelectedScripts((prev) => {
          const newSet = new Set(prev)
          newSet.delete(scriptId)
          return newSet
        })
        // Remove from expanded cards if it was expanded
        setExpandedCards((prev) => {
          const newSet = new Set(prev)
          newSet.delete(scriptId)
          return newSet
        })
      }
      catch (error) {
        console.error('Error deleting script:', error)
        alert('Failed to delete script: ' + (error as Error).message)
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6">
        {onBack && (
          <div className="mb-4">
            <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Messages
            </Button>
          </div>
        )}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Keyboard Shortcuts</h1>
          <p className="text-muted-foreground">Select the relevant Keyboard shortucts scripts you want to run</p>
        </div>

        {/* Provider Status Section */}
        {(providerConfigs.length > 0 || servers.length > 0) && (
          <Card className="mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Connected Services</CardTitle>
              <CardDescription>Manage your OAuth provider connections</CardDescription>
            </CardHeader>
            <CardContent>
              {providerError && (
                <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{providerError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {providerConfigs.map((provider) => {
                  const status = providerStatus[provider.id]
                  const isAuthenticated = status?.authenticated || false
                  const isExpired = status?.expired || false
                  const isLoading = providerLoading[provider.id] || false
                  const userEmail = status?.user?.email

                  return (
                    <div
                      key={provider.id}
                      className={`relative flex items-center gap-3 p-4 border-2 rounded-lg transition-all ${
                        isAuthenticated && !isExpired
                          ? 'border-green-500/50 bg-green-50/50'
                          : isExpired
                            ? 'border-orange-500/50 bg-orange-50/50'
                            : 'border-gray-200 bg-gray-50/50'
                      }`}
                    >
                      <img
                        src={getProviderIcon(provider.id)}
                        alt={provider.name}
                        className="w-8 h-8"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{provider.name}</div>
                        {userEmail && (
                          <div className="text-xs text-muted-foreground truncate">
                            {userEmail}
                          </div>
                        )}
                        {isExpired && (
                          <div className="text-xs text-orange-600 mt-1">
                            Token expired
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isAuthenticated && !isExpired && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                        {isExpired && (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Expired
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={isAuthenticated && !isExpired ? 'ghost' : isExpired ? 'default' : 'outline'}
                        onClick={() =>
                          isAuthenticated
                            ? handleProviderDisconnect(provider.id)
                            : handleProviderConnect(provider.id)}
                        disabled={isLoading}
                        className={`ml-auto ${isExpired ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                      >
                        {isLoading
                          ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            )
                          : isAuthenticated
                            ? (
                                isExpired
                                  ? (
                                      <>
                                        <RefreshCw className="h-4 w-4 mr-1" />
                                        Reconnect
                                      </>
                                    )
                                  : (
                                      'Disconnect'
                                    )
                              )
                            : (
                                'Connect'
                              )}
                      </Button>
                    </div>
                  )
                })}

                {/* Server Providers */}
                {servers.map((server) => {
                  const serverObj = server as { id: string, name: string }
                  const providers = serverProviders[serverObj.id] || []
                  return providers
                    .filter(provider => provider.configured)
                    .map((provider) => {
                      const status = providerStatus[provider.name]
                      const isAuthenticated = status?.authenticated || false
                      const isExpired = status?.expired || false
                      const loadingKey = `${serverObj.id}-${provider.name}`
                      const isLoading = providerLoading[loadingKey] || false
                      const userEmail = status?.user?.email

                      return (
                        <div
                          key={`${serverObj.id}-${provider.name}`}
                          className={`relative flex items-center gap-3 p-4 border-2 rounded-lg transition-all ${
                            isAuthenticated && !isExpired
                              ? 'border-green-500/50 bg-green-50/50'
                              : isExpired
                                ? 'border-orange-500/50 bg-orange-50/50'
                                : 'border-gray-200 bg-gray-50/50'
                          }`}
                        >
                          <img
                            src={getProviderIcon(provider.name)}
                            alt={provider.name}
                            className="w-8 h-8"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{provider.name}</div>
                            <div className="text-xs text-muted-foreground">
                              via
                              {serverObj.name}
                            </div>
                            {userEmail && (
                              <div className="text-xs text-muted-foreground truncate">
                                {userEmail}
                              </div>
                            )}
                            {isExpired && (
                              <div className="text-xs text-orange-600 mt-1">
                                Token expired
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isAuthenticated && !isExpired && (
                              <Badge variant="secondary" className="bg-green-100 text-green-700">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            )}
                            {isExpired && (
                              <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Expired
                              </Badge>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant={isAuthenticated && !isExpired ? 'ghost' : isExpired ? 'default' : 'outline'}
                            onClick={() =>
                              isAuthenticated
                                ? handleProviderDisconnect(provider.name)
                                : handleServerProviderConnect(serverObj.id, provider.name)}
                            disabled={isLoading}
                            className={`ml-auto ${isExpired ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                          >
                            {isLoading
                              ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                )
                              : isAuthenticated
                                ? (
                                    isExpired
                                      ? (
                                          <>
                                            <RefreshCw className="h-4 w-4 mr-1" />
                                            Reconnect
                                          </>
                                        )
                                      : (
                                          'Disconnect'
                                        )
                                  )
                                : (
                                    'Connect'
                                  )}
                          </Button>
                        </div>
                      )
                    })
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <input
              type="text"
              placeholder="Search scripts..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {selectedScripts.size > 0
            ? (
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <span className="text-sm font-medium">
                    {selectedScripts.size}
                    {' '}
                    script
                    {selectedScripts.size !== 1 ? 's' : ''}
                    {' '}
                    selected
                  </span>
                  <Button
                    onClick={runSelectedScripts}
                    size="sm"
                  >
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Send Prompt Request
                    </>
                  </Button>
                </div>
              )
            : (
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <span className="text-sm font-medium">
                    No scripts selected
                  </span>
                  <Button
                    onClick={runSelectedScripts}
                    size="sm"
                  >
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Skip
                    </>
                  </Button>
                </div>
              )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredScripts.map((script) => {
            const isExpanded = expandedCards.has(script.id)
            const isSelected = selectedScripts.has(script.id)

            return (
              <Card
                key={script.id}
                className={`flex flex-col h-full transition-all duration-200 ${isSelected ? 'ring-2 ring-primary' : ''}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{script.name}</CardTitle>
                      <CardDescription className={`mt-2 ${!isExpanded ? 'line-clamp-2' : ''}`}>
                        {script.description}
                      </CardDescription>
                    </div>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleScriptSelection(script.id)}
                      className="ml-4 mt-1"
                    />
                  </div>
                </CardHeader>

                <CardContent className="flex-grow">
                  {script.tags && script.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {script.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {isExpanded && script.services && script.services.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm font-medium mb-2">Required Services:</p>
                      <div className="flex flex-wrap gap-2">
                        {script.services.map((service, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {service}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex justify-between pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCardExpansion(script.id)}
                  >
                    {isExpanded
                      ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1" />
                            Less
                          </>
                        )
                      : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" />
                            More
                          </>
                        )}
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteScript(script.id, script.name)}
                    >
                      <Trash className="h-4 w-4 mr-1" />
                      Delete
                    </Button>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl bg-white">
                        <DialogHeader>
                          <DialogTitle>{script.name}</DialogTitle>
                          <DialogDescription className="mt-3 whitespace-pre-wrap">
                            {script.description}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 space-y-4">
                          {script.tags && script.tags.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">Tags</h4>
                              <div className="flex flex-wrap gap-2">
                                {script.tags.map((tag, index) => (
                                  <Badge key={index} variant="secondary">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {script.services && script.services.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">Required Services</h4>
                              <div className="flex flex-wrap gap-2">
                                {script.services.map((service, index) => (
                                  <Badge key={index} variant="outline">
                                    {service}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardFooter>
              </Card>
            )
          })}
        </div>
        {filteredScripts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No scripts found matching your search.</p>
          </div>
        )}
      </div>

      {/* Unified bottom section */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={taskDescription}
            onChange={e => setTaskDescription(e.target.value)}
            placeholder="Describe what you want to accomplish..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button
            onClick={copyPromptToClipboard}
            disabled={selectedScripts.size === 0}
          >
            <>
              <Copy className="h-4 w-4 mr-2" />
              Generate Prompt
            </>
          </Button>
        </div>
      </div>

      {/* Prompt Dialog */}
      <Dialog
        open={showPromptDialog}
        onOpenChange={(open) => {
          if (!open) {
            // When closing the dialog, navigate back to messages
            if (onBack) {
              onBack()
            }
          }
          setShowPromptDialog(open)
        }}
      >
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle>Generated Prompt</DialogTitle>
            <DialogDescription>
              Your prompt has been copied to the clipboard. Here's what was generated:
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <pre className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm font-mono">
              {generatedPrompt}
            </pre>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(generatedPrompt)
                }
                catch (error) {
                  console.error('Failed to copy to clipboard:', error)
                }
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Again
            </Button>
            <Button
              onClick={() => {
                setShowPromptDialog(false)
                if (onBack) {
                  onBack()
                }
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
