from odoo import models, api, fields
import logging

_logger = logging.getLogger(__name__)


class Project(models.Model):
    _inherit = 'project.project'

    # ------------------------------------------------------------------
    # Custom field: Assigned Users
    # Admin assigns Managers here; Managers assign Users here
    # ------------------------------------------------------------------

    assigned_user_ids = fields.Many2many(
        'res.users',
        'project_assigned_users_rel',
        'project_id',
        'user_id',
        string='Assigned To',
        domain=[('share', '=', False)],
        help="Users assigned to this project. "
             "Admins can assign Managers; Managers can assign Users.",
    )

    # ------------------------------------------------------------------
    # Visibility restriction for Project Users
    # ------------------------------------------------------------------

    @api.model
    def _search(self, domain, offset=0, limit=None, order=None):
        """
        4-Tier project visibility restriction:

        Tier 1 - System Administrator (Administration = Administration, base.group_system):
            → Sees ALL projects (no filter applied).

        Tier 2 - Project: Administrator (project.group_project_manager):
            → Sees ALL projects (no filter applied).

        Tier 3 - Project: Manager (custom_project.group_project_manager_custom):
            → Sees projects where they are the Project Manager (user_id = me)
              OR they are listed in Assigned To (assigned_user_ids)
              OR their partner is the Customer (partner_id = my partner)
              OR they created the project (create_uid = me)
              OR they are a follower.

        Tier 4 - Project: User (project.group_project_user only):
            → Sees ONLY projects where they are the Project Manager (user_id = me)
              OR they are listed in Assigned To (assigned_user_ids)
              OR their partner is the Customer (partner_id = my partner).
        """
        user = self.env.user

        # Tier 1: System Admin sees everything
        is_system_admin = user.has_group('base.group_system')
        if is_system_admin:
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Tier 2: Project Administrator sees everything
        is_project_admin = user.has_group('project.group_project_manager')
        if is_project_admin:
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Tier 3: Project Manager sees own + assigned + customer + created + followed
        is_project_manager = user.has_group('custom_project.group_project_manager_custom')
        if is_project_manager:
            visibility_domain = [
                '|', '|', '|', '|',
                ('user_id', '=', user.id),
                ('assigned_user_ids', 'in', [user.id]),
                ('partner_id', '=', user.partner_id.id),
                ('create_uid', '=', user.id),
                ('message_partner_ids', 'in', [user.partner_id.id]),
            ]
            domain = visibility_domain + list(domain)
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Tier 4: Project User sees own + assigned + customer projects
        visibility_domain = [
            '|', '|',
            ('user_id', '=', user.id),
            ('assigned_user_ids', 'in', [user.id]),
            ('partner_id', '=', user.partner_id.id),
        ]
        domain = visibility_domain + list(domain)
        return super()._search(domain, offset=offset, limit=limit, order=order)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_notification_user_ids(self):
        """
        Returns user IDs to notify for this project.
        Priority:
          1. Project manager (user_id)
          2. Current user (env.user)
        """
        user_ids = []
        for project in self:
            if project.user_id:
                user_ids.append(project.user_id.id)
            else:
                user_ids.append(self.env.uid)
        return list(set(user_ids))

    def _send_project_customer_notification(self, project_name, customer_name):
        """Fire a push notification via notification.manager."""
        user_ids = self._get_notification_user_ids()
        if not user_ids:
            return
        title = "🏗️ New Project Created"
        message = (
            f"Project '{project_name}' has been created and assigned to "
            f"customer '{customer_name}'."
        )
        try:
            self.env['notification.manager'].sudo().send_push_notification(
                user_ids, title, message, notification_type='success'
            )
            _logger.info(
                "Project notification sent: project=%s, customer=%s, users=%s",
                project_name, customer_name, user_ids,
            )
        except Exception as exc:
            _logger.error("Failed to send project notification: %s", exc)

    # ------------------------------------------------------------------
    # CRUD overrides
    # ------------------------------------------------------------------

    def create(self, vals):
        project = super(Project, self).create(vals)
        # Only notify when a customer is set
        if project.partner_id:
            project._send_project_customer_notification(
                project_name=project.name,
                customer_name=project.partner_id.name,
            )
        return project

    def write(self, vals):
        # Capture old customer values before the write
        old_customers = {p.id: p.partner_id for p in self}
        result = super(Project, self).write(vals)
        # Notify only when partner_id is explicitly changed and is now set
        if 'partner_id' in vals:
            for project in self:
                new_partner = project.partner_id
                if new_partner and old_customers.get(project.id) != new_partner:
                    project._send_project_customer_notification(
                        project_name=project.name,
                        customer_name=new_partner.name,
                    )
        return result

    # ------------------------------------------------------------------
    # Unlink override (existing logic)
    # ------------------------------------------------------------------

    def unlink(self):
        # Before deleting the projects, delete their related project updates
        # to avoid the foreign key constraint violation.
        updates = self.env['project.update'].search([('project_id', 'in', self.ids)])
        if updates:
            updates.unlink()
        return super(Project, self).unlink()

