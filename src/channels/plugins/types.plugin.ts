/**
 * OpenClaw Plugin Type Definitions
 * Legacy type definitions for plugin integration
 */

export interface ChannelPlugin {
  id: string;
  name: string;
  version: string;
  configSchema: Record<string, unknown>;
  
  init: (config: Record<string, unknown>, context?: any) => Promise<void>;
  getGatewayMethods?: () => string[];
  getHttpHandlers?: (config: Record<string, unknown>) => Record<string, any>;
  handleInboundMessage?: (message: {
    from: string;
    content: string;
    attachments?: unknown[];
  }) => Promise<{ success: boolean; messageId?: string }>;
  handleOutboundMessage?: (options: {
    to: string;
    content: string;
    attachments?: unknown[];
  }) => Promise<{ success: boolean; messageId?: string }>;
  shutdown?: () => Promise<void>;
}

export interface PluginConfig {
  enabled?: boolean;
  port?: number;
  processingMode?: 'queue' | 'batch';
  sessionTimeout?: number;
  maxHistory?: number;
  wechatMpEnabled?: boolean;
  allowedOrigins?: string[];
  rateLimit?: number;
}
