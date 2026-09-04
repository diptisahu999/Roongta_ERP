/** @odoo-module **/

import { AppsBar } from "@muk_web_appsbar/webclient/appsbar/appsbar";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { onWillStart, onMounted, onWillUnmount, useState } from "@odoo/owl";
import { Record } from "@web/model/relational_model/record";

// Patch Record to trigger event whenever any task record is saved or deleted
patch(Record.prototype, {
    async _save() {
        const result = await super._save(...arguments);
        if (result && this.resModel === "project.task" && this.model && this.model.env && this.model.env.bus) {
            this.model.env.bus.trigger("PROJECT_TASK:COUNT_UPDATE");
        }
        return result;
    },
    async _delete() {
        const result = await super._delete(...arguments);
        if (this.resModel === "project.task" && this.model && this.model.env && this.model.env.bus) {
            this.model.env.bus.trigger("PROJECT_TASK:COUNT_UPDATE");
        }
        return result;
    },
});

patch(AppsBar.prototype, {
    setup() {
        super.setup(...arguments);
        this.orm = useService("orm");
        this.taskState = useState({
            todoCount: 0,
        });

        const fetchTaskCount = async () => {
            try {
                const today = new Date().toISOString().slice(0, 10);
                // Count uncompleted tasks matching Pending & Due
                const count = await this.orm.searchCount("project.task", [
                    ["is_closed", "=", false],
                    ["date_deadline", "<=", today],
                ]);
                this.taskState.todoCount = count;
            } catch (e) {
                console.debug("Could not fetch sidebar task count:", e);
            }
        };

        const onTaskCountUpdate = () => {
            fetchTaskCount();
            setTimeout(fetchTaskCount, 250);
        };

        onWillStart(async () => {
            await fetchTaskCount();
        });

        onMounted(() => {
            // Auto-refresh task count every 15 seconds
            this.taskCountInterval = setInterval(fetchTaskCount, 15000);
        });

        onWillUnmount(() => {
            if (this.taskCountInterval) {
                clearInterval(this.taskCountInterval);
            }
            this.env.bus.removeEventListener("MENUS:APP-CHANGED", fetchTaskCount);
            this.env.bus.removeEventListener("ACTION_MANAGER:UPDATE", fetchTaskCount);
            this.env.bus.removeEventListener("PROJECT_TASK:COUNT_UPDATE", onTaskCountUpdate);
        });

        // Refresh count whenever app, action, search, or task updates
        this.env.bus.addEventListener("MENUS:APP-CHANGED", fetchTaskCount);
        this.env.bus.addEventListener("ACTION_MANAGER:UPDATE", fetchTaskCount);
        this.env.bus.addEventListener("PROJECT_TASK:COUNT_UPDATE", onTaskCountUpdate);
    },

    getAppBadgeCount(app) {
        if (!app) return 0;
        const xmlid = (app.xmlid || "").toLowerCase();
        const label = (app.label || "").toLowerCase();
        if (xmlid.includes("custom_mytask") || xmlid.includes("new_task") || label === "my tasks" || label === "my task") {
            return this.taskState.todoCount;
        }
        return 0;
    },
});
