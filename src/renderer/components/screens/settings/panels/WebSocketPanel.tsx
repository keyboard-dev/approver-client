import React, { useEffect, useState } from 'react'
import copyIconUrl from '../../../../../../assets/icon-copy.svg'
import { maskKey } from '../../../../../lib/utils/display.utils'

export const WebSocketPanel: React.FC = () => {
  const [connectionUrl, setConnectionUrl] = useState<string>('')
  const [keyInfo, setKeyInfo] = useState<{ key: string | null, createdAt: number | null, keyFile: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showKey, setShowKey] = useState(false)

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
    if (
      !confirm('Are you sure you want to regenerate the WebSocket key? This will invalidate all existing connections.')
    ) {
      return
    }

    setIsLoading(true)
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
      setIsLoading(false)
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
          <div className="bg-[#F7F7F7] border border-[#CCC] rounded-[0.25rem] divide-solid divide-[#CCC] flex w-full">
            <div
              className="flex gap-[0.63rem] px-[0.63rem] shrink min-w-0 items-center"
            >
              <div
                className="overflow-ellipsis overflow-hidden font-fira-code text-[#737373] shrink min-w-0"
              >
                {keyInfo?.key
                  ? showKey
                    ? keyInfo?.key
                    : maskKey(keyInfo?.key)
                  : 'No key available'}
              </div>
              <button
                onClick={() => setShowKey(!showKey)}
                className="p-[0.25rem] border border-[#CCC] rounded-[0.25rem] bg-[#F0F0F0]"
              >
                Show
              </button>
            </div>

            {keyInfo?.key && (
              <div
                className="px-[1.5rem] py-[0.38rem] flex items-center justify-center border-l border-[#CCC]"
              >
                <button
                  className="w-[1.5rem] h-[1.5rem] p-[0.13rem]"
                  onClick={() => {
                    navigator.clipboard.writeText(keyInfo?.key || '')
                  }}
                >
                  <img src={copyIconUrl} alt="Copy" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
