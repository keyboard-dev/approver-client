import {
  AlertCircleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  Loader2Icon,
  PencilIcon,
  RefreshCwIcon,
  Square,
  WifiOffIcon,
} from 'lucide-react'

import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAssistantState,
  useThreadListItem,
} from '@assistant-ui/react'

import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import * as m from 'motion/react-m'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useOrgCoverImage } from '../../hooks/useOrgCoverImage'
import { useSidebarStore } from '../../stores/sidebar-store'

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
import { SmartText } from './smart-text'
import { Reasoning, ReasoningGroup } from './reasoning'
import { SettingsTabType, ThreadLeftSidebar } from './thread-left-sidebar'
import { ThreadSidebar } from './thread-sidebar'
import { ToolFallback } from './tool-fallback'
import { RunCodeToolPart, AbilityCallToolPart } from './tool-parts'
// Settings panels
import { AdvancedPanel } from '../screens/settings/panels/AdvancedPanel'
import { AICreditsPanel } from '../screens/settings/panels/AICreditsPanel'
import { ConnectorsPanel } from '../screens/settings/panels/ConnectorsPanel'
import { TooltipIconButton } from './tooltip-icon-button'

interface ProviderConfig {
  id: string
  name: string
  models: Array<{ id: string, name: string }>
  supportsMCP?: boolean
}

interface OrgProviderData {
  configured: boolean
  provider_type?: string
  display_name?: string
  is_active?: boolean
  allowed_models?: string[] | null
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
  // Org provider
  orgProvider?: OrgProviderData | null
  // Thinking mode
  thinkingEnabled?: boolean
  onThinkingChange?: (enabled: boolean) => void
  // MCP status
  mcpConnected?: boolean
  mcpAbilities?: number
  mcpError?: string | null
  onRetryMCP?: () => void
}

