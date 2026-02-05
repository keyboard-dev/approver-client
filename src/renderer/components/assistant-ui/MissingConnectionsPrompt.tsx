/**
 * MissingConnectionsPrompt Component
 *
 * Displays a prompt when the AI detects that required app connections
 * are missing. Matches the Figma design with app icons, provider badges,
 * and connect buttons.
 */

import { ExternalLink } from 'lucide-react'
import React from 'react'

import squaresIconUrl from '../../../../assets/icon-squares.svg'
import { SourceTag } from '../ui/ConnectorsContent'

export interface MissingConnection {
  id: string
  name: string
  icon: string
  source: 'pipedream' | 'composio' | 'local'
  isConnecting?: boolean
}

export interface MissingConnectionsPromptProps {
  /** Message explaining why connections are needed */
  message?: string
  /** List of missing connections to display */
  missingConnections: MissingConnection[]
  /** Callback when user clicks Connect for a service */
  onConnect: (connection: MissingConnection) => void
  /** Optional className for additional styling */
  className?: string
}

/**
 * Single connection row component
 */
const ConnectionRow: React.FC<{
  connection: MissingConnection
  onConnect: () => void
}> = ({ connection, onConnect }) => {
  return (
    <div className="flex items-center gap-[10px] w-full">
      {/* Left section: Icon + Name */}
      <div className="flex-1 flex items-center gap-[10px]">
        <div className="bg-white border border-[#e5e5e5] rounded-[4px] p-[5px] flex items-center">
          <img
            src={connection.icon}
            alt={connection.name}
            className="w-[22px] h-[22px] object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = squaresIconUrl
            }}
          />
        </div>
        <span className="font-medium text-[14px] text-[#171717]">
          {connection.name}
        </span>
      </div>

      {/* Middle: Source Tag */}
      <SourceTag source={connection.source} />

      {/* Right: Connect Button */}
      <button
        className="flex items-center gap-[4px] px-[12px] py-[4px] bg-white border border-[#e5e5e5] rounded-[4px] text-[14px] font-medium text-[#171717] hover:border-[#ccc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={connection.isConnecting}
        onClick={onConnect}
      >
        <ExternalLink className="w-[13px] h-[13px]" />
        {connection.isConnecting ? 'Connecting...' : 'Connect'}
      </button>
    </div>
  )
}

/**
 * Main MissingConnectionsPrompt component
 */
export const MissingConnectionsPrompt: React.FC<MissingConnectionsPromptProps> = ({
  message = 'To complete your request, I would need to the relevant apps, please connect to the relevant ones below:',
  missingConnections,
  onConnect,
  className = '',
}) => {
  if (missingConnections.length === 0) {
    return null
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Explanation message */}
      <div className="mb-[6px]">
        <p className="text-[14px] font-medium text-[#171717] leading-normal">
          {message}
        </p>
      </div>

      {/* OAuth providers container - matching Figma design */}
      <div className="bg-[#fafafa] border border-[#dbdbdb] rounded-[12px] p-[10px] flex flex-col gap-[10px] overflow-hidden">
        {missingConnections.map(connection => (
          <ConnectionRow
            key={connection.id}
            connection={connection}
            onConnect={() => onConnect(connection)}
          />
        ))}
      </div>
    </div>
  )
}

export default MissingConnectionsPrompt
