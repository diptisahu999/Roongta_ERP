/** @odoo-module */

import { Component, useState, onWillStart, onMounted, useRef } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { rpc } from "@web/core/network/rpc";
import { loadBundle } from "@web/core/assets";

export class CustomeAnalyticsDashboard extends Component {
    setup() {
        this.actionService = useService("action");

        this.state = useState({
            data: null,
            isLoading: true,
            filterCompany: 'all',
            filterDept: 'all',
            filterEmployee: 'all',
            filterProject: 'all',
            filterCustomView: 'all',
            dateRange: 'all',
            dateFrom: '',
            dateTo: '',
            timeGranularity: 'weekly',
            openDropdown: null, // 'company', 'department', 'employee', 'project', 'custom_view', 'date', 'quick_filter', null
            searchDept: '',
            searchEmployee: '',
            searchProject: '',
        });

        this.tasksOverTimeRef = useRef("tasksOverTimeCanvas");
        this.tasksStatusRef = useRef("tasksStatusCanvas");
        this.tasksPriorityRef = useRef("tasksPriorityCanvas");
        this.productivityRef = useRef("productivityCanvas");

        this.chartInstances = {};

        // Close dropdowns on global click
        this.onWindowClick = (ev) => {
            if (!ev.target.closest('.ca-custom-dropdown') && !ev.target.closest('.ca-action-pill')) {
                this.state.openDropdown = null;
            }
        };

        onWillStart(async () => {
            try {
                if (!window.Chart) {
                    await loadBundle("web.chartjs_lib");
                }
            } catch (err) {
                console.warn("Chart.js bundle load attempted:", err);
            }
            // Restore filters from sessionStorage if returning from task list or elsewhere
            const savedFilters = sessionStorage.getItem("ca_dashboard_filters");
            if (savedFilters) {
                try {
                    const parsed = JSON.parse(savedFilters);
                    if (parsed && typeof parsed === "object") {
                        if (parsed.filterCompany) this.state.filterCompany = parsed.filterCompany;
                        if (parsed.filterDept) this.state.filterDept = parsed.filterDept;
                        if (parsed.filterEmployee) this.state.filterEmployee = parsed.filterEmployee;
                        if (parsed.filterProject) this.state.filterProject = parsed.filterProject;
                        if (parsed.filterCustomView) this.state.filterCustomView = parsed.filterCustomView;
                        if (parsed.dateRange) this.state.dateRange = parsed.dateRange;
                        if (parsed.dateFrom) this.state.dateFrom = parsed.dateFrom;
                        if (parsed.dateTo) this.state.dateTo = parsed.dateTo;
                        if (parsed.timeGranularity) this.state.timeGranularity = parsed.timeGranularity;
                    }
                } catch (e) {
                    console.warn("[CustomeAnalyticsDashboard] Failed to parse saved filters:", e);
                }
            }
            await this.fetchData();
        });

        onMounted(() => {
            window.addEventListener('click', this.onWindowClick);
            if (this.state.data) {
                this.renderAllCharts();
            }
        });
    }

    saveFiltersToStorage() {
        try {
            const filters = {
                filterCompany: this.state.filterCompany,
                filterDept: this.state.filterDept,
                filterEmployee: this.state.filterEmployee,
                filterProject: this.state.filterProject,
                filterCustomView: this.state.filterCustomView,
                dateRange: this.state.dateRange,
                dateFrom: this.state.dateFrom,
                dateTo: this.state.dateTo,
                timeGranularity: this.state.timeGranularity,
            };
            sessionStorage.setItem("ca_dashboard_filters", JSON.stringify(filters));
        } catch (e) {
            console.warn("[CustomeAnalyticsDashboard] Failed to save filters:", e);
        }
    }

