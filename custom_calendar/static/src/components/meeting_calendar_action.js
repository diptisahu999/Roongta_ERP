/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, useState, onWillStart } from "@odoo/owl";
import { MeetingCalendar } from "./meeting_calendar";
import { useService } from "@web/core/utils/hooks";
import { rpc } from "@web/core/network/rpc";
import { user } from "@web/core/user";
import { xml } from "@odoo/owl";

export class CustomCalendarAction extends Component {
    static components = { MeetingCalendar };
    static template = xml/* xml */`
        <div class="o_action_manager h-100 overflow-auto bg-view p-3 pd-calendar-view-fullscreen">
            <style>
                .pd-calendar-view-fullscreen {
                    background: #f8fafc;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }
                .pd-calendar-view-fullscreen .pd-calendar-box {
                    flex: 1;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                    margin: 0;
                    height: 100%;
                }
            </style>
            
            <MeetingCalendar
                level="1"
                isUserAdmin="state.isUserAdmin"
                isUserManager="state.isUserManager"
                canSelectDepartment="state.canSelectDepartment"
                data="state.dashboardData"
                searchQuery="state.searchQuery"
                onScheduleActivity="() => this.openActivityModal()"
                onDateClick="(dateStr) => this.onDateClick(dateStr)"
                onEventClick="(ev) => this.onEventClick(ev)"
            />

            <!-- ══ Schedule / Edit Activity Modal Popup ══════════════════════════════════ -->
            <t t-if="state.showActivityModal">
                <div class="pd-modal-overlay">
                    <div class="pd-modal-box">
                        <div class="pd-modal-hdr">
                            <span class="pd-modal-title" t-esc="state.isEditMode ? (state.isEventEditable ? 'Edit Event / Meeting' : 'View Event / Meeting') : 'Schedule Activity / Meeting'"/>
                            <span class="pd-modal-close" t-on-click="closeActivityModal">✕</span>
                        </div>
                        <div class="pd-modal-body">
                            <!-- 1. Activity / Meeting Type -->
                            <div class="pd-form-group">
                                <label class="pd-form-label">Activity / Meeting Type</label>
                                <select t-model="state.activityForm.type" class="pd-form-input pd-form-select" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined">
                                    <option value="meeting">Meeting</option>
                                    <option value="todo">To-Do</option>
                                    <option value="call">Call</option>
                                </select>
                            </div>

                            <!-- 2. Date & Time -->
                            <div class="pd-form-group">
                                <label class="pd-form-label">Date &amp; Time</label>
                                <div class="pd-datetime-row">
                                    <!-- Date Input with Native Calendar Picker -->
                                    <input type="date" t-model="state.activityForm.date" class="pd-form-input pd-date-input" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined"/>

                                    <!-- Start Time Box: HH : MM AM/PM -->
                                    <div class="pd-time-box">
                                        <select t-model="state.activityForm.start_h" class="pd-time-select" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined">
                                            <option value="12">12</option><option value="1">01</option><option value="2">02</option><option value="3">03</option><option value="4">04</option><option value="5">05</option><option value="6">06</option><option value="7">07</option><option value="8">08</option><option value="9">09</option><option value="10">10</option><option value="11">11</option>
                                        </select>
                                        <span class="pd-time-colon">:</span>
                                        <select t-model="state.activityForm.start_m" class="pd-time-select" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined">
                                            <option value="0">00</option><option value="5">05</option><option value="10">10</option><option value="15">15</option><option value="20">20</option><option value="25">25</option><option value="30">30</option><option value="35">35</option><option value="40">40</option><option value="45">45</option><option value="50">50</option><option value="55">55</option>
                                        </select>
                                        <select t-model="state.activityForm.start_ampm" class="pd-time-select pd-time-ampm" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined">
                                            <option value="AM">AM</option><option value="PM">PM</option>
                                        </select>
                                    </div>

                                    <span class="pd-time-dash">-</span>

                                    <!-- Stop Time Box: HH : MM AM/PM -->
                                    <div class="pd-time-box">
                                        <select t-model="state.activityForm.stop_h" class="pd-time-select" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined">
                                            <option value="12">12</option><option value="1">01</option><option value="2">02</option><option value="3">03</option><option value="4">04</option><option value="5">05</option><option value="6">06</option><option value="7">07</option><option value="8">08</option><option value="9">09</option><option value="10">10</option><option value="11">11</option>
                                        </select>
                                        <span class="pd-time-colon">:</span>
                                        <select t-model="state.activityForm.stop_m" class="pd-time-select" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined">
                                            <option value="0">00</option><option value="5">05</option><option value="10">10</option><option value="15">15</option><option value="20">20</option><option value="25">25</option><option value="30">30</option><option value="35">35</option><option value="40">40</option><option value="45">45</option><option value="50">50</option><option value="55">55</option>
                                        </select>
                                        <select t-model="state.activityForm.stop_ampm" class="pd-time-select pd-time-ampm" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined">
                                            <option value="AM">AM</option><option value="PM">PM</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <!-- 3. Subject / Summary -->
                            <div class="pd-form-group">
                                <label class="pd-form-label">Subject / Summary</label>
                                <input type="text" t-model="state.activityForm.title" class="pd-form-input" placeholder="e.g. Discuss Q3 Project Roadmap" t-att-disabled="!state.isEventEditable ? 'disabled' : undefined"/>
                            </div>

                            <!-- 4. Agenda / Description -->
                            <div class="pd-form-group">
                                <label class="pd-form-label">Agenda / Description</label>
                                <textarea t-model="state.activityForm.description" class="pd-form-input pd-form-textarea" rows="2" placeholder="Add meeting notes, agenda, or details..." t-att-disabled="!state.isEventEditable ? 'disabled' : undefined"></textarea>
                            </div>

                            <!-- 5. Assigned to / Mentioned Attendees -->
                            <div class="pd-form-group">
                                <label class="pd-form-label">Assigned to / Mentioned Attendees</label>
                                
                                <!-- Attendees Display Box -->
                                <div class="pd-attendees-list-box">
                                    <t t-if="!state.activityForm.user_ids or state.activityForm.user_ids.length === 0">
                                        <span class="pd-no-attendees-text">No attendees added yet. Search or select a person below.</span>
                                    </t>
                                    <t t-else="">
                                        <t t-foreach="state.activityForm.user_ids" t-as="uid" t-key="uid">
                                            <div class="pd-attendee-chip">
                                                <span class="pd-attendee-avatar"><t t-esc="getUserInitials(uid)"/></span>
                                                <span class="pd-attendee-name"><t t-esc="getUserName(uid)"/></span>
                                                <span t-if="state.isEventEditable" class="pd-attendee-remove" t-on-click.stop="() => this.removePerson(uid)" title="Remove Person">✕</span>
                                            </div>
                                        </t>
                                    </t>
                                </div>

                                <!-- Dual Dropdown: Department & Person -->
                                <t t-if="state.isEventEditable">
                                    <div class="pd-add-attendee-row">
                                        <!-- 1. Department Selection Dropdown (Selectable for all users) -->
                                        <select class="pd-form-input pd-dept-select" t-model="state.selectedDepartmentToSelect" t-on-change="onDepartmentSelectChange">
                                            <option value="">-- Select Department --</option>
                                            <t t-foreach="getAvailableDepartments()" t-as="d" t-key="d.id || d.name">
                                                <option t-att-value="d.name" t-esc="d.name + (d.count ? ' (' + d.count + ')' : '')"/>
                                            </t>
                                        </select>

                                        <!-- 2. Person Selection Dropdown (Dynamic based on selected department) -->
                                        <select class="pd-form-input pd-person-select" t-model="state.selectedPersonToSelect" t-on-change="onPersonDropdownChange">
                                            <option value="">-- Select Person to Add --</option>
                                            <t t-foreach="getAvailableEmployees()" t-as="e" t-key="e.id">
                                                <option t-att-value="e.id" t-esc="e.name + (e.department_name ? ' (' + e.department_name + ')' : '')"/>
                                            </t>
                                        </select>
                                    </div>
                                </t>
                            </div>
                        </div>

                        <!-- Modal Footer Buttons -->
                        <div class="pd-modal-ftr">
                            <!-- In Edit Mode -->
                            <t t-if="state.isEditMode">
                                <!-- Done / Read-only mode: only Close -->
                                <t t-if="state.activityForm.is_done">
                                    <button class="pd-btn-outline" style="margin-left: auto;" t-on-click="closeActivityModal">Close</button>
                                </t>
                                <!-- Editable mode -->
                                <t t-elif="state.isEventEditable">
                                    <button type="button" class="pd-btn-danger" t-on-click="() => this.deleteEvent()">
                                        <i class="fa fa-trash pd-delete-icon"/>
                                    </button>

                                    <button class="pd-btn-primary" t-on-click="() => this.saveActivity(false)">
                                        Update Event
                                    </button>

                                    <button class="pd-btn-outline" t-on-click="() => this.saveActivity(true)">
                                        Mark as Done
                                    </button>

                                    <button class="pd-btn-outline" t-on-click="closeActivityModal">Cancel</button>
                                </t>
                                <!-- View-only (not creator/admin, not done) -->
                                <t t-else="">
                                    <button class="pd-btn-outline" style="margin-left: auto;" t-on-click="closeActivityModal">Close</button>
                                </t>
                            </t>

                            <!-- In Create / Schedule Mode -->
                            <t t-else="">
                                <button class="pd-btn-primary" t-on-click="() => this.saveActivity(false)">
                                    Schedule Event
                                </button>

                                <button class="pd-btn-outline" t-on-click="() => this.saveActivity(true)">
                                    Schedule &amp; Mark Done
                                </button>

                                <button class="pd-btn-outline" t-on-click="closeActivityModal">Cancel</button>
                            </t>
                        </div>
                    </div>
                </div>
            </t>
        </div>
    `;

