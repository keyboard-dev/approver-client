import { Octokit } from '@octokit/rest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as https from 'https'
import { createWriteStream } from 'fs'

interface GitHubToken {
  access_token: string
  token_type?: string
  scope?: string
}

export class GithubService {
  private octokit: Octokit | null = null
  private readonly TOKEN_FILE_PATH = path.join(os.homedir(), '.keyboard-mcp-onboarding-gh-token')

  constructor() {
    this.initializeOctokit()
  }

  private initializeOctokit(): void {
    try {
      const token = this.readToken()
      if (token) {
        this.octokit = new Octokit({
          auth: token.access_token,
        })
      }
    } catch (error) {
      console.error('Failed to initialize GitHub service:', error)
    }
  }

  private readToken(): GitHubToken | null {
    try {
      if (!fs.existsSync(this.TOKEN_FILE_PATH)) {
        console.warn('GitHub token file not found:', this.TOKEN_FILE_PATH)
        return null
      }

      const fileContent = fs.readFileSync(this.TOKEN_FILE_PATH, 'utf8')
      const tokenData = JSON.parse(fileContent) as GitHubToken

      if (!tokenData.access_token) {
        console.warn('Invalid token data: missing access_token')
        return null
      }

      return tokenData
    } catch (error) {
      console.error('Error reading GitHub token:', error)
      return null
    }
  }

  private ensureAuthenticated(): void {
    if (!this.octokit) {
      throw new Error('GitHub service not authenticated. Please ensure token file exists at ~/.keyboard-mcp-onboarding-gh-token')
    }
  }

  // Repository Operations

