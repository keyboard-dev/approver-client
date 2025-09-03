import React, { useEffect, useState } from 'react'
import greenCheckIconUrl from '../../../../../../assets/icon-check-green.svg'
import copyIconUrl from '../../../../../../assets/icon-copy.svg'
import { maskKey } from '../../../../../lib/utils/display.utils'
import { ButtonDesigned } from '../../../ui/ButtonDesigned'
import { Confirmation } from '../../../ui/Confirmation'

export type KeyInfo = { key: string | null, createdAt: number | null, keyFile?: string, source?: 'environment' | 'generated' | null }

export const KeyPanel: React.FC<{
  confirmationDescription?: string
  description?: string
  getKeyInfo: () => Promise<KeyInfo>
  keyName: string
  onKeyGenerated: (callback: (event: Electron.CrossProcessExports.IpcRendererEvent, data: KeyInfo) => void) => void
  onUnmount: () => void
  regenerateKey: () => Promise<KeyInfo | undefined>
  title: string
}> = ({
  confirmationDescription,
  description,
  getKeyInfo,
  keyName,
  onKeyGenerated,
  onUnmount,
  regenerateKey,
  title,
}) => {
  const [isCopyDebouncing, setIsCopyDebouncing] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isRegeneratingConfirmationOpen, setIsRegeneratingConfirmationOpen] = useState(false)
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null)
  const [showKey, setShowKey] = useState(false)

  const loadKeyInfo = async () => {
    const info = await getKeyInfo()
    setKeyInfo(info)
  }

  useEffect(() => {
    loadKeyInfo()

    const handleKeyGenerated = (_event: unknown, data: KeyInfo) => {
      setKeyInfo(prev => prev
        ? ({
            ...prev,
            ...data,
          })
        : data)
    }

    onKeyGenerated(handleKeyGenerated)

    return onUnmount
  }, [getKeyInfo, onKeyGenerated, onUnmount])

  const handleRegenerateKey = async () => {
    const data = await regenerateKey()
    if (!data) return

    setKeyInfo(prev => prev
      ? ({
          ...prev,
          ...data,
        })
      : data)
  }

  return (
    <div
      className="grow shrink min-w-0 h-full py-[0.5rem] flex flex-col gap-[0.63rem]"
    >
      <div
        className="px-[0.94rem] text-[1.13rem]"
      >
        {title}
      </div>

      <div
        className="p-[0.94rem] flex flex-col gap-[1rem] rounded-[0.38rem] bg-[rgba(80,147,183,0.15)]"
      >
        <div
          className="flex flex-col gap-[0.5rem]"
        >
          <div>
            {keyName}
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
                  // <button
                  //   onClick={() => setShowKey(!showKey)}
                  //   className="p-[0.25rem] border border-[#CCC] rounded-[0.25rem] bg-[#F0F0F0]"
                  // >
                  //   Show
                // </button>
                  <ButtonDesigned
                    className="p-[0.25rem]"
                    variant="secondary"
                    onClick={() => setShowKey(!showKey)}
                    hasBorder
                  >
                    Show
                  </ButtonDesigned>
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

        {description && (
          <div
            className="text-[#737373]"
          >
            {description}
          </div>
        )}

        <ButtonDesigned
          className="self-end px-[0.63rem] py-[0.38rem]"
          disabled={keyInfo?.source === 'environment' || isRegenerating}
          hasBorder
          onClick={() => setIsRegeneratingConfirmationOpen(true)}
          variant="destructive"
        >
          Regenerate key
        </ButtonDesigned>

        {isRegeneratingConfirmationOpen && (
          <Confirmation
            confirmText="Yes, regenerate key"
            description={confirmationDescription}
            disabled={isRegenerating}
            onCancel={() => setIsRegeneratingConfirmationOpen(false)}
            onConfirm={async () => {
              if (isRegenerating) return
              setIsRegenerating(true)
              await handleRegenerateKey()
              setIsRegenerating(false)

              setIsRegeneratingConfirmationOpen(false)
            }}
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
    </div>
  )
}
