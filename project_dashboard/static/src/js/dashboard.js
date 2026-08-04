/** @odoo-module **/
import { DepartmentDashboard } from "./department_dashboard";
import { registry } from "@web/core/registry";

export class ProjectDashboard extends DepartmentDashboard {}

registry.category("actions").add("project_dashboard_action", ProjectDashboard);