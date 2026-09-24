/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, useState, onWillStart, onMounted, onWillUnmount, useRef, markup } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { ListController } from "@web/views/list/list_controller";
import { KanbanController } from "@web/views/kanban/kanban_controller";
import { FormController } from "@web/views/form/form_controller";
import { SelectCreateDialog } from "@web/views/view_dialogs/select_create_dialog";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";

export class TaskDetailView extends Component {
    static template = "custom_task_detail.TaskDetailView";

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.dialog = useService("dialog");
        this.notification = useService("notification");
        this.fileInputRef = useRef("fileInputRef");
        this.imageInputRef = useRef("imageInputRef");
        this.descEditorRef = useRef("descEditorRef");
        this.newSubtaskInputRef = useRef("newSubtaskInputRef");
        this.subtaskAssigneeSearchRef = useRef("subtaskAssigneeSearchRef");
        this.mainAssigneeSearchRef = useRef("mainAssigneeSearchRef");
        this.projectSearchRef = useRef("projectSearchRef");
        this.departmentSearchRef = useRef("departmentSearchRef");
        this.tagSearchRef = useRef("tagSearchRef");
        this.labelSearchRef = useRef("labelSearchRef");
        this.deadlineInputRef = useRef("deadlineInputRef");

        // Extract task ID from action params, context, props, session storage, or URL
        const actionParams = (this.props.action && this.props.action.params) || {};
        const actionContext = (this.props.action && this.props.action.context) || {};
        let taskId = this.props.task_id || actionParams.task_id || actionParams.id || actionContext.default_task_id || actionContext.active_id || null;
        if (!taskId) {
            try {
                const stored = sessionStorage.getItem("last_opened_task_id");
                if (stored) {
                    taskId = parseInt(stored);
                }
            } catch (e) {}
        }
        if (!taskId) {
            const match = window.location.href.match(/project\.task\/(\d+)/) || window.location.href.match(/id=(\d+)/);
            if (match) {
                taskId = parseInt(match[1]);
            }
        }

        this.state = useState({
            taskId: taskId,
            loading: true,
            isEditMode: false,
            isDirty: false,
            draftValues: {},
            originalTask: null,
            isSavingDesc: false,
            selectedImage: false,
            imgPopoverPos: { top: 0, left: 0 },
            middleTab: "description", // 'description' | 'subtasks'
            activeTab: "overview", // 'overview' | 'activity' | 'comments' | 'checklist' | 'attachments'
            isAddingSubtask: false,
            newSubtaskTitle: "",
            newSubtaskUserIds: [],
            newSubtaskAssigneeDropdownOpen: false,
            subtaskAssigneeSearch: "",
            mainAssigneeSearch: "",
            projectSearch: "",
            departmentSearch: "",
            tagSearch: "",
            labelSearch: "",
            task: {
                name: "",
                state_label: "In Progress",
                department_name: "",
                tag_name: "",
                project_name: "",
                milestone_name: "",
                label_name: "",
                date_deadline: "",
                date_deadline_iso: "",
                is_overdue: false,
                overdue_days: 0,
                allocated_time_formatted: "0h 00m (0%)",
                description: "",
                priority_int: 0,
                assignees: [],
                subtasks: [],
                subtasks_count: 0,
                checklist: [],
                activities: [],
                comments: [],
                attachments: [],
                options: {
                    states: [
                        { code: "01_in_progress", name: "In Progress", color: "#2563eb" },
                        { code: "02_changes_requested", name: "Changes Requested", color: "#d97706" },
                        { code: "03_approved", name: "Approved", color: "#16a34a" },
                        { code: "04_waiting_normal", name: "Waiting / Blocked", color: "#9333ea" },
                        { code: "05_management_discussion", name: "MGMT Discussion", color: "#0891b2" },
                        { code: "1_done", name: "Done", color: "#10b981" },
                        { code: "1_canceled", name: "Cancelled", color: "#6b7280" },
                    ],
                    projects: [],
                    users: [],
                    tags: [],
                    labels: [],
                    departments: [],
                    milestones: [],
                },
                pager: { current: 1, total: 1, prev_id: null, next_id: null },
            },
            dropdownOpen: {
                status: false,
                state: false,
                priority: false,
                project: false,
                assignee: false,
                tag: false,
                label: false,
                department: false,
                actions: false,
            },
            recurrencePopoverOpen: false,
            recurrenceDraft: {
                recurring_task: false,
                repeat_interval: 1,
                repeat_unit: "week",
                repeat_type: "forever",
                repeat_until: "",
                repeat_number: 1,
                recurrence_time_str: "00:00",
            },
            deadlineModalOpen: false,
            deadlineModalDate: "",
            deadlineModalReason: "",
            deadlineModalError: "",
            isSavingDeadlineModal: false,
            newCommentBody: "",
            newChecklistName: "",
        });

        this.onDocClick = this.onDocClick.bind(this);

        onWillStart(async () => {
            await this.loadTaskData(this.state.taskId);
        });

        onMounted(() => {
            document.addEventListener("click", this.onDocClick);
            this.syncDescEditor();
        });

