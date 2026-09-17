from odoo import models
from markupsafe import Markup, escape
import logging

_logger = logging.getLogger(__name__)

class NotificationManager(models.AbstractModel):
    _name = 'notification.manager'
    _description = 'Push Notification Manager'

    # def send_fcm_notification(self, user_ids, title, message):
    #     """Sends push notification via FCM using the push.service."""
    #     if not user_ids:
    #         return
        
    #     try:
    #         self.env['push.service'].sudo().send_to_users(
    #             user_ids=user_ids,
    #             title=title,
    #             body=message
    #         )
    #     except Exception as e:
    #         _logger.error(f"FCM notification error via push.service: {e}")

    # Optional alias if other code still calls this name
    def send_push_notification(self, user_ids, title, message, notification_type='info'):
        """
        This method prepares the notification payload for Odoo's internal
        notification service and sends it over the bus.
        """
        _logger.info("--- DEBUG: send_push_notification called ---")
        _logger.info(f"--- DEBUG: Target User IDs: {user_ids} ---")

        users = self.env['res.users'].browse(user_ids)
        if not users:
            _logger.warning("--- DEBUG: No users found for the given IDs. Aborting. ---")
            return

        # Prepare Standard Odoo 'simple_notification' Payload (Sticky Toast)
        payload = {
            'type': notification_type,
            'title': title,
            'message': message,
            'sticky': False,  # Changed to False so it disappears automatically
        }

        # Use _sendone loop for maximum reliability across different user sessions
        for user in users:
            try:
                # Send to this specific partner's simple_notification channel
                self.env['bus.bus']._sendone(user.partner_id, 'simple_notification', payload)
            except Exception as e:
                _logger.error(f"--- DEBUG: Failed to send to user {user.name}: {e}")

        _logger.info(f"--- DEBUG: _sendone loop executed for {len(users)} users. ---")

        return self.send_chat_notification(user_ids, title, message)


    def send_chat_notification(self, user_ids, title, message):
        """
        Sends a chat message notification to the given user_ids.
        Reuses existing 1-to-1 chat channels for each recipient so duplicate channels are not created.
        """
        if not user_ids:
            _logger.warning("CHAT NOTIF: No users provided.")
            return

        Partner = self.env['res.partner']
        Channel = self.env['discuss.channel']
        sender_partner = self.env.user.partner_id

        desired_partners = Partner.search([('user_ids', 'in', user_ids)])
        if not desired_partners:
            return

        # Format message as proper HTML markup so Odoo message_post does not escape HTML tags
        if title:
            formatted_body = Markup("<p><strong>%s</strong><br/>%s</p>") % (escape(title), escape(message or ''))
        else:
            formatted_body = Markup("<p>%s</p>") % escape(message or '')

        # Target recipients (excluding sender if multiple users, otherwise include sender for self-notifications)
        recipients = desired_partners.filtered(lambda p: p.id != sender_partner.id) or desired_partners

        for recipient in recipients:
            try:
                # Find or reuse existing 1-on-1 direct chat channel
                channel = Channel.channel_get(partners_to=[recipient.id])
                if channel:
                    channel.message_post(
                        body=formatted_body,
                        message_type='comment',
                        subtype_xmlid='mail.mt_comment',
                        author_id=sender_partner.id,
                    )
                    _logger.info("CHAT NOTIF: Message posted to existing channel id=%s for partner %s", channel.id, recipient.name)
            except Exception as e:
                _logger.error("CHAT NOTIF: Failed to send message to partner %s: %s", recipient.name, e)

