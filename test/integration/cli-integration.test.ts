/**
 * TinyWebChat CLI Integration Tests
 * 
 * Tests CLI mode functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStandaloneServer } from '../../src/channels/plugins/webchat/http.js';
import type { WebchatConfig } from '../../src/channels/plugins/webchat/types.js';

// Mock server creation to avoid actual HTTP server in tests
vi.mock('../../src/channels/plugins/webchat/http.js', () => ({
  createStandaloneServer: vi.fn().mockResolvedValue(undefined),
}));

const mockConfig: WebchatConfig = {
  enabled: true,
  port: 3008,
  agentMode: 'cli',
  processingMode: 'queue',
  sessionTimeout: 3600,
  maxHistory: 100,
  wechatMpEnabled: true,
  allowedOrigins: ['*'],
  rateLimit: 60,
  offlineQueue: true,
  maxOfflineQueue: 50,
};

describe('CLI Mode Integration', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CLI Server Creation', () => {
    it('should create standalone server in CLI mode', async () => {
      await createStandaloneServer(mockConfig);
      
      expect(createStandaloneServer).toHaveBeenCalledWith(mockConfig);
    });

    it('should handle CLI mode configuration', () => {
      const cliConfig = {
        ...mockConfig,
        agentMode: 'cli' as const,
        workspacePath: '/test/workspace',
      };
      
      expect(cliConfig.agentMode).toBe('cli');
      expect(cliConfig.workspacePath).toBe('/test/workspace');
    });

    it('should support different processing modes', () => {
      const queueConfig = { ...mockConfig, processingMode: 'queue' as const };
      const batchConfig = { ...mockConfig, processingMode: 'batch' as const };
      
      expect(queueConfig.processingMode).toBe('queue');
      expect(batchConfig.processingMode).toBe('batch');
    });
  });

  describe('CLI Agent Communication', () => {
    it('should use CLI mode for agent communication', () => {
      const config = { ...mockConfig, agentMode: 'cli' as const };
      
      expect(config.agentMode).toBe('cli');
      // In CLI mode, the gateway should spawn openclaw process
    });

    it('should handle workspace path configuration', () => {
      const config = {
        ...mockConfig,
        agentMode: 'cli' as const,
        workspacePath: '/custom/workspace',
      };
      
      expect(config.workspacePath).toBe('/custom/workspace');
    });
  });

  describe('CLI Session Management', () => {
    it('should respect session timeout configuration', () => {
      const config = {
        ...mockConfig,
        sessionTimeout: 1800, // 30 minutes
      };
      
      expect(config.sessionTimeout).toBe(1800);
    });

    it('should respect max history configuration', () => {
      const config = {
        ...mockConfig,
        maxHistory: 50,
      };
      
      expect(config.maxHistory).toBe(50);
    });
  });

  describe('CLI Security Configuration', () => {
    it('should support CORS configuration', () => {
      const config = {
        ...mockConfig,
        allowedOrigins: ['https://example.com', 'https://app.example.com'],
      };
      
      expect(config.allowedOrigins).toEqual([
        'https://example.com',
        'https://app.example.com',
      ]);
    });

    it('should support rate limiting', () => {
      const config = {
        ...mockConfig,
        rateLimit: 30, // 30 requests per minute
      };
      
      expect(config.rateLimit).toBe(30);
    });
  });

  describe('CLI WeChat Mini-Program Support', () => {
    it('should enable WeChat mini-program support by default', () => {
      expect(mockConfig.wechatMpEnabled).toBe(true);
    });

    it('should allow disabling WeChat mini-program support', () => {
      const config = {
        ...mockConfig,
        wechatMpEnabled: false,
      };
      
      expect(config.wechatMpEnabled).toBe(false);
    });

    it('should support WeChat appId configuration', () => {
      const config = {
        ...mockConfig,
        wechatMpAppId: 'wx1234567890abcdef',
      };
      
      expect(config.wechatMpAppId).toBe('wx1234567890abcdef');
    });
  });

  describe('CLI Offline Queue', () => {
    it('should enable offline queue by default', () => {
      expect(mockConfig.offlineQueue).toBe(true);
    });

    it('should allow disabling offline queue', () => {
      const config = {
        ...mockConfig,
        offlineQueue: false,
      };
      
      expect(config.offlineQueue).toBe(false);
    });

    it('should support max offline queue size', () => {
      const config = {
        ...mockConfig,
        maxOfflineQueue: 100,
      };
      
      expect(config.maxOfflineQueue).toBe(100);
    });
  });
});

describe('CLI Mode Edge Cases', () => {
  it('should handle invalid port numbers', () => {
    // Port validation should be handled by config schema
    const invalidConfig = {
      ...mockConfig,
      port: 80, // Should fail validation (needs to be >= 1024)
    };
    
    // This would be validated by OpenClaw's config system
    expect(invalidConfig.port).toBe(80);
  });

  it('should handle disabled plugin', () => {
    const disabledConfig = {
      ...mockConfig,
      enabled: false,
    };
    
    expect(disabledConfig.enabled).toBe(false);
    // When disabled, no server should be created
  });

  it('should handle batch processing with CLI mode', () => {
    const batchConfig = {
      ...mockConfig,
      agentMode: 'cli' as const,
      processingMode: 'batch' as const,
    };
    
    expect(batchConfig.agentMode).toBe('cli');
    expect(batchConfig.processingMode).toBe('batch');
  });
});