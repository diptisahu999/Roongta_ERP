/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, onWillStart, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class MOMTrackingDashboard extends Component {
    static template = "custom_mom_task.MOMTrackingDashboard";

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");

        this.state = useState({
            loading: true,
            activeTileTab: "all", // "all", "mom", "blockers", "timeline"
            metrics: {
                total_moms: 0,
                active_blockers: 0,
                critical_blockers: 0,
                tracked_tasks: 0,
                overdue_timelines: 0,
            },
            moms: [],
            blockers: [],
            timelines: [],
            departments: [],
            projects: [],
            users: [],
            tasksSimple: [],
            filters: {
                department_id: "all",
                project_id: "all",
                blocker_status: "all",
                search_term: "",
            },
            expandedMOMs: {},
            // New MOM modal state
            showNewMOMModal: false,
            newMOM: {
                name: "",
                task_id: null,
                date: new Date().toISOString().slice(0, 16),
                attendee_ids: [],
                key_discussion: "",
                decisions: "",
                action_items: "",
            },
            // New Blocker modal state
            showNewBlockerModal: false,
            newBlocker: {
                name: "",
                task_id: null,
                category: "internal",
                severity: "critical",
                assigned_to: null,
            },
            // Resolve Blocker modal state
            showResolveBlockerModal: false,
            resolveBlockerId: null,
            resolveNotes: "",
        });

        onWillStart(async () => {
            await this.loadData();
        });
    }

    async loadData() {
        this.state.loading = true;
        try {
            const res = await this.orm.call("project.task", "get_task_tracking_dashboard_data", [], {
                filters: this.state.filters,
            });

            this.state.metrics = res.metrics || this.state.metrics;
            this.state.moms = res.moms || [];
            this.state.blockers = res.blockers || [];
            this.state.timelines = res.timelines || [];
            this.state.departments = res.departments || [];
            this.state.projects = res.projects || [];
            this.state.users = res.users || [];
            this.state.tasksSimple = res.tasks_simple || [];
        } catch (err) {
            console.error("Error loading MOM tracking dashboard data:", err);
            this.notification.add("Failed to load MOM tracking data.", { type: "danger" });
        } finally {
            this.state.loading = false;
        }
    }

    switchTileTab(tab) {
        this.state.activeTileTab = tab;
    }

    // Filter Handlers
    async onDepartmentChange(e) {
        this.state.filters.department_id = e.target.value;
        await this.loadData();
    }

    async onProjectChange(e) {
        this.state.filters.project_id = e.target.value;
        await this.loadData();
    }

    async onBlockerStatusChange(status) {
        this.state.filters.blocker_status = status;
        await this.loadData();
    }

    async onSearchInput(e) {
        this.state.filters.search_term = e.target.value;
        clearTimeout(this._searchTimeout);
        this._searchTimeout = setTimeout(async () => {
            await this.loadData();
        }, 350);
    }

    // Open Task in Custom Task Detail or Standard Form
    openTask(taskId) {
        if (!taskId) return;
        this.action.doAction({
            type: "ir.actions.client",
            tag: "custom_task_detail.task_detail",
            name: `Task #${taskId}`,
            context: { active_id: taskId, task_id: taskId },
            params: { task_id: taskId },
        });
    }

    toggleMOM(momId) {
        this.state.expandedMOMs[momId] = !this.state.expandedMOMs[momId];
    }

    // ═══ Modal Handlers: New MOM ═══
    openNewMOMModal(preselectedTaskId = null) {
        this.state.newMOM = {
            name: "",
            task_id: preselectedTaskId || (this.state.tasksSimple[0]?.id || null),
            date: new Date().toISOString().slice(0, 16),
            attendee_ids: [],
            key_discussion: "",
            decisions: "",
            action_items: "",
        };
        this.state.showNewMOMModal = true;
    }

    closeNewMOMModal() {
        this.state.showNewMOMModal = false;
    }

    toggleMOMAttendee(userId) {
        const idx = this.state.newMOM.attendee_ids.indexOf(userId);
        if (idx > -1) {
            this.state.newMOM.attendee_ids.splice(idx, 1);
        } else {
            this.state.newMOM.attendee_ids.push(userId);
        }
    }

    async saveNewMOM() {
        if (!this.state.newMOM.name || !this.state.newMOM.task_id) {
            this.notification.add("Please specify meeting subject and select a task.", { type: "warning" });
            return;
        }

        try {
            const vals = {
                name: this.state.newMOM.name,
                task_id: parseInt(this.state.newMOM.task_id),
                date: this.state.newMOM.date ? this.state.newMOM.date.replace("T", " ") + ":00" : false,
                attendee_ids: [[6, 0, this.state.newMOM.attendee_ids]],
                key_discussion: this.state.newMOM.key_discussion,
                decisions: this.state.newMOM.decisions,
                action_items: this.state.newMOM.action_items,
            };

            await this.orm.call("project.task", "create_task_mom", [vals]);
            this.notification.add("Minutes of Meeting saved successfully!", { type: "success" });
            this.closeNewMOMModal();
            await this.loadData();
        } catch (err) {
            console.error("Error creating MOM:", err);
            this.notification.add("Could not save MOM.", { type: "danger" });
        }
    }

    // ═══ Modal Handlers: New Blocker ═══
    openNewBlockerModal(preselectedTaskId = null) {
        this.state.newBlocker = {
            name: "",
            task_id: preselectedTaskId || (this.state.tasksSimple[0]?.id || null),
            category: "internal",
            severity: "critical",
            assigned_to: null,
        };
        this.state.showNewBlockerModal = true;
    }

    closeNewBlockerModal() {
        this.state.showNewBlockerModal = false;
    }

    async saveNewBlocker() {
        if (!this.state.newBlocker.name || !this.state.newBlocker.task_id) {
            this.notification.add("Please specify blocker description and select a task.", { type: "warning" });
            return;
        }

        try {
            const vals = {
                name: this.state.newBlocker.name,
                task_id: parseInt(this.state.newBlocker.task_id),
                category: this.state.newBlocker.category,
                severity: this.state.newBlocker.severity,
                assigned_to: this.state.newBlocker.assigned_to ? parseInt(this.state.newBlocker.assigned_to) : false,
                status: "active",
            };

            await this.orm.call("project.task", "create_task_blocker", [vals]);
            this.notification.add("Blocker reported successfully!", { type: "success" });
            this.closeNewBlockerModal();
            await this.loadData();
        } catch (err) {
            console.error("Error reporting blocker:", err);
            this.notification.add("Could not report blocker.", { type: "danger" });
        }
    }

    // ═══ Modal Handlers: Resolve Blocker ═══
    openResolveBlockerModal(blockerId) {
        this.state.resolveBlockerId = blockerId;
        this.state.resolveNotes = "";
        this.state.showResolveBlockerModal = true;
    }

    closeResolveBlockerModal() {
        this.state.showResolveBlockerModal = false;
        this.state.resolveBlockerId = null;
        this.state.resolveNotes = "";
    }

    async confirmResolveBlocker() {
        if (!this.state.resolveBlockerId) return;

        try {
            await this.orm.call("project.task", "resolve_task_blocker", [
                this.state.resolveBlockerId,
                this.state.resolveNotes,
            ]);
            this.notification.add("Blocker marked as resolved!", { type: "success" });
            this.closeResolveBlockerModal();
            await this.loadData();
        } catch (err) {
            console.error("Error resolving blocker:", err);
            this.notification.add("Could not resolve blocker.", { type: "danger" });
        }
    }

    // Helpers
    getFilteredBlockers() {
        if (this.state.filters.blocker_status === "active") {
            return this.state.blockers.filter(b => b.status === "active");
        }
        if (this.state.filters.blocker_status === "resolved") {
            return this.state.blockers.filter(b => b.status === "resolved");
        }
        return this.state.blockers;
    }
}

// Register action in Odoo Registry
registry.category("actions").add("custom_mom_task.mom_dashboard", MOMTrackingDashboard);
// Alias for backwards compatibility if needed
registry.category("actions").add("custom_mytask.task_tracking_dashboard", MOMTrackingDashboard);
