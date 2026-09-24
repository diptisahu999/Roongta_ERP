# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, date, timedelta
from markupsafe import Markup
import pytz
import html
import logging

_logger = logging.getLogger(__name__)


class ProjectTask(models.Model):
    _inherit = 'project.task'

    @api.model
    def get_custom_task_detail(self, task_id=None):
        """Fetch complete comprehensive task detail dataset for the modern Task Detail view."""
        task = None
        if task_id:
            try:
                task = self.sudo().browse(int(task_id))
            except Exception:
                task = None

        if not task or not task.exists():
            task = self.sudo().search([('active', '=', True)], order='id desc', limit=1)

        if not task or not task.exists():
            return {'error': 'No tasks found.'}

        today = fields.Date.context_today(self)
        user_tz_name = self.env.user.tz or 'Asia/Kolkata'
        try:
            user_tz = pytz.timezone(user_tz_name)
        except Exception:
            user_tz = pytz.timezone('UTC')

        def format_dt(dt_val):
            if not dt_val:
                return ''
            try:
                utc_dt = pytz.utc.localize(dt_val) if dt_val.tzinfo is None else dt_val
                return utc_dt.astimezone(user_tz).strftime('%d %b %Y, %I:%M %p')
            except Exception:
                return dt_val.strftime('%d/%m/%Y %H:%M')

        # Overdue Calculation
        is_done = task.is_closed or task.state in ['1_done', '1_canceled'] or getattr(task, 'task_progress', '') == '100' or getattr(task, 'task_progress_rate', 0) >= 100
        is_overdue = False
        overdue_days = 0
        formatted_deadline = ''
        formatted_deadline_iso = ''
        if task.date_deadline:
            formatted_deadline = task.date_deadline.strftime('%d %b %Y')
            formatted_deadline_iso = str(task.date_deadline)
            if not is_done and task.date_deadline < today:
                is_overdue = True
                overdue_days = (today - task.date_deadline).days

        # Assignees
        assignees = []
        avatar_palette = ["#f59e0b", "#8b5cf6", "#3b82f6", "#10b981", "#ec4899", "#06b6d4", "#f97316"]
        for u in task.user_ids:
            parts = (u.name or '').split()
            initials = "".join([p[0].upper() for p in parts[:2]]) if parts else "U"
            hash_idx = sum(ord(c) for c in (u.name or '')) % len(avatar_palette)
            assignees.append({
                'id': u.id,
                'name': u.name,
                'initials': initials,
                'color': avatar_palette[hash_idx],
                'avatar': f'/web/image/res.users/{u.id}/avatar_128',
            })

        # Created By & Dates
        create_user_name = task.create_uid.name if task.create_uid else 'System'
        c_parts = (create_user_name or '').split()
        create_user_initials = "".join([p[0].upper() for p in c_parts[:2]]) if c_parts else "U"
        formatted_create_date = format_dt(task.create_date)
        formatted_last_update = format_dt(getattr(task, 'last_user_update_date', task.write_date))

        # Milestone
        milestone_name = ''
        milestone_id = False
        if hasattr(task, 'milestone_id') and task.milestone_id:
            milestone_id = task.milestone_id.id
            milestone_name = task.milestone_id.name

        # Tag
        tag_id = False
        tag_name = ''
        if getattr(task, 'single_tag_id', False):
            tag_id = task.single_tag_id.id
            tag_name = task.single_tag_id.name
        elif task.tag_ids:
            tag_id = task.tag_ids[0].id
            tag_name = task.tag_ids[0].name

        # Label
        label_id = False
        label_name = ''
        if hasattr(task, 'label_id') and task.label_id:
            label_id = task.label_id.id
            label_name = task.label_id.name

        # Department
        department_id = task.department_id.id if task.department_id else False
        department_name = task.department_id.name if task.department_id else ''

        # Project
        project_id = task.project_id.id if task.project_id else False
        project_name = task.project_id.name if task.project_id else ''

        # State & Stage
        state_code = task.state or '01_in_progress'
        state_labels_dict = dict(task._fields['state']._description_selection(self.env)) if 'state' in task._fields else {
            '01_in_progress': 'In Progress',
            '02_changes_requested': 'Changes Requested',
            '03_approved': 'Approved',
            '04_waiting_normal': 'Waiting / Blocked',
            '05_management_discussion': 'MGMT Discussion',
            '1_done': 'Done',
            '1_canceled': 'Cancelled',
        }
        state_label = state_labels_dict.get(state_code, state_code.replace('_', ' ').title())
        stage_name = task.stage_id.name if task.stage_id else state_label
        stage_id = task.stage_id.id if task.stage_id else False

        # Priority
        try:
            priority_int = int(task.priority or '0')
        except (ValueError, TypeError):
            priority_int = 0

        # Progress
        progress_val = getattr(task, 'task_progress_rate', 0.0) or 0.0
        if not progress_val and hasattr(task, 'task_progress') and task.task_progress:
            try:
                progress_val = float(task.task_progress)
            except Exception:
                progress_val = 0.0

        # Allocated Hours & Time string
        allocated_hours = getattr(task, 'allocated_hours', 0.0) or 0.0
        hrs = int(allocated_hours)
        mins = int((allocated_hours - hrs) * 60)
        allocated_time_formatted = f"{hrs}h {mins:02d}m ({int(round(progress_val))}%)"

        # Days open
        days_open = getattr(task, 'days_open', 0)
        if not days_open and task.create_date:
            days_open = (today - task.create_date.date()).days

        # Subtasks / Checklist
        checklist = []
        subtasks_data = []
        subtasks = self.search([('parent_id', '=', task.id)], order='id asc')
        for sub in subtasks:
            sub_done = sub.is_closed or sub.state in ['1_done', '1_canceled'] or getattr(sub, 'task_progress', '') == '100' or getattr(sub, 'task_progress_rate', 0) >= 100
            sub_assignees = []
            for u in sub.user_ids:
                u_parts = (u.name or '').split()
                u_initials = "".join([p[0].upper() for p in u_parts[:2]]) if u_parts else "U"
                u_hash = sum(ord(c) for c in (u.name or '')) % len(avatar_palette)
                sub_assignees.append({
                    'id': u.id,
                    'name': u.name,
                    'initials': u_initials,
                    'color': avatar_palette[u_hash],
                    'avatar': f'/web/image/res.users/{u.id}/avatar_128',
                })

            sub_state_label = state_labels_dict.get(sub.state, 'In Progress')
            sub_item = {
                'id': sub.id,
                'name': sub.name,
                'is_done': sub_done,
                'state': sub.state or '01_in_progress',
                'state_label': sub_state_label,
                'stage_id': sub.stage_id.id if sub.stage_id else False,
                'stage_name': sub.stage_id.name if sub.stage_id else sub_state_label,
                'date_deadline': sub.date_deadline.strftime('%d %b %Y') if sub.date_deadline else '',
                'user_ids': sub.user_ids.ids,
                'user_names': ", ".join(sub.user_ids.mapped('name')),
                'assignees': sub_assignees,
            }
            checklist.append(sub_item)
            subtasks_data.append(sub_item)

        # Activities
        activities = []
        if hasattr(task, 'activity_ids'):
            for act in task.activity_ids.sorted(key=lambda a: a.date_deadline or date.max):
                act_user_name = act.user_id.name if act.user_id else 'Unassigned'
                act_type_name = act.activity_type_id.name if act.activity_type_id else 'Activity'
                act_state = 'today' if act.date_deadline == today else ('overdue' if act.date_deadline and act.date_deadline < today else 'planned')
                activities.append({
                    'id': act.id,
                    'summary': act.summary or act.note or act_type_name,
                    'activity_type': act_type_name,
                    'activity_icon': act.activity_type_id.icon or 'fa-tasks',
                    'date_deadline': act.date_deadline.strftime('%d %b %Y') if act.date_deadline else '',
                    'user_name': act_user_name,
                    'state': act_state,
                })

        # Comments & Chatter Messages with Tracking Values
        comments = []
        if hasattr(task, 'message_ids'):
            for msg in task.message_ids.sorted(key=lambda m: m.date or datetime.min, reverse=True)[:60]:
                author_name = msg.author_id.name if msg.author_id else (msg.create_uid.name if msg.create_uid else 'System')
                a_parts = (author_name or '').split()
                a_initials = "".join([p[0].upper() for p in a_parts[:2]]) if a_parts else "U"
                hash_idx = sum(ord(c) for c in (author_name or '')) % len(avatar_palette)

                # Date grouping and human readable timestamps
                date_group = 'Older'
                time_str = ''
                if msg.date:
                    try:
                        utc_dt = pytz.utc.localize(msg.date) if msg.date.tzinfo is None else msg.date
                        local_dt = utc_dt.astimezone(user_tz)
                        msg_date = local_dt.date()
                        if msg_date == today:
                            date_group = 'Today'
                            time_str = f"Today at {local_dt.strftime('%I:%M %p').lstrip('0')}"
                        elif msg_date == today - timedelta(days=1):
                            date_group = 'Yesterday'
                            time_str = f"Yesterday at {local_dt.strftime('%I:%M %p').lstrip('0')}"
                        else:
                            date_group = local_dt.strftime('%b %d, %Y')
                            time_str = local_dt.strftime('%b %d, %I:%M %p').lstrip('0')
                    except Exception:
                        date_group = 'Past'
                        time_str = format_dt(msg.date)

                # Tracking values from Odoo mail.tracking.value
                tracking_values = []
                if hasattr(msg, 'tracking_value_ids') and msg.tracking_value_ids:
                    for trk in msg.tracking_value_ids:
                        f_desc = getattr(trk, 'field_desc', '') or (trk.field_id.field_description if hasattr(trk, 'field_id') and trk.field_id else '')
                        old_val = trk.old_value_char or trk.old_value_text or (str(trk.old_value_integer) if trk.old_value_integer else '') or (str(trk.old_value_datetime) if trk.old_value_datetime else '')
                        new_val = trk.new_value_char or trk.new_value_text or (str(trk.new_value_integer) if trk.new_value_integer else '') or (str(trk.new_value_datetime) if trk.new_value_datetime else '')
                        tracking_values.append({
                            'field': f_desc or 'Field',
                            'old_value': old_val or 'None',
                            'new_value': new_val or 'None',
                        })

                raw_body = msg.body or ''
                clean_body = html.unescape(html.unescape(raw_body)) if raw_body else ''

                if not clean_body.strip() and not tracking_values:
                    continue

                comments.append({
                    'id': msg.id,
                    'author_name': author_name,
                    'author_initials': a_initials,
                    'avatar_color': avatar_palette[hash_idx],
                    'author_avatar': f'/web/image/res.partner/{msg.author_id.id}/avatar_128' if msg.author_id else '',
                    'date': format_dt(msg.date),
                    'date_group': date_group,
                    'time_formatted': time_str,
                    'body': clean_body,
                    'tracking_values': tracking_values,
                    'message_type': msg.message_type,
                    'subtype_name': msg.subtype_id.name if msg.subtype_id else '',
                    'is_internal': msg.is_internal if hasattr(msg, 'is_internal') else False,
                })

        # Attachments
        attachments = []
        att_records = self.env['ir.attachment'].sudo().search([
            ('res_model', '=', 'project.task'),
            ('res_id', '=', task.id)
        ], order='create_date desc')
        for att in att_records:
            size_kb = round(att.file_size / 1024, 1) if att.file_size else 0
            attachments.append({
                'id': att.id,
                'name': att.name,
                'mimetype': att.mimetype,
                'size_kb': f"{size_kb} KB",
                'url': f'/web/content/{att.id}?download=true',
                'create_date': format_dt(att.create_date),
            })

        # Reference selections for dropdowns (Filtered according to user access rights & active state)
        accessible_projects = self.env['project.project'].search([('active', '=', True)], order='name asc')
        if task.project_id and task.project_id not in accessible_projects:
            accessible_projects |= task.project_id
        all_projects = [{'id': p.id, 'name': p.name} for p in accessible_projects]

        all_departments = self.env['hr.department'].search_read([], ['id', 'name'], order='name asc')
        all_tags = self.env['project.tags'].search_read([], ['id', 'name'], order='name asc')
        all_labels = []
        if 'project.task.label' in self.env:
            all_labels = self.env['project.task.label'].search_read([], ['id', 'name'], order='name asc')
        all_users = self.env['res.users'].search_read([('share', '=', False), ('active', '=', True)], ['id', 'name'], order='name asc')

        all_states = [
            {'code': '01_in_progress', 'name': 'In Progress', 'color': '#2563eb'},
            {'code': '02_changes_requested', 'name': 'Changes Requested', 'color': '#d97706'},
            {'code': '03_approved', 'name': 'Approved', 'color': '#16a34a'},
            {'code': '04_waiting_normal', 'name': 'Waiting / Blocked', 'color': '#9333ea'},
            {'code': '05_management_discussion', 'name': 'MGMT Discussion', 'color': '#0891b2'},
            {'code': '1_done', 'name': 'Done', 'color': '#10b981'},
            {'code': '1_canceled', 'name': 'Cancelled', 'color': '#6b7280'},
        ]

        # Project-specific stages matching the task's project statusbar
        stage_records = self.env['project.task.type']
        if task.project_id:
            if hasattr(task.project_id, 'type_ids') and task.project_id.type_ids:
                stage_records = task.project_id.type_ids
            else:
                stage_records = self.env['project.task.type'].sudo().search([('project_ids', 'in', [task.project_id.id])])

        if not stage_records:
            if task.stage_id:
                stage_records = task.stage_id
            else:
                stage_records = self.env['project.task.type'].sudo().search([('project_ids', '=', False)], limit=6)

        if task.stage_id and task.stage_id not in stage_records:
            stage_records = stage_records | task.stage_id

        # Sort stages by sequence, placing 'Done' at the end
        done_stages = stage_records.filtered(lambda s: s.name and s.name.lower() == 'done')
        other_stages = (stage_records - done_stages).sorted(key=lambda s: (s.sequence, s.id))
        sorted_stage_records = other_stages + done_stages.sorted(key=lambda s: (s.sequence, s.id))

        all_stages = []
        stage_color_map = {}
        for stg in sorted_stage_records:
            stg_lower = (stg.name or '').lower()
            if 'done' in stg_lower or 'closed' in stg_lower or 'complete' in stg_lower:
                stg_color = '#10b981' # Green
            elif 'progress' in stg_lower or 'working' in stg_lower or 'doing' in stg_lower:
                stg_color = '#2563eb' # Blue
            elif 'hold' in stg_lower or 'block' in stg_lower or 'wait' in stg_lower or 'review' in stg_lower:
                stg_color = '#d97706' # Orange/Amber
            elif 'pending' in stg_lower or 'new' in stg_lower or 'todo' in stg_lower or 'to do' in stg_lower:
                stg_color = '#0284c7' # Sky Blue
            elif 'cancel' in stg_lower:
                stg_color = '#6b7280' # Gray
            else:
                stg_color = '#8b5cf6' # Purple

            stage_color_map[stg.id] = stg_color
            all_stages.append({
                'id': stg.id,
                'name': stg.name,
                'color': stg_color,
                'fold': stg.fold,
                'is_closed': getattr(stg, 'is_closed', False),
            })

        current_stage_color = stage_color_map.get(stage_id, '#2563eb')

        # Milestone options for project
        milestone_options = []
        if project_id and 'project.milestone' in self.env:
            milestones = self.env['project.milestone'].sudo().search_read([('project_id', '=', project_id)], ['id', 'name'])
            milestone_options = milestones

        # Pager info: find prev and next task IDs in current scope
        all_task_ids = self.search([('active', '=', True)], order='id desc').ids
        current_idx = all_task_ids.index(task.id) if task.id in all_task_ids else 0
        prev_task_id = all_task_ids[current_idx - 1] if current_idx > 0 else None
        next_task_id = all_task_ids[current_idx + 1] if current_idx < len(all_task_ids) - 1 else None
        pager_index = current_idx + 1
        pager_total = len(all_task_ids)

        # Check if there is an active reminder sent for this task
        has_active_reminder = False
        reminder_acts = self.env['mail.activity'].sudo().search([
            ('res_model', '=', 'project.task'),
            ('res_id', '=', task.id),
        ])
        for act in reminder_acts:
            summary_str = (act.summary or '').lower()
            note_str = (act.note or '').lower()
            act_type_name = (act.activity_type_id.name or '').lower() if act.activity_type_id else ''
            if 'reminder' in summary_str or 'reminder' in note_str or 'reminder' in act_type_name:
                has_active_reminder = True
                break

        if not has_active_reminder:
            # Check most recent reminder-related chatter message
            last_reminder_msg = self.env['mail.message'].sudo().search([
                ('model', '=', 'project.task'),
                ('res_id', '=', task.id),
                ('body', 'ilike', 'Reminder'),
            ], order='id desc', limit=1)
            if last_reminder_msg:
                body_lower = (last_reminder_msg.body or '').lower()
                if 'reminder' in body_lower and 'reminder done' not in body_lower:
                    has_active_reminder = True

        # Recurrence Details
        recurring_task = bool(getattr(task, 'recurring_task', False))
        repeat_interval = getattr(task, 'repeat_interval', 1) or 1
        repeat_unit = getattr(task, 'repeat_unit', 'week') or 'week'
        repeat_type = getattr(task, 'repeat_type', 'forever') or 'forever'
        repeat_until = str(task.repeat_until) if getattr(task, 'repeat_until', False) else ''
        repeat_number = getattr(task, 'repeat_number', 1) or 1
        recurrence_time = getattr(task, 'recurrence_time', 0.0) or 0.0
        recurrence_message = getattr(task, 'recurrence_message', '') or ''
        rec_hrs = int(recurrence_time)
        rec_mins = int(round((recurrence_time - rec_hrs) * 60))
        recurrence_time_str = f"{rec_hrs:02d}:{rec_mins:02d}"

        # Deadline edit access (Strictly controlled by Task Deadline Access group)
        can_edit_deadline = bool(
            self.env.user.has_group('custom_project.group_edit_task_deadline')
        )

        return {
            'id': task.id,
            'name': task.name or '',
            'is_subtask': bool(task.parent_id),
            'parent_id': task.parent_id.id if task.parent_id else False,
            'parent_name': task.parent_id.name if task.parent_id else '',
            'has_active_reminder': has_active_reminder,
            'can_edit_deadline': can_edit_deadline,
            'recurring_task': recurring_task,
            'repeat_interval': repeat_interval,
            'repeat_unit': repeat_unit,
            'repeat_type': repeat_type,
            'repeat_until': repeat_until,
            'repeat_number': repeat_number,
            'recurrence_time': recurrence_time,
            'recurrence_time_str': recurrence_time_str,
            'recurrence_message': recurrence_message,
            'priority': str(priority_int),
            'priority_int': priority_int,
            'state': state_code,
            'state_label': state_label,
            'stage_id': stage_id,
            'stage_name': stage_name,
            'stage_color': current_stage_color,
            'project_id': project_id,
            'project_name': project_name,
            'milestone_id': milestone_id,
            'milestone_name': milestone_name,
            'department_id': department_id,
            'department_name': department_name,
            'tag_id': tag_id,
            'tag_name': tag_name,
            'label_id': label_id,
            'label_name': label_name,
            'date_deadline': formatted_deadline,
            'date_deadline_iso': formatted_deadline_iso,
            'is_overdue': is_overdue,
            'overdue_days': overdue_days,
            'allocated_hours': allocated_hours,
            'allocated_time_formatted': allocated_time_formatted,
            'progress': int(round(progress_val)),
            'task_progress': str(task.task_progress or int(round(progress_val))),
            'description': task.description or '',
            'days_open': days_open,
            'create_user': {
                'id': task.create_uid.id if task.create_uid else False,
                'name': create_user_name,
                'initials': create_user_initials,
            },
            'create_date': formatted_create_date,
            'last_update_date': formatted_last_update,
            'assignees': assignees,
            'checklist': checklist,
            'checklist_count': len(checklist),
            'checklist_done_count': len([c for c in checklist if c['is_done']]),
            'subtasks': subtasks_data,
            'subtasks_count': len(subtasks_data),
            'activities': activities,
            'comments': comments,
            'attachments': attachments,
            'options': {
                'projects': all_projects,
                'departments': all_departments,
                'tags': all_tags,
                'labels': all_labels,
                'users': all_users,
                'stages': all_stages,
                'states': all_states,
                'milestones': milestone_options,
            },
            'pager': {
                'current': pager_index,
                'total': pager_total,
                'prev_id': prev_task_id,
                'next_id': next_task_id,
            },
        }

    @api.model
    def save_task_recurrence(self, task_id, vals):
        """Save recurrence settings for the task."""
        task = self.browse(int(task_id))
        if not task.exists():
            raise UserError(_("Task not found."))

        write_vals = {}
        if 'recurring_task' in vals:
            write_vals['recurring_task'] = bool(vals['recurring_task'])
        if 'repeat_interval' in vals and vals['repeat_interval']:
            try:
                write_vals['repeat_interval'] = int(vals['repeat_interval'])
            except Exception:
                pass
        if 'repeat_unit' in vals and vals['repeat_unit']:
            write_vals['repeat_unit'] = str(vals['repeat_unit'])
        if 'repeat_type' in vals and vals['repeat_type']:
            write_vals['repeat_type'] = str(vals['repeat_type'])
        if 'repeat_until' in vals:
            write_vals['repeat_until'] = vals['repeat_until'] if vals['repeat_until'] else False
        if 'repeat_number' in vals and vals['repeat_number']:
            try:
                write_vals['repeat_number'] = int(vals['repeat_number'])
            except Exception:
                pass
        if 'recurrence_time' in vals:
            try:
                write_vals['recurrence_time'] = float(vals['recurrence_time'])
            except Exception:
                pass

        valid_vals = {k: v for k, v in write_vals.items() if k in task._fields}
        if valid_vals:
            task.write(valid_vals)

        return self.get_custom_task_detail(task.id)

    @api.model
    def change_deadline_with_reason(self, task_id, new_date, reason):
        """Change task deadline with mandatory reason and post to chatter."""
        task = self.browse(int(task_id))
        if not task.exists():
            raise UserError(_("Task not found."))

        if not new_date:
            raise UserError(_("Please select a new deadline date."))

        reason_text = (reason or '').strip()
        if not reason_text:
            raise UserError(_("Please provide a reason for changing the deadline."))

        old_deadline_str = task.date_deadline.strftime('%d %b %Y') if task.date_deadline else 'None'
        try:
            new_dt_obj = datetime.strptime(str(new_date), '%Y-%m-%d').date()
            new_deadline_str = new_dt_obj.strftime('%d %b %Y')
        except Exception:
            new_deadline_str = str(new_date)

        # Update deadline bypassing field-level readonly restriction
        task.sudo().with_context(mail_notrack=True).write({
            'date_deadline': new_date,
        })

        # Post formatted tracking note to chatter
        user_name = self.env.user.name or 'User'
        note_html = Markup(f"""
            <div style="font-size: 13px;">
                <p class="mb-1">📅 <b>Deadline Changed by {html.escape(user_name)}</b></p>
                <p class="mb-1">• {html.escape(old_deadline_str)} ➔ <b style="color:#0284c7;">{html.escape(new_deadline_str)}</b></p>
                <p class="mb-0 text-muted"><b>Reason:</b> <i>{html.escape(reason_text)}</i></p>
            </div>
        """)
        task.message_post(
            body=note_html,
            message_type='comment',
            subtype_xmlid='mail.mt_comment',
        )

    @api.model
    def delete_task_attachment(self, task_id, attachment_id):
        """Delete an attachment associated with the task and post log to chatter."""
        task = self.browse(int(task_id))
        attachment = self.env['ir.attachment'].sudo().search([
            ('id', '=', int(attachment_id)),
            ('res_model', '=', 'project.task'),
            ('res_id', '=', int(task_id)),
        ])
        if attachment.exists():
            att_name = attachment.name or 'file'
            attachment.unlink()
            if task.exists():
                user_name = self.env.user.name or 'User'
                task.message_post(
                    body=f"🗑️ <b>Attachment Removed:</b> {html.escape(att_name)} by {html.escape(user_name)}",
                    message_type='comment',
                    subtype_xmlid='mail.mt_comment',
                )
        return self.get_custom_task_detail(int(task_id))

    @api.model
    def update_task_detail_field(self, task_id, field_name, value):
        """Update a specific field on the task and post tracking log in chatter."""
        task = self.browse(int(task_id))
        if not task.exists():
            raise UserError(_("Task not found."))

        vals = {}
        log_bullet = None
        prio_map = {'0': 'Low', '1': 'Medium', '2': 'High', '3': 'Urgent'}
        state_labels_dict = dict(task._fields['state']._description_selection(self.env)) if 'state' in task._fields else {
            '01_in_progress': 'In Progress',
            '02_changes_requested': 'Changes Requested',
            '03_approved': 'Approved',
            '04_waiting_normal': 'Waiting / Blocked',
            '05_management_discussion': 'MGMT Discussion',
            '1_done': 'Done',
            '1_canceled': 'Cancelled',
        }

        if field_name == 'name':
            old_val = task.name or 'Untitled'
            new_val = str(value).strip() or 'Untitled'
            if old_val != new_val:
                vals['name'] = new_val
                log_bullet = f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Task Title)</i>"

        elif field_name == 'state':
            old_val = state_labels_dict.get(task.state, task.state or 'In Progress')
            new_val = state_labels_dict.get(value, value)
            if task.state != value:
                vals['state'] = value
                if value == '1_done':
                    vals['task_progress'] = '100'
                log_bullet = f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(State)</i>"

        elif field_name == 'stage_id':
            old_val = task.stage_id.name if task.stage_id else 'None'
            stg_id = int(value) if value else False
            stage_obj = self.env['project.task.type'].browse(stg_id) if stg_id else None
            new_val = stage_obj.name if stage_obj and stage_obj.exists() else 'None'
            if (task.stage_id.id if task.stage_id else False) != stg_id:
                vals['stage_id'] = stg_id
                if stage_obj and stage_obj.exists() and (stage_obj.fold or getattr(stage_obj, 'is_closed', False) or (stage_obj.name and stage_obj.name.lower() == 'done')):
                    vals['task_progress'] = '100'
                    vals['state'] = '1_done'
                log_bullet = f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Stage)</i>"

        elif field_name == 'priority':
            old_val = prio_map.get(str(task.priority), 'Low')
            new_val = prio_map.get(str(value), 'Low')
            if str(task.priority) != str(value):
                vals['priority'] = str(value)
                log_bullet = f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Priority)</i>"

        elif field_name == 'project_id':
            old_val = task.project_id.name if task.project_id else 'None'
            proj_id = int(value) if value else False
            proj_obj = self.env['project.project'].browse(proj_id) if proj_id else None
            new_val = proj_obj.name if proj_obj and proj_obj.exists() else 'None'
            if (task.project_id.id if task.project_id else False) != proj_id:
                vals['project_id'] = proj_id
                log_bullet = f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Project)</i>"

        elif field_name == 'department_id':
            old_val = task.department_id.name if task.department_id else 'None'
            dept_id = int(value) if value else False
            dept_obj = self.env['hr.department'].browse(dept_id) if dept_id else None
            new_val = dept_obj.name if dept_obj and dept_obj.exists() else 'None'
            if (task.department_id.id if task.department_id else False) != dept_id:
                vals['department_id'] = dept_id
                log_bullet = f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Department)</i>"

        elif field_name == 'single_tag_id' or field_name == 'tag_id':
            old_val = task.single_tag_id.name if getattr(task, 'single_tag_id', False) else (task.tag_ids[0].name if task.tag_ids else 'None')
            tag_id_val = int(value) if value else False
            tag_obj = self.env['project.tags'].browse(tag_id_val) if tag_id_val else None
            new_val = tag_obj.name if tag_obj and tag_obj.exists() else 'None'
            if hasattr(task, 'single_tag_id'):
                vals['single_tag_id'] = tag_id_val
            if tag_id_val:
                vals['tag_ids'] = [(6, 0, [tag_id_val])]
            else:
                vals['tag_ids'] = [(5, 0, 0)]
            if old_val != new_val:
                log_bullet = f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Tag)</i>"

        elif field_name == 'label_id':
            old_val = task.label_id.name if hasattr(task, 'label_id') and task.label_id else 'None'
            lbl_id = int(value) if value else False
            lbl_obj = self.env['project.task.label'].browse(lbl_id) if lbl_id and 'project.task.label' in self.env else None
            new_val = lbl_obj.name if lbl_obj and lbl_obj.exists() else 'None'
            if hasattr(task, 'label_id'):
                vals['label_id'] = lbl_id
            if old_val != new_val:
                log_bullet = f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Label)</i>"

        elif field_name == 'date_deadline':
            old_val = task.date_deadline.strftime('%d-%m-%Y') if task.date_deadline else 'None'
            new_val = 'None'
            if value:
                try:
                    new_val = datetime.strptime(str(value), '%Y-%m-%d').strftime('%d-%m-%Y')
                except Exception:
                    new_val = str(value)
            if str(task.date_deadline or '') != str(value or ''):
                vals['date_deadline'] = value if value else False
                log_bullet = f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Date Deadline)</i>"

        elif field_name == 'milestone_id':
            old_val = task.milestone_id.name if hasattr(task, 'milestone_id') and task.milestone_id else 'None'
            ms_id = int(value) if value else False
            ms_obj = self.env['project.milestone'].browse(ms_id) if ms_id and 'project.milestone' in self.env else None
            new_val = ms_obj.name if ms_obj and ms_obj.exists() else (str(value) if value else 'None')
            if hasattr(task, 'milestone_id'):
                vals['milestone_id'] = ms_id
            if old_val != new_val:
                log_bullet = f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Milestone)</i>"

        elif field_name == 'allocated_hours':
            try:
                vals['allocated_hours'] = float(value)
            except Exception:
                pass

        elif field_name == 'description':
            vals['description'] = value or ''

        if vals:
            task.with_context(mail_notrack=True).write(vals)

        # Post tracking log note
        if log_bullet:
            task.message_post(
                body=Markup(f"<p class='mb-0'>{log_bullet}</p>"),
                message_type='notification',
                subtype_xmlid='mail.mt_note',
            )

        return self.get_custom_task_detail(task_id)

    @api.model
    def save_task_detail_batch(self, task_id, values):
        """Save batch of changes to task with consolidated chatter tracking."""
        task = self.browse(int(task_id))
        if not task.exists():
            raise UserError(_("Task not found."))

        vals = {}
        log_bullets = []
        prio_map = {'0': 'Low', '1': 'Medium', '2': 'High', '3': 'Urgent'}
        state_labels_dict = dict(task._fields['state']._description_selection(self.env)) if 'state' in task._fields else {
            '01_in_progress': 'In Progress',
            '02_changes_requested': 'Changes Requested',
            '03_approved': 'Approved',
            '04_waiting_normal': 'Waiting / Blocked',
            '05_management_discussion': 'MGMT Discussion',
            '1_done': 'Done',
            '1_canceled': 'Cancelled',
        }

        if 'name' in values:
            new_name = str(values['name']).strip()
            if new_name and task.name != new_name:
                vals['name'] = new_name
                log_bullets.append(f"• {task.name or 'Untitled'} ➔ <b style='color:#0284c7'>{new_name}</b> <i>(Task Title)</i>")

        if 'state' in values:
            new_state = values['state']
            if task.state != new_state:
                old_lbl = state_labels_dict.get(task.state, task.state or 'In Progress')
                new_lbl = state_labels_dict.get(new_state, new_state)
                vals['state'] = new_state
                if new_state == '1_done':
                    vals['task_progress'] = '100'
                log_bullets.append(f"• {old_lbl} ➔ <b style='color:#0284c7'>{new_lbl}</b> <i>(State)</i>")

        if 'stage_id' in values:
            stg_id = int(values['stage_id']) if values['stage_id'] else False
            if (task.stage_id.id if task.stage_id else False) != stg_id:
                old_val = task.stage_id.name if task.stage_id else 'None'
                stage_obj = self.env['project.task.type'].browse(stg_id) if stg_id else None
                new_val = stage_obj.name if stage_obj and stage_obj.exists() else 'None'
                vals['stage_id'] = stg_id
                if stage_obj and stage_obj.exists() and (stage_obj.fold or getattr(stage_obj, 'is_closed', False) or (stage_obj.name and stage_obj.name.lower() == 'done')):
                    vals['task_progress'] = '100'
                    vals['state'] = '1_done'
                log_bullets.append(f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Stage)</i>")

        if 'priority' in values:
            new_prio = str(values['priority'])
            if str(task.priority) != new_prio:
                old_val = prio_map.get(str(task.priority), 'Low')
                new_val = prio_map.get(new_prio, 'Low')
                vals['priority'] = new_prio
                log_bullets.append(f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Priority)</i>")

        if 'project_id' in values:
            proj_id = int(values['project_id']) if values['project_id'] else False
            if (task.project_id.id if task.project_id else False) != proj_id:
                old_val = task.project_id.name if task.project_id else 'None'
                proj_obj = self.env['project.project'].browse(proj_id) if proj_id else None
                new_val = proj_obj.name if proj_obj and proj_obj.exists() else 'None'
                vals['project_id'] = proj_id
                log_bullets.append(f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Project)</i>")

        if 'department_id' in values:
            dept_id = int(values['department_id']) if values['department_id'] else False
            if (task.department_id.id if task.department_id else False) != dept_id:
                old_val = task.department_id.name if task.department_id else 'None'
                dept_obj = self.env['hr.department'].browse(dept_id) if dept_id else None
                new_val = dept_obj.name if dept_obj and dept_obj.exists() else 'None'
                vals['department_id'] = dept_id
                log_bullets.append(f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Department)</i>")

        if 'single_tag_id' in values or 'tag_id' in values:
            tag_id_val = int(values.get('single_tag_id') or values.get('tag_id') or 0) or False
            old_val = task.single_tag_id.name if getattr(task, 'single_tag_id', False) else (task.tag_ids[0].name if task.tag_ids else 'None')
            tag_obj = self.env['project.tags'].browse(tag_id_val) if tag_id_val else None
            new_val = tag_obj.name if tag_obj and tag_obj.exists() else 'None'
            if old_val != new_val:
                if hasattr(task, 'single_tag_id'):
                    vals['single_tag_id'] = tag_id_val
                if tag_id_val:
                    vals['tag_ids'] = [(6, 0, [tag_id_val])]
                else:
                    vals['tag_ids'] = [(5, 0, 0)]
                log_bullets.append(f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Tag)</i>")

        if 'label_id' in values:
            lbl_id = int(values['label_id']) if values['label_id'] else False
            old_val = task.label_id.name if hasattr(task, 'label_id') and task.label_id else 'None'
            lbl_obj = self.env['project.task.label'].browse(lbl_id) if lbl_id and 'project.task.label' in self.env else None
            new_val = lbl_obj.name if lbl_obj and lbl_obj.exists() else 'None'
            if old_val != new_val:
                if hasattr(task, 'label_id'):
                    vals['label_id'] = lbl_id
                log_bullets.append(f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Label)</i>")

        if 'date_deadline' in values:
            deadline_val = values['date_deadline'] or False
            if str(task.date_deadline or '') != str(deadline_val or ''):
                old_val = task.date_deadline.strftime('%d-%m-%Y') if task.date_deadline else 'None'
                new_val = 'None'
                if deadline_val:
                    try:
                        new_val = datetime.strptime(str(deadline_val), '%Y-%m-%d').strftime('%d-%m-%Y')
                    except Exception:
                        new_val = str(deadline_val)
                vals['date_deadline'] = deadline_val
                log_bullets.append(f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Date Deadline)</i>")

        if 'milestone_id' in values or 'milestone_name' in values:
            ms_val = values.get('milestone_id') or values.get('milestone_name')
            old_val = task.milestone_id.name if hasattr(task, 'milestone_id') and task.milestone_id else 'None'
            try:
                ms_id = int(ms_val) if ms_val else False
            except (ValueError, TypeError):
                ms_id = False
            ms_obj = self.env['project.milestone'].browse(ms_id) if ms_id and 'project.milestone' in self.env else None
            new_val = ms_obj.name if ms_obj and ms_obj.exists() else (str(ms_val) if ms_val else 'None')
            if old_val != new_val:
                if hasattr(task, 'milestone_id') and ms_id:
                    vals['milestone_id'] = ms_id
                log_bullets.append(f"• {old_val} ➔ <b style='color:#0284c7'>{new_val}</b> <i>(Milestone)</i>")

        if 'description' in values:
            new_desc = values['description'] or ''
            if (task.description or '') != new_desc:
                vals['description'] = new_desc

        if 'user_ids' in values:
            new_user_ids = set([int(u) for u in (values['user_ids'] or [])])
            old_user_ids = set(task.user_ids.ids)
            if new_user_ids != old_user_ids:
                vals['user_ids'] = [(6, 0, list(new_user_ids))]
                added_users = self.env['res.users'].browse(list(new_user_ids - old_user_ids))
                removed_users = self.env['res.users'].browse(list(old_user_ids - new_user_ids))
                for u in added_users:
                    log_bullets.append(f"• Added <b style='color:#0284c7'>{u.name}</b> <i>(Assignee)</i>")
                for u in removed_users:
                    log_bullets.append(f"• Removed <b style='color:#0284c7'>{u.name}</b> <i>(Assignee)</i>")

        if vals:
            task.with_context(mail_notrack=True).write(vals)

        if log_bullets:
            combined_body = "<br/>".join(log_bullets)
            task.message_post(
                body=Markup(f"<p class='mb-0'>{combined_body}</p>"),
                message_type='notification',
                subtype_xmlid='mail.mt_note',
            )

        return self.get_custom_task_detail(task_id)

    @api.model
    def add_task_assignee_user(self, task_id, user_id):
        """Add a user as assignee to the task and log to chatter."""
        task = self.browse(int(task_id))
        if not task.exists():
            raise UserError(_("Task not found."))
        user = self.env['res.users'].browse(int(user_id))
        if not user.exists():
            raise UserError(_("User not found."))

        if user not in task.user_ids:
            task.sudo().with_context(mail_notrack=True).write({
                'user_ids': [(4, user.id)]
            })
            task.message_post(
                body=Markup(f"<p class='mb-0'>• Added <b style='color:#0284c7'>{user.name}</b> <i>(Assignee)</i></p>"),
                message_type='notification',
                subtype_xmlid='mail.mt_note',
            )
        return self.get_custom_task_detail(task_id)

    @api.model
    def remove_task_assignee_user(self, task_id, user_id):
        """Remove a user from task assignees and log to chatter."""
        task = self.browse(int(task_id))
        if not task.exists():
            raise UserError(_("Task not found."))
        user = self.env['res.users'].browse(int(user_id))
        user_name = user.name if user.exists() else 'User'
        task.sudo().with_context(mail_notrack=True).write({
            'user_ids': [(3, int(user_id))]
        })
        task.message_post(
            body=Markup(f"<p class='mb-0'>• Removed <b style='color:#0284c7'>{user_name}</b> <i>(Assignee)</i></p>"),
            message_type='notification',
            subtype_xmlid='mail.mt_note',
        )
        return self.get_custom_task_detail(task_id)

    @api.model
    def post_task_chatter_message(self, task_id, body, is_internal_note=False):
        """Post a chatter message or log note on the task."""
        task = self.browse(int(task_id))
        if not task.exists():
            raise UserError(_("Task not found."))
        if not body or not body.strip():
            raise UserError(_("Message body cannot be empty."))

        subtype = 'mail.mt_note' if is_internal_note else 'mail.mt_comment'
        task.message_post(
            body=body,
            message_type='comment',
            subtype_xmlid=subtype,
        )
        return self.get_custom_task_detail(task_id)

    @api.model
    def create_checklist_subtask(self, task_id, name):
        """Create a checklist / subtask item under the parent task."""
        task = self.browse(int(task_id))
        if not task.exists():
            raise UserError(_("Task not found."))
        if not name or not name.strip():
            raise UserError(_("Checklist item name cannot be empty."))

        subtask_vals = {
            'name': name.strip(),
            'parent_id': task.id,
            'project_id': task.project_id.id if task.project_id else False,
            'department_id': task.department_id.id if task.department_id else False,
            'date_deadline': task.date_deadline,
            'user_ids': [(6, 0, task.user_ids.ids)],
        }
        self.create(subtask_vals)
        return self.get_custom_task_detail(task_id)

    @api.model
    def toggle_checklist_subtask_status(self, subtask_id, is_done):
        """Toggle subtask done or in-progress state."""
        subtask = self.browse(int(subtask_id))
        if not subtask.exists():
            raise UserError(_("Subtask not found."))

        parent_id = subtask.parent_id.id if subtask.parent_id else False
        new_state = '1_done' if is_done else '01_in_progress'
        subtask.write({
            'state': new_state,
            'task_progress': '100' if is_done else '0',
        })
        return self.get_custom_task_detail(parent_id) if parent_id else {}

    @api.model
    def create_subtask_line(self, task_id, name, user_ids=None):
        """Create a new sub-task line under the parent task."""
        task = self.browse(int(task_id))
        if not task.exists():
            raise UserError(_("Task not found."))
        if not name or not name.strip():
            raise UserError(_("Sub-task title cannot be empty."))

        vals = {
            'name': name.strip(),
            'parent_id': task.id,
            'project_id': task.project_id.id if task.project_id else False,
            'department_id': task.department_id.id if task.department_id else False,
            'date_deadline': task.date_deadline,
        }
        if user_ids and isinstance(user_ids, list) and len(user_ids) > 0:
            vals['user_ids'] = [(6, 0, [int(u) for u in user_ids])]
        elif task.user_ids:
            vals['user_ids'] = [(6, 0, task.user_ids.ids)]

        new_sub = self.create(vals)
        task.message_post(
            body=Markup(f"<p class='mb-0'>• Created sub-task: <b style='color:#0284c7'>{new_sub.name}</b></p>"),
            message_type='notification',
            subtype_xmlid='mail.mt_note',
        )
        return self.get_custom_task_detail(task_id)

    @api.model
    def delete_subtask_line(self, task_id, subtask_id):
        """Delete a subtask."""
        task = self.browse(int(task_id))
        subtask = self.browse(int(subtask_id))
        if subtask.exists() and subtask.parent_id.id == task.id:
            sub_name = subtask.name
            subtask.unlink()
            task.message_post(
                body=Markup(f"<p class='mb-0'>• Removed sub-task: <b style='color:#ef4444'>{sub_name}</b></p>"),
                message_type='notification',
                subtype_xmlid='mail.mt_note',
            )
        return self.get_custom_task_detail(task_id)

