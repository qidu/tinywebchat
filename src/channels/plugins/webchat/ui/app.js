/**
 * TinyWebChat - Lightweight H5 Chat App (~8kb)
 * Compatible with WeChat mini-program environment
 */

(function(global) {
  'use strict';

  // Configuration
  const CONFIG = {
    baseUrl: '',
    reconnectDelay: 3000,
    maxRetries: 5,
    messageTimeout: 30000,
  };

  // State
  let state = {
    sessionId: null,
    token: null,
    connected: false,
    reconnectAttempts: 0,
    eventSource: null,
    messageQueue: [],
  };

  // DOM Elements
  let els = {};

  /**
   * Initialize the app
   */
  function init(options = {}) {
    Object.assign(CONFIG, options);
    
    cacheElements();
    bindEvents();
    checkExistingSession();
  }

  /**
   * Cache DOM elements
   */
  function cacheElements() {
    els = {
      app: document.getElementById('app'),
      loginScreen: document.getElementById('login-screen'),
      chatScreen: document.getElementById('chat-screen'),
      startBtn: document.getElementById('start-btn'),
      sendBtn: document.getElementById('send-btn'),
      messageInput: document.getElementById('message-input'),
      messages: document.getElementById('messages'),
      typing: document.getElementById('typing'),
      statusBar: document.getElementById('status-bar'),
      menuBtn: document.getElementById('menu-btn'),
    };
  }

  /**
   * Bind event listeners
   */
  function bindEvents() {
    // Start chat button
    els.startBtn?.addEventListener('click', startChat);
    
    // Send button
    els.sendBtn?.addEventListener('click', sendMessage);
    
    // Enter to send
    els.messageInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    // Auto-resize textarea
    els.messageInput?.addEventListener('input', autoResize);
    
    // Menu button
    els.menuBtn?.addEventListener('click', showMenu);
    
    // Network status
    global.addEventListener('online', onOnline);
    global.addEventListener('offline', onOffline);
  }

  /**
   * Check for existing session
   */
  function checkExistingSession() {
    const sessionId = localStorage.getItem('webchat_session_id');
    const token = localStorage.getItem('webchat_token');
    
    if (sessionId && token) {
      state.sessionId = sessionId;
      state.token = token;
      showChatScreen();
      connectSSE();
    }
  }

  /**
   * Start a new chat session
   */
  async function startChat() {
    try {
      showStatus('Connecting...');
      
      const response = await fetch(`${CONFIG.baseUrl}/v1/webchat/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error('Failed to create session');
      }
      
      const data = await response.json();
      
      state.sessionId = data.id;
      state.token = data.token;
      
      // Store credentials
      localStorage.setItem('webchat_session_id', data.id);
      localStorage.setItem('webchat_token', data.token);
      
      hideStatus();
      showChatScreen();
      connectSSE();
      
    } catch (err) {
      showStatus('Connection failed. Tap to retry.', true);
      console.error('Failed to start chat:', err);
    }
  }

  /**
   * Connect to SSE for real-time updates
   */
  function connectSSE() {
    if (state.eventSource) {
      state.eventSource.close();
    }
    
    const url = `${CONFIG.baseUrl}/v1/webchat/events?sessionId=${state.sessionId}`;
    
    try {
      state.eventSource = new EventSource(url, {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      
      state.eventSource.addEventListener('connected', (e) => {
        const data = JSON.parse(e.data);
        console.log('Connected:', data);
        state.connected = true;
        state.reconnectAttempts = 0;
        hideStatus();
        processQueue();
      });
      
      state.eventSource.addEventListener('message', (e) => {
        const data = JSON.parse(e.data);
        handleIncomingMessage(data);
      });
      
      state.eventSource.addEventListener('typing', (e) => {
        const data = JSON.parse(e.data);
        showTyping(data.isTyping);
      });
      
      state.eventSource.addEventListener('error', (e) => {
        console.error('SSE error:', e);
        state.connected = false;
        attemptReconnect();
      });
      
    } catch (err) {
      console.error('Failed to connect SSE:', err);
      attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect
   */
  function attemptReconnect() {
    if (state.reconnectAttempts >= CONFIG.maxRetries) {
      showStatus('Connection lost. Please refresh.', true);
      return;
    }
    
    state.reconnectAttempts++;
    showStatus('Reconnecting...');
    
    setTimeout(() => {
      if (state.sessionId && state.token) {
        connectSSE();
      }
    }, CONFIG.reconnectDelay);
  }

  /**
   * Send a message
   */
  async function sendMessage() {
    const content = els.messageInput.value.trim();
    if (!content || !state.sessionId) return;
    
    // Clear input
    els.messageInput.value = '';
    autoResize();
    
    // Add to UI immediately (optimistic)
    addMessage('user', content);
    
    // Disable send button while sending
    updateSendButton();
    
    try {
      const response = await fetch(`${CONFIG.baseUrl}/v1/webchat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`,
        },
        body: JSON.stringify({
          sessionId: state.sessionId,
          content,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send');
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to send');
      }
      
    } catch (err) {
      console.error('Send failed:', err);
      
      // Queue for retry if offline
      if (!navigator.onLine) {
        state.messageQueue.push(content);
        showStatus('Offline. Message queued.', true);
      } else {
        showStatus('Failed to send. Tap to retry.', true);
      }
    }
    
    updateSendButton();
  }

  /**
   * Process queued messages
   */
  async function processQueue() {
    if (!state.connected || state.messageQueue.length === 0) return;
    
    const queue = [...state.messageQueue];
    state.messageQueue = [];
    
    for (const content of queue) {
      els.messageInput.value = content;
      await sendMessage();
    }
  }

  /**
   * Handle incoming message
   */
  function handleIncomingMessage(data) {
    if (data.role === 'user') return; // Ignore our own messages
    
    hideTyping();
    addMessage('assistant', data.content);
  }

  /**
   * Add message to UI
   */
  function addMessage(role, content) {
    if (!els.messages) return;
    
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;
    
    const avatar = role === 'assistant' ? '🤖' : '👤';
    
    messageEl.innerHTML = `
      <div class="avatar">${avatar}</div>
      <div class="bubble">${escapeHtml(content)}</div>
    `;
    
    els.messages.appendChild(messageEl);
    scrollToBottom();
  }

  /**
   * Show typing indicator
   */
  function showTyping(show) {
    els.typing?.classList.toggle('hidden', !show);
    if (show) {
      scrollToBottom();
    }
  }

  function hideTyping() {
    els.typing?.classList.add('hidden');
  }

  /**
   * Update send button state
   */
  function updateSendButton() {
    if (!els.sendBtn) return;
    
    const hasContent = els.messageInput.value.trim().length > 0;
    els.sendBtn.disabled = !hasContent || !state.connected;
  }

  /**
   * Auto-resize textarea
   */
  function autoResize() {
    const el = els.messageInput;
    if (!el) return;
    
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
    
    updateSendButton();
  }

  /**
   * Scroll to bottom of messages
   */
  function scrollToBottom() {
    els.messages?.scrollTo({
      top: els.messages.scrollHeight,
      behavior: 'smooth'
    });
  }

  /**
   * Show status bar
   */
  function showStatus(text, persistent = false) {
    if (!els.statusBar) return;
    
    const textEl = els.statusBar.querySelector('.status-text');
    if (textEl) textEl.textContent = text;
    
    els.statusBar.classList.remove('hidden');
    
    if (!persistent) {
      setTimeout(hideStatus, 3000);
    }
  }

  function hideStatus() {
    els.statusBar?.classList.add('hidden');
  }

  /**
   * Show/hide screens
   */
  function showChatScreen() {
    els.loginScreen?.classList.add('hidden');
    els.chatScreen?.classList.remove('hidden');
  }

  /**
   * Show menu
   */
  function showMenu() {
    // Simple confirm dialog for now
    if (confirm('End this conversation?')) {
      clearSession();
    }
  }

  /**
   * Clear session
   */
  function clearSession() {
    localStorage.removeItem('webchat_session_id');
    localStorage.removeItem('webchat_token');
    
    if (state.eventSource) {
      state.eventSource.close();
      state.eventSource = null;
    }
    
    state.sessionId = null;
    state.token = null;
    state.connected = false;
    
    // Clear messages
    if (els.messages) {
      els.messages.innerHTML = `
        <div class="message assistant">
          <div class="avatar">🤖</div>
          <div class="bubble">Hello! How can I help you today?</div>
        </div>
      `;
    }
    
    els.chatScreen?.classList.add('hidden');
    els.loginScreen?.classList.remove('hidden');
  }

  /**
   * Network status handlers
   */
  function onOnline() {
    if (state.sessionId && state.token) {
      connectSSE();
      processQueue();
    }
  }

  function onOffline() {
    state.connected = false;
    showStatus('You are offline', true);
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Export
  global.WebChat = {
    init,
    sendMessage,
    clearSession,
  };

})(window);
