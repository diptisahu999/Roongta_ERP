from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)


class ProjectTask(models.Model):
    _inherit = 'project.task'

    department_id = fields.Many2one('hr.department', string='Department')
    timesheet_total = fields.Float(string='Timesheets', compute='_compute_timesheet_total')

    @api.depends('timesheet_ids.unit_amount')
    def _compute_timesheet_total(self):
        for rec in self:
            rec.timesheet_total = sum(rec.timesheet_ids.mapped('unit_amount'))

    assignable_user_ids = fields.Many2many('res.users', compute='_compute_assignable_user_ids')

    @api.depends('department_id')
    def _compute_assignable_user_ids(self):
        user = self.env.user
        # Admins, Project Administrators AND Custom Managers all see ALL users
        is_admin_or_manager = (
            user.has_group('project.group_project_manager')
            or user.has_group('base.group_system')
            or user.has_group('custom_project.group_project_manager_custom')
        )

        for task in self:
            if is_admin_or_manager:
                # Admins & managers can assign any internal user
                allowed_users = self.env['res.users'].sudo().search([('share', '=', False), ('active', '=', True)])
            else:
                # Regular users: restrict to all internal users (basic behaviour)
                allowed_users = self.env['res.users'].sudo().search([('share', '=', False), ('active', '=', True)])

            task.assignable_user_ids = allowed_users


    @api.model
    def _search(self, domain, offset=0, limit=None, order=None):
        if self.env.su:
            return super()._search(domain, offset=offset, limit=limit, order=order)
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

        # Bypass custom visibility filters if Odoo is looking for specific records 
        # (e.g. during read() or name_get() on relational fields) to avoid AccessErrors.
        is_specific_id_search = any(
            isinstance(term, tuple) and term[0] == 'id' and term[1] in ('=', 'in') 
            for term in domain if isinstance(term, tuple)
        )
        if is_specific_id_search:
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

        # Tier 4: Project User — see tasks assigned directly to them OR created by them
        visibility_domain = [
            '|',
            ('user_ids', 'in', [user.id]),
            ('create_uid', '=', user.id),
        ]
        domain = visibility_domain + list(domain)
        return super()._search(domain, offset=offset, limit=limit, order=order)

    @api.model_create_multi
    def create(self, vals_list):
        tasks = super().create(vals_list)
        for task in tasks:
            if task.parent_id and task.user_ids:
                new_users = task.user_ids - task.parent_id.user_ids
                if new_users:
                    task.parent_id.sudo().write({
                        'user_ids': [(4, user.id) for user in new_users]
                    })
        return tasks

    def write(self, vals):
        res = super().write(vals)
        if 'user_ids' in vals or 'parent_id' in vals:
            for task in self:
                if task.parent_id and task.user_ids:
                    new_users = task.user_ids - task.parent_id.user_ids
                    if new_users:
                        task.parent_id.sudo().write({
                            'user_ids': [(4, user.id) for user in new_users]
                        })
        return res

class ProjectTaskType(models.Model):
    _inherit = 'project.task.type'

    @api.model
    def _search(self, domain, offset=0, limit=None, order=None):
        if self.env.su:
            return super()._search(domain, offset=offset, limit=limit, order=order)
        user = self.env.user

        # Admins see everything
        if user.has_group('base.group_system') or user.has_group('project.group_project_manager'):
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Bypass for specific ID searches
        is_specific_id_search = any(
            isinstance(term, tuple) and term[0] == 'id' and term[1] in ('=', 'in')
            for term in domain if isinstance(term, tuple)
        )
        if is_specific_id_search:
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Tier 3 (Manager) and Tier 4 (User) only see task stages for projects they are involved in.
        # Find project IDs where this user has assigned tasks safely via sudo()
        assigned_task_project_ids = self.env['project.task'].sudo().search([
            ('user_ids', 'in', [user.id]),
            ('project_id', '!=', False),
        ]).mapped('project_id').ids

        managed_project_domain = [
            '|', '|', '|', '|', '|',
            ('user_id', '=', user.id),
            ('assigned_user_ids', 'in', [user.id]),
            ('partner_id', '=', user.partner_id.id),
            ('create_uid', '=', user.id),
            ('message_partner_ids', 'in', [user.partner_id.id]),
            ('id', 'in', assigned_task_project_ids),
        ]
        
        # Get IDs of projects they can see
        allowed_project_ids = self.env['project.project'].sudo().search(managed_project_domain).ids

        visibility_domain = [
            '|', 
            ('project_ids', '=', False), # Global stages
            ('project_ids', 'in', allowed_project_ids) # Stages for their projects
        ]
        
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
