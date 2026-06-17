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

        Tier 3 - Custom Project Manager:
            → Sees tasks assigned directly to them (user_ids includes them).
            → Sees ALL tasks in projects they manage:
                  projects where they are Project Manager (user_id = me)
                  OR they are in Assigned To (assigned_user_ids).
            This lets managers track their own work AND monitor their team's tasks
            without seeing tasks from projects they have no relation to.

        Tier 4 - Project User:
            → Sees ONLY tasks assigned directly to them (user_ids includes them).
        """
        user = self.env.user

        # Tier 1 & 2: Admins see everything
        if user.has_group('base.group_system') or user.has_group('project.group_project_manager'):
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Tier 3: Custom Project Manager
        # Sees their own tasks + ALL tasks in projects they manage.
        # Uses sudo() to safely fetch managed project IDs without triggering
        # recursive project.project access checks inside task._search.
        if user.has_group('custom_project.group_project_manager_custom'):
            managed_project_ids = self.env['project.project'].sudo().search([
                '|',
                ('user_id', '=', user.id),
                ('assigned_user_ids', 'in', [user.id]),
            ]).ids

            visibility_domain = [
                '|',
                ('user_ids', 'in', [user.id]),          # tasks assigned to the manager
                ('project_id', 'in', managed_project_ids),  # all tasks in managed projects
            ]
            domain = visibility_domain + list(domain)
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Tier 4: Project User — only see tasks assigned directly to them
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
