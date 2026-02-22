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

## Quick Start

### Run the Server

```bash
# Clone and run
cd tinywebchat
npm run openclaw

# Or with custom port
PORT=3002 npm run openclaw
```

### Test with curl

```bash
# Create session
SESSION=$(curl -s -X POST http://localhost:3002/v1/webchat/sessions)
SESSION_ID=$(echo $SESSION | jq -r '.id')
TOKEN=$(echo $SESSION | jq -r '.token')

# Send message
curl -X POST http://localhost:3002/v1/webchat/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"content\": \"Hello!\"}"

# Get messages
curl http://localhost:3002/v1/webchat/sessions/$SESSION_ID/messages \
  -H "Authorization: Bearer $TOKEN"
```

### Test with Browser

Open `test-chat.html` in a browser to test the UI.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/v1/webchat/sessions` | POST | Create new session |
| `/v1/webchat/sessions` | GET | List all sessions |
| `/v1/webchat/send` | POST | Send message to agent |
| `/v1/webchat/sessions/:id/messages` | GET | Get message history |
| `/v1/webchat/events` | GET | SSE for real-time updates |

## Concurrent Message Processing

TinyWebChat handles concurrent messages in two modes:

### Queue Mode (Default)

Messages are processed **one at a time** per session. If multiple messages arrive while processing, they wait in queue.

```bash
PROCESSING_MODE=queue npm run openclaw
```

**Behavior:**
- User sends "msg1", "msg2", "msg3" simultaneously
- Agent processes "msg1" first
- "msg2", "msg3" wait in queue
- Agent processes each sequentially

### Batch Mode

All queued messages are combined into a **single context** and sent to the agent together.

```bash
PROCESSING_MODE=batch npm run openclaw
```

**Behavior:**
- User sends "msg1", "msg2", "msg3" simultaneously
- All messages combined: "user: msg1\nuser: msg2\nuser: msg3"
- Single agent call with full context
- Single response addressing all messages

### Comparison

| Mode | Use Case | Pros | Cons |
|------|----------|------|------|
| Queue | Sequential conversation | Simple, predictable | Slower for bursts |
| Batch | Fast Q&A, context-rich | Faster, more context | May miss nuance |

## File Structure

```
tinywebchat/
├── server/
│   ├── index.ts         # Standalone test server
│   └── openclaw.ts     # OpenClaw-integrated server
├── src/
│   └── channels/
│       └── plugins/
│           └── webchat/
│               ├── index.ts
│               ├── config.ts
│               ├── types.ts
│               ├── gateway.ts
│               ├── http.ts
│               └── ui/
│                   ├── index.html
│                   ├── app.js
│                   └── styles.css
├── sdk/
│   ├── webchat-sdk.js  # Browser SDK
│   └── wechat-demo/    # WeChat Mini-Program demo
├── test-chat.html      # Browser test UI
└── README.md
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3002 | Server port |
| `PROCESSING_MODE` | queue | Message processing: queue or batch |

## Session Architecture

TinyWebChat has **two layers of sessions**:

```
┌─────────────────────────────────────────────┐
│  TinyWebChat Session (Browser/WeChat)       │  ← Per-tab, in-memory
│  - Token auth                               │     Lost on page refresh
│  - Message history                          │
└─────────────────────────────────────────────┘
              │
              │ HTTP/SSE
              ▼
┌─────────────────────────────────────────────┐
│  OpenClaw Session (Agent)                   │  ← Persistent, shared
│  - Conversation context                     │     Currently uses 'main'
│  - Tool access                              │     (all tabs share context)
└─────────────────────────────────────────────┘
```

### Key Differences

| Aspect | TinyWebChat Session | OpenClaw Session |
|--------|--------------------|------------------|
| **Scope** | Per browser tab / WeChat page | Shared across all tabs |
| **Lifetime** | Until page refresh/close | Persistent in OpenClaw |
| **Storage** | In-memory Map | OpenClaw session storage |
| **Purpose** | Web connection, message queue | Agent context, memory |

**Note:** Currently all TinyWebChat sessions connect to a single OpenClaw session (`main`). This means multiple browser tabs share the same agent context. For isolation, each TinyWebChat session would need a unique OpenClaw session ID.

## Comparison

| Feature | Current Control UI | TinyWebChat |
|---------|-------------------|-------------|
| Protocol | WebSocket only | HTTP REST + SSE |
| Auth | Gateway token | Per-session token |
| Size | Full React app | <50kb total |
| WeChat MP | ❌ | ✅ |
| H5 Browser | ✅ (heavy) | ✅ (lightweight) |
| Concurrent handling | ❌ | ✅ (queue/batch) |

## WeChat Mini-Program

See `sdk/wechat-demo/` for a complete WeChat Mini-Program example.

## License

MIT

## Related

- [OpenClaw](https://github.com/openclaw/openclaw) - Main project
- [OpenClaw Channels](https://docs.openclaw.ai/channels) - Channel documentation
