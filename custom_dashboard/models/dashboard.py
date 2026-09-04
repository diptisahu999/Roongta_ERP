# -*- coding: utf-8 -*-
from odoo import models, api, fields
from datetime import datetime, date, timedelta
import pytz

class CustomDashboard(models.AbstractModel):
    _name = 'custom.dashboard'
    _description = 'Custom Dashboard Backend'

    def _is_done(self, task):
        if not task:
            return False
        if getattr(task, 'state', '') in ['1_done', '1_canceled']:
            return True
        st_name = (task.stage_id.name or '').strip().lower() if task.stage_id else ''
        if st_name in ['done', 'completed', 'task completed', 'task complete', 'work done', 'pass', "md's approval done", 'closed', 'finished']:
            return True
        if any(w in st_name for w in ['complete', 'done', 'closed', 'finished']) and not any(w in st_name for w in ['pending', 'cancel', 'fail', 'hold']):
            return True
        if task.stage_id and (task.stage_id.fold or getattr(task.stage_id, 'is_closed', False)) and not any(w in st_name for w in ['cancel', 'fail', 'hold', 'pending']):
            return True
        if str(getattr(task, 'task_progress', '')).strip() == '100' or getattr(task, 'task_progress_rate', 0.0) >= 100.0:
            return True
        return False

    def _is_hold_or_blocked(self, task):
        if not task:
            return False
        if getattr(task, 'state', '') == '04_waiting_normal' or getattr(task, 'kanban_state', '') == 'blocked':
            return True
        st_name = (task.stage_id.name or '').strip().lower() if task.stage_id else ''
        if st_name in ['hold', 'on hold', 'on_hold', 'blocked']:
            return True
        return False

    def _is_overdue(self, task, today_date):
        if not task or self._is_done(task):
            return False
        if task.date_deadline:
            dd = task.date_deadline.date() if isinstance(task.date_deadline, datetime) else task.date_deadline
            return dd < today_date
        return False

    def _is_due_today(self, task, today_date):
        if not task or self._is_done(task):
            return False
        if task.date_deadline:
            dd = task.date_deadline.date() if isinstance(task.date_deadline, datetime) else task.date_deadline
            return dd == today_date
        return False

    def _is_due_this_week(self, task, today_date):
        if not task or self._is_done(task):
            return False
        if task.date_deadline:
            dd = task.date_deadline.date() if isinstance(task.date_deadline, datetime) else task.date_deadline
            return today_date <= dd <= (today_date + timedelta(days=7))
        return False

    @api.model
    def get_dashboard_data(self, filters=None):
        filters = filters or {}
        user = self.env.user
        company = self.env.company
        today = fields.Date.context_today(self)
        now = fields.Datetime.now()

        # Dynamic Greeting based on server/user time
        user_tz = pytz.timezone(user.tz or 'UTC')
        current_time_user = datetime.now(user_tz)
        hour = current_time_user.hour
        if hour < 12:
            greeting_time = "Good Morning"
        elif hour < 17:
            greeting_time = "Good Afternoon"
        else:
            greeting_time = "Good Evening"
        
        user_name = user.name.split()[0] if user.name else "User"
        greeting = f"{greeting_time}, {user_name} 👋"

        # User Profile info
        user_info = {
            'id': user.id,
            'name': user.name,
            'first_name': user_name,
            'greeting': greeting,
            'role': 'Admin' if user.has_group('base.group_system') or user.has_group('project.group_project_manager') else 'Member',
            'avatar_url': f"/web/image/res.users/{user.id}/avatar_128",
            'unread_notifications': 4,
        }
        is_admin = user.has_group('base.group_system') or user.has_group('project.group_project_manager')

        # Query base accessible tasks respecting user access rights
        Task = self.env['project.task']
        user_accessible_tasks = Task.search([('active', '=', True)])

        # Available Filters Data based on user role and accessible records
        assignee_domain = [('share', '=', False)]
        department_id_filter = filters.get('department_id')
        if department_id_filter:
            if 'department_id' in self.env['res.users']._fields:
                assignee_domain.append(('department_id', '=', int(department_id_filter)))
            elif 'hr.employee' in self.env:
                dept_employees = self.env['hr.employee'].sudo().search([('department_id', '=', int(department_id_filter))])
                dept_user_ids = dept_employees.mapped('user_id').ids
                assignee_domain.append(('id', 'in', dept_user_ids))

        if is_admin:
            if 'project.firm' in self.env:
                all_firms = self.env['project.firm'].sudo().search([])
                companies = [{'id': f.id, 'name': f.name} for f in all_firms]
            else:
                companies = self.env['res.company'].search_read([], ['id', 'name'])
            departments = self.env['hr.department'].search_read([], ['id', 'name']) if 'hr.department' in self.env else []
            assignees = self.env['res.users'].search_read(assignee_domain, ['id', 'name'])
        else:
            # For regular users and managers, only show companies/firms associated with their accessible tasks
            user_task_tags = set(user_accessible_tasks.mapped('tag_ids').ids)
            if 'project.firm' in self.env:
                all_firms = self.env['project.firm'].sudo().search([])
                companies = [{'id': f.id, 'name': f.name} for f in all_firms if (set(f.tag_ids.ids) & user_task_tags) or not f.tag_ids]
                if not companies:
                    companies = [{'id': f.id, 'name': f.name} for f in all_firms]
            else:
                user_comp_ids = user_accessible_tasks.mapped('company_id').ids or [user.company_id.id]
                companies = self.env['res.company'].search_read([('id', 'in', user_comp_ids)], ['id', 'name'])

            user_dept_ids = user_accessible_tasks.mapped('department_id').ids
            departments = self.env['hr.department'].search_read([('id', 'in', user_dept_ids)], ['id', 'name']) if (user_dept_ids and 'hr.department' in self.env) else []
            user_assignee_ids = user_accessible_tasks.mapped('user_ids').ids or [user.id]
            assignee_domain.append(('id', 'in', user_assignee_ids))
            assignees = self.env['res.users'].search_read(assignee_domain, ['id', 'name'])

        # Build Domain for Project Tasks based on filters
        domain = [('active', '=', True)]
        
        company_id = filters.get('company_id')
        if company_id:
            if 'project.firm' in self.env:
                sel_firm = self.env['project.firm'].sudo().browse(int(company_id))
                if sel_firm.exists() and sel_firm.tag_ids:
                    domain.append(('tag_ids', 'in', sel_firm.tag_ids.ids))
                else:
                    domain.append(('company_id', '=', int(company_id)))
            else:
                domain.append(('company_id', '=', int(company_id)))

        department_id = filters.get('department_id')
        if department_id and 'department_id' in self.env['project.task']._fields:
            domain.append(('department_id', '=', int(department_id)))

        user_id = filters.get('user_id')
        if user_id:
            domain.append(('user_ids', 'in', [int(user_id)]))

        # Time range filter
        date_range = filters.get('date_range', 'all')
        start_date = None
        end_date = None
        if date_range == 'today':
            start_date = today
            end_date = today
        elif date_range == 'this_week':
            start_date = today - timedelta(days=today.weekday())
            end_date = start_date + timedelta(days=6)
        elif date_range == 'this_month':
            start_date = today.replace(day=1)
            next_month = (today.replace(day=28) + timedelta(days=4)).replace(day=1)
            end_date = next_month - timedelta(days=1)

        # Query filtered tasks
        tasks = Task.search(domain)
        
        if start_date and end_date and date_range != 'all':
            tasks = tasks.filtered(lambda t: (
                (t.date_deadline and start_date <= (t.date_deadline.date() if isinstance(t.date_deadline, datetime) else t.date_deadline) <= end_date) or
                (t.create_date and start_date <= t.create_date.date() <= end_date) or
                (t.write_date and start_date <= t.write_date.date() <= end_date)
            ))

        task_count = len(tasks)

        # Compute KPIs with exact ERP stage and progress checks
        done_tasks = tasks.filtered(lambda t: self._is_done(t))
        completed_count = len(done_tasks)

        blocked_tasks = tasks.filtered(lambda t: self._is_hold_or_blocked(t) and not self._is_done(t))
        blocked_count = len(blocked_tasks)

        in_progress_tasks = tasks.filtered(lambda t: not self._is_done(t) and not self._is_hold_or_blocked(t))
        in_progress_count = len(in_progress_tasks)

        overdue_tasks = tasks.filtered(lambda t: self._is_overdue(t, today))
        overdue_count = len(overdue_tasks)

        due_today_tasks = tasks.filtered(lambda t: self._is_due_today(t, today))
        due_today_count = len(due_today_tasks)

        due_this_week_tasks = tasks.filtered(lambda t: self._is_due_this_week(t, today))
        due_this_week_count = len(due_this_week_tasks)

        awaiting_approval_tasks = tasks.filtered(lambda t: getattr(t, 'state', False) in ['02_changes_requested', '03_approved'] or 'approval' in (t.stage_id.name or '').lower())
        awaiting_approval_count = len(awaiting_approval_tasks)

        high_priority_due_today = len(due_today_tasks.filtered(lambda t: t.priority in ['2', '3']))

        total_tasks_val = task_count
        in_progress_val = in_progress_count
        completed_val = completed_count
        due_today_val = due_today_count
        overdue_val = overdue_count
        pending_val = max(0, total_tasks_val - completed_val - in_progress_val - blocked_count)
        blocked_val = blocked_count
        awaiting_val = awaiting_approval_count
        due_this_week_val = due_this_week_count
        overall_progress_val = round((completed_val / total_tasks_val * 100)) if total_tasks_val > 0 else 0

        kpis = {
            'total_tasks': {
                'value': total_tasks_val,
                'trend': '↑ 12% vs last week' if total_tasks_val > 0 else '-',
                'trend_type': 'up',
            },
            'in_progress': {
                'value': in_progress_val,
                'subtext': f"{round(in_progress_val / total_tasks_val * 100) if total_tasks_val else 0}% of total",
            },
            'completed': {
                'value': completed_val,
                'subtext': f"{round(completed_val / total_tasks_val * 100) if total_tasks_val else 0}% completion",
            },
            'due_today': {
                'value': f"{due_today_val:02d}" if isinstance(due_today_val, int) else due_today_val,
                'subtext': f"{high_priority_due_today} high priority",
            },
            'overdue': {
                'value': overdue_val,
                'trend': f"↑ {overdue_val} total" if overdue_val > 0 else '-',
                'trend_type': 'danger',
            }
        }

        # Overall Task Progress Breakdown
        progress_breakdown = {
            'percentage': overall_progress_val,
            'completed': completed_val,
            'in_progress': in_progress_val,
            'pending': pending_val,
            'blocked': blocked_val,
            'total': total_tasks_val,
        }

        # Attention Required
        attention_required = [
            {'id': 'overdue', 'name': 'Overdue Tasks', 'count': overdue_val, 'icon': 'exclamation', 'color': '#ef4444', 'bg_color': '#fee2e2'},
            {'id': 'due_today', 'name': 'Due Today', 'count': due_today_val, 'icon': 'calendar-check', 'color': '#f97316', 'bg_color': '#ffedd5'},
            {'id': 'due_this_week', 'name': 'Due This Week', 'count': due_this_week_val, 'icon': 'clock', 'color': '#f59e0b', 'bg_color': '#fef3c7'},
            {'id': 'blocked', 'name': 'Blocked Tasks', 'count': blocked_val, 'icon': 'ban', 'color': '#1e293b', 'bg_color': '#f1f5f9'},
            {'id': 'awaiting_approval', 'name': 'Awaiting Approval', 'count': awaiting_val, 'icon': 'user-check', 'color': '#3b82f6', 'bg_color': '#dbeafe'},
        ]

        # Team Workload by Department
        team_workload = []
        if departments:
            for dept in departments[:5]:
                dept_tasks = tasks.filtered(lambda t: getattr(t, 'department_id', None) and t.department_id.id == dept['id'])
                total_dept_tasks = len(dept_tasks)
                if total_dept_tasks == 0:
                    continue
                dept_done = len(dept_tasks.filtered(lambda t: self._is_done(t)))
                pct = round((dept_done / total_dept_tasks) * 100) if total_dept_tasks else 0
                
                dept_rec = self.env['hr.department'].browse(dept['id'])
                manager_user = dept_rec.manager_id.user_id if dept_rec.manager_id and dept_rec.manager_id.user_id else False
                task_users = dept_tasks.mapped('user_ids').filtered(lambda u: u.id != 1)
                
                lead_user = manager_user or (task_users[:1] if task_users else False) or user
                lead_avatar = f"/web/image?model=res.users&field=avatar_128&id={lead_user.id}" if lead_user else f"/web/image/res.users/{user.id}/avatar_128"
                
                dept_members_users = (task_users | (manager_user if manager_user else self.env['res.users'])).filtered(lambda u: u.id != 1)
                members = []
                for u in dept_members_users[:4]:
                    members.append({
                        'id': u.id,
                        'name': u.name,
                        'avatar': f"/web/image?model=res.users&field=avatar_128&id={u.id}",
                        'initial': (u.name or 'U')[:1].upper(),
                    })

                if not members and lead_user:
                    members = [{
                        'id': lead_user.id,
                        'name': lead_user.name,
                        'avatar': f"/web/image?model=res.users&field=avatar_128&id={lead_user.id}",
                        'initial': (lead_user.name or 'U')[:1].upper(),
                    }]

                team_workload.append({
                    'id': dept['id'],
                    'name': dept['name'],
                    'done_tasks': dept_done,
                    'total_tasks': total_dept_tasks,
                    'percentage': pct,
                    'avatar_text': dept['name'][:2].upper(),
                    'lead_avatar': lead_avatar,
                    'members': members,
                })

        # Overdue Tasks Table Data
        overdue_table_groups = []
        if overdue_tasks:
            group_dict = {}
            for ot in overdue_tasks[:30]:
                assignee_name = ot.user_ids[0].name if ot.user_ids else (ot.create_uid.name or 'Unassigned')
                assignee_key = assignee_name
                if assignee_key not in group_dict:
                    group_dict[assignee_key] = []
                
                days_open = (today - ot.create_date.date()).days if ot.create_date else 0
                deadline_str = ot.date_deadline.strftime('%d/%m/%Y') if ot.date_deadline else '-'
                progress_val = int(getattr(ot, 'task_progress_rate', getattr(ot, 'progress', 0)) or 0)
                
                group_dict[assignee_key].append({
                    'id': ot.id,
                    'title': ot.name,
                    'project': ot.project_id.name if ot.project_id else 'No Project',
                    'created_by': ot.create_uid.name or 'Admin',
                    'created_by_initial': (ot.create_uid.name or 'A')[:1].upper(),
                    'assignees': [{'name': u.name, 'initial': u.name[:1].upper()} for u in ot.user_ids] or [{'name': 'Unassigned', 'initial': 'U'}],
                    'progress': progress_val,
                    'days_open': days_open,
                    'date_deadline': deadline_str,
                    'next_activity': 'Today' if ot.activity_ids else '-',
                    'tag': ot.single_tag_id.name if getattr(ot, 'single_tag_id', False) else (ot.tag_ids[0].name if ot.tag_ids else 'General'),
                    'stage': ot.stage_id.name if ot.stage_id else 'To Do',
                    'is_starred': bool(ot.priority and ot.priority != '0'),
                })
            
            for grp_name, t_list in group_dict.items():
                overdue_table_groups.append({
                    'name': grp_name,
                    'count': len(t_list),
                    'tasks': t_list
                })

        # Task Completion Trend (7 days)
        trend_days = []
        day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        monday = today - timedelta(days=today.weekday())
        
        for i in range(7):
            d = monday + timedelta(days=i)
            d_done = len(tasks.filtered(lambda t: t.date_last_stage_update and t.date_last_stage_update.date() == d and self._is_done(t)))
            trend_days.append({
                'day': day_names[i],
                'date': d.strftime('%d %b'),
                'count': d_done,
                'is_peak': False,
            })
        
        # Determine highest day as peak if any done tasks exist
        if any(td['count'] > 0 for td in trend_days):
            max_pt = max(trend_days, key=lambda td: td['count'])
            max_pt['is_peak'] = True

        # Recent Activity Feed
        recent_activity = []
        recent_tasks = tasks.sorted(key=lambda t: t.write_date or t.create_date, reverse=True)[:6]
        for idx, rt in enumerate(recent_tasks):
            act_user = rt.write_uid.name or rt.create_uid.name or 'User'
            act_time = rt.write_date.strftime('%I:%M %p') if rt.write_date else 'Today'
            if self._is_done(rt):
                act_icon = 'check-circle'
                act_color = '#10b981'
                act_text = f"completed '{rt.name}'"
            elif self._is_hold_or_blocked(rt):
                act_icon = 'edit-3'
                act_color = '#ef4444'
                act_text = f"marked '{rt.name}' as blocked"
            else:
                act_icon = 'plus-circle'
                act_color = '#6366f1'
                act_text = f"updated '{rt.name}'"
            
            recent_activity.append({
                'id': rt.id or idx,
                'time': act_time,
                'user': act_user,
                'action': act_text,
                'type': 'updated',
                'color': act_color,
                'icon': act_icon,
            })

        task_ids_map = {
            'all': tasks.ids,
            'in_progress': in_progress_tasks.ids,
            'completed': done_tasks.ids,
            'due_today': due_today_tasks.ids,
            'overdue': overdue_tasks.ids,
            'due_this_week': due_this_week_tasks.ids,
            'blocked': blocked_tasks.ids,
            'awaiting_approval': awaiting_approval_tasks.ids,
        }

        return {
            'user_info': user_info,
            'companies': companies,
            'departments': departments,
            'assignees': assignees,
            'kpis': kpis,
            'progress_breakdown': progress_breakdown,
            'attention_required': attention_required,
            'team_workload': team_workload,
            'overdue_table_groups': overdue_table_groups,
            'trend_data': trend_days,
            'recent_activity': recent_activity,
            'task_ids_map': task_ids_map,
        }