  async createFork(owner: string, repo: string): Promise<any> {
    this.ensureAuthenticated()
    
    try {
      // First, get the authenticated user
      const user = await this.getCurrentUser()
      if (!user) {
        throw new Error('Could not get authenticated user')
      }
      
      // Check if fork already exists
      try {
        const existingFork = await this.octokit!.repos.get({
          owner: user.login,
          repo: repo,
        })
        
        // If we get here, fork exists - return it
        console.log(`Fork already exists: ${user.login}/${repo}`)
        return existingFork.data
      } catch (error: any) {
        // If fork doesn't exist (404), continue to create it
        if (error.status !== 404) {
          throw error
        }
      }
      
      // Fork doesn't exist, create it
      console.log(`Creating fork: ${owner}/${repo}`)
      const response = await this.octokit!.repos.createFork({
        owner,
        repo,
      })
      return response.data
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found`)
      }
      throw error
    }
  }

  async getRepository(owner: string, repo: string): Promise<any> {
    this.ensureAuthenticated()
    
    const response = await this.octokit!.repos.get({
      owner,
      repo,
    })
    return response.data
  }

  async listBranches(owner: string, repo: string, perPage: number = 100): Promise<any[]> {
    this.ensureAuthenticated()
    
    const response = await this.octokit!.repos.listBranches({
      owner,
      repo,
      per_page: perPage,
    })
    return response.data
  }

  // Pull Request Operations

  async createPullRequest(params: {
    owner: string
    repo: string
    title: string
    body?: string
    head: string
    base: string
    draft?: boolean
    maintainer_can_modify?: boolean
  }): Promise<any> {
    this.ensureAuthenticated()
    
    const response = await this.octokit!.pulls.create({
      owner: params.owner,
      repo: params.repo,
      title: params.title,
      body: params.body,
      head: params.head,
      base: params.base,
      draft: params.draft,
      maintainer_can_modify: params.maintainer_can_modify,
    })
    return response.data
  }

  async getPullRequest(owner: string, repo: string, pull_number: number): Promise<any> {
    this.ensureAuthenticated()
    
    const response = await this.octokit!.pulls.get({
      owner,
      repo,
      pull_number,
    })
    return response.data
  }

  async mergePullRequest(
    owner: string, 
    repo: string, 
    pull_number: number,
    options?: {
      commit_title?: string
      commit_message?: string
      merge_method?: 'merge' | 'squash' | 'rebase'
    }
  ): Promise<any> {
    this.ensureAuthenticated()
    
    const response = await this.octokit!.pulls.merge({
      owner,
      repo,
      pull_number,
      commit_title: options?.commit_title,
      commit_message: options?.commit_message,
      merge_method: options?.merge_method,
    })
    return response.data
  }

  async listPullRequests(
    owner: string, 
    repo: string,
    options?: {
      state?: 'open' | 'closed' | 'all'
      sort?: 'created' | 'updated' | 'popularity' | 'long-running'
      direction?: 'asc' | 'desc'
      per_page?: number
    }
  ): Promise<any[]> {
    this.ensureAuthenticated()
    
    const response = await this.octokit!.pulls.list({
      owner,
      repo,
      state: options?.state || 'open',
      sort: options?.sort || 'created',
      direction: options?.direction || 'desc',
      per_page: options?.per_page || 100,
    })
    return response.data
  }

  // Release Operations

  async getReleaseByTag(owner: string, repo: string, tag: string): Promise<any> {
    this.ensureAuthenticated()
    
    const response = await this.octokit!.repos.getReleaseByTag({
      owner,
      repo,
      tag,
    })
    return response.data
  }

  async getLatestRelease(owner: string, repo: string): Promise<any> {
    this.ensureAuthenticated()
    
    const response = await this.octokit!.repos.getLatestRelease({
      owner,
      repo,
    })
    return response.data
  }

  async downloadReleaseAsset(assetUrl: string, destPath: string): Promise<void> {
    this.ensureAuthenticated()
    
    return new Promise((resolve, reject) => {
      const token = this.readToken()
      if (!token) {
        reject(new Error('No GitHub token available'))
        return
      }

      const file = createWriteStream(destPath)
      
      const urlParts = new URL(assetUrl)
      const options = {
        hostname: urlParts.hostname,
        path: urlParts.pathname + urlParts.search,
        headers: {
          'Authorization': `token ${token.access_token}`,
          'Accept': 'application/octet-stream',
          'User-Agent': 'Keyboard-Approver-App',
        },
      }

      https.get(options, (response) => {
        if (response.statusCode === 302 || response.statusCode === 307) {
          // Follow redirect
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            https.get(redirectUrl, (redirectResponse) => {
              redirectResponse.pipe(file)
              file.on('finish', () => {
                file.close()
                resolve()
              })
            }).on('error', reject)
          } else {
            reject(new Error('Redirect location not found'))
          }
        } else if (response.statusCode === 200) {
          response.pipe(file)
          file.on('finish', () => {
            file.close()
            resolve()
          })
        } else {
          reject(new Error(`Failed to download asset: ${response.statusCode}`))
        }
      }).on('error', reject)

      file.on('error', (err) => {
        fs.unlink(destPath, () => {})
        reject(err)
      })
    })
  }

  // File Operations

  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<any> {
    this.ensureAuthenticated()
    
    const response = await this.octokit!.repos.getContent({
      owner,
      repo,
      path,
      ref,
    })
    return response.data
  }

  async downloadFile(
    owner: string, 
    repo: string, 
    filePath: string, 
    destPath: string, 
    ref?: string
  ): Promise<void> {
    this.ensureAuthenticated()
    
    const content = await this.getFileContent(owner, repo, filePath, ref)
    
    if (Array.isArray(content)) {
      throw new Error('Path is a directory, not a file')
    }

    if (content.type !== 'file') {
      throw new Error(`Path is not a file: ${content.type}`)
    }

    if (!content.content) {
      throw new Error('File content is empty')
    }

    // Decode base64 content
    const buffer = Buffer.from(content.content, 'base64')
    fs.writeFileSync(destPath, buffer)
  }

  // Utility Methods

  isAuthenticated(): boolean {
    return this.octokit !== null
  }

  async getCurrentUser(): Promise<any | null> {
    if (!this.isAuthenticated()) {
      return null
    }

    try {
      const response = await this.octokit!.users.getAuthenticated()
      return response.data
    } catch (error) {
      console.error('Failed to get current user:', error)
      return null
    }
  }

  async checkTokenValidity(): Promise<boolean> {
    if (!this.isAuthenticated()) {
      return false
    }

    try {
      await this.getCurrentUser()
      return true
    } catch (error) {
      return false
    }
  }
}