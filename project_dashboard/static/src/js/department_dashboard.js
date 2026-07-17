/** @odoo-module **/
/**
 * Department Dashboard — OWL Component (Odoo 18)
 *
 * Displays a live overview of all visible departments and tasks:
 */

import { Component, useState, onWillStart, xml, useEffect, useRef } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { rpc } from "@web/core/network/rpc";
import { loadBundle } from "@web/core/assets";
import { useService } from "@web/core/utils/hooks";

// ─── Department Dashboard Component ───────────────────────────────────────────
export class DepartmentDashboard extends Component {

    static template = xml/* xml */`
<div class="pd-wrap">

    <!-- ══ Header ══════════════════════════════════════════════════════════ -->
    <div class="pd-header">
        <div class="pd-header-left">
            <div>
                <h1 class="pd-title">Department Dashboard</h1>
                <p class="pd-subtitle">Live overview of departments, projects &amp; tasks</p>
            </div>
        </div>
        <div class="pd-header-actions">
            <button class="pd-btn-primary" t-on-click="createNewProject">+ New Project</button>

            <button class="pd-btn-outline">Export</button>
            <button class="pd-btn-outline" t-on-click="loadData" t-att-disabled="state.loading" style="padding: 8px 12px;">
                <t t-if="state.loading">⏳</t>
                <t t-else="">🔄</t>
            </button>
        </div>
    </div>

    <!-- ══ Filter Bar ═══════════════════════════════════════════════════════ -->
    <div class="pd-filter-bar">
        <div class="pd-filter-group">
            <label>Date Range</label>
            <div style="display:flex; gap:8px;">
                <input type="date" t-model="state.filters.start_date" class="pd-filter-input" />
                <input type="date" t-model="state.filters.end_date" class="pd-filter-input" />
            </div>
        </div>
        <div class="pd-filter-group" style="flex:1;">
            <label>Department</label>
            <select t-model="state.filters.department_id" class="pd-filter-input">
                <option value="">All Departments</option>
                <t t-foreach="state.filter_data.departments" t-as="d" t-key="d.id">
                    <option t-att-value="d.id" t-esc="d.name" />
                </t>
            </select>
        </div>
        <div class="pd-filter-group" style="flex:1;">
            <label>Employee</label>
            <select t-model="state.filters.employee_id" class="pd-filter-input">
                <option value="">All Employees</option>
                <t t-foreach="state.filter_data.employees" t-as="e" t-key="e.id">
                    <option t-att-value="e.id" t-esc="e.name" />
                </t>
            </select>
        </div>
        <div class="pd-filter-actions">
            <button class="pd-btn-apply" t-on-click="loadData">Apply</button>
            <button class="pd-btn-reset" t-on-click="resetFilters">↺ Reset</button>
        </div>
    </div>

    <!-- ══ Skeleton ═════════════════════════════════════════════════════════ -->
    <t t-if="state.loading">
        <div class="pd-skeleton-grid">
            <t t-foreach="[1,2,3,4,5,6]" t-as="s" t-key="s"><div class="pd-skel-card"/></t>
        </div>
        <div class="pd-skel-table"/>
    </t>

    <!-- ══ Content ══════════════════════════════════════════════════════════ -->
    <t t-else="">

        <!-- Top 6 Cards -->
        <div class="pd-cards">
            <div class="pd-card" t-on-click="openDepartmentsList" style="cursor: pointer;">
                <div class="pd-card-inner">
                    <div class="pd-card-icon-wrap" style="background-color: #805ad5; color: white;"><i class="fa fa-sitemap"/></div>
                    <div class="pd-card-info">
                        <span class="pd-card-lbl">Departments</span>
                        <span class="pd-card-num" t-esc="state.data.departments.total"/>
                        <span t-attf-class="pd-card-trend {{ state.data.departments.trend.dir }}">
                            <t t-if="state.data.departments.trend.dir == 'up'">▲ </t>
                            <t t-else="">▼ </t>
                            <t t-esc="state.data.departments.trend.lbl"/>
                        </span>
                    </div>
                </div>
            </div>
            <div class="pd-card" t-on-click="openProjectsList" style="cursor: pointer;">
                <div class="pd-card-inner">
                    <div class="pd-card-icon-wrap" style="background-color: #4e73df; color: white;"><i class="fa fa-folder"/></div>
                    <div class="pd-card-info">
                        <span class="pd-card-lbl">Projects</span>
                        <span class="pd-card-num" t-esc="state.data.projects.total"/>
                        <span t-attf-class="pd-card-trend {{ state.data.projects.trend.dir }}">
                            <t t-if="state.data.projects.trend.dir == 'up'">▲ </t>
                            <t t-else="">▼ </t>
                            <t t-esc="state.data.projects.trend.lbl"/>
                        </span>
                    </div>
                </div>
            </div>
            <div class="pd-card" t-on-click="openTasksList" style="cursor: pointer;">
                <div class="pd-card-inner">
                    <div class="pd-card-icon-wrap" style="background-color: #1cc88a; color: white;"><i class="fa fa-clipboard"/></div>
                    <div class="pd-card-info">
                        <span class="pd-card-lbl">Tasks</span>
                        <span class="pd-card-num" t-esc="state.data.tasks.total"/>
                        <span t-attf-class="pd-card-trend {{ state.data.tasks.trend.dir }}">
                            <t t-if="state.data.tasks.trend.dir == 'up'">▲ </t>
                            <t t-else="">▼ </t>
                            <t t-esc="state.data.tasks.trend.lbl"/>
                        </span>
                    </div>
                </div>
            </div>
            <div class="pd-card" t-on-click="openCompletedTasksList" style="cursor: pointer;">
                <div class="pd-card-inner">
                    <div class="pd-card-icon-wrap" style="background-color: #38a169; color: white;"><i class="fa fa-check-circle"/></div>
                    <div class="pd-card-info">
                        <span class="pd-card-lbl">Completed</span>
                        <span class="pd-card-num" t-esc="state.data.tasks.completed"/>
                        <span class="pd-card-trend up" style="color:#38a169;"><t t-esc="state.data.tasks.completed_percent"/>% of total tasks</span>
                    </div>
                </div>
            </div>
            <div class="pd-card" t-on-click="openInProgressTasksList" style="cursor: pointer;">
                <div class="pd-card-inner">
                    <div class="pd-card-icon-wrap" style="background-color: #ed8936; color: white;"><i class="fa fa-clock-o"/></div>
                    <div class="pd-card-info">
                        <span class="pd-card-lbl">In Progress</span>
                        <span class="pd-card-num" t-esc="state.data.tasks.in_progress"/>
                        <span class="pd-card-trend" style="color:#ed8936;"><t t-esc="state.data.tasks.in_progress_percent"/>% of total tasks</span>
                    </div>
                </div>
            </div>
            <div class="pd-card">
                <div class="pd-card-inner">
                    <div class="pd-card-icon-wrap" style="background-color: #3182ce; color: white;"><i class="fa fa-pie-chart"/></div>
                    <div class="pd-card-info">
                        <span class="pd-card-lbl">Completion Rate</span>
                        <span class="pd-card-num" t-esc="state.data.completion_rate.current + '%'"/>
                        <span t-attf-class="pd-card-trend {{ state.data.completion_rate.trend.dir }}">
                            <t t-if="state.data.completion_rate.trend.dir == 'up'">▲ </t>
                            <t t-else="">▼ </t>
                            <t t-esc="state.data.completion_rate.trend.lbl"/>
                        </span>
                    </div>
                </div>
            </div>

        </div>

        <!-- Middle 3 Columns -->
        <div class="pd-grid-3">
            <div class="pd-chart-card">
                <div class="pd-chart-header">
                    <span>Department Performance</span>
                    <select t-model="state.filters.dept_sort" t-on-change="loadData" style="font-size: 11px; font-weight: bold; color: #4a5568; border: 1px solid #e2e8f0; padding: 2px 8px; border-radius: 4px; background: transparent; cursor: pointer; outline: none; width: auto;">
                        <option value="completion">By Completion %</option>
                        <option value="tasks_done">By Tasks Done</option>
                    </select>
                </div>
                <div class="pd-chart-body">
                    <canvas t-ref="deptPerfChart"/>
                </div>
            </div>
            <div class="pd-chart-card">
                <div class="pd-chart-header">
                    <span>Employee Leaderboard</span>
                    <span style="font-size: 11px; font-weight: bold; color: #4a5568; border: 1px solid #e2e8f0; padding: 2px 8px; border-radius: 4px;">By Tasks Done</span>
                </div>
                <div class="pd-chart-body" style="overflow-y: auto;">
                    <t t-foreach="state.data.charts.employee_leaderboard" t-as="emp" t-key="emp.name">
                        <div class="pd-lb-item" t-on-click="() => this.openEmployeeCompletedTasks(emp.id, emp.name)" style="cursor: pointer;">
                            <span class="pd-lb-rank" t-esc="emp_index + 1"/>
                            <img t-att-src="emp.avatar" class="pd-lb-avatar" />
                            <span class="pd-lb-name" t-esc="emp.name"/>
                            <div class="pd-lb-bar-wrap">
                                <div class="pd-lb-bar" t-att-style="'width: ' + (emp.done / emp.max * 100) + '%'"/>
                            </div>
                            <span class="pd-lb-val" t-esc="emp.done"/>
                        </div>
                    </t>
                </div>
            </div>
            <div class="pd-chart-card">
                <div class="pd-chart-header">
                    <span>Recent Activity</span>

                </div>
                <div class="pd-chart-body" style="overflow-y: auto; max-height: 280px;">
                    <div class="pd-list">
                        <t t-foreach="state.data.recent_activity" t-as="act" t-key="act_index">
                            <div class="pd-list-item" style="cursor: pointer;" t-on-click="() => this.openRecord(act.res_model, act.res_id)">
                                <div class="pd-list-icon" t-att-style="'color: ' + act.color + '; background: ' + act.color + '1A;'"><t t-esc="act.icon"/></div>
                                <div class="pd-list-text">
                                    <div class="pd-list-title" t-esc="act.title"/>
                                    <div class="pd-list-subtitle" t-esc="act.subtitle"/>
                                </div>
                                <div class="pd-list-time" t-esc="act.time"/>
                            </div>
                        </t>
                    </div>
                </div>
            </div>
        </div>

        <!-- Bottom 4 Columns -->
        <div class="pd-grid-4">
            <div class="pd-chart-card">
                <div class="pd-chart-header">
                    <span style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #6f42c1;"></span>
                        Department Task Analysis
                    </span>
                </div>
                <div class="pd-chart-body" style="display: flex; flex-direction: column; height: 100%; padding-top: 0px;">
                    <div id="dept-custom-legend" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 10px 20px 0; margin-bottom: 8px;"></div>
                    <div style="position: relative; flex: 1; width: 100%; min-height: 190px; padding: 0px 40px 10px 40px;">
                        <canvas t-ref="departmentTaskAnalysisChart"/>
                    </div>
                </div>
            </div>
            <div class="pd-chart-card" style="grid-column: span 2;">
                <div class="pd-chart-header">
                    <span>Monthly Task Trend</span>
                    <select t-model="state.filters.trend_period" t-on-change="loadData" style="font-size: 11px; font-weight: bold; color: #4a5568; border: 1px solid #e2e8f0; padding: 2px 8px; border-radius: 4px; background: transparent; cursor: pointer; outline: none; width: auto; min-width: 100px;">
                        <option value="this_year">This Year</option>
                        <option value="last_year">Last Year</option>
                        <option value="6_months">Last 6 Months</option>
                    </select>
                </div>
                <div class="pd-chart-body"><canvas t-ref="monthlyTrendChart"/></div>
            </div>
            <div class="pd-chart-card">
                <div class="pd-chart-header">
                    <span>💡 Insights</span>
                </div>
                <div class="pd-chart-body" style="overflow-y: auto;">
                    <div class="pd-list">
                        <t t-foreach="state.data.insights" t-as="ins" t-key="ins.text">
                            <div class="pd-list-item">
                                <div class="pd-list-icon" t-att-style="'color: ' + ins.color + '; border: 1px solid ' + ins.color + '33;'"><t t-esc="ins.icon"/></div>
                                <div class="pd-list-text" t-esc="ins.text"/>
                            </div>
                        </t>
                    </div>
                </div>
            </div>
        </div>

        <!-- Department Overview Table -->
        <div class="pd-table-box" style="margin-top: 8px;">
            <table class="pd-table">
                <thead>
                    <tr>
                        <th>Department Overview</th>
                        <th>Manager</th>
                        <th class="pd-tc">Projects</th>
                        <th class="pd-tc">Tasks</th>
                        <th class="pd-tc">Completed</th>
                        <th class="pd-tc">In Progress</th>
                        <th class="pd-tc">Blocked</th>
                        <th class="pd-tp">Completion %</th>
                        <th class="pd-tc">Action</th>
                    </tr>
                </thead>
                <tbody>
                    <t t-if="state.data.department_list.length === 0">
                        <tr>
                            <td colspan="9" class="pd-empty">
                                <span>📂</span>
                                <p>No departments found</p>
                            </td>
                        </tr>
                    </t>
                    <t t-foreach="state.data.department_list" t-as="dept" t-key="dept.id">
                        <tr class="pd-row">
                            <td class="pd-td-name" t-esc="dept.name"/>
                            <td class="pd-td-sec">
                                <t t-if="dept.manager !== '—'"><i class="fa fa-user-circle" style="margin-right: 6px; color: #a0aec0;"/> <t t-esc="dept.manager"/></t>
                                <t t-else="">—</t>
                            </td>
                            <td class="pd-tc pd-n-tot" t-esc="dept.projects"/>
                            <td class="pd-tc pd-n-tot" t-esc="dept.tasks"/>
                            <td class="pd-tc pd-n-done" t-esc="dept.completed"/>
                            <td class="pd-tc pd-n-prog" t-esc="dept.in_progress"/>
                            <td class="pd-tc pd-n-blk" t-esc="dept.blocked"/>
                            <td class="pd-tp">
                                <div class="pd-prog-wrap">
                                    <span class="pd-prog-pct" style="text-align:left;" t-esc="dept.progress + '%'"/>
                                    <div class="pd-prog-track">
                                        <div class="pd-prog-fill" t-att-style="'width:' + dept.progress + '%; background: ' + (dept.progress > 50 ? '#38a169' : '#e53e3e')"/>
                                    </div>
                                </div>
                            </td>
                            <td class="pd-tc">
                                <button class="pd-btn-outline" style="padding: 4px 8px; font-size: 11px;" t-on-click="() => this.toggleDepartment(dept.id)">
                                    <t t-if="state.expanded_depts[dept.id]">Hide ▲</t>
                                    <t t-else="">View ▼</t>
                                </button>
                            </td>
                        </tr>
                        <tr t-if="state.expanded_depts[dept.id]">
                            <td colspan="9" style="padding: 0; background-color: #f7fafc; border-bottom: 1px solid #e2e8f0;">
                                <table class="pd-table" style="margin: 0; box-shadow: none; border-radius: 0;">
                                    <tbody>
                                        <t t-if="dept.project_list and dept.project_list.length > 0">
                                            <t t-foreach="dept.project_list" t-as="proj" t-key="proj.id">
                                                <tr class="pd-row" style="background: transparent;">
                                                    <td class="pd-td-name" style="padding-left: 40px; cursor: pointer;" t-on-click="() => this.openProject(proj.id)">
                                                        ↳ <b t-esc="proj.name" style="color: #4a5568; font-weight: normal;"/>
                                                    </td>
                                                    <td class="pd-td-sec" t-esc="proj.manager"/>
                                                    <td class="pd-tc pd-n-tot">—</td>
                                                    <td class="pd-tc pd-n-tot" t-esc="proj.tasks"/>
                                                    <td class="pd-tc pd-n-done" t-esc="proj.completed"/>
                                                    <td class="pd-tc pd-n-prog" t-esc="proj.in_progress"/>
                                                    <td class="pd-tc pd-n-blk" t-esc="proj.blocked"/>
                                                    <td class="pd-tp">
                                                        <div class="pd-prog-wrap">
                                                            <span class="pd-prog-pct" style="text-align:left;" t-esc="proj.progress + '%'"/>
                                                            <div class="pd-prog-track">
                                                                <div class="pd-prog-fill" t-att-style="'width:' + proj.progress + '%; background: ' + (proj.progress > 50 ? '#38a169' : '#e53e3e')"/>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td class="pd-tc"></td>
                                                </tr>
                                            </t>
                                        </t>
                                        <t t-else="">
                                            <tr>
                                                <td colspan="9" class="pd-empty" style="padding: 10px;">
                                                    <p style="margin:0; color:#a0aec0;">No projects in this department.</p>
                                                </td>
                                            </tr>
                                        </t>
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                    </t>
                </tbody>
            </table>
            <div style="text-align: center; padding: 12px; border-top: 1px solid #e8edf2;">
                <a href="#" style="font-size: 12px; font-weight: 600; color: #4e73df; text-decoration: none;" t-on-click="viewAllDepartments">View All Departments ∨</a>
            </div>
        </div>

    </t>
</div>
    `;

