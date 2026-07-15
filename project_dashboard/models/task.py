# -*- coding: utf-8 -*-
from odoo import models, api

class ProjectTask(models.Model):
    _inherit = 'project.task'

    @api.model_create_multi
    def create(self, vals_list):
        tasks = super().create(vals_list)
        for task in tasks:
            if task.stage_id and (task.stage_id.fold or (task.stage_id.name and task.stage_id.name.lower() in ['done', 'completed'])):
                if hasattr(task, 'state') and task.state != '1_done':
                    task.state = '1_done'
        return tasks

    def write(self, vals):
        res = super().write(vals)
        if 'stage_id' in vals:
            for task in self:
                if task.stage_id and (task.stage_id.fold or (task.stage_id.name and task.stage_id.name.lower() in ['done', 'completed'])):
                    if hasattr(task, 'state') and task.state != '1_done':
                        task.state = '1_done'
        return res
