from odoo import models
import logging

_logger = logging.getLogger(__name__)


class Project(models.Model):
    _inherit = 'project.project'

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