    // ── Setup ─────────────────────────────────────────────────────────────────
    setup() {
        this.actionService = useService("action");
        this.deptPerfChartRef = useRef("deptPerfChart");
        this.departmentTaskAnalysisChartRef = useRef("departmentTaskAnalysisChart");
        this.monthlyTrendChartRef = useRef("monthlyTrendChart");
        this.charts = {};
        this.needsChartRender = false;

        const actionContext = this.props.action && this.props.action.context ? this.props.action.context : {};
        const defaultDeptId = actionContext.default_department_id || '';

        this.state = useState({
            loading: true,
            filter_data: { departments: [], employees: [] },
            filters: {
                start_date: '',
                end_date: '',
                department_id: defaultDeptId,
                employee_id: '',
                trend_period: 'this_year',
                dept_sort: 'completion'
            },
            expanded_depts: {},
            data: {
                projects: { total: 0, trend: 0 },
                tasks: { total: 0, trend: 0, completed: 0, completed_percent: 0, in_progress: 0, in_progress_percent: 0 },
                completion_rate: { current: 0, trend: 0 },
                employees: { total: 0, trend: 0 },
                department_list: [],
                insights: [],
                recent_activity: [],
                charts: {}
            },
        });

        onWillStart(async () => {
            await loadBundle("web.chartjs_lib");
            await this.loadData();
        });

        useEffect(() => {
            if (!this.state.loading && this.state.data.charts && this.needsChartRender) {
                this.renderCharts();
                this.needsChartRender = false;
            }
        });
    }

