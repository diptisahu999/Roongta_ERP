/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, useState, onWillStart, onMounted, onWillUnmount } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";

export class CustomTaskListView extends Component {
    static template = "custom_list_task.CustomTaskListView";

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.dialog = useService("dialog");
        this.notification = useService("notification");

        const actionParams = (this.props.action && this.props.action.params) || {};
        const actionContext = (this.props.action && this.props.action.context) || {};

        this.state = useState({
            loading: true,
            title: actionParams.title || actionContext.default_title || (this.props.action && this.props.action.name) || "All Tasks",
            tagTree: [],
            groupedSections: [],
            flatTasks: [],
            totalTasks: 0,
            collapsedTags: {},
            collapsedProjects: {},
            collapsedStages: {},
            collapsedSections: {},
            selectedTaskIds: {},
            projectTasks: {},
            projectLoading: {},
            sectionTasks: {},
            sectionLoading: {},
            filters: {
                search: actionParams.search || actionContext.default_search || "",
                scope: actionParams.scope || actionContext.default_scope || "all_tasks",
                status: actionParams.status || actionContext.default_status || "all",
                group_by: actionParams.group_by || actionContext.default_group_by || "tag_project_stage",
                project_id: actionParams.project_id || actionContext.default_project_id || "all",
                department_id: actionParams.department_id || actionContext.default_department_id || "all",
                company_id: actionParams.company_id || actionContext.default_company_id || "all",
                custom_domain: actionParams.custom_domain || actionParams.domain || (this.props.action && this.props.action.domain) || actionContext.custom_domain || actionContext.default_domain || actionContext.domain || false,
            },
            dropdownOpen: {
                groupBy: false,
                scope: false,
            },
            openAssigneeTaskId: null,
            assigneeSearch: "",
            openRowActionTaskId: null,
            users: [],
            projects: [],
            departments: [],
            isAdminOrManager: false,
        });

        this._onDocumentClick = this.onDocumentClick.bind(this);

        onWillStart(async () => {
            await this.loadData();
        });

        onMounted(() => {
            document.addEventListener("click", this._onDocumentClick);
        });

