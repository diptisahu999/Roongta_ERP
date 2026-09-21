/** @odoo-module **/
import { Component, useState, xml } from "@odoo/owl";
import { user } from "@web/core/user";

export class MeetingCalendar extends Component {
    static template = xml/* xml */`
    <div class="pd-calendar-box pd-calendar-enhanced">
        <!-- ── CALENDAR HEADER & FILTER BAR ────────────────────────────────────── -->
        <div class="pd-cal-hdr pd-cal-hdr-flex">
            <div class="pd-cal-title-wrap">
                <span class="pd-cal-title">
                    <t t-if="props.level === 1">Project Meeting Calendar</t>
                    <t t-else="">Meeting Calendar</t>
                </span>
                <t t-if="isUserAdmin()">
                    <span class="pd-cal-badge" t-esc="getFilterBadgeText()"/>
                </t>
            </div>

            <!-- View Selection Controls (Visible ONLY to Admin) -->
            <t t-if="isUserAdmin()">
                <div class="pd-cal-view-selector">
                    <label class="pd-cal-filter-label"><i class="fa fa-filter"/> View Mode:</label>
                    <select class="pd-cal-select pd-cal-view-dropdown" t-model="state.filterMode" t-on-change="onFilterModeChange">
                        <option value="admin">MD Meetings Calendar</option> 
                        <option value="department">Internal Department meetings</option>
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
                    <span class="pd-cal-month-title"><t t-esc="getCalendarMonthName()"/></span>
                    <button class="pd-cal-btn pd-btn-schedule" t-on-click="() => props.onScheduleActivity()">
                        <i class="fa fa-calendar-plus-o"/> Schedule Activity
                    </button>
                </div>

                <div class="pd-cal-grid">
                    <div class="pd-cal-day-hdr">SUN</div>
                    <div class="pd-cal-day-hdr">MON</div>
                    <div class="pd-cal-day-hdr">TUE</div>
                    <div class="pd-cal-day-hdr">WED</div>
                    <div class="pd-cal-day-hdr">THU</div>
                    <div class="pd-cal-day-hdr">FRI</div>
                    <div class="pd-cal-day-hdr">SAT</div>

                    <t t-foreach="getCalendarGrid()" t-as="cell" t-key="cell_index">
                        <div t-att-class="'pd-cal-cell ' + (cell.otherMonth ? 'pd-cal-other-month ' : '') + (cell.isToday ? 'pd-cal-today' : '')"
                             t-on-click="() => this.onCellClick(cell)">
                            <span class="pd-cal-date-num"><t t-esc="cell.date"/></span>
                            <t t-if="!cell.otherMonth">
                                <t t-foreach="getCalendarEvents(cell.fullDate)" t-as="ev" t-key="ev.id">
                                    <div t-att-class="'pd-cal-event-pill' + (ev.is_done ? ' pd-cal-event-done' : '')"
                                         t-att-style="'background-color: ' + (ev.color || (ev.is_admin_event ? '#7c3aed' : '#ea580c')) + ';'"
                                         t-att-title="ev.title + (ev.user_name ? ' (' + ev.user_name + ')' : '') + ' - Click to edit/delete'"
                                         t-on-click.stop="() => this.onEventClick(ev)">
                                        <span t-esc="ev.time"/> <span t-esc="ev.title"/>
                                        <t t-if="ev.user_name"> (<t t-esc="ev.user_name"/>)</t>
                                    </div>
                                </t>
                            </t>
                        </div>
                    </t>
                </div>
            </div>

            <!-- Right: Mini Calendar Sidebar -->
            <div class="pd-cal-sidebar">
                <div class="pd-mini-cal-hdr">
                    <button type="button" class="pd-mini-nav-btn" t-on-click="prevMonth" title="Previous Month">&lt;</button>
                    <span class="pd-mini-title" t-esc="getCalendarMonthName()"/>
                    <button type="button" class="pd-mini-nav-btn" t-on-click="nextMonth" title="Next Month">&gt;</button>
                </div>
                <div class="pd-mini-cal-days">
                    <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
                    <t t-foreach="getCalendarGrid()" t-as="cell" t-key="'mini_' + cell_index">
                        <t t-if="!cell.otherMonth">
                            <span t-att-class="cell.isToday ? 'active' : ''"
                                  t-on-click="() => this.onCellClick(cell)">
                                <t t-esc="cell.date"/>
                            </span>
                        </t>
                        <t t-else="">
                            <span class="pd-mini-empty"></span>
                        </t>
                    </t>
                </div>
            </div>
        </div>
    </div>
    `;

    setup() {
        const now = new Date();
        this.state = useState({
            calYear: now.getFullYear(),
            calMonth: now.getMonth() + 1,
            selectedDate: null,
            filterMode: 'admin',
            selectedDeptId: 'all',
        });
    }

    isUserAdmin() {
        if (user.name && user.name.toLowerCase().includes("diptiranjan")) return false;
        if (user.login && user.login.toLowerCase().includes("diptiranjan")) return false;
        return !!(this.props.isUserAdmin || user.isAdmin || user.userId === 1 || user.userId === 2);
    }

