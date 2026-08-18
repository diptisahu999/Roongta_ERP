# -*- coding: utf-8 -*-
from odoo import models, fields, api

class ResUsers(models.Model):
    _inherit = 'res.users'

    department_id = fields.Many2one(
        'hr.department',
        string='Department',
        store=True,
        help='Department to which this user belongs.',
    )

    is_same_department = fields.Boolean(
        string='Is Same Department',
        compute='_compute_is_same_department',
        search='_search_is_same_department'
    )

    total_tasks_done = fields.Integer(
        string='Total Tasks',
        compute='_compute_user_performance',
    )
    tasks_completed_on_time = fields.Integer(
        string='Tasks On Time',
        compute='_compute_user_performance',
    )
    tasks_done_late = fields.Integer(
        string='Tasks Late',
        compute='_compute_user_performance',
    )
    performance_rate = fields.Float(
        string='Performance Bar',
        compute='_compute_user_performance',
    )

    def _compute_user_performance(self):
        done_tasks = self.env['project.task'].sudo().search([
            ('state', '=', '1_done'),
            ('user_ids', 'in', self.ids)
        ])

        user_tasks_map = {user.id: [] for user in self}
        for task in done_tasks:
            for user in task.user_ids:
                if user.id in user_tasks_map:
                    user_tasks_map[user.id].append(task)

        for user in self:
            u_tasks = user_tasks_map.get(user.id, [])
            total = len(u_tasks)
            on_time = 0
            late = 0

            for task in u_tasks:
                completion_dt = task.date_last_stage_update or task.write_date
                if completion_dt and task.date_deadline:
                    comp_date = fields.Date.context_today(task, completion_dt)
                    if comp_date <= task.date_deadline:
                        on_time += 1
                    else:
                        late += 1
                else:
                    on_time += 1

            user.total_tasks_done = total
            user.tasks_completed_on_time = on_time
            user.tasks_done_late = late
            user.performance_rate = round((on_time / total * 100.0), 2) if total > 0 else 0.0

    @api.depends('department_id')
    def _compute_is_same_department(self):
        current_user_dept = self.env.user.department_id
        for user in self:
            if current_user_dept and user.department_id:
                user.is_same_department = (user.department_id.id == current_user_dept.id)
            else:
                user.is_same_department = False

    def _search_is_same_department(self, operator, value):
        current_user_dept = self.env.user.department_id
        if not current_user_dept:
            return [('id', '=', False)]
        if (operator == '=' and value is True) or (operator == '!=' and value is False):
            return [('department_id', '=', current_user_dept.id)]
        else:
            return [('department_id', '!=', current_user_dept.id)]
