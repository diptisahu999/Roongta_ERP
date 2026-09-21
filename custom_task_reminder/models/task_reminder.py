# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError
from markupsafe import Markup, escape
import logging

_logger = logging.getLogger(__name__)


class CustomTaskReminderWizard(models.TransientModel):
    _name = 'custom.task.reminder'
    _description = 'Task Reminder Wizard'

    task_id = fields.Many2one('project.task', string='Task', required=True, ondelete='cascade')
    task_name = fields.Char(related='task_id.name', string='Task Name', readonly=True)
    recipient_ids = fields.Many2many(
        'res.users',
        'custom_task_reminder_user_rel',
        'wizard_id',
        'user_id',
        string='Recipients',
        required=True
    )
    message = fields.Text(
        string='Reminder Message',
        required=True,
        help="Type the custom reminder message to send to the assigned users."
    )
    send_chat = fields.Boolean(
        string='Send Direct Chat Message',
        default=True,
        help="Send a direct 1-to-1 Discuss chat message to the recipient(s)."
    )
    create_activity = fields.Boolean(
        string='Create Activity (Bell Menu)',
        default=True,
        help="Create a scheduled reminder activity on the task so it appears under the Bell menu."
    )
    post_chatter = fields.Boolean(
        string='Log in Task Chatter',
        default=True,
        help="Log an internal note in the task chatter that this reminder was sent."
    )

    @api.model
    def default_get(self, fields_list):
        res = super(CustomTaskReminderWizard, self).default_get(fields_list)
        active_id = self.env.context.get('default_task_id') or self.env.context.get('active_id')
        if active_id and self.env.context.get('active_model') in (False, 'project.task'):
            task = self.env['project.task'].browse(active_id)
            if task.exists():
                res['task_id'] = task.id
                if not res.get('recipient_ids') and task.user_ids:
                    res['recipient_ids'] = [(6, 0, task.user_ids.ids)]
                if not res.get('message'):
                    deadline_str = f" (Deadline: {task.date_deadline})" if task.date_deadline else ""
                    res['message'] = f"Friendly reminder to review and update the progress on task: '{task.name}'{deadline_str}."
        return res

    def action_send_reminder(self):
        self.ensure_one()
        if not self.recipient_ids:
            raise UserError(_("Please select at least one recipient user."))
        if not self.message or not self.message.strip():
            raise UserError(_("Please enter a reminder message."))

        task = self.task_id
        current_user = self.env.user
        recipient_users = self.recipient_ids
        user_ids = recipient_users.ids
        clean_msg = self.message.strip()

        # 1. Send Discuss / Chat notification via push_notification_system if available
        if self.send_chat:
            self._send_chat_reminder(task, recipient_users, clean_msg, current_user)

        # 2. Create Scheduled Activity in Bell / Activity menu
        if self.create_activity:
            self._schedule_activity_reminder(task, recipient_users, clean_msg, current_user)

        # 3. Post in Task Chatter if requested
        if self.post_chatter:
            recipient_names = ", ".join(recipient_users.mapped('name'))
            chatter_body = Markup(
                "<p>🔔 <strong>Task Reminder sent by %s</strong> to <strong>%s</strong>:</p>"
                "<blockquote>%s</blockquote>"
            ) % (escape(current_user.name), escape(recipient_names), escape(clean_msg).replace("\n", Markup("<br/>")))
            task.message_post(
                body=chatter_body,
                message_type='comment',
                subtype_xmlid='mail.mt_note'
            )

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Reminder Sent'),
                'message': _('Reminder successfully sent to %d user(s).') % len(recipient_users),
                'type': 'success',
                'sticky': False,
                'next': {'type': 'ir.actions.act_window_close'},
            }
        }

    def _schedule_activity_reminder(self, task, recipient_users, clean_msg, current_user):
        """Creates or updates a single scheduled reminder activity for each recipient user without duplicate stacking."""
        todo_type = self.env.ref('custom_task_reminder.mail_activity_type_task_reminder', raise_if_not_found=False)
        if not todo_type:
            todo_type = self.env.ref('mail.mail_activity_data_todo', raise_if_not_found=False)
        if not todo_type:
            todo_type = self.env['mail.activity.type'].search([], limit=1)

        activity_type_id = todo_type.id if todo_type else False
        task_model_id = self.env['ir.model']._get_id('project.task')
        deadline = task.date_deadline or fields.Date.today()
        summary = f"🔔 Reminder: {task.name}"
        note = Markup("<p><strong>Reminder from %s:</strong></p><blockquote>%s</blockquote>") % (
            escape(current_user.name),
            escape(clean_msg).replace("\n", Markup("<br/>"))
        )

        for user in recipient_users:
            try:
                # Search if this user already has an active activity on this task
                existing_user_activities = self.env['mail.activity'].sudo().search([
                    ('res_model', '=', 'project.task'),
                    ('res_id', '=', task.id),
                    ('user_id', '=', user.id),
                ])

                if existing_user_activities:
                    # Update existing activity for this user
                    existing_user_activities[0].write({
                        'activity_type_id': activity_type_id,
                        'summary': summary,
                        'note': note,
                        'date_deadline': deadline,
                    })
                    if len(existing_user_activities) > 1:
                        existing_user_activities[1:].unlink()
                    _logger.info("[TaskReminder] Updated activity for user %s on task %s", user.name, task.id)
                else:
                    self.env['mail.activity'].sudo().create({
                        'res_model_id': task_model_id,
                        'res_id': task.id,
                        'activity_type_id': activity_type_id,
                        'summary': summary,
                        'note': note,
                        'user_id': user.id,
                        'date_deadline': deadline,
                    })
                    _logger.info("[TaskReminder] Created scheduled activity for user %s on task %s", user.name, task.id)
            except Exception as e:
                _logger.error("[TaskReminder] Failed to schedule activity for user %s on task %s: %s", user.name, task.id, e)

    def _send_chat_reminder(self, task, recipient_users, clean_msg, current_user):
        """Sends rich formatted reminder chat to recipients."""
        task_url = f"/web#id={task.id}&model=project.task&view_type=form"
        my_tasks_act = self.env.ref('custom_mytask.action_my_tasks_dashboard', raise_if_not_found=False)
        dashboard_url = f"/odoo/action-{my_tasks_act.id}" if my_tasks_act else f"/odoo/action-414"

        deadline_info = ""
        if task.date_deadline:
            is_overdue = task.date_deadline < fields.Date.today()
            color = "#dc3545" if is_overdue else "#017e84"
            status_text = " (Overdue)" if is_overdue else ""
            deadline_info = f"<br/><span style='color: {color}; font-weight: 500;'>📅 Deadline: {task.date_deadline}{status_text}</span>"

        title = f"🔔 Reminder: {task.name}"
        html_msg = Markup(
            f"<div style='font-family: sans-serif; line-height: 1.5;'>"
            f"<strong>Reminder from {escape(current_user.name)}:</strong><br/>"
            f"<div style='margin: 6px 0; padding: 8px 12px; background: #f8fafc; border-left: 3px solid #0056b3; border-radius: 4px;'>"
            f"{escape(clean_msg).replace(chr(10), Markup('<br/>'))}"
            f"</div>"
            f"📌 Task: <a href='{task_url}' style='font-weight: 600; color: #0056b3; text-decoration: underline;'>{escape(task.name)}</a>"
            f"{deadline_info}"
            f"<br/><br/>"
            f"<a href='{dashboard_url}' style='display: inline-block; padding: 4px 10px; background: #0056b3; color: white; border-radius: 4px; text-decoration: none; font-size: 12px;'>Open My Tasks</a>"
            f"</div>"
        )

        notification_manager = self.env['notification.manager'].sudo() if 'notification.manager' in self.env else None
        if notification_manager:
            try:
                notification_manager.send_push_notification(
                    user_ids=recipient_users.ids,
                    title=title,
                    message=html_msg,
                    notification_type='warning'
                )
                _logger.info("[TaskReminder] Sent notification via NotificationManager to users %s", recipient_users.ids)
                return
            except Exception as e:
                _logger.warning("[TaskReminder] NotificationManager call failed: %s, falling back to direct Discuss channel", e)

        # Fallback to direct discuss channel if notification_manager is not present or failed
        Channel = self.env['discuss.channel'].sudo()
        sender_partner = current_user.partner_id
        for recipient in recipient_users:
            if not recipient.partner_id:
                continue
            try:
                channel = Channel.channel_get(partners_to=[recipient.partner_id.id])
                if channel:
                    channel.message_post(
                        body=html_msg,
                        message_type='comment',
                        subtype_xmlid='mail.mt_comment',
                        author_id=sender_partner.id,
                    )
            except Exception as e:
                _logger.error("[TaskReminder] Error posting to channel for user %s: %s", recipient.name, e)


