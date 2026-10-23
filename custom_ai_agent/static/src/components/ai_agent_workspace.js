/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, onWillStart, onMounted, useState, useRef, markup } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { rpc } from "@web/core/network/rpc";

export class AiAgentWorkspace extends Component {
    setup() {
        this.action = useService("action");
        this.notification = useService("notification");
        this.dialog = useService("dialog");
        this.inputAreaRef = useRef("inputArea");
        this.messagesStreamRef = useRef("messagesStream");

        this.state = useState({
            sessions: [],
            currentSessionId: null,
            currentSession: null,
            messages: [],
            inputText: "",
            isGenerating: false,
            searchQuery: "",
            selectedModel: "claude-sonnet-5",
            models: [
                { id: "claude-sonnet-5", name: "Claude Sonnet 5 (Recommended)" },
                { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
                { id: "claude-opus-5", name: "Claude Opus 5" },
                { id: "claude-fable-5", name: "Claude Fable 5" },
            ],
            userName: "",
            isListening: false,
        });
        this.speechRecognizer = null;

        onWillStart(async () => {
            await this.loadConfig();
            await this.loadSessions();
        });

        onMounted(() => {
            this.scrollToBottom();
            this.focusInput();
        });
    }

    async loadConfig() {
        try {
            const data = await rpc("/custom_ai_agent/get_config", {});
            if (data.models && data.models.length > 0) {
                this.state.models = data.models;
            }
            if (data.default_model) {
                this.state.selectedModel = data.default_model;
            }
            if (data.user_name) {
                this.state.userName = data.user_name;
            }
        } catch (e) {
            console.error("Failed to load AI config", e);
        }
    }

    async loadSessions(targetSessionId = null) {
        try {
            const res = await rpc("/custom_ai_agent/get_sessions", {
                search_term: this.state.searchQuery,
            });
            this.state.sessions = res.sessions || [];

            if (this.state.sessions.length > 0) {
                const sessionToSelect = targetSessionId || (this.state.currentSessionId ? this.state.currentSessionId : this.state.sessions[0].id);
                await this.selectSession(sessionToSelect);
            } else {
                await this.createNewSession();
            }
        } catch (e) {
            console.error("Failed to load sessions", e);
        }
    }

    async selectSession(sessionId) {
        if (!sessionId) return;
        this.state.currentSessionId = sessionId;
        try {
            const data = await rpc("/custom_ai_agent/get_session", { session_id: sessionId });
            if (data && !data.error) {
                this.state.currentSession = data;
                this.state.messages = data.messages || [];
                if (data.model) {
                    this.state.selectedModel = data.model;
                }
                setTimeout(() => this.scrollToBottom(), 50);
            }
        } catch (e) {
            console.error("Error selecting session", e);
        }
    }

    async createNewSession() {
        try {
            const newSession = await rpc("/custom_ai_agent/create_session", {
                title: "New Conversation",
                model: this.state.selectedModel,
            });
            if (newSession && newSession.id) {
                await this.loadSessions(newSession.id);
                this.focusInput();
            }
        } catch (e) {
            console.error("Error creating session", e);
        }
    }

    async deleteSession(sessionId) {
        if (!confirm("Are you sure you want to delete this chat session?")) return;
        try {
            await rpc("/custom_ai_agent/delete_session", { session_id: sessionId });
            this.state.sessions = this.state.sessions.filter(s => s.id !== sessionId);
            if (this.state.currentSessionId === sessionId) {
                this.state.currentSessionId = null;
                await this.loadSessions();
            }
        } catch (e) {
            console.error("Error deleting session", e);
        }
    }

    async togglePinSession(sessionId) {
        try {
            const res = await rpc("/custom_ai_agent/pin_session", { session_id: sessionId });
            if (res.success) {
                const s = this.state.sessions.find(x => x.id === sessionId);
                if (s) s.is_pinned = res.is_pinned;
                this.state.sessions.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
            }
        } catch (e) {
            console.error("Error pinning session", e);
        }
    }

    async renameSession(sessionId, oldName) {
        const newName = prompt("Enter new chat title:", oldName);
        if (newName === null || !newName.trim()) return;
        try {
            const res = await rpc("/custom_ai_agent/rename_session", {
                session_id: sessionId,
                name: newName.trim(),
            });
            if (res.success) {
                const s = this.state.sessions.find(x => x.id === sessionId);
                if (s) s.name = res.name;
                if (this.state.currentSession && this.state.currentSession.id === sessionId) {
                    this.state.currentSession.name = res.name;
                }
            }
        } catch (e) {
            console.error("Error renaming session", e);
        }
    }

    async clearCurrentChat() {
        if (!this.state.currentSessionId) return;
        if (!confirm("Clear all messages in this conversation?")) return;
        try {
            await rpc("/custom_ai_agent/clear_session_messages", {
                session_id: this.state.currentSessionId,
            });
            this.state.messages = [];
        } catch (e) {
            console.error("Error clearing chat", e);
        }
    }

    onSearchSessions() {
        // dynamic filtering computed via getter
    }

    get filteredSessions() {
        if (!this.state.searchQuery.trim()) return this.state.sessions;
        const q = this.state.searchQuery.toLowerCase();
        return this.state.sessions.filter(s => s.name.toLowerCase().includes(q));
    }

    get currentSessionName() {
        if (this.state.currentSession && this.state.currentSession.name) {
            return this.state.currentSession.name;
        }
        const s = this.state.sessions.find(x => x.id === this.state.currentSessionId);
        return s ? s.name : "AI Agent";
    }

    onModelChange(ev) {
        this.state.selectedModel = ev.target.value;
    }

    onInputKeydown(ev) {
        if (ev.key === "Enter" && !ev.shiftKey) {
            ev.preventDefault();
            this.sendMessage();
        }
    }

    sendPrompt(promptText) {
        this.state.inputText = promptText;
        this.sendMessage();
    }

    toggleSpeechInput() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.notification.add("Speech recognition is not supported in this browser.", { type: "warning" });
            return;
        }

