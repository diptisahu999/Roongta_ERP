from odoo import models, fields, api


class ResUsers(models.Model):
    _inherit = 'res.users'

    department_id = fields.Many2one(
        'hr.department',
        string='Department',
        store=True,
        help='Department to which this user belongs.',
    )

    @api.onchange('department_id')
    def _onchange_department_id(self):
        """Sync department change to the linked employee record."""
        if self.employee_id and self.department_id:
            self.employee_id.department_id = self.department_id
