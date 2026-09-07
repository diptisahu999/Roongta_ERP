/** @odoo-module **/

import { UserMenu } from "@web/webclient/user_menu/user_menu";
import { patch } from "@web/core/utils/patch";
import { registry } from "@web/core/registry";
import { markup } from "@odoo/owl";

// Proactively clean up non-essential items from the user_menuitems registry
const userMenuRegistry = registry.category("user_menuitems");
const itemsToRemove = ["documentation", "support", "onboarding", "separator", "odoo_account"];
for (const key of itemsToRemove) {
    if (userMenuRegistry.contains(key)) {
        userMenuRegistry.remove(key);
    }
}

// Patch UserMenu to strictly return only: 1. Shortcuts, 2. My Profile, 3. Logout
patch(UserMenu.prototype, {
    getElements() {
        const rawElements = super.getElements();

        // Allowed items: shortcuts, settings (My Profile), logout
        const allowedIds = ["shortcuts", "settings", "profile", "logout", "log_out", "install_pwa"];

        const filtered = rawElements.filter(
            (el) => el.type !== "separator" && allowedIds.includes(el.id)
        );

        return filtered
            .map((item) => {
                if (item.id === "shortcuts") {
                    return {
                        ...item,
                        sequence: 10,
                        description: markup(`
                            <div class="d-flex align-items-center justify-content-between w-100 py-1">
                                <span class="d-flex align-items-center">
                                    <i class="fa fa-keyboard-o me-2" style="color: #38bdf8; font-size: 14px; width: 16px;"></i>
                                    <span style="font-weight: 500;">Shortcuts</span>
                                </span>
                                <span class="badge" style="background: rgba(255, 255, 255, 0.12); color: #cbd5e1; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px;">CTRL+K</span>
                            </div>
                        `),
                    };
                }
                if (item.id === "settings" || item.id === "profile") {
                    return {
                        ...item,
                        sequence: 20,
                        description: markup(`
                            <div class="d-flex align-items-center w-100 py-1">
                                <i class="fa fa-user-circle-o me-2" style="color: #10b981; font-size: 14px; width: 16px;"></i>
                                <span style="font-weight: 500;">My Profile</span>
                            </div>
                        `),
                    };
                }
                if (item.id === "logout" || item.id === "log_out") {
                    return {
                        ...item,
                        sequence: 30,
                        description: markup(`
                            <div class="d-flex align-items-center w-100 py-1">
                                <i class="fa fa-sign-out me-2" style="color: #f43f5e; font-size: 14px; width: 16px;"></i>
                                <span style="font-weight: 500;">Logout</span>
                            </div>
                        `),
                    };
                }
                if (item.id === "install_pwa") {
                    return {
                        ...item,
                        sequence: 25,
                        description: markup(`
                            <div class="d-flex align-items-center w-100 py-1">
                                <i class="fa fa-download me-2" style="color: #a78bfa; font-size: 14px; width: 16px;"></i>
                                <span style="font-weight: 500;">Install App</span>
                            </div>
                        `),
                    };
                }
                return item;
            })
            .sort((a, b) => (a.sequence || 100) - (b.sequence || 100));
    },
});
