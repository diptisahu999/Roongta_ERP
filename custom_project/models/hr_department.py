from odoo import models, fields, api


class HrDepartment(models.Model):
    _inherit = 'hr.department'

    manager_user_id = fields.Many2one(
        'res.users',
        string='Manager',
        domain=[('active', '=', True), ('share', '=', False)],
        tracking=True,
    )

    user_count = fields.Integer(
        string='Users',
        compute='_compute_user_count',
        store=False,
    )

    @api.model
    def get_view(self, view_id=None, view_type='form', **options):
        res = super().get_view(view_id=view_id, view_type=view_type, **options)
        # If the user is not a system administrator (e.g. they are a Manager or User),
        # disable the actions that populate the "Actions" dropdown menu.
        if not self.env.user.has_group('base.group_system'):
            import xml.etree.ElementTree as ET
            doc = ET.fromstring(res['arch'])
            if view_type in ['list', 'tree', 'form', 'kanban']:
                doc.set('create', '0')
                doc.set('edit', '0')
                doc.set('delete', '0')
                doc.set('duplicate', '0')
                doc.set('export_xlsx', '0')
            res['arch'] = ET.tostring(doc, encoding='unicode')
        return res

    @api.depends_context('uid')
    def _compute_user_count(self):
        """Count res.users with department_id = this department."""
        for dept in self:
            dept.user_count = self.env['res.users'].search_count([
                ('department_id', '=', dept.id),
                ('active', '=', True),
                ('share', '=', False),
            ])

    def action_department_users(self):
        """Open filtered list of internal users in this department."""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': f'{self.name} — Users',
            'res_model': 'res.users',
            'view_mode': 'list,form',
            'domain': [('department_id', '=', self.id), ('share', '=', False)],
            'context': {'default_department_id': self.id},
        }

    def action_delete_department(self):
        """Force delete the department, auto-unassigning any employees and child departments."""
        self.ensure_one()

        # Unassign all employees from this department
        employees = self.env['hr.employee'].search([('department_id', '=', self.id)])
        if employees:
            employees.write({'department_id': False})

        # Detach any child departments so they don't get cascade-blocked
        child_depts = self.env['hr.department'].search([('parent_id', '=', self.id)])
        if child_depts:
            child_depts.write({'parent_id': False})

        self.unlink()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Departments',
            'res_model': 'hr.department',
            'view_mode': 'list,form,kanban',
            'target': 'current',
        }

    def action_open_dashboard(self):
        """Open the custom Owl Department Dashboard filtered by this department."""
        self.ensure_one()
        return {
            'type': 'ir.actions.client',
            'tag': 'department_dashboard_action',
            'name': 'Department Dashboard',
            'context': {
                'default_department_id': self.id,
            }
        }