    async fetchData() {
        this.state.isLoading = true;
        try {
            const params = {
                company_id: this.state.filterCompany,
                department_id: this.state.filterDept,
                employee_id: this.state.filterEmployee,
                project_id: this.state.filterProject,
                custom_view: this.state.filterCustomView,
                date_range: this.state.dateRange,
                time_granularity: this.state.timeGranularity,
            };
            if (this.state.dateFrom && this.state.dateTo && this.state.dateRange === 'custom') {
                params.date_from = this.state.dateFrom;
                params.date_to = this.state.dateTo;
            }

            const data = await rpc('/custome_analytics/data', params);
            if (data && data.overview) {
                const ov = data.overview;
                const total = ov.total_tasks || 0;
                const completed = ov.completed_tasks || 0;
                if (ov.on_time_completed === undefined) {
                    ov.on_time_completed = completed;
                }
                if (ov.late_completed === undefined) {
                    ov.late_completed = Math.max(0, completed - ov.on_time_completed);
                }
                if (ov.completion_rate === undefined) {
                    ov.completion_rate = total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0;
                }
                if (ov.on_time_rate === undefined) {
                    ov.on_time_rate = completed > 0 ? Number(((ov.on_time_completed / completed) * 100).toFixed(1)) : 0;
                }
                if (ov.late_rate === undefined) {
                    ov.late_rate = completed > 0 ? Number(((ov.late_completed / completed) * 100).toFixed(1)) : 0;
                }
                if (ov.performance_rate === undefined) {
                    ov.performance_rate = total > 0 ? Number(((ov.on_time_completed / total) * 100).toFixed(1)) : 0;
                }
                if (ov.total_tasks_trend === undefined) ov.total_tasks_trend = 0;
                if (ov.completed_tasks_trend === undefined) ov.completed_tasks_trend = 0;
                if (ov.on_time_completed_trend === undefined) ov.on_time_completed_trend = 0;
                if (ov.late_completed_trend === undefined) ov.late_completed_trend = 0;
                if (ov.performance_rate_trend === undefined) ov.performance_rate_trend = 0;
                if (!ov.sparklines) {
                    ov.sparklines = {};
                }
                if (!ov.sparklines.total_tasks) ov.sparklines.total_tasks = [0, 0, 0, 0, 0];
                if (!ov.sparklines.completed_tasks) ov.sparklines.completed_tasks = [0, 0, 0, 0, 0];
                if (!ov.sparklines.on_time_completed) ov.sparklines.on_time_completed = ov.sparklines.completed_tasks || [0, 0, 0, 0, 0];
                if (!ov.sparklines.late_completed) ov.sparklines.late_completed = [0, 0, 0, 0, 0];
                if (!ov.sparklines.performance) ov.sparklines.performance = [0, 0, 0, 0, 0];
            }
            this.state.data = data;

            if (data.filters) {
                if (data.filters.date_from && data.filters.date_to && this.state.dateRange !== 'custom') {
                    this.state.dateFrom = data.filters.date_from;
                    this.state.dateTo = data.filters.date_to;
                }
            }
        } catch (error) {
            console.error("Error fetching analytics dashboard data:", error);
        } finally {
            this.state.isLoading = false;
            setTimeout(() => this.renderAllCharts(), 80);
        }
    }

    toggleFilterDropdown(name, ev) {
        if (ev && ev.target.closest('.ca-dropdown-menu, .ca-custom-dropdown-popover')) {
            return; // Do not toggle if click is inside the opened menu
        }
        if (ev) ev.stopPropagation();
        if (this.state.openDropdown === name) {
            this.state.openDropdown = null;
        } else {
            this.state.openDropdown = name;
            this.state.searchDept = '';
            this.state.searchEmployee = '';
            this.state.searchProject = '';
        }
    }

    toggleDateDropdown(ev) {
        this.toggleFilterDropdown('date', ev);
    }

    toggleQuickFilters(ev) {
        this.toggleFilterDropdown('quick_filter', ev);
    }

    async setDatePreset(preset) {
        this.state.dateRange = preset;
        this.state.openDropdown = null;
        this.saveFiltersToStorage();
        await this.fetchData();
    }

    async applyCustomDate() {
        if (this.state.dateFrom && this.state.dateTo) {
            this.state.dateRange = 'custom';
            this.state.openDropdown = null;
            this.saveFiltersToStorage();
            await this.fetchData();
        }
    }

    async setQuickFilter(view) {
        this.state.filterCustomView = view;
        this.state.openDropdown = null;
        this.saveFiltersToStorage();
        await this.fetchData();
    }

    async selectCompany(companyId) {
        this.state.openDropdown = null;
        this.state.filterCompany = companyId ? companyId.toString() : 'all';
        this.saveFiltersToStorage();
        await this.fetchData();
    }

