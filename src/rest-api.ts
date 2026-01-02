import express, { Application, NextFunction, Request, Response } from 'express'
import { Server } from 'http'
import { decryptWithCustomKey, encryptWithCustomKey } from './encryption'
import {
  deleteScriptTemplate,
  getScriptTemplate,
  interpolateScript,
  listScriptTemplates,
  saveScriptTemplate,
  searchScriptTemplates,
  updateScriptTemplate,
  validateInputs,
} from './keyboard-shortcuts'
import { AuthTokens, Message } from './types'

interface AuthenticatedRequest extends Request {
  user?: { id?: string, sub?: string, [key: string]: unknown }
  token?: string
}

const safeParseInt = (value: unknown, defaultValue: number): number => {
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    return isNaN(parsed) ? defaultValue : parsed
  }
  return defaultValue
}

const safeParseString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

interface RestAPIConfig {
  port?: number
  host?: string
}

interface RestAPIServerDeps {
  getMessages: () => Message[]
  getAuthTokens: () => AuthTokens | null
  getWebSocketServerStatus: () => boolean
  getLatestConnectedAccountSessionId: () => string | null
  completeConnectedAccount: (authSession: string, connectCode: string) => Promise<{ success: boolean, message: string, data?: unknown }>
  updateMessageStatus: (messageId: string, status: 'approved' | 'rejected', feedback?: string) => boolean
}

interface RestAPIServerInterface {
  start: () => Promise<void>
  stop: () => Promise<void>
  getPort: () => number
  getApp: () => Application
}

// Middleware factory functions
const createCorsMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')

    if (req.method === 'OPTIONS') {
      res.sendStatus(200)
    }
    else {
      next()
    }
  }
}

import { createRemoteJWKSet, jwtVerify } from 'jose'

const ISSUER_URL = 'https://login.keyboard.dev'
const JWKS = createRemoteJWKSet(new URL(`${ISSUER_URL}/oauth2/jwks`))

export async function verifyBearerToken(token: string): Promise<boolean> {
  if (!token || token.trim() === '') {
    console.error('❌ Token verification failed: Empty token')
    return false
  }

  try {
    await jwtVerify(token, JWKS, {
      issuer: ISSUER_URL,
    })

    return true
  }
  catch (e) {
    const error = e as { code?: string, message?: string }
    if (error.code === 'ERR_JWT_EXPIRED') {
      console.error('❌ Token verification failed: Token expired')
    }
    else if (error.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
      console.error('❌ Token verification failed: Invalid issuer or claims')
    }
    else if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      console.error('❌ Token verification failed: Invalid signature')
    }
    else {
      console.error('❌ Token verification error:', error.message)
    }
    return false
  }
}

export async function verifyTokensMatch(tokenOne: string, tokenTwo: string): Promise<boolean> {
  if (!tokenOne || !tokenTwo || tokenOne.trim() === '' || tokenTwo.trim() === '') {
    console.error('❌ Token match verification failed: One or both tokens are empty')
    return false
  }

  try {
    // Verify and decode both tokens
    const tokenOneResult = await jwtVerify(tokenOne, JWKS, {
      issuer: ISSUER_URL,
    })

    const tokenTwoResult = await jwtVerify(tokenTwo, JWKS, {
      issuer: ISSUER_URL,
    })

    // Extract the 'sub' (subject) claim from both tokens
    const subOne = tokenOneResult.payload.sub
    const subTwo = tokenTwoResult.payload.sub

    if (!subOne || !subTwo) {
      console.error('❌ Token match verification failed: Missing sub claim in one or both tokens')
      return false
    }

    // Check if the subjects match
    const match = subOne === subTwo
    if (!match) {
      console.error('❌ Token match verification failed: Subject claims do not match')
    }

    return match
  }
  catch (e) {
    const error = e as { message?: string }
    console.error('❌ Token match verification error:', error.message)
    return false
  }
}

const createAuthMiddleware = (getAuthTokens: () => AuthTokens | null) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization
    const token = authHeader?.split(' ')[1] // Bearer token
    if (!token) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }
    const authTokens = getAuthTokens()

    if (!authTokens || !token) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    const isTokensMatch = await verifyTokensMatch(token, authTokens.access_token)
    if (!isTokensMatch) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    req.user = authTokens.user
    req.token = token
    next()
  }
}

