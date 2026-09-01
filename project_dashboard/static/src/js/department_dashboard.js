/** @odoo-module **/
/**
 * 3-Level Multi-Tier Dashboard — OWL Component (Odoo 18)
 *
 * Implements the exact 3-level dashboard flow matching Image 1:
 *   - Level 1: Project List Main Dashboard (Tag-based cards)
 *   - Level 2: Department Dashboard (Drilled into Tag)
 *   - Level 3: Employee Dashboard (Drilled into Department) + Grouped Task List View
 */

import { Component, useState, onWillStart, onWillUnmount, xml, markup } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { rpc } from "@web/core/network/rpc";
import { useService } from "@web/core/utils/hooks";
import { user } from "@web/core/user";
import { MeetingCalendar } from "./meeting_calendar";

export class DepartmentDashboard extends Component {
    static components = { MeetingCalendar };

    static template = xml/* xml */`
<div class="pd-wrap">

    <!-- ══ Header & Navigation Breadcrumbs ════════════════════════════════ -->
    <div class="pd-header">
        <div class="pd-header-left">
            <div class="pd-breadcrumb-trail">
                <t t-if="state.level > state.baseLevel || state.baseLevel === 2 || state.selectedFirmId">
                    <button class="pd-btn-back" t-on-click="() => this.goBack()">
                        <i class="fa fa-arrow-left"/> Back
                    </button>
                </t>
                <t t-if="state.baseLevel === 1">
                    <span class="pd-bc-item" t-on-click="() => this.goToLevel(1)">Project List</span>
                    <t t-if="state.level >= 2">
                        <span class="pd-bc-sep">/</span>
                        <span class="pd-bc-item" t-att-class="{ 'active': state.level === 2 }" t-on-click="() => this.goToLevel(2)">
                            <t t-esc="state.selectedTagName || ''"/> - Department Dashboard
                        </span>
                    </t>
                </t>
                <t t-if="state.baseLevel === 2">
                    <span class="pd-bc-item" t-on-click="() => this.goToLevel(2)">
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
            <div class="pd-title-row" style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                <div>
                    <h1 class="pd-title">
                        <t t-if="state.level === 1">Project List</t>
                        <t t-elif="state.level === 2"><t t-esc="state.selectedTagName || ''"/> - Department Dashboard</t>
                        <t t-elif="state.level === 3"><t t-esc="state.selectedTagName || ''"/> - <t t-esc="state.selectedDeptName || ''"/> - Employee Dashboard</t>
                    </h1>
                    <p class="pd-subtitle">Live overview of projects</p>
                </div>
            </div>
        </div>

        <div class="pd-header-actions">
            <select class="pd-filter-select" t-model="state.dateFilter" t-on-change="onDateFilterChange" style="padding: 6px 12px; border-radius: 20px; border: 1.5px solid #cbd5e1; font-size: 13px; font-weight: 600; color: #475569; background: white; cursor: pointer; outline: none; margin-right: 8px;">
                <option value="all">📅 All</option>
                <option value="today">Today</option>
                <option value="next_7">Next 7 Days</option>
                <option value="last_7">Last 7 Days</option>
                <option value="last_month">Last Month</option>
            </select>
            <div class="pd-search-box">
                <input type="text" class="pd-search-input" placeholder="Search by name..." t-model="state.dashboardSearchQuery"/>
                <i class="fa fa-search pd-search-icon"></i>
            </div>
            <t t-if="state.level === 1">
                <t t-if="state.is_project_manager">
                    <button class="pd-btn-primary" t-on-click="createNewProject">+ New Project</button>
                </t>
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
                <!-- MGMT Discussion Column -->
                <div class="pd-table-column">
                    <div class="pd-table-column-title">MGMT Discussion</div>
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
                                    <tr t-on-click="() => this.openTaskDetailModal(row)" style="cursor: pointer;" title="Click to view task details and activity log">
                                        <td t-esc="row.project || ''"/>
                                        <td t-esc="row.department || ''"/>
                                        <td class="pd-truncate" t-att-title="row.task || ''">
                                            <t t-if="row.priority == '1'">
                                                <i class="fa fa-minus" style="color: #eab308; margin-right: 4px;" title="Medium Priority"></i>
                                            </t>
                                            <t t-elif="row.priority == '2'">
                                                <i class="fa fa-arrow-up" style="color: #f97316; margin-right: 4px;" title="High Priority"></i>
                                            </t>
                                            <t t-elif="row.priority == '3'">
                                                <i class="fa fa-exclamation" style="color: #ef4444; margin-right: 4px;" title="Urgent Priority"></i>
                                            </t>
                                            <t t-else="">
                                                <i class="fa fa-circle" style="color: #3b82f6; margin-right: 4px;" title="Low Priority"></i>
                                            </t>
                                            <t t-esc="row.task || ''"/>
                                        </td>
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
                                    <tr t-on-click="() => this.openTaskDetailModal(row)" style="cursor: pointer;" title="Click to view task details and activity log">
                                        <td t-esc="row.project || ''"/>
                                        <td t-esc="row.department || ''"/>
                                        <td class="pd-truncate" t-att-title="row.task || ''">
                                            <t t-if="row.priority == '1'">
                                                <i class="fa fa-minus" style="color: #eab308; margin-right: 4px;" title="Medium Priority"></i>
                                            </t>
                                            <t t-elif="row.priority == '2'">
                                                <i class="fa fa-arrow-up" style="color: #f97316; margin-right: 4px;" title="High Priority"></i>
                                            </t>
                                            <t t-elif="row.priority == '3'">
                                                <i class="fa fa-exclamation" style="color: #ef4444; margin-right: 4px;" title="Urgent Priority"></i>
                                            </t>
                                            <t t-else="">
                                                <i class="fa fa-circle" style="color: #3b82f6; margin-right: 4px;" title="Low Priority"></i>
                                            </t>
                                            <t t-esc="row.task || ''"/>
                                        </td>
                                        <td class="pd-truncate" t-att-title="row.employee || ''" t-esc="row.employee || ''"/>
                                        <td>
                                            <span t-att-class="'pd-pill pd-pill-' + (row.status ? row.status.toLowerCase().replace(' ', '-') : 'pending')" t-esc="row.status || ''"/>
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
                            <th style="width: 22%;">Title</th>
                            <th>Project</th>
                            <th>Created By</th>
                            <th>Assignees</th>
                            <th style="width: 13%;">Progress</th>
                            <th>Days Open</th>
                            <th>Date Deadline</th>
                            <th>Next Activity</th>
                            <th>Tags</th>
                            <th>Stage</th>
                        </tr>
                    </thead>
                    <tbody>
                        <t t-foreach="getGroupedTasks()" t-as="grp" t-key="grp.employee_id">
                            <!-- Group Header Row -->
                            <tr class="pd-grp-hdr-row" t-on-click="() => this.toggleGroup(grp.employee_id)">
                                <td colspan="10">
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
                                            <div class="pd-team-stack" style="display: inline-flex; align-items: center; gap: 4px;">
                                                <t t-if="tk.create_uid_avatar">
                                                    <img t-att-src="tk.create_uid_avatar" class="pd-avatar-img" t-att-title="tk.create_uid_name || ''"/>
                                                </t>
                                                <t t-elif="tk.create_uid_name">
                                                    <span class="pd-avatar-circle" t-att-title="tk.create_uid_name || ''"><t t-esc="tk.create_uid_initials || ''"/></span>
                                                </t>
                                                <span t-esc="tk.create_uid_name || ''" style="font-size: 12px; font-weight: 500;"/>
                                            </div>
                                        </td>
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
                                        <td t-esc="tk.date_deadline || ''"/>
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
                            <td colspan="4"><b>Total Summary</b></td>
                            <td>
                                <div class="pd-prog-bar-cell">
                                    <span class="pd-prog-pct" t-esc="((state.data &amp;&amp; state.data.summary_totals &amp;&amp; state.data.summary_totals.overall_progress) || 0) + '%'"/>
                                    <div class="pd-prog-track">
                                        <div class="pd-prog-fill" t-att-style="'width:' + ((state.data &amp;&amp; state.data.summary_totals &amp;&amp; state.data.summary_totals.overall_progress) || 0) + '%'"/>
                                    </div>
                                </div>
                            </td>
                            <td colspan="5"></td>
                        </tr>
                    </tfoot>
                    </table>
                </div>
            </div>
        </t>

        <!-- ── BOTTOM SECTION: Meeting Calendar (Levels 1 & 2) ─────────────── -->
        <t t-if="state.level &lt; 3">
            <MeetingCalendar
                level="state.level"
                data="state.data"
                searchQuery="state.dashboardSearchQuery"
                isUserAdmin="state.data.is_admin"
                onScheduleActivity="() => this.openActivityModal()"
                onDateClick="(dateStr) => this.onDateClick(dateStr)"
                onEventClick="(ev) => this.onEventClick(ev)"
            />
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
                        <div style="display:flex; gap:6px; align-items:center; flex-wrap:nowrap; width:100%;">
                            <input type="date" t-model="state.activityForm.date" class="pd-form-input" style="flex: 1; padding:4px 6px; min-width: 120px;" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined"/>
                            <div class="pd-form-input" style="display:inline-flex; gap:1px !important; padding: 4px 4px !important; align-items:center; width:max-content !important; flex: 0 0 auto !important;" title="Start Time">
                                <select t-model="state.activityForm.start_h" style="border:none !important; background:transparent !important; outline:none !important; padding:0 !important; margin:0 !important; appearance:none !important; -webkit-appearance:none !important; cursor:pointer; text-align:center; width:20px !important; min-width:20px !important; max-width:20px !important; flex:none !important;" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined">
                                    <option value="12">12</option><option value="01">01</option><option value="02">02</option>
                                    <option value="03">03</option><option value="04">04</option><option value="05">05</option>
                                    <option value="06">06</option><option value="07">07</option><option value="08">08</option>
                                    <option value="09">09</option><option value="10">10</option><option value="11">11</option>
                                </select>
                                <span style="font-weight:bold; margin:0 1px; flex:none !important;">:</span>
                                <select t-model="state.activityForm.start_m" style="border:none !important; background:transparent !important; outline:none !important; padding:0 !important; margin:0 !important; appearance:none !important; -webkit-appearance:none !important; cursor:pointer; text-align:center; width:20px !important; min-width:20px !important; max-width:20px !important; flex:none !important;" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined">
                                    <option value="00">00</option><option value="01">01</option><option value="02">02</option><option value="03">03</option><option value="04">04</option><option value="05">05</option><option value="06">06</option><option value="07">07</option><option value="08">08</option><option value="09">09</option>
                                    <option value="10">10</option><option value="11">11</option><option value="12">12</option><option value="13">13</option><option value="14">14</option><option value="15">15</option><option value="16">16</option><option value="17">17</option><option value="18">18</option><option value="19">19</option>
                                    <option value="20">20</option><option value="21">21</option><option value="22">22</option><option value="23">23</option><option value="24">24</option><option value="25">25</option><option value="26">26</option><option value="27">27</option><option value="28">28</option><option value="29">29</option>
                                    <option value="30">30</option><option value="31">31</option><option value="32">32</option><option value="33">33</option><option value="34">34</option><option value="35">35</option><option value="36">36</option><option value="37">37</option><option value="38">38</option><option value="39">39</option>
                                    <option value="40">40</option><option value="41">41</option><option value="42">42</option><option value="43">43</option><option value="44">44</option><option value="45">45</option><option value="46">46</option><option value="47">47</option><option value="48">48</option><option value="49">49</option>
                                    <option value="50">50</option><option value="51">51</option><option value="52">52</option><option value="53">53</option><option value="54">54</option><option value="55">55</option><option value="56">56</option><option value="57">57</option><option value="58">58</option><option value="59">59</option>
                                </select>
                                <select t-model="state.activityForm.start_ampm" style="border:none !important; background:transparent !important; outline:none !important; padding:0 !important; margin:0 0 0 2px !important; appearance:none !important; -webkit-appearance:none !important; cursor:pointer; color:#4b5563; font-weight:500; text-align:center; width:28px !important; min-width:28px !important; max-width:28px !important; flex:none !important;" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined">
                                    <option value="AM">AM</option><option value="PM">PM</option>
                                </select>
                            </div>
                            <span style="color:#9ca3af; flex: 0 0 auto; margin: 0 2px;">-</span>
                            <div class="pd-form-input" style="display:inline-flex; gap:1px !important; padding: 4px 4px !important; align-items:center; width:max-content !important; flex: 0 0 auto !important;" title="End Time">
                                <select t-model="state.activityForm.stop_h" style="border:none !important; background:transparent !important; outline:none !important; padding:0 !important; margin:0 !important; appearance:none !important; -webkit-appearance:none !important; cursor:pointer; text-align:center; width:20px !important; min-width:20px !important; max-width:20px !important; flex:none !important;" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined">
                                    <option value="12">12</option><option value="01">01</option><option value="02">02</option>
                                    <option value="03">03</option><option value="04">04</option><option value="05">05</option>
                                    <option value="06">06</option><option value="07">07</option><option value="08">08</option>
                                    <option value="09">09</option><option value="10">10</option><option value="11">11</option>
                                </select>
                                <span style="font-weight:bold; margin:0 1px; flex:none !important;">:</span>
                                <select t-model="state.activityForm.stop_m" style="border:none; background:transparent; outline:none; padding:0 !important; margin:0 !important; appearance:none !important; -webkit-appearance:none !important; cursor:pointer; text-align:center; width:20px !important; min-width:20px !important; max-width:20px !important; flex:none !important;" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined">
                                    <option value="00">00</option><option value="01">01</option><option value="02">02</option><option value="03">03</option><option value="04">04</option><option value="05">05</option><option value="06">06</option><option value="07">07</option><option value="08">08</option><option value="09">09</option>
                                    <option value="10">10</option><option value="11">11</option><option value="12">12</option><option value="13">13</option><option value="14">14</option><option value="15">15</option><option value="16">16</option><option value="17">17</option><option value="18">18</option><option value="19">19</option>
                                    <option value="20">20</option><option value="21">21</option><option value="22">22</option><option value="23">23</option><option value="24">24</option><option value="25">25</option><option value="26">26</option><option value="27">27</option><option value="28">28</option><option value="29">29</option>
                                    <option value="30">30</option><option value="31">31</option><option value="32">32</option><option value="33">33</option><option value="34">34</option><option value="35">35</option><option value="36">36</option><option value="37">37</option><option value="38">38</option><option value="39">39</option>
                                    <option value="40">40</option><option value="41">41</option><option value="42">42</option><option value="43">43</option><option value="44">44</option><option value="45">45</option><option value="46">46</option><option value="47">47</option><option value="48">48</option><option value="49">49</option>
                                    <option value="50">50</option><option value="51">51</option><option value="52">52</option><option value="53">53</option><option value="54">54</option><option value="55">55</option><option value="56">56</option><option value="57">57</option><option value="58">58</option><option value="59">59</option>
                                </select>
                                <select t-model="state.activityForm.stop_ampm" style="border:none !important; background:transparent !important; outline:none !important; padding:0 !important; margin:0 0 0 2px !important; appearance:none !important; -webkit-appearance:none !important; cursor:pointer; color:#4b5563; font-weight:500; text-align:center; width:28px !important; min-width:28px !important; max-width:28px !important; flex:none !important;" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined">
                                    <option value="AM">AM</option><option value="PM">PM</option>
                                </select>
                            </div>
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

                        <!-- Search & Add Person Controls: Department -> Person -> Add -->
                        <div t-if="state.isEventEditable" class="pd-add-person-row" style="margin-top:10px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            <!-- 1. Department Selection Dropdown -->
                            <select class="pd-form-input" t-model="state.selectedDepartmentToSelect" t-on-change="onDepartmentSelectChange" style="flex:1; min-width: 140px;">
                                <option value="">-- Select Department --</option>
                                <t t-foreach="getAvailableDepartments()" t-as="d" t-key="d.name">
                                    <option t-att-value="d.name" t-esc="d.name + ' (' + d.count + ')'"/>
                                </t>
                            </select>

                            <!-- 2. User Selection Dropdown (shows users of selected department) -->
                            <select class="pd-form-input pd-person-select" t-model="state.selectedPersonToSelect" t-on-change="onPersonDropdownChange" style="flex:1.2; min-width: 160px;">
                                <option value="">-- Select Person to Add --</option>
                                <t t-foreach="getAvailableEmployees()" t-as="e" t-key="e.id">
                                    <option t-att-value="e.id" t-esc="e.name || ''"/>
                                </t>
                            </select>

                            <button type="button" class="pd-btn-add-person" t-on-click="addSelectedPerson" style="display: none;">
                                ➕ Add
                            </button>
                        </div>
                    </div>
                </div>
                <div class="pd-modal-ftr">
                    <t t-if="state.isEditMode &amp;&amp; state.isEventEditable">
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
    <t t-if="state.showPersonCard &amp;&amp; state.personCardData">
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

    <!-- ══ Unified Single-Page Task Details & Analytics Popup Modal ══════════════ -->
    <t t-if="state.showTaskDetailModal">
        <div class="pd-modal-overlay" t-on-click="closeTaskDetailModal">
            <div class="pd-task-popup-modal" t-on-click.stop="">
                <!-- Header -->
                <div class="pd-task-popup-hdr">
                    <div class="pd-task-popup-hdr-top">
                        <span class="pd-task-popup-title pd-task-popup-title-link" t-att-title="'Click to open task in Odoo' + (state.taskDetailData ? ': ' + state.taskDetailData.name : '')" t-on-click="() => this.openTask(state.taskDetailData ? state.taskDetailData.id : null)">
                            Task Details - <t t-esc="state.taskDetailData ? (state.taskDetailData.name || state.taskDetailData.task) : 'Loading...'"/>
                        </span>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <button type="button" class="pd-btn-open-task" t-if="state.taskDetailData &amp;&amp; state.taskDetailData.id" t-on-click="() => this.openTask(state.taskDetailData.id)" title="Open full task in Odoo">
                                <i class="fa fa-external-link"/> <span>Open Task</span> <span>↗</span>
                            </button>
                            <span class="pd-modal-close" style="font-size: 16px; cursor: pointer; color: #94a3b8;" t-on-click="closeTaskDetailModal">✕</span>
                        </div>
                    </div>
                </div>

                <!-- Scrollable Body (All information in one seamless page) -->
                <div class="pd-task-popup-body">
                    <t t-if="state.taskDetailLoading">
                        <div style="display: flex; align-items: center; justify-content: center; padding: 60px 0; color: #64748b; gap: 10px;">
                            <i class="fa fa-circle-o-notch fa-spin fa-2x"/>
                            <span style="font-size: 14px; font-weight: 500;">Loading task details...</span>
                        </div>
                    </t>
                    <t t-elif="state.taskDetailData">
                        
                        <!-- ── 1. UNEDITABLE FORM CONTROLS GRID ── -->
                        <div class="pd-task-form-grid">
                            <div class="pd-form-field">
                                <label class="pd-form-lbl">Project</label>
                                <div class="pd-form-input-readonly">
                                    <span t-esc="state.taskDetailData.project || 'No Project'"/>
                                    <span class="pd-chevron">▼</span>
                                </div>
                            </div>
                            <div class="pd-form-field">
                                <label class="pd-form-lbl">Department</label>
                                <div class="pd-form-input-readonly">
                                    <span t-esc="state.taskDetailData.department || 'General'"/>
                                    <span class="pd-chevron">▼</span>
                                </div>
                            </div>
                            <div class="pd-form-field">
                                <label class="pd-form-lbl">Status</label>
                                <div class="pd-form-input-readonly">
                                    <span t-esc="state.taskDetailData.status_label || 'In Progress'"/>
                                    <span class="pd-chevron">▼</span>
                                </div>
                            </div>
                            <div class="pd-form-field">
                                <label class="pd-form-lbl">Due Date</label>
                                <div class="pd-form-input-readonly">
                                    <span t-esc="state.taskDetailData.due_date_dmy || state.taskDetailData.due_date || ''"/>
                                    <i class="fa fa-calendar" style="color: #64748b; font-size: 13px;"/>
                                </div>
                            </div>
                            <div class="pd-form-field">
                                <label class="pd-form-lbl">Stage &amp; Priority</label>
                                <div class="pd-form-input-readonly">
                                    <span>
                                        <t t-esc="state.taskDetailData.stage || 'New'"/>
                                        <t t-if="state.taskDetailData.priority_label">
                                            • <t t-esc="state.taskDetailData.priority_label"/>
                                        </t>
                                    </span>
                                    <i class="fa fa-tag" style="color: #94a3b8; font-size: 12px;"/>
                                </div>
                            </div>
                            <div class="pd-form-field">
                                <label class="pd-form-lbl">Created By</label>
                                <div class="pd-form-input-readonly">
                                    <div style="display: flex; align-items: center; gap: 7px;">
                                        <img t-if="state.taskDetailData.created_by_avatar" t-att-src="state.taskDetailData.created_by_avatar" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;"/>
                                        <span t-else="" class="pd-assignee-avatar" style="width: 20px; height: 20px; font-size: 9px;"><t t-esc="state.taskDetailData.created_by_initials || 'U'"/></span>
                                        <span t-esc="state.taskDetailData.created_by || 'System'"/>
                                    </div>
                                    <i class="fa fa-user-o" style="color: #94a3b8; font-size: 12px;"/>
                                </div>
                            </div>
                        </div>

                        <!-- ── 2. ASSIGNED EMPLOYEES ── -->
                        <div class="pd-form-field">
                            <label class="pd-form-lbl">Assigned Employee(s)</label>
                            <div class="pd-assignee-chips-wrap">
                                <t t-if="state.taskDetailData.assignees &amp;&amp; state.taskDetailData.assignees.length &gt; 0">
                                    <t t-foreach="state.taskDetailData.assignees" t-as="asgn" t-key="asgn.id">
                                        <div class="pd-assignee-chip" style="cursor: pointer;" t-on-click="() => this.openPersonCard(asgn.id)">
                                            <img t-if="asgn.avatar" t-att-src="asgn.avatar" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;"/>
                                            <span t-else="" class="pd-assignee-avatar"><t t-esc="asgn.initials"/></span>
                                            <span t-esc="asgn.name"/>
                                        </div>
                                    </t>
                                </t>
                                <t t-elif="state.taskDetailData.employee &amp;&amp; state.taskDetailData.employee !== 'Unassigned'">
                                    <t t-foreach="state.taskDetailData.employee.split(',')" t-as="empName" t-key="empName">
                                        <div class="pd-assignee-chip">
                                            <span class="pd-assignee-avatar"><t t-esc="this.getInitials(empName)"/></span>
                                            <span t-esc="empName.trim()"/>
                                        </div>
                                    </t>
                                </t>
                                <t t-else="">
                                    <span style="font-size: 13px; color: #64748b; font-style: italic;">Unassigned</span>
                                </t>
                            </div>
                        </div>

                        <!-- ── 3. DESCRIPTION & NOTES ── -->
                        <div class="pd-form-field">
                            <label class="pd-form-lbl"><i class="fa fa-align-left" style="margin-right: 4px;"/> Description / Notes</label>
                            <div class="pd-task-desc-card">
                                <t t-if="state.taskDetailData.description">
                                    <div t-out="renderMarkup(state.taskDetailData.description)"/>
                                </t>
                                <t t-else="">
                                    <span style="color: #94a3b8; font-style: italic;">No description notes entered for this task.</span>
                                </t>
                            </div>
                        </div>

                        <!-- ── 4. PROJECT STAGE PROGRESSION ANALYTICS (PIE CHART) ── -->
                        <div class="pd-task-analytics-card">
                            <div class="pd-task-analytics-title">PROJECT STAGE PROGRESSION ANALYTICS</div>
                            <div class="pd-analytics-body">
                                <!-- Pie Chart: Current Stage (Green) vs Remaining Stages Pending (Amber) -->
                                <div class="pd-pie-chart-wrap">
                                    <div t-att-style="'width: 100px; height: 100px; border-radius: 50%; background: conic-gradient(#10b981 0% ' + (state.taskDetailData.analytics?.stage_progress_pct || 0) + '%, #f59e0b ' + (state.taskDetailData.analytics?.stage_progress_pct || 0) + '% 100%); box-shadow: 0 2px 8px rgba(0,0,0,0.08);'"/>
                                </div>

                                <!-- Legend -->
                                <div class="pd-analytics-legend">
                                    <div class="pd-legend-item">
                                        <div class="pd-legend-label">
                                            <span class="pd-legend-box pd-legend-box-green"/>
                                            <span>Current Stage (<t t-esc="state.taskDetailData.stage || 'In Progress'"/>)</span>
                                        </div>
                                        <span class="pd-legend-pct" style="color: #059669;">
                                            <t t-esc="(state.taskDetailData.analytics?.stage_progress_pct || 0).toFixed(2)"/>%
                                            <span style="font-size: 11px; font-weight: normal; color: #64748b; margin-left: 3px;">
                                                (Stage <t t-esc="state.taskDetailData.analytics?.current_stage_idx || 0"/> of <t t-esc="state.taskDetailData.analytics?.total_stages || 0"/>)
                                            </span>
                                        </span>
                                    </div>
                                    <div class="pd-legend-item">
                                        <div class="pd-legend-label">
                                            <span class="pd-legend-box pd-legend-box-amber"/>
                                            <span>Remaining Stages Pending</span>
                                        </div>
                                        <span class="pd-legend-pct" style="color: #d97706;">
                                            <t t-esc="(state.taskDetailData.analytics?.remaining_stage_pct || 0).toFixed(2)"/>%
                                            <span style="font-size: 11px; font-weight: normal; color: #64748b; margin-left: 3px;">
                                                (<t t-esc="state.taskDetailData.analytics?.remaining_stages_count || 0"/> left)
                                            </span>
                                        </span>
                                    </div>
                                    <div class="pd-analytics-subtext">
                                        Calculated from project stage sequence (<t t-esc="state.taskDetailData.analytics?.current_stage_idx || 0"/> of <t t-esc="state.taskDetailData.analytics?.total_stages || 0"/> workflow stages completed).
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- ── 5. DISCUSSION NOTES TEXTAREA ── -->
                        <div class="pd-form-field">
                            <label class="pd-form-lbl"><i class="fa fa-commenting-o" style="margin-right: 4px;"/> Discussion Notes</label>
                            <textarea class="pd-discussion-textarea" placeholder="Write discussion updates or analytics details..." t-model="state.discussionNoteInput"/>
                        </div>

                        <!-- ── 6. TASK HISTORY & STAGE MOVES ── -->
                        <div class="pd-task-history-card">
                            <div class="pd-task-history-title">TASK HISTORY &amp; STAGE MOVES</div>
                            <div class="pd-history-list" style="max-height: 260px;">
                                <t t-if="getTaskHistoryEntries().length === 0">
                                    <div style="color: #94a3b8; font-size: 13px; font-style: italic; padding: 18px 0; text-align: center;">
                                        No history or stage moves recorded yet.
                                    </div>
                                </t>
                                <t t-else="">
                                    <t t-foreach="getTaskHistoryEntries()" t-as="hist" t-key="hist.id">
                                        <div class="pd-history-item">
                                            <div class="pd-history-avatar-circle">
                                                <t t-esc="hist.initials"/>
                                            </div>
                                            <div class="pd-history-content">
                                                <div class="pd-history-author-row">
                                                    <span t-esc="hist.author"/>
                                                    <span class="pd-history-time" t-esc="hist.time_str"/>
                                                </div>
                                                <t t-if="hist.tracking_values &amp;&amp; hist.tracking_values.length > 0">
                                                    <t t-foreach="hist.tracking_values" t-as="trk" t-key="trk_index">
                                                        <div class="pd-history-change-line">
                                                            <span>• <t t-esc="trk.field"/>:</span>
                                                            <span class="pd-history-old-val" t-esc="trk.old_value"/>
                                                            <span class="pd-history-arrow">➔</span>
                                                            <span class="pd-history-new-val" t-esc="trk.new_value"/>
                                                        </div>
                                                    </t>
                                                </t>
                                                <t t-if="hist.body">
                                                    <div style="font-size: 12.5px; color: #334155; margin-top: 2px;" t-out="renderMarkup(hist.body)"/>
                                                </t>
                                            </div>
                                        </div>
                                    </t>
                                </t>
                            </div>
                        </div>

                    </t>
                </div>

                <!-- Footer -->
                <div class="pd-task-popup-ftr">
                    <button type="button" class="pd-btn-save-blue" t-att-disabled="state.isSavingDiscussion" t-on-click="saveDiscussion">
                        <t t-if="state.isSavingDiscussion">Saving...</t>
                        <t t-else="">Save Discussion</t>
                    </button>
                    <button type="button" class="pd-btn-outline" t-on-click="closeTaskDetailModal">Close</button>
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
            is_project_manager: false,
            loading: true,
            level: 1, // 1: Tag Cards, 2: Dept Cards, 3: Employee Cards & Task List
            baseLevel: 1,
            selectedTagId: null,
            selectedTagName: '',
            selectedDeptId: null,
            selectedDeptName: '',
            selectedFirmId: '',
            collapsed_groups: {},
            showActivityModal: false,
            isEditMode: false,
            dashboardSearchQuery: '',
            personSearchQuery: '',
            dateFilter: 'all',
            calYear: today.getFullYear(),
            calMonth: today.getMonth() + 1,
            selectedPersonToSelect: '',
            showPersonCard: false,
            personCardData: null,
            showTaskDetailModal: false,
            taskDetailLoading: false,
            taskDetailData: null,
            taskModalTab: 'details',
            discussionNoteInput: '',
            isSavingDiscussion: false,
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
                is_admin: false,
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
                this.state.dateFilter = st.dateFilter || 'all';
                this.saveStateToStorage();
                this.loadData();
            }
        };

        window.addEventListener('popstate', this.onPopState);

        onWillUnmount(() => {
            window.removeEventListener('popstate', this.onPopState);
        });

        onWillStart(async () => {
            const isProjectAdmin = await user.hasGroup("project.group_project_manager");
            const isProjectManagerCustom = await user.hasGroup("custom_project.group_project_manager_custom");
            this.state.is_project_manager = isProjectAdmin || isProjectManagerCustom;
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
                this.state.baseLevel = saved.baseLevel || 1;
                this.state.selectedTagId = saved.tagId;
                this.state.selectedDeptId = saved.deptId;
                this.state.selectedTagName = saved.tagName || '';
                this.state.selectedDeptName = saved.deptName || '';
                this.state.selectedFirmId = saved.firmId || '';
                this.state.dateFilter = saved.dateFilter || 'all';
            } else {
                const ctx = (this.props.action && this.props.action.context) || {};
                const params = (this.props.action && this.props.action.params) || ctx.params || {};

                if (ctx.default_level === 2 || params.level === 2) {
                    this.state.level = 2;
                    this.state.baseLevel = 2;
                    this.state.selectedTagId = ctx.default_tag_id || params.tag_id || null;
                    this.state.selectedTagName = ctx.default_tag_name || params.tag_name || '';
                    if (ctx.default_firm_id || params.firm_id) {
                        this.state.selectedFirmId = String(ctx.default_firm_id || params.firm_id);
                    }
                } else if (ctx.default_firm_id || params.firm_id) {
                    this.state.level = 1;
                    this.state.baseLevel = 1;
                    this.state.selectedFirmId = String(ctx.default_firm_id || params.firm_id);
                    this.state.selectedTagId = null;
                    this.state.selectedDeptId = null;
                } else {
                    this.state.level = 1;
                    this.state.baseLevel = 1;
                    this.state.selectedTagId = null;
                    this.state.selectedDeptId = null;
                    this.state.selectedFirmId = '';
                }
            }
            await this.loadData();
        });
    }

    saveStateToStorage() {
        try {
            sessionStorage.setItem("pd_active_level_state", JSON.stringify({
                level: this.state.level,
                baseLevel: this.state.baseLevel,
                tagId: this.state.selectedTagId,
                tagName: this.state.selectedTagName,
                deptId: this.state.selectedDeptId,
                deptName: this.state.selectedDeptName,
                firmId: this.state.selectedFirmId,
                dateFilter: this.state.dateFilter,
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
        
        // Remove unnecessary departments that have 0 total tasks
        cards = cards.filter(c => c.total > 0);

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

    getInitials(name) {
        if (!name) return 'U';
        const parts = name.trim().split(/\s+/);
        if (parts.length > 1) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.trim().substring(0, 2).toUpperCase();
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

    getFirms() {
        return (this.state.data && this.state.data.firms) || [];
    }

    onFirmChange(ev) {
        this.loadData();
    }

    onDateFilterChange(ev) {
        this.loadData();
    }

    async loadData() {
        this.state.loading = true;
        try {
            const params = {
                level: this.state.level,
                tag_id: this.state.selectedTagId,
                department_id: this.state.selectedDeptId,
                firm_id: this.state.selectedFirmId,
                date_filter: this.state.dateFilter || 'all',
            };
            const res = await rpc("/department_dashboard/data", params);
            if (res) {
                this.state.data = {
                    is_admin: Boolean(res.is_admin),
                    firms: res.firms || [],
                    tag_cards: res.tag_cards || [],
                    dept_cards: res.dept_cards || [],
                    emp_cards: res.emp_cards || [],
                    my_tasks: res.my_tasks || [],
                    my_due_tasks: res.my_due_tasks || [],
                    calendar_events: res.calendar_events || [],
                    grouped_tasks_view: res.grouped_tasks_view || [],
                    summary_totals: res.summary_totals || { time_spent: '0.00', overall_progress: 0 },
                    filter_data: res.filter_data || { tags: [], departments: [], employees: [] },
                    firm_tags: res.firm_tags || [],
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
        } else if (this.state.level === 2 && this.state.baseLevel === 1) {
            this.goToLevel(1);
        } else if (this.state.level === this.state.baseLevel) {
            if (this.state.baseLevel === 2 || this.state.selectedFirmId) {
                this.actionService.doAction("custom_project.action_project_firm");
            } else {
                window.history.back();
            }
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
                deptName: this.state.selectedDeptName,
                firmId: this.state.selectedFirmId,
                dateFilter: this.state.dateFilter
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
                deptName: '',
                firmId: this.state.selectedFirmId
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
                deptName: this.state.selectedDeptName,
                firmId: this.state.selectedFirmId
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
            domain.push('|',
                '&', ['tag_ids', '!=', false], ['tag_ids', 'in', [tId]],
                '&', ['tag_ids', '=', false], ['project_id.tag_ids', 'in', [tId]]
            );
        } else if (this.state.selectedTagId === 'untagged') {
            domain.push(['tag_ids', '=', false], '|', ['project_id', '=', false], ['project_id.tag_ids', '=', false]);
        } else if (this.state.selectedFirmId) {
            const fTags = (this.state.data && this.state.data.firm_tags) || [];
            if (fTags.length > 0) {
                domain.push('|',
                    '&', ['tag_ids', '!=', false], ['tag_ids', 'in', fTags],
                    '&', ['tag_ids', '=', false], ['project_id.tag_ids', 'in', fTags]
                );
            } else {
                domain.push(['id', '=', -1]); // Firm has no tags, show no tasks
            }
        }

        if (this.state.selectedDeptId && this.state.selectedDeptId !== 'no_dept') {
            const dId = parseInt(this.state.selectedDeptId);
            domain.push('|',
                '&', ['department_id', '!=', false], ['department_id', '=', dId],
                '&', ['department_id', '=', false], ['project_id.department_id', '=', dId]
            );
        } else if (this.state.selectedDeptId === 'no_dept') {
            domain.push('&', ['department_id', '=', false], '|', ['project_id', '=', false], ['project_id.department_id', '=', false]);
        }

        if (this.state.dateFilter && this.state.dateFilter !== 'all') {
            const today = new Date();
            const formatDateYYYYMMDD = (d) => {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            };
            if (this.state.dateFilter === 'today') {
                domain.push(['date_deadline', '=', formatDateYYYYMMDD(today)]);
            } else if (this.state.dateFilter === 'next_7') {
                const next7 = new Date();
                next7.setDate(today.getDate() + 7);
                domain.push(['date_deadline', '>=', formatDateYYYYMMDD(today)]);
                domain.push(['date_deadline', '<=', formatDateYYYYMMDD(next7)]);
            } else if (this.state.dateFilter === 'last_7') {
                const last7 = new Date();
                last7.setDate(today.getDate() - 7);
                domain.push(['date_deadline', '>=', formatDateYYYYMMDD(last7)]);
                domain.push(['date_deadline', '<=', formatDateYYYYMMDD(today)]);
            } else if (this.state.dateFilter === 'last_month') {
                const lastMonth = new Date();
                lastMonth.setDate(today.getDate() - 30);
                domain.push(['date_deadline', '>=', formatDateYYYYMMDD(lastMonth)]);
                domain.push(['date_deadline', '<=', formatDateYYYYMMDD(today)]);
            }
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
        this.state.isEditMode = false;
        this.state.isEventEditable = true;
        this.state.personSearchQuery = '';
        this.state.selectedDepartmentToSelect = '';
        this.state.selectedPersonToSelect = '';
        this.state.activityForm = {
            event_id: null,
            source: 'calendar',
            type: 'meeting',
            date: dateStr,
            time_start: '09:00',
            time_stop: '10:00',
            start_h: '09', start_m: '00', start_ampm: 'AM',
            stop_h: '10', stop_m: '00', stop_ampm: 'AM',
            summary: '',
            description: '',
            user_ids: []
        };
        this.state.showActivityModal = true;
    }

    onEventClick(ev) {
        if (!ev) return;
        this.state.isEditMode = true;
        this.state.isEventEditable = ev.is_editable !== false;
        this.state.personSearchQuery = '';
        this.state.selectedDepartmentToSelect = '';
        this.state.selectedPersonToSelect = '';

        let cleanDesc = ev.description || '';
        if (cleanDesc && cleanDesc.includes('<')) {
            const tmp = document.createElement('div');
            tmp.innerHTML = cleanDesc;
            cleanDesc = tmp.textContent || tmp.innerText || '';
        }

        const parseTime = (timeStr) => {
            if (!timeStr) return { h: '09', m: '00', ampm: 'AM' };
            let [h, m] = timeStr.split(':');
            let hr = parseInt(h, 10) || 9;
            let ampm = hr >= 12 ? 'PM' : 'AM';
            hr = hr % 12;
            if (hr === 0) hr = 12;
            let hrStr = hr < 10 ? '0' + hr : '' + hr;
            return { h: hrStr, m: m || '00', ampm: ampm };
        };
        const sTime = parseTime(ev.time_start || '09:00');
        const eTime = parseTime(ev.time_stop || '10:00');

        this.state.activityForm = {
            event_id: ev.id,
            source: ev.source || 'calendar',
            type: ev.type || 'meeting',
            date: ev.date,
            time_start: ev.time_start || '09:00',
            time_stop: ev.time_stop || '10:00',
            start_h: sTime.h, start_m: sTime.m, start_ampm: sTime.ampm,
            stop_h: eTime.h, stop_m: eTime.m, stop_ampm: eTime.ampm,
            summary: ev.title || '',
            description: cleanDesc,
            user_ids: (ev.user_ids && ev.user_ids.length > 0) ? [...ev.user_ids] : []
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


        const buildTime = (hStr, mStr, ampm) => {
            let hr = parseInt(hStr || '9', 10);
            if (ampm === 'PM' && hr !== 12) hr += 12;
            if (ampm === 'AM' && hr === 12) hr = 0;
            let h = hr < 10 ? '0' + hr : '' + hr;
            return h + ':' + (mStr || '00');
        };

        try {
            this.state.loading = true;
            const res = await rpc("/department_dashboard/save_event", {
                event_id: this.state.activityForm.event_id || null,
                source: this.state.activityForm.source || 'calendar',
                title: this.state.activityForm.summary,
                date: this.state.activityForm.date,
                time_start: buildTime(this.state.activityForm.start_h, this.state.activityForm.start_m, this.state.activityForm.start_ampm),
                time_stop: buildTime(this.state.activityForm.stop_h, this.state.activityForm.stop_m, this.state.activityForm.stop_ampm),
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

    getAvailableDepartments() {
        const selectedIds = this.state.activityForm.user_ids || [];
        const emps = this.getEmployees().filter(e => !selectedIds.includes(e.id));
        const deptsMap = {};
        for (const e of emps) {
            const dept = (e.department || 'OTHER').toUpperCase();
            deptsMap[dept] = (deptsMap[dept] || 0) + 1;
        }
        const sortedDepts = Object.keys(deptsMap).sort();
        return sortedDepts.map(dept => ({
            name: dept,
            count: deptsMap[dept],
        }));
    }

    getAvailableEmployees() {
        const selectedIds = this.state.activityForm.user_ids || [];
        let emps = this.getEmployees().filter(e => !selectedIds.includes(e.id));

        if (this.state.selectedDepartmentToSelect) {
            const deptName = this.state.selectedDepartmentToSelect.toUpperCase();
            emps = emps.filter(e => (e.department || 'OTHER').toUpperCase() === deptName);
        }

        if (this.state.personSearchQuery && this.state.personSearchQuery.trim()) {
            const q = this.state.personSearchQuery.toLowerCase().trim();
            emps = emps.filter(e => (e.name || '').toLowerCase().includes(q));
        }

        return emps.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    onDepartmentSelectChange(ev) {
        if (ev && ev.target) {
            this.state.selectedDepartmentToSelect = ev.target.value || '';
            this.state.selectedPersonToSelect = '';
        }
    }

    addSelectedPerson() {
        const pid = parseInt(this.state.selectedPersonToSelect);
        if (pid && !(this.state.activityForm.user_ids || []).includes(pid)) {
            this.state.activityForm.user_ids = [...(this.state.activityForm.user_ids || []), pid];
            this.state.selectedPersonToSelect = '';
            this.state.selectedDepartmentToSelect = '';
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
                this.state.selectedDepartmentToSelect = '';
            }
        }
    }

    removePerson(uid) {
        this.state.activityForm.user_ids = (this.state.activityForm.user_ids || []).filter(id => id !== uid);
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

    setTaskModalTab(tab) {
        this.state.taskModalTab = tab;
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

    renderMarkup(val) {
        return markup(val || '');
    }

    closeTaskDetailModal() {
        this.state.showTaskDetailModal = false;
        this.state.taskDetailLoading = false;
        this.state.taskDetailData = null;
        this.state.taskModalTab = 'details';
        this.state.discussionNoteInput = '';
    }
}

registry.category("actions").add("department_dashboard_action", DepartmentDashboard);