    async selectDepartment(deptId) {
        this.state.openDropdown = null;
        this.state.filterDept = deptId ? deptId.toString() : 'all';
        this.saveFiltersToStorage();
        await this.fetchData();
    }

    async selectEmployee(empId) {
        this.state.openDropdown = null;
        this.state.filterEmployee = empId ? empId.toString() : 'all';
        this.saveFiltersToStorage();
        await this.fetchData();
    }

    async selectProject(projId) {
        this.state.openDropdown = null;
        this.state.filterProject = projId ? projId.toString() : 'all';
        this.saveFiltersToStorage();
        await this.fetchData();
    }

    async selectCustomView(view) {
        this.state.openDropdown = null;
        this.state.filterCustomView = view || 'all';
        this.saveFiltersToStorage();
        await this.fetchData();
    }

    async onGranularityChange(ev) {
        this.state.timeGranularity = ev.target.value;
        this.saveFiltersToStorage();
        await this.fetchData();
    }

    async filterByDepartment(deptId) {
        if (!deptId) return;
        this.state.filterDept = deptId.toString();
        this.saveFiltersToStorage();
        await this.fetchData();
    }

    async filterByAssignee(empId) {
        if (!empId) return;
        this.state.filterEmployee = empId.toString();
        this.saveFiltersToStorage();
        await this.fetchData();
    }

    async filterByProject(projId) {
        if (!projId) return;
        this.state.filterProject = projId.toString();
        this.saveFiltersToStorage();
        await this.fetchData();
    }

    // Label Getters for Dropdowns
    get selectedDepartmentName() {
        if (!this.state.data || !this.state.data.filters) return "All Departments";
        const filters = this.state.data.filters;
        if (filters.is_restricted_user && filters.departments && filters.departments.length > 0) {
            return filters.departments[0].name;
        }
        if (this.state.filterDept === 'all') return "All Departments";
        const d = filters.departments.find(dept => dept.id.toString() === this.state.filterDept.toString());
        return d ? d.name : "All Departments";
    }

    get selectedCompanyName() {
        if (!this.state.data || !this.state.data.filters) return "All Companies";
        if (this.state.filterCompany === 'all') return "All Companies";
        const c = this.state.data.filters.companies.find(comp => comp.id.toString() === this.state.filterCompany.toString());
        return c ? c.name : "All Companies";
    }

    get selectedEmployeeName() {
        if (!this.state.data || !this.state.data.filters) return "All Assignees";
        if (this.state.filterEmployee === 'all') return "All Assignees";
        const e = this.state.data.filters.employees.find(emp => emp.id.toString() === this.state.filterEmployee.toString());
        return e ? e.name : "All Assignees";
    }

    get selectedProjectName() {
        if (!this.state.data || !this.state.data.filters) return "All Projects";
        if (this.state.filterProject === 'all') return "All Projects";
        const p = this.state.data.filters.projects.find(proj => proj.id.toString() === this.state.filterProject.toString());
        return p ? p.name : "All Projects";
    }

    get selectedCustomViewName() {
        const map = {
            'all': 'Custom View',
            'my_tasks': 'My Tasks',
            'high_priority': 'High Priority',
            'blocked': 'Blocked Tasks',
            'overdue': 'Overdue Tasks',
        };
        return map[this.state.filterCustomView] || 'Custom View';
    }

    // Search Filtering Getters
    get filteredDepartments() {
        if (!this.state.data || !this.state.data.filters) return [];
        const depts = this.state.data.filters.departments || [];
        if (!this.state.searchDept) return depts;
        const q = this.state.searchDept.toLowerCase();
        return depts.filter(d => d.name.toLowerCase().includes(q));
    }

    get filteredEmployees() {
        if (!this.state.data || !this.state.data.filters) return [];
        const emps = this.state.data.filters.employees || [];
        if (!this.state.searchEmployee) return emps;
        const q = this.state.searchEmployee.toLowerCase();
        return emps.filter(e => e.name.toLowerCase().includes(q));
    }

    get filteredProjects() {
        if (!this.state.data || !this.state.data.filters) return [];
        const projs = this.state.data.filters.projects || [];
        if (!this.state.searchProject) return projs;
        const q = this.state.searchProject.toLowerCase();
        return projs.filter(p => p.name.toLowerCase().includes(q));
    }

