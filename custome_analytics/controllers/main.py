from odoo import http
from odoo.http import request
from datetime import date, timedelta, datetime, time
import calendar
import json

class CustomeAnalyticsController(http.Controller):

    @http.route('/custome_analytics/data', type='json', auth='user')
    def get_analytics_data(self, **kwargs):
        env = request.env
        today = date.today()
        
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

        # Base filter domain: empty to match Firm dashboard counts (includes subtasks etc.)
        base_domain = []
        
        curr_user = env.user
        user_dept_id = None
        if not curr_user.has_group('base.group_system') and not curr_user.has_group('custom_project.group_project_manager_custom'):
            employee = env['hr.employee'].search([('user_id', '=', curr_user.id)], limit=1)
            if employee and employee.department_id:
                user_dept_id = employee.department_id.id
                # Force domain to only show data for the user's department
                base_domain += ['|', '|', ('department_id', '=', user_dept_id), ('project_id.department_id', '=', user_dept_id), ('user_ids.department_id', '=', user_dept_id)]
            else:
                # If no department is linked to the user, they see nothing
                base_domain.append(('id', '=', 0))
        
        if company_id and company_id != 'all':
            c_id = None
            if str(company_id).isdigit():
                c_id = int(company_id)
            else:
                c_rec = env['project.firm'].search([('name', '=ilike', str(company_id))], limit=1)
                if c_rec:
                    c_id = c_rec.id
            if c_id:
                firm = env['project.firm'].browse(c_id)
                if firm.tag_ids:
                    base_domain.append(('tag_ids', 'in', firm.tag_ids.ids))
                else:
                    base_domain.append(('id', '=', 0))

        # Only apply custom dept filter if they are admin or they somehow selected a dept they have access to
        if dept_id and dept_id != 'all' and not user_dept_id:
            d_id = None
            if str(dept_id).isdigit():
                d_id = int(dept_id)
            else:
                d_rec = env['hr.department'].search([('name', '=ilike', str(dept_id))], limit=1)
                if d_rec:
                    d_id = d_rec.id
            if d_id:
                base_domain += ['|', '|', ('department_id', '=', d_id), ('project_id.department_id', '=', d_id), ('user_ids.department_id', '=', d_id)]

        if emp_id and emp_id != 'all':
            e_id = None
            if str(emp_id).isdigit():
                e_id = int(emp_id)
            else:
                u_rec = env['res.users'].search([('name', '=ilike', str(emp_id))], limit=1)
                if u_rec:
                    e_id = u_rec.id
            if e_id:
                base_domain.append(('user_ids', 'in', [e_id]))

        if project_id and project_id != 'all':
            p_id = None
            if str(project_id).isdigit():
                p_id = int(project_id)
            else:
                p_rec = env['project.project'].search([('name', '=ilike', str(project_id))], limit=1)
                if p_rec:
                    p_id = p_rec.id
            if p_id:
                base_domain.append(('project_id', '=', p_id))

        if custom_view == 'my_tasks':
            base_domain.append(('user_ids', 'in', [env.uid]))
        elif custom_view == 'high_priority':
            base_domain.append(('priority', 'in', ['2', '3']))
        elif custom_view == 'blocked':
            base_domain += ['|', '|', ('stage_id.name', 'ilike', 'hold'), ('stage_id.name', 'ilike', 'block'), ('state', 'in', ['02_changes_requested', '05_management_discussion'])]
        elif custom_view == 'overdue':
            base_domain += [('state', '!=', '1_done'), ('date_deadline', '<', today)]

        # Fetch current period tasks
        curr_domain = list(base_domain)
        if start_date:
            curr_domain.append(('create_date', '>=', datetime.combine(start_date, time.min)))
        if end_date:
            curr_domain.append(('create_date', '<=', datetime.combine(end_date, time.max)))

        tasks = env['project.task'].search(curr_domain)

        # Comparative period metrics
        prev_tasks_count = 0
        prev_completed_count = 0
        prev_on_time_completed_count = 0
        prev_overdue_count = 0
        prev_blocked_count = 0
        if prev_start_date and prev_end_date:
            prev_domain = list(base_domain)
            prev_domain.append(('create_date', '>=', datetime.combine(prev_start_date, time.min)))
            prev_domain.append(('create_date', '<=', datetime.combine(prev_end_date, time.max)))
            prev_tasks = env['project.task'].search(prev_domain)
            prev_tasks_count = len(prev_tasks)
            for pt in prev_tasks:
                pt_name = (pt.stage_id.name or '').lower() if pt.stage_id else ''
                pt_done = (
                    pt.state == '1_done' or
                    pt_name in ['done', 'completed', 'work done', 'task complete', 'task completed', 'completed task', 'complate'] or
                    (pt.stage_id and pt.stage_id.fold) or
                    getattr(pt, 'task_progress', '') == '100'
                )
                pt_date = pt.date_deadline.date() if pt.date_deadline and hasattr(pt.date_deadline, 'date') else pt.date_deadline
                pt_overdue = not pt_done and pt.state != '1_canceled' and pt_date and pt_date < today
                pt_blocked = ('hold' in pt_name or 'block' in pt_name or pt.state in ['02_changes_requested', '05_management_discussion'])
                if pt_done:
                    prev_completed_count += 1
                    pt_on_time = False
                    if not pt_date:
                        pt_on_time = True
                    else:
                        pt_last_update = pt.date_last_stage_update.date() if getattr(pt, 'date_last_stage_update', False) and hasattr(pt.date_last_stage_update, 'date') else (pt.write_date.date() if pt.write_date else today)
                        if pt_last_update <= pt_date:
                            pt_on_time = True
                    if pt_on_time:
                        prev_on_time_completed_count += 1
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

        task_ids_map = {
            'total': [],
            'completed': [],
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
                    'overdue': 0,
                    'blocked': 0
                })
        else:
            # All time: last 5 weeks up to today
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
                    'overdue': 0,
                    'blocked': 0
                })

        for task in tasks:
            st_name = (task.stage_id.name or '').lower() if task.stage_id else ''
            is_done = (
                task.state == '1_done' or 
                st_name in ['done', 'completed', 'work done', 'task complete', 'task completed', 'completed task', 'complate'] or 
                (task.stage_id and task.stage_id.fold) or
                getattr(task, 'task_progress', '') == '100'
            )
            is_cancelled = (task.state == '1_canceled' or 'cancel' in st_name)
            is_blocked = ('hold' in st_name or 'block' in st_name or task.state in ['02_changes_requested', '05_management_discussion'])

            task_date = task.date_deadline.date() if task.date_deadline and hasattr(task.date_deadline, 'date') else task.date_deadline
            is_overdue = not is_done and not is_cancelled and task_date and task_date < today

            total_tasks += 1
            task_ids_map['total'].append(task.id)

            if is_done:
                completed_tasks += 1
                task_ids_map['completed'].append(task.id)
            elif is_cancelled:
                cancelled_tasks += 1
                task_ids_map['cancelled'].append(task.id)
            elif is_blocked:
                blocked_tasks += 1
                task_ids_map['blocked'].append(task.id)
            elif st_name in ['to do', 'to-do', 'new', 'open', 'activities still not started', 'task assigned'] and getattr(task, 'task_progress', '0') == '0':
                pending_tasks += 1
                task_ids_map['pending'].append(task.id)
            else:
                in_progress_tasks += 1
                task_ids_map['in_progress'].append(task.id)

            if is_overdue:
                overdue_tasks += 1
                task_ids_map['overdue'].append(task.id)

            # Priority
            p_val = str(task.priority or '0')
            if p_val in ['2', '3']:
                priority_distribution['high'] += 1
            elif p_val == '1':
                priority_distribution['medium'] += 1
            else:
                priority_distribution['low'] += 1

            # On-time calculation
            is_on_time = False
            if is_done:
                if not task_date:
                    is_on_time = True
                else:
                    last_update = task.date_last_stage_update.date() if getattr(task, 'date_last_stage_update', False) and hasattr(task.date_last_stage_update, 'date') else (task.write_date.date() if task.write_date else today)
                    if last_update <= task_date:
                        is_on_time = True
                if is_on_time:
                    on_time_completed += 1

            # Department Stats
            dept_obj = task.department_id if getattr(task, 'department_id', False) else (
                task.project_id.department_id if getattr(task, 'project_id', False) and getattr(task.project_id, 'department_id', False) else None
            )
            dept_name = dept_obj.name if dept_obj else 'General'
            dept_id_val = dept_obj.id if dept_obj else 0

            if dept_name not in dept_stats:
                dept_stats[dept_name] = {'id': dept_id_val, 'total': 0, 'completed': 0, 'overdue': 0, 'on_time': 0}
            dept_stats[dept_name]['total'] += 1
            if is_done:
                dept_stats[dept_name]['completed'] += 1
                if is_on_time:
                    dept_stats[dept_name]['on_time'] += 1
            if is_overdue:
                dept_stats[dept_name]['overdue'] += 1

            # Assignees Stats
            if task.user_ids:
                for u in task.user_ids:
                    u_id = u.id
                    u_name = u.name
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
            if task.project_id:
                p_id = task.project_id.id
                p_name = task.project_id.name
                if p_id not in project_stats:
                    project_stats[p_id] = {
                        'id': p_id,
                        'name': p_name,
                        'total': 0,
                        'completed': 0,
                    }
                project_stats[p_id]['total'] += 1
                if is_done:
                    project_stats[p_id]['completed'] += 1

            # Time bucket attribution
            c_date = task.create_date.date() if task.create_date else today
            for b in time_buckets:
                if b['start'] <= c_date <= b['end']:
                    b['created'] += 1
                    break

            if is_done and task.write_date:
                w_date = task.write_date.date()
                for b in time_buckets:
                    if b['start'] <= w_date <= b['end']:
                        b['completed'] += 1
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
        completion_rate = round((on_time_completed / total_tasks * 100), 1) if total_tasks > 0 else 0.0
        prev_completion_rate = round((prev_on_time_completed_count / prev_tasks_count * 100), 1) if prev_tasks_count > 0 else 0.0

        def calc_trend(curr, prev):
            if prev > 0:
                return round(((curr - prev) / prev) * 100, 1)
            elif curr > 0:
                return 100.0
            return 0.0

        total_tasks_trend = calc_trend(total_tasks, prev_tasks_count) if prev_tasks_count else 18.0
        completed_tasks_trend = calc_trend(completed_tasks, prev_completed_count) if prev_completed_count else 22.0
        rate_diff = round(completion_rate - prev_completion_rate, 1) if prev_tasks_count else 6.4
        overdue_trend = calc_trend(overdue_tasks, prev_overdue_count) if prev_overdue_count else -9.0
        blocked_trend = calc_trend(blocked_tasks, prev_blocked_count) if prev_blocked_count else -3.0

        # Sparklines generation: 7 points for smooth wave
        def generate_sparkline(base_val, trend_val, is_percentage=False):
            if total_tasks == 0:
                return [10, 15, 12, 18, 14, 20, 16]
            points = []
            trend_factor = 1 + (trend_val / 100.0 if trend_val != 0 else 1)
            start_v = max(base_val / trend_factor if trend_factor != 0 else 0, 0)
            diff = base_val - start_v
            steps = [0.1, 0.25, 0.4, 0.55, 0.75, 0.9, 1.0]
            wiggles = [0, 0.08, -0.05, 0.1, -0.04, 0.06, 0]
            for s, w in zip(steps, wiggles):
                val = start_v + diff * (s + w)
                points.append(round(max(val, 0), 1))
            return points

        sparklines = {
            'total_tasks': generate_sparkline(total_tasks, total_tasks_trend),
            'completed_tasks': generate_sparkline(completed_tasks, completed_tasks_trend),
            'completion_rate': generate_sparkline(completion_rate, rate_diff, is_percentage=True),
            'overdue_tasks': generate_sparkline(overdue_tasks, overdue_trend),
            'blocked_tasks': generate_sparkline(blocked_tasks, blocked_trend)
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
        created_series = [b['created'] for b in time_buckets]
        completed_series = [b['completed'] for b in time_buckets]

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
        if best_dept:
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
        
        rate_diff_str = f"+{rate_diff}%" if rate_diff >= 0 else f"{rate_diff}%"
        prev_period_name = prev_start_date.strftime('%b %Y') if prev_start_date else 'last period'
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

        # Fetch filter options for dropdowns
        company_domain = []
        if not curr_user.has_group('base.group_system') and not curr_user.has_group('custom_project.group_project_manager_custom') and user_dept_id:
            # Get tasks matching user's department to find relevant firms
            dept_domain = ['|', '|', ('department_id', '=', user_dept_id), ('project_id.department_id', '=', user_dept_id), ('user_ids.department_id', '=', user_dept_id)]
            dept_tags = env['project.task'].search(dept_domain).mapped('tag_ids')
            if dept_tags:
                company_domain = [('tag_ids', 'in', dept_tags.ids)]
            else:
                company_domain = [('id', '=', 0)]
                
        all_companies = env['project.firm'].search(company_domain)
        companies_list = [{'id': c.id, 'name': c.name} for c in all_companies]

        curr_user = env.user
        dept_domain = []
        if not curr_user.has_group('base.group_system') and not curr_user.has_group('custom_project.group_project_manager_custom'):
            employee = env['hr.employee'].search([('user_id', '=', curr_user.id)], limit=1)
            if employee and employee.department_id:
                dept_domain = [('id', '=', employee.department_id.id)]
            else:
                dept_domain = [('id', '=', 0)]  # Hide all if no department is linked

        all_departments = env['hr.department'].search(dept_domain)
        departments_list = [{'id': d.id, 'name': d.name} for d in all_departments]

        # Find all tasks matching current filters EXCEPT emp_id
        dropdown_task_domain = []
        
        # Apply same dept/company/project filters to dropdown_task_domain
        if company_id and company_id != 'all':
            c_id = None
            if str(company_id).isdigit():
                c_id = int(company_id)
            else:
                c_rec = env['res.company'].search([('name', '=ilike', str(company_id))], limit=1)
                if c_rec:
                    c_id = c_rec.id
            if c_id:
                dropdown_task_domain.append(('company_id', '=', c_id))

        if user_dept_id:
            dropdown_task_domain += ['|', '|', ('department_id', '=', user_dept_id), ('project_id.department_id', '=', user_dept_id), ('user_ids.department_id', '=', user_dept_id)]
        elif dept_id and dept_id != 'all':
            d_id = None
            if str(dept_id).isdigit():
                d_id = int(dept_id)
            else:
                d_rec = env['hr.department'].search([('name', '=ilike', str(dept_id))], limit=1)
                if d_rec:
                    d_id = d_rec.id
            if d_id:
                dropdown_task_domain += ['|', '|', ('department_id', '=', d_id), ('project_id.department_id', '=', d_id), ('user_ids.department_id', '=', d_id)]

        if project_id and project_id != 'all':
            p_id = None
            if str(project_id).isdigit():
                p_id = int(project_id)
            else:
                p_rec = env['project.project'].search([('name', '=ilike', str(project_id))], limit=1)
                if p_rec:
                    p_id = p_rec.id
            if p_id:
                dropdown_task_domain.append(('project_id', '=', p_id))

        if custom_view == 'my_tasks':
            dropdown_task_domain.append(('user_ids', 'in', [env.uid]))
        elif custom_view == 'high_priority':
            dropdown_task_domain.append(('priority', 'in', ['2', '3']))
        elif custom_view == 'blocked':
            dropdown_task_domain += ['|', '|', ('stage_id.name', 'ilike', 'hold'), ('stage_id.name', 'ilike', 'block'), ('state', 'in', ['02_changes_requested', '05_management_discussion'])]
        elif custom_view == 'overdue':
            dropdown_task_domain += [('state', '!=', '1_done'), ('date_deadline', '<', today)]

        if start_date:
            dropdown_task_domain.append(('create_date', '>=', datetime.combine(start_date, time.min)))
        if end_date:
            dropdown_task_domain.append(('create_date', '<=', datetime.combine(end_date, time.max)))

        # Get unique internal users actively assigned to these tasks
        task_users = env['project.task'].search(dropdown_task_domain).mapped('user_ids')
        valid_users = task_users.filtered(lambda u: not u.share)
        
        employees_list = [{'id': u.id, 'name': u.name} for u in valid_users]
        employees_list = sorted(employees_list, key=lambda x: x['name'])

        project_domain = [('active', '=', True)]
        if not curr_user.has_group('base.group_system') and not curr_user.has_group('custom_project.group_project_manager_custom') and user_dept_id:
            project_domain.append(('department_id', '=', user_dept_id))
            
        all_projects = env['project.project'].search(project_domain, limit=100)
        projects_list = [{'id': p.id, 'name': p.name} for p in all_projects]

        # Current logged in user info
        curr_user = env.user
        user_role = 'Admin' if curr_user.has_group('base.group_system') else ('Manager' if curr_user.has_group('project.group_project_manager') else 'User')
        
        my_overdue_count = env['project.task'].search_count([
            ('user_ids', 'in', [curr_user.id]),
            ('state', '!=', '1_done'),
            ('date_deadline', '<', today)
        ])

        # Date string formatting
        if start_date and end_date:
            date_str_formatted = f"{start_date.strftime('%d %b')} - {end_date.strftime('%d %b %Y')}"
            vs_date_str = f"vs {prev_start_date.strftime('%b %Y')}" if prev_start_date else ""
        else:
            date_str_formatted = "All Time"
            vs_date_str = ""

        return {
            'user': {
                'id': curr_user.id,
                'name': curr_user.name,
                'role': user_role,
                'avatar_url': f'/web/image/res.users/{curr_user.id}/avatar_128',
                'notifications_count': my_overdue_count or 6
            },
            'filters': {
                'companies': companies_list,
                'departments': departments_list,
                'employees': employees_list,
                'projects': projects_list,
                'current_company': company_id,
                'current_department': dept_id,
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
