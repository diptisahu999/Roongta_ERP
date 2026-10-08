/** @odoo-module **/

console.log("🚀 Roongta ERP Standard AI Assistant (Voice + Text) Initializing...");

const embedToken = 'emb_Yfp3_17Q5260rhMRcA4HIpCkTiMNihfhbJTBnbQa3p4&environment';
const backendUrl = 'https://dograhaibackend.techvizor.in';
const frontendUrl = 'https://dograhai.techvizor.in';

const css = `
  #dograh-container {
    position: fixed;
    bottom: 30px;
    right: 25px;
    z-index: 999999;
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  #dograh-toggle-btn {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1e3a8a, #3b82f6);
    box-shadow: 0 4px 20px rgba(37, 99, 235, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    border: 2px solid rgba(255, 255, 255, 0.2);
    outline: none;
    animation: dograh-float 3.5s ease-in-out infinite;
  }
  @keyframes dograh-float {
    0%, 100% { transform: translateY(0); box-shadow: 0 4px 20px rgba(37, 99, 235, 0.45); }
    50% { transform: translateY(-6px); box-shadow: 0 10px 28px rgba(37, 99, 235, 0.6); }
  }
  #dograh-toggle-btn:hover {
    transform: scale(1.08) translateY(-2px);
    box-shadow: 0 8px 30px rgba(37, 99, 235, 0.65);
    animation-play-state: paused;
  }
  #dograh-toggle-btn span {
    font-size: 19px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 0.5px;
  }
  #dograh-toggle-btn.active {
    animation-play-state: paused;
  }
  #dograh-toggle-btn.active span {
    transform: scale(0.85) rotate(90deg);
  }

  /* Main Standard Bot Panel */
  #dograh-panel {
    display: none;
    position: absolute;
    bottom: 66px;
    right: 0;
    width: 380px;
    height: 560px;
    max-height: calc(100vh - 100px);
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    box-shadow: 0 16px 45px rgba(15, 23, 42, 0.18), 0 0 1px rgba(0, 0, 0, 0.05);
    flex-direction: column;
    overflow: hidden;
    transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    transform: translateY(16px) scale(0.95);
    opacity: 0;
    transform-origin: bottom right;
  }
  #dograh-panel.show {
    display: flex;
    transform: translateY(0) scale(1);
    opacity: 1;
  }

  /* Header */
  .dograh-header {
    padding: 12px 16px;
    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: white;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
    flex-shrink: 0;
  }
  .dograh-title-area {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dograh-avatar-wrap {
    position: relative;
  }
  .dograh-avatar {
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid rgba(255, 255, 255, 0.4);
  }
  .dograh-avatar svg {
    width: 20px;
    height: 20px;
    fill: #ffffff;
  }
  .dograh-status-dot {
    position: absolute;
    bottom: 0px;
    right: 0px;
    width: 9px;
    height: 9px;
    background-color: #22c55e;
    border: 2px solid #1e3a8a;
    border-radius: 50%;
    box-shadow: 0 0 6px rgba(34, 197, 94, 0.9);
  }
  .dograh-title {
    font-weight: 700;
    font-size: 14px;
    color: #ffffff;
    margin: 0;
    line-height: 1.2;
    letter-spacing: 0.2px;
  }
  .dograh-subtitle {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.85);
    margin-top: 2px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .dograh-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dograh-call-header-btn {
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: #ffffff;
    padding: 5px 10px;
    border-radius: 20px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: all 0.2s;
  }
  .dograh-call-header-btn:hover {
    background: rgba(255, 255, 255, 0.28);
    transform: translateY(-1px);
  }
  .dograh-call-header-btn.calling {
    background: #ef4444;
    border-color: #f87171;
    animation: dograh-btn-pulse 1.5s infinite;
  }
  @keyframes dograh-btn-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }
  .dograh-close-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 4px 6px;
    border-radius: 6px;
    transition: all 0.2s;
  }
  .dograh-close-btn:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.15);
  }

  /* Dual Mode Tabs (Text & Voice) */
  .dograh-tabs {
    display: flex;
    background: #f1f5f9;
    border-bottom: 1px solid #e2e8f0;
    padding: 4px 8px;
    gap: 6px;
  }
  .dograh-tab-btn {
    flex: 1;
    padding: 6px 10px;
    border: none;
    background: transparent;
    color: #64748b;
    font-size: 12px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .dograh-tab-btn.active {
    background: #ffffff;
    color: #1e3a8a;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }

  /* Active Call Banner */
  .dograh-call-banner {
    display: none;
    padding: 8px 14px;
    background: #eff6ff;
    border-bottom: 1px solid #bfdbfe;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    color: #1e40af;
    font-weight: 600;
  }
  .dograh-call-banner.active {
    display: flex;
  }
  .dograh-call-wave {
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .dograh-call-wave span {
    width: 3px;
    height: 12px;
    background: #3b82f6;
    border-radius: 3px;
    animation: dograh-wave-anim 1s infinite ease-in-out;
  }
  .dograh-call-wave span:nth-child(2) { animation-delay: 0.2s; }
  .dograh-call-wave span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes dograh-wave-anim {
    0%, 100% { height: 4px; }
    50% { height: 13px; }
  }
  .dograh-end-call-pill {
    background: #ef4444;
    color: white;
    border: none;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .dograh-end-call-pill:hover {
    background: #dc2626;
  }

  /* Conversation Area */
  .dograh-chat-window {
    flex: 1;
    overflow-y: auto;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    scroll-behavior: smooth;
    background: #fafbfc;
  }
  .dograh-chat-window::-webkit-scrollbar {
    width: 4px;
  }
  .dograh-chat-window::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }

  /* Message Row */
  .dograh-msg-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    box-sizing: border-box;
    animation: dograh-fade-in 0.25s ease;
  }
  @keyframes dograh-fade-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .dograh-msg-row.user {
    justify-content: flex-end;
    margin-left: auto;
  }
  .dograh-msg-row.assistant {
    justify-content: flex-start;
    margin-right: auto;
  }
  .dograh-msg-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .dograh-msg-avatar svg {
    width: 15px;
    height: 15px;
    fill: #ffffff;
  }
  .dograh-msg {
    padding: 9px 13px;
    border-radius: 14px;
    max-width: 82%;
    font-size: 12.5px;
    line-height: 1.45;
    word-wrap: break-word;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    position: relative;
  }
  .dograh-msg-row.user .dograh-msg {
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: #ffffff;
    border-bottom-right-radius: 3px;
  }
  .dograh-msg-row.assistant .dograh-msg {
    background: #ffffff;
    color: #1e293b;
    border: 1px solid #e2e8f0;
    border-bottom-left-radius: 3px;
  }
  .dograh-msg.interim {
    opacity: 0.8;
    font-style: italic;
    background: #f1f5f9 !important;
    border: 1px dashed #cbd5e1 !important;
    color: #475569 !important;
  }
  .dograh-msg.system {
    background: #f1f5f9;
    color: #64748b;
    align-self: center;
    text-align: center;
    max-width: 90%;
    font-size: 11px;
    border-radius: 10px;
    padding: 5px 10px;
    margin: 4px auto;
  }

  /* Quick Suggestion Chips */
  .dograh-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }
  .dograh-chip {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    color: #2563eb;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11.5px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  .dograh-chip:hover {
    background: #eff6ff;
    border-color: #3b82f6;
    transform: translateY(-1px);
  }

  /* Footer Modes */
  .dograh-footer {
    background: #ffffff;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
  }
  
  /* Text Chat Input Row */
  .dograh-text-footer {
    padding: 8px 12px;
  }
  .dograh-input-row {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 20px;
    padding: 4px 6px 4px 12px;
    transition: border-color 0.2s;
  }
  .dograh-input-row:focus-within {
    border-color: #3b82f6;
    background: #ffffff;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }
  .dograh-input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-size: 13px;
    color: #1e293b;
    resize: none;
    max-height: 80px;
    font-family: inherit;
    line-height: 1.4;
  }
  .dograh-mic-btn {
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .dograh-mic-btn:hover {
    color: #2563eb;
    background: #eff6ff;
  }
  .dograh-mic-btn.listening {
    color: #ef4444;
    background: #fee2e2;
    animation: dograh-btn-pulse 1s infinite;
  }
  .dograh-send-btn {
    background: linear-gradient(135deg, #1e3a8a, #2563eb);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.15s;
    flex-shrink: 0;
  }
  .dograh-send-btn:hover {
    transform: scale(1.08);
  }
  .dograh-send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Voice Footer */
  .dograh-voice-footer {
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .dograh-call-action-btn {
    width: 100%;
    padding: 11px 18px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    font-weight: 700;
    font-size: 13.5px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
    transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .dograh-call-action-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(16, 185, 129, 0.45);
  }
  .dograh-call-action-btn.calling {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35);
  }
`;