    setup() {
        this.notification = useService("notification");
        this.action = useService("action");
        this.orm = useService("orm");
        const now = new Date();
        this.state = useState({
            isUserAdmin: false,
            isUserManager: false,
            canSelectDepartment: false,
            userDepartmentId: false,
            userDepartmentName: "",
            searchQuery: "",
            showActivityModal: false,
            isEditMode: false,
            isEventEditable: true,
            selectedDepartmentToSelect: "",
            selectedPersonToSelect: "",
            dashboardData: {
                calendar_events: [],
                departments: [],
                firms: [],
            },
            allUsers: [],
            activityForm: {
                raw_id: null,
                source: "calendar",
                type: "meeting",
                title: "",
                date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
                start_h: "9",
                start_m: "0",
                start_ampm: "AM",
                stop_h: "10",
                stop_m: "0",
                stop_ampm: "AM",
                user_ids: [],
                department_id: "",
                description: "",
                is_done: false,
                role_level: "team",
            }
        });

        onWillStart(async () => {
            try {
                const isProjectAdmin = await user.hasGroup("project.group_project_manager");
                const isCustomManager = await user.hasGroup("custom_project.group_project_manager_custom");
                const isErpManager = await user.hasGroup("base.group_erp_manager");
                const isHrManager = await user.hasGroup("hr.group_hr_manager");
                const isDiptiranjan = !!(
                    (user.name && user.name.toLowerCase().includes("diptiranjan")) ||
                    (user.login && user.login.toLowerCase().includes("diptiranjan"))
                );
                if (user.isAdmin || isProjectAdmin || isCustomManager || isErpManager || isHrManager || isDiptiranjan) {
                    this.state.isUserManager = true;
                    this.state.canSelectDepartment = true;
                }
            } catch (err) {
                console.warn("Error checking user groups in custom_calendar:", err);
            }
            await this.loadCalendarData();
            await this.loadUsersAndDepartments();
        });
    }

