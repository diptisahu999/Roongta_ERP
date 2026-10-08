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
                "description": "Get only the pending tasks assigned to the current user (active, not completed).",
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "get_my_tasks_summary",
                "description": "Get real-time count and status of all tasks (Total, In Progress, Completed, Due Today, Due This Week, Overdue).",
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "search_tasks",
                "description": "Search and query tasks in Odoo with optional filters like keyword, project name, user name, overdue status, or priority.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query or task title keyword"},
                        "project_name": {"type": "string", "description": "Filter by project name (optional)"},
                        "assigned_to": {"type": "string", "description": "Filter by assigned user name (optional)"},
                        "overdue_only": {"type": "boolean", "description": "Filter only overdue tasks (optional)"},
                        "priority_only": {"type": "boolean", "description": "Filter only high priority tasks (optional)"},
                        "limit": {"type": "integer", "description": "Maximum number of tasks to return (default 10)", "default": 10}
                    },
                    "required": []
                }
            },
            {
                "name": "create_task",
                "description": "Create a new project task in Odoo.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Title of the task (required)"},
                        "project_name": {"type": "string", "description": "Name of the project to create the task in (optional)"},
                        "assigned_to": {"type": "string", "description": "Name or email of user to assign task to (optional)"},
                        "date_deadline": {"type": "string", "description": "Deadline in YYYY-MM-DD format (optional)"},
                        "priority": {"type": "string", "enum": ["0", "1", "2", "3"], "description": "Priority (optional)"},
                        "description": {"type": "string", "description": "Detailed description for the task (optional)"}
                    },
                    "required": ["name"]
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
        """Fetches ONLY the pending tasks assigned to the current user"""
        user = self.env.user
        Task = self.env['project.task']
        
        # User's uncompleted tasks
        domain = [
            ('active', '=', True),
            ('user_ids', 'in', [user.id]),
            ('state', 'not in', ['1_done', '1_canceled'])
        ]
        
        # If user has no assigned pending tasks, check if user is manager/admin
        user_tasks = Task.search(domain, order='date_deadline asc, id desc')
        
        # If no personal tasks and user is admin, also check general pending tasks
        is_admin = user.has_group('base.group_system') or user.has_group('project.group_project_manager')
        general_tasks = []
        if not user_tasks and is_admin:
            general_tasks = Task.search([('active', '=', True), ('state', 'not in', ['1_done', '1_canceled'])], order='date_deadline asc, id desc', limit=10)

        tasks_to_format = user_tasks if user_tasks else general_tasks

        results = []
        for t in tasks_to_format:
            results.append({
                "id": t.id,
                "name": t.name,
                "project": t.project_id.name if t.project_id else "No Project",
                "assigned_to": ", ".join(t.user_ids.mapped('name')) if t.user_ids else "Unassigned",
                "stage": t.stage_id.name if t.stage_id else "",
                "deadline": str(t.date_deadline) if t.date_deadline else "No Deadline",
                "priority": "High" if t.priority in ['1', '2', '3'] else "Normal",
            })

        return {
            "user_name": user.name,
            "count": len(results),
            "is_assigned_to_user": bool(user_tasks),
            "tasks": results
        }

    def _tool_get_my_tasks_summary(self, tool_input):
        """Fetches exact live statistics matching the Dashboard metrics optimized for speed"""
        user = self.env.user
        today = fields.Date.context_today(self)
        Task = self.env['project.task']

        # Database-level optimized counts
        total_tasks = Task.search_count([('active', '=', True)])
        done_count = Task.search_count([('active', '=', True), ('state', 'in', ['1_done', '1_canceled'])])
        blocked_count = Task.search_count([('active', '=', True), ('state', '=', '04_waiting_normal')])
        in_progress_count = total_tasks - done_count - blocked_count

        today_str = today.strftime('%Y-%m-%d')
        week_end_str = (today + timedelta(days=7)).strftime('%Y-%m-%d')

        overdue_count = Task.search_count([('active', '=', True), ('state', 'not in', ['1_done', '1_canceled']), ('date_deadline', '<', today_str)])
        due_today_count = Task.search_count([('active', '=', True), ('state', 'not in', ['1_done', '1_canceled']), ('date_deadline', '=', today_str)])
        due_this_week_count = Task.search_count([('active', '=', True), ('state', 'not in', ['1_done', '1_canceled']), ('date_deadline', '>=', today_str), ('date_deadline', '<=', week_end_str)])

        # Fetch only a small subset of tasks for the lists
        in_progress_records = Task.search_read(
            [('active', '=', True), ('state', 'not in', ['1_done', '1_canceled', '04_waiting_normal'])],
            ['id', 'name', 'date_deadline', 'project_id', 'priority'],
            limit=5, order='date_deadline asc, id desc'
        )

        due_this_week_records = Task.search_read(
            [('active', '=', True), ('state', 'not in', ['1_done', '1_canceled']), ('date_deadline', '>=', today_str), ('date_deadline', '<=', week_end_str)],
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
            "user_name": user.name,
            "total_tasks": total_tasks,
            "in_progress_count": in_progress_count,
            "completed_count": done_count,
            "due_today_count": due_today_count,
            "due_this_week_count": due_this_week_count,
            "overdue_count": overdue_count,
            "blocked_count": blocked_count,
            "pending_count": in_progress_count + blocked_count,
            "in_progress_tasks": [format_t(t) for t in in_progress_records],
            "due_this_week_tasks": [format_t(t) for t in due_this_week_records],
        }

    def _tool_search_tasks(self, tool_input):
        Task = self.env['project.task']
        domain = [('active', '=', True)]
        
        query = tool_input.get('query')
        if query:
            domain.append(('name', 'ilike', query.strip()))
            
        project_name = tool_input.get('project_name')
        if project_name:
            domain.append(('project_id.name', 'ilike', project_name.strip()))
            
        assigned_to = tool_input.get('assigned_to')
        if assigned_to:
            domain.append(('user_ids.name', 'ilike', assigned_to.strip()))
            
        if tool_input.get('overdue_only'):
            today_str = fields.Date.context_today(self)
            domain.append(('date_deadline', '<', today_str))
            domain.append(('state', 'not in', ['1_done', '1_canceled']))

        if tool_input.get('priority_only'):
            domain.append(('priority', 'in', ['1', '2', '3']))

        limit = min(tool_input.get('limit', 10), 20)
        tasks = Task.search(domain, order='date_deadline asc, id desc', limit=limit)
        
        results = []
        for t in tasks:
            results.append({
                "id": t.id,
                "name": t.name,
                "project": t.project_id.name if t.project_id else "No Project",
                "assigned_users": ", ".join(t.user_ids.mapped('name')) if t.user_ids else "Unassigned",
                "stage": t.stage_id.name if t.stage_id else "",
                "priority": "High" if t.priority in ['1', '2', '3'] else "Normal",
                "deadline": str(t.date_deadline) if t.date_deadline else "None",
            })
            
        return {
            "count_found": len(results),
            "tasks": results
        }

    def _tool_create_task(self, tool_input):
        Task = self.env['project.task']
        name = tool_input.get('name', '').strip()
        if not name:
            return {"error": "Task name is required."}

        vals = {'name': name}
        
        # Dynamic Odoo Project Validation with Exact & Closest Matching
        project_name = tool_input.get('project_name')
        project = None
        if project_name and str(project_name).strip():
            p_clean = str(project_name).strip()
            # 1. Exact case-insensitive match (e.g. 'Task Management' == 'task management')
            project = self.env['project.project'].search([
                ('name', '=ilike', p_clean),
                ('active', '=', True)
            ], limit=1)
            
            # 2. If no exact match, search with ilike and pick the project with closest matching name
            if not project:
                matched_projects = self.env['project.project'].search([
                    ('name', 'ilike', p_clean),
                    ('active', '=', True)
                ])
                if matched_projects:
                    # Sort by difference in string length to find the best match
                    project = min(matched_projects, key=lambda p: abs(len(p.name or '') - len(p_clean)))

            # 3. Normalized alphanumeric search
            if not project:
                all_projs = self.env['project.project'].search([('active', '=', True)])
                p_norm = re.sub(r'[^a-zA-Z0-9]', '', p_clean.lower())
                for p in all_projs:
                    if re.sub(r'[^a-zA-Z0-9]', '', (p.name or '').lower()) == p_norm:
                        project = p
                        break

            if not project:
                active_projs = self.env['project.project'].search_read(
                    [('active', '=', True)], ['name'], limit=25, order='name asc'
                )
                proj_list = [f"**{p['name']}**" for p in active_projs]
                proj_hint = ", ".join(proj_list) if proj_list else "None"
                return {
                    "error": f"Project '{p_clean}' not found in Roongta ERP.\n\n📁 **Available Active Projects:** {proj_hint}\n\nPlease specify one of the available project names."
                }
        else:
            active_projs = self.env['project.project'].search_read(
                [('active', '=', True)], ['name'], limit=25, order='name asc'
            )
            proj_list = [f"**{p['name']}**" for p in active_projs]
            proj_hint = ", ".join(proj_list) if proj_list else "None"
            return {
                "error": f"Please specify a project for this task.\n\n📁 **Available Active Projects:** {proj_hint}"
            }
            
        vals['project_id'] = project.id

        # Multi-Assignee Lookup (supports "me and kartikey", "Diptiranjan, Kartikey", etc.)
        assigned_to = tool_input.get('assigned_to')
        target_user_ids = []
        if assigned_to:
            raw_assigned = str(assigned_to).strip()
            # Split by 'and', '&', '+', or commas
            user_tokens = re.split(r'\s+(?:and|&|\+)\s+|,\s*', raw_assigned, flags=re.IGNORECASE)
            for tok in user_tokens:
                tok_clean = tok.strip()
                if not tok_clean:
                    continue
                if tok_clean.lower() in ['me', 'myself', 'self', 'my', 'current user', 'i']:
                    if self.env.user.id not in target_user_ids:
                        target_user_ids.append(self.env.user.id)
                else:
                    found_u = self.env['res.users'].search([
                        '|', ('name', 'ilike', tok_clean), ('login', 'ilike', tok_clean)
                    ], limit=1)
                    if found_u and found_u.id not in target_user_ids:
                        target_user_ids.append(found_u.id)

        if not target_user_ids:
            target_user_ids = [self.env.user.id]

        vals['user_ids'] = [(6, 0, target_user_ids)]

        # Deadline
        date_deadline = tool_input.get('date_deadline')
        if date_deadline:
            try:
                # Validate date format YYYY-MM-DD
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

        # Department Lookup (matches user's department like IT)
        if 'department_id' in Task._fields:
            user_dept = self.env.user.department_id if hasattr(self.env.user, 'department_id') and self.env.user.department_id else False
            if not user_dept and 'hr.employee' in self.env:
                emp = self.env['hr.employee'].sudo().search([('user_id', '=', self.env.user.id)], limit=1)
                if emp and emp.department_id:
                    user_dept = emp.department_id
            if user_dept:
                vals['department_id'] = user_dept.id

        # Tag Lookup (matches user's active tag like TechVizor)
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
        dept_name = new_task.department_id.name if hasattr(new_task, 'department_id') and new_task.department_id else (user_dept.name if user_dept else "IT")
        tag_name = ""
        if hasattr(new_task, 'single_tag_id') and new_task.single_tag_id:
            tag_name = new_task.single_tag_id.name
        elif new_task.tag_ids:
            tag_name = new_task.tag_ids[0].name
        else:
            tag_name = "TechVizor"

        return {
            "success": True,
            "task_id": new_task.id,
            "task_name": new_task.name,
            "project_name": new_task.project_id.name if new_task.project_id else "General",
            "assigned_to": ", ".join(new_task.user_ids.mapped('name')) if new_task.user_ids else assigned_user.name,
            "department": dept_name,
            "tag": tag_name,
            "deadline": str(new_task.date_deadline) if new_task.date_deadline else "None",
            "priority": "High" if new_task.priority in ['1', '2', '3'] else "Normal",
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
            task = Task.search([('user_ids', 'in', [self.env.user.id]), ('active', '=', True)], order='write_date desc, id desc', limit=1)

        if not task:
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
            task = Task.search([('user_ids', 'in', [self.env.user.id]), ('active', '=', True)], order='write_date desc, id desc', limit=1)

        if not task:
            return {"error": "Task not found to update."}

        vals = {}
        
        # Multi-Assignee Lookup
        assigned_to = tool_input.get('assigned_to')
        if assigned_to:
            target_user_ids = []
            raw_assigned = str(assigned_to).strip()
            user_tokens = re.split(r'\s+(?:and|&|\+)\s+|,\s*', raw_assigned, flags=re.IGNORECASE)
            for tok in user_tokens:
                tok_clean = tok.strip()
                if not tok_clean:
                    continue
                if tok_clean.lower() in ['me', 'myself', 'self', 'my', 'current user', 'i']:
                    if self.env.user.id not in target_user_ids:
                        target_user_ids.append(self.env.user.id)
                else:
                    found_u = self.env['res.users'].search([
                        '|', ('name', 'ilike', tok_clean), ('login', 'ilike', tok_clean)
                    ], limit=1)
                    if found_u and found_u.id not in target_user_ids:
                        target_user_ids.append(found_u.id)
            
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

    def _tool_get_system_metrics(self, tool_input):
        return self._tool_get_my_tasks_summary({})
