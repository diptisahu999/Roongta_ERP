# -*- coding: utf-8 -*-
import json
import base64
import re
from datetime import datetime, date, timedelta
from odoo import http, fields
from odoo.http import request

PASTEL_COLORS = [
    {'bg': '#EEF2FF', 'text': '#4F46E5', 'border': '#C7D2FE'},
    {'bg': '#FEF3C7', 'text': '#D97706', 'border': '#FDE68A'},
    {'bg': '#DCFCE7', 'text': '#16A34A', 'border': '#BBF7D0'},
    {'bg': '#E0F2FE', 'text': '#0284C7', 'border': '#BAE6FD'},
    {'bg': '#FCE7F3', 'text': '#DB2777', 'border': '#FBCFE8'},
    {'bg': '#F3E8FF', 'text': '#9333EA', 'border': '#E9D5FF'},
    {'bg': '#CFFAFE', 'text': '#0891B2', 'border': '#A5F3FC'},
    {'bg': '#F1F5F9', 'text': '#475569', 'border': '#CBD5E1'},
]

def clean_html_snippet(html_text):
    if not html_text:
        return ''
    clean = re.sub(r'<[^>]+>', ' ', html_text)
    clean = clean.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
    clean = re.sub(r'<[^>]+>', ' ', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean

def get_clean_initials(name):
    if not name:
        return '?'
    # Clean string and extract meaningful words
    clean = re.sub(r'[^A-Za-z0-9\s]', ' ', name).strip()
    words = clean.split()
    if not words:
        return '?'
    
    # Filter out time markers like AM/PM or pure numbers if letters exist
    alpha_words = [w for w in words if re.search(r'[A-Za-z]', w) and w.upper() not in ('AM', 'PM')]
    if len(alpha_words) >= 2:
        return (alpha_words[0][0] + alpha_words[1][0]).upper()
    elif len(alpha_words) == 1:
        w = alpha_words[0]
        return w[:2].upper() if len(w) >= 2 else w.upper()
    
    # Fallback to general words
    if len(words) >= 2:
        return (words[0][0] + words[1][0]).upper()
    return words[0][:2].upper()

def format_message_time(dt):
    if not dt:
        return ''
    now = fields.Datetime.now()
    user_tz = request.env.user.tz or 'UTC'
    try:
        import pytz
        tz = pytz.timezone(user_tz)
        local_dt = pytz.utc.localize(dt).astimezone(tz)
        local_now = pytz.utc.localize(now).astimezone(tz)
    except Exception:
        local_dt = dt
        local_now = now

    diff_days = (local_now.date() - local_dt.date()).days
    if diff_days == 0:
        return local_dt.strftime('%I:%M %p').lstrip('0')
    elif diff_days == 1:
        return 'Yesterday'
    elif diff_days < 7:
        return local_dt.strftime('%a')
    else:
        return local_dt.strftime('%d %b')

def format_file_size(size_bytes):
    if not size_bytes:
        return '0 B'
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"

def get_channel_metadata(ch, current_partner):
    """
    Resolves the proper display name, avatar, and initials for a channel.
    Ensures that generic names like 'Chat' or unnamed group meetings resolve
    to the actual participants involved in the conversation.
    """
    other_members = ch.channel_member_ids.filtered(
        lambda m: m.partner_id and m.partner_id.id != current_partner.id
    )
    other_partners = other_members.mapped('partner_id')

    raw_name = (ch.name or '').strip()
    is_generic_name = (not raw_name) or (raw_name.lower() in ('chat', 'direct chat', 'general', 'live conference', 'conversation'))

    display_name = raw_name
    avatar_url = f'/web/image/discuss.channel/{ch.id}/avatar_128'
    has_custom_avatar = False
    other_partner = None

    if ch.channel_type == 'chat':
        if other_partners:
            other_partner = other_partners[0]
            display_name = other_partner.name or 'Colleague'
            avatar_url = f'/web/image/res.partner/{other_partner.id}/avatar_128'
            has_custom_avatar = bool(other_partner.image_128)
        else:
            display_name = f"{current_partner.name} (Notes)"
            avatar_url = f'/web/image/res.partner/{current_partner.id}/avatar_128'
            has_custom_avatar = bool(current_partner.image_128)
    else:
        # If auto-generated meeting name and has participants
        if raw_name.lower().startswith('meeting') and other_partners:
            if len(other_partners) == 1:
                other_partner = other_partners[0]
                display_name = f"{other_partner.name} (Meeting)"
                avatar_url = f'/web/image/res.partner/{other_partner.id}/avatar_128'
                has_custom_avatar = bool(other_partner.image_128)
                initials = get_clean_initials(other_partner.name)
                return {
                    'display_name': display_name,
                    'avatar_url': avatar_url,
                    'has_custom_avatar': has_custom_avatar,
                    'initials': initials,
                    'other_partner': other_partner,
                }
            else:
                names = [p.name.split()[0] for p in other_partners if p.name]
                display_name = f"Meeting ({', '.join(names[:3])})"
                avatar_url = f'/web/image/discuss.channel/{ch.id}/avatar_128'
                has_custom_avatar = bool(getattr(ch, 'image_128', False))
                initials = get_clean_initials(' '.join(names[:2]))
                return {
                    'display_name': display_name,
                    'avatar_url': avatar_url,
                    'has_custom_avatar': has_custom_avatar,
                    'initials': initials,
                    'other_partner': other_partners[0] if other_partners else None,
                }

        # Group or public channel
        if not is_generic_name:
            display_name = raw_name
            avatar_url = f'/web/image/discuss.channel/{ch.id}/avatar_128'
            has_custom_avatar = bool(getattr(ch, 'image_128', False))
            if len(other_partners) == 1 and not has_custom_avatar and other_partners[0].image_128:
                other_partner = other_partners[0]
                avatar_url = f'/web/image/res.partner/{other_partner.id}/avatar_128'
                has_custom_avatar = True
        else:
            if len(other_partners) == 1:
                other_partner = other_partners[0]
                display_name = other_partner.name or 'Colleague'
                avatar_url = f'/web/image/res.partner/{other_partner.id}/avatar_128'
                has_custom_avatar = bool(other_partner.image_128)
            elif len(other_partners) > 1:
                short_names = [p.name.split()[0] for p in other_partners if p.name]
                display_name = ", ".join(short_names[:3])
                if len(other_partners) > 3:
                    display_name += f" (+{len(other_partners) - 3})"
                avatar_url = f'/web/image/discuss.channel/{ch.id}/avatar_128'
                has_custom_avatar = bool(getattr(ch, 'image_128', False))
            else:
                display_name = raw_name or f"{current_partner.name} (Direct)"
                avatar_url = f'/web/image/res.partner/{current_partner.id}/avatar_128'
                has_custom_avatar = bool(current_partner.image_128)

    initials = get_clean_initials(display_name)
    return {
        'display_name': display_name,
        'avatar_url': avatar_url,
        'has_custom_avatar': has_custom_avatar,
        'initials': initials,
        'other_partner': other_partner,
    }


class CustomDiscussController(http.Controller):

    @http.route('/custom_discuss/data', type='json', auth='user')
    def get_discuss_data(self):
        env = request.env
        user = env.user
        partner = user.partner_id

        # Auto-clear stuck email failure notifications so they don't block the systray or counters
        try:
            failed_notifications = env['mail.notification'].sudo().search([
                ('notification_status', 'in', ['exception', 'bounce'])
            ])
            if failed_notifications:
                failed_notifications.write({'notification_status': 'canceled'})

            failed_mails = env['mail.mail'].sudo().search([
                ('state', '=', 'exception')
            ])
            if failed_mails:
                failed_mails.write({'state': 'cancel'})
        except Exception:
            pass

        # Channels where user is a member
        memberships = env['discuss.channel.member'].search([('partner_id', '=', partner.id)])
        channel_ids = memberships.mapped('channel_id')

        # Get channels sorted by activity
        channels = channel_ids.sorted(key=lambda c: c.write_date or fields.Datetime.now(), reverse=True)

        channel_list = []
        total_unread_conversations = 0

        member_map = {m.channel_id.id: m for m in memberships}

        for idx, ch in enumerate(channels):
            m = member_map.get(ch.id)
            unread_count = m.message_unread_counter if m else 0
            if unread_count > 0:
                total_unread_conversations += 1

            meta = get_channel_metadata(ch, partner)
            display_name = meta['display_name']
            avatar_url = meta['avatar_url']
            has_custom_avatar = meta['has_custom_avatar']
            initials = meta['initials']
            other_partner = meta['other_partner']
            ch_type = ch.channel_type

            # Last message in channel
            last_msg = env['mail.message'].search([
                ('model', '=', 'discuss.channel'),
                ('res_id', '=', ch.id),
                ('message_type', '!=', 'user_notification')
            ], order='id desc', limit=1)

            last_msg_info = None
            if last_msg:
                snippet = clean_html_snippet(last_msg.body)
                if not snippet and last_msg.attachment_ids:
                    snippet = f"Attachment ({len(last_msg.attachment_ids)})"
                elif not snippet:
                    snippet = "No message text"

                author_name = last_msg.author_id.name if last_msg.author_id else 'System'
                last_msg_info = {
                    'id': last_msg.id,
                    'snippet': snippet,
                    'author_name': author_name,
                    'time_str': format_message_time(last_msg.date),
                    'date': last_msg.date.strftime('%Y-%m-%d %H:%M:%S') if last_msg.date else '',
                }

            color_choice = PASTEL_COLORS[idx % len(PASTEL_COLORS)]

            channel_list.append({
                'id': ch.id,
                'name': display_name,
                'channel_type': ch_type,
                'avatar_url': avatar_url,
                'has_custom_avatar': has_custom_avatar,
                'initials': initials,
                'pastel': color_choice,
                'unread_count': unread_count,
                'last_message': last_msg_info,
                'member_count': len(ch.channel_member_ids),
                'other_partner_id': other_partner.id if other_partner else False,
            })

        channel_list.sort(
            key=lambda c: (
                c['last_message']['date'] if (c['last_message'] and c['last_message']['date']) else '1970-01-01'
            ),
            reverse=True
        )

        # Mentions / Needaction messages for current user
        needaction_msgs = env['mail.message'].search([
            ('needaction', '=', True)
        ], order='id desc', limit=20)

        mentions_list = []
        for msg in needaction_msgs:
            task_card = None
            if msg.model == 'project.task' and msg.res_id and 'project.task' in env:
                task = env['project.task'].browse(msg.res_id).exists()
                if task:
                    task_card = {
                        'task_id': task.id,
                        'name': task.name,
                        'project_name': task.project_id.name if task.project_id else 'No Project',
                        'stage_name': task.stage_id.name if task.stage_id else '',
                        'priority': task.priority or '0',
                    }

            mentions_list.append({
                'id': msg.id,
                'subject': msg.subject or msg.record_name or 'Notification',
                'snippet': clean_html_snippet(msg.body)[:100],
                'author_name': msg.author_id.name if msg.author_id else 'System',
                'time_str': format_message_time(msg.date),
                'model': msg.model,
                'res_id': msg.res_id,
                'task_card': task_card,
            })

        pending_tasks_count = env['project.task'].search_count([
            ('user_ids', 'in', [user.id]),
            ('state', 'not in', ['1_done', '1_canceled'])
        ]) if 'project.task' in env else 0

        meetings_today_count = 0
        if 'calendar.event' in env:
            today_start = fields.Datetime.to_string(datetime.combine(date.today(), datetime.min.time()))
            today_end = fields.Datetime.to_string(datetime.combine(date.today(), datetime.max.time()))
            meetings_today_count = env['calendar.event'].search_count([
                ('partner_ids', 'in', [partner.id]),
                ('start', '>=', today_start),
                ('start', '<=', today_end)
            ])

        return {
            'user': {
                'id': user.id,
                'name': user.name,
                'partner_id': partner.id,
                'avatar_url': f'/web/image/res.partner/{partner.id}/avatar_128',
                'email': user.email or '',
                'role': user.employee_id.job_title if hasattr(user, 'employee_id') and user.employee_id and user.employee_id.job_title else '',
            },
            'channels': channel_list,
            'mentions': mentions_list,
            'counts': {
                'all': len(channel_list),
                'mentions': len(mentions_list),
                'unread': total_unread_conversations,
            },
            'quick_stats': {
                'pending_tasks': pending_tasks_count,
                'meetings_today': meetings_today_count,
            }
        }

    @http.route('/custom_discuss/channel_messages', type='json', auth='user')
    def get_channel_messages(self, channel_id, limit=60, before_id=None):
        env = request.env
        user = env.user
        partner = user.partner_id

        channel = env['discuss.channel'].browse(int(channel_id)).exists()
        if not channel:
            return {'error': 'Channel not found'}

        member = env['discuss.channel.member'].search([
            ('channel_id', '=', channel.id),
            ('partner_id', '=', partner.id)
        ], limit=1)

        domain = [
            ('model', '=', 'discuss.channel'),
            ('res_id', '=', channel.id),
        ]
        if before_id:
            domain.append(('id', '<', int(before_id)))

        messages = env['mail.message'].search(domain, order='id desc', limit=int(limit))
        messages = messages.sorted(key=lambda m: m.id)

        msg_list = []
        last_date_header = None
        today = date.today()

        for msg in messages:
            is_self = (msg.author_id.id == partner.id) if msg.author_id else False
            is_starred = partner in msg.starred_partner_ids

            attachments = []
            for att in msg.attachment_ids:
                is_image = bool(att.mimetype and att.mimetype.startswith('image/'))
                attachments.append({
                    'id': att.id,
                    'name': att.name,
                    'mimetype': att.mimetype or 'application/octet-stream',
                    'is_image': is_image,
                    'url': f"/web/content/{att.id}?download=true",
                    'view_url': f"/web/image/{att.id}",
                    'size': format_file_size(att.file_size),
                })

            task_card = None
            if msg.model == 'project.task' and msg.res_id and 'project.task' in env:
                t = env['project.task'].browse(msg.res_id).exists()
                if t:
                    task_card = {
                        'task_id': t.id,
                        'name': t.name,
                        'project_name': t.project_id.name if t.project_id else '',
                        'stage_name': t.stage_id.name if t.stage_id else '',
                        'priority': t.priority or '0',
                    }

            msg_dt = msg.date or fields.Datetime.now()
            if msg_dt.date() == today:
                date_header = "Today"
            elif msg_dt.date() == today - timedelta(days=1):
                date_header = "Yesterday"
            else:
                date_header = msg_dt.strftime("%d %B %Y")

            show_date_divider = (date_header != last_date_header)
            if show_date_divider:
                last_date_header = date_header

            time_str = msg_dt.strftime("%I:%M %p").lstrip('0')
            author_id = msg.author_id.id if msg.author_id else False
            author_name = msg.author_id.name if msg.author_id else 'System'
            author_avatar = f"/web/image/res.partner/{author_id}/avatar_128" if author_id else "/web/static/img/placeholder.png"

            msg_list.append({
                'id': msg.id,
                'body': msg.body or '',
                'body_plain': clean_html_snippet(msg.body),
                'author_id': author_id,
                'author_name': author_name,
                'author_avatar': author_avatar,
                'is_self': is_self,
                'is_starred': is_starred,
                'time_str': time_str,
                'date_header': date_header,
                'show_date_divider': show_date_divider,
                'attachments': attachments,
                'task_card': task_card,
            })

        # Mark channel as read for this member with newest message id
        if member and messages:
            try:
                member._mark_as_read(messages[-1].id, sync=True)
            except Exception:
                pass

        meta = get_channel_metadata(channel, partner)
        display_name = meta['display_name']
        avatar_url = meta['avatar_url']
        has_custom_avatar = meta['has_custom_avatar']
        initials = meta['initials']
        other_partner = meta['other_partner']

        members_info = []
        creator_partner_id = channel.create_uid.partner_id.id if (channel.create_uid and channel.create_uid.partner_id) else False
        for mem in channel.channel_member_ids[:100]:
            p = mem.partner_id
            if p:
                u = p.user_ids and p.user_ids[0]
                job_title = ''
                if u and hasattr(u, 'employee_id') and u.employee_id:
                    job_title = u.employee_id.job_title or (u.employee_id.department_id.name if u.employee_id.department_id else '') or ''
                members_info.append({
                    'id': p.id,
                    'name': p.name or 'User',
                    'avatar': f"/web/image/res.partner/{p.id}/avatar_128",
                    'has_custom_avatar': bool(p.image_128),
                    'initials': get_clean_initials(p.name),
                    'email': p.email or '',
                    'job_title': job_title,
                    'is_self': p.id == partner.id,
                    'is_creator': p.id == creator_partner_id,
                })

        return {
            'channel': {
                'id': channel.id,
                'name': display_name,
                'channel_type': channel.channel_type,
                'description': channel.description or '',
                'members': members_info,
                'member_count': len(channel.channel_member_ids),
                'avatar_url': avatar_url,
                'has_custom_avatar': has_custom_avatar,
                'pastel': PASTEL_COLORS[channel.id % len(PASTEL_COLORS)],
                'initials': initials,
                'uuid': channel.uuid,
                'invitation_url': f"{channel.get_base_url()}/chat/{channel.id}/{channel.uuid}" if channel.uuid and channel.channel_type != 'chat' else '',
            },
            'messages': msg_list
        }

    @http.route('/custom_discuss/send_message', type='json', auth='user')
    def send_message(self, channel_id, body, attachment_ids=None):
        env = request.env
        user = env.user
        partner = user.partner_id

        channel = env['discuss.channel'].browse(int(channel_id)).exists()
        if not channel:
            return {'error': 'Channel not found'}

        attachment_ids = [int(aid) for aid in (attachment_ids or [])]

        message = channel.message_post(
            body=body,
            message_type='comment',
            subtype_xmlid='mail.mt_comment',
            attachment_ids=attachment_ids,
        )

        member = env['discuss.channel.member'].search([
            ('channel_id', '=', channel.id),
            ('partner_id', '=', partner.id)
        ], limit=1)
        if member:
            try:
                member._mark_as_read(message.id, sync=True)
            except Exception:
                pass

        attachments = []
        for att in message.attachment_ids:
            attachments.append({
                'id': att.id,
                'name': att.name,
                'mimetype': att.mimetype or 'application/octet-stream',
                'is_image': bool(att.mimetype and att.mimetype.startswith('image/')),
                'url': f"/web/content/{att.id}?download=true",
                'view_url': f"/web/image/{att.id}",
                'size': format_file_size(att.file_size),
            })

        msg_dt = message.date or fields.Datetime.now()
        return {
            'id': message.id,
            'body': message.body or '',
            'body_plain': clean_html_snippet(message.body),
            'author_id': partner.id,
            'author_name': partner.name,
            'author_avatar': f"/web/image/res.partner/{partner.id}/avatar_128",
            'is_self': True,
            'is_starred': False,
            'time_str': msg_dt.strftime("%I:%M %p").lstrip('0'),
            'date_header': "Today",
            'show_date_divider': False,
            'attachments': attachments,
            'task_card': None,
        }

    @http.route('/custom_discuss/mark_seen', type='json', auth='user')
    def mark_seen(self, channel_id):
        env = request.env
        member = env['discuss.channel.member'].search([
            ('channel_id', '=', int(channel_id)),
            ('partner_id', '=', env.user.partner_id.id)
        ], limit=1)
        if member:
            try:
                last_msg = env['mail.message'].search([
                    ('model', '=', 'discuss.channel'),
                    ('res_id', '=', int(channel_id)),
                ], order='id desc', limit=1)
                if last_msg:
                    member._mark_as_read(last_msg.id, sync=True)
            except Exception:
                pass
        return {'success': True}

    @http.route('/custom_discuss/toggle_star', type='json', auth='user')
    def toggle_star(self, message_id):
        env = request.env
        msg = env['mail.message'].browse(int(message_id)).exists()
        if not msg:
            return {'error': 'Message not found'}
        partner = env.user.partner_id
        if partner in msg.starred_partner_ids:
            msg.write({'starred_partner_ids': [(3, partner.id)]})
            is_starred = False
        else:
            msg.write({'starred_partner_ids': [(4, partner.id)]})
            is_starred = True
        return {'is_starred': is_starred}

    @http.route('/custom_discuss/users_list', type='json', auth='user')
    def search_users(self, query=''):
        env = request.env
        user = env.user
        domain = [('active', '=', True), ('id', '!=', user.id)]
        public_user = env.ref('base.public_user', raise_if_not_found=False)
        if public_user:
            domain.append(('id', '!=', public_user.id))

        if query and query.strip():
            q = query.strip()
            domain.extend([
                '|', ('name', 'ilike', q), ('email', 'ilike', q)
            ])

        users = env['res.users'].search(domain, order='name asc', limit=300)
        result = []
        for u in users:
            pid = u.partner_id.id if u.partner_id else False
            if not pid:
                continue

            job_title = ''
            if hasattr(u, 'employee_id') and u.employee_id:
                job_title = u.employee_id.job_title or (u.employee_id.department_id.name if u.employee_id.department_id else '') or ''

            result.append({
                'id': u.id,
                'name': u.name or 'User',
                'partner_id': pid,
                'email': u.email or '',
                'avatar_url': f"/web/image/res.partner/{pid}/avatar_128",
                'has_custom_avatar': bool(u.partner_id.image_128),
                'initials': get_clean_initials(u.name),
                'job_title': job_title,
            })
        return result

    @http.route('/custom_discuss/get_or_create_chat', type='json', auth='user')
    def get_or_create_chat(self, partner_id):
        env = request.env
        target_partner = env['res.partner'].browse(int(partner_id)).exists()
        if not target_partner:
            return {'error': 'Partner not found'}

        channel = env['discuss.channel'].channel_get(partners_to=[target_partner.id])
        return {'channel_id': channel.id if channel else False}

    @http.route('/custom_discuss/create_group_channel', type='json', auth='user')
    def create_group_channel(self, name, partner_ids=None, description=''):
        env = request.env
        user = env.user
        partner_ids = [int(pid) for pid in (partner_ids or [])]
        if user.partner_id.id not in partner_ids:
            partner_ids.append(user.partner_id.id)

        channel_type = 'group'
        channel = env['discuss.channel'].create({
            'name': name.strip(),
            'channel_type': channel_type,
            'description': description.strip() if description else False,
            'channel_member_ids': [(0, 0, {'partner_id': pid}) for pid in partner_ids],
        })
        return {'channel_id': channel.id}

    @http.route('/custom_discuss/invite_members', type='json', auth='user')
    def invite_members(self, channel_id, partner_ids, invite_to_call=True):
        env = request.env
        channel = env['discuss.channel'].browse(int(channel_id)).exists()
        if not channel:
            return {'error': 'Channel not found'}

        partner_ids = [int(pid) for pid in (partner_ids or [])]
        if not partner_ids:
            return {'error': 'No partners selected'}

        if channel.channel_type == 'chat':
            all_partner_ids = list(set(channel.channel_member_ids.mapped('partner_id.id') + partner_ids))
            partner_names = env['res.partner'].browse(partner_ids).mapped('name')
            new_channel = env['discuss.channel'].create({
                'name': f"{channel.name}, {', '.join(partner_names)}",
                'channel_type': 'group',
                'channel_member_ids': [(0, 0, {'partner_id': pid}) for pid in all_partner_ids],
            })
            if invite_to_call:
                try:
                    new_channel.add_members(partner_ids=partner_ids, invite_to_rtc_call=True)
                except Exception:
                    pass
            invitation_url = f"{new_channel.get_base_url()}/chat/{new_channel.id}/{new_channel.uuid}" if new_channel.uuid else ''
            return {
                'success': True,
                'channel_id': new_channel.id,
                'is_new_channel': True,
                'member_count': len(new_channel.channel_member_ids),
                'invitation_url': invitation_url,
            }
        else:
            channel.add_members(
                partner_ids=partner_ids,
                invite_to_rtc_call=invite_to_call,
                open_chat_window=False,
                post_joined_message=True,
            )
            invitation_url = f"{channel.get_base_url()}/chat/{channel.id}/{channel.uuid}" if channel.uuid else ''
            return {
                'success': True,
                'channel_id': channel.id,
                'is_new_channel': False,
                'member_count': len(channel.channel_member_ids),
                'invitation_url': invitation_url,
            }

    @http.route('/custom_discuss/upload_attachment', type='http', auth='user', methods=['POST'], csrf=False)
    def upload_attachment(self, **kwargs):
        file = request.httprequest.files.get('file')
        if not file:
            return request.make_response(json.dumps({'error': 'No file uploaded'}), headers=[('Content-Type', 'application/json')])

        file_content = file.read()
        attachment = request.env['ir.attachment'].create({
            'name': file.filename,
            'datas': base64.b64encode(file_content),
            'mimetype': file.content_type or 'application/octet-stream',
            'res_model': 'discuss.channel',
            'res_id': int(kwargs.get('channel_id', 0)),
        })

        res_data = {
            'id': attachment.id,
            'name': attachment.name,
            'mimetype': attachment.mimetype or 'application/octet-stream',
            'is_image': bool(attachment.mimetype and attachment.mimetype.startswith('image/')),
            'url': f"/web/content/{attachment.id}?download=true",
            'view_url': f"/web/image/{attachment.id}",
            'size': format_file_size(len(file_content)),
        }
        return request.make_response(json.dumps(res_data), headers=[('Content-Type', 'application/json')])

    @http.route('/custom_discuss/delete_channel', type='json', auth='user')
    def delete_channel(self, channel_id):
        env = request.env
        user = env.user
        partner = user.partner_id
        channel = env['discuss.channel'].browse(int(channel_id)).exists()
        if not channel:
            return {'error': 'Channel not found'}

        try:
            is_creator = (channel.create_uid.id == user.id)
            is_admin = user.has_group('base.group_system')
            member_count = len(channel.channel_member_ids)

            # Unpin for current user
            try:
                channel.channel_pin(pinned=False)
            except Exception:
                pass

            # If admin or creator or small chat/meeting (<=2 members), try complete unlink
            if is_creator or is_admin or member_count <= 2:
                try:
                    channel.unlink()
                    return {'success': True, 'action': 'deleted'}
                except Exception:
                    pass

            # Otherwise remove membership so channel no longer appears in inbox
            member = env['discuss.channel.member'].search([
                ('channel_id', '=', channel.id),
                ('partner_id', '=', partner.id)
            ])
            if member:
                member.unlink()

            try:
                channel.action_unfollow()
            except Exception:
                pass

            return {'success': True, 'action': 'unfollowed'}
        except Exception as e:
            return {'error': str(e)}

    @http.route('/custom_discuss/rename_channel', type='json', auth='user')
    def rename_channel(self, channel_id, name):
        env = request.env
        channel = env['discuss.channel'].browse(int(channel_id)).exists()
        if not channel:
            return {'error': 'Channel not found'}

        new_name = (name or '').strip()
        if not new_name:
            return {'error': 'Channel name cannot be empty'}

        try:
            channel.write({'name': new_name})
            return {'success': True, 'name': new_name}
        except Exception as e:
            return {'error': str(e)}

    @http.route('/custom_discuss/remove_channel_member', type='json', auth='user')
    def remove_channel_member(self, channel_id, partner_id):
        env = request.env
        channel = env['discuss.channel'].browse(int(channel_id)).exists()
        if not channel:
            return {'error': 'Channel not found'}

        member = env['discuss.channel.member'].search([
            ('channel_id', '=', channel.id),
            ('partner_id', '=', int(partner_id))
        ], limit=1)

        if not member:
            return {'error': 'Member not found in channel'}

        try:
            member.unlink()
            return {
                'success': True,
                'member_count': len(channel.channel_member_ids),
                'partner_id': int(partner_id)
            }
        except Exception as e:
            return {'error': str(e)}

