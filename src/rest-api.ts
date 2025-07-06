import express, { Request, Response, NextFunction } from 'express';
import { Message, AuthTokens } from './types';

interface AuthenticatedRequest extends Request {
  user?: any;
}

export class RestAPIServer {
  private app: express.Application;
  private server: any;
  private readonly PORT = 8081;

  constructor(
    private getMessages: () => Message[],
    private getAuthTokens: () => AuthTokens | null,
    private getWebSocketServerStatus: () => boolean,
    private updateMessageStatus: (messageId: string, status: 'approved' | 'rejected', feedback?: string) => boolean
  ) {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  private authenticateRequest = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1]; // Bearer token
    
    const authTokens = this.getAuthTokens();
    
    // For now, we'll do a simple check - in production, you'd want proper JWT validation
    if (!authTokens || !token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    // Simple token validation (you might want to implement proper JWT validation)
    if (token !== authTokens.access_token) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    
    req.user = authTokens.user;
    next();
  };

  private setupRoutes(): void {
    // Health check endpoint (no auth required)
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        websocket: this.getWebSocketServerStatus() ? 'running' : 'stopped',
        authenticated: !!this.getAuthTokens(),
        messageCount: this.getMessages().length,
        timestamp: new Date().toISOString()
      });
    });

    // Get authentication status
    this.app.get('/api/auth/status', (req: Request, res: Response) => {
      const authTokens = this.getAuthTokens();
      res.json({
        authenticated: !!authTokens,
        user: authTokens?.user || null,
        expiresAt: authTokens?.expires_at || null
      });
    });

    // Get messages with pagination (requires auth)
    this.app.get('/api/messages', this.authenticateRequest, (req: AuthenticatedRequest, res: Response) => {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100); // Max 100 items
      const status = req.query.status as string;
      const priority = req.query.priority as string;
      
      let messages = this.getMessages();
      
      // Filter by status if provided
      if (status) {
        messages = messages.filter(msg => msg.status === status);
      }
      
      // Filter by priority if provided
      if (priority) {
        messages = messages.filter(msg => msg.priority === priority);
      }
      
      // Sort by timestamp (newest first)
      messages.sort((a, b) => b.timestamp - a.timestamp);
      
      const start = (page - 1) * limit;
      const paginatedMessages = messages.slice(start, start + limit);
      
      res.json({
        messages: paginatedMessages,
        total: messages.length,
        page,
        limit,
        hasMore: start + limit < messages.length
      });
    });

    // Get specific message by ID (requires auth)
    this.app.get('/api/messages/:id', this.authenticateRequest, (req: AuthenticatedRequest, res: Response) => {
      const messageId = req.params.id;
      const message = this.getMessages().find(msg => msg.id === messageId);
      
      if (!message) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }
      
      res.json(message);
    });

    // Approve a single message (requires auth)
    this.app.post('/api/messages/:id/approve', this.authenticateRequest, (req: AuthenticatedRequest, res: Response) => {
      const messageId = req.params.id;
      const { feedback } = req.body;
      
      const success = this.updateMessageStatus(messageId, 'approved', feedback);
      
      if (!success) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }
      
      res.json({ 
        success: true, 
        messageId, 
        status: 'approved',
        feedback: feedback || null,
        timestamp: Date.now()
      });
    });

    // Reject a single message (requires auth)
    this.app.post('/api/messages/:id/reject', this.authenticateRequest, (req: AuthenticatedRequest, res: Response) => {
      const messageId = req.params.id;
      const { feedback } = req.body;
      
      const success = this.updateMessageStatus(messageId, 'rejected', feedback);
      
      if (!success) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }
      
      res.json({ 
        success: true, 
        messageId, 
        status: 'rejected',
        feedback: feedback || null,
        timestamp: Date.now()
      });
    });

    // Batch approve messages (requires auth)
    this.app.post('/api/messages/batch-approve', this.authenticateRequest, (req: AuthenticatedRequest, res: Response) => {
      const { messageIds, feedback } = req.body;
      
      if (!Array.isArray(messageIds)) {
        res.status(400).json({ error: 'messageIds must be an array' });
        return;
      }
      
      const approved: string[] = [];
      const failed: string[] = [];
      
      messageIds.forEach((id: string) => {
        const success = this.updateMessageStatus(id, 'approved', feedback);
        if (success) {
          approved.push(id);
        } else {
          failed.push(id);
        }
      });
      
      res.json({ 
        approved, 
        failed,
        approvedCount: approved.length,
        failedCount: failed.length,
        feedback: feedback || null,
        timestamp: Date.now()
      });
    });

    // Batch reject messages (requires auth)
    this.app.post('/api/messages/batch-reject', this.authenticateRequest, (req: AuthenticatedRequest, res: Response) => {
      const { messageIds, feedback } = req.body;
      
      if (!Array.isArray(messageIds)) {
        res.status(400).json({ error: 'messageIds must be an array' });
        return;
      }
      
      const rejected: string[] = [];
      const failed: string[] = [];
      
      messageIds.forEach((id: string) => {
        const success = this.updateMessageStatus(id, 'rejected', feedback);
        if (success) {
          rejected.push(id);
        } else {
          failed.push(id);
        }
      });
      
      res.json({ 
        rejected, 
        failed,
        rejectedCount: rejected.length,
        failedCount: failed.length,
        feedback: feedback || null,
        timestamp: Date.now()
      });
    });

    // Get message statistics (requires auth)
    this.app.get('/api/stats', this.authenticateRequest, (req: AuthenticatedRequest, res: Response) => {
      const messages = this.getMessages();
      
      const stats = {
        total: messages.length,
        pending: messages.filter(msg => msg.status === 'pending').length,
        approved: messages.filter(msg => msg.status === 'approved').length,
        rejected: messages.filter(msg => msg.status === 'rejected').length,
        byPriority: {
          low: messages.filter(msg => msg.priority === 'low').length,
          normal: messages.filter(msg => msg.priority === 'normal').length,
          high: messages.filter(msg => msg.priority === 'high').length,
          urgent: messages.filter(msg => msg.priority === 'urgent').length
        },
        recent: messages.filter(msg => Date.now() - msg.timestamp < 24 * 60 * 60 * 1000).length // Last 24 hours
      };
      
      res.json(stats);
    });

    // Error handling middleware
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('REST API Error:', err);
      res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.PORT, '127.0.0.1', () => {
        console.log(`🚀 REST API server running on http://127.0.0.1:${this.PORT}`);
        resolve();
      });
      
      this.server.on('error', (err: Error) => {
        console.error('❌ REST API server error:', err);
        reject(err);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🛑 REST API server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getPort(): number {
    return this.PORT;
  }
} 