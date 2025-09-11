import React from 'react'
import { Check } from 'lucide-react'

interface McpSetupProps {
  onNext: () => void
}

export const McpSetup: React.FC<McpSetupProps> = ({ onNext }) => {
  return (
    <div className="flex items-start start justify-center min-h-screen w-full p-6 bg-white">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">
            Set up MCP (Model Context Protocol)
          </h1>
          <p className="text-gray-600">
            Configure your development environment for enhanced AI assistance.
          </p>
        </div>

        {/* Features List */}
        <div className="space-y-4">
          <p className="text-gray-700 text-sm">MCP will enable:</p>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700 text-sm">
                Enhanced code understanding and context awareness
              </span>
            </div>
            <div className="flex items-start space-x-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700 text-sm">
                Seamless integration with your development workflow
              </span>
            </div>
            <div className="flex items-start space-x-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700 text-sm">
                Intelligent suggestions and automated assistance
              </span>
            </div>
          </div>
        </div>

        {/* Next Button */}
        <div className="flex justify-center">
          <button
            onClick={onNext}
            className="px-8 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors cursor-pointer"
          >
            Next
          </button>
        </div>

        {/* Footer */}
        <div className="w-full max-w-md text-center">
          <span className="text-gray-400 text-sm font-medium font-inter">Need help? </span>
          <span 
            className="text-gray-900 text-sm font-medium font-inter cursor-pointer hover:underline"
            onClick={() => window.electronAPI.openExternal('https://discord.com/invite/UxsRWtV6M2')}
          >
            Ask in our Discord
          </span>
          <span className="text-gray-400 text-sm font-medium font-inter"> or read the </span>
          <span 
            className="text-gray-900 text-sm font-medium font-inter cursor-pointer hover:underline"
            onClick={() => window.electronAPI.openExternal('https://docs.keyboard.dev')}
          >
            docs
          </span>
          <span className="text-gray-400 text-sm font-medium font-inter">.</span>
        </div>
      </div>
    </div>
  )
}

export default McpSetup