        onWillUnmount(() => {
            document.removeEventListener("click", this.onDocClick);
        });
    }

    onDocClick(e) {
        if (!e.target.closest(".ctd-status-dropdown-wrap") &&
            !e.target.closest(".ctd-field-row") &&
            !e.target.closest(".position-relative") &&
            !e.target.closest(".ctd-recurrence-popover")) {
            this.closeAllDropdowns();
        }
        if (!e.target.closest(".ctd-inline-assignee-trigger") && !e.target.closest(".ctd-subtask-dropdown")) {
            this.state.newSubtaskAssigneeDropdownOpen = false;
        }
        if (!e.target.closest(".ctd-img-popover-toolbar") && !e.target.closest(".ctd-description-content img")) {
            this.deselectImage();
        }
    }

    closeAllDropdowns() {
        this.state.dropdownOpen.status = false;
        this.state.dropdownOpen.state = false;
        this.state.dropdownOpen.priority = false;
        this.state.dropdownOpen.project = false;
        this.state.dropdownOpen.assignee = false;
        this.state.dropdownOpen.tag = false;
        this.state.dropdownOpen.label = false;
        this.state.dropdownOpen.department = false;
        this.state.dropdownOpen.actions = false;
        this.state.newSubtaskAssigneeDropdownOpen = false;
        this.state.recurrencePopoverOpen = false;
    }

    getStateColor(stateCode) {
        switch (stateCode) {
            case "03_approved":
                return "#16a34a";
            case "02_changes_requested":
                return "#d97706";
            case "05_management_discussion":
                return "#0891b2";
            case "04_waiting_normal":
                return "#9333ea";
            case "1_done":
                return "#059669";
            case "1_canceled":
                return "#6b7280";
            case "01_in_progress":
            default:
                return "#2563eb";
        }
    }

    getOptions(type) {
        return (this.state.task && this.state.task.options && this.state.task.options[type]) || [];
    }

    get groupedComments() {
        const comments = (this.state.task && this.state.task.comments) || [];
        const groups = [];
        const map = new Map();

        for (const msg of comments) {
            const groupKey = msg.date_group || "Past";
            if (!map.has(groupKey)) {
                const grp = { date: groupKey, messages: [] };
                map.set(groupKey, grp);
                groups.push(grp);
            }
            map.get(groupKey).messages.push(msg);
        }
        return groups;
    }

    notify(message, type = "info") {
        if (this.notification && typeof this.notification.add === "function") {
            this.notification.add(message, { type });
        }
    }

    setTaskData(data) {
        if (!data || data.error) return;
        if (data.comments) {
            data.comments.forEach(c => {
                let bodyStr = c.body || "";
                if (bodyStr.includes("&lt;") || bodyStr.includes("&gt;")) {
                    const txt = document.createElement("textarea");
                    txt.innerHTML = bodyStr;
                    bodyStr = txt.value;
                }
                c.bodyHtml = markup(bodyStr);
            });
        }
        this.state.originalTask = JSON.parse(JSON.stringify(data));
        this.state.task = data;
        this.state.taskId = data.id;
        if (data.is_subtask) {
            this.state.middleTab = "description";
        }
        this.state.isDirty = false;
        this.state.draftValues = {};
        this.syncDescEditor();
    }

    async loadTaskData(taskId) {
        this.state.loading = true;
        try {
            const targetId = taskId ? parseInt(taskId) : false;
            const data = await this.orm.call("project.task", "get_custom_task_detail", [targetId]);
            if (data && !data.error) {
                this.setTaskData(data);
                try {
                    sessionStorage.setItem("last_opened_task_id", String(data.id));
                } catch (e) {}
            } else if (data && data.error) {
                this.notify(data.error, "warning");
            }
        } catch (err) {
            console.error("Error loading task details:", err);
            this.notify("Could not load task data.", "danger");
        } finally {
            this.state.loading = false;
            setTimeout(() => this.syncDescEditor(), 50);
        }
    }

    syncDescEditor() {
        if (this.descEditorRef.el) {
            this.descEditorRef.el.innerHTML = this.state.task.description || "";
        }
    }

    goBack() {
        this.action.restore();
    }

    toggleEditMode() {
        this.state.isEditMode = !this.state.isEditMode;
    }

    switchTab(tabName) {
        this.state.activeTab = tabName;
    }

    switchMiddleTab(tabName) {
        this.state.middleTab = tabName;
        if (tabName === "description") {
            setTimeout(() => this.syncDescEditor(), 50);
        }
    }

    toggleQuickSettings(e) {
        if (e) e.stopPropagation();
        this.toggleEditMode();
    }

    // Dropdown togglers
    toggleStatusDropdown(e) {
        if (e) e.stopPropagation();
        const cur = this.state.dropdownOpen.status;
        this.closeAllDropdowns();
        this.state.dropdownOpen.status = !cur;
    }

    toggleStateDropdown(e) {
        if (e) e.stopPropagation();
        const cur = this.state.dropdownOpen.state;
        this.closeAllDropdowns();
        this.state.dropdownOpen.state = !cur;
    }

    toggleProjectDropdown(e) {
        if (e) e.stopPropagation();
        const cur = this.state.dropdownOpen.project;
        this.closeAllDropdowns();
        this.state.dropdownOpen.project = !cur;
        if (this.state.dropdownOpen.project) {
            this.state.projectSearch = "";
            setTimeout(() => {
                if (this.projectSearchRef.el) {
                    this.projectSearchRef.el.focus();
                }
            }, 50);
        }
    }

    getFilteredProjects() {
        const projects = this.getOptions("projects");
        const q = (this.state.projectSearch || "").trim().toLowerCase();
        if (!q) return projects;
        return projects.filter(p => (p.name || "").toLowerCase().includes(q));
    }

    clearProjectSearch(e) {
        if (e) e.stopPropagation();
        this.state.projectSearch = "";
    }

    toggleAssigneeDropdown(e) {
        if (e) e.stopPropagation();
        const cur = this.state.dropdownOpen.assignee;
        this.closeAllDropdowns();
        this.state.dropdownOpen.assignee = !cur;
        if (this.state.dropdownOpen.assignee) {
            this.state.mainAssigneeSearch = "";
            setTimeout(() => {
                if (this.mainAssigneeSearchRef.el) {
                    this.mainAssigneeSearchRef.el.focus();
                }
            }, 50);
        }
    }

    getFilteredMainAssigneeUsers() {
        const users = this.getOptions("users");
        const q = (this.state.mainAssigneeSearch || "").trim().toLowerCase();
        if (!q) return users;
        return users.filter(u => (u.name || "").toLowerCase().includes(q));
    }

    clearMainAssigneeSearch(e) {
        if (e) e.stopPropagation();
        this.state.mainAssigneeSearch = "";
    }

    toggleTagDropdown(e) {
        if (e) e.stopPropagation();
        const cur = this.state.dropdownOpen.tag;
        this.closeAllDropdowns();
        this.state.dropdownOpen.tag = !cur;
        if (this.state.dropdownOpen.tag) {
            this.state.tagSearch = "";
            setTimeout(() => {
                if (this.tagSearchRef.el) {
                    this.tagSearchRef.el.focus();
                }
            }, 50);
        }
    }

    getFilteredTags() {
        const tags = this.getOptions("tags");
        const q = (this.state.tagSearch || "").trim().toLowerCase();
        if (!q) return tags;
        return tags.filter(t => (t.name || "").toLowerCase().includes(q));
    }

    clearTagSearch(e) {
        if (e) e.stopPropagation();
        this.state.tagSearch = "";
    }

    toggleLabelDropdown(e) {
        if (e) e.stopPropagation();
        const cur = this.state.dropdownOpen.label;
        this.closeAllDropdowns();
        this.state.dropdownOpen.label = !cur;
        if (this.state.dropdownOpen.label) {
            this.state.labelSearch = "";
            setTimeout(() => {
                if (this.labelSearchRef.el) {
                    this.labelSearchRef.el.focus();
                }
            }, 50);
        }
    }

    getFilteredLabels() {
        const labels = this.getOptions("labels");
        const q = (this.state.labelSearch || "").trim().toLowerCase();
        if (!q) return labels;
        return labels.filter(l => (l.name || "").toLowerCase().includes(q));
    }

    clearLabelSearch(e) {
        if (e) e.stopPropagation();
        this.state.labelSearch = "";
    }

    toggleDepartmentDropdown(e) {
        if (e) e.stopPropagation();
        const cur = this.state.dropdownOpen.department;
        this.closeAllDropdowns();
        this.state.dropdownOpen.department = !cur;
        if (this.state.dropdownOpen.department) {
            this.state.departmentSearch = "";
            setTimeout(() => {
                if (this.departmentSearchRef.el) {
                    this.departmentSearchRef.el.focus();
                }
            }, 50);
        }
    }

    getFilteredDepartments() {
        const departments = this.getOptions("departments");
        const q = (this.state.departmentSearch || "").trim().toLowerCase();
        if (!q) return departments;
        return departments.filter(d => (d.name || "").toLowerCase().includes(q));
    }

    clearDepartmentSearch(e) {
        if (e) e.stopPropagation();
        this.state.departmentSearch = "";
    }

    togglePriorityDropdown(e) {
        if (e) e.stopPropagation();
        const cur = this.state.dropdownOpen.priority;
        this.closeAllDropdowns();
        this.state.dropdownOpen.priority = !cur;
    }

    getPriorityLabel(prio) {
        switch (String(prio)) {
            case "1":
                return "Medium";
            case "2":
                return "High";
            case "3":
                return "Urgent";
            case "0":
            default:
                return "Low";
        }
    }

    setPriority(prioInt) {
        this.closeAllDropdowns();
        const currentPrio = this.state.task.priority_int || 0;
        const newPrio = currentPrio === prioInt ? 0 : prioInt;
        this.state.task.priority_int = newPrio;
        this.state.task.priority = String(newPrio);
        this.state.draftValues.priority = String(newPrio);
        this.state.isDirty = true;
    }

    toggleActionsMenu(e) {
        if (e) e.stopPropagation();
        const cur = this.state.dropdownOpen.actions;
        this.closeAllDropdowns();
        this.state.dropdownOpen.actions = !cur;
    }

    // ═══ Recurrence Management ═══
    toggleRecurrencePopover(e) {
        if (e && typeof e.stopPropagation === "function") {
            e.stopPropagation();
        }
        const cur = this.state.recurrencePopoverOpen;
        this.closeAllDropdowns();
        this.state.recurrencePopoverOpen = !cur;
        if (this.state.recurrencePopoverOpen) {
            this.state.recurrenceDraft = {
                recurring_task: !!(this.state.task && this.state.task.recurring_task),
                repeat_interval: (this.state.task && this.state.task.repeat_interval) || 1,
                repeat_unit: (this.state.task && this.state.task.repeat_unit) || "week",
                repeat_type: (this.state.task && this.state.task.repeat_type) || "forever",
                repeat_until: (this.state.task && this.state.task.repeat_until) || "",
                repeat_number: (this.state.task && this.state.task.repeat_number) || 1,
                recurrence_time_str: (this.state.task && this.state.task.recurrence_time_str) || "00:00",
            };
        }
    }

    closeRecurrencePopover(e) {
        if (e && typeof e.stopPropagation === "function") {
            e.stopPropagation();
        }
        this.state.recurrencePopoverOpen = false;
    }

    toggleRecurrenceDraftSwitch() {
        this.state.recurrenceDraft.recurring_task = !this.state.recurrenceDraft.recurring_task;
    }

    getRecurrenceSummaryText() {
        if (!this.state.recurrenceDraft.recurring_task) {
            return "Recurrence is currently disabled.";
        }
        const intVal = this.state.recurrenceDraft.repeat_interval || 1;
        const unitMap = { day: "Day", week: "Week", month: "Month", year: "Year" };
        const unitLabel = unitMap[this.state.recurrenceDraft.repeat_unit] || "Week";
        const plural = intVal > 1 ? `${unitLabel}s` : unitLabel;
        let txt = `Repeats every ${intVal} ${plural}`;

        if (this.state.recurrenceDraft.repeat_type === "until" && this.state.recurrenceDraft.repeat_until) {
            txt += ` until ${this.state.recurrenceDraft.repeat_until}`;
        } else if (this.state.recurrenceDraft.repeat_type === "after" && this.state.recurrenceDraft.repeat_number) {
            txt += `, ${this.state.recurrenceDraft.repeat_number} times`;
        } else {
            txt += " forever";
        }

        if (this.state.recurrenceDraft.recurrence_time_str && this.state.recurrenceDraft.recurrence_time_str !== "00:00") {
            txt += ` at ${this.state.recurrenceDraft.recurrence_time_str}`;
        }
        return txt;
    }

    async saveRecurrenceSettings() {
        try {
            let recTimeFloat = 0.0;
            if (this.state.recurrenceDraft.recurrence_time_str) {
                const parts = this.state.recurrenceDraft.recurrence_time_str.split(":");
                if (parts.length === 2) {
                    recTimeFloat = parseInt(parts[0] || 0) + (parseInt(parts[1] || 0) / 60.0);
                }
            }
            const payload = {
                recurring_task: this.state.recurrenceDraft.recurring_task,
                repeat_interval: parseInt(this.state.recurrenceDraft.repeat_interval) || 1,
                repeat_unit: this.state.recurrenceDraft.repeat_unit || "week",
                repeat_type: this.state.recurrenceDraft.repeat_type || "forever",
                repeat_until: this.state.recurrenceDraft.repeat_until || false,
                repeat_number: parseInt(this.state.recurrenceDraft.repeat_number) || 1,
                recurrence_time: recTimeFloat,
            };

            const updatedData = await this.orm.call("project.task", "save_task_recurrence", [
                this.state.taskId,
                payload,
            ]);
            this.setTaskData(updatedData);
            this.state.recurrencePopoverOpen = false;
            this.notify(payload.recurring_task ? "Recurrence enabled & saved." : "Recurrence disabled.", "success");
        } catch (err) {
            console.error("Error saving recurrence:", err);
            this.notify("Could not save recurrence settings.", "danger");
        }
    }

    // Field updates (Staged in Draft until Save is clicked)
    onTitleChange(e) {
        const val = e.target.value;
        this.state.task.name = val;
        this.state.draftValues.name = val;
        this.state.isDirty = true;
    }

    changeStage(stageId) {
        this.closeAllDropdowns();
        const st = this.getOptions("stages").find(s => s.id === stageId);
        if (st) {
            this.state.task.stage_id = st.id;
            this.state.task.stage_name = st.name;
            this.state.task.stage_color = st.color;
        }
        this.state.draftValues.stage_id = stageId;
        this.state.isDirty = true;
    }

    changeState(statusCode) {
        this.closeAllDropdowns();
        const st = this.getOptions("states").find(s => s.code === statusCode);
        if (st) {
            this.state.task.state = st.code;
            this.state.task.state_label = st.name;
        }
        this.state.draftValues.state = statusCode;
        this.state.isDirty = true;
    }

    togglePriority() {
        const newPriority = this.state.task.priority_int > 0 ? 0 : 1;
        this.setPriority(newPriority);
    }

    changeProject(projectId) {
        this.closeAllDropdowns();
        const p = this.getOptions("projects").find(x => x.id === projectId);
        if (p) {
            this.state.task.project_id = p.id;
            this.state.task.project_name = p.name;
        }
        this.state.draftValues.project_id = projectId;
        this.state.isDirty = true;
    }

    onMilestoneChange(e) {
        const val = e.target.value;
        this.state.task.milestone_name = val;
        this.state.draftValues.milestone_name = val;
        this.state.isDirty = true;
    }

    changeTag(tagId) {
        this.closeAllDropdowns();
        const tg = this.getOptions("tags").find(x => x.id === tagId);
        if (tg) {
            this.state.task.tag_id = tg.id;
            this.state.task.tag_name = tg.name;
        }
        this.state.draftValues.single_tag_id = tagId;
        this.state.isDirty = true;
    }

    changeLabel(labelId) {
        this.closeAllDropdowns();
        const lb = this.getOptions("labels").find(x => x.id === labelId);
        if (lb) {
            this.state.task.label_id = lb.id;
            this.state.task.label_name = lb.name;
        }
        this.state.draftValues.label_id = labelId;
        this.state.isDirty = true;
    }

    changeDepartment(deptId) {
        this.closeAllDropdowns();
        const d = this.getOptions("departments").find(x => x.id === deptId);
        if (d) {
            this.state.task.department_id = d.id;
            this.state.task.department_name = d.name;
        }
        this.state.draftValues.department_id = deptId;
        this.state.isDirty = true;
    }

    openDeadlinePicker(e) {
        if (e && typeof e.stopPropagation === "function") {
            e.stopPropagation();
        }
        if (!this.state.task.can_edit_deadline) {
            this.state.deadlineModalDate = this.state.task.date_deadline_iso || "";
            this.state.deadlineModalReason = "";
            this.state.deadlineModalError = "";
            this.state.deadlineModalOpen = true;
            return;
        }
        const el = this.deadlineInputRef && this.deadlineInputRef.el;
        if (el) {
            try {
                if (typeof el.showPicker === "function") {
                    el.showPicker();
                } else {
                    el.focus();
                    el.click();
                }
            } catch (err) {
                el.focus();
                el.click();
            }
        }
    }

    closeDeadlineModal() {
        this.state.deadlineModalOpen = false;
        this.state.deadlineModalReason = "";
        this.state.deadlineModalError = "";
    }

    async submitDeadlineWithReason() {
        if (!this.state.deadlineModalDate) {
            this.state.deadlineModalError = "Please select a deadline date.";
            return;
        }
        const reason = (this.state.deadlineModalReason || "").trim();
        if (!reason) {
            this.state.deadlineModalError = "Please provide a reason for changing the deadline.";
            return;
        }

        this.state.isSavingDeadlineModal = true;
        this.state.deadlineModalError = "";
        try {
            const updatedData = await this.orm.call("project.task", "change_deadline_with_reason", [
                this.state.taskId,
                this.state.deadlineModalDate,
                reason,
            ]);
            this.setTaskData(updatedData);
            this.state.deadlineModalOpen = false;
            this.state.deadlineModalReason = "";
            this.notify("Deadline updated and logged to chatter.", "success");
        } catch (err) {
            console.error("Error updating deadline with reason:", err);
            this.state.deadlineModalError = (err.data && err.data.message) || err.message || "Could not update deadline.";
        } finally {
            this.state.isSavingDeadlineModal = false;
        }
    }

    onDeadlineChange(e) {
        const val = e.target.value;
        this.state.task.date_deadline_iso = val;
        if (val) {
            const parts = val.split("-");
            if (parts.length === 3) {
                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const day = parseInt(parts[2]);
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                this.state.task.date_deadline = `${day} ${months[month]} ${year}`;

                // Calculate overdue dynamically
                const now = new Date();
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const deadlineMidnight = new Date(year, month, day);
                if (deadlineMidnight < todayMidnight) {
                    this.state.task.is_overdue = true;
                    this.state.task.overdue_days = Math.round((todayMidnight - deadlineMidnight) / (1000 * 60 * 60 * 24));
                } else {
                    this.state.task.is_overdue = false;
                    this.state.task.overdue_days = 0;
                }
            }
        } else {
            this.state.task.date_deadline = "";
            this.state.task.is_overdue = false;
            this.state.task.overdue_days = 0;
        }
        this.state.draftValues.date_deadline = val;
        this.state.isDirty = true;
    }

    onDescriptionChange(e) {
        const val = e.target.value;
        this.state.task.description = val;
        this.state.draftValues.description = val;
        this.state.isDirty = true;
    }

    getAssigneeSummary() {
        if (!this.state.task || !this.state.task.assignees || this.state.task.assignees.length === 0) {
            return "Select Assignees";
        }
        return this.state.task.assignees.map(a => a.name).join(", ");
    }

    isAssigneeSelected(userId) {
        if (!this.state.task || !this.state.task.assignees) return false;
        return this.state.task.assignees.some(a => a.id === userId);
    }

    toggleAssigneeUser(userId, e) {
        if (e && typeof e.stopPropagation === "function") {
            e.stopPropagation();
        }
        if (!this.state.task.assignees) this.state.task.assignees = [];
        const exists = this.state.task.assignees.some(a => a.id === userId);
        if (exists) {
            this.state.task.assignees = this.state.task.assignees.filter(a => a.id !== userId);
        } else {
            const u = this.getOptions("users").find(x => x.id === userId);
            if (u) {
                this.state.task.assignees.push({
                    id: u.id,
                    name: u.name,
                    initials: u.initials || (u.name ? u.name.substring(0, 2).toUpperCase() : "U"),
                    color: u.color || "#2563eb",
                    avatar: u.avatar || `/web/image/res.users/${u.id}/avatar_128`,
                    department_name: u.department_name || "",
                });
            }
        }
        this.state.draftValues.user_ids = this.state.task.assignees.map(a => a.id);
        this.state.isDirty = true;
    }

    openSearchMoreAssignees(e) {
        if (e && typeof e.stopPropagation === "function") {
            e.stopPropagation();
        }
        this.closeAllDropdowns();

        this.dialog.add(SelectCreateDialog, {
            resModel: "res.users",
            title: _t("Search: Assignees"),
            multiSelect: true,
            domain: [["share", "=", false], ["active", "=", true]],
            context: {
                search_default_filter_no_share: 1,
                search_default_group_by_department: 1,
            },
            onSelected: async (resIds) => {
                const ids = Array.isArray(resIds) ? resIds : [resIds];
                await this.addAssigneeUserIds(ids);
            },
        });
    }

    async addAssigneeUserIds(ids) {
        if (!ids || !ids.length) return;
        if (!this.state.task.assignees) {
            this.state.task.assignees = [];
        }
        const existingIds = new Set(this.state.task.assignees.map(a => a.id));
        const allUsers = this.getOptions("users");
        const avatarPalette = ["#f59e0b", "#8b5cf6", "#3b82f6", "#10b981", "#ec4899", "#06b6d4", "#f97316"];
        
        const missingIds = [];
        for (const uid of ids) {
            if (!existingIds.has(uid)) {
                const found = allUsers.find(u => u.id === uid);
                if (found) {
                    this.state.task.assignees.push({
                        id: found.id,
                        name: found.name,
                        initials: found.initials || (found.name ? found.name.substring(0, 2).toUpperCase() : "U"),
                        color: found.color || "#2563eb",
                        avatar: found.avatar || `/web/image/res.users/${found.id}/avatar_128`,
                        department_name: found.department_name || "",
                    });
                    existingIds.add(uid);
                } else {
                    missingIds.push(uid);
                }
            }
        }

        if (missingIds.length > 0) {
            try {
                const fetched = await this.orm.read("res.users", missingIds, ["id", "name", "department_id"]);
                for (const u of fetched) {
                    if (!existingIds.has(u.id)) {
                        const parts = (u.name || "").split(" ");
                        const initials = parts.slice(0, 2).map(p => p[0].toUpperCase()).join("") || "U";
                        const hashIdx = (u.name || "").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % avatarPalette.length;
                        this.state.task.assignees.push({
                            id: u.id,
                            name: u.name,
                            initials: initials,
                            color: avatarPalette[hashIdx],
                            avatar: `/web/image/res.users/${u.id}/avatar_128`,
                            department_name: u.department_id ? u.department_id[1] : "",
                        });
                        existingIds.add(u.id);
                    }
                }
            } catch (err) {
                console.error("Error fetching user details:", err);
            }
        }

        this.state.draftValues.user_ids = this.state.task.assignees.map(a => a.id);
        this.state.isDirty = true;
    }

    openSearchMoreSubtaskAssignees(e) {
        if (e && typeof e.stopPropagation === "function") {
            e.stopPropagation();
        }
        this.state.newSubtaskAssigneeDropdownOpen = false;

        this.dialog.add(SelectCreateDialog, {
            resModel: "res.users",
            title: _t("Search: Assignees"),
            multiSelect: true,
            domain: [["share", "=", false], ["active", "=", true]],
            context: {
                search_default_filter_no_share: 1,
                search_default_group_by_department: 1,
            },
            onSelected: (resIds) => {
                const ids = Array.isArray(resIds) ? resIds : [resIds];
                for (const uid of ids) {
                    if (!this.state.newSubtaskUserIds.includes(uid)) {
                        this.state.newSubtaskUserIds.push(uid);
                    }
                }
            },
        });
    }

    async saveAllChanges() {
        this.markDescDirty();
        if (!this.state.isDirty) {
            return;
        }

        this.state.isSavingDesc = true;
        try {
            const updatedData = await this.orm.call("project.task", "save_task_detail_batch", [
                this.state.taskId,
                this.state.draftValues,
            ]);
            this.setTaskData(updatedData);
        } catch (err) {
            console.error("Error saving task changes:", err);
            this.notify("Could not save changes.", "danger");
        } finally {
            this.state.isSavingDesc = false;
        }
    }

    discardAllChanges() {
        if (this.state.originalTask) {
            this.setTaskData(JSON.parse(JSON.stringify(this.state.originalTask)));
        } else {
            this.loadTaskData(this.state.taskId);
        }
        this.state.isDirty = false;
        this.state.draftValues = {};
    }

    // Chatter comments
    async postComment() {
        if (!this.state.newCommentBody || !this.state.newCommentBody.trim()) {
            return;
        }
        try {
            const updatedData = await this.orm.call("project.task", "post_task_chatter_message", [
                this.state.taskId,
                this.state.newCommentBody.trim(),
                false,
            ]);
            this.setTaskData(updatedData);
            this.state.newCommentBody = "";
            this.notify("Comment posted.", "success");
        } catch (err) {
            console.error("Error posting comment:", err);
            this.notify("Could not post comment.", "danger");
        }
    }

    // ═══ Sub-tasks Management ═══
    startAddingSubtask() {
        this.state.isAddingSubtask = true;
        this.state.newSubtaskTitle = "";
        if (this.state.task.assignees && this.state.task.assignees.length > 0) {
            this.state.newSubtaskUserIds = this.state.task.assignees.map(a => a.id);
        } else {
            this.state.newSubtaskUserIds = [];
        }
        setTimeout(() => {
            if (this.newSubtaskInputRef.el) {
                this.newSubtaskInputRef.el.focus();
            }
        }, 50);
    }

    cancelNewSubtask() {
        this.state.isAddingSubtask = false;
        this.state.newSubtaskTitle = "";
        this.state.newSubtaskUserIds = [];
        this.state.newSubtaskAssigneeDropdownOpen = false;
    }

    toggleNewSubtaskAssigneeDropdown(e) {
        if (e && typeof e.stopPropagation === "function") {
            e.stopPropagation();
        }
        this.state.newSubtaskAssigneeDropdownOpen = !this.state.newSubtaskAssigneeDropdownOpen;
        if (this.state.newSubtaskAssigneeDropdownOpen) {
            this.state.subtaskAssigneeSearch = "";
            setTimeout(() => {
                if (this.subtaskAssigneeSearchRef.el) {
                    this.subtaskAssigneeSearchRef.el.focus();
                }
            }, 50);
        }
    }

    getFilteredSubtaskUsers() {
        const users = this.getOptions("users");
        const q = (this.state.subtaskAssigneeSearch || "").trim().toLowerCase();
        if (!q) return users;
        return users.filter(u => (u.name || "").toLowerCase().includes(q));
    }

    clearSubtaskAssigneeSearch(e) {
        if (e) e.stopPropagation();
        this.state.subtaskAssigneeSearch = "";
    }

    toggleNewSubtaskAssignee(userId, e) {
        if (e && typeof e.stopPropagation === "function") {
            e.stopPropagation();
        }
        const idx = this.state.newSubtaskUserIds.indexOf(userId);
        if (idx > -1) {
            this.state.newSubtaskUserIds.splice(idx, 1);
        } else {
            this.state.newSubtaskUserIds.push(userId);
        }
    }

    getNewSubtaskAssigneesSummary() {
        if (!this.state.newSubtaskUserIds || this.state.newSubtaskUserIds.length === 0) {
            return "Select Assignees";
        }
        const users = this.getOptions("users");
        const names = this.state.newSubtaskUserIds
            .map(id => {
                const u = users.find(x => x.id === id);
                return u ? u.name : "";
            })
            .filter(Boolean);
        return names.length > 0 ? names.join(", ") : "Select Assignees";
    }

    async onNewSubtaskKeyDown(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            await this.submitNewSubtask();
        } else if (e.key === "Escape") {
            this.cancelNewSubtask();
        }
    }

    async submitNewSubtask() {
        if (!this.state.newSubtaskTitle || !this.state.newSubtaskTitle.trim()) {
            this.notify("Please enter a title for the sub-task.", "warning");
            return;
        }
        try {
            const updatedData = await this.orm.call("project.task", "create_subtask_line", [
                this.state.taskId,
                this.state.newSubtaskTitle.trim(),
                this.state.newSubtaskUserIds,
            ]);
            this.setTaskData(updatedData);
            this.state.newSubtaskTitle = "";
            this.state.isAddingSubtask = false;
            this.state.newSubtaskAssigneeDropdownOpen = false;
            this.notify("Sub-task created.", "success");
        } catch (err) {
            console.error("Error creating sub-task:", err);
            this.notify("Could not create sub-task.", "danger");
        }
    }

    async deleteSubtask(subtaskId) {
        if (!confirm("Are you sure you want to remove this sub-task?")) {
            return;
        }
        try {
            const updatedData = await this.orm.call("project.task", "delete_subtask_line", [
                this.state.taskId,
                subtaskId,
            ]);
            this.setTaskData(updatedData);
            this.notify("Sub-task removed.", "info");
        } catch (err) {
            console.error("Error deleting sub-task:", err);
            this.notify("Could not delete sub-task.", "danger");
        }
    }

    async toggleSubtaskDone(subtaskId, isDone) {
        try {
            const updatedData = await this.orm.call("project.task", "toggle_checklist_subtask_status", [
                subtaskId,
                isDone,
            ]);
            this.setTaskData(updatedData);
        } catch (err) {
            console.error("Error toggling sub-task:", err);
            this.notify("Could not update sub-task status.", "danger");
        }
    }

    async openSubtask(subtaskId) {
        if (subtaskId) {
            await this.loadTaskData(subtaskId);
        }
    }

    // Checklist
    async onChecklistKeyDown(e) {
        if (e.key === "Enter") {
            await this.addChecklistItem();
        }
    }

    async addChecklistItem() {
        if (!this.state.newChecklistName || !this.state.newChecklistName.trim()) {
            return;
        }
        try {
            const updatedData = await this.orm.call("project.task", "create_checklist_subtask", [
                this.state.taskId,
                this.state.newChecklistName.trim(),
            ]);
            this.setTaskData(updatedData);
            this.state.newChecklistName = "";
        } catch (err) {
            console.error("Error adding checklist item:", err);
            this.notify("Could not add checklist item.", "danger");
        }
    }

    async toggleChecklistItem(subtaskId, isDone) {
        try {
            const updatedData = await this.orm.call("project.task", "toggle_checklist_subtask_status", [
                subtaskId,
                isDone,
            ]);
            this.setTaskData(updatedData);
        } catch (err) {
            console.error("Error toggling checklist:", err);
            this.notify("Could not update checklist item.", "danger");
        }
    }

    // Attachments
    triggerAttachmentUpload() {
        if (this.fileInputRef.el) {
            this.fileInputRef.el.click();
        }
    }

    async onFileUpload(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        const formData = new FormData();
        formData.append("task_id", this.state.taskId);
        formData.append("ufile", file);

        try {
            const response = await fetch("/custom_task_detail/upload_attachment", {
                method: "POST",
                body: formData,
            });
            const result = await response.json();
            if (result.success) {
                this.notify("Attachment uploaded.", "success");
                await this.loadTaskData(this.state.taskId);
            } else {
                this.notify(result.error || "Upload failed.", "danger");
            }
        } catch (err) {
            console.error("Error uploading file:", err);
            this.notify("File upload failed.", "danger");
        } finally {
            e.target.value = "";
        }
    }

    async deleteAttachment(attachmentId) {
        if (!confirm("Are you sure you want to delete this attachment?")) {
            return;
        }
        try {
            const updatedData = await this.orm.call("project.task", "delete_task_attachment", [
                this.state.taskId,
                attachmentId,
            ]);
            this.setTaskData(updatedData);
            this.notify("Attachment deleted.", "success");
        } catch (err) {
            console.error("Error deleting attachment:", err);
            this.notify("Could not delete attachment.", "danger");
        }
    }

    // ═══ Rich Description & Image Editing ═══
    triggerImageUpload() {
        if (this.imageInputRef.el) {
            this.imageInputRef.el.click();
        }
    }

    async onImageSelected(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const file = files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            this.insertImageSrc(event.target.result);
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    }

    onDescPaste(e) {
        const items = (e.clipboardData || (e.originalEvent && e.originalEvent.clipboardData) || {}).items || [];
        for (let item of items) {
            if (item.type && item.type.indexOf("image") !== -1) {
                e.preventDefault();
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.insertImageSrc(event.target.result);
                };
                reader.readAsDataURL(blob);
                return;
            }
        }
    }

    // ═══ Image Selection & Floating Controls ═══
    onDescClick(e) {
        const img = e.target.closest("img");
        if (img && this.descEditorRef.el && this.descEditorRef.el.contains(img)) {
            e.stopPropagation();
            this.selectImage(img);
        } else if (!e.target.closest(".ctd-img-popover-toolbar")) {
            this.deselectImage();
        }
    }

    onDescKeyDown(e) {
        if ((e.key === "Delete" || e.key === "Backspace") && this.state.selectedImage && this.currentImgEl) {
            e.preventDefault();
            this.deleteSelectedImg();
        }
    }

    selectImage(imgEl) {
        this.deselectImage();
        this.currentImgEl = imgEl;
        imgEl.classList.add("ctd-img-active-selected");

        const card = this.descEditorRef.el ? this.descEditorRef.el.closest(".ctd-description-card") : null;
        if (card) {
            const cardRect = card.getBoundingClientRect();
            const imgRect = imgEl.getBoundingClientRect();
            const topPos = Math.max(8, imgRect.top - cardRect.top - 46);
            const leftPos = Math.max(12, Math.min(imgRect.left - cardRect.left, cardRect.width - 320));
            this.state.imgPopoverPos = {
                top: Math.round(topPos),
                left: Math.round(leftPos),
            };
        }
        this.state.selectedImage = true;
    }

    deselectImage() {
        if (this.currentImgEl) {
            this.currentImgEl.classList.remove("ctd-img-active-selected");
            this.currentImgEl = null;
        }
        this.state.selectedImage = false;
    }

    deleteSelectedImg() {
        if (this.currentImgEl) {
            const parent = this.currentImgEl.parentElement;
            this.currentImgEl.remove();
            if (parent && parent.tagName === "P" && !parent.textContent.trim() && !parent.querySelector("img")) {
                parent.remove();
            }
            this.currentImgEl = null;
            this.state.selectedImage = false;
            this.saveDescription(true);
            this.notify("Image deleted.", "info");
        }
    }

    resizeSelectedImg(size) {
        if (this.currentImgEl) {
            this.currentImgEl.style.width = size;
            this.currentImgEl.style.maxWidth = "100%";
            this.saveDescription(false);
            setTimeout(() => {
                if (this.currentImgEl) this.selectImage(this.currentImgEl);
            }, 50);
        }
    }

    alignSelectedImg(align) {
        if (this.currentImgEl) {
            if (align === "center") {
                this.currentImgEl.style.display = "block";
                this.currentImgEl.style.marginLeft = "auto";
                this.currentImgEl.style.marginRight = "auto";
            } else if (align === "right") {
                this.currentImgEl.style.display = "block";
                this.currentImgEl.style.marginLeft = "auto";
                this.currentImgEl.style.marginRight = "0";
            } else {
                this.currentImgEl.style.display = "block";
                this.currentImgEl.style.marginLeft = "0";
                this.currentImgEl.style.marginRight = "auto";
            }
            this.saveDescription(false);
            setTimeout(() => {
                if (this.currentImgEl) this.selectImage(this.currentImgEl);
            }, 50);
        }
    }

    insertImageSrc(src) {
        const el = this.descEditorRef.el;
        if (el) {
            el.focus();
            const imgHtml = `<p><img src="${src}" class="img-fluid rounded" style="max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: block;"/></p><p><br/></p>`;
            document.execCommand("insertHTML", false, imgHtml);
            this.markDescDirty();
        }
    }

    formatDoc(command, value = null) {
        const el = this.descEditorRef.el;
        if (el) {
            el.focus();
            document.execCommand(command, false, value);
            this.markDescDirty();
        }
    }

    insertLink() {
        const url = prompt("Enter URL to insert:", "https://");
        if (url) {
            this.formatDoc("createLink", url);
        }
    }

    insertTable() {
        const tableHtml = `
            <table class="table table-bordered my-2" style="width: 100%; border-collapse: collapse; margin: 12px 0;">
                <thead>
                    <tr style="background-color: #f8fafc;">
                        <th style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600;">Header 1</th>
                        <th style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600;">Header 2</th>
                        <th style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600;">Header 3</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">Data 1</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">Data 2</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">Data 3</td>
                    </tr>
                </tbody>
            </table>
            <p><br/></p>
        `;
        const el = this.descEditorRef.el;
        if (el) {
            el.focus();
            document.execCommand("insertHTML", false, tableHtml);
            this.markDescDirty();
        }
    }

    insertChecklistTag() {
        const checklistHtml = `<p>🔲 Checklist item...</p>`;
        const el = this.descEditorRef.el;
        if (el) {
            el.focus();
            document.execCommand("insertHTML", false, checklistHtml);
            this.markDescDirty();
        }
    }

    onDescInput() {
        this.markDescDirty();
    }

    onDescBlur() {
        this.markDescDirty();
    }

    markDescDirty() {
        if (this.descEditorRef.el) {
            const currentHtml = this.descEditorRef.el.innerHTML;
            const origHtml = (this.state.originalTask && this.state.originalTask.description) || "";
            if (currentHtml !== origHtml) {
                this.state.task.description = currentHtml;
                this.state.draftValues.description = currentHtml;
                this.state.isDirty = true;
            }
        }
    }

    openTaskReminder() {
        this.closeAllDropdowns();
        this.action.doAction(
            {
                type: "ir.actions.act_window",
                res_model: "custom.task.reminder",
                views: [[false, "form"]],
                target: "new",
                context: {
                    default_task_id: this.state.taskId,
                },
            },
            {
                onClose: () => this.refreshData(),
            }
        );
    }

    openReplyReminder() {
        this.closeAllDropdowns();
        this.action.doAction(
            {
                type: "ir.actions.act_window",
                res_model: "custom.task.reminder.response",
                views: [[false, "form"]],
                target: "new",
                context: {
                    default_task_id: this.state.taskId,
                    active_id: this.state.taskId,
                },
            },
            {
                onClose: () => this.refreshData(),
            }
        );
    }

    async refreshData() {
        this.closeAllDropdowns();
        await this.loadTaskData(this.state.taskId);
    }

    async navigateTask(targetTaskId) {
        if (targetTaskId) {
            await this.loadTaskData(targetTaskId);
        }
    }
}