    createNewProject() {
        this.actionService.doAction({
            type: 'ir.actions.act_window',
            res_model: 'project.project',
            views: [[false, 'form']],
            target: 'current',
        });
    }

    createNewTask() {
        this.actionService.doAction({
            type: 'ir.actions.act_window',
            res_model: 'project.task',
            views: [[false, 'form']],
            target: 'current',
        });
    }

    viewAllDepartments(ev) {
        ev.preventDefault();
        this.actionService.doAction({
            type: 'ir.actions.act_window',
            res_model: 'hr.department',
            views: [[false, 'list'], [false, 'form']],
            target: 'current',
        });
    }

    toggleDepartment(departmentId) {
        this.state.expanded_depts[departmentId] = !this.state.expanded_depts[departmentId];
    }

    openProject(projectId) {
        this.actionService.doAction({
            type: 'ir.actions.act_window',
            res_model: 'project.project',
            res_id: projectId,
            views: [[false, 'form']],
            target: 'current',
        });
    }

    openProject(projectId) {
        this.actionService.doAction({
            type: 'ir.actions.act_window',
            res_model: 'project.project',
            res_id: projectId,
            views: [[false, 'form']],
            target: 'current',
        });
    }

    openDepartmentsList() {
        this.actionService.doAction({
            name: "Departments",
            type: "ir.actions.act_window",
            res_model: "hr.department",
            views: [[false, "kanban"], [false, "list"], [false, "form"]],
            target: "current",
        });
    }