        if (this.state.isListening) {
            if (this.speechRecognizer) {
                try { this.speechRecognizer.stop(); } catch (e) {}
            }
            this.state.isListening = false;
            return;
        }

        try {
            this.speechRecognizer = new SpeechRecognition();
            this.speechRecognizer.continuous = false;
            this.speechRecognizer.interimResults = true;
            this.speechRecognizer.lang = "en-IN";

            this.speechRecognizer.onstart = () => {
                this.state.isListening = true;
            };

            this.speechRecognizer.onresult = (event) => {
                let transcript = "";
                for (let i = 0; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript;
                }
                this.state.inputText = transcript;
            };

            this.speechRecognizer.onend = () => {
                this.state.isListening = false;
                if (this.state.inputText.trim()) {
                    this.sendMessage();
                }
            };

            this.speechRecognizer.onerror = (event) => {
                console.error("Speech error", event);
                this.state.isListening = false;
            };

            this.speechRecognizer.start();
        } catch (e) {
            console.error("Speech initialization error", e);
            this.state.isListening = false;
        }
    }

    async sendMessage() {
        const text = this.state.inputText.trim();
        if (!text || this.state.isGenerating) return;

        if (!this.state.currentSessionId) {
            await this.createNewSession();
        }

        const sessionId = this.state.currentSessionId;
        this.state.inputText = "";

        // Optimistically add user message
        this.state.messages.push({
            role: "user",
            content: text,
            created_at: new Date().toISOString(),
        });

        this.state.isGenerating = true;
        this.scrollToBottom();

        try {
            const res = await rpc("/custom_ai_agent/send_message", {
                session_id: sessionId,
                message: text,
                model: this.state.selectedModel,
            });

            if (res.error) {
                let errDisplay = res.error;
                try {
                    const jsonMatch = errDisplay.match(/\{.*\}$/s);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (parsed.error && (parsed.error.message || parsed.error.type)) {
                            errDisplay = parsed.error.message || parsed.error.type;
                        }
                    }
                } catch (_) {}
                this.notification.add(errDisplay, { type: "danger", title: "AI Error" });
                this.state.messages.push({
                    role: "assistant",
                    content: `⚠️ **Notice:** ${errDisplay}`,
                    created_at: new Date().toISOString(),
                });
            } else if (res.assistant_message) {
                // Update session title in list if changed
                if (res.session_name) {
                    const sess = this.state.sessions.find(s => s.id === sessionId);
                    if (sess) sess.name = res.session_name;
                    if (this.state.currentSession) this.state.currentSession.name = res.session_name;
                }
                this.state.messages.push(res.assistant_message);
            }
        } catch (e) {
            console.error("Error sending message", e);
            this.notification.add("Failed to communicate with AI Agent.", { type: "danger" });
            this.state.messages.push({
                role: "assistant",
                content: `⚠️ **Request failed:** ${e.message || "Network error"}`,
                created_at: new Date().toISOString(),
            });
        } finally {
            this.state.isGenerating = false;
            setTimeout(() => this.scrollToBottom(), 50);
            this.focusInput();
        }
    }

    copyToClipboard(text) {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            this.notification.add("Copied to clipboard!", { type: "success" });
        });
    }

    speakText(text) {
        if (!window.speechSynthesis || !text) return;
        window.speechSynthesis.cancel();
        // Remove task links and markdown tokens for speech
        const cleanText = text
            .replace(/\[([^\]]+)\]\((?:#task-|task:)(\d+)\)/g, "$1")
            .replace(/[#*`_~[\]()|]/g, "")
            .replace(/\n+/g, " ");
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }

    exportChatMarkdown() {
        if (!this.state.messages || this.state.messages.length === 0) {
            this.notification.add("No messages to export.", { type: "warning" });
            return;
        }
        let md = `# Roongta AI Chat Export: ${this.currentSessionName}\n\n`;
        md += `*Exported on: ${new Date().toLocaleString()} | Model: ${this.state.selectedModel}*\n\n---\n\n`;

        for (const msg of this.state.messages) {
            const author = msg.role === "user" ? "👤 **User**" : "⚡ **Roongta AI**";
            md += `### ${author}\n\n${msg.content}\n\n---\n\n`;
        }

        const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `AI_Chat_${this.state.currentSessionId || "export"}.md`;
        a.click();
        URL.revokeObjectURL(a);
    }

    formatMarkdown(text) {
        if (!text) return markup("");
        let html = text;

        // Escape dangerous HTML tags
        html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Code blocks with syntax highlighting container & copy
        html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

        // Convert prompt action chips [Label](prompt:text)
        html = html.replace(/\[([^\]]+)\]\(prompt:([^)]+)\)/g, (match, label, promptText) => {
            return `<button type="button" class="ai-prompt-chip dograh-chip" data-prompt="${promptText.replace(/"/g, '&quot;')}">${label}</button>`;
        });

        // Convert task action links [Open Task](task:123) into interactive action buttons
        html = html.replace(/\[([^\]]+)\]\((?:#task-|task:)(\d+)\)/g, (match, label, taskId) => {
            return `<button type="button" class="ai-task-open-btn" data-task-id="${taskId}" title="Open Task #${taskId}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:-1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>${label}</button>`;
        });

        // Convert raw task IDs like (#6887) or (ID: #6887) into interactive action buttons
        html = html.replace(/\((?:Task ID:\s*|ID:\s*)?#?(\d{2,})\)(?!\s*<button[^>]*ai-task-open-btn)/gi, (match, taskId) => {
            // Ignore common HTTP status codes / error numbers (e.g. 400, 401, 403, 404, 500)
            if (/^(?:1\d\d|2\d\d|3\d\d|4\d\d|5\d\d)$/.test(taskId)) {
                return match;
            }
            return `(#${taskId}) <button type="button" class="ai-task-open-btn" data-task-id="${taskId}" title="Open Task #${taskId}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:-1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>Open Task</button>`;
        });

        // Convert dash/colon ID references like "— ID 6887" or "- ID 6887" into interactive action buttons
        html = html.replace(/((?:—|-|:)\s*(?:Task\s*ID|ID)\s*[:#]?\s*(\d{2,}))(?!\s*<button[^>]*ai-task-open-btn)/gi, (match, fullPrefix, taskId) => {
            if (/^(?:1\d\d|2\d\d|3\d\d|4\d\d|5\d\d)$/.test(taskId)) {
                return match;
            }
            return `${fullPrefix} <button type="button" class="ai-task-open-btn" data-task-id="${taskId}" title="Open Task #${taskId}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:-1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>Open Task</button>`;
        });

        // Tables
        html = html.replace(/((?:\|[^\n]+\|\r?\n?)+)/g, (match) => {
            const lines = match.trim().split(/\r?\n/);
            if (lines.length < 2) return match;
            let tableHtml = "<table>";
            let isHeader = true;
            for (let line of lines) {
                line = line.trim();
                if (/^\|[-:\s|]+\|$/.test(line)) {
                    isHeader = false;
                    continue;
                }
                const cells = line.split("|").slice(1, -1).map(c => c.trim());
                tableHtml += "<tr>";
                for (let cell of cells) {
                    if (!isHeader && /^\d{2,}$/.test(cell)) {
                        cell = `${cell} <button type="button" class="ai-task-open-btn" data-task-id="${cell}" title="Open Task #${cell}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:-1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>Open Task</button>`;
                    }
                    tableHtml += isHeader ? `<th>${cell}</th>` : `<td>${cell}</td>`;
                }
                tableHtml += "</tr>";
                if (isHeader) isHeader = false;
            }
            tableHtml += "</table>";
            return tableHtml;
        });

        // Headers
        html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
        html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
        html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

        // Bold & Italic
        html = html.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
        html = html.replace(/\*([^*]+)\*/g, "<i>$1</i>");

        // Bullet and numbered lists
        html = html
            .replace(/^\s*[-*•]\s+(.*$)/gim, "<li>$1</li>")
            .replace(/^\s*(\d+\.)\s+(.*$)/gim, '<li><span class="ai-num" style="font-weight:600;margin-right:4px;">$1</span>$2</li>')
            .replace(/((?:<li>.*<\/li>(?:\r?\n)?)+)/gim, '<ul style="margin:6px 0;padding:0 0 0 4px;list-style:none;">$1</ul>')
            .replace(/<\/li>\s*<br\s*\/?>/gi, "</li>")
            .replace(/\n\n/g, "<br/><br/>").replace(/\n/g, "<br/>");

        return markup(html);
    }

    onMessagesStreamClick(e) {
        const chip = e.target.closest(".ai-prompt-chip, .dograh-chip");
        if (chip) {
            e.preventDefault();
            e.stopPropagation();
            const prompt = chip.getAttribute("data-prompt");
            if (prompt) {
                this.sendPrompt(prompt);
            }
            return;
        }

        const btn = e.target.closest(".ai-task-open-btn, .dograh-task-open-btn");
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            const taskId = btn.getAttribute("data-task-id");
            if (taskId) {
                this.openTaskDetail(taskId);
            }
        }
    }

    openTaskDetail(taskId) {
        if (!taskId) return;
        const parsedId = parseInt(taskId);
        try {
            sessionStorage.setItem("last_opened_task_id", parsedId);
        } catch (e) {}

        if (typeof window.openOdooTask === "function") {
            window.openOdooTask(parsedId);
        } else if (this.action) {
            this.action.doAction({
                type: "ir.actions.client",
                tag: "custom_task_detail.task_detail_view",
                params: { task_id: parsedId },
                context: { default_task_id: parsedId },
            });
        }
    }

    scrollToBottom() {
        if (this.messagesStreamRef.el) {
            this.messagesStreamRef.el.scrollTop = this.messagesStreamRef.el.scrollHeight;
        }
    }

    focusInput() {
        if (this.inputAreaRef.el) {
            this.inputAreaRef.el.focus();
        }
    }
}

AiAgentWorkspace.template = "custom_ai_agent.WorkspaceView";
registry.category("actions").add("custom_ai_agent.chat_workspace", AiAgentWorkspace);

// Global Odoo Service to open custom task detail view from any component or widget
registry.category("services").add("ai_task_opener_service", {
    dependencies: ["action"],
    start(env, { action }) {
        window.odooActionService = action;
        window.openOdooTask = (taskId) => {
            if (!taskId) return;
            const parsedId = parseInt(taskId);
            try {
                sessionStorage.setItem("last_opened_task_id", parsedId);
            } catch (e) {}
            if (action && typeof action.doAction === "function") {
                return action.doAction({
                    type: "ir.actions.client",
                    tag: "custom_task_detail.task_detail_view",
                    params: { task_id: parsedId },
                    context: { default_task_id: parsedId },
                });
            } else {
                window.location.href = `/odoo/action-custom_task_detail.task_detail_view?task_id=${parsedId}`;
            }
        };
    },
});
