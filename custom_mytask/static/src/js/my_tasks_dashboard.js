/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, onWillStart, onMounted, onWillUnmount, onWillUpdateProps, useState, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { user } from "@web/core/user";
import { TaskCreateModal } from "@custom_taskcreate/components/task_create_modal";
import { TaskReminderModal } from "@custom_task_reminder/components/task_reminder_modal";

export class MyTasksDashboard extends Component {
    static template = "custom_mytask.MyTasksDashboard";
    static components = {
        TaskCreateModal,
        TaskReminderModal,
    };

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.searchInputRef = useRef("searchInput");
        this.createDateInputRef = useRef("createDateInputRef");

        let savedState = null;
        try {
            const raw = sessionStorage.getItem("my_tasks_dashboard_state");
            if (raw) {
                savedState = JSON.parse(raw);
            }
        } catch (e) {
            console.warn("Could not parse saved dashboard state", e);
        }

        // Parse query params from URL (e.g. /odoo/action-414?status=overdue&assignee_id=my_tasks)
        let urlStatus = null;
        let urlAssignee = null;
        let urlDept = null;
        try {
            const searchParams = new URLSearchParams(window.location.search);
            urlStatus = searchParams.get("status") || searchParams.get("default_status");
            urlAssignee = searchParams.get("assignee") || searchParams.get("assignee_id") || searchParams.get("default_assignee_id");
            urlDept = searchParams.get("department_id") || searchParams.get("dept") || searchParams.get("default_department_id");

            if (!urlStatus && window.location.hash) {
                const hashIndex = window.location.hash.indexOf("?");
                const hashQuery = hashIndex !== -1 ? window.location.hash.substring(hashIndex) : window.location.hash.replace(/^#/, "?");
                const hashParams = new URLSearchParams(hashQuery);
                urlStatus = urlStatus || hashParams.get("status") || hashParams.get("default_status");
                urlAssignee = urlAssignee || hashParams.get("assignee") || hashParams.get("assignee_id") || hashParams.get("default_assignee_id");
                urlDept = urlDept || hashParams.get("department_id") || hashParams.get("dept") || hashParams.get("default_department_id");
            }
        } catch (e) {
            console.warn("Could not parse URL query parameters", e);
        }

        const contextStatus = (this.props.action && this.props.action.context && this.props.action.context.default_status)
            || (this.props.context && this.props.context.default_status)
            || (this.props.action && this.props.action.params && this.props.action.params.default_status)
            || (this.props.action && this.props.action.params && this.props.action.params.status)
            || urlStatus;

        const contextAssignee = (this.props.action && this.props.action.context && this.props.action.context.default_assignee_id)
            || (this.props.context && this.props.context.default_assignee_id)
            || (this.props.action && this.props.action.params && this.props.action.params.default_assignee_id)
            || (this.props.action && this.props.action.params && this.props.action.params.assignee_id)
            || urlAssignee;

        const contextDept = (this.props.action && this.props.action.context && this.props.action.context.default_department_id)
            || (this.props.context && this.props.context.default_department_id)
            || (this.props.action && this.props.action.params && this.props.action.params.default_department_id)
            || (this.props.action && this.props.action.params && this.props.action.params.department_id)
            || urlDept;

        const initialFilters = {
            department_id: "all",
            status: "uncompleted",
            due_this_week: false,
            high_priority: false,
            assignee_id: "all",
            time_filter: "all",
            created_filter: "all",
            create_date: "",
            search_term: "",
            ...(savedState?.filters || {}),
        };

        // Explicit URL/action overrides take precedence over savedState
        if (contextStatus) {
            initialFilters.status = contextStatus;
        }
        if (contextAssignee) {
            initialFilters.assignee_id = contextAssignee;
        }
        if (contextDept) {
            initialFilters.department_id = contextDept;
        }

        // If explicit context or URL filters provided, sync to session storage immediately
        if (contextStatus || contextAssignee || contextDept) {
            try {
                const updatedPayload = {
                    filters: initialFilters,
                    expandedDepartments: (contextStatus === "overdue") ? {} : (savedState?.expandedDepartments || {}),
                    expandedTags: (contextStatus === "overdue") ? {} : (savedState?.expandedTags || {}),
                    expandedProjects: (contextStatus === "overdue") ? {} : (savedState?.expandedProjects || {}),
                };
                sessionStorage.setItem("my_tasks_dashboard_state", JSON.stringify(updatedPayload));
            } catch (e) {}
        }

        this.state = useState({
            loading: true,
            departments: [],
            allDepartments: [],
            allUsers: [],
            allStages: [],
            totalTasks: 0,
            filters: initialFilters,
            expandedDepartments: (contextStatus === "overdue") ? {} : (savedState?.expandedDepartments || {}),
            expandedTags: (contextStatus === "overdue") ? {} : (savedState?.expandedTags || {}),
            expandedProjects: (contextStatus === "overdue") ? {} : (savedState?.expandedProjects || {}),
            activeTaskStateDropdown: null,
            assigneeSearch: "",
            departmentSearch: "",
            dropdownOpen: {
                department: false,
                status: false,
                assignee: false,
                time: false,
                created_filter: false,
            },
            showCreateTaskModal: false,
            showReminderModal: false,
            reminderTaskId: null,
            downloadingReport: false,
        });

        this.onKeyDown = this.onKeyDown.bind(this);
        this.onDocClick = this.onDocClick.bind(this);
        this.onTaskUpdate = this.onTaskUpdate.bind(this);

        onWillStart(async () => {
            await this.loadData();
        });

        onWillUpdateProps(async (nextProps) => {
            let nextUrlStatus = null;
            let nextUrlAssignee = null;
            try {
                const searchParams = new URLSearchParams(window.location.search);
                nextUrlStatus = searchParams.get("status") || searchParams.get("default_status");
                nextUrlAssignee = searchParams.get("assignee") || searchParams.get("assignee_id") || searchParams.get("default_assignee_id");
            } catch (e) {}

            const nextStatus = (nextProps.action && nextProps.action.context && nextProps.action.context.default_status)
                || (nextProps.context && nextProps.context.default_status)
                || (nextProps.action && nextProps.action.params && nextProps.action.params.default_status)
                || (nextProps.action && nextProps.action.params && nextProps.action.params.status)
                || nextUrlStatus;

            const nextAssignee = (nextProps.action && nextProps.action.context && nextProps.action.context.default_assignee_id)
                || (nextProps.context && nextProps.context.default_assignee_id)
                || (nextProps.action && nextProps.action.params && nextProps.action.params.default_assignee_id)
                || (nextProps.action && nextProps.action.params && nextProps.action.params.assignee_id)
                || nextUrlAssignee;

            let changed = false;
            if (nextStatus && nextStatus !== this.state.filters.status) {
                this.state.filters.status = nextStatus;
                changed = true;
            }
            if (nextAssignee && nextAssignee !== this.state.filters.assignee_id) {
                this.state.filters.assignee_id = nextAssignee;
                changed = true;
            }
            if (changed) {
                this.saveStateToSession();
                await this.loadData();
            }
        });

        onMounted(() => {
            window.addEventListener("keydown", this.onKeyDown);
            document.addEventListener("click", this.onDocClick);
            if (this.env.bus) {
                this.env.bus.addEventListener("PROJECT_TASK:COUNT_UPDATE", this.onTaskUpdate);
            }
            window.addEventListener("PROJECT_TASK:COUNT_UPDATE", this.onTaskUpdate);
        });

        onWillUnmount(() => {
            window.removeEventListener("keydown", this.onKeyDown);
            document.removeEventListener("click", this.onDocClick);
            if (this.env.bus) {
                this.env.bus.removeEventListener("PROJECT_TASK:COUNT_UPDATE", this.onTaskUpdate);
            }
            window.removeEventListener("PROJECT_TASK:COUNT_UPDATE", this.onTaskUpdate);
        });
    }

