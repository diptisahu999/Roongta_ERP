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
        if task.stage_id and (getattr(task.stage_id, 'fold', False) or getattr(task.stage_id, 'is_closed', False)) and not any(w in st_name for w in ['cancel', 'fail', 'hold', 'pending']):
            return True
        if str(getattr(task, 'task_progress', '')).strip() == '100' or getattr(task, 'task_progress_rate', 0.0) >= 100.0:
            return True
        return False

    def _is_hold_or_blocked(self, task):
        if not task:
            return False
        if getattr(task, 'state', '') == '04_waiting_normal':
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
        current_date_formatted = current_time_user.strftime('%A, %d %b %Y')

        # User Profile info
        user_info = {
            'id': user.id,
            'name': user.name,
            'first_name': user_name,
            'greeting': greeting,
            'current_date_formatted': current_date_formatted,
            'role': 'Admin' if user.has_group('base.group_system') or user.has_group('project.group_project_manager') else 'Member',
            'avatar_url': f"/web/image/res.users/{user.id}/avatar_128",
            'unread_notifications': 4,
        }

        # 1. Pre-categorize stages once to eliminate repeated string/field parsing in loops
        all_stages = self.env['project.task.type'].search_read([], ['id', 'name', 'fold'])
        done_stage_ids = set()
        blocked_stage_ids = set()
        approval_stage_ids = set()

        for st in all_stages:
            s_id = st['id']
            st_name = (st.get('name') or '').strip().lower()
            is_st_done = False
            if st_name in ['done', 'completed', 'task completed', 'task complete', 'work done', 'pass', "md's approval done", 'closed', 'finished']:
                is_st_done = True
            elif any(w in st_name for w in ['complete', 'done', 'closed', 'finished']) and not any(w in st_name for w in ['pending', 'cancel', 'fail', 'hold']):
                is_st_done = True
            elif st.get('fold') and not any(w in st_name for w in ['cancel', 'fail', 'hold', 'pending']):
                is_st_done = True

            if is_st_done:
                done_stage_ids.add(s_id)

            if st_name in ['hold', 'on hold', 'on_hold', 'blocked']:
                blocked_stage_ids.add(s_id)

            if 'approval' in st_name:
                approval_stage_ids.add(s_id)

        # 2. Query filter options directly and efficiently without scanning project.task
        assignee_domain = [('share', '=', False), ('active', '=', True)]
        department_id_filter = filters.get('department_id')
        if department_id_filter:
            if 'department_id' in self.env['res.users']._fields:
                assignee_domain.append(('department_id', '=', int(department_id_filter)))
            elif 'hr.employee' in self.env:
                dept_employees = self.env['hr.employee'].sudo().search([('department_id', '=', int(department_id_filter))])
                dept_user_ids = dept_employees.mapped('user_id').ids
                assignee_domain.append(('id', 'in', dept_user_ids))

        if 'project.firm' in self.env:
            companies = self.env['project.firm'].sudo().search_read([], ['id', 'name'], order='name asc')
        else:
            allowed_comp_ids = self.env.companies.ids
            companies = self.env['res.company'].search_read([('id', 'in', allowed_comp_ids)], ['id', 'name'], order='name asc')

        departments = self.env['hr.department'].search_read([], ['id', 'name'], order='name asc') if 'hr.department' in self.env else []
        assignees = self.env['res.users'].search_read(assignee_domain, ['id', 'name'], order='name asc', limit=150)

        # 3. Build optimized search domain for Project Tasks
        Task = self.env['project.task']
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
        if department_id and 'department_id' in Task._fields:
            domain.append(('department_id', '=', int(department_id)))

        user_id = filters.get('user_id')
        if user_id:
            domain.append(('user_ids', 'in', [int(user_id)]))

        # Quick Scope Filter (All Tasks, My Tasks, Due This Week, High Priority)
        custom_view = filters.get('custom_view', 'all')
        if custom_view == 'my_tasks':
            domain.append(('user_ids', 'in', [user.id]))
        elif custom_view == 'due_this_week':
            domain += [
                ('date_deadline', '>=', today),
                ('date_deadline', '<=', today + timedelta(days=7)),
            ]
        elif custom_view == 'high_priority':
            domain.append(('priority', 'in', ['2', '3']))

        # Time range filter directly inside the PostgreSQL domain
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

        if start_date and end_date and date_range != 'all':
            start_dt = datetime.combine(start_date, datetime.min.time())
            end_dt = datetime.combine(end_date, datetime.max.time())
            domain += [
                '|',
                '&', ('date_deadline', '>=', start_date), ('date_deadline', '<=', end_date),
                '&', ('create_date', '>=', start_dt), ('create_date', '<=', end_dt),
            ]

        # 4. Fetch only valid, existing fields directly using search_read
        candidate_fields = [
            'id', 'name', 'state', 'stage_id', 'date_deadline',
            'department_id', 'user_ids', 'priority', 'date_last_stage_update',
            'create_date', 'create_uid', 'task_progress_rate', 'task_progress', 'progress'
        ]
        task_fields = [f for f in candidate_fields if f in Task._fields]

        tasks = Task.search_read(domain, task_fields)
        total_tasks_val = len(tasks)

        # 5. Single linear pass aggregation over the task dictionaries
        done_task_ids = []
        blocked_task_ids = []
        in_progress_task_ids = []
        overdue_task_ids = []
        due_today_task_ids = []
        due_this_week_task_ids = []
        awaiting_approval_task_ids = []
        high_priority_due_today = 0

        # Department aggregation: dept_id -> {'total': count, 'done': count, 'user_ids': set()}
        dept_stats = {}
        # Completion trend aggregation: date -> count
        trend_done_counts = {}

        for t in tasks:
            t_id = t['id']
            stage_tuple = t.get('stage_id')
            stage_id = stage_tuple[0] if stage_tuple else False
            state = t.get('state') or ''

            prog_val = t.get('task_progress_rate') or t.get('task_progress') or t.get('progress') or 0.0
            try:
                prog_num = float(prog_val)
            except (ValueError, TypeError):
                prog_num = 0.0

            # Done check
            is_done = (
                state in ['1_done', '1_canceled'] or
                stage_id in done_stage_ids or
                prog_num >= 100.0
            )

            # Blocked check (Odoo 18 state '04_waiting_normal' or blocked stage)
            is_blocked = not is_done and (
                state == '04_waiting_normal' or
                stage_id in blocked_stage_ids
            )

            # Categorize status
            if is_done:
                done_task_ids.append(t_id)
                dlsu = t.get('date_last_stage_update')
                if dlsu:
                    d_val = dlsu.date() if isinstance(dlsu, (datetime, date)) else (datetime.strptime(str(dlsu)[:10], '%Y-%m-%d').date() if str(dlsu)[:10] else None)
                    if d_val:
                        trend_done_counts[d_val] = trend_done_counts.get(d_val, 0) + 1
            elif is_blocked:
                blocked_task_ids.append(t_id)
            else:
                in_progress_task_ids.append(t_id)

            # Deadline checks (for active / uncompleted tasks)
            dd = t.get('date_deadline')
            if dd and not is_done:
                dd_val = dd if isinstance(dd, date) else (datetime.strptime(str(dd)[:10], '%Y-%m-%d').date() if str(dd)[:10] else None)
                if dd_val:
                    if dd_val < today:
                        overdue_task_ids.append(t_id)
                    elif dd_val == today:
                        due_today_task_ids.append(t_id)
                        if (t.get('priority') or '0') in ['2', '3']:
                            high_priority_due_today += 1

                    if today <= dd_val <= (today + timedelta(days=7)):
                        due_this_week_task_ids.append(t_id)

            # Awaiting Approval check
            if state in ['02_changes_requested', '03_approved'] or stage_id in approval_stage_ids:
                awaiting_approval_task_ids.append(t_id)

            # Department stats aggregation
            dept_tuple = t.get('department_id')
            if dept_tuple:
                d_id = dept_tuple[0]
                if d_id not in dept_stats:
                    dept_stats[d_id] = {'total': 0, 'done': 0, 'user_ids': set()}
                dept_stats[d_id]['total'] += 1
                if is_done:
                    dept_stats[d_id]['done'] += 1
                for u_id in (t.get('user_ids') or []):
                    if u_id != 1:
                        dept_stats[d_id]['user_ids'].add(u_id)

        completed_count = len(done_task_ids)
        blocked_count = len(blocked_task_ids)
        in_progress_count = len(in_progress_task_ids)
        overdue_count = len(overdue_task_ids)
        due_today_count = len(due_today_task_ids)
        due_this_week_count = len(due_this_week_task_ids)
        awaiting_approval_count = len(awaiting_approval_task_ids)

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

        # 6. Team Workload by Department (Optimized: No N+1 queries, batch fetch)
        team_workload = []
        if dept_stats and 'hr.department' in self.env:
            dept_ids = list(dept_stats.keys())
            dept_records = self.env['hr.department'].sudo().browse(dept_ids)

            needed_user_ids = set()
            for d in dept_records:
                if d.manager_id and d.manager_id.user_id:
                    needed_user_ids.add(d.manager_id.user_id.id)
                needed_user_ids.update(dept_stats.get(d.id, {}).get('user_ids', set()))
            needed_user_ids.discard(1)

            users_map = {}
            if needed_user_ids:
                user_records = self.env['res.users'].sudo().search_read(
                    [('id', 'in', list(needed_user_ids))],
                    ['id', 'name']
                )
                users_map = {u['id']: u['name'] for u in user_records}

            for dept_rec in dept_records:
                d_id = dept_rec.id
                d_stat = dept_stats[d_id]
                total_dept_tasks = d_stat['total']
                if total_dept_tasks == 0:
                    continue
                dept_done = d_stat['done']
                pct = round((dept_done / total_dept_tasks) * 100) if total_dept_tasks else 0

                manager_user_id = dept_rec.manager_id.user_id.id if (dept_rec.manager_id and dept_rec.manager_id.user_id) else False
                task_user_ids = list(d_stat['user_ids'])

                lead_user_id = manager_user_id or (task_user_ids[0] if task_user_ids else False) or user.id
                lead_avatar = f"/web/image?model=res.users&field=avatar_128&id={lead_user_id}"

                members = []
                member_user_ids = []
                if manager_user_id and manager_user_id in users_map:
                    member_user_ids.append(manager_user_id)
                for u_id in task_user_ids:
                    if u_id not in member_user_ids and u_id in users_map:
                        member_user_ids.append(u_id)

                for u_id in member_user_ids[:4]:
                    u_name = users_map.get(u_id, 'User')
                    members.append({
                        'id': u_id,
                        'name': u_name,
                        'avatar': f"/web/image?model=res.users&field=avatar_128&id={u_id}",
                        'initial': (u_name or 'U')[:1].upper(),
                    })

                if not members and lead_user_id:
                    lead_name = users_map.get(lead_user_id, user.name or 'User')
                    members = [{
                        'id': lead_user_id,
                        'name': lead_name,
                        'avatar': f"/web/image?model=res.users&field=avatar_128&id={lead_user_id}",
                        'initial': (lead_name or 'U')[:1].upper(),
                    }]

                status_text = 'Optimal'
                status_class = 'optimal'
                if pct < 75:
                    status_text = 'Heavy Load'
                    status_class = 'heavy-load'
                elif pct < 90:
                    status_text = 'On Track'
                    status_class = 'on-track'

                team_workload.append({
                    'id': d_id,
                    'name': dept_rec.name,
                    'done_tasks': dept_done,
                    'total_tasks': total_dept_tasks,
                    'percentage': pct,
                    'avatar_text': (dept_rec.name or 'D')[:1].upper(),
                    'lead_avatar': lead_avatar,
                    'members': members,
                    'status': status_text,
                    'status_class': status_class,
                })

        # 7. Overdue Tasks Table Data (Only fetch top 30 overdue tasks with batch activities query)
        overdue_table_groups = []
        if overdue_task_ids:
            overdue_sample_ids = overdue_task_ids[:30]
            ot_candidates = [
                'id', 'name', 'project_id', 'department_id', 'create_uid',
                'user_ids', 'create_date', 'date_deadline', 'stage_id', 'priority',
                'task_progress_rate', 'task_progress', 'progress', 'single_tag_id', 'tag_ids'
            ]
            ot_fields = [f for f in ot_candidates if f in Task._fields]
            overdue_records = Task.search_read([('id', 'in', overdue_sample_ids)], ot_fields)

            # Batch check activities to eliminate N+1 queries
            has_activity_ids = set()
            if 'mail.activity' in self.env:
                activities = self.env['mail.activity'].sudo().search_read([
                    ('res_model', '=', 'project.task'),
                    ('res_id', 'in', overdue_sample_ids)
                ], ['res_id'])
                has_activity_ids = {act['res_id'] for act in activities}

            # Batch pre-fetch user names for assignees
            all_ot_user_ids = set()
            for ot in overdue_records:
                for u_id in (ot.get('user_ids') or []):
                    all_ot_user_ids.add(u_id)
            user_name_cache = {}
            if all_ot_user_ids:
                u_data = self.env['res.users'].sudo().search_read([('id', 'in', list(all_ot_user_ids))], ['id', 'name'])
                user_name_cache = {u['id']: u['name'] for u in u_data}

            group_dict = {}
            for ot in overdue_records:
                assignee_ids = ot.get('user_ids') or []
                if assignee_ids:
                    first_uid = assignee_ids[0]
                    assignee_name = user_name_cache.get(first_uid, 'Assigned')
                else:
                    creator_tuple = ot.get('create_uid')
                    assignee_name = creator_tuple[1] if creator_tuple else 'Unassigned'

                assignee_key = assignee_name
                if assignee_key not in group_dict:
                    group_dict[assignee_key] = []

                c_date = ot.get('create_date')
                if c_date:
                    c_val = c_date.date() if isinstance(c_date, (datetime, date)) else datetime.strptime(str(c_date)[:10], '%Y-%m-%d').date()
                    days_open = (today - c_val).days
                else:
                    days_open = 0

                dd_raw = ot.get('date_deadline')
                if dd_raw:
                    dd_dt = dd_raw if isinstance(dd_raw, (datetime, date)) else datetime.strptime(str(dd_raw)[:10], '%Y-%m-%d').date()
                    deadline_str = dd_dt.strftime('%d/%m/%Y')
                else:
                    deadline_str = '-'

                prog_val = int(ot.get('task_progress_rate') or ot.get('task_progress') or ot.get('progress') or 0)
                creator_name = ot.get('create_uid')[1] if ot.get('create_uid') else 'Admin'

                assignees_list = []
                for uid in assignee_ids:
                    u_n = user_name_cache.get(uid, 'User')
                    assignees_list.append({'name': u_n, 'initial': (u_n or 'U')[:1].upper()})
                if not assignees_list:
                    assignees_list = [{'name': 'Unassigned', 'initial': 'U'}]

                single_tag = ot.get('single_tag_id')
                tag_ids = ot.get('tag_ids')
                if single_tag:
                    tag_display = single_tag[1]
                elif tag_ids and len(tag_ids) > 0:
                    tag_rec = self.env['project.tags'].sudo().browse(tag_ids[0]) if 'project.tags' in self.env else None
                    tag_display = tag_rec.name if (tag_rec and tag_rec.exists()) else 'General'
                else:
                    tag_display = 'General'

                group_dict[assignee_key].append({
                    'id': ot['id'],
                    'title': ot.get('name') or '',
                    'project': ot.get('project_id')[1] if ot.get('project_id') else 'No Project',
                    'department': ot.get('department_id')[1] if ot.get('department_id') else '',
                    'created_by': creator_name,
                    'created_by_initial': (creator_name or 'A')[:1].upper(),
                    'assignees': assignees_list,
                    'progress': prog_val,
                    'days_open': days_open,
                    'date_deadline': deadline_str,
                    'next_activity': 'Today' if ot['id'] in has_activity_ids else '-',
                    'tag': tag_display,
                    'stage': ot.get('stage_id')[1] if ot.get('stage_id') else 'To Do',
                    'is_starred': bool(ot.get('priority') and ot.get('priority') != '0'),
                })

            for grp_name, t_list in group_dict.items():
                overdue_table_groups.append({
                    'name': grp_name,
                    'count': len(t_list),
                    'tasks': t_list
                })

        # 8. Task Completion Trend (O(1) lookups from trend_done_counts)
        trend_period = filters.get('trend_period', '7_days')
        trend_days = []
        day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

        if trend_period == '30_days':
            start_30 = today - timedelta(days=29)
            for i in range(30):
                d = start_30 + timedelta(days=i)
                d_done = trend_done_counts.get(d, 0)
                trend_days.append({
                    'day': d.strftime('%d %b') if (i % 5 == 0 or i == 29) else '',
                    'date': d.strftime('%d %b'),
                    'count': d_done,
                    'is_peak': False,
                })
        else:
            monday = today - timedelta(days=today.weekday())
            for i in range(7):
                d = monday + timedelta(days=i)
                d_done = trend_done_counts.get(d, 0)
                trend_days.append({
                    'day': day_names[i],
                    'date': d.strftime('%d %b'),
                    'count': d_done,
                    'is_peak': False,
                })

        if any(td['count'] > 0 for td in trend_days):
            max_pt = max(trend_days, key=lambda td: td['count'])
            max_pt['is_peak'] = True

        # 9. Recent Activity Feed (Limit to 4 using index-optimized query)
        recent_activity = []
        recent_candidates = ['id', 'name', 'write_date', 'create_date', 'write_uid', 'create_uid', 'stage_id', 'state']
        recent_fields = [f for f in recent_candidates if f in Task._fields]
        recent_tasks = Task.search_read(
            domain,
            recent_fields,
            order='write_date desc, id desc',
            limit=4
        )
        for idx, rt in enumerate(recent_tasks):
            act_user = rt.get('write_uid')[1] if rt.get('write_uid') else (rt.get('create_uid')[1] if rt.get('create_uid') else 'User')
            rt_write_date = rt.get('write_date')
            if rt_write_date:
                w_dt = rt_write_date if isinstance(rt_write_date, datetime) else datetime.strptime(str(rt_write_date)[:19], '%Y-%m-%d %H:%M:%S')
                local_dt = pytz.utc.localize(w_dt).astimezone(user_tz)
                act_time = local_dt.strftime('%I:%M %p')
            else:
                act_time = 'Today'

            st_id = rt.get('stage_id')[0] if rt.get('stage_id') else False
            st_state = rt.get('state') or ''

            rt_is_done = (st_state in ['1_done', '1_canceled'] or st_id in done_stage_ids)
            rt_is_blocked = (st_state == '04_waiting_normal' or st_id in blocked_stage_ids)
            rt_name = rt.get('name') or 'Task'

            if rt_is_done:
                act_icon = 'check-circle'
                act_color = '#10b981'
                act_text = f"completed '{rt_name}'"
            elif rt_is_blocked:
                act_icon = 'edit-3'
                act_color = '#ef4444'
                act_text = f"marked '{rt_name}' as blocked"
            else:
                act_icon = 'plus-circle'
                act_color = '#6366f1'
                act_text = f"updated '{rt_name}'"

            recent_activity.append({
                'id': rt['id'] or idx,
                'time': act_time,
                'user': act_user,
                'action': act_text,
                'type': 'updated',
                'color': act_color,
                'icon': act_icon,
            })

        # 10. Native action domain map (Clean, lightweight domains instead of transmitting 50,000 IDs)
        domain_base = list(domain)
        domain_map = {
            'all': domain_base,
            'in_progress': domain_base + [('state', '=', '01_in_progress')],
            'completed': domain_base + [('state', 'in', ['1_done', '1_canceled'])],
            'due_today': domain_base + [('date_deadline', '=', today), ('state', 'not in', ['1_done', '1_canceled'])],
            'overdue': domain_base + [('date_deadline', '<', today), ('state', 'not in', ['1_done', '1_canceled'])],
            'due_this_week': domain_base + [('date_deadline', '>=', today), ('date_deadline', '<=', today + timedelta(days=7)), ('state', 'not in', ['1_done', '1_canceled'])],
            'blocked': domain_base + [('state', '=', '04_waiting_normal')],
            'awaiting_approval': domain_base + [('state', 'in', ['02_changes_requested', '03_approved'])],
        }

        # Backwards-compatible capped task IDs map (max 300 IDs to protect network/payload)
        task_ids_map = {
            'all': [t['id'] for t in tasks[:300]],
            'in_progress': in_progress_task_ids[:300],
            'completed': done_task_ids[:300],
            'due_today': due_today_task_ids[:300],
            'overdue': overdue_task_ids[:300],
            'due_this_week': due_this_week_task_ids[:300],
            'blocked': blocked_task_ids[:300],
            'awaiting_approval': awaiting_approval_task_ids[:300],
        }

        return {
            'user_info': user_info,
            'current_date_formatted': current_date_formatted,
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
            'domain_map': domain_map,
            'task_ids_map': task_ids_map,
        }
