/**
 * TinyWebChat - WeChat Mini-Program SDK
 * 
 * A lightweight SDK (~8kb) compatible with WeChat's limited JS environment.
 * Uses WeChat's wx.request for HTTP and wx.connectSocket for WebSocket fallback.
 */

(function(global) {
  'use strict';

  // WeChat environment check
  const isWeChat = typeof wx !== 'undefined' && wx.request;

  // Configuration
  const CONFIG = {
    baseUrl: '',
    apiVersion: 'v1',
    timeout: 30000,
    retryDelay: 2000,
    maxRetries: 3,
  };

  // State
  let state = {
    sessionId: null,
    token: null,
    socketTask: null,
    messageHandlers: [],
    connected: false,
    status: 'ready', // 'ready', 'connected', 'disconnected', 'error'
  };

  /**
   * Initialize the SDK
   * @param {Object} options - Configuration options
   * @param {string} options.baseUrl - Base URL for the API
   */
  function init(options = {}) {
    Object.assign(CONFIG, options);
    
    // Try to restore existing session
    try {
      const sessionId = wx.getStorageSync('webchat_session_id');
      const token = wx.getStorageSync('webchat_token');
      
      if (sessionId && token) {
        state.sessionId = sessionId;
        state.token = token;
      }
    } catch (e) {
      console.warn('Failed to restore session:', e);
    }
  }

  /**
   * Get status icon
   */
  function getStatusIcon() {
    switch (state.status) {
      case 'connected': return '🟢';
      case 'disconnected': return '🟠';
      case 'error': return '🔴';
      case 'ready':
      default: return '⚪';
    }
  }

  /**
   * Get status text
   */
  function getStatusText() {
    switch (state.status) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Error';
      case 'ready': return 'Ready - no active session';
      default: return 'Unknown';
    }
  }

  /**
   * Set status
   */
  function setStatus(status) {
    state.status = status;
    notifyStatusChange();
  }

  /**
   * Notify status change
   */
  function notifyStatusChange() {
    for (const handler of state.messageHandlers) {
      try {
        handler({ type: 'status', data: { status: state.status, icon: getStatusIcon(), text: getStatusText() } });
      } catch (e) {
        console.error('[WebChat] Status handler error:', e);
      }
    }
  }

  /**
   * Make an HTTP request
   */
  function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const url = `${CONFIG.baseUrl}/${CONFIG.apiVersion}/webchat${path}`;
      
      const header = {
        'Content-Type': 'application/json',
      };
      
      if (state.token) {
        header['Authorization'] = `Bearer ${state.token}`;
      }
      
      const options = {
        url,
        method,
        header,
        timeout: CONFIG.timeout,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else {
            reject(new Error(res.data?.error || `HTTP ${res.statusCode}`));
          }
        },
        fail: (err) => {
          reject(err);
        },
      };
      
      if (data && (method === 'POST' || method === 'PUT')) {
        options.data = data;
      }
      
      if (isWeChat) {
        wx.request(options);
      } else {
        // Browser fallback for testing
        fetch(url, {
          method,
          headers: header,
          body: data ? JSON.stringify(data) : undefined,
        })
        .then(res => res.json())
        .then(resolve)
        .catch(reject);
      }
    });
  }

  /**
   * Start a new chat session
   * @returns {Promise<Object>} Session info
   */
  async function startSession() {
    setStatus('ready');
    const data = await request('POST', '/sessions');
    
    state.sessionId = data.id;
    state.token = data.token;
    
    // Persist session
    if (isWeChat) {
      wx.setStorageSync('webchat_session_id', data.id);
      wx.setStorageSync('webchat_token', data.token);
    }
    
    setStatus('connected');
    return data;
  }

  /**
   * Send a message
   * @param {string} content - Message content
   * @returns {Promise<Object>} Send result
   */
  async function sendMessage(content) {
    if (!state.sessionId || !state.token) {
      throw new Error('No active session. Call startSession() first.');
    }
    
    return request('POST', '/send', {
      sessionId: state.sessionId,
      content,
    });
  }

  /**
   * Get message history
   * @param {number} limit - Max messages to retrieve
   * @returns {Promise<Array>} Messages
   */
  async function getMessages(limit = 50) {
    if (!state.sessionId) {
      throw new Error('No active session');
    }
    
    const data = await request('GET', `/sessions/${state.sessionId}/messages?limit=${limit}`);
    return data.messages;
  }

  /**
   * Connect to real-time events (WebSocket fallback for WeChat)
   */
  function connectEvents() {
    if (!state.sessionId || !state.token) {
      console.warn('No active session for events');
      return;
    }
    
    // WeChat uses wx.connectSocket instead of EventSource
    const wsUrl = `${CONFIG.baseUrl.replace('http', 'ws')}/${CONFIG.apiVersion}/webchat/ws?sessionId=${state.sessionId}`;
    
    if (isWeChat) {
      state.socketTask = wx.connectSocket({
        url: wsUrl,
        header: {
          'Authorization': `Bearer ${state.token}`,
        },
      });
      
      state.socketTask.onOpen(() => {
        state.connected = true;
        setStatus('connected');
        console.log('[WebChat] Connected to events');
      });
      
      state.socketTask.onMessage((res) => {
        try {
          const event = JSON.parse(res.data);
          handleEvent(event);
        } catch (e) {
          console.error('[WebChat] Failed to parse event:', e);
        }
      });
      
      state.socketTask.onClose(() => {
        state.connected = false;
        setStatus('disconnected');
        console.log('[WebChat] Disconnected from events');
      });
      
      state.socketTask.onError((err) => {
        console.error('[WebChat] Socket error:', err);
        state.connected = false;
        setStatus('error');
      });
    }
  }

  /**
   * Disconnect from events
   */
  function disconnectEvents() {
    if (state.socketTask) {
      if (isWeChat) {
        wx.closeSocket();
      }
      state.socketTask = null;
      state.connected = false;
      setStatus('disconnected');
    }
  }

  /**
   * Handle incoming event
   */
  function handleEvent(event) {
    for (const handler of state.messageHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error('[WebChat] Handler error:', e);
      }
    }
  }

  /**
   * Register message handler
   * @param {Function} handler - Function to handle messages
   */
  function onMessage(handler) {
    state.messageHandlers.push(handler);
  }

  /**
   * Remove message handler
   * @param {Function} handler - Handler to remove
   */
  function offMessage(handler) {
    const idx = state.messageHandlers.indexOf(handler);
    if (idx >= 0) {
      state.messageHandlers.splice(idx, 1);
    }
  }

  /**
   * Check if connected
   */
  function isConnected() {
    return state.connected;
  }

  /**
   * Check if has active session
   */
  function hasSession() {
    return !!state.sessionId && !!state.token;
  }

  /**
   * Clear session
   */
  function clearSession() {
    disconnectEvents();
    
    state.sessionId = null;
    state.token = null;
    setStatus('ready');
    
    if (isWeChat) {
      wx.removeStorageSync('webchat_session_id');
      wx.removeStorageSync('webchat_token');
    }
  }

  /**
   * Get session info
   */
  function getSession() {
    return {
      sessionId: state.sessionId,
      token: state.token,
      connected: state.connected,
      status: state.status,
      statusIcon: getStatusIcon(),
      statusText: getStatusText(),
    };
  }

  // Export for different environments
  const WebChatSDK = {
    init,
    startSession,
    sendMessage,
    getMessages,
    connectEvents,
    disconnectEvents,
    onMessage,
    offMessage,
    isConnected,
    hasSession,
    clearSession,
    getSession,
    getStatusIcon,
    getStatusText,
    setStatus,
    CONFIG,
  };

  // WeChat Mini-Program module export
  if (isWeChat) {
    module.exports = WebChatSDK;
  } else {
    global.WebChatSDK = WebChatSDK;
  }

})(window);