    openProjectsList() {
        this.actionService.doAction({
            name: "Projects",
            type: "ir.actions.act_window",
            res_model: "project.project",
            views: [[false, "kanban"], [false, "list"], [false, "form"]],
            target: "current",
        });
    }

    openTasksList() {
        this.actionService.doAction({
            name: "Tasks",
            type: "ir.actions.act_window",
            res_model: "project.task",
            views: [[false, "kanban"], [false, "list"], [false, "form"]],
            target: "current",
        });
    }

    openCompletedTasksList() {
        this.actionService.doAction({
            name: "Completed Tasks",
            type: "ir.actions.act_window",
            res_model: "project.task",
            domain: [['state', '=', '1_done']], // Replace with your exact state for Completed
            views: [[false, "kanban"], [false, "list"], [false, "form"]],
            target: "current",
        });
    }

    openInProgressTasksList() {
        this.actionService.doAction({
            name: "In Progress Tasks",
            type: "ir.actions.act_window",
            res_model: "project.task",
            domain: [['state', '!=', '1_done'], ['state', '!=', '1_canceled']], // Replace with exact state
            views: [[false, "kanban"], [false, "list"], [false, "form"]],
            target: "current",
        });
    }

    openEmployeeCompletedTasks(employeeId, employeeName) {
        this.actionService.doAction({
            name: `Completed Tasks - ${employeeName}`,
            type: "ir.actions.act_window",
            res_model: "project.task",
            domain: [['state', '=', '1_done'], ['user_ids', 'in', [employeeId]]],
            views: [[false, "kanban"], [false, "list"], [false, "form"]],
            target: "current",
        });
    }

