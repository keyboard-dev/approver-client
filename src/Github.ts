import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

interface GitHubToken {
  access_token: string
  token_type?: string
  scope?: string
}

interface GitHubUser {
  login: string
  id: number
  avatar_url: string
  name?: string
  email?: string
  [key: string]: unknown
}

interface GitHubRepository {
  id: number
  name: string
  full_name: string
  owner: GitHubUser
  private: boolean
  html_url: string
  clone_url: string
  default_branch: string
  fork: boolean
  [key: string]: unknown
}

interface GitHubBranch {
  name: string
  commit: {
    sha: string
    url: string
  }
  protected: boolean
}

interface GitHubPullRequest {
  id: number
  number: number
  title: string
  body?: string
  state: 'open' | 'closed'
  head: {
    ref: string
    sha: string
    repo: GitHubRepository
  }
  base: {
    ref: string
    sha: string
    repo: GitHubRepository
  }
  merged: boolean
  html_url: string
  [key: string]: unknown
}

interface GitHubRelease {
  id: number
  tag_name: string
  name: string
  body?: string
  draft: boolean
  prerelease: boolean
  assets: GitHubReleaseAsset[]
  html_url: string
  [key: string]: unknown
}

interface GitHubReleaseAsset {
  id: number
  name: string
  size: number
  download_count: number
  browser_download_url: string
  [key: string]: unknown
}

interface GitHubFileContent {
  type: 'file' | 'dir' | 'symlink' | 'submodule'
  content?: string
  encoding?: string
  size: number
  name: string
  path: string
  sha: string
  url: string
  html_url: string
  download_url?: string
}

interface GitHubMergeResult {
  merged: boolean
  message?: string
  sha?: string
}

export class GithubService {
  private token: string | null = null
  private readonly TOKEN_FILE_PATH = path.join(os.homedir(), '.keyboard-mcp', '.keyboard-mcp-onboarding-gh-token')
  private readonly BASE_URL = 'https://api.github.com'

  constructor() {
    this.initializeToken()
  }

  initializeToken(): void {
    try {
      const tokenData = this.readToken()
      if (tokenData) {
        this.token = tokenData.access_token
      }
    }
    catch (error) {
      console.error('Failed to initialize GitHub service:', error)
    }
  }

  private readToken(): GitHubToken | null {
    try {
      if (!fs.existsSync(this.TOKEN_FILE_PATH)) {
        return null
      }

      const fileContent = fs.readFileSync(this.TOKEN_FILE_PATH, 'utf8')
      const tokenData = JSON.parse(fileContent) as GitHubToken

      if (!tokenData.access_token) {
        return null
      }

      return tokenData
    }
    catch (error) {
      console.error('Error reading GitHub token:', error)
      return null
    }
  }

