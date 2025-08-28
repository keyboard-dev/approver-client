/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react'
import { useAuth } from '../../../../hooks/useAuth'
import { MyConnectors } from './MyConnectors'

const CONNECTOR_TABS = [
  'Shared connectors',
  'My connectors',
] as const

type ConnectorTab = typeof CONNECTOR_TABS[number]

export const ConnectorPanel: React.FC = () => {
  const {
    isAuthenticated,
  } = useAuth()

  const [activeTab, setActiveTab] = useState<ConnectorTab>(CONNECTOR_TABS[0])

  return (
    <>
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
              <div>
                Shared connectors
              </div>
            )
          : (
              <MyConnectors />
            )}

      </div>
    </>
  )
}
