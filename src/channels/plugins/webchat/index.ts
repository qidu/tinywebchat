/**
 * TinyWebChat Channel Plugin - Entry Point
 * 
 * This is the main plugin file that integrates with OpenClaw's
 * channel plugin system.
 */

import type { ChannelPlugin, ChannelPluginGateway, ChannelPluginConfig } from '../types.plugin.js';
import type { WebchatConfig } from './types.js';
import { normalizeWebchatConfig, WEBCHAT_CONFIG_SCHEMA } from './config.js';
import { createWebchatGateway } from './gateway.js';
import { createHttpHandlers } from './http.js';

/**
 * Webchat channel plugin for OpenClaw
 */
export const webchatPlugin: ChannelPlugin = {
  /** Unique plugin identifier */
  id: 'webchat',
  
  /** Human-readable name */
  name: 'TinyWebChat',
  
  /** Plugin version */
  version: '1.0.0',
  
  /** Config schema for validation */
  configSchema: WEBCHAT_CONFIG_SCHEMA,
  
  /**
   * Initialize the plugin with configuration
   */
  async init(config: ChannelPluginConfig): Promise<void> {
    const webchatConfig = normalizeWebchatConfig(config);
    
    if (!webchatConfig.enabled) {
      console.log('[webchat] Plugin disabled');
      return;
    }
    
    console.log('[webchat] Initializing TinyWebChat plugin...');
    console.log(`[webchat] Session timeout: ${webchatConfig.sessionTimeout}s`);
    console.log(`[webchat] Max history: ${webchatConfig.maxHistory}`);
    console.log(`[webchat] WeChat MP: ${webchatConfig.wechatMpEnabled ? 'enabled' : 'disabled'}`);
    
    // Initialize gateway
    const gateway = createWebchatGateway({
      sendToAgent: async (sessionKey, message, channel) => {
        // This would integrate with OpenClaw's agent system
        // For now, return a placeholder
        return `msg_${Date.now()}`;
      },
      getSession: async (sessionKey) => null,
      listSessions: async (channel) => [],
      getMessageHistory: async (sessionKey, limit) => [],
      emitEvent: (sessionId, event) => {
        // Would emit via SSE
      },
    });
    
    // Create HTTP handlers
    const handlers = createHttpHandlers(webchatConfig, gateway);
    
    // Register with OpenClaw's gateway
    // This is where we'd hook into the HTTP server
    console.log('[webchat] Plugin initialized');
  },
  
  /**
   * Get gateway methods exposed by this plugin
   */
  getGatewayMethods(): ChannelPluginGateway['gatewayMethods'] {
    return [
      'webchat.send',
      'webchat.createSession',
      'webchat.getMessages',
      'webchat.validateToken',
    ];
  },
  
  /**
   * Get HTTP handlers for custom routes
   */
  getHttpHandlers() {
    return {
      // Would return actual HTTP handlers
    };
  },
  
  /**
   * Handle incoming message
   */
  async handleInboundMessage(message: {
    from: string;
    content: string;
    attachments?: unknown[];
  }): Promise<{ success: boolean; messageId?: string }> {
    // Process incoming message from webchat
    return { success: true };
  },
  
  /**
   * Send outbound message
   */
  async handleOutboundMessage(options: {
    to: string;
    content: string;
    attachments?: unknown[];
  }): Promise<{ success: boolean; messageId?: string }> {
    // Send message via webchat
    return { success: true };
  },
  
  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[webchat] Shutting down...');
    // Clean up resources
  },
};

/**
 * Default configuration
 */
export const DEFAULT_WEBCONFIG: WebchatConfig = {
  enabled: true,
  sessionTimeout: 3600,
  maxHistory: 100,
  wechatMpEnabled: true,
  allowedOrigins: ['*'],
  rateLimit: 60,
  offlineQueue: true,
  maxOfflineQueue: 50,
};

export default webchatPlugin;
