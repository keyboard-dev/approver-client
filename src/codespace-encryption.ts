import { publicEncrypt } from 'crypto'

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

    const data: CodespacePublicKeyResponse = await response.json()

    if (!data.success || !data.publicKey) {
      throw new Error('Invalid response: missing public key')
    }

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
    const key = publicKey || await fetchPublicKey(config)

    const encrypted = publicEncrypt(
      {
        key: key,
        padding: 1,
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
