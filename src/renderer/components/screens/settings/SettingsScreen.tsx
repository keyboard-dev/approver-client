import React, { useState } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs'
import EncryptionKeyManager from '../../EncryptionKeyManager'
import { OAuthProviderManager } from '../../OAuthProviderManager'
import ServerProviderManager from '../../ServerProviderManager'
import WebSocketKeyManager from '../../WebSocketKeyManager'
import { ConnectorPanel } from './panels/ConnectorPanel'
import { KeyPanel } from './panels/KeyPanel'
import { NotificationPanel } from './panels/NotificationPanel'

const oldSettings = false

const TABS = [
  'Connectors',
  'WebSocket',
  'Security',
  'Notifications',
] as const

type TabType = typeof TABS[number]

export const SettingsScreen: React.FC<{
  onBack: () => void
}> = ({
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('Connectors')

  if (oldSettings) {
    return (
      <div className="space-y-6">
        <Tabs defaultValue="websocket" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="websocket">WebSocket</TabsTrigger>
            <TabsTrigger value="encryption">Encryption</TabsTrigger>
            <TabsTrigger value="oauth">OAuth Providers</TabsTrigger>
            <TabsTrigger value="servers">Server Providers</TabsTrigger>
          </TabsList>
          <TabsContent value="websocket" className="mt-6">
            <WebSocketKeyManager />
          </TabsContent>
          <TabsContent value="encryption" className="mt-6">
            <EncryptionKeyManager />
          </TabsContent>
          <TabsContent value="oauth" className="mt-6">
            <OAuthProviderManager />
          </TabsContent>
          <TabsContent value="servers" className="mt-6">
            <ServerProviderManager />
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  const getPanel = () => {
    switch (activeTab) {
      case 'Connectors':
        // return <OAuthProviderManager />
        return <ConnectorPanel />
      case 'WebSocket':
        return (
          <KeyPanel
            confirmationDescription="Submitting this form will generate a new WebSocket key. Be aware that any scripts or applications using this key will need to be updated."
            description="Applications need this key to connect to the approver. Treat it like a password — do not share it. The key is stored securely on your device."
            getKeyInfo={window.electronAPI.getWSKeyInfo}
            onKeyGenerated={window.electronAPI.onWSKeyGenerated}
            onUnmount={() => window.electronAPI.removeAllListeners('ws-key-generated')}
            regenerateKey={window.electronAPI.regenerateWSKey}
            title="WebSocket"
          />
        )
      case 'Security': {
        return (
          <KeyPanel
            confirmationDescription="Are you sure you want to regenerate the encryption key? This will invalidate all previously encrypted data."
            getKeyInfo={window.electronAPI.getEncryptionKeyInfo}
            onKeyGenerated={window.electronAPI.onEncryptionKeyGenerated}
            onUnmount={() => window.electronAPI.removeAllListeners('encryption-key-generated')}
            regenerateKey={async () => {
              const keyInfo = await window.electronAPI.getEncryptionKeyInfo()
              if (keyInfo.source === 'environment') {
                alert('Cannot regenerate encryption key when using environment variable. Please remove the ENCRYPTION_KEY environment variable to use a generated key.')
                return
              }
              return window.electronAPI.regenerateEncryptionKey()
            }}
            title="Security"
          />
        )
      }
      case 'Notifications':
        return <NotificationPanel />
      default:
        return <div>Not implemented</div>
    }
  }

  return (
    <>
      <button
        onClick={onBack}
        className="text-[#737373]"
      >
        &lt;  Back to requests
      </button>

      <div
        className="text-[1.25rem] font-bold ml-[0.88rem]"
      >
        Settings
      </div>

      <div
        className="grow shrink min-w-0 flex w-full p-[0.25rem] gap-[0.38rem]"
      >
        <div
          className="flex flex-col items-start shrink-0"
        >
          {TABS.map(tab => (
            <button
              key={`settings-tabs-${tab}`}
              onClick={() => setActiveTab(tab)}
              className="px-[0.63rem] py-[0.5rem] w-full text-left"
              style={
                activeTab === tab
                  ? {
                      color: '#171717',
                      fontWeight: 600,
                    }
                  : {
                      color: '#737373',
                    }
              }
            >
              {tab}
            </button>
          ))}
        </div>
        <div
          className="grow shrink min-w-0 h-full py-[0.5rem] flex flex-col gap-[0.63rem]"
        >
          {getPanel()}
        </div>
      </div>
    </>
  )
}
