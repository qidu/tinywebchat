/**
 * TinyWebChat Channel Plugin - Configuration Schema
 */

import type { WebchatConfig } from './types.js';

export const WEBCHAT_CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: true,
      description: 'Enable the webchat channel',
    },
    baseUrl: {
      type: 'string',
      description: 'Base URL for the channel (defaults to gateway URL)',
    },
    port: {
      type: 'number',
      default: 18799,
      minimum: 1024,
      maximum: 65535,
      description: 'Server port for HTTP endpoints',
    },
    processingMode: {
      type: 'string',
      enum: ['queue', 'batch'],
      default: 'queue',
      description: 'Message processing mode: queue (one at a time) or batch (grouped)',
    },
    sessionTimeout: {
      type: 'number',
      default: 3600,
      minimum: 60,
      maximum: 86400,
      description: 'Session timeout in seconds',
    },
    maxHistory: {
      type: 'number',
      default: 100,
      minimum: 10,
      maximum: 1000,
      description: 'Maximum message history per session',
    },
    wechatMpEnabled: {
      type: 'boolean',
      default: true,
      description: 'Enable WeChat mini-program support',
    },
    wechatMpAppId: {
      type: 'string',
      description: 'WeChat mini-program appId (optional)',
    },
    allowedOrigins: {
      type: 'array',
      items: { type: 'string' },
      default: ['*'],
      description: 'Allow CORS origins',
    },
    rateLimit: {
      type: 'number',
      default: 60,
      minimum: 10,
      maximum: 600,
      description: 'Rate limiting - max requests per minute',
    },
    offlineQueue: {
      type: 'boolean',
      default: true,
      description: 'Enable offline message queueing',
    },
    maxOfflineQueue: {
      type: 'number',
      default: 50,
      minimum: 10,
      maximum: 500,
      description: 'Maximum offline message queue size',
    },
  },
  additionalProperties: false,
} as const;

export function normalizeWebchatConfig(raw: unknown): WebchatConfig {
  const cfg = (raw as Record<string, unknown>) || {};
  
  return {
    enabled: cfg.enabled !== false,
    baseUrl: typeof cfg.baseUrl === 'string' ? cfg.baseUrl : undefined,
    port: typeof cfg.port === 'number' ? cfg.port : 18799,
    processingMode: (cfg.processingMode === 'batch' ? 'batch' : 'queue') as 'queue' | 'batch',
    sessionTimeout: typeof cfg.sessionTimeout === 'number' ? cfg.sessionTimeout : 3600,
    maxHistory: typeof cfg.maxHistory === 'number' ? cfg.maxHistory : 100,
    wechatMpEnabled: cfg.wechatMpEnabled !== false,
    wechatMpAppId: typeof cfg.wechatMpAppId === 'string' ? cfg.wechatMpAppId : undefined,
    allowedOrigins: Array.isArray(cfg.allowedOrigins) ? cfg.allowedOrigins : ['*'],
    rateLimit: typeof cfg.rateLimit === 'number' ? cfg.rateLimit : 60,
    offlineQueue: cfg.offlineQueue !== false,
    maxOfflineQueue: typeof cfg.maxOfflineQueue === 'number' ? cfg.maxOfflineQueue : 50,
  };
}
