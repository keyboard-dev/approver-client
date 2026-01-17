import React from 'react'

interface ProgressIndicatorProps {
  progress: number
  totalSteps?: number
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  totalSteps = 3,
}) => {
  return (
    <div className="flex justify-center gap-[6px]">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          className={`h-[3px] w-[20px] ${progress === index ? 'bg-black' : 'bg-[rgba(0,0,0,0.25)]'}`}
        />
      ))}
    </div>
  )
}
