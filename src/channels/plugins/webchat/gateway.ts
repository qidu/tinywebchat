/**
 * TinyWebChat Channel Plugin - Gateway Methods
 * 
 * Handles sending/receiving messages through OpenClaw's gateway system
 */

import type { WebchatConfig, WebchatMessage, WebchatSession } from './types.js';

export interface WebchatGatewayDeps {
  /** Send a message to the agent */
  sendToAgent: (sessionKey: string, message: string, channel: string) => Promise<string>;
  
  /** Get session by ID */
  getSession: (sessionKey: string) => Promise<unknown>;
  
  /** List all sessions */
  listSessions: (channel: string) => Promise<string[]>;
  
  /** Get message history for a session */
  getMessageHistory: (sessionKey: string, limit: number) => Promise<WebchatMessage[]>;
  
  /** Emit an event to connected clients */
  emitEvent: (sessionId: string, event: unknown) => void;
}

/**
 * Create gateway methods for the webchat channel
 */
export function createWebchatGateway(deps: WebchatGatewayDeps) {
  const CHANNEL_NAME = 'webchat';
  
  /**
   * Create a new session
   */
  async function createSession(metadata?: Record<string, unknown>): Promise<WebchatSession> {
    const sessionId = generateSessionId();
    const token = generateToken();
    const now = Date.now();
    
    const session: WebchatSession = {
      id: sessionId,
      token,
      createdAt: now,
      lastActivityAt: now,
      metadata,
    };
    
    // Store session (depends on OpenClaw's session storage)
    // This would integrate with OpenClaw's session management
    
    return session;
  }
  
  /**
   * Send a message from a webchat session
   */
  async function sendMessage(
    sessionId: string, 
    content: string, 
    config: WebchatConfig
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Get the session key for this webchat session
      const sessionKey = `webchat:${sessionId}`;
      
      // Send to the agent via OpenClaw's gateway
      const messageId = await deps.sendToAgent(sessionKey, content, CHANNEL_NAME);
      
      return {
        success: true,
        messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Get session information
   */
  async function getSession(sessionId: string): Promise<WebchatSession | null> {
    try {
      const sessionKey = `webchat:${sessionId}`;
      const session = await deps.getSession(sessionKey);
      
      if (!session) return null;
      
      // Transform to WebchatSession format
      return session as WebchatSession;
    } catch {
      return null;
    }
  }
  
  /**
   * List all webchat sessions
   */
  async function listSessions(): Promise<WebchatSession[]> {
    const sessionKeys = await deps.listSessions(CHANNEL_NAME);
    
    const sessions: WebchatSession[] = [];
    for (const key of sessionKeys) {
      const session = await deps.getSession(key);
      if (session) {
        sessions.push(session as WebchatSession);
      }
    }
    
    return sessions;
  }
  
  /**
   * Get message history for a session
   */
  async function getMessageHistory(
    sessionId: string, 
    limit: number = 50
  ): Promise<WebchatMessage[]> {
    const sessionKey = `webchat:${sessionId}`;
    return deps.getMessageHistory(sessionKey, limit);
  }
  
  /**
   * Handle incoming message from agent
   */
  function handleAgentMessage(sessionId: string, message: WebchatMessage): void {
    deps.emitEvent(sessionId, {
      type: 'message',
      data: message,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Handle typing indicator from agent
   */
  function handleTyping(sessionId: string, isTyping: boolean): void {
    deps.emitEvent(sessionId, {
      type: 'typing',
      data: { isTyping },
      timestamp: Date.now(),
    });
  }
  
  /**
   * Validate session token
   */
  async function validateToken(sessionId: string, token: string): Promise<boolean> {
    const session = await getSession(sessionId);
    return session?.token === token;
  }
  
  /**
   * Refresh session expiration
   */
  async function refreshSession(sessionId: string): Promise<boolean> {
    const session = await getSession(sessionId);
    if (!session) return false;
    
    // Update last activity timestamp
    // This would update the session in storage
    return true;
  }
  
  /**
   * Close/delete a session
   */
  async function closeSession(sessionId: string): Promise<boolean> {
    // Clean up session resources
    return true;
  }
  
  return {
    createSession,
    sendMessage,
    getSession,
    listSessions,
    getMessageHistory,
    handleAgentMessage,
    handleTyping,
    validateToken,
    refreshSession,
    closeSession,
  };
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `wc_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Generate a secure token
 */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export type WebchatGateway = ReturnType<typeof createWebchatGateway>;
