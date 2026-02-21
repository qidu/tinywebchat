# TinyWebChat SDK

Lightweight SDK for WeChat Mini-Programs and H5 browsers.

## Installation

### WeChat Mini-Program

Copy `webchat-sdk.js` to your mini-program's `utils/` folder:

```javascript
// app.js or page.js
var WebChatSDK = require('../../utils/webchat-sdk.js');
```

### H5 Browser

```html
<script src="webchat-sdk.js"></script>
```

## Usage

### WeChat Mini-Program

```javascript
// Initialize
WebChatSDK.init({
  baseUrl: 'https://your-gateway.com'
});

// Start a session
async function startChat() {
  try {
    const session = await WebChatSDK.startSession();
    console.log('Session:', session.id);
    
    // Connect to real-time events
    WebChatSDK.connectEvents();
    
    // Listen for messages
    WebChatSDK.onMessage((event) => {
      if (event.type === 'message') {
        console.log('Received:', event.data.content);
      }
    });
    
  } catch (err) {
    console.error('Failed to start:', err);
  }
}

// Send a message
async function send(msg) {
  const result = await WebChatSDK.sendMessage(msg);
  console.log('Sent:', result);
}
```

### H5 Browser

```html
<script>
  WebChatSDK.init({
    baseUrl: 'https://your-gateway.com'
  });

  async function startChat() {
    await WebChatSDK.startSession();
    WebChatSDK.connectEvents();
    
    WebChatSDK.onMessage((event) => {
      if (event.type === 'message') {
        console.log('Received:', event.data.content);
      }
    });
  }
</script>
```

## API Reference

### init(options)

Initialize the SDK with configuration.

**Options:**
- `baseUrl` - Gateway base URL (required)
- `apiVersion` - API version (default: 'v1')
- `timeout` - Request timeout in ms (default: 30000)

### startSession()

Create a new chat session. Returns session info with token.

**Returns:**
```javascript
{
  id: "wc_1234567890_abc",
  token: "abc123...",
  expiresAt: 1234567890000
}
```

### sendMessage(content)

Send a message to the agent.

**Parameters:**
- `content` - Message text (string)

**Returns:**
```javascript
{
  success: true,
  messageId: "msg_123"
}
```

### getMessages(limit)

Get message history.

**Parameters:**
- `limit` - Max messages (default: 50)

**Returns:**
```javascript
{
  messages: [...],
  hasMore: false
}
```

### connectEvents()

Connect to real-time event stream (WebSocket for WeChat, SSE for browser).

### onMessage(handler)

Register a message handler.

```javascript
WebChatSDK.onMessage((event) => {
  switch (event.type) {
    case 'message':
      // Handle incoming message
      break;
    case 'typing':
      // Handle typing indicator
      break;
    case 'error':
      // Handle error
      break;
  }
});
```

### clearSession()

Clear the current session and disconnect.

## WeChat Mini-Program Specific

### wxss Usage

Copy the following to your page's `wxss`:

```css
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16rpx;
}

.message {
  display: flex;
  margin-bottom: 16rpx;
}

.message.user {
  flex-direction: row-reverse;
}

.bubble {
  max-width: 70%;
  padding: 16rpx 24rpx;
  border-radius: 16rpx;
  background: #f0f0f0;
}

.message.user .bubble {
  background: #0066cc;
  color: white;
}

.input-area {
  display: flex;
  padding: 16rpx;
  background: white;
  border-top: 1rpx solid #e0e0e0;
}

.input-area input {
  flex: 1;
  padding: 16rpx;
  border: 1rpx solid #e0rpx;
  border-radius: 32rpx;
}
```

## TypeScript Support

For TypeScript projects, you can add type definitions:

```typescript
declare class WebChatSDK {
  init(options: { baseUrl: string; apiVersion?: string; timeout?: number }): void;
  startSession(): Promise<{ id: string; token: string; expiresAt: number }>;
  sendMessage(content: string): Promise<{ success: boolean; messageId?: string }>;
  getMessages(limit?: number): Promise<{ messages: Message[]; hasMore: boolean }>;
  connectEvents(): void;
  disconnectEvents(): void;
  onMessage(handler: (event: Event) => void): void;
  offMessage(handler: (event: Event) => void): void;
  isConnected(): boolean;
  hasSession(): boolean;
  clearSession(): void;
  getSession(): { sessionId: string | null; token: string | null; connected: boolean };
}

declare const WebChatSDK: WebChatSDK;
```
