# TinyWebChat Implementation Plan

> Detailed implementation roadmap for the TinyWebChat channel plugin

## Overview

Create a lightweight webchat channel for OpenClaw optimized for:
- H5 mobile browsers
- WeChat Mini-Programs
- Environments without WebSocket support

## Why This Channel?

| Feature | Current Control UI | TinyWebChat |
|---------|-------------------|-------------|
| Protocol | WebSocket only | HTTP REST + SSE |
| Auth | Gateway token | Per-session token |
| Size | Full React app | <50kb total |
| WeChat MP | ❌ | ✅ |
| H5 Browser | ✅ (heavy) | ✅ (lightweight) |
| Offline support | ❌ | ✅ (queue & retry) |

---

## Phase 1: Channel Plugin Skeleton

### 1.1 Create Plugin Structure
```
src/channels/plugins/webchat/
├── index.ts         # Plugin entry point
├── config.ts        # Config schema (DONE ✓)
├── types.ts         # Type definitions (DONE ✓)
├── gateway.ts       # Gateway methods (DONE ✓)
├── http.ts          # HTTP endpoints (DONE ✓)
├── events.ts        # Event handlers
└── ui/              # Lightweight H5 UI
    ├── index.html   (DONE ✓)
    ├── app.js       (DONE ✓)
    └── styles.css   (DONE ✓)
```

### 1.2 Implement WebchatConfig Schema
```typescript
interface WebchatConfig {
  enabled: boolean;
  baseUrl?: string;
  sessionTimeout: number;      // default: 3600
  maxHistory: number;          // default: 100
  wechatMpEnabled: boolean;    // default: true
  wechatMpAppId?: string;
  allowedOrigins?: string[];   // default: ['*']
  rateLimit: number;           // default: 60/min
  offlineQueue: boolean;       // default: true
  maxOfflineQueue: number;     // default: 50
}
```

### 1.3 Add to Channel Catalog
Register the plugin in `src/channels/plugins/catalog.ts`

---

## Phase 2: HTTP API

### 2.1 REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/webchat/sessions` | POST | Create new session |
| `/v1/webchat/sessions` | GET | List sessions (admin) |
| `/v1/webchat/sessions/:id/messages` | GET | Get message history |
| `/v1/webchat/send` | POST | Send message to agent |
| `/v1/webchat/events` | GET | SSE for real-time |
| `/v1/webchat/health` | GET | Health check |

### 2.2 Authentication
- Token-based via `Authorization: Bearer <token>`
- Session tokens generated on creation
- Tokens expire after `sessionTimeout` seconds

### 2.3 SSE Implementation
```typescript
// Server-Sent Events for real-time messaging
// Works in WeChat Mini-Program and H5 browsers
GET /v1/webchat/events?sessionId=xxx
Authorization: Bearer <token>

// Response (text/event-stream)
event: connected
data: {"sessionId":"wc_xxx"}

event: message
data: {"role":"assistant","content":"Hello!","timestamp":1234567890}

event: typing
data: {"isTyping":true}
```

---

## Phase 3: WeChat Mini-Program Support

### 3.1 SDK Requirements
- Use `wx.request` for HTTP (not fetch)
- Use `wx.connectSocket` for WebSocket fallback
- No external dependencies
- Bundle size: <10kb

### 3.2 WeChat-specific Features
- [ ] Storage for session persistence
- [ ] WebSocket connection management
- [ ] Message queue for offline support

### 3.3 Mini-Program Template
```javascript
// utils/webchat-sdk.js
var WebChatSDK = require('./webchat-sdk.js');

Page({
  onLoad() {
    WebChatSDK.init({
      baseUrl: 'https://your-gateway.com'
    });
    
    WebChatSDK.startSession().then(() => {
      WebChatSDK.connectEvents();
    });
    
    WebChatSDK.onMessage((event) => {
      if (event.type === 'message') {
        this.setData({
          messages: [...this.data.messages, event.data]
        });
      }
    });
  },
  
  sendMessage(e) {
    WebChatSDK.sendMessage(e.detail.value);
  }
});
```

---

## Phase 4: H5 Optimizations

### 4.1 UI Targets
- Total size: <50kb (HTML + CSS + JS)
- First contentful paint: <1s on 3G
- Works offline (service worker)

### 4.2 Technology Choices
- No framework (vanilla JS)
- Preact for complex pages (optional)
- CSS Grid/Flexbox for layout

### 4.3 Mobile Optimizations
- Viewport meta tags
- Touch-friendly tap targets (44px min)
- Hardware-accelerated animations
- Dark mode support

---

## Integration with OpenClaw

### 5.1 Gateway Hooks
```typescript
// In gateway/server-http.ts
import { webchatPlugin } from './channels/plugins/webchat/index.js';

// Register routes
app.post('/v1/webchat/sessions', webchatPlugin.createSession);
app.post('/v1/webchat/send', webchatPlugin.sendMessage);
app.get('/v1/webchat/events', webchatPlugin.sseEvents);
```

### 5.2 Agent Integration
```typescript
// Messages flow through the agent system
webchat.sendMessage(sessionId, content)
  → gateway.sendToAgent(sessionKey, content, 'webchat')
  → agent.run()
  → response events
  → webchat.emit(sessionId, response)
```

---

## File Checklist

### Core Plugin
- [x] `src/channels/plugins/webchat/types.ts` - Type definitions
- [x] `src/channels/plugins/webchat/config.ts` - Config schema
- [x] `src/channels/plugins/webchat/gateway.ts` - Gateway methods
- [x] `src/channels/plugins/webchat/http.ts` - HTTP handlers
- [ ] `src/channels/plugins/webchat/events.ts` - Event emitter
- [x] `src/channels/plugins/webchat/index.ts` - Plugin entry

### UI
- [x] `src/channels/plugins/webchat/ui/index.html` - H5 HTML
- [x] `src/channels/plugins/webchat/ui/styles.css` - H5 CSS
- [x] `src/channels/plugins/webchat/ui/app.js` - H5 JS

### SDK
- [x] `sdk/webchat-sdk.js` - WeChat Mini-Program SDK
- [ ] `sdk/webchat-sdk.wxss` - WeChat styles (optional)

### Documentation
- [x] `README.md` - Overview
- [ ] `docs/api.md` - API reference
- [ ] `docs/wechat.md` - WeChat setup guide

---

## Testing Plan

### Unit Tests
- Config validation
- Token generation
- Message serialization
- Rate limiting

### Integration Tests
- Session lifecycle
- Message send/receive
- SSE connections
- Offline queue

### E2E Tests
- H5 browser chat flow
- WeChat mini-program flow
- Reconnection handling

---

## Deployment

### OpenClaw Config
```json
{
  "channels": {
    "webchat": {
      "enabled": true,
      "sessionTimeout": 3600,
      "maxHistory": 100,
      "wechatMpEnabled": true,
      "rateLimit": 60
    }
  }
}
```

### Gateway Routes
The plugin adds these routes to the gateway:
- `POST /v1/webchat/sessions`
- `POST /v1/webchat/send`
- `GET /v1/webchat/events`
- `GET /v1/webchat/sessions/:id/messages`

---

## Future Enhancements

- [ ] File attachments (image, audio, video)
- [ ] End-to-end encryption
- [ ] Message reactions
- [ ] Typing indicators (already in SSE)
- [ ] Read receipts
- [ ] Multi-session support
- [ ] Message search

---

## References

- [OpenClaw Channel Plugin System](https://docs.openclaw.ai/channels)
- [WeChat Mini-Program API](https://developers.weixin.qq.com/miniprogram/en/dev/api/)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
