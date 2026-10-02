/** @odoo-module **/

console.log("🚀 Dograh Voice Widget & Chat Panel Initialization Started!");


// const embedToken = 'emb_Yfp3_17Q5260rhMRcA4HIpCkTiMNihfhbJTBnbQa3p4'
const embedToken = 'emb_tWAkgiqQQDmfLUx-fhVYirmHlBqlR7Z2v78DqyyJR5E'
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
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1e3a8a, #3b82f6);
    box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
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
      box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
    }
    25% {
      transform: translateY(-3px) rotateX(6deg) rotateY(-6deg);
      box-shadow: -3px 8px 20px rgba(59, 130, 246, 0.5);
    }
    50% {
      transform: translateY(-6px) rotateX(0) rotateY(0);
      box-shadow: 0 10px 24px rgba(59, 130, 246, 0.6);
    }
    75% {
      transform: translateY(-3px) rotateX(-6deg) rotateY(6deg);
      box-shadow: 3px 8px 20px rgba(59, 130, 246, 0.5);
    }
    100% {
      transform: translateY(0) rotateX(0) rotateY(0);
      box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
    }
  }
  #dograh-toggle-btn:hover {
    transform: scale(1.06) translateY(-2px) rotateX(0) rotateY(0) !important;
    box-shadow: 0 8px 24px rgba(59, 130, 246, 0.6) !important;
    animation-play-state: paused;
  }
  #dograh-toggle-btn span {
    font-size: 17px;
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
    bottom: 56px;
    right: 0;
    width: 320px;
    height: 410px;
    max-height: calc(100vh - 120px);
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15);
    flex-direction: column;
    overflow: hidden;
    transition: all 0.35s cubic-bezier(0.075, 0.82, 0.165, 1);
    transform: translateY(16px) scale(0.96);
    opacity: 0;
    transform-origin: bottom right;
  }
  #dograh-panel.show {
    display: flex;
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  .dograh-header {
    padding: 10px 14px;
    background: linear-gradient(135deg, rgba(30, 58, 138, 0.75) 0%, rgba(59, 130, 246, 0.75) 100%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: white;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }
  .dograh-title-area {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dograh-avatar {
    width: 32px;
    height: 32px;
    background: #4f46e5;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    flex-shrink: 0;
  }
  .dograh-avatar svg {
    width: 18px;
    height: 18px;
    fill: white;
  }
  .dograh-status-dot {
    width: 6px;
    height: 6px;
    background-color: #22c55e;
    border-radius: 50%;
    box-shadow: 0 0 6px rgba(34, 197, 94, 0.8);
  }
  .dograh-title {
    font-weight: 700;
    font-size: 13.5px;
    color: #ffffff;
    margin: 0;
    letter-spacing: 0.1px;
    line-height: 1.2;
  }
  .dograh-subtitle {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.9);
    margin-top: 1px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .dograh-close-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    padding: 2px 4px;
    transition: color 0.2s, transform 0.2s;
  }
  .dograh-close-btn:hover {
    color: #ffffff;
    transform: scale(1.1);
  }
  .dograh-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    background: transparent;
  }
  /* Voice view */
  .dograh-voice-panel {
    padding: 12px 14px 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    height: 100%;
    box-sizing: border-box;
    background: transparent;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-behavior: smooth;
  }
  .dograh-voice-panel::-webkit-scrollbar {
    width: 4px;
  }
  .dograh-voice-panel::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
  .dograh-voice-header-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }
  .dograh-voice-icon-container {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #eff6ff;
    border: 2px solid #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0;
    animation: dograh-pulse 2s infinite;
  }
  .dograh-voice-icon-container svg {
    width: 20px;
    height: 20px;
  }
  @keyframes dograh-pulse {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
    70% { transform: scale(1.05); box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  }
  .dograh-voice-title {
    font-size: 13.5px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
    line-height: 1.2;
  }
  .dograh-voice-desc {
    display: block;
    font-size: 11px;
    color: #64748b;
    line-height: 1.35;
    max-width: 250px;
    margin: 0;
  }
  .dograh-call-btn {
    width: 100%;
    padding: 8px 14px;
    border-radius: 8px;
    border: none;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    font-weight: 700;
    font-size: 12.5px;
    cursor: pointer;
    box-shadow: 0 3px 8px rgba(16, 185, 129, 0.25);
    transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-sizing: border-box;
    flex-shrink: 0;
  }
  .dograh-call-btn:hover {
    transform: translateY(-1px) scale(1.01);
    box-shadow: 0 5px 14px rgba(16, 185, 129, 0.35);
  }
  /* Live Subtitles & Transcript Box */
  .dograh-live-transcript-box {
    width: 100%;
    background: rgba(248, 250, 252, 0.95);
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 8px 10px;
    text-align: left;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: all 0.3s ease;
    min-height: 100px;
    box-sizing: border-box;
  }
  .dograh-transcript-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .dograh-transcript-badge {
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 2px 6px;
    border-radius: 12px;
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
    height: 10px;
    background: #3b82f6;
    border-radius: 3px;
    animation: dograh-wave-anim 1s infinite ease-in-out;
  }
  .dograh-transcript-wave span:nth-child(2) { animation-delay: 0.2s; }
  .dograh-transcript-wave span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes dograh-wave-anim {
    0%, 100% { height: 4px; }
    50% { height: 12px; }
  }
  .dograh-transcript-content {
    font-size: 11.5px;
    color: #334155;
    line-height: 1.4;
    flex: 1;
    min-height: 60px;
    max-height: 130px;
    overflow-y: auto;
    word-break: break-word;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-right: 4px;
    scroll-behavior: smooth;
  }
  .dograh-transcript-content::-webkit-scrollbar {
    width: 4px;
  }
  .dograh-transcript-content::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
  .dograh-transcript-entry {
    padding: 6px 8px;
    border-radius: 8px;
    font-size: 11px;
    line-height: 1.35;
    max-width: 92%;
    word-wrap: break-word;
    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
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
    font-size: 9.5px;
    margin-bottom: 1px;
    display: block;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .dograh-transcript-placeholder {
    font-style: italic;
    color: #64748b;
    font-size: 11px;
    text-align: center;
    padding: 16px 8px;
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
    <div class="dograh-content">
      <div class="dograh-voice-panel">
        <div class="dograh-voice-icon-container" id="dograh-voice-status-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#3b82f6">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02C8.79 6.32 8.59 5.13 8.59 3.9c0-.55-.45-1-1-1H4.01c-.55 0-1 .45-1 1C3 16.92 12.08 21 21 21c.55 0 1-.45 1-1v-3.62c0-.55-.45-1-1-1z"/>
          </svg>
        </div>
        <div class="dograh-voice-title" id="dograh-voice-status-title">Roongta Voice Agent</div>
        
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
          <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02C8.79 6.32 8.59 5.13 8.59 3.9c0-.55-.45-1-1-1H4.01c-.55 0-1 .45-1 1C3 16.92 12.08 21 21 21c.55 0 1-.45 1-1v-3.62c0-.55-.45-1-1-1z"/>
          </svg>
          Start Call
        </button>
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
