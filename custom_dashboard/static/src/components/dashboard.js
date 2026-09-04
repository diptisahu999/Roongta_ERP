/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, onWillStart, onMounted, onWillUnmount, useState, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class CustomDashboard extends Component {
    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.searchInputRef = useRef("searchInput");

        this.state = useState({
            loading: true,
            data: {},
            filters: {
                company_id: "",
                department_id: "",
                user_id: "",
                date_range: "all",
                search_term: "",
            },
            trendPeriod: "7_days",
            collapsedGroups: {},
            starredTasks: {},
            activeTooltip: null,
        });

        this.onKeyDown = this.onKeyDown.bind(this);

        onWillStart(async () => {
            await this.loadDashboardData();
        });

        onMounted(() => {
            window.addEventListener("keydown", this.onKeyDown);
        });

        onWillUnmount(() => {
            window.removeEventListener("keydown", this.onKeyDown);
        });
    }

    async loadDashboardData() {
        try {
            this.state.loading = true;
            const res = await this.orm.call("custom.dashboard", "get_dashboard_data", [this.state.filters]);
            this.state.data = res;

            // Set initial peak tooltip for completion trend if available
            if (res.trend_data && res.trend_data.length) {
                const peakPoint = res.trend_data.find((p) => p.is_peak) || res.trend_data[3] || res.trend_data[res.trend_data.length - 1];
                if (peakPoint) {
                    this.state.activeTooltip = peakPoint;
                }
            }
        } catch (e) {
            console.error("Dashboard data fetch error:", e);
            if (this.notification) {
                this.notification.add("Failed to load dashboard metrics.", { type: "danger" });
            }
        } finally {
            this.state.loading = false;
        }
    }

    onKeyDown(ev) {
        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") {
            ev.preventDefault();
            if (this.searchInputRef.el) {
                this.searchInputRef.el.focus();
            }
        }
    }

    async onFilterChange(field, ev) {
        this.state.filters[field] = ev.target.value;
        await this.loadDashboardData();
    }

    onSearchInput(ev) {
        this.state.filters.search_term = ev.target.value.toLowerCase();
    }

    async onTrendPeriodChange(ev) {
        this.state.trendPeriod = ev.target.value;
        await this.loadDashboardData();
    }

    toggleGroup(groupName) {
        this.state.collapsedGroups[groupName] = !this.state.collapsedGroups[groupName];
    }

    toggleStar(task, ev) {
        if (ev) ev.stopPropagation();
        this.state.starredTasks[task.id] = !this.isStarred(task);
    }

    isStarred(task) {
        if (this.state.starredTasks[task.id] !== undefined) {
            return this.state.starredTasks[task.id];
        }
        return !!task.is_starred;
    }

    get filteredTableGroups() {
        const groups = this.state.data.overdue_table_groups || [];
        const query = (this.state.filters.search_term || "").trim().toLowerCase();
        if (!query) {
            return groups;
        }
        return groups
            .map((grp) => {
                const filteredTasks = grp.tasks.filter(
                    (t) =>
                        t.title.toLowerCase().includes(query) ||
                        t.project.toLowerCase().includes(query) ||
                        t.tag.toLowerCase().includes(query) ||
                        t.created_by.toLowerCase().includes(query)
                );
                return {
                    ...grp,
                    count: filteredTasks.length,
                    tasks: filteredTasks,
                };
            })
            .filter((grp) => grp.tasks.length > 0);
    }

    // Circular Progress Gauge Calculations
    get gaugeCircumference() {
        return 2 * Math.PI * 52; // r = 52
    }

    get gaugeDashOffset() {
        const pct = (this.state.data.progress_breakdown && this.state.data.progress_breakdown.percentage) || 72;
        return this.gaugeCircumference - (pct / 100) * this.gaugeCircumference;
    }

    // Trend Curve & Area Calculations
    get trendPointsData() {
        const points = this.state.data.trend_data || [];
        if (!points.length) return { linePath: "", areaPath: "", coords: [] };

        const width = 540;
        const height = 150;
        const paddingLeft = 40;
        const paddingBottom = 25;
        const paddingTop = 20;

        const effectiveW = width - paddingLeft - 20;
        const effectiveH = height - paddingTop - paddingBottom;
        const maxVal = 80;

        const coords = points.map((p, index) => {
            const x = paddingLeft + (index / (points.length - 1)) * effectiveW;
            const y = height - paddingBottom - (p.count / maxVal) * effectiveH;
            return { x, y, raw: p };
        });

        if (coords.length === 1) {
            return {
                linePath: `M ${coords[0].x} ${coords[0].y}`,
                areaPath: `M ${coords[0].x} ${coords[0].y} L ${coords[0].x} ${height - paddingBottom} Z`,
                coords,
            };
        }

        // Generate smooth Bezier curve
        let linePath = `M ${coords[0].x},${coords[0].y}`;
        for (let i = 0; i < coords.length - 1; i++) {
            const current = coords[i];
            const next = coords[i + 1];
            const controlX1 = current.x + (next.x - current.x) / 2;
            const controlY1 = current.y;
            const controlX2 = current.x + (next.x - current.x) / 2;
            const controlY2 = next.y;
            linePath += ` C ${controlX1},${controlY1} ${controlX2},${controlY2} ${next.x},${next.y}`;
        }

        const last = coords[coords.length - 1];
        const first = coords[0];
        const areaPath = `${linePath} L ${last.x},${height - paddingBottom} L ${first.x},${height - paddingBottom} Z`;

        return { linePath, areaPath, coords };
    }

    onHoverTrendPoint(point) {
        this.state.activeTooltip = point.raw;
    }

    // Navigation & Actions
    onCreateTask() {
        this.action.doAction({
            name: "New Task",
            type: "ir.actions.act_window",
            res_model: "project.task",
            views: [[false, "form"]],
            target: "new",
            context: {
                default_company_id: this.state.filters.company_id ? parseInt(this.state.filters.company_id) : undefined,
                default_department_id: this.state.filters.department_id ? parseInt(this.state.filters.department_id) : undefined,
            },
        });
    }

    onOpenTask(taskId) {
        if (!taskId) return;
        sessionStorage.setItem("custom_dashboard_active", "true");
        this.action.doAction(
            {
                name: "Task",
                type: "ir.actions.act_window",
                res_model: "project.task",
                res_id: taskId,
                views: [[false, "form"]],
                target: "current",
            },
            {
                clearBreadcrumbs: false,
            }
        );
    }

    onOpenTaskList(type) {
        let title = "Tasks";
        const taskIdsMap = (this.state.data && this.state.data.task_ids_map) || {};
        let domain = [];

        if (type === "all") {
            title = "All Tasks";
        } else if (type === "in_progress") {
            title = "In Progress Tasks";
        } else if (type === "completed") {
            title = "Completed Tasks";
        } else if (type === "due_today") {
            title = "Tasks Due Today";
        } else if (type === "overdue") {
            title = "Overdue Tasks";
        } else if (type === "due_this_week") {
            title = "Tasks Due This Week";
        } else if (type === "blocked") {
            title = "Blocked Tasks";
        } else if (type === "awaiting_approval") {
            title = "Tasks Awaiting Approval";
        }

        if (taskIdsMap[type]) {
            domain = [["id", "in", taskIdsMap[type]]];
        } else {
            domain = [["active", "=", true]];
            if (type === "in_progress") domain.push(["state", "=", "01_in_progress"]);
            if (type === "completed") domain.push(["state", "=", "1_done"]);
            if (type === "due_today") domain.push(["date_deadline", "=", new Date().toISOString().split("T")[0]], ["state", "!=", "1_done"]);
            if (type === "overdue") domain.push(["date_deadline", "<", new Date().toISOString().split("T")[0]], ["state", "!=", "1_done"]);
            if (type === "blocked") domain.push(["kanban_state", "=", "blocked"]);
        }

        sessionStorage.setItem("custom_dashboard_active", "true");
        this.action.doAction(
            {
                name: title,
                type: "ir.actions.act_window",
                res_model: "project.task",
                views: [
                    [false, "list"],
                    [false, "kanban"],
                    [false, "form"],
                ],
                domain: domain,
                target: "current",
            },
            {
                clearBreadcrumbs: false,
            }
        );
    }

    onOpenDepartmentTasks(deptId) {
        sessionStorage.setItem("custom_dashboard_active", "true");
        this.action.doAction(
            {
                name: "Department Tasks",
                type: "ir.actions.act_window",
                res_model: "project.task",
                views: [
                    [false, "list"],
                    [false, "kanban"],
                    [false, "form"],
                ],
                domain: [["department_id", "=", deptId]],
                target: "current",
            },
            {
                clearBreadcrumbs: false,
            }
        );
    }

    onOpenAllActivity() {
        sessionStorage.setItem("custom_dashboard_active", "true");
        this.action.doAction(
            {
                name: "Task Activities",
                type: "ir.actions.act_window",
                res_model: "mail.activity",
                views: [
                    [false, "list"],
                    [false, "form"],
                ],
                target: "current",
            },
            {
                clearBreadcrumbs: false,
            }
        );
    }
}

CustomDashboard.template = "custom_dashboard.DashboardView";

registry.category("actions").add("custom_dashboard.client_action", CustomDashboard);
