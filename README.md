# TinyWebChat - OpenClaw Lightweight Web Channel

> Lightweight webchat channel for OpenClaw - optimized for H5 browsers & WeChat mini-programs

## Overview

This is a new channel plugin for [OpenClaw](https://github.com/openclaw/openclaw) that provides a lightweight, mobile-first chat interface designed for:

- 📱 **H5 Mobile Browsers** - Lightweight web interface
- 💬 **WeChat Mini-Programs** - Native-like experience in WeChat
- 🔌 **REST + SSE** - No WebSocket dependency (works in restricted environments)

## Why a New Channel?

OpenClaw already has a "webchat" concept, but it's:
- **WebSocket-only** - Requires persistent connection (blocked in many environments)
- **Control UI** - Full-featured admin interface, not user-facing
- **Internal** - Not exposed as a pluggable channel

This project creates a proper channel plugin that's:
- ✨ **Lightweight** - <50kb total UI
- 🔒 **Secure** - Per-session token auth
- 🌐 **Universal** - Works where WebSockets don't

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  OpenClaw Gateway                        │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ WhatsApp    │  │ Telegram    │  │ TinyWebChat     │  │
│  │ Plugin      │  │ Plugin      │  │ Plugin          │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│         │                │                  │            │
│         └────────────────┼──────────────────┘            │
│                          │                               │
│                   Channel Registry                       │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   ┌─────────┐       ┌──────────┐      ┌────────────┐
   │ WeChat  │       │  H5 App  │      │ Mini-Prog  │
   │ Mini-Prog│      │ (Mobile) │      │ (WeChat)   │
   └─────────┘       └──────────┘      └────────────┘
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/webchat/send` | POST | Send message to agent |
| `/v1/webchat/sessions` | GET | List sessions |
| `/v1/webchat/sessions/:id/messages` | GET | Get message history |
| `/v1/webchat/events` | GET | SSE for incoming messages |

## Implementation Phases

### Phase 1: Channel Plugin Skeleton
- [ ] Create `/src/channels/plugins/webchat/`
- [ ] Implement `WebchatConfig` schema
- [ ] Add to channel catalog

### Phase 2: HTTP API
- [ ] REST endpoints (send, sessions, messages)
- [ ] SSE for real-time events
- [ ] Token-based authentication

### Phase 3: WeChat Mini-Program Support
- [ ] Simple JS SDK (~10kb)
- [ ] Compatible with WeChat's limited JS environment
- [ ] Token-based auth (no WS)

### Phase 4: H5 Optimizations
- [ ] Minimal CSS (<20kb)
- [ ] Preact instead of React
- [ ] Lazy loading

## File Structure

```
tinywebchat/
├── src/
│   └── channels/
│       └── plugins/
│           └── webchat/
│               ├── index.ts              # Plugin entry
│               ├── config.ts             # Config schema
│               ├── types.ts              # Type definitions  
│               ├── gateway.ts            # Gateway methods
│               ├── http.ts               # HTTP endpoints
│               ├── events.ts             # Event handlers
│               └── ui/                   # Lightweight H5 UI
│                   ├── index.html
│                   ├── app.js
│                   └── styles.css
├── sdk/                                  # WeChat Mini-Program SDK
│   ├── webchat-sdk.js
│   └── README.md
├── docs/
│   └── api.md
└── README.md
```

## Comparison

| Feature | Current Control UI | TinyWebChat |
|---------|-------------------|-------------|
| Protocol | WebSocket only | HTTP REST + SSE |
| Auth | Gateway token | Per-session token |
| Size | Full React app | <50kb total |
| WeChat MP | ❌ | ✅ |
| H5 Browser | ✅ (heavy) | ✅ (lightweight) |
| Offline support | ❌ | ✅ (queue & retry) |

## Usage

### WeChat Mini-Program
```javascript
import { WebChatSDK } from './webchat-sdk';

const sdk = new WebChatSDK({
  baseUrl: 'https://your-gateway.com',
  token: 'user-session-token'
});

// Send message
sdk.sendMessage('Hello!').then(msg => console.log(msg));

// Subscribe to responses
sdk.onMessage(msg => {
  console.log('Received:', msg.content);
});
```

### H5 Browser
```html
<script src="webchat.min.js"></script>
<div id="chat-container"></div>
<script>
  WebChat.init({
    container: '#chat-container',
    token: 'user-session-token'
  });
</script>
```

## Requirements

- OpenClaw Gateway 2026.x+
- Node.js 20+
- For WeChat Mini-Program: WeChat DevTools

## License

MIT

## Related

- [OpenClaw](https://github.com/openclaw/openclaw) - Main project
- [OpenClaw Channels](https://docs.openclaw.ai/channels) - Channel documentation
