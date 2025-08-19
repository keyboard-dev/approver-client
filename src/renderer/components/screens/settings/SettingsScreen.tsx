import React, { useState } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs'
import EncryptionKeyManager from '../../EncryptionKeyManager'
import { OAuthProviderManager } from '../../OAuthProviderManager'
import ServerProviderManager from '../../ServerProviderManager'
import WebSocketKeyManager from '../../WebSocketKeyManager'
import { ConnectorPanel } from './panels/ConnectorPanel'
import { WebSocketPanel } from './panels/WebsocketPanel'

const oldSettings = false

export const SettingsScreen: React.FC<{
  onBack: () => void
}> = ({
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'Connectors' | 'WebSocket' | 'Security' | 'Notifications'>('Connectors')

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
        return <ConnectorPanel />
      case 'WebSocket':
        return <WebSocketPanel />
      default:
        return null
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
          className="flex flex-col items-start"
        >
          <button
            onClick={() => setActiveTab('Connectors')}
            className="px-[0.63rem] py-[0.5rem]"
            style={
              activeTab === 'Connectors'
                ? {
                    color: '#171717',
                    fontWeight: 600,
                  }
                : {
                    color: '#737373',
                  }
            }
          >
            Connectors
          </button>
          <button
            onClick={() => setActiveTab('WebSocket')}
            className="px-[0.63rem] py-[0.5rem]"
            style={
              activeTab === 'WebSocket'
                ? {
                    color: '#171717',
                    fontWeight: 600,
                  }
                : {
                    color: '#737373',
                  }
            }
          >
            WebSocket
          </button>
          <button
            onClick={() => setActiveTab('Security')}
            className="px-[0.63rem] py-[0.5rem]"
            style={
              activeTab === 'Security'
                ? {
                    color: '#171717',
                    fontWeight: 600,
                  }
                : {
                    color: '#737373',
                  }
            }
          >
            Security
          </button>
          <button
            onClick={() => setActiveTab('Notifications')}
            className="px-[0.63rem] py-[0.5rem]"
            style={
              activeTab === 'Notifications'
                ? {
                    color: '#171717',
                    fontWeight: 600,
                  }
                : {
                    color: '#737373',
                  }
            }
          >
            Notifications
          </button>
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