    saveStateToSession() {
        try {
            const payload = {
                filters: this.state.filters,
                expandedDepartments: this.state.expandedDepartments,
                expandedTags: this.state.expandedTags,
                expandedProjects: this.state.expandedProjects,
            };
            sessionStorage.setItem("my_tasks_dashboard_state", JSON.stringify(payload));
        } catch (e) {
            // ignore storage errors
        }
    }

    // Task State / Activity Dropdown Handler
    toggleTaskStateDropdown(taskId, e) {
        if (e) {
            e.stopPropagation();
        }
        if (this.state.activeTaskStateDropdown === taskId) {
            this.state.activeTaskStateDropdown = null;
        } else {
            this.closeAllDropdowns();
            this.state.activeTaskStateDropdown = taskId;
        }
    }

    async setTaskState(taskId, newState, e) {
        if (e) {
            e.stopPropagation();
        }
        this.state.activeTaskStateDropdown = null;
        try {
            await this.orm.write("project.task", [taskId], {
                state: newState,
            });
            await this.loadData(true);
        } catch (err) {
            console.error("Error updating task state:", err);
            this.notification.add("Could not update status.", { type: "danger" });
        }
    }

    getStateLabel(state) {
        switch (state) {
            case "01_in_progress":
                return "In Progress";
            case "02_changes_requested":
                return "Changes Requested";
            case "03_approved":
                return "Approved";
            case "05_management_discussion":
                return "MGMT Discussion";
            case "1_canceled":
                return "Cancelled";
            case "1_done":
                return "Done";
            default:
                return "In Progress";
        }
    }

