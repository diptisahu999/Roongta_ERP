/** @odoo-module **/

import { Component, useState, onWillStart, xml } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { rpc } from "@web/core/network/rpc";
import { useService } from "@web/core/utils/hooks";

export class PerformanceDashboard extends Component {
    static template = xml/* xml */`
<div class="pd-wrap pd-perf-dashboard-wrap">

    <!-- ══ Header & Navigation Breadcrumbs ════════════════════════════════ -->
    <div class="pd-header">
        <div class="pd-header-left">
            <div class="pd-breadcrumb-trail" t-if="state.level &gt; 1">
                <button class="pd-btn-back" t-on-click="() => this.goToLevel(1)">
                    <i class="fa fa-arrow-left"/> Back
                </button>
                <span class="pd-bc-item" t-on-click="() => this.goToLevel(1)">Departments</span>
                <t t-if="state.level === 2">
                    <span class="pd-bc-sep">/</span>
                    <span class="pd-bc-item active">
                        <t t-esc="state.selectedDeptName || ''"/> - User Performance
                    </span>
                </t>
            </div>
            <div class="pd-title-row">
                <h1 class="pd-title">
                    <t t-if="state.level === 1">Department Performance Dashboard</t>
                    <t t-elif="state.level === 2"><t t-esc="state.selectedDeptName || ''"/> - User Performance</t>
                </h1>
                <p class="pd-subtitle">Live overview of task performance and efficiency</p>
            </div>
        </div>

        <div class="pd-header-actions">
            <div class="pd-search-box">
                <input type="text" class="pd-search-input" placeholder="Search by name..." t-model="state.searchQuery"/>
                <i class="fa fa-search pd-search-icon"></i>
            </div>
            <button class="pd-btn-icon-sq" t-on-click="loadData" t-att-disabled="state.loading" title="Refresh">
                <i class="fa fa-refresh"/>
            </button>
        </div>
    </div>

    <!-- ══ Skeleton Loading ═══════════════════════════════════════════════ -->
    <t t-if="state.loading">
        <div class="pd-perf-cards-grid">
            <t t-foreach="[1,2,3,4,5,6,7,8]" t-as="s" t-key="s">
                <div class="pd-skel-card"/>
            </t>
        </div>
    </t>

    <!-- ══ Main Dashboard Content ═════════════════════════════════════════ -->
    <t t-else="">

        <!-- ── LEVEL 1: Department Cards ────────────────────────────────── -->
        <t t-if="state.level === 1">
            <div class="pd-perf-cards-grid">
                <t t-foreach="getDeptCards()" t-as="card" t-key="card.id">
                    <div class="pd-stat-card" t-on-click="() => this.selectDepartment(card.id, card.name)" style="cursor: pointer;">
                        <!-- Card Top Bar -->
                        <div class="pd-card-top-bar">
                            <div class="pd-card-name-group">
                                <span class="pd-check-circle"><i class="fa fa-check"/></span>
                                <span class="pd-card-name" t-esc="card.name || ''"/>
                            </div>
                            <div class="pd-card-top-right">
                                <span class="pd-update-label" t-esc="card.last_update || ''"/>
                            </div>
                        </div>

                        <!-- Card Body Layout -->
                        <div class="pd-card-body-layout">
                            <!-- Left Metrics Column (3 side-by-side metrics) -->
                            <div class="pd-card-left-metrics">
                                <div class="pd-metric-box pd-mb-total">
                                    <span class="pd-mb-lbl">Total<br/>Tasks</span>
                                    <span class="pd-mb-num" t-esc="card.total || 0"/>
                                </div>
                                <div class="pd-metric-box pd-mb-done">
                                    <span class="pd-mb-lbl">Tasks Done<br/>On Time</span>
                                    <span class="pd-mb-num" style="color: #10b981;" t-esc="card.on_time || 0"/>
                                </div>
                                <div class="pd-metric-box pd-mb-due">
                                    <span class="pd-mb-lbl">Tasks Done<br/>Late</span>
                                    <span class="pd-mb-num" style="color: #ef4444;" t-esc="card.late || 0"/>
                                </div>
                            </div>

                            <!-- Right Donut Chart + Performance Label -->
                            <div class="pd-card-right-donut">
                                <div class="pd-donut-container">
                                    <svg viewBox="0 0 36 36" class="pd-donut-svg">
                                        <path class="pd-donut-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" stroke-width="4.5"/>
                                        <t t-if="card.total &gt; 0">
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" stroke-width="4.5"
                                                  t-att-stroke-dasharray="getSegmentDash(card.on_time, card.total)"/>
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#ef4444" stroke-width="4.5"
                                                  t-att-stroke-dasharray="getSegmentDash(card.late, card.total)"
                                                  t-att-stroke-dashoffset="getSegmentOffset(card.on_time, card.total)"/>
                                        </t>
                                        <circle cx="18" cy="18" r="11.5" fill="#ffffff"/>
                                        <text x="18" y="21" class="pd-donut-center-text" text-anchor="middle" style="fill: #0f172a; font-weight: 700; font-size: 9.5px;" t-esc="(card.perf_pct || 0) + '%'"/>
                                    </svg>
                                </div>
                                <span class="pd-perf-donut-label">Performance</span>
                            </div>
                        </div>

                        <!-- Card Footer -->
                        <div class="pd-card-footer">
                            <span class="pd-team-lbl">Team Member</span>
                            <div class="pd-team-stack">
                                <t t-foreach="card.team || []" t-as="m" t-key="m.id">
                                    <t t-if="m.avatar">
                                        <img t-att-src="m.avatar" class="pd-avatar-img" t-att-title="m.name || ''"/>
                                    </t>
                                    <t t-else="">
                                        <span class="pd-avatar-circle" t-att-title="m.name || ''" t-att-style="'background:' + (m.bg_color || '#3b82f6')">
                                            <t t-esc="m.initials || ''"/>
                                        </span>
                                    </t>
                                </t>
                                <t t-if="card.extra_team_count &gt; 0">
                                    <span class="pd-avatar-circle pd-avatar-more" t-esc="'+' + card.extra_team_count"/>
                                </t>
                            </div>
                        </div>
                    </div>
                </t>
            </div>
        </t>

        <!-- ── LEVEL 2: User Performance Cards ─────────────────────────── -->
        <t t-if="state.level === 2">
            <div class="pd-perf-cards-grid">
                <t t-foreach="getUserCards()" t-as="card" t-key="card.id">
                    <div class="pd-stat-card" t-on-click="() => this.openUserTasks(card.id, card.name)" style="cursor: pointer;">
                        <!-- Card Top Bar -->
                        <div class="pd-card-top-bar">
                            <div class="pd-card-name-group">
                                <span class="pd-check-circle"><i class="fa fa-user"/></span>
                                <span class="pd-card-name" t-esc="card.name || ''"/>
                            </div>
                            <div class="pd-card-top-right">
                                <span class="pd-update-label" t-esc="card.last_update || ''"/>
                            </div>
                        </div>

                        <!-- Card Body Layout -->
                        <div class="pd-card-body-layout">
                            <!-- Left Metrics Column (3 side-by-side metrics) -->
                            <div class="pd-card-left-metrics">
                                <div class="pd-metric-box pd-mb-total">
                                    <span class="pd-mb-lbl">Total<br/>Tasks</span>
                                    <span class="pd-mb-num" t-esc="card.total || 0"/>
                                </div>
                                <div class="pd-metric-box pd-mb-done">
                                    <span class="pd-mb-lbl">Tasks Done<br/>On Time</span>
                                    <span class="pd-mb-num" style="color: #10b981;" t-esc="card.on_time || 0"/>
                                </div>
                                <div class="pd-metric-box pd-mb-due">
                                    <span class="pd-mb-lbl">Tasks Done<br/>Late</span>
                                    <span class="pd-mb-num" style="color: #ef4444;" t-esc="card.late || 0"/>
                                </div>
                            </div>

                            <!-- Right Donut Chart + Performance Label -->
                            <div class="pd-card-right-donut">
                                <div class="pd-donut-container">
                                    <svg viewBox="0 0 36 36" class="pd-donut-svg">
                                        <path class="pd-donut-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" stroke-width="4.5"/>
                                        <t t-if="card.total &gt; 0">
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" stroke-width="4.5"
                                                  t-att-stroke-dasharray="getSegmentDash(card.on_time, card.total)"/>
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#ef4444" stroke-width="4.5"
                                                  t-att-stroke-dasharray="getSegmentDash(card.late, card.total)"
                                                  t-att-stroke-dashoffset="getSegmentOffset(card.on_time, card.total)"/>
                                        </t>
                                        <circle cx="18" cy="18" r="11.5" fill="#ffffff"/>
                                        <text x="18" y="21" class="pd-donut-center-text" text-anchor="middle" style="fill: #0f172a; font-weight: 700; font-size: 9.5px;" t-esc="(card.perf_pct || 0) + '%'"/>
                                    </svg>
                                </div>
                                <span class="pd-perf-donut-label">Performance</span>
                            </div>
                        </div>

                        <!-- Card Footer -->
                        <div class="pd-card-footer">
                            <span class="pd-team-lbl">Team Member</span>
                            <div class="pd-team-stack">
                                <span class="pd-avatar-circle" t-att-title="card.name || ''" t-att-style="'background:' + (card.bg_color || '#84cc16')">
                                    <t t-esc="card.initials || ''"/>
                                </span>
                            </div>
                        </div>
                    </div>
                </t>
            </div>
        </t>

    </t>

</div>
    `;

