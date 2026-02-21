/**
 * TinyWebChat Channel Plugin - HTTP Endpoints
 * 
 * REST API + SSE for real-time messaging
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { WebchatConfig, WebchatMessage, WebchatSession } from './types.js';
import type { WebchatGateway } from './gateway.js';

export interface HttpHandlers {
  sendMessage: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  getSessions: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  getSessionMessages: (req: IncomingMessage, res: ServerResponse, sessionId: string) => Promise<void>;
  createSession: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  events: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  health: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
}

/**
 * Create HTTP request handlers
 */
export function createHttpHandlers(
  config: WebchatConfig,
  gateway: WebchatGateway
): HttpHandlers {
  // Track active SSE connections
  const sseConnections = new Map<string, Set<ServerResponse>>();
  
  /**
   * Parse JSON body from request
   */
  async function parseBody<T>(req: IncomingMessage): Promise<T | null> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          resolve(JSON.parse(body) as T);
        } catch {
          resolve(null);
        }
      });
      req.on('error', () => resolve(null));
    });
  }
  
  /**
   * Send JSON response
   */
  function sendJson(res: ServerResponse, status: number, data: unknown): void {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', config.allowedOrigins?.join(', ') || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end(JSON.stringify(data));
  }
  
  /**
   * Send error response
   */
  function sendError(res: ServerResponse, status: number, message: string): void {
    sendJson(res, status, { error: message });
  }
  
  /**
   * Validate authorization header
   */
  function getAuthToken(req: IncomingMessage): string | null {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return null;
    }
    return auth.slice(7);
  }
  
  /**
   * GET /health - Health check
   */
  async function health(req: IncomingMessage, res: ServerResponse): Promise<void> {
    sendJson(res, 200, { status: 'ok', timestamp: Date.now() });
  }
  
  /**
   * POST /sessions - Create a new session
   */
  async function createSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      sendError(res, 405, 'Method not allowed');
      return;
    }
    
    const body = await parseBody<{ metadata?: Record<string, unknown> }>(req);
    const session = await gateway.createSession(body?.metadata);
    
    sendJson(res, 201, {
      id: session.id,
      token: session.token,
      expiresAt: session.createdAt + (config.sessionTimeout * 1000),
    });
  }
  
  /**
   * GET /sessions - List all sessions (admin only)
   */
  async function getSessions(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'GET') {
      sendError(res, 405, 'Method not allowed');
      return;
    }
    
    // In production, add admin authentication check
    const sessions = await gateway.listSessions();
    
    sendJson(res, 200, {
      sessions: sessions.map(s => ({
        id: s.id,
        createdAt: s.createdAt,
        lastActivityAt: s.lastActivityAt,
      })),
      total: sessions.length,
    });
  }
  
  /**
   * GET /sessions/:id/messages - Get message history
   */
  async function getSessionMessages(
    req: IncomingMessage, 
    res: ServerResponse, 
    sessionId: string
  ): Promise<void> {
    if (req.method !== 'GET') {
      sendError(res, 405, 'Method not allowed');
      return;
    }
    
    // Validate token
    const token = getAuthToken(req);
    if (!token || !(await gateway.validateToken(sessionId, token))) {
      sendError(res, 401, 'Unauthorized');
      return;
    }
    
    // Refresh session on activity
    await gateway.refreshSession(sessionId);
    
    const url = new URL(req.url || '', 'http://localhost');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    
    const messages = await gateway.getMessageHistory(sessionId, Math.min(limit, config.maxHistory));
    
    sendJson(res, 200, {
      messages,
      hasMore: messages.length >= limit,
    });
  }
  
  /**
   * POST /send - Send a message
   */
  async function sendMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      sendError(res, 405, 'Method not allowed');
      return;
    }
    
    // Validate authorization
    const token = getAuthToken(req);
    const body = await parseBody<{ sessionId: string; content: string }>(req);
    
    if (!body?.sessionId || !body?.content) {
      sendError(res, 400, 'Missing sessionId or content');
      return;
    }
    
    if (!token || !(await gateway.validateToken(body.sessionId, token))) {
      sendError(res, 401, 'Unauthorized');
      return;
    }
    
    // Refresh session on activity
    await gateway.refreshSession(body.sessionId);
    
    const result = await gateway.sendMessage(body.sessionId, body.content, config);
    
    if (result.success) {
      sendJson(res, 200, {
        success: true,
        messageId: result.messageId,
      });
    } else {
      sendError(res, 500, result.error || 'Failed to send message');
    }
  }
  
  /**
   * GET /events - Server-Sent Events for real-time updates
   */
  async function events(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'GET') {
      sendError(res, 405, 'Method not allowed');
      return;
    }
    
    // Validate token
    const token = getAuthToken(req);
    const url = new URL(req.url || '', 'http://localhost');
    const sessionId = url.searchParams.get('sessionId');
    
    if (!sessionId || !token || !(await gateway.validateToken(sessionId, token))) {
      sendError(res, 401, 'Unauthorized');
      return;
    }
    
    // Refresh session
    await gateway.refreshSession(sessionId);
    
    // Set SSE headers
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', config.allowedOrigins?.join(', ') || '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');
    
    // Add to connections
    if (!sseConnections.has(sessionId)) {
      sseConnections.set(sessionId, new Set());
    }
    sseConnections.get(sessionId)!.add(res);
    
    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ sessionId })}\n\n`);
    
    // Handle client disconnect
    req.on('close', () => {
      const conns = sseConnections.get(sessionId);
      if (conns) {
        conns.delete(res);
        if (conns.size === 0) {
          sseConnections.delete(sessionId);
        }
      }
    });
  }
  
  /**
   * Broadcast event to all connected clients for a session
   */
  function broadcastToSession(sessionId: string, event: unknown): void {
    const conns = sseConnections.get(sessionId);
    if (!conns) return;
    
    const data = JSON.stringify(event);
    for (const res of conns) {
      try {
        res.write(`data: ${data}\n\n`);
      } catch {
        // Connection might be closed
      }
    }
  }
  
  return {
    health,
    createSession,
    getSessions,
    getSessionMessages,
    sendMessage,
    events,
    // Expose broadcast for gateway integration
    broadcastToSession,
  };
}
