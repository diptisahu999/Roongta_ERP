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

        def clean_xml_tree(tree, is_admin):
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

        is_admin = self.env.user.has_group('base.group_system')
        if hasattr(res, 'xpath'):
            clean_xml_tree(res, is_admin)
        elif isinstance(res, dict) and 'arch' in res:
            arch = res['arch']
            if hasattr(arch, 'xpath'):
                clean_xml_tree(arch, is_admin)
        return res

    @api.model
    def get_views(self, views, options=None):
        res = super(ResUsers, self).get_views(views, options=options)
        if not self.env.user.has_group('base.group_system'):
            tags_group = self.env.ref('custom_project.group_project_tags_create', raise_if_not_found=False)
            tags_group_id = str(tags_group.id) if tags_group else None

            if 'views' in res and 'form' in res['views']:
                form_view = res['views']['form']
                if 'arch' in form_view:
                    try:
                        arch_xml = etree.fromstring(form_view['arch'])
                        changed = False
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
                        if changed:
                            form_view['arch'] = etree.tostring(arch_xml, encoding='unicode')
                    except Exception:
                        pass
        return res

    @api.model
    def fields_view_get(self, view_id=None, view_type='form', toolbar=False, submenu=False):
        res = super(ResUsers, self).fields_view_get(view_id=view_id, view_type=view_type, toolbar=toolbar, submenu=submenu)
        if view_type == 'form' and not self.env.user.has_group('base.group_system'):
            if 'arch' in res:
                try:
                    arch_xml = etree.fromstring(res['arch'])
                    tags_group = self.env.ref('custom_project.group_project_tags_create', raise_if_not_found=False)
                    tags_group_id = str(tags_group.id) if tags_group else None

                    changed = False
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
                    if changed:
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
