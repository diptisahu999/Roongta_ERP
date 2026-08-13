/** @odoo-module **/
/**
 * 3-Level Multi-Tier Dashboard — OWL Component (Odoo 18)
 *
 * Implements the exact 3-level dashboard flow matching Image 1:
 *   - Level 1: Project List Main Dashboard (Tag-based cards)
 *   - Level 2: Department Dashboard (Drilled into Tag)
 *   - Level 3: Employee Dashboard (Drilled into Department) + Grouped Task List View
 */

import { Component, useState, onWillStart, onWillUnmount, xml } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { rpc } from "@web/core/network/rpc";
import { useService } from "@web/core/utils/hooks";

export class DepartmentDashboard extends Component {

    static template = xml/* xml */`
<div class="pd-wrap">

    <!-- ══ Header & Navigation Breadcrumbs ════════════════════════════════ -->
    <div class="pd-header">
        <div class="pd-header-left">
            <div class="pd-breadcrumb-trail" t-if="state.level &gt; 1">
                <button class="pd-btn-back" t-on-click="() => this.goBack()">
                    <i class="fa fa-arrow-left"/> Back
                </button>
                <span class="pd-bc-item" t-on-click="() => this.goToLevel(1)">Project List</span>
                <t t-if="state.level >= 2">
                    <span class="pd-bc-sep">/</span>
                    <span class="pd-bc-item" t-att-class="{ 'active': state.level === 2 }" t-on-click="() => this.goToLevel(2)">
                        <t t-esc="state.selectedTagName || ''"/> - Department Dashboard
                    </span>
                </t>
                <t t-if="state.level === 3">
                    <span class="pd-bc-sep">/</span>
                    <span class="pd-bc-item active">
                        <t t-esc="state.selectedDeptName || ''"/> - Employee Dashboard
                    </span>
                </t>
            </div>
            <div class="pd-title-row">
                <h1 class="pd-title">
                    <t t-if="state.level === 1">Project List</t>
                    <t t-elif="state.level === 2"><t t-esc="state.selectedTagName || ''"/> - Department Dashboard</t>
                    <t t-elif="state.level === 3"><t t-esc="state.selectedTagName || ''"/> - <t t-esc="state.selectedDeptName || ''"/> - Employee Dashboard</t>
                </h1>
                <p class="pd-subtitle">Live overview of projects</p>
            </div>
        </div>

        <div class="pd-header-actions">
            <div class="pd-search-box">
                <input type="text" class="pd-search-input" placeholder="Search by name..." t-model="state.dashboardSearchQuery"/>
                <i class="fa fa-search pd-search-icon"></i>
            </div>
            <t t-if="state.level === 1">
                <button class="pd-btn-primary" t-on-click="createNewProject">+ New Project</button>
            </t>
            <t t-else="">
                <button class="pd-btn-primary" t-on-click="createNewTask">+ New Task</button>
            </t>
            <button class="pd-btn-outline" t-on-click="exportData">Export</button>
            <button class="pd-btn-icon-sq" t-on-click="loadData" t-att-disabled="state.loading" title="Refresh">
                <i class="fa fa-refresh"/>
            </button>
        </div>
    </div>

    <!-- ══ Skeleton Loading ═══════════════════════════════════════════════ -->
    <t t-if="state.loading">
        <div class="pd-cards-grid">
            <t t-foreach="[1,2,3,4,5,6]" t-as="s" t-key="s">
                <div class="pd-skel-card"/>
            </t>
        </div>
    </t>

    <!-- ══ Main Dashboard Content ═════════════════════════════════════════ -->
    <t t-else="">

        <!-- ── LEVEL 1: Tag Cards (Project List Main Dashboard) ───────────── -->
        <t t-if="state.level === 1">
            <div class="pd-cards-grid">
                <t t-foreach="getTagCards()" t-as="card" t-key="card.id">
                    <div class="pd-stat-card" t-on-click="() => this.selectTag(card.id, card.name)">
                        <!-- Card Header -->
                        <div class="pd-card-top-bar">
                            <div class="pd-card-name-group">
                                <span class="pd-check-circle"><i class="fa fa-check"/></span>
                                <span class="pd-card-name" t-esc="card.name || ''"/>
                            </div>
                            <div class="pd-card-top-right">
                                <span class="pd-update-label" t-esc="card.last_update || ''"/>
                            </div>
                        </div>

                        <!-- Card Metrics Section -->
                        <div class="pd-card-body-layout">
                            <div class="pd-card-left-metrics">
                                <!-- Top Row Metrics + Due Pill -->
                                <div class="pd-metrics-row-top">
                                    <div class="pd-metric-box pd-mb-total">
                                        <span class="pd-mb-lbl">Total</span>
                                        <span class="pd-mb-num" t-esc="card.total || 0"/>
                                    </div>
                                    <div class="pd-metric-box pd-mb-done">
                                        <span class="pd-mb-lbl">Done</span>
                                        <span class="pd-mb-num" t-esc="card.done || 0"/>
                                    </div>
                                    <div class="pd-metric-box pd-mb-pending">
                                        <span class="pd-mb-lbl">Pending</span>
                                        <span class="pd-mb-num" t-esc="card.pending || 0"/>
                                    </div>
                                </div>

                                <!-- Bottom Row Metrics -->
                                <div class="pd-metrics-row-bottom">
                                    <div class="pd-metric-box pd-mb-due">
                                        <span class="pd-mb-lbl">Due</span>
                                        <span class="pd-mb-num" t-esc="card.due || 0"/>
                                    </div>
                                    <div class="pd-metric-box pd-mb-hold">
                                        <span class="pd-mb-lbl">Hold</span>
                                        <span class="pd-mb-num" t-esc="card.hold || 0"/>
                                    </div>
                                </div>
                            </div>

                            <!-- Right Donut Chart -->
                            <div class="pd-card-right-donut" style="display: flex; flex-direction: column; align-items: flex-end; gap: 12px; justify-content: flex-start; height: 100%;">

                                <div class="pd-donut-container">
                                    <svg viewBox="0 0 36 36" class="pd-donut-svg">
                                        <path class="pd-donut-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" stroke-width="4.5"/>
                                        <t t-if="card.total &gt; 0">
                                            <!-- Done segment (Green) -->
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" stroke-width="4.5"
                                                  t-att-stroke-dasharray="getSegmentDash(card.done, card.total)"/>
                                            <!-- Pending segment (Orange) -->
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f59e0b" stroke-width="4.5"
                                                  t-att-stroke-dasharray="getSegmentDash(card.pending, card.total)"
                                                  t-att-stroke-dashoffset="getSegmentOffset(card.done, card.total)"/>
                                            <!-- Due segment (Red) -->
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#ef4444" stroke-width="4.5"
                                                  t-att-stroke-dasharray="getSegmentDash(card.due, card.total)"
                                                  t-att-stroke-dashoffset="getSegmentOffset((card.done || 0) + (card.pending || 0), card.total)"/>
                                        </t>
                                        <!-- White center hole -->
                                        <circle cx="18" cy="18" r="11.5" fill="#ffffff"/>
                                        <text x="18" y="21" class="pd-donut-center-text" text-anchor="middle" style="fill: #94a3b8; font-weight: 500;" t-esc="card.total || 0"/>
                                    </svg>
                                </div>
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
                                        <span class="pd-avatar-circle" t-att-title="m.name || ''">
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

        <!-- ── LEVEL 2: Department Cards (Estella - Department Dashboard) ─── -->
        <t t-if="state.level === 2">
            <div class="pd-cards-grid">
                <t t-foreach="getDeptCards()" t-as="card" t-key="card.id">
                    <div class="pd-stat-card" t-on-click="() => this.selectDepartment(card.id, card.name)">
                        <!-- Card Header -->
                        <div class="pd-card-top-bar">
                            <div class="pd-card-name-group">
                                <span class="pd-check-circle"><i class="fa fa-check"/></span>
                                <span class="pd-card-name" t-esc="card.name || ''"/>
                            </div>
                            <div class="pd-card-top-right">
                                <span class="pd-update-label" t-esc="card.last_update || ''"/>
                            </div>
                        </div>

                        <!-- Card Metrics Section -->
                        <div class="pd-card-body-layout">
                            <div class="pd-card-left-metrics">
                                <div class="pd-metrics-row-top">
                                    <div class="pd-metric-box pd-mb-total">
                                        <span class="pd-mb-lbl">Total</span>
                                        <span class="pd-mb-num" t-esc="card.total || 0"/>
                                    </div>
                                    <div class="pd-metric-box pd-mb-done">
                                        <span class="pd-mb-lbl">Done</span>
                                        <span class="pd-mb-num" t-esc="card.done || 0"/>
                                    </div>
                                    <div class="pd-metric-box pd-mb-pending">
                                        <span class="pd-mb-lbl">Pending</span>
                                        <span class="pd-mb-num" t-esc="card.pending || 0"/>
                                    </div>
                                </div>

                                <div class="pd-metrics-row-bottom">
                                    <div class="pd-metric-box pd-mb-due">
                                        <span class="pd-mb-lbl">Due</span>
                                        <span class="pd-mb-num" t-esc="card.due || 0"/>
                                    </div>
                                    <div class="pd-metric-box pd-mb-hold">
                                        <span class="pd-mb-lbl">Hold</span>
                                        <span class="pd-mb-num" t-esc="card.hold || 0"/>
                                    </div>
                                </div>
                            </div>

                            <!-- Right Donut Chart -->
                            <div class="pd-card-right-donut" style="display: flex; flex-direction: column; align-items: flex-end; gap: 12px; justify-content: flex-start; height: 100%;">

                                <div class="pd-donut-container">
                                    <svg viewBox="0 0 36 36" class="pd-donut-svg">
                                        <path class="pd-donut-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" stroke-width="4.5"/>
                                        <t t-if="card.total &gt; 0">
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" stroke-width="4.5"
                                                  t-att-stroke-dasharray="getSegmentDash(card.done, card.total)"/>
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f59e0b" stroke-width="4.5"
                                                  t-att-stroke-dasharray="getSegmentDash(card.pending, card.total)"
                                                  t-att-stroke-dashoffset="getSegmentOffset(card.done, card.total)"/>
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#ef4444" stroke-width="4.5"
                                                  t-att-stroke-dasharray="getSegmentDash(card.due, card.total)"
                                                  t-att-stroke-dashoffset="getSegmentOffset((card.done || 0) + (card.pending || 0), card.total)"/>
                                        </t>
                                        <circle cx="18" cy="18" r="11.5" fill="#ffffff"/>
                                        <text x="18" y="21" class="pd-donut-center-text" text-anchor="middle" style="fill: #94a3b8; font-weight: 500;" t-esc="card.total || 0"/>
                                    </svg>
                                </div>
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
                                        <span class="pd-avatar-circle" t-att-title="m.name || ''">
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

        <!-- ── LEVEL 3: Employee Cards (Estella - Purchase - Employee Dashboard) -->
        <t t-if="state.level === 3">
            <div class="pd-cards-grid">
                <t t-foreach="getEmpCards()" t-as="card" t-key="card.id">
                    <div class="pd-stat-card" t-on-click="() => this.openEmployeeTasks(card.id, card.name)">
                        <!-- Card Header -->
                        <div class="pd-card-top-bar">
                            <div class="pd-card-name-group">
                                <span class="pd-check-circle"><i class="fa fa-user"/></span>
                                <span class="pd-card-name" t-esc="card.name || ''"/>
                            </div>
                            <div class="pd-card-top-right">
                                <span class="pd-update-label" t-esc="card.last_update || ''"/>
                            </div>
                        </div>

                        <!-- Card Metrics Section -->
                        <div class="pd-card-body-layout">
                            <div class="pd-card-left-metrics">
                                <div class="pd-metrics-row-top">
                                    <div class="pd-metric-box pd-mb-total">
                                        <span class="pd-mb-lbl">Total</span>
                                        <span class="pd-mb-num" t-esc="card.total || 0"/>
                                    </div>
                                    <div class="pd-metric-box pd-mb-done">
                                        <span class="pd-mb-lbl">Done</span>
                                        <span class="pd-mb-num" t-esc="card.done || 0"/>
                                    </div>
                                    <div class="pd-metric-box pd-mb-pending">
                                        <span class="pd-mb-lbl">Pending</span>
                                        <span class="pd-mb-num" t-esc="card.pending || 0"/>
                                    </div>
                                </div>

                                <div class="pd-metrics-row-bottom">
                                    <div class="pd-metric-box pd-mb-due">
                                        <span class="pd-mb-lbl">Due</span>
                                        <span class="pd-mb-num" t-esc="card.due || 0"/>
                                    </div>
                                    <div class="pd-metric-box pd-mb-hold">
                                        <span class="pd-mb-lbl">Hold</span>
                                        <span class="pd-mb-num" t-esc="card.hold || 0"/>
                                    </div>
                                </div>
                            </div>

                            <!-- Right Donut Chart -->
                            <div class="pd-card-right-donut" style="display: flex; flex-direction: column; align-items: flex-end; gap: 12px; justify-content: flex-start; height: 100%;">

                                <div class="pd-donut-container">
                                    <svg viewBox="0 0 36 36" class="pd-donut-svg">
                                        <path class="pd-donut-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" stroke-width="4.5"/>
                                        <t t-if="card.total &gt; 0">
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" stroke-width="4.5"
                                                  t-att-stroke-dasharray="getSegmentDash(card.done, card.total)"/>
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f59e0b" stroke-width="4.5"
                                                  t-att-stroke-dasharray="getSegmentDash(card.pending, card.total)"
                                                  t-att-stroke-dashoffset="getSegmentOffset(card.done, card.total)"/>
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#ef4444" stroke-width="4.5"
                                                  t-att-stroke-dasharray="getSegmentDash(card.due, card.total)"
                                                  t-att-stroke-dashoffset="getSegmentOffset((card.done || 0) + (card.pending || 0), card.total)"/>
                                        </t>
                                        <circle cx="18" cy="18" r="11.5" fill="#ffffff"/>
                                        <text x="18" y="21" class="pd-donut-center-text" text-anchor="middle" t-esc="card.total || 0"/>
                                    </svg>
                                </div>
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
                                        <span class="pd-avatar-circle" t-att-title="m.name || ''">
                                            <t t-esc="m.initials || ''"/>
                                        </span>
                                    </t>
                                </t>
                            </div>
                        </div>
                    </div>
                </t>
            </div>
        </t>

        <!-- ── MIDDLE SECTION: Side-by-Side Tables (Levels 1 & 2) ─────────── -->
        <t t-if="state.level &lt; 3">
            <div class="pd-tables-row">
                <!-- My Task Column -->
                <div class="pd-table-column">
                    <div class="pd-table-column-title">My Task</div>
                    <div class="pd-table-box">
                        <table class="pd-table">
                            <thead>
                                <tr>
                                    <th style="width: 14%;">PROJECT</th>
                                    <th style="width: 16%;">DEPARTMENT</th>
                                    <th style="width: 25%;">TASK</th>
                                    <th style="width: 18%;">EMPLOYEE</th>
                                    <th style="width: 12%;">STATUS</th>
                                    <th style="width: 15%;">DUE DATE</th>
                                </tr>
                            </thead>
                            <tbody>
                                <t t-foreach="getMyTasks()" t-as="row" t-key="row.id">
                                    <tr t-on-click="() => this.openTask(row.id)">
                                        <td t-esc="row.project || ''"/>
                                        <td t-esc="row.department || ''"/>
                                        <td class="pd-truncate" t-att-title="row.task || ''" t-esc="row.task || ''"/>
                                        <td class="pd-truncate" t-att-title="row.employee || ''" t-esc="row.employee || ''"/>
                                        <td>
                                            <span t-att-class="'pd-pill pd-pill-' + (row.status ? row.status.toLowerCase() : 'pending')" t-esc="row.status || ''"/>
                                        </td>
                                        <td t-esc="row.due_date || ''"/>
                                    </tr>
                                </t>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- My Due Task Column -->
                <div class="pd-table-column">
                    <div class="pd-table-column-title">Overdue Tasks</div>
                    <div class="pd-table-box">
                        <table class="pd-table">
                            <thead>
                                <tr>
                                    <th style="width: 14%;">PROJECT</th>
                                    <th style="width: 16%;">DEPARTMENT</th>
                                    <th style="width: 25%;">TASK</th>
                                    <th style="width: 18%;">EMPLOYEE</th>
                                    <th style="width: 12%;">STATUS</th>
                                    <th style="width: 15%;">DUE DATE</th>
                                </tr>
                            </thead>
                            <tbody>
                                <t t-foreach="getMyDueTasks()" t-as="row" t-key="row.id">
                                    <tr t-on-click="() => this.openTask(row.id)">
                                        <td t-esc="row.project || ''"/>
                                        <td t-esc="row.department || ''"/>
                                        <td class="pd-truncate" t-att-title="row.task || ''" t-esc="row.task || ''"/>
                                        <td class="pd-truncate" t-att-title="row.employee || ''" t-esc="row.employee || ''"/>
                                        <td>
                                            <span class="pd-pill pd-pill-due" t-esc="row.status || 'Due'"/>
                                        </td>
                                        <td t-esc="row.due_date || ''"/>
                                    </tr>
                                </t>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </t>

        <!-- ── LEVEL 3: Grouped Task List View (Estella Purchase List View) ── -->
        <t t-if="state.level === 3">
            <div class="pd-list-view-box">
                <div class="pd-list-view-hdr">
                    <t t-esc="state.selectedTagName || ''"/> <t t-esc="state.selectedDeptName || ''"/> List View
                </div>
                <div class="pd-table-scroll-wrapper">
                    <table class="pd-grouped-table">
                        <thead>
                        <tr>
                            <th style="width: 25%;">Title</th>
                            <th>Project</th>
                            <th>Assignees</th>
                            <th style="width: 15%;">Progress</th>
                            <th>Days Open</th>
                            <th>Next Activity</th>
                            <th>Tags</th>
                            <th>Stage</th>
                        </tr>
                    </thead>
                    <tbody>
                        <t t-foreach="getGroupedTasks()" t-as="grp" t-key="grp.employee_id">
                            <!-- Group Header Row -->
                            <tr class="pd-grp-hdr-row" t-on-click="() => this.toggleGroup(grp.employee_id)">
                                <td colspan="8">
                                    <span class="pd-grp-chevron">
                                        <t t-if="state.collapsed_groups[grp.employee_id]">▶</t>
                                        <t t-else="">▼</t>
                                    </span>
                                    <b t-esc="grp.employee_name || ''"/> (<t t-esc="grp.count || 0"/>)
                                </td>
                            </tr>

                            <!-- Task Rows under Employee -->
                            <t t-if="!state.collapsed_groups[grp.employee_id]">
                                <t t-foreach="grp.tasks || []" t-as="tk" t-key="tk.id">
                                    <tr class="pd-task-item-row" t-on-click="() => this.openTask(tk.id)">
                                        <td class="pd-task-title-cell">
                                            <span class="pd-task-star">☆</span>
                                            <span class="pd-task-check">
                                                <t t-if="tk.is_done">
                                                    <i class="fa fa-check-circle" style="color: #10b981;"/>
                                                </t>
                                                <t t-else="">
                                                    <i class="fa fa-circle-o" style="color: #cbd5e1;"/>
                                                </t>
                                            </span>
                                            <span class="pd-task-title" t-esc="tk.title || ''"/>
                                            <span class="pd-subtask-badge" t-if="tk.subtask_str" t-esc="tk.subtask_str"/>
                                        </td>
                                        <td t-esc="tk.project_name || ''"/>
                                        <td>
                                            <div class="pd-team-stack">
                                                <t t-foreach="tk.assignees || []" t-as="a" t-key="a.id">
                                                    <t t-if="a.avatar">
                                                        <img t-att-src="a.avatar" class="pd-avatar-img" t-att-title="a.name || ''"/>
                                                    </t>
                                                    <t t-else="">
                                                        <span class="pd-avatar-circle" t-att-title="a.name || ''"><t t-esc="a.initials || ''"/></span>
                                                    </t>
                                                </t>
                                            </div>
                                        </td>
                                        <td>
                                            <div class="pd-prog-bar-cell">
                                                <span class="pd-prog-pct" t-esc="(tk.progress || 0) + '%'"/>
                                                <div class="pd-prog-track">
                                                    <div class="pd-prog-fill" t-att-style="'width:' + (tk.progress || 0) + '%'"/>
                                                </div>
                                            </div>
                                        </td>
                                        <td t-esc="tk.days_open || 0"/>
                                        <td><span class="pd-act-clock">⏰</span></td>
                                        <td><span class="pd-tag-pill" t-if="tk.tag_name" t-esc="tk.tag_name"/></td>
                                        <td><span class="pd-stage-badge" t-esc="tk.stage || ''"/></td>
                                    </tr>
                                </t>
                            </t>
                        </t>
                    </tbody>
                    <tfoot>
                        <tr class="pd-summary-tot-row">
                            <td colspan="3"><b>Total Summary</b></td>
                            <td>
                                <div class="pd-prog-bar-cell">
                                    <span class="pd-prog-pct" t-esc="((state.data &amp;&amp; state.data.summary_totals &amp;&amp; state.data.summary_totals.overall_progress) || 0) + '%'"/>
                                    <div class="pd-prog-track">
                                        <div class="pd-prog-fill" t-att-style="'width:' + ((state.data &amp;&amp; state.data.summary_totals &amp;&amp; state.data.summary_totals.overall_progress) || 0) + '%'"/>
                                    </div>
                                </div>
                            </td>
                            <td colspan="4"></td>
                        </tr>
                    </tfoot>
                    </table>
                </div>
            </div>
        </t>

        <!-- ── BOTTOM SECTION: Meeting Calendar (Levels 1 & 2) ─────────────── -->
        <t t-if="state.level &lt; 3">
            <div class="pd-calendar-box">
                <div class="pd-cal-hdr">
                    <span class="pd-cal-title">
                        <t t-if="state.level === 1">Project Meeting Calender</t>
                        <t t-else="">Department Meeting Calender</t>
                    </span>
                </div>

                <div class="pd-cal-body">
                    <!-- Left: Main Calendar View -->
                    <div class="pd-cal-main">
                        <div class="pd-cal-toolbar">
                            <div class="pd-cal-nav-group">
                                <button class="pd-cal-btn" t-on-click="prevMonth">&lt;</button>
                                <button class="pd-cal-btn" t-on-click="nextMonth">&gt;</button>
                                <select class="pd-cal-select" t-model="state.calMonth" t-on-change="onMonthSelect">
                                    <option value="1">January</option>
                                    <option value="2">February</option>
                                    <option value="3">March</option>
                                    <option value="4">April</option>
                                    <option value="5">May</option>
                                    <option value="6">June</option>
                                    <option value="7">July</option>
                                    <option value="8">August</option>
                                    <option value="9">September</option>
                                    <option value="10">October</option>
                                    <option value="11">November</option>
                                    <option value="12">December</option>
                                </select>
                                <button class="pd-cal-btn" t-on-click="goToToday">Today</button>
                            </div>
                            <span class="pd-cal-month-title"><t t-esc="getCalendarMonthName()"/> <t t-esc="state.calYear"/></span>
                            <button class="pd-cal-btn" t-on-click="openActivityModal">➕ Schedule Activity</button>
                        </div>

                        <!-- Calendar Month Grid -->
                        <div class="pd-cal-grid">
                            <div class="pd-cal-day-hdr">SUN</div>
                            <div class="pd-cal-day-hdr">MON</div>
                            <div class="pd-cal-day-hdr">TUE</div>
                            <div class="pd-cal-day-hdr">WED</div>
                            <div class="pd-cal-day-hdr">THU</div>
                            <div class="pd-cal-day-hdr">FRI</div>
                            <div class="pd-cal-day-hdr">SAT</div>

                            <!-- Dynamic Grid Cells -->
                            <t t-foreach="getCalendarGrid()" t-as="cell" t-key="cell.dateStr + '_' + cell_index">
                                <div class="pd-cal-cell" t-att-class="{ 'pd-cal-other-month': !cell.isCurrentMonth, 'pd-cal-today': cell.isToday }" t-on-click="() => this.onDateClick(cell.dateStr)" title="Click to schedule on this date">
                                    <span class="pd-cal-date-num" t-esc="cell.day"/>
                                    <t t-foreach="cell.events" t-as="ev" t-key="ev.id">
                                        <div class="pd-cal-event-pill" t-att-style="'background-color: ' + (ev.color || '#3b82f6') + ';'" t-att-title="ev.title + (ev.user_name ? ' (' + ev.user_name + ')' : '') + ' - Click to edit/delete'" t-on-click.stop="() => this.onEventClick(ev)">
                                            <span t-esc="ev.time"/> <span t-esc="ev.title"/> <t t-if="ev.user_name">(<t t-esc="ev.user_name"/>)</t>
                                        </div>
                                    </t>
                                </div>
                            </t>
                        </div>
                    </div>

                    <!-- Right: Mini Calendar Sidebar -->
                    <div class="pd-cal-sidebar">
                        <div class="pd-mini-cal-hdr">
                            <span class="pd-mini-nav-btn" t-on-click="prevMonth" style="cursor:pointer; margin-right:8px;">&lt;</span>
                            <span><t t-esc="getCalendarMonthName()"/> <t t-esc="state.calYear"/></span>
                            <span class="pd-mini-nav-btn" t-on-click="nextMonth" style="cursor:pointer; margin-left:8px;">&gt;</span>
                        </div>
                        <div class="pd-mini-cal-days">
                            <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
                            <t t-foreach="getCalendarGrid()" t-as="cell" t-key="'mini_' + cell.dateStr + '_' + cell_index">
                                <span t-att-class="{ 'other-month': !cell.isCurrentMonth, 'active': cell.isToday }" t-esc="cell.day" t-on-click="() => this.onDateClick(cell.dateStr)" style="cursor:pointer;" title="Click to schedule on date"/>
                            </t>
                        </div>
                    </div>
                </div>
            </div>
        </t>

    </t>

    <!-- ══ Schedule / Edit Activity Modal Popup ══════════════════════════════════ -->
    <t t-if="state.showActivityModal">
        <div class="pd-modal-overlay">
            <div class="pd-modal-box">
                <div class="pd-modal-hdr">
                    <span t-esc="state.isEditMode ? 'Edit Event / Meeting' : 'Schedule Activity / Meeting'"/>
                    <span class="pd-modal-close" t-on-click="closeActivityModal">✕</span>
                </div>
                <div class="pd-modal-body">
                    <div class="pd-form-group">
                        <label>Activity / Meeting Type</label>
                        <select t-model="state.activityForm.type" class="pd-form-input" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined">
                            <option value="meeting">Meeting</option>
                            <option value="todo">To-Do</option>
                            <option value="call">Call</option>
                        </select>
                    </div>
                    <div class="pd-form-group">
                        <label>Date &amp; Time</label>
                        <div style="display:flex; gap:10px;">
                            <input type="date" t-model="state.activityForm.date" class="pd-form-input" style="flex:2;" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined"/>
                            <input type="time" t-model="state.activityForm.time_start" class="pd-form-input" style="flex:1;" title="Start Time" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined"/>
                            <input type="time" t-model="state.activityForm.time_stop" class="pd-form-input" style="flex:1;" title="End Time" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined"/>
                        </div>
                    </div>
                    <div class="pd-form-group">
                        <label>Subject / Summary</label>
                        <input type="text" placeholder="e.g. Discuss Q3 Project Roadmap" t-model="state.activityForm.summary" class="pd-form-input" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined"/>
                    </div>
                    <div class="pd-form-group">
                        <label>Agenda / Description</label>
                        <textarea placeholder="Add meeting notes, agenda, or details..." t-model="state.activityForm.description" class="pd-form-input" rows="3" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined"/>
                    </div>
                    <div class="pd-form-group">
                        <label>Assigned to / Mentioned Attendees</label>
                        
                        <!-- Selected Persons Chips -->
                        <div class="pd-attendees-list-box" style="display:flex; flex-wrap:wrap; gap:8px; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; min-height:48px; max-height:120px; overflow-y:auto; align-items:center; margin-bottom:10px;">
                            <t t-if="!state.activityForm.user_ids || state.activityForm.user_ids.length === 0">
                                <span class="pd-no-attendees-text">No attendees added yet. Search or select a person below.</span>
                            </t>
                            <t t-else="">
                                <t t-foreach="state.activityForm.user_ids" t-as="uid" t-key="uid">
                                    <div class="pd-attendee-chip" style="display:inline-flex; align-items:center; gap:8px; background:#ffffff; border:1px solid #cbd5e1; box-shadow:0 1px 3px rgba(0,0,0,0.05); border-radius:20px; padding:4px 10px 4px 4px; cursor:pointer;" t-on-click="() => this.openPersonCard(uid)">
                                        <span class="pd-attendee-avatar" style="width:24px; height:24px; border-radius:50%; background:#2563eb; color:#ffffff; font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center;"><t t-esc="getUserInitials(uid)"/></span>
                                        <span class="pd-attendee-name" style="font-size:12.5px; font-weight:600; color:#1e293b;"><t t-esc="getUserName(uid)"/></span>
                                        <span t-if="state.isEventEditable" class="pd-attendee-remove" t-on-click.stop="() => this.removePerson(uid)" title="Remove Person" style="cursor:pointer; font-size:13px; color:#94a3b8; font-weight:700; margin-left:2px;">✕</span>
                                    </div>
                                </t>
                            </t>
                        </div>

                        <!-- Search & Add Person Controls -->
                        <div t-if="state.isEventEditable" class="pd-add-person-row" style="margin-top:8px; display:flex; gap:10px; align-items:center;">
                            <input type="text" placeholder="🔍 Search person name..." t-model="state.personSearchQuery" class="pd-form-input" style="flex:1; max-width: 180px;"/>
                            <select class="pd-form-input pd-person-select" t-model="state.selectedPersonToSelect" t-on-change="onPersonDropdownChange" style="flex:2;">
                                <option value="">-- Select Person to Add --</option>
                                <t t-foreach="getAvailableEmployees()" t-as="e" t-key="e.id">
                                    <option t-att-value="e.id" t-esc="e.name || ''"/>
                                </t>
                            </select>
                            <button type="button" class="pd-btn-add-person" t-on-click="addSelectedPerson">
                                ➕ Add
                            </button>
                        </div>
                    </div>
                </div>
                <div class="pd-modal-ftr">
                    <t t-if="state.isEditMode and state.isEventEditable">
                        <button type="button" class="pd-btn-danger" t-on-click="() => this.deleteEvent()" style="margin-right:auto; background:#ef4444; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:600; cursor:pointer;">🗑 Delete Event</button>
                    </t>
                    <t t-if="state.isEventEditable">
                        <button class="pd-btn-primary" t-on-click="() => this.saveActivity(false)">
                            <t t-esc="state.isEditMode ? 'Update Event' : 'Schedule Event'"/>
                        </button>
                        <button class="pd-btn-outline" t-on-click="() => this.saveActivity(true)">
                            <t t-esc="state.isEditMode ? 'Mark as Done' : 'Schedule &amp; Mark Done'"/>
                        </button>
                    </t>
                    <button class="pd-btn-outline" t-on-click="closeActivityModal"><t t-esc="state.isEventEditable ? 'Cancel' : 'Close'"/></button>
                </div>
            </div>
        </div>
    </t>
    <!-- Person Info Card Modal -->
    <t t-if="state.showPersonCard and state.personCardData">
        <div class="pd-modal-overlay" t-on-click="closePersonCard">
            <div class="pd-person-card-modal" t-on-click.stop="">
                <div class="pd-pc-close" t-on-click="closePersonCard">✕</div>
                <div class="pd-pc-header">
                    <img t-att-src="state.personCardData.avatar" class="pd-pc-avatar" t-if="state.personCardData.avatar"/>
                    <div class="pd-pc-avatar-placeholder" t-else=""><t t-esc="getUserInitials(state.personCardData.id)"/></div>
                    <div class="pd-pc-title-box">
                        <div class="pd-pc-name" t-esc="state.personCardData.name"/>
                        <div class="pd-pc-job" t-if="state.personCardData.job_title" t-esc="state.personCardData.job_title"/>
                    </div>
                </div>
                <div class="pd-pc-body">
                    <div class="pd-pc-row">
                        <div class="pd-pc-icon pd-icon-dept">🏢</div>
                        <div class="pd-pc-info">
                            <span class="pd-pc-lbl">DEPARTMENT</span>
                            <span class="pd-pc-val pd-text-dark">
                                <t t-if="state.personCardData.department" t-esc="state.personCardData.department"/>
                                <t t-else="">Not Assigned</t>
                            </span>
                        </div>
                    </div>
                    <div class="pd-pc-row" t-if="state.personCardData.email">
                        <div class="pd-pc-icon pd-icon-email">✉️</div>
                        <div class="pd-pc-info">
                            <span class="pd-pc-lbl">EMAIL ADDRESS</span>
                            <a t-att-href="'mailto:' + state.personCardData.email" class="pd-pc-val pd-text-blue" t-esc="state.personCardData.email"/>
                        </div>
                    </div>
                </div>
                <div class="pd-pc-footer">
                    <button class="pd-btn-close-blue" t-on-click="closePersonCard">Close</button>
                </div>
            </div>
        </div>
    </t>

</div>
    `;

