import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PencilIcon,
  RefreshCwIcon,
  Square,
} from 'lucide-react'

import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from '@assistant-ui/react'

import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import * as m from 'motion/react-m'
import type { FC } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Message, Script } from '../../../types'
import { cn } from '../../lib/utils'
import { contextService } from '../../services/context-service'
import { ScriptSelector } from '../ScriptSelector'
import { Button } from '../ui/button'
import { ApprovalMessage } from './ApprovalMessage'
import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from './attachment'
import { MarkdownText } from './markdown-text'
import { SettingsTabType, ThreadLeftSidebar } from './thread-left-sidebar'
import { ThreadSidebar } from './thread-sidebar'
import { ToolFallback } from './tool-fallback'
// Settings panels
import { AdvancedPanel } from '../screens/settings/panels/AdvancedPanel'
import { AICreditsPanel } from '../screens/settings/panels/AICreditsPanel'
import { AIProvidersPanel } from '../screens/settings/panels/AIProvidersPanel'
import { ConnectorsPanel } from '../screens/settings/panels/ConnectorsPanel'
import { KeyPanel } from '../screens/settings/panels/KeyPanel'
import { NotificationPanel } from '../screens/settings/panels/NotificationPanel'
import { SecurityPolicyPanel } from '../screens/settings/panels/SecurityPolicyPanel'
import { TriggersPanel } from '../screens/settings/panels/TriggersPanel'
import { TooltipIconButton } from './tooltip-icon-button'

interface ProviderConfig {
  id: string
  name: string
  models: Array<{ id: string, name: string }>
  supportsMCP?: boolean
}

