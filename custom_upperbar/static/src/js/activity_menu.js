/** @odoo-module **/

import { ActivityMenu } from "@mail/core/web/activity_menu";
import { patch } from "@web/core/utils/patch";
import { useState, onWillStart, onMounted, onWillUnmount } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

patch(ActivityMenu.prototype, {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.action = useService("action");
        this.reminderState = useState({
            reminders: [],
            totalCount: 0,
            loading: false,
        });

        onWillStart(async () => {
            await this.loadSystrayReminders();
        });

        onMounted(() => {
            this.loadSystrayReminders();

            // 1. Refresh every 5 seconds for real-time counter decrease
            this._reminderInterval = setInterval(() => {
                this.loadSystrayReminders();
                if (this.store && this.store.fetchData) {
                    this.store.fetchData({ systray_get_activities: true });
                }
            }, 5000);

            // 2. Refresh on window focus
            this._onWindowFocus = () => {
                this.loadSystrayReminders();
                if (this.store && this.store.fetchData) {
                    this.store.fetchData({ systray_get_activities: true });
                }
            };
            window.addEventListener("focus", this._onWindowFocus);
        });

        onWillUnmount(() => {
            if (this._reminderInterval) {
                clearInterval(this._reminderInterval);
            }
            if (this._onWindowFocus) {
                window.removeEventListener("focus", this._onWindowFocus);
            }
        });
    },

    get totalReminderCount() {
        // Only return count if there are actual pending reminders or activities
        if (this.reminderState && this.reminderState.reminders) {
            return this.reminderState.reminders.length;
        }
        return this.store.activityCounter || 0;
    },

    async loadSystrayReminders() {
        try {
            const res = await this.orm.call("project.task", "get_systray_reminders", []);
            if (res && res.reminders !== undefined) {
                this.reminderState.reminders = res.reminders;
                this.reminderState.totalCount = res.count;
            }
        } catch (e) {
            // Silently ignore during unmount / navigation
        }
    },

    async onBeforeOpen() {
        if (super.onBeforeOpen) {
            super.onBeforeOpen();
        }
        await this.loadSystrayReminders();
    },

    openReminderTask(reminder) {
        if (this.dropdown) {
            this.dropdown.close();
        }
        if (reminder.task_id) {
            this.action.doAction({
                type: "ir.actions.act_window",
                res_model: "project.task",
                res_id: reminder.task_id,
                views: [[false, "form"]],
                target: "current",
            });
        } else {
            this.openMyActivities();
        }
    },

    getAvatarBg(name) {
        const colors = [
            "#4338ca",
            "#5b21b6",
            "#6d28d9",
            "#4f46e5",
            "#3730a3",
            "#1e40af",
            "#0f766e",
        ];
        if (!name) return colors[0];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }
});
