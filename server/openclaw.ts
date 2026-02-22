/**
 * TinyWebChat Server - Integrated with OpenClaw Agent
 * 
 * This version integrates directly with OpenClaw's agent system.
 * Run: npx tsx server/openclaw.ts
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const PORT = 3008;

// In-memory storage
const sessions = new Map<string, WebchatSession>();
const messageQueues = new Map<string, WebchatMessage[]>();
const pendingJobs = new Map<string, { resolve: Function; reject: Function }>();

// Message processing mode: 'queue' (one at a time) or 'batch' (all together)
const PROCESSING_MODE = process.env.PROCESSING_MODE || 'queue';

// Track processing state per session
const sessionProcessing = new Map<string, boolean>();

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

// Call OpenClaw agent via CLI
async function callOpenClawAgent(message: string, sessionKey: string = 'main'): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use openclaw CLI to send a message
    const cli = spawn('npx', [
      'openclaw',
      'agent',
      '--message', message,
      '--session-id', sessionKey,
      '--json'
    ], {
      cwd: '/home/teric/dev/bot/openclaw/workspace-abc',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    cli.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    cli.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    cli.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          // Extract text from the result
          const text = result.result?.payloads?.[0]?.text || 
                       result.summary || 
                       'No response';
          resolve(text);
        } catch {
          resolve(stdout.substring(0, 500));
        }
      } else {
        reject(new Error(stderr || `Process exited with code ${code}`));
      }
    });

    cli.on('error', reject);
  });
}

/**
 * Process messages one at a time (QUEUE mode)
 * Only processes when not already processing this session
 */
async function processQueue(sessionId: string): Promise<void> {
  // Check if already processing
  if (sessionProcessing.get(sessionId)) {
    console.log(`[QUEUE] ${sessionId}: Already processing, message queued`);
    return;
  }
  
  // Mark as processing
  sessionProcessing.set(sessionId, true);
  broadcastToSession(sessionId, { type: 'typing', data: { isTyping: true } });
  
  try {
    // Get the latest user message that needs a response
    const queue = messageQueues.get(sessionId) || [];
    const lastUserMsg = [...queue].reverse().find(m => m.role === 'user');
    
    if (!lastUserMsg) {
      console.log(`[QUEUE] ${sessionId}: No user messages to process`);
      return;
    }
    
    // Check if already responded to this message
    const hasResponse = queue.some(m => m.role === 'assistant' && m.timestamp > lastUserMsg.timestamp);
    if (hasResponse) {
      console.log(`[QUEUE] ${sessionId}: Already responded to latest message`);
      return;
    }
    
    console.log(`[QUEUE] ${sessionId}: Processing "${lastUserMsg.content.substring(0, 30)}..."`);
    
    const response = await callOpenClawAgent(lastUserMsg.content);
    
    const assistantMsg: WebchatMessage = {
      id: generateId(),
      sessionId,
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    };
    queue.push(assistantMsg);
    messageQueues.set(sessionId, queue);
    
    broadcastToSession(sessionId, { type: 'message', data: assistantMsg });
    console.log(`[QUEUE] ${sessionId}: Response "${response.substring(0, 30)}..."`);
    
  } catch (err) {
    console.error(`[QUEUE] ${sessionId} ERROR:`, err);
    broadcastToSession(sessionId, { 
      type: 'error', 
      data: { message: err instanceof Error ? err.message : 'Unknown error' } 
    });
  } finally {
    sessionProcessing.set(sessionId, false);
    broadcastToSession(sessionId, { type: 'typing', data: { isTyping: false } });
  }
}

/**
 * Process all queued messages together (BATCH mode)
 * Sends all user messages as context to OpenClaw
 */