class CustomTaskReminderResponseWizard(models.TransientModel):
    _name = 'custom.task.reminder.response'
    _description = 'Respond to Task Reminder'

    task_id = fields.Many2one('project.task', string='Task', required=True, ondelete='cascade')
    task_name = fields.Char(related='task_id.name', string='Task Name', readonly=True)
    original_note = fields.Html(string='Original Reminder', readonly=True)
    feedback = fields.Text(string='Your Feedback / Response', required=True, placeholder="Type your response here (e.g. once, done, updated in staging, working on it)...")

    @api.model
    def default_get(self, fields_list):
        res = super(CustomTaskReminderResponseWizard, self).default_get(fields_list)
        active_id = self.env.context.get('default_task_id') or self.env.context.get('active_id')
        if active_id:
            task = self.env['project.task'].browse(active_id)
            if task.exists():
                res['task_id'] = task.id
                # Look for latest reminder activity on this task
                act = self.env['mail.activity'].search([
                    ('res_model', '=', 'project.task'),
                    ('res_id', '=', task.id),
                    ('user_id', '=', self.env.user.id),
                ], order="id desc", limit=1)
                if act:
                    res['original_note'] = act.note or act.summary
                else:
                    # Look for any recent reminder message on task chatter
                    msg = self.env['mail.message'].search([
                        ('model', '=', 'project.task'),
                        ('res_id', '=', task.id),
                        ('body', 'ilike', 'Reminder'),
                    ], order="id desc", limit=1)
                    if msg:
                        res['original_note'] = msg.body
        return res

    def action_send_response(self):
        self.ensure_one()
        if not self.feedback or not self.feedback.strip():
            raise UserError(_("Please enter your feedback response."))

        task = self.task_id
        current_user = self.env.user
        clean_feedback = self.feedback.strip()

        # Find user's active reminder activities for this task
        activities = self.env['mail.activity'].search([
            ('res_model', '=', 'project.task'),
            ('res_id', '=', task.id),
            ('user_id', '=', current_user.id),
        ])

        if activities:
            activities._action_done(feedback=clean_feedback)
        else:
            all_task_activities = self.env['mail.activity'].search([
                ('res_model', '=', 'project.task'),
                ('res_id', '=', task.id),
            ])
            if all_task_activities:
                all_task_activities._action_done(feedback=clean_feedback)
            else:
                # Format and post directly to task chatter and Discuss
                formatted_body = Markup(
                    f"<div style='font-family: inherit; line-height: 1.5;'>"
                    f"<p style='margin-bottom: 8px;'>🔔 <strong>Task Reminder done : 🔔 Reminder: {escape(task.name)}</strong></p>"
                    f"<p style='margin-bottom: 4px;'><strong>Original note:</strong><br/>"
                    f"{self.original_note or 'Task Reminder'}</p>"
                    f"<p style='margin-bottom: 0;'><strong>Feedback:</strong><br/>"
                    f"{escape(clean_feedback)}</p>"
                    f"</div>"
                )
                task.message_post(
                    body=formatted_body,
                    message_type='comment',
                    subtype_xmlid='mail.mt_comment',
                    author_id=current_user.partner_id.id,
                )

                # Also send to Discuss channel with task creator
                creator_user = task.create_uid
                if creator_user and creator_user.partner_id and creator_user.id != current_user.id:
                    try:
                        Channel = self.env['discuss.channel'].sudo()
                        channel = Channel.channel_get(partners_to=[creator_user.partner_id.id])
                        if channel:
                            channel.message_post(
                                body=formatted_body,
                                message_type='comment',
                                subtype_xmlid='mail.mt_comment',
                                author_id=current_user.partner_id.id,
                            )
                    except Exception as e:
                        _logger.error("[TaskReminder] Failed sending response to discuss: %s", e)

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Response Sent'),
                'message': _('Your response has been sent and reminder completed.'),
                'type': 'success',
                'sticky': False,
                'next': {
                    'type': 'ir.actions.client',
                    'tag': 'reload',
                },
            }
        }


