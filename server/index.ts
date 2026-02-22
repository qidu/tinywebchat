/**
 * TinyWebChat Server - Standalone HTTP Server
 * 
 * This is a test server that simulates the webchat channel.
 * In production, this would be integrated into OpenClaw as a channel plugin.
 * 
 * Run: npx tsx server/index.ts
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import crypto from 'node:crypto';

const PORT = 3008;

// In-memory storage (would use OpenClaw session storage in production)
const sessions = new Map<string, WebchatSession>();
const messageQueues = new Map<string, WebchatMessage[]>();

interface WebchatSession {
  id: string;
  token: string;
  createdAt: number;
  lastActivityAt: number;
}

interface WebchatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Generate unique IDs
function generateId(): string {
  return `wc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

// Generate secure token
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Parse JSON body
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

// Send JSON response
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

// Get auth token from request
function getAuthToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

// Validate session token
function validateToken(sessionId: string, token: string): boolean {
  const session = sessions.get(sessionId);
  return session?.token === token;
}

// Simulated AI response (in production, calls OpenClaw agent)
async function getAgentResponse(userMessage: string): Promise<string> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const responses = [
    `I received: "${userMessage}". This is a test response from TinyWebChat!`,
    `Thanks for your message: "${userMessage}". How can I help you today?`,
    `Interesting! You said: "${userMessage}". Tell me more.`,
    `I understand: "${userMessage}". Let me think about that...`,
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

// SSE clients for real-time updates
const sseClients = new Map<string, Set<ServerResponse>>();

// HTTP request handler
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return;
  }
  
  // Routes
  if (path === '/health') {
    sendJson(res, 200, { status: 'ok', timestamp: Date.now() });
    return;
  }
  
  if (path === '/v1/webchat/sessions' && req.method === 'POST') {
    // Create new session
    const session: WebchatSession = {
      id: generateId(),
      token: generateToken(),
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };
    sessions.set(session.id, session);
    messageQueues.set(session.id, []);
    
    console.log(`[+] New session: ${session.id}`);
    
    sendJson(res, 201, {
      id: session.id,
      token: session.token,
      expiresAt: session.createdAt + 3600000, // 1 hour
    });
    return;
  }
  
  if (path === '/v1/webchat/sessions' && req.method === 'GET') {
    // List sessions (admin)
    const allSessions = Array.from(sessions.values()).map(s => ({
      id: s.id,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
    }));
    sendJson(res, 200, { sessions: allSessions, total: allSessions.length });
    return;
  }
  
  if (path.match(/^\/v1\/webchat\/sessions\/[\w_]+\/messages$/) && req.method === 'GET') {
    // Get session messages
    const sessionId = path.split('/')[4];
    const token = getAuthToken(req);
    
    if (!token || !validateToken(sessionId, token)) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
    
    const msgs = messageQueues.get(sessionId) || [];
    sendJson(res, 200, { messages: msgs, hasMore: false });
    return;
  }
  
  if (path === '/v1/webchat/send' && req.method === 'POST') {
    // Send message
    const body = await parseBody<{ sessionId: string; content: string }>(req);
    const token = getAuthToken(req);
    
    if (!body?.sessionId || !body?.content) {
      sendJson(res, 400, { error: 'Missing sessionId or content' });
      return;
    }
    
    if (!token || !validateToken(body.sessionId, token)) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
    
    // Update session activity
    const session = sessions.get(body.sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
    }
    
    // Store user message
    const userMsg: WebchatMessage = {
      id: generateId(),
      sessionId: body.sessionId,
      role: 'user',
      content: body.content,
      timestamp: Date.now(),
    };
    const queue = messageQueues.get(body.sessionId) || [];
    queue.push(userMsg);
    messageQueues.set(body.sessionId, queue);
    
    // Broadcast to SSE
    broadcastToSession(body.sessionId, { type: 'message', data: userMsg });
    
    // Get AI response
    console.log(`[MSG] ${body.sessionId}: ${body.content}`);
    const response = await getAgentResponse(body.content);
    
    // Store assistant message
    const assistantMsg: WebchatMessage = {
      id: generateId(),
      sessionId: body.sessionId,
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    };
    queue.push(assistantMsg);
    messageQueues.set(body.sessionId, queue);
    
    // Broadcast response
    broadcastToSession(body.sessionId, { type: 'message', data: assistantMsg });
    
    sendJson(res, 200, { success: true, messageId: assistantMsg.id });
    return;
  }
  
  if (path === '/v1/webchat/events' && req.method === 'GET') {
    // Server-Sent Events
    const sessionId = url.searchParams.get('sessionId');
    const token = getAuthToken(req);
    
    if (!sessionId || !token || !validateToken(sessionId, token)) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
    
    // Update session activity
    const session = sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
    }
    
    // Set SSE headers
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');
    
    // Add to clients
    if (!sseClients.has(sessionId)) {
      sseClients.set(sessionId, new Set());
    }
    sseClients.get(sessionId)!.add(res);
    
    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ sessionId })}\n\n`);
    
    console.log(`[SSE] Client connected: ${sessionId}`);
    
    // Handle disconnect
    req.on('close', () => {
      const clients = sseClients.get(sessionId);
      if (clients) {
        clients.delete(res);
        if (clients.size === 0) {
          sseClients.delete(sessionId);
        }
      }
      console.log(`[SSE] Client disconnected: ${sessionId}`);
    });
    return;
  }
  
  // 404 for unknown routes
  sendJson(res, 404, { error: 'Not found' });
}

// Broadcast event to all SSE clients for a session
function broadcastToSession(sessionId: string, event: unknown): void {
  const clients = sseClients.get(sessionId);
  if (!clients) return;
  
  const data = JSON.stringify(event);
  for (const res of clients) {
    try {
      res.write(`data: ${data}\n\n`);
    } catch {
      // Client disconnected
    }
  }
}

// Start server
const server = createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    console.error('Request error:', err);
    sendJson(res, 500, { error: 'Internal server error' });
  });
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║         TinyWebChat Test Server Started            ║
╠════════════════════════════════════════════════════╣
║  Server:   http://localhost:${PORT}                  ║
║                                                    ║
║  Endpoints:                                        ║
║  POST   /v1/webchat/sessions      - Create session ║
║  GET    /v1/webchat/sessions      - List sessions  ║
║  GET    /v1/webchat/sessions/:id  - Get messages   ║
║  POST   /v1/webchat/send          - Send message   ║
║  GET    /v1/webchat/events        - SSE stream     ║
║                                                    ║
║  Test: curl localhost:${PORT}/health               ║
╚════════════════════════════════════════════════════╝
  `);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close(() => process.exit(0));
});