async function processBatch(sessionId: string): Promise<void> {
  if (sessionProcessing.get(sessionId)) {
    console.log(`[BATCH] ${sessionId}: Already processing, will batch on completion`);
    return;
  }
  
  sessionProcessing.set(sessionId, true);
  broadcastToSession(sessionId, { type: 'typing', data: { isTyping: true } });
  
  try {
    const queue = messageQueues.get(sessionId) || [];
    const userMessages = queue.filter(m => m.role === 'user');
    
    // Check if we already have a response for all messages
    const respondedCount = queue.filter(m => m.role === 'assistant').length;
    if (respondedCount >= userMessages.length) {
      console.log(`[BATCH] ${sessionId}: All messages already responded`);
      return;
    }
    
    // Build context from all messages
    const context = userMessages.map(m => `${m.role}: ${m.content}`).join('\n');
    console.log(`[BATCH] ${sessionId}: Processing ${userMessages.length} messages`);
    
    const response = await callOpenClawAgent(context);
    
    const assistantMsg: WebchatMessage = {
      id: generateId(),
      sessionId,
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    };
    queue.push(assistantMsg);
    messageQueues.set(sessionId, queue);
    
    broadcastToSession(sessionId, { type: 'message', data: assistantMsg });
    console.log(`[BATCH] ${sessionId}: Batch response "${response.substring(0, 30)}..."`);
    
  } catch (err) {
    console.error(`[BATCH] ${sessionId} ERROR:`, err);
    broadcastToSession(sessionId, { 
      type: 'error', 
      data: { message: err instanceof Error ? err.message : 'Unknown error' } 
    });
  } finally {
    sessionProcessing.set(sessionId, false);
    broadcastToSession(sessionId, { type: 'typing', data: { isTyping: false } });
  }
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
    res.end();
    return;
  }
  
  // Routes
  if (path === '/health') {
    sendJson(res, 200, { status: 'ok', timestamp: Date.now() });
    return;
  }
  
  if (path === '/v1/webchat/sessions' && req.method === 'POST') {
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
      expiresAt: session.createdAt + 3600000,
    });
    return;
  }
  
  if (path === '/v1/webchat/sessions' && req.method === 'GET') {
    const allSessions = Array.from(sessions.values()).map(s => ({
      id: s.id,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
    }));
    sendJson(res, 200, { sessions: allSessions, total: allSessions.length });
    return;
  }
  
  if (path.match(/^\/v1\/webchat\/sessions\/[\w_]+\/messages$/) && req.method === 'GET') {
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
    broadcastToSession(body.sessionId, { type: 'message', data: userMsg });
    
    console.log(`[MSG] ${body.sessionId}: ${body.content}`);
    
    // Send response immediately
    sendJson(res, 200, { success: true, messageId: userMsg.id, status: 'processing' });
    
    // Add to queue and process based on mode
    if (PROCESSING_MODE === 'batch') {
      // Batch mode: process all queued messages together
      processBatch(body.sessionId);
    } else {
      // Queue mode (default): process one at a time
      processQueue(body.sessionId);
    }
    return;
  }
  
  if (path === '/v1/webchat/events' && req.method === 'GET') {
    const sessionId = url.searchParams.get('sessionId');
    const token = getAuthToken(req);
    
    if (!sessionId || !token || !validateToken(sessionId, token)) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
    
    const session = sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
    }
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');
    
    if (!sseClients.has(sessionId)) {
      sseClients.set(sessionId, new Set());
    }
    sseClients.get(sessionId)!.add(res);
    
    res.write(`event: connected\ndata: ${JSON.stringify({ sessionId })}\n\n`);
    console.log(`[SSE] Client connected: ${sessionId}`);
    
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
  
  sendJson(res, 404, { error: 'Not found' });
}

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

const server = createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    console.error('Request error:', err);
    sendJson(res, 500, { error: 'Internal server error' });
  });
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║    TinyWebChat + OpenClaw Agent Server           ║
╠════════════════════════════════════════════════════╣
║  Server:   http://localhost:${PORT}                 ║
║                                                    ║
║  Endpoints:                                        ║
║  POST   /v1/webchat/sessions      - Create session║
║  POST   /v1/webchat/send          - Send message  ║
║  GET    /v1/webchat/events        - SSE stream    ║
║                                                    ║
║  Test: curl localhost:${PORT}/health               ║
╚════════════════════════════════════════════════════╝
  `);
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close(() => process.exit(0));
});
