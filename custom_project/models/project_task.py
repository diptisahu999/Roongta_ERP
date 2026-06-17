from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)


class ProjectTask(models.Model):
    _inherit = 'project.task'

    timesheet_total = fields.Float(string='Timesheets', compute='_compute_timesheet_total')

    @api.depends('timesheet_ids.unit_amount')
    def _compute_timesheet_total(self):
        for rec in self:
            rec.timesheet_total = sum(rec.timesheet_ids.mapped('unit_amount'))

    @api.model
    def _search(self, domain, offset=0, limit=None, order=None):
        """
        Task visibility restriction:

        Tier 1 - System Administrator: Sees ALL tasks.
        Tier 2 - Project Administrator: Sees ALL tasks.
        Tier 3 - Custom Project Manager: Sees ALL tasks (rule in security_rules.xml).
        Tier 4 - Project User: Sees tasks where they are assigned (user_ids).
                 This ensures "All Tasks" works without hitting project.project
                 access errors caused by the project-level _search filter.
        """
        user = self.env.user

        # Tier 1 & 2: Admins see everything
        if user.has_group('base.group_system') or user.has_group('project.group_project_manager'):
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Tier 3: Custom Manager — security rule already handles this, pass through
        if user.has_group('custom_project.group_project_manager_custom'):
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Tier 4: Project User — only see tasks assigned to them
        visibility_domain = [('user_ids', 'in', [user.id])]
        domain = visibility_domain + list(domain)
        return super()._search(domain, offset=offset, limit=limit, order=order)

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
