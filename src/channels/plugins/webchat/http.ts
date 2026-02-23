/**
 * TinyWebChat HTTP Handlers and Standalone Server
 * 
 * Supports both plugin mode (registered routes) and CLI mode (standalone server)
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WebchatConfig } from './types.js';
import type { WebchatGateway } from './gateway.js';
import { createWebchatGateway } from './gateway.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SSE connections storage
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
 * Send JSON response with CORS headers
 */
function sendJson(
  res: ServerResponse, 
  status: number, 
  data: unknown,
  allowedOrigins: string[] = ['*']
): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.join(', '));
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

/**
 * Handle CORS preflight
 */
function handleCors(res: ServerResponse, allowedOrigins: string[]): void {
  res.statusCode = 204;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.join(', '));
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end();
}

/**
 * Extract Bearer token from Authorization header
 */
function getAuthToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

/**
 * Broadcast event to all SSE connections for a session
 */
export function broadcastToSession(sessionId: string, event: unknown): void {
  const conns = sseConnections.get(sessionId);
  if (!conns) return;
  
  const data = JSON.stringify(event);
  for (const res of conns) {
    try {
      res.write(`data: ${data}\n\n`);
    } catch {
      // Connection closed
    }
  }
}

/**
 * Create HTTP handlers for integration with OpenClaw or standalone use
 */
export function createHttpHandlers(config: WebchatConfig, gateway: WebchatGateway) {
  // Set broadcast function on gateway
  gateway.setBroadcastFn(broadcastToSession);

  return {
    /**
     * GET /health - Health check
     */
    async health(req: IncomingMessage, res: ServerResponse): Promise<void> {
      if (req.method === 'OPTIONS') {
        handleCors(res, config.allowedOrigins || ['*']);
        return;
      }
      sendJson(res, 200, { status: 'ok', timestamp: Date.now() }, config.allowedOrigins);
    },

    /**
     * POST /v1/webchat/sessions - Create new session
     */
    async createSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
      if (req.method === 'OPTIONS') {
        handleCors(res, config.allowedOrigins || ['*']);
        return;
      }
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' }, config.allowedOrigins);
        return;
      }

      const body = await parseBody<{ metadata?: Record<string, unknown> }>(req);
      const session = await gateway.createSession(body?.metadata);

      sendJson(res, 201, {
        id: session.id,
        token: session.token,
        expiresAt: session.createdAt + (config.sessionTimeout * 1000),
      }, config.allowedOrigins);
    },

    /**
     * GET /v1/webchat/sessions - List sessions
     */
    async getSessions(req: IncomingMessage, res: ServerResponse): Promise<void> {
      if (req.method === 'OPTIONS') {
        handleCors(res, config.allowedOrigins || ['*']);
        return;
      }
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' }, config.allowedOrigins);
        return;
      }

      const sessions = await gateway.listSessions();
      
      sendJson(res, 200, {
        sessions: sessions.map(s => ({
          id: s.id,
          createdAt: s.createdAt,
          lastActivityAt: s.lastActivityAt,
        })),
        total: sessions.length,
      }, config.allowedOrigins);
    },

    /**
     * GET /v1/webchat/sessions/:id/messages - Get message history
     */
    async getSessionMessages(req: IncomingMessage, res: ServerResponse, sessionId: string): Promise<void> {
      if (req.method === 'OPTIONS') {
        handleCors(res, config.allowedOrigins || ['*']);
        return;
      }
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' }, config.allowedOrigins);
        return;
      }

      const token = getAuthToken(req);
      if (!token || !(await gateway.validateToken(sessionId, token))) {
        sendJson(res, 401, { error: 'Unauthorized' }, config.allowedOrigins);
        return;
      }

      await gateway.refreshSession(sessionId);

      const url = new URL(req.url || '', 'http://localhost');
      const limit = Math.min(
        parseInt(url.searchParams.get('limit') || '50', 10),
        config.maxHistory
      );

      const messages = await gateway.getMessageHistory(sessionId, limit);

      sendJson(res, 200, { messages, hasMore: messages.length >= limit }, config.allowedOrigins);
    },

    /**
     * POST /v1/webchat/send - Send message
     */
    async sendMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
      if (req.method === 'OPTIONS') {
        handleCors(res, config.allowedOrigins || ['*']);
        return;
      }
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' }, config.allowedOrigins);
        return;
      }

      const token = getAuthToken(req);
      const body = await parseBody<{ sessionId: string; content: string }>(req);

      if (!body?.sessionId || !body?.content) {
        sendJson(res, 400, { error: 'Missing sessionId or content' }, config.allowedOrigins);
        return;
      }

      if (!token || !(await gateway.validateToken(body.sessionId, token))) {
        sendJson(res, 401, { error: 'Unauthorized' }, config.allowedOrigins);
        return;
      }

      await gateway.refreshSession(body.sessionId);

      const result = await gateway.sendMessage(body.sessionId, body.content, config);

      if (result.success) {
        sendJson(res, 200, { success: true, messageId: result.messageId }, config.allowedOrigins);
      } else {
        sendJson(res, 500, { error: result.error || 'Failed to send' }, config.allowedOrigins);
      }
    },

    /**
     * GET /v1/webchat/events - SSE for real-time updates
     */
    async sseEvents(req: IncomingMessage, res: ServerResponse): Promise<void> {
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' }, config.allowedOrigins);
        return;
      }

      // Debug logging
      console.log('[tinywebchat] SSE request:', req.url);
      
      const url = new URL(req.url || '', `http://localhost:${config.port}`);
      const sessionId = url.searchParams.get('sessionId');
      const token = url.searchParams.get('token') || getAuthToken(req);

      console.log('[tinywebchat] SSE sessionId:', sessionId, 'token:', token ? 'present' : 'missing');

      if (!sessionId || !token) {
        console.log('[tinywebchat] SSE auth failed: missing sessionId or token');
        res.statusCode = 401;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Unauthorized: missing sessionId or token');
        return;
      }

      const isValid = await gateway.validateToken(sessionId, token);
      console.log('[tinywebchat] SSE token valid:', isValid);
      
      if (!isValid) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Unauthorized: invalid token');
        return;
      }

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

      // Send initial event
      res.write(`event: connected\ndata: ${JSON.stringify({ sessionId })}\n\n`);

      // Handle disconnect
      req.on('close', () => {
        const conns = sseConnections.get(sessionId);
        if (conns) {
          conns.delete(res);
          if (conns.size === 0) {
            sseConnections.delete(sessionId);
          }
        }
      });
    },
  };
}

