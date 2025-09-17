import React from 'react'

interface ProgressIndicatorProps {
  progress: number
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ progress }) => {
  return (
    <div className="flex justify-center space-x-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className={`h-1 w-8 ${progress == index ? 'bg-gray-900' : 'bg-gray-300'} rounded`}
        />
      ))}
    </div>
  )
}
