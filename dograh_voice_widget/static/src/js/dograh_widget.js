/** @odoo-module **/

console.log("🚀 Roongta ERP Standard AI Assistant Widget Initializing...");

const embedToken = 'emb_tWAkgiqQQDmfLUx-fhVYirmHlBqlR7Z2v78DqyyJR5E';
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
    width: 48px;
    height: 48px;
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
    font-size: 18px;
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
    bottom: 62px;
    right: 0;
    width: 360px;
    height: 520px;
    max-height: calc(100vh - 100px);
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    box-shadow: 0 16px 45px rgba(15, 23, 42, 0.16), 0 0 1px rgba(0, 0, 0, 0.05);
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

  /* Bottom Voice Action Bar */
  .dograh-footer {
    padding: 12px 16px;
    background: #ffffff;
    border-top: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
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

// Global WebSocket Wire Interceptor - Intercepts all Dograh RTF frames directly from the network wire
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
          <div class="dograh-subtitle">Online • AI Copilot</div>
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
    <div class="dograh-chat-window" id="dograh-chat-window">
      <div class="dograh-msg-row assistant">
        <div class="dograh-msg-avatar">
          <svg viewBox="0 0 24 24"><path d="M12 2a1 1 0 0 1 1 1v2h3a2 2 0 0 1 2 2v2.1c1.1.4 2 1.5 2 2.9v2a3 3 0 0 1-3 3h-1v1a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-1H7a3 3 0 0 1-3-3v-2c0-1.4.9-2.5 2-2.9V7a2 2 0 0 1 2-2h3V3a1 1 0 0 1 1-1z"/></svg>
        </div>
        <div>
          <div class="dograh-msg">
            Hello! 👋 I am your Roongta ERP Assistant. Tap 'Start Voice Call' below to speak with me directly.
          </div>
          <div class="dograh-chips">
            <button class="dograh-chip" data-action="voice">📌 Create new task</button>
            <button class="dograh-chip" data-action="voice">📊 Today's summary</button>
            <button class="dograh-chip" data-action="voice">📞 Start voice call</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Voice Action Bar -->
    <div class="dograh-footer">
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

  // Elements
  const chatWindow = panel.querySelector('#dograh-chat-window');
  const headerCallBtn = panel.querySelector('#dograh-header-call-btn');
  const bottomCallBtn = panel.querySelector('#dograh-call-action-btn');
  const callBanner = panel.querySelector('#dograh-call-banner');
  const callBannerText = panel.querySelector('#dograh-call-banner-text');
  const endCallPill = panel.querySelector('#dograh-end-call-pill');

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

      // Check last message — suppress exact duplicates and near-duplicate user messages.
      // Near-duplicate = user said something very similar (e.g. "Task name is" vs "Uh task name is").
      // In that case, replace the last bubble with the latest version instead of appending a new one.
      const lastRow = chatWindow.lastElementChild;
      if (lastRow && lastRow.classList.contains(sender)) {
        const lastText = lastRow.getAttribute('data-text') || '';
        if (lastText === text) return; // exact duplicate — skip
        if (sender === 'user' && typeof textSimilarity === 'function' && textSimilarity(lastText, text) > 0.70) {
          // Near-duplicate correction — update the existing bubble in place
          lastRow.setAttribute('data-text', text);
          const msgEl = lastRow.querySelector('.dograh-msg');
          if (msgEl) { msgEl.innerText = text; }
          chatWindow.scrollTop = chatWindow.scrollHeight;
          return;
        }
      }

      const rowDiv = document.createElement('div');
      rowDiv.className = `dograh-msg-row ${sender}`;
      rowDiv.setAttribute('data-text', text);

      if (sender === 'assistant') {
        rowDiv.innerHTML = `
          <div class="dograh-msg-avatar">
            <svg viewBox="0 0 24 24"><path d="M12 2a1 1 0 0 1 1 1v2h3a2 2 0 0 1 2 2v2.1c1.1.4 2 1.5 2 2.9v2a3 3 0 0 1-3 3h-1v1a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-1H7a3 3 0 0 1-3-3v-2c0-1.4.9-2.5 2-2.9V7a2 2 0 0 1 2-2h3V3a1 1 0 0 1 1-1z"/></svg>
          </div>
          <div class="dograh-msg">${text}</div>
        `;
      } else {
        rowDiv.innerHTML = `<div class="dograh-msg">${text}</div>`;
      }

      chatWindow.appendChild(rowDiv);
    }

    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  // Suggestion Chips Click
  chatWindow.addEventListener('click', (e) => {
    const chip = e.target.closest('.dograh-chip');
    if (!chip) return;

    const action = chip.getAttribute('data-action');
    const query = chip.getAttribute('data-query');

    if (action === 'voice') {
      toggleVoiceCall();
    } else if (query) {
      chatInput.value = query;
      chatForm.dispatchEvent(new Event('submit'));
    }
  });

  // Call State & Controllers
  let isCallActive = false;
  let speechRecognizer = null;
  let lastAppendedAgentMsg = '';
  let lastAppendedUserMsg = '';
  let voiceSessionPollTimer = null;
  // Track recent user speech transcripts to prevent WS echoes being misclassified as assistant messages
  const recentUserTexts = new Set();

  // Echo prevention: STOP the SpeechRecognizer while the AI agent is speaking (TTS output)
  // This prevents the AI's own voice from being picked up by the microphone and shown as user text.
  // Physically stopping the recognizer is more reliable than ignoring its results.
  let isAgentSpeaking = false;
  let agentSpeakingSilenceTimer = null;

  // Keep the last few agent texts for fuzzy similarity check
  const recentAgentTexts = [];
  const MAX_RECENT_AGENT = 5;

  function textSimilarity(a, b) {
    // Simple word-overlap ratio — catches mic transcriptions that are close but not exact
    if (!a || !b) return 0;
    const wa = a.toLowerCase().split(/\s+/);
    const wb = b.toLowerCase().split(/\s+/);
    const setB = new Set(wb);
    const overlap = wa.filter(w => setB.has(w)).length;
    return overlap / Math.max(wa.length, wb.length);
  }

  function isEchoOfAgentSpeech(text) {
    // Returns true if this text is suspiciously similar to something the agent just said
    return recentAgentTexts.some(agentText => textSimilarity(text, agentText) > 0.65);
  }

  function setAgentSpeaking(speaking) {
    if (agentSpeakingSilenceTimer) {
      clearTimeout(agentSpeakingSilenceTimer);
      agentSpeakingSilenceTimer = null;
    }
    if (speaking) {
      isAgentSpeaking = true;
      // Physically stop the recognizer so the browser doesn't process TTS audio at all
      if (speechRecognizer) {
        try { speechRecognizer.stop(); } catch (e) {}
      }
    } else {
      // Keep mic suppressed for 1800ms after agent finishes speaking
      // to let the TTS audio tail fully dissipate before re-enabling mic input.
      agentSpeakingSilenceTimer = setTimeout(() => {
        isAgentSpeaking = false;
        agentSpeakingSilenceTimer = null;
        // Restart recognizer now that agent is done speaking
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
    
    // Reject data URIs or blobs
    if (str.startsWith('data:') || str.startsWith('blob:')) return false;
    
    // Reject internal RTF / Dograh system events & action identifiers (e.g. rtf-node-transition, rtf-bot-started-speaking)
    if (str.startsWith('rtf-') || str.startsWith('rtf_') || str.startsWith('event-') || str.startsWith('sys-')) return false;
    if (/^[a-z0-9_.-]+$/i.test(str) && !str.includes(' ') && (str.includes('-') || str.includes('_'))) return false;

    // Reject long base64 hashes or comma-separated byte buffers
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

    // Check direct preferred text fields only (do NOT iterate over event/type/status keys)
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

      // Detect user speech / STT transcripts — these are echoes of what the user said
      // Many backends send these frames back over WS for confirmation — must NOT classify as assistant
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
      // If neither is detected, role stays 'assistant' (default)
      // But we guard below via recentUserTexts to prevent echo misclassification

      // Detect agent TTS start/stop events to mute the browser mic accordingly.
      // Many RTF backends emit events like 'bot-started-speaking', 'agent-speaking', etc.
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
          // Only show if not already shown by browser SpeechRecognition
          if (detected.text !== lastAppendedUserMsg && !recentUserTexts.has(detected.text)) {
            lastAppendedUserMsg = detected.text;
            recentUserTexts.add(detected.text);
            appendChatMessage('user', detected.text, false);
            // Expire this entry after 8 seconds
            setTimeout(() => recentUserTexts.delete(detected.text), 8000);
          }
        } else {
          // Guard: if this text matches any recent user speech, it is a backend echo — skip it
          if (recentUserTexts.has(detected.text)) return;
          if (detected.text !== lastAppendedAgentMsg) {
            lastAppendedAgentMsg = detected.text;
            // Store for fuzzy echo detection
            recentAgentTexts.push(detected.text);
            if (recentAgentTexts.length > MAX_RECENT_AGENT) recentAgentTexts.shift();
            // Agent is about to speak this text — physically stop the microphone to prevent echo
            setAgentSpeaking(true);
            appendChatMessage('assistant', detected.text, false);
            // Mark agent as done speaking after a duration proportional to text length.
            // ~130 words per minute average TTS = roughly 50ms per character.
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
    // Contextual phonetic corrections: 'text'/'tast'/'test' -> 'task' in ERP commands
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
      // Use Indian English (en-IN) for accurate accent & phonetic recognition in India
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

        // PRIMARY ECHO GUARD: recognizer is physically stopped while agent speaks,
        // so this handler should not fire. But as a safety net, drop results if flag is set.
        if (isAgentSpeaking) return;

        if (interimTranscript && isCleanReadableText(interimTranscript)) {
          // FUZZY ECHO GUARD: drop interim if it sounds like what the agent just said
          if (!isEchoOfAgentSpeech(interimTranscript)) {
            appendChatMessage('user', normalizeErpSpokenText(interimTranscript), true);
          }
        }

        if (finalTranscript && isCleanReadableText(finalTranscript)) {
          const cleanFinal = normalizeErpSpokenText(finalTranscript.trim());
          if (cleanFinal) {
            // FUZZY ECHO GUARD: drop final transcript if it closely matches agent speech
            if (isEchoOfAgentSpeech(cleanFinal)) return;
            // Register this text so the WS echo of the same transcript is suppressed
            lastAppendedUserMsg = cleanFinal;
            recentUserTexts.add(cleanFinal);
            setTimeout(() => recentUserTexts.delete(cleanFinal), 8000);
            appendChatMessage('user', cleanFinal, false);
          }
        }
      };

      speechRecognizer.onend = () => {
        // Only auto-restart if call is active AND agent is NOT currently speaking.
        // If agent is speaking, setAgentSpeaking(false) will restart it after the grace period.
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

  // Session polling is DISABLED — the WS interceptor (handleAnyIncomingAgentTranscript)
  // is the single source of truth for live messages during a voice call.
  // Having two sources caused duplicate messages (one from polling, one from WS events).
  function pollLatestSessionTurn() { /* disabled — WS interceptor handles all messages */ }

  function startVoiceSessionPolling() {
    // Polling disabled — no-op. Remove interval that caused double-appending.
    stopVoiceSessionPolling();
  }

  function stopVoiceSessionPolling() {
    if (voiceSessionPollTimer) {
      clearInterval(voiceSessionPollTimer);
      voiceSessionPollTimer = null;
    }
  }

  // Voice Call Start / Stop
  function resetCallUI() {
    isCallActive = false;
    stopBrowserSpeechRecognition();
    stopVoiceSessionPolling();

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
  }

  function setConnectedCallUI() {
    isCallActive = true;
    startBrowserSpeechRecognition();
    startVoiceSessionPolling();

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

    // Starting call
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