// Global WebSocket Wire Interceptor
(function installWebSocketInterceptor() {
  if (window.__dograhWsInterceptorInstalled) return;
  window.__dograhWsInterceptorInstalled = true;

  const NativeWebSocket = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    const ws = new NativeWebSocket(url, protocols);

    ws.addEventListener('message', function (evt) {
      try {
        let rawData = evt.data;
        if (!rawData) return;
        if (typeof rawData === 'string') {
          try { rawData = JSON.parse(rawData); } catch (_) {}
        }
        if (window.__handleDograhWsFrame) {
          window.__handleDograhWsFrame(rawData);
        }
      } catch (err) {}
    });

    return ws;
  };
  window.WebSocket.prototype = NativeWebSocket.prototype;
  window.WebSocket.CONNECTING = NativeWebSocket.CONNECTING;
  window.WebSocket.OPEN = NativeWebSocket.OPEN;
  window.WebSocket.CLOSING = NativeWebSocket.CLOSING;
  window.WebSocket.CLOSED = NativeWebSocket.CLOSED;
})();

function loadDograhWidget(userToken, userName, userEmail, callback) {
  (function (d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) {
      if (callback) callback();
      return;
    }
    js = d.createElement(s); js.id = id;

    var widgetUrl = frontendUrl + '/embed/dograh-widget.js?token=' + embedToken + '&environment=local&apiEndpoint=' + backendUrl + '&mode=headless';

    if (userToken) {
      widgetUrl += '&odoo_token=' + encodeURIComponent(userToken) +
        '&user_name=' + encodeURIComponent(userName) +
        '&user_email=' + encodeURIComponent(userEmail);

      const contextData = {
        erp_api_token: userToken,
        user_id: userName || 'odoo_user',
        is_authenticated: true
      };
      js.setAttribute('data-dograh-context', JSON.stringify(contextData));
    }

    js.src = widgetUrl;
    js.async = true;
    js.onload = function () {
      if (callback) callback();
    };
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'dograh-widget'));
}