    isUserManager() {
        return !!this.props.isUserManager;
    }

    canSelectDepartment() {
        if (this.props.isUserAdmin || this.props.isUserManager || this.props.canSelectDepartment) {
            return true;
        }
        if (user.isAdmin) {
            return true;
        }
        if (user.name && user.name.toLowerCase().includes("diptiranjan")) {
            return true;
        }
        if (user.login && user.login.toLowerCase().includes("diptiranjan")) {
            return true;
        }
        return false;
    }

    onFilterModeChange() {
        if (this.state.filterMode !== 'department') {
            this.state.selectedDeptId = 'all';
        }
    }

    getDepartmentsList() {
        const data = this.props.data;
        if (!data) return [];
        return data.departments || [];
    }

    getFilterBadgeText() {
        if (this.state.filterMode === 'admin') {
            return "MD Meetings View";
        } else if (this.state.filterMode === 'department') {
            if (this.state.selectedDeptId !== 'all') {
                const depts = this.getDepartmentsList();
                const d = depts.find(x => String(x.id) === String(this.state.selectedDeptId));
                return d ? `Dept: ${d.name}` : "Department View";
            }
            return "All Departments";
        }
        return "MD Meetings View";
    }

    getCalendarEvents(dateStr) {
        const data = this.props.data;
        if (!data || !data.calendar_events) return [];

        let events = data.calendar_events.filter(e => e.date === dateStr);

        // View Mode Filter (Applicable ONLY to Admin)
        if (this.isUserAdmin()) {
            if (this.state.filterMode === 'admin') {
                events = events.filter(e => e.is_admin_event === true || e.role_level === 'admin');
            } else if (this.state.filterMode === 'department') {
                if (this.state.selectedDeptId !== 'all') {
                    const targetDeptId = String(this.state.selectedDeptId);
                    const selectedDeptObj = this.getDepartmentsList().find(d => String(d.id) === targetDeptId);
                    const targetDeptName = selectedDeptObj ? selectedDeptObj.name.trim().toLowerCase() : '';

                    events = events.filter(e => {
                        if (e.department_ids && Array.isArray(e.department_ids) && e.department_ids.length > 0) {
                            if (e.department_ids.map(String).includes(targetDeptId)) return true;
                        }
                        if (e.department_id && String(e.department_id) === targetDeptId) return true;
                        if (targetDeptName) {
                            const eDeptName = (e.department_name || '').trim().toLowerCase();
                            if (eDeptName && eDeptName === targetDeptName) return true;
                        }
                        return false;
                    });
                }
            }
        } else {
            // For non-admin: strictly ensure only meetings of themselves are shown!
            const currentUid = user.userId;
            const currentPartnerId = data.current_partner_id;
            events = events.filter(e => {
                if (e.create_uid === currentUid) return true;
                if (e.user_ids && Array.isArray(e.user_ids) && e.user_ids.includes(currentUid)) return true;
                if (e.partner_ids && Array.isArray(e.partner_ids) && e.partner_ids.includes(currentPartnerId)) return true;
                return false;
            });
        }

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

    getCalendarMonthName() {
        const names = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        return `${names[this.state.calMonth - 1]} ${this.state.calYear}`;
    }

    getCalendarGrid() {
        const y = this.state.calYear;
        const m = this.state.calMonth;
        const firstDay = new Date(y, m - 1, 1).getDay();
        const daysInMonth = new Date(y, m, 0).getDate();
        const prevMonthDays = new Date(y, m - 1, 0).getDate();

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        const grid = [];

        for (let i = firstDay - 1; i >= 0; i--) {
            const d = prevMonthDays - i;
            const prevM = m === 1 ? 12 : m - 1;
            const prevY = m === 1 ? y - 1 : y;
            const fullDate = `${prevY}-${String(prevM).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            grid.push({
                date: d,
                otherMonth: true,
                fullDate,
                isToday: fullDate === todayStr,
            });
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const fullDate = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            grid.push({
                date: d,
                otherMonth: false,
                fullDate,
                isToday: fullDate === todayStr,
            });
        }

        const totalCells = grid.length > 35 ? 42 : 35;
        let nextD = 1;
        while (grid.length < totalCells) {
            const nextM = m === 12 ? 1 : m + 1;
            const nextY = m === 12 ? y + 1 : y;
            const fullDate = `${nextY}-${String(nextM).padStart(2, "0")}-${String(nextD).padStart(2, "0")}`;
            grid.push({
                date: nextD++,
                otherMonth: true,
                fullDate,
                isToday: fullDate === todayStr,
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

    onCellClick(cell) {
        if (cell.otherMonth) return;
        if (this.props.onDateClick) {
            this.props.onDateClick(cell.fullDate);
        } else if (this.props.onScheduleActivity) {
            this.props.onScheduleActivity();
        }
    }

    onEventClick(ev) {
        if (this.props.onEventClick) {
            this.props.onEventClick(ev);
        }
    }
}
