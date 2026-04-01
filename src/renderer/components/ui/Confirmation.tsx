import React from 'react'
import { ButtonDesigned } from './ButtonDesigned'
import { Popup } from './Popup'

export const Confirmation: React.FC<{
  cancelText?: string
  confirmText?: string
  description?: string
  disabled?: boolean
  onCancel?: () => void
  onConfirm?: () => void
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
  const confirmTextDisplay = confirmText ?? 'Confirm'
  const cancelTextDisplay = cancelText ?? 'Cancel'

  return (
    <Popup
      onCancel={onCancel}
      relative={relative}
    >
      {title && (
        <div
          className="text-[1rem] text-[#000] dark:text-[#f5f5f5] font-semibold"
        >
          {title}
        </div>
      )}

      {description && (
        <div
          className="text-[#000] dark:text-[#a9a9a9]"
        >
          {description}
        </div>
      )}

      {(onConfirm || onCancel) && (
        <div
          className="flex gap-[1.25rem]"
        >
          {onConfirm && (
            <ButtonDesigned
              className="basis-0 grow px-[0.63rem] py-[0.38rem] bg-[#FC8E8F] hover:bg-[#ff9e9f] text-[#f5f5f5]"
              variant="primary"
              onClick={onConfirm}
              disabled={disabled}
            >
              {confirmTextDisplay}
            </ButtonDesigned>
          )}

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
      )}
    </Popup>
  )
}
