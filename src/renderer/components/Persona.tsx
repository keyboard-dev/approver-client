import { Widget } from '@typeform/embed-react'
import React from 'react'
import { Footer } from './Footer'
import { ProgressIndicator } from './ProgressIndicator'
interface PersonaProps {
  onComplete: () => void
}

export const Persona: React.FC<PersonaProps> = ({ onComplete }) => {
  // const [selectedPersona, setSelectedPersona] = useState<string>('')

  const handleComplete = async () => {
    try {
      await window.electronAPI.markOnboardingCompleted()
      onComplete()
    }
    catch (error) {
      console.error('Error completing onboarding:', error)
    }
  }

  // const personas = [
  //   {
  //     id: 'developer',
  //     title: 'Developer',
  //     description: 'I write code, build applications, and work with development tools',
  //   },
  //   {
  //     id: 'designer',
  //     title: 'Designer',
  //     description: 'I create user interfaces, design systems, and visual experiences',
  //   },
  //   {
  //     id: 'product_manager',
  //     title: 'Product Manager',
  //     description: 'I manage products, coordinate teams, and define requirements',
  //   },
  //   {
  //     id: 'other',
  //     title: 'Other',
  //     description: 'I have different needs or use multiple roles',
  //   },
  // ]

  return (
    <div className="flex items-start start justify-center min-h-screen w-full p-6 bg-white">
      <div style={{ height: '70vh', display: 'flex', flexDirection: 'column' }} className="max-w-md w-full space-y-8">
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
        <Widget
          id="qKw2fNDB"
          style={{ width: '100%', height: '90vh' }}
          className="my-form"
          onSubmit={({ responseId }) => {
            console.log('Typeform widget submitted, response ID:', responseId)
            handleComplete()
          // Additional actions after submit
          }}
        />

        {/* Next Button */}
        {/* <div className="flex justify-center">
            <button
              onClick={onNext}
              className="px-8 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors cursor-pointer"
            >
              Next
            </button>
          </div> */}
        <div className="flex justify-end">
          <button
            onClick={handleComplete}
            className="px-8 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors cursor-pointer"
          >
            Skip
          </button>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  )
}

export default Persona