function initDograhAgentWidget(userToken, userName, userEmail, userLogin) {
  if (document.getElementById('dograh-container')) return;

  // Insert Google Font for Outfit
  const fontLink = document.createElement('link');
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap';
  fontLink.rel = 'stylesheet';
  document.head.appendChild(fontLink);

  // Append CSS
  const styleEl = document.createElement('style');
  styleEl.innerHTML = css;
  document.head.appendChild(styleEl);

  // Create Container
  const container = document.createElement('div');
  container.id = 'dograh-container';

  // Floating Toggle Button
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'dograh-toggle-btn';
  toggleBtn.innerHTML = `<span>AI</span>`;
  container.appendChild(toggleBtn);

  // Standard Bot Panel
  const panel = document.createElement('div');
  panel.id = 'dograh-panel';
  panel.innerHTML = `
    <!-- Header -->
    <div class="dograh-header">
      <div class="dograh-title-area">
        <div class="dograh-avatar-wrap">
          <div class="dograh-avatar">
            <svg viewBox="0 0 24 24">
              <path d="M12 2a1 1 0 0 1 1 1v2h3a2 2 0 0 1 2 2v2.1c1.1.4 2 1.5 2 2.9v2a3 3 0 0 1-3 3h-1v1a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-1H7a3 3 0 0 1-3-3v-2c0-1.4.9-2.5 2-2.9V7a2 2 0 0 1 2-2h3V3a1 1 0 0 1 1-1zm3 5H9a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm-4 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM12 16h-3v1a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1z"/>
            </svg>
          </div>
          <div class="dograh-status-dot"></div>
        </div>
        <div>
          <div class="dograh-title">Roongta ERP Assistant</div>
          <div class="dograh-subtitle">Online • Voice &amp; Text AI</div>
        </div>
      </div>
      <div class="dograh-header-actions">
        <button class="dograh-call-header-btn" id="dograh-header-call-btn">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02C8.79 6.32 8.59 5.13 8.59 3.9c0-.55-.45-1-1-1H4.01c-.55 0-1 .45-1 1C3 16.92 12.08 21 21 21c.55 0 1-.45 1-1v-3.62c0-.55-.45-1-1-1z"/>
          </svg>
          <span>Call</span>
        </button>
        <button class="dograh-close-btn" title="Close Assistant">&times;</button>
      </div>
    </div>

    <!-- Mode Tabs -->
    <div class="dograh-tabs">
      <button class="dograh-tab-btn active" id="dograh-tab-text">
        <span>💬 Text Chat</span>
      </button>
      <button class="dograh-tab-btn" id="dograh-tab-voice">
        <span>🎙️ Voice Call</span>
      </button>
    </div>

    <!-- Active Call Banner -->
    <div class="dograh-call-banner" id="dograh-call-banner">
      <div style="display:flex; align-items:center; gap:8px;">
        <div class="dograh-call-wave">
          <span></span><span></span><span></span>
        </div>
        <span id="dograh-call-banner-text">🎙️ Voice Call Active</span>
      </div>
      <button class="dograh-end-call-pill" id="dograh-end-call-pill">End Call</button>
    </div>

    <!-- Main Chat Window -->
    <div class="dograh-chat-window" id="dograh-chat-window"></div>

    <!-- Text Chat Input Footer -->
    <div class="dograh-footer dograh-text-footer" id="dograh-text-footer">
      <div class="dograh-input-row">
        <input type="text" class="dograh-input" id="dograh-text-input" placeholder="Type a message or ask AI..." autocomplete="off"/>
        <button class="dograh-mic-btn" id="dograh-text-mic-btn" title="Speak to dictate">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
          </svg>
        </button>
        <button class="dograh-send-btn" id="dograh-text-send-btn" title="Send message">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Voice Action Footer -->
    <div class="dograh-footer dograh-voice-footer" id="dograh-voice-footer" style="display:none;">
      <button class="dograh-call-action-btn" id="dograh-call-action-btn">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
          <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02C8.79 6.32 8.59 5.13 8.59 3.9c0-.55-.45-1-1-1H4.01c-.55 0-1 .45-1 1C3 16.92 12.08 21 21 21c.55 0 1-.45 1-1v-3.62c0-.55-.45-1-1-1z"/>
        </svg>
        <span>Start Voice Call</span>
      </button>
    </div>
  `;
  container.appendChild(panel);
  document.body.appendChild(container);

  // Toggle Panel
  const closeBtn = panel.querySelector('.dograh-close-btn');

  function togglePanel() {
    if (panel.classList.contains('show')) {
      panel.classList.remove('show');
      toggleBtn.classList.remove('active');
      setTimeout(() => { panel.style.display = 'none'; }, 300);
    } else {
      panel.style.display = 'flex';
      setTimeout(() => {
        panel.classList.add('show');
        toggleBtn.classList.add('active');
      }, 10);
    }
  }

  toggleBtn.addEventListener('click', togglePanel);
  closeBtn.addEventListener('click', togglePanel);

  // Tab switching
  const tabText = panel.querySelector('#dograh-tab-text');
  const tabVoice = panel.querySelector('#dograh-tab-voice');
  const textFooter = panel.querySelector('#dograh-text-footer');
  const voiceFooter = panel.querySelector('#dograh-voice-footer');
  const textInput = panel.querySelector('#dograh-text-input');
  const textSendBtn = panel.querySelector('#dograh-text-send-btn');
  const textMicBtn = panel.querySelector('#dograh-text-mic-btn');

  tabText.addEventListener('click', () => {
    tabText.classList.add('active');
    tabVoice.classList.remove('active');
    textFooter.style.display = 'block';
    voiceFooter.style.display = 'none';
    textInput.focus();
  });

  tabVoice.addEventListener('click', () => {
    tabVoice.classList.add('active');
    tabText.classList.remove('active');
    textFooter.style.display = 'none';
    voiceFooter.style.display = 'flex';
  });

  // Elements
  const chatWindow = panel.querySelector('#dograh-chat-window');
  const headerCallBtn = panel.querySelector('#dograh-header-call-btn');
  const bottomCallBtn = panel.querySelector('#dograh-call-action-btn');
  const callBanner = panel.querySelector('#dograh-call-banner');
  const callBannerText = panel.querySelector('#dograh-call-banner-text');
  const endCallPill = panel.querySelector('#dograh-end-call-pill');

  let activeSessionId = null;

  // Simple Markdown parsing for chat messages
  function formatMiniMarkdown(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\*([^*]+)\*/g, '<i>$1</i>')
      .replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;">$1</code>')
      .replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gim, '<ul style="margin:4px 0 4px 16px;padding:0;">$1</ul>')
      .replace(/<\/ul>\s*<ul>/gim, '')
      .replace(/\n/g, '<br/>');
    return html;
  }

  // Helper to append chat messages
  function appendChatMessage(sender, text, isInterim = false) {
    if (!text || !text.trim()) return;

    if (sender === 'system') {
      const sysDiv = document.createElement('div');
      sysDiv.className = 'dograh-msg system';
      sysDiv.innerText = text;
      chatWindow.appendChild(sysDiv);
      chatWindow.scrollTop = chatWindow.scrollHeight;
      return;
    }

    let interimEl = chatWindow.querySelector('#dograh-interim-msg-row');

    if (isInterim) {
      if (!interimEl) {
        interimEl = document.createElement('div');
        interimEl.id = 'dograh-interim-msg-row';
        interimEl.className = `dograh-msg-row ${sender}`;
        if (sender === 'assistant') {
          interimEl.innerHTML = `
            <div class="dograh-msg-avatar">
              <svg viewBox="0 0 24 24"><path d="M12 2a1 1 0 0 1 1 1v2h3a2 2 0 0 1 2 2v2.1c1.1.4 2 1.5 2 2.9v2a3 3 0 0 1-3 3h-1v1a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-1H7a3 3 0 0 1-3-3v-2c0-1.4.9-2.5 2-2.9V7a2 2 0 0 1 2-2h3V3a1 1 0 0 1 1-1z"/></svg>
            </div>
            <div class="dograh-msg interim"></div>
          `;
        } else {
          interimEl.innerHTML = `<div class="dograh-msg interim"></div>`;
        }
        chatWindow.appendChild(interimEl);
      }
      interimEl.querySelector('.dograh-msg').innerText = text;
    } else {
      if (interimEl) {
        interimEl.remove();
      }

      const lastRow = chatWindow.lastElementChild;
      if (lastRow && lastRow.classList.contains(sender)) {
        const lastText = lastRow.getAttribute('data-text') || '';
        if (lastText === text) return;
      }

      const rowDiv = document.createElement('div');
      rowDiv.className = `dograh-msg-row ${sender}`;
      rowDiv.setAttribute('data-text', text);

      if (sender === 'assistant') {
        rowDiv.innerHTML = `
          <div class="dograh-msg-avatar">
            <svg viewBox="0 0 24 24"><path d="M12 2a1 1 0 0 1 1 1v2h3a2 2 0 0 1 2 2v2.1c1.1.4 2 1.5 2 2.9v2a3 3 0 0 1-3 3h-1v1a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-1H7a3 3 0 0 1-3-3v-2c0-1.4.9-2.5 2-2.9V7a2 2 0 0 1 2-2h3V3a1 1 0 0 1 1-1z"/></svg>
          </div>
          <div class="dograh-msg">${formatMiniMarkdown(text)}</div>
        `;
      } else {
        rowDiv.innerHTML = `<div class="dograh-msg">${text}</div>`;
      }

      chatWindow.appendChild(rowDiv);
    }

    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  // Text Message Sending via Claude AI Agent
  async function sendTextMessage(promptText) {
    const text = (promptText || textInput.value).trim();
    if (!text) return;

    textInput.value = '';
    appendChatMessage('user', text);
    appendChatMessage('assistant', 'Thinking...', true);

    try {
      const response = await fetch('/custom_ai_agent/send_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: {
            session_id: activeSessionId || null,
            message: text,
          }
        }),
      });

      const resJson = await response.json();
      const result = resJson.result;

      if (result && result.session_id) {
        activeSessionId = result.session_id;
      }

      if (result && result.assistant_message) {
        appendChatMessage('assistant', result.assistant_message.content);
      } else if (result && result.error) {
        appendChatMessage('assistant', '⚠️ ' + result.error);
      } else {
        appendChatMessage('assistant', 'I have processed your request.');
      }
    } catch (err) {
      appendChatMessage('assistant', '⚠️ Failed to connect to AI Agent.');
    }
  }

  textSendBtn.addEventListener('click', () => sendTextMessage());
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendTextMessage();
    }
  });

  // Suggestion Chips Click
  chatWindow.addEventListener('click', (e) => {
    const chip = e.target.closest('.dograh-chip');
    if (!chip) return;

    const action = chip.getAttribute('data-action');
    const prompt = chip.getAttribute('data-prompt');

    if (action === 'voice') {
      toggleVoiceCall();
    } else if (prompt) {
      sendTextMessage(prompt);
    }
  });

  // Speech Recognition for Text Mic button
  let dictationRecognizer = null;
  let isDictating = false;

  function toggleDictation() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isDictating) {
      if (dictationRecognizer) dictationRecognizer.stop();
      isDictating = false;
      textMicBtn.classList.remove('listening');
      return;
    }

    dictationRecognizer = new SpeechRecognition();
    dictationRecognizer.continuous = false;
    dictationRecognizer.interimResults = true;
    dictationRecognizer.lang = 'en-IN';

    dictationRecognizer.onstart = () => {
      isDictating = true;
      textMicBtn.classList.add('listening');
    };

    dictationRecognizer.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      textInput.value = transcript;
    };

    dictationRecognizer.onend = () => {
      isDictating = false;
      textMicBtn.classList.remove('listening');
      if (textInput.value.trim()) {
        sendTextMessage();
      }
    };

    dictationRecognizer.onerror = () => {
      isDictating = false;
      textMicBtn.classList.remove('listening');
    };

    dictationRecognizer.start();
  }

  textMicBtn.addEventListener('click', toggleDictation);

  // Call State & Controllers
  let isCallActive = false;
  let speechRecognizer = null;
  let lastAppendedAgentMsg = '';
  let lastAppendedUserMsg = '';
  const recentUserTexts = new Set();
  let isAgentSpeaking = false;
  let agentSpeakingSilenceTimer = null;
  const recentAgentTexts = [];
  const MAX_RECENT_AGENT = 5;

  function textSimilarity(a, b) {
    if (!a || !b) return 0;
    const wa = a.toLowerCase().split(/\s+/);
    const wb = b.toLowerCase().split(/\s+/);
    const setB = new Set(wb);
    const overlap = wa.filter(w => setB.has(w)).length;
    return overlap / Math.max(wa.length, wb.length);
  }

  function isEchoOfAgentSpeech(text) {
    return recentAgentTexts.some(agentText => textSimilarity(text, agentText) > 0.65);
  }

  function setAgentSpeaking(speaking) {
    if (agentSpeakingSilenceTimer) {
      clearTimeout(agentSpeakingSilenceTimer);
      agentSpeakingSilenceTimer = null;
    }
    if (speaking) {
      isAgentSpeaking = true;
      if (speechRecognizer) {
        try { speechRecognizer.stop(); } catch (e) {}
      }
    } else {
      agentSpeakingSilenceTimer = setTimeout(() => {
        isAgentSpeaking = false;
        agentSpeakingSilenceTimer = null;
        if (isCallActive && speechRecognizer) {
          try { speechRecognizer.start(); } catch (e) {}
        }
      }, 1800);
    }
  }

  function isCleanReadableText(str) {
    if (typeof str !== 'string') return false;
    str = str.trim();
    if (!str || str.length === 0) return false;
    if (str.startsWith('data:') || str.startsWith('blob:')) return false;
    if (str.startsWith('rtf-') || str.startsWith('rtf_') || str.startsWith('event-') || str.startsWith('sys-')) return false;
    if (/^[a-z0-9_.-]+$/i.test(str) && !str.includes(' ') && (str.includes('-') || str.includes('_'))) return false;
    if (str.length > 50 && !str.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(str)) return false;
    if (/^[0-9,\s]+$/.test(str) && str.length > 15) return false;
    if (str.startsWith('{') || str.startsWith('[')) return false;
    return true;
  }

  function extractDeepText(obj) {
    if (!obj) return null;
    if (typeof obj === 'string') {
      return isCleanReadableText(obj) ? obj.trim() : null;
    }
    if (typeof obj !== 'object') return null;

    if (obj.payload) {
      const nested = extractDeepText(obj.payload);
      if (nested) return nested;
    }
    if (obj.data) {
      const nested = extractDeepText(obj.data);
      if (nested) return nested;
    }

    const textFields = ['transcript', 'text', 'content', 'message', 'speech', 'sentence', 'delta'];
    for (let field of textFields) {
      if (obj[field]) {
        const res = extractDeepText(obj[field]);
        if (res) return res;
      }
    }
    return null;
  }

  function detectRoleAndText(rawPayload) {
    if (!rawPayload) return null;
    let role = 'assistant';
    let text = null;

    if (typeof rawPayload === 'object') {
      const typeStr = String(rawPayload.type || rawPayload.event || '').toLowerCase();
      const roleStr = String(rawPayload.role || rawPayload.speaker || rawPayload.source || rawPayload.sender || '').toLowerCase();

      const isUserSpeech = (
        typeStr.includes('user') || typeStr.includes('human') ||
        typeStr.includes('stt') || typeStr.includes('transcription') ||
        typeStr.includes('input_transcript') || typeStr.includes('user_transcript') ||
        roleStr.includes('user') || roleStr.includes('human') || roleStr.includes('stt')
      );

      const isAssistantSpeech = (
        typeStr.includes('bot') || typeStr.includes('agent') || typeStr.includes('assistant') ||
        typeStr.includes('output_transcript') || typeStr.includes('agent_transcript') ||
        roleStr.includes('bot') || roleStr.includes('agent') || roleStr.includes('assistant')
      );

      if (isUserSpeech) {
        role = 'user';
      } else if (isAssistantSpeech) {
        role = 'assistant';
      }

      const isAgentSpeakingEvent = (
        typeStr.includes('bot-started-speaking') || typeStr.includes('agent-started-speaking') ||
        typeStr.includes('bot_started_speaking') || typeStr.includes('agent_started_speaking') ||
        typeStr.includes('tts-started') || typeStr.includes('tts_started') ||
        typeStr.includes('speaking-started') || typeStr.includes('speaking_started') ||
        typeStr.includes('speech-start') || typeStr.includes('voice-start')
      );
      const isAgentDoneEvent = (
        typeStr.includes('bot-stopped-speaking') || typeStr.includes('agent-stopped-speaking') ||
        typeStr.includes('bot_stopped_speaking') || typeStr.includes('agent_stopped_speaking') ||
        typeStr.includes('tts-ended') || typeStr.includes('tts_ended') ||
        typeStr.includes('speaking-ended') || typeStr.includes('speaking_ended') ||
        typeStr.includes('speech-end') || typeStr.includes('voice-end') ||
        typeStr.includes('audio-end') || typeStr.includes('audio_end')
      );
      if (isAgentSpeakingEvent) setAgentSpeaking(true);
      if (isAgentDoneEvent) setAgentSpeaking(false);

      text = extractDeepText(rawPayload);
    } else if (typeof rawPayload === 'string') {
      text = extractDeepText(rawPayload);
    }

    if (!text || !isCleanReadableText(text)) return null;
    return { role, text };
  }

  function handleAnyIncomingAgentTranscript(rawPayload, sourceName) {
    if (!isCallActive || !rawPayload) return;
    try {
      const detected = detectRoleAndText(rawPayload);
      if (detected && detected.text) {
        if (detected.role === 'user') {
          if (detected.text !== lastAppendedUserMsg && !recentUserTexts.has(detected.text)) {
            lastAppendedUserMsg = detected.text;
            recentUserTexts.add(detected.text);
            appendChatMessage('user', detected.text, false);
            setTimeout(() => recentUserTexts.delete(detected.text), 8000);
          }
        } else {
          if (recentUserTexts.has(detected.text)) return;
          if (detected.text !== lastAppendedAgentMsg) {
            lastAppendedAgentMsg = detected.text;
            recentAgentTexts.push(detected.text);
            if (recentAgentTexts.length > MAX_RECENT_AGENT) recentAgentTexts.shift();
            setAgentSpeaking(true);
            appendChatMessage('assistant', detected.text, false);
            const estimatedSpeakMs = Math.max(2000, detected.text.length * 55);
            setTimeout(() => setAgentSpeaking(false), estimatedSpeakMs);
          }
        }
      }
    } catch (err) {}
  }

  window.__handleDograhWsFrame = function(frameData) {
    handleAnyIncomingAgentTranscript(frameData, 'WebSocket');
  };

  function normalizeErpSpokenText(text) {
    if (!text || typeof text !== 'string') return text;
    let clean = text;
    clean = clean.replace(/\b(create|add|new|make|edit|delete|update|assign|view|show|check|find|open)\s+(a\s+|an\s+)?(text|tast|test|tax)\b/gi, '$1 $2task');
    clean = clean.replace(/\b(create|add|make)\s+(text|tast|test)\b/gi, '$1 task');
    clean = clean.replace(/\b(new|my|our|pending|overdue)\s+(text|tast|test|texts)\b/gi, '$1 task');
    clean = clean.replace(/\b(a\s+new\s+)(text|tast|test)\b/gi, '$1task');
    return clean;
  }

  function startBrowserSpeechRecognition() {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      if (speechRecognizer) {
        try { speechRecognizer.stop(); } catch (e) {}
      }

      speechRecognizer = new SpeechRecognition();
      speechRecognizer.continuous = true;
      speechRecognizer.interimResults = true;
      speechRecognizer.lang = 'en-IN';

      speechRecognizer.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (isAgentSpeaking) return;

        if (interimTranscript && isCleanReadableText(interimTranscript)) {
          if (!isEchoOfAgentSpeech(interimTranscript)) {
            appendChatMessage('user', normalizeErpSpokenText(interimTranscript), true);
          }
        }

        if (finalTranscript && isCleanReadableText(finalTranscript)) {
          const cleanFinal = normalizeErpSpokenText(finalTranscript.trim());
          if (cleanFinal) {
            if (isEchoOfAgentSpeech(cleanFinal)) return;
            lastAppendedUserMsg = cleanFinal;
            recentUserTexts.add(cleanFinal);
            setTimeout(() => recentUserTexts.delete(cleanFinal), 8000);
            appendChatMessage('user', cleanFinal, false);
          }
        }
      };

      speechRecognizer.onend = () => {
        if (isCallActive && !isAgentSpeaking) {
          try { speechRecognizer.start(); } catch (e) {}
        }
      };

      speechRecognizer.start();
    } catch (e) {}
  }

  function stopBrowserSpeechRecognition() {
    if (speechRecognizer) {
      try { speechRecognizer.stop(); } catch (e) {}
      speechRecognizer = null;
    }
  }

  // Voice Call Start / Stop
  function resetCallUI() {
    isCallActive = false;
    stopBrowserSpeechRecognition();

    headerCallBtn.classList.remove('calling');
    headerCallBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
        <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02C8.79 6.32 8.59 5.13 8.59 3.9c0-.55-.45-1-1-1H4.01c-.55 0-1 .45-1 1C3 16.92 12.08 21 21 21c.55 0 1-.45 1-1v-3.62c0-.55-.45-1-1-1z"/>
      </svg>
      <span>Call</span>
    `;

    bottomCallBtn.classList.remove('calling');
    bottomCallBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
        <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02C8.79 6.32 8.59 5.13 8.59 3.9c0-.55-.45-1-1-1H4.01c-.55 0-1 .45-1 1C3 16.92 12.08 21 21 21c.55 0 1-.45 1-1v-3.62c0-.55-.45-1-1-1z"/>
      </svg>
      <span>Start Voice Call</span>
    `;

    callBanner.classList.remove('active');
    
    if (typeof tabText !== 'undefined' && tabText) {
      tabText.click();
    }
  }

  function setConnectedCallUI() {
    isCallActive = true;
    startBrowserSpeechRecognition();

    headerCallBtn.classList.add('calling');
    headerCallBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
      </svg>
      <span>End</span>
    `;

    bottomCallBtn.classList.add('calling');
    bottomCallBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
      </svg>
      <span>End Call</span>
    `;

    callBanner.classList.add('active');
    callBannerText.innerText = '🎙️ Voice Call Active — Speak now';
  }

  function toggleVoiceCall() {
    if (isCallActive) {
      if (window.DograhWidget && typeof window.DograhWidget.stop === 'function') {
        window.DograhWidget.stop();
      }
      resetCallUI();
      appendChatMessage('system', 'Voice call ended.');
      return;
    }

    // Switch to voice tab if in text mode
    tabVoice.click();

    headerCallBtn.innerHTML = `Connecting...`;
    bottomCallBtn.innerHTML = `Connecting...`;
    callBanner.classList.add('active');
    callBannerText.innerText = 'Connecting to Voice Agent...';

    loadDograhWidget(userToken, userName, userEmail, () => {
      const startWidgetCall = () => {
        if (window.DograhWidget) {
          if (!window.DograhWidget.__eventsBound) {
            window.DograhWidget.onCallConnected(() => setConnectedCallUI());
            window.DograhWidget.onCallDisconnected(() => resetCallUI());
            window.DograhWidget.onCallEnd(() => resetCallUI());
            window.DograhWidget.onError((err) => {
              resetCallUI();
              appendChatMessage('system', 'Call disconnected.');
            });
            window.DograhWidget.__eventsBound = true;
          }

          try {
            const state = window.DograhWidget.getState();
            if (state && state.isInitialized) {
              window.DograhWidget.start();
            } else {
              window.DograhWidget.onReady(() => window.DograhWidget.start());
            }
          } catch (e) {
            resetCallUI();
          }
        } else {
          resetCallUI();
        }
      };

      setTimeout(startWidgetCall, 400);
    });
  }

  headerCallBtn.addEventListener('click', toggleVoiceCall);
  bottomCallBtn.addEventListener('click', toggleVoiceCall);
  endCallPill.addEventListener('click', toggleVoiceCall);
}

// Boot with logged-in user profile
fetch('/api/profile?_nocache=' + new Date().getTime())
  .then(response => {
    if (!response.ok) throw new Error("Not logged in");
    return response.json();
  })
  .then(data => {
    if (data.data && data.data.api_token) {
      initDograhAgentWidget(
        data.data.api_token,
        data.data.name || '',
        data.data.email || '',
        data.data.login || ''
      );
    } else {
      initDograhAgentWidget('', '', '', '');
    }
  })
  .catch(() => {
    initDograhAgentWidget('', '', '', '');
  });
