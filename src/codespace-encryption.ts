import { constants, publicEncrypt } from 'crypto'
import { GithubService } from './Github'
import { GitHubCodespacesService } from './github-codespaces'

export interface CodespacePublicKeyResponse {
  success: boolean
  publicKey: string
  algorithm: string
  createdAt: string
  fingerprint: string
}

export interface CodespaceEncryptionConfig {
  codespaceUrl: string
  bearerToken: string
  githubToken: string
}

/**
 * Automatically discover the best codespace URL for encryption
 */
export async function discoverCodespaceUrl(githubToken: string): Promise<string | null> {
  try {
    const githubService = new GithubService()

    // Initialize the GitHub service with the token
    // Note: We assume the GithubService has a way to set the token
    // If not, we'll need to modify this based on the actual GithubService API
    if (typeof (githubService as any).setToken === 'function') {
      (githubService as any).setToken(githubToken)
    }
    else {
      // If there's no setToken method, we'll try to initialize it directly
      await githubService.initializeToken()
    }

    const codespacesService = new GitHubCodespacesService(githubService)
    const bestCodespace = await codespacesService.findBestCodespace()

    if (bestCodespace?.codespace) {
      // Convert WebSocket URL to HTTP URL for REST API calls
      let httpUrl: string

      if (bestCodespace.websocketUrl) {
        // Convert existing WebSocket URL to HTTP
        httpUrl = bestCodespace.websocketUrl
          .replace('wss://', 'https://')
          .replace('ws://', 'http://')
          .replace('-4002.app.github.dev', '.app.github.dev') // Remove port from domain
      }
      else {
        // Generate HTTP URL from codespace web URL
        const match = bestCodespace.codespace.web_url.match(/https:\/\/([^.]+)\.github\.dev/)
        if (match) {
          const codespaceName = match[1]
          httpUrl = `https://${codespaceName}.app.github.dev`
        }
        else {
          throw new Error(`Cannot generate HTTP URL from codespace web_url: ${bestCodespace.codespace.web_url}`)
        }
      }

      console.log(`🔍 Discovered codespace URL: ${httpUrl}`)
      return httpUrl
    }

    console.log('⚠️ No suitable codespace found for encryption')
    return null
  }
  catch (error) {
    console.error('❌ Failed to discover codespace URL:', error)
    return null
  }
}

export async function fetchPublicKey(config: CodespaceEncryptionConfig): Promise<string> {
  try {
    const response = await fetch(`${config.codespaceUrl}/crypto/public-key`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.bearerToken}`,
        'x-github-token': config.githubToken,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch public key: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as CodespacePublicKeyResponse

    if (!data.success || !data.publicKey) {
      throw new Error('Invalid response: missing public key')
    }
    console.log('🔍 Public key: ', data.publicKey)
    return data.publicKey
  }
  catch (error) {
    console.error('Error fetching public key:', error)
    throw new Error(`Failed to fetch public key: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function encryptWithCodespaceKey(
  data: string,
  config: CodespaceEncryptionConfig,
  publicKey?: string,
): Promise<string> {
  try {
    // Auto-discover codespace URL if not provided or if placeholder URL is used
    let finalConfig = config
    if (!config.codespaceUrl
      || config.codespaceUrl === 'https://github.com'
      || config.codespaceUrl === ''
      || config.codespaceUrl === 'auto') {
      console.log('🔍 Auto-discovering codespace URL...')
      const discoveredUrl = await discoverCodespaceUrl(config.githubToken)
      if (discoveredUrl) {
        finalConfig = { ...config, codespaceUrl: discoveredUrl }
        console.log(`✅ Using discovered codespace URL: ${discoveredUrl}`)
      }
      else {
        throw new Error('No suitable codespace found for encryption and no manual URL provided')
      }
    }

    const key = await fetchPublicKey(finalConfig)

    const encrypted = publicEncrypt(
      {
        key: key,
        padding: constants.RSA_PKCS1_OAEP_PADDING, // ← CORRECT: OAEP padding
        oaepHash: 'sha256', // ← REQUIRED: Match server expectation
      },
      Buffer.from(data, 'utf8'),
    )

    return encrypted.toString('base64')
  }
  catch (error) {
    console.error('Error encrypting data:', error)
    throw new Error(`Failed to encrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
