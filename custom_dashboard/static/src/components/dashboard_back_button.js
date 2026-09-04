/** @odoo-module */

import { ListController } from "@web/views/list/list_controller";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";

/**
 * Patch ListController to support a "← Back to Dashboard" button
 * when the action context contains `back_to_dashboard: true`.
 */
patch(ListController.prototype, {
    setup() {
        super.setup(...arguments);
        this._dashboardBackActionService = useService("action");
    },

    get showDashboardBack() {
        return !!(this.props.context && this.props.context.back_to_dashboard);
    },

    goBackToDashboard() {
        this._dashboardBackActionService.doAction(
            "custom_dashboard.action_custom_dashboard",
            { clearBreadcrumbs: true }
        );
    },
});
