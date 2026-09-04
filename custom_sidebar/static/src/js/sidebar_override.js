/** @odoo-module **/

import { AppsBar } from "@muk_web_appsbar/webclient/appsbar/appsbar";
import { patch } from "@web/core/utils/patch";
import { user } from "@web/core/user";
import { useState, onWillStart } from "@odoo/owl";

patch(AppsBar.prototype, {
    setup() {
        super.setup(...arguments);

        this.sidebarUser = useState({
            name: user.name || "Diptiranjan Sahu",
            initial: (user.name || "D")[0].toUpperCase(),
            role: "Manager",
        });

        onWillStart(async () => {
            try {
                if (user.name) {
                    this.sidebarUser.name = user.name;
                    this.sidebarUser.initial = user.name[0].toUpperCase();
                }

                const isMainAdmin = user.userId === 2 || user.login === "admin";
                const isProjectAdmin = await user.hasGroup("project.group_project_manager");
                const isCustomManager = await user.hasGroup("custom_project.group_project_manager_custom");

                if (isMainAdmin || isProjectAdmin) {
                    this.sidebarUser.role = "Administrator";
                } else if (isCustomManager) {
                    this.sidebarUser.role = "Manager";
                } else {
                    this.sidebarUser.role = "User";
                }
            } catch (err) {
                console.error("Error determining user info in sidebar:", err);
            }
        });
    },

    get currentUserName() {
        return (this.sidebarUser && this.sidebarUser.name) || user.name || "Diptiranjan Sahu";
    },

    get currentUserInitial() {
        return (this.sidebarUser && this.sidebarUser.initial) || (user.name ? user.name[0].toUpperCase() : "D");
    },

    get currentUserRole() {
        return (this.sidebarUser && this.sidebarUser.role) || "Manager";
    },
});