    setup() {
        this.actionService = useService("action");

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        this.state = useState({
            loading: true,
            level: 1, // 1: Tag Cards, 2: Dept Cards, 3: Employee Cards & Task List
            selectedTagId: null,
            selectedTagName: '',
            selectedDeptId: null,
            selectedDeptName: '',
            collapsed_groups: {},
            showActivityModal: false,
            isEditMode: false,
            dashboardSearchQuery: '',
            personSearchQuery: '',
            calYear: today.getFullYear(),
            calMonth: today.getMonth() + 1,
            selectedPersonToSelect: '',
            showPersonCard: false,
            personCardData: null,
            activityForm: {
                event_id: null,
                source: 'calendar',
                type: 'meeting',
                date: todayStr,
                time_start: '09:00',
                time_stop: '10:00',
                summary: '',
                description: '',
                user_ids: []
            },
            data: {
                tag_cards: [],
                dept_cards: [],
                emp_cards: [],
                my_tasks: [],
                my_due_tasks: [],
                calendar_events: [],
                grouped_tasks_view: [],
                summary_totals: { time_spent: '0.00', overall_progress: 0 },
                filter_data: { tags: [], departments: [], employees: [] }
            }
        });

        // Listen for browser popstate
        this.onPopState = (event) => {
            const st = (event && event.state) || (window.history && window.history.state);
            if (st && st.pd_dashboard) {
                this.state.level = st.level || 1;
                this.state.selectedTagId = st.tagId || null;
                this.state.selectedTagName = st.tagName || '';
                this.state.selectedDeptId = st.deptId || null;
                this.state.selectedDeptName = st.deptName || '';
                this.saveStateToStorage();
                this.loadData();
            }
        };

        window.addEventListener('popstate', this.onPopState);

        onWillUnmount(() => {
            window.removeEventListener('popstate', this.onPopState);
        });

        onWillStart(async () => {
            let isBackFromTask = false;
            try {
                if (sessionStorage.getItem("pd_navigated_to_task") === "true") {
                    isBackFromTask = true;
                    sessionStorage.removeItem("pd_navigated_to_task");
                }
            } catch (e) { }

            if (isBackFromTask) {
                // Restore Level 3 (Cinema - ENGINEERING - Employee Dashboard)
                let saved = JSON.parse(sessionStorage.getItem("pd_active_level_state"));
                this.state.level = saved.level || 1;
                this.state.selectedTagId = saved.tagId;
                this.state.selectedDeptId = saved.deptId;
                this.state.selectedTagName = saved.tagName || '';
                this.state.selectedDeptName = saved.deptName || '';
            } else {
                // Fresh Sidebar Menu Touch -> Always default to Level 1 (Project List)
                this.state.level = 1;
                this.state.selectedTagId = null;
                this.state.selectedDeptId = null;
            }
            await this.loadData();
        });
    }

