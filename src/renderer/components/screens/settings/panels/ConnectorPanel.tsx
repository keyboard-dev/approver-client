import React, { useState } from 'react'

import { useAuth } from '../../../../hooks/useAuth'
import { Confirmation } from '../../../ui/Confirmation'
import { MyConnectors } from './MyConnectors'
import SharedConnectors from './SharedConnectors'

const CONNECTOR_TABS = [
  'Shared connectors',
  'My connectors',
] as const

type ConnectorTab = typeof CONNECTOR_TABS[number]

export const ConnectorPanel: React.FC = () => {
  const {
    isAuthenticated,
  } = useAuth()

  console.log('connector panel')
  console.log('isAuthenticated', isAuthenticated)

  const [activeTab, setActiveTab] = useState<ConnectorTab>(CONNECTOR_TABS[0])

  return (
    <div
      className="relative grow shrink min-w-0 h-full py-[0.5rem] flex flex-col gap-[0.63rem]"
    >
      {!isAuthenticated && (
        <Confirmation
          confirmText="Authenticate"
          description="You need to be authenticated to use connectors."
          onConfirm={window.electronAPI.startOAuth}
          relative
          title="Authentication Required"
        />
      )}

      <div
        className="px-[0.94rem]"
      >
        <div
          className="text-[1.13rem]"
        >
          Connectors
        </div>
        <div
          className="text-[#737373]"
        >
          Allow Keyboard to reference other apps and services for more context.
          {' '}
          <button
            className="underline"
            // too add link
            onClick={() => window.electronAPI.openExternalUrl('https://docs.keyboard.dev/')}
          >
            Learn more
          </button>
        </div>
      </div>

      <div className="flex gap-[0.31rem]">
        {CONNECTOR_TABS.map(tab => (
          <button
            key={`settings-connector-panel-tab-${tab}`}
            className="p-[0.63rem] border-b-[1.5px] border-transparent"
            style={{
              borderColor: activeTab === tab ? '#171717' : 'transparent',
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div
        className="w-full p-[0.94rem] flex flex-col gap-[0.63rem] border border-[#E5E5E5] rounded-[0.38rem]"
      >
        {activeTab === 'Shared connectors'
          ? (
              <SharedConnectors />
            )
          : (
              <MyConnectors />
            )}

      </div>
    </div>
  )
}
