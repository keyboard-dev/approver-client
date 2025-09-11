import React from 'react'
import { Download } from 'lucide-react'
import { ProgressIndicator } from './ProgressIndicator'
interface McpSetupProps {
  onNext: () => void
  onSkip?: () => void
}

export const McpSetup: React.FC<McpSetupProps> = ({ onNext, onSkip }) => {
  const handleDownload = () => {
    window.electronAPI.openExternal('https://github.com/keyboard-dev/keyboard-mcp/releases/latest')
  }

  return (
    <div className="flex items-start justify-center min-h-screen w-full p-6 bg-white">
      <div className="max-w-md w-full space-y-6 bg-white rounded-lg p-8 shadow-sm">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-gray-900">
            Set up your MCP client
          </h1>
          <p className="text-gray-600 text-sm">
            Make sure you've downloaded our most up-to-date .dxt file.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center space-x-2">
          <ProgressIndicator progress={1} />
        </div>

        {/* Instructions */}
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <span className="text-gray-900 font-medium">1. Download the </span>
              <span className="text-blue-600 font-medium">keyboard-mcp.dxt</span>
              <span className="text-gray-900 font-medium"> file</span>
            </div>
            
            <div className="flex justify-center">
              <button
                onClick={handleDownload}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-medium transition-colors cursor-pointer border border-blue-200"
              >
                <Download className="h-4 w-4" />
                <span>Download file</span>
              </button>
            </div>
          </div>

          <div>
            <span className="text-gray-900 font-medium">2. Install the file as an extension in your MCP client</span>
            <br />
            <span className="text-gray-600 text-sm">(Claude, ChatGPT, etc)</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-4">
          <button
            onClick={onNext}
            className="px-6 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-md text-sm font-medium transition-colors cursor-pointer"
          >
            Next
          </button>
        </div>

        {/* Footer */}
        <div className="text-center pt-4 border-t border-gray-100">
          <span className="text-gray-400 text-sm">Need help? </span>
          <span 
            className="text-gray-900 text-sm cursor-pointer hover:underline"
            onClick={() => window.electronAPI.openExternal('https://discord.com/invite/UxsRWtV6M2')}
          >
            Contact us
          </span>
          <span className="text-gray-400 text-sm"> or read the </span>
          <span 
            className="text-gray-900 text-sm cursor-pointer hover:underline"
            onClick={() => window.electronAPI.openExternal('https://docs.keyboard.dev')}
          >
            docs
          </span>
        </div>
      </div>
    </div>
  )
}

export default McpSetup