import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { BotIcon, HomeIcon, ListTodoIcon, SettingsIcon, WorkflowIcon } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Message } from '../../../types'
import { useAuth } from '../../hooks/useAuth'
import { useWebSocketConnection } from '../../hooks/useWebSocketConnection'
import { useDatabase } from '../../providers/DatabaseProvider'
import { databaseService } from '../../services/database-service'
import { resolvePendingCall } from '../../services/pending-tool-calls'
import { AssistantUIChatContent } from '../AssistantUIChatContent'
import AuthComponent from '../AuthComponent'
import { AdvancedPanel } from './settings/panels/AdvancedPanel'
import { AICreditsPanel } from './settings/panels/AICreditsPanel'
import { AIProvidersPanel } from './settings/panels/AIProvidersPanel'
import { ConnectorsPanel } from './settings/panels/ConnectorsPanel'
import { KeyPanel } from './settings/panels/KeyPanel'
import { NotificationPanel } from './settings/panels/NotificationPanel'
import { SecurityPolicyPanel } from './settings/panels/SecurityPolicyPanel'
import { TriggersPanel } from './settings/panels/TriggersPanel'

/**
 * Navigation tabs for the home screen
 */
const TABS = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'agentic-chat', label: 'Agentic chat', icon: BotIcon },
  { id: 'flow-shortcuts', label: 'Flow shortcuts', icon: WorkflowIcon },
  { id: 'task-approvals', label: 'Task approvals', icon: ListTodoIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
] as const

type TabId = typeof TABS[number]['id']

/**
 * Settings sub-tabs (shown when Settings is selected)
 */
const SETTINGS_TABS = [
  'WebSocket',
  'Security',
  'Security Policies',
  'AI Providers',
  'AI Credits',
  'Notifications',
  'Connectors',
  'Triggers',
  'Advanced',
] as const

type SettingsTabType = typeof SETTINGS_TABS[number]

