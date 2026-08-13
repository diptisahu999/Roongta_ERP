/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ProjectTaskStateSelection } from "@project/components/project_task_state_selection/project_task_state_selection";

patch(ProjectTaskStateSelection.prototype, {
    setup() {
        super.setup();
        this.icons["05_management_discussion"] = "fa fa-lg fa-comments";
        this.colorIcons["05_management_discussion"] = "text-primary";
        this.colorButton["05_management_discussion"] = "btn-outline-primary";
    },

    get options() {
        const labels = new Map(super.options);
        labels.set("05_management_discussion", "MGMT Discussion");
        const states = ["1_canceled", "1_done"];
        const currentState = this.props.record.data[this.props.name];
        if (currentState != "04_waiting_normal") {
            states.unshift("01_in_progress", "02_changes_requested", "03_approved", "05_management_discussion");
        }
        return states.map((state) => [state, labels.get(state) || "MGMT Discussion"]);
    },
});