  private ensureAuthenticated(): void {
    if (!this.token) {
      throw new Error('GitHub service not authenticated. Please ensure token file exists at ~/.keyboard-mcp/.keyboard-mcp-onboarding-gh-token')
    }
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    this.ensureAuthenticated()

    const url = endpoint.startsWith('http') ? endpoint : `${this.BASE_URL}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Keyboard-Approver-App',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`GitHub API error (${response.status}): ${error}`)
    }

    return response.json() as T
  }

  // Repository Operations
  async fetchResources(url: string) {
    this.ensureAuthenticated()
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        'x-github-token': this.token || '',
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  async createFork(owner: string, repo: string): Promise<GitHubRepository> {
    try {
      // First, get the authenticated user
      const user = await this.getCurrentUser()
      if (!user) {
        throw new Error('Could not get authenticated user')
      }

      // Check if fork already exists
      try {
        const existingFork = await this.makeRequest<GitHubRepository>(`/repos/${user.login}/${repo}`)

        // If we get here, fork exists - return it
        return existingFork
      }
      catch (error: unknown) {
        // If fork doesn't exist (404), continue to create it
        if (!(error instanceof Error) || !error.message.includes('404')) {
          throw error
        }
      }

      // Fork doesn't exist, create it
      return await this.makeRequest<GitHubRepository>(`/repos/${owner}/${repo}/forks`, {
        method: 'POST',
      })
    }
    catch (error: unknown) {
      if (error instanceof Error && error.message.includes('404')) {
        throw new Error(`Repository ${owner}/${repo} not found`)
      }
      throw error
    }
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return await this.makeRequest<GitHubRepository>(`/repos/${owner}/${repo}`)
  }

  async listBranches(owner: string, repo: string, perPage: number = 100): Promise<GitHubBranch[]> {
    return await this.makeRequest<GitHubBranch[]>(`/repos/${owner}/${repo}/branches?per_page=${perPage}`)
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
  }): Promise<GitHubPullRequest> {
    return await this.makeRequest<GitHubPullRequest>(`/repos/${params.owner}/${params.repo}/pulls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base,
        draft: params.draft,
        maintainer_can_modify: params.maintainer_can_modify,
      }),
    })
  }

  async getPullRequest(owner: string, repo: string, pull_number: number): Promise<GitHubPullRequest> {
    return await this.makeRequest<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls/${pull_number}`)
  }

  async mergePullRequest(
    owner: string,
    repo: string,
    pull_number: number,
    options?: {
      commit_title?: string
      commit_message?: string
      merge_method?: 'merge' | 'squash' | 'rebase'
    },
  ): Promise<GitHubMergeResult> {
    return await this.makeRequest<GitHubMergeResult>(`/repos/${owner}/${repo}/pulls/${pull_number}/merge`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commit_title: options?.commit_title,
        commit_message: options?.commit_message,
        merge_method: options?.merge_method,
      }),
    })
  }

  async listPullRequests(
    owner: string,
    repo: string,
    options?: {
      state?: 'open' | 'closed' | 'all'
      sort?: 'created' | 'updated' | 'popularity' | 'long-running'
      direction?: 'asc' | 'desc'
      per_page?: number
    },
  ): Promise<GitHubPullRequest[]> {
    const params = new URLSearchParams({
      state: options?.state || 'open',
      sort: options?.sort || 'created',
      direction: options?.direction || 'desc',
      per_page: String(options?.per_page || 100),
    })
    return await this.makeRequest<GitHubPullRequest[]>(`/repos/${owner}/${repo}/pulls?${params}`)
  }

  // Release Operations

  async getReleaseByTag(owner: string, repo: string, tag: string): Promise<GitHubRelease> {
    return await this.makeRequest<GitHubRelease>(`/repos/${owner}/${repo}/releases/tags/${tag}`)
  }

  async getLatestRelease(owner: string, repo: string): Promise<GitHubRelease> {
    return await this.makeRequest<GitHubRelease>(`/repos/${owner}/${repo}/releases/latest`)
  }

  async downloadReleaseAsset(assetUrl: string, destPath: string): Promise<void> {
    this.ensureAuthenticated()

    const response = await fetch(assetUrl, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/octet-stream',
        'User-Agent': 'Keyboard-Approver-App',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to download asset: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    fs.writeFileSync(destPath, buffer)
  }

  // File Operations

  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<GitHubFileContent | GitHubFileContent[]> {
    const params = ref ? `?ref=${ref}` : ''
    return await this.makeRequest<GitHubFileContent | GitHubFileContent[]>(`/repos/${owner}/${repo}/contents/${path}${params}`)
  }

  async downloadFile(
    owner: string,
    repo: string,
    filePath: string,
    destPath: string,
    ref?: string,
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
    return this.token !== null
  }

  async getCurrentUser(): Promise<GitHubUser | null> {
    if (!this.isAuthenticated()) {
      return null
    }

    try {
      return await this.makeRequest<GitHubUser>('/user')
    }
    catch (error) {
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
    }
    catch {
      return false
    }
  }
}
