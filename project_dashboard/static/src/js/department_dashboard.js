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
            <span class="pd-header-icon">🏢</span>
            <div>
                <h1 class="pd-title">Department Dashboard</h1>
                <p class="pd-subtitle">Live overview · departments &amp; tasks</p>
            </div>
        </div>
        <button class="pd-btn-refresh" t-on-click="loadData" t-att-disabled="state.loading">
            <t t-if="state.loading">⏳ Loading…</t>
            <t t-else="">🔄 Refresh</t>
        </button>
    </div>

    <!-- ══ Filter Bar ═══════════════════════════════════════════════════════ -->
    <div class="pd-filter-bar">
        <div class="pd-filter-group">
            <label>Start Date</label>
            <input type="date" t-model="state.filters.start_date" t-on-change="loadData" class="pd-filter-input" />
        </div>
        <div class="pd-filter-group">
            <label>End Date</label>
            <input type="date" t-model="state.filters.end_date" t-on-change="loadData" class="pd-filter-input" />
        </div>
        <div class="pd-filter-group" style="flex:1;">
            <label>Department</label>
            <select t-model="state.filters.department_id" t-on-change="loadData" class="pd-filter-input">
                <option value="">All Departments</option>
                <t t-foreach="state.filter_data.departments" t-as="d" t-key="d.id">
                    <option t-att-value="d.id" t-esc="d.name" />
                </t>
            </select>
        </div>
        <div class="pd-filter-group" style="flex:1;">
            <label>Employees</label>
            <select t-model="state.filters.employee_id" t-on-change="loadData" class="pd-filter-input">
                <option value="">All Employees</option>
                <t t-foreach="state.filter_data.employees" t-as="e" t-key="e.id">
                    <option t-att-value="e.id" t-esc="e.name" />
                </t>
            </select>
        </div>
        <div class="pd-filter-actions">
            <button class="pd-btn-reset" t-on-click="resetFilters">↺ Reset</button>
        </div>
    </div>

    <!-- ══ Skeleton ═════════════════════════════════════════════════════════ -->
    <t t-if="state.loading">
        <div class="pd-skeleton-grid">
            <t t-foreach="[1,2,3,4]" t-as="s" t-key="s"><div class="pd-skel-card"/></t>
        </div>
        <div class="pd-skel-table"/>
    </t>

    <!-- ══ Content ══════════════════════════════════════════════════════════ -->
    <t t-else="">

        <!-- Department & Project Stats -->
        <div class="pd-section-label">
            <span class="pd-dot" style="background:#63b3ed;box-shadow:0 0 8px #63b3ed"/>
            Departments &amp; Projects
        </div>
        <div class="pd-cards">
            <div class="pd-card" style="--accent:#63b3ed">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">🏢</span>
                    <span class="pd-card-num" t-esc="state.data.departments.total"/>
                </div>
                <div class="pd-card-lbl">Total Departments</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(99,179,237,.18),transparent 70%)"/>
            </div>
            <div class="pd-card" style="--accent:#ed8936">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">🏗️</span>
                    <span class="pd-card-num" t-esc="state.data.projects.total"/>
                </div>
                <div class="pd-card-lbl">Total Projects</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(237,137,54,.18),transparent 70%)"/>
            </div>
            <div class="pd-card" style="--accent:#48bb78">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">✅</span>
                    <span class="pd-card-num" t-esc="state.data.projects.completed"/>
                </div>
                <div class="pd-card-lbl">Completed</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(72,187,120,.18),transparent 70%)"/>
            </div>
            <div class="pd-card" style="--accent:#4299e1">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">🔄</span>
                    <span class="pd-card-num" t-esc="state.data.projects.in_progress"/>
                </div>
                <div class="pd-card-lbl">In Progress</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(66,153,225,.18),transparent 70%)"/>
            </div>
        </div>

        <!-- Main Task Cards -->
        <div class="pd-section-label">
            <span class="pd-dot" style="background:#b794f4;box-shadow:0 0 8px #b794f4"/>
            Main Tasks
        </div>
        <div class="pd-cards">
            <div class="pd-card" style="--accent:#b794f4">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">📋</span>
                    <span class="pd-card-num" t-esc="state.data.tasks.main"/>
                </div>
                <div class="pd-card-lbl">Total Main Tasks</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(183,148,244,.18),transparent 70%)"/>
            </div>
            <div class="pd-card" style="--accent:#68d391">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">✅</span>
                    <span class="pd-card-num" t-esc="state.data.tasks.main_done"/>
                </div>
                <div class="pd-card-lbl">Done</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(104,211,145,.18),transparent 70%)"/>
            </div>
            <div class="pd-card" style="--accent:#7f9cf5">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">⚙️</span>
                    <span class="pd-card-num" t-esc="state.data.tasks.main_in_progress"/>
                </div>
                <div class="pd-card-lbl">In Progress</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(127,156,245,.18),transparent 70%)"/>
            </div>
            <div class="pd-card" style="--accent:#fc8181">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">⚠️</span>
                    <span class="pd-card-num" t-esc="state.data.tasks.main_blocked"/>
                </div>
                <div class="pd-card-lbl">Blocked</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(252,129,129,.18),transparent 70%)"/>
            </div>
        </div>

        <!-- Sub Task Cards -->
        <div class="pd-section-label" style="margin-top: 1.5rem;">
            <span class="pd-dot" style="background:#ed8936;box-shadow:0 0 8px #ed8936"/>
            Sub Tasks
        </div>
        <div class="pd-cards">
            <div class="pd-card" style="--accent:#ed8936">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">📄</span>
                    <span class="pd-card-num" t-esc="state.data.tasks.sub"/>
                </div>
                <div class="pd-card-lbl">Total Sub Tasks</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(237,137,54,.18),transparent 70%)"/>
            </div>
            <div class="pd-card" style="--accent:#48bb78">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">✅</span>
                    <span class="pd-card-num" t-esc="state.data.tasks.sub_done"/>
                </div>
                <div class="pd-card-lbl">Done</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(72,187,120,.18),transparent 70%)"/>
            </div>
            <div class="pd-card" style="--accent:#4299e1">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">⚙️</span>
                    <span class="pd-card-num" t-esc="state.data.tasks.sub_in_progress"/>
                </div>
                <div class="pd-card-lbl">In Progress</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(66,153,225,.18),transparent 70%)"/>
            </div>
            <div class="pd-card" style="--accent:#fc8181">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">⚠️</span>
                    <span class="pd-card-num" t-esc="state.data.tasks.sub_blocked"/>
                </div>
                <div class="pd-card-lbl">Blocked</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(252,129,129,.18),transparent 70%)"/>
            </div>
        </div>

        <!-- ══ Charts ══════════════════════════════════════════════════════════ -->
        <div class="pd-charts-grid">
            <div class="pd-chart-card">
                <div class="pd-chart-header">
                    <span class="pd-dot" style="background:#805ad5;box-shadow:0 0 8px #805ad5"/>
                    Department Task Analysis
                </div>
                <div class="pd-chart-body">
                    <canvas t-ref="departmentChart"/>
                </div>
            </div>
            <div class="pd-chart-card">
                <div class="pd-chart-header">
                    <span class="pd-dot" style="background:#dd6b20;box-shadow:0 0 8px #dd6b20"/>
                    Top Employees
                </div>
                <div class="pd-chart-body">
                    <canvas t-ref="employeeChart"/>
                </div>
            </div>
        </div>

        <!-- Department Overview Table -->
        <div class="pd-section-label">
            <span class="pd-dot" style="background:#4fd1c5;box-shadow:0 0 8px #4fd1c5"/>
            Department Overview
        </div>
        <div class="pd-table-box">
            <table class="pd-table">
                <thead>
                    <tr>
                        <th>Department</th>
                        <th>Manager</th>
                        <th class="pd-tc">Main Tasks</th>
                        <th class="pd-tc">Sub Tasks</th>
                        <th class="pd-tc">Task Done</th>
                        <th class="pd-tc">Sub Task Done</th>
                        <th class="pd-tc">Task In Progress</th>
                        <th class="pd-tc">Sub Task In Progress</th>
                        <th class="pd-tp">Progress</th>
                    </tr>
                </thead>
                <tbody>
                    <t t-if="state.data.department_list.length === 0">
                        <tr>
                            <td colspan="10" class="pd-empty">
                                <span>📂</span>
                                <p>No departments found</p>
                            </td>
                        </tr>
                    </t>
                    <t t-foreach="state.data.department_list" t-as="dept" t-key="dept.id">
                        <tr class="pd-row">
                            <td class="pd-td-name" t-on-click="() => this.toggleDepartment(dept.id)" style="cursor: pointer;" title="Toggle Projects">
                                <span class="pd-proj-dot"/>
                                <b t-esc="dept.name" style="color: #3182ce;"/>
                                <span style="font-size: 10px; margin-left: 5px;">
                                    <t t-if="state.expanded_depts[dept.id]">▼</t>
                                    <t t-else="">▶</t>
                                </span>
                            </td>
                            <td class="pd-td-sec" t-esc="dept.manager || '—'"/>
                            <td class="pd-tc pd-n-main" t-esc="dept.tasks_main"/>
                            <td class="pd-tc pd-n-sub" t-esc="dept.tasks_sub"/>
                            <td class="pd-tc pd-n-done" t-esc="dept.tasks_main_done"/>
                            <td class="pd-tc pd-n-done" t-esc="dept.tasks_sub_done"/>
                            <td class="pd-tc pd-n-prog" t-esc="dept.tasks_main_in_progress"/>
                            <td class="pd-tc pd-n-prog" t-esc="dept.tasks_sub_in_progress"/>
                            <td class="pd-tp">
                                <div class="pd-prog-wrap">
                                    <div class="pd-prog-track">
                                        <div class="pd-prog-fill"
                                             t-att-style="'width:' + dept.progress + '%'"/>
                                    </div>
                                    <span class="pd-prog-pct" t-esc="dept.progress + '%'"/>
                                </div>
                            </td>
                        </tr>
                        <tr t-if="state.expanded_depts[dept.id]">
                            <td colspan="9" style="padding: 0; background-color: #f7fafc; border-bottom: 1px solid #e2e8f0;">
                                <table class="pd-table" style="margin: 0; box-shadow: none; border-radius: 0;">
                                    <tbody>
                                        <t t-if="dept.projects and dept.projects.length > 0">
                                            <t t-foreach="dept.projects" t-as="proj" t-key="proj.id">
                                                <tr class="pd-row" style="background: transparent;">
                                                    <td class="pd-td-name" style="padding-left: 40px; cursor: pointer;" t-on-click="() => this.openProject(proj.id)">
                                                        ↳ <b t-esc="proj.name" style="color: #4a5568; font-weight: normal;"/>
                                                    </td>
                                                    <td class="pd-td-sec" t-esc="proj.manager || '—'"/>
                                                    <td class="pd-tc pd-n-main" t-esc="proj.tasks_main"/>
                                                    <td class="pd-tc pd-n-sub" t-esc="proj.tasks_sub"/>
                                                    <td class="pd-tc pd-n-done" t-esc="proj.tasks_main_done"/>
                                                    <td class="pd-tc pd-n-done" t-esc="proj.tasks_sub_done"/>
                                                    <td class="pd-tc pd-n-prog" t-esc="proj.tasks_main_in_progress"/>
                                                    <td class="pd-tc pd-n-prog" t-esc="proj.tasks_sub_in_progress"/>
                                                    <td class="pd-tp">
                                                        <div class="pd-prog-wrap">
                                                            <div class="pd-prog-track">
                                                                <div class="pd-prog-fill"
                                                                     t-att-style="'width:' + proj.progress + '%'"/>
                                                            </div>
                                                            <span class="pd-prog-pct" t-esc="proj.progress + '%'"/>
                                                        </div>
                                                    </td>
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
        </div>

    </t>
