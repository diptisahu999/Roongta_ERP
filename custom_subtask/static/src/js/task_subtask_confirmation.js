/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ProjectTaskStateSelection } from "@project/components/project_task_state_selection/project_task_state_selection";
import { StatusBarField } from "@web/views/fields/statusbar/statusbar_field";

// Patch the Task State Selection widget (the "Done" pill/dropdown in form header, kanban, list)
patch(ProjectTaskStateSelection.prototype, {
    async updateRecord(value) {
        if (value === "1_done" && this.props.record.resModel === "project.task") {
            const taskId = this.props.record.resId;
            if (taskId) {
                const orm = this.env.services.orm;
                const actionService = this.env.services.action;
                try {
                    const checkRes = await orm.call(
                        "project.task",
                        "check_task_subtasks_status",
                        [taskId],
                        { target_state: "1_done", target_progress: "100" }
                    );
                    if (checkRes && checkRes.has_open_subtasks && checkRes.action) {
                        await actionService.doAction(checkRes.action, {
                            onClose: () => {
                                if (this.props.record.model) {
                                    this.props.record.model.load();
                                }
                            },
                        });
                        return;
                    }
                } catch (e) {
                    console.warn("Could not check subtask status before updateRecord:", e);
                }
            }
        }
        return super.updateRecord(value);
    },
});

// Patch the stage statusbar widget in form header
patch(StatusBarField.prototype, {
    async selectItem(item) {
        const { name, record } = this.props;
        if (record.resModel === "project.task" && name === "stage_id" && item && item.value) {
            const taskId = record.resId;
            if (taskId) {
                const orm = this.env.services.orm;
                const actionService = this.env.services.action;
                try {
                    const checkRes = await orm.call(
                        "project.task",
                        "check_task_subtasks_status",
                        [taskId],
                        { target_state: "1_done", target_stage_id: item.value }
                    );
                    if (checkRes && checkRes.has_open_subtasks && checkRes.action) {
                        await actionService.doAction(checkRes.action, {
                            onClose: () => {
                                if (record.model) {
                                    record.model.load();
                                }
                            },
                        });
                        return;
                    }
                } catch (e) {
                    console.warn("Could not check subtask status before selectItem:", e);
                }
            }
        }
        return super.selectItem(item);
    },
});
