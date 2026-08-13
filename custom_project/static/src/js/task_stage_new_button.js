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
import { FormController } from "@web/views/form/form_controller";
import { KanbanController } from "@web/views/kanban/kanban_controller";
import { ProjectTaskKanbanRenderer } from "@project/views/project_task_kanban/project_task_kanban_renderer";
import { ProjectTaskKanbanHeader } from "@project/views/project_task_kanban/project_task_kanban_header";
import { patch } from "@web/core/utils/patch";
import { user } from "@web/core/user";
import { onWillStart, onMounted, onPatched } from "@odoo/owl";

patch(KanbanController.prototype, {
    setup() {
        super.setup(...arguments);

        if (this.props.resModel === "project.task") {
            const renderBackButton = () => {
                // Hide "Home" breadcrumb item
                const breadcrumbItems = document.querySelectorAll(
                    ".o_control_panel .o_breadcrumb .o_breadcrumb_item, .o_control_panel .o_breadcrumb a, .o_control_panel .o_breadcrumb span"
                );
                breadcrumbItems.forEach(item => {
                    if ((item.textContent || "").trim().toLowerCase() === "home") {
                        item.style.display = "none";
                    }
                });

                if (document.querySelector(".pd-btn-back-cp")) {
                    return;
                }

                const btn = document.createElement("button");
                btn.className = "pd-btn-back pd-btn-back-cp btn-back-custom";
                btn.type = "button";
                btn.innerHTML = `<i class="fa fa-arrow-left"></i><span>Back</span>`;
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.history.length > 1) {
                        window.history.back();
                    } else if (this.actionService) {
                        this.actionService.restore();
                    }
                };

                const newBtn = document.querySelector(
                    ".o_control_panel .o_list_button_add, .o_control_panel .o_form_button_create, .o_control_panel .btn-primary"
                );

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
            };

            onMounted(() => {
                setTimeout(renderBackButton, 50);
            });
            onPatched(() => {
                setTimeout(renderBackButton, 50);
            });
        }
    },
});

patch(ListController.prototype, {
    setup() {
        super.setup(...arguments);

        if (this.props.resModel === "project.task") {
            const renderBackButton = () => {
                // Hide "Home" breadcrumb item
                const breadcrumbItems = document.querySelectorAll(
                    ".o_control_panel .o_breadcrumb .o_breadcrumb_item, .o_control_panel .o_breadcrumb a, .o_control_panel .o_breadcrumb span"
                );
                breadcrumbItems.forEach(item => {
                    if ((item.textContent || "").trim().toLowerCase() === "home") {
                        item.style.display = "none";
                    }
                });

                if (document.querySelector(".pd-btn-back-cp")) {
                    return;
                }

                const btn = document.createElement("button");
                btn.className = "pd-btn-back pd-btn-back-cp btn-back-custom";
                btn.type = "button";
                btn.innerHTML = `<i class="fa fa-arrow-left"></i><span>Back</span>`;
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.history.length > 1) {
                        window.history.back();
                    } else if (this.actionService) {
                        this.actionService.restore();
                    }
                };

                const newBtn = document.querySelector(
                    ".o_control_panel .o_list_button_add, .o_control_panel .o_form_button_create, .o_control_panel .btn-primary"
                );

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
            };

            onMounted(() => {
                setTimeout(renderBackButton, 50);
            });
            onPatched(() => {
                setTimeout(renderBackButton, 50);
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

        if (this.props.resModel === "project.task") {
            const renderBackButton = () => {
                // Hide "Home" breadcrumb item
                const breadcrumbItems = document.querySelectorAll(
                    ".o_control_panel .o_breadcrumb .o_breadcrumb_item, .o_control_panel .o_breadcrumb a, .o_control_panel .o_breadcrumb span"
                );
                breadcrumbItems.forEach(item => {
                    if ((item.textContent || "").trim().toLowerCase() === "home") {
                        item.style.display = "none";
                    }
                });

                if (document.querySelector(".pd-btn-back-cp")) {
                    return;
                }

                const btn = document.createElement("button");
                btn.className = "pd-btn-back pd-btn-back-cp btn-back-custom";
                btn.type = "button";
                btn.innerHTML = `<i class="fa fa-arrow-left"></i><span>Back</span>`;
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.history.length > 1) {
                        window.history.back();
                    } else if (this.actionService) {
                        this.actionService.restore();
                    }
                };

                const newBtn = document.querySelector(
                    ".o_control_panel .o_list_button_add, .o_control_panel .o_form_button_create, .o_control_panel .btn-primary"
                );

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
            };

            onMounted(() => {
                setTimeout(() => {
                    updateSaveDiscardLabels();
                    renderBackButton();
                }, 50);
            });
            onPatched(() => {
                setTimeout(() => {
                    updateSaveDiscardLabels();
                    renderBackButton();
                }, 50);
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
