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
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  #dograh-toggle-btn {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6, #6366f1);
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    border: none;
    outline: none;
  }
  #dograh-toggle-btn:hover {
    transform: scale(1.08) translateY(-3px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.6);
  }
  #dograh-toggle-btn svg {
    width: 28px;
    height: 28px;
    fill: #ffffff;
    transition: transform 0.3s;
  }
  #dograh-toggle-btn.active svg {
    transform: scale(0.8) rotate(90deg);
  }
  #dograh-panel {
    display: none;
    position: absolute;
    bottom: 75px;
    right: 0;
    width: 360px;
    height: 520px;
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
    flex-direction: column;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
    transform: translateY(20px);
    opacity: 0;
  }
  #dograh-panel.show {
    display: flex;
    transform: translateY(0);
    opacity: 1;
  }
  .dograh-header {
    padding: 16px 20px;
    background: rgba(30, 41, 59, 0.5);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .dograh-title-area {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dograh-status-dot {
    width: 8px;
    height: 8px;
    background-color: #10b981;
    border-radius: 50%;
    box-shadow: 0 0 8px #10b981;
  }
  .dograh-title {
    font-weight: 700;
    font-size: 16px;
    color: #f8fafc;
    margin: 0;
  }
  .dograh-subtitle {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 2px;
  }
  .dograh-close-btn {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 24px;
    line-height: 1;
    transition: color 0.2s;
  }
  .dograh-close-btn:hover {
    color: #f8fafc;
  }
  .dograh-tabs {
    display: grid;
    grid-template-cols: 1fr 1fr;
    background: rgba(15, 23, 42, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .dograh-tab-btn {
    padding: 12px;
    text-align: center;
    background: none;
    border: none;
    color: #94a3b8;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    border-bottom: 2px solid transparent;
  }
  .dograh-tab-btn.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
    background: rgba(59, 130, 246, 0.05);
  }
  .dograh-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }
  .dograh-tab-content {
    display: none;
    flex: 1;
    flex-direction: column;
    overflow: hidden;
  }
  .dograh-tab-content.active {
    display: flex;
  }
  /* Chat view */
  .dograh-chat-window {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .dograh-msg {
    padding: 10px 14px;
    border-radius: 14px;
    max-width: 80%;
    font-size: 13px;
    line-height: 1.4;
    word-wrap: break-word;
  }
  .dograh-msg.user {
    background: #3b82f6;
    color: #ffffff;
    align-self: flex-end;
    border-bottom-right-radius: 2px;
  }
  .dograh-msg.assistant {
    background: rgba(255, 255, 255, 0.08);
    color: #f8fafc;
    align-self: flex-start;
    border-bottom-left-radius: 2px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  .dograh-msg.system {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
    align-self: center;
    text-align: center;
    max-width: 100%;
    font-size: 11px;
    border-radius: 8px;
  }
  .dograh-input-area {
    padding: 12px 16px;
    background: rgba(30, 41, 59, 0.4);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    gap: 8px;
    margin: 0;
  }
  .dograh-input-area input {
    flex: 1;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(15, 23, 42, 0.5);
    color: #ffffff;
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
  }
  .dograh-input-area input:focus {
    border-color: #3b82f6;
  }
  .dograh-send-btn {
    padding: 10px 16px;
    background: #10b981;
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .dograh-send-btn:hover {
    opacity: 0.9;
  }
  /* Voice view */
  .dograh-voice-panel {
    padding: 30px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 20px;
    height: 100%;
  }
  .dograh-voice-icon-container {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(59, 130, 246, 0.1);
    border: 2px dashed #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 10px;
    animation: dograh-pulse 2s infinite;
  }
  @keyframes dograh-pulse {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
    70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  }
  .dograh-voice-title {
    font-size: 18px;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }
  .dograh-voice-desc {
    font-size: 13px;
    color: #94a3b8;
    line-height: 1.5;
    max-width: 260px;
    margin: 0;
  }
  .dograh-call-btn {
    padding: 12px 28px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dograh-call-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(16, 185, 129, 0.4);
  }
`;

function loadDograhWidget(userToken, userName, userEmail) {
  (function (d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;

    var widgetUrl = frontendUrl + '/embed/dograh-widget.js?token=' + embedToken + '&environment=local&apiEndpoint=' + backendUrl;

    if (userToken) {
      widgetUrl += '&odoo_token=' + encodeURIComponent(userToken) +
        '&user_name=' + encodeURIComponent(userName) +
        '&user_email=' + encodeURIComponent(userEmail);
        
      // Pass context variables via data attribute so the widget parses them for the WebRTC session
      const contextData = {
        api_key: userToken,
        user_id: userName || 'odoo_user',
        is_authenticated: true
      };
      js.setAttribute('data-dograh-context', JSON.stringify(contextData));
    }

    js.src = widgetUrl;
    js.async = true;
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
    <svg viewBox="0 0 24 24" width="28" height="28" fill="white">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
      <circle cx="9" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/>
    </svg>
  `;
  container.appendChild(toggleBtn);

  // Panel
  const panel = document.createElement('div');
  panel.id = 'dograh-panel';
  panel.innerHTML = `
    <div class="dograh-header">
      <div class="dograh-title-area">
        <div class="dograh-status-dot"></div>
        <div>
          <div class="dograh-title">Dograh Assistant</div>
          <div class="dograh-subtitle">Ask anything or start a call</div>
        </div>
      </div>
      <button class="dograh-close-btn">&times;</button>
    </div>
    <div class="dograh-tabs">
      <button class="dograh-tab-btn active" data-tab="chat">Text Chat</button>
      <button class="dograh-tab-btn" data-tab="voice">Voice Call</button>
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
          <div class="dograh-voice-title">Dograh Voice Agent</div>
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
  callBtn.addEventListener('click', () => {
    loadDograhWidget(userToken, userName, userEmail);
    appendChatMessage('system', 'Voice Call Widget initialized. Click the phone icon to speak.');
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
            api_key: userToken || '',
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

      if (!sendRes.ok) throw new Error('Failed to send message');

      const session = await sendRes.json();
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
    } catch (err) {
      const indicator = panel.querySelector('#dograh-typing');
      if (indicator) indicator.remove();
      appendChatMessage('system', 'Error: ' + err.message);
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
