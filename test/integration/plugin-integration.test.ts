/**
 * TinyWebChat Plugin Integration Tests
 * 
 * Tests integration with OpenClaw plugin system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { webchatPlugin } from '../../src/channels/plugins/webchat/index.js';
import type { WebchatConfig } from '../../src/channels/plugins/webchat/types.js';

describe('Plugin Integration', () => {
  const mockConfig: WebchatConfig = {
    enabled: true,
    port: 3008,
    agentMode: 'plugin',
    processingMode: 'queue',
    sessionTimeout: 3600,
    maxHistory: 100,
    wechatMpEnabled: true,
    allowedOrigins: ['*'],
    rateLimit: 60,
    offlineQueue: true,
    maxOfflineQueue: 50,
  };

  const mockContext = {
    agent: {
      submit: vi.fn().mockResolvedValue({
        content: 'Test response from OpenClaw agent',
        messageId: 'test-message-id',
      }),
    },
    sessions: {
      getOrCreate: vi.fn().mockResolvedValue({ id: 'test-session' }),
    },
    http: {
      register: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup
    vi.restoreAllMocks();
  });

  describe('Plugin Initialization', () => {
    it('should initialize plugin with context', async () => {
      await webchatPlugin.init(mockConfig, mockContext);
      
      expect(mockContext.http.register).toHaveBeenCalled();
      expect(mockContext.http.register).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/v1/webchat/sessions',
          method: 'POST',
        })
      );
    });

    it('should fall back to CLI mode when no context provided', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      
      await webchatPlugin.init(mockConfig, undefined);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[tinywebchat] No context provided, falling back to CLI mode'
      );
    });

    it('should skip initialization when disabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const disabledConfig = { ...mockConfig, enabled: false };
      
      await webchatPlugin.init(disabledConfig, mockContext);
      
      expect(consoleSpy).toHaveBeenCalledWith('[tinywebchat] Plugin disabled');
      expect(mockContext.http.register).not.toHaveBeenCalled();
    });
  });

  describe('Plugin Gateway Methods', () => {
    it('should expose correct gateway methods', () => {
      const methods = webchatPlugin.getGatewayMethods();
      
      expect(methods).toEqual([
        'tinywebchat.send',
        'tinywebchat.createSession',
        'tinywebchat.getMessages',
        'tinywebchat.validateToken',
      ]);
    });
  });

  describe('Plugin HTTP Handlers', () => {
    it('should return HTTP handlers for plugin mode', () => {
      const handlers = webchatPlugin.getHttpHandlers(mockConfig);
      
      expect(handlers).toHaveProperty('health');
      expect(handlers).toHaveProperty('createSession');
      expect(handlers).toHaveProperty('getSessions');
      expect(handlers).toHaveProperty('sendMessage');
      expect(handlers).toHaveProperty('sseEvents');
    });

    it('should handle CORS configuration', async () => {
      const customConfig = {
        ...mockConfig,
        allowedOrigins: ['https://example.com', 'https://app.example.com'],
      };
      
      const handlers = webchatPlugin.getHttpHandlers(customConfig);
      
      // The handlers should respect CORS configuration
      expect(handlers).toBeDefined();
    });
  });

  describe('Plugin Message Handling', () => {
    it('should handle inbound messages', async () => {
      const result = await webchatPlugin.handleInboundMessage({
        from: 'test-user',
        content: 'Test message',
      });
      
      expect(result).toEqual({ success: true });
    });

    it('should handle outbound messages', async () => {
      const result = await webchatPlugin.handleOutboundMessage({
        to: 'test-session',
        content: 'Test message',
      });
      
      expect(result).toEqual({ success: true });
    });
  });

  describe('Plugin Shutdown', () => {
    it('should handle shutdown gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      await webchatPlugin.shutdown();
      
      expect(consoleSpy).toHaveBeenCalledWith('[tinywebchat] Shutting down...');
    });
  });
});

describe('Plugin Configuration Schema', () => {
  it('should have valid configuration schema', () => {
    const schema = webchatPlugin.configSchema;
    
    expect(schema).toBeDefined();
    expect(schema.type).toBe('object');
    expect(schema.properties).toBeDefined();
    expect(schema.properties.enabled).toBeDefined();
    expect(schema.properties.port).toBeDefined();
    expect(schema.properties.agentMode).toBeDefined();
  });

  it('should validate configuration defaults', () => {
    const schema = webchatPlugin.configSchema;
    
    expect(schema.properties.enabled.default).toBe(true);
    expect(schema.properties.port.default).toBe(18799);
    expect(schema.properties.agentMode.default).toBe('cli');
    expect(schema.properties.processingMode.default).toBe('queue');
  });
});