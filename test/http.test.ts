import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHttpHandlers, broadcastToSession } from '../src/channels/plugins/webchat/http.js';
import { createWebchatGateway } from '../src/channels/plugins/webchat/gateway.js';
import type { WebchatConfig } from '../src/channels/plugins/webchat/types.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

describe('HTTP Handlers', () => {
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

  let gateway: ReturnType<typeof createWebchatGateway>;
  let handlers: ReturnType<typeof createHttpHandlers>;

  beforeEach(() => {
    gateway = createWebchatGateway({ config: mockConfig });
    handlers = createHttpHandlers(mockConfig, gateway);
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const req = { method: 'GET' } as IncomingMessage;
      const res = {
        statusCode: 0,
        headers: {} as Record<string, string>,
        setHeader: function(key: string, value: string) { this.headers[key] = value; },
        end: function(data: string) { this.body = data; },
        body: '',
      } as unknown as ServerResponse;

      await handlers.health(req, res);

      expect(res.statusCode).toBe(200);
      const body = JSON.parse((res as any).body);
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('timestamp');
    });

    it('should handle CORS preflight', async () => {
      const req = { method: 'OPTIONS' } as IncomingMessage;
      const res = {
        statusCode: 0,
        headers: {} as Record<string, string>,
        setHeader: function(key: string, value: string) { this.headers[key] = value; },
        end: vi.fn(),
      } as unknown as ServerResponse;

      await handlers.health(req, res);

      expect(res.statusCode).toBe(204);
    });
  });

  describe('Create Session', () => {
    it('should create new session', async () => {
      let bodyData = '';
      const req = {
        method: 'POST',
        on: vi.fn((event: string, cb: Function) => {
          if (event === 'end') cb();
        }),
      } as unknown as IncomingMessage;

      const res = {
        statusCode: 0,
        headers: {} as Record<string, string>,
        setHeader: function(key: string, value: string) { this.headers[key] = value; },
        end: function(data: string) { bodyData = data; },
      } as unknown as ServerResponse;

      await handlers.createSession(req, res);

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(bodyData);
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('expiresAt');
    });

    it('should reject non-POST methods', async () => {
      let bodyData = '';
      const req = { method: 'GET' } as IncomingMessage;
      const res = {
        statusCode: 0,
        headers: {} as Record<string, string>,
        setHeader: function(key: string, value: string) { this.headers[key] = value; },
        end: function(data: string) { bodyData = data; },
      } as unknown as ServerResponse;

      await handlers.createSession(req, res);

      expect(res.statusCode).toBe(405);
      const body = JSON.parse(bodyData);
      expect(body.error).toBe('Method not allowed');
    });
  });

  describe('List Sessions', () => {
    it('should list sessions', async () => {
      // Create a session first
      await gateway.createSession();

      let bodyData = '';
      const req = { method: 'GET' } as IncomingMessage;
      const res = {
        statusCode: 0,
        headers: {} as Record<string, string>,
        setHeader: function(key: string, value: string) { this.headers[key] = value; },
        end: function(data: string) { bodyData = data; },
      } as unknown as ServerResponse;

      await handlers.getSessions(req, res);

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(bodyData);
      expect(body).toHaveProperty('sessions');
      expect(body).toHaveProperty('total');
      expect(body.sessions.length).toBeGreaterThan(0);
    });
  });

  describe('Send Message', () => {
    it('should reject unauthorized requests', async () => {
      let bodyData = '';
      const req = {
        method: 'POST',
        headers: {},
        on: vi.fn((event: string, cb: Function) => {
          if (event === 'data') cb(JSON.stringify({ sessionId: 'test', content: 'Hello' }));
          if (event === 'end') cb();
        }),
      } as unknown as IncomingMessage;

      const res = {
        statusCode: 0,
        headers: {} as Record<string, string>,
        setHeader: function(key: string, value: string) { this.headers[key] = value; },
        end: function(data: string) { bodyData = data; },
      } as unknown as ServerResponse;

      await handlers.sendMessage(req, res);

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(bodyData);
      expect(body.error).toBe('Unauthorized');
    });

    it('should reject missing sessionId or content', async () => {
      let bodyData = '';
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
        on: vi.fn((event: string, cb: Function) => {
          if (event === 'data') cb(JSON.stringify({}));
          if (event === 'end') cb();
        }),
      } as unknown as IncomingMessage;

      const res = {
        statusCode: 0,
        headers: {} as Record<string, string>,
        setHeader: function(key: string, value: string) { this.headers[key] = value; },
        end: function(data: string) { bodyData = data; },
      } as unknown as ServerResponse;

      await handlers.sendMessage(req, res);

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(bodyData);
      expect(body.error).toBe('Missing sessionId or content');
    });
  });

  describe('Get Session Messages', () => {
    it('should reject invalid session ID', async () => {
      let bodyData = '';
      const req = {
        method: 'GET',
        headers: { authorization: 'Bearer invalid-token' },
      } as unknown as IncomingMessage;

      const res = {
        statusCode: 0,
        headers: {} as Record<string, string>,
        setHeader: function(key: string, value: string) { this.headers[key] = value; },
        end: function(data: string) { bodyData = data; },
      } as unknown as ServerResponse;

      await handlers.getSessionMessages(req, res, 'non-existent-session');

      expect(res.statusCode).toBe(401);
    });
  });
});

describe('Broadcast Function', () => {
  it('should not throw when no connections exist', () => {
    expect(() => broadcastToSession('test-session', { type: 'message' })).not.toThrow();
  });
});
