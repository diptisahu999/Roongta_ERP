from lxml import etree
from odoo import models, fields, api


class ResUsers(models.Model):
    _inherit = 'res.users'

    department_id = fields.Many2one(
        'hr.department',
        string='Department',
        store=True,
        help='Department to which this user belongs.',
    )

    def action_change_password(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Change Password',
            'res_model': 'change.password.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'active_ids': self.ids, 'active_id': self.id, 'active_model': 'res.users'},
        }

    is_admin_or_manager = fields.Boolean(
        string='Is Admin or Manager',
        compute='_compute_is_admin_or_manager'
    )

    def _compute_is_admin_or_manager(self):
        for user in self:
            user.is_admin_or_manager = user.has_group('base.group_system') or user.has_group('project.group_project_manager') or user.has_group('custom_project.group_project_manager_custom')

    can_change_password = fields.Boolean(
        compute='_compute_can_change_password'
    )

    def _compute_can_change_password(self):
        for user in self:
            if self.env.user.has_group('base.group_system'):
                user.can_change_password = True
            elif self.env.user.has_group('custom_project.group_project_manager_custom'):
                if user.is_admin_or_manager:
                    user.can_change_password = False
                else:
                    user.can_change_password = True
            else:
                user.can_change_password = False

    def write(self, vals):
        is_project_manager = self.env.user.has_group('custom_project.group_project_manager_custom')
        is_admin = self.env.user.has_group('base.group_system')
        is_project_admin = self.env.user.has_group('project.group_project_manager')

        if is_project_manager and not is_admin and not is_project_admin:
            for user in self:
                if user.is_admin_or_manager and user.id != self.env.user.id:
                    from odoo.exceptions import UserError
                    raise UserError('You cannot edit Administrator or Manager profiles.')
        return super(ResUsers, self).write(vals)

    can_create_department = fields.Boolean(
        string='Can Create Department',
        compute='_compute_can_create_department',
        inverse='_inverse_can_create_department'
    )

    can_edit_task_deadline = fields.Boolean(
        string='Can Edit Task Deadline',
        compute='_compute_can_edit_task_deadline',
        inverse='_inverse_can_edit_task_deadline'
    )

    def _compute_can_create_department(self):
        group = self.env.ref('custom_project.group_create_department', raise_if_not_found=False)
        for user in self:
            if group:
                user.can_create_department = group in user.groups_id
            else:
                user.can_create_department = False

    def _inverse_can_create_department(self):
        group = self.env.ref('custom_project.group_create_department', raise_if_not_found=False)
        if not group:
            return
        for user in self:
            if user.can_create_department:
                user.groups_id = [(4, group.id)]
            else:
                user.groups_id = [(3, group.id)]

    def _compute_can_edit_task_deadline(self):
        group = self.env.ref('custom_project.group_edit_task_deadline', raise_if_not_found=False)
        for user in self:
            if group:
                user.can_edit_task_deadline = group in user.groups_id
            else:
                user.can_edit_task_deadline = False

    def _inverse_can_edit_task_deadline(self):
        group = self.env.ref('custom_project.group_edit_task_deadline', raise_if_not_found=False)
        if not group:
            return
        for user in self:
            if user.can_edit_task_deadline:
                user.groups_id = [(4, group.id)]
            else:
                user.groups_id = [(3, group.id)]

    is_same_department = fields.Boolean(
        string='Is Same Department',
        compute='_compute_is_same_department',
        search='_search_is_same_department'
    )

    @api.depends('department_id')
    def _compute_is_same_department(self):
        for user in self:
            if self.env.user.department_id:
                user.is_same_department = user.department_id == self.env.user.department_id
            else:
                user.is_same_department = False

    def _search_is_same_department(self, operator, value):
        if operator == '=' and value and self.env.user.department_id:
            return [('department_id', '=', self.env.user.department_id.id)]
        elif operator == '=' and not value and self.env.user.department_id:
            return [('department_id', '!=', self.env.user.department_id.id)]
        return []

    @api.onchange('department_id')
    def _onchange_department_id(self):
        """Sync department change to the linked employee record."""
        if self.employee_id and self.department_id:
            self.employee_id.department_id = self.department_id

    @api.model
    def _search(self, domain, offset=0, limit=None, order=None, **kwargs):
        """
        User visibility rules:

        - System Admin (base.group_system): sees ALL users.
        - Project Administrator (project.group_project_manager): sees ALL users.
        - Custom Project Manager (custom_project.group_project_manager_custom): sees ALL users.
        - Regular Users: standard Odoo rules apply (no extra filter here).
        """
        # No extra Python-level domain filter needed.
        # Access is fully controlled by ir.rules in security_rules.xml.
        return super(ResUsers, self)._search(domain, offset=offset, limit=limit, order=order, **kwargs)

    @api.model
    def _get_user_groups_view(self, view_id=None, view_type='form', toolbar=False, submenu=False):
        res = super(ResUsers, self)._get_user_groups_view(
            view_id=view_id, view_type=view_type, toolbar=toolbar, submenu=submenu
        )
        tags_group = self.env.ref('custom_project.group_project_tags_create', raise_if_not_found=False)
        tags_group_id = str(tags_group.id) if tags_group else None

        deadline_group = self.env.ref('custom_project.group_edit_task_deadline', raise_if_not_found=False)
        deadline_group_id = str(deadline_group.id) if deadline_group else None

        def clean_xml_tree(tree, is_admin, is_project_admin):
            if not hasattr(tree, 'xpath'):
                return
            field_name = f"in_group_{tags_group_id}" if tags_group_id else None
            if field_name:
                for node in tree.xpath(f"//field[@name='{field_name}']"):
                    node.set('groups', 'base.group_system')
                    if not is_admin:
                        parent = node.getparent()
                        if parent is not None:
                            parent.remove(node)
            for node in tree.xpath("//*[@string='Tags Access']"):
                node.set('groups', 'base.group_system')
                if not is_admin:
                    parent = node.getparent()
                    if parent is not None:
                        parent.remove(node)

            deadline_field_name = f"in_group_{deadline_group_id}" if deadline_group_id else None
            if deadline_field_name:
                for node in tree.xpath(f"//field[@name='{deadline_field_name}']"):
                    node.set('groups', 'project.group_project_manager,base.group_system')
                    if not is_project_admin:
                        parent = node.getparent()
                        if parent is not None:
                            parent.remove(node)
            for node in tree.xpath("//*[@string='Task Deadline Access']"):
                node.set('groups', 'project.group_project_manager,base.group_system')
                if not is_project_admin:
                    parent = node.getparent()
                    if parent is not None:
                        parent.remove(node)

        is_admin = self.env.user.has_group('base.group_system')
        is_project_admin = self.env.user.has_group('project.group_project_manager') or is_admin
        if hasattr(res, 'xpath'):
            clean_xml_tree(res, is_admin, is_project_admin)
        elif isinstance(res, dict) and 'arch' in res:
            arch = res['arch']
            if hasattr(arch, 'xpath'):
                clean_xml_tree(arch, is_admin, is_project_admin)
        return res

    @api.model
    def get_views(self, views, options=None):
        res = super(ResUsers, self).get_views(views, options=options)
        is_admin = self.env.user.has_group('base.group_system')
        is_project_admin = self.env.user.has_group('project.group_project_manager') or is_admin

        if not is_admin or not is_project_admin:
            tags_group = self.env.ref('custom_project.group_project_tags_create', raise_if_not_found=False)
            tags_group_id = str(tags_group.id) if tags_group else None

            deadline_group = self.env.ref('custom_project.group_edit_task_deadline', raise_if_not_found=False)
            deadline_group_id = str(deadline_group.id) if deadline_group else None

            for v_type in ['form', 'list', 'tree']:
                if 'views' in res and v_type in res['views']:
                    v_view = res['views'][v_type]
                    if 'arch' in v_view:
                        try:
                            arch_xml = etree.fromstring(v_view['arch'])
                            changed = False

                            if not is_admin:
                                for node in arch_xml.xpath("//*[@string='Tags Access']"):
                                    parent = node.getparent()
                                    if parent is not None:
                                        parent.remove(node)
                                        changed = True
                                if tags_group_id:
                                    for node in arch_xml.xpath(f"//field[@name='in_group_{tags_group_id}']"):
                                        parent = node.getparent()
                                        if parent is not None:
                                            parent.remove(node)
                                            changed = True
                                    for node in arch_xml.xpath("//field[starts-with(@name, 'sel_groups_')]"):
                                        name = node.get('name', '')
                                        parts = name.split('_')[2:]
                                        if tags_group_id in parts:
                                            parent = node.getparent()
                                            if parent is not None:
                                                parent.remove(node)
                                                changed = True

                            if not is_project_admin:
                                for node in arch_xml.xpath("//*[@string='Task Deadline Access']"):
                                    parent = node.getparent()
                                    if parent is not None:
                                        parent.remove(node)
                                        changed = True
                                if deadline_group_id:
                                    for node in arch_xml.xpath(f"//field[@name='in_group_{deadline_group_id}']"):
                                        parent = node.getparent()
                                        if parent is not None:
                                            parent.remove(node)
                                            changed = True
                                    for node in arch_xml.xpath("//field[starts-with(@name, 'sel_groups_')]"):
                                        name = node.get('name', '')
                                        parts = name.split('_')[2:]
                                        if deadline_group_id in parts:
                                            parent = node.getparent()
                                            if parent is not None:
                                                parent.remove(node)
                                                changed = True

                            # Hide Archive globally for Custom Managers
                            is_project_manager = self.env.user.has_group('custom_project.group_project_manager_custom')
                            if is_project_manager and not is_project_admin:
                                if arch_xml.tag in ['form', 'list', 'tree']:
                                    arch_xml.set('archive', '0')
                                    arch_xml.set('duplicate', '0')
                                    arch_xml.set('delete', '0')
                                    changed = True

                            if changed:
                                v_view['arch'] = etree.tostring(arch_xml, encoding='unicode')
                        except Exception:
                            pass
        return res

    @api.model
    def fields_view_get(self, view_id=None, view_type='form', toolbar=False, submenu=False):
        res = super(ResUsers, self).fields_view_get(view_id=view_id, view_type=view_type, toolbar=toolbar, submenu=submenu)
        is_admin = self.env.user.has_group('base.group_system')
        is_project_admin = self.env.user.has_group('project.group_project_manager') or is_admin

        if view_type == 'form' and (not is_admin or not is_project_admin):
            if 'arch' in res:
                try:
                    arch_xml = etree.fromstring(res['arch'])
                    tags_group = self.env.ref('custom_project.group_project_tags_create', raise_if_not_found=False)
                    tags_group_id = str(tags_group.id) if tags_group else None

                    deadline_group = self.env.ref('custom_project.group_edit_task_deadline', raise_if_not_found=False)
                    deadline_group_id = str(deadline_group.id) if deadline_group else None

                    changed = False

                    if not is_admin:
                        for node in arch_xml.xpath("//*[@string='Tags Access']"):
                            parent = node.getparent()
                            if parent is not None:
                                parent.remove(node)
                                changed = True
                        if tags_group_id:
                            for node in arch_xml.xpath(f"//field[@name='in_group_{tags_group_id}']"):
                                parent = node.getparent()
                                if parent is not None:
                                    parent.remove(node)
                                    changed = True
                            for node in arch_xml.xpath("//field[starts-with(@name, 'sel_groups_')]"):
                                name = node.get('name', '')
                                parts = name.split('_')[2:]
                                if tags_group_id in parts:
                                    parent = node.getparent()
                                    if parent is not None:
                                        parent.remove(node)
                                        changed = True

                    if not is_project_admin:
                        for node in arch_xml.xpath("//*[@string='Task Deadline Access']"):
                            parent = node.getparent()
                            if parent is not None:
                                parent.remove(node)
                                changed = True
                        if deadline_group_id:
                            for node in arch_xml.xpath(f"//field[@name='in_group_{deadline_group_id}']"):
                                parent = node.getparent()
                                if parent is not None:
                                    parent.remove(node)
                                    changed = True
                            for node in arch_xml.xpath("//field[starts-with(@name, 'sel_groups_')]"):
                                name = node.get('name', '')
                                parts = name.split('_')[2:]
                                if deadline_group_id in parts:
                                    parent = node.getparent()
                                    if parent is not None:
                                        parent.remove(node)
                                        changed = True

                    if changed:
                        arch_xml.set('archive', '0')
                        res['arch'] = etree.tostring(arch_xml, encoding='unicode')
                except Exception:
                    pass
        return res

    @api.model
    def fields_get(self, allfields=None, attributes=None):
        res = super(ResUsers, self).fields_get(allfields, attributes)

        # Restrict Tags Access field to System Administrators
        tags_group = self.env.ref('custom_project.group_project_tags_create', raise_if_not_found=False)
        if tags_group:
            field_name = f"in_group_{tags_group.id}"
            if field_name in res:
                res[field_name]['groups'] = 'base.group_system'
                if not self.env.user.has_group('base.group_system'):
                    res[field_name]['invisible'] = True

        # Restrict Task Deadline Access field to Project Administrators
        deadline_group = self.env.ref('custom_project.group_edit_task_deadline', raise_if_not_found=False)
        if deadline_group:
            deadline_field_name = f"in_group_{deadline_group.id}"
            if deadline_field_name in res:
                res[deadline_field_name]['groups'] = 'project.group_project_manager,base.group_system'
                if not (self.env.user.has_group('project.group_project_manager') or self.env.user.has_group('base.group_system')):
                    res[deadline_field_name]['invisible'] = True

        # Check if the current user is NOT an administrator (Administration / Settings)
        if not self.env.user.has_group('base.group_system'):
            # IDs of the groups to hide from group selection lists
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

class ChangePasswordWizard(models.TransientModel):
    _inherit = 'change.password.wizard'

    def default_get(self, fields):
        res = super(ChangePasswordWizard, self).default_get(fields)
        is_project_manager = self.env.user.has_group('custom_project.group_project_manager_custom')
        is_admin = self.env.user.has_group('base.group_system')
        is_project_admin = self.env.user.has_group('project.group_project_manager')

        if is_project_manager and not is_admin and not is_project_admin:
            active_ids = self.env.context.get('active_ids')
            if active_ids:
                from odoo.exceptions import UserError
                users = self.env['res.users'].browse(active_ids)
                for user in users:
                    if user.is_admin_or_manager and user.id != self.env.user.id:
                        raise UserError('You cannot change the password for Administrator or Manager profiles.')
        return res
