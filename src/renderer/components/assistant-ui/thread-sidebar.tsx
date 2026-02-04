import { ChevronDownIcon, PlusIcon } from 'lucide-react'
import type { FC } from 'react'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { ConnectAppsModal } from '../ui/ConnectAppsModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

interface ProviderConfig {
  id: string
  name: string
  models: Array<{ id: string, name: string }>
  supportsMCP?: boolean
}

interface ThreadSidebarProps {
  isOpen: boolean
  onClose?: () => void
  // Provider/Model selection
  providers?: ProviderConfig[]
  availableProviders?: string[]
  selectedProvider?: string
  selectedModel?: string
  onProviderChange?: (providerId: string, defaultModelId?: string) => void
  onModelChange?: (modelId: string) => void
  // MCP status
  mcpConnected?: boolean
  mcpAbilities?: number
  mcpError?: string | null
  onRetryMCP?: () => void
}

export const ThreadSidebar: FC<ThreadSidebarProps> = ({
  isOpen,
  providers = [],
  availableProviders = [],
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  mcpConnected,
  mcpAbilities,
  mcpError,
  onRetryMCP,
}) => {
  const [modelPreferencesOpen, setModelPreferencesOpen] = useState(true)
  const [connectorsOpen, setConnectorsOpen] = useState(true)
  const [connectAppsModalOpen, setConnectAppsModalOpen] = useState(false)

  if (!isOpen) return null

  const currentProvider = providers.find(p => p.id === selectedProvider)
  const currentModelName = currentProvider?.models.find(m => m.id === selectedModel)?.name || 'Select model'

  return (
    <div className="flex flex-col gap-[10px] h-full max-w-[500px] min-w-[300px] overflow-x-clip overflow-y-auto">
      {/* Overview Header */}
      <div className="flex items-center justify-center px-[15px]">
        <p className="flex-1 font-semibold text-[14px] text-[#737373] leading-normal">
          Overview
        </p>
      </div>

      {/* Model Preferences Section */}
      <div className="flex flex-col gap-[10px] px-[15px]">
        <button
          type="button"
          onClick={() => setModelPreferencesOpen(!modelPreferencesOpen)}
          className="flex gap-[10px] items-center justify-center w-full text-left"
        >
          <ChevronDownIcon
            className={cn(
              'size-[24px] text-[#171717] transition-transform duration-200',
              !modelPreferencesOpen && '-rotate-90',
            )}
          />
          <p className="flex-1 font-semibold text-[16px] text-[#171717] leading-normal">
            Model preferences
          </p>
        </button>

        {modelPreferencesOpen && (
          <div className="flex flex-col gap-[10px]">
            {/* Provider Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="bg-[#fafafa] border border-[#dbdbdb] flex h-[44px] items-center justify-between p-[10px] rounded-[12px] w-full hover:bg-[#f5f5f5] transition-colors"
                >
                  <p className="font-medium text-[14px] text-[#737373] leading-normal">
                    {currentProvider?.name || 'Select provider'}
                  </p>
                  <ChevronDownIcon className="size-[24px] text-[#737373]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[270px]">
                {providers
                  .filter(p => availableProviders.includes(p.id))
                  .map(provider => (
                    <DropdownMenuItem
                      key={provider.id}
                      onClick={() => onProviderChange?.(provider.id, provider.models[0]?.id)}
                      className="cursor-pointer"
                    >
                      <span className={cn(
                        'font-medium text-[14px]',
                        provider.id === selectedProvider ? 'text-[#171717]' : 'text-[#737373]',
                      )}
                      >
                        {provider.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Model Dropdown */}
            {currentProvider && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="bg-[#fafafa] border border-[#dbdbdb] flex h-[44px] items-center justify-between p-[10px] rounded-[12px] w-full hover:bg-[#f5f5f5] transition-colors"
                  >
                    <p className="font-medium text-[14px] text-[#737373] leading-normal">
                      {currentModelName}
                    </p>
                    <ChevronDownIcon className="size-[24px] text-[#737373]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[270px]">
                  {currentProvider.models.map(model => (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => onModelChange?.(model.id)}
                      className="cursor-pointer"
                    >
                      <span className={cn(
                        'font-medium text-[14px]',
                        model.id === selectedModel ? 'text-[#171717]' : 'text-[#737373]',
                      )}
                      >
                        {model.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-[1px] bg-[#dbdbdb] w-full" />

      {/* Connectors Section */}
      <div className="flex flex-col gap-[10px] px-[15px]">
        <button
          type="button"
          onClick={() => setConnectorsOpen(!connectorsOpen)}
          className="flex gap-[10px] items-center justify-center w-full text-left"
        >
          <ChevronDownIcon
            className={cn(
              'size-[24px] text-[#171717] transition-transform duration-200',
              !connectorsOpen && '-rotate-90',
            )}
          />
          <p className="flex-1 font-semibold text-[16px] text-[#171717] leading-normal">
            Connectors
          </p>
        </button>

        {connectorsOpen && (
          <>
            <p className="font-medium text-[14px] text-[#737373] leading-normal">
              Apps used in this chat
            </p>

            {/* Connection status box */}
            <div className="bg-[#fafafa] border border-[#dbdbdb] flex flex-col p-[10px] rounded-[12px] w-full">
              {mcpConnected
                ? (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-[14px] text-[#737373] leading-normal">
                          MCP Server
                        </p>
                        <Badge className="text-xs h-5 bg-[#22c55e] text-white border-0 hover:bg-[#22c55e]">
                          Connected
                        </Badge>
                      </div>
                      {mcpAbilities !== undefined && (
                        <p className="font-medium text-[12px] text-[#a5a5a5] leading-normal mt-1">
                          {mcpAbilities}
                          {' '}
                          abilities available
                        </p>
                      )}
                    </>
                  )
                : mcpError
                  ? (
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-[14px] text-[#737373] leading-normal">
                          MCP Server
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onRetryMCP}
                          className="text-xs h-5 px-2"
                        >
                          Retry
                        </Button>
                      </div>
                    )
                  : (
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-[14px] text-[#737373] leading-normal">
                          {mcpConnected === false ? 'None in use' : 'Connecting...'}
                        </p>
                        {mcpConnected !== false && (
                          <Badge variant="secondary" className="text-xs h-5">
                            Connecting...
                          </Badge>
                        )}
                      </div>
                    )}
            </div>

            {/* Connect more apps button */}
            <button
              type="button"
              onClick={() => setConnectAppsModalOpen(true)}
              className="bg-[#fafafa] border border-[#dbdbdb] flex gap-[4px] items-center justify-center px-[20px] py-[4px] rounded-[12px] self-start hover:bg-[#f5f5f5] transition-colors"
            >
              <PlusIcon className="size-[24px] text-[#171717]" />
              <p className="font-medium text-[14px] text-[#171717] leading-normal">
                Connect more apps
              </p>
            </button>

            {/* Connect Apps Modal */}
            <ConnectAppsModal
              isOpen={connectAppsModalOpen}
              onClose={() => setConnectAppsModalOpen(false)}
            />

            {/* Docs link */}
            <div className="flex flex-col gap-[6px] w-full">
              <p className="font-medium text-[14px] text-[#a5a5a5] leading-normal">
                See our
                {' '}
                <span className="font-semibold text-[#171717] cursor-pointer hover:underline">
                  docs
                </span>
                {' '}
                to learn more about how connectors work or how to connect any app.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