    async loadCalendarData() {
        try {
            const res = await rpc("/custom_calendar/get_calendar_data", {});
            if (res && res.status === "success") {
                this.state.dashboardData = res;
                const isDipti = !!(
                    (user.name && user.name.toLowerCase().includes("diptiranjan")) ||
                    (user.login && user.login.toLowerCase().includes("diptiranjan"))
                );
                this.state.isUserAdmin = !isDipti && !!res.is_admin;
                if (res.is_manager) this.state.isUserManager = true;
                if (res.can_select_department) this.state.canSelectDepartment = true;
                this.state.userDepartmentId = res.user_department_id;
                this.state.userDepartmentName = res.user_department_name;
            }
        } catch (e) {
            console.error("Error loading calendar data:", e);
        }
    }

    async loadUsersAndDepartments() {
        try {
            // 1. Fetch departments directly via ORM
            const depts = await this.orm.searchRead("hr.department", [], ["id", "name"]);
            if (depts && depts.length) {
                this.state.dashboardData.departments = depts;
            }

            // 2. Fetch users directly via ORM
            const users = await this.orm.searchRead(
                "res.users",
                [["active", "=", true]],
                ["id", "name", "login", "department_id"]
            );

            // 3. Fetch hr.employee mapping directly via ORM
            let empMap = {};
            try {
                const emps = await this.orm.searchRead(
                    "hr.employee",
                    [["user_id", "!=", false]],
                    ["user_id", "department_id"]
                );
                for (const emp of emps) {
                    if (emp.user_id && emp.department_id) {
                        empMap[emp.user_id[0]] = {
                            id: emp.department_id[0],
                            name: emp.department_id[1],
                        };
                    }
                }
            } catch (err) {
                console.warn("[CustomCalendar] Error loading hr.employee mappings:", err);
            }

            // 4. Map users with resolved department
            this.state.allUsers = users.map(u => {
                let deptId = false;
                let deptName = "";
                if (u.department_id) {
                    deptId = u.department_id[0];
                    deptName = u.department_id[1];
                } else if (empMap[u.id]) {
                    deptId = empMap[u.id].id;
                    deptName = empMap[u.id].name;
                }
                return {
                    id: u.id,
                    name: u.name,
                    login: u.login || "",
                    department_id: deptId,
                    department_name: deptName,
                    department: deptName,
                };
            });
        } catch (e) {
            console.error("[CustomCalendar] Error loading users via ORM, attempting fallback:", e);
            try {
                const res = await rpc("/custom_calendar/get_users_and_departments", {});
                if (res && res.status === "success" && res.users) {
                    this.state.allUsers = res.users;
                    if (res.departments && (!this.state.dashboardData.departments || !this.state.dashboardData.departments.length)) {
                        this.state.dashboardData.departments = res.departments;
                    }
                }
            } catch (rpcErr) {
                console.error("[CustomCalendar] Error loading users via RPC fallback:", rpcErr);
            }
        }
    }

