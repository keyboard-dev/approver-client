import React from 'react'

export const Confirmation: React.FC<{
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}> = ({
  title,
  description,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}) => {
  const titleDisplay = title ?? 'Are you sure?'
  const confirmTextDisplay = confirmText ?? 'Confirm'
  const cancelTextDisplay = cancelText ?? 'Cancel'

  return (
    <div
      className="absolute top-0 left-0 w-screen h-screen backdrop-blur-[2px] flex flex-col items-center justify-center z-10"
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
          <button
            className="basis-0 grow text-[#5093B7] bg-[rgba(80,147,183,0.15)] rounded-[0.25rem] px-[0.63rem] py-[0.38rem] text-center"
            onClick={onConfirm}
          >
            {confirmTextDisplay}
          </button>

          <button
            className="basis-0 grow border border-[#CCC] rounded-[0.25rem] px-[0.63rem] py-[0.38rem] text-center"
            onClick={onCancel}
          >
            {cancelTextDisplay}
          </button>
        </div>
      </div>
    </div>
  )
}
