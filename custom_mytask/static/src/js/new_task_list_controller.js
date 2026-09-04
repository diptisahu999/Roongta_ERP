/** @odoo-module **/

import { ListController } from "@web/views/list/list_controller";
import { listView } from "@web/views/list/list_view";
import { registry } from "@web/core/registry";
import { useState, onMounted } from "@odoo/owl";
import { user } from "@web/core/user";

export class NewTaskListController extends ListController {
    static template = "custom_mytask.NewTaskListView";

    setup() {
        this.taskFilters = useState({
            scope: "all_tasks",
            status: "pending_due",
        });
        super.setup();
        const hideMyTasksBreadcrumb = () => {
            const breadcrumbItems = document.querySelectorAll(
                ".o_control_panel .o_breadcrumb .o_breadcrumb_item, .o_control_panel .o_breadcrumb a, .o_control_panel .o_breadcrumb span, .o_control_panel .breadcrumb-item, .o_control_panel .o_breadcrumb"
            );
            breadcrumbItems.forEach(item => {
                const txt = (item.textContent || "").trim().toLowerCase();
                if (txt === "my tasks" || txt === "my task" || txt === "home") {
                    item.style.display = "none";
                }
            });
        };

        onMounted(() => {
            hideMyTasksBreadcrumb();
            setTimeout(hideMyTasksBreadcrumb, 50);
            setTimeout(hideMyTasksBreadcrumb, 200);
            this.applyCustomFilters();
        });
    }

    get modelParams() {
        const params = super.modelParams;
        const customDomain = this.getComputedDomain();
        if (customDomain && customDomain.length > 0) {
            params.domain = [...(params.domain || []), ...customDomain];
        }
        return params;
    }

    getComputedDomain() {
        const scope = (this.taskFilters && this.taskFilters.scope) || "all_tasks";
        const status = (this.taskFilters && this.taskFilters.status) || "pending_due";
        const today = new Date().toISOString().slice(0, 10);
        const domain = [];

        // 1. Scope filter (All Tasks / My Tasks)
        if (scope === "my_tasks" && user.userId) {
            domain.push(["user_ids", "in", user.userId]);
        }

        // 2. Status filter
        switch (status) {
            case "pending_due":
                domain.push(["is_closed", "=", false]);
                domain.push(["date_deadline", "<=", today]);
                break;
            case "pending":
                domain.push(["is_closed", "=", false]);
                break;
            case "due":
                domain.push(["is_closed", "=", false]);
                domain.push(["date_deadline", "<=", today]);
                break;
            case "mgmt_discussion":
                domain.push(["state", "=", "05_management_discussion"]);
                break;
            case "done":
                domain.push(["is_closed", "=", true]);
                break;
            case "all":
                break;
        }
        return domain;
    }

    async applyCustomFilters() {
        try {
            const customDomain = this.getComputedDomain();
            const searchDomain = (this.env.searchModel && this.env.searchModel.domain) || [];
            const combinedDomain = [...searchDomain, ...customDomain];
            if (this.model && this.model.root) {
                await this.model.root.load({
                    domain: combinedDomain,
                    offset: 0,
                });
            }
        } catch (err) {
            console.error("Error applying task filters:", err);
        }
    }

    async onFilterChange() {
        await this.applyCustomFilters();
    }
}

export const newTaskListView = {
    ...listView,
    Controller: NewTaskListController,
};

registry.category("views").add("new_task_list_view", newTaskListView);