</div>
    `;

    // ── Setup ─────────────────────────────────────────────────────────────────
    setup() {
        this.actionService = useService("action");
        this.departmentChartRef = useRef("departmentChart");
        this.employeeChartRef = useRef("employeeChart");
        this.charts = { department: null, employee: null };

        this.state = useState({
            loading: true,
            filter_data: { departments: [], employees: [] },
            filters: {
                start_date: '',
                end_date: '',
                department_id: '',
                employee_id: ''
            },
            expanded_depts: {},
            data: {
                projects: { total: 0, completed: 0, in_progress: 0 },
                departments: { total: 0 },
                tasks: { total: 0, done: 0, in_progress: 0, blocked: 0 },
                department_list: [],
            },
        });

        onWillStart(async () => {
            await loadBundle("web.chartjs_lib");
            await this.loadData();
        });

        useEffect(() => {
            if (!this.state.loading && this.state.data.charts) {
                this.renderCharts();
            }
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

    renderCharts() {
        if (!window.Chart) return;

        // 1. Department Donut Chart
        if (this.departmentChartRef.el) {
            if (this.charts.department) this.charts.department.destroy();
            const ctx = this.departmentChartRef.el.getContext('2d');
            const data = this.state.data.charts.department_analysis;

            this.charts.department = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: data.labels,
                    datasets: [{
                        data: data.data,
                        backgroundColor: ['#805ad5', '#e53e3e', '#38a169', '#3182ce', '#d69e2e', '#d53f8c', '#319795', '#e2e8f0', '#718096', '#2d3748'],
                        borderWidth: 2, borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'left' } },
                    legend: { position: 'left' } // For older Chart.js compatibility
                }
            });
        }

        // 2. Employee Bar Chart
        if (this.employeeChartRef.el) {
            if (this.charts.employee) this.charts.employee.destroy();
            const ctx = this.employeeChartRef.el.getContext('2d');
            const data = this.state.data.charts.employee_analysis;

            this.charts.employee = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: data.label_title,
                        data: data.data,
                        backgroundColor: ['#e53e3e', '#38a169', '#805ad5', '#d69e2e', '#dd6b20', '#d53f8c', '#319795', '#a0aec0', '#4a5568', '#1a202c']
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    legend: { display: false }, // For older Chart.js compatibility
                    scales: {
                        y: { beginAtZero: true },
                        yAxes: [{ ticks: { beginAtZero: true } }] // For older Chart.js compatibility
                    }
                }
            });
        }
    }

    resetFilters() {
        this.state.filters = { start_date: '', end_date: '', department_id: '', employee_id: '' };
        this.loadData();
    }

    // ── Data fetch ─────────────────────────────────────────────────────────────
    async loadData() {
        this.state.loading = true;
        try {
            const data = await rpc("/department_dashboard/data", this.state.filters);
            this.state.data = data;
            if (data.filters) {
                this.state.filter_data = data.filters;
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
