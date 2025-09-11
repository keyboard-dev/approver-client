import React, { useState } from 'react'
import { Check } from 'lucide-react'
import { ProgressIndicator } from './ProgressIndicator'
interface PersonaProps {
  onNext: () => void
}

export const Persona: React.FC<PersonaProps> = ({ onNext }) => {
  const [selectedPersona, setSelectedPersona] = useState<string>('')

  const personas = [
    {
      id: 'developer',
      title: 'Developer',
      description: 'I write code, build applications, and work with development tools'
    },
    {
      id: 'designer',
      title: 'Designer',
      description: 'I create user interfaces, design systems, and visual experiences'
    },
    {
      id: 'product_manager',
      title: 'Product Manager',
      description: 'I manage products, coordinate teams, and define requirements'
    },
    {
      id: 'other',
      title: 'Other',
      description: 'I have different needs or use multiple roles'
    }
  ]

  return (
    <div className="flex items-start start justify-center min-h-screen w-full p-6 bg-white">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">
            What best describes you?
          </h1>
          <p className="text-gray-600">
            This helps us customize your Keyboard experience.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center space-x-2">
          <ProgressIndicator progress={2} />
        </div>

        {/* Persona Selection */}
        <div className="space-y-3">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedPersona === persona.id
                  ? 'border-gray-400 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedPersona(persona.id)}
            >
              <div className="flex items-start space-x-3">
                <div className={`w-4 h-4 rounded-full border-2 mt-1 ${
                  selectedPersona === persona.id
                    ? 'border-gray-600 bg-gray-600'
                    : 'border-gray-300'
                }`}>
                  {selectedPersona === persona.id && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{persona.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{persona.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Next Button */}
        {selectedPersona && (
          <div className="flex justify-center">
            <button
              onClick={onNext}
              className="px-8 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        )}

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

export default Persona