    setup() {
        this.actionService = useService("action");

        // Use Odoo's built-in state restoration, fallback to sessionStorage, otherwise default to Level 1
        let level = 1;
        let selectedDeptId = null;
        let selectedDeptName = '';

        if (this.props.state && this.props.state.level) {
            level = this.props.state.level;
            selectedDeptId = this.props.state.selectedDeptId;
            selectedDeptName = this.props.state.selectedDeptName;
        } else {
            try {
                const savedState = JSON.parse(sessionStorage.getItem('perf_dashboard_state'));
                if (savedState && savedState.level) {
                    level = savedState.level;
                    selectedDeptId = savedState.selectedDeptId;
                    selectedDeptName = savedState.selectedDeptName;
                }
            } catch (e) { }
        }

        this.state = useState({
            loading: true,
            level: level,
            selectedDeptId: selectedDeptId,
            selectedDeptName: selectedDeptName,
            searchQuery: '',
            deptCards: [],
            userCards: []
        });

        onWillStart(async () => {
            await this.loadData();
        });
    }

    // Save state for Odoo's breadcrumb navigation
    getState() {
        return {
            level: this.state.level,
            selectedDeptId: this.state.selectedDeptId,
            selectedDeptName: this.state.selectedDeptName,
        };
    }

    async loadData() {
        this.state.loading = true;
        try {
            const res = await rpc("/performance_dashboard/data", {
                level: this.state.level,
                department_id: this.state.selectedDeptId
            });
            if (this.state.level === 1) {
                this.state.deptCards = res.dept_cards || [];
            } else if (this.state.level === 2) {
                this.state.userCards = res.user_cards || [];
                this.state.selectedDeptName = res.department_name || this.state.selectedDeptName;
            }
        } catch (err) {
            console.error("Failed to load performance dashboard data:", err);
        } finally {
            this.state.loading = false;
        }
    }

