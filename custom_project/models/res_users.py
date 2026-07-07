from odoo import models, fields, api
from odoo.osv import expression


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

    @api.model
    def _search(self, domain, offset=0, limit=None, order=None, **kwargs):
        """
        If the current user is a department manager (custom project manager group)
        but NOT a true system admin (Settings), restrict them to see only users
        from their own department.
        """
        user = self.env.user
        # True system admin: skip filtering entirely
        is_system_admin = self.env.is_superuser() or user.has_group('base.group_system')

        if not is_system_admin and user.department_id:
            # Check if user has the custom project manager group
            if user.has_group('custom_project.group_project_manager_custom'):
                dept_id = user.department_id.id
                dept_filter = ['|',
                    ('department_id', '=', dept_id),
                    ('id', '=', user.id)
                ]
                domain = expression.AND([domain, dept_filter])

        return super(ResUsers, self)._search(domain, offset=offset, limit=limit, order=order, **kwargs)

    @api.model
    def fields_get(self, allfields=None, attributes=None):
        res = super(ResUsers, self).fields_get(allfields, attributes)
        
        # Check if the current user is NOT an administrator (Administration / Settings)
        if not self.env.user.has_group('base.group_system'):
            # IDs of the groups to hide
            project_manager_group = self.env.ref('project.group_project_manager', raise_if_not_found=False)
            project_custom_manager_group = self.env.ref('custom_project.group_project_manager_custom', raise_if_not_found=False)
            
            groups_to_hide = []
            if project_manager_group:
                groups_to_hide.append(project_manager_group.id)
            if project_custom_manager_group:
                groups_to_hide.append(project_custom_manager_group.id)
                
            if groups_to_hide:
                # Odoo's group selection fields are dynamically created and start with 'sel_groups_'
                for field_name, field_attrs in res.items():
                    if field_name.startswith('sel_groups_') and 'selection' in field_attrs:
                        # field_attrs['selection'] contains a list of tuples like [(group_id, group_name), ...]
                        original_selection = field_attrs['selection']
                        new_selection = [s for s in original_selection if s[0] not in groups_to_hide]
                        if len(new_selection) != len(original_selection):
                            field_attrs['selection'] = new_selection
        return res
