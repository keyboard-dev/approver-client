import * as http from 'http'
import * as url from 'url'

export interface OAuthCallbackData {
  code?: string
  state?: string
  error?: string
  error_description?: string
}

export class OAuthHttpServer {
  private server: http.Server | null = null
  private port: number = 8080
  private isRunning: boolean = false
  private callbackPath: string = '/callback'
  private host: string = 'localhost'

  constructor(port?: number, options?: { callbackPath?: string, host?: string }) {
    if (port !== undefined) {
      this.port = port
    }
    if (options?.callbackPath) {
      this.callbackPath = options.callbackPath
    }
    if (options?.host) {
      this.host = options.host
    }
  }

  /**
   * Start the HTTP server to listen for OAuth callbacks
   */
  startServer(onCallback: (data: OAuthCallbackData) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        resolve()
        return
      }

      this.server = http.createServer((req, res) => {
        try {
          const parsedUrl = url.parse(req.url || '', true)

          if (parsedUrl.pathname === this.callbackPath) {
            const { code, state, error, error_description } = parsedUrl.query

            // Send success/error page
            if (error) {
              res.writeHead(400, { 'Content-Type': 'text/html' })
              res.end(`
                <html>
                  <head><title>OAuth Error</title></head>
                  <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5;">
                    <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto;">
                      <h2 style="color: #e74c3c;">❌ Authentication Error</h2>
                      <p style="color: #666; margin: 20px 0;">
                        <strong>Error:</strong> ${error}<br/>
                        ${error_description ? `<strong>Description:</strong> ${error_description}` : ''}
                      </p>
                      <p style="color: #666;">You can close this window and try again.</p>
                      <button onclick="window.close()" style="background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 20px;">Close Window</button>
                    </div>
                    <script>
                      setTimeout(() => window.close(), 5000);
                    </script>
                  </body>
                </html>
              `)
            }
            else {
              res.writeHead(200, { 'Content-Type': 'text/html' })
              res.end(`
                <html>
                  <head><title>OAuth Success</title></head>
                  <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5;">
                    <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto;">
                      <h2 style="color: #27ae60;">Authentication Successful!</h2>
                      <p style="color: #666; margin: 20px 0;">
                        You have successfully connected to the OAuth provider.
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

            // Trigger callback with data
            const callbackData: OAuthCallbackData = {
              code: code as string,
              state: state as string,
              error: error as string,
              error_description: error_description as string,
            }

            // Use setTimeout to ensure response is sent before processing
            setTimeout(() => {
              onCallback(callbackData)
              this.stopServer()
            }, 100)
          }
          else {
            // Handle other paths
            res.writeHead(404, { 'Content-Type': 'text/html' })
            res.end(`
              <html>
                <head><title>Not Found</title></head>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h2>404 - Not Found</h2>
                  <p>This OAuth callback server only handles /callback requests.</p>
                </body>
              </html>
            `)
          }
        }
        catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end('Internal Server Error')
        }
      })

      this.server.listen(this.port, this.host, () => {
        this.isRunning = true
        // Update port to actual assigned port (important when port 0 is used for random port)
        const addr = this.server?.address()
        if (addr && typeof addr === 'object') {
          this.port = addr.port
        }
        resolve()
      })

      this.server.on('error', (error) => {
        this.isRunning = false
        reject(error)
      })
    })
  }

  /**
   * Stop the HTTP server
   */
  stopServer(): void {
    if (this.server && this.isRunning) {
      this.server.close(() => {
      })
      this.server = null
      this.isRunning = false
    }
  }

  /**
   * Check if server is running
   */
  isServerRunning(): boolean {
    return this.isRunning
  }

  /**
   * Get the callback URL for this server
   */
  getCallbackUrl(): string {
    return `http://${this.host}:${this.port}${this.callbackPath}`
  }

  /**
   * Get the port number
   */
  getPort(): number {
    return this.port
  }
}