// Maps between SettingsTabType and URL hash fragment
const PANEL_TO_HASH: Partial<Record<SettingsTabType, string>> = {
  Connectors: '#connectors',
  'AI Credits': '#ai-credits',
  Advanced: '#advanced',
}
const HASH_TO_PANEL: Record<string, SettingsTabType> = {
  '#connectors': 'Connectors',
  '#ai-credits': 'AI Credits',
  '#advanced': 'Advanced',
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
  // Org provider
  orgProvider,
  // Thinking mode
  thinkingEnabled,
  onThinkingChange,
  // MCP props
  mcpConnected,
  mcpAbilities,
  mcpError,
  onRetryMCP,
}) => {
  const [selectedScripts, setSelectedScripts] = useState<Script[]>([])
  const {
    leftSidebarOpen,
    setLeftSidebarOpen,
    rightSidebarOpen,
    setRightSidebarOpen,
    leftSidebarWidth,
    setLeftSidebarWidth,
    rightSidebarWidth,
    setRightSidebarWidth,
    setSettingsPanelOpen,
    setActivePanelTitle,
  } = useSidebarStore()
  const navigate = useNavigate()
  const { hash } = useLocation()
  const activeSettingsTab: SettingsTabType | null = HASH_TO_PANEL[hash] ?? null

  // Sync settings panel state + title to store so Layout can reflect current view
  useEffect(() => {
    setSettingsPanelOpen(activeSettingsTab !== null)
    setActivePanelTitle(activeSettingsTab)
  }, [activeSettingsTab, setSettingsPanelOpen, setActivePanelTitle])
  // Get settings panel based on active tab
  const getSettingsPanel = () => {
    switch (activeSettingsTab) {
      case 'AI Credits':
        return <AICreditsPanel />
      case 'Connectors':
        return <ConnectorsPanel />
      case 'Advanced':
        return <AdvancedPanel />
      default:
        return null
    }
  }

  // Whether to show the chat panel (hide when settings is active)
  const showChat = !activeSettingsTab

  const handleSettingsTabClick = (tab: SettingsTabType) => {
    navigate(`/chat${PANEL_TO_HASH[tab] ?? ''}`)
  }

  const handleLeftResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = leftSidebarWidth
    const onMouseMove = (ev: MouseEvent) => {
      setLeftSidebarWidth(Math.min(570, Math.max(280, startWidth + (ev.clientX - startX))))
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [leftSidebarWidth, setLeftSidebarWidth])

  const handleRightResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = rightSidebarWidth
    const onMouseMove = (ev: MouseEvent) => {
      setRightSidebarWidth(Math.min(570, Math.max(280, startWidth - (ev.clientX - startX))))
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [rightSidebarWidth, setRightSidebarWidth])

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <div className="flex h-full w-full gap-0 overflow-hidden">
          {/* Left Sidebar - always rendered; collapsed to icon strip when leftSidebarOpen is false */}
          <div className="h-full pt-[8px] shrink-0">
            <ThreadLeftSidebar
              isOpen={leftSidebarOpen}
              width={leftSidebarWidth}
              activeTab={activeSettingsTab}
              onTabClick={handleSettingsTabClick}
              onChatSelect={() => navigate('/chat')}
            />
          </div>
          {leftSidebarOpen && (
            <div
              className="group relative h-full w-[10px] shrink-0 cursor-col-resize"
              onMouseDown={handleLeftResizeStart}
            >
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-[#d4d4d4] dark:bg-[#3a3a3a] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}

          {/* Settings Panel - Shown when a settings tab is active (takes full remaining width) */}
          {activeSettingsTab && (
            <div className="h-full flex-1 overflow-auto bg-[#f5f5f5] dark:bg-[#1f1f1f] rounded-[20px] border border-[#dbdbdb] dark:border-[#2e2e2e]">
              {getSettingsPanel()}
            </div>
          )}

          {/* Main Chat Panel - Hidden when settings tab is active */}
          {showChat && (
            <ThreadPrimitive.Root
              className="aui-root aui-thread-root @container flex h-full flex-1 flex-col bg-[#f5f5f5] dark:bg-[#1f1f1f] border border-[#dbdbdb] dark:border-[#2e2e2e] rounded-[20px] overflow-hidden"
              style={{
                ['--thread-max-width' as string]: '960px',
              }}
            >
              {/* Header with title */}
              <div className="flex items-center p-[16px] border-b border-[#eaeaea] dark:border-[#2e2e2e]">
                <p className="font-semibold text-[16px] text-[#171717] dark:text-[#f5f5f5]">
                  <ThreadTitle />
                </p>
              </div>

              <ThreadChatArea
                currentApprovalMessage={currentApprovalMessage}
                onApproveMessage={onApproveMessage}
                onRejectMessage={onRejectMessage}
                onClearMessage={onClearMessage}
                mcpConnected={mcpConnected}
                mcpError={mcpError}
                onRetryMCP={onRetryMCP}
                selectedScripts={selectedScripts}
                onScriptSelect={setSelectedScripts}
              />
            </ThreadPrimitive.Root>
          )}

          {/* Right Sidebar - Only show when chat is visible */}
          {showChat && rightSidebarOpen && (
            <>
            <div
              className="group relative h-full w-[8px] shrink-0 cursor-col-resize"
              onMouseDown={handleRightResizeStart}
            >
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-[#d4d4d4] dark:bg-[#3a3a3a] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="h-full py-[8px] shrink-0" style={{ width: rightSidebarWidth }}>
              <ThreadSidebar
                isOpen={rightSidebarOpen}
                onClose={() => setRightSidebarOpen(false)}
                providers={providers}
                availableProviders={availableProviders}
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onProviderChange={onProviderChange}
                onModelChange={onModelChange}
                orgProvider={orgProvider}
                thinkingEnabled={thinkingEnabled}
                onThinkingChange={onThinkingChange}
                mcpConnected={mcpConnected}
                mcpAbilities={mcpAbilities}
                mcpError={mcpError}
                onRetryMCP={onRetryMCP}
              />
            </div>
            </>
          )}

        </div>
      </MotionConfig>
    </LazyMotion>
  )
}

interface ThreadChatAreaProps {
  currentApprovalMessage?: Message
  onApproveMessage?: (message: Message) => void
  onRejectMessage?: (message: Message) => void
  onClearMessage?: () => void
  mcpConnected?: boolean
  mcpError?: string | null
  onRetryMCP?: () => void
  selectedScripts: Script[]
  onScriptSelect: (scripts: Script[]) => void
}

const ThreadChatArea: FC<ThreadChatAreaProps> = ({
  currentApprovalMessage,
  onApproveMessage,
  onRejectMessage,
  onClearMessage,
  mcpConnected,
  mcpError,
  onRetryMCP,
  selectedScripts,
  onScriptSelect,
}) => {
  const isThreadEmpty = useAssistantState(({ thread }) => thread.messages.length === 0 && !thread.isLoading)

  return (
    <div className={cn('flex flex-col flex-1 min-h-0', isThreadEmpty && 'max-h-[677px]')}>
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

        <ThreadPrimitive.If running>
          <div className="w-full max-w-[960px] mx-auto px-[20px] py-[10px]">
            <span className="animate-cursor-blink text-[#171717] dark:text-[#f5f5f5] text-[14px] font-medium select-none">_</span>
          </div>
        </ThreadPrimitive.If>

        <ThreadPrimitive.If empty={false}>
          <div className="aui-thread-viewport-spacer min-h-8 grow" />
        </ThreadPrimitive.If>
      </ThreadPrimitive.Viewport>

      {/* MCP Connection Status Banner */}
      {mcpConnected === false && (
        <div className="w-full max-w-[960px] mx-auto px-5 mb-2">
          <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            {mcpError
              ? <AlertCircleIcon className="size-4 shrink-0 text-amber-600" />
              : <WifiOffIcon className="size-4 shrink-0 text-amber-600" />}
            <span className="flex-1">
              {mcpError
                ? `Connection error: ${mcpError}`
                : 'Connecting to automation server...'}
            </span>
            {mcpError && onRetryMCP
              ? (
                  <button
                    type="button"
                    onClick={onRetryMCP}
                    className="shrink-0 rounded-md bg-amber-200 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-300 transition-colors"
                  >
                    Retry
                  </button>
                )
              : !mcpError && (
                  <Loader2Icon className="size-4 shrink-0 animate-spin text-amber-600" />
                )}
          </div>
        </div>
      )}

      <Composer
        selectedScripts={selectedScripts}
        onScriptSelect={onScriptSelect}
      />
    </div>
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

// Hero background image from design (keyboard with dotted pattern)
import heroBackgroundUrl from '../../../../assets/hero-background.png'

function ThreadTitle() {
  const threadListItem = useThreadListItem({ optional: true })
  return <>{threadListItem?.title ?? 'New chat'}</>
}

const ThreadWelcome: FC = () => {
  const { url: orgCoverUrl } = useOrgCoverImage()
  const backgroundSrc = orgCoverUrl || heroBackgroundUrl

  return (
    <div className="aui-thread-welcome-root flex w-[calc(100%+2rem)] flex-grow flex-col relative -mx-4">
      {/* Background image with gradient overlay */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={backgroundSrc}
          alt=""
          className="absolute w-full h-[156.89%] left-0 top-[-22.95%] object-cover"
        />
        <div className="absolute inset-0 welcome-gradient" />
      </div>

      {/* Centered headline - positioned like Figma design */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[13rem] z-10 w-[90%] max-w-[800px]">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="bg-white/20 backdrop-blur-md border border-white/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] px-5 py-2.5 rounded-full"
        >
          <span
            className="text-center block text-[#171717] dark:text-[#f5f5f5]"
            style={{
              fontFamily: '"Instrument Serif", serif',
              fontSize: '2rem',
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
    <div className="aui-composer-wrapper sticky bottom-0 flex w-full max-w-[960px] mx-auto flex-col gap-2.5 overflow-visible px-5 pb-10">
      <ThreadScrollToBottom />

      <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col rounded-xl border border-[#dbdbdb] dark:border-[#2e2e2e] bg-[#fafafa] dark:bg-[#242424] p-4 min-h-[100px] max-h-[260px] justify-between">
        <ComposerAttachments />
        <ComposerPrimitive.Input
          placeholder="Do anything with AI..."
          className="aui-composer-input w-full resize-none bg-transparent text-sm font-medium text-[#171717] dark:text-[#f5f5f5] outline-none placeholder:text-[#737373] dark:text-[#a9a9a9] dark:placeholder:text-[#a9a9a9] focus:outline-none"
          rows={1}
          autoFocus
          aria-label="Message input"
        />

        {/* Bottom action bar */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2.5">
            <ComposerAddAttachment />
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
                className="aui-composer-send size-6 rounded-full p-1 bg-[#171717] hover:bg-[#171717] text-white dark:bg-[#f5f5f5] dark:hover:bg-[#e5e5e5] dark:text-[#171717] disabled:bg-transparent disabled:text-[#171717] dark:disabled:text-[#f5f5f5] dark:disabled:bg-transparent disabled:cursor-default"
                aria-label="Send message"
              >
                <ArrowUpIcon className="aui-composer-send-icon size-4" />
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
                <Square className="aui-composer-cancel-icon size-3.5 fill-[#171717] dark:fill-[#f5f5f5]" />
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
        className="aui-assistant-message-root w-full max-w-[960px] mx-auto animate-in px-[20px] py-[10px] duration-150 ease-out fade-in slide-in-from-bottom-1 last:mb-24"
        data-role="assistant"
      >
        <div className="flex flex-wrap gap-[6px] items-start w-full">
          <div className="aui-assistant-message-content w-full text-[#171717] dark:text-[#f5f5f5] text-[14px] font-medium leading-normal break-words [&>:not(.aui-tool-fallback-root)]:max-w-[960px]">
            <MessagePrimitive.Parts
              components={{
                Text: SmartText,
                Reasoning,
                ReasoningGroup,
                tools: {
                  by_name: {
                    'run-code': RunCodeToolPart,
                    'web-search': AbilityCallToolPart,
                    'save-keyboard-shortcut-script-template': AbilityCallToolPart,
                    'update-keyboard-shortcut-script-template': AbilityCallToolPart,
                    'poll-background-job': AbilityCallToolPart,
                    'list-background-jobs': AbilityCallToolPart,
                    'search-images': AbilityCallToolPart,
                  },
                  Fallback: ToolFallback,
                },
              }}
            />
            <MessageError />
          </div>
        </div>

        <div className="aui-assistant-message-footer mt-2 flex">
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
        className="aui-user-message-root w-full max-w-[960px] mx-auto animate-in px-[20px] py-[10px] duration-150 ease-out fade-in slide-in-from-bottom-1 first:mt-3"
        data-role="user"
      >
        <div className="flex flex-wrap gap-[10px] items-start justify-end w-full">
          <UserMessageAttachments />
          <div className="aui-user-message-content-wrapper relative min-w-0 max-w-[960px]">
            <div className="aui-user-message-content bg-[#171717] dark:bg-[#f0f0f0] text-white dark:text-[#171717] rounded-[12px] p-[10px] break-words text-[14px] font-medium leading-normal">
              <MessagePrimitive.Parts />
            </div>
            <div className="aui-user-action-bar-wrapper absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2">
              <UserActionBar />
            </div>
          </div>
        </div>
        <BranchPicker className="aui-user-branch-picker flex justify-end mt-2" />
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
        'aui-branch-picker-root mr-2 -ml-2 inline-flex items-center text-xs text-muted-foreground dark:text-[#A9A9A9]',
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
