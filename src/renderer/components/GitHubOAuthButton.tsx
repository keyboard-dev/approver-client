import React, { useState, useEffect, useRef } from 'react'
import { Button } from './ui/button'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { Alert, AlertDescription } from './ui/alert'

interface GitHubOAuthButtonProps {
  className?: string
}

export const GitHubOAuthButton: React.FC<GitHubOAuthButtonProps> = ({ className }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)

  const checkConnectionStatus = async () => {
    try {
      const connected = await window.electronAPI.checkOnboardingGithubToken()
      setIsConnected(connected)
    } catch (error) {
      console.error('Failed to check GitHub connection status:', error)
    }
  }

  useEffect(() => {
    // Check status on mount
    checkConnectionStatus()

    // Set up intersection observer for visibility detection
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          checkConnectionStatus()
        }
      },
      { threshold: 0.1 }
    )

    if (buttonRef.current) {
      observer.observe(buttonRef.current)
    }

    return () => {
      if (buttonRef.current) {
        observer.unobserve(buttonRef.current)
      }
    }
  }, [])

  const handleGitHubOAuth = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // First, ensure we have a server provider configured for localhost:4000
      const servers = await window.electronAPI.getServerProviders()
      let serverId = servers.find(s => s.url === 'https://localhost:4000')?.id

      // If server doesn't exist, add it
      if (!serverId) {
        serverId = `github-server-${Date.now()}`
        await window.electronAPI.addServerProvider({
          id: serverId,
          name: 'GitHub OAuth Server',
          url: 'https://localhost:4000'
        })
      }

      await window.electronAPI.fetchOnboardingGithubProvider()
      // Re-check connection status after OAuth flow
      await checkConnectionStatus()
    } catch (error) {
      console.error('Failed to start GitHub OAuth:', error)
      setError(error instanceof Error ? error.message : 'Failed to start GitHub OAuth')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={className} ref={buttonRef}>
      <Button
        onClick={handleGitHubOAuth}
        disabled={isLoading || isConnected}
        className={isConnected ? "bg-green-600 hover:bg-green-700 text-white" : "bg-gray-900 hover:bg-gray-800 text-white"}
      >
        {isConnected ? (
          <CheckCircle className="w-5 h-5 mr-2" />
        ) : (
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        )}
        {isLoading ? 'Connecting...' : isConnected ? 'GitHub Connected' : 'Connect with GitHub'}
      </Button>

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