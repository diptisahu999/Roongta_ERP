# -*- coding: utf-8 -*-
"""
Dashboard JSON endpoint for project_dashboard module.

Returns live statistics for all projects and tasks visible to the
current user (respects Odoo's built-in project visibility rules).
"""
import logging
from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class ProjectDashboardController(http.Controller):

    @http.route('/project_dashboard/data', type='json', auth='user')
    def dashboard_data(self, **kwargs):
        """Return project + task statistics as a JSON dict."""
        env = request.env

        start_date = kwargs.get('start_date')
        end_date = kwargs.get('end_date')
        project_id = kwargs.get('project_id')
        employee_id = kwargs.get('employee_id')

        # ── Projects Domain ──────────────────────────────────────────────────
        project_domain = []
        if project_id:
            project_domain.append(('id', '=', int(project_id)))
            
        is_manager = env.user.has_group('project.group_project_manager') or env.user.has_group('base.group_erp_manager')

        if not is_manager:
            user_tasks = env['project.task'].search([('user_ids', 'in', env.uid)])
            assigned_project_ids = list(set(user_tasks.mapped('project_id').ids))
            assigned_project_ids = [p for p in assigned_project_ids if p]
            project_domain.append(('id', 'in', assigned_project_ids if assigned_project_ids else [0]))

        projects = env['project.project'].search(project_domain)

        # ── Tasks Domain ─────────────────────────────────────────────────────
        task_domain = [('project_id', 'in', projects.ids)] if projects else [('id', '=', 0)]
        if employee_id:
            task_domain.append(('user_ids', 'in', [int(employee_id)]))
        if start_date:
            task_domain.append(('date_deadline', '>=', start_date))
        if end_date:
            task_domain.append(('date_deadline', '<=', end_date))

        tasks = env['project.task'].search(task_domain)

        # If filtering by employee or date, restrict the projects we show stats for
        # to ONLY those projects that contain matching tasks.
        if employee_id or start_date or end_date:
            projects = projects.filtered(lambda p: p.id in tasks.mapped('project_id').ids)

        last_project_stage_id = False
        if 'stage_id' in projects._fields:
            stage_model = projects._fields['stage_id'].comodel_name
            last_stage = env[stage_model].search([], order='sequence desc, id desc', limit=1)
            if last_stage:
                last_project_stage_id = last_stage.id

        completed_projects  = projects.filtered(lambda p: p.stage_id and (p.stage_id.fold or p.stage_id.id == last_project_stage_id))
        on_hold_projects    = projects.filtered(lambda p: not (p.stage_id and (p.stage_id.fold or p.stage_id.id == last_project_stage_id)) and p.last_update_status == 'on_hold')
        in_progress_projects = projects - completed_projects - on_hold_projects

        done_tasks    = tasks.filtered(lambda t: t.state == '1_done' or (t.stage_id and t.stage_id.name and t.stage_id.name.lower() in ['done', 'completed']))
        blocked_tasks = tasks.filtered(
            lambda t: not t.is_closed and t.state == '04_waiting_normal'
        )
        active_tasks  = tasks - done_tasks - blocked_tasks

        # ── Per-project breakdown ─────────────────────────────────────────────
        STATUS_LABELS = {
            'done':      'Completed',
            'on_hold':   'On Hold',
            'on_track':  'On Track',
            'at_risk':   'At Risk',
            'off_track': 'Off Track',
        }

        project_list = []
        for project in projects.sorted(key=lambda p: p.name):
            p_tasks   = tasks.filtered(lambda t: t.project_id.id == project.id)
            p_done    = p_tasks.filtered(lambda t: t.state == '1_done' or (t.stage_id and t.stage_id.name and t.stage_id.name.lower() in ['done', 'completed']))
            p_blocked = p_tasks.filtered(
                lambda t: not t.is_closed and t.state == '04_waiting_normal'
            )
            p_active  = p_tasks - p_done - p_blocked
            p_subtasks = p_tasks.filtered(lambda t: t.parent_id)
            p_main_tasks = p_tasks - p_subtasks
            total     = len(p_tasks)
            status    = project.last_update_status or 'on_track'
            if project.stage_id and (project.stage_id.fold or project.stage_id.id == last_project_stage_id):
                progress = 100
            else:
                progress = round(len(p_done) / total * 100) if total > 0 else 0

            project_list.append({
                'id':                project.id,
                'name':              project.name,
                'customer':          project.partner_id.name if project.partner_id else '',
                'manager':           project.user_id.name if project.user_id else '',
                'tasks_total':       total,
                'tasks_main':        len(p_main_tasks),
                'tasks_sub':         len(p_subtasks),
                'tasks_done':        len(p_done),
                'tasks_in_progress': len(p_active),
                'tasks_blocked':     len(p_blocked),
                'progress':          progress,
                'status':            status,
                'status_label':      'Completed' if (project.stage_id and (project.stage_id.fold or project.stage_id.id == last_project_stage_id)) else STATUS_LABELS.get(
                    status, status.replace('_', ' ').title()
                ),
            })

        # ── Dropdown Data for Filters ─────────────────────────────────────────
        all_projects = env['project.project'].search_read([], ['id', 'name'])
        all_employees = env['res.users'].search_read(
            [('active', '=', True), ('id', '!=', 1)],  # all active users except OdooBot
            ['id', 'name'],
            order='name asc',
        )

        # ── Chart Data ────────────────────────────────────────────────────────
        # 1. Project Task Analysis
        project_counts = {}
        for t in tasks:
            if t.project_id:
                name = t.project_id.name
                project_counts[name] = project_counts.get(name, 0) + 1
                
        # 2. Time/Tasks by Employees
        employee_metrics = {}
        # Safely check if effective_hours field exists on the model
        use_time = False
        try:
            if 'effective_hours' in request.env['project.task']._fields:
                hours = tasks.mapped('effective_hours')
                use_time = any(h for h in hours if h)
        except Exception:
            use_time = False

        for t in tasks:
            val = (t.effective_hours if use_time else 1)
            for u in t.user_ids:
                name = u.name
                employee_metrics[name] = employee_metrics.get(name, 0) + val
                
        # Sort employees by value descending (top 10)
        sorted_emp = sorted(employee_metrics.items(), key=lambda x: x[1], reverse=True)[:10]

        return {
            'projects': {
                'total':       len(projects),
                'completed':   len(completed_projects),
                'in_progress': len(in_progress_projects),
                'on_hold':     len(on_hold_projects),
            },
            'tasks': {
                'total':       len(tasks),
                'main':        len(tasks - tasks.filtered(lambda t: t.parent_id)),
                'sub':         len(tasks.filtered(lambda t: t.parent_id)),
                'done':        len(done_tasks),
                'main_done':   len(done_tasks - done_tasks.filtered(lambda t: t.parent_id)),
                'sub_done':    len(done_tasks.filtered(lambda t: t.parent_id)),
                'in_progress': len(active_tasks),
                'main_in_progress': len(active_tasks - active_tasks.filtered(lambda t: t.parent_id)),
                'sub_in_progress':  len(active_tasks.filtered(lambda t: t.parent_id)),
                'blocked':     len(blocked_tasks),
                'main_blocked': len(blocked_tasks - blocked_tasks.filtered(lambda t: t.parent_id)),
                'sub_blocked':  len(blocked_tasks.filtered(lambda t: t.parent_id)),
            },
            'project_list': project_list,
            'filters': {
                'projects': all_projects,
                'employees': all_employees,
            },
            'charts': {
                'project_analysis': {
                    'labels': list(project_counts.keys()),
                    'data': list(project_counts.values())
                },
                'employee_analysis': {
                    'labels': [x[0] for x in sorted_emp],
                    'data': [x[1] for x in sorted_emp],
                    'label_title': 'Hours' if use_time else 'Tasks'
                }
            }
        }

    @http.route('/department_dashboard/data', type='json', auth='user')
    def department_dashboard_data(self, **kwargs):
        """Return department + task statistics as a JSON dict for the new UI."""
        env = request.env
        from dateutil.relativedelta import relativedelta
        from datetime import datetime, date

        start_date = kwargs.get('start_date')
        end_date = kwargs.get('end_date')
        department_id = kwargs.get('department_id')
        employee_id = kwargs.get('employee_id')
        dept_sort = kwargs.get('dept_sort', 'completion')

        # ── Domains ───────────────────────────────────────────────
        project_domain = []
        if department_id:
            project_domain.append(('department_id', '=', int(department_id)))

        all_dashboard_projects = env['project.project'].search(project_domain)

        task_domain = [('project_id', 'in', all_dashboard_projects.ids)] if all_dashboard_projects else [('id', '=', 0)]
        if employee_id:
            task_domain.append(('user_ids', 'in', [int(employee_id)]))
        if start_date:
            task_domain.append(('date_deadline', '>=', start_date))
        if end_date:
            task_domain.append(('date_deadline', '<=', end_date))

        tasks = env['project.task'].search(task_domain)

        if employee_id or start_date or end_date:
            all_dashboard_projects = all_dashboard_projects.filtered(lambda p: p.id in tasks.mapped('project_id').ids)

        # Retrieve relevant departments for the table
        if department_id:
            departments = env['hr.department'].search([('id', '=', int(department_id))])
        else:
            departments = env['hr.department'].search([])

        done_tasks    = tasks.filtered(lambda t: t.state == '1_done' or (t.stage_id and t.stage_id.name and t.stage_id.name.lower() in ['done', 'completed']))
        blocked_tasks = tasks.filtered(lambda t: not t.is_closed and t.state == '04_waiting_normal')
        active_tasks  = tasks - done_tasks - blocked_tasks

        total_tasks = len(tasks)
        total_done = len(done_tasks)
        total_active = len(active_tasks)
        total_blocked = len(blocked_tasks)
        
        last_project_stage_id = False
        if 'stage_id' in all_dashboard_projects._fields:
            stage_model = all_dashboard_projects._fields['stage_id'].comodel_name
            last_stage = env[stage_model].search([], order='sequence desc, id desc', limit=1)
            if last_stage:
                last_project_stage_id = last_stage.id
                
        projects_completed = all_dashboard_projects.filtered(lambda p: p.stage_id and (p.stage_id.fold or p.stage_id.id == last_project_stage_id))
        projects_on_hold = all_dashboard_projects.filtered(lambda p: not (p.stage_id and (p.stage_id.fold or p.stage_id.id == last_project_stage_id)) and p.last_update_status == 'on_hold')
        projects_in_progress = all_dashboard_projects - projects_completed - projects_on_hold

        # Mock Trends for UI (in a real app, query previous period data)
        # We will dynamically generate some believable trends based on current numbers.
        
        # ── Per-department breakdown & Charts Data ───────────────────────────────
        department_list = []
        dept_perf_labels = []
        dept_perf_data = []

        assigned_tasks = env['project.task']
        assigned_projects = env['project.project']
        
        for dept in departments.sorted(key=lambda d: d.name):
            d_tasks   = tasks.filtered(lambda t: t.department_id.id == dept.id or t.project_id.department_id.id == dept.id)
            d_done    = d_tasks.filtered(lambda t: t.state == '1_done' or (t.stage_id and t.stage_id.name and t.stage_id.name.lower() in ['done', 'completed']))
            d_blocked = d_tasks.filtered(lambda t: not t.is_closed and t.state == '04_waiting_normal')
            d_active  = d_tasks - d_done - d_blocked
            total     = len(d_tasks)
            progress  = round(len(d_done) / total * 100) if total > 0 else 0

            dept_perf_labels.append(dept.name)
            if dept_sort == 'tasks_done':
                dept_perf_data.append(len(d_done))
            else:
                dept_perf_data.append(progress)

            d_projects = all_dashboard_projects.filtered(lambda p: p.department_id.id == dept.id)
            d_projects |= d_tasks.mapped('project_id')
            
            assigned_tasks |= d_tasks
            assigned_projects |= d_projects
            
            projects_data = []
            for p in d_projects:
                p_tasks = d_tasks.filtered(lambda t: t.project_id.id == p.id)
                p_done = p_tasks.filtered(lambda t: t.state == '1_done' or (t.stage_id and t.stage_id.name and t.stage_id.name.lower() in ['done', 'completed']))
                p_blocked = p_tasks.filtered(lambda t: not t.is_closed and t.state == '04_waiting_normal')
                p_active = p_tasks - p_done - p_blocked
                p_total = len(p_tasks)
                p_progress = round(len(p_done) / p_total * 100) if p_total > 0 else 0
                projects_data.append({
                    'id': p.id,
                    'name': p.name,
                    'manager': p.user_id.name if p.user_id else '—',
                    'tasks': p_total,
                    'completed': len(p_done),
                    'in_progress': len(p_active),
                    'blocked': len(p_blocked),
                    'progress': p_progress,
                })
            
            department_list.append({
                'id':                dept.id,
                'name':              dept.name,
                'manager':           dept.manager_id.name if dept.manager_id else '—',
                'projects':          len(d_projects),
                'tasks':             total,
                'completed':         len(d_done),
                'in_progress':       len(d_active),
                'blocked':           len(d_blocked),
                'progress':          progress,
                'project_list':      projects_data,
            })

        unassigned_tasks = tasks - assigned_tasks
        unassigned_projects = all_dashboard_projects - assigned_projects
        if unassigned_tasks or unassigned_projects:
            d_tasks = unassigned_tasks
            d_projects = unassigned_projects
            d_done = d_tasks.filtered(lambda t: t.state == '1_done' or (t.stage_id and t.stage_id.name and t.stage_id.name.lower() in ['done', 'completed']))
            d_blocked = d_tasks.filtered(lambda t: not t.is_closed and t.state == '04_waiting_normal')
            d_active = d_tasks - d_done - d_blocked
            total = len(d_tasks)
            progress = round(len(d_done) / total * 100) if total > 0 else 0
            
            dept_perf_labels.append('No Department')
            if dept_sort == 'tasks_done':
                dept_perf_data.append(len(d_done))
            else:
                dept_perf_data.append(progress)
            
            projects_data = []
            for p in d_projects:
                p_tasks = d_tasks.filtered(lambda t: t.project_id.id == p.id)
                p_done = p_tasks.filtered(lambda t: t.state == '1_done' or (t.stage_id and t.stage_id.name and t.stage_id.name.lower() in ['done', 'completed']))
                p_blocked = p_tasks.filtered(lambda t: not t.is_closed and t.state == '04_waiting_normal')
                p_active = p_tasks - p_done - p_blocked
                p_total = len(p_tasks)
                p_progress = round(len(p_done) / p_total * 100) if p_total > 0 else 0
                projects_data.append({
                    'id': p.id,
                    'name': p.name,
                    'manager': p.user_id.name if p.user_id else '—',
                    'tasks': p_total,
                    'completed': len(p_done),
                    'in_progress': len(p_active),
                    'blocked': len(p_blocked),
                    'progress': p_progress,
                })
            
            department_list.append({
                'id': 0,
                'name': 'No Department',
                'manager': '—',
                'projects': len(d_projects),
                'tasks': total,
                'completed': len(d_done),
                'in_progress': len(d_active),
                'blocked': len(d_blocked),
                'progress': progress,
                'project_list': projects_data,
            })

        # Sort department performance by progress descending
        perf_combined = sorted(zip(dept_perf_labels, dept_perf_data), key=lambda x: x[1], reverse=True)
        dept_perf_labels = [x[0] for x in perf_combined]
        dept_perf_data = [x[1] for x in perf_combined]

        dept_task_labels = []
        dept_task_data = []
        for d in department_list:
            if d['tasks'] > 0:
                dept_task_labels.append(d['name'])
                dept_task_data.append(d['tasks'])

        # ── Employee Leaderboard ──────────────────────────────────────────────
        employee_metrics = {}
        for t in done_tasks:
            for u in t.user_ids:
                if u.id != 1:  # skip OdooBot
                    key = (u.id, u.name)
                    employee_metrics[key] = employee_metrics.get(key, 0) + 1
                    
        sorted_emp = sorted(employee_metrics.items(), key=lambda x: x[1], reverse=True)[:6]
        max_emp_tasks = max([x[1] for x in sorted_emp]) if sorted_emp else 1
        
        employee_leaderboard = []
        for (u_id, name), count in sorted_emp:
            employee_leaderboard.append({
                'id': u_id,
                'name': name,
                'done': count,
                'max': max_emp_tasks,
                'avatar': f'/web/image?model=res.users&field=avatar_128&id={u_id}'
            })

        # ── Dropdown Data for Filters ─────────────────────────────────────────
        all_departments = env['hr.department'].search_read([], ['id', 'name'])
        all_employees = env['res.users'].search_read(
            [('active', '=', True), ('id', '!=', 1)],
            ['id', 'name'],
            order='name asc',
        )

        # ── Trend Calculations & Periods ─────────────────────────────────────────
        today = datetime.today()
        
        if start_date and end_date:
            try:
                s_date = datetime.strptime(start_date, '%Y-%m-%d')
                e_date = datetime.strptime(end_date, '%Y-%m-%d')
                delta_days = (e_date - s_date).days + 1
                
                this_p_start = s_date
                this_p_end = e_date + relativedelta(days=1)
                last_p_start = s_date - relativedelta(days=delta_days)
                last_p_end = s_date
                
                t_lbl = "in this period"
                t_pct_lbl = "% from previous period"
            except Exception:
                this_p_start = today.replace(day=1)
                this_p_end = today + relativedelta(days=1)
                last_p_start = this_p_start - relativedelta(months=1)
                last_p_end = this_p_start
                t_lbl = "new this month"
                t_pct_lbl = "% from last month"
        else:
            this_p_start = today.replace(day=1)
            this_p_end = today + relativedelta(days=1)
            last_p_start = this_p_start - relativedelta(months=1)
            last_p_end = this_p_start
            t_lbl = "new this month"
            t_pct_lbl = "% from last month"

        trend_period = kwargs.get('trend_period', 'this_year')

        # Line Chart Data
        months = []
        created_trend = []
        completed_trend = []
        
        base_trend_domain = [('project_id', 'in', all_dashboard_projects.ids)] if all_dashboard_projects else [('id', '=', 0)]
        if employee_id:
            base_trend_domain.append(('user_ids', 'in', [int(employee_id)]))
        
        if trend_period == 'this_year':
            for i in range(1, 13):
                start_d = datetime(today.year, i, 1)
                end_d = start_d + relativedelta(months=1)
                months.append(start_d.strftime('%b'))
                created = env['project.task'].search_count(base_trend_domain + [('create_date', '>=', start_d), ('create_date', '<', end_d)])
                completed = env['project.task'].search_count(base_trend_domain + [('write_date', '>=', start_d), ('write_date', '<', end_d), ('state', '=', '1_done')])
                created_trend.append(created)
                completed_trend.append(completed)
        elif trend_period == 'last_year':
            last_year = today.year - 1
            for i in range(1, 13):
                start_d = datetime(last_year, i, 1)
                end_d = start_d + relativedelta(months=1)
                months.append(start_d.strftime('%b %y'))
                created = env['project.task'].search_count(base_trend_domain + [('create_date', '>=', start_d), ('create_date', '<', end_d)])
                completed = env['project.task'].search_count(base_trend_domain + [('write_date', '>=', start_d), ('write_date', '<', end_d), ('state', '=', '1_done')])
                created_trend.append(created)
                completed_trend.append(completed)
        else: # 6_months
            for i in range(5, -1, -1):
                start_d = today.replace(day=1) - relativedelta(months=i)
                end_d = start_d + relativedelta(months=1)
                months.append(start_d.strftime('%b'))
                created = env['project.task'].search_count(base_trend_domain + [('create_date', '>=', start_d), ('create_date', '<', end_d)])
                completed = env['project.task'].search_count(base_trend_domain + [('write_date', '>=', start_d), ('write_date', '<', end_d), ('state', '=', '1_done')])
                created_trend.append(created)
                completed_trend.append(completed)

        # Top Card Trends
        new_proj_count = len(all_dashboard_projects.filtered(lambda p: p.create_date and p.create_date >= this_p_start and p.create_date < this_p_end))
        
        base_t_domain = [('project_id', 'in', all_dashboard_projects.ids)] if all_dashboard_projects else [('id', '=', 0)]
        if employee_id:
            base_t_domain.append(('user_ids', 'in', [int(employee_id)]))
        base_tasks = env['project.task'].search(base_t_domain)

        t_this = len(base_tasks.filtered(lambda t: t.create_date and t.create_date >= this_p_start and t.create_date < this_p_end))
        t_last = len(base_tasks.filtered(lambda t: t.create_date and t.create_date >= last_p_start and t.create_date < last_p_end))
        t_trend_val = round((t_this - t_last) / max(t_last, 1) * 100)
        t_trend_val = min(t_trend_val, 100)  # Capped at a maximum of 100%

        # Completion Rate Trend: Current Rate minus Past Rate
        current_rate = round(total_done / total_tasks * 100) if total_tasks > 0 else 0
        past_tasks = base_tasks.filtered(lambda t: t.create_date and t.create_date < this_p_start)
        past_done = past_tasks.filtered(lambda t: t.write_date and t.write_date < this_p_start and t.state == '1_done')
        rate_last = round((len(past_done) / max(len(past_tasks), 1)) * 100)
        c_trend_val = current_rate - rate_last

        new_emp = env['res.users'].search_count([('create_date', '>=', this_p_start), ('create_date', '<', this_p_end), ('active', '=', True)])
        new_dept = env['hr.department'].search_count([('create_date', '>=', this_p_start), ('create_date', '<', this_p_end)])

        # ── Insights Generation ──────────────────────────────────────────────
        insights = []
        if department_list:
            top_dept = max(department_list, key=lambda x: x['progress'])
            if top_dept['progress'] > 0:
                insights.append({
                    'icon': '✅', 'color': '#38a169',
                    'text': f"{top_dept['name']} department has the highest completion rate ({top_dept['progress']}%)"
                })
        
        if total_blocked > 0:
            insights.append({
                'icon': '🕒', 'color': '#ed8936',
                'text': f"{total_blocked} tasks are delayed or blocked across {len(set(t.department_id for t in blocked_tasks))} departments"
            })
            
        if new_proj_count > 0:
            insights.append({
                'icon': '📁', 'color': '#4299e1',
                'text': f"{new_proj_count} new project{'s' if new_proj_count != 1 else ''} created {t_lbl.replace('new ', '')}"
            })
            
        if department_list:
            busiest_dept = max(department_list, key=lambda x: x['tasks'])
            if busiest_dept['tasks'] > 0:
                insights.append({
                    'icon': '🔥', 'color': '#e53e3e',
                    'text': f"{busiest_dept['name']} is the most active department with {busiest_dept['tasks']} tasks"
                })
                
        if employee_leaderboard:
            top_emp = employee_leaderboard[0]
            if top_emp['done'] > 0:
                insights.append({
                    'icon': '⭐', 'color': '#d69e2e',
                    'text': f"{top_emp['name']} is leading with {top_emp['done']} completed tasks"
                })
                
        if total_active > 0:
            insights.append({
                'icon': '⏳', 'color': '#ed8936',
                'text': f"There are currently {total_active} tasks in progress"
            })
            
        if c_trend_val > 0:
            insights.append({
                'icon': '📈', 'color': '#3182ce',
                'text': f"Overall completion rate improved by {c_trend_val}% {t_lbl.replace('new ', '')}"
            })
        elif total_done > 0:
            insights.append({
                'icon': '🎯', 'color': '#3182ce',
                'text': f"A total of {total_done} tasks have been successfully completed"
            })

        # ── Recent Activity (Mocked from latest tasks/projects) ───────────────
        import pytz
        user_tz = pytz.timezone(env.user.tz or 'UTC')

        def format_tz(dt):
            if not dt: return ''
            return pytz.utc.localize(dt).astimezone(user_tz).strftime('%d %b, %H:%M')

        recent_activity = []
        latest_tasks = tasks.sorted(key=lambda t: t.write_date, reverse=True)[:3]
        for t in latest_tasks:
            action = 'completed' if t in done_tasks else 'updated'
            recent_activity.append({
                'title': f"Task \"{t.name}\" {action}",
                'subtitle': f"by {t.write_uid.name if t.write_uid else 'System'}",
                'time': format_tz(t.write_date),
                'icon': '✅' if action == 'completed' else '✏️',
                'color': '#38a169' if action == 'completed' else '#4299e1',
                'res_model': 'project.task',
                'res_id': t.id
            })

        latest_projects = all_dashboard_projects.sorted(key=lambda p: p.create_date, reverse=True)[:2]
        for p in latest_projects:
            recent_activity.append({
                'title': f"New project \"{p.name}\" created",
                'subtitle': f"by {p.create_uid.name if p.create_uid else 'System'}",
                'time': format_tz(p.create_date),
                'icon': '📁',
                'color': '#805ad5',
                'res_model': 'project.project',
                'res_id': p.id
            })

        def t_obj(val, lbl, is_pct=False):
            return {
                'val': abs(val),
                'dir': 'up' if val >= 0 else 'down',
                'lbl': (str(abs(val)) + lbl) if is_pct else (str(abs(val)) + " " + lbl)
            }

        return {
            'projects': {
                'total': len(all_dashboard_projects),
                'trend': t_obj(new_proj_count, t_lbl),
            },
            'tasks': {
                'total': total_tasks,
                'trend': t_obj(t_trend_val, t_pct_lbl, is_pct=True),
                'completed': total_done,
                'completed_percent': round(total_done / total_tasks * 100) if total_tasks else 0,
                'in_progress': total_active,
                'in_progress_percent': round(total_active / total_tasks * 100) if total_tasks else 0,
            },
            'completion_rate': {
                'current': round(total_done / total_tasks * 100) if total_tasks else 0,
                'trend': t_obj(c_trend_val, t_pct_lbl, is_pct=True),
            },
            'employees': {
                'total': len(all_employees),
                'trend': t_obj(new_emp, t_lbl),
            },
            'departments': {
                'total': len(all_departments),
                'trend': t_obj(new_dept, t_lbl),
            },
            'department_list': department_list,
            'filters': {
                'departments': all_departments,
                'employees': all_employees,
            },
            'charts': {
                'department_performance': {
                    'labels': dept_perf_labels,
                    'data': dept_perf_data,
                    'label': 'Tasks Done' if dept_sort == 'tasks_done' else 'Completion %'
                },
                'employee_leaderboard': employee_leaderboard,
                'task_status': {
                    'labels': ['Completed', 'In Progress', 'Blocked'],
                    'data': [total_done, total_active, total_blocked]
                },
                'project_status': {
                    'labels': ['Completed', 'In Progress', 'On Hold'],
                    'data': [len(projects_completed), len(projects_in_progress), len(projects_on_hold)]
                },
                'department_task_analysis': {
                    'labels': dept_task_labels,
                    'data': dept_task_data,
                },
                'monthly_trend': {
                    'labels': months,
                    'created': created_trend,
                    'completed': completed_trend,
                }
            },
            'insights': insights,
            'recent_activity': recent_activity,
        }