    renderCharts() {
        if (!window.Chart) return;
        const chartData = this.state.data.charts;

        // 1. Department Performance (Horizontal Bar)
        if (this.deptPerfChartRef.el) {
            if (this.charts.deptPerf) this.charts.deptPerf.destroy();
            const ctx = this.deptPerfChartRef.el.getContext('2d');
            this.charts.deptPerf = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: chartData.department_performance.labels,
                    datasets: [{
                        label: chartData.department_performance.label || 'Completion %',
                        data: chartData.department_performance.data,
                        backgroundColor: ['#4e73df', '#e74a3b', '#f6c23e', '#1cc88a', '#36b9cc', '#858796', '#6f42c1', '#fd7e14'],
                        borderWidth: 0,
                        barThickness: 12
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true, maintainAspectRatio: false,
                    legend: { display: false },
                    scales: {
                        xAxes: [{ ticks: { beginAtZero: true, max: 100 }, gridLines: { display: false } }],
                        yAxes: [{ gridLines: { display: false } }],
                        x: { min: 0, max: 100, grid: { display: false } },
                        y: { grid: { display: false } }
                    }
                }
            });
        }

        // 2. Department Task Analysis (Donut)
        if (this.departmentTaskAnalysisChartRef.el) {
            if (this.charts.departmentTaskAnalysis) this.charts.departmentTaskAnalysis.destroy();
            const ctx = this.departmentTaskAnalysisChartRef.el.getContext('2d');
            this.charts.departmentTaskAnalysis = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: chartData.department_task_analysis.labels,
                    datasets: [{
                        data: chartData.department_task_analysis.data,
                        backgroundColor: [
                            '#6f42c1', '#e74a3b', '#1cc88a', '#3182ce',
                            '#d69e2e', '#d53f8c', '#319795', '#e2e8f0'
                        ],
                        borderWidth: 2, borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    legend: { display: false },
                    cutoutPercentage: 45,
                    tooltips: {
                        callbacks: {
                            label: function (tooltipItem, data) {
                                var label = data.labels[tooltipItem.index] || '';
                                if (label) {
                                    label += '\n';
                                }
                                label += data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                                return label;
                            }
                        }
                    }
                },
                plugins: [{
                    id: 'custom_legend',
                    afterUpdate: (chart) => {
                        const legendContainer = chart.canvas.parentElement.parentElement.parentElement.querySelector('#dept-custom-legend');
                        if (!legendContainer) return;
                        let html = '';
                        chart.data.labels.forEach((label, i) => {
                            const bgColor = chart.data.datasets[0].backgroundColor[i];
                            html += `<div style="display: flex; align-items: center; gap: 4px; font-size: 9.5px; color: #6c757d; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;" title="${label}">
                                        <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${bgColor}; flex-shrink: 0;"></span>
                                        <span style="overflow: hidden; text-overflow: ellipsis;">${label}</span>
                                     </div>`;
                        });
                        legendContainer.innerHTML = html;
                    }
                }]
            });
        }

        // 4. Monthly Task Trend (Line)
        if (this.monthlyTrendChartRef.el) {
            if (this.charts.monthlyTrend) this.charts.monthlyTrend.destroy();
            const ctx = this.monthlyTrendChartRef.el.getContext('2d');
            this.charts.monthlyTrend = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartData.monthly_trend.labels,
                    datasets: [
                        {
                            label: 'Created',
                            data: chartData.monthly_trend.created,
                            borderColor: '#3182ce',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            pointRadius: 3
                        },
                        {
                            label: 'Completed',
                            data: chartData.monthly_trend.completed,
                            borderColor: '#38a169',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            pointRadius: 3
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    legend: { position: 'top', labels: { boxWidth: 12, fontSize: 11, fontColor: '#4a5568' } },
                    scales: {
                        yAxes: [{ ticks: { beginAtZero: true } }],
                        xAxes: [{ gridLines: { display: false } }]
                    }
                }
            });
        }
    }

    resetFilters() {
        this.state.filters = { start_date: '', end_date: '', department_id: '', employee_id: '', trend_period: 'this_year', dept_sort: 'completion' };
        this.loadData();
    }

    openRecord(resModel, resId) {
        if (!resModel || !resId) return;
        this.actionService.doAction({
            type: "ir.actions.act_window",
            res_model: resModel,
            res_id: resId,
            views: [[false, "form"]],
            target: "current",
        });
    }

    // ── Data fetch ─────────────────────────────────────────────────────────────
    async loadData() {
        this.state.loading = true;
        try {
            const data = await rpc("/department_dashboard/data", this.state.filters);
            this.state.data = data;
            this.needsChartRender = true;
            if (data.filters) {
                this.state.filter_data = data.filters;
            }
            if (data.department_list && data.department_list.length > 0 && Object.keys(this.state.expanded_depts).length === 0) {
                this.state.expanded_depts[data.department_list[0].id] = true;
            }
        } catch (err) {
            console.error('[DepartmentDashboard] Fetch failed:', err);
        } finally {
            this.state.loading = false;
        }
    }
}

// Register the component as an Odoo client-action
registry.category("actions").add("department_dashboard_action", DepartmentDashboard);