export const HomeScreen: React.FC = () => {
  const navigate = useNavigate()
  const { tab, messageId } = useParams<{ tab?: string, messageId?: string }>()
  const { updateMessage } = useDatabase()
  const { authStatus, isSkippingAuth } = useAuth()
  const { connectionStatus } = useWebSocketConnection(authStatus, isSkippingAuth)

  // Initialize activeTab from URL params
  const initialTab = (tab && TABS.some(t => t.id === tab)) ? (tab as TabId) : 'agentic-chat'
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabType>('WebSocket')

  // Approval message state (for agentic chat)
  const [approvalMessage, setApprovalMessage] = useState<Message | null>(null)
  const [isLoading, setIsLoading] = useState(!!messageId)

  // Fetch approval message if messageId is provided
  useEffect(() => {
    const fetchApprovalMessage = async () => {
      if (!messageId) {
        setIsLoading(false)
        return
      }

      try {
        const fetchedMessage = await databaseService.getMessage(messageId)
        if (fetchedMessage) {
          const supportedMessageTypes = ['Security Evaluation Request', 'code response approval']
          if (supportedMessageTypes.includes(fetchedMessage.title)) {
            setApprovalMessage(fetchedMessage)
          }
        }
      }
      catch (err) {
      }
      finally {
        setIsLoading(false)
      }
    }

    fetchApprovalMessage()
  }, [messageId])

  // Listen for chat approval events
  useEffect(() => {
    const handleChatApprovalMessage = (event: CustomEvent<Message>) => {
      const message = event.detail
      if (authStatus.authenticated || isSkippingAuth) {
        setApprovalMessage(message)
      }
    }

    window.addEventListener('chat-approval-message', handleChatApprovalMessage as EventListener)
    return () => {
      window.removeEventListener('chat-approval-message', handleChatApprovalMessage as EventListener)
    }
  }, [authStatus.authenticated, isSkippingAuth])

  // Approve message handler
  const handleApprove = async (message: Message) => {
    try {
      await updateMessage(message.id, { status: 'approved' })
      const updatedMessage = await databaseService.getMessage(message.id)
      if (!updatedMessage) throw new Error('Failed to fetch updated message')

      await window.electronAPI.sendMessageResponse(updatedMessage)

      if (message.title === 'code response approval' && message.codespaceResponse) {
        const responseData = message.codespaceResponse.data || message.codespaceResponse
        let resultText = ''
        if (responseData.stdout) resultText += `Output:\n${responseData.stdout}\n`
        if (responseData.stderr) resultText += `Errors:\n${responseData.stderr}\n`
        if (!resultText) resultText = JSON.stringify(responseData, null, 2)

        const toolResult: CallToolResult = {
          content: [{ type: 'text', text: resultText }],
        }
        resolvePendingCall('run-code', toolResult)
      }

      setApprovalMessage(null)
    }
    catch (error) {
    }
  }

  // Reject message handler
  const handleReject = async (message: Message) => {
    try {
      await updateMessage(message.id, { status: 'rejected' })
      const updatedMessage = await databaseService.getMessage(message.id)
      if (!updatedMessage) throw new Error('Failed to fetch updated message')

      await window.electronAPI.sendMessageResponse(updatedMessage)
      setApprovalMessage(null)
    }
    catch (error) {
    }
  }

  // Get settings panel based on active settings tab
  const getSettingsPanel = () => {
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
        return <div>Not implemented</div>
    }
  }

  // Get main content panel based on active tab
  const getPanel = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <h1 className="text-2xl font-semibold text-[#171717] mb-4">Welcome to Keyboard</h1>
            <p className="text-[#737373] text-center max-w-md">
              Your AI-powered automation assistant. Select "Agentic chat" to start automating tasks.
            </p>
          </div>
        )
      case 'agentic-chat':
        return (
          <AssistantUIChatContent
            currentApprovalMessage={approvalMessage || undefined}
            onApproveMessage={handleApprove}
            onRejectMessage={handleReject}
            onClearApprovalMessage={() => setApprovalMessage(null)}
          />
        )
      case 'flow-shortcuts':
        return (
          <div className="flex-1 flex flex-col p-8">
            <h2 className="text-xl font-semibold text-[#171717] mb-4">Flow Shortcuts</h2>
            <p className="text-[#737373]">Manage and run your saved automation scripts.</p>
            {/* TODO: Add flow shortcuts list/management */}
          </div>
        )
      case 'task-approvals':
        return (
          <div className="flex-1 flex flex-col p-8">
            <h2 className="text-xl font-semibold text-[#171717] mb-4">Task Approvals</h2>
            <p className="text-[#737373]">Review and approve pending automation tasks.</p>
            {/* TODO: Add task approvals list */}
          </div>
        )
      case 'settings':
        return (
          <div className="flex-1 flex min-h-0">
            {/* Settings sub-navigation */}
            <div className="flex flex-col items-start shrink-0 border-r border-[#dbdbdb] pr-4">
              {SETTINGS_TABS.map(settingsTab => (
                <button
                  key={settingsTab}
                  onClick={() => setActiveSettingsTab(settingsTab)}
                  className="px-[0.63rem] py-[0.5rem] w-full text-left text-[14px]"
                  style={
                    activeSettingsTab === settingsTab
                      ? { color: '#171717', fontWeight: 600 }
                      : { color: '#737373' }
                  }
                >
                  {settingsTab}
                </button>
              ))}
            </div>
            {/* Settings panel content */}
            <div className="flex-1 min-h-0 overflow-auto">
              {getSettingsPanel()}
            </div>
          </div>
        )
      default:
        return <div>Not implemented</div>
    }
  }

  // Gate on authentication - show login screen if not authenticated
  if (!authStatus.authenticated && !isSkippingAuth) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <AuthComponent />
      </div>
    )
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left Sidebar Navigation */}
      <div className="flex flex-col h-full w-[215px] shrink-0 py-2">
        {TABS.map((tabItem) => {
          const Icon = tabItem.icon
          return (
            <button
              key={tabItem.id}
              onClick={() => setActiveTab(tabItem.id)}
              className={`flex gap-[10px] items-center px-[16px] py-[8px] w-full text-left transition-colors rounded-lg mx-1 ${
                activeTab === tabItem.id
                  ? 'bg-[#e5e5e5]'
                  : 'hover:bg-[#ebebeb]'
              }`}
            >
              <Icon className="size-[24px] text-[#171717]" />
              <span
                className="font-medium text-[14px] leading-normal"
                style={{
                  color: activeTab === tabItem.id ? '#171717' : '#737373',
                  fontWeight: activeTab === tabItem.id ? 600 : 500,
                }}
              >
                {tabItem.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {getPanel()}
      </div>
    </div>
  )
}
