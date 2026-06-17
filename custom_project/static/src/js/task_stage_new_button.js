/** @odoo-module **/

/**
 * custom_project - task_stage_new_button.js
 *
 * Backup JS patch: ensures the "New" button is visible on the Task Stages
 * list view (model: project.task.type) for users in the custom Manager group.
 *
 * The primary fix is the XML view inheritance in task_stage_menu_override.xml
 * which explicitly sets create="1" on the list view for the Manager group.
 * This JS patch serves as a belt-and-suspenders backup.
 */

import { ListController } from "@web/views/list/list_controller";
import { ProjectTaskKanbanRenderer } from "@project/views/project_task_kanban/project_task_kanban_renderer";
import { ProjectTaskKanbanHeader } from "@project/views/project_task_kanban/project_task_kanban_header";
import { patch } from "@web/core/utils/patch";
import { user } from "@web/core/user";
import { onWillStart } from "@odoo/owl";

patch(ListController.prototype, {
    setup() {
        super.setup(...arguments);

        // Only apply on the Task Stages model
        if (this.props.resModel === "project.task.type") {
            let _isCustomManager = false;
            onWillStart(async () => {
                _isCustomManager = await user.hasGroup(
                    "custom_project.group_project_manager_custom"
                );
            });

            // Use a getter and setter to intercept activeActions
            let _currentActiveActions = this.activeActions;
            Object.defineProperty(this, "activeActions", {
                get: () => {
                    if (_isCustomManager) {
                        return { ..._currentActiveActions, create: true, edit: true };
                    }
                    return _currentActiveActions;
                },
                set: (val) => {
                    _currentActiveActions = val;
                },
                configurable: true,
            });
        }
    },
});

patch(ProjectTaskKanbanRenderer.prototype, {
    setup() {
        super.setup(...arguments);
        onWillStart(async () => {
            const isCustomManager = await user.hasGroup(
                "custom_project.group_project_manager_custom"
            );
            if (isCustomManager) {
                this.isProjectManager = true;
            }
        });
    },
});

patch(ProjectTaskKanbanHeader.prototype, {
    setup() {
        super.setup(...arguments);
        onWillStart(async () => {
            const isCustomManager = await user.hasGroup(
                "custom_project.group_project_manager_custom"
            );
            if (isCustomManager) {
                this.isProjectManager = true;
            }
        });
    },
});
