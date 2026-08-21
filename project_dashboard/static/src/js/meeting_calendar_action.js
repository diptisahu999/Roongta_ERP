/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, useState, onWillStart } from "@odoo/owl";
import { MeetingCalendar } from "./meeting_calendar";
import { useService } from "@web/core/utils/hooks";
import { rpc } from "@web/core/network/rpc";
import { xml } from "@odoo/owl";

export class ProjectMeetingCalendarWrapper extends Component {
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
                level="state.level"
                isUserAdmin="state.isUserAdmin"
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
    static components = { MeetingCalendar };

    setup() {
        this.actionService = useService("action");

        this.state = useState({
            dashboardData: {},
            searchQuery: "",
            isUserAdmin: false,
            level: 1,
            
            // Modal States
            showActivityModal: false,
            isEditMode: false,
            isEventEditable: true,
            personSearchQuery: '',
            selectedDepartmentToSelect: '',
            selectedPersonToSelect: '',
            activityForm: {
                event_id: null,
                source: 'calendar',
                type: 'meeting',
                date: '',
                time_start: '09:00',
                time_stop: '10:00',
                summary: '',
                description: '',
                user_ids: []
            },
            showPersonCard: false,
            personCardData: null,
            loading: false
        });

        onWillStart(async () => {
            await this.loadData();
        });
    }

    async loadData() {
        try {
            const data = await rpc("/project_dashboard/data", {
                level: 1,
            });
            this.state.dashboardData = data;
            this.state.isUserAdmin = !!data.is_admin;
        } catch (e) {
            console.error("Error loading calendar data", e);
        }
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

        this.state.activityForm = {
            event_id: ev.id,
            source: ev.source || 'calendar',
            type: ev.type || 'meeting',
            date: ev.date,
            time_start: ev.time_start || '09:00',
            time_stop: ev.time_stop || '10:00',
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

    getEmployees() {
        return (this.state.dashboardData && this.state.dashboardData.filter_data && this.state.dashboardData.filter_data.employees) || [];
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
        if (!this.state.dashboardData || !this.state.dashboardData.filter_data || !this.state.dashboardData.filter_data.employees) return;
        const emp = this.state.dashboardData.filter_data.employees.find(e => e.id === uid);
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
}

registry.category("actions").add("project_meeting_calendar_action", ProjectMeetingCalendarWrapper);