    saveStateToStorage() {
        try {
            sessionStorage.setItem("pd_active_level_state", JSON.stringify({
                level: this.state.level,
                tagId: this.state.selectedTagId,
                tagName: this.state.selectedTagName,
                deptId: this.state.selectedDeptId,
                deptName: this.state.selectedDeptName,
            }));
        } catch (e) { }
    }

    getTagCards() {
        let cards = (this.state.data && this.state.data.tag_cards) || [];
        if (this.state.dashboardSearchQuery) {
            const q = this.state.dashboardSearchQuery.toLowerCase();
            cards = cards.filter(c =>
                (c.name || '').toLowerCase().includes(q) ||
                (c.team || []).some(m => (m.name || '').toLowerCase().includes(q))
            );
        }
        return cards;
    }

    getDeptCards() {
        let cards = (this.state.data && this.state.data.dept_cards) || [];
        if (this.state.dashboardSearchQuery) {
            const q = this.state.dashboardSearchQuery.toLowerCase();
            cards = cards.filter(c =>
                (c.name || '').toLowerCase().includes(q) ||
                (c.team || []).some(m => (m.name || '').toLowerCase().includes(q))
            );
        }
        return cards;
    }

    getEmpCards() {
        let cards = (this.state.data && this.state.data.emp_cards) || [];
        if (this.state.dashboardSearchQuery) {
            const q = this.state.dashboardSearchQuery.toLowerCase();
            cards = cards.filter(c => (c.name || '').toLowerCase().includes(q));
        }
        return cards;
    }