// Route handler factories
const createHealthHandler = (
  getMessages: () => Message[],
  getAuthTokens: () => AuthTokens | null,
  getWebSocketServerStatus: () => boolean,
) => {
  return (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      websocket: getWebSocketServerStatus() ? 'running' : 'stopped',
      authenticated: !!getAuthTokens(),
      messageCount: getMessages().length,
      timestamp: new Date().toISOString(),
    })
  }
}

const createAuthStatusHandler = (getAuthTokens: () => AuthTokens | null) => {
  return (_req: Request, res: Response) => {
    const authTokens = getAuthTokens()
    res.json({
      authenticated: !!authTokens,
      user: authTokens?.user || null,
      expiresAt: authTokens?.expires_at || null,
    })
  }
}

const createMessagesHandler = (getMessages: () => Message[]) => {
  return (req: AuthenticatedRequest, res: Response) => {
    const page = safeParseInt(req.query.page, 1)
    const limit = Math.min(safeParseInt(req.query.limit, 10), 100)
    const status = safeParseString(req.query.status)
    const priority = safeParseString(req.query.priority)

    let messages = getMessages()

    if (status) {
      messages = messages.filter(msg => msg.status === status)
    }

    if (priority) {
      messages = messages.filter(msg => msg.priority === priority)
    }

    messages.sort((a, b) => b.timestamp - a.timestamp)

    const start = (page - 1) * limit
    const paginatedMessages = messages.slice(start, start + limit)

    res.json({
      messages: paginatedMessages,
      total: messages.length,
      page,
      limit,
      hasMore: start + limit < messages.length,
    })
  }
}

const createMessageByIdHandler = (getMessages: () => Message[]) => {
  return (req: AuthenticatedRequest, res: Response) => {
    const messageId = req.params.id
    const message = getMessages().find(msg => msg.id === messageId)

    if (!message) {
      res.status(404).json({ error: 'Message not found' })
      return
    }

    res.json(message)
  }
}

const createApproveMessageHandler = (
  updateMessageStatus: (messageId: string, status: 'approved' | 'rejected', feedback?: string) => boolean,
) => {
  return (req: AuthenticatedRequest, res: Response) => {
    const messageId = req.params.id
    const { feedback } = req.body

    const success = updateMessageStatus(messageId, 'approved', feedback)

    if (!success) {
      res.status(404).json({ error: 'Message not found' })
      return
    }

    res.json({
      success: true,
      messageId,
      status: 'approved',
      feedback: feedback || null,
      timestamp: Date.now(),
    })
  }
}

const createRejectMessageHandler = (
  updateMessageStatus: (messageId: string, status: 'approved' | 'rejected', feedback?: string) => boolean,
) => {
  return (req: AuthenticatedRequest, res: Response) => {
    const messageId = req.params.id
    const { feedback } = req.body

    const success = updateMessageStatus(messageId, 'rejected', feedback)

    if (!success) {
      res.status(404).json({ error: 'Message not found' })
      return
    }

    res.json({
      success: true,
      messageId,
      status: 'rejected',
      feedback: feedback || null,
      timestamp: Date.now(),
    })
  }
}

const createBatchApproveHandler = (
  updateMessageStatus: (messageId: string, status: 'approved' | 'rejected', feedback?: string) => boolean,
) => {
  return (req: AuthenticatedRequest, res: Response) => {
    const { messageIds, feedback } = req.body

    if (!Array.isArray(messageIds)) {
      res.status(400).json({ error: 'messageIds must be an array' })
      return
    }

    const { approved, failed } = messageIds.reduce<{ approved: string[], failed: string[] }>((acc, id: string) => {
      const success = updateMessageStatus(id, 'approved', feedback)
      if (success) {
        acc.approved.push(id)
      }
      else {
        acc.failed.push(id)
      }
      return acc
    }, { approved: [], failed: [] })

    res.json({
      approved,
      failed,
      approvedCount: approved.length,
      failedCount: failed.length,
      feedback: feedback || null,
      timestamp: Date.now(),
    })
  }
}

