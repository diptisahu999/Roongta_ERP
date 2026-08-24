/** @odoo-module **/

/**
 * custom_project - task_stage_new_button.js
 *
 * 1. Ensures the Back button is rendered in the Control Panel for Project list,
 *    kanban, and form views (models: project.project and project.task).
 * 2. Ensures the "New" button is visible on the Task Stages list view
 *    (model: project.task.type) for users in the custom Manager group.
 */

import { ListController } from "@web/views/list/list_controller";
import { FormController } from "@web/views/form/form_controller";
import { KanbanController } from "@web/views/kanban/kanban_controller";
import { ProjectTaskKanbanRenderer } from "@project/views/project_task_kanban/project_task_kanban_renderer";
import { ProjectTaskKanbanHeader } from "@project/views/project_task_kanban/project_task_kanban_header";
import { patch } from "@web/core/utils/patch";
import { user } from "@web/core/user";
import { onWillStart, onMounted, onPatched } from "@odoo/owl";

function renderBackButtonHelper(controllerEnv) {
    // Hide "Home" breadcrumb item if present
    const breadcrumbItems = document.querySelectorAll(
        ".o_control_panel .o_breadcrumb .o_breadcrumb_item, .o_control_panel .o_breadcrumb a, .o_control_panel .o_breadcrumb span"
    );
    breadcrumbItems.forEach(item => {
        if ((item.textContent || "").trim().toLowerCase() === "home") {
            item.style.display = "none";
        }
    });

    // If Odoo's native back button is present, do not show the custom one
    const nativeBackBtn = document.querySelector(".o_control_panel .o_back_button");
    if (nativeBackBtn) {
        const customBtn = document.querySelector(".pd-btn-back-cp");
        if (customBtn) {
            customBtn.remove();
        }
        return;
    }

    const existingBtn = document.querySelector(".pd-btn-back-cp");
    const newBtn = document.querySelector(
        ".o_control_panel .o_list_button_add, .o_control_panel .o_form_button_create, .o_control_panel .btn-primary"
    );

    if (existingBtn) {
        if (newBtn && newBtn.parentNode && existingBtn.nextSibling !== newBtn) {
            newBtn.parentNode.insertBefore(existingBtn, newBtn);
        }
        return;
    }

    const btn = document.createElement("button");
    btn.className = "pd-btn-back pd-btn-back-cp btn-back-custom";
    btn.type = "button";
    btn.innerHTML = `<i class="fa fa-arrow-left"></i><span>Back</span>`;
    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (controllerEnv && controllerEnv.services && controllerEnv.services.action && typeof controllerEnv.services.action.restore === "function") {
            controllerEnv.services.action.restore().catch(() => {
                window.history.back();
            });
        } else if (window.history.length > 1) {
            window.history.back();
        }
    };

    if (newBtn && newBtn.parentNode) {
        newBtn.parentNode.insertBefore(btn, newBtn);
    } else {
        const targetContainer =
            document.querySelector(".o_control_panel .o_cp_buttons") ||
            document.querySelector(".o_control_panel .o_breadcrumb") ||
            document.querySelector(".o_control_panel .o_control_panel_main");
        if (targetContainer) {
            targetContainer.insertBefore(btn, targetContainer.firstChild);
        }
    }
}

patch(KanbanController.prototype, {
    setup() {
        super.setup(...arguments);

        if (this.props.resModel === "project.project" || this.props.resModel === "project.task") {
            const runRender = () => renderBackButtonHelper(this.env);
            onMounted(() => {
                setTimeout(runRender, 50);
                setTimeout(runRender, 200);
            });
            onPatched(() => {
                setTimeout(runRender, 50);
                setTimeout(runRender, 200);
            });
        }
    },
});

patch(ListController.prototype, {
    setup() {
        super.setup(...arguments);

        if (this.props.resModel === "project.project" || this.props.resModel === "project.task") {
            const runRender = () => renderBackButtonHelper(this.env);
            onMounted(() => {
                setTimeout(runRender, 50);
                setTimeout(runRender, 200);
            });
            onPatched(() => {
                setTimeout(runRender, 50);
                setTimeout(runRender, 200);
            });
        }

        // Only apply on the Task Stages model
        if (this.props.resModel === "project.task.type") {
            let _isCustomManager = false;
            onWillStart(async () => {
                _isCustomManager = await user.hasGroup(
                    "custom_project.group_project_manager_custom"
                );
            });

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

patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);

        const updateSaveDiscardLabels = () => {
            const saveBtns = document.querySelectorAll(
                ".o_control_panel .o_form_button_save, .o_form_status_indicator .o_form_button_save, button[aria-label*='Save'], button[title*='Save']"
            );
            saveBtns.forEach(btn => {
                if (btn && !btn.querySelector(".pd-label-text") && !(btn.textContent || "").toLowerCase().includes("save")) {
                    const span = document.createElement("span");
                    span.className = "pd-label-text ms-1";
                    span.textContent = "Save";
                    span.style.fontWeight = "600";
                    span.style.fontSize = "13px";
                    btn.appendChild(span);
                }
            });

            const discardBtns = document.querySelectorAll(
                ".o_control_panel .o_form_button_cancel, .o_control_panel .o_form_button_discard, .o_form_status_indicator .o_form_button_cancel, button[aria-label*='Discard'], button[title*='Discard']"
            );
            discardBtns.forEach(btn => {
                if (btn && !btn.querySelector(".pd-label-text") && !(btn.textContent || "").toLowerCase().includes("discard")) {
                    const span = document.createElement("span");
                    span.className = "pd-label-text ms-1";
                    span.textContent = "Discard";
                    span.style.fontWeight = "600";
                    span.style.fontSize = "13px";
                    btn.appendChild(span);
                }
            });
        };

        if (this.props.resModel === "project.project" || this.props.resModel === "project.task") {
            const runRender = () => {
                updateSaveDiscardLabels();
            };
            onMounted(() => {
                setTimeout(runRender, 50);
                setTimeout(runRender, 200);
            });
            onPatched(() => {
                setTimeout(runRender, 50);
                setTimeout(runRender, 200);
            });
        } else {
            onMounted(() => {
                setTimeout(updateSaveDiscardLabels, 50);
            });
            onPatched(() => {
                setTimeout(updateSaveDiscardLabels, 50);
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