        onWillUnmount(() => {
            document.removeEventListener("click", this._onDocumentClick);
        });
    }

    onDocumentClick(e) {
        this.state.dropdownOpen.groupBy = false;
        this.state.dropdownOpen.scope = false;
        this.state.openAssigneeTaskId = null;
        this.state.openRowActionTaskId = null;
    }

    async loadData() {
        this.state.loading = true;
        this.state.projectTasks = {};
        this.state.sectionTasks = {};
        try {
            const data = await this.orm.call(
                "project.task",
                "get_custom_list_task_data",
                [],
                { filters: this.state.filters }
            );

            if (data) {
                this.state.tagTree = data.tag_tree || [];
                this.state.groupedSections = data.grouped_sections || [];
                this.state.flatTasks = data.flat_tasks || [];
                this.state.totalTasks = data.total_tasks || 0;
                this.state.projects = data.projects || [];
                this.state.departments = data.departments || [];
                this.state.users = data.users || [];
                this.state.isAdminOrManager = data.is_admin_or_manager || false;

                // Pre-load project tasks for the first expanded tag so they are immediately visible on click
                if (this.state.tagTree && this.state.tagTree.length) {
                    const firstTag = this.state.tagTree[0];
                    if (firstTag.projects) {
                        for (const p of firstTag.projects) {
                            this.ensureProjectTasksLoaded(firstTag.id, p.id);
                        }
                    }
                    if (this.state.tagTree.length === 1 && firstTag.projects && firstTag.projects.length === 1) {
                        const onlyProjKey = `${firstTag.id}_${firstTag.projects[0].id}`;
                        this.state.collapsedProjects[onlyProjKey] = false;
                    }
                }
            }
        } catch (error) {
            console.error("[CustomTaskListView] Failed to load tasks:", error);
            this.notification.add(_t("Failed to load task list"), { type: "danger" });
        } finally {
            this.state.loading = false;
        }
    }

    goBack() {
        const actionParams = (this.props.action && this.props.action.params) || {};
        const actionContext = (this.props.action && this.props.action.context) || {};
        const backTarget = actionContext.back_to_dashboard || actionParams.back_to_dashboard;

        try {
            if (typeof backTarget === "string" && backTarget !== "") {
                if (backTarget.includes("department_dashboard")) {
                    sessionStorage.setItem("pd_navigated_to_task", "true");
                }
                this.action.doAction(backTarget, { clearBreadcrumbs: true });
                return;
            } else if (backTarget === true) {
                this.action.doAction("custom_dashboard.action_custom_dashboard", { clearBreadcrumbs: true });
                return;
            } else if (sessionStorage.getItem("pd_active_level_state")) {
                sessionStorage.setItem("pd_navigated_to_task", "true");
                this.action.doAction("project_dashboard.action_department_dashboard", { clearBreadcrumbs: true });
                return;
            } else if (this.action && typeof this.action.restore === "function") {
                this.action.restore();
                return;
            } else if (window.history.length > 1) {
                window.history.back();
                return;
            }
        } catch (e) {
            console.warn("[CustomTaskListView] goBack error:", e);
        }
        this.action.doAction("project_dashboard.action_department_dashboard", { clearBreadcrumbs: true });
    }

    async refreshData() {
        await this.loadData();
    }

    onSearchInput(e) {
        this.state.filters.search = e.target.value;
        if (this._searchTimeout) clearTimeout(this._searchTimeout);
        this._searchTimeout = setTimeout(() => {
            this.loadData();
        }, 300);
    }

    toggleDropdown(type, e) {
        if (e) e.stopPropagation();
        const cur = this.state.dropdownOpen[type];
        this.state.dropdownOpen.groupBy = false;
        this.state.dropdownOpen.scope = false;
        this.state.dropdownOpen[type] = !cur;
    }

    getGroupByLabel() {
        switch (this.state.filters.group_by) {
            case "tag_project_stage": return "Tag > Project > Stage";
            case "project_id": return "Project";
            case "department_id": return "Department";
            case "stage_id": return "Stage";
            case "none": return "No Grouping";
            default: return "Project";
        }
    }

    async setGroupBy(groupBy) {
        this.state.filters.group_by = groupBy;
        this.state.dropdownOpen.groupBy = false;
        await this.loadData();
    }

    async setScope(scope) {
        this.state.filters.scope = scope;
        this.state.dropdownOpen.scope = false;
        await this.loadData();
    }

    isTagCollapsed(tagId) {
        if (this.state.collapsedTags[tagId] !== undefined) {
            return this.state.collapsedTags[tagId];
        }
        // First tag (e.g. Cinema) is expanded by default (false), other tags are collapsed (true)
        const firstTag = this.state.tagTree && this.state.tagTree[0];
        return firstTag ? tagId !== firstTag.id : false;
    }

    isProjectCollapsed(projKey) {
        if (this.state.collapsedProjects[projKey] !== undefined) {
            return this.state.collapsedProjects[projKey];
        }
        if (this.state.tagTree && this.state.tagTree.length === 1 && this.state.tagTree[0].projects && this.state.tagTree[0].projects.length === 1) {
            return false;
        }
        // Projects start collapsed by default
        return true;
    }

    isStageCollapsed(stageKey) {
        if (this.state.collapsedStages[stageKey] !== undefined) {
            return this.state.collapsedStages[stageKey];
        }
        // Stages start expanded once the project is expanded
        return false;
    }

    toggleTagCollapse(tagId) {
        const cur = this.isTagCollapsed(tagId);
        this.state.collapsedTags[tagId] = !cur;

        // When a tag is expanded for the first time, pre-fetch its projects' tasks
        if (cur) {
            const tag = (this.state.tagTree || []).find(t => t.id === tagId);
            if (tag && tag.projects) {
                for (const p of tag.projects) {
                    this.ensureProjectTasksLoaded(tag.id, p.id);
                }
            }
        }
    }

    async ensureProjectTasksLoaded(tagId, projId) {
        const key = `${tagId}_${projId}`;
        if (this.state.projectTasks[key]) {
            return;
        }
        this.state.projectLoading[key] = true;
        try {
            const data = await this.orm.call(
                "project.task",
                "get_custom_list_project_tasks",
                [tagId, projId],
                { filters: this.state.filters }
            );
            this.state.projectTasks[key] = data || {};
        } catch (err) {
            console.error("[CustomTaskListView] Error loading project tasks:", err);
            this.state.projectTasks[key] = {};
        } finally {
            this.state.projectLoading[key] = false;
        }
    }

    async toggleProjectCollapse(projKey, tagId, projId) {
        const cur = this.isProjectCollapsed(projKey);
        this.state.collapsedProjects[projKey] = !cur;

        // If expanding, make sure tasks are loaded
        if (!cur) {
            await this.ensureProjectTasksLoaded(tagId, projId);
        }
    }

    getStageTasks(tagId, projId, stageId) {
        const key = `${tagId}_${projId}`;
        const pTasks = this.state.projectTasks[key];
        if (!pTasks) return [];
        return pTasks[stageId] || pTasks[String(stageId)] || [];
    }

    toggleStageCollapse(stageKey) {
        const cur = this.isStageCollapsed(stageKey);
        this.state.collapsedStages[stageKey] = !cur;
    }

    async toggleSectionCollapse(sectionId) {
        this.state.collapsedSections[sectionId] = !this.state.collapsedSections[sectionId];
        if (!this.state.collapsedSections[sectionId] && !this.state.sectionTasks[sectionId]) {
            this.state.sectionLoading[sectionId] = true;
            try {
                const tasks = await this.orm.call(
                    "project.task",
                    "get_custom_list_section_tasks",
                    [this.state.filters.group_by, sectionId],
                    { filters: this.state.filters }
                );
                this.state.sectionTasks[sectionId] = tasks || [];
            } catch (err) {
                console.error("[CustomTaskListView] Failed to load section tasks:", err);
                this.state.sectionTasks[sectionId] = [];
            } finally {
                this.state.sectionLoading[sectionId] = false;
            }
        }
    }

    getSectionTasks(sectionId) {
        return this.state.sectionTasks[sectionId] || [];
    }

    isStageAllSelected(tagId, projId, stage) {
        const tasks = this.getStageTasks(tagId, projId, stage.id);
        if (!tasks || !tasks.length) return false;
        return tasks.every(t => this.state.selectedTaskIds[t.id]);
    }

    toggleSelectAllStage(tagId, projId, stage, e) {
        const checked = e.target.checked;
        const tasks = this.getStageTasks(tagId, projId, stage.id);
        if (tasks) {
            tasks.forEach(t => {
                this.state.selectedTaskIds[t.id] = checked;
            });
        }
    }

    isSectionAllSelected(section) {
        const tasks = this.getSectionTasks(section.id);
        if (!tasks || !tasks.length) return false;
        return tasks.every(t => this.state.selectedTaskIds[t.id]);
    }

    toggleSelectAllSection(section, e) {
        const checked = e.target.checked;
        const tasks = this.getSectionTasks(section.id);
        if (tasks) {
            tasks.forEach(t => {
                this.state.selectedTaskIds[t.id] = checked;
            });
        }
    }

    isFlatAllSelected() {
        if (!this.state.flatTasks || !this.state.flatTasks.length) return false;
        return this.state.flatTasks.every(t => this.state.selectedTaskIds[t.id]);
    }

    toggleSelectAllFlat(e) {
        const checked = e.target.checked;
        if (this.state.flatTasks) {
            this.state.flatTasks.forEach(t => {
                this.state.selectedTaskIds[t.id] = checked;
            });
        }
    }

    toggleSelectTask(taskId, e) {
        this.state.selectedTaskIds[taskId] = e.target.checked;
    }

    async toggleStar(task, e) {
        if (e) e.stopPropagation();
        try {
            const res = await this.orm.call("project.task", "toggle_task_priority", [task.id]);
            if (res && res.success) {
                task.priority = res.priority;
                task.is_starred = res.priority !== "0";
            }
        } catch (err) {
            console.error("[CustomTaskListView] Error toggling star:", err);
        }
    }

    openTaskDetail(taskId) {
        if (!taskId) return;
        this.action.doAction({
            type: "ir.actions.client",
            tag: "custom_task_detail.task_detail_view",
            params: { task_id: taskId },
            context: { default_task_id: taskId },
        });
    }

    toggleAssigneeDropdown(taskId, e) {
        if (e) e.stopPropagation();
        this.state.assigneeSearch = "";
        this.state.openAssigneeTaskId = this.state.openAssigneeTaskId === taskId ? null : taskId;
        this.state.openRowActionTaskId = null;
    }

    onAssigneeSearchInput(e) {
        this.state.assigneeSearch = e.target.value;
    }

    getFilteredAssigneeUsers() {
        const term = (this.state.assigneeSearch || "").toLowerCase().trim();
        if (!term) return this.state.users;
        return (this.state.users || []).filter(u => u.name.toLowerCase().includes(term));
    }

    async addAssigneeToTask(taskId, userId) {
        try {
            await this.orm.call("project.task", "quick_add_assignee", [taskId, userId]);
            this.state.openAssigneeTaskId = null;
            this.notification.add(_t("Assignee added"), { type: "success" });
            await this.loadData();
        } catch (err) {
            this.notification.add(_t("Failed to add assignee"), { type: "danger" });
        }
    }

    toggleRowActions(taskId, e) {
        if (e) e.stopPropagation();
        this.state.openRowActionTaskId = this.state.openRowActionTaskId === taskId ? null : taskId;
        this.state.openAssigneeTaskId = null;
    }

    openReminderModal(taskId) {
        this.state.openRowActionTaskId = null;
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "custom.task.reminder",
            views: [[false, "form"]],
            target: "new",
            context: { default_task_id: taskId },
        });
    }

    deleteSingleTask(taskId) {
        this.state.openRowActionTaskId = null;
        this.dialog.add(ConfirmationDialog, {
            title: _t("Delete Task"),
            body: _t("Are you sure you want to delete this task? This action cannot be undone."),
            confirmLabel: _t("Delete"),
            confirm: async () => {
                try {
                    await this.orm.unlink("project.task", [taskId]);
                    this.notification.add(_t("Task deleted successfully"), { type: "success" });
                    await this.loadData();
                } catch (e) {
                    this.notification.add(_t("Failed to delete task: ") + (e.message || e), { type: "danger" });
                }
            },
            cancel: () => {},
        });
    }

    createNewTask() {
        try {
            this.action.doAction({
                type: "ir.actions.act_window",
                res_model: "project.task",
                views: [[false, "form"]],
                target: "current",
            });
        } catch (e) {
            console.error("Failed to open create task modal:", e);
        }
    }

    async onProgressChange(task, e) {
        if (e) e.stopPropagation();
        const newVal = e.target.value;
        const oldVal = task.task_progress != undefined ? task.task_progress : String(task.progress || 0);
        const oldProg = task.progress;

        // Optimistic reactive UI update
        task.task_progress = newVal;
        task.progress = parseInt(newVal, 10) || 0;

        try {
            await this.orm.call("project.task", "update_task_progress", [task.id, newVal]);
        } catch (err) {
            console.error("Failed to update task progress:", err);
            task.task_progress = oldVal;
            task.progress = oldProg;
            this.notification.add(_t("Failed to update progress"), { type: "danger" });
        }
    }
}

registry.category("actions").add("custom_list_task.task_list_view", CustomTaskListView);
