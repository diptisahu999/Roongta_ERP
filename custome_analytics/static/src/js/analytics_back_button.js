/** @odoo-module */

import { ListController } from "@web/views/list/list_controller";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";

/**
 * Patch ListController to support a "← Back to Analytics" button
 * when the action context contains `back_to_analytics: true`.
 */
patch(ListController.prototype, {
    setup() {
        super.setup(...arguments);
        this._analyticsBackActionService = useService("action");
    },

    get showAnalyticsBack() {
        return !!(this.props.context && this.props.context.back_to_analytics);
    },

    goBackToAnalytics() {
        this._analyticsBackActionService.doAction(
            "custome_analytics.action_custome_analytics_dashboard",
            { clearBreadcrumbs: true }
        );
    },
});