registry.category("actions").add("custom_task_detail.task_detail_view", TaskDetailView);

// Patch ListController to open modern Task Detail view when clicking any project.task row
patch(ListController.prototype, {
    async openRecord(record) {
        if ((this.props?.resModel === "project.task" || record?.resModel === "project.task") && record?.resId) {
            return this.actionService?.doAction({
                type: "ir.actions.client",
                tag: "custom_task_detail.task_detail_view",
                params: { task_id: record.resId },
                context: { default_task_id: record.resId },
            });
        }
        return super.openRecord(...arguments);
    },
});

// Patch KanbanController to open modern Task Detail view when clicking any project.task card
patch(KanbanController.prototype, {
    async openRecord(record) {
        if ((this.props?.resModel === "project.task" || record?.resModel === "project.task") && record?.resId) {
            return this.actionService?.doAction({
                type: "ir.actions.client",
                tag: "custom_task_detail.task_detail_view",
                params: { task_id: record.resId },
                context: { default_task_id: record.resId },
            });
        }
        return super.openRecord(...arguments);
    },
});

// Patch FormController to automatically redirect full-page project.task forms to modern TaskDetailView
patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);
        if (
            this.props?.resModel === "project.task" &&
            this.props?.resId &&
            !this.props?.context?.dont_redirect_custom_detail &&
            this.props?.target !== "new"
        ) {
            onMounted(() => {
                const isInsideDialog = !!document.querySelector(".modal .o_form_view");
                if (!isInsideDialog && this.props?.resId && this.actionService) {
                    this.actionService.doAction(
                        {
                            type: "ir.actions.client",
                            tag: "custom_task_detail.task_detail_view",
                            params: { task_id: this.props.resId },
                            context: { default_task_id: this.props.resId },
                        },
                        { replace: true }
                    );
                }
            });
        }
    },
});
