/** @odoo-module **/

console.log("🚀 Dograh Voice Widget & Chat Panel Initialization Started!");


// const embedToken = 'emb_Yfp3_17Q5260rhMRcA4HIpCkTiMNihfhbJTBnbQa3p4'
const embedToken = 'emb_l_VVC61l9Tnno5kjxsTx6WP8dXUhacyq98VswaPMPkc'
const backendUrl = 'https://dograhaibackend.techvizor.in';
const frontendUrl = 'https://dograhai.techvizor.in';

// const embedToken = 'emb_QJHbbdF5H55QBLrvN27QjsKBn-SoQg5fWeqhG3CCcI4';
// const backendUrl = 'http://localhost:8000';
// const frontendUrl = 'http://localhost:3000';
const css = `
  #dograh-container {
    position: fixed;
    bottom: 60px;
    right: 20px;
    z-index: 999999;
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  #dograh-toggle-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1e3a8a, #3b82f6);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    border: none;
    outline: none;
    animation: dograh-float-3d 4s ease-in-out infinite;
    transform-style: preserve-3d;
    perspective: 1000px;
  }
  @keyframes dograh-float-3d {
    0% {
      transform: translateY(0) rotateX(0) rotateY(0);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
    }
    25% {
      transform: translateY(-4px) rotateX(8deg) rotateY(-8deg);
      box-shadow: -4px 10px 25px rgba(59, 130, 246, 0.5);
    }
    50% {
      transform: translateY(-8px) rotateX(0) rotateY(0);
      box-shadow: 0 12px 30px rgba(59, 130, 246, 0.6);
    }
    75% {
      transform: translateY(-4px) rotateX(-8deg) rotateY(8deg);
      box-shadow: 4px 10px 25px rgba(59, 130, 246, 0.5);
    }
    100% {
      transform: translateY(0) rotateX(0) rotateY(0);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
    }
  }
  #dograh-toggle-btn:hover {
    transform: scale(1.08) translateY(-3px) rotateX(0) rotateY(0) !important;
    box-shadow: 0 10px 30px rgba(59, 130, 246, 0.6) !important;
    animation-play-state: paused;
  }
  #dograh-toggle-btn span {
    font-size: 20px;
    font-weight: 700;
    color: #ffffff;
    transition: transform 0.3s;
    animation: dograh-sparkle-pulse 2s infinite ease-in-out;
  }
  @keyframes dograh-sparkle-pulse {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 2px rgba(255,255,255,0.4)); }
    50% { transform: scale(1.15); filter: drop-shadow(0 0 8px rgba(255,255,255,0.9)); }
  }
  #dograh-toggle-btn.active {
    animation-play-state: paused;
  }
  #dograh-toggle-btn.active span {
    transform: scale(0.8) rotate(90deg) !important;
    animation: none;
  }
  #dograh-panel {
    display: none;
    position: absolute;
    bottom: 75px;
    right: 0;
    width: 380px;
    height: 580px;
    max-height: calc(100vh - 100px);
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 24px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
    flex-direction: column;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.075, 0.82, 0.165, 1);
    transform: translateY(20px) scale(0.95);
    opacity: 0;
    transform-origin: bottom right;
  }
  #dograh-panel.show {
    display: flex;
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  .dograh-header {
    padding: 18px 24px;
    background: linear-gradient(135deg, rgba(30, 58, 138, 0.6) 0%, rgba(59, 130, 246, 0.6) 100%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: white;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .dograh-title-area {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .dograh-avatar {
    width: 44px;
    height: 44px;
    background: #6366f1;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  }
  .dograh-avatar svg {
    width: 24px;
    height: 24px;
    fill: white;
  }
  .dograh-status-dot {
    width: 8px;
    height: 8px;
    background-color: #22c55e;
    border-radius: 50%;
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.8);
  }
  .dograh-title {
    font-weight: 700;
    font-size: 17px;
    color: #ffffff;
    margin: 0;
    letter-spacing: 0.2px;
  }
  .dograh-subtitle {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.9);
    margin-top: 4px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .dograh-close-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    font-size: 26px;
    line-height: 1;
    transition: color 0.2s, transform 0.2s;
  }
  .dograh-close-btn:hover {
    color: #ffffff;
    transform: scale(1.1);
  }
  .dograh-tabs {
    display: flex;
    background: rgba(255, 255, 255, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 12px;
    margin: 16px;
    padding: 4px;
    gap: 4px;
  }
  .dograh-tab-btn {
    flex: 1;
    padding: 10px 16px;
    text-align: center;
    background: transparent;
    border: none;
    border-radius: 10px;
    color: #475569;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .dograh-tab-btn:hover {
    background: rgba(255, 255, 255, 0.5);
  }
  .dograh-tab-btn.active {
    color: #ffffff;
    background: #3b82f6;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
  }
  .dograh-tab-btn svg {
    fill: currentColor;
    width: 16px;
    height: 16px;
  }
  .dograh-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    background: transparent;
  }
  .dograh-tab-content {
    display: none;
    flex: 1;
    flex-direction: column;
    overflow: hidden;
    animation: fadeIn 0.3s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .dograh-tab-content.active {
    display: flex;
  }
  /* Chat view */
  .dograh-chat-window {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    scroll-behavior: smooth;
  }
  .dograh-chat-window::-webkit-scrollbar {
    width: 6px;
  }
  .dograh-chat-window::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
  .dograh-msg {
    padding: 12px 16px;
    border-radius: 16px;
    max-width: 82%;
    font-size: 13.5px;
    line-height: 1.5;
    word-wrap: break-word;
    box-shadow: 0 2px 5px rgba(0,0,0,0.02);
    position: relative;
  }
  .dograh-msg.user {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: #ffffff;
    align-self: flex-end;
    border-bottom-right-radius: 4px;
  }
  .dograh-msg.assistant {
    background: rgba(255, 255, 255, 0.65);
    color: #1e293b;
    align-self: flex-start;
    border-bottom-left-radius: 4px;
    border: 1px solid #e2e8f0;
  }
  .dograh-msg.system {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #ef4444;
    align-self: center;
    text-align: center;
    max-width: 90%;
    font-size: 11.5px;
    border-radius: 12px;
    padding: 8px 12px;
  }
  .dograh-input-area {
    padding: 16px 20px;
    background: rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-top: 1px solid rgba(255, 255, 255, 0.5);
    display: flex;
    gap: 10px;
    margin: 0;
    align-items: center;
  }
  .dograh-input-area input {
    flex: 1;
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.85);
    color: #0f172a;
    font-size: 14px;
    outline: none;
    transition: all 0.3s;
    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  }
  .dograh-input-area input:focus {
    border-color: #3b82f6;
    background: #ffffff;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }
  .dograh-send-btn {
    padding: 12px 20px;
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .dograh-send-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 15px rgba(37, 99, 235, 0.3);
  }
  .dograh-send-btn:active {
    transform: translateY(0);
  }
  /* Voice view */
  .dograh-voice-panel {
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
    height: 100%;
    box-sizing: border-box;
    background: transparent;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-behavior: smooth;
  }
  .dograh-voice-panel::-webkit-scrollbar {
    width: 5px;
  }
  .dograh-voice-panel::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
  .dograh-voice-header-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .dograh-voice-icon-container {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: #eff6ff;
    border: 2px solid #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2px;
    animation: dograh-pulse 2s infinite;
  }
  .dograh-voice-icon-container svg {
    width: 24px;
    height: 24px;
  }
  @keyframes dograh-pulse {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
    70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  }
  .dograh-voice-title {
    font-size: 16px;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
    line-height: 1.2;
  }
  .dograh-voice-desc {
    display: block;
    font-size: 12px;
    color: #64748b;
    line-height: 1.4;
    max-width: 280px;
    margin: 0;
  }
  .dograh-call-btn {
    width: 100%;
    padding: 12px 20px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-sizing: border-box;
    flex-shrink: 0;
  }
  .dograh-call-btn:hover {
    transform: translateY(-2px) scale(1.01);
    box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
  }
  /* Live Subtitles & Transcript Box */
  .dograh-live-transcript-box {
    width: 100%;
    background: rgba(248, 250, 252, 0.95);
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 10px 12px;
    text-align: left;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: all 0.3s ease;
    min-height: 160px;
    box-sizing: border-box;
  }
  .dograh-transcript-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .dograh-transcript-badge {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 3px 8px;
    border-radius: 20px;
    background: #e0f2fe;
    color: #0284c7;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .dograh-transcript-badge.user-speaking {
    background: #dcfce7;
    color: #15803d;
  }
  .dograh-transcript-badge.agent-speaking {
    background: #eff6ff;
    color: #2563eb;
  }
  .dograh-transcript-wave {
    display: none;
    align-items: center;
    gap: 3px;
  }
  .dograh-transcript-wave.active {
    display: flex;
  }
  .dograh-transcript-wave span {
    width: 3px;
    height: 12px;
    background: #3b82f6;
    border-radius: 3px;
    animation: dograh-wave-anim 1s infinite ease-in-out;
  }
  .dograh-transcript-wave span:nth-child(2) { animation-delay: 0.2s; }
  .dograh-transcript-wave span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes dograh-wave-anim {
    0%, 100% { height: 5px; }
    50% { height: 15px; }
  }
  .dograh-transcript-content {
    font-size: 12.5px;
    color: #334155;
    line-height: 1.45;
    flex: 1;
    min-height: 90px;
    max-height: 200px;
    overflow-y: auto;
    word-break: break-word;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding-right: 4px;
    scroll-behavior: smooth;
  }
  .dograh-transcript-content::-webkit-scrollbar {
    width: 5px;
  }
  .dograh-transcript-content::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
  .dograh-transcript-entry {
    padding: 8px 10px;
    border-radius: 10px;
    font-size: 12px;
    line-height: 1.4;
    max-width: 92%;
    word-wrap: break-word;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    animation: fadeIn 0.2s ease;
  }
  .dograh-transcript-entry.user {
    background: #e0f2fe;
    color: #0369a1;
    align-self: flex-end;
    border-bottom-right-radius: 2px;
  }
  .dograh-transcript-entry.agent {
    background: #ffffff;
    color: #0f172a;
    align-self: flex-start;
    border: 1px solid #e2e8f0;
    border-bottom-left-radius: 2px;
  }
  .dograh-transcript-entry.interim {
    opacity: 0.75;
    font-style: italic;
    background: #f1f5f9;
    align-self: flex-end;
  }
  .dograh-transcript-sender {
    font-weight: 700;
    font-size: 10.5px;
    margin-bottom: 2px;
    display: block;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .dograh-transcript-placeholder {
    font-style: italic;
    color: #64748b;
    font-size: 12px;
    text-align: center;
    padding: 30px 10px;
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
        console.log("🌐 [Dograh WS Wire Frame]:", rawData);
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

      // Pass context variables via data attribute so the widget parses them for the WebRTC session
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

  // Toggle Button SVG
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'dograh-toggle-btn';
  toggleBtn.innerHTML = `
    <span>AI</span>
  `;
  container.appendChild(toggleBtn);

  // Panel
  const panel = document.createElement('div');
  panel.id = 'dograh-panel';
  panel.innerHTML = `
    <div class="dograh-header">
      <div class="dograh-title-area">
        <div class="dograh-avatar">
          <svg viewBox="0 0 24 24">
            <path d="M12 2a1 1 0 0 1 1 1v2h3a2 2 0 0 1 2 2v2.1c1.1.4 2 1.5 2 2.9v2a3 3 0 0 1-3 3h-1v1a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-1H7a3 3 0 0 1-3-3v-2c0-1.4.9-2.5 2-2.9V7a2 2 0 0 1 2-2h3V3a1 1 0 0 1 1-1zm3 5H9a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm-4 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM12 16h-3v1a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1z"/>
          </svg>
        </div>
        <div>
          <div class="dograh-title">Roongta ERP Assistant</div>
          <div class="dograh-subtitle">
            <div class="dograh-status-dot"></div> Online
          </div>
        </div>
      </div>
      <button class="dograh-close-btn">&times;</button>
    </div>
    <div class="dograh-tabs">
      <button class="dograh-tab-btn active" data-tab="chat">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
        Text Chat
      </button>
      <button class="dograh-tab-btn" data-tab="voice">
        <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
        Voice Call
      </button>
    </div>
    <div class="dograh-content">
      <div class="dograh-tab-content active" id="dograh-tab-chat">
        <div class="dograh-chat-window" id="dograh-chat-window">
          <div class="dograh-msg assistant">Hello! I am your AI Assistant. How can I help you today?</div>
        </div>
        <form class="dograh-input-area" id="dograh-chat-form">
          <input type="text" id="dograh-chat-input" placeholder="Type a message..." required autocomplete="off">
          <button type="submit" class="dograh-send-btn">Send</button>
        </form>
      </div>
      <div class="dograh-tab-content" id="dograh-tab-voice">
        <div class="dograh-voice-panel">
          <div class="dograh-voice-icon-container" id="dograh-voice-status-icon">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="#3b82f6">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02C8.79 6.32 8.59 5.13 8.59 3.9c0-.55-.45-1-1-1H4.01c-.55 0-1 .45-1 1C3 16.92 12.08 21 21 21c.55 0 1-.45 1-1v-3.62c0-.55-.45-1-1-1z"/>
            </svg>
          </div>
          <div class="dograh-voice-title" id="dograh-voice-status-title">Roongta Voice Agent</div>
          <div class="dograh-voice-desc" id="dograh-voice-status-desc">Experience real-time interactive voice calls with live text transcripts.</div>
          
          <div class="dograh-live-transcript-box" id="dograh-live-transcript-box">
            <div class="dograh-transcript-header">
              <span class="dograh-transcript-badge" id="dograh-transcript-badge">Live Subtitles</span>
              <div class="dograh-transcript-wave" id="dograh-transcript-wave">
                <span></span><span></span><span></span>
              </div>
            </div>
            <div class="dograh-transcript-content" id="dograh-transcript-content">
              <div class="dograh-transcript-placeholder">
                Click 'Start Call' to talk. Your voice chat history will appear here in real-time.
              </div>
            </div>
          </div>

          <button class="dograh-call-btn" id="dograh-call-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02C8.79 6.32 8.59 5.13 8.59 3.9c0-.55-.45-1-1-1H4.01c-.55 0-1 .45-1 1C3 16.92 12.08 21 21 21c.55 0 1-.45 1-1v-3.62c0-.55-.45-1-1-1z"/>
            </svg>
            Start Call
          </button>
        </div>
      </div>
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

  // Tabs Switching
  const tabButtons = panel.querySelectorAll('.dograh-tab-btn');
  const tabContents = panel.querySelectorAll('.dograh-tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      panel.querySelector('#dograh-tab-' + targetTab).classList.add('active');
    });
  });

  // Global call state flag
  let isCallActive = false;

  // Real-Time Transcript & Live Subtitles Controller
  const transcriptBadge = panel.querySelector('#dograh-transcript-badge');
  const transcriptWave = panel.querySelector('#dograh-transcript-wave');
  const transcriptContent = panel.querySelector('#dograh-transcript-content');
  let speechRecognizer = null;
  let lastAppendedAgentMsg = '';
  let isAgentSpeaking = false;
  let agentSpeakingTimer = null;
  let isTranscriptPlaceholderRemoved = false;

  // Helper to validate clean, human-readable text (ignores binary data, base64, JSON, or comma-separated bytes)
  function isCleanReadableText(str) {
    if (typeof str !== 'string') return false;
    str = str.trim();
    if (!str || str.length === 0) return false;

    // Reject base64, data URIs, or binary blob URLs
    if (str.startsWith('data:') || str.startsWith('blob:')) return false;
    // Reject long unspaced base64 / binary hashes
    if (str.length > 50 && !str.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(str)) return false;
    // Reject comma-separated byte arrays like "0, 12, 255..."
    if (/^[0-9,\s]+$/.test(str) && str.length > 15) return false;
    // Reject raw JSON string blocks
    if (str.startsWith('{') || str.startsWith('[')) return false;

    return true;
  }

  function triggerAgentSpeakingState(text) {
    isAgentSpeaking = true;
    if (agentSpeakingTimer) clearTimeout(agentSpeakingTimer);

    // Keep agent speaking flag active while audio plays (clears 3.5s after last sentence chunk)
    agentSpeakingTimer = setTimeout(() => {
      isAgentSpeaking = false;
      transcriptWave.classList.remove('active');
    }, 3500);
  }

  function setLiveTranscript(speaker, text, isInterim = false) {
    if (!text || !text.trim()) return;

    if (speaker === 'user') {
      transcriptBadge.className = 'dograh-transcript-badge user-speaking';
      transcriptBadge.innerText = isInterim ? '🎙️ User Speaking...' : '👤 You Spoke';
    } else if (speaker === 'agent') {
      transcriptBadge.className = 'dograh-transcript-badge agent-speaking';
      transcriptBadge.innerText = isInterim ? '🤖 Agent Speaking...' : '🤖 AI Agent';
    } else {
      transcriptBadge.className = 'dograh-transcript-badge';
      transcriptBadge.innerText = 'Live Subtitles';
    }

    transcriptWave.classList.add('active');

    // Remove placeholder on first transcript turn
    const placeholder = transcriptContent.querySelector('.dograh-transcript-placeholder');
    if (placeholder) {
      placeholder.remove();
      isTranscriptPlaceholderRemoved = true;
    }

    let interimEl = transcriptContent.querySelector('#dograh-interim-entry');

    if (isInterim) {
      if (!interimEl) {
        interimEl = document.createElement('div');
        interimEl.id = 'dograh-interim-entry';
        interimEl.className = `dograh-transcript-entry interim ${speaker}`;
        transcriptContent.appendChild(interimEl);
      }
      const label = speaker === 'user' ? 'You' : 'Agent';
      interimEl.innerHTML = `<span class="dograh-transcript-sender">🎙️ ${label} Speaking...</span> ${text}`;
    } else {
      // Remove interim bubble if present
      if (interimEl) {
        interimEl.remove();
      }

      // Check if duplicate of last permanent entry to prevent repeated lines
      const lastChild = transcriptContent.lastElementChild;
      if (!lastChild || lastChild.getAttribute('data-text') !== text) {
        const entryDiv = document.createElement('div');
        entryDiv.className = `dograh-transcript-entry ${speaker}`;
        entryDiv.setAttribute('data-text', text);
        const label = speaker === 'user' ? '👤 You' : '🤖 AI Agent';
        entryDiv.innerHTML = `<span class="dograh-transcript-sender">${label}</span> ${text}`;
        transcriptContent.appendChild(entryDiv);
      }
    }

    // Auto-scroll to bottom so latest chat entry is visible
    transcriptContent.scrollTop = transcriptContent.scrollHeight;

    if (!isInterim) {
      setTimeout(() => {
        if (!isAgentSpeaking) {
          transcriptWave.classList.remove('active');
        }
      }, 2500);
    }
  }

  // Web Speech API - Browser Real-Time Speech-to-Text for User
  function startBrowserSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API (SpeechRecognition) is not supported in this browser environment.");
      return;
    }

    try {
      if (speechRecognizer) {
        try { speechRecognizer.stop(); } catch (e) {}
      }

      speechRecognizer = new SpeechRecognition();
      speechRecognizer.continuous = true;
      speechRecognizer.interimResults = true;
      speechRecognizer.lang = 'en-US';

      speechRecognizer.onresult = (event) => {
        // Prevent mic echo: ignore mic input while AI Agent is actively speaking through computer speakers
        if (isAgentSpeaking) {
          console.log("ℹ️ Muting mic speech recognition while AI agent is speaking.");
          return;
        }

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (interimTranscript && isCleanReadableText(interimTranscript)) {
          setLiveTranscript('user', interimTranscript, true);
        }

        if (finalTranscript && isCleanReadableText(finalTranscript)) {
          const cleanFinal = finalTranscript.trim();
          if (cleanFinal) {
            setLiveTranscript('user', cleanFinal, false);
            appendChatMessage('user', cleanFinal);
          }
        }
      };

      speechRecognizer.onerror = (err) => {
        if (err.error !== 'no-speech' && err.error !== 'aborted') {
          console.warn("SpeechRecognition notice:", err.error);
        }
      };

      speechRecognizer.onend = () => {
        if (isCallActive) {
          try { speechRecognizer.start(); } catch (e) {}
        }
      };

      speechRecognizer.start();
      console.log("🎙️ Live User Speech Recognition Started!");
    } catch (e) {
      console.error("Could not start Speech Recognition:", e);
    }
  }

  function stopBrowserSpeechRecognition() {
    if (speechRecognizer) {
      try {
        speechRecognizer.stop();
        console.log("⏹️ Live User Speech Recognition Stopped.");
      } catch (e) {}
      speechRecognizer = null;
    }
  }

  // Helper to extract clean text from any nested payload or structure
  function extractDeepText(obj) {
    if (!obj) return null;
    if (typeof obj === 'string') {
      return isCleanReadableText(obj) ? obj.trim() : null;
    }
    if (typeof obj === 'object') {
      const priorityKeys = ['text', 'transcript', 'content', 'message', 'response', 'delta', 'utterance', 'words', 'say', 'speech', 'value'];
      for (const key of priorityKeys) {
        if (obj[key]) {
          const res = extractDeepText(obj[key]);
          if (res) return res;
        }
      }
      if (obj.payload) {
        const res = extractDeepText(obj.payload);
        if (res) return res;
      }
      if (obj.data) {
        const res = extractDeepText(obj.data);
        if (res) return res;
      }
      if (obj.detail) {
        const res = extractDeepText(obj.detail);
        if (res) return res;
      }
    }
    return null;
  }

  // Unified Handler for any incoming Agent transcript event (RTF & WebRTC events)
  function handleAnyIncomingAgentTranscript(rawPayload, sourceName = 'Unknown') {
    if (!isCallActive || !rawPayload) return;

    try {
      console.log(`💬 [Dograh Event via ${sourceName}]:`, rawPayload);

      const msgType = String(rawPayload.type || rawPayload.event || rawPayload.msg_type || '').toLowerCase();

      // Tool execution status (e.g. creating tasks in Odoo ERP)
      if (msgType === 'rtf-function-call-start' || msgType.includes('function-call-start')) {
        isAgentSpeaking = true;
        setLiveTranscript('agent', '⚙️ Executing ERP action...', true);
        return;
      }
      if (msgType === 'rtf-function-call-end' || msgType.includes('function-call-end')) {
        isAgentSpeaking = false;
        return;
      }
      if (msgType === 'rtf-user-mute-started' || msgType.includes('user-mute')) {
        isAgentSpeaking = true;
        return;
      }

      // Determine speaker / role
      let speaker = 'agent';
      if (msgType === 'rtf-user-transcription' || msgType.includes('user-transcription')) {
        speaker = 'user';
      } else if (typeof rawPayload === 'object') {
        const role = String(rawPayload.role || rawPayload.speaker || rawPayload.sender || '').toLowerCase();
        if (role.includes('user') || role.includes('human') || role.includes('client')) {
          speaker = 'user';
        }
      }

      if (speaker === 'user') {
        const text = extractDeepText(rawPayload);
        if (text && isCleanReadableText(text)) {
          setLiveTranscript('user', text, false);
        }
        return;
      }

      // Handle speech start / end events for Agent
      if (msgType.includes('start') || msgType.includes('speaking')) {
        isAgentSpeaking = true;
        setLiveTranscript('agent', 'AI Agent is speaking...', true);
      }
      if (msgType.includes('stop') || msgType.includes('end') || msgType.includes('finished')) {
        isAgentSpeaking = false;
      }

      const text = extractDeepText(rawPayload);
      if (text && text !== lastAppendedAgentMsg && isCleanReadableText(text)) {
        triggerAgentSpeakingState(text);
        lastAppendedAgentMsg = text;
        setLiveTranscript('agent', text, false);
        appendChatMessage('assistant', text);
      }
    } catch (err) {
      console.warn("Could not process transcript payload:", err);
    }
  }

  // Bind WebSocket Wire Interceptor Frame Handler
  window.__handleDograhWsFrame = function(frameData) {
    handleAnyIncomingAgentTranscript(frameData, 'WebSocket Wire Interceptor');
  };

  // Active Call Session Poller - Inspects window.DograhWidget live state in memory (no HTTP GET 404s)
  let voiceSessionPollTimer = null;

  function pollLatestSessionTurn() {
    if (!isCallActive || !window.DograhWidget) return;

    try {
      const state = typeof window.DograhWidget.getState === 'function' ? window.DograhWidget.getState() : (window.DograhWidget.state || window.DograhWidget._state);
      if (state) {
        // Inspect turns / messages / history in SDK state
        const turns = state.turns || state.messages || state.history || (state.session_data && state.session_data.turns);
        if (turns && turns.length > 0) {
          for (let i = turns.length - 1; i >= 0; i--) {
            const turn = turns[i];
            if (turn) {
              const turnRole = String(turn.role || turn.speaker || turn.type || '').toLowerCase();
              if (!turnRole.includes('user') && !turnRole.includes('human')) {
                const text = extractDeepText(turn.assistant_message || turn.assistant || turn.agent || turn.text || turn.content || turn);
                if (text && text !== lastAppendedAgentMsg && isCleanReadableText(text)) {
                  console.log("💬 [Dograh Widget State Sync]: Found LLM turn:", text);
                  triggerAgentSpeakingState(text);
                  lastAppendedAgentMsg = text;
                  setLiveTranscript('agent', text, false);
                  appendChatMessage('assistant', text);
                  return;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      // Silently catch state inspection
    }
  }

  function startVoiceSessionPolling() {
    stopVoiceSessionPolling();
    voiceSessionPollTimer = setInterval(pollLatestSessionTurn, 1000);
  }

  function stopVoiceSessionPolling() {
    if (voiceSessionPollTimer) {
      clearInterval(voiceSessionPollTimer);
      voiceSessionPollTimer = null;
    }
  }

  // Global postMessage Listener for External Agent Transcripts
  window.addEventListener('message', (event) => {
    if (!isCallActive) return;
    try {
      const rawData = event.data;
      if (!rawData) return;

      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      handleAnyIncomingAgentTranscript(data, 'postMessage');
    } catch (e) {
      // Safe catch for non-JSON postMessages
    }
  });

  // Custom DOM Event Listeners
  ['dograh:transcript', 'dograh:message', 'dograh:agent_speech', 'dograh_transcript', 'dograh_message', 'agent_transcript'].forEach(evtName => {
    window.addEventListener(evtName, (e) => handleAnyIncomingAgentTranscript(e.detail || e, 'window.CustomEvent:' + evtName));
    document.addEventListener(evtName, (e) => handleAnyIncomingAgentTranscript(e.detail || e, 'document.CustomEvent:' + evtName));
  });

  // Call Button
  const callBtn = panel.querySelector('#dograh-call-btn');
  const originalCallBtnHtml = callBtn.innerHTML;

  callBtn.addEventListener('click', () => {
    if (isCallActive && window.DograhWidget) {
      window.DograhWidget.stop();
      return;
    }

    // Show loading state
    callBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
        <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02C8.79 6.32 8.59 5.13 8.59 3.9c0-.55-.45-1-1-1H4.01c-.55 0-1 .45-1 1C3 16.92 12.08 21 21 21c.55 0 1-.45 1-1v-3.62c0-.55-.45-1-1-1z"/>
      </svg>
      Connecting...
    `;
    callBtn.style.opacity = '0.7';
    callBtn.style.cursor = 'wait';
    callBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';

    appendChatMessage('system', 'Connecting to Voice Agent...');

    loadDograhWidget(userToken, userName, userEmail, () => {
      const resetBtn = () => {
        isCallActive = false;
        stopBrowserSpeechRecognition();
        stopVoiceSessionPolling();
        callBtn.innerHTML = originalCallBtnHtml;
        callBtn.style.opacity = '1';
        callBtn.style.cursor = 'pointer';
        callBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        transcriptWave.classList.remove('active');
        transcriptBadge.className = 'dograh-transcript-badge';
        transcriptBadge.innerText = 'Live Subtitles';
      };

      const setConnectedBtn = () => {
        isCallActive = true;
        startBrowserSpeechRecognition();
        startVoiceSessionPolling();
        callBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
          </svg>
          End Call
        `;
        callBtn.style.opacity = '1';
        callBtn.style.cursor = 'pointer';
        callBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      };

      const startWidgetCall = () => {
        if (window.DograhWidget) {
          // Bind events if not already bound
          if (!window.DograhWidget.__eventsBound) {
            window.DograhWidget.onCallConnected(() => {
              setConnectedBtn();
            });
            window.DograhWidget.onCallDisconnected(() => {
              resetBtn();
            });
            window.DograhWidget.onCallEnd(() => {
              resetBtn();
            });
            window.DograhWidget.onError((err) => {
              resetBtn();
              console.error("Voice Widget Error:", err);
            });

            // EventEmitter style binding on DograhWidget if present
            if (typeof window.DograhWidget.on === 'function') {
              ['transcript', 'message', 'agent_message', 'agent_speech', 'response', 'speech', 'text', 'bot_message'].forEach(evtName => {
                try {
                  window.DograhWidget.on(evtName, (data) => {
                    handleAnyIncomingAgentTranscript(data, 'DograhWidget.on(' + evtName + ')');
                  });
                } catch (e) {}
              });
            }

            // Function callback style binding on DograhWidget if present
            if (typeof window.DograhWidget.onTranscript === 'function') {
              window.DograhWidget.onTranscript((data) => {
                handleAnyIncomingAgentTranscript(data, 'DograhWidget.onTranscript');
              });
            }
            if (typeof window.DograhWidget.onMessage === 'function') {
              window.DograhWidget.onMessage((msg) => {
                handleAnyIncomingAgentTranscript(msg, 'DograhWidget.onMessage');
              });
            }

            window.DograhWidget.__eventsBound = true;
          }

          try {
            const state = window.DograhWidget.getState();
            if (state && state.isInitialized) {
              window.DograhWidget.start();
            } else {
              window.DograhWidget.onReady(() => {
                window.DograhWidget.start();
              });
            }
          } catch (e) {
            console.error("Could not auto-start widget:", e);
            resetBtn();
          }
        } else {
          resetBtn();
        }
      };

      // Slight delay to ensure scripts are fully parsed
      setTimeout(startWidgetCall, 500);
    });
  });

  // Text Chat Logic
  let textSessionToken = '';
  let currentRevision = 0;

  const chatForm = panel.querySelector('#dograh-chat-form');
  const chatInput = panel.querySelector('#dograh-chat-input');
  const chatWindow = panel.querySelector('#dograh-chat-window');

  function appendChatMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `dograh-msg ${sender}`;
    msgDiv.innerText = text;
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  async function initTextChat() {
    try {
      const response = await fetch(backendUrl + '/api/v1/public/embed/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: embedToken,
          service_mode: 'text',
          context_variables: {
            erp_api_token: userToken || '',
            user_id: userLogin || userName || 'odoo_user',
            is_authenticated: !!userToken
          }
        })
      });

      if (!response.ok) throw new Error('Session initialization failed');
      const data = await response.json();
      textSessionToken = data.session_token;

      // Load history
      const historyRes = await fetch(backendUrl + '/api/v1/public/embed/text-chat/' + textSessionToken);
      if (historyRes.ok) {
        const session = await historyRes.json();
        currentRevision = session.revision;

        const turns = session.session_data && session.session_data.turns;
        if (turns && turns.length > 0) {
          chatWindow.innerHTML = '';
          turns.forEach(turn => {
            if (turn.user_message && turn.user_message.text) {
              appendChatMessage('user', turn.user_message.text);
            }
            if (turn.assistant_message && turn.assistant_message.text) {
              appendChatMessage('assistant', turn.assistant_message.text);
            }
          });
        }
      }
    } catch (e) {
      appendChatMessage('system', 'Failed to connect to Chat Assistant.');
      console.error(e);
    }
  }

  initTextChat();

  /**
   * Extract the reply text from an assistant_message object.
   * The Dograh API may use different field names depending on version:
   * text | content | message | response
   */
  function extractAssistantText(assistantMsg) {
    if (!assistantMsg) return null;
    return assistantMsg.text
      || assistantMsg.content
      || assistantMsg.message
      || assistantMsg.response
      || null;
  }

  /**
   * Poll the session GET endpoint until a new assistant reply appears.
   *
   * WHY THIS IS REQUIRED:
   * The Dograh backend is async. When the AI calls an ERP tool (create task, move task, etc.)
   * the POST /messages endpoint returns immediately with assistant_message = null.
   * The AI generates its reply AFTER the tool finishes. Without polling, the
   * typing indicator is removed and the user sees a blank response.
   *
   * maxWaitMs = 90s  — ERP tool calls can take 30-60s
   * intervalMs = 800ms — poll fast so reply shows as soon as it's ready
   */
  async function pollForAssistantReply(typingEl, maxWaitMs, intervalMs) {
    maxWaitMs = maxWaitMs || 90000;
    intervalMs = intervalMs || 800;
    const deadline = Date.now() + maxWaitMs;
    const statusMessages = [
      'AI is thinking...',
      'Calling ERP tools...',
      'Processing your request...',
      'Almost there...'
    ];
    let statusIndex = 0;
    let lastStatusChange = Date.now();
    let pollCount = 0;

    while (Date.now() < deadline) {
      await new Promise(function(resolve) { setTimeout(resolve, intervalMs); });
      pollCount++;

      // Cycle the typing indicator text every 8s so user knows it hasn't frozen
      if (typingEl && typingEl.parentNode && (Date.now() - lastStatusChange) > 8000) {
        statusIndex = (statusIndex + 1) % statusMessages.length;
        typingEl.innerText = statusMessages[statusIndex];
        lastStatusChange = Date.now();
      }

      try {
        const res = await fetch(backendUrl + '/api/v1/public/embed/text-chat/' + textSessionToken);
        if (!res.ok) continue;
        const session = await res.json();

        // Log every 5th poll so we can inspect the actual session structure
        if (pollCount % 5 === 1) {
          console.log('[Dograh Poll #' + pollCount + '] session:', JSON.stringify(session).substring(0, 500));
        }

        currentRevision = session.revision;
        const turns = session.session_data && session.session_data.turns;
        if (!turns || turns.length === 0) continue;

        // Scan ALL turns from newest to oldest looking for any assistant reply.
        // The backend may add a NEW turn instead of updating the existing one.
        for (let i = turns.length - 1; i >= 0; i--) {
          const turn = turns[i];
          const replyText = extractAssistantText(turn.assistant_message);
          if (replyText) {
            console.log('[Dograh Poll] Found reply in turn[' + i + ']:', replyText.substring(0, 100));
            return replyText;
          }
        }
      } catch (pollErr) {
        console.warn('[Dograh Poll] Error:', pollErr.message);
        // network hiccup — keep polling
      }
    }
    console.warn('[Dograh Poll] Timed out after ' + pollCount + ' polls.');
    return null; // timed out
  }

  let isSending = false;

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text || isSending) return;

    // Guard: session must be initialized before sending
    if (!textSessionToken) {
      appendChatMessage('system', 'Chat session is not ready yet. Please wait a moment and try again.');
      return;
    }

    // Lock UI while waiting — prevents double-send and stacked requests
    isSending = true;
    chatInput.value = '';
    chatInput.disabled = true;

    const sendBtnEl = panel.querySelector('.dograh-send-btn');
    if (sendBtnEl) { sendBtnEl.disabled = true; sendBtnEl.style.opacity = '0.6'; }

    appendChatMessage('user', text);

    // Show typing indicator — stays visible during polling
    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'dograh-typing';
    typingIndicator.className = 'dograh-msg assistant';
    typingIndicator.innerText = 'AI is typing...';
    chatWindow.appendChild(typingIndicator);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    const removeTyping = function() {
      const ind = panel.querySelector('#dograh-typing');
      if (ind) ind.remove();
    };

    const unlockUI = function() {
      isSending = false;
      chatInput.disabled = false;
      if (sendBtnEl) { sendBtnEl.disabled = false; sendBtnEl.style.opacity = '1'; }
      chatInput.focus();
    };

    try {
      const sendRes = await fetch(backendUrl + '/api/v1/public/embed/text-chat/' + textSessionToken + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          expected_revision: currentRevision
        })
      });

      if (!sendRes.ok) {
        let errMsg = 'Failed to send message';
        try {
          const errData = await sendRes.json();
          errMsg = errData.detail || errData.message || errMsg;
        } catch (_) {}
        throw new Error(errMsg + ' (HTTP ' + sendRes.status + ')');
      }

      const session = await sendRes.json();
      currentRevision = session.revision;

      const turns = session.session_data && session.session_data.turns;
      const lastTurn = turns && turns.length > 0 ? turns[turns.length - 1] : null;

      if (lastTurn && lastTurn.assistant_message && lastTurn.assistant_message.text) {
        // Reply is already in the POST response — show immediately
        removeTyping();
        appendChatMessage('assistant', lastTurn.assistant_message.text);
        unlockUI();
      } else {
        // Reply is not ready yet — backend is running ERP tools asynchronously.
        // Keep typing indicator visible and poll until the reply arrives (up to 90s).
        const reply = await pollForAssistantReply(typingIndicator);
        removeTyping();
        if (reply) {
          appendChatMessage('assistant', reply);
        } else {
          appendChatMessage('system', 'No response received — the ERP may be busy. Please try again.');
        }
        unlockUI();
      }
    } catch (err) {
      removeTyping();
      appendChatMessage('system', 'Error: ' + err.message);
      console.error('Dograh chat error:', err);
      unlockUI();
    }
  });
}


// Fetch user profile and boot
fetch('/api/profile?_nocache=' + new Date().getTime())
  .then(response => {
    if (!response.ok) throw new Error("Not logged in");
    return response.json();
  })
  .then(data => {
    if (data.data && data.data.api_token) {
      console.log("✅ Odoo User Profile Fetched! API Token:", data.data.api_token);
      initDograhAgentWidget(
        data.data.api_token,
        data.data.name || '',
        data.data.email || '',
        data.data.login || ''
      );
    } else {
      console.log("⚠️ Logged in, but no API Token found in response:", data);
      initDograhAgentWidget('', '', '', '');
    }
  })
  .catch(err => {
    console.log("ℹ️ No active user session for Voice Agent.");
    initDograhAgentWidget('', '', '', '');
  });
