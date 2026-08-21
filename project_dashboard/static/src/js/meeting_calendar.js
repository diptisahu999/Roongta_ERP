/** @odoo-module **/
/**
 * Meeting Calendar Module for Project Dashboard
 * =============================================
 * This file contains BOTH the original (old) calendar code preserved for reference/fallback
 * and the new enhanced MeetingCalendar component supporting View Selection by Admin,
 * Companies, and Departments while preserving the default table/calendar view by default.
 */

import { Component, useState, xml } from "@odoo/owl";

/* ============================================================================
   1. OLD / LEGACY CALENDAR IMPLEMENTATION (PRESERVED FOR REFERENCE)
   ============================================================================
   Below is the original calendar logic previously embedded inside department_dashboard.js.
   It is retained intact as requested.

   Original methods:
   - getCalendarMonthName()
   - getCalendarEvents(dateStr) -> filtered only by search query
   - getCalendarGrid() -> 35/42 day grid calculation
   - prevMonth(), nextMonth(), goToToday(), onMonthSelect()
   
   Original Inline XML Snippet:
   <div class="pd-calendar-box">
       <div class="pd-cal-hdr">
           <span class="pd-cal-title">Project Meeting Calender</span>
       </div>
       <div class="pd-cal-body">
           <div class="pd-cal-main">...</div>
           <div class="pd-cal-sidebar">...</div>
       </div>
   </div>
   ============================================================================ */


/* ============================================================================
   2. NEW ENHANCED MEETING CALENDAR COMPONENT (NEW CODE)
   ============================================================================ */

export class MeetingCalendar extends Component {
    static template = xml/* xml */`
    <div class="pd-calendar-box pd-calendar-enhanced">
        <!-- ── CALENDAR HEADER & FILTER BAR ────────────────────────────────────── -->
        <div class="pd-cal-hdr pd-cal-hdr-flex">
            <div class="pd-cal-title-wrap">
                <span class="pd-cal-title">
                    <t t-if="props.level === 1">Project Meeting Calendar</t>
                    <t t-else="">Department Meeting Calendar</t>
                </span>
                <t t-if="isUserAdmin()">
                    <span class="pd-cal-badge" t-esc="getFilterBadgeText()"/>
                </t>
            </div>

            <!-- View Selection Controls (Right aligned in Header - Visible ONLY to Admin) -->
            <t t-if="isUserAdmin()">
                <div class="pd-cal-view-selector">
                    <label class="pd-cal-filter-label"><i class="fa fa-filter"/> View Mode:</label>
                    <select class="pd-cal-select pd-cal-view-dropdown" t-model="state.filterMode" t-on-change="onFilterModeChange">
                        <option value="admin">MD Meetings Calendar</option> 
                        <option value="department">Meetings By Department</option>
                    </select>

                    <!-- Dynamic Sub-Filter: Department Selection -->
                    <t t-if="state.filterMode === 'department'">
                        <select class="pd-cal-select pd-cal-subselect" t-model="state.selectedDeptId">
                            <option value="all">All Departments</option>
                            <t t-foreach="getDepartmentsList()" t-as="dept" t-key="dept.id">
                                <option t-att-value="dept.id" t-esc="dept.name"/>
                            </t>
                        </select>
                    </t>
                </div>
            </t>
        </div>

        <div class="pd-cal-body">
            <!-- Left: Main Calendar View -->
            <div class="pd-cal-main">
                <div class="pd-cal-toolbar">
                    <div class="pd-cal-nav-group">
                        <button class="pd-cal-btn" t-on-click="prevMonth">&lt;</button>
                        <button class="pd-cal-btn" t-on-click="nextMonth">&gt;</button>
                        <select class="pd-cal-select" t-model="state.calMonth">
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
                    <span class="pd-cal-month-title">
                        <t t-esc="getCalendarMonthName()"/> <t t-esc="state.calYear"/>
                    </span>
                    <button class="pd-cal-btn pd-btn-schedule" t-on-click="() => props.onScheduleActivity()">
                        ➕ Schedule Activity
                    </button>
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
                        <t t-if="cell.isCurrentMonth">
                            <div class="pd-cal-cell"
                                 t-att-class="{ 'pd-cal-today': cell.isToday }"
                                 t-on-click="() => props.onDateClick(cell.dateStr)"
                                 title="Click to schedule on this date">
                                <span class="pd-cal-date-num" t-esc="cell.day"/>
                                <t t-foreach="cell.events" t-as="ev" t-key="ev.id">
                                    <div class="pd-cal-event-pill"
                                         t-att-style="'background-color: ' + (ev.color || '#3b82f6') + ';'"
                                         t-att-title="ev.title + (ev.user_name ? ' (' + ev.user_name + ')' : '') + ' - Click to edit/delete'"
                                         t-on-click.stop="() => props.onEventClick(ev)">
                                        <span t-esc="ev.time"/> <span t-esc="ev.title"/>
                                        <t t-if="ev.user_name"> (<t t-esc="ev.user_name"/>)</t>
                                    </div>
                                </t>
                            </div>
                        </t>
                        <t t-else="">
                            <div class="pd-cal-cell pd-cal-other-month">
                            </div>
                        </t>
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
                        <span t-att-class="{ 'other-month': !cell.isCurrentMonth, 'active': cell.isToday }"
                              t-esc="cell.day"
                              t-on-click="() => props.onDateClick(cell.dateStr)"
                              style="cursor:pointer;"
                              title="Click to schedule on date"/>
                    </t>
                </div>
            </div>
        </div>
    </div>
    `;

