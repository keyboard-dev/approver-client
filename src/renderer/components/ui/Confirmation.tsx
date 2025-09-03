import React from 'react'
import { ButtonDesigned } from './ButtonDesigned'
import { Popup } from './Popup'

export const Confirmation: React.FC<{
  cancelText?: string
  confirmText?: string
  description?: string
  disabled?: boolean
  onCancel?: () => void
  onConfirm: () => void
  relative?: boolean
  title?: string
}> = ({
  cancelText,
  confirmText,
  description,
  disabled,
  onCancel,
  onConfirm,
  relative,
  title,
}) => {
  const titleDisplay = title ?? 'Are you sure?'
  const confirmTextDisplay = confirmText ?? 'Confirm'
  const cancelTextDisplay = cancelText ?? 'Cancel'

  return (
    <Popup
      onCancel={onCancel}
      relative={relative}
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
        <ButtonDesigned
          className="basis-0 grow px-[0.63rem] py-[0.38rem]"
          variant="primary"
          onClick={onConfirm}
          disabled={disabled}
        >
          {confirmTextDisplay}
        </ButtonDesigned>

        {onCancel
          && (
            <ButtonDesigned
              className="basis-0 grow px-[0.63rem] py-[0.38rem]"
              variant="secondary"
              onClick={onCancel}
              hasBorder
            >
              {cancelTextDisplay}
            </ButtonDesigned>
          )}
      </div>
    </Popup>
  )
}
