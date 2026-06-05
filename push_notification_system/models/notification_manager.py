from odoo import models
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
        Attempts 1-to-1 chat first if possible, otherwise uses a group channel.
        """
        if not user_ids:
            _logger.warning("CHAT NOTIF: No users provided.")
            return

        Partner = self.env['res.partner']
        Channel = self.env['discuss.channel']
        Message = self.env['mail.message']
        User = self.env['res.users']

        desired_partners = Partner.search([('user_ids', 'in', user_ids)])
        desired_partner_ids = desired_partners.ids

        _logger.info("CHAT NOTIF: desired partners = %s", desired_partner_ids)

        members_vals = [(0, 0, {'partner_id': pid}) for pid in desired_partner_ids]
        channel = None

        # --- Try to create 1-to-1 chat first if 2 users ---
        if len(desired_partner_ids) == 2:
            try:
                channel = Channel.create({
                    'name': 'System Notifications',
                    'channel_type': 'chat',
                    'channel_member_ids': members_vals,
                })
                _logger.info("CHAT NOTIF: created 1-to-1 chat channel id=%s members=%s", channel.id, desired_partner_ids)
            except Exception as e:
                _logger.warning("CHAT NOTIF: failed to create chat channel, falling back to group channel. Error: %s", e)

        # --- Fallback to group channel if chat not created or >2 users ---
        if not channel:
            channel = Channel.create({
                'name': 'System Notifications',
                'channel_type': 'channel',
                'channel_member_ids': members_vals,
            })
            _logger.info("CHAT NOTIF: created group channel id=%s members=%s", channel.id, desired_partner_ids)

        # --- Post the message to the created/reused channel ---
        Message.create({
            'author_id': self.env.user.partner_id.id,
            'model': 'discuss.channel',
            'res_id': channel.id,
            'message_type': 'comment',
            'subtype_id': self.env.ref('mail.mt_comment').id,
            'body': f"<b>{title}</b><br/>{message}",
        })
        _logger.info("CHAT NOTIF: message posted to channel id=%s", channel.id)

