# -*- coding: utf-8 -*-
from odoo import models, api, fields
import logging

_logger = logging.getLogger(__name__)

class CustomTaskCreate(models.AbstractModel):
    _name = 'custom.taskcreate'
    _description = 'Custom Task Creation Service'

    @api.model
    def get_init_data(self):
        """Fetch project, department, tag, and assignee metadata for the modal"""
        user = self.env.user
        is_admin = user.has_group('base.group_system') or user.has_group('project.group_project_manager')

        # Projects
        projects = self.env['project.project'].search_read(
            [('active', '=', True)],
            ['id', 'name'],
            order='name asc'
        )

        # 1. Native Odoo default_get for project.task
        task_defaults = {}
        try:
            task_defaults = self.env['project.task'].default_get(['project_id', 'department_id', 'single_tag_id', 'tag_ids', 'user_ids', 'date_deadline'])
        except Exception as e:
            _logger.warning("Error getting project.task default_get: %s", e)

        # Default deadline: 3 days from today (or from task default_get)
        default_deadline = False
        if task_defaults.get('date_deadline'):
            default_deadline = fields.Date.to_string(task_defaults['date_deadline'])
        else:
            from datetime import date, timedelta
            default_deadline = fields.Date.to_string(date.today() + timedelta(days=3))

        # Detect User's Department
        default_department_id = task_defaults.get('department_id')
        if not default_department_id:
            user_dept = user.department_id if hasattr(user, 'department_id') and user.department_id else False
            if not user_dept and 'hr.employee' in self.env:
                emp = self.env['hr.employee'].sudo().search([('user_id', '=', user.id)], limit=1)
                if emp and emp.department_id:
                    user_dept = emp.department_id
            default_department_id = user_dept.id if user_dept else False
        else:
            user_dept = self.env['hr.department'].browse(default_department_id) if default_department_id else False

        # Detect User's Default Tag (Prioritize user's active working tag like TechVizor)
        default_tag_ids = []
        if task_defaults.get('single_tag_id'):
            default_tag_ids = [task_defaults['single_tag_id']]
        elif task_defaults.get('tag_ids'):
            t_ids = task_defaults['tag_ids']
            if isinstance(t_ids, list) and t_ids and isinstance(t_ids[0], (list, tuple)) and len(t_ids[0]) >= 3:
                default_tag_ids = list(t_ids[0][2])
            elif isinstance(t_ids, list):
                default_tag_ids = [t for t in t_ids if isinstance(t, int)]

        # 2. Check user's own last created task tag (e.g. TechVizor)
        if not default_tag_ids:
            last_created = self.env['project.task'].sudo().search([
                ('create_uid', '=', user.id),
                '|', ('single_tag_id', '!=', False), ('tag_ids', '!=', False)
            ], order='create_date desc, id desc', limit=1)
            if last_created:
                if hasattr(last_created, 'single_tag_id') and last_created.single_tag_id:
                    default_tag_ids = [last_created.single_tag_id.id]
                elif last_created.tag_ids:
                    default_tag_ids = [last_created.tag_ids[0].id]

        # 3. Check user's own assigned tasks tag
        if not default_tag_ids:
            last_assigned = self.env['project.task'].sudo().search([
                ('user_ids', 'in', [user.id]),
                '|', ('single_tag_id', '!=', False), ('tag_ids', '!=', False)
            ], order='write_date desc, id desc', limit=1)
            if last_assigned:
                if hasattr(last_assigned, 'single_tag_id') and last_assigned.single_tag_id:
                    default_tag_ids = [last_assigned.single_tag_id.id]
                elif last_assigned.tag_ids:
                    default_tag_ids = [last_assigned.tag_ids[0].id]

        # 4. Check user's department's most recent task tag
        if not default_tag_ids and user_dept:
            recent_task = self.env['project.task'].sudo().search([
                ('department_id', '=', user_dept.id),
                '|', ('single_tag_id', '!=', False), ('tag_ids', '!=', False)
            ], order='id desc', limit=1)
            if recent_task:
                if hasattr(recent_task, 'single_tag_id') and recent_task.single_tag_id:
                    default_tag_ids = [recent_task.single_tag_id.id]
                elif recent_task.tag_ids:
                    default_tag_ids = [recent_task.tag_ids[0].id]

        # 5. Check if project.tags matches department name directly
        if not default_tag_ids and user_dept:
            matching_tag = self.env['project.tags'].sudo().search([
                ('name', '=ilike', user_dept.name.strip())
            ], limit=1)
            if matching_tag:
                default_tag_ids = [matching_tag.id]

        # Default Assignees: logged-in user
        default_user_ids = [user.id]

        # Departments
        if is_admin:
            departments = self.env['hr.department'].search_read(
                [],
                ['id', 'name'],
                order='name asc'
            )
        else:
            departments = self.env['hr.department'].search_read(
                [],
                ['id', 'name'],
                order='name asc'
            )
            if not departments and user_dept:
                departments = [{'id': user_dept.id, 'name': user_dept.name}]

        # Assignees
        assignees = self.env['res.users'].search_read(
            [('active', '=', True), ('share', '=', False)],
            ['id', 'name'],
            order='name asc'
        )

        # Tags
        tags = self.env['project.tags'].search_read(
            [],
            ['id', 'name', 'color'],
            order='name asc'
        )

        # Labels (project.task.label)
        labels = []
        if 'project.task.label' in self.env:
            labels = self.env['project.task.label'].search_read(
                [],
                ['id', 'name'],
                order='name asc'
            )
        if not labels:
            # Fallback standard labels if no records exist yet
            labels = [
                {'id': 1, 'name': 'New Task'},
                {'id': 2, 'name': 'Bug Fixing'},
                {'id': 3, 'name': 'Bug'},
                {'id': 4, 'name': 'Support'},
                {'id': 5, 'name': 'Demo'},
                {'id': 6, 'name': 'Changes'},
                {'id': 7, 'name': 'Testing'},
            ]

        return {
            'projects': projects,
            'departments': departments,
            'assignees': assignees,
            'tags': tags,
            'labels': labels,
            'stages': [],
            'current_user_id': user.id,
            'default_department_id': default_department_id,
            'default_tag_id': default_tag_ids[0] if default_tag_ids else False,
            'default_tag_ids': default_tag_ids,
            'default_user_ids': default_user_ids,
            'default_deadline': default_deadline,
        }

    @api.model
    def get_project_stages(self, project_id=None):
        """Fetch stages associated with a project in sequence order"""
        if not project_id:
            return []
        stages = self.env['project.task.type'].search_read(
            [('project_ids', 'in', [int(project_id)])],
            ['id', 'name', 'sequence', 'fold'],
            order='sequence asc, id asc'
        )
        if not stages:
            stages = self.env['project.task.type'].search_read(
                ['|', ('project_ids', '=', False), ('project_ids', 'in', [int(project_id)])],
                ['id', 'name', 'sequence', 'fold'],
                order='sequence asc, id asc',
                limit=6
            )
        return stages

    @api.model
    def create_task_from_modal(self, vals):
        """Creates a new project.task from modal inputs with subtasks and associations"""
        if not vals or not vals.get('name'):
            return {'status': 'error', 'message': 'Task title is required.'}

        try:
            task_vals = {
                'name': vals.get('name').strip(),
            }
            if vals.get('project_id'):
                task_vals['project_id'] = int(vals['project_id'])
            if vals.get('stage_id'):
                task_vals['stage_id'] = int(vals['stage_id'])
            if vals.get('department_id'):
                task_vals['department_id'] = int(vals['department_id'])
            if vals.get('date_deadline'):
                task_vals['date_deadline'] = vals['date_deadline']
            if vals.get('description'):
                task_vals['description'] = vals['description']
            if vals.get('label_id'):
                task_vals['label_id'] = int(vals['label_id'])
            if vals.get('user_ids'):
                task_vals['user_ids'] = [(6, 0, [int(u) for u in vals['user_ids'] if u])]
            
            # Handle single tag selection
            tag_id = vals.get('tag_id') or vals.get('single_tag_id')
            if not tag_id and vals.get('tag_ids'):
                t_ids = [int(t) for t in vals['tag_ids'] if t]
                if t_ids:
                    tag_id = t_ids[0]

            if tag_id:
                task_vals['tag_ids'] = [(6, 0, [int(tag_id)])]
                if 'single_tag_id' in self.env['project.task']._fields:
                    task_vals['single_tag_id'] = int(tag_id)
            elif vals.get('tag_ids') == [] or vals.get('tag_id') is False:
                task_vals['tag_ids'] = [(5, 0, 0)]
                if 'single_tag_id' in self.env['project.task']._fields:
                    task_vals['single_tag_id'] = False

            if vals.get('priority'):
                task_vals['priority'] = str(vals['priority'])

            new_task = self.env['project.task'].create(task_vals)

            # Create subtasks if provided
            subtasks = vals.get('subtasks') or []
            for st in subtasks:
                if isinstance(st, dict):
                    st_name = (st.get('name') or '').strip()
                    st_user_ids = st.get('user_ids') or []
                else:
                    st_name = str(st).strip()
                    st_user_ids = []
                if st_name:
                    sub_vals = {
                        'name': st_name,
                        'parent_id': new_task.id,
                    }
                    if st_user_ids:
                        sub_vals['user_ids'] = [(6, 0, [int(u) for u in st_user_ids if u])]
                    if task_vals.get('project_id'):
                        sub_vals['project_id'] = task_vals['project_id']
                    if task_vals.get('department_id'):
                        sub_vals['department_id'] = task_vals['department_id']
                    self.env['project.task'].create(sub_vals)

            return {
                'status': 'success',
                'task_id': new_task.id,
                'task_name': new_task.name,
            }
        except Exception as e:
            _logger.exception("Error creating task from modal: %s", str(e))
            return {
                'status': 'error',
                'message': str(e),
            }
