/**
 * TinyWebChat Channel Plugin - Type Definitions
 */

export interface WebchatConfig {
  /** Enable the webchat channel */
  enabled: boolean;
  
  /** Base URL for the channel (defaults to gateway URL) */
  baseUrl?: string;
  
  /** Server port (for standalone mode) */
  port?: number;
  
  /** Agent communication mode: 'cli' (spawn process) or 'plugin' (internal API) */
  agentMode: 'cli' | 'plugin';
  
  /** Workspace path for CLI mode (defaults to process.cwd()) */
  workspacePath?: string;
  
  /** Message processing mode: 'queue' or 'batch' */
  processingMode: 'queue' | 'batch';
  
  /** Session timeout in seconds */
  sessionTimeout: number;
  
  /** Maximum message history per session */
  maxHistory: number;
  
  /** Enable WeChat mini-program support */
  wechatMpEnabled: boolean;
  
  /** WeChat mini-program appId (optional) */
  wechatMpAppId?: string;
  
  /** Allow CORS origins (default: all) */
  allowedOrigins?: string[];
  
  /** Rate limiting - max requests per minute */
  rateLimit: number;
  
  /** Enable offline message queueing */
  offlineQueue: boolean;
  
  /** Maximum offline message queue size */
  maxOfflineQueue: number;
}

export interface WebchatSession {
  id: string;
  token: string;
  createdAt: number;
  lastActivityAt: number;
  metadata?: Record<string, unknown>;
}

export interface WebchatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: WebchatAttachment[];
}

export interface WebchatAttachment {
  id: string;
  type: 'image' | 'audio' | 'video' | 'file';
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface WebchatEvent {
  type: 'message' | 'typing' | 'error' | 'connected';
  data: unknown;
  timestamp: number;
}

export interface SendMessageRequest {
  sessionId: string;
  content: string;
  attachments?: File[];
}

export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SessionListResponse {
  sessions: WebchatSession[];
  total: number;
}

export interface MessageListResponse {
  messages: WebchatMessage[];
  hasMore: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_WEBCONFIG: WebchatConfig = {
  enabled: true,
  port: 18799,
  agentMode: 'cli',  // Default: CLI mode for standalone usage
  processingMode: 'queue',
  sessionTimeout: 3600, // 1 hour
  maxHistory: 100,
  wechatMpEnabled: true,
  allowedOrigins: ['*'],
  rateLimit: 60,
  offlineQueue: true,
  maxOfflineQueue: 50,
};
