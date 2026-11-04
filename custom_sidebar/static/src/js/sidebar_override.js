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

// Mobile offcanvas sidebar support
function closeMobileSidebar() {
    const sidebar = document.querySelector(".mk_apps_sidebar_panel");
    const backdrop = document.querySelector(".pd-sidebar-backdrop");
    if (sidebar) sidebar.classList.remove("show-mobile-sidebar");
    if (backdrop) backdrop.classList.remove("active");
    document.body.classList.remove("pd-sidebar-mobile-open");
}

function openMobileSidebar() {
    const sidebar = document.querySelector(".mk_apps_sidebar_panel");
    let backdrop = document.querySelector(".pd-sidebar-backdrop");
    if (!backdrop) {
        backdrop = document.createElement("div");
        backdrop.className = "pd-sidebar-backdrop";
        document.body.appendChild(backdrop);
        backdrop.addEventListener("click", () => closeMobileSidebar());
    }
    if (sidebar) sidebar.classList.add("show-mobile-sidebar");
    backdrop.classList.add("active");
    document.body.classList.add("pd-sidebar-mobile-open");
}

function toggleMobileSidebar() {
    const sidebar = document.querySelector(".mk_apps_sidebar_panel");
    if (sidebar && sidebar.classList.contains("show-mobile-sidebar")) {
        closeMobileSidebar();
    } else {
        openMobileSidebar();
    }
}

// Global mobile event listeners
document.addEventListener("click", (e) => {
    if (window.innerWidth > 768) return;

    // Toggle on navbar hamburger button
    const toggleBtn = e.target.closest(".o_menu_toggle, .o_navbar_apps_menu button, .pd-mobile-menu-btn");
    if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        toggleMobileSidebar();
        return;
    }

    // Close button inside sidebar
    if (e.target.closest(".pd-sidebar-mobile-close")) {
        e.preventDefault();
        e.stopPropagation();
        closeMobileSidebar();
        return;
    }

    // Auto-close drawer when clicking any menu item
    if (e.target.closest(".mk_apps_sidebar_menu a.nav-link")) {
        closeMobileSidebar();
    }
}, true);

window.addEventListener("resize", () => {
    if (window.innerWidth > 768) {
        closeMobileSidebar();
    }
});

window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && window.innerWidth <= 768) {
        closeMobileSidebar();
    }
});