    getMyTasks() {
        let tasks = (this.state.data && this.state.data.my_tasks) || [];
        if (this.state.dashboardSearchQuery) {
            const q = this.state.dashboardSearchQuery.toLowerCase();
            tasks = tasks.filter(t =>
                (t.project || '').toLowerCase().includes(q) ||
                (t.department || '').toLowerCase().includes(q) ||
                (t.task || '').toLowerCase().includes(q) ||
                (t.employee || '').toLowerCase().includes(q) ||
                (t.status || '').toLowerCase().includes(q)
            );
        }
        return tasks;
    }

    getMyDueTasks() {
        let tasks = (this.state.data && this.state.data.my_due_tasks) || [];
        if (this.state.dashboardSearchQuery) {
            const q = this.state.dashboardSearchQuery.toLowerCase();
            tasks = tasks.filter(t =>
                (t.project || '').toLowerCase().includes(q) ||
                (t.department || '').toLowerCase().includes(q) ||
                (t.task || '').toLowerCase().includes(q) ||
                (t.employee || '').toLowerCase().includes(q) ||
                (t.status || '').toLowerCase().includes(q)
            );
        }
        return tasks;
    }

    getGroupedTasks() {
        let groups = (this.state.data && this.state.data.grouped_tasks_view) || [];
        if (this.state.dashboardSearchQuery) {
            const q = this.state.dashboardSearchQuery.toLowerCase();
            groups = groups.map(grp => {
                const filteredTasks = (grp.tasks || []).filter(tk =>
                    (tk.title || '').toLowerCase().includes(q) ||
                    (tk.project_name || '').toLowerCase().includes(q) ||
                    (tk.tag_name || '').toLowerCase().includes(q) ||
                    (tk.stage || '').toLowerCase().includes(q)
                );
                if ((grp.employee_name || '').toLowerCase().includes(q)) {
                    return grp;
                } else if (filteredTasks.length > 0) {
                    return { ...grp, tasks: filteredTasks, count: filteredTasks.length };
                }
                return null;
            }).filter(g => g !== null);
        }
        return groups;
    }

