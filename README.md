# TinyWebChat - OpenClaw Lightweight Web Channel

> Lightweight webchat channel for OpenClaw - optimized for H5 browsers & WeChat mini-programs

## Overview

TinyWebChat is a dual-mode channel plugin for [OpenClaw](https://github.com/openclaw/openclaw) that provides a lightweight, mobile-first chat interface:

- 📱 **H5 Mobile Browsers** - Lightweight web interface
- 💬 **WeChat Mini-Programs** - Native-like experience in WeChat
- 🔌 **REST + SSE** - No WebSocket dependency (works in restricted environments)
- 🔄 **Dual Mode** - Run standalone (CLI) or integrated (Plugin)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Two Operation Modes                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────┐  ┌─────────────────────────┐   │
│  │   CLI Mode          │  │   Plugin Mode           │   │
│  │   (Standalone)      │  │   (Integrated)          │   │
│  │                     │  │                         │   │
│  │  TinyWebChat        │  │  TinyWebChat            │   │
│  │  Server ──spawn──►  │  │  Plugin ──internal──►   │   │
│  │  openclaw agent     │  │  OpenClaw Agent API     │   │
│  └─────────────────────┘  └─────────────────────────┘   │
│                                                          │
│  Use CLI mode for:        Use Plugin mode for:          │
│  • Quick testing          • Production OpenClaw         │
│  • Standalone deployment  • Shared agent context        │
│  • No OpenClaw required   • Centralized management      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### CLI Mode (Standalone - Default)

Run TinyWebChat as a standalone server that spawns OpenClaw agent processes:

```bash
# Install dependencies
npm install

# Run in CLI mode (default)
npm run start

# Or with custom port
PORT=18799 npm run start

# With batch processing mode
PROCESSING_MODE=batch npm run start
```

### Plugin Mode (Integrated)

Run as an OpenClaw plugin for tighter integration:

```bash
# Build the plugin
npm run build

# Configure OpenClaw to load the plugin
# See examples/openclaw-config.yaml
```

## Configuration

### Environment Variables (CLI Mode)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 18799 | Server port |
| `PROCESSING_MODE` | queue | `queue` (one at a time) or `batch` (grouped) |
| `AGENT_MODE` | cli | `cli` (spawn process) or `plugin` (internal API) |
| `WORKSPACE_PATH` | . | Path to OpenClaw workspace |

### Plugin Configuration

```yaml
# In your OpenClaw config
channels:
  tinywebchat:
    enabled: true
    port: 18799
    agentMode: plugin        # Use OpenClaw internal API
    processingMode: queue    # or 'batch'
    sessionTimeout: 3600
    maxHistory: 100
    wechatMpEnabled: true
    allowedOrigins: ['*']
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Chat UI (tinywebchat.html) |
| `/tinywebchat.html` | GET | Chat UI (HTML page) |
| `/health` | GET | Health check |
| `/v1/webchat/sessions` | POST | Create new session |
| `/v1/webchat/sessions` | GET | List all sessions |
| `/v1/webchat/send` | POST | Send message to agent |
| `/v1/webchat/sessions/:id/messages` | GET | Get message history |
| `/v1/webchat/events` | GET | SSE for real-time updates |

## Testing

### With curl

```bash
# Create session
SESSION=$(curl -s -X POST http://localhost:18799/v1/webchat/sessions)
SESSION_ID=$(echo $SESSION | jq -r '.id')
TOKEN=$(echo $SESSION | jq -r '.token')

# Send message
curl -X POST http://localhost:18799/v1/webchat/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"content\": \"Hello!\"}"

# Get messages
curl http://localhost:18799/v1/webchat/sessions/$SESSION_ID/messages \
  -H "Authorization: Bearer $TOKEN"
```

### With Browser

Simply open the chat UI in your browser:

```bash
# Start the server (CLI mode)
pnpm start

# Then open in browser
open http://localhost:18799
```

Or access `tinywebchat.html` directly at:
- http://localhost:18799/
- http://localhost:18799/tinywebchat.html

### With SDK

```javascript
import { WebChatSDK } from './sdk/webchat-sdk.js';

const client = WebChatSDK;
client.init({ baseUrl: 'http://localhost:18799' });

const session = await client.startSession();
await client.sendMessage('Hello!');
```

## Message Processing Modes

### Queue Mode (Default)

Messages processed **one at a time** per session:

```bash
PROCESSING_MODE=queue npm run start
```

**Behavior:**
- User sends "msg1", "msg2", "msg3" simultaneously
- Agent processes "msg1" first
- "msg2", "msg3" wait in queue
- Sequential responses

### Batch Mode

All queued messages combined into **single context**:

```bash
PROCESSING_MODE=batch npm run start
```

**Behavior:**
- User sends "msg1", "msg2", "msg3" simultaneously
- Combined: "msg1\nmsg2\nmsg3"
- Single agent call with full context
- One response addressing all

## File Structure

```
tinywebchat/
├── src/channels/plugins/webchat/    # Plugin source
│   ├── index.ts                     # Entry point (dual mode)
│   ├── gateway.ts                   # Agent communication
│   ├── http.ts                      # HTTP handlers
│   ├── config.ts                    # Config schema
│   └── types.ts                     # Type definitions
├── server/                          # Standalone servers
│   ├── index.ts                     # Test server
│   └── openclaw.ts                  # OpenClaw-integrated
├── sdk/                             # Client SDKs
│   ├── webchat-sdk.js               # Browser SDK
│   └── wechat-demo/                 # WeChat Mini-Program
├── examples/                        # Example configs
│   ├── openclaw-config.yaml
│   └── docker-compose.yaml
├── test/                            # Tests
│   ├── gateway.test.ts
│   └── http.test.ts
├── tinywebchat.html                 # Chat UI (served at /)
├── openclaw-plugin.yaml             # Plugin manifest
└── README.md
```

## Session Architecture

TinyWebChat has **two layers of sessions**:

| Aspect | TinyWebChat Session | OpenClaw Session |
|--------|--------------------|------------------|
| **Scope** | Per browser tab / WeChat page | Shared across all tabs (CLI mode) |
| **Lifetime** | Until page refresh/close | Persistent in OpenClaw |
| **Storage** | In-memory Map | OpenClaw session storage |
| **Purpose** | Web connection, message queue | Agent context, memory |

**Note:** In CLI mode, all TinyWebChat sessions connect to a single OpenClaw session (`main`). In Plugin mode, sessions can be isolated per OpenClaw session.

## Scripts

```bash
# Development
npm run dev              # Watch mode compilation
npm run start            # Start standalone server (CLI mode)
npm run server           # Start test server

# Build
npm run build            # Compile TypeScript
npm run build:plugin     # Build for OpenClaw plugin

# Testing
npm test                 # Run all tests
npm run test:watch       # Watch mode testing
npm run test:coverage    # Coverage report

# Linting
npm run lint             # ESLint check
npm run lint:fix         # Auto-fix issues
```

## WeChat Mini-Program

See `sdk/wechat-demo/` for a complete WeChat Mini-Program example.

## Deployment

For detailed deployment scenarios and production setup, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Development

To contribute to TinyWebChat, please read our [CONTRIBUTING.md](CONTRIBUTING.md) guide.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history and changes.

## License

MIT - See [LICENSE](LICENSE) file for details.

## Related

- [OpenClaw](https://github.com/openclaw/openclaw) - Main project
- [OpenClaw Channels](https://docs.openclaw.ai/channels) - Channel documentation
