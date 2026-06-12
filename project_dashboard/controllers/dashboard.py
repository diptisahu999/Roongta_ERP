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

        completed_projects  = projects.filtered(lambda p: p.stage_id and p.stage_id.fold)
        on_hold_projects    = projects.filtered(lambda p: not (p.stage_id and p.stage_id.fold) and p.last_update_status == 'on_hold')
        in_progress_projects = projects - completed_projects - on_hold_projects

        done_tasks    = tasks.filtered(lambda t: t.state == '1_done')
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
            p_done    = p_tasks.filtered(lambda t: t.state == '1_done')
            p_blocked = p_tasks.filtered(
                lambda t: not t.is_closed and t.state == '04_waiting_normal'
            )
            p_active  = p_tasks - p_done - p_blocked
            total     = len(p_tasks)
            status    = project.last_update_status or 'on_track'
            if project.stage_id and project.stage_id.fold:
                progress = 100
            else:
                progress = round(len(p_done) / total * 100) if total > 0 else 0

            project_list.append({
                'id':                project.id,
                'name':              project.name,
                'customer':          project.partner_id.name if project.partner_id else '',
                'manager':           project.user_id.name if project.user_id else '',
                'tasks_total':       total,
                'tasks_done':        len(p_done),
                'tasks_in_progress': len(p_active),
                'tasks_blocked':     len(p_blocked),
                'progress':          progress,
                'status':            status,
                'status_label':      'Completed' if (project.stage_id and project.stage_id.fold) else STATUS_LABELS.get(
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
                'done':        len(done_tasks),
                'in_progress': len(active_tasks),
                'blocked':     len(blocked_tasks),
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