    openTasks(category) {
        if (!this.state.data || !this.state.data.task_ids) return;

        let taskIds = [];
        let title = "Tasks";

        if (category === 'total') {
            title = "Total Tasks";
            taskIds = this.state.data.task_ids['total'] || [];
        } else if (category === 'completed') {
            title = "Total Completed Tasks";
            taskIds = this.state.data.task_ids['completed'] || [];
        } else if (category === 'completed_on_time' || category === 'performance') {
            title = "Completed On Time Tasks";
            taskIds = this.state.data.task_ids['completed_on_time'] || [];
        } else if (category === 'completed_late') {
            title = "Completed Late Tasks";
            taskIds = this.state.data.task_ids['completed_late'] || [];
        } else if (category === 'overdue') {
            title = "Overdue Tasks";
            taskIds = this.state.data.task_ids['overdue'] || [];
        } else if (category === 'blocked') {
            title = "Blocked Tasks";
            taskIds = this.state.data.task_ids['blocked'] || [];
        } else if (category === 'in_progress') {
            title = "In Progress Tasks";
            taskIds = this.state.data.task_ids['in_progress'] || [];
        } else if (category === 'pending') {
            title = "Pending Tasks";
            taskIds = this.state.data.task_ids['pending'] || [];
        } else if (category === 'cancelled') {
            title = "Cancelled Tasks";
            taskIds = this.state.data.task_ids['cancelled'] || [];
        } else if (category === 'high') {
            title = "High Priority Tasks";
            taskIds = this.state.data.task_ids['high'] || [];
        } else if (category === 'medium') {
            title = "Medium Priority Tasks";
            taskIds = this.state.data.task_ids['medium'] || [];
        } else if (category === 'low') {
            title = "Low Priority Tasks";
            taskIds = this.state.data.task_ids['low'] || [];
        } else {
            taskIds = this.state.data.task_ids[category] || this.state.data.task_ids['total'] || [];
        }

        this.saveFiltersToStorage();

        // Clear any project dashboard leftovers so backTarget works unambiguously
        try {
            sessionStorage.removeItem("pd_active_level_state");
            sessionStorage.removeItem("pd_navigated_to_task");
        } catch (e) {}

        const domain = [['id', 'in', taskIds]];

        this.actionService.doAction({
            type: 'ir.actions.client',
            tag: 'custom_list_task.task_list_view',
            name: title,
            params: {
                title: title,
                custom_domain: domain,
                domain: domain,
                group_by: 'tag_project_stage',
                back_to_dashboard: 'custome_analytics.action_custome_analytics_dashboard',
            },
            context: {
                default_title: title,
                default_domain: domain,
                custom_domain: domain,
                default_group_by: 'tag_project_stage',
                back_to_analytics: true,
                back_to_dashboard: 'custome_analytics.action_custome_analytics_dashboard',
            },
            target: 'current',
        }, { clearBreadcrumbs: true });
    }

    openAllDepartments() {
        this.actionService.doAction({
            type: 'ir.actions.act_window',
            name: 'Departments',
            res_model: 'hr.department',
            view_mode: 'kanban,list,form',
            views: [[false, 'kanban'], [false, 'list'], [false, 'form']],
            target: 'current',
            context: { back_to_analytics: true },
        }, { clearBreadcrumbs: true });
    }

    openAllAssignees() {
        this.actionService.doAction({
            type: 'ir.actions.act_window',
            name: 'Assignees',
            res_model: 'res.users',
            view_mode: 'list,kanban,form',
            views: [[false, 'list'], [false, 'kanban'], [false, 'form']],
            domain: [['share', '=', false]],
            target: 'current',
            context: { back_to_analytics: true },
        }, { clearBreadcrumbs: true });
    }

    openAllProjects() {
        this.actionService.doAction({
            type: 'ir.actions.act_window',
            name: 'Projects',
            res_model: 'project.project',
            view_mode: 'kanban,list,form',
            views: [[false, 'kanban'], [false, 'list'], [false, 'form']],
            target: 'current',
            context: { back_to_analytics: true },
        }, { clearBreadcrumbs: true });
    }

    onAvatarError(ev) {
        ev.target.src = '/web/static/img/placeholder.png';
    }

