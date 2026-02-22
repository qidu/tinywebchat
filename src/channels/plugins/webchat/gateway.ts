/**
 * TinyWebChat Gateway - Full implementation with CLI/Plugin dual mode support
 */

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import type { WebchatConfig, WebchatMessage, WebchatSession } from './types.js';

// In-memory storage (would use proper DB in production)
const sessions = new Map<string, WebchatSession>();
const messageQueues = new Map<string, WebchatMessage[]>();
const sessionProcessing = new Map<string, boolean>();

export interface AgentResponse {
  content: string;
  messageId?: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WebchatGateway {
  // Session management
  createSession: (metadata?: Record<string, unknown>) => Promise<WebchatSession>;
  listSessions: () => Promise<WebchatSession[]>;
  validateToken: (sessionId: string, token: string) => Promise<boolean>;
  refreshSession: (sessionId: string) => Promise<void>;
  
  // Message handling
  sendMessage: (sessionId: string, content: string, config: WebchatConfig) => Promise<SendMessageResult>;
  getMessageHistory: (sessionId: string, limit: number) => Promise<WebchatMessage[]>;
  
  // Events
  emitEvent: (sessionId: string, event: unknown) => void;
  setBroadcastFn: (fn: (sessionId: string, event: unknown) => void) => void;
}

export interface GatewayOptions {
  config: WebchatConfig;
  // Plugin mode: OpenClaw channel context
  channelContext?: {
    agent: {
      submit: (params: { sessionKey: string; message: string; channel: string }) => Promise<unknown>;
    };
    sessions: {
      getOrCreate: (sessionKey: string) => Promise<{ id: string }>;
    };
  };
}

// Broadcast function (set by http handlers)
let broadcastFn: ((sessionId: string, event: unknown) => void) | null = null;

/**
 * Create a full gateway implementation
 */
export function createWebchatGateway(options: GatewayOptions): WebchatGateway {
  const { config, channelContext } = options;

  return {
    // Session management
    async createSession(metadata?: Record<string, unknown>): Promise<WebchatSession> {
      const session: WebchatSession = {
        id: generateId(),
        token: generateToken(),
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        metadata,
      };
      
      sessions.set(session.id, session);
      messageQueues.set(session.id, []);
      
      return session;
    },

    async listSessions(): Promise<WebchatSession[]> {
      return Array.from(sessions.values());
    },

    async validateToken(sessionId: string, token: string): Promise<boolean> {
      const session = sessions.get(sessionId);
      return session?.token === token;
    },

    async refreshSession(sessionId: string): Promise<void> {
      const session = sessions.get(sessionId);
      if (session) {
        session.lastActivityAt = Date.now();
      }
    },

    // Message handling
    async sendMessage(
      sessionId: string, 
      content: string, 
      cfg: WebchatConfig
    ): Promise<SendMessageResult> {
      try {
        // Store user message
        const userMsg: WebchatMessage = {
          id: generateId(),
          sessionId,
          role: 'user',
          content,
          timestamp: Date.now(),
        };
        
        const queue = messageQueues.get(sessionId) || [];
        queue.push(userMsg);
        messageQueues.set(sessionId, queue);
        
        // Broadcast user message
        this.emitEvent(sessionId, { type: 'message', data: userMsg });
        
        // Process based on mode
        if (cfg.processingMode === 'batch') {
          await processBatch(sessionId, cfg, channelContext);
        } else {
          await processQueue(sessionId, cfg, channelContext);
        }
        
        return { success: true, messageId: userMsg.id };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    },

    async getMessageHistory(sessionId: string, limit: number): Promise<WebchatMessage[]> {
      const queue = messageQueues.get(sessionId) || [];
      return queue.slice(-limit);
    },

    // Events
    emitEvent(sessionId: string, event: unknown): void {
      if (broadcastFn) {
        broadcastFn(sessionId, event);
      }
    },

    setBroadcastFn(fn: (sessionId: string, event: unknown) => void): void {
      broadcastFn = fn;
    },
  };
}

/**
 * Process messages one at a time (QUEUE mode)
 */
async function processQueue(
  sessionId: string,
  config: WebchatConfig,
  channelContext?: GatewayOptions['channelContext']
): Promise<void> {
  if (sessionProcessing.get(sessionId)) {
    console.log(`[QUEUE] ${sessionId}: Already processing`);
    return;
  }
  
  sessionProcessing.set(sessionId, true);
  
  // Emit typing indicator
  if (broadcastFn) {
    broadcastFn(sessionId, { type: 'typing', data: { isTyping: true } });
  }
  
  try {
    const queue = messageQueues.get(sessionId) || [];
    const lastUserMsg = [...queue].reverse().find(m => m.role === 'user');
    
    if (!lastUserMsg) return;
    
    // Check if already responded
    const hasResponse = queue.some(m => 
      m.role === 'assistant' && m.timestamp > lastUserMsg.timestamp
    );
    if (hasResponse) return;
    
    // Send to agent
    const response = await sendToAgent(
      lastUserMsg.content, 
      'main', 
      config, 
      channelContext
    );
    
    // Store assistant message
    const assistantMsg: WebchatMessage = {
      id: generateId(),
      sessionId,
      role: 'assistant',
      content: response.content,
      timestamp: Date.now(),
    };
    queue.push(assistantMsg);
    messageQueues.set(sessionId, queue);
    
    // Broadcast response
    if (broadcastFn) {
      broadcastFn(sessionId, { type: 'message', data: assistantMsg });
    }
    
  } finally {
    sessionProcessing.set(sessionId, false);
    if (broadcastFn) {
      broadcastFn(sessionId, { type: 'typing', data: { isTyping: false } });
    }
  }
}

/**
 * Process all queued messages together (BATCH mode)
 */
async function processBatch(
  sessionId: string,
  config: WebchatConfig,
  channelContext?: GatewayOptions['channelContext']
): Promise<void> {
  if (sessionProcessing.get(sessionId)) {
    console.log(`[BATCH] ${sessionId}: Already processing`);
    return;
  }
  
  sessionProcessing.set(sessionId, true);
  
  if (broadcastFn) {
    broadcastFn(sessionId, { type: 'typing', data: { isTyping: true } });
  }
  
  try {
    const queue = messageQueues.get(sessionId) || [];
    const userMessages = queue.filter(m => m.role === 'user');
    
    if (userMessages.length === 0) return;
    
    // Build context
    const context = userMessages.map(m => m.content).join('\n');
    
    // Send to agent
    const response = await sendToAgent(context, 'main', config, channelContext);
    
    // Store response
    const assistantMsg: WebchatMessage = {
      id: generateId(),
      sessionId,
      role: 'assistant',
      content: response.content,
      timestamp: Date.now(),
    };
    queue.push(assistantMsg);
    messageQueues.set(sessionId, queue);
    
    // Broadcast
    if (broadcastFn) {
      broadcastFn(sessionId, { type: 'message', data: assistantMsg });
    }
    
  } finally {
    sessionProcessing.set(sessionId, false);
    if (broadcastFn) {
      broadcastFn(sessionId, { type: 'typing', data: { isTyping: false } });
    }
  }
}

/**
 * Send message to agent (routes to CLI or Plugin mode)
 */
async function sendToAgent(
  message: string,
  sessionKey: string,
  config: WebchatConfig,
  channelContext?: GatewayOptions['channelContext']
): Promise<AgentResponse> {
  if (config.agentMode === 'plugin' && channelContext) {
    return sendViaPlugin(message, sessionKey, channelContext);
  } else {
    return sendViaCLI(message, sessionKey, config);
  }
}

/**
 * Send via CLI (spawn openclaw process)
 */
async function sendViaCLI(
  message: string,
  sessionKey: string,
  config: WebchatConfig
): Promise<AgentResponse> {
  return new Promise((resolve, reject) => {
    const cli = spawn('openclaw', [
      'agent',
      '--message', message,
      '--session-id', sessionKey,
      '--json'
    ], {
      cwd: config.workspacePath || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    cli.stdout.on('data', (data) => { stdout += data.toString(); });
    cli.stderr.on('data', (data) => { stderr += data.toString(); });

    cli.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          const content = result.result?.payloads?.[0]?.text || 
                         result.summary || 
                         stdout.substring(0, 500);
          resolve({ content, messageId: result.messageId });
        } catch {
          resolve({ content: stdout.substring(0, 500) });
        }
      } else {
        reject(new Error(stderr || `Process exited with code ${code}`));
      }
    });

    cli.on('error', reject);
  });
}

/**
 * Send via Plugin API (OpenClaw internal)
 */
async function sendViaPlugin(
  message: string,
  sessionKey: string,
  context: NonNullable<GatewayOptions['channelContext']>
): Promise<AgentResponse> {
  try {
    await context.sessions.getOrCreate(sessionKey);
    
    const result = await context.agent.submit({
      sessionKey,
      message,
      channel: 'tinywebchat',
    });

    return { 
      content: extractResponseContent(result),
      messageId: (result as any)?.messageId 
    };
  } catch (error) {
    throw new Error(`Plugin agent error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract content from various response formats
 */
function extractResponseContent(result: unknown): string {
  if (!result) return 'No response';
  const r = result as any;
  
  if (r.result?.payloads?.[0]?.text) return r.result.payloads[0].text;
  if (r.summary) return r.summary;
  if (r.content) return r.content;
  if (r.text) return r.text;
  if (typeof r === 'string') return r;
  
  return JSON.stringify(result).substring(0, 500);
}

// Helpers
function generateId(): string {
  return `wc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
