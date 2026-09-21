/** @odoo-module **/

import { Component, useState, onWillStart, onWillUpdateProps, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class TaskReminderModal extends Component {
    static template = "custom_task_reminder.TaskReminderModal";
    static props = {
        isOpen: { type: Boolean, optional: true },
        taskId: { type: [Number, Boolean], optional: true },
        onClose: { type: Function, optional: true },
        onSuccess: { type: Function, optional: true },
    };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.textareaRef = useRef("messageTextarea");

        this.state = useState({
            loading: false,
            sending: false,
            taskInfo: null,
            selectedUserIds: [],
            message: "",
            sendChat: true,
            postChatter: true,
        });

        onWillStart(async () => {
            if (this.props.isOpen && this.props.taskId) {
                await this.loadTaskInfo(this.props.taskId);
            }
        });

        onWillUpdateProps(async (nextProps) => {
            if (nextProps.isOpen && nextProps.taskId && nextProps.taskId !== this.props.taskId) {
                await this.loadTaskInfo(nextProps.taskId);
            } else if (nextProps.isOpen && !this.props.isOpen && nextProps.taskId) {
                await this.loadTaskInfo(nextProps.taskId);
            }
        });
    }

    async loadTaskInfo(taskId) {
        if (!taskId) return;
        this.state.loading = true;
        try {
            const data = await this.orm.call("project.task", "get_task_reminder_info", [taskId]);
            if (data && !data.error) {
                this.state.taskInfo = data;
                // Default select all assigned users
                const assigneeIds = (data.assignees || []).map(u => u.id);
                this.state.selectedUserIds = assigneeIds.length > 0 ? assigneeIds : [];

                // Generate friendly default message
                const deadlineText = data.deadline ? ` (Due: ${data.deadline})` : "";
                if (data.is_overdue) {
                    this.state.message = `⚠️ Attention: Task "${data.name}" is overdue${deadlineText}. Please provide an urgent status update.`;
                } else {
                    this.state.message = `Friendly reminder to check and update the status of task "${data.name}"${deadlineText}.`;
                }
            } else {
                this.notification.add("Could not load task information.", { type: "danger" });
            }
        } catch (error) {
            console.error("Error loading task reminder info:", error);
            this.notification.add("Error loading task details.", { type: "danger" });
        } finally {
            this.state.loading = false;
        }
    }

    toggleUser(userId) {
        const idx = this.state.selectedUserIds.indexOf(userId);
        if (idx > -1) {
            this.state.selectedUserIds.splice(idx, 1);
        } else {
            this.state.selectedUserIds.push(userId);
        }
    }

    selectAllAssignees() {
        if (!this.state.taskInfo) return;
        const allIds = (this.state.taskInfo.assignees || []).map(u => u.id);
        if (this.state.selectedUserIds.length === allIds.length) {
            this.state.selectedUserIds = [];
        } else {
            this.state.selectedUserIds = [...allIds];
        }
    }

    applyPreset(presetType) {
        if (!this.state.taskInfo) return;
        const task = this.state.taskInfo;
        const deadline = task.deadline ? ` (Due: ${task.deadline})` : "";

        switch (presetType) {
            case "deadline":
                this.state.message = `⏳ The deadline for "${task.name}" is approaching${deadline}. Please make sure everything is on track.`;
                break;
            case "overdue":
                this.state.message = `⚠️ Task "${task.name}" is currently overdue${deadline}. Please prioritize this and update the progress immediately.`;
                break;
            case "status":
                this.state.message = `🔔 Hi! Could you please share a quick status update on task "${task.name}"?`;
                break;
            case "urgent":
                this.state.message = `🚀 High Priority: Immediate attention needed for task "${task.name}"${deadline}.`;
                break;
            default:
                break;
        }

        if (this.textareaRef.el) {
            this.textareaRef.el.focus();
        }
    }

    async sendReminder() {
        if (!this.state.selectedUserIds.length) {
            this.notification.add("Please select at least one recipient user.", { type: "warning" });
            return;
        }
        if (!this.state.message || !this.state.message.trim()) {
            this.notification.add("Please enter a reminder message.", { type: "warning" });
            return;
        }

        this.state.sending = true;
        try {
            const result = await this.orm.call("project.task", "send_task_reminder_rpc", [], {
                task_id: this.props.taskId,
                recipient_ids: this.state.selectedUserIds,
                message: this.state.message.trim(),
                send_chat: Boolean(this.state.sendChat),
                create_activity: true,
                post_chatter: Boolean(this.state.postChatter),
            });

            if (result && result.success) {
                this.notification.add(result.message || "Reminder sent successfully!", { type: "success" });
                if (this.props.onSuccess) {
                    this.props.onSuccess();
                }
                this.close();
            } else {
                this.notification.add((result && result.error) || "Failed to send reminder.", { type: "danger" });
            }
        } catch (error) {
            console.error("Error sending task reminder:", error);
            this.notification.add("Failed to send reminder due to an error.", { type: "danger" });
        } finally {
            this.state.sending = false;
        }
    }

    close() {
        if (this.props.onClose) {
            this.props.onClose();
        }
    }

    onOverlayClick(event) {
        if (event.target === event.currentTarget) {
            this.close();
        }
    }
}
