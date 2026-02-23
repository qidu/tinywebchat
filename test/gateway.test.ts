import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createWebchatGateway, resetStorage } from '../src/channels/plugins/webchat/gateway.js';
import type { WebchatConfig } from '../src/channels/plugins/webchat/types.js';

// Mock child_process to avoid spawning real processes
const { mockSpawn } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
}));
vi.mock('node:child_process', () => ({
  spawn: mockSpawn,
}));

const mockConfig: WebchatConfig = {
  enabled: true,
  port: 18799,
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

describe('WebchatGateway', () => {

  let gateway: ReturnType<typeof createWebchatGateway>;

  beforeEach(() => {
    resetStorage();
    // Mock spawn to return a fake child process that immediately exits with success
    mockSpawn.mockClear();
    mockSpawn.mockReturnValue({
      stdout: { on: vi.fn((event, callback) => {
        if (event === 'data') callback(JSON.stringify({ result: { payloads: [{ text: 'Mock response' }] }, messageId: 'mock-id' }));
      }) },
      stderr: { on: vi.fn() },
      on: vi.fn((event, callback) => {
        if (event === 'close') setTimeout(() => callback(0), 0);
      }),
    });
    gateway = createWebchatGateway({ config: mockConfig });
  });

  describe('Session Management', () => {
    it('should create a new session', async () => {
      const session = await gateway.createSession();
      
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('token');
      expect(session.id).toMatch(/^wc_\d+_[a-f0-9]+$/);
      expect(session.token).toHaveLength(64); // 32 bytes hex
    });

    it('should validate correct token', async () => {
      const session = await gateway.createSession();
      const isValid = await gateway.validateToken(session.id, session.token);
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid token', async () => {
      const session = await gateway.createSession();
      const isValid = await gateway.validateToken(session.id, 'invalid-token');
      
      expect(isValid).toBe(false);
    });

    it('should reject token for non-existent session', async () => {
      const isValid = await gateway.validateToken('non-existent', 'some-token');
      
      expect(isValid).toBe(false);
    });

    it('should list all sessions', async () => {
      await gateway.createSession();
      await gateway.createSession();
      
      const sessions = await gateway.listSessions();
      
      expect(sessions).toHaveLength(2);
    });

    it('should refresh session activity', async () => {
      const session = await gateway.createSession();
      const originalActivity = session.lastActivityAt;
      
      // Wait a bit
      await new Promise(r => setTimeout(r, 10));
      
      await gateway.refreshSession(session.id);
      
      const refreshed = await gateway.listSessions();
      expect(refreshed[0].lastActivityAt).toBeGreaterThan(originalActivity);
    });
  });

  describe('Message Handling', () => {
    it('should store and retrieve messages', async () => {
      const session = await gateway.createSession();
      
      await gateway.sendMessage(session.id, 'Hello!', mockConfig);
      
      const messages = await gateway.getMessageHistory(session.id, 10);
      
      expect(messages).toHaveLength(2); // user message + pending indicator
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hello!');
    });

    it('should respect message history limit', async () => {
      const session = await gateway.createSession();
      
      await gateway.sendMessage(session.id, 'Message 1', mockConfig);
      await gateway.sendMessage(session.id, 'Message 2', mockConfig);
      await gateway.sendMessage(session.id, 'Message 3', mockConfig);
      
      const messages = await gateway.getMessageHistory(session.id, 2);
      
      expect(messages.length).toBeLessThanOrEqual(4); // 2 user + 2 responses
    });
  });

  describe('Event Broadcasting', () => {
    it('should set broadcast function', () => {
      const mockBroadcast = () => {};
      
      gateway.setBroadcastFn(mockBroadcast);
      
      // Should not throw
      expect(() => gateway.setBroadcastFn(mockBroadcast)).not.toThrow();
    });
  });
});

describe('Gateway with Plugin Mode', () => {
  const mockPluginConfig: WebchatConfig = {
    ...mockConfig,
    agentMode: 'plugin',
  };

  const mockChannelContext = {
    agent: {
      submit: async () => ({ content: 'Plugin response' }),
    },
    sessions: {
      getOrCreate: async () => ({ id: 'test-session' }),
    },
  };

  it('should use plugin mode when configured', () => {
    const gateway = createWebchatGateway({
      config: mockPluginConfig,
      channelContext: mockChannelContext,
    });

    expect(gateway).toBeDefined();
  });
});
