from odoo import models, fields


class ProjectTaskLabel(models.Model):
    _name = 'project.task.label'
    _description = 'Task Label'

    name = fields.Char(string='Name', required=True)
    color = fields.Integer(string='Color Index')

    _sql_constraints = [
        ('name_uniq', 'unique (name)', "Label name already exists!"),
    ]
