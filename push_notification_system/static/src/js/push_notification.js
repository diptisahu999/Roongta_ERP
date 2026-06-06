/** @odoo-module **/

import { registry } from "@web/core/registry";
import { browser } from "@web/core/browser/browser";

/**
 * A helper function to process and forward a notification to the Flutter bridge.
 * @param {string | object} messageContent The message from the notification.
 */
function _forwardToFlutter(messageContent) {
    if (window.OdooNotificationBridge && window.OdooNotificationBridge.postMessage) {
        try {
            let cleanMessage = messageContent || "You have a new notification.";

            if (typeof cleanMessage === 'object' && cleanMessage.trustedHTML) {
                cleanMessage = cleanMessage.trustedHTML;
            }

            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = cleanMessage;
            const messageText = (tempDiv.textContent || tempDiv.innerText || "").trim();

            if (messageText) {
                console.log(`[Flutter Bridge] Forwarding notification: ${messageText}`);
                window.OdooNotificationBridge.postMessage(messageText);
            }
        } catch (e) {
            console.error("[Flutter Bridge] Failed to post message to Flutter:", e);
        }
    }
}

/**
 * Push Notification Service
 * Subscribes to bus.bus and shows toast notifications for 'simple_notification' events.
 */
const pushNotificationService = {
    dependencies: ["bus_service", "notification"],

    start(env, { bus_service, notification }) {
        // Subscribe to the bus channel so we receive simple_notification events
        bus_service.subscribe("simple_notification", (payload) => {
            console.log("[PushNotification] Received simple_notification:", payload);

            const { title, message, sticky, type } = payload;

            // Show the Odoo toast notification
            notification.add(message || "", {
                title: title || "",
                type: type || "info",       // 'info', 'success', 'warning', 'danger'
                sticky: sticky || false,
            });

            // Also forward to Flutter bridge if applicable
            _forwardToFlutter(message);
        });

        console.log("[PushNotification] Bus listener for simple_notification registered.");
    },
};

// Register as a lazy service so it starts automatically when the web client loads
registry.category("services").add("push_notification_service", pushNotificationService);