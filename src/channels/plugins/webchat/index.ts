/**
 * TinyWebChat Channel Plugin - Entry Point
 * 
 * Supports two modes:
 * - CLI mode (default): Spawns openclaw agent process (standalone server)
 * - Plugin mode: Uses OpenClaw's internal agent API (integrated)
 */

import type { ChannelPlugin } from '../types.plugin.js';
import type { WebchatConfig } from './types.js';
import { normalizeWebchatConfig, WEBCHAT_CONFIG_SCHEMA } from './config.js';
import { createWebchatGateway } from './gateway.js';
import { createHttpHandlers, createStandaloneServer, broadcastToSession } from './http.js';

/**
 * Webchat channel plugin for OpenClaw
 */
export const webchatPlugin: ChannelPlugin = {
  id: 'tinywebchat',
  name: 'TinyWebChat',
  version: '1.0.0',
  configSchema: WEBCHAT_CONFIG_SCHEMA,
  
  /**
   * Initialize the plugin with configuration
   */
  async init(config: Record<string, unknown>, context?: any): Promise<void> {
    const webchatConfig = normalizeWebchatConfig(config);
    
    if (!webchatConfig.enabled) {
      console.log('[tinywebchat] Plugin disabled');
      return;
    }
    
    console.log('[tinywebchat] Initializing...');
    console.log(`[tinywebchat] Agent mode: ${webchatConfig.agentMode}`);
    console.log(`[tinywebchat] Processing: ${webchatConfig.processingMode}`);
    
    if (webchatConfig.agentMode === 'cli') {
      // CLI mode: Start standalone HTTP server that spawns openclaw process
      console.log('[tinywebchat] Starting standalone server (CLI mode)...');
      await createStandaloneServer(webchatConfig);
    } else {
      // Plugin mode: Integrate with OpenClaw's internal systems
      console.log('[tinywebchat] Registering as OpenClaw plugin...');
      await initPluginMode(webchatConfig, context);
    }
  },
  
  /**
   * Get gateway methods exposed by this plugin
   */
  getGatewayMethods(): string[] {
    return [
      'tinywebchat.send',
      'tinywebchat.createSession',
      'tinywebchat.getMessages',
      'tinywebchat.validateToken',
    ];
  },
  
  /**
   * Get HTTP handlers for custom routes (plugin mode)
   */
  getHttpHandlers(config: Record<string, unknown>) {
    const webchatConfig = normalizeWebchatConfig(config);
    const gateway = createWebchatGateway({ config: webchatConfig });
    return createHttpHandlers(webchatConfig, gateway);
  },
  
  /**
   * Handle incoming message (from OpenClaw to webchat)
   */
  async handleInboundMessage(message: {
    from: string;
    content: string;
    attachments?: unknown[];
  }): Promise<{ success: boolean; messageId?: string }> {
    // Process incoming message from agent to webchat user
    console.log('[tinywebchat] Inbound message:', message);
    return { success: true };
  },
  
  /**
   * Send outbound message (from webchat to OpenClaw)
   */
  async handleOutboundMessage(options: {
    to: string;
    content: string;
    attachments?: unknown[];
  }): Promise<{ success: boolean; messageId?: string }> {
    // Send message via webchat
    console.log('[tinywebchat] Outbound message:', options);
    return { success: true };
  },
  
  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[tinywebchat] Shutting down...');
    // Clean up resources
  },
};

/**
 * Initialize in plugin mode - integrate with OpenClaw internals
 */
async function initPluginMode(config: WebchatConfig, context: any) {
  if (!context) {
    console.warn('[tinywebchat] No context provided, falling back to CLI mode');
    await createStandaloneServer(config);
    return;
  }
  
  // Create gateway that uses OpenClaw's internal agent API
  const channelContext = {
    agent: context.agent || {
      submit: async (params: any) => {
        console.warn('[tinywebchat] No agent context available');
        return { content: 'Agent not available' };
      }
    },
    sessions: context.sessions || {
      getOrCreate: async (key: string) => ({ id: key })
    },
  };
  
  const gateway = createWebchatGateway({
    config,
    channelContext,
  });
  
  // Register HTTP routes with OpenClaw's gateway
  if (context.http && context.http.register) {
    const handlers = createHttpHandlers(config, gateway);
    
    context.http.register({
      path: '/v1/webchat/sessions',
      method: 'POST',
      handler: handlers.createSession,
    });
    
    context.http.register({
      path: '/v1/webchat/sessions',
      method: 'GET',
      handler: handlers.getSessions,
    });
    
    context.http.register({
      path: '/v1/webchat/sessions/:id/messages',
      method: 'GET',
      handler: (req: any, res: any, params: any) => 
        handlers.getSessionMessages(req, res, params.id),
    });
    
    context.http.register({
      path: '/v1/webchat/send',
      method: 'POST',
      handler: handlers.sendMessage,
    });
    
    context.http.register({
      path: '/v1/webchat/events',
      method: 'GET',
      handler: handlers.sseEvents,
    });
    
    context.http.register({
      path: '/health',
      method: 'GET',
      handler: handlers.health,
    });
    
    console.log('[tinywebchat] HTTP routes registered with OpenClaw');
  }
  
  console.log('[tinywebchat] Plugin mode initialized');
}

// Export for direct use
export { createWebchatGateway, createHttpHandlers, createStandaloneServer };
export { normalizeWebchatConfig, WEBCHAT_CONFIG_SCHEMA };
export type { WebchatConfig };

export default webchatPlugin;

// OpenClaw plugin activation entry point
export function register(api: any): void {
  console.log('[tinywebchat] Registering plugin...');
  
  // Register as a channel plugin
  if (api.registerChannel) {
    api.registerChannel({
      plugin: webchatPlugin,
    });
  }
  
  console.log('[tinywebchat] Plugin registered successfully');
}
