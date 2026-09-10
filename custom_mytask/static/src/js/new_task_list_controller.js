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

        // Intercept model config generation so our custom Scope and Status filters
        // are seamlessly merged on initial load, search bar queries, filter changes, and pagination
        if (this.model && this.model._getNextConfig) {
            const originalGetNextConfig = this.model._getNextConfig.bind(this.model);
            this.model._getNextConfig = (currentConfig, params = {}) => {
                const config = originalGetNextConfig(currentConfig, params);
                const customDomain = this.getComputedDomain();
                const baseDomain =
                    params.domain ||
                    (this.env.searchModel && this.env.searchModel.domain) ||
                    this.props.domain ||
                    [];

                config.domain = [...baseDomain, ...customDomain];
                return config;
            };
        }

        const hideMyTasksBreadcrumb = () => {
            const breadcrumbItems = document.querySelectorAll(
                ".o_control_panel .o_breadcrumb .o_breadcrumb_item, .o_control_panel .o_breadcrumb a, .o_control_panel .o_breadcrumb span, .o_control_panel .breadcrumb-item, .o_control_panel .o_breadcrumb"
            );
            breadcrumbItems.forEach((item) => {
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
        });
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
            case "uncompleted":
            case "pending_due":
                domain.push(["is_closed", "=", false]);
                break;
            case "pending":
                domain.push(["is_closed", "=", false]);
                domain.push("|", ["date_deadline", ">=", today], ["date_deadline", "=", false]);
                break;
            case "overdue":
            case "due":
                domain.push(["is_closed", "=", false]);
                domain.push(["date_deadline", "<", today]);
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

    async onFilterChange() {
        try {
            if (this.model) {
                await this.model.load({ offset: 0 });
            }
        } catch (err) {
            console.error("Error applying task filters:", err);
        }
    }
}

export const newTaskListView = {
    ...listView,
    Controller: NewTaskListController,
};

registry.category("views").add("new_task_list_view", newTaskListView);