const createBatchRejectHandler = (
  updateMessageStatus: (messageId: string, status: 'approved' | 'rejected', feedback?: string) => boolean,
) => {
  return (req: AuthenticatedRequest, res: Response) => {
    const { messageIds, feedback } = req.body

    if (!Array.isArray(messageIds)) {
      res.status(400).json({ error: 'messageIds must be an array' })
      return
    }

    const rejected: string[] = []
    const failed: string[] = []

    messageIds.forEach((id: string) => {
      const success = updateMessageStatus(id, 'rejected', feedback)
      if (success) {
        rejected.push(id)
      }
      else {
        failed.push(id)
      }
    })

    res.json({
      rejected,
      failed,
      rejectedCount: rejected.length,
      failedCount: failed.length,
      feedback: feedback || null,
      timestamp: Date.now(),
    })
  }
}

const createStatsHandler = (getMessages: () => Message[]) => {
  return (_req: AuthenticatedRequest, res: Response) => {
    const messages = getMessages()

    const stats = {
      total: messages.length,
      pending: messages.filter(msg => msg.status === 'pending').length,
      approved: messages.filter(msg => msg.status === 'approved').length,
      rejected: messages.filter(msg => msg.status === 'rejected').length,
      byPriority: {
        low: messages.filter(msg => msg.priority === 'low').length,
        normal: messages.filter(msg => msg.priority === 'normal').length,
        high: messages.filter(msg => msg.priority === 'high').length,
        urgent: messages.filter(msg => msg.priority === 'urgent').length,
      },
      recent: messages.filter(msg => Date.now() - msg.timestamp < 24 * 60 * 60 * 1000).length,
    }

    res.json(stats)
  }
}

// Error handling middleware
const createErrorHandler = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('REST API Error:', err)
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    })
  }
}

const createNotFoundHandler = () => {
  return (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' })
  }
}

