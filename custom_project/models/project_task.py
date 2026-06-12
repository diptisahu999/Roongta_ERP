from odoo import models, fields, api


class ProjectTask(models.Model):
    _inherit = 'project.task'

    timesheet_total = fields.Float(string='Timesheets', compute='_compute_timesheet_total')

    @api.depends('timesheet_ids.unit_amount')
    def _compute_timesheet_total(self):
        for rec in self:
            rec.timesheet_total = sum(rec.timesheet_ids.mapped('unit_amount'))

class AccountAnalyticLine(models.Model):
    _inherit = 'account.analytic.line'

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            user_id = vals.get('user_id')
            if user_id and not vals.get('employee_id'):
                user = self.env['res.users'].sudo().browse(user_id)
                if user.exists():
                    employee = self.env['hr.employee'].sudo().search([('user_id', '=', user.id)], limit=1)
                    if not employee:
                        employee = self.env['hr.employee'].sudo().create({
                            'name': user.name,
                            'user_id': user.id,
                            'company_id': user.company_id.id or self.env.company.id,
                        })
                    vals['employee_id'] = employee.id
        return super().create(vals_list)

    def write(self, vals):
        if 'user_id' in vals and not vals.get('employee_id'):
            user_id = vals.get('user_id')
            if user_id:
                user = self.env['res.users'].sudo().browse(user_id)
                if user.exists():
                    employee = self.env['hr.employee'].sudo().search([('user_id', '=', user.id)], limit=1)
                    if not employee:
                        employee = self.env['hr.employee'].sudo().create({
                            'name': user.name,
                            'user_id': user.id,
                            'company_id': user.company_id.id or self.env.company.id,
                        })
                    vals['employee_id'] = employee.id
        return super().write(vals)

    @api.onchange('user_id')
    def _onchange_user_id_custom(self):
        if self.user_id:
            employee = self.env['hr.employee'].sudo().search([('user_id', '=', self.user_id.id)], limit=1)
            if employee:
                self.employee_id = employee.id