    getEmployees() {
        return (this.state.data && this.state.data.filter_data && this.state.data.filter_data.employees) || [];
    }

    getSegmentDash(val, total) {
        if (!total || total === 0 || !val) return "0 100";
        const len = (val / total) * 100;
        return `${len.toFixed(2)} 100`;
    }

    getSegmentOffset(offsetVal, total) {
        if (!total || total === 0 || !offsetVal) return 0;
        const off = (offsetVal / total) * 100;
        return -off.toFixed(2);
    }

    async loadData() {
        this.state.loading = true;
        try {
            const params = {
                level: this.state.level,
                tag_id: this.state.selectedTagId,
                department_id: this.state.selectedDeptId,
            };
            const res = await rpc("/department_dashboard/data", params);
            if (res) {
                this.state.data = {
                    tag_cards: res.tag_cards || [],
                    dept_cards: res.dept_cards || [],
                    emp_cards: res.emp_cards || [],
                    my_tasks: res.my_tasks || [],
                    my_due_tasks: res.my_due_tasks || [],
                    calendar_events: res.calendar_events || [],
                    grouped_tasks_view: res.grouped_tasks_view || [],
                    summary_totals: res.summary_totals || { time_spent: '0.00', overall_progress: 0 },
                    filter_data: res.filter_data || { tags: [], departments: [], employees: [] }
                };
            }
        } catch (err) {
            console.error('[Dashboard] Fetch error:', err);
        } finally {
            this.state.loading = false;
        }
    }

