import React from 'react'
import { ButtonDesigned } from './ButtonDesigned'

export const Confirmation: React.FC<{
  cancelText?: string
  confirmText?: string
  description?: string
  disabled?: boolean
  onCancel: () => void
  onConfirm: () => void
  title?: string
}> = ({
  cancelText,
  confirmText,
  description,
  disabled,
  onCancel,
  onConfirm,
  title,
}) => {
  const titleDisplay = title ?? 'Are you sure?'
  const confirmTextDisplay = confirmText ?? 'Confirm'
  const cancelTextDisplay = cancelText ?? 'Cancel'

  return (
    <div
      className="absolute top-0 left-0 w-screen h-screen backdrop-blur-[2px] bg-[rgba(0,0,0,0.4)] flex flex-col items-center justify-center z-10"
    >
      <div
        className="max-w-[24.63rem] flex flex-col p-[1.25rem] gap-[1.25rem] border border-[#E5E5E5] bg-[#F7F7F7] rounded-[0.38rem]"
      >
        <div
          className="text-[1rem] text-[#000] font-semibold"
        >
          {titleDisplay}
        </div>

        <div
          className="text-[#000]"
        >
          {description}
        </div>

        <div
          className="flex gap-[1.25rem]"
        >
          {/* <button
            className="basis-0 grow text-[#5093B7] bg-[#E4EBEF] hover:bg-[#D5E0E6] active:bg-[#C5D4DD] rounded-[0.25rem] px-[0.63rem] py-[0.38rem] text-center"
            onClick={onConfirm}
            disabled={disabled}
          >
            {confirmTextDisplay}
          </button> */}
          <ButtonDesigned
            className="basis-0 grow px-[0.63rem] py-[0.38rem]"
            variant="primary"
            onClick={onConfirm}
            disabled={disabled}
          >
            {confirmTextDisplay}
          </ButtonDesigned>

          {/* <button
            className="basis-0 grow border border-[#CCC] bg-[#F3F3F3] hover:bg-[#E6E6E6] active:bg-[#D9D9D9] rounded-[0.25rem] px-[0.63rem] py-[0.38rem] text-center"
            onClick={onCancel}
          >
            {cancelTextDisplay}
          </button> */}
          <ButtonDesigned
            className="basis-0 grow px-[0.63rem] py-[0.38rem]"
            variant="secondary"
            onClick={onCancel}
            hasBorder
          >
            {cancelTextDisplay}
          </ButtonDesigned>
        </div>
      </div>
    </div>
  )
}
