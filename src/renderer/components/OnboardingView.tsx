import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Alert, AlertDescription } from './ui/alert'
import { Info } from 'lucide-react'
import GitHubOAuthButton from './GitHubOAuthButton'

interface OnboardingViewProps {
  onComplete?: () => void
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold mb-2">Welcome to Keyboard Approver</CardTitle>
          <p className="text-gray-600">Connect your GitHub account to get started</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <p className="font-semibold mb-2">Why do we need GitHub access?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>To start and stop codespaces on public repositories</li>
                <li>To create forks of the codespace-executor and app-creator repositories</li>
                <li>To enable secure code execution in isolated environments</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="text-center space-y-4">
            <p className="text-gray-700">
              Keyboard uses GitHub Codespaces to execute code in secure, isolated environments. 
              This ensures your local machine remains protected while still allowing you to approve 
              and manage code execution requests.
            </p>

            <GitHubOAuthButton className="flex justify-center" />
          </div>

          <div className="text-center text-sm text-gray-500 mt-6">
            <p>By connecting, you agree to our security practices and GitHub's terms of service.</p>
            <p className="mt-1">Your GitHub credentials are securely managed and never stored on our servers.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default OnboardingView