    exportData() {
        if (!this.state.data) return;
        const ov = this.state.data.overview;
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Metric,Value,Trend\n";
        csvContent += `Total Tasks,${ov.total_tasks},${ov.total_tasks_trend}%\n`;
        csvContent += `Completed Tasks,${ov.completed_tasks},${ov.completed_tasks_trend}%\n`;
        csvContent += `Completion Rate,${ov.completion_rate}%,${ov.completion_rate_trend}%\n`;
        csvContent += `Overdue Tasks,${ov.overdue_tasks},${ov.overdue_tasks_trend}%\n`;
        csvContent += `Blocked Tasks,${ov.blocked_tasks},${ov.blocked_tasks_trend}%\n\n`;

        csvContent += "Department,Total Tasks,Completed,Overdue,Completion Rate\n";
        for (const dept of this.state.data.department_performance) {
            csvContent += `"${dept.department}",${dept.total_tasks},${dept.completed},${dept.overdue},${dept.completion_rate}%\n`;
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `analytics_summary_${this.state.dateRange}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Sparkline SVG Generators
    getSparklinePath(points, width = 180, height = 36) {
        if (!points || !points.length) {
            points = [10, 14, 12, 18, 15, 22, 18];
        }
        const min = Math.min(...points);
        const max = Math.max(...points);
        const range = (max - min) || 1;
        const coords = points.map((val, idx) => {
            const x = (idx / (points.length - 1)) * width;
            const y = height - 5 - ((val - min) / range) * (height - 12);
            return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
        });

        let d = `M ${coords[0].x} ${coords[0].y}`;
        for (let i = 0; i < coords.length - 1; i++) {
            const p0 = coords[i];
            const p1 = coords[i + 1];
            const cpX = Math.round(((p0.x + p1.x) / 2) * 10) / 10;
            d += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
        }
        return d;
    }

    getSparklineFill(points, width = 180, height = 36) {
        const linePath = this.getSparklinePath(points, width, height);
        return `${linePath} L ${width} ${height} L 0 ${height} Z`;
    }

    // Chart Rendering
    renderAllCharts() {
        if (!window.Chart || !this.state.data) return;

        this.renderTasksOverTime();
        this.renderTasksByStatus();
        this.renderTasksByPriority();
        this.renderProductivityTrend();
    }

    renderTasksOverTime() {
        if (!this.tasksOverTimeRef.el) return;
        if (this.chartInstances.overTime) {
            this.chartInstances.overTime.destroy();
        }

        const ctx = this.tasksOverTimeRef.el.getContext('2d');
        const tot = this.state.data.tasks_over_time;

        const purpleGrad = ctx.createLinearGradient(0, 0, 0, 260);
        purpleGrad.addColorStop(0, 'rgba(139, 92, 246, 0.2)');
        purpleGrad.addColorStop(1, 'rgba(139, 92, 246, 0)');

        const greenGrad = ctx.createLinearGradient(0, 0, 0, 260);
        greenGrad.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
        greenGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');

        this.chartInstances.overTime = new window.Chart(ctx, {
            type: 'line',
            data: {
                labels: tot.labels,
                datasets: [
                    {
                        label: 'Created',
                        data: tot.created,
                        borderColor: '#8B5CF6',
                        backgroundColor: purpleGrad,
                        borderWidth: 2.2,
                        pointBackgroundColor: '#8B5CF6',
                        pointBorderColor: '#FFFFFF',
                        pointBorderWidth: 1.5,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.38,
                    },
                    {
                        label: 'Completed',
                        data: tot.completed,
                        borderColor: '#10B981',
                        backgroundColor: greenGrad,
                        borderWidth: 2.2,
                        pointBackgroundColor: '#10B981',
                        pointBorderColor: '#FFFFFF',
                        pointBorderWidth: 1.5,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.38,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1E293B',
                        titleFont: { size: 12, weight: '600' },
                        bodyFont: { size: 12 },
                        padding: 10,
                        cornerRadius: 6,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#F1F5F9', drawBorder: false },
                        ticks: { color: '#94A3B8', font: { size: 11 } }
                    },
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { color: '#94A3B8', font: { size: 11 } }
                    }
                }
            }
        });
    }

    renderTasksByStatus() {
        if (!this.tasksStatusRef.el) return;
        if (this.chartInstances.status) {
            this.chartInstances.status.destroy();
        }

        const ctx = this.tasksStatusRef.el.getContext('2d');
        const stData = this.state.data.tasks_by_status;
        const total = stData.total;

        this.chartInstances.status = new window.Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: stData.items.map(i => i.label),
                datasets: [{
                    data: stData.items.map(i => i.count),
                    backgroundColor: stData.items.map(i => i.color),
                    borderWidth: 0,
                    hoverOffset: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                onClick: (evt, elements) => {
                    if (elements && elements.length > 0) {
                        const index = elements[0].index;
                        const item = stData.items[index];
                        if (item) {
                            this.openTasks(item.label.toLowerCase().replace(' ', '_'));
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1E293B',
                        padding: 8,
                        cornerRadius: 6,
                    }
                }
            },
            plugins: [{
                id: 'centerTextStatus',
                beforeDraw(chart) {
                    const { width, height, ctx } = chart;
                    ctx.save();
                    ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = "#0F172A";
                    ctx.fillText(total.toString(), width / 2, height / 2 - 8);

                    ctx.font = "normal 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
                    ctx.fillStyle = "#64748B";
                    ctx.fillText("Total", width / 2, height / 2 + 12);
                    ctx.restore();
                }
            }]
        });
    }

    renderTasksByPriority() {
        if (!this.tasksPriorityRef.el) return;
        if (this.chartInstances.priority) {
            this.chartInstances.priority.destroy();
        }

        const ctx = this.tasksPriorityRef.el.getContext('2d');
        const pData = this.state.data.tasks_by_priority;
        const total = pData.total;

        this.chartInstances.priority = new window.Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: pData.items.map(i => i.label),
                datasets: [{
                    data: pData.items.map(i => i.count),
                    backgroundColor: pData.items.map(i => i.color),
                    borderWidth: 0,
                    hoverOffset: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                onClick: (evt, elements) => {
                    if (elements && elements.length > 0) {
                        const index = elements[0].index;
                        const item = pData.items[index];
                        if (item) {
                            this.openTasks(item.label.toLowerCase());
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1E293B',
                        padding: 8,
                        cornerRadius: 6,
                    }
                }
            },
            plugins: [{
                id: 'centerTextPriority',
                beforeDraw(chart) {
                    const { width, height, ctx } = chart;
                    ctx.save();
                    ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = "#0F172A";
                    ctx.fillText(total.toString(), width / 2, height / 2 - 8);

                    ctx.font = "normal 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
                    ctx.fillStyle = "#64748B";
                    ctx.fillText("Total", width / 2, height / 2 + 12);
                    ctx.restore();
                }
            }]
        });
    }

    renderProductivityTrend() {
        if (!this.productivityRef.el) return;
        if (this.chartInstances.productivity) {
            this.chartInstances.productivity.destroy();
        }

        const ctx = this.productivityRef.el.getContext('2d');
        const pt = this.state.data.productivity_trend;

        this.chartInstances.productivity = new window.Chart(ctx, {
            type: 'bar',
            data: {
                labels: pt.labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Tasks Completed',
                        data: pt.tasks_completed,
                        backgroundColor: '#C4B5FD',
                        borderRadius: 6,
                        barThickness: 28,
                        yAxisID: 'y',
                    },
                    {
                        type: 'line',
                        label: 'Completion Rate (%)',
                        data: pt.completion_rate,
                        borderColor: '#10B981',
                        borderWidth: 2.2,
                        pointBackgroundColor: '#10B981',
                        pointBorderColor: '#FFFFFF',
                        pointBorderWidth: 1.5,
                        pointRadius: 4.5,
                        pointHoverRadius: 6,
                        tension: 0.38,
                        yAxisID: 'y1',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1E293B',
                        titleFont: { size: 12, weight: '600' },
                        bodyFont: { size: 12 },
                        padding: 10,
                        cornerRadius: 6,
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        grid: { color: '#F1F5F9', drawBorder: false },
                        ticks: { color: '#94A3B8', font: { size: 11 } }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: 0,
                        max: 100,
                        grid: { drawOnChartArea: false, drawBorder: false },
                        ticks: {
                            color: '#94A3B8',
                            font: { size: 11 },
                            callback: (val) => val + '%'
                        }
                    },
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { color: '#94A3B8', font: { size: 11 } }
                    }
                }
            }
        });
    }
}

CustomeAnalyticsDashboard.template = "custome_analytics.Dashboard";

registry.category("actions").add("custome_analytics_dashboard_action", CustomeAnalyticsDashboard);
