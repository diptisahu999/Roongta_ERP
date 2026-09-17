/** @odoo-module **/

import { Component, useState, useRef, onWillStart, onMounted, onWillUnmount, markup, useSubEnv } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { rpc } from "@web/core/network/rpc";
import { Call } from "@mail/discuss/call/common/call";

export class CustomDiscussAction extends Component {
    static template = "custom_discuss.DiscussView";
    static components = { Call };

    setup() {
        this.action = useService("action");
        this.notification = useService("notification");
        try {
            this.mailStore = useState(useService("mail.store"));
        } catch (e) {
            this.mailStore = null;
        }
        try {
            this.rtc = useState(useService("discuss.rtc"));
        } catch (e) {
            this.rtc = null;
        }

        useSubEnv({
            inDiscussApp: true,
        });

        this.messagesEndRef = useRef("messagesEnd");
        this.fileInputRef = useRef("fileInput");
        this.composerTextareaRef = useRef("composerTextarea");
        this.renameInputRef = useRef("renameInput");

        this.emojis = [
            "👍", "❤️", "😂", "🎉", "🔥", "🙏", "👏", "😊",
            "🚀", "✨", "💯", "👌", "💡", "🙌", "😍", "🤝",
            "👀", "✅", "⚠️", "💪", "🤩", "😎", "🥳", "🌟"
        ];

        this.state = useState({
            loading: true,
            user: null,
            activeTab: "all", // 'all' | 'mentions' | 'unread'
            searchTerm: "",
            inChatSearchTerm: "",
            channels: [],
            mentions: [],
            counts: { all: 0, mentions: 0, unread: 0 },
            quickStats: { pending_tasks: 0, meetings_today: 0 },
            activeChannelId: null,
            activeChannel: null,
            messages: [],
            messagesLoading: false,
            messageInput: "",
            pendingAttachments: [],
            showDropdown: false,
            showEmojiDrawer: false,
            showStartChatModal: false,
            showCreateChannelModal: false,
            showInviteModal: false,
            showGroupInfoModal: false,
            isRenamingChannel: false,
            editChannelNameInput: "",
            inviteSearchQuery: "",
            selectedInviteMemberIds: [],
            userSearchQuery: "",
            usersList: [],
            newChannelName: "",
            newChannelDesc: "",
            selectedMemberIds: [],
            createChannelMemberSearchQuery: "",
            imageLightboxUrl: null,
        });

        this.onWindowClick = (e) => {
            if (!e.target.closest(".o_cd_dropdown_wrapper")) {
                this.state.showDropdown = false;
            }
            if (!e.target.closest(".o_cd_emoji_wrapper")) {
                this.state.showEmojiDrawer = false;
            }
        };

        onWillStart(async () => {
            await this.loadInitialData();
        });

        onMounted(() => {
            window.addEventListener("click", this.onWindowClick);
            if (this.mailStore && this.mailStore.discuss) {
                this.mailStore.discuss.isActive = true;
            }
            if (this.mailStore && this.mailStore.chatHub && this.mailStore.chatHub.opened) {
                this.mailStore.chatHub.opened.clear();
            }
            // Polling for live updates every 4 seconds
            this.pollInterval = setInterval(() => {
                this.pollUpdates();
            }, 4000);
        });

        onWillUnmount(() => {
            window.removeEventListener("click", this.onWindowClick);
            if (this.mailStore && this.mailStore.discuss) {
                this.mailStore.discuss.isActive = false;
            }
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
            }
        });
    }

    async loadInitialData() {
        try {
            const res = await rpc("/custom_discuss/data", {});
            if (res) {
                this.state.user = res.user || null;
                this.state.channels = res.channels || [];
                this.state.mentions = res.mentions || [];
                this.state.counts = res.counts || { all: 0, mentions: 0, unread: 0 };
                this.state.quickStats = res.quick_stats || { pending_tasks: 0, meetings_today: 0 };
            }
            if (this.mailStore && this.mailStore.failures) {
                this.mailStore.failures = [];
            }
        } catch (err) {
            console.error("Error loading discuss data:", err);
        } finally {
            this.state.loading = false;
        }
    }

    async pollUpdates() {
        // Silently sync channels & messages
        try {
            const res = await rpc("/custom_discuss/data", {});
            if (res) {
                this.state.counts = res.counts || this.state.counts;
                this.state.channels = res.channels || [];
                this.state.mentions = res.mentions || [];
            }

            if (this.state.activeChannelId) {
                const msgsRes = await rpc("/custom_discuss/channel_messages", {
                    channel_id: this.state.activeChannelId,
                    limit: 60,
                });
                if (msgsRes && msgsRes.messages) {
                    const newCount = msgsRes.messages.length;
                    const oldCount = this.state.messages.length;
                    const hasNewMessage = newCount !== oldCount || (
                        newCount > 0 && oldCount > 0 && msgsRes.messages[newCount - 1].id !== this.state.messages[oldCount - 1].id
                    );

                    if (hasNewMessage) {
                        const streamEl = document.querySelector(".o_cd_messages_stream");
                        const isNearBottom = streamEl ? (streamEl.scrollHeight - streamEl.scrollTop - streamEl.clientHeight < 150) : true;
                        this.state.messages = msgsRes.messages;
                        if (isNearBottom) {
                            this.scrollToBottom();
                        }
                    }

                    if (msgsRes.channel && this.state.activeChannel) {
                        this.state.activeChannel.member_count = msgsRes.channel.member_count;
                        this.state.activeChannel.members = msgsRes.channel.members;
                    }
                }
            }
        } catch (e) {
            // Ignore background polling errors
        }
    }

    get filteredChannels() {
        let list = this.state.channels;

        if (this.state.activeTab === "unread") {
            list = list.filter((c) => c.unread_count > 0);
        }

        if (this.state.searchTerm.trim()) {
            const q = this.state.searchTerm.toLowerCase();
            list = list.filter((c) => {
                const nameMatch = c.name && c.name.toLowerCase().includes(q);
                const snipMatch = c.last_message && c.last_message.snippet && c.last_message.snippet.toLowerCase().includes(q);
                return nameMatch || snipMatch;
            });
        }

        return list;
    }

    renderMarkup(val) {
        return markup(val || "");
    }

    get activeThread() {
        if (!this.mailStore || !this.state.activeChannelId) {
            return null;
        }
        return this.mailStore.Thread.get({
            model: "discuss.channel",
            id: this.state.activeChannelId,
        });
    }

    get isCallActive() {
        return Boolean(
            this.rtc &&
            this.rtc.state &&
            this.rtc.state.channel &&
            this.activeThread &&
            this.rtc.state.channel.eq(this.activeThread)
        );
    }

    get hasActiveCall() {
        const thread = this.activeThread;
        if (!thread) {
            return false;
        }
        const hasSessions = Boolean(thread.rtcSessions && thread.rtcSessions.length > 0);
        const isSelfInCall = this.isCallActive;
        return hasSessions || isSelfInCall;
    }

    get isCallMinimized() {
        if (!this.activeThread) {
            return true;
        }
        return this.activeThread.videoCount === 0;
    }

    get invitationLink() {
        if (this.state.activeChannel && this.state.activeChannel.invitation_url) {
            return this.state.activeChannel.invitation_url;
        }
        if (this.activeThread && this.activeThread.invitationLink) {
            return this.activeThread.invitationLink;
        }
        if (this.state.activeChannelId && this.state.activeChannel && this.state.activeChannel.uuid) {
            return `${window.location.origin}/chat/${this.state.activeChannelId}/${this.state.activeChannel.uuid}`;
        }
        return "";
    }

    async copyInvitationLink() {
        const link = this.invitationLink;
        if (!link) {
            this.notification.add("No invitation link available for this conversation", { type: "info" });
            return;
        }
        let copied = false;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(link);
                copied = true;
            }
        } catch (e) {}

        if (!copied) {
            try {
                const textarea = document.createElement("textarea");
                textarea.value = link;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                copied = document.execCommand("copy");
                document.body.removeChild(textarea);
            } catch (e) {}
        }

        if (copied) {
            this.notification.add("Meeting invitation link copied to clipboard!", { type: "success" });
        } else {
            window.prompt("Copy meeting invitation link:", link);
        }
    }

    async openInviteModal() {
        this.state.showInviteModal = true;
        this.state.inviteSearchQuery = "";
        this.state.selectedInviteMemberIds = [];
        await this.searchUsers("");
    }

    closeInviteModal() {
        this.state.showInviteModal = false;
        this.state.selectedInviteMemberIds = [];
    }

    toggleInviteMember(partnerId) {
        const idx = this.state.selectedInviteMemberIds.indexOf(partnerId);
        if (idx >= 0) {
            this.state.selectedInviteMemberIds.splice(idx, 1);
        } else {
            this.state.selectedInviteMemberIds.push(partnerId);
        }
    }

    getUserName(partnerId) {
        const u = this.state.usersList.find((x) => x.partner_id === partnerId);
        return u ? u.name : "Colleague";
    }

    get inviteUsersList() {
        let list = this.state.usersList;
        if (this.state.activeChannel && this.state.activeChannel.members) {
            const existingIds = this.state.activeChannel.members.map((m) => m.id);
            list = list.filter((u) => !existingIds.includes(u.partner_id));
        }
        if (this.state.inviteSearchQuery && this.state.inviteSearchQuery.trim()) {
            const q = this.state.inviteSearchQuery.toLowerCase();
            list = list.filter((u) => u.name && u.name.toLowerCase().includes(q));
        }
        return list;
    }

    async submitInviteMembers() {
        if (!this.state.activeChannelId || this.state.selectedInviteMemberIds.length === 0) {
            return;
        }
        const partnerIds = [...this.state.selectedInviteMemberIds];
        const channelId = this.state.activeChannelId;
        const isCall = this.isCallActive;

        try {
            const res = await rpc("/custom_discuss/invite_members", {
                channel_id: channelId,
                partner_ids: partnerIds,
                invite_to_call: isCall,
            });

            if (res && res.success) {
                this.notification.add(
                    isCall ? "Invitations sent! Calling members..." : "Members added successfully!",
                    { type: "success" }
                );
                this.closeInviteModal();

                if (res.is_new_channel && res.channel_id) {
                    await this.loadInitialData();
                    await this.selectChannel(res.channel_id);
                    if (isCall && this.rtc && this.mailStore) {
                        const newThread = await this.mailStore.Thread.getOrFetch({
                            model: "discuss.channel",
                            id: res.channel_id,
                        });
                        if (newThread) {
                            await this.rtc.toggleCall(newThread, { camera: true });
                        }
                    }
                } else {
                    await this.loadInitialData();
                    const channelRes = await rpc("/custom_discuss/channel_messages", {
                        channel_id: channelId,
                        limit: 60,
                    });
                    if (channelRes && channelRes.channel) {
                        this.state.activeChannel = channelRes.channel;
                        this.state.messages = channelRes.messages || [];
                        this.scrollToBottom();
                    }
                }
            } else if (res && res.error) {
                this.notification.add(res.error, { type: "danger" });
            }
        } catch (err) {
            console.error("Error inviting members:", err);
            this.notification.add("Failed to invite members", { type: "danger" });
        }
    }

    async startMeeting(video = true) {
        if (!this.state.activeChannelId) {
            return this.startNewMeeting();
        }
        try {
            if (this.mailStore && this.rtc) {
                let thread = this.activeThread;
                if (!thread) {
                    thread = await this.mailStore.Thread.getOrFetch({
                        model: "discuss.channel",
                        id: this.state.activeChannelId,
                    });
                }
                if (thread) {
                    if (this.mailStore.discuss) {
                        this.mailStore.discuss.thread = thread;
                        this.mailStore.discuss.isActive = true;
                    }
                    if (this.mailStore.chatHub && this.mailStore.chatHub.opened) {
                        this.mailStore.chatHub.opened.clear();
                    }
                    await this.rtc.toggleCall(thread, { camera: video });

                    // Refresh channel messages shortly to display meeting notification
                    setTimeout(async () => {
                        try {
                            const msgsRes = await rpc("/custom_discuss/channel_messages", {
                                channel_id: this.state.activeChannelId,
                                limit: 60,
                            });
                            if (msgsRes && msgsRes.messages) {
                                this.state.messages = msgsRes.messages;
                                this.scrollToBottom();
                            }
                        } catch (err) {}
                    }, 1200);
                    return;
                }
            }
            this.notification.add("Call service is not available", { type: "warning" });
        } catch (err) {
            console.error("Error starting meeting:", err);
            this.notification.add("Failed to start meeting: " + (err.message || err), { type: "danger" });
        }
    }

    async leaveCall() {
        const channel = (this.rtc && this.rtc.state && this.rtc.state.channel) || this.activeThread;
        if (this.rtc && channel) {
            try {
                if (typeof this.rtc.leaveCall === "function") {
                    await this.rtc.leaveCall(channel);
                } else {
                    await this.rtc.toggleCall(channel);
                }
                this.notification.add("Left call", { type: "info" });
            } catch (e) {
                console.error("Error leaving call:", e);
            }
        }
    }

    async startNewMeeting() {
        this.state.showDropdown = false;
        try {
            const res = await rpc("/custom_discuss/create_group_channel", {
                name: "Meeting - " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                partner_ids: [],
            });
            if (res && res.channel_id) {
                await this.loadInitialData();
                await this.selectChannel(res.channel_id);
                if (this.mailStore && this.rtc) {
                    if (this.mailStore.discuss) {
                        this.mailStore.discuss.isActive = true;
                    }
                    if (this.mailStore.chatHub && this.mailStore.chatHub.opened) {
                        this.mailStore.chatHub.opened.clear();
                    }
                    const thread = await this.mailStore.Thread.getOrFetch({
                        model: "discuss.channel",
                        id: res.channel_id,
                    });
                    if (thread) {
                        if (this.mailStore.discuss) {
                            this.mailStore.discuss.thread = thread;
                        }
                        await this.rtc.toggleCall(thread, { camera: true });
                        // Automatically open the invite modal like Odoo so user can invite colleagues
                        await this.openInviteModal();
                    }
                }
            }
        } catch (err) {
            console.error("Error creating new meeting:", err);
            this.notification.add("Failed to start new meeting", { type: "danger" });
        }
    }

    get filteredMessages() {
        if (!this.state.inChatSearchTerm.trim()) {
            return this.state.messages;
        }
        const q = this.state.inChatSearchTerm.toLowerCase();
        return this.state.messages.filter((m) => {
            return (m.body_plain && m.body_plain.toLowerCase().includes(q)) ||
                   (m.author_name && m.author_name.toLowerCase().includes(q));
        });
    }

    async selectChannel(channelId) {
        if (this.state.activeChannelId === channelId && this.state.activeChannel) return;

        this.state.activeChannelId = channelId;
        this.state.messagesLoading = true;
        this.state.inChatSearchTerm = "";

        // Pre-populate activeChannel immediately so template never accesses null
        const existingCh = this.state.channels.find((c) => c.id === channelId);
        this.state.activeChannel = existingCh ? {
            id: existingCh.id,
            name: existingCh.name,
            channel_type: existingCh.channel_type,
            avatar_url: existingCh.avatar_url,
            initials: existingCh.initials,
            member_count: existingCh.member_count || 1,
            members: [],
            invitation_url: "",
            uuid: "",
        } : {
            id: channelId,
            name: "Conversation",
            channel_type: "chat",
            avatar_url: "",
            initials: "C",
            member_count: 1,
            members: [],
            invitation_url: "",
            uuid: "",
        };

        // Immediately update local unread counter in list
        const ch = this.state.channels.find((c) => c.id === channelId);
        if (ch && ch.unread_count > 0) {
            ch.unread_count = 0;
            this.state.counts.unread = Math.max(0, this.state.counts.unread - 1);
        }

        if (this.mailStore) {
            try {
                const thread = await this.mailStore.Thread.getOrFetch({
                    model: "discuss.channel",
                    id: channelId,
                });
                if (thread && this.mailStore.discuss) {
                    this.mailStore.discuss.thread = thread;
                    this.mailStore.discuss.isActive = true;
                }
                if (this.mailStore.chatHub && this.mailStore.chatHub.opened) {
                    this.mailStore.chatHub.opened.clear();
                }
            } catch (e) {}
        }

        try {
            const res = await rpc("/custom_discuss/channel_messages", {
                channel_id: channelId,
                limit: 60,
            });
            if (res && res.channel) {
                this.state.activeChannel = res.channel;
                this.state.messages = res.messages || [];
                this.scrollToBottom();
                setTimeout(() => {
                    if (this.composerTextareaRef.el) {
                        this.composerTextareaRef.el.focus();
                    }
                }, 120);
            }
        } catch (err) {
            this.notification.add("Could not load messages", { type: "danger" });
        } finally {
            this.state.messagesLoading = false;
        }
    }

    closeChat() {
        this.state.activeChannelId = null;
        this.state.activeChannel = null;
        this.state.messages = [];
        if (this.mailStore && this.mailStore.discuss) {
            this.mailStore.discuss.thread = null;
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            if (this.messagesEndRef.el) {
                this.messagesEndRef.el.scrollIntoView({ behavior: "smooth" });
            }
        }, 80);
    }

    onKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (e.target && e.target.value !== undefined) {
                this.state.messageInput = e.target.value;
            }
            this.sendMessage();
        }
    }

    async sendMessage() {
        const text = this.state.messageInput.trim();
        const hasAttachments = this.state.pendingAttachments.length > 0;
        if (!text && !hasAttachments) return;

        const channelId = this.state.activeChannelId;
        const attachmentIds = this.state.pendingAttachments.map((a) => a.id);

        this.state.messageInput = "";
        this.state.pendingAttachments = [];
        this.state.showEmojiDrawer = false;

        try {
            const newMsg = await rpc("/custom_discuss/send_message", {
                channel_id: channelId,
                body: text,
                attachment_ids: attachmentIds,
            });

            if (newMsg && !newMsg.error) {
                this.state.messages.push(newMsg);
                this.scrollToBottom();

                // Update channel last message in sidebar
                const ch = this.state.channels.find((c) => c.id === channelId);
                if (ch) {
                    ch.last_message = {
                        id: newMsg.id,
                        snippet: newMsg.body_plain || "Attachment",
                        author_name: newMsg.author_name,
                        time_str: newMsg.time_str,
                    };
                }
            }
        } catch (err) {
            this.notification.add("Failed to send message", { type: "danger" });
        }
    }

    async toggleStar(msg) {
        try {
            const res = await rpc("/custom_discuss/toggle_star", {
                message_id: msg.id,
            });
            if (res) {
                msg.is_starred = res.is_starred;
            }
        } catch (e) {
            console.error("Star toggle error:", e);
        }
    }

    insertEmoji(emoji) {
        this.state.messageInput += emoji;
        if (this.composerTextareaRef.el) {
            this.composerTextareaRef.el.focus();
        }
    }

    triggerFileUpload() {
        if (this.fileInputRef.el) {
            this.fileInputRef.el.click();
        }
    }

    async onFileSelected(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("channel_id", this.state.activeChannelId || 0);

        try {
            const response = await fetch("/custom_discuss/upload_attachment", {
                method: "POST",
                body: formData,
            });
            const data = await response.json();
            if (data && data.id) {
                this.state.pendingAttachments.push(data);
            } else {
                this.notification.add("Upload failed", { type: "danger" });
            }
        } catch (err) {
            this.notification.add("File upload error", { type: "danger" });
        } finally {
            e.target.value = "";
        }
    }

    removePendingAttachment(patt) {
        const idx = this.state.pendingAttachments.indexOf(patt);
        if (idx >= 0) {
            this.state.pendingAttachments.splice(idx, 1);
        }
    }

    openLightbox(url) {
        this.state.imageLightboxUrl = url;
    }

    closeLightbox() {
        this.state.imageLightboxUrl = null;
    }

    openMention(mention) {
        if (!mention) return;
        if (mention.model === "discuss.channel" && mention.res_id) {
            this.selectChannel(mention.res_id);
            return;
        }
        if (mention.task_card && mention.task_card.task_id) {
            this.openTask(mention.task_card.task_id);
            return;
        }
        if (mention.model && mention.res_id) {
            this.action.doAction({
                type: "ir.actions.act_window",
                res_model: mention.model,
                res_id: mention.res_id,
                views: [[false, "form"]],
                target: "current",
            });
        }
    }

    openTask(taskId) {
        if (!taskId) return;
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "project.task",
            res_id: taskId,
            views: [[false, "form"]],
            target: "current",
        });
    }

    openQuickAction(type) {
        try {
            if (type === "tasks") {
                this.action.doAction("custom_mytask.action_my_tasks_dashboard").catch(() => {
                    this.action.doAction("custom_mytask.action_new_task_all").catch(() => {
                        this.action.doAction({
                            type: "ir.actions.act_window",
                            name: "All Tasks",
                            res_model: "project.task",
                            views: [[false, "list"], [false, "kanban"], [false, "form"]],
                            context: { group_by: "project_id" },
                        });
                    });
                });
            } else if (type === "chat") {
                this.openStartChatModal();
            } else if (type === "calendar") {
                this.action.doAction("calendar.action_calendar_event").catch(() => {
                    this.action.doAction({
                        type: "ir.actions.act_window",
                        name: "Meetings Calendar",
                        res_model: "calendar.event",
                        views: [[false, "calendar"], [false, "list"], [false, "form"]],
                    });
                });
            } else if (type === "analytics") {
                this.action.doAction("custome_analytics.action_custome_analytics_dashboard").catch(() => {
                    this.action.doAction("custom_dashboard.action_custom_dashboard").catch(() => {
                        this.notification.add("Dashboard module is not installed", { type: "info" });
                    });
                });
            }
        } catch (err) {
            this.notification.add("Could not open action", { type: "warning" });
        }
    }

    async openStartChatModal() {
        this.state.showStartChatModal = true;
        this.state.userSearchQuery = "";
        await this.searchUsers("");
    }

    async searchUsers(query) {
        try {
            const list = await rpc("/custom_discuss/users_list", { query });
            this.state.usersList = list || [];
        } catch (e) {
            console.error("Error searching users:", e);
        }
    }

    async startChatWithUser(u) {
        this.state.showStartChatModal = false;
        try {
            const res = await rpc("/custom_discuss/get_or_create_chat", {
                partner_id: u.partner_id,
            });
            if (res && res.channel_id) {
                await this.loadInitialData();
                await this.selectChannel(res.channel_id);
            }
        } catch (e) {
            this.notification.add("Could not open chat", { type: "danger" });
        }
    }

    get filteredCreateChannelUsers() {
        const list = this.state.usersList || [];
        const q = (this.state.createChannelMemberSearchQuery || "").trim().toLowerCase();
        if (!q) {
            return list;
        }
        return list.filter((u) => {
            return (u.name && u.name.toLowerCase().includes(q)) ||
                   (u.job_title && u.job_title.toLowerCase().includes(q)) ||
                   (u.email && u.email.toLowerCase().includes(q));
        });
    }

    openCreateChannelModal() {
        this.state.showCreateChannelModal = true;
        this.state.newChannelName = "";
        this.state.newChannelDesc = "";
        this.state.selectedMemberIds = [];
        this.state.createChannelMemberSearchQuery = "";
        this.searchUsers("");
    }

    toggleMemberSelection(partnerId) {
        const idx = this.state.selectedMemberIds.indexOf(partnerId);
        if (idx >= 0) {
            this.state.selectedMemberIds.splice(idx, 1);
        } else {
            this.state.selectedMemberIds.push(partnerId);
        }
    }

    async createGroupChannel() {
        if (!this.state.newChannelName.trim()) {
            this.notification.add("Please provide a channel name", { type: "warning" });
            return;
        }

        try {
            const res = await rpc("/custom_discuss/create_group_channel", {
                name: this.state.newChannelName.trim(),
                description: this.state.newChannelDesc.trim(),
                partner_ids: this.state.selectedMemberIds,
            });
            this.state.showCreateChannelModal = false;
            if (res && res.channel_id) {
                await this.loadInitialData();
                await this.selectChannel(res.channel_id);
                this.notification.add("Channel created successfully!", { type: "success" });
            }
        } catch (e) {
            this.notification.add("Failed to create channel", { type: "danger" });
        }
    }

    async markAllAsRead() {
        this.state.showDropdown = false;
        for (const c of this.state.channels) {
            if (c.unread_count > 0) {
                c.unread_count = 0;
                rpc("/custom_discuss/mark_seen", { channel_id: c.id });
            }
        }
        this.state.counts.unread = 0;
        this.notification.add("All conversations marked as read", { type: "success" });
    }

    async deleteChat(channelId = null) {
        const targetId = channelId || this.state.activeChannelId;
        if (!targetId) return;

        const ch = this.state.channels.find((c) => c.id === targetId) || this.state.activeChannel;
        const chatName = ch ? ch.name : "this conversation";

        if (!window.confirm(`Are you sure you want to delete "${chatName}"?`)) {
            return;
        }

        try {
            // If call is active in this channel, leave call first
            if (this.rtc && this.state.activeChannelId === targetId && this.hasActiveCall) {
                await this.leaveCall();
            }

            const res = await rpc("/custom_discuss/delete_channel", { channel_id: targetId });
            if (res && res.success) {
                this.notification.add(`Conversation "${chatName}" deleted`, { type: "success" });
                if (this.state.activeChannelId === targetId) {
                    this.closeChat();
                }
                await this.loadInitialData();
            } else {
                this.notification.add(res?.error || "Failed to delete chat", { type: "danger" });
            }
        } catch (err) {
            console.error("Error deleting chat:", err);
            this.notification.add("Failed to delete chat", { type: "danger" });
        }
    }

    openGroupInfoModal() {
        if (!this.state.activeChannel) return;
        this.state.showGroupInfoModal = true;
        this.state.editChannelNameInput = this.state.activeChannel.name || "";
    }

    closeGroupInfoModal() {
        this.state.showGroupInfoModal = false;
    }

    openInviteModalFromGroupInfo() {
        this.closeGroupInfoModal();
        this.openInviteModal();
    }

    startRenameChannel() {
        if (!this.state.activeChannel) return;
        this.state.isRenamingChannel = true;
        this.state.editChannelNameInput = this.state.activeChannel.name || "";
        setTimeout(() => {
            if (this.renameInputRef && this.renameInputRef.el) {
                this.renameInputRef.el.focus();
                this.renameInputRef.el.select();
            }
        }, 50);
    }

    cancelRenameChannel() {
        this.state.isRenamingChannel = false;
        this.state.editChannelNameInput = "";
    }

    onRenameKeyDown(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            this.saveChannelName();
        } else if (e.key === "Escape") {
            this.cancelRenameChannel();
        }
    }

    async saveChannelName() {
        const newName = (this.state.editChannelNameInput || "").trim();
        if (!newName) {
            this.notification.add("Channel name cannot be empty", { type: "warning" });
            return;
        }
        const channelId = this.state.activeChannelId;
        if (!channelId) return;

        try {
            const res = await rpc("/custom_discuss/rename_channel", {
                channel_id: channelId,
                name: newName,
            });
            if (res && res.success) {
                if (this.state.activeChannel) {
                    this.state.activeChannel.name = newName;
                    // Compute initials
                    const words = newName.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
                    if (words.length >= 2) {
                        this.state.activeChannel.initials = (words[0][0] + words[1][0]).toUpperCase();
                    } else if (words.length === 1) {
                        this.state.activeChannel.initials = words[0].slice(0, 2).toUpperCase();
                    }
                }
                const ch = this.state.channels.find((c) => c.id === channelId);
                if (ch) {
                    ch.name = newName;
                    if (this.state.activeChannel) {
                        ch.initials = this.state.activeChannel.initials;
                    }
                }
                this.state.isRenamingChannel = false;
                this.notification.add("Group name updated successfully!", { type: "success" });
            } else {
                this.notification.add(res?.error || "Failed to rename group", { type: "danger" });
            }
        } catch (err) {
            console.error("Error renaming channel:", err);
            this.notification.add("Failed to rename group", { type: "danger" });
        }
    }

    async removeMemberFromGroup(mem) {
        if (!mem || !this.state.activeChannelId) return;
        if (!window.confirm(`Are you sure you want to remove "${mem.name}" from this group?`)) {
            return;
        }
        try {
            const res = await rpc("/custom_discuss/remove_channel_member", {
                channel_id: this.state.activeChannelId,
                partner_id: mem.id,
            });
            if (res && res.success) {
                this.notification.add(`${mem.name} removed from group`, { type: "success" });
                if (this.state.activeChannel && this.state.activeChannel.members) {
                    this.state.activeChannel.members = this.state.activeChannel.members.filter((m) => m.id !== mem.id);
                    this.state.activeChannel.member_count = this.state.activeChannel.members.length;
                }
                const ch = this.state.channels.find((c) => c.id === this.state.activeChannelId);
                if (ch) {
                    ch.member_count = Math.max(1, (ch.member_count || 1) - 1);
                }
            } else {
                this.notification.add(res?.error || "Failed to remove member", { type: "danger" });
            }
        } catch (err) {
            console.error("Error removing member:", err);
            this.notification.add("Failed to remove member", { type: "danger" });
        }
    }
}

registry.category("actions").add("custom_discuss.discuss_action", CustomDiscussAction);
