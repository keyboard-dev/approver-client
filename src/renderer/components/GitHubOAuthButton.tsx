import { AlertCircle, CheckCircle, LogOut } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils'
import { Alert, AlertDescription } from './ui/alert'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

interface GitHubOAuthButtonProps {
  className?: string
  isConnected?: boolean
  buttonClassName?: string
}

export const GitHubOAuthButton: React.FC<GitHubOAuthButtonProps> = ({ className, isConnected: isConnectedProp, buttonClassName }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)

  const checkConnectionStatus = async () => {
    try {
      const connected = await window.electronAPI.checkOnboardingGithubToken()
      setIsConnected(connected)
    }
    catch (error) {
    }
  }

  useEffect(() => {
    // If prop is provided, use it
    if (isConnectedProp !== undefined) {
      setIsConnected(isConnectedProp)
    }
    else {
      // Otherwise check status on mount
      checkConnectionStatus()

      // Set up intersection observer for visibility detection
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            checkConnectionStatus()
          }
        },
        { threshold: 0.1 },
      )

      if (buttonRef.current) {
        observer.observe(buttonRef.current)
      }

      return () => {
        if (buttonRef.current) {
          observer.unobserve(buttonRef.current)
        }
      }
    }
  }, [isConnectedProp])

  const handleGitHubOAuth = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await window.electronAPI.fetchOnboardingGithubProvider()
      // Re-check connection status after OAuth flow
      await checkConnectionStatus()
    }
    catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start GitHub OAuth')
    }
    finally {
      setIsLoading(false)
    }
  }

  const handleClearConnection = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Clear the GitHub token
      await window.electronAPI.clearOnboardingGithubToken()
      // Re-check connection status
      await checkConnectionStatus()
    }
    catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to clear GitHub connection')
    }
    finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={className} ref={buttonRef}>
      {isConnected
        ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={isLoading}
                  className={cn(
                    'bg-green-600 hover:bg-green-700 text-white ',
                    buttonClassName,
                  )}
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  {isLoading ? 'Processing...' : 'GitHub Connected'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleClearConnection}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Clear GitHub Connection
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleGitHubOAuth}
                    disabled={isLoading}
                    className={cn(
                      'bg-gray-900 hover:bg-gray-800 text-white',
                      buttonClassName,
                    )}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    {isLoading ? 'Connecting...' : 'Connect with GitHub'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[50vw] text-sm">
                  <p>This allows Keyboard to start and stop codespaces on public repositories. We will create a fork of the codespace-executor and app-creator repositories.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

      {error && (
        <Alert className="mt-4 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default GitHubOAuthButton
