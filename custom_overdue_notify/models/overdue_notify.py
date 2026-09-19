# -*- coding: utf-8 -*-
from odoo import models, api, fields
from datetime import date
import logging

_logger = logging.getLogger(__name__)


class CustomOverdueNotify(models.AbstractModel):
    _name = 'custom.overdue.notify'
    _description = 'Overdue Task Web Notification Sender'

    @api.model
    def send_overdue_notifications(self):
        """
        Scheduled action entry point.
        Finds all overdue active tasks and sends a grouped web notification
        to each assigned user via the push_notification_system module.
        """
        today = fields.Date.context_today(self)

        # 1. Fetch all overdue, active, non-done tasks with their assignees
        overdue_tasks = self.env['project.task'].sudo().search([
            ('active', '=', True),
            ('date_deadline', '<', today),
            ('state', 'not in', ['1_done', '1_canceled']),
        ])

        if not overdue_tasks:
            _logger.info('[OverdueNotify] No overdue tasks found. Skipping notifications.')
            return

        _logger.info('[OverdueNotify] Found %d overdue task(s). Processing...', len(overdue_tasks))

        # 2. Group tasks by assigned user
        user_task_map = {}  # { user_id: [task, ...] }
        for task in overdue_tasks:
            for user in task.user_ids:
                if user.active and not user.share:
                    user_task_map.setdefault(user.id, []).append(task)

        if not user_task_map:
            _logger.info('[OverdueNotify] No internal users assigned to overdue tasks.')
            return

        # 3. Send one grouped notification per user
        notification_manager = self.env['notification.manager'].sudo()
        for user_id, tasks in user_task_map.items():
            count = len(tasks)
            # Build task name list (max 5 shown to keep message compact)
            task_names = [t.name for t in tasks[:5]]
            task_list_str = '\n'.join(f'• {name}' for name in task_names)
            if count > 5:
                task_list_str += f'\n• ... and {count - 5} more'

            title = f'⚠️ {count} Overdue Task{"s" if count > 1 else ""}'
            message = (
                f'You have {count} overdue task{"s" if count > 1 else ""} '
                f'that require{"" if count > 1 else "s"} your immediate attention:\n'
                f'{task_list_str}'
            )

            try:
                notification_manager.send_push_notification(
                    user_ids=[user_id],
                    title=title,
                    message=message,
                    notification_type='warning',
                )
                _logger.info(
                    '[OverdueNotify] Notification sent to user_id=%d (%d overdue tasks)',
                    user_id, count
                )
            except Exception as e:
                _logger.error(
                    '[OverdueNotify] Failed to send notification to user_id=%d: %s',
                    user_id, e
                )

        _logger.info('[OverdueNotify] Done. Notified %d user(s).', len(user_task_map))