    setup() {
        const today = new Date();
        this.state = useState({
            calYear: today.getFullYear(),
            calMonth: today.getMonth() + 1,
            filterMode: 'admin', // 'admin' | 'department'
            selectedCompanyId: 'all',
            selectedDeptId: 'all',
        });
    }

    isUserAdmin() {
        if (this.props.isUserAdmin !== undefined && this.props.isUserAdmin !== null) {
            return Boolean(this.props.isUserAdmin);
        }
        if (this.props.data && this.props.data.is_admin !== undefined && this.props.data.is_admin !== null) {
            return Boolean(this.props.data.is_admin);
        }
        return false;
    }

    onFilterModeChange(ev) {
        this.state.selectedCompanyId = 'all';
        this.state.selectedDeptId = 'all';
    }

    getCompaniesList() {
        return (this.props.data && this.props.data.firms) || [];
    }

    getDepartmentsList() {
        return (this.props.data && this.props.data.filter_data && this.props.data.filter_data.departments) || [];
    }

    getCalendarMonthName() {
        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        return months[(parseInt(this.state.calMonth) || 1) - 1] || "";
    }

    getFilterBadgeText() {
        if (this.state.filterMode === 'admin') {
            return "MD Meetings View";
        } else if (this.state.filterMode === 'department') {
            if (this.state.selectedDeptId !== 'all') {
                const dept = this.getDepartmentsList().find(d => String(d.id) === String(this.state.selectedDeptId));
                return dept ? `Dept: ${dept.name}` : "Department View";
            }
            return "All Departments";
        }
        return "MD Meetings";
    }

    getCalendarEvents(dateStr) {
        let events = (this.props.data && this.props.data.calendar_events) || [];
        
        // 1. Filter by Date
        events = events.filter(e => e.date === dateStr);

        // 2. View Mode Filter (Applicable only to Admin)
        if (!this.isUserAdmin()) {
            return events;
        }

        if (this.state.filterMode === 'admin') {
            // Show only events created by/involving admin
            events = events.filter(e => e.is_admin_event === true);
        } else if (this.state.filterMode === 'company') {
            if (this.state.selectedCompanyId !== 'all') {
                const targetCompId = String(this.state.selectedCompanyId);
                const selectedCompObj = this.getCompaniesList().find(c => String(c.id) === targetCompId);
                const targetCompName = selectedCompObj ? selectedCompObj.name.trim().toLowerCase() : '';

                events = events.filter(e => {
                    // 1. Array ID matching
                    if (e.firm_ids && Array.isArray(e.firm_ids) && e.firm_ids.length > 0) {
                        if (e.firm_ids.map(String).includes(targetCompId)) return true;
                    }
                    if (e.company_ids && Array.isArray(e.company_ids) && e.company_ids.length > 0) {
                        if (e.company_ids.map(String).includes(targetCompId)) return true;
                    }
                    // 2. Direct ID matching
                    if (e.firm_id && String(e.firm_id) === targetCompId) return true;
                    if (e.company_id && String(e.company_id) === targetCompId) return true;

                    // 3. Name fallback matching (exact match)
                    if (targetCompName) {
                        const eFirmName = (e.firm_name || e.company_name || '').trim().toLowerCase();
                        if (eFirmName && eFirmName === targetCompName) return true;
                    }
                    return false;
                });
            }
        } else if (this.state.filterMode === 'department') {
            if (this.state.selectedDeptId !== 'all') {
                const targetDeptId = String(this.state.selectedDeptId);
                const selectedDeptObj = this.getDepartmentsList().find(d => String(d.id) === targetDeptId);
                const targetDeptName = selectedDeptObj ? selectedDeptObj.name.trim().toLowerCase() : '';

                events = events.filter(e => {
                    // 1. Array ID matching
                    if (e.department_ids && Array.isArray(e.department_ids) && e.department_ids.length > 0) {
                        if (e.department_ids.map(String).includes(targetDeptId)) return true;
                    }
                    // 2. Direct ID matching
                    if (e.department_id && String(e.department_id) === targetDeptId) return true;

                    // 3. Name fallback matching (exact match)
                    if (targetDeptName) {
                        const eDeptName = (e.department_name || '').trim().toLowerCase();
                        if (eDeptName && eDeptName === targetDeptName) return true;
                    }
                    return false;
                });
            }
        }

        // 3. Search Query Filter (if active in parent props)
        if (this.props.searchQuery) {
            const q = this.props.searchQuery.toLowerCase();
            events = events.filter(e =>
                (e.title || '').toLowerCase().includes(q) ||
                (e.user_name || '').toLowerCase().includes(q) ||
                (e.description || '').toLowerCase().includes(q)
            );
        }

        return events;
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
                day: '',
                month: pMonth,
                year: pYear,
                dateStr: dateStr,
                isCurrentMonth: false,
                isToday: false,
                events: []
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
                day: '',
                month: nMonth,
                year: nYear,
                dateStr: dateStr,
                isCurrentMonth: false,
                isToday: false,
                events: []
            });
        }

        return grid;
    }

    prevMonth() {
        if (parseInt(this.state.calMonth) === 1) {
            this.state.calMonth = 12;
            this.state.calYear -= 1;
        } else {
            this.state.calMonth = parseInt(this.state.calMonth) - 1;
        }
    }

    nextMonth() {
        if (parseInt(this.state.calMonth) === 12) {
            this.state.calMonth = 1;
            this.state.calYear += 1;
        } else {
            this.state.calMonth = parseInt(this.state.calMonth) + 1;
        }
    }

    goToToday() {
        const today = new Date();
        this.state.calYear = today.getFullYear();
        this.state.calMonth = today.getMonth() + 1;
    }
}