class MailActivity(models.Model):
    _inherit = 'mail.activity'

    def _action_done(self, feedback=False, attachment_ids=None):
        """Override to format reminder completion and notify the sender in Discuss."""
        reminder_type = self.env.ref('custom_task_reminder.mail_activity_type_task_reminder', raise_if_not_found=False)
        if not reminder_type:
            reminder_type = self.env.ref('custom_task_reminder.mail_activity_type_reminder', raise_if_not_found=False)

        notifications_to_send = []

        for act in self:
            is_reminder = (reminder_type and act.activity_type_id == reminder_type) or (act.summary and 'Reminder' in act.summary)
            if is_reminder and act.res_model == 'project.task':
                creator = act.create_uid
                current_user = self.env.user
                task = self.env['project.task'].browse(act.res_id)
                if creator and task.exists():
                    notifications_to_send.append({
                        'creator_user_id': creator.id,
                        'creator_partner_id': creator.partner_id.id,
                        'task_id': task.id,
                        'task_name': task.name,
                        'original_note': act.note or act.summary or '',
                        'feedback': feedback or '',
                        'responder_name': current_user.name,
                        'responder_partner_id': current_user.partner_id.id,
                    })

        res = super(MailActivity, self)._action_done(feedback=feedback, attachment_ids=attachment_ids)

        # Dispatch response to Discuss chat channel and Notification Manager
        for notif in notifications_to_send:
            try:
                formatted_body = Markup(
                    f"<div style='font-family: inherit; line-height: 1.5;'>"
                    f"<p style='margin-bottom: 8px;'>🔔 <strong>Task Reminder done : 🔔 Reminder: {escape(notif['task_name'])}</strong></p>"
                    f"<p style='margin-bottom: 4px;'><strong>Original note:</strong><br/>"
                    f"{notif['original_note']}</p>"
                    f"<p style='margin-bottom: 0;'><strong>Feedback:</strong><br/>"
                    f"{escape(notif['feedback']) if notif['feedback'] else '<em>(Marked as done)</em>'}</p>"
                    f"</div>"
                )

                # 1. Direct Discuss chat channel with the creator
                if notif['creator_partner_id'] and notif['creator_partner_id'] != notif['responder_partner_id']:
                    Channel = self.env['discuss.channel'].sudo()
                    channel = Channel.channel_get(partners_to=[notif['creator_partner_id']])
                    if channel:
                        channel.message_post(
                            body=formatted_body,
                            message_type='comment',
                            subtype_xmlid='mail.mt_comment',
                            author_id=notif['responder_partner_id'],
                        )
                        _logger.info("[TaskReminder] Posted response to discuss channel with creator %s", notif['creator_user_id'])

                # 2. Push Notification if Notification Manager is installed
                notification_manager = self.env['notification.manager'].sudo() if 'notification.manager' in self.env else None
                if notification_manager and notif['creator_user_id'] != self.env.user.id:
                    try:
                        notification_manager.send_push_notification(
                            user_ids=[notif['creator_user_id']],
                            title=f"🔔 Task Reminder done : {notif['task_name']}",
                            message=formatted_body,
                            notification_type='info'
                        )
                    except Exception as pe:
                        _logger.warning("[TaskReminder] Push notification failed: %s", pe)

            except Exception as e:
                _logger.error("[TaskReminder] Error sending response to Discuss: %s", e)

        return res