    goBack() {
        if (this.state.level === 3) {
            this.goToLevel(2);
        } else if (this.state.level === 2) {
            this.goToLevel(1);
        }
    }

    goToLevel(lvl) {
        if (lvl === 1) {
            this.state.selectedTagId = null;
            this.state.selectedTagName = '';
            this.state.selectedDeptId = null;
            this.state.selectedDeptName = '';
        } else if (lvl === 2) {
            this.state.selectedDeptId = null;
            this.state.selectedDeptName = '';
        }
        this.state.level = lvl;

        try {
            window.history.pushState({
                pd_dashboard: true,
                level: lvl,
                tagId: this.state.selectedTagId,
                tagName: this.state.selectedTagName,
                deptId: this.state.selectedDeptId,
                deptName: this.state.selectedDeptName
            }, "");
        } catch (e) { }

        this.saveStateToStorage();
        this.loadData();
    }

    selectTag(tagId, tagName) {
        this.state.selectedTagId = tagId;
        this.state.selectedTagName = tagName || '';
        this.state.level = 2;

        try {
            window.history.pushState({
                pd_dashboard: true,
                level: 2,
                tagId: this.state.selectedTagId,
                tagName: this.state.selectedTagName,
                deptId: null,
                deptName: ''
            }, "");
        } catch (e) { }

        this.saveStateToStorage();
        this.loadData();
    }

