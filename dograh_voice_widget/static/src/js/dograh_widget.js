/** @odoo-module **/

console.log("🚀 Dograh Voice Widget & Chat Panel Initialization Started!");


const embedToken = 'emb_Yfp3_17Q5260rhMRcA4HIpCkTiMNihfhbJTBnbQa3p4'
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
    padding: 40px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 24px;
    height: 100%;
    background: transparent;
  }
  .dograh-voice-icon-container {
    width: 90px;
    height: 90px;
    border-radius: 50%;
    background: #eff6ff;
    border: 2px solid #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 5px;
    animation: dograh-pulse 2s infinite;
  }
  @keyframes dograh-pulse {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
    70% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(59, 130, 246, 0); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  }
  .dograh-voice-title {
    font-size: 20px;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
  }
  .dograh-voice-desc {
    font-size: 14px;
    color: #64748b;
    line-height: 1.6;
    max-width: 280px;
    margin: 0;
  }
  .dograh-call-btn {
    padding: 14px 32px;
    border-radius: 14px;
    border: none;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    font-weight: 700;
    font-size: 15px;
    cursor: pointer;
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3);
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dograh-call-btn:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
  }
`;

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
          <div class="dograh-voice-icon-container">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="#3b82f6">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02C8.79 6.32 8.59 5.13 8.59 3.9c0-.55-.45-1-1-1H4.01c-.55 0-1 .45-1 1C3 16.92 12.08 21 21 21c.55 0 1-.45 1-1v-3.62c0-.55-.45-1-1-1z"/>
            </svg>
          </div>
          <div class="dograh-voice-title">Roongta Voice Agent</div>
          <div class="dograh-voice-desc">Experience real-time interactive voice calls with our AI agent to resolve queries instantly.</div>
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

  // Call Button
  const callBtn = panel.querySelector('#dograh-call-btn');
  const originalCallBtnHtml = callBtn.innerHTML;
  let isCallActive = false;

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
        callBtn.innerHTML = originalCallBtnHtml;
        callBtn.style.opacity = '1';
        callBtn.style.cursor = 'pointer';
        callBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      };

      const setConnectedBtn = () => {
        isCallActive = true;
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

        const turns = session.session_data.turns;
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

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    // Guard: session must be initialized before sending
    if (!textSessionToken) {
      appendChatMessage('system', 'Chat session is not ready yet. Please wait a moment and try again.');
      return;
    }

    chatInput.value = '';
    appendChatMessage('user', text);

    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'dograh-typing';
    typingIndicator.className = 'dograh-msg assistant';
    typingIndicator.innerText = 'AI is typing...';
    chatWindow.appendChild(typingIndicator);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
      const sendRes = await fetch(backendUrl + '/api/v1/public/embed/text-chat/' + textSessionToken + '/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          expected_revision: currentRevision
        })
      });

      const indicator = panel.querySelector('#dograh-typing');
      if (indicator) indicator.remove();

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
      if (turns && turns.length > 0) {
        // Only append the latest assistant reply instead of clearing the entire chat
        const lastTurn = turns[turns.length - 1];
        if (lastTurn.assistant_message && lastTurn.assistant_message.text) {
          appendChatMessage('assistant', lastTurn.assistant_message.text);
        } else {
          // Assistant message not yet available — re-render all turns as fallback
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
    } catch (err) {
      const indicator = panel.querySelector('#dograh-typing');
      if (indicator) indicator.remove();
      appendChatMessage('system', 'Error: ' + err.message);
      console.error('Dograh chat error:', err);
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