    canUserSelectDepartment() {
        if (this.state.isUserAdmin || this.state.isUserManager || this.state.canSelectDepartment) {
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

    onDateClick(dateStr) {
        this.openActivityModal(null, dateStr);
    }

    onEventClick(ev) {
        this.openActivityModal(ev);
    }

    openActivityModal(eventData = null, defaultDate = null) {
        const now = new Date();
        const dateVal = defaultDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

        this.state.selectedPersonToSelect = "";
        this.state.selectedDepartmentToSelect = "";

        const canManage = this.canUserSelectDepartment();

        if (eventData) {
            this.state.isEditMode = true;
            // The person who scheduled the meeting can do full CRUD on it; Admin has all rights; others can only view
            const currentUid = user.userId;
            const isCreator = !!(eventData.is_creator || (eventData.create_uid && eventData.create_uid === currentUid));
            const isDipti = !!(
                (user.name && user.name.toLowerCase().includes("diptiranjan")) ||
                (user.login && user.login.toLowerCase().includes("diptiranjan"))
            );
            const isUserAdmin = !isDipti && (this.state.isUserAdmin || user.isAdmin || currentUid === 1 || currentUid === 2);
            this.state.isEventEditable = (isUserAdmin || isCreator) && !eventData.is_done;

            const tStart = eventData.time_start || "09:00";
            const [sh24, sm] = tStart.split(":");
            let sh = parseInt(sh24, 10);
            let s_ampm = "AM";
            if (sh >= 12) {
                s_ampm = "PM";
                if (sh > 12) sh -= 12;
            }
            if (sh === 0) sh = 12;

            const tStop = eventData.time_stop || "10:00";
            const [eh24, em] = tStop.split(":");
            let eh = parseInt(eh24, 10);
            let e_ampm = "AM";
            if (eh >= 12) {
                e_ampm = "PM";
                if (eh > 12) eh -= 12;
            }
            if (eh === 0) eh = 12;

            this.state.activityForm = {
                raw_id: eventData.raw_id,
                source: eventData.source || "calendar",
                type: eventData.type || "meeting",
                title: eventData.raw_title || eventData.title.replace(/^✓\s*/, ""),
                date: eventData.date || dateVal,
                start_h: String(sh),
                start_m: String(parseInt(sm, 10)),
                start_ampm: s_ampm,
                stop_h: String(eh),
                stop_m: String(parseInt(em, 10)),
                stop_ampm: e_ampm,
                user_ids: [...(eventData.user_ids || [])],
                department_id: eventData.department_id || "",
                description: (eventData.description || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim(),
                is_done: !!eventData.is_done,
                role_level: eventData.role_level || "team",
            };
        } else {
            this.state.isEditMode = false;
            this.state.isEventEditable = true;
            this.state.activityForm = {
                raw_id: null,
                source: "calendar",
                type: "meeting",
                title: "",
                date: dateVal,
                start_h: "9",
                start_m: "0",
                start_ampm: "AM",
                stop_h: "10",
                stop_m: "0",
                stop_ampm: "AM",
                user_ids: [],
                department_id: "",
                description: "",
                is_done: false,
                role_level: "team",
            };
        }
        this.state.showActivityModal = true;
    }

    closeActivityModal() {
        this.state.showActivityModal = false;
    }

    getUserName(uid) {
        const u = this.state.allUsers.find(x => x.id === uid);
        return u ? u.name : `User ${uid}`;
    }

    getUserInitials(uid) {
        const name = this.getUserName(uid);
        const parts = name.split(" ");
        return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
    }

    getAvailableDepartments() {
        let depts = this.state.dashboardData.departments || [];
        if (!depts.length && this.state.allUsers.length) {
            const deptMap = {};
            for (const u of this.state.allUsers) {
                const dn = (u.department_name || u.department || '').trim();
                const did = u.department_id || dn;
                if (dn && dn !== 'Other' && !deptMap[dn]) {
                    deptMap[dn] = { id: did, name: dn };
                }
            }
            depts = Object.values(deptMap);
        }

        const selectedIds = this.state.activityForm.user_ids || [];
        const availableUsers = this.state.allUsers.filter(u => !selectedIds.includes(u.id));

        const countMap = {};
        for (const u of availableUsers) {
            const dept = (u.department_name || u.department || 'Other').trim();
            countMap[dept] = (countMap[dept] || 0) + 1;
        }

        return depts.map(d => ({
            id: d.id,
            name: d.name,
            count: countMap[d.name] || 0,
        })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    getAvailableEmployees() {
        const selectedIds = this.state.activityForm.user_ids || [];
        let emps = this.state.allUsers.filter(u => !selectedIds.includes(u.id));

        if (this.state.selectedDepartmentToSelect) {
            const targetDept = this.state.selectedDepartmentToSelect.trim().toLowerCase();
            emps = emps.filter(u => {
                const uDept = (u.department_name || u.department || '').trim().toLowerCase();
                const uDeptId = String(u.department_id || '');
                return uDept === targetDept || (uDept && uDept.includes(targetDept)) || uDeptId === targetDept;
            });
        }

        return emps.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    onDepartmentSelectChange(ev) {
        if (ev && ev.target) {
            this.state.selectedDepartmentToSelect = ev.target.value || '';
            this.state.selectedPersonToSelect = '';
        }
    }

    onPersonDropdownChange(ev) {
        if (ev && ev.target && ev.target.value) {
            const pid = parseInt(ev.target.value, 10);
            if (pid && !this.state.activityForm.user_ids.includes(pid)) {
                this.state.activityForm.user_ids.push(pid);
            }
            this.state.selectedPersonToSelect = '';
        }
    }

    removePerson(uid) {
        this.state.activityForm.user_ids = this.state.activityForm.user_ids.filter(id => id !== uid);
    }

    async saveActivity(markDone = false) {
        const f = this.state.activityForm;
        if (!f.title) {
            this.notification.add("Please enter a meeting title.", { type: "warning" });
            return;
        }

        let startH = parseInt(f.start_h, 10);
        if (f.start_ampm === "PM" && startH < 12) startH += 12;
        if (f.start_ampm === "AM" && startH === 12) startH = 0;
        const timeStart = `${String(startH).padStart(2, "0")}:${String(parseInt(f.start_m, 10)).padStart(2, "0")}`;

        let stopH = parseInt(f.stop_h, 10);
        if (f.stop_ampm === "PM" && stopH < 12) stopH += 12;
        if (f.stop_ampm === "AM" && stopH === 12) stopH = 0;
        const timeStop = `${String(stopH).padStart(2, "0")}:${String(parseInt(f.stop_m, 10)).padStart(2, "0")}`;

        try {
            const res = await rpc("/custom_calendar/save_event", {
                raw_id: f.raw_id,
                title: f.title,
                activity_type: f.type || "meeting",
                date: f.date,
                time_start: timeStart,
                time_stop: timeStop,
                user_ids: f.user_ids,
                department_id: f.department_id ? parseInt(f.department_id, 10) : false,
                description: f.description,
                mark_done: markDone,
            });

            if (res && res.status === "success") {
                this.notification.add(markDone ? "Meeting marked as completed!" : "Meeting saved successfully!", { type: "success" });
                this.closeActivityModal();
                await this.loadCalendarData();
            } else {
                this.notification.add(res ? res.message : "Error saving meeting", { type: "danger" });
            }
        } catch (e) {
            this.notification.add("Failed to save meeting.", { type: "danger" });
        }
    }

    async reopenActivity() {
        const f = this.state.activityForm;
        try {
            const res = await rpc("/custom_calendar/save_event", {
                raw_id: f.raw_id,
                title: f.title,
                date: f.date,
                unmark_done: true,
            });
            if (res && res.status === "success") {
                this.notification.add("Meeting reopened / marked incomplete!", { type: "success" });
                this.closeActivityModal();
                await this.loadCalendarData();
            }
        } catch (e) {
            this.notification.add("Failed to reopen meeting.", { type: "danger" });
        }
    }

    async deleteEvent() {
        const f = this.state.activityForm;
        if (!f.raw_id) return;
        if (!this.state.isEventEditable) {
            this.notification.add("Only the person who scheduled this meeting or an Admin can delete it.", { type: "warning" });
            return;
        }
        try {
            const res = await rpc("/custom_calendar/delete_event", {
                raw_id: f.raw_id,
                source: f.source,
            });
            if (res && res.status === "success") {
                this.notification.add("Meeting deleted successfully.", { type: "success" });
                this.closeActivityModal();
                await this.loadCalendarData();
            } else {
                this.notification.add(res ? res.message : "Error deleting meeting.", { type: "danger" });
            }
        } catch (e) {
            this.notification.add("Failed to delete meeting.", { type: "danger" });
        }
    }
}

registry.category("actions").add("custom_calendar_action", CustomCalendarAction);
registry.category("actions").add("custom_calendar.meeting_calendar", CustomCalendarAction);
registry.category("actions").add("custom_discuss_meeting_calendar_action", CustomCalendarAction);