/**
 * Create standalone HTTP server (for CLI mode)
 */
export async function createStandaloneServer(config: WebchatConfig): Promise<void> {
  const gateway = createWebchatGateway({ config });
  const handlers = createHttpHandlers(config, gateway);

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://localhost:${config.port}`);
      const path = url.pathname;

      // Route handling
      // Serve tinywebchat.html at root path
      if (path === '/' || path === '/tinywebchat.html') {
        // Try multiple paths for both dev (src) and production (dist)
        const possiblePaths = [
          join(__dirname, '../../../../tinywebchat.html'),   // dev: src/channels/plugins/webchat -> project root
          join(__dirname, '../../../tinywebchat.html'),       // prod: dist/channels/plugins/webchat -> dist root
        ];
        
        for (const htmlPath of possiblePaths) {
          if (existsSync(htmlPath)) {
            const html = readFileSync(htmlPath, 'utf-8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Access-Control-Allow-Origin', config.allowedOrigins?.join(', ') || '*');
            res.end(html);
            return;
          }
        }
        
        // If file not found, return 404
        sendJson(res, 404, { error: 'Chat UI not found. Please ensure tinywebchat.html is deployed.' }, config.allowedOrigins);
        return;
      }

      if (path === '/health') {
        await handlers.health(req, res);
      } else if (path === '/v1/webchat/sessions' && req.method === 'POST') {
        await handlers.createSession(req, res);
      } else if (path === '/v1/webchat/sessions' && req.method === 'GET') {
        await handlers.getSessions(req, res);
      } else if (path.match(/^\/v1\/webchat\/sessions\/[^/]+\/messages$/)) {
        const sessionId = path.split('/')[4];
        await handlers.getSessionMessages(req, res, sessionId);
      } else if (path === '/v1/webchat/send') {
        await handlers.sendMessage(req, res);
      } else if (path === '/v1/webchat/events') {
        await handlers.sseEvents(req, res);
      } else {
        sendJson(res, 404, { error: 'Not found' }, config.allowedOrigins);
      }
    } catch (err) {
      console.error('Request error:', err);
      sendJson(res, 500, { error: 'Internal server error' }, config.allowedOrigins);
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(config.port, () => {
      console.log(`
╔════════════════════════════════════════════════════╗
║         TinyWebChat Server Started                 ║
╠════════════════════════════════════════════════════╣
║  Mode:      ${config.agentMode.toUpperCase().padEnd(39)}║
║  Port:      ${String(config.port).padEnd(39)}║
║  Processing: ${config.processingMode.toUpperCase().padEnd(38)}║
╠════════════════════════════════════════════════════╣
║  Endpoints:                                        ║
║  POST   /v1/webchat/sessions      - Create session ║
║  GET    /v1/webchat/sessions      - List sessions  ║
║  GET    /v1/webchat/sessions/:id  - Get messages   ║
║  POST   /v1/webchat/send          - Send message   ║
║  GET    /v1/webchat/events        - SSE stream     ║
║                                                    ║
║  Test:  curl localhost:${String(config.port).padEnd(26)}║
╚════════════════════════════════════════════════════╝
      `);
      resolve();
    });

    server.on('error', reject);
  });
}
