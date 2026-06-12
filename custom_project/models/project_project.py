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

    timesheet_progress_percentage = fields.Float(
        string='Timesheet Progress',
        compute='_compute_timesheet_progress_percentage',
    )

    @api.depends('effective_hours', 'allocated_hours')
    def _compute_timesheet_progress_percentage(self):
        for project in self:
            if project.allocated_hours > 0:
                project.timesheet_progress_percentage = project.effective_hours / project.allocated_hours
            else:
                project.timesheet_progress_percentage = 0.0

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

        # Tier 3: Project Manager sees own + assigned + customer + created + followed + assigned tasks
        is_project_manager = user.has_group('custom_project.group_project_manager_custom')
        if is_project_manager:
            visibility_domain = [
                '|', '|', '|', '|', '|',
                ('user_id', '=', user.id),
                ('assigned_user_ids', 'in', [user.id]),
                ('partner_id', '=', user.partner_id.id),
                ('create_uid', '=', user.id),
                ('message_partner_ids', 'in', [user.partner_id.id]),
                ('task_ids.user_ids', 'in', [user.id]),
            ]
            domain = visibility_domain + list(domain)
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Tier 4: Project User sees own + assigned + customer projects + assigned tasks
        visibility_domain = [
            '|', '|', '|',
            ('user_id', '=', user.id),
            ('assigned_user_ids', 'in', [user.id]),
            ('partner_id', '=', user.partner_id.id),
            ('task_ids.user_ids', 'in', [user.id]),
        ]
        domain = visibility_domain + list(domain)
        return super()._search(domain, offset=offset, limit=limit, order=order)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _collect_notify_user_ids(self):
        """
        Explicitly collects user IDs for notification:
          - Current user (admin doing the action) : always included
          - Project Manager  : project.user_id
          - Customer user    : res.users linked to project.partner_id
          - Assigned users   : project.assigned_user_ids
        Always includes BOTH project manager and customer AND the acting user.
        """
        user_ids = set()

        # Always notify the current user (the one performing the action)
        user_ids.add(self.env.uid)
        _logger.info("NOTIFY: always adding current user uid=%s", self.env.uid)

        for project in self:
            # 1. Project Manager
            if project.user_id:
                user_ids.add(project.user_id.id)
                _logger.info("NOTIFY: adding project manager user_id=%s (%s)",
                             project.user_id.id, project.user_id.name)

            # 2. Customer's linked Odoo user (portal or internal)
            if project.partner_id:
                customer_users = self.env['res.users'].sudo().search([
                    ('partner_id', '=', project.partner_id.id),
                    ('active', '=', True),
                ], limit=10)
                for cu in customer_users:
                    user_ids.add(cu.id)
                    _logger.info("NOTIFY: adding customer user_id=%s (%s)",
                                 cu.id, cu.name)

            # 3. Assigned users
            for user in project.assigned_user_ids:
                user_ids.add(user.id)

        _logger.info("NOTIFY: Final user_ids to notify = %s", list(user_ids))
        return list(user_ids)

    def _send_project_notification(self, project_name, customer_name, title=None, message=None):
        """Fire a push notification to ALL relevant users (manager + customer + assigned)."""
        user_ids = self._collect_notify_user_ids()
        if not user_ids:
            _logger.warning("NOTIFY: No user IDs collected, skipping notification.")
            return

        title = title or "🏗️ New Project Created"
        message = message or (
            f"Project '{project_name}' has been created and assigned to "
            f"customer '{customer_name}'."
        )

        _logger.info("NOTIFY: Sending to user_ids=%s — title=%s", user_ids, title)
        try:
            self.env['notification.manager'].sudo().send_push_notification(
                user_ids, title, message, notification_type='success'
            )
        except Exception as exc:
            _logger.error("NOTIFY: Failed to send notification: %s", exc)

    # Keep old name as alias for compatibility
    def _send_project_customer_notification(self, project_name, customer_name):
        self._send_project_notification(project_name, customer_name)

    # ------------------------------------------------------------------
    # CRUD overrides
    # ------------------------------------------------------------------

    def create(self, vals):
        project = super(Project, self).create(vals)
        # Notify whenever a customer OR project manager is set
        if project.partner_id or project.user_id:
            project._send_project_notification(
                project_name=project.name,
                customer_name=project.partner_id.name if project.partner_id else 'N/A',
            )
        return project

    def write(self, vals):
        # Capture old values before the write
        old_data = {
            p.id: {'partner_id': p.partner_id, 'user_id': p.user_id}
            for p in self
        }
        result = super(Project, self).write(vals)

        # Trigger notification when customer OR project manager changes
        partner_changed = 'partner_id' in vals
        manager_changed = 'user_id' in vals

        if partner_changed or manager_changed:
            for project in self:
                old = old_data.get(project.id, {})
                customer_changed = (
                    partner_changed and
                    project.partner_id and
                    old.get('partner_id') != project.partner_id
                )
                pm_changed = (
                    manager_changed and
                    project.user_id and
                    old.get('user_id') != project.user_id
                )
                if customer_changed or pm_changed:
                    project._send_project_notification(
                        project_name=project.name,
                        customer_name=project.partner_id.name if project.partner_id else 'N/A',
                        title="🔄 Project Updated",
                        message=(
                            f"Project '{project.name}' has been updated. "
                            f"Customer: {project.partner_id.name if project.partner_id else 'N/A'}, "
                            f"Manager: {project.user_id.name if project.user_id else 'N/A'}."
                        ),
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