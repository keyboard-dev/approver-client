import React from 'react'

export const Popup: React.FC<{
  children: React.ReactNode
  onCancel?: () => void
  relative?: boolean
}> = ({
  children,
  onCancel,
  relative,
}) => {
  const containerClasses = relative
    ? 'absolute inset-0 pt-[25%] backdrop-blur-[2px] flex flex-col items-center justify-start z-10'
    : 'fixed top-0 left-0 w-screen h-screen backdrop-blur-[2px] bg-[rgba(0,0,0,0.4)] flex flex-col items-center justify-center z-10'

  return (
    <div
      className={containerClasses}
      onClick={onCancel}
    >
      <div
        className="max-w-[24.63rem] flex flex-col p-[1.25rem] gap-[1.25rem] border border-[#E5E5E5] bg-[#FFF] rounded-[0.38rem]"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
