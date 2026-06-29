/** @odoo-module **/
/**
 * Project Dashboard — OWL Component (Odoo 18)
 *
 * Displays a live overview of all visible projects and tasks:
 *   Row 1 — Project stat cards  (Total / Completed / In Progress / On Hold)
 *   Row 2 — Task stat cards     (Total / Done / In Progress / Blocked)
 *   Table — Per-project detail  (progress bar + status badge per row)
 */

import { Component, useState, onWillStart, xml, useEffect, useRef } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { rpc } from "@web/core/network/rpc";
import { loadBundle } from "@web/core/assets";
import { useService } from "@web/core/utils/hooks";

// ─── Dashboard Component ──────────────────────────────────────────────────────
export class ProjectDashboard extends Component {

    static template = xml/* xml */`
<div class="pd-wrap">

    <!-- ══ Header ══════════════════════════════════════════════════════════ -->
    <div class="pd-header">
        <div class="pd-header-left">
            <span class="pd-header-icon">📊</span>
            <div>
                <h1 class="pd-title">Project Dashboard</h1>
                <p class="pd-subtitle">Live overview · projects &amp; tasks</p>
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
            <label>Project</label>
            <select t-model="state.filters.project_id" t-on-change="loadData" class="pd-filter-input">
                <option value="">All Projects</option>
                <t t-foreach="state.filter_data.projects" t-as="p" t-key="p.id">
                    <option t-att-value="p.id" t-esc="p.name" />
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
        <div class="pd-skeleton-grid">
            <t t-foreach="[1,2,3,4]" t-as="s" t-key="s"><div class="pd-skel-card"/></t>
        </div>
        <div class="pd-skel-table"/>
    </t>

    <!-- ══ Content ══════════════════════════════════════════════════════════ -->
    <t t-else="">

        <!-- Project Cards -->
        <div class="pd-section-label">
            <span class="pd-dot" style="background:#63b3ed;box-shadow:0 0 8px #63b3ed"/>
            Projects
        </div>
        <div class="pd-cards">
            <div class="pd-card" style="--accent:#63b3ed">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">🏗️</span>
                    <span class="pd-card-num" t-esc="state.data.projects.total"/>
                </div>
                <div class="pd-card-lbl">Total Projects</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(99,179,237,.18),transparent 70%)"/>
            </div>
            <div class="pd-card" style="--accent:#68d391">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">✅</span>
                    <span class="pd-card-num" t-esc="state.data.projects.completed"/>
                </div>
                <div class="pd-card-lbl">Completed</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(104,211,145,.18),transparent 70%)"/>
            </div>
            <div class="pd-card" style="--accent:#7f9cf5">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">🔄</span>
                    <span class="pd-card-num" t-esc="state.data.projects.in_progress"/>
                </div>
                <div class="pd-card-lbl">In Progress</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(127,156,245,.18),transparent 70%)"/>
            </div>
            <div class="pd-card" style="--accent:#f6ad55">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">⏸️</span>
                    <span class="pd-card-num" t-esc="state.data.projects.on_hold"/>
                </div>
                <div class="pd-card-lbl">On Hold</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(246,173,85,.18),transparent 70%)"/>
            </div>
        </div>

        <!-- Task Cards -->
        <div class="pd-section-label">
            <span class="pd-dot" style="background:#b794f4;box-shadow:0 0 8px #b794f4"/>
            Tasks
        </div>
        <div class="pd-cards">
            <div class="pd-card" style="--accent:#b794f4">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">📋</span>
                    <span class="pd-card-num" t-esc="state.data.tasks.total"/>
                </div>
                <div class="pd-card-lbl">Total Tasks</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(183,148,244,.18),transparent 70%)"/>
            </div>
            <div class="pd-card" style="--accent:#68d391">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">✅</span>
                    <span class="pd-card-num" t-esc="state.data.tasks.done"/>
                </div>
                <div class="pd-card-lbl">Done</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(104,211,145,.18),transparent 70%)"/>
            </div>
            <div class="pd-card" style="--accent:#7f9cf5">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">⚙️</span>
                    <span class="pd-card-num" t-esc="state.data.tasks.in_progress"/>
                </div>
                <div class="pd-card-lbl">In Progress</div>
                <div class="pd-card-glow" style="background:radial-gradient(circle,rgba(127,156,245,.18),transparent 70%)"/>
            </div>
            <div class="pd-card" style="--accent:#fc8181">
                <div class="pd-card-inner">
                    <span class="pd-card-ico">⚠️</span>
                    <span class="pd-card-num" t-esc="state.data.tasks.blocked"/>
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
                    Project Task Analysis
                </div>
                <div class="pd-chart-body">
                    <canvas t-ref="projectChart"/>
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

        <!-- Project Overview Table -->
        <div class="pd-section-label">
            <span class="pd-dot" style="background:#4fd1c5;box-shadow:0 0 8px #4fd1c5"/>
            Project Overview
        </div>
        <div class="pd-table-box">
            <table class="pd-table">
                <thead>
                    <tr>
                        <th>Project</th>
                        <th>Customer</th>
                        <th>Manager</th>
                        <th class="pd-tc">Total</th>
                        <th class="pd-tc">Done</th>
                        <th class="pd-tc">In Progress</th>
                        <th class="pd-tc">Blocked</th>
                        <th class="pd-tp">Progress</th>
                        <th class="pd-tc">Status</th>
                    </tr>
                </thead>
                <tbody>
                    <t t-if="state.data.project_list.length === 0">
                        <tr>
                            <td colspan="9" class="pd-empty">
                                <span>📂</span>
                                <p>No projects found</p>
                            </td>
                        </tr>
                    </t>
                    <t t-foreach="state.data.project_list" t-as="proj" t-key="proj.id">
                        <tr class="pd-row">
                            <td class="pd-td-name" t-on-click="() => this.openProject(proj.id)" style="cursor: pointer;" title="Open Project">
                                <span class="pd-proj-dot"/>
                                <b t-esc="proj.name" style="color: #3182ce;"/>
                            </td>
                            <td class="pd-td-sec" t-esc="proj.customer || '—'"/>
                            <td class="pd-td-sec" t-esc="proj.manager || '—'"/>
                            <td class="pd-tc pd-n-tot" t-esc="proj.tasks_total"/>
                            <td class="pd-tc pd-n-done" t-esc="proj.tasks_done"/>
                            <td class="pd-tc pd-n-prog" t-esc="proj.tasks_in_progress"/>
                            <td class="pd-tc pd-n-blk"  t-esc="proj.tasks_blocked"/>
                            <td class="pd-tp">
                                <div class="pd-prog-wrap">
                                    <div class="pd-prog-track">
                                        <div class="pd-prog-fill"
                                             t-att-style="'width:' + proj.progress + '%'"/>
                                    </div>
                                    <span class="pd-prog-pct" t-esc="proj.progress + '%'"/>
                                </div>
                            </td>
                            <td class="pd-tc">
                                <span t-att-class="'pd-badge pd-badge-' + proj.status"
                                      t-esc="proj.status_label"/>
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
        this.projectChartRef = useRef("projectChart");
        this.employeeChartRef = useRef("employeeChart");
        this.charts = { project: null, employee: null };

        this.state = useState({
            loading: true,
            filter_data: { projects: [], employees: [] },
            filters: {
                start_date: '',
                end_date: '',
                project_id: '',
                employee_id: ''
            },
            data: {
                projects: { total: 0, completed: 0, in_progress: 0, on_hold: 0 },
                tasks: { total: 0, done: 0, in_progress: 0, blocked: 0 },
                project_list: [],
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

        // 1. Project Donut Chart
        if (this.projectChartRef.el) {
            if (this.charts.project) this.charts.project.destroy();
            const ctx = this.projectChartRef.el.getContext('2d');
            const data = this.state.data.charts.project_analysis;

            this.charts.project = new Chart(ctx, {
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
        this.state.filters = { start_date: '', end_date: '', project_id: '', employee_id: '' };
        this.loadData();
    }

    // ── Data fetch ─────────────────────────────────────────────────────────────
    async loadData() {
        this.state.loading = true;
        try {
            // Using Odoo's core rpc handles the session/CSRF correctly
            const data = await rpc("/project_dashboard/data", this.state.filters);
            this.state.data = data;
            if (data.filters) {
                this.state.filter_data = data.filters;
            }
        } catch (err) {
            console.error('[ProjectDashboard] Fetch failed:', err);
        } finally {
            this.state.loading = false;
        }
    }
}

// Register the component as an Odoo client-action
registry.category("actions").add("project_dashboard_action", ProjectDashboard);