class ProjectTask(models.Model):
    _inherit = 'project.task'

    def action_open_reminder_wizard(self):
        """Opens the reminder popup wizard from task views."""
        self.ensure_one()
        return {
            'name': _('Send Task Reminder'),
            'type': 'ir.actions.act_window',
            'res_model': 'custom.task.reminder',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_task_id': self.id,
                'default_recipient_ids': [(6, 0, self.user_ids.ids)],
            }
        }

    def action_open_reminder_response_wizard(self):
        """Opens the reply / response popup for this task's reminder."""
        self.ensure_one()
        return {
            'name': _('Reply to Reminder'),
            'type': 'ir.actions.act_window',
            'res_model': 'custom.task.reminder.response',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_task_id': self.id,
            }
        }

    @api.model
    def get_task_reminder_info(self, task_id):
        """API endpoint to get task metadata and assignees for OWL Modal."""
        task = self.browse(task_id)
        if not task.exists():
            return {'error': 'Task not found'}

        today = fields.Date.today()
        is_overdue = bool(task.date_deadline and task.date_deadline < today and task.state not in ['1_done', '1_canceled'])
        formatted_deadline = task.date_deadline.strftime("%d/%m/%Y") if task.date_deadline else ""

        assignees = []
        for u in task.user_ids:
            assignees.append({
                'id': u.id,
                'name': u.name,
                'email': u.email or '',
                'avatar_url': f"/web/image/res.users/{u.id}/avatar_128",
            })

        # All selectable project team users
        all_users = []
        internal_users = self.env['res.users'].sudo().search([
            ('active', '=', True),
            ('share', '=', False),
        ], limit=50, order='name asc')
        for u in internal_users:
            all_users.append({
                'id': u.id,
                'name': u.name,
                'email': u.email or '',
                'avatar_url': f"/web/image/res.users/{u.id}/avatar_128",
            })

        return {
            'id': task.id,
            'name': task.name,
            'project_name': task.project_id.name if task.project_id else '',
            'deadline': formatted_deadline,
            'raw_deadline': str(task.date_deadline) if task.date_deadline else '',
            'is_overdue': is_overdue,
            'stage_name': task.stage_id.name if task.stage_id else '',
            'priority': task.priority,
            'assignees': assignees,
            'all_users': all_users,
        }

    @api.model
    def get_systray_reminders(self):
        """Fetch active reminder activities for the current user."""
        user = self.env.user
        reminders = []
        
        import re
        html_tag_regex = re.compile(r'<[^>]+>')

        # Activities on project.task assigned to user
        Activity = self.env['mail.activity'].sudo()
        activities = Activity.search([
            ('user_id', '=', user.id),
            ('res_model', '=', 'project.task'),
        ], order="id desc", limit=30)

        for act in activities:
            task = self.browse(act.res_id)
            if not task.exists():
                continue

            author = act.create_uid
            author_name = author.name if author else "Admin"
            author_initial = author_name[:1].upper() if author_name else "A"
            
            raw_note = act.note or ''
            clean_note = html_tag_regex.sub(' ', raw_note).strip()
            clean_note = " ".join(clean_note.split())
            if not clean_note:
                clean_note = act.summary or f"Reminder: Task '{task.name}'"
            
            snippet = clean_note
            if len(snippet) > 85:
                snippet = snippet[:82] + "..."

            create_dt = act.create_date or fields.Datetime.now()
            time_str = create_dt.strftime("%I:%M %p").lstrip('0')
            date_str = create_dt.strftime("%d/%m/%Y")
            is_overdue = bool(act.date_deadline and act.date_deadline < fields.Date.today())

            reminders.append({
                'id': f"act_{act.id}",
                'task_id': task.id,
                'task_name': task.name,
                'author_id': author.id if author else False,
                'author_partner_id': author.partner_id.id if author and author.partner_id else False,
                'author_name': author_name,
                'author_initial': author_initial,
                'author_avatar': f"/web/image/res.users/{author.id}/avatar_128" if author else "",
                'summary': act.summary or f"Reminder for {task.name}",
                'snippet': snippet,
                'time_str': time_str,
                'date_str': date_str,
                'date_deadline': str(act.date_deadline) if act.date_deadline else "",
                'is_overdue': is_overdue,
            })

        return {
            'count': len(reminders),
            'reminders': reminders,
        }

    @api.model
    def send_task_reminder_rpc(self, task_id=False, recipient_ids=None, message="", send_chat=True, create_activity=True, post_chatter=True, **kwargs):
        """API endpoint invoked from OWL popup modal to send reminders."""
        try:
            if not task_id:
                return {'success': False, 'error': 'Task ID is required'}
            task = self.browse(task_id)
            if not task.exists():
                return {'success': False, 'error': 'Task not found'}

            if not recipient_ids:
                return {'success': False, 'error': 'Please select at least one recipient.'}

            if not message or not message.strip():
                return {'success': False, 'error': 'Please enter a reminder message.'}

            wizard = self.env['custom.task.reminder'].create({
                'task_id': task.id,
                'recipient_ids': [(6, 0, recipient_ids)],
                'message': message.strip(),
                'send_chat': bool(send_chat),
                'create_activity': bool(create_activity),
                'post_chatter': bool(post_chatter),
            })

            wizard.action_send_reminder()
            return {
                'success': True,
                'message': f"Reminder sent to {len(recipient_ids)} assignee(s) successfully!"
            }
        except Exception as e:
            _logger.error("[TaskReminder] send_task_reminder_rpc error: %s", e)
            return {
                'success': False,
                'error': str(e)
            }
