/** @odoo-module **/

import { Component, useState, useRef, onWillStart, onMounted, onWillUnmount, onWillUpdateProps } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class TaskCreateModal extends Component {
    static template = "custom_taskcreate.TaskCreateModal";
    static props = {
        isOpen: { type: Boolean, optional: true },
        onClose: { type: Function, optional: true },
        onTaskCreated: { type: Function, optional: true },
        defaultProjectId: { type: [Number, String, Boolean], optional: true },
        defaultDepartmentId: { type: [Number, String, Boolean], optional: true },
        projects: { type: Array, optional: true },
        departments: { type: Array, optional: true },
        assignees: { type: Array, optional: true },
        tags: { type: Array, optional: true },
        stages: { type: Array, optional: true },
    };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");

        this.editorRef = useRef("editorRef");
        this.imageInputRef = useRef("imageInputRef");
        this.fileInputRef = useRef("fileInputRef");

        this.priorityOptions = [
            { value: '0', label: 'Low', icon: 'fa fa-circle', color: '#60a5fa', bgColor: '#eff6ff', borderColor: '#bfdbfe' },
            { value: '1', label: 'Medium', icon: 'fa fa-minus', color: '#eab308', bgColor: '#fefce8', borderColor: '#fef08a' },
            { value: '2', label: 'High', icon: 'fa fa-arrow-up', color: '#f97316', bgColor: '#fff7ed', borderColor: '#fed7aa' },
            { value: '3', label: 'Urgent', icon: 'fa fa-exclamation', color: '#ef4444', bgColor: '#fef2f2', borderColor: '#fecaca' },
        ];

        this.state = useState({
            projects: this.props.projects || [],
            departments: this.props.departments || [],
            assignees: this.props.assignees || [],
            tags: this.props.tags || [],
            labels: this.props.labels || [],
            stages: this.props.stages || [],
            isSubmitting: false,
            dropdownOpen: {
                project: false,
                department: false,
                assignee: false,
                tag: false,
                label: false,
                priority: false,
            },
            openSubtaskDropdownIndex: null,
            searchQueries: {
                project: "",
                department: "",
                assignee: "",
                tag: "",
                label: "",
                subtaskAssignee: "",
            },
            formData: this.getDefaultFormData(),
        });

        this.onDocClick = (e) => {
            if (!e.target.closest(".dnt-search-dropdown") && !e.target.closest(".dnt-priority-dropdown-wrap")) {
                this.closeAllDropdowns();
            }
            if (!e.target.closest(".dnt-st-assignee-select-wrap")) {
                this.state.openSubtaskDropdownIndex = null;
            }
        };

        onWillStart(async () => {
            if (!this.state.projects.length || !this.state.departments.length) {
                await this.loadInitData();
            }
        });

        onMounted(() => {
            document.addEventListener("click", this.onDocClick);
        });

        onWillUnmount(() => {
            document.removeEventListener("click", this.onDocClick);
        });

        onWillUpdateProps((nextProps) => {
            if (nextProps.projects) this.state.projects = nextProps.projects;
            if (nextProps.departments) this.state.departments = nextProps.departments;
            if (nextProps.assignees) this.state.assignees = nextProps.assignees;
            if (nextProps.tags) this.state.tags = nextProps.tags;
            if (nextProps.labels) this.state.labels = nextProps.labels;
            if (nextProps.stages) this.state.stages = nextProps.stages;
        });
    }

    getDefaultDeadline() {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    getDefaultFormData() {
        return {
            name: "",
            deadline: this.getDefaultDeadline(),
            time: "",
            scope: "inbox",
            project_id: this.props.defaultProjectId || "",
            department_id: this.props.defaultDepartmentId || "",
            stage_id: false,
            priority: "0",
            label_id: "",
            user_ids: [],
            tag_id: "",
            activeTab: "description",
            description: "",
            subtasks: [],
            newSubtaskInput: "",
        };
    }

    async loadInitData() {
        try {
            const data = await this.orm.call("custom.taskcreate", "get_init_data", []);
            if (data) {
                this.state.projects = data.projects || [];
                this.state.departments = data.departments || [];
                this.state.assignees = data.assignees || [];
                this.state.tags = data.tags || [];
                this.state.labels = data.labels || [];
                this.state.stages = [];
                this.state.default_department_id = data.default_department_id || false;
                this.state.default_tag_id = data.default_tag_id || (data.default_tag_ids && data.default_tag_ids.length ? data.default_tag_ids[0] : false);
                this.state.default_user_ids = data.default_user_ids || [];
                this.state.default_deadline = data.default_deadline || this.getDefaultDeadline();

                // Auto-fill Deadline (3 days from today) if not already set
                if (!this.state.formData.deadline && data.default_deadline) {
                    this.state.formData.deadline = data.default_deadline;
                }

                // Auto-fill Department for logged in user / manager if not already set
                if (!this.state.formData.department_id && data.default_department_id) {
                    this.state.formData.department_id = data.default_department_id;
                }

                // Auto-fill Tag for logged in user / department if not already set
                if (!this.state.formData.tag_id && this.state.default_tag_id) {
                    this.state.formData.tag_id = this.state.default_tag_id;
                }

                // Auto-fill Assignees for logged in user if not already set
                if ((!this.state.formData.user_ids || !this.state.formData.user_ids.length) && data.default_user_ids && data.default_user_ids.length) {
                    this.state.formData.user_ids = [...data.default_user_ids];
                }

                if (this.props.defaultProjectId) {
                    this.state.formData.project_id = this.props.defaultProjectId;
                    await this.loadProjectStages(this.props.defaultProjectId);
                }
            }
        } catch (err) {
            console.error("[TaskCreateModal] Error loading init data:", err);
        }
    }

    closeModal() {
        this.state.formData = this.getDefaultFormData();
        if (this.state.default_deadline && !this.state.formData.deadline) {
            this.state.formData.deadline = this.state.default_deadline;
        }
        if (this.state.default_department_id && !this.state.formData.department_id) {
            this.state.formData.department_id = this.state.default_department_id;
        }
        if (this.state.default_tag_id && !this.state.formData.tag_id) {
            this.state.formData.tag_id = this.state.default_tag_id;
        }
        if (this.state.default_user_ids && (!this.state.formData.user_ids || !this.state.formData.user_ids.length)) {
            this.state.formData.user_ids = [...this.state.default_user_ids];
        }
        this.closeAllDropdowns();
        if (this.props.onClose) {
            this.props.onClose();
        }
    }

    toggleDropdown(type, ev) {
        if (ev) ev.stopPropagation();
        const current = this.state.dropdownOpen[type];
        this.closeAllDropdowns();
        this.state.dropdownOpen[type] = !current;
        if (this.state.searchQueries[type] !== undefined) {
            this.state.searchQueries[type] = "";
        }
    }

    closeAllDropdowns() {
        this.state.dropdownOpen.project = false;
        this.state.dropdownOpen.department = false;
        this.state.dropdownOpen.assignee = false;
        this.state.dropdownOpen.tag = false;
        this.state.dropdownOpen.label = false;
        this.state.dropdownOpen.priority = false;
    }

    getSelectedPriority() {
        const val = this.state.formData.priority || "0";
        return this.priorityOptions.find((p) => p.value === val) || this.priorityOptions[0];
    }

    selectPriority(val) {
        this.state.formData.priority = val;
        this.state.dropdownOpen.priority = false;
    }

    onSearchInput(type, ev) {
        this.state.searchQueries[type] = (ev.target.value || "").toLowerCase();
    }

    getFilteredProjects() {
        const q = (this.state.searchQueries.project || "").trim();
        if (!q) return this.state.projects || [];
        return (this.state.projects || []).filter((p) => (p.name || "").toLowerCase().includes(q));
    }

    getFilteredDepartments() {
        const q = (this.state.searchQueries.department || "").trim();
        if (!q) return this.state.departments || [];
        return (this.state.departments || []).filter((d) => (d.name || "").toLowerCase().includes(q));
    }

    getFilteredAssignees() {
        const q = (this.state.searchQueries.assignee || "").trim();
        if (!q) return this.state.assignees || [];
        return (this.state.assignees || []).filter((u) => (u.name || "").toLowerCase().includes(q));
    }

    getFilteredTags() {
        const q = (this.state.searchQueries.tag || "").trim();
        if (!q) return this.state.tags || [];
        return (this.state.tags || []).filter((t) => (t.name || "").toLowerCase().includes(q));
    }

    getFilteredLabels() {
        const q = (this.state.searchQueries.label || "").trim();
        if (!q) return this.state.labels || [];
        return (this.state.labels || []).filter((l) => (l.name || "").toLowerCase().includes(q));
    }

    async selectProject(projectId) {
        this.state.formData.project_id = projectId ? parseInt(projectId) : "";
        this.state.dropdownOpen.project = false;
        this.state.searchQueries.project = "";
        await this.loadProjectStages(this.state.formData.project_id);
    }

    selectDepartment(departmentId) {
        this.state.formData.department_id = departmentId ? parseInt(departmentId) : "";
        this.state.dropdownOpen.department = false;
        this.state.searchQueries.department = "";
        if (this.state.formData.department_id) {
            const dept = (this.state.departments || []).find((d) => d.id === this.state.formData.department_id);
            if (dept && !this.state.formData.tag_id) {
                const matchingTag = (this.state.tags || []).find((t) => (t.name || "").trim().toLowerCase() === (dept.name || "").trim().toLowerCase());
                if (matchingTag) {
                    this.state.formData.tag_id = matchingTag.id;
                }
            }
        }
    }

    selectLabel(labelId) {
        this.state.formData.label_id = labelId ? parseInt(labelId) : "";
        this.state.dropdownOpen.label = false;
        this.state.searchQueries.label = "";
    }

    getLabelName() {
        const lid = parseInt(this.state.formData.label_id);
        if (!lid) return "";
        const lbl = (this.state.labels || []).find((l) => l.id === lid);
        return lbl ? lbl.name : "";
    }

    selectAssignee(userId) {
        const uid = parseInt(userId);
        if (uid) {
            if (this.state.formData.user_ids.includes(uid)) {
                this.removeAssignee(uid);
            } else {
                this.state.formData.user_ids.push(uid);
            }
        }
        this.state.dropdownOpen.assignee = false;
        this.state.searchQueries.assignee = "";
    }

    selectTag(tagId) {
        this.state.formData.tag_id = tagId ? parseInt(tagId) : "";
        this.state.dropdownOpen.tag = false;
        this.state.searchQueries.tag = "";
    }

    async loadProjectStages(projectId) {
        if (!projectId) {
            this.state.stages = [];
            this.state.formData.stage_id = false;
            return;
        }
        try {
            const stages = await this.orm.call("custom.taskcreate", "get_project_stages", [projectId]);
            this.state.stages = stages || [];
            if (this.state.stages.length) {
                this.state.formData.stage_id = this.state.stages[0].id;
            } else {
                this.state.formData.stage_id = false;
            }
        } catch (err) {
            console.error("[TaskCreateModal] Error loading stages for project:", err);
        }
    }

    setStage(stageId) {
        this.state.formData.stage_id = stageId;
    }

    getStageName() {
        if (!this.state.formData.stage_id) return "Not selected";
        const found = (this.state.stages || []).find((s) => s.id === this.state.formData.stage_id);
        return found ? found.name : "Not selected";
    }

    setTab(tab) {
        this.state.formData.activeTab = tab;
    }

    removeAssignee(uid) {
        this.state.formData.user_ids = this.state.formData.user_ids.filter((id) => id !== uid);
    }

    getAssigneeName(uid) {
        const found = (this.state.assignees || []).find((u) => u.id === uid);
        return found ? found.name : "User";
    }

    removeTag() {
        this.state.formData.tag_id = "";
    }

    getTagName(tid) {
        const idToFind = tid !== undefined ? parseInt(tid) : parseInt(this.state.formData.tag_id);
        if (!idToFind) return "";
        const found = (this.state.tags || []).find((t) => t.id === idToFind);
        return found ? found.name : "";
    }

    toggleAddLabelInput() {
        this.state.formData.showAddLabelInput = !this.state.formData.showAddLabelInput;
        this.state.formData.newLabelInput = "";
    }

    addLabel() {
        const val = (this.state.formData.newLabelInput || "").trim();
        if (val && !this.state.formData.labels.includes(val)) {
            this.state.formData.labels.push(val);
        }
        this.state.formData.newLabelInput = "";
        this.state.formData.showAddLabelInput = false;
    }

    removeLabel(idx) {
        this.state.formData.labels.splice(idx, 1);
    }

    onLabelKeydown(ev) {
        if (ev.key === "Enter") {
            ev.preventDefault();
            this.addLabel();
        }
    }

    getLabelClass(lbl) {
        if (!lbl) return "default";
        return lbl.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }

    addSubtaskLine() {
        this.state.formData.subtasks.push({
            id: Date.now() + Math.random(),
            name: "",
            user_ids: [],
        });
    }

    removeSubtaskLine(idx) {
        this.state.formData.subtasks.splice(idx, 1);
    }

    updateSubtaskName(idx, val) {
        if (this.state.formData.subtasks[idx]) {
            this.state.formData.subtasks[idx].name = val;
        }
    }

    toggleSubtaskDropdown(idx, ev) {
        if (ev) ev.stopPropagation();
        const current = this.state.openSubtaskDropdownIndex === idx;
        this.closeAllDropdowns();
        this.state.openSubtaskDropdownIndex = current ? null : idx;
        this.state.searchQueries.subtaskAssignee = "";
    }

    onSubtaskSearchInput(ev) {
        this.state.searchQueries.subtaskAssignee = (ev.target.value || "").toLowerCase();
    }

    getFilteredSubtaskAssignees() {
        const q = (this.state.searchQueries.subtaskAssignee || "").trim();
        if (!q) return this.state.assignees || [];
        return (this.state.assignees || []).filter((u) => (u.name || "").toLowerCase().includes(q));
    }

    toggleSubtaskUser(idx, userId) {
        const sub = this.state.formData.subtasks[idx];
        if (!sub) return;
        if (!sub.user_ids) sub.user_ids = [];
        const uid = parseInt(userId);
        const pos = sub.user_ids.indexOf(uid);
        if (pos > -1) {
            sub.user_ids.splice(pos, 1);
        } else {
            sub.user_ids.push(uid);
        }
    }

    onSubtaskRowKeydown(ev, idx) {
        if (ev.key === "Enter") {
            ev.preventDefault();
            this.addSubtaskLine();
        }
    }

    focusEditor() {
        if (this.editorRef && this.editorRef.el) {
            this.editorRef.el.focus();
        }
    }

    onEditorInput(ev) {
        this.syncEditorState();
    }

    onEditorPaste(ev) {
        const clipboardData = ev.clipboardData || window.clipboardData;
        if (clipboardData && clipboardData.items) {
            const items = clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    ev.preventDefault();
                    const blob = items[i].getAsFile();
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const imgHtml = `<p><img src="${event.target.result}" alt="Pasted Image" style="max-width: 100%; height: auto; border-radius: 6px; margin: 6px 0; display: block;" /></p><p><br/></p>`;
                        this.insertHtmlAtCursor(imgHtml);
                    };
                    reader.readAsDataURL(blob);
                    return;
                }
            }
        }
        setTimeout(() => this.syncEditorState(), 50);
    }

    syncEditorState() {
        if (!this.editorRef || !this.editorRef.el) return;
        const html = this.editorRef.el.innerHTML;
        const text = this.editorRef.el.innerText.trim();
        const hasContent = text.length > 0 || html.includes("<img") || html.includes("<table") || html.includes("<input");
        this.state.formData.description = hasContent ? html : "";
    }

    insertHtmlAtCursor(html) {
        if (!this.editorRef || !this.editorRef.el) return;
        this.editorRef.el.focus();
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const el = document.createElement("div");
            el.innerHTML = html;
            const frag = document.createDocumentFragment();
            let node, lastNode;
            while ((node = el.firstChild)) {
                lastNode = frag.appendChild(node);
            }
            range.insertNode(frag);
            if (lastNode) {
                range.setStartAfter(lastNode);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        } else {
            this.editorRef.el.innerHTML += html;
        }
        this.syncEditorState();
    }

    triggerImageUpload() {
        if (this.imageInputRef && this.imageInputRef.el) {
            this.imageInputRef.el.click();
        }
    }

    onImageSelected(ev) {
        const file = ev.target.files && ev.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgHtml = `<p><img src="${e.target.result}" alt="${file.name}" style="max-width: 100%; height: auto; border-radius: 6px; margin: 8px 0;" /></p><p><br/></p>`;
                this.insertHtmlAtCursor(imgHtml);
            };
            reader.readAsDataURL(file);
        }
        ev.target.value = "";
    }

    triggerFileUpload() {
        if (this.fileInputRef && this.fileInputRef.el) {
            this.fileInputRef.el.click();
        }
    }

    onFileSelected(ev) {
        const file = ev.target.files && ev.target.files[0];
        if (file) {
            const fileHtml = `<p>📎 <span style="font-weight: 500; color: #2563eb;">${file.name}</span> <span style="color: #64748b; font-size: 11px;">(${(file.size / 1024).toFixed(1)} KB)</span></p><p><br/></p>`;
            this.insertHtmlAtCursor(fileHtml);
        }
        ev.target.value = "";
    }

    insertTable() {
        const tableHtml = `
<table style="width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12.5px;">
    <thead>
        <tr style="background: #f8fafc;">
            <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; font-weight: 600;">Header 1</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; font-weight: 600;">Header 2</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; font-weight: 600;">Header 3</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Item 1</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Details</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">Pending</td>
        </tr>
    </tbody>
</table><p><br/></p>`;
        this.insertHtmlAtCursor(tableHtml);
    }

    insertBulletList() {
        if (this.editorRef && this.editorRef.el) {
            this.editorRef.el.focus();
            document.execCommand("insertUnorderedList", false, null);
            this.syncEditorState();
        }
    }

    insertNumberedList() {
        if (this.editorRef && this.editorRef.el) {
            this.editorRef.el.focus();
            document.execCommand("insertOrderedList", false, null);
            this.syncEditorState();
        }
    }

    insertChecklist() {
        const checkHtml = `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;"><input type="checkbox" style="cursor: pointer; width: 14px; height: 14px;"/> <span>To-do item</span></div><p><br/></p>`;
        this.insertHtmlAtCursor(checkHtml);
    }

    insertLink() {
        if (this.editorRef && this.editorRef.el) {
            this.editorRef.el.focus();
            const url = prompt("Enter website or document URL:", "https://");
            if (url) {
                document.execCommand("createLink", false, url);
                this.syncEditorState();
            }
        }
    }

    insertMore() {
        if (this.editorRef && this.editorRef.el) {
            this.editorRef.el.focus();
            document.execCommand("bold", false, null);
            this.syncEditorState();
        }
    }

    getProjectName() {
        const pid = parseInt(this.state.formData.project_id);
        if (!pid) return "";
        const proj = (this.state.projects || []).find((p) => p.id === pid);
        return proj ? proj.name : "";
    }

    getDepartmentName() {
        const did = parseInt(this.state.formData.department_id);
        if (!did) return "";
        const dept = (this.state.departments || []).find((d) => d.id === did);
        return dept ? dept.name : "";
    }

    getAssigneeNamesSummary() {
        const uids = this.state.formData.user_ids || [];
        if (!uids.length) return "Unassigned";
        const names = (this.state.assignees || [])
            .filter((u) => uids.includes(u.id))
            .map((u) => u.name);
        return names.length ? names.join(", ") : "Unassigned";
    }

    getTagNameSummary() {
        const tid = parseInt(this.state.formData.tag_id);
        if (!tid) return "None";
        const tag = (this.state.tags || []).find((t) => t.id === tid);
        return tag ? tag.name : "None";
    }

    formatOverviewDate(dateStr) {
        if (!dateStr) return "No deadline";
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        } catch {
            return dateStr;
        }
    }

    async submitTask() {
        if (!this.state.formData.name || !this.state.formData.name.trim()) {
            this.notification.add("Please enter a task title.", { type: "danger" });
            return;
        }

        this.state.isSubmitting = true;
        try {
            const tagId = this.state.formData.tag_id ? parseInt(this.state.formData.tag_id) : false;
            const vals = {
                name: this.state.formData.name.trim(),
                project_id: this.state.formData.project_id || false,
                stage_id: this.state.formData.stage_id || false,
                department_id: this.state.formData.department_id || false,
                date_deadline: this.state.formData.deadline || false,
                description: this.state.formData.description || "",
                priority: this.state.formData.priority || "0",
                label_id: this.state.formData.label_id || false,
                user_ids: this.state.formData.user_ids || [],
                tag_id: tagId,
                single_tag_id: tagId,
                tag_ids: tagId ? [tagId] : [],
                subtasks: (this.state.formData.subtasks || [])
                    .filter((s) => s && s.name && s.name.trim())
                    .map((s) => ({ name: s.name.trim(), user_ids: s.user_ids || [] })),
            };

            const res = await this.orm.call("custom.taskcreate", "create_task_from_modal", [vals]);
            if (res && res.status === "success") {
                this.notification.add("Task created successfully!", { type: "success" });
                const newTaskId = res.task_id;
                this.closeModal();
                if (this.props.onTaskCreated) {
                    this.props.onTaskCreated(newTaskId, vals);
                }
            } else {
                this.notification.add((res && res.message) || "Failed to create task.", { type: "danger" });
            }
        } catch (err) {
            console.error("[TaskCreateModal] Error creating task:", err);
            this.notification.add("An error occurred while creating the task.", { type: "danger" });
        } finally {
            this.state.isSubmitting = false;
        }
    }
}
