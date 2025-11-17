import { Check } from 'lucide-react'
import React, { useState } from 'react'
import { ProgressIndicator } from './screens/onboarding/ProgressIndicator'
interface ConnectAppsProps {
  onComplete: () => void
}

export const ConnectApps: React.FC<ConnectAppsProps> = ({ onComplete }) => {
  const [selectedApps, setSelectedApps] = useState<string[]>([])

  const apps = [
    {
      id: 'vscode',
      title: 'Visual Studio Code',
      description: 'Integrate with VS Code for enhanced development experience',
    },
    {
      id: 'slack',
      title: 'Slack',
      description: 'Get notifications and collaborate with your team',
    },
    {
      id: 'notion',
      title: 'Notion',
      description: 'Sync your notes and documentation',
    },
    {
      id: 'linear',
      title: 'Linear',
      description: 'Track issues and project progress',
    },
  ]

  const toggleApp = (appId: string) => {
    setSelectedApps(prev =>
      prev.includes(appId)
        ? prev.filter(id => id !== appId)
        : [...prev, appId],
    )
  }

  const handleComplete = async () => {
    try {
      await window.electronAPI.markOnboardingCompleted()
      onComplete()
    }
    catch (error) {
      console.error('Error completing onboarding:', error)
    }
  }

  return (
    <div className="flex items-start start justify-center min-h-screen w-full p-6 bg-white">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">
            Connect your apps
          </h1>
          <p className="text-gray-600">
            Choose which applications to integrate with Keyboard.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center space-x-2">
          <ProgressIndicator progress={3} />
        </div>

        {/* App Selection */}
        <div className="space-y-3">
          {apps.map(app => (
            <div
              key={app.id}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedApps.includes(app.id)
                  ? 'border-gray-400 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => toggleApp(app.id)}
            >
              <div className="flex items-start space-x-3">
                <div className={`w-4 h-4 rounded border mt-1 flex items-center justify-center ${
                  selectedApps.includes(app.id)
                    ? 'border-gray-600 bg-gray-600'
                    : 'border-gray-300'
                }`}
                >
                  {selectedApps.includes(app.id) && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{app.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{app.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500 mb-4">
            You can always connect more apps later in settings.
          </p>
        </div>

        {/* Complete Button */}
        <div className="flex justify-center">
          <button
            onClick={handleComplete}
            className="px-8 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors cursor-pointer"
          >
            Complete Setup
          </button>
        </div>

        {/* Footer */}
        <div className="w-full max-w-md text-center">
          <span className="text-gray-400 text-sm font-medium font-inter">Need help? </span>
          <span
            className="text-gray-900 text-sm font-medium font-inter cursor-pointer hover:underline"
            onClick={() => window.electronAPI.openExternalUrl('https://discord.com/invite/UxsRWtV6M2')}
          >
            Ask in our Discord
          </span>
          <span className="text-gray-400 text-sm font-medium font-inter"> or read the </span>
          <span
            className="text-gray-900 text-sm font-medium font-inter cursor-pointer hover:underline"
            onClick={() => window.electronAPI.openExternalUrl('https://docs.keyboard.dev')}
          >
            docs
          </span>
          <span className="text-gray-400 text-sm font-medium font-inter">.</span>
        </div>
      </div>
    </div>
  )
}

export default ConnectApps
