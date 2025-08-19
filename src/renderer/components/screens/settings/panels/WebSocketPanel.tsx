import React, { useEffect, useState } from 'react'
import greenCheckIconUrl from '../../../../../../assets/icon-check-green.svg'
import copyIconUrl from '../../../../../../assets/icon-copy.svg'
import { maskKey } from '../../../../../lib/utils/display.utils'
import { Confirmation } from '../../../ui/Confirmation'

export const WebSocketPanel: React.FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [connectionUrl, setConnectionUrl] = useState<string>('')
  const [keyInfo, setKeyInfo] = useState<{ key: string | null, createdAt: number | null, keyFile: string } | null>(null)

  const [isRegenerating, setIsRegenerating] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [isCopyDebouncing, setIsCopyDebouncing] = useState(false)
  const [isRegeneratingConfirmationOpen, setIsRegeneratingConfirmationOpen] = useState(false)

  const loadConnectionUrl = async () => {
    const url = await window.electronAPI.getWSConnectionUrl()
    setConnectionUrl(url)
  }

  const loadKeyInfo = async () => {
    const info = await window.electronAPI.getWSKeyInfo()
    setKeyInfo(info)
    loadConnectionUrl()
  }

  useEffect(() => {
    loadKeyInfo()

    const handleKeyGenerated = (_event: unknown, data: { key: string, createdAt: number }) => {
      setKeyInfo(prev => prev
        ? ({
            ...prev,
            ...data,
          })
        : ({
            keyFile: '',
            ...data,
          }))
      loadConnectionUrl()
    }

    window.electronAPI.onWSKeyGenerated(handleKeyGenerated)

    return () => {
      window.electronAPI.removeAllListeners('ws-key-generated')
    }
  }, [])

  const handleRegenerateKey = async () => {
    if (isRegenerating) return

    setIsRegenerating(true)
    try {
      const data = await window.electronAPI.regenerateWSKey()
      setKeyInfo(prev => prev
        ? ({
            ...prev,
            ...data,
          })
        : ({
            keyFile: '',
            ...data,
          }))
      loadConnectionUrl()
    }
    finally {
      setIsRegenerating(false)
    }
  }

  return (
    <>
      <div
        className="px-[0.94rem] text-[1.13rem]"
      >
        WebSocket
      </div>

      <div
        className="p-[0.94rem] flex flex-col gap-[1rem] rounded-[0.38rem] bg-[rgba(80,147,183,0.15)]"
      >
        <div
          className="flex flex-col gap-[0.5rem]"
        >
          <div>
            Connection key
          </div>

          <div className="bg-[#F7F7F7] border border-[#CCC] rounded-[0.25rem] flex">
            <div
              className="flex gap-[0.63rem] px-[0.63rem] shrink grow min-w-0 items-center"
            >
              <div
                className="overflow-ellipsis overflow-hidden font-fira-code text-[#737373] shrink grow min-w-0"
              >
                {keyInfo?.key
                  ? showKey
                    ? keyInfo?.key
                    : maskKey(keyInfo?.key)
                  : 'No key available'}
              </div>

              {keyInfo?.key
                && (
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="p-[0.25rem] border border-[#CCC] rounded-[0.25rem] bg-[#F0F0F0]"
                  >
                    Show
                  </button>
                )}
            </div>

            {keyInfo?.key && (
              <div
                className="px-[1.5rem] py-[0.38rem] flex items-center justify-center border-l border-[#CCC] relative"
              >
                <button
                  className="w-[1.5rem] h-[1.5rem] p-[0.13rem]"
                  disabled={isCopyDebouncing}
                  onClick={async () => {
                    if (isCopyDebouncing) return

                    setIsCopyDebouncing(true)
                    await navigator.clipboard.writeText(keyInfo?.key || '')

                    setTimeout(() => {
                      setIsCopyDebouncing(false)
                    }, 2000)
                  }}
                >
                  <img src={isCopyDebouncing ? greenCheckIconUrl : copyIconUrl} alt={isCopyDebouncing ? 'Copied' : 'Copy'} />
                </button>

                {isCopyDebouncing && (
                  <div
                    className="absolute top-[2.5rem] -left-1/4 text-[#FFF] bg-[#171717] border border-[#CCC] rounded-[0.25rem] px-[0.63rem] py-[0.38rem] z-10 pointer-events-none whitespace-nowrap"
                  >
                    Copied!
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          className="text-[#737373]"
        >
          Applications need this key to connect to the approver. Treat it like a password — do not share it. The key is stored securely on your device.
        </div>

        <button
          className="self-end px-[0.63rem] py-[0.38rem] border border-[#CCC] rounded-[0.25rem] bg-[#F7F7F7] text-[#D23535]"
          onClick={() => setIsRegeneratingConfirmationOpen(true)}
          disabled={isRegenerating}
        >
          Regenerate key
        </button>

        {isRegeneratingConfirmationOpen && (
          <Confirmation
            confirmText="Yes, regenerate key"
            description="Submitting this form will generate a new WebSocket key. Be aware that any scripts or applications using this key will need to be updated."
            onCancel={() => setIsRegeneratingConfirmationOpen(false)}
            onConfirm={handleRegenerateKey}
          />
        )}
      </div>

      {keyInfo?.createdAt && (
        <>
          <div>
            Created:
            {' '}
            <span
              className="italic"
            >
              {new Date(keyInfo.createdAt).toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </span>
          </div>

          <div>
            Regenerates automatically:
            {' '}
            <span
              className="italic"
            >
              {new Date(keyInfo.createdAt + (30 * 24 * 60 * 60 * 1000)).toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </span>
          </div>
        </>
      )}
    </>
  )
}
