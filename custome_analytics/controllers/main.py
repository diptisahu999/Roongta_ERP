# -*- coding: utf-8 -*-
from odoo import http, fields
from odoo.http import request
from datetime import date, timedelta, datetime, time
import calendar
import json
import pytz


class CustomeAnalyticsController(http.Controller):

    def _is_done_dict(self, task, stage_name_map, stage_fold_map):
        if not task:
            return False
        st = task.get('state') or ''
        if st == '1_canceled':
            return False
        if st == '1_done':
            return True
        if task.get('is_closed'):
            return True
        stage_id = task.get('stage_id')
        if stage_id:
            s_id = stage_id[0] if isinstance(stage_id, (list, tuple)) else stage_id
            st_name = stage_name_map.get(s_id, '').lower()
            if st_name in ['done', 'completed', 'task completed', 'task complete', 'work done', 'pass', "md's approval done", 'complate']:
                return True
            if stage_fold_map.get(s_id) and not any(w in st_name for w in ['cancel', 'fail', 'hold', 'pending']):
                return True
        return False

    def _is_hold_dict(self, task, stage_name_map):
        if not task:
            return False
        st = task.get('state') or ''
        if st in ['04_waiting_normal', '02_changes_requested', '05_management_discussion']:
            return True
        stage_id = task.get('stage_id')
        if stage_id:
            s_id = stage_id[0] if isinstance(stage_id, (list, tuple)) else stage_id
            st_name = stage_name_map.get(s_id, '').lower()
            if any(w in st_name for w in ['hold', 'on hold', 'on_hold', 'blocked', 'block']):
                return True
        return False

    def _is_overdue_dict(self, task, is_done, today_date):
        if not task or is_done or task.get('state') == '1_canceled':
            return False
        dd = task.get('date_deadline')
        if dd:
            if isinstance(dd, str):
                try:
                    dd_date = datetime.strptime(dd[:10], '%Y-%m-%d').date()
                except Exception:
                    return False
            elif isinstance(dd, datetime):
                dd_date = dd.date()
            elif isinstance(dd, date):
                dd_date = dd
            else:
                return False
            return dd_date < today_date
        return False

    def _parse_date(self, val):
        if not val:
            return None
        if isinstance(val, date) and not isinstance(val, datetime):
            return val
        if isinstance(val, datetime):
            return val.date()
        if isinstance(val, str):
            try:
                return datetime.strptime(val[:10], '%Y-%m-%d').date()
            except Exception:
                return None
        return None

    @http.route('/custome_analytics/data', type='json', auth='user')
    def get_analytics_data(self, **kwargs):
        env = request.env
        today = date.today()
        curr_user = env.user
        
        # Filter parameters
        company_id = kwargs.get('company_id', 'all')
        dept_id = kwargs.get('department_id', 'all')
        emp_id = kwargs.get('employee_id', 'all')
        project_id = kwargs.get('project_id', 'all')
        custom_view = kwargs.get('custom_view', 'all')
        date_range = kwargs.get('date_range', 'all')
        date_from = kwargs.get('date_from')
        date_to = kwargs.get('date_to')
        time_granularity = kwargs.get('time_granularity', 'weekly')

        # Calculate date range
        if date_from and date_to:
            try:
                start_date = datetime.strptime(date_from, '%Y-%m-%d').date()
                end_date = datetime.strptime(date_to, '%Y-%m-%d').date()
            except Exception:
                start_date = None
                end_date = None
            if start_date and end_date:
                duration = max((end_date - start_date).days + 1, 1)
                prev_end_date = start_date - timedelta(days=1)
                prev_start_date = prev_end_date - timedelta(days=duration - 1)
            else:
                prev_start_date = None
                prev_end_date = None
        elif date_range == 'this_month':
            start_date = today.replace(day=1)
            _, last_day = calendar.monthrange(today.year, today.month)
            end_date = today.replace(day=last_day)
            prev_end_date = start_date - timedelta(days=1)
            prev_start_date = prev_end_date.replace(day=1)
        elif date_range == 'last_month':
            first_of_this_month = today.replace(day=1)
            end_date = first_of_this_month - timedelta(days=1)
            start_date = end_date.replace(day=1)
            prev_end_date = start_date - timedelta(days=1)
            prev_start_date = prev_end_date.replace(day=1)
        elif date_range == '7d':
            start_date = today - timedelta(days=7)
            end_date = today
            prev_end_date = start_date - timedelta(days=1)
            prev_start_date = prev_end_date - timedelta(days=7)
        elif date_range == '30d':
            start_date = today - timedelta(days=30)
            end_date = today
            prev_end_date = start_date - timedelta(days=1)
            prev_start_date = prev_end_date - timedelta(days=30)
        elif date_range == '90d':
            start_date = today - timedelta(days=90)
            end_date = today
            prev_end_date = start_date - timedelta(days=1)
            prev_start_date = prev_end_date - timedelta(days=90)
        elif date_range == 'this_year':
            start_date = today.replace(month=1, day=1)
            end_date = today.replace(month=12, day=31)
            prev_start_date = start_date.replace(year=start_date.year - 1)
            prev_end_date = end_date.replace(year=end_date.year - 1)
        elif date_range == 'all':
            start_date = None
            end_date = None
            prev_start_date = None
            prev_end_date = None
        else:
            start_date = None
            end_date = None
            prev_start_date = None
            prev_end_date = None

        # Determine user department
        user_dept_id = None
        if hasattr(curr_user, 'department_id') and curr_user.department_id:
            user_dept_id = curr_user.department_id.id
        elif 'hr.employee' in env:
            emp = env['hr.employee'].sudo().search([('user_id', '=', curr_user.id)], limit=1)
            if emp and emp.department_id:
                user_dept_id = emp.department_id.id

        is_admin_or_manager = (
            curr_user.has_group('base.group_system') or 
            curr_user.has_group('project.group_project_manager') or 
            curr_user.has_group('custom_project.group_project_manager_custom')
        )

        # Base filter domain: Odoo's native record rules handle task access
        base_domain = []

        # Company / Firm filter
        c_id = None
        if company_id and company_id != 'all':
            if str(company_id).isdigit():
                c_id = int(company_id)
            elif 'project.firm' in env:
                c_rec = env['project.firm'].sudo().search([('name', '=ilike', str(company_id))], limit=1)
                if c_rec:
                    c_id = c_rec.id
            if c_id and 'project.firm' in env:
                firm = env['project.firm'].sudo().browse(c_id)
                if firm.exists() and firm.tag_ids:
                    t_ids = firm.tag_ids.ids
                    base_domain += ['|', ('tag_ids', 'in', t_ids), ('project_id.tag_ids', 'in', t_ids)]

        # Department filter
        d_id = None
        if not is_admin_or_manager and user_dept_id:
            d_id = user_dept_id
            base_domain += ['|', ('department_id', '=', d_id), ('project_id.department_id', '=', d_id)]
        elif dept_id and dept_id != 'all':
            if str(dept_id).isdigit():
                d_id = int(dept_id)
            elif 'hr.department' in env:
                d_rec = env['hr.department'].sudo().search([('name', '=ilike', str(dept_id))], limit=1)
                if d_rec:
                    d_id = d_rec.id
            if d_id:
                base_domain += ['|', ('department_id', '=', d_id), ('project_id.department_id', '=', d_id)]

        # Employee filter
        e_id = None
        if emp_id and emp_id != 'all':
            if str(emp_id).isdigit():
                e_id = int(emp_id)
            else:
                u_rec = env['res.users'].sudo().search([('name', '=ilike', str(emp_id))], limit=1)
                if u_rec:
                    e_id = u_rec.id
            if e_id:
                base_domain.append(('user_ids', 'in', [e_id]))

        # Project filter
        p_id = None
        if project_id and project_id != 'all':
            if str(project_id).isdigit():
                p_id = int(project_id)
            else:
                p_rec = env['project.project'].sudo().search([('name', '=ilike', str(project_id))], limit=1)
                if p_rec:
                    p_id = p_rec.id
            if p_id:
                base_domain.append(('project_id', '=', p_id))

        # Quick views
        if custom_view == 'my_tasks':
            base_domain.append(('user_ids', 'in', [curr_user.id]))
        elif custom_view == 'high_priority':
            base_domain.append(('priority', 'in', ['2', '3']))
        elif custom_view == 'blocked':
            base_domain += ['|', '|', ('stage_id.name', 'ilike', 'hold'), ('stage_id.name', 'ilike', 'block'), ('state', 'in', ['02_changes_requested', '05_management_discussion'])]
        elif custom_view == 'overdue':
            base_domain += [('state', '!=', '1_done'), ('date_deadline', '<', today)]

        # Batch prefetch references in single fast queries
        all_stages = env['project.task.type'].sudo().search_read([], ['id', 'name', 'fold'])
        stage_name_map = {s['id']: (s['name'] or '').strip() for s in all_stages}
        stage_fold_map = {s['id']: s['fold'] for s in all_stages}

        user_records = env['res.users'].sudo().search_read([('share', '=', False), ('id', '!=', 1)], ['id', 'name'], order='name asc', limit=200)
        user_name_map = {u['id']: u['name'] for u in user_records}

        user_dept_map = {}
        if 'hr.employee' in env:
            emp_records = env['hr.employee'].sudo().search_read([('user_id', '!=', False), ('department_id', '!=', False)], ['user_id', 'department_id'])
            for emp in emp_records:
                if emp.get('user_id') and emp.get('department_id'):
                    user_dept_map[emp['user_id'][0]] = emp['department_id']

        proj_dept_map = {}
        proj_dept_records = env['project.project'].sudo().search_read([('department_id', '!=', False)], ['id', 'department_id'])
        for pr in proj_dept_records:
            if pr.get('department_id'):
                proj_dept_map[pr['id']] = pr['department_id']

        # Fetch current period tasks using search_read
        curr_domain = list(base_domain)
        if start_date:
            curr_domain.append(('create_date', '>=', datetime.combine(start_date, time.min)))
        if end_date:
            curr_domain.append(('create_date', '<=', datetime.combine(end_date, time.max)))

        read_fields = [
            'id', 'name', 'stage_id', 'state', 'is_closed', 'priority',
            'date_deadline', 'date_last_stage_update', 'write_date', 'create_date',
            'department_id', 'project_id', 'user_ids', 'task_performance'
        ]
        if 'task_progress' in env['project.task']._fields:
            read_fields.append('task_progress')

        tasks = env['project.task'].search_read(curr_domain, read_fields, order='date_deadline asc, create_date desc')

        # Comparative period metrics
        prev_tasks_count = 0
        prev_completed_count = 0
        prev_on_time_completed_count = 0
        prev_late_completed_count = 0
        prev_overdue_count = 0
        prev_blocked_count = 0
        prev_tasks = []

        if prev_start_date and prev_end_date:
            prev_domain = list(base_domain)
            prev_domain.append(('create_date', '>=', datetime.combine(prev_start_date, time.min)))
            prev_domain.append(('create_date', '<=', datetime.combine(prev_end_date, time.max)))
            prev_tasks = env['project.task'].search_read(prev_domain, ['id', 'stage_id', 'state', 'is_closed', 'date_deadline', 'date_last_stage_update', 'write_date', 'task_performance'])
            prev_tasks_count = len(prev_tasks)

        if prev_tasks:
            for pt in prev_tasks:
                pt_done = self._is_done_dict(pt, stage_name_map, stage_fold_map)
                pt_overdue = self._is_overdue_dict(pt, pt_done, today)
                pt_blocked = self._is_hold_dict(pt, stage_name_map)
                if pt_done:
                    prev_completed_count += 1
                    pt_perf = pt.get('task_performance')
                    if pt_perf == '1_on_time':
                        prev_on_time_completed_count += 1
                    elif pt_perf == '2_late':
                        prev_late_completed_count += 1
                    else:
                        pt_date = self._parse_date(pt.get('date_deadline'))
                        if not pt_date:
                            prev_on_time_completed_count += 1
                        else:
                            pt_comp_d = self._parse_date(pt.get('date_last_stage_update') or pt.get('write_date'))
                            if pt_comp_d and pt_comp_d <= pt_date:
                                prev_on_time_completed_count += 1
                            else:
                                prev_late_completed_count += 1
                if pt_overdue:
                    prev_overdue_count += 1
                if pt_blocked:
                    prev_blocked_count += 1

        # Process current period tasks
        total_tasks = 0
        completed_tasks = 0
        in_progress_tasks = 0
        pending_tasks = 0
        overdue_tasks = 0
        blocked_tasks = 0
        cancelled_tasks = 0
        on_time_completed = 0
        late_completed = 0

        task_ids_map = {
            'total': [],
            'completed': [],
            'completed_on_time': [],
            'completed_late': [],
            'in_progress': [],
            'pending': [],
            'overdue': [],
            'blocked': [],
            'cancelled': []
        }

        priority_distribution = {
            'high': 0,
            'medium': 0,
            'low': 0
        }

        dept_stats = {}
        assignee_stats = {}
        project_stats = {}

        # Define 5 intervals for sparklines and time series
        num_intervals = 5
        if start_date and end_date:
            total_days = max((end_date - start_date).days, 1)
            interval_step = max(total_days // num_intervals, 1)
            time_buckets = []
            for i in range(num_intervals):
                b_start = start_date + timedelta(days=i * interval_step)
                if i == num_intervals - 1:
                    b_end = end_date
                else:
                    b_end = start_date + timedelta(days=(i + 1) * interval_step - 1)
                b_label = f"{b_start.strftime('%d %b')}"
                time_buckets.append({
                    'start': b_start,
                    'end': b_end,
                    'label': b_label,
                    'full_label': f"{b_start.strftime('%d %b')} - {b_end.strftime('%d %b')}",
                    'created': 0,
                    'completed': 0,
                    'on_time': 0,
                    'late': 0,
                    'overdue': 0,
                    'blocked': 0
                })
        else:
            time_buckets = []
            for i in range(num_intervals - 1, -1, -1):
                b_end = today - timedelta(days=i * 7)
                b_start = b_end - timedelta(days=6)
                time_buckets.append({
                    'start': b_start,
                    'end': b_end,
                    'label': b_start.strftime('%d %b'),
                    'full_label': f"{b_start.strftime('%d %b')} - {b_end.strftime('%d %b')}",
                    'created': 0,
                    'completed': 0,
                    'on_time': 0,
                    'late': 0,
                    'overdue': 0,
                    'blocked': 0
                })

        for task in tasks:
            t_id = task['id']
            stage_id = task.get('stage_id')
            s_id = stage_id[0] if isinstance(stage_id, (list, tuple)) else stage_id
            st_name = stage_name_map.get(s_id, '').lower() if s_id else ''

            is_done = self._is_done_dict(task, stage_name_map, stage_fold_map)
            is_cancelled = (task.get('state') == '1_canceled' or 'cancel' in st_name)
            is_blocked = self._is_hold_dict(task, stage_name_map)
            task_date = self._parse_date(task.get('date_deadline'))
            is_overdue = self._is_overdue_dict(task, is_done, today)

            total_tasks += 1
            task_ids_map['total'].append(t_id)

            if is_done:
                completed_tasks += 1
                task_ids_map['completed'].append(t_id)
            elif is_cancelled:
                cancelled_tasks += 1
                task_ids_map['cancelled'].append(t_id)
            elif is_blocked:
                blocked_tasks += 1
                task_ids_map['blocked'].append(t_id)
            elif st_name in ['to do', 'to-do', 'new', 'open', 'activities still not started', 'task assigned'] and str(task.get('task_progress', '0')) == '0':
                pending_tasks += 1
                task_ids_map['pending'].append(t_id)
            else:
                in_progress_tasks += 1
                task_ids_map['in_progress'].append(t_id)

            if is_overdue:
                overdue_tasks += 1
                task_ids_map['overdue'].append(t_id)

            # Priority
            p_val = str(task.get('priority') or '0')
            if p_val in ['2', '3']:
                priority_distribution['high'] += 1
            elif p_val == '1':
                priority_distribution['medium'] += 1
            else:
                priority_distribution['low'] += 1

            # On-time calculation
            is_on_time = False
            if is_done:
                task_perf = task.get('task_performance')
                if task_perf == '1_on_time':
                    is_on_time = True
                elif task_perf == '2_late':
                    is_on_time = False
                elif not task_date:
                    is_on_time = True
                else:
                    comp_dt = self._parse_date(task.get('date_last_stage_update') or task.get('write_date'))
                    if comp_dt:
                        is_on_time = (comp_dt <= task_date)
                    else:
                        is_on_time = True

                if is_on_time:
                    on_time_completed += 1
                    task_ids_map['completed_on_time'].append(t_id)
                else:
                    late_completed += 1
                    task_ids_map['completed_late'].append(t_id)

            # Department Stats (In-Memory Resolution)
            dept_id_val = 0
            dept_name = 'General'
            dept = task.get('department_id')
            if dept and isinstance(dept, (list, tuple)):
                dept_id_val = dept[0]
                dept_name = dept[1]
            elif task.get('project_id') and isinstance(task['project_id'], (list, tuple)) and task['project_id'][0] in proj_dept_map:
                p_dept = proj_dept_map[task['project_id'][0]]
                dept_id_val = p_dept[0]
                dept_name = p_dept[1]
            elif task.get('user_ids'):
                for u_id in task['user_ids']:
                    if u_id in user_dept_map:
                        u_dept = user_dept_map[u_id]
                        dept_id_val = u_dept[0]
                        dept_name = u_dept[1]
                        break

            if dept_name not in dept_stats:
                dept_stats[dept_name] = {'id': dept_id_val, 'total': 0, 'completed': 0, 'overdue': 0, 'on_time': 0, 'late': 0}
            dept_stats[dept_name]['total'] += 1
            if is_done:
                dept_stats[dept_name]['completed'] += 1
                if is_on_time:
                    dept_stats[dept_name]['on_time'] += 1
                else:
                    dept_stats[dept_name]['late'] += 1
            if is_overdue:
                dept_stats[dept_name]['overdue'] += 1

            # Assignees Stats
            if task.get('user_ids'):
                for u_id in task['user_ids']:
                    if u_id == 1:
                        continue
                    u_name = user_name_map.get(u_id)
                    if not u_name:
                        continue
                    if u_id not in assignee_stats:
                        assignee_stats[u_id] = {
                            'id': u_id,
                            'name': u_name,
                            'total': 0,
                            'completed': 0,
                            'avatar_url': f'/web/image/res.users/{u_id}/avatar_128'
                        }
                    assignee_stats[u_id]['total'] += 1
                    if is_done:
                        assignee_stats[u_id]['completed'] += 1

            # Project Stats
            if task.get('project_id') and isinstance(task['project_id'], (list, tuple)):
                proj_rec_id = task['project_id'][0]
                p_name = task['project_id'][1]
                if proj_rec_id not in project_stats:
                    project_stats[proj_rec_id] = {
                        'id': proj_rec_id,
                        'name': p_name,
                        'total': 0,
                        'completed': 0,
                    }
                project_stats[proj_rec_id]['total'] += 1
                if is_done:
                    project_stats[proj_rec_id]['completed'] += 1

            # Time bucket attribution
            c_date = self._parse_date(task.get('create_date')) or today
            for b in time_buckets:
                if b['start'] <= c_date <= b['end']:
                    b['created'] += 1
                    break

            if is_done:
                comp_d = self._parse_date(task.get('date_last_stage_update') or task.get('write_date')) or c_date
                for b in time_buckets:
                    if b['start'] <= comp_d <= b['end']:
                        b['completed'] += 1
                        if is_on_time:
                            b['on_time'] += 1
                        else:
                            b['late'] += 1
                        break

            if is_overdue:
                for b in time_buckets:
                    if b['start'] <= (task_date or today) <= b['end']:
                        b['overdue'] += 1
                        break

            if is_blocked:
                for b in time_buckets:
                    if b['start'] <= c_date <= b['end']:
                        b['blocked'] += 1
                        break

        # Calculate KPI percentages and trends
        completion_rate = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0
        prev_completion_rate = round((prev_completed_count / prev_tasks_count * 100), 1) if prev_tasks_count > 0 else 0.0

        on_time_rate = round((on_time_completed / completed_tasks * 100), 1) if completed_tasks > 0 else 0.0
        late_rate = round((late_completed / completed_tasks * 100), 1) if completed_tasks > 0 else 0.0

        performance_rate = round((on_time_completed / total_tasks * 100), 1) if total_tasks > 0 else 0.0
        prev_performance_rate = round((prev_on_time_completed_count / prev_tasks_count * 100), 1) if prev_tasks_count > 0 else 0.0

        def calc_trend(curr, prev):
            if prev > 0:
                return round(((curr - prev) / prev) * 100, 1)
            elif curr > 0:
                return 100.0
            return 0.0

        total_tasks_trend = calc_trend(total_tasks, prev_tasks_count) if prev_tasks_count else 0.0
        completed_tasks_trend = calc_trend(completed_tasks, prev_completed_count) if prev_completed_count else 0.0
        on_time_trend = calc_trend(on_time_completed, prev_on_time_completed_count) if prev_tasks_count else 0.0
        late_trend = calc_trend(late_completed, prev_late_completed_count) if prev_tasks_count else 0.0
        performance_trend = round(performance_rate - prev_performance_rate, 1) if prev_tasks_count else 0.0
        rate_diff = round(completion_rate - prev_completion_rate, 1) if prev_tasks_count else 0.0
        overdue_trend = calc_trend(overdue_tasks, prev_overdue_count) if prev_overdue_count else 0.0
        blocked_trend = calc_trend(blocked_tasks, prev_blocked_count) if prev_blocked_count else 0.0

        # Sparklines generation
        created_series = [b['created'] for b in time_buckets]
        completed_series = [b['completed'] for b in time_buckets]
        on_time_series = [b.get('on_time', 0) for b in time_buckets]
        late_series = [b.get('late', 0) for b in time_buckets]
        perf_series = [
            round((b.get('on_time', 0) / b['created'] * 100), 1) if b['created'] > 0 else 0.0
            for b in time_buckets
        ]
        overdue_series = [b['overdue'] for b in time_buckets]
        blocked_series = [b['blocked'] for b in time_buckets]
        rate_series = [
            round((b['completed'] / b['created'] * 100), 1) if b['created'] > 0 else 0.0
            for b in time_buckets
        ]

        sparklines = {
            'total_tasks': created_series if any(created_series) else [0, 0, 0, 0, 0],
            'completed_tasks': completed_series if any(completed_series) else [0, 0, 0, 0, 0],
            'on_time_completed': on_time_series if any(on_time_series) else [0, 0, 0, 0, 0],
            'late_completed': late_series if any(late_series) else [0, 0, 0, 0, 0],
            'performance': perf_series if any(perf_series) else [0, 0, 0, 0, 0],
            'completion_rate': rate_series if any(rate_series) else [0, 0, 0, 0, 0],
            'overdue_tasks': overdue_series if any(overdue_series) else [0, 0, 0, 0, 0],
            'blocked_tasks': blocked_series if any(blocked_series) else [0, 0, 0, 0, 0]
        }

        # Format Departments list
        dept_colors = ['#8B5CF6', '#3B82F6', '#F97316', '#14B8A6', '#10B981', '#6366F1', '#EC4899', '#06B6D4']
        dept_bg_colors = ['#F5F3FF', '#EFF6FF', '#FFF7ED', '#F0FDFA', '#ECFDF5', '#EEF2FF', '#FDF2F8', '#ECFEFF']
        dept_icons = ['fa-bullhorn', 'fa-users', 'fa-film', 'fa-line-chart', 'fa-cogs', 'fa-laptop', 'fa-shield', 'fa-briefcase']

        department_performance = []
        dept_sorted = sorted(dept_stats.items(), key=lambda x: x[1]['total'], reverse=True)
        for idx, (d_name, s) in enumerate(dept_sorted[:8]):
            d_rate = round((s['completed'] / s['total'] * 100), 1) if s['total'] > 0 else 0.0
            department_performance.append({
                'id': s['id'],
                'department': d_name,
                'total_tasks': s['total'],
                'completed': s['completed'],
                'on_time': s.get('on_time', 0),
                'done_late': s.get('late', 0),
                'overdue': s['overdue'],
                'completion_rate': d_rate,
                'color': dept_colors[idx % len(dept_colors)],
                'bg_color': dept_bg_colors[idx % len(dept_bg_colors)],
                'icon': dept_icons[idx % len(dept_icons)]
            })

        # Format Top Assignees
        top_assignees = []
        assignee_sorted = sorted(assignee_stats.values(), key=lambda x: (x['completed'] / x['total'] if x['total'] > 0 else 0, x['completed']), reverse=True)
        for u in assignee_sorted[:6]:
            rate = round((u['completed'] / u['total'] * 100), 1) if u['total'] > 0 else 0.0
            top_assignees.append({
                'id': u['id'],
                'name': u['name'],
                'completed': u['completed'],
                'total_tasks': u['total'],
                'rate': rate,
                'avatar_url': u['avatar_url']
            })

        # Format Top Projects
        project_colors = ['#10B981', '#3B82F6', '#1E293B', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']
        project_bg_colors = ['#ECFDF5', '#EFF6FF', '#F1F5F9', '#FFFBEB', '#F5F3FF', '#FDF2F8', '#ECFEFF']
        project_icons = ['fa-film', 'fa-globe', 'fa-database', 'fa-mobile', 'fa-sitemap', 'fa-cube', 'fa-folder']

        top_projects = []
        project_sorted = sorted(project_stats.values(), key=lambda x: (x['completed'] / x['total'] if x['total'] > 0 else 0, x['total']), reverse=True)
        for idx, p in enumerate(project_sorted[:6]):
            p_prog = round((p['completed'] / p['total'] * 100)) if p['total'] > 0 else 0
            top_projects.append({
                'id': p['id'],
                'name': p['name'],
                'progress': p_prog,
                'tasks': p['total'],
                'color': project_colors[idx % len(project_colors)],
                'bg_color': project_bg_colors[idx % len(project_bg_colors)],
                'icon': project_icons[idx % len(project_icons)]
            })

        # Format Tasks Over Time
        time_labels = [b['label'] for b in time_buckets]
        tasks_over_time = {
            'labels': time_labels,
            'created': created_series,
            'completed': completed_series
        }

        # Productivity Trend: Bar + Line
        prod_labels = [b['full_label'] for b in time_buckets]
        prod_rates = []
        for b in time_buckets:
            r = round((b['completed'] / b['created'] * 100), 1) if b['created'] > 0 else (round(completion_rate, 1))
            prod_rates.append(min(r, 100.0))

        productivity_trend = {
            'labels': prod_labels,
            'tasks_completed': completed_series,
            'completion_rate': prod_rates
        }

        # Format Status Distribution
        status_dist = [
            {'label': 'Completed', 'count': completed_tasks, 'pct': round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0, 'color': '#10B981'},
            {'label': 'In Progress', 'count': in_progress_tasks, 'pct': round((in_progress_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0, 'color': '#3B82F6'},
            {'label': 'Pending', 'count': pending_tasks, 'pct': round((pending_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0, 'color': '#F59E0B'},
            {'label': 'Blocked', 'count': blocked_tasks, 'pct': round((blocked_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0, 'color': '#EF4444'},
            {'label': 'Cancelled', 'count': cancelled_tasks, 'pct': round((cancelled_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0, 'color': '#334155'}
        ]

        # Format Priority Distribution
        priority_dist = [
            {'label': 'High', 'count': priority_distribution['high'], 'pct': round((priority_distribution['high'] / total_tasks * 100), 1) if total_tasks > 0 else 0.0, 'color': '#EF4444'},
            {'label': 'Medium', 'count': priority_distribution['medium'], 'pct': round((priority_distribution['medium'] / total_tasks * 100), 1) if total_tasks > 0 else 0.0, 'color': '#F59E0B'},
            {'label': 'Low', 'count': priority_distribution['low'], 'pct': round((priority_distribution['low'] / total_tasks * 100), 1) if total_tasks > 0 else 0.0, 'color': '#10B981'}
        ]

        # Generate Insights dynamically
        best_dept = max(department_performance, key=lambda x: x['completion_rate']) if department_performance else None
        worst_overdue_dept = max(department_performance, key=lambda x: x['overdue']) if department_performance else None
        top_user = top_assignees[0] if top_assignees else None

        insights = []
        if best_dept and best_dept['total_tasks'] > 0:
            insights.append({
                'type': 'success',
                'icon': 'fa-line-chart',
                'color': '#10B981',
                'bg_color': '#ECFDF5',
                'text': f"{best_dept['department']} department has the highest completion rate ({best_dept['completion_rate']}%)."
            })
        if worst_overdue_dept and worst_overdue_dept['overdue'] > 0:
            insights.append({
                'type': 'warning',
                'icon': 'fa-exclamation-triangle',
                'color': '#F59E0B',
                'bg_color': '#FFFBEB',
                'text': f"{worst_overdue_dept['overdue']} tasks are overdue in {worst_overdue_dept['department']} department. Immediate attention needed."
            })
        else:
            insights.append({
                'type': 'warning',
                'icon': 'fa-check',
                'color': '#10B981',
                'bg_color': '#ECFDF5',
                'text': "No critical overdue bottleneck detected across active departments."
            })
        
        insights.append({
            'type': 'info',
            'icon': 'fa-info-circle',
            'color': '#3B82F6',
            'bg_color': '#EFF6FF',
            'text': f"Task completion rate is {completion_rate}% across active project tasks."
        })

        if top_user:
            insights.append({
                'type': 'user',
                'icon': 'fa-user-circle',
                'color': '#8B5CF6',
                'bg_color': '#F5F3FF',
                'text': f"{top_user['name']} is the top performer with {top_user['rate']}% task completion rate."
            })

        # Fetch filter options for dropdowns in fast batch reads
        if 'project.firm' in env:
            companies_list = env['project.firm'].sudo().search_read([], ['id', 'name'], order='name asc')
        else:
            companies_list = env['res.company'].sudo().search_read([], ['id', 'name'], order='name asc')

        if 'hr.department' in env:
            if not is_admin_or_manager:
                if user_dept_id:
                    departments_list = env['hr.department'].sudo().search_read([('id', '=', user_dept_id)], ['id', 'name'])
                else:
                    departments_list = []
            else:
                departments_list = env['hr.department'].sudo().search_read([], ['id', 'name'], order='name asc')
        else:
            departments_list = []

        employees_list = [{'id': u['id'], 'name': u['name']} for u in user_records]

        # Projects list respecting filters
        project_domain = [('active', '=', True)]
        if c_id and 'project.firm' in env:
            firm = env['project.firm'].sudo().browse(c_id)
            if firm.exists() and firm.tag_ids:
                project_domain.append(('tag_ids', 'in', firm.tag_ids.ids))
        if d_id:
            project_domain.append(('department_id', '=', d_id))

        projects_list = env['project.project'].search_read(project_domain, ['id', 'name'], order='name asc', limit=100)

        # Current logged in user info
        user_role = 'Admin' if (curr_user.has_group('base.group_system') or curr_user.has_group('project.group_project_manager')) else ('Manager' if curr_user.has_group('custom_project.group_project_manager_custom') else 'User')
        
        my_overdue_count = env['project.task'].search_count([
            ('user_ids', 'in', [curr_user.id]),
            ('state', '!=', '1_done'),
            ('date_deadline', '<', today)
        ])

        # Date string formatting
        today_formatted = today.strftime('%A, %d %b %Y')
        if start_date and end_date:
            if start_date == end_date:
                date_str_formatted = start_date.strftime('%A, %d %b %Y')
            else:
                date_str_formatted = f"{start_date.strftime('%d %b')} - {end_date.strftime('%d %b %Y')}"
            vs_date_str = f"vs {prev_start_date.strftime('%b %Y')}" if prev_start_date else ""
        else:
            date_str_formatted = today_formatted
            vs_date_str = ""

        return {
            'user': {
                'id': curr_user.id,
                'name': curr_user.name,
                'role': user_role,
                'avatar_url': f'/web/image/res.users/{curr_user.id}/avatar_128',
                'notifications_count': my_overdue_count or 0
            },
            'filters': {
                'is_restricted_user': not is_admin_or_manager,
                'companies': companies_list,
                'departments': departments_list,
                'employees': employees_list,
                'projects': projects_list,
                'current_company': company_id,
                'current_department': d_id if (not is_admin_or_manager and d_id) else dept_id,
                'current_employee': emp_id,
                'current_project': project_id,
                'current_custom_view': custom_view,
                'current_date_str': date_str_formatted,
                'vs_date_str': vs_date_str,
                'date_range': date_range,
                'date_from': start_date.strftime('%Y-%m-%d') if start_date else '',
                'date_to': end_date.strftime('%Y-%m-%d') if end_date else '',
                'time_granularity': time_granularity
            },
            'overview': {
                'total_tasks': total_tasks,
                'total_tasks_trend': total_tasks_trend,
                'completed_tasks': completed_tasks,
                'completed_tasks_trend': completed_tasks_trend,
                'on_time_completed': on_time_completed,
                'on_time_completed_trend': on_time_trend,
                'on_time_rate': on_time_rate,
                'late_completed': late_completed,
                'late_completed_trend': late_trend,
                'late_rate': late_rate,
                'performance_rate': performance_rate,
                'performance_rate_trend': performance_trend,
                'completion_rate': completion_rate,
                'completion_rate_trend': rate_diff,
                'overdue_tasks': overdue_tasks,
                'overdue_tasks_trend': overdue_trend,
                'blocked_tasks': blocked_tasks,
                'blocked_tasks_trend': blocked_trend,
                'sparklines': sparklines
            },
            'tasks_over_time': tasks_over_time,
            'tasks_by_status': {
                'total': total_tasks,
                'items': status_dist
            },
            'tasks_by_priority': {
                'total': total_tasks,
                'items': priority_dist
            },
            'department_performance': department_performance,
            'top_assignees': top_assignees,
            'top_projects': top_projects,
            'productivity_trend': productivity_trend,
            'insights': insights,
            'task_ids': task_ids_map
        }
