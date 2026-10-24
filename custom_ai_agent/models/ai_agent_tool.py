# -*- coding: utf-8 -*-
import json
import logging
import re
from datetime import date, datetime, timedelta
from odoo import models, api, fields

_logger = logging.getLogger(__name__)

class AiAgentToolEngine(models.AbstractModel):
    _name = 'ai.agent.tool.engine'
    _description = 'AI Agent Odoo Context & Tool Execution Engine'

    @api.model
    def get_tool_definitions(self):
        """Returns the list of tools defined in Anthropic Tool Calling schema format"""
        return [
            {
                "name": "get_user_pending_tasks",
                "description": "Get real-time pending (in-progress / incomplete / to-do) tasks matching the Dashboard page. Can be filtered by assigned user, project (e.g. 'Task Management', 'Ville Flora'), department (e.g. 'IT', 'Sales'), or company.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "assigned_to": {"type": "string", "description": "Name of the user to get pending tasks for (e.g. 'Siba Sethy', 'Diptiranjan Sahu'). If omitted, defaults to current user."},
                        "project_name": {"type": "string", "description": "Name of the project to filter tasks for (e.g. 'Task Management', 'Ville Flora', 'RCinema App')"},
                        "department_name": {"type": "string", "description": "Name of the department to filter tasks for (e.g. 'IT', 'Sales', 'Purchase', 'Marketing')"},
                        "company_name": {"type": "string", "description": "Name of the company/firm to filter tasks for (e.g. 'Techvizor', 'Roongta Entertainment')"}
                    },
                    "required": []
                }
            },
            {
                "name": "get_user_completed_tasks",
                "description": "Get real-time completed (done / finished) tasks matching the Dashboard page. Can be filtered by assigned user, project (e.g. 'Task Management', 'Ville Flora'), department (e.g. 'IT', 'Sales'), or company.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "assigned_to": {"type": "string", "description": "Name of the user to get completed tasks for (e.g. 'Siba Sethy', 'Diptiranjan Sahu'). If omitted, defaults to current user."},
                        "project_name": {"type": "string", "description": "Name of the project to filter tasks for (e.g. 'Task Management', 'Ville Flora', 'RCinema App')"},
                        "department_name": {"type": "string", "description": "Name of the department to filter tasks for (e.g. 'IT', 'Sales', 'Purchase', 'Marketing')"},
                        "company_name": {"type": "string", "description": "Name of the company/firm to filter tasks for (e.g. 'Techvizor', 'Roongta Entertainment')"}
                    },
                    "required": []
                }
            },
            {
                "name": "get_my_tasks_summary",
                "description": "Get exact live task counts and dashboard KPI metrics (Total, In Progress, Completed, Overdue, Due Today, Due This Week) for a specific user, project, department, company, or overall tasks matching the Dashboard.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "assigned_to": {"type": "string", "description": "Optional name of user to get dashboard metrics for (e.g. 'Siba Sethy', 'Diptiranjan Sahu')."},
                        "project_name": {"type": "string", "description": "Name of the project to filter tasks for (e.g. 'Task Management', 'Ville Flora', 'RCinema App')"},
                        "department_name": {"type": "string", "description": "Name of the department to filter tasks for (e.g. 'IT', 'Sales', 'Purchase', 'Marketing')"},
                        "company_name": {"type": "string", "description": "Name of the company/firm to filter tasks for (e.g. 'Techvizor', 'Roongta Entertainment')"}
                    },
                    "required": []
                }
            },
            {
                "name": "search_tasks",
                "description": "Search and query tasks in Odoo with optional filters like keyword, project name, user name, department name, status, overdue status, or priority.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query or task title keyword"},
                        "project_name": {"type": "string", "description": "Filter by project name (optional)"},
                        "assigned_to": {"type": "string", "description": "Filter by assigned user name (e.g. 'Diptiranjan Sahu')"},
                        "department_name": {"type": "string", "description": "Filter by department name (e.g. 'IT', 'Sales', 'Purchase')"},
                        "status": {"type": "string", "enum": ["all", "in_progress", "pending", "done", "blocked"], "description": "Filter by status: 'in_progress' or 'pending' (incomplete tasks), 'done' (completed), 'blocked' (hold), or 'all'"},
                        "overdue_only": {"type": "boolean", "description": "Filter only overdue tasks (optional)"},
                        "priority_only": {"type": "boolean", "description": "Filter only high priority tasks (optional)"},
                        "limit": {"type": "integer", "description": "Maximum number of tasks to return (default 15)", "default": 15}
                    },
                    "required": []
                }
            },
            {
                "name": "create_task",
                "description": "Create a new project task in Odoo. Can also create multiple tasks if 'tasks' array is passed, and can mark as Done if 'stage_name'='Done' or 'mark_completed'=true.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Title of the task (required for single task)"},
                        "tasks": {"type": "array", "items": {"type": "string"}, "description": "List of task titles to create in batch (optional)"},
                        "project_name": {"type": "string", "description": "Name of the project to create the task in (e.g. 'AvSight', 'Task Management')"},
                        "assigned_to": {"type": "string", "description": "Name or email of user(s) to assign task to (e.g. 'me, sneh and chirag khichadiya')"},
                        "stage_name": {"type": "string", "description": "Stage name to assign to the task (e.g. 'Done', 'In Progress', 'To-Do')"},
                        "mark_completed": {"type": "boolean", "description": "Set to true to mark the task as completed / Done immediately upon creation"},
                        "date_deadline": {"type": "string", "description": "Deadline in YYYY-MM-DD format (optional)"},
                        "priority": {"type": "string", "enum": ["0", "1", "2", "3"], "description": "Priority (optional)"},
                        "description": {"type": "string", "description": "Detailed description for the task (optional)"}
                    },
                    "required": []
                }
            },
            {
                "name": "create_tasks_batch",
                "description": "Create multiple tasks at once in Odoo under a specific project with assigned users, optional deadline, priority, and stage (e.g. mark as Done / Completed).",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "tasks": {"type": "array", "items": {"type": "string"}, "description": "List of task titles to create in batch (required)"},
                        "project_name": {"type": "string", "description": "Name of the project to create tasks in (e.g. 'AvSight', 'Task Management') (required)"},
                        "assigned_to": {"type": "string", "description": "Names of users to assign tasks to (e.g. 'me, sneh and chirag khichadiya')"},
                        "stage_name": {"type": "string", "description": "Stage name to assign (e.g. 'Done' or 'In Progress')"},
                        "mark_completed": {"type": "boolean", "description": "Set to true to mark all tasks as Done/completed immediately"},
                        "date_deadline": {"type": "string", "description": "Deadline in YYYY-MM-DD format (optional)"},
                        "priority": {"type": "string", "enum": ["0", "1", "2", "3"], "description": "Priority (optional)"}
                    },
                    "required": ["tasks", "project_name"]
                }
            },
            {
                "name": "search_projects",
                "description": "Search and list active projects with their task counts and manager.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search keyword for project name (optional)"},
                        "limit": {"type": "integer", "description": "Max projects to return (default 10)", "default": 10}
                    },
                    "required": []
                }
            },
            {
                "name": "get_task_stages",
                "description": "Retrieve active task and all available stages configured for its project.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "string", "description": "ID of the task (optional)"},
                        "task_name": {"type": "string", "description": "Name of the task (optional)"},
                        "project_name": {"type": "string", "description": "Name of the project (optional)"}
                    },
                    "required": []
                }
            },
            {
                "name": "change_task_stage",
                "description": "Updates the stage or state of a task in Odoo.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "string", "description": "ID of the task to update (optional)"},
                        "task_name": {"type": "string", "description": "Name of the task to update (optional)"},
                        "project_name": {"type": "string", "description": "Name of the project (optional)"},
                        "stage_name": {"type": "string", "description": "Name of the target stage (e.g., Done, In Progress)"}
                    },
                    "required": ["stage_name"]
                }
            },
            {
                "name": "complete_task",
                "description": "Marks a task as completed in Odoo.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "string", "description": "ID of the task to complete (optional)"},
                        "task_name": {"type": "string", "description": "Name of the task to complete (optional)"},
                        "project_name": {"type": "string", "description": "Name of the project (optional)"}
                    },
                    "required": []
                }
            },
            {
                "name": "update_task",
                "description": "Updates an existing task in Odoo (e.g. changing assigned user, deadline, priority).",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "string", "description": "ID of the task to update (optional)"},
                        "task_name": {"type": "string", "description": "Name of the task to update (optional)"},
                        "assigned_to": {"type": "string", "description": "Name or email of user to assign task to (optional)"},
                        "append_assignee": {"type": "boolean", "description": "If true, adds the new assignee to the existing assignees instead of replacing them. Set to true if the user says 'also assign' or 'add'"},
                        "date_deadline": {"type": "string", "description": "Deadline in YYYY-MM-DD format (optional)"},
                        "priority": {"type": "string", "enum": ["0", "1", "2", "3"], "description": "Priority (optional)"}
                    },
                    "required": []
                }
            },
            {
                "name": "delete_task",
                "description": "Permanently deletes a task from Odoo.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "string", "description": "ID of the task to delete (optional)"},
                        "task_name": {"type": "string", "description": "Name of the task to delete (optional)"},
                        "project_name": {"type": "string", "description": "Name of the project the task belongs to (optional)"}
                    },
                    "required": []
                }
            }
        ]

    @api.model
    def execute_tool(self, tool_name, tool_input):
        """Execute a tool request and return the result data dictionary"""
        try:
            handler = getattr(self, f'_tool_{tool_name}', None)
            if not handler:
                return {"error": f"Unknown tool: {tool_name}"}
            return handler(tool_input or {})
        except Exception as e:
            _logger.exception("Error executing AI tool %s: %s", tool_name, str(e))
            return {"error": str(e)}

    def _tool_get_user_pending_tasks(self, tool_input):
        """Fetches pending (in-progress/incomplete) tasks matching Dashboard (by user, department, or company)"""
        user = self.env.user
        assigned_to = (tool_input.get('assigned_to') or tool_input.get('user_name') or '').strip()
        dept_name = (tool_input.get('department_name') or tool_input.get('department') or '').strip()
        company_name = (tool_input.get('company_name') or tool_input.get('firm_name') or '').strip()
        project_name = (tool_input.get('project_name') or tool_input.get('project') or '').strip()

        filters = {}
        target_display = user.name

        if assigned_to:
            target_user = self.env['res.users'].sudo().search([
                ('name', 'ilike', assigned_to),
                ('share', '=', False)
            ], limit=1)
            if target_user:
                user = target_user
                filters['user_id'] = user.id
                target_display = user.name
        elif not dept_name and not company_name and not project_name:
            filters['user_id'] = user.id

        if project_name and 'project.project' in self.env:
            proj = self.env['project.project'].sudo().search([('name', 'ilike', project_name)], limit=1)
            if proj:
                filters['project_id'] = proj.id
                target_display = f"{proj.name} Project"

        if dept_name and 'hr.department' in self.env:
            dept = self.env['hr.department'].sudo().search([('name', 'ilike', dept_name)], limit=1)
            if dept:
                filters['department_id'] = dept.id
                target_display = f"{dept.name} Department"

        if company_name and 'project.firm' in self.env:
            firm = self.env['project.firm'].sudo().search([('name', 'ilike', company_name)], limit=1)
            if firm:
                filters['company_id'] = firm.id
                target_display = firm.name

        dash_data = {}
        if 'custom.dashboard' in self.env:
            try:
                dash_data = self.env['custom.dashboard'].sudo().get_dashboard_data(filters)
            except Exception as e:
                _logger.warning("Error getting dashboard data: %s", e)

        kpis = dash_data.get('kpis', {})
        total_tasks_count = kpis.get('total_tasks', {}).get('value', 0)
        done_count = kpis.get('completed', {}).get('value', 0)
        in_progress_count = kpis.get('in_progress', {}).get('value', 0)
        overdue_count = kpis.get('overdue', {}).get('value', 0)
        due_today_raw = kpis.get('due_today', {}).get('value', 0)
        try:
            due_today_count = int(due_today_raw)
        except (ValueError, TypeError):
            due_today_count = 0
            
        att_dict = {a['id']: a['count'] for a in dash_data.get('attention_required', [])}
        due_this_week_count = att_dict.get('due_this_week', 0)

        domain_map = dash_data.get('domain_map', {})
        in_prog_domain = domain_map.get('in_progress') or [
            ('active', '=', True),
            ('state', 'not in', ['1_done', '1_canceled', '04_waiting_normal'])
        ]

        tasks_recs = self.env['project.task'].sudo().search(in_prog_domain, order='id desc', limit=15)
        results = []
        for t in tasks_recs:
            results.append({
                "id": t.id,
                "name": t.name,
                "project": t.project_id.name if t.project_id else "No Project",
                "assigned_to": ", ".join(t.user_ids.mapped('name')) if t.user_ids else "Unassigned",
                "stage": t.stage_id.name if t.stage_id else (t.state or "In Progress"),
                "deadline": str(t.date_deadline) if t.date_deadline else "No Deadline",
                "priority": "High" if t.priority in ['1', '2', '3'] else "Normal",
            })

        return {
            "target": target_display,
            "user_name": target_display,
            "total_tasks_count": total_tasks_count,
            "done_count": done_count,
            "in_progress_count": in_progress_count,
            "overdue_count": overdue_count,
            "due_today_count": due_today_count,
            "due_this_week_count": due_this_week_count,
            "count": len(results),
            "is_assigned_to_user": True,
            "tasks": results
        }

    def _tool_get_user_completed_tasks(self, tool_input):
        """Fetches completed / done tasks matching Dashboard (by user, department, company, or project)"""
        user = self.env.user
        assigned_to = (tool_input.get('assigned_to') or tool_input.get('user_name') or '').strip()
        dept_name = (tool_input.get('department_name') or tool_input.get('department') or '').strip()
        company_name = (tool_input.get('company_name') or tool_input.get('firm_name') or '').strip()
        project_name = (tool_input.get('project_name') or tool_input.get('project') or '').strip()

        filters = {}
        target_display = user.name

        if assigned_to:
            target_user = self.env['res.users'].sudo().search([
                ('name', 'ilike', assigned_to),
                ('share', '=', False)
            ], limit=1)
            if target_user:
                user = target_user
                filters['user_id'] = user.id
                target_display = user.name
        elif not dept_name and not company_name and not project_name:
            filters['user_id'] = user.id

        if project_name and 'project.project' in self.env:
            proj = self.env['project.project'].sudo().search([('name', 'ilike', project_name)], limit=1)
            if proj:
                filters['project_id'] = proj.id
                target_display = f"{proj.name} Project"

        if dept_name and 'hr.department' in self.env:
            dept = self.env['hr.department'].sudo().search([('name', 'ilike', dept_name)], limit=1)
            if dept:
                filters['department_id'] = dept.id
                target_display = f"{dept.name} Department"

        if company_name and 'project.firm' in self.env:
            firm = self.env['project.firm'].sudo().search([('name', 'ilike', company_name)], limit=1)
            if firm:
                filters['company_id'] = firm.id
                target_display = firm.name

        dash_data = {}
        if 'custom.dashboard' in self.env:
            try:
                dash_data = self.env['custom.dashboard'].sudo().get_dashboard_data(filters)
            except Exception as e:
                _logger.warning("Error getting dashboard data: %s", e)

        kpis = dash_data.get('kpis', {})
        total_tasks_count = kpis.get('total_tasks', {}).get('value', 0)
        done_count = kpis.get('completed', {}).get('value', 0)
        in_progress_count = kpis.get('in_progress', {}).get('value', 0)
        overdue_count = kpis.get('overdue', {}).get('value', 0)

        domain_map = dash_data.get('domain_map', {})
        completed_domain = domain_map.get('completed') or [
            ('active', '=', True),
            ('state', 'in', ['1_done', '1_canceled'])
        ]

        tasks_recs = self.env['project.task'].sudo().search(completed_domain, order='write_date desc, id desc', limit=15)
        results = []
        for t in tasks_recs:
            results.append({
                "id": t.id,
                "name": t.name,
                "project": t.project_id.name if t.project_id else "No Project",
                "assigned_to": ", ".join(t.user_ids.mapped('name')) if t.user_ids else "Unassigned",
                "stage": t.stage_id.name if t.stage_id else (t.state or "Done"),
                "deadline": str(t.date_deadline) if t.date_deadline else "No Deadline",
                "priority": "High" if t.priority in ['1', '2', '3'] else "Normal",
            })

        return {
            "target": target_display,
            "user_name": target_display,
            "total_tasks_count": total_tasks_count,
            "done_count": done_count,
            "in_progress_count": in_progress_count,
            "overdue_count": overdue_count,
            "count": len(results),
            "is_assigned_to_user": True,
            "tasks": results
        }

    def _tool_get_my_tasks_summary(self, tool_input):
        """Fetches exact live statistics matching the Dashboard metrics optimized for speed"""
        user = self.env.user
        assigned_to = (tool_input.get('assigned_to') or tool_input.get('user_name') or '').strip()
        dept_name = (tool_input.get('department_name') or tool_input.get('department') or '').strip()
        company_name = (tool_input.get('company_name') or tool_input.get('firm_name') or '').strip()
        project_name = (tool_input.get('project_name') or tool_input.get('project') or '').strip()

        filters = {}
        target_display = "All Tasks"

        if assigned_to:
            target_user = self.env['res.users'].sudo().search([
                ('name', 'ilike', assigned_to),
                ('share', '=', False)
            ], limit=1)
            if target_user:
                user = target_user
                filters['user_id'] = user.id
                target_display = user.name
        elif not dept_name and not company_name and not project_name:
            is_admin = self.env.user.has_group('base.group_system') or self.env.user.has_group('project.group_project_manager')
            if not is_admin:
                filters['user_id'] = user.id
                target_display = user.name

        if project_name and 'project.project' in self.env:
            proj = self.env['project.project'].sudo().search([('name', 'ilike', project_name)], limit=1)
            if proj:
                filters['project_id'] = proj.id
                target_display = f"{proj.name} Project"

        if dept_name and 'hr.department' in self.env:
            dept = self.env['hr.department'].sudo().search([('name', 'ilike', dept_name)], limit=1)
            if dept:
                filters['department_id'] = dept.id
                target_display = f"{dept.name} Department"

        if company_name and 'project.firm' in self.env:
            firm = self.env['project.firm'].sudo().search([('name', 'ilike', company_name)], limit=1)
            if firm:
                filters['company_id'] = firm.id
                target_display = firm.name

        dash_data = {}
        if 'custom.dashboard' in self.env:
            try:
                dash_data = self.env['custom.dashboard'].sudo().get_dashboard_data(filters)
            except Exception as e:
                _logger.warning("Error getting dashboard data: %s", e)

        kpis = dash_data.get('kpis', {})
        total_tasks = kpis.get('total_tasks', {}).get('value', 0)
        done_count = kpis.get('completed', {}).get('value', 0)
        in_progress_count = kpis.get('in_progress', {}).get('value', 0)
        overdue_count = kpis.get('overdue', {}).get('value', 0)
        due_today_raw = kpis.get('due_today', {}).get('value', 0)
        try:
            due_today_count = int(due_today_raw)
        except (ValueError, TypeError):
            due_today_count = 0

        att_dict = {a['id']: a['count'] for a in dash_data.get('attention_required', [])}
        due_this_week_count = att_dict.get('due_this_week', 0)
        blocked_count = att_dict.get('blocked', 0)
        awaiting_val = att_dict.get('awaiting_approval', 0)

        domain_map = dash_data.get('domain_map', {})
        in_prog_domain = domain_map.get('in_progress') or [('active', '=', True), ('state', 'not in', ['1_done', '1_canceled', '04_waiting_normal'])]
        due_this_week_domain = domain_map.get('due_this_week') or [('active', '=', True), ('state', 'not in', ['1_done', '1_canceled'])]

        Task = self.env['project.task'].sudo()
        in_progress_records = Task.search_read(
            in_prog_domain,
            ['id', 'name', 'date_deadline', 'project_id', 'priority'],
            limit=5, order='id desc'
        )

        due_this_week_records = Task.search_read(
            due_this_week_domain,
            ['id', 'name', 'date_deadline', 'project_id', 'priority'],
            limit=5, order='date_deadline asc, id desc'
        )

        def format_t(t):
            proj_name = t.get('project_id')[1] if t.get('project_id') else "No Project"
            return {
                "id": t['id'],
                "name": t['name'],
                "project": proj_name,
                "deadline": str(t.get('date_deadline') or 'None'),
                "priority": "High" if (t.get('priority') or '0') in ['1', '2', '3'] else "Normal"
            }

        return {
            "target": target_display,
            "user_name": target_display,
            "total_tasks": total_tasks,
            "in_progress_count": in_progress_count,
            "completed_count": done_count,
            "due_today_count": due_today_count,
            "due_this_week_count": due_this_week_count,
            "overdue_count": overdue_count,
            "blocked_count": blocked_count,
            "awaiting_approval_count": awaiting_val,
            "pending_count": in_progress_count + blocked_count,
            "in_progress_tasks": [format_t(t) for t in in_progress_records],
            "due_this_week_tasks": [format_t(t) for t in due_this_week_records],
        }

    def _tool_search_tasks(self, tool_input):
        Task = self.env['project.task'].sudo()
        domain = [('active', '=', True)]
        
        query = tool_input.get('query')
        if query:
            domain.append(('name', 'ilike', query.strip()))
            
        project_name = tool_input.get('project_name')
        if project_name:
            domain.append(('project_id.name', 'ilike', project_name.strip()))
            
        assigned_to = tool_input.get('assigned_to')
        if assigned_to:
            target_user = self.env['res.users'].sudo().search([
                ('name', 'ilike', assigned_to.strip()),
                ('share', '=', False)
            ], limit=1)
            if target_user:
                domain.append(('user_ids', 'in', [target_user.id]))
            else:
                domain.append(('user_ids.name', 'ilike', assigned_to.strip()))

        dept_name = (tool_input.get('department_name') or tool_input.get('department') or '').strip()
        if dept_name and 'hr.department' in self.env:
            dept = self.env['hr.department'].sudo().search([('name', 'ilike', dept_name)], limit=1)
            if dept:
                domain.append(('department_id', '=', dept.id))
            
        status = (tool_input.get('status') or '').lower().strip()
        if status in ['in_progress', 'in-progress', 'pending', 'open', 'active', 'not_done']:
            domain.append(('state', 'not in', ['1_done', '1_canceled', '04_waiting_normal']))
        elif status in ['done', 'completed', 'closed']:
            domain.append(('state', 'in', ['1_done', '1_canceled']))
        elif status in ['blocked', 'hold']:
            domain.append(('state', '=', '04_waiting_normal'))

        if tool_input.get('overdue_only'):
            today_str = fields.Date.context_today(self)
            domain.append(('date_deadline', '<', today_str))
            domain.append(('state', 'not in', ['1_done', '1_canceled']))

        if tool_input.get('priority_only'):
            domain.append(('priority', 'in', ['1', '2', '3']))

        total_matching = Task.search_count(domain)
        limit = min(tool_input.get('limit', 15), 30)
        tasks = Task.search(domain, order='id desc', limit=limit)
        
        results = []
        for t in tasks:
            results.append({
                "id": t.id,
                "name": t.name,
                "project": t.project_id.name if t.project_id else "No Project",
                "assigned_users": ", ".join(t.user_ids.mapped('name')) if t.user_ids else "Unassigned",
                "stage": t.stage_id.name if t.stage_id else (t.state or ""),
                "priority": "High" if t.priority in ['1', '2', '3'] else "Normal",
                "deadline": str(t.date_deadline) if t.date_deadline else "None",
            })
            
        return {
            "total_matching": total_matching,
            "count_found": len(results),
            "status_filter": status or "all",
            "tasks": results
        }

    def _resolve_project(self, project_name):
        """Resolves a project record by exact name, ilike name, core name (stripping parentheses), or keyword"""
        if not project_name:
            return None
        p_raw = str(project_name).strip()
        p_clean = re.sub(r'^(?:in\s+project|for\s+project|in|for|under|project)\s+', '', p_raw, flags=re.IGNORECASE).strip()
        p_clean = re.sub(r'\s+(?:project|tasks?)$', '', p_clean, flags=re.IGNORECASE).strip().strip('\'"`:;.,')
        if not p_clean:
            return None

        # 1. Exact case-insensitive match (e.g. 'AvSight (Salesforce)' == 'avsight (salesforce)')
        p = self.env['project.project'].sudo().search([('name', '=ilike', p_clean), ('active', '=', True)], limit=1)
        if p:
            return p

        # 2. Case-insensitive ilike substring match (e.g. 'AvSight' in 'AvSight (Salesforce)')
        p = self.env['project.project'].sudo().search([('name', 'ilike', p_clean), ('active', '=', True)], limit=1)
        if p:
            return p

        # 3. Core name match (stripping parentheses like '(Salesforce)', '(Express)', etc.)
        all_projs = self.env['project.project'].sudo().search([('active', '=', True)])
        p_norm = re.sub(r'[^a-zA-Z0-9]', '', p_clean.lower())
        for proj in all_projs:
            core_name = re.sub(r'\(.*?\)', '', proj.name or '').strip().lower()
            core_norm = re.sub(r'[^a-zA-Z0-9]', '', core_name)
            if core_norm and (core_norm == p_norm or core_norm in p_norm or p_norm in core_norm):
                return proj

        # 4. Check if any word of p_clean matches a project (e.g. 'AvSight' inside 'AvSight (Salesforce)')
        words = [w for w in re.split(r'[^a-zA-Z0-9]', p_clean) if len(w) >= 3]
        for w in words:
            p = self.env['project.project'].sudo().search([('name', 'ilike', w), ('active', '=', True)], limit=1)
            if p:
                return p

        # 5. Reverse check: if any project core name is inside p_clean
        for proj in sorted(all_projs, key=lambda x: len(x.name or ''), reverse=True):
            pname = (proj.name or '').strip().lower()
            core_name = re.sub(r'\(.*?\)', '', pname).strip()
            if (len(core_name) >= 3 and core_name in p_clean.lower()) or (len(pname) >= 4 and pname in p_clean.lower()):
                return proj

        return None

    def _resolve_assignees(self, assigned_to):
        """Resolves target user IDs and display names for multiple assignees (supports 'me, sneh and chirag khichadiya')"""
        target_user_ids = []
        assigned_names = []
        if assigned_to:
            if isinstance(assigned_to, list):
                tokens = assigned_to
            else:
                raw_assigned = str(assigned_to).strip()
                tokens = re.split(r'\s+(?:and|&|\+)\s+|,\s*', raw_assigned, flags=re.IGNORECASE)

            for tok in tokens:
                tok_clean = str(tok).strip().strip('"\'`')
                # Clean any instruction prefixes e.g. "assign the task to", "assign to", "assignee", "for user", "for", "to"
                tok_clean = re.sub(
                    r'^(?:assign(?:ed)?\s+(?:the\s+)?(?:task|rtask|work|issue)?\s*(?:to\s+)?|assignee\s*[:=]?\s*|for\s+user\s+|for\s+|to\s+)',
                    '',
                    tok_clean,
                    flags=re.IGNORECASE
                ).strip()
                tok_clean = re.sub(r'\s+(?:and\s+)?mark\s+.*$', '', tok_clean, flags=re.IGNORECASE).strip()

                if not tok_clean:
                    continue

                if tok_clean.lower() in ['me', 'myself', 'self', 'my', 'current user', 'i']:
                    if self.env.user.id not in target_user_ids:
                        target_user_ids.append(self.env.user.id)
                        assigned_names.append(f"{self.env.user.name} (Me)")
                else:
                    found_u = self.env['res.users'].sudo().search([
                        ('share', '=', False),
                        '|', ('name', '=ilike', tok_clean), ('login', '=ilike', tok_clean)
                    ], limit=1)
                    if not found_u:
                        found_u = self.env['res.users'].sudo().search([
                            ('share', '=', False),
                            '|', ('name', 'ilike', tok_clean), ('login', 'ilike', tok_clean)
                        ], limit=1)
                    if not found_u:
                        parts = tok_clean.split()
                        if len(parts) >= 2:
                            found_u = self.env['res.users'].sudo().search([
                                ('share', '=', False),
                                ('name', 'ilike', parts[0]), ('name', 'ilike', parts[1])
                            ], limit=1)
                        elif len(parts) == 1:
                            found_u = self.env['res.users'].sudo().search([
                                ('share', '=', False),
                                '|', ('name', 'ilike', parts[0]), ('login', 'ilike', parts[0])
                            ], limit=1)
                    if found_u and found_u.id not in target_user_ids:
                        target_user_ids.append(found_u.id)
                        assigned_names.append(found_u.name)

        if not target_user_ids:
            target_user_ids = [self.env.user.id]
            assigned_names = [self.env.user.name]

        return target_user_ids, assigned_names

    def _tool_create_task(self, tool_input):
        Task = self.env['project.task']

        # Check if caller passed a batch of tasks (list or multi-line)
        if tool_input.get('tasks') or isinstance(tool_input.get('name'), list) or ('\n' in str(tool_input.get('name', '')) and len(str(tool_input.get('name', '')).strip().split('\n')) > 1):
            return self._tool_create_tasks_batch(tool_input)

        name = tool_input.get('name', '').strip()
        if not name:
            return {"error": "Task name is required."}

        # Resolve Project
        project_name = tool_input.get('project_name')
        project = self._resolve_project(project_name)
        if not project:
            active_projs = self.env['project.project'].sudo().search_read(
                [('active', '=', True)], ['name'], limit=25, order='name asc'
            )
            proj_list = [f"**{p['name']}**" for p in active_projs]
            proj_hint = ", ".join(proj_list) if proj_list else "None"
            p_display = project_name or 'unspecified'
            return {
                "error": f"Project '{p_display}' not found in Roongta ERP.\n\n📁 **Available Active Projects:** {proj_hint}\n\nPlease specify one of the available project names."
            }

        # Resolve Assignees
        target_user_ids, assigned_names = self._resolve_assignees(tool_input.get('assigned_to'))

        vals = {
            'name': name,
            'project_id': project.id,
            'user_ids': [(6, 0, target_user_ids)]
        }

        # Stage & State handling (e.g. mark_completed or stage_name='Done')
        stage_name_req = tool_input.get('stage_name')
        mark_done = tool_input.get('mark_completed') or (stage_name_req and str(stage_name_req).lower() in ['done', 'complete', 'completed', 'finished', 'closed'])
        stage_display = "To-Do"
        if mark_done:
            done_stage = self.env['project.task.type'].search([
                ('project_ids', 'in', [project.id]),
                '|', ('fold', '=', True), ('name', 'ilike', 'done')
            ], limit=1)
            if not done_stage:
                done_stage = self.env['project.task.type'].search([
                    '|', ('fold', '=', True), ('name', 'ilike', 'done')
                ], limit=1)
            if done_stage:
                vals['stage_id'] = done_stage.id
                stage_display = done_stage.name
            else:
                stage_display = "Done"
            vals['state'] = '1_done'
            vals['is_closed'] = True
            vals['date_last_stage_update'] = fields.Datetime.now()
        elif stage_name_req:
            st = self.env['project.task.type'].search([
                ('project_ids', 'in', [project.id]),
                ('name', 'ilike', str(stage_name_req).strip())
            ], limit=1)
            if st:
                vals['stage_id'] = st.id
                stage_display = st.name

        # Deadline
        date_deadline = tool_input.get('date_deadline')
        if date_deadline:
            try:
                d_match = re.search(r'\d{4}-\d{2}-\d{2}', str(date_deadline))
                if d_match:
                    vals['date_deadline'] = d_match.group(0)
            except Exception:
                pass

        # Priority
        priority_raw = str(tool_input.get('priority') or '0').lower()
        if priority_raw in ['1', 'high', 'urgent', 'urgent priority', 'high priority']:
            vals['priority'] = '1'
        elif priority_raw in ['2', 'very high']:
            vals['priority'] = '2'
        elif priority_raw in ['3']:
            vals['priority'] = '3'
        else:
            vals['priority'] = '0'

        # Department
        if 'department_id' in Task._fields:
            user_dept = self.env.user.department_id if hasattr(self.env.user, 'department_id') and self.env.user.department_id else False
            if not user_dept and 'hr.employee' in self.env:
                emp = self.env['hr.employee'].sudo().search([('user_id', '=', self.env.user.id)], limit=1)
                if emp and emp.department_id:
                    user_dept = emp.department_id
            if user_dept:
                vals['department_id'] = user_dept.id

        # Tag
        if 'single_tag_id' in Task._fields or 'tag_ids' in Task._fields:
            default_tag = self.env['project.tags'].sudo().search([('name', 'ilike', 'TechVizor')], limit=1)
            if not default_tag:
                default_tag = self.env['project.tags'].sudo().search([], limit=1)
            if default_tag:
                if 'tag_ids' in Task._fields:
                    vals['tag_ids'] = [(6, 0, [default_tag.id])]
                if 'single_tag_id' in Task._fields:
                    vals['single_tag_id'] = default_tag.id

        # Description
        description = tool_input.get('description')
        if description:
            vals['description'] = f"<p>{description}</p>"

        new_task = Task.create(vals)
        dept_name = new_task.department_id.name if hasattr(new_task, 'department_id') and new_task.department_id else "IT"
        tag_name = new_task.single_tag_id.name if hasattr(new_task, 'single_tag_id') and new_task.single_tag_id else "TechVizor"
        assignee_str = ", ".join(assigned_names) if assigned_names else self.env.user.name

        return {
            "success": True,
            "task_id": new_task.id,
            "task_name": new_task.name,
            "project_name": new_task.project_id.name if new_task.project_id else "General",
            "assigned_to": assignee_str,
            "stage_name": stage_display,
            "is_completed": mark_done,
            "department": dept_name,
            "tag": tag_name,
            "deadline": str(new_task.date_deadline) if new_task.date_deadline else "None",
            "priority": "High" if new_task.priority in ['1', '2', '3'] else "Normal",
        }

    def _tool_create_tasks_batch(self, tool_input):
        """Create multiple tasks at once in a specific project with assignees, optional stage, deadline, priority"""
        Task = self.env['project.task']
        tasks_raw = tool_input.get('tasks') or tool_input.get('name') or []
        task_titles = []
        extracted_project = tool_input.get('project_name')
        extracted_assigned = tool_input.get('assigned_to')
        extracted_stage = tool_input.get('stage_name')
        extracted_mark_done = tool_input.get('mark_completed')

        # Sanitize if caller passed corrupted/multi-line fields
        if extracted_project and ('\n' in str(extracted_project) or len(str(extracted_project)) > 50 or any(k in str(extracted_project).lower() for k in ['assign', 'mark complate', 'mark complete', 'below', 'following'])):
            extracted_project = None
        if extracted_assigned and ('\n' in str(extracted_assigned) or len(str(extracted_assigned)) > 120):
            extracted_assigned = None

        raw_lines = []
        if isinstance(tasks_raw, list):
            for t in tasks_raw:
                if isinstance(t, dict):
                    t_title = t.get('name') or t.get('title')
                    if t_title:
                        raw_lines.append(str(t_title).strip())
                elif isinstance(t, str):
                    for sub in t.split('\n'):
                        if sub.strip():
                            raw_lines.append(sub.strip())
        elif isinstance(tasks_raw, str):
            for sub in tasks_raw.split('\n'):
                if sub.strip():
                    raw_lines.append(sub.strip())

        # Check if multiple tasks are embedded on a single line (e.g. when pasted into a single-line input field)
        expanded_lines = []
        for line in raw_lines:
            t_matches = list(re.finditer(r'\b([A-Z0-9]+-\d+|\d+[\.\)]|\*|\-|•)\s+', line))
            if len(t_matches) >= 2:
                first_idx = t_matches[0].start()
                prefix = line[:first_idx].strip()
                if prefix:
                    expanded_lines.append(prefix)
                tasks_chunk = line[first_idx:].strip()
                split_items = re.split(r'(?=\b[A-Z0-9]+-\d+\b|\b\d+[\.\)]\s+)', tasks_chunk)
                for item in split_items:
                    if item.strip():
                        expanded_lines.append(item.strip())
            else:
                expanded_lines.append(line)
        raw_lines = expanded_lines

        for line in raw_lines:
            line_str = line.strip()
            if not line_str:
                continue
            line_lower = line_str.lower()

            is_instr = any(k in line_lower for k in [
                'create below', 'create following', 'list of task', 'list of tasks',
                'assign this', 'assign these', 'assign to', 'assigned to',
                'mark complate', 'mark complete', 'mark done', 'mark as done', 'mark as complete'
            ])

            if is_instr:
                if not extracted_project:
                    pm = re.search(r'(?:in\s+project|for\s+project|under\s+project|in|under|for|project)\s+([a-zA-Z0-9_\-\(\)\s]+?)(?:\s+(?:assign|and|with|to|\n)|$)', line_str, re.IGNORECASE)
                    if pm:
                        cand = pm.group(1).strip()
                        cand = re.sub(r'\s+(?:project|tasks?)$', '', cand, flags=re.IGNORECASE).strip().strip('\'"`:;.,')
                        if cand.lower() not in ['a', 'the', 'below', 'following', 'this', 'me', 'list', 'list of']:
                            extracted_project = cand
                if not extracted_assigned:
                    am = re.search(r'(?:assign\s+(?:this\s+|these\s+)?(?:r?tasks?\s+)?to|assigned\s+to)\s+([^\n\r]+?)(?:\s+and\s+(?:mark|set)|\s+with\s+deadline|$)', line_str, re.IGNORECASE)
                    if am:
                        extracted_assigned = am.group(1).strip()
                if not extracted_mark_done and re.search(r'mark\s+(?:as\s+|this\s+|these\s+|them\s+)?(?:complate|complete|completed|done|finished)', line_str, re.IGNORECASE):
                    extracted_mark_done = True
                    extracted_stage = 'Done'
            else:
                clean_title = re.sub(r'^(?:\d+[\.\)]|\*|\-|•)\s*', '', line_str).strip()
                if clean_title and len(clean_title) >= 3:
                    task_titles.append(clean_title)

        if not task_titles:
            return {"error": "No task titles provided for batch creation."}

        # Resolve Project
        project = self._resolve_project(extracted_project)
        if not project:
            # Check full input context for project mention
            full_context = f"{str(tasks_raw)} {str(tool_input)}"
            all_projs = self.env['project.project'].search([('active', '=', True)])
            for p in sorted(all_projs, key=lambda x: len(x.name or ''), reverse=True):
                pname = (p.name or '').strip().lower()
                core = re.sub(r'\(.*?\)', '', pname).strip()
                if (len(core) >= 3 and core in full_context.lower()) or (len(pname) >= 4 and pname in full_context.lower()):
                    project = p
                    break

        if not project:
            active_projs = self.env['project.project'].search_read(
                [('active', '=', True)], ['name'], limit=25, order='name asc'
            )
            proj_list = [f"**{p['name']}**" for p in active_projs]
            proj_hint = ", ".join(proj_list) if proj_list else "None"
            p_display = extracted_project or 'unspecified'
            return {
                "error": f"Project '{p_display}' not found in Roongta ERP.\n\n📁 **Available Active Projects:** {proj_hint}\n\nPlease specify one of the available project names."
            }

        # Resolve Assignees
        target_user_ids, assigned_names = self._resolve_assignees(extracted_assigned)

        # Prepare Base Values
        base_vals = {
            'project_id': project.id,
            'user_ids': [(6, 0, target_user_ids)]
        }

        # Stage & State handling (e.g. mark_completed or stage_name='Done')
        stage_name_req = extracted_stage or tool_input.get('stage_name')
        mark_done = extracted_mark_done or tool_input.get('mark_completed') or (stage_name_req and str(stage_name_req).lower() in ['done', 'complete', 'completed', 'finished', 'closed'])
        stage_display = "To-Do"
        if mark_done:
            done_stage = self.env['project.task.type'].search([
                ('project_ids', 'in', [project.id]),
                '|', ('fold', '=', True), ('name', 'ilike', 'done')
            ], limit=1)
            if not done_stage:
                done_stage = self.env['project.task.type'].search([
                    '|', ('fold', '=', True), ('name', 'ilike', 'done')
                ], limit=1)
            if done_stage:
                base_vals['stage_id'] = done_stage.id
                stage_display = done_stage.name
            else:
                stage_display = "Done"
            base_vals['state'] = '1_done'
            base_vals['is_closed'] = True
            base_vals['date_last_stage_update'] = fields.Datetime.now()
        elif stage_name_req:
            st = self.env['project.task.type'].search([
                ('project_ids', 'in', [project.id]),
                ('name', 'ilike', str(stage_name_req).strip())
            ], limit=1)
            if st:
                base_vals['stage_id'] = st.id
                stage_display = st.name

        # Priority
        priority_raw = str(tool_input.get('priority') or '0').lower()
        if priority_raw in ['1', 'high', 'urgent', 'urgent priority', 'high priority']:
            base_vals['priority'] = '1'
        elif priority_raw in ['2', 'very high']:
            base_vals['priority'] = '2'
        elif priority_raw in ['3']:
            base_vals['priority'] = '3'
        else:
            base_vals['priority'] = '0'

        # Deadline
        date_deadline = tool_input.get('date_deadline')
        if date_deadline:
            d_match = re.search(r'\d{4}-\d{2}-\d{2}', str(date_deadline))
            if d_match:
                base_vals['date_deadline'] = d_match.group(0)

        # Department
        if 'department_id' in Task._fields:
            user_dept = self.env.user.department_id if hasattr(self.env.user, 'department_id') and self.env.user.department_id else False
            if not user_dept and 'hr.employee' in self.env:
                emp = self.env['hr.employee'].sudo().search([('user_id', '=', self.env.user.id)], limit=1)
                if emp and emp.department_id:
                    user_dept = emp.department_id
            if user_dept:
                base_vals['department_id'] = user_dept.id

        # Tag
        if 'single_tag_id' in Task._fields or 'tag_ids' in Task._fields:
            default_tag = self.env['project.tags'].sudo().search([('name', 'ilike', 'TechVizor')], limit=1)
            if not default_tag:
                default_tag = self.env['project.tags'].sudo().search([], limit=1)
            if default_tag:
                if 'tag_ids' in Task._fields:
                    base_vals['tag_ids'] = [(6, 0, [default_tag.id])]
                if 'single_tag_id' in Task._fields:
                    base_vals['single_tag_id'] = default_tag.id

        created_tasks = []
        for title in task_titles:
            vals = dict(base_vals)
            vals['name'] = title
            t = Task.create(vals)
            created_tasks.append(t)

        assignee_str = ", ".join(assigned_names) if assigned_names else self.env.user.name

        return {
            "success": True,
            "count": len(created_tasks),
            "project_name": project.name,
            "assigned_to": assignee_str,
            "stage_name": stage_display,
            "is_completed": mark_done,
            "tasks": [
                {
                    "task_id": t.id,
                    "task_name": t.name,
                    "project_name": project.name,
                    "assigned_to": assignee_str,
                    "stage_name": stage_display,
                    "deadline": str(t.date_deadline) if t.date_deadline else "None",
                    "priority": "High" if t.priority in ['1', '2', '3'] else "Normal"
                }
                for t in created_tasks
            ]
        }

    def _tool_search_projects(self, tool_input):
        Project = self.env['project.project']
        query = tool_input.get('query')
        domain = [('active', '=', True)]
        if query:
            domain.append(('name', 'ilike', query.strip()))
            
        limit = min(tool_input.get('limit', 10), 20)
        projects = Project.search(domain, limit=limit)
        
        results = []
        for p in projects:
            task_count = self.env['project.task'].search_count([('project_id', '=', p.id)])
            results.append({
                "id": p.id,
                "name": p.name,
                "manager": p.user_id.name if p.user_id else "Unassigned",
                "task_count": task_count,
            })
            
        return {
            "count": len(results),
            "projects": results
        }

    def _tool_get_task_stages(self, tool_input):
        """Retrieves active task and all available stages configured for its project"""
        Task = self.env['project.task']
        task_id = tool_input.get('task_id')
        task_name = tool_input.get('task_name')
        project_name = tool_input.get('project_name')

        task = None
        if task_id:
            try:
                task = Task.browse(int(task_id))
                if not task.exists():
                    task = None
            except Exception:
                task = None

        if not task and task_name:
            domain = [('name', '=ilike', str(task_name).strip()), ('active', '=', True)]
            if project_name:
                domain.append(('project_id.name', 'ilike', str(project_name).strip()))
            task = Task.search(domain, order='write_date desc, id desc', limit=1)

        if not task and project_name:
            task = Task.search([('project_id.name', 'ilike', str(project_name).strip()), ('active', '=', True)], order='write_date desc, id desc', limit=1)

        if not task:
            task = Task.search([('user_ids', 'in', [self.env.user.id]), ('active', '=', True)], order='write_date desc, id desc', limit=1)

        if not task:
            return {"error": "Task not found."}

        stage_domain = [('project_ids', 'in', [task.project_id.id])] if task.project_id else []
        stages = self.env['project.task.type'].search(stage_domain, order='sequence asc, id asc')
        if not stages:
            stages = self.env['project.task.type'].search([], order='sequence asc, id asc', limit=10)

        stage_names = [s.name for s in stages]
        if not stage_names:
            stage_names = ['To-Do', 'Pending', 'In Progress', 'Deployed', 'Done']

        current_stage = task.stage_id.name if task.stage_id else (
            "Done" if getattr(task, 'state', None) == '1_done' else ("In Progress" if getattr(task, 'state', None) == '01_in_progress' else "To-Do")
        )

        return {
            "success": True,
            "task_id": task.id,
            "task_name": task.name,
            "project_name": task.project_id.name if task.project_id else "General",
            "current_stage": current_stage,
            "available_stages": stage_names,
        }

    def _tool_complete_task(self, tool_input):
        """Marks a task as completed in Odoo"""
        tool_input['stage_name'] = 'Done'
        return self._tool_change_task_stage(tool_input)

    def _tool_change_task_stage(self, tool_input):
        """Updates the stage or state of a task in Odoo matching available project stages"""
        Task = self.env['project.task']
        task_id = tool_input.get('task_id')
        task_name = tool_input.get('task_name')
        project_name = tool_input.get('project_name')
        target_stage_name = str(tool_input.get('stage_name', 'Done')).strip()

        task = None
        if task_id:
            try:
                task = Task.browse(int(task_id))
                if not task.exists():
                    task = None
            except Exception:
                task = None

        if not task and task_name:
            domain = [('name', '=ilike', str(task_name).strip()), ('active', '=', True)]
            if project_name:
                domain.append(('project_id.name', 'ilike', str(project_name).strip()))
            task = Task.search(domain, order='write_date desc, id desc', limit=1)
            
            if not task:
                domain = [('name', 'ilike', str(task_name).strip()), ('active', '=', True)]
                if project_name:
                    domain.append(('project_id.name', 'ilike', str(project_name).strip()))
                task = Task.search(domain, order='write_date desc, id desc', limit=1)

        if not task and project_name:
            task = Task.search([('project_id.name', 'ilike', str(project_name).strip()), ('active', '=', True)], order='write_date desc, id desc', limit=1)

        if not task:
            if not task_id and not task_name:
                return {"error": "Please specify the task ID or task title you want to update."}
            return {"error": "Task not found to update stage."}

        vals = {}
        target_lower = target_stage_name.lower().replace('-', ' ')

        # Find matching stage in project.task.type
        stage_domain = [('project_ids', 'in', [task.project_id.id])] if task.project_id else []
        proj_stages = self.env['project.task.type'].search(stage_domain, order='sequence asc, id asc')
        if not proj_stages:
            proj_stages = self.env['project.task.type'].search([], order='sequence asc, id asc')

        matched_stage = None
        # 1. Exact or case-insensitive match
        for st in proj_stages:
            st_clean = st.name.lower().replace('-', ' ')
            if st_clean == target_lower or st.name.lower() == target_stage_name.lower():
                matched_stage = st
                break

        # 2. Substring match (e.g. 'done' matches 'Done', 'progress' matches 'In Progress')
        if not matched_stage:
            for st in proj_stages:
                st_clean = st.name.lower().replace('-', ' ')
                if target_lower in st_clean or st_clean in target_lower:
                    matched_stage = st
                    break

        if not matched_stage:
            # Fallback search across all project stages
            matched_stage = self.env['project.task.type'].search([('name', 'ilike', target_stage_name)], limit=1)

        if matched_stage:
            vals['stage_id'] = matched_stage.id

        # Update state field for Odoo 18
        if hasattr(task, 'state'):
            if any(w in target_lower for w in ['done', 'complete', 'finish', 'closed', 'deploy']):
                vals['state'] = '1_done'
            elif any(w in target_lower for w in ['progress', 'doing', 'working', 'pending']):
                vals['state'] = '01_in_progress'
            elif any(w in target_lower for w in ['to do', 'todo', 'new', 'draft', 'open']):
                vals['state'] = '01_in_progress'

        if vals:
            task.write(vals)

        current_stage = task.stage_id.name if task.stage_id else (
            matched_stage.name if matched_stage else target_stage_name
        )

        return {
            "success": True,
            "task_id": task.id,
            "task_name": task.name,
            "project_name": task.project_id.name if task.project_id else "General",
            "stage_name": current_stage,
            "assignee": ", ".join(task.user_ids.mapped('name')) or self.env.user.name
        }

    def _tool_update_task_stage(self, tool_input):
        return self._tool_change_task_stage(tool_input)

    def _tool_update_task(self, tool_input):
        """Updates fields of an existing task (assignment, priority, deadline)"""
        Task = self.env['project.task']
        task_id = tool_input.get('task_id')
        task_name = tool_input.get('task_name')

        task = None
        if task_id:
            try:
                task = Task.browse(int(task_id))
                if not task.exists():
                    task = None
            except Exception:
                task = None

        if not task and task_name:
            domain = [('name', '=ilike', str(task_name).strip()), ('active', '=', True)]
            task = Task.search(domain, order='write_date desc, id desc', limit=1)
            
            if not task:
                domain = [('name', 'ilike', str(task_name).strip()), ('active', '=', True)]
                task = Task.search(domain, order='write_date desc, id desc', limit=1)

        if not task:
            if task_id:
                return {"error": f"Task #{task_id} not found in Roongta ERP."}
            if task_name:
                return {"error": f"Task '{task_name}' not found in Roongta ERP."}
            task = Task.search([('user_ids', 'in', [self.env.user.id]), ('active', '=', True)], order='write_date desc, id desc', limit=1)

        if not task:
            return {"error": "No task specified or found to update."}

        vals = {}
        
        # Multi-Assignee Lookup
        assigned_to = tool_input.get('assigned_to')
        if assigned_to:
            target_user_ids, assigned_names = self._resolve_assignees(assigned_to)
            if target_user_ids:
                if tool_input.get('append_assignee'):
                    existing_ids = task.user_ids.ids if task.user_ids else []
                    combined_ids = list(set(existing_ids + target_user_ids))
                    vals['user_ids'] = [(6, 0, combined_ids)]
                else:
                    vals['user_ids'] = [(6, 0, target_user_ids)]

        # Deadline
        date_deadline = tool_input.get('date_deadline')
        if date_deadline:
            try:
                d_match = re.search(r'\d{4}-\d{2}-\d{2}', str(date_deadline))
                if d_match:
                    vals['date_deadline'] = d_match.group(0)
            except Exception:
                pass

        # Priority
        if tool_input.get('priority'):
            priority_raw = str(tool_input.get('priority')).lower()
            if priority_raw in ['1', 'high', 'urgent', 'urgent priority', 'high priority']:
                vals['priority'] = '1'
            elif priority_raw in ['2', 'very high']:
                vals['priority'] = '2'
            elif priority_raw in ['3']:
                vals['priority'] = '3'
            else:
                vals['priority'] = '0'

        if vals:
            task.write(vals)

        return {
            "success": True,
            "task_id": task.id,
            "task_name": task.name,
            "project_name": task.project_id.name if task.project_id else "General",
            "assigned_to": ", ".join(task.user_ids.mapped('name')) or "Unassigned",
            "deadline": str(task.date_deadline) if task.date_deadline else "None",
            "priority": "High" if task.priority in ['1', '2', '3'] else "Normal",
        }

    def _tool_delete_task(self, tool_input):
        """Deletes a task from Odoo"""
        Task = self.env['project.task']
        task_id = tool_input.get('task_id')
        task_name = tool_input.get('task_name')
        project_name = tool_input.get('project_name')

        task = None
        if task_id:
            try:
                task = Task.browse(int(task_id))
                if not task.exists():
                    task = None
            except Exception:
                task = None

        if not task and task_name:
            domain = [('name', '=ilike', str(task_name).strip()), ('active', '=', True)]
            if project_name:
                domain.append(('project_id.name', 'ilike', str(project_name).strip()))
            task = Task.search(domain, order='write_date desc, id desc', limit=1)
            
            if not task:
                domain = [('name', 'ilike', str(task_name).strip()), ('active', '=', True)]
                if project_name:
                    domain.append(('project_id.name', 'ilike', str(project_name).strip()))
                task = Task.search(domain, order='write_date desc, id desc', limit=1)

        if not task and project_name:
            task = Task.search([('project_id.name', 'ilike', str(project_name).strip()), ('active', '=', True)], order='write_date desc, id desc', limit=1)

        if not task:
            if task_id:
                return {"error": f"Task #{task_id} not found to delete."}
            if task_name:
                return {"error": f"Task '{task_name}' not found to delete."}
            return {"error": "Please specify the task ID or title you want to delete."}

        is_admin = self.env.user.has_group('base.group_system') or self.env.user.has_group('project.group_project_manager')
        if not is_admin and task.create_uid and task.create_uid.id != self.env.user.id:
            return {"error": f"You do not have permission to delete this task. It can only be deleted by its creator ({task.create_uid.name}) or a Project Manager."}

        task_id = task.id
        task_name_val = task.name
        project_name_val = task.project_id.name if task.project_id else "General"
        
        task.unlink()

        return {
            "success": True,
            "deleted": True,
            "task_id": task_id,
            "task_name": task_name_val,
            "project_name": project_name_val
        }

    def _tool_get_system_metrics(self, tool_input):
        return self._tool_get_my_tasks_summary({})
