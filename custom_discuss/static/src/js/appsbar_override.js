/** @odoo-module */

import { patch } from '@web/core/utils/patch';
import { AppsBar } from '@muk_web_appsbar/webclient/appsbar/appsbar';
import { useService } from '@web/core/utils/hooks';
import { useState } from '@odoo/owl';

patch(AppsBar.prototype, {
    setup() {
        super.setup(...arguments);
        try {
            // In Odoo 17/18, the mail messaging store handles the counters
            // We use useState so that changes in the store re-render the AppsBar
            this.store = useState(useService('mail.store'));
        } catch (e) {
            console.warn("Could not load mail.store service", e);
            this.store = null;
        }
    },
    
    get discussCounter() {
        try {
            if (!this.store) return 0;
            let value = 0;
            // Standard inbox counter
            if (this.store.inbox && this.store.inbox.counter) {
                value += this.store.inbox.counter;
            } else if (this.store.discuss && this.store.discuss.inbox && this.store.discuss.inbox.counter) {
                value += this.store.discuss.inbox.counter;
            }
            
            // Add unread chat/channel messages
            if (this.store.Thread && this.store.Thread.records) {
                for (const thread of Object.values(this.store.Thread.records)) {
                    if (thread.selfMember && thread.selfMember.message_unread_counter > 0) {
                        value += thread.selfMember.message_unread_counter;
                    }
                }
            } else if (this.store.threads) {
                for (const thread of Object.values(this.store.threads)) {
                    if (thread.selfMember && thread.selfMember.message_unread_counter > 0) {
                        value += thread.selfMember.message_unread_counter;
                    }
                }
            }

            // Failure notifications
            if (this.store.failures) {
                value += this.store.failures.reduce((acc, f) => acc + parseInt(f.notifications?.length || 0), 0);
            }
            
            // Fallback for permission requests similar to top-right icon
            if (this.store.notification && this.store.notification.permission === "prompt" && !this.store.isNotificationPermissionDismissed) {
                value += 1;
            }
            
            return value;
        } catch (e) {
            console.error("Error calculating discuss counter:", e);
            return 0;
        }
    }
});