    async selectDepartment(deptId, deptName) {
        this.state.selectedDeptId = deptId;
        this.state.selectedDeptName = deptName;
        this.state.level = 2;
        this._saveSessionState();

        await this.loadData();
    }

    async goToLevel(lvl) {
        if (lvl === 1) {
            this.state.selectedDeptId = null;
            this.state.selectedDeptName = '';
            this.state.level = 1;
            this._saveSessionState();
            await this.loadData();
        }
    }

    _saveSessionState() {
        try {
            sessionStorage.setItem('perf_dashboard_state', JSON.stringify({
                level: this.state.level,
                selectedDeptId: this.state.selectedDeptId,
                selectedDeptName: this.state.selectedDeptName
            }));
        } catch (e) { }
    }

    getDeptCards() {
        const q = (this.state.searchQuery || '').toLowerCase().trim();
        if (!q) return this.state.deptCards;
        return this.state.deptCards.filter(c => (c.name || '').toLowerCase().includes(q));
    }

    getUserCards() {
        const q = (this.state.searchQuery || '').toLowerCase().trim();
        if (!q) return this.state.userCards;
        return this.state.userCards.filter(c => (c.name || '').toLowerCase().includes(q));
    }

    getSegmentDash(val, total) {
        if (!total || total <= 0 || !val) return "0 100";
        const pct = (val / total) * 100;
        return `${pct} ${100 - pct}`;
    }

    getSegmentOffset(prevVal, total) {
        if (!total || total <= 0 || !prevVal) return "0";
        const pct = (prevVal / total) * 100;
        return `-${pct}`;
    }

    openUserTasks(userId, userName) {
        this.actionService.doAction({
            type: "ir.actions.act_window",
            name: `${userName} - Month Wise Task Working`,
            res_model: "project.task",
            views: [
                [false, "graph"],
                [false, "kanban"],
                [false, "list"],
                [false, "pivot"],
                [false, "form"]
            ],
            domain: [["user_ids", "in", [userId]], ["state", "=", "1_done"]],
            context: {
                group_by: ["date_deadline:month", "task_performance"],
                graph_group_bys: ["date_deadline:month", "task_performance"],
                graph_measure: "__count__",
                graph_mode: "pie"
            }
        }, {
            clearBreadcrumbs: false
        });
    }
}

registry.category("actions").add("performance_dashboard_action", PerformanceDashboard);
