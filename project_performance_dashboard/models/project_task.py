# -*- coding: utf-8 -*-
from odoo import models, fields, api

class ProjectTask(models.Model):
    _inherit = 'project.task'

    task_performance = fields.Selection([
        ('1_on_time', 'On Time'),
        ('2_late', 'Over Time')
    ], string='Performance Status', compute='_compute_task_performance', store=True)

    @api.depends('state', 'date_deadline', 'date_last_stage_update')
    def _compute_task_performance(self):
        for task in self:
            if not task.date_deadline:
                task.task_performance = '1_on_time'
            else:
                from datetime import datetime
                deadline_date = task.date_deadline.date() if isinstance(task.date_deadline, datetime) else task.date_deadline
                if task.state == '1_done':
                    completion_date = task.date_last_stage_update or task.write_date
                    comp_date = completion_date.date() if isinstance(completion_date, datetime) else completion_date
                    if comp_date and comp_date <= deadline_date:
                        task.task_performance = '1_on_time'
                    else:
                        task.task_performance = '2_late'
                else:
                    if fields.Date.today() <= deadline_date:
                        task.task_performance = '1_on_time'
                    else:
                        task.task_performance = '2_late'
