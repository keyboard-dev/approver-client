import React from 'react'

export const Popup: React.FC<{
  children: React.ReactNode
  onCancel: () => void
}> = ({
  children,
  onCancel,
}) => {
  return (
    <div
      className="absolute top-0 left-0 w-screen h-screen backdrop-blur-[2px] bg-[rgba(0,0,0,0.4)] flex flex-col items-center justify-center z-10"
      onClick={onCancel}
    >
      <div
        className="max-w-[24.63rem] flex flex-col p-[1.25rem] gap-[1.25rem] border border-[#E5E5E5] bg-[#F7F7F7] rounded-[0.38rem]"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