// Application setup function
const setupExpressApp = (deps: RestAPIServerDeps): Application => {
  const app = express()

  // Middleware setup
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(createCorsMiddleware())

  // Create auth middleware
  const authMiddleware = createAuthMiddleware(deps.getAuthTokens)

  // Route handlers
  app.get('/api/health', createHealthHandler(
    deps.getMessages,
    deps.getAuthTokens,
    deps.getWebSocketServerStatus,
  ))

  app.get('/api/auth-status', createAuthStatusHandler(deps.getAuthTokens))

  app.get('/api/messages', createMessagesHandler(deps.getMessages))

  app.get('/api/messages/:id', createMessageByIdHandler(deps.getMessages))

  app.post('/api/messages/:id/approve', createApproveMessageHandler(deps.updateMessageStatus))

  app.post('/api/messages/:id/reject', createRejectMessageHandler(deps.updateMessageStatus))

  app.post('/api/messages/batch/approve', createBatchApproveHandler(deps.updateMessageStatus))

  app.post('/api/messages/batch/reject', createBatchRejectHandler(deps.updateMessageStatus))

  app.get('/api/stats', createStatsHandler(deps.getMessages))

  // Keyboard shortcuts endpoints
  app.post('/api/scripts', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description, schema, script, tags } = req.body
      const token = req.token || ''

      if (!name || !description || !script) {
        res.status(400).json({ error: 'Name, description, and script are required' })
        return
      }

      const result = await saveScriptTemplate({
        name,
        description,
        schema: schema || {},
        script,
        tags: tags || [],
      }, token)

      if (result.success) {
        res.json({ success: true, id: result.id })
      }
      else {
        res.status(500).json({ error: result.error })
      }
    }
    catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  app.get('/api/scripts/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params
      const token = req.token || ''

      const result = await getScriptTemplate(id, token)

      if (result.success) {
        res.json({ success: true, script: result.script })
      }
      else {
        res.status(404).json({ error: result.error })
      }
    }
    catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  app.get('/api/scripts', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const token = req.token || ''
      const tagsString = safeParseString(req.query.tags)
      const tags = tagsString ? tagsString.split(',') : undefined

      const result = await listScriptTemplates(token, tags)

      if (result.success) {
        res.json({ success: true, scripts: result.scripts })
      }
      else {
        res.status(500).json({ error: result.error })
      }
    }
    catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  app.put('/api/scripts/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params
      const token = req.token || ''
      const updates = req.body

      const result = await updateScriptTemplate(id, token, updates)

      if (result.success) {
        res.json({ success: true })
      }
      else {
        res.status(404).json({ error: result.error })
      }
    }
    catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  app.delete('/api/scripts/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params
      const token = req.token || ''

      const result = await deleteScriptTemplate(id, token)

      if (result.success) {
        res.json({ success: true })
      }
      else {
        res.status(404).json({ error: result.error })
      }
    }
    catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  app.get('/api/scripts/search', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const token = req.token || ''
      const searchTerm = safeParseString(req.query.q)

      if (!searchTerm) {
        res.status(400).json({ error: 'Search term (q) is required' })
        return
      }

      const result = await searchScriptTemplates(token, searchTerm)

      if (result.success) {
        res.json({ success: true, scripts: result.scripts })
      }
      else {
        res.status(500).json({ error: result.error })
      }
    }
    catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  app.post('/api/scripts/:id/interpolate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params
      const { variables } = req.body
      const token = req.token || ''

      // Get the script template
      const templateResult = await getScriptTemplate(id, token)
      if (!templateResult.success) {
        res.status(404).json({ error: templateResult.error })
        return
      }

      const script = templateResult.script!

      // Validate variables against schema if schema exists
      if (script.schema && Object.keys(script.schema).length > 0) {
        const validation = validateInputs(variables || {}, script.schema)
        if (!validation.valid) {
          res.status(400).json({
            error: 'Variable validation failed',
            errors: validation.errors,
          })
          return
        }
      }

      // Interpolate the script
      const interpolated = interpolateScript(script.script, variables || {})

      res.json({
        success: true,
        scriptId: id,
        scriptName: script.name,
        scriptDescription: script.description,
        template: script.script,
        variables: variables || {},
        interpolatedCode: interpolated.interpolated,
        availableVariables: Object.keys(script.schema || {}),
        tags: script.tags,
      })
    }
    catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  app.post('/api/encrypt', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const codeToEncrypt = req.body.code
      const encryptedCode = encryptWithCustomKey(codeToEncrypt)
      res.json({ success: true, encryptedCode })
    }
    catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  app.post('/api/decrypt', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const codeToDecrypt = req.body.code
      const decryptedCode = decryptWithCustomKey(codeToDecrypt)
      res.json({ success: true, decryptedCode })
    }
    catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  app.get('/connected/accounts/callback', async (req: Request, res: Response) => {
    try {
      const { connect_code, state } = req.query
      const authSession = deps.getLatestConnectedAccountSessionId()

      if (!authSession) {
        res.status(400).json({ error: 'No active session found' })
        return
      }

      if (!connect_code || typeof connect_code !== 'string') {
        res.status(400).json({ error: 'Missing or invalid connect_code' })
        return
      }

      // Complete the connection by calling the token vault
      const result = await deps.completeConnectedAccount(authSession, connect_code)

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: result.message,
        })
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <html>
          <head><title>Connection Success</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5;">
            <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto;">
              <h2 style="color: #27ae60;">Connection Successful!</h2>
              <p style="color: #666; margin: 20px 0;">
                You have successfully connected your account.
              </p>
              <p style="color: #666;">You can close this window and return to the app.</p>
              <button onclick="window.close()" style="background: #27ae60; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 20px;">Close Window</button>
            </div>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `)
    }
    catch (error) {
      console.error('❌ Connected accounts callback error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // Error handling
  app.use(createErrorHandler())
  app.use(createNotFoundHandler())

  return app
}

// Main factory function
export const createRestAPIServer = (
  deps: RestAPIServerDeps,
  config: RestAPIConfig = {},
): RestAPIServerInterface => {
  const port = config.port || 8081
  const host = config.host || '127.0.0.1'

  const app = setupExpressApp(deps)
  let server: Server | null = null

  const start = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      server = app.listen(port, host, () => {
        resolve()
      })

      server.on('error', (err: Error) => {
        console.error('❌ REST API server error:', err)
        reject(err)
      })
    })
  }

  const stop = (): Promise<void> => {
    return new Promise((resolve) => {
      if (server) {
        server.close(() => {
          resolve()
        })
      }
      else {
        resolve()
      }
    })
  }

  const getPort = (): number => port
  const getApp = (): Application => app

  return {
    start,
    stop,
    getPort,
    getApp,
  }
}

// For backward compatibility, export the class-like interface
