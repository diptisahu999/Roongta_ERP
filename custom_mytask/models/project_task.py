# -*- coding: utf-8 -*-
from odoo import models, api, fields
from datetime import datetime, date, timedelta
import logging

_logger = logging.getLogger(__name__)

class ProjectTask(models.Model):
    _inherit = 'project.task'

    @api.model
    def _hide_my_task_menus(self):
        """Disable any unwanted legacy/duplicate 'My Task' or dashboard menus in sidebar,
        and remove obsolete/ghost module records from ir.module.module."""
        # 1. Clean up ghost / obsolete module entries from Apps list
        try:
            self.env.cr.execute("""
                UPDATE ir_module_module 
                SET state = 'uninstalled' 
                WHERE name IN ('my_task_dashboard', 'my_task', 'my_tasks_dashboard', 'my_tasks', 'new_task')
                  AND name != 'custom_mytask'
            """)
            self.env.cr.execute("""
                DELETE FROM ir_module_module 
                WHERE name IN ('my_task_dashboard', 'my_task', 'my_tasks_dashboard', 'my_tasks', 'new_task')
                  AND name != 'custom_mytask'
            """)
        except Exception as e:
            _logger.warning("Could not clean ghost modules: %s", e)

        # 2. Deactivate duplicate/legacy sidebar menus
        our_menu = self.env.ref('custom_mytask.menu_new_task_root', raise_if_not_found=False)
        our_menu_id = our_menu.id if our_menu else False
        project_root = self.env.ref('project.menu_main_pm', raise_if_not_found=False)
        project_root_id = project_root.id if project_root else False

        # Find all other menus named My Task / My Tasks or pointing to dashboard/my_task actions
        domain = [
            '|', '|', '|',
            ('name', 'ilike', 'My Task%'),
            ('action', 'ilike', '%my_task%'),
            ('action', 'ilike', '%department_dashboard%'),
            ('action', 'ilike', '%project_dashboard%')
        ]
        menus = self.env['ir.ui.menu'].search(domain)
        for menu in menus:
            if our_menu_id and menu.id == our_menu_id:
                # Ensure our new root menu is always active
                menu.active = True
                continue
            if project_root_id and menu.id == project_root_id:
                # Keep main Project app menu intact
                continue
            
            # Deactivate duplicate or legacy My Tasks root or sub-menus
            _logger.info("Deactivating duplicate My Task menu: id=%s, name=%s, action=%s", menu.id, menu.name, menu.action)
            menu.active = False

    @api.model
    def get_my_tasks_dashboard_data(self, filters=None):
        """Fetch tasks grouped by department with statistics and metadata for the My Tasks dashboard."""
        if filters is None:
            filters = {}
        
        today = fields.Date.context_today(self)
        uid = self.env.uid

        # Base domain
        domain = [('active', '=', True)]
        
        # 3 Role Levels: Admin -> Manager -> Regular User
        is_admin = self.env.user.has_group('base.group_system') or self.env.user.has_group('project.group_project_manager')
        is_manager = self.env.user.has_group('custom_project.group_project_manager_custom')

        # Scope / Assignee filter
        assignee_filter = filters.get('assignee_id', 'all')
        if assignee_filter == 'my_tasks':
            domain.append(('user_ids', 'in', [uid]))
        elif assignee_filter and assignee_filter != 'all':
            try:
                domain.append(('user_ids', 'in', [int(assignee_filter)]))
            except (ValueError, TypeError):
                pass
        elif not is_admin and not is_manager:
            # Regular user only sees their own assigned tasks
            domain.append(('user_ids', 'in', [uid]))
                
        # Department filter
        dept_filter = filters.get('department_id', 'all')
        if dept_filter and dept_filter != 'all':
            try:
                domain.append(('department_id', '=', int(dept_filter)))
            except (ValueError, TypeError):
                pass
                
        # Status Filter (Uncompleted Tasks / Pending / Overdue / MGMT Discussion / Done / All)
        status_filter = filters.get('status', 'uncompleted')
        if status_filter in ['uncompleted', 'pending_due']:
            domain.append(('is_closed', '=', False))
        elif status_filter == 'pending':
            domain.extend([('is_closed', '=', False), '|', ('date_deadline', '>=', today), ('date_deadline', '=', False)])
        elif status_filter == 'overdue':
            domain.extend([('is_closed', '=', False), ('date_deadline', '<', today)])
        elif status_filter == 'mgmt_discussion':
            domain.append(('state', '=', '05_management_discussion'))
        elif status_filter == 'done':
            domain.append(('is_closed', '=', True))
        elif status_filter == 'all':
            pass

        # Time / Due filter
        time_filter = filters.get('time_filter', 'all')
        if filters.get('due_this_week'):
            from datetime import timedelta
            start_week = today - timedelta(days=today.weekday())
            end_week = start_week + timedelta(days=6)
            domain.extend([('date_deadline', '>=', start_week), ('date_deadline', '<=', end_week)])
        elif time_filter == 'today':
            domain.append(('date_deadline', '=', today))
        elif time_filter == 'this_week':
            from datetime import timedelta
            start_week = today - timedelta(days=today.weekday())
            end_week = start_week + timedelta(days=6)
            domain.extend([('date_deadline', '>=', start_week), ('date_deadline', '<=', end_week)])
        elif time_filter == 'this_month':
            from datetime import timedelta
            start_month = today.replace(day=1)
            next_month = (start_month.replace(day=28) + timedelta(days=4)).replace(day=1)
            end_month = next_month - timedelta(days=1)
            domain.extend([('date_deadline', '>=', start_month), ('date_deadline', '<=', end_month)])
        elif time_filter == 'overdue':
            domain.extend([('is_closed', '=', False), ('date_deadline', '<', today)])
            
        # High Priority filter
        if filters.get('high_priority'):
            domain.append(('priority', 'in', ['2', '3', '1']))
            
        # Search Term
        search_term = (filters.get('search_term') or '').strip()
        if search_term:
            domain.extend([
                '|', '|', '|', '|',
                ('name', 'ilike', search_term),
                ('project_id.name', 'ilike', search_term),
                ('department_id.name', 'ilike', search_term),
                ('single_tag_id.name', 'ilike', search_term),
                ('user_ids.name', 'ilike', search_term)
            ])
            
        tasks = self.search(domain, order="department_id, single_tag_id, project_id, date_deadline asc, id desc")
        
        # Timezone for date formatting
        import pytz
        user_tz_name = self.env.user.tz or 'UTC'
        try:
            user_tz = pytz.timezone(user_tz_name)
        except Exception:
            user_tz = pytz.utc

        # Build 3-level Hierarchy: Department -> Tag -> Project -> Tasks
        depts_dict = {}
        
        all_projects = self.env['project.project'].search_read([], ['id', 'name'], order='name asc')
        
        # Determine user department
        user_dept = self.env.user.department_id if hasattr(self.env.user, 'department_id') and self.env.user.department_id else False
        if not user_dept:
            emp = self.env['hr.employee'].sudo().search([('user_id', '=', self.env.uid)], limit=1)
            if emp and emp.department_id:
                user_dept = emp.department_id

        # Department list based on role:
        # - Admin: all departments
        # - Manager / Regular User: ONLY their own department
        if is_admin:
            all_depts = self.env['hr.department'].search_read([], ['id', 'name'], order='name asc')
        elif user_dept:
            all_depts = self.env['hr.department'].search_read([('id', '=', user_dept.id)], ['id', 'name'], order='name asc')
        else:
            all_depts = []
        
        # Configure user list based on role:
        # - Admin: all users (or filtered by selected department)
        # - Manager: users in manager's department
        # - Regular User: ONLY themselves
        if is_admin:
            if dept_filter and dept_filter != 'all':
                try:
                    dept_id_val = int(dept_filter)
                    dept_user_ids = set(self.env['res.users'].sudo().search([('department_id', '=', dept_id_val), ('share', '=', False)]).ids)
                    emp_user_ids = self.env['hr.employee'].sudo().search([('department_id', '=', dept_id_val), ('user_id', '!=', False)]).mapped('user_id.id')
                    dept_user_ids.update(emp_user_ids)
                    dept_user_ids.add(self.env.uid)
                    all_users = self.env['res.users'].search_read([('id', 'in', list(dept_user_ids)), ('share', '=', False)], ['id', 'name'], order='name asc')
                except (ValueError, TypeError):
                    all_users = self.env['res.users'].search_read([('share', '=', False)], ['id', 'name'], order='name asc')
            else:
                all_users = self.env['res.users'].search_read([('share', '=', False)], ['id', 'name'], order='name asc')
        elif is_manager:
            user_dept = self.env.user.department_id
            if not user_dept:
                emp = self.env['hr.employee'].sudo().search([('user_id', '=', self.env.uid)], limit=1)
                if emp and emp.department_id:
                    user_dept = emp.department_id
            target_dept_id = int(dept_filter) if (dept_filter and dept_filter != 'all') else (user_dept.id if user_dept else None)
            
            if target_dept_id:
                dept_user_ids = set(self.env['res.users'].sudo().search([('department_id', '=', target_dept_id), ('share', '=', False)]).ids)
                emp_user_ids = self.env['hr.employee'].sudo().search([('department_id', '=', target_dept_id), ('user_id', '!=', False)]).mapped('user_id.id')
                dept_user_ids.update(emp_user_ids)
                dept_user_ids.add(self.env.uid)
                all_users = self.env['res.users'].search_read([('id', 'in', list(dept_user_ids)), ('share', '=', False)], ['id', 'name'], order='name asc')
            else:
                all_users = [{'id': self.env.uid, 'name': self.env.user.name}]
        else:
            # Regular User (Employee) only sees themselves in Assignees
            all_users = [{'id': self.env.uid, 'name': self.env.user.name}]

        all_stages = self.env['project.task.type'].search_read([], ['id', 'name'], order='sequence, id asc')

        state_labels = dict(self._fields['state']._description_selection(self.env)) if 'state' in self._fields else {}

        for task in tasks:
            # 1. Department Level
            dept = task.department_id
            d_id = dept.id if dept else 0
            d_name = dept.name if dept else 'General'
            
            if d_id not in depts_dict:
                depts_dict[d_id] = {
                    'id': d_id,
                    'name': d_name,
                    'task_count': 0,
                    'overdue_count': 0,
                    'total_progress': 0.0,
                    'avg_progress': 0,
                    'tags_dict': {},
                }
                
            # 2. Tag Level
            tag = task.single_tag_id if getattr(task, 'single_tag_id', False) and task.single_tag_id else (task.tag_ids[0] if task.tag_ids else False)
            t_id = tag.id if tag else 0
            t_name = tag.name if tag else 'General'
            
            if t_id not in depts_dict[d_id]['tags_dict']:
                depts_dict[d_id]['tags_dict'][t_id] = {
                    'id': t_id,
                    'dept_id': d_id,
                    'key': f"{d_id}_{t_id}",
                    'name': t_name,
                    'task_count': 0,
                    'overdue_count': 0,
                    'total_progress': 0.0,
                    'avg_progress': 0,
                    'projects_dict': {},
                }
                
            # 3. Project Level
            proj = task.project_id
            p_id = proj.id if proj else 0
            p_name = proj.name if proj else 'General'
            
            if p_id not in depts_dict[d_id]['tags_dict'][t_id]['projects_dict']:
                depts_dict[d_id]['tags_dict'][t_id]['projects_dict'][p_id] = {
                    'id': p_id,
                    'dept_id': d_id,
                    'tag_id': t_id,
                    'key': f"{d_id}_{t_id}_{p_id}",
                    'name': p_name,
                    'task_count': 0,
                    'overdue_count': 0,
                    'total_progress': 0.0,
                    'avg_progress': 0,
                    'tasks': [],
                }

            is_done = task.is_closed or task.state in ['1_done', '1_canceled'] or getattr(task, 'task_progress', '') == '100' or getattr(task, 'task_progress_rate', 0) >= 100
            is_overdue = not is_done and task.date_deadline and task.date_deadline < today
            
            progress_val = getattr(task, 'task_progress_rate', 0.0) or 0.0
            if not progress_val and hasattr(task, 'task_progress') and task.task_progress:
                try:
                    progress_val = float(task.task_progress)
                except:
                    progress_val = 0.0
                    
            # Assignees
            assignees = []
            for user_rec in task.user_ids:
                parts = (user_rec.name or '').split()
                initials = "".join([p[0].upper() for p in parts[:2]]) if parts else "U"
                assignees.append({
                    'id': user_rec.id,
                    'name': user_rec.name,
                    'initials': initials,
                })

            # Created By user
            create_user_info = None
            if task.create_uid:
                c_parts = (task.create_uid.name or '').split()
                c_initials = "".join([p[0].upper() for p in c_parts[:2]]) if c_parts else "U"
                create_user_info = {
                    'id': task.create_uid.id,
                    'name': task.create_uid.name,
                    'initials': c_initials,
                }
                
            # Create Date formatted (e.g. 29/08/2026 16:58:49)
            formatted_create_date = ""
            if task.create_date:
                utc_dt = pytz.utc.localize(task.create_date) if task.create_date.tzinfo is None else task.create_date
                local_dt = utc_dt.astimezone(user_tz)
                formatted_create_date = local_dt.strftime("%d/%m/%Y %H:%M:%S")

            # Due date formatting (e.g. "30/08/2026")
            formatted_due = ""
            if task.date_deadline:
                formatted_due = task.date_deadline.strftime("%d/%m/%Y")
                
            # Days open (integer)
            days_open = getattr(task, 'days_open', 0)
            if not days_open and task.create_date:
                days_open = (today - task.create_date.date()).days
                
            # Subtask count
            subtask_count = getattr(task, 'subtask_count', 0)
            if not subtask_count and hasattr(task, 'child_ids'):
                subtask_count = len(task.child_ids)

            # Stage info
            stage_name = task.stage_id.name if task.stage_id else state_labels.get(task.state, task.state or 'To Do')
            
            # Priority (int 0..3)
            try:
                prio_int = int(task.priority or '0')
            except (ValueError, TypeError):
                prio_int = 0

            task_data = {
                'id': task.id,
                'name': task.name,
                'project_name': p_name,
                'tag_name': t_name,
                'dept_name': d_name,
                'priority': str(prio_int),
                'priority_int': prio_int,
                'state': task.state,
                'stage_name': stage_name,
                'stage_id': task.stage_id.id if task.stage_id else False,
                'task_progress': str(task.task_progress or int(round(progress_val))),
                'progress': int(round(progress_val)),
                'days_open': days_open if days_open is not None else 0,
                'create_date': formatted_create_date,
                'create_user': create_user_info,
                'due_date': formatted_due,
                'raw_due_date': str(task.date_deadline) if task.date_deadline else "",
                'subtask_count': subtask_count,
                'assignees': assignees,
                'is_overdue': is_overdue,
                'is_done': is_done,
                'has_discussion': bool(task.state == '05_management_discussion' or (hasattr(task, 'message_ids') and len(task.message_ids) > 0)),
            }
            
            # Add task and accumulate metrics at all 3 levels
            depts_dict[d_id]['tags_dict'][t_id]['projects_dict'][p_id]['tasks'].append(task_data)
            
            # Project metrics
            depts_dict[d_id]['tags_dict'][t_id]['projects_dict'][p_id]['task_count'] += 1
            if is_overdue:
                depts_dict[d_id]['tags_dict'][t_id]['projects_dict'][p_id]['overdue_count'] += 1
            depts_dict[d_id]['tags_dict'][t_id]['projects_dict'][p_id]['total_progress'] += progress_val

            # Tag metrics
            depts_dict[d_id]['tags_dict'][t_id]['task_count'] += 1
            if is_overdue:
                depts_dict[d_id]['tags_dict'][t_id]['overdue_count'] += 1
            depts_dict[d_id]['tags_dict'][t_id]['total_progress'] += progress_val

            # Department metrics
            depts_dict[d_id]['task_count'] += 1
            if is_overdue:
                depts_dict[d_id]['overdue_count'] += 1
            depts_dict[d_id]['total_progress'] += progress_val

        # Convert dictionaries to structured lists and compute average progress
        dept_list = []
        for d_id, d_data in depts_dict.items():
            if d_data['task_count'] > 0:
                d_data['avg_progress'] = int(round(d_data['total_progress'] / d_data['task_count']))
            else:
                d_data['avg_progress'] = 0
                
            tag_list = []
            for t_id, t_data in d_data['tags_dict'].items():
                if t_data['task_count'] > 0:
                    t_data['avg_progress'] = int(round(t_data['total_progress'] / t_data['task_count']))
                else:
                    t_data['avg_progress'] = 0
                    
                proj_list = []
                for p_id, p_data in t_data['projects_dict'].items():
                    if p_data['task_count'] > 0:
                        p_data['avg_progress'] = int(round(p_data['total_progress'] / p_data['task_count']))
                    else:
                        p_data['avg_progress'] = 0
                    proj_list.append(p_data)
                    
                t_data['projects'] = proj_list
                del t_data['projects_dict']
                tag_list.append(t_data)
                
            d_data['tags'] = tag_list
            del d_data['tags_dict']
            dept_list.append(d_data)
            
        return {
            'departments': dept_list,
            'groups': dept_list,
            'all_projects': all_projects,
            'all_departments': all_depts,
            'all_users': all_users,
            'all_stages': all_stages,
            'total_tasks': len(tasks),
            'current_user_id': uid,
        }
