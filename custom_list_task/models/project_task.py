# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError
from datetime import datetime, date, timedelta
import pytz
import logging

_logger = logging.getLogger(__name__)

AVATAR_PALETTE = [
    '#2563eb', '#16a34a', '#d97706', '#9333ea',
    '#0891b2', '#e11d48', '#4f46e5', '#059669',
    '#ca8a04', '#7c3aed', '#0284c7', '#be123c'
]


class ProjectTask(models.Model):
    _inherit = 'project.task'

    def _get_user_meta(self, user_obj):
        if not user_obj:
            return None
        name = user_obj.name or 'User'
        parts = name.split()
        initials = "".join([p[0].upper() for p in parts[:2]]) if parts else "U"
        hash_idx = sum(ord(c) for c in name) % len(AVATAR_PALETTE)
        return {
            'id': user_obj.id,
            'name': name,
            'initials': initials,
            'color': AVATAR_PALETTE[hash_idx],
            'avatar': f'/web/image/res.users/{user_obj.id}/avatar_128',
        }

    def _format_dt(self, dt_val, user_tz):
        if not dt_val:
            return {'date': '-', 'time': '', 'display': '-'}
        try:
            utc_dt = pytz.utc.localize(dt_val) if dt_val.tzinfo is None else dt_val
            local_dt = utc_dt.astimezone(user_tz)
            return {
                'date': local_dt.strftime('%d/%m/%Y'),
                'time': local_dt.strftime('%H:%M:%S'),
                'display': local_dt.strftime('%d/%m/%Y %H:%M:%S')
            }
        except Exception:
            return {
                'date': dt_val.strftime('%d/%m/%Y'),
                'time': dt_val.strftime('%H:%M:%S'),
                'display': dt_val.strftime('%d/%m/%Y %H:%M')
            }

    def _build_custom_task_domain(self, filters=None):
        if filters is None:
            filters = {}

        today = fields.Date.context_today(self)
        current_user = self.env.user
        domain = [('active', '=', True)]

        # 1. Search Query
        search_query = (filters.get('search') or '').strip()
        if search_query:
            domain.append('|')
            domain.append(('name', 'ilike', search_query))
            domain.append('|')
            domain.append(('project_id.name', 'ilike', search_query))
            domain.append(('user_ids.name', 'ilike', search_query))

        # 2. Scope (All Tasks / My Tasks)
        scope = filters.get('scope', 'all_tasks')
        if scope == 'my_tasks':
            domain.append(('user_ids', 'in', [current_user.id]))

        # 3. Status Filter
        status_filter = filters.get('status', 'all')
        if status_filter == 'uncompleted':
            domain.append(('state', 'not in', ['1_done', '1_canceled']))
        elif status_filter in ['done', 'completed']:
            domain.append(('state', 'in', ['1_done', '1_canceled']))
        elif status_filter == 'in_progress':
            domain.append(('state', 'not in', ['1_done', '1_canceled', '04_waiting_normal']))
        elif status_filter in ['overdue']:
            domain.extend([('date_deadline', '<', today), ('state', 'not in', ['1_done', '1_canceled'])])
        elif status_filter in ['today', 'due_today']:
            domain.extend([('date_deadline', '=', today), ('state', 'not in', ['1_done', '1_canceled'])])
        elif status_filter == 'due_this_week':
            domain.extend([('date_deadline', '>=', today), ('date_deadline', '<=', today + timedelta(days=7)), ('state', 'not in', ['1_done', '1_canceled'])])
        elif status_filter in ['starred', 'high_priority']:
            domain.append(('priority', 'in', ['2', '3']))
        elif status_filter == 'blocked':
            domain.append(('state', '=', '04_waiting_normal'))
        elif status_filter == 'awaiting_approval':
            domain.append(('state', 'in', ['02_changes_requested', '03_approved']))

        # 4. Project / Department / Company Filter
        if filters.get('project_id') and filters['project_id'] != 'all':
            try:
                domain.append(('project_id', '=', int(filters['project_id'])))
            except (ValueError, TypeError):
                pass

        if filters.get('department_id') and filters['department_id'] != 'all':
            try:
                domain.append(('department_id', '=', int(filters['department_id'])))
            except (ValueError, TypeError):
                pass

        if filters.get('company_id') and filters['company_id'] != 'all':
            try:
                domain.append(('company_id', '=', int(filters['company_id'])))
            except (ValueError, TypeError):
                pass

        # 5. Direct Domain Override if supplied
        if filters.get('custom_domain') and isinstance(filters['custom_domain'], list) and len(filters['custom_domain']) > 0:
            domain.extend(filters['custom_domain'])

        return domain

    def _format_custom_task_item(self, task, today, user_tz, is_admin_or_manager, current_user):
        # A task is strictly Done ONLY if its state is 1_done, or its stage is marked is_closed (and not canceled/in_progress).
        # It must NEVER be treated as done based on a progress field if state is '01_in_progress'.
        is_done = bool(
            task.state == '1_done' or
            (task.stage_id and getattr(task.stage_id, 'is_closed', False) and task.state not in ['1_canceled', '01_in_progress'])
        )
        is_canceled = bool(task.state == '1_canceled')

        STATE_META = {
            '01_in_progress': {'label': 'In Progress', 'color': '#2563eb', 'icon': 'fa-circle'},
            '02_changes_requested': {'label': 'Changes Requested', 'color': '#d97706', 'icon': 'fa-circle'},
            '03_approved': {'label': 'Approved', 'color': '#16a34a', 'icon': 'fa-circle'},
            '04_waiting_normal': {'label': 'Waiting / Blocked', 'color': '#9333ea', 'icon': 'fa-circle'},
            '05_management_discussion': {'label': 'MGMT Discussion', 'color': '#0891b2', 'icon': 'fa-circle'},
            '1_done': {'label': 'Done', 'color': '#10b981', 'icon': 'fa-check'},
            '1_canceled': {'label': 'Cancelled', 'color': '#6b7280', 'icon': 'fa-ban'},
        }
        st_meta = STATE_META.get(task.state, {'label': task.state or 'In Progress', 'color': '#2563eb', 'icon': 'fa-circle'})

        progress_val = 0
        if is_done:
            progress_val = 100
        else:
            try:
                raw_prog = int(task.task_progress or '0') if hasattr(task, 'task_progress') else 0
                progress_val = raw_prog
            except (ValueError, TypeError):
                progress_val = 0

        subtitle_parts = []
        if task.department_id:
            subtitle_parts.append(task.department_id.name)
        elif task.project_id:
            subtitle_parts.append(task.project_id.name)
        if task.parent_id:
            subtitle_parts.append(f"Sub of: {task.parent_id.name}")
        subtitle = " • ".join(subtitle_parts) if subtitle_parts else (task.project_id.name if task.project_id else 'Task')

        next_act = '-'
        if hasattr(task, 'activity_ids') and task.activity_ids:
            act = task.activity_ids.sorted(key=lambda a: a.date_deadline or date.max)[0]
            next_act = act.summary or act.activity_type_id.name or 'Activity'

        tags_list = []
        if hasattr(task, 'single_tag_id') and task.single_tag_id:
            tags_list.append({'id': task.single_tag_id.id, 'name': task.single_tag_id.name})
        elif hasattr(task, 'tag_ids') and task.tag_ids:
            for tg in task.tag_ids:
                tags_list.append({'id': tg.id, 'name': tg.name})

        sub_count = task.subtask_count if hasattr(task, 'subtask_count') else len(task.child_ids)
        last_up_dt = getattr(task, 'last_user_update_date', None) or task.write_date or task.create_date
        last_up_info = self._format_dt(last_up_dt, user_tz)

        deadline_str = task.date_deadline.strftime('%d/%m/%Y') if task.date_deadline else '-'
        is_overdue = bool(not is_done and task.date_deadline and task.date_deadline < today)

        creator_meta = self._get_user_meta(task.create_uid) if task.create_uid else None
        assignees_meta = [self._get_user_meta(u) for u in task.user_ids] if task.user_ids else []
        can_delete = bool(is_admin_or_manager or (task.create_uid and task.create_uid.id == current_user.id))

        tag_id_val = 0
        tag_name_val = 'Untagged'
        if getattr(task, 'single_tag_id', False):
            tag_id_val = task.single_tag_id.id
            tag_name_val = task.single_tag_id.name
        elif task.tag_ids:
            tag_id_val = task.tag_ids[0].id
            tag_name_val = task.tag_ids[0].name

        return {
            'id': task.id,
            'name': task.name or 'Untitled Task',
            'subtitle': subtitle,
            'priority': task.priority or '0',
            'is_starred': task.priority in ['1', '2', '3'],
            'is_done': is_done,
            'is_canceled': is_canceled,
            'state': task.state or '01_in_progress',
            'state_label': st_meta['label'],
            'state_color': st_meta['color'],
            'state_icon': st_meta['icon'],
            'stage_id': task.stage_id.id if task.stage_id else 0,
            'stage_name': task.stage_id.name if task.stage_id else 'To Do',
            'project_id': task.project_id.id if task.project_id else 0,
            'project_name': task.project_id.name if task.project_id else 'No Project',
            'tag_id': tag_id_val,
            'tag_name': tag_name_val,
            'department_id': task.department_id.id if task.department_id else 0,
            'department_name': task.department_id.name if task.department_id else 'General',
            'last_updated_date': last_up_info['date'],
            'last_updated_time': last_up_info['time'],
            'last_updated_display': last_up_info['display'],
            'create_user': creator_meta,
            'assignees': assignees_meta,
            'progress': progress_val,
            'task_progress': str(task.task_progress or progress_val if hasattr(task, 'task_progress') else progress_val),
            'days_open': task.days_open if hasattr(task, 'days_open') else 0,
            'date_deadline': deadline_str,
            'is_overdue': is_overdue,
            'next_activity': next_act,
            'subtasks_count': sub_count,
            'tags': tags_list,
            'can_delete_task': can_delete,
        }

    @api.model
    def get_custom_list_task_data(self, filters=None):
        """Fetch tasks formatted specifically for the modern Custom List Task UI.
        Uses lightning-fast SQL read_group for hierarchies, avoiding client-side overload.
        """
        if filters is None:
            filters = {}

        current_user = self.env.user
        is_admin_or_manager = bool(
            self.env.is_admin() or
            current_user.has_group('base.group_system') or
            current_user.has_group('base.group_erp_manager') or
            current_user.has_group('project.group_project_manager') or
            current_user.has_group('custom_project.group_project_manager_custom')
        )

        domain = self._build_custom_task_domain(filters)
        total_count = self.search_count(domain)
        group_by_field = filters.get('group_by', 'tag_project_stage')

        tag_tree = []
        grouped_sections = []
        flat_tasks = []

        if group_by_field == 'tag_project_stage':
            # Fast aggregation using _read_group in ~25ms
            res = self._read_group(
                domain,
                groupby=['single_tag_id', 'project_id', 'stage_id'],
                aggregates=['__count']
            )
            tag_dict = {}
            for tag_rec, proj_rec, stage_rec, count in res:
                tag_id = tag_rec.id if tag_rec else 0
                tag_name = tag_rec.name if tag_rec else 'Untagged'
                proj_id = proj_rec.id if proj_rec else 0
                proj_name = proj_rec.name if proj_rec else 'No Project'
                stage_id = stage_rec.id if stage_rec else 0
                stage_name = stage_rec.name if stage_rec else 'To Do'

                if tag_id not in tag_dict:
                    tag_dict[tag_id] = {
                        'id': tag_id,
                        'name': tag_name,
                        'count': 0,
                        'projects': {},
                    }
                tag_dict[tag_id]['count'] += count

                if proj_id not in tag_dict[tag_id]['projects']:
                    tag_dict[tag_id]['projects'][proj_id] = {
                        'id': proj_id,
                        'name': proj_name,
                        'count': 0,
                        'stages': {},
                        'tasks': [],
                        'loaded': False,
                        'loading': False,
                    }
                tag_dict[tag_id]['projects'][proj_id]['count'] += count

                if stage_id not in tag_dict[tag_id]['projects'][proj_id]['stages']:
                    tag_dict[tag_id]['projects'][proj_id]['stages'][stage_id] = {
                        'id': stage_id,
                        'name': stage_name,
                        'count': 0,
                        'tasks': [],
                    }
                tag_dict[tag_id]['projects'][proj_id]['stages'][stage_id]['count'] += count

            for t_id, t_data in sorted(tag_dict.items(), key=lambda x: (x[1]['name'] == 'Untagged', x[1]['name'].lower())):
                proj_list = []
                for p_id, p_data in sorted(t_data['projects'].items(), key=lambda x: x[1]['name'].lower()):
                    stage_list = []
                    for s_id, s_data in sorted(p_data['stages'].items(), key=lambda x: x[1]['name'].lower()):
                        stage_list.append({
                            'id': s_id,
                            'name': s_data['name'],
                            'count': s_data['count'],
                            'tasks': [],
                        })
                    proj_list.append({
                        'id': p_id,
                        'name': p_data['name'],
                        'count': p_data['count'],
                        'stages': stage_list,
                        'tasks': [],
                        'loaded': False,
                        'loading': False,
                    })
                tag_tree.append({
                    'id': t_id,
                    'name': t_data['name'],
                    'count': t_data['count'],
                    'projects': proj_list,
                })

        elif group_by_field in ['project_id', 'department_id', 'stage_id']:
            field_name = group_by_field
            res = self._read_group(domain, groupby=[field_name], aggregates=['__count'])
            icon_map = {
                'project_id': 'fa fa-folder text-primary',
                'department_id': 'fa fa-building-o text-primary',
                'stage_id': 'fa fa-circle text-primary',
            }
            default_name_map = {
                'project_id': 'No Project',
                'department_id': 'General',
                'stage_id': 'To Do',
            }
            sections = []
            for rec, count in res:
                r_id = rec.id if rec else 0
                r_name = rec.name if rec else default_name_map.get(field_name, 'Other')
                sections.append({
                    'id': r_id,
                    'name': r_name,
                    'count': count,
                    'icon': icon_map.get(field_name, 'fa fa-folder text-primary'),
                    'tasks': [],
                    'loaded': False,
                    'loading': False,
                })
            grouped_sections = sorted(sections, key=lambda x: (x['id'] == 0, x['name'].lower()))

        else:
            # group_by == 'none': Paginated flat list (first 50 tasks)
            today = fields.Date.context_today(self)
            user_tz_name = self.env.user.tz or 'Asia/Kolkata'
            try:
                user_tz = pytz.timezone(user_tz_name)
            except Exception:
                user_tz = pytz.timezone('UTC')

            tasks = self.search(domain, order='id desc', limit=50)
            task_items = [self._format_custom_task_item(t, today, user_tz, is_admin_or_manager, current_user) for t in tasks]
            flat_tasks = task_items
            grouped_sections = [{
                'id': 'all',
                'name': 'All Tasks',
                'count': total_count,
                'icon': 'fa fa-tasks text-primary',
                'tasks': task_items,
                'loaded': True,
                'loading': False,
            }]

        # Dropdown metadata (lightweight search_read)
        all_projects = self.env['project.project'].search_read([('active', '=', True)], ['id', 'name'], order='name asc')
        all_departments = self.env['hr.department'].search_read([], ['id', 'name'], order='name asc')
        all_users_rec = self.env['res.users'].sudo().search([('share', '=', False), ('active', '=', True)], order='name asc')
        all_users = [self._get_user_meta(u) for u in all_users_rec]

        return {
            'tag_tree': tag_tree,
            'grouped_sections': grouped_sections,
            'flat_tasks': flat_tasks,
            'group_by': group_by_field,
            'total_tasks': total_count,
            'projects': all_projects,
            'departments': all_departments,
            'users': all_users,
            'is_admin_or_manager': is_admin_or_manager,
            'current_user_id': current_user.id,
        }

    @api.model
    def get_custom_list_project_tasks(self, tag_id, project_id, filters=None):
        """Lazy load tasks for a specific tag and project on accordion expand.
        Returns a dictionary mapping stage_id -> list of formatted tasks.
        """
        if filters is None:
            filters = {}

        today = fields.Date.context_today(self)
        user_tz_name = self.env.user.tz or 'Asia/Kolkata'
        try:
            user_tz = pytz.timezone(user_tz_name)
        except Exception:
            user_tz = pytz.timezone('UTC')

        current_user = self.env.user
        is_admin_or_manager = bool(
            self.env.is_admin() or
            current_user.has_group('base.group_system') or
            current_user.has_group('base.group_erp_manager') or
            current_user.has_group('project.group_project_manager') or
            current_user.has_group('custom_project.group_project_manager_custom')
        )

        domain = self._build_custom_task_domain(filters)

        # Append tag and project constraints
        tag_id_int = int(tag_id) if tag_id and str(tag_id).isdigit() else 0
        if tag_id_int > 0:
            domain.append(('single_tag_id', '=', tag_id_int))
        elif tag_id == 0 or tag_id == '0':
            domain.append(('single_tag_id', '=', False))

        proj_id_int = int(project_id) if project_id and str(project_id).isdigit() else 0
        if proj_id_int > 0:
            domain.append(('project_id', '=', proj_id_int))
        elif project_id == 0 or project_id == '0':
            domain.append(('project_id', '=', False))

        tasks = self.search(domain, order='id desc', limit=500)
        stages_tasks_map = {}
        for task in tasks:
            sid = task.stage_id.id if task.stage_id else 0
            if sid not in stages_tasks_map:
                stages_tasks_map[sid] = []
            stages_tasks_map[sid].append(
                self._format_custom_task_item(task, today, user_tz, is_admin_or_manager, current_user)
            )

        result = {}
        for sid, t_list in stages_tasks_map.items():
            result[sid] = t_list
            result[str(sid)] = t_list

        return result

    @api.model
    def get_custom_list_section_tasks(self, group_by_field, group_id, filters=None):
        """Lazy load tasks for a specific section (Project, Department, Stage)."""
        if filters is None:
            filters = {}

        today = fields.Date.context_today(self)
        user_tz_name = self.env.user.tz or 'Asia/Kolkata'
        try:
            user_tz = pytz.timezone(user_tz_name)
        except Exception:
            user_tz = pytz.timezone('UTC')

        current_user = self.env.user
        is_admin_or_manager = bool(
            self.env.is_admin() or
            current_user.has_group('base.group_system') or
            current_user.has_group('base.group_erp_manager') or
            current_user.has_group('project.group_project_manager') or
            current_user.has_group('custom_project.group_project_manager_custom')
        )

        domain = self._build_custom_task_domain(filters)

        if group_by_field in ['project_id', 'department_id', 'stage_id']:
            gid_int = int(group_id) if group_id and str(group_id).isdigit() else 0
            if gid_int > 0:
                domain.append((group_by_field, '=', gid_int))
            elif group_id == 0 or group_id == '0':
                domain.append((group_by_field, '=', False))

        tasks = self.search(domain, order='id desc', limit=500)
        return [self._format_custom_task_item(t, today, user_tz, is_admin_or_manager, current_user) for t in tasks]

    @api.model
    def toggle_task_priority(self, task_id):
        """Toggle star priority between 0 and 1."""
        task = self.browse(int(task_id))
        if task.exists():
            new_prio = '0' if task.priority == '1' else '1'
            task.write({'priority': new_prio})
            return {'success': True, 'priority': new_prio}
        return {'error': 'Task not found'}

    @api.model
    def quick_add_assignee(self, task_id, user_id):
        """Add an assignee to the task."""
        task = self.browse(int(task_id))
        user = self.env['res.users'].browse(int(user_id))
        if task.exists() and user.exists():
            if user not in task.user_ids:
                task.write({'user_ids': [(4, user.id)]})
            return {'success': True}
        return {'error': 'Failed to add assignee'}

    @api.model
    def update_task_progress(self, task_id, progress_val):
        """Update progress dropdown for a task."""
        task = self.browse(int(task_id))
        if task.exists():
            val_str = str(progress_val)
            task.write({'task_progress': val_str})
            return {'success': True, 'progress': int(val_str), 'task_progress': val_str}
        return {'error': 'Task not found'}
