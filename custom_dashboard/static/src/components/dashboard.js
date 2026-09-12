/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, onWillStart, onMounted, onWillUnmount, useState, useRef, markup } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { rpc } from "@web/core/network/rpc";
import { TaskCreateModal } from "@custom_taskcreate/components/task_create_modal";

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
                custom_view: "all",
                search_term: "",
            },
            trendPeriod: "7_days",
            collapsedGroups: {},
            starredTasks: {},
            activeTooltip: null,
            overdueDeptFilter: "",
            overdueProjectFilter: "",
            showTaskDetailModal: false,
            taskDetailLoading: false,
            taskDetailData: null,
            taskModalTab: 'details',
            discussionNoteInput: '',
            isSavingDiscussion: false,
            dropdownOpen: {
                company: false,
                department: false,
                assignee: false,
                date_range: false,
                overdueDept: false,
                overdueProject: false,
            },
            companySearch: "",
            departmentSearch: "",
            assigneeSearch: "",
            overdueDeptSearch: "",
            overdueProjectSearch: "",
            showCreateTaskModal: false,
        });

        this.onKeyDown = this.onKeyDown.bind(this);
        this.onContextMenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        this.onDocClick = (e) => {
            if (!e.target.closest(".dash-dropdown")) {
                this.closeAllDropdowns();
            }
        };

        onWillStart(async () => {
            await this.loadDashboardData();
        });

        onMounted(() => {
            window.addEventListener("keydown", this.onKeyDown);
            window.addEventListener("contextmenu", this.onContextMenu, true);
            document.addEventListener("click", this.onDocClick);
        });

        onWillUnmount(() => {
            window.removeEventListener("keydown", this.onKeyDown);
            window.removeEventListener("contextmenu", this.onContextMenu, true);
            document.removeEventListener("click", this.onDocClick);
        });
    }

    async loadDashboardData() {
        try {
            this.state.loading = true;
            const filters = {
                ...this.state.filters,
                trend_period: this.state.trendPeriod,
            };
            const res = await this.orm.call("custom.dashboard", "get_dashboard_data", [filters]);
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

    closeAllDropdowns() {
        if (this.state.dropdownOpen) {
            this.state.dropdownOpen.company = false;
            this.state.dropdownOpen.department = false;
            this.state.dropdownOpen.assignee = false;
            this.state.dropdownOpen.date_range = false;
            this.state.dropdownOpen.overdueDept = false;
            this.state.dropdownOpen.overdueProject = false;
        }
        this.state.companySearch = "";
        this.state.departmentSearch = "";
        this.state.assigneeSearch = "";
        this.state.overdueDeptSearch = "";
        this.state.overdueProjectSearch = "";
    }

    toggleDropdown(type, e) {
        if (e) {
            e.stopPropagation();
        }
        const current = this.state.dropdownOpen[type];
        this.closeAllDropdowns();
        this.state.dropdownOpen[type] = !current;
    }

    async selectFilter(field, value) {
        this.state.filters[field] = value;
        this.closeAllDropdowns();
        await this.loadDashboardData();
    }

    onAssigneeSearch(e) {
        if (e) {
            e.stopPropagation();
        }
        this.state.assigneeSearch = e.target.value;
    }

    getFilteredAssignees() {
        const q = (this.state.assigneeSearch || "").trim().toLowerCase();
        const list = this.state.data.assignees || [];
        if (!q) return list;
        return list.filter((u) => (u.name || "").toLowerCase().includes(q));
    }

    onDepartmentSearch(e) {
        if (e) {
            e.stopPropagation();
        }
        this.state.departmentSearch = e.target.value;
    }

    getFilteredDepartments() {
        const q = (this.state.departmentSearch || "").trim().toLowerCase();
        const list = this.state.data.departments || [];
        if (!q) return list;
        return list.filter((d) => (d.name || "").toLowerCase().includes(q));
    }

    onCompanySearch(e) {
        if (e) {
            e.stopPropagation();
        }
        this.state.companySearch = e.target.value;
    }

    getFilteredCompanies() {
        const q = (this.state.companySearch || "").trim().toLowerCase();
        const list = this.state.data.companies || [];
        if (!q) return list;
        return list.filter((c) => (c.name || "").toLowerCase().includes(q));
    }

    getSelectedCompanyLabel() {
        if (!this.state.filters.company_id) return "All Companies";
        const c = (this.state.data.companies || []).find((x) => x.id == this.state.filters.company_id);
        return c ? c.name : "All Companies";
    }

    getSelectedDepartmentLabel() {
        if (!this.state.filters.department_id) return "All Departments";
        const d = (this.state.data.departments || []).find((x) => x.id == this.state.filters.department_id);
        return d ? d.name : "All Departments";
    }

    getSelectedAssigneeLabel() {
        if (!this.state.filters.user_id) return "All Assignees";
        const u = (this.state.data.assignees || []).find((x) => x.id == this.state.filters.user_id);
        return u ? u.name : "All Assignees";
    }

    getSelectedDateRangeLabel() {
        switch (this.state.filters.date_range) {
            case "today": return "Today";
            case "this_week": return "This Week";
            case "this_month": return "This Month";
            default: return "All Time";
        }
    }

    async onFilterChange(field, ev) {
        this.state.filters[field] = ev.target.value;
        await this.loadDashboardData();
    }

    async setQuickFilter(view) {
        this.state.filters.custom_view = view || "all";
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

    get currentDateFormatted() {
        if (this.state.data && this.state.data.current_date_formatted) {
            return this.state.data.current_date_formatted;
        }
        if (this.state.data && this.state.data.user_info && this.state.data.user_info.current_date_formatted) {
            return this.state.data.user_info.current_date_formatted;
        }
        const now = new Date();
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const dayName = days[now.getDay()];
        const day = String(now.getDate()).padStart(2, "0");
        const month = months[now.getMonth()];
        const year = now.getFullYear();
        return `${dayName}, ${day} ${month} ${year}`;
    }

    get filteredTableGroups() {
        const groups = this.state.data.overdue_table_groups || [];
        const query = (this.state.filters.search_term || "").trim().toLowerCase();
        const deptFilter = (this.state.overdueDeptFilter || "").trim();
        const projFilter = (this.state.overdueProjectFilter || "").trim();

        if (!query && !deptFilter && !projFilter) {
            return groups;
        }

        return groups
            .map((grp) => {
                const filteredTasks = grp.tasks.filter((t) => {
                    const matchesSearch = !query ||
                        ((t.title || "").toLowerCase().includes(query)) ||
                        ((t.project || "").toLowerCase().includes(query)) ||
                        ((t.tag || "").toLowerCase().includes(query)) ||
                        ((t.created_by || "").toLowerCase().includes(query));

                    const matchesDept = !deptFilter || ((t.department || "").toLowerCase() === deptFilter.toLowerCase());
                    const matchesProj = !projFilter || ((t.project || "").toLowerCase() === projFilter.toLowerCase());

                    return matchesSearch && matchesDept && matchesProj;
                });
                return {
                    ...grp,
                    count: filteredTasks.length,
                    tasks: filteredTasks,
                };
            })
            .filter((grp) => grp.tasks.length > 0);
    }

    getOverdueDepartments() {
        const depts = new Set();
        if (this.state.data.departments && Array.isArray(this.state.data.departments)) {
            for (const d of this.state.data.departments) {
                if (d.name) depts.add(d.name);
            }
        }
        const groups = this.state.data.overdue_table_groups || [];
        for (const grp of groups) {
            for (const task of grp.tasks) {
                if (task.department) depts.add(task.department);
            }
        }
        return Array.from(depts).sort();
    }

    onOverdueDeptSearch(e) {
        if (e) {
            e.stopPropagation();
        }
        this.state.overdueDeptSearch = e.target.value;
    }

    getFilteredOverdueDepartments() {
        const q = (this.state.overdueDeptSearch || "").trim().toLowerCase();
        const list = this.getOverdueDepartments();
        if (!q) return list;
        return list.filter((dept) => (dept || "").toLowerCase().includes(q));
    }

    selectOverdueDept(dept) {
        this.state.overdueDeptFilter = dept;
        this.closeAllDropdowns();
    }

    getOverdueProjects() {
        const groups = this.state.data.overdue_table_groups || [];
        const projs = new Set();
        for (const grp of groups) {
            for (const task of grp.tasks) {
                if (task.project && task.project !== 'No Project') projs.add(task.project);
            }
        }
        return Array.from(projs).sort();
    }

    onOverdueProjectSearch(e) {
        if (e) {
            e.stopPropagation();
        }
        this.state.overdueProjectSearch = e.target.value;
    }

    getFilteredOverdueProjects() {
        const q = (this.state.overdueProjectSearch || "").trim().toLowerCase();
        const list = this.getOverdueProjects();
        if (!q) return list;
        return list.filter((proj) => (proj || "").toLowerCase().includes(q));
    }

    selectOverdueProject(proj) {
        this.state.overdueProjectFilter = proj;
        this.closeAllDropdowns();
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
        const paddingLeft = 40;
        const paddingRight = 20;
        const baselineY = 175;
        const topY = 25;

        const effectiveW = width - paddingLeft - paddingRight;
        const effectiveH = baselineY - topY; // 150
        const maxVal = 80;

        const coords = points.map((p, index) => {
            const x = paddingLeft + (index / (points.length - 1 || 1)) * effectiveW;
            const y = baselineY - (Math.min(p.count, maxVal) / maxVal) * effectiveH;
            return { x, y, raw: p };
        });

        if (coords.length === 1) {
            return {
                linePath: `M ${coords[0].x} ${coords[0].y}`,
                areaPath: `M ${coords[0].x} ${coords[0].y} L ${coords[0].x} ${baselineY} Z`,
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
        const areaPath = `${linePath} L ${last.x},${baselineY} L ${first.x},${baselineY} Z`;

        return { linePath, areaPath, coords };
    }

    get activeTooltipPos() {
        const active = this.state.activeTooltip;
        if (!active) return null;
        const trend = this.trendPointsData;
        if (!trend || !trend.coords || !trend.coords.length) return null;
        const pt = trend.coords.find((c) => c.raw.day === active.day || c.raw.date === active.date) ||
            trend.coords.find((c) => c.raw.is_peak) ||
            trend.coords[3] ||
            trend.coords[0];
        if (!pt) return null;
        return {
            xPct: ((pt.x / 540) * 100).toFixed(2),
            yPct: ((pt.y / 210) * 100).toFixed(2),
            date: active.date || (pt.raw && pt.raw.date) || "",
            count: active.count !== undefined ? active.count : (pt.raw && pt.raw.count) || 0,
        };
    }

    onHoverTrendPoint(point) {
        this.state.activeTooltip = point.raw;
    }

    // Navigation & Actions
    onCreateTask() {
        this.state.showCreateTaskModal = true;
    }

    closeCreateTaskModal() {
        this.state.showCreateTaskModal = false;
    }

    onTaskCreated() {
        this.state.showCreateTaskModal = false;
        this.loadDashboardData();
    }

    onOpenTask(taskId) {
        // Find the task object from state data
        let taskObj = null;
        if (this.state.data && this.state.data.overdue_table_groups) {
            for (const grp of this.state.data.overdue_table_groups) {
                const found = grp.tasks.find(t => t.id === taskId);
                if (found) {
                    taskObj = found;
                    break;
                }
            }
        }

        if (taskObj) {
            // Map the keys for openTaskDetailModal
            const mappedTask = {
                id: taskObj.id,
                task: taskObj.title,
                project: taskObj.project,
                department: taskObj.department,
                due_date: taskObj.date_deadline,
                status: taskObj.stage,
                employee: taskObj.assignees && taskObj.assignees.length ? taskObj.assignees.map(a => a.name).join(', ') : 'Unassigned',
            };
            this.openTaskDetailModal(mappedTask);
        } else {
            // Fallback to native form view if not found
            this.action.doAction({
                type: "ir.actions.act_window",
                res_model: "project.task",
                res_id: taskId,
                views: [[false, "form"]],
                target: "new",
            });
        }
    }

    onOpenTaskList(type) {
        let title = "Tasks";
        const domainMap = (this.state.data && this.state.data.domain_map) || {};
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

        if (domainMap[type]) {
            domain = domainMap[type];
        } else if (taskIdsMap[type] && taskIdsMap[type].length) {
            domain = [["id", "in", taskIdsMap[type]]];
        } else {
            domain = [["active", "=", true]];
            if (type === "in_progress") domain.push(["state", "=", "01_in_progress"]);
            if (type === "completed") domain.push(["state", "=", "1_done"]);
            if (type === "due_today") domain.push(["date_deadline", "=", new Date().toISOString().split("T")[0]], ["state", "!=", "1_done"]);
            if (type === "overdue") domain.push(["date_deadline", "<", new Date().toISOString().split("T")[0]], ["state", "!=", "1_done"]);
            if (type === "blocked") domain.push(["state", "=", "04_waiting_normal"]);
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
                context: {
                    back_to_dashboard: true,
                    group_by: ["single_tag_id", "project_id", "stage_id"],
                },
            },
            {
                clearBreadcrumbs: true,
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
                context: {
                    back_to_dashboard: true,
                    group_by: ["single_tag_id", "project_id", "stage_id"],
                },
            },
            {
                clearBreadcrumbs: true,
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
                context: { back_to_dashboard: true },
            },
            {
                clearBreadcrumbs: true,
            }
        );
    }


    async openTaskDetailModal(row) {
        if (!row || !row.id) return;
        this.state.showTaskDetailModal = true;
        this.state.taskDetailLoading = true;
        this.state.taskModalTab = 'details';
        this.state.discussionNoteInput = '';
        this.state.taskDetailData = {
            id: row.id,
            name: row.task || 'Task',
            project: row.project || '',
            department: row.department || '',
            due_date: row.due_date || '',
            due_date_dmy: '',
            status_label: row.status || 'Task',
            status_code: (row.status || '').toLowerCase().includes('mgmt') ? 'mgmt' : ((row.status || '').toLowerCase().includes('due') ? 'due' : 'pending'),
            employee: row.employee || '',
            progress: 0,
            assignees: [],
            total_logs_count: 0,
            date_groups: [],
            analytics: { on_time_pct: 100.0, delayed_pct: 0.0 }
        };

        try {
            const res = await rpc('/department_dashboard/task_details', { task_id: row.id });
            if (res && res.status === 'success' && res.task) {
                const prevEmployee = this.state.taskDetailData.employee;
                this.state.taskDetailData = res.task;
                if (!this.state.taskDetailData.employee && prevEmployee) {
                    this.state.taskDetailData.employee = prevEmployee;
                }
                this.state.discussionNoteInput = res.task.discussion_notes_text || res.task.mgmt_discussion || '';
            } else {
                throw new Error("RPC returned non-success");
            }
        } catch (err) {
            console.error("[Dashboard] Error fetching task details, falling back to ORM:", err);
            try {
                const task_data = await rpc('/web/dataset/call_kw/project.task/read', {
                    model: 'project.task',
                    method: 'read',
                    args: [[row.id], ['project_id', 'stage_id', 'state', 'name']],
                    kwargs: {}
                });
                if (task_data && task_data.length) {
                    const p_task = task_data[0];
                    const project_id = p_task.project_id ? p_task.project_id[0] : null;
                    const stage_id = p_task.stage_id ? p_task.stage_id[0] : null;
                    const is_done = (p_task.state && p_task.state === '1_done') || false;

                    let domain = [];
                    if (project_id) {
                        domain = [['project_ids', 'in', [project_id]]];
                    } else if (stage_id) {
                        domain = [['id', '=', stage_id]];
                    }

                    const stages = await rpc('/web/dataset/call_kw/project.task.type/search_read', {
                        model: 'project.task.type',
                        method: 'search_read',
                        args: [domain, ['id', 'name', 'sequence']],
                        kwargs: { order: 'sequence asc' }
                    });

                    let total_stages = Math.max(1, stages.length);
                    let current_stage_idx = 1;
                    let current_stage_name = p_task.stage_id ? p_task.stage_id[1] : 'New';

                    const stage_ids = stages.map(s => s.id);
                    if (stage_id && stage_ids.includes(stage_id)) {
                        current_stage_idx = stage_ids.indexOf(stage_id) + 1;
                    } else if (is_done) {
                        current_stage_idx = total_stages;
                    }

                    const stage_progress_pct = Math.min(100, Math.max(0, (current_stage_idx / total_stages) * 100));

                    this.state.taskDetailData.analytics = {
                        stage_progress_pct: stage_progress_pct,
                        remaining_stage_pct: 100 - stage_progress_pct,
                        current_stage_idx: current_stage_idx,
                        total_stages: total_stages,
                        remaining_stages_count: total_stages - current_stage_idx,
                        current_stage_name: current_stage_name,
                        on_time_pct: 100.0,
                        delayed_pct: 0.0
                    };
                    this.state.taskDetailData.stage = current_stage_name;
                }
            } catch (fallbackErr) {
                console.error("[Dashboard] Fallback analytics fetch also failed:", fallbackErr);
            }
        } finally {
            this.state.taskDetailLoading = false;
        }
    }

    closeTaskDetailModal() {
        this.state.showTaskDetailModal = false;
        this.state.taskDetailLoading = false;
        this.state.taskDetailData = null;
        this.state.taskModalTab = 'details';
        this.state.discussionNoteInput = '';
    }

    async saveDiscussion() {
        if (!this.state.taskDetailData || !this.state.taskDetailData.id) return;
        this.state.isSavingDiscussion = true;
        try {
            const res = await rpc('/department_dashboard/save_task_discussion', {
                task_id: this.state.taskDetailData.id,
                notes: this.state.discussionNoteInput
            });
            if (res && res.status === 'success') {
                const detailRes = await rpc('/department_dashboard/task_details', { task_id: this.state.taskDetailData.id });
                if (detailRes && detailRes.status === 'success' && detailRes.task) {
                    const prevEmployee = this.state.taskDetailData.employee;
                    this.state.taskDetailData = detailRes.task;
                    if (!this.state.taskDetailData.employee && prevEmployee) {
                        this.state.taskDetailData.employee = prevEmployee;
                    }
                }
            }
        } catch (err) {
            console.error("[Dashboard] Error saving discussion:", err);
        } finally {
            this.state.isSavingDiscussion = false;
        }
    }

    getTaskHistoryEntries() {
        if (!this.state.taskDetailData || !this.state.taskDetailData.date_groups) return [];
        const res = [];
        for (const dg of this.state.taskDetailData.date_groups) {
            for (const entry of dg.entries) {
                const author = entry.author || 'User';
                const parts = author.trim().split(/\s+/);
                const initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
                res.push({
                    id: entry.id,
                    author: author,
                    initials: initials,
                    time_str: entry.time_str,
                    tracking_values: entry.tracking_values || [],
                    body: entry.body || ''
                });
            }
        }
        return res;
    }

    setTaskModalTab(tab) {
        this.state.taskModalTab = tab;
    }

    renderMarkup(val) {
        return markup(val || '');
    }

    getInitials(name) {
        if (!name) return 'U';
        const parts = name.trim().split(/\s+/);
        if (parts.length > 1) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.trim().substring(0, 2).toUpperCase();
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
}

CustomDashboard.template = "custom_dashboard.DashboardView";
CustomDashboard.components = {
    TaskCreateModal,
};

registry.category("actions").add("custom_dashboard.client_action", CustomDashboard);
