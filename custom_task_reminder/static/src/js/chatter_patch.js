/** @odoo-module **/

import { Chatter } from "@mail/chatter/web_portal/chatter";
import { patch } from "@web/core/utils/patch";
import { user } from "@web/core/user";

patch(Chatter.prototype, {
    get activities() {
        const allActs = super.activities || [];
        if (!allActs || !allActs.length) {
            return allActs;
        }

        const currentUserId = user.userId;

        // Filter reminder activities assigned specifically to the logged in user
        const userReminders = allActs.filter((act) => {
            const actUserId = Array.isArray(act.user_id)
                ? act.user_id[0]
                : (act.user_id && act.user_id.id ? act.user_id.id : act.user_id);
            const isReminder =
                (act.summary && act.summary.includes("Reminder")) ||
                (act.activity_type_id && String(act.activity_type_id).includes("Reminder"));
            return isReminder && actUserId === currentUserId;
        });

        // Non-reminder general activities (todos, calls, etc.)
        const nonReminders = allActs.filter((act) => {
            const isReminder =
                (act.summary && act.summary.includes("Reminder")) ||
                (act.activity_type_id && String(act.activity_type_id).includes("Reminder"));
            return !isReminder;
        });

        // If the logged in user has their own reminder activity, show only their reminder
        if (userReminders.length > 0) {
            return [...userReminders, ...nonReminders];
        }

        // If logged in user is viewing other assignees' reminders, show at most 1 reminder card
        const otherReminders = allActs.filter((act) => {
            return (
                (act.summary && act.summary.includes("Reminder")) ||
                (act.activity_type_id && String(act.activity_type_id).includes("Reminder"))
            );
        });

        if (otherReminders.length > 0) {
            return [otherReminders[0], ...nonReminders];
        }

        return allActs;
    },
});