    onKeyDown(e) {
        // Ctrl + K or Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            if (this.searchInputRef.el) {
                this.searchInputRef.el.focus();
                this.searchInputRef.el.select();
            }
        }
    }

    onDocClick(e) {
        if (!e.target.closest(".mt-dropdown") && !e.target.closest(".mt-state-dropdown-wrap")) {
            this.closeAllDropdowns();
            this.state.activeTaskStateDropdown = null;
        }
    }

    closeAllDropdowns() {
        this.state.dropdownOpen.department = false;
        this.state.dropdownOpen.status = false;
        this.state.dropdownOpen.assignee = false;
        this.state.dropdownOpen.time = false;
        this.state.dropdownOpen.created_filter = false;
        this.state.activeTaskStateDropdown = null;
        this.state.assigneeSearch = "";
        this.state.departmentSearch = "";
    }

    toggleDropdown(type, e) {
        if (e) {
            e.stopPropagation();
        }
        const current = this.state.dropdownOpen[type];
        this.closeAllDropdowns();
        this.state.dropdownOpen[type] = !current;
    }

    async loadData(silent = false) {
        if (!silent && (!this.state.departments || this.state.departments.length === 0)) {
            this.state.loading = true;
        }
        try {
            const res = await this.orm.call("project.task", "get_my_tasks_dashboard_data", [], {
                filters: this.state.filters,
            });

            this.state.departments = res.departments || [];
            this.state.allDepartments = res.all_departments || [];
            this.state.allUsers = res.all_users || [];
            this.state.allStages = res.all_stages || [];
            this.state.totalTasks = res.total_tasks || 0;

            // Expand all departments, tags, and projects when status is overdue so user immediately sees overdue tasks
            if (this.state.filters.status === "overdue" && this.state.departments.length > 0) {
                for (const dept of this.state.departments) {
                    this.state.expandedDepartments[dept.id] = true;
                    for (const tag of (dept.tags || [])) {
                        this.state.expandedTags[tag.key] = true;
                        for (const proj of (tag.projects || [])) {
                            this.state.expandedProjects[proj.key] = true;
                        }
                    }
                }
                this.saveStateToSession();
            } else if (Object.keys(this.state.expandedDepartments).length === 0 && this.state.departments.length > 0) {
                for (const dept of this.state.departments) {
                    this.state.expandedDepartments[dept.id] = true;
                }
                this.saveStateToSession();
            }
        } catch (err) {
            console.error("Error loading My Tasks dashboard data:", err);
            this.notification.add("Failed to load tasks.", { type: "danger" });
        } finally {
            this.state.loading = false;
        }
    }

    // Direct Task Management Handlers
    async setTaskPriority(taskId, starNumber, e) {
        if (e) {
            e.stopPropagation();
        }
        try {
            let currentPrio = 0;
            for (const dept of (this.state.departments || [])) {
                for (const tag of (dept.tags || [])) {
                    for (const proj of (tag.projects || [])) {
                        for (const task of (proj.tasks || [])) {
                            if (task.id === taskId) {
                                currentPrio = task.priority_int || 0;
                            }
                        }
                    }
                }
            }
            const newPrio = currentPrio === starNumber ? 0 : starNumber;
            await this.orm.write("project.task", [taskId], {
                priority: String(newPrio),
            });
            await this.loadData(true);
        } catch (err) {
            console.error("Error setting task priority:", err);
            this.notification.add("Could not update priority.", { type: "danger" });
        }
    }

    async onProgressChange(taskId, e) {
        if (e) {
            e.stopPropagation();
        }
        const val = e.target.value;
        try {
            await this.orm.write("project.task", [taskId], {
                task_progress: val,
            });
            await this.loadData(true);
        } catch (err) {
            console.error("Error updating progress:", err);
            this.notification.add("Could not update progress.", { type: "danger" });
        }
    }

    async onStageChange(taskId, e) {
        if (e) {
            e.stopPropagation();
        }
        const stageId = parseInt(e.target.value);
        if (!stageId) return;
        try {
            await this.orm.write("project.task", [taskId], {
                stage_id: stageId,
            });
            await this.loadData(true);
        } catch (err) {
            console.error("Error updating stage:", err);
            this.notification.add("Could not update stage.", { type: "danger" });
        }
    }

    onTaskUpdate() {
        this.loadData(true);
    }

    toggleDepartment(deptId, e) {
        if (e) {
            e.stopPropagation();
        }
        this.state.expandedDepartments[deptId] = !this.state.expandedDepartments[deptId];
        this.saveStateToSession();
    }

    toggleTag(tagKey, e) {
        if (e) {
            e.stopPropagation();
        }
        const willBeOpen = !this.state.expandedTags[tagKey];
        this.state.expandedTags[tagKey] = willBeOpen;
        if (willBeOpen) {
            for (const dept of (this.state.departments || [])) {
                for (const tag of (dept.tags || [])) {
                    if (tag.key === tagKey) {
                        for (const proj of (tag.projects || [])) {
                            this.state.expandedProjects[proj.key] = true;
                        }
                    }
                }
            }
        }
        this.saveStateToSession();
    }

    toggleProject(projKey, e) {
        if (e) {
            e.stopPropagation();
        }
        this.state.expandedProjects[projKey] = !this.state.expandedProjects[projKey];
        this.saveStateToSession();
    }

    // Filter Handlers
    async selectDepartment(deptId) {
        this.state.filters.department_id = deptId;
        this.closeAllDropdowns();
        this.saveStateToSession();
        await this.loadData();
    }

    async selectStatus(statusVal) {
        this.state.filters.status = statusVal;
        this.closeAllDropdowns();
        this.saveStateToSession();
        await this.loadData();
    }

    async toggleDueThisWeek() {
        this.state.filters.due_this_week = !this.state.filters.due_this_week;
        if (this.state.filters.due_this_week) {
            this.state.filters.time_filter = "all";
        }
        this.saveStateToSession();
        await this.loadData();
    }

    async toggleHighPriority() {
        this.state.filters.high_priority = !this.state.filters.high_priority;
        this.saveStateToSession();
        await this.loadData();
    }

    async selectAssignee(userId) {
        this.state.filters.assignee_id = userId;
        this.closeAllDropdowns();
        this.saveStateToSession();
        await this.loadData();
    }

    async selectTimeFilter(timeVal) {
        this.state.filters.time_filter = timeVal;
        if (timeVal !== "all") {
            this.state.filters.due_this_week = false;
        }
        this.closeAllDropdowns();
        this.saveStateToSession();
        await this.loadData();
    }

    async selectCreatedFilter(createdFilterVal) {
        this.state.filters.created_filter = createdFilterVal;
        this.closeAllDropdowns();
        this.saveStateToSession();
        await this.loadData();
    }

    openCalendarPicker(e) {
        if (e && typeof e.stopPropagation === "function") {
            e.stopPropagation();
        }
        const el = this.createDateInputRef && this.createDateInputRef.el;
        if (el) {
            try {
                if (typeof el.showPicker === "function") {
                    el.showPicker();
                } else {
                    el.focus();
                    el.click();
                }
            } catch (err) {
                el.focus();
                el.click();
            }
        }
    }

    async onCreatedDateChange(e) {
        const val = e.target.value || "";
        this.state.filters.create_date = val;
        this.saveStateToSession();
        await this.loadData();
    }

    async clearCreatedDate(e) {
        if (e && typeof e.stopPropagation === "function") {
            e.stopPropagation();
        }
        this.state.filters.create_date = "";
        if (this.createDateInputRef && this.createDateInputRef.el) {
            this.createDateInputRef.el.value = "";
        }
        this.saveStateToSession();
        await this.loadData();
    }

    async onSearchInput(e) {
        this.state.filters.search_term = e.target.value;
        this.saveStateToSession();
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        this.searchTimeout = setTimeout(() => {
            this.loadData();
        }, 250);
    }

    onAssigneeSearch(e) {
        if (e) {
            e.stopPropagation();
        }
        this.state.assigneeSearch = e.target.value;
    }

    getFilteredAssignees() {
        const q = (this.state.assigneeSearch || "").trim().toLowerCase();
        if (!q) {
            return this.state.allUsers || [];
        }
        return (this.state.allUsers || []).filter((u) =>
            (u.name || "").toLowerCase().includes(q)
        );
    }

    onDepartmentSearch(e) {
        if (e) {
            e.stopPropagation();
        }
        this.state.departmentSearch = e.target.value;
    }

    getFilteredDepartments() {
        const q = (this.state.departmentSearch || "").trim().toLowerCase();
        if (!q) {
            return this.state.allDepartments || [];
        }
        return (this.state.allDepartments || []).filter((d) =>
            (d.name || "").toLowerCase().includes(q)
        );
    }

    // Actions
    openTask(taskId) {
        this.action.doAction({
            type: "ir.actions.client",
            tag: "custom_task_detail.task_detail_view",
            params: { task_id: taskId },
            context: { default_task_id: taskId },
            target: "current",
        });
    }

    createTask() {
        this.state.showCreateTaskModal = true;
    }

    closeCreateTaskModal() {
        this.state.showCreateTaskModal = false;
    }

    async onTaskCreated() {
        this.state.showCreateTaskModal = false;
        await this.loadData(true);
        if (this.env && this.env.bus) {
            this.env.bus.trigger("PROJECT_TASK:COUNT_UPDATE");
        }
        window.dispatchEvent(new CustomEvent("PROJECT_TASK:COUNT_UPDATE"));
    }

    // UI Helpers
    getSelectedDepartmentLabel() {
        if (this.state.filters.department_id === "all") {
            return "All departments";
        }
        const dept = this.state.allDepartments.find(
            (d) => d.id === parseInt(this.state.filters.department_id)
        );
        return dept ? dept.name : "Department";
    }

    getSelectedAssigneeLabel() {
        if (this.state.filters.assignee_id === "all") {
            return "All assignees";
        }
        if (this.state.filters.assignee_id === "my_tasks" || parseInt(this.state.filters.assignee_id) === user.userId) {
            return "My tasks";
        }
        const u = this.state.allUsers.find(
            (usr) => usr.id === parseInt(this.state.filters.assignee_id)
        );
        return u ? u.name : "Assignee";
    }

    getSelectedStatusLabel() {
        switch (this.state.filters.status) {
            case "pending":
                return "Pending";
            case "overdue":
                return "Overdue";
            case "mgmt_discussion":
                return "MGMT Discussion";
            case "done":
                return "Done";
            case "all":
                return "All";
            case "uncompleted":
            default:
                return "Uncompleted Tasks";
        }
    }

    getSelectedTimeLabel() {
        switch (this.state.filters.time_filter) {
            case "today":
                return "Due today";
            case "this_week":
                return "Due this week";
            case "this_month":
                return "Due this month";
            case "overdue":
                return "Overdue";
            default:
                return "All time";
        }
    }

    getSelectedCreatedFilterLabel() {
        switch (this.state.filters.created_filter) {
            case "assigned_to_self":
                return "Assigned to Self";
            case "assigned_to_others":
                return "Assigned to Others";
            case "all":
            default:
                return "Created: All";
        }
    }

    getSelectedCreatedDateLabel() {
        const dateVal = this.state.filters.create_date;
        if (!dateVal) {
            return "Created Date";
        }
        try {
            const [y, m, d] = dateVal.split("-");
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const monthName = months[parseInt(m, 10) - 1] || m;
            return `${parseInt(d, 10)} ${monthName} ${y}`;
        } catch (e) {
            return dateVal;
        }
    }

    async downloadExcelReport() {
        if (this.state.downloadingReport) {
            return;
        }
        try {
            this.state.downloadingReport = true;
            const filtersJson = JSON.stringify(this.state.filters);
            const downloadUrl = `/custom_mytask/export_excel?filters=${encodeURIComponent(filtersJson)}`;

            const link = document.createElement("a");
            link.href = downloadUrl;
            link.setAttribute("download", "");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.notification.add("Downloading tasks Excel report...", {
                type: "info",
            });
        } catch (err) {
            console.error("Error initiating Excel report download:", err);
            this.notification.add("Could not generate Excel report.", {
                type: "danger",
            });
        } finally {
            setTimeout(() => {
                this.state.downloadingReport = false;
            }, 1500);
        }
    }

    getStageClass(task) {
        const name = (task.stage_name || "").toLowerCase();
        if (name.includes("pending") || name.includes("new") || name.includes("to do")) {
            return "mt-stage-pending";
        }
        if (name.includes("progress") || name.includes("working") || name.includes("doing")) {
            return "mt-stage-progress";
        }
        if (name.includes("done") || name.includes("complete") || name.includes("closed")) {
            return "mt-stage-done";
        }
        if (name.includes("discussion") || name.includes("review")) {
            return "mt-stage-discussion";
        }
        if (name.includes("blocked") || name.includes("hold") || name.includes("cancel")) {
            return "mt-stage-blocked";
        }
        return "mt-stage-default";
    }

    openTaskReminder(taskId, event) {
        if (event) {
            event.stopPropagation();
        }
        this.state.reminderTaskId = taskId;
        this.state.showReminderModal = true;
    }

    closeTaskReminderModal() {
        this.state.showReminderModal = false;
        this.state.reminderTaskId = null;
    }

    onReminderSent() {
        // Handled via toast in modal
    }

    getAvatarColor(name) {
        const colors = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b"];
        let hash = 0;
        for (let i = 0; i < (name || "").length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    }
}

registry.category("actions").add("custom_mytask.my_tasks_dashboard", MyTasksDashboard);
