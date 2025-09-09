/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useState } from 'react'
import greenCheckIconUrl from '../../../../../../assets/icon-check-green.svg'
import copyIconUrl from '../../../../../../assets/icon-copy.svg'
import { OAuthProviderConfig } from '../../../../../provider-storage'
import { ButtonDesigned } from '../../../ui/ButtonDesigned'
import { Popup } from '../../../ui/Popup'
import { Tooltip } from '../../../ui/tooltip'

interface ProviderTemplate {
  name: string
  icon: string
  authorizationUrl: string
  tokenUrl: string
  userInfoUrl?: string
  scopes: string
  usePKCE: boolean
  additionalParams?: Record<string, unknown>
}

interface ManualProviderFormProps {
  onSave: (config: Omit<OAuthProviderConfig, 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
  initialConfig: OAuthProviderConfig | null
  isEditing?: boolean
}

export const AddConnectorPopup: React.FC<ManualProviderFormProps> = ({
  onSave,
  onCancel,
  initialConfig,
}) => {
  const [config, setConfig] = useState({
    id: initialConfig?.id || '',
    name: initialConfig?.name || '',
    icon: initialConfig?.iconSrc || '🔗',
    clientId: initialConfig?.clientId || '',
    clientSecret: initialConfig?.clientSecret || '',
    authorizationUrl: initialConfig?.authorizationUrl || '',
    tokenUrl: initialConfig?.tokenUrl || '',
    userInfoUrl: initialConfig?.userInfoUrl || '',
    scopes: initialConfig?.scopes?.join(', ') || '',
    usePKCE: initialConfig?.usePKCE ?? true,
    redirectUri: initialConfig?.redirectUri || 'http://localhost:8082/callback',
    additionalParams: JSON.stringify(initialConfig?.additionalParams || {}, null, 2),
    isCustom: true,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [isCopyDebouncing, setIsCopyDebouncing] = useState(false)

  const handleSubmit = async () => {
    setIsLoading(true)

    try {
      console.log('===============================================')
      console.log('config', config)
      console.log('===============================================')

      // Validate required fields
      if (!config.id || !config.name || !config.clientId || !config.authorizationUrl || !config.tokenUrl) {
        throw new Error('Please fill in all required fields')
      }

      // Parse additional params
      let additionalParams = {}
      if (config.additionalParams.trim()) {
        try {
          additionalParams = JSON.parse(config.additionalParams)
        }
        catch {
          throw new Error('Invalid JSON in additional parameters')
        }
      }

      // Create provider config
      const providerConfig = {
        id: config.id,
        name: config.name,
        iconSrc: config.icon,
        clientId: config.clientId,
        clientSecret: config.clientSecret || undefined,
        authorizationUrl: config.authorizationUrl,
        tokenUrl: config.tokenUrl,
        userInfoUrl: config.userInfoUrl || undefined,
        scopes: config.scopes.split(',').map(s => s.trim()).filter(s => s),
        usePKCE: config.usePKCE,
        redirectUri: config.redirectUri,
        additionalParams: Object.keys(additionalParams).length > 0 ? additionalParams : undefined,
        isCustom: true,
      }

      await onSave(providerConfig)
    }
    finally {
      setIsLoading(false)
    }
  }

  return (
    <Popup
      onCancel={onCancel}
    >
      <div
        className="flex flex-col gap-[1rem]"
      >
        <div
          className="text-[1rem] text-[#000] font-semibold"
        >
          Add a custom connector
        </div>

        <div
          className="flex flex-col gap-[0.75rem]"
        >
          <div
            className="flex flex-col gap-[0.38rem]"
          >
            <div
              className="text-[#000]"
            >
              Connector name
              {' '}
              <span className="text-[#D23535]">
                *
              </span>
            </div>

            <div
              className="text-[#737373]"
            >
              A name for this connector, e.g., “My Salesforce”.
            </div>

            <input
              className="border border-[#CCC] rounded-[0.38rem] px-[0.63rem] py-[0.38rem]"
              value={config.name}
              onChange={e => setConfig(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div
            className="flex flex-col gap-[0.38rem]"
          >
            <div
              className="text-[#000]"
            >
              Client ID
              {' '}
              <span className="text-[#D23535]">
                *
              </span>
            </div>

            <div
              className="text-[#737373]"
            >
              Provided by the service you’re connecting to.
            </div>

            <input
              className="border border-[#CCC] rounded-[0.38rem] px-[0.63rem] py-[0.38rem]"
              value={config.clientId}
              onChange={e => setConfig(prev => ({ ...prev, clientId: e.target.value }))}
            />
          </div>

          <div
            className="flex flex-col gap-[0.38rem]"
          >
            <div
              className="text-[#000] flex gap-[0.25rem] items-center"
            >
              Client secret (optional for PKCE flows)
              <Tooltip
                position="bottom"
                tooltipText="PKCE (Proof Key for Code Exchange) is a security method that doesn’t require storing a client secret."
                tooltipClassName="w-[15.75rem]"
              />
            </div>

            <div
              className="text-[#737373]"
            >
              Used to authenticate your app with the service.
            </div>

            <input
              className="border border-[#CCC] rounded-[0.38rem] px-[0.63rem] py-[0.38rem]"
              value={config.clientSecret}
              onChange={e => setConfig(prev => ({
                ...prev,
                clientSecret: e.target.value,
                usePKCE: Boolean(e.target.value?.trim()),
              }))}
              placeholder="Leave blank if using PKCE."
            />
          </div>

          <div
            className="flex flex-col gap-[0.38rem]"
          >
            <div
              className="text-[#000]"
            >
              Redirect URI (read-only)
            </div>

            <div
              className="text-[#737373]"
            >
              Add this to your app settings so it can send users back to Keyboard.
            </div>

            <div
              className="bg-[#F7F7F7] border border-[#CCC] rounded-[0.38rem] flex items-center justify-between"
            >
              <div className="text-[#737373] grow shrink min-w-0 basis-0 px-[0.63rem]">
                {config.redirectUri}
              </div>

              <button
                className="relative px-[1.5rem] py-[0.38rem] border-l border-[#CCC] p-[0.13rem]"
                disabled={isCopyDebouncing}
                onClick={async () => {
                  if (isCopyDebouncing) return

                  setIsCopyDebouncing(true)
                  await navigator.clipboard.writeText(config.redirectUri)

                  setTimeout(() => {
                    setIsCopyDebouncing(false)
                  }, 2000)
                }}
              >
                <div
                  className="p-[0.13rem]"
                >
                  <img
                    className="w-[1rem] h-[1rem]"
                    alt={isCopyDebouncing ? 'Copied' : 'Copy'}
                    src={isCopyDebouncing ? greenCheckIconUrl : copyIconUrl}
                  />
                </div>

                {isCopyDebouncing && (
                  <div
                    className="absolute top-full -left-1/4 text-[#FFF] bg-[#171717] border border-[#CCC] rounded-[0.25rem] px-[0.63rem] py-[0.38rem] z-10 pointer-events-none whitespace-nowrap"
                    onClick={e => e.stopPropagation()}
                  >
                    Copied!
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        <div
          className="flex gap-[1.25rem]"
        >
          <ButtonDesigned
            className="grow shrink basis-0"
            variant="primary"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            Connect
          </ButtonDesigned>

          <ButtonDesigned
            className="grow shrink basis-0"
            variant="secondary"
            onClick={onCancel}
          >
            Cancel
          </ButtonDesigned>
        </div>
      </div>
    </Popup>
  )
}