interface ThreadCustomProps {
  currentApprovalMessage?: Message
  onApproveMessage?: (message: Message) => void
  onRejectMessage?: (message: Message) => void
  onClearMessage?: () => void
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

export const Thread: FC<ThreadCustomProps> = ({
  currentApprovalMessage,
  onApproveMessage,
  onRejectMessage,
  onClearMessage,
  // Provider/Model props
  providers = [],
  availableProviders = [],
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  // MCP props
  mcpConnected,
  mcpAbilities,
  mcpError,
  onRetryMCP,
}) => {
  const navigate = useNavigate()
  const [selectedScripts, setSelectedScripts] = useState<Script[]>([])
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabType | null>(null)

  // Get settings panel based on active tab
  const getSettingsPanel = () => {
    if (!activeSettingsTab) return null

    switch (activeSettingsTab) {
      case 'WebSocket':
        return (
          <KeyPanel
            confirmationDescription="Submitting this form will generate a new WebSocket key. Be aware that any scripts or applications using this key will need to be updated."
            description="Applications need this key to connect to the approver. Treat it like a password — do not share it. The key is stored securely on your device."
            getKeyInfo={window.electronAPI.getWSKeyInfo}
            keyName="Connection key"
            onKeyGenerated={window.electronAPI.onWSKeyGenerated}
            onUnmount={() => window.electronAPI.removeAllListeners('ws-key-generated')}
            regenerateKey={window.electronAPI.regenerateWSKey}
            title="WebSocket"
          />
        )
      case 'Security':
        return (
          <KeyPanel
            confirmationDescription="Are you sure you want to regenerate the encryption key? This will invalidate all previously encrypted data."
            description="The encryption key we use to encrypt data that Keyboard will save for you."
            getKeyInfo={window.electronAPI.getEncryptionKeyInfo}
            keyName="Encryption key"
            onKeyGenerated={window.electronAPI.onEncryptionKeyGenerated}
            onUnmount={() => window.electronAPI.removeAllListeners('encryption-key-generated')}
            regenerateKey={async () => {
              const keyInfo = await window.electronAPI.getEncryptionKeyInfo()
              if (keyInfo.source === 'environment') {
                alert('Cannot regenerate encryption key when using environment variable.')
                return
              }
              return window.electronAPI.regenerateEncryptionKey()
            }}
            title="Security"
          />
        )
      case 'Security Policies':
        return <SecurityPolicyPanel />
      case 'AI Providers':
        return <AIProvidersPanel />
      case 'AI Credits':
        return <AICreditsPanel />
      case 'Notifications':
        return <NotificationPanel />
      case 'Connectors':
        return <ConnectorsPanel />
      case 'Triggers':
        return <TriggersPanel />
      case 'Advanced':
        return <AdvancedPanel />
      default:
        return null
    }
  }

  // Whether to show the chat panel (hide when settings is active)
  const showChat = !activeSettingsTab

  const handleSettingsTabClick = (tab: SettingsTabType) => {
    if (activeSettingsTab === tab) {
      // Toggle off if clicking same tab
      setActiveSettingsTab(null)
    } else {
      setActiveSettingsTab(tab)
    }
  }

  const handleBackToChat = () => {
    setActiveSettingsTab(null)
  }

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <div className="flex h-full w-full gap-0 overflow-hidden">
          {/* Left Sidebar - Settings Navigation */}
          {leftSidebarOpen && (
            <div className="h-full shrink-0 border-r border-[#dbdbdb]">
              <ThreadLeftSidebar
                isOpen={leftSidebarOpen}
                activeTab={activeSettingsTab}
                onTabClick={handleSettingsTabClick}
                onChatClick={handleBackToChat}
                onApprovalRequestsClick={() => navigate('/')}
              />
            </div>
          )}

          {/* Settings Panel - Shown when a settings tab is active (takes full remaining width) */}
          {leftSidebarOpen && activeSettingsTab && (
            <div className="h-full flex-1 overflow-auto bg-white">
              {getSettingsPanel()}
            </div>
          )}

          {/* Main Chat Panel - Hidden when settings tab is active */}
          {showChat && (
            <ThreadPrimitive.Root
              className="aui-root aui-thread-root @container flex h-full flex-1 flex-col bg-[#f5f5f5] border border-[#dbdbdb] rounded-[20px] overflow-hidden"
              style={{
                ['--thread-max-width' as string]: '44rem',
              }}
            >
              {/* Header with title and sidebar toggles */}
              <div className="flex items-center justify-between p-[16px] border-b border-[#eaeaea]">
                <div className="flex items-center gap-[10px]">
                  {/* Left sidebar toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setLeftSidebarOpen(!leftSidebarOpen)
                      if (leftSidebarOpen) {
                        setActiveSettingsTab(null)
                      }
                    }}
                    className="flex items-center justify-center p-[2px] hover:bg-[#ebebeb] rounded-md transition-colors"
                    aria-label={leftSidebarOpen ? 'Close settings' : 'Open settings'}
                  >
                    {leftSidebarOpen ? (
                      <PanelLeftCloseIcon className="size-[20px] text-[#171717]" />
                    ) : (
                      <PanelLeftOpenIcon className="size-[20px] text-[#171717]" />
                    )}
                  </button>
                  <p className="font-semibold text-[16px] text-[#171717]">
                    New chat
                  </p>
                </div>
                {/* Right sidebar toggle */}
                <button
                  type="button"
                  onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                  className="flex items-center justify-center p-[2px] hover:bg-[#ebebeb] rounded-md transition-colors"
                  aria-label={rightSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                >
                  {rightSidebarOpen ? (
                    <PanelRightCloseIcon className="size-[20px] text-[#171717]" />
                  ) : (
                    <PanelRightOpenIcon className="size-[20px] text-[#171717]" />
                  )}
                </button>
              </div>

              <ThreadPrimitive.Viewport className="aui-thread-viewport relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 min-h-0">
                <ThreadPrimitive.If empty>
                  <ThreadWelcome />
                </ThreadPrimitive.If>

                <ThreadPrimitive.Messages
                  components={{
                    UserMessage,
                    EditComposer,
                    AssistantMessage,
                  }}
                />

                <ApprovalMessage
                  currentApprovalMessage={currentApprovalMessage}
                  onApproveMessage={onApproveMessage}
                  onRejectMessage={onRejectMessage}
                  onClearMessage={onClearMessage}
                />

                <ThreadPrimitive.If empty={false}>
                  <div className="aui-thread-viewport-spacer min-h-8 grow" />
                </ThreadPrimitive.If>
              </ThreadPrimitive.Viewport>

              <Composer
                selectedScripts={selectedScripts}
                onScriptSelect={setSelectedScripts}
              />
            </ThreadPrimitive.Root>
          )}

          {/* Right Sidebar - Only show when chat is visible */}
          {showChat && rightSidebarOpen && (
            <div className="h-full py-[10px] pl-[10px] shrink-0 min-w-[300px]">
              <ThreadSidebar
                isOpen={rightSidebarOpen}
                onClose={() => setRightSidebarOpen(false)}
                providers={providers}
                availableProviders={availableProviders}
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onProviderChange={onProviderChange}
                onModelChange={onModelChange}
                mcpConnected={mcpConnected}
                mcpAbilities={mcpAbilities}
                mcpError={mcpError}
                onRetryMCP={onRetryMCP}
              />
            </div>
          )}

        </div>
      </MotionConfig>
    </LazyMotion>
  )
}

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  )
}

