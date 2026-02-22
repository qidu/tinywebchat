/**
 * TinyWebChat - WeChat Mini-Program Demo Pages
 * 
 * Copy these files to your WeChat mini-project
 * Pages: index, chat
 */

export default {
  data: {
    sessionId: '',
    token: '',
    messages: [],
    inputValue: '',
    isConnected: false,
    isTyping: false,
    statusIcon: '⚪',
    statusText: 'Ready - no active session',
    pendingMsgIndex: -1
  },

  onLoad() {
    // Initialize status
    this.setStatus('ready');
    
    // Try to restore saved session
    const sessionId = wx.getStorageSync('twc_session_id');
    const token = wx.getStorageSync('twc_token');
    
    if (sessionId && token) {
      this.setData({ sessionId, token });
      this.connectSSE();
    }
  },

  setStatus(status) {
    let icon = '⚪';
    let text = 'Ready - no active session';
    
    switch (status) {
      case 'connected':
        icon = '🟢';
        text = 'Connected';
        break;
      case 'disconnected':
        icon = '🟠';
        text = 'Disconnected';
        break;
      case 'error':
        icon = '🔴';
        text = 'Error';
        break;
      case 'ready':
      default:
        icon = '⚪';
        text = 'Ready - no active session';
    }
    
    this.setData({ 
      statusIcon: icon,
      statusText: text,
      isConnected: status === 'connected'
    });
  },

  async startChat() {
    try {
      this.setStatus('ready');
      
      // Create session via HTTP
      const res = await wx.request({
        url: 'http://localhost:3008/v1/webchat/sessions',
        method: 'POST'
      });
      
      const data = res.data;
      this.setData({
        sessionId: data.id,
        token: data.token,
        messages: []
      });
      
      // Save for persistence
      wx.setStorageSync('twc_session_id', data.id);
      wx.setStorageSync('twc_token', data.token);
      
      this.connectSSE();
      this.setStatus('connected');
      
      wx.showToast({ title: 'Connected!', icon: 'success' });
    } catch (err) {
      this.setStatus('error');
      wx.showToast({ title: 'Error: ' + err.message, icon: 'none' });
    }
  },

  newSession() {
    // Clear current session
    this.setData({
      sessionId: '',
      token: '',
      messages: [],
      inputValue: ''
    });
    
    wx.removeStorageSync('twc_session_id');
    wx.removeStorageSync('twc_token');
    
    this.setStatus('ready');
    
    // Start new session
    this.startChat();
  },

  connectSSE() {
    // WeChat doesn't support SSE natively, use WebSocket fallback
    // Or use wx.request with short polling
    
    this.setStatus('connected');
    
    // Add welcome message
    this.setData({
      messages: [{
        role: 'assistant',
        content: 'Hello! How can I help you today?'
      }]
    });
  },

  addPendingMessage() {
    const messages = this.data.messages;
    messages.push({
      role: 'assistant',
      content: '...',
      isPending: true
    });
    
    this.setData({ 
      messages,
      pendingMsgIndex: messages.length - 1,
      isTyping: true
    });
    
    return messages.length - 1;
  },

  replacePendingMessage(content) {
    const idx = this.data.pendingMsgIndex;
    if (idx >= 0) {
      const messages = this.data.messages;
      messages[idx] = {
        role: 'assistant',
        content: content
      };
      this.setData({ 
        messages,
        pendingMsgIndex: -1,
        isTyping: false
      });
    }
  },

  async sendMessage() {
    const content = this.data.inputValue.trim();
    if (!content || !this.data.sessionId) return;
    
    // Add user message
    const messages = this.data.messages;
    messages.push({ role: 'user', content });
    
    this.setData({
      messages,
      inputValue: ''
    });
    
    // Add pending message with blinking dots
    this.addPendingMessage();
    
    try {
      const res = await wx.request({
        url: 'http://localhost:3008/v1/webchat/send',
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.data.token}`
        },
        data: {
          sessionId: this.data.sessionId,
          content
        }
      });
      
      if (!res.data.success) {
        wx.showToast({ title: 'Error: ' + res.data.error, icon: 'none' });
        this.replacePendingMessage('Error: ' + res.data.error);
      } else {
        // Simulate receiving response (in real implementation, use SSE/WebSocket)
        setTimeout(() => {
          this.replacePendingMessage('Response received!');
        }, 1000);
      }
    } catch (err) {
      wx.showToast({ title: 'Send failed', icon: 'none' });
      this.replacePendingMessage('Error: ' + err.message);
    }
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  // Handle Enter key for new line (textarea behavior)
  onConfirm(e) {
    // In WeChat, we can't easily distinguish Enter vs Ctrl+Enter
    // So we just add a newline to the input
    const value = this.data.inputValue + '\n';
    this.setData({ inputValue: value });
  }
};
