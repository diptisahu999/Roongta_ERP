/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { Component, useState, onWillStart, useRef, onWillUnmount } from "@odoo/owl";

export class KanbanTagDropdown extends Component {
    static template = "kanban_tag_widget.KanbanTagDropdown";

    setup() {
        this.orm = useService("orm");
        this.rootRef = useRef("root");
        this.menuEl = null;
        this.closeHandler = null;
        this.state = useState({
            tags: [],
            loading: true,
        });

        onWillStart(async () => {
            try {
                this.state.tags = await this.orm.searchRead("project.tags", [], ["id", "name", "color"]);
            } catch (e) {
                console.error("Failed to load project tags", e);
            } finally {
                this.state.loading = false;
            }
        });

        onWillUnmount(() => {
            this._removeMenu();
        });
    }

    _removeMenu() {
        if (this.menuEl && this.menuEl.parentNode) {
            this.menuEl.parentNode.removeChild(this.menuEl);
            this.menuEl = null;
        }
        if (this.closeHandler) {
            document.removeEventListener("mousedown", this.closeHandler);
            this.closeHandler = null;
        }
    }

    _getCurrentTagIds() {
        try {
            const value = this.props.record.data[this.props.name];
            if (value && value.records) {
                return value.records.map((r) => r.resId || r.id);
            }
            if (Array.isArray(value)) {
                return value.map((v) => (typeof v === "object" ? v.id : v));
            }
        } catch (e) {
            // fallback
        }
        return [];
    }

    _buildMenuItems(ul, currentTagIds) {
        // Clear existing items (except header)
        while (ul.children.length > 1) {
            ul.removeChild(ul.lastChild);
        }

        if (this.state.loading) {
            const li = document.createElement("li");
            li.innerHTML = '<span class="dropdown-item text-muted">Loading...</span>';
            ul.appendChild(li);
            return;
        }

        this.state.tags.forEach((tag) => {
            const isSelected = currentTagIds.includes(tag.id);
            const colorStyle = tag.color
                ? "background-color: " + tag.color + "; width:10px; height:10px; display:inline-block; border-radius:50%; flex-shrink:0;"
                : "background-color: #cbd5e1; width:10px; height:10px; display:inline-block; border-radius:50%; flex-shrink:0;";

            const li = document.createElement("li");
            const a = document.createElement("a");
            a.href = "#";
            a.className = "dropdown-item d-flex align-items-center justify-content-between";
            if (isSelected) {
                a.style.backgroundColor = "#f0f9ff";
                a.style.fontWeight = "500";
            }

            // Left: colored dot + name
            const left = document.createElement("span");
            left.className = "d-flex align-items-center";
            const dot = document.createElement("span");
            dot.className = "me-2";
            dot.style.cssText = colorStyle;
            left.appendChild(dot);
            left.appendChild(document.createTextNode(tag.name));

            // Right: × if selected
            const right = document.createElement("span");
            if (isSelected) {
                right.innerHTML = '<i class="fa fa-times text-danger ms-2" style="font-size:11px;" title="Remove tag"></i>';
            }

            a.appendChild(left);
            a.appendChild(right);

            a.addEventListener("click", async (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Do NOT close the menu — just update it after the operation
                if (isSelected) {
                    await this._doRemoveTag(tag.id, ul);
                } else {
                    await this._doAddTag(tag.id, ul);
                }
            });

            li.appendChild(a);
            ul.appendChild(li);
        });
    }

    toggleDropdown(ev) {
        ev.preventDefault();
        ev.stopPropagation();

        if (this.menuEl) {
            this._removeMenu();
            return;
        }

        const btn = this.rootRef.el && this.rootRef.el.querySelector(".pd-tag-btn");
        if (!btn) return;

        const rect = btn.getBoundingClientRect();
        const currentTagIds = this._getCurrentTagIds();

        const ul = document.createElement("ul");
        ul.className = "dropdown-menu show shadow-sm";
        ul.style.cssText = [
            "position: fixed",
            "top: " + (rect.bottom + 4) + "px",
            "left: " + rect.left + "px",
            "z-index: 99999",
            "min-width: 200px",
            "max-height: 260px",
            "overflow-y: auto",
        ].join("; ");

        // Header
        const header = document.createElement("li");
        header.className = "dropdown-header fw-bold";
        header.textContent = "Manage Tags";
        ul.appendChild(header);

        this._buildMenuItems(ul, currentTagIds);

        document.body.appendChild(ul);
        this.menuEl = ul;

        this.closeHandler = (e) => {
            if (!ul.contains(e.target) && (!this.rootRef.el || !this.rootRef.el.contains(e.target))) {
                this._removeMenu();
            }
        };
        setTimeout(() => document.addEventListener("mousedown", this.closeHandler), 0);
    }

    async _doAddTag(tagId, ul) {
        if (!this.props.record || !this.props.record.resId) return;
        try {
            await this.orm.write(this.props.record.resModel, [this.props.record.resId], {
                [this.props.name]: [[4, tagId]],
            });
            if (this.props.record.load) {
                await this.props.record.load();
            }
            // Rebuild menu with updated tag state (dropdown stays open)
            this._buildMenuItems(ul, this._getCurrentTagIds());
        } catch (e) {
            console.error("Failed to add tag", e);
        }
    }

    async _doRemoveTag(tagId, ul) {
        if (!this.props.record || !this.props.record.resId) return;
        try {
            await this.orm.write(this.props.record.resModel, [this.props.record.resId], {
                [this.props.name]: [[3, tagId]],
            });
            if (this.props.record.load) {
                await this.props.record.load();
            }
            // Rebuild menu with updated tag state (dropdown stays open)
            this._buildMenuItems(ul, this._getCurrentTagIds());
        } catch (e) {
            console.error("Failed to remove tag", e);
        }
    }
}

export const kanbanTagDropdown = {
    component: KanbanTagDropdown,
    supportedTypes: ["many2many"],
};

registry.category("fields").add("kanban_tag_dropdown", kanbanTagDropdown);
