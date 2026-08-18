# -*- coding: utf-8 -*-
from odoo import http, fields
from odoo.http import request
from datetime import date

COLORS = ['#0284c7', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981', '#06b6d4', '#84cc16', '#6366f1', '#3b82f6']


class ProjectPerformanceDashboardController(http.Controller):

    @http.route('/performance_dashboard/data', type='json', auth='user')
    def get_performance_dashboard_data(self, level=1, department_id=None, **kwargs):
        env = request.env
        user = env.user
        is_manager = user.has_group('project.group_project_manager') or env.is_admin()

        # Fetch visible tasks respecting user access rights and role
        if is_manager:
            tasks = env['project.task'].search([], order='date_deadline asc, create_date desc')
        else:
            tasks = env['project.task'].search([('user_ids', 'in', [user.id])], order='date_deadline asc, create_date desc')

        if int(level) == 1:
            # Level 1: Department Cards (Sum of User Task Metrics for 100% consistency)
            if is_manager:
                departments = env['hr.department'].sudo().search([])
            else:
                departments = user.department_id or env['hr.department'].sudo().search([])

            dept_cards = []

            for dept in departments:
                dept_users = env['res.users'].sudo().search([
                    ('department_id', '=', dept.id),
                    ('share', '=', False)
                ])
                if not is_manager:
                    dept_users = dept_users.filtered(lambda u: u.id == user.id)

                if not dept_users:
                    continue

                total_cnt = 0
                done_on_time = 0
                done_late = 0

                for u in dept_users:
                    user_tasks = tasks.filtered(lambda tk: u.id in tk.user_ids.ids)
                    user_done_tasks = user_tasks.filtered(lambda tk: tk.state == '1_done')
                    total_cnt += len(user_done_tasks)
                    for tk in user_done_tasks:
                        completion_dt = tk.date_last_stage_update or tk.write_date
                        if completion_dt and tk.date_deadline:
                            comp_date = fields.Date.context_today(tk, completion_dt)
                            if comp_date <= tk.date_deadline:
                                done_on_time += 1
                            else:
                                done_late += 1
                        else:
                            done_on_time += 1

                if total_cnt == 0:
                    continue

                perf_pct = round((done_on_time / total_cnt * 100.0)) if total_cnt > 0 else 0

                team_avatars = []
                for idx, u in enumerate(dept_users[:5]):
                    name_parts = (u.name or 'U').split()
                    initials = (name_parts[0][0] + name_parts[-1][0]).upper() if len(name_parts) > 1 else name_parts[0][0].upper()
                    team_avatars.append({
                        'id': u.id,
                        'name': u.name,
                        'initials': initials,
                        'bg_color': COLORS[idx % len(COLORS)],
                        'avatar': f'/web/image?model=res.users&field=avatar_128&id={u.id}'
                    })

                dept_cards.append({
                    'id': dept.id,
                    'name': dept.name,
                    'last_update': f"Last Update {fields.Date.today().strftime('%d %b %Y')}",
                    'total': total_cnt,
                    'on_time': done_on_time,
                    'late': done_late,
                    'perf_pct': perf_pct,
                    'team': team_avatars,
                    'extra_team_count': max(0, len(dept_users) - 5)
                })

            return {'level': 1, 'dept_cards': dept_cards}

        elif int(level) == 2 and department_id:
            # Level 2: User Cards for a specific Department
            dept = env['hr.department'].sudo().browse(int(department_id))
            if is_manager:
                dept_users = env['res.users'].sudo().search([
                    ('department_id', '=', dept.id),
                    ('share', '=', False)
                ])
            else:
                dept_users = env['res.users'].sudo().search([
                    ('id', '=', user.id),
                    ('share', '=', False)
                ])
            user_cards = []

            for idx, u in enumerate(dept_users):
                user_tasks = tasks.filtered(lambda tk: u.id in tk.user_ids.ids)
                done_tasks = user_tasks.filtered(lambda tk: tk.state == '1_done')
                total_cnt = len(done_tasks)

                # Skip users with 0 tasks so empty 0% cards are not displayed
                if total_cnt == 0:
                    continue

                on_time = 0
                late = 0
                for tk in done_tasks:
                    completion_dt = tk.date_last_stage_update or tk.write_date
                    if completion_dt and tk.date_deadline:
                        comp_date = fields.Date.context_today(tk, completion_dt)
                        if comp_date <= tk.date_deadline:
                            on_time += 1
                        else:
                            late += 1
                    else:
                        on_time += 1

                perf_pct = round((on_time / total_cnt * 100.0)) if total_cnt > 0 else 0

                name_parts = (u.name or 'U').split()
                initials = (name_parts[0][0] + name_parts[-1][0]).upper() if len(name_parts) > 1 else name_parts[0][0].upper()

                user_cards.append({
                    'id': u.id,
                    'name': u.name,
                    'department_name': dept.name,
                    'last_update': f"Last Update {fields.Date.today().strftime('%d %b %Y')}",
                    'total': total_cnt,
                    'on_time': on_time,
                    'late': late,
                    'perf_pct': perf_pct,
                    'initials': initials,
                    'bg_color': COLORS[idx % len(COLORS)],
                    'avatar': f'/web/image?model=res.users&field=avatar_128&id={u.id}'
                })

            return {
                'level': 2,
                'department_id': dept.id,
                'department_name': dept.name,
                'user_cards': user_cards
            }

        return {'level': 1, 'dept_cards': []}