// Floral background image from design
const floralBackgroundUrl = 'https://www.figma.com/api/mcp/asset/9bad4c51-8496-484a-b2f4-c2ec2d303fe0'

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root flex w-full flex-grow flex-col relative">
      {/* Background image with gradient overlay */}
      <div className="absolute inset-0 overflow-hidden rounded-[20px]">
        <img
          src={floralBackgroundUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#f5f5f5]" style={{ backgroundImage: 'linear-gradient(to bottom, rgba(245,245,245,0) 0%, #f5f5f5 85%)' }} />
      </div>

      {/* Centered headline */}
      <div className="flex w-full flex-grow flex-col items-center justify-center relative z-10 py-16">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="bg-white/10 backdrop-blur-sm px-5 py-2.5 rounded-full"
        >
          <span
            className="text-center"
            style={{
              color: '#171717',
              fontFamily: '"FS Mondwest Regular", sans-serif',
              fontSize: '3.25rem',
              fontStyle: 'normal',
              fontWeight: 400,
              lineHeight: 'normal',
            }}
          >
            What can we automate for you today?
          </span>
        </m.div>
      </div>
    </div>
  )
}

const ThreadSuggestions: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestions grid w-full gap-2 pb-4 @md:grid-cols-2">
      {[
        {
          title: 'What\'s the weather',
          label: 'in San Francisco?',
          action: 'What\'s the weather in San Francisco?',
        },
        {
          title: 'Explain React hooks',
          label: 'like useState and useEffect',
          action: 'Explain React hooks like useState and useEffect',
        },
        {
          title: 'Write a SQL query',
          label: 'to find top customers',
          action: 'Write a SQL query to find top customers',
        },
        {
          title: 'Create a meal plan',
          label: 'for healthy weight loss',
          action: 'Create a meal plan for healthy weight loss',
        },
      ].map((suggestedAction, index) => (
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${suggestedAction.title}-${index}`}
          className="aui-thread-welcome-suggestion-display [&:nth-child(n+3)]:hidden @md:[&:nth-child(n+3)]:block"
        >
          <ThreadPrimitive.Suggestion
            prompt={suggestedAction.action}
            send
            asChild
          >
            <Button
              variant="ghost"
              className="aui-thread-welcome-suggestion h-auto w-full flex-1 flex-wrap items-start justify-start gap-1 rounded-3xl border px-5 py-4 text-left text-sm @md:flex-col dark:hover:bg-accent/60"
              aria-label={suggestedAction.action}
            >
              <span className="aui-thread-welcome-suggestion-text-1 font-medium">
                {suggestedAction.title}
              </span>
              <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground">
                {suggestedAction.label}
              </span>
            </Button>
          </ThreadPrimitive.Suggestion>
        </m.div>
      ))}
    </div>
  )
}

interface ComposerProps {
  selectedScripts?: Script[]
  onScriptSelect?: (scripts: Script[]) => void
}

const Composer: FC<ComposerProps> = ({ selectedScripts = [], onScriptSelect }) => {
  const [showScriptDropdown, setShowScriptDropdown] = useState(false)

  const handleScriptSelect = (scripts: Script[]) => {
    // Update context service directly
    contextService.setSelectedScripts(scripts)

    // Update local state
    if (onScriptSelect) {
      onScriptSelect(scripts)
    }
  }

  return (
    <div className="aui-composer-wrapper sticky bottom-0 mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-2.5 overflow-visible px-5 pb-10">
      <ThreadScrollToBottom />

      {/* Script Selector Dropdown (shown when expanded) */}
      {showScriptDropdown && onScriptSelect && (
        <div className="aui-script-selector-wrapper mb-2">
          <ScriptSelector
            selectedScripts={selectedScripts}
            onScriptSelect={handleScriptSelect}
          />
        </div>
      )}

      <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col rounded-xl border border-[#dbdbdb] bg-[#fafafa] p-4 min-h-[100px] max-h-[260px] justify-between">
        <ComposerAttachments />
        <ComposerPrimitive.Input
          placeholder="Do anything with AI..."
          className="aui-composer-input w-full resize-none bg-transparent text-sm font-medium text-[#171717] outline-none placeholder:text-[#737373] focus:outline-none"
          rows={1}
          autoFocus
          aria-label="Message input"
        />

        {/* Bottom action bar */}
        <div className="flex items-center justify-between mt-4">
          {/* Left side: Flow shortcuts */}
          <div className="flex items-center gap-2.5">
            <ComposerAddAttachment />
            <button
              type="button"
              onClick={() => setShowScriptDropdown(!showScriptDropdown)}
              className="flex items-center gap-0 text-sm font-medium text-[#737373] hover:text-[#171717] transition-colors"
            >
              <span>Flow shortcuts</span>
              <ChevronDownIcon className={cn('size-5 transition-transform', showScriptDropdown && 'rotate-180')} />
            </button>
            {selectedScripts.length > 0 && (
              <span className="text-xs text-[#737373] bg-[#ebebeb] px-2 py-0.5 rounded-full">
                {selectedScripts.length} selected
              </span>
            )}
          </div>

          {/* Right side: Send button */}
          <ThreadPrimitive.If running={false}>
            <ComposerPrimitive.Send asChild>
              <TooltipIconButton
                tooltip="Send message"
                side="top"
                type="submit"
                variant="ghost"
                size="icon"
                className="aui-composer-send size-6 rounded-full p-0 text-[#171717] hover:bg-[#ebebeb]"
                aria-label="Send message"
              >
                <ArrowUpIcon className="aui-composer-send-icon size-5" />
              </TooltipIconButton>
            </ComposerPrimitive.Send>
          </ThreadPrimitive.If>

          <ThreadPrimitive.If running>
            <ComposerPrimitive.Cancel asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="aui-composer-cancel size-6 rounded-full"
                aria-label="Stop generating"
              >
                <Square className="aui-composer-cancel-icon size-3.5 fill-[#171717]" />
              </Button>
            </ComposerPrimitive.Cancel>
          </ThreadPrimitive.If>
        </div>
      </ComposerPrimitive.Root>
    </div>
  )
}

const ComposerAction: FC = () => {
  return (
    <div className="aui-composer-action-wrapper relative mx-1 mt-2 mb-2 flex items-center justify-between">
      <ComposerAddAttachment />

      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send message"
            side="bottom"
            type="submit"
            variant="default"
            size="icon"
            className="aui-composer-send size-[34px] rounded-full p-1"
            aria-label="Send message"
          >
            <ArrowUpIcon className="aui-composer-send-icon size-5" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>

      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-cancel size-[34px] rounded-full border border-muted-foreground/60 hover:bg-primary/75 dark:border-muted-foreground/90"
            aria-label="Stop generating"
          >
            <Square className="aui-composer-cancel-icon size-3.5 fill-white dark:fill-black" />
          </Button>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </div>
  )
}

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/5 dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  )
}

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <div
        className="aui-assistant-message-root relative mx-auto w-full max-w-[var(--thread-max-width)] animate-in py-4 duration-150 ease-out fade-in slide-in-from-bottom-1 last:mb-24"
        data-role="assistant"
      >
        <div className="aui-assistant-message-content mx-2 leading-7 break-words text-foreground">
          <MessagePrimitive.Parts
            components={{
              Text: MarkdownText,
              tools: { Fallback: ToolFallback },
            }}
          />
          <MessageError />
        </div>

        <div className="aui-assistant-message-footer mt-2 ml-2 flex">
          <BranchPicker />
          <AssistantActionBar />
        </div>
      </div>
    </MessagePrimitive.Root>
  )
}

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="aui-assistant-action-bar-root col-start-3 row-start-2 -ml-1 flex gap-1 text-muted-foreground data-floating:absolute data-floating:rounded-md data-floating:border data-floating:bg-background data-floating:p-1 data-floating:shadow-sm"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <MessagePrimitive.If copied>
            <CheckIcon />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  )
}

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <div
        className="aui-user-message-root mx-auto grid w-full max-w-[var(--thread-max-width)] animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 px-2 py-4 duration-150 ease-out fade-in slide-in-from-bottom-1 first:mt-3 last:mb-5 [&:where(>*)]:col-start-2"
        data-role="user"
      >
        <UserMessageAttachments />

        <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
          <div className="aui-user-message-content rounded-3xl bg-muted px-5 py-2.5 break-words text-foreground">
            <MessagePrimitive.Parts />
          </div>
          <div className="aui-user-action-bar-wrapper absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2">
            <UserActionBar />
          </div>
        </div>

        <BranchPicker className="aui-user-branch-picker col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
      </div>
    </MessagePrimitive.Root>
  )
}

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit" className="aui-user-action-edit p-4">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  )
}

const EditComposer: FC = () => {
  return (
    <div className="aui-edit-composer-wrapper mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 px-2 first:mt-4">
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-7/8 flex-col rounded-xl bg-muted">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input flex min-h-[60px] w-full resize-none bg-transparent p-4 text-foreground outline-none"
          autoFocus
        />

        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center justify-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm" aria-label="Cancel edit">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm" aria-label="Update message">
              Update
            </Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </div>
  )
}

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        'aui-branch-picker-root mr-2 -ml-2 inline-flex items-center text-xs text-muted-foreground',
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number />
        {' '}
        /
        <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  )
}
