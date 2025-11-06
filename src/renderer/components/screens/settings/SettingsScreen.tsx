import React, { useEffect, useState } from 'react'

import { AdvancedPanel } from './panels/AdvancedPanel'
import { AIProvidersPanel } from './panels/AIProvidersPanel'
import { ConnectorPanel } from './panels/ConnectorPanel'
import { KeyPanel } from './panels/KeyPanel'
import { NotificationPanel } from './panels/NotificationPanel'

const TABS = [
  'WebSocket',
  'Security',
  'AI Providers',
  'Notifications',
  'Connectors',
  'Advanced',
] as const

type TabType = typeof TABS[number]

export const SettingsScreen: React.FC<{
  onBack: () => void
}> = ({
  onBack,
}) => {
  const [tabsWidth, setTabsWidth] = useState<number>(0)

  const [activeTab, setActiveTab] = useState<TabType>(TABS[0])

  useEffect(() => {
    const tempTabs = document.createElement('div')
    tempTabs.className = 'flex flex-col items-start shrink-0'
    tempTabs.style.position = 'absolute'
    tempTabs.style.visibility = 'hidden'
    tempTabs.style.whiteSpace = 'nowrap'
    tempTabs.style.zIndex = '-1000'
    const button = document.createElement('button')
    button.className = 'px-[0.63rem] py-[0.5rem] text-left font-semibold'
    tempTabs.appendChild(button)
    document.body.appendChild(tempTabs)

    const maxWidth = TABS.reduce((max, tab) => {
      button.textContent = tab
      return Math.max(max, tempTabs.offsetWidth)
    }, 0)

    document.body.removeChild(tempTabs)
    setTabsWidth(maxWidth)
  }, [])

  const getPanel = () => {
    switch (activeTab) {
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
      case 'Security': {
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
                alert('Cannot regenerate encryption key when using environment variable. Please remove the ENCRYPTION_KEY environment variable to use a generated key.')
                return
              }
              return window.electronAPI.regenerateEncryptionKey()
            }}
            title="Security"
          />
        )
      }
      case 'AI Providers':
        return <AIProvidersPanel />
      case 'Notifications':
        return <NotificationPanel />
      case 'Connectors':
        return <ConnectorPanel />
      case 'Advanced':
        return <AdvancedPanel />
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
          style={{
            width: tabsWidth,
          }}
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

        {getPanel()}
      </div>
    </>
  )
}
