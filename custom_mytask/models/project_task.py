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
            
        # Candidate fields to fetch in a single fast SQL query
        candidate_fields = [
            'id', 'name', 'project_id', 'single_tag_id', 'tag_ids', 'department_id',
            'priority', 'state', 'stage_id', 'task_progress', 'task_progress_rate',
            'date_deadline', 'create_date', 'create_uid', 'user_ids', 'is_closed', 'child_ids'
        ]
        task_fields = [f for f in candidate_fields if f in self._fields]

        tasks = self.search_read(
            domain,
            task_fields,
            order="department_id, single_tag_id, project_id, date_deadline asc, id desc"
        )
        
        # Timezone for date formatting
        import pytz
        user_tz_name = self.env.user.tz or 'UTC'
        try:
            user_tz = pytz.timezone(user_tz_name)
        except Exception:
            user_tz = pytz.utc

        # Pre-fetch all user info in a single batch query
        all_user_ids = set()
        for t in tasks:
            for uid in (t.get('user_ids') or []):
                all_user_ids.add(uid)
            c_uid = t.get('create_uid')
            if c_uid:
                all_user_ids.add(c_uid[0])

        user_map = {}
        if all_user_ids:
            u_records = self.env['res.users'].sudo().search_read([('id', 'in', list(all_user_ids))], ['id', 'name'])
            for u in u_records:
                u_name = u.get('name') or 'User'
                parts = u_name.split()
                initials = "".join([p[0].upper() for p in parts[:2]]) if parts else "U"
                user_map[u['id']] = {
                    'id': u['id'],
                    'name': u_name,
                    'initials': initials,
                }

        # Build 3-level Hierarchy: Department -> Tag -> Project -> Tasks
        depts_dict = {}
        
        all_projects = self.env['project.project'].search_read([('active', '=', True)], ['id', 'name'], order='name asc')
        
        # Determine user department
        user_dept = self.env.user.department_id if hasattr(self.env.user, 'department_id') and self.env.user.department_id else False
        if not user_dept:
            emp = self.env['hr.employee'].sudo().search([('user_id', '=', self.env.uid)], limit=1)
            if emp and emp.department_id:
                user_dept = emp.department_id

        # Department list based on role
        if is_admin:
            all_depts = self.env['hr.department'].search_read([], ['id', 'name'], order='name asc')
        elif user_dept:
            all_depts = self.env['hr.department'].search_read([('id', '=', user_dept.id)], ['id', 'name'], order='name asc')
        else:
            all_depts = []
        
        # Configure user list based on role
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
            all_users = [{'id': self.env.uid, 'name': self.env.user.name}]

        all_stages = self.env['project.task.type'].search_read([], ['id', 'name'], order='sequence, id asc')
        stage_map = {st['id']: st['name'] for st in all_stages}

        state_labels = dict(self._fields['state']._description_selection(self.env)) if 'state' in self._fields else {}

        for task in tasks:
            # 1. Department Level
            dept_tuple = task.get('department_id')
            d_id = dept_tuple[0] if dept_tuple else 0
            d_name = dept_tuple[1] if dept_tuple else 'General'
            
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
            single_tag = task.get('single_tag_id')
            tag_ids = task.get('tag_ids')
            if single_tag:
                t_id = single_tag[0]
                t_name = single_tag[1]
            elif tag_ids and len(tag_ids) > 0:
                t_id = tag_ids[0]
                t_name = 'General'
            else:
                t_id = 0
                t_name = 'General'
            
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
            proj_tuple = task.get('project_id')
            p_id = proj_tuple[0] if proj_tuple else 0
            p_name = proj_tuple[1] if proj_tuple else 'General'
            
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

            task_state = task.get('state') or ''
            task_is_closed = task.get('is_closed') or False
            task_prog_rate = task.get('task_progress_rate') or 0.0
            task_prog_str = task.get('task_progress') or ''

            is_done = task_is_closed or task_state in ['1_done', '1_canceled'] or str(task_prog_str).strip() == '100' or task_prog_rate >= 100
            
            date_dd = task.get('date_deadline')
            if date_dd:
                dd_val = date_dd if isinstance(date_dd, (date, datetime)) else datetime.strptime(str(date_dd)[:10], '%Y-%m-%d').date()
                if isinstance(dd_val, datetime):
                    dd_val = dd_val.date()
                is_overdue = not is_done and dd_val < today
                formatted_due = dd_val.strftime("%d/%m/%Y")
                raw_due = dd_val.strftime("%Y-%m-%d")
            else:
                is_overdue = False
                formatted_due = ""
                raw_due = ""
            
            progress_val = task_prog_rate
            if not progress_val and task_prog_str:
                try:
                    progress_val = float(task_prog_str)
                except Exception:
                    progress_val = 0.0
                    
            # Assignees from batch user_map
            assignees = []
            for u_id in (task.get('user_ids') or []):
                if u_id in user_map:
                    assignees.append(user_map[u_id])
                else:
                    assignees.append({'id': u_id, 'name': 'User', 'initials': 'U'})

            # Created By user
            create_uid_tuple = task.get('create_uid')
            create_user_info = None
            if create_uid_tuple and create_uid_tuple[0] in user_map:
                create_user_info = user_map[create_uid_tuple[0]]
            elif create_uid_tuple:
                c_name = create_uid_tuple[1]
                c_parts = c_name.split()
                create_user_info = {
                    'id': create_uid_tuple[0],
                    'name': c_name,
                    'initials': "".join([p[0].upper() for p in c_parts[:2]]) if c_parts else "U",
                }
                
            # Create Date formatted
            create_dt_val = task.get('create_date')
            formatted_create_date = ""
            days_open = 0
            if create_dt_val:
                if isinstance(create_dt_val, str):
                    try:
                        create_dt_val = datetime.strptime(create_dt_val[:19], '%Y-%m-%d %H:%M:%S')
                    except Exception:
                        create_dt_val = None
                if create_dt_val:
                    utc_dt = pytz.utc.localize(create_dt_val) if create_dt_val.tzinfo is None else create_dt_val
                    local_dt = utc_dt.astimezone(user_tz)
                    formatted_create_date = local_dt.strftime("%d/%m/%Y %H:%M:%S")
                    days_open = (today - create_dt_val.date()).days
                
            # Subtask count from child_ids list (zero SQL queries!)
            subtask_count = len(task.get('child_ids') or [])

            # Stage info
            stage_tuple = task.get('stage_id')
            if stage_tuple:
                stage_name = stage_tuple[1]
                stage_id_val = stage_tuple[0]
            else:
                stage_name = state_labels.get(task_state, task_state or 'To Do')
                stage_id_val = False
            
            # Priority (int 0..3)
            try:
                prio_int = int(task.get('priority') or '0')
            except (ValueError, TypeError):
                prio_int = 0

            task_data = {
                'id': task['id'],
                'name': task.get('name') or '',
                'project_name': p_name,
                'tag_name': t_name,
                'dept_name': d_name,
                'priority': str(prio_int),
                'priority_int': prio_int,
                'state': task_state,
                'stage_name': stage_name,
                'stage_id': stage_id_val,
                'task_progress': str(task_prog_str or int(round(progress_val))),
                'progress': int(round(progress_val)),
                'days_open': max(0, days_open),
                'create_date': formatted_create_date,
                'create_user': create_user_info,
                'due_date': formatted_due,
                'raw_due_date': raw_due,
                'subtask_count': subtask_count,
                'assignees': assignees,
                'is_overdue': is_overdue,
                'is_done': is_done,
                'has_discussion': bool(task_state == '05_management_discussion'),
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
