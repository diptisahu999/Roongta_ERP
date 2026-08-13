from odoo import fields, models, api


class ReportProjectTaskUser(models.Model):
    _inherit = "report.project.task.user"

    department_id = fields.Many2one('hr.department', string='Department', readonly=True)
    state = fields.Selection(
        selection_add=[
            ('05_management_discussion', 'Discussion'),
        ],
        ondelete={'05_management_discussion': 'cascade'}
    )

    def _select(self):
        return super()._select() + ", t.department_id"

    def _group_by(self):
        return super()._group_by() + ", t.department_id"

    @api.model
    def _search(self, domain, offset=0, limit=None, order=None):
        if self.env.su:
            return super()._search(domain, offset=offset, limit=limit, order=order)

        user = self.env.user
        # System Admin (base.group_system) & Project Admin (project.group_project_manager) see ALL departments
        if user.has_group('base.group_system') or user.has_group('project.group_project_manager'):
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Bypass specific ID searches
        is_specific_id_search = any(
            isinstance(term, tuple) and term[0] == 'id' and term[1] in ('=', 'in')
            for term in domain if isinstance(term, tuple)
        )
        if is_specific_id_search:
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Restrict to logged-in user's department for Managers and Users
        if user.department_id:
            dept_domain = [('department_id', '=', user.department_id.id)]
            domain = dept_domain + list(domain or [])

        return super()._search(domain, offset=offset, limit=limit, order=order)

