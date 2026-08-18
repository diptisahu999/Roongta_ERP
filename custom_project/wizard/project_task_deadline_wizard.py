# -*- coding: utf-8 -*-
from odoo import models, fields, api

class ProjectTaskDeadlineWizard(models.TransientModel):
    _name = 'project.task.deadline.wizard'
    _description = 'Update Task Deadline Wizard'

    new_deadline = fields.Date(string="New Deadline", required=True)

    def action_update_deadline(self):
        self.ensure_one()
        active_id = self._context.get('active_id')
        if active_id:
            task = self.env['project.task'].browse(active_id)
            task.write({'date_deadline': self.new_deadline})
        return {'type': 'ir.actions.act_window_close'}