    selectDepartment(deptId, deptName) {
        this.state.selectedDeptId = deptId;
        this.state.selectedDeptName = deptName || '';
        this.state.level = 3;

        try {
            window.history.pushState({
                pd_dashboard: true,
                level: 3,
                tagId: this.state.selectedTagId,
                tagName: this.state.selectedTagName,
                deptId: this.state.selectedDeptId,
                deptName: this.state.selectedDeptName
            }, "");
        } catch (e) { }

        this.saveStateToStorage();
        this.loadData();
    }

    toggleGroup(empId) {
        this.state.collapsed_groups[empId] = !this.state.collapsed_groups[empId];
    }

    createNewProject() {
        this.saveStateToStorage();
        this.actionService.doAction({
            type: 'ir.actions.act_window',
            res_model: 'project.project',
            views: [[false, 'form']],
            target: 'current',
        });
    }

    createNewTask() {
        this.saveStateToStorage();
        sessionStorage.setItem("pd_navigated_to_task", "true");
        const ctx = {};
        if (this.state.selectedTagId && this.state.selectedTagId !== 'untagged') {
            ctx['default_tag_ids'] = [[6, 0, [parseInt(this.state.selectedTagId)]]];
        }
        if (this.state.selectedDeptId && this.state.selectedDeptId !== 'no_dept') {
            ctx['default_department_id'] = parseInt(this.state.selectedDeptId);
        }
        ctx['dashboard_force_project_required'] = true;

        const deadlineDate = new Date();
        deadlineDate.setDate(deadlineDate.getDate() + 3);
        const yyyy = deadlineDate.getFullYear();
        const mm = String(deadlineDate.getMonth() + 1).padStart(2, '0');
        const dd = String(deadlineDate.getDate()).padStart(2, '0');
        ctx['default_date_deadline'] = `${yyyy}-${mm}-${dd}`;

        this.actionService.doAction({
            type: 'ir.actions.act_window',
            res_model: 'project.task',
            views: [[false, 'form']],
            context: ctx,
            target: 'current',
        });
    }

    openTask(taskId) {
        if (!taskId) return;
        this.saveStateToStorage();
        sessionStorage.setItem("pd_navigated_to_task", "true");
        this.actionService.doAction({
            type: 'ir.actions.act_window',
            res_model: 'project.task',
            res_id: taskId,
            views: [[false, 'form']],
            context: {
                from_dashboard: 1,
            },
            target: 'current',
        });
    }

    openEmployeeTasks(empId, empName) {
        this.saveStateToStorage();
        sessionStorage.setItem("pd_navigated_to_task", "true");
        const domain = [];
        if (empId && empId !== 'unassigned') {
            domain.push(['user_ids', 'in', [parseInt(empId)]]);
        } else {
            domain.push(['user_ids', '=', false]);
        }

        if (this.state.selectedTagId && this.state.selectedTagId !== 'untagged') {
            const tId = parseInt(this.state.selectedTagId);
            domain.push('|', ['tag_ids', 'in', [tId]], ['project_id.tag_ids', 'in', [tId]]);
        } else if (this.state.selectedTagId === 'untagged') {
            domain.push(['tag_ids', '=', false], '|', ['project_id', '=', false], ['project_id.tag_ids', '=', false]);
        }

        if (this.state.selectedDeptId && this.state.selectedDeptId !== 'no_dept') {
            const dId = parseInt(this.state.selectedDeptId);
            domain.push('|', ['department_id', '=', dId], ['project_id.department_id', '=', dId]);
        } else if (this.state.selectedDeptId === 'no_dept') {
            domain.push(['department_id', '=', false], '|', ['project_id', '=', false], ['project_id.department_id', '=', false]);
        }

        const actionName = empName ? `Tasks - ${empName}` : 'Tasks';

        this.actionService.doAction({
            type: 'ir.actions.act_window',
            name: actionName,
            res_model: 'project.task',
            views: [[false, 'list'], [false, 'kanban'], [false, 'form']],
            domain: domain,
            context: {
                from_dashboard: 1,
                search_default_group_by_stage: 1,
                group_by: 'stage_id',
            },
            target: 'current',
        });
    }

