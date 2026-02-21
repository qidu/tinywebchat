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
    isTyping: false
  },

  onLoad() {
    // Try to restore saved session
    const sessionId = wx.getStorageSync('twc_session_id');
    const token = wx.getStorageSync('twc_token');
    
    if (sessionId && token) {
      this.setData({ sessionId, token });
      this.connectSSE();
    }
  },

  async startChat() {
    try {
      // Create session via HTTP
      const res = await wx.request({
        url: 'http://localhost:3002/v1/webchat/sessions',
        method: 'POST'
      });
      
      const data = res.data;
      this.setData({
        sessionId: data.id,
        token: data.token
      });
      
      // Save for persistence
      wx.setStorageSync('twc_session_id', data.id);
      wx.setStorageSync('twc_token', data.token);
      
      this.connectSSE();
      
      wx.showToast({ title: 'Connected!', icon: 'success' });
    } catch (err) {
      wx.showToast({ title: 'Error: ' + err.message, icon: 'none' });
    }
  },

  connectSSE() {
    // WeChat doesn't support SSE natively, use WebSocket fallback
    // Or use wx.request with short polling
    
    this.setData({ isConnected: true });
    
    // Add welcome message
    this.setData({
      messages: [...this.data.messages, {
        role: 'assistant',
        content: 'Hello! How can I help you today?'
      }]
    });
  },

  async sendMessage() {
    const content = this.data.inputValue.trim();
    if (!content || !this.data.sessionId) return;
    
    // Add user message
    this.setData({
      messages: [...this.data.messages, { role: 'user', content }],
      inputValue: '',
      isTyping: true
    });
    
    try {
      const res = await wx.request({
        url: 'http://localhost:3002/v1/webchat/send',
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
      }
    } catch (err) {
      wx.showToast({ title: 'Send failed', icon: 'none' });
    }
    
    this.setData({ isTyping: false });
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  }
};