    exportData() {
        let csv = "data:text/csv;charset=utf-8,Name,Total,Done,Pending,Due,Hold\n";
        const cards = this.state.level === 1 ? this.getTagCards() : (
            this.state.level === 2 ? this.getDeptCards() : this.getEmpCards()
        );
        cards.forEach(c => {
            csv += `"${c.name || ''}",${c.total || 0},${c.done || 0},${c.pending || 0},${c.due || 0},${c.hold || 0}\n`;
        });
        const encodedUri = encodeURI(csv);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `dashboard_export_level${this.state.level}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    onDateClick(dateStr) {
        if (!dateStr) return;
        const emps = this.getEmployees();
        const defaultUserIds = emps.length > 0 ? [emps[0].id] : [];
        this.state.isEditMode = false;
        this.state.isEventEditable = true;
        this.state.personSearchQuery = '';
        this.state.selectedPersonToSelect = '';
        this.state.activityForm = {
            event_id: null,
            source: 'calendar',
            type: 'meeting',
            date: dateStr,
            time_start: '09:00',
            time_stop: '10:00',
            summary: '',
            description: '',
            user_ids: defaultUserIds
        };
        this.state.showActivityModal = true;
    }

    onEventClick(ev) {
        if (!ev) return;
        this.state.isEditMode = true;
        this.state.isEventEditable = ev.is_editable !== false;
        this.state.personSearchQuery = '';
        this.state.selectedPersonToSelect = '';

        let cleanDesc = ev.description || '';
        if (cleanDesc && cleanDesc.includes('<')) {
            const tmp = document.createElement('div');
            tmp.innerHTML = cleanDesc;
            cleanDesc = tmp.textContent || tmp.innerText || '';
        }

        this.state.activityForm = {
            event_id: ev.id,
            source: ev.source || 'calendar',
            type: ev.type || 'meeting',
            date: ev.date,
            time_start: ev.time_start || '09:00',
            time_stop: ev.time_stop || '10:00',
            summary: ev.title || '',
            description: cleanDesc,
            user_ids: (ev.user_ids && ev.user_ids.length > 0) ? [...ev.user_ids] : (this.getEmployees().length > 0 ? [this.getEmployees()[0].id] : [])
        };
        this.state.showActivityModal = true;
    }

    openActivityModal(dateStr = null) {
        const today = new Date();
        const dStr = dateStr || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        this.onDateClick(dStr);
    }

    closeActivityModal() {
        this.state.showActivityModal = false;
        this.state.isEditMode = false;
        this.state.personSearchQuery = '';
    }

    async saveActivity(markDone = false) {
        if (!this.state.activityForm.summary || !this.state.activityForm.summary.trim()) {
            alert("Please enter a summary / subject for the event.");
            return;
        }
        if (!this.state.activityForm.user_ids || this.state.activityForm.user_ids.length === 0) {
            alert("Please select at least one assigned person / attendee.");
            return;
        }

        try {
            this.state.loading = true;
            const res = await rpc("/department_dashboard/save_event", {
                event_id: this.state.activityForm.event_id || null,
                source: this.state.activityForm.source || 'calendar',
                title: this.state.activityForm.summary,
                date: this.state.activityForm.date,
                time_start: this.state.activityForm.time_start || '09:00',
                time_stop: this.state.activityForm.time_stop || '10:00',
                activity_type: this.state.activityForm.type || 'meeting',
                user_ids: this.state.activityForm.user_ids,
                description: this.state.activityForm.description || '',
                mark_done: markDone === true,
            });
            if (res && res.status === 'success') {
                this.closeActivityModal();
                await this.loadData();
            } else {
                alert("Failed to save event: " + (res ? res.message : "Unknown error"));
            }
        } catch (err) {
            console.error("[Dashboard] Save event error:", err);
            alert("Error saving event: " + (err.message || err));
        } finally {
            this.state.loading = false;
        }
    }

    async deleteEvent() {
        if (!this.state.activityForm.event_id) return;
        if (!confirm("Are you sure you want to delete this event/meeting?")) return;

        try {
            this.state.loading = true;
            const res = await rpc("/department_dashboard/delete_event", {
                event_id: this.state.activityForm.event_id,
                source: this.state.activityForm.source || 'calendar',
            });
            if (res && res.status === 'success') {
                this.closeActivityModal();
                await this.loadData();
            } else {
                alert("Failed to delete event: " + (res ? res.message : "Unknown error"));
            }
        } catch (err) {
            console.error("[Dashboard] Delete event error:", err);
            alert("Error deleting event: " + (err.message || err));
        } finally {
            this.state.loading = false;
        }
    }

    getCalendarMonthName() {
        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        return months[(this.state.calMonth || 1) - 1] || "";
    }

    getCalendarEvents(dateStr) {
        let evs = (this.state.data.calendar_events || []).filter(e => e.date === dateStr);
        if (this.state.dashboardSearchQuery) {
            const q = this.state.dashboardSearchQuery.toLowerCase();
            evs = evs.filter(e =>
                (e.title || '').toLowerCase().includes(q) ||
                (e.user_name || '').toLowerCase().includes(q) ||
                (e.description || '').toLowerCase().includes(q)
            );
        }
        return evs;
    }

    getCalendarGrid() {
        const year = parseInt(this.state.calYear);
        const month = parseInt(this.state.calMonth);

        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);

        const totalDays = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();

        const prevMonthLastDay = new Date(year, month - 1, 0).getDate();

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const grid = [];

        // Previous month padding
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const dNum = prevMonthLastDay - i;
            const pMonth = month === 1 ? 12 : month - 1;
            const pYear = month === 1 ? year - 1 : year;
            const dateStr = `${pYear}-${String(pMonth).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
            grid.push({
                day: dNum,
                month: pMonth,
                year: pYear,
                dateStr: dateStr,
                isCurrentMonth: false,
                isToday: dateStr === todayStr,
                events: this.getCalendarEvents(dateStr)
            });
        }

        // Current month days
        for (let d = 1; d <= totalDays; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            grid.push({
                day: d,
                month: month,
                year: year,
                dateStr: dateStr,
                isCurrentMonth: true,
                isToday: dateStr === todayStr,
                events: this.getCalendarEvents(dateStr)
            });
        }

        // Next month padding to complete grid
        const remaining = (42 - (grid.length % 42)) % 42;
        const totalPad = grid.length < 35 ? 35 - grid.length : (remaining > 7 ? remaining % 7 : remaining);
        for (let n = 1; n <= totalPad; n++) {
            const nMonth = month === 12 ? 1 : month + 1;
            const nYear = month === 12 ? year + 1 : year;
            const dateStr = `${nYear}-${String(nMonth).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
            grid.push({
                day: n,
                month: nMonth,
                year: nYear,
                dateStr: dateStr,
                isCurrentMonth: false,
                isToday: dateStr === todayStr,
                events: this.getCalendarEvents(dateStr)
            });
        }

        return grid;
    }

    prevMonth() {
        if (this.state.calMonth === 1) {
            this.state.calMonth = 12;
            this.state.calYear -= 1;
        } else {
            this.state.calMonth -= 1;
        }
    }

    nextMonth() {
        if (this.state.calMonth === 12) {
            this.state.calMonth = 1;
            this.state.calYear += 1;
        } else {
            this.state.calMonth += 1;
        }
    }

    goToToday() {
        const today = new Date();
        this.state.calYear = today.getFullYear();
        this.state.calMonth = today.getMonth() + 1;
    }

    onMonthSelect(ev) {
        if (ev && ev.target) {
            this.state.calMonth = parseInt(ev.target.value);
        }
    }

    getUserName(uid) {
        const emp = this.getEmployees().find(e => e.id === uid);
        return emp ? emp.name : `User ${uid}`;
    }

    getUserInitials(uid) {
        const name = this.getUserName(uid);
        if (!name) return "U";
        const parts = name.trim().split(" ");
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    getAvailableEmployees() {
        const selectedIds = this.state.activityForm.user_ids || [];
        let emps = this.getEmployees().filter(e => !selectedIds.includes(e.id));
        if (this.state.personSearchQuery && this.state.personSearchQuery.trim()) {
            const q = this.state.personSearchQuery.toLowerCase().trim();
            emps = emps.filter(e => (e.name || '').toLowerCase().includes(q));
        }
        return emps;
    }

    addSelectedPerson() {
        const pid = parseInt(this.state.selectedPersonToSelect);
        if (pid && !(this.state.activityForm.user_ids || []).includes(pid)) {
            this.state.activityForm.user_ids = [...(this.state.activityForm.user_ids || []), pid];
            this.state.selectedPersonToSelect = '';
        }
    }

    openPersonCard(uid) {
        if (!this.state.data || !this.state.data.filter_data || !this.state.data.filter_data.employees) return;
        const emp = this.state.data.filter_data.employees.find(e => e.id === uid);
        if (emp) {
            this.state.personCardData = emp;
            this.state.showPersonCard = true;
        }
    }

    closePersonCard() {
        this.state.showPersonCard = false;
        this.state.personCardData = null;
    }

    onPersonDropdownChange(ev) {
        if (ev && ev.target && ev.target.value) {
            const pid = parseInt(ev.target.value);
            if (pid && !(this.state.activityForm.user_ids || []).includes(pid)) {
                this.state.activityForm.user_ids = [...(this.state.activityForm.user_ids || []), pid];
                this.state.selectedPersonToSelect = '';
            }
        }
    }

    removePerson(uid) {
        this.state.activityForm.user_ids = (this.state.activityForm.user_ids || []).filter(id => id !== uid);
    }
}

registry.category("actions").add("department_dashboard_action", DepartmentDashboard);
