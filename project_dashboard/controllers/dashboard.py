# -*- coding: utf-8 -*-
"""
Dashboard JSON controller for project_dashboard module.

Supports 3-level drill-down hierarchy:
  - Level 1: Tag Cards (Project List Main Dashboard) — only tags with active tasks
  - Level 2: Dynamic Department Cards for a selected Tag — only departments with active tasks (total_cnt > 0)
  - Level 3: Employee Cards for a selected Tag + Department — only employees with active tasks (total_cnt > 0)
             + Grouped Task List View by Assignee.
  - Includes My Task & My Due Task side-by-side tables matching user reference UI.
"""
import logging
from datetime import datetime, date, timedelta
import pytz
from dateutil.relativedelta import relativedelta

from odoo import http, fields
# pyrefly: ignore [missing-import]
from odoo.http import request

_logger = logging.getLogger(__name__)


class ProjectDashboardController(http.Controller):

    @http.route('/department_dashboard/task_details', type='json', auth='user')
    def get_task_details(self, task_id, **kw):
        env = request.env
        if not task_id:
            return {'status': 'error', 'message': 'Missing task_id'}

        try:
            task = env['project.task'].sudo().browse(int(task_id))
            if not task.exists():
                return {'status': 'error', 'message': 'Task not found'}

            today_date = date.today()
            user_tz_name = env.user.tz or 'Asia/Kolkata'
            try:
                user_tz = pytz.timezone(user_tz_name)
            except Exception:
                user_tz = pytz.timezone('UTC')

            # Assignees list with rich profile info
            assignees = []
            for u in task.user_ids:
                if u.id == 1:
                    continue
                emp = env['hr.employee'].sudo().search([('user_id', '=', u.id)], limit=1) if 'hr.employee' in env else False
                dept_name = ''
                if hasattr(u, 'department_id') and u.department_id:
                    dept_name = u.department_id.name
                elif emp and hasattr(emp, 'department_id') and emp.department_id:
                    dept_name = emp.department_id.name

                initials = "".join([part[0].upper() for part in (u.name or "").split()[:2]]) or "U"
                assignees.append({
                    'id': u.id,
                    'name': u.name,
                    'initials': initials,
                    'avatar': f'/web/image/res.users/{u.id}/avatar_128',
                    'job_title': emp.job_title if emp else (getattr(u, 'function', '') or ''),
                    'department': dept_name,
                    'email': u.login or u.email or '',
                    'phone': u.phone or u.mobile or '',
                })

            # Creator details
            creator_name = task.create_uid.name if task.create_uid else 'System'
            creator_initials = "".join([part[0].upper() for part in (creator_name or "").split()[:2]]) or "U"
            creator_avatar = f'/web/image/res.users/{task.create_uid.id}/avatar_128' if task.create_uid else ''

            created_on_str = ''
            if task.create_date:
                try:
                    loc_cdate = pytz.utc.localize(task.create_date).astimezone(user_tz)
                    created_on_str = loc_cdate.strftime('%d %b %Y, %I:%M %p')
                except Exception:
                    created_on_str = task.create_date.strftime('%d %b %Y')

            # Stage & Priority
            stage_name = task.stage_id.name if task.stage_id else 'New'
            priority_labels = {'0': 'Low', '1': 'Medium', '2': 'High', '3': 'Urgent'}
            priority_val = str(task.priority or '0')
            priority_label = priority_labels.get(priority_val, 'Low')

            # Status classification
            if hasattr(task, 'state') and task.state == '05_management_discussion':
                status_label = 'MGMT Discussion'
                status_code = 'mgmt'
            elif self._is_done(task):
                status_label = 'Done'
                status_code = 'done'
            elif self._is_overdue(task, today_date):
                status_label = 'Overdue'
                status_code = 'due'
            elif self._is_hold(task):
                status_label = 'On Hold'
                status_code = 'hold'
            else:
                status_label = 'In Progress'
                status_code = 'pending'

            # Progress & Hours
            prog_val = round(getattr(task, 'task_progress_rate', 0.0) or getattr(task, 'progress', 0.0) or 0.0)
            eff_hours = getattr(task, 'effective_hours', 0.0) or getattr(task, 'timesheet_total', 0.0) or 0.0
            alloc_hours = getattr(task, 'allocated_hours', 0.0) or 0.0

            # Department name
            dept_name = task.department_id.name if 'department_id' in task._fields and task.department_id else (
                task.project_id.department_id.name if task.project_id and 'department_id' in task.project_id._fields and task.project_id.department_id else "General"
            )

            # Project name
            proj_name = task.project_id.name if task.project_id else "No Project"
            tag_name = task.tag_ids[0].name if task.tag_ids else (
                task.project_id.tag_ids[0].name if task.project_id and task.project_id.tag_ids else ""
            )

            # Chatter / Messages / Activity Logs grouped by Date
            avatar_colors = ['#8e24aa', '#1e88e5', '#00897b', '#f4511e', '#3949ab', '#039be5', '#d81b60', '#43a047', '#7c3aed', '#059669']
            grouped_by_date = {}
            total_logs_count = 0

            if 'mail.message' in env:
                msgs = env['mail.message'].sudo().search([
                    ('model', '=', 'project.task'),
                    ('res_id', '=', task.id)
                ], order='date desc', limit=50)

                for m in msgs:
                    loc_mdate = None
                    if m.date:
                        try:
                            loc_mdate = pytz.utc.localize(m.date).astimezone(user_tz)
                        except Exception:
                            loc_mdate = m.date
                    
                    date_group_key = loc_mdate.strftime('%b %d, %Y') if loc_mdate else 'Earlier'
                    time_str = loc_mdate.strftime('%b %d, %I:%M %p') if loc_mdate else ''

                    author_name = m.author_id.name if m.author_id else (m.create_uid.name if m.create_uid else 'System')
                    author_initial = (author_name.strip()[0] if author_name.strip() else 'S').upper()
                    partner_id_val = m.author_id.id if m.author_id else (m.create_uid.id if m.create_uid else 0)
                    color_idx = (partner_id_val + ord(author_initial)) % len(avatar_colors)
                    avatar_bg_color = avatar_colors[color_idx]

                    # Parse tracking values
                    tracking_items = []
                    action_title = ""
                    if 'tracking_value_ids' in m._fields and m.tracking_value_ids:
                        for trk in m.tracking_value_ids:
                            f_desc_raw = trk.field_id.field_description if (hasattr(trk, 'field_id') and trk.field_id) else (getattr(trk, 'field_desc', '') or 'Field')
                            f_desc = f_desc_raw
                            if isinstance(f_desc_raw, dict):
                                f_desc = f_desc_raw.get('en_US') or list(f_desc_raw.values())[0]

                            old_v = trk.old_value_char or (str(trk.old_value_integer) if trk.old_value_integer is not None else '') or (str(trk.old_value_float) if trk.old_value_float is not None else '') or ''
                            new_v = trk.new_value_char or (str(trk.new_value_integer) if trk.new_value_integer is not None else '') or (str(trk.new_value_float) if trk.new_value_float is not None else '') or ''
                            if not old_v and not new_v and hasattr(trk, 'old_value_datetime') and trk.old_value_datetime:
                                old_v = str(trk.old_value_datetime)
                                new_v = str(trk.new_value_datetime)

                            tracking_items.append({
                                'field': f_desc or 'Field',
                                'old_value': old_v or 'None',
                                'new_value': new_v or 'None',
                            })

                            if not action_title:
                                if (f_desc or '').lower() in ['stage', 'stage_id']:
                                    action_title = "Stage changed"
                                elif (f_desc or '').lower() in ['progress', 'progress dropdown', 'task progress']:
                                    action_title = "Progress updated"
                                elif (f_desc or '').lower() in ['priority']:
                                    action_title = "Priority changed"
                                elif (f_desc or '').lower() in ['assignees', 'assigned to', 'user']:
                                    action_title = "Assignee changed"
                                elif (f_desc or '').lower() in ['deadline', 'date_deadline']:
                                    action_title = "Deadline changed"
                                else:
                                    action_title = f"{f_desc} updated"

                    body_html = (m.body or '').strip()
                    # Clean up empty tags
                    if body_html in ['<p></p>', '<p><br></p>', '<div></div>', '<p><br/></p>']:
                        body_html = ''

                    if body_html or tracking_items:
                        total_logs_count += 1
                        entry = {
                            'id': m.id,
                            'author': author_name,
                            'initial': author_initial,
                            'avatar_color': avatar_bg_color,
                            'time_str': time_str,
                            'action_title': action_title,
                            'body': body_html,
                            'tracking_values': tracking_items,
                        }
                        grouped_by_date.setdefault(date_group_key, []).append(entry)

            date_groups_list = []
            for date_key, entries in grouped_by_date.items():
                date_groups_list.append({
                    'date': date_key,
                    'entries': entries,
                })

            # Project Stage Progression Calculation (Current stage index / Total project stages)
            total_stages = 1
            current_stage_idx = 1
            current_stage_name = task.stage_id.name if task.stage_id else 'New'

            ordered_stages = env['project.task.type'].browse()
            if task.project_id:
                if hasattr(task.project_id, 'type_ids') and task.project_id.type_ids:
                    ordered_stages = task.project_id.type_ids.sorted(key=lambda s: s.sequence)
                elif 'project_ids' in env['project.task.type']._fields:
                    ordered_stages = env['project.task.type'].search([('project_ids', 'in', task.project_id.id)], order='sequence asc')
            
            if not ordered_stages and task.stage_id:
                ordered_stages = env['project.task.type'].search([('id', '=', task.stage_id.id)])

            if ordered_stages:
                stage_ids_list = ordered_stages.ids
                total_stages = len(stage_ids_list) or 1
                if task.stage_id and task.stage_id.id in stage_ids_list:
                    current_stage_idx = stage_ids_list.index(task.stage_id.id) + 1
                elif self._is_done(task):
                    current_stage_idx = total_stages
                else:
                    current_stage_idx = 1
            elif self._is_done(task):
                total_stages = 1
                current_stage_idx = 1

            if self._is_done(task) and current_stage_idx < total_stages:
                current_stage_idx = total_stages

            stage_progress_pct = min(100.0, max(0.0, round((current_stage_idx / max(1, total_stages)) * 100.0, 2)))
            remaining_stage_pct = round(100.0 - stage_progress_pct, 2)
            remaining_stages_count = max(0, total_stages - current_stage_idx)

            # Schedule On-time metrics
            if self._is_done(task):
                on_time_pct = 100.0
                delayed_pct = 0.0
            elif task.date_deadline and task.date_deadline < today_date:
                days_late = (today_date - task.date_deadline).days
                total_open = max(1, (today_date - task.create_date.date()).days) if task.create_date else max(1, days_late)
                delayed_pct = min(100.0, max(15.0, round((days_late / max(total_open, days_late + 1)) * 100.0, 2)))
                on_time_pct = round(100.0 - delayed_pct, 2)
            else:
                on_time_pct = 100.0
                delayed_pct = 0.0

            due_date_dmy = task.date_deadline.strftime('%d-%m-%Y') if task.date_deadline else ''
            
            # Clean plain text for textarea
            clean_disc_notes = self._clean_html_text(getattr(task, 'mgmt_discussion', '') or '')
            clean_desc_text = self._clean_html_text(task.description or '')

            return {
                'status': 'success',
                'task': {
                    'id': task.id,
                    'name': task.name or 'Untitled Task',
                    'project': proj_name,
                    'tag_name': tag_name,
                    'department': dept_name,
                    'due_date': self._format_date(task.date_deadline) if task.date_deadline else 'No Deadline',
                    'due_date_dmy': due_date_dmy,
                    'raw_deadline': task.date_deadline.strftime('%Y-%m-%d') if task.date_deadline else '',
                    'priority': priority_val,
                    'priority_label': priority_label,
                    'stage': stage_name,
                    'state': task.state if hasattr(task, 'state') else '01_in_progress',
                    'status_label': status_label,
                    'status_code': status_code,
                    'progress': prog_val,
                    'time_spent': f"{eff_hours:.2f}h",
                    'allocated_hours': f"{alloc_hours:.2f}h" if alloc_hours > 0 else "0h",
                    'days_open': task.days_open if hasattr(task, 'days_open') else 0,
                    'created_by': creator_name,
                    'created_by_avatar': creator_avatar,
                    'created_by_initials': creator_initials,
                    'created_on': created_on_str,
                    'assignees': assignees,
                    'description': task.description or '',
                    'discussion_notes_text': clean_disc_notes or clean_desc_text or '',
                    'mgmt_discussion': clean_disc_notes or '',
                    'total_logs_count': total_logs_count,
                    'date_groups': date_groups_list,
                    'analytics': {
                        'stage_progress_pct': stage_progress_pct,
                        'remaining_stage_pct': remaining_stage_pct,
                        'current_stage_idx': current_stage_idx,
                        'total_stages': total_stages,
                        'remaining_stages_count': remaining_stages_count,
                        'current_stage_name': stage_name,
                        'completed_pct': stage_progress_pct,
                        'pending_pct': remaining_stage_pct,
                        'on_time_pct': on_time_pct,
                        'delayed_pct': delayed_pct,
                    }
                }
            }
        except Exception as e:
            _logger.error("Error fetching task details for ID %s: %s", task_id, e)
            return {'status': 'error', 'message': str(e)}

    @http.route('/department_dashboard/save_task_discussion', type='json', auth='user')
    def save_task_discussion(self, task_id, notes='', **kw):
        env = request.env
        if not task_id:
            return {'status': 'error', 'message': 'Missing task_id'}
        try:
            task = env['project.task'].sudo().browse(int(task_id))
            if not task.exists():
                return {'status': 'error', 'message': 'Task not found'}

            if notes and notes.strip():
                # Post note in chatter
                task.message_post(body=notes.strip(), subtype_xmlid='mail.mt_note')
                if 'mgmt_discussion' in task._fields:
                    task.sudo().write({'mgmt_discussion': notes.strip()})

            return {'status': 'success'}
        except Exception as e:
            _logger.error("Error saving discussion for task %s: %s", task_id, e)
            return {'status': 'error', 'message': str(e)}

    @http.route('/department_dashboard/schedule_activity', type='json', auth='user')
    def schedule_activity(self, activity_type='todo', date=None, summary='', user_ids=None, mark_done=False, **kw):
        return self.save_event(
            event_id=None,
            source='calendar' if activity_type == 'meeting' else 'activity',
            title=summary,
            date=date,
            activity_type=activity_type,
            user_ids=user_ids,
            mark_done=mark_done,
            **kw
        )

    @http.route('/department_dashboard/save_event', type='json', auth='user')
    def save_event(self, event_id=None, source='calendar', title='', date=None, time_start='09:00', time_stop='10:00', activity_type='meeting', user_ids=None, description='', mark_done=False, **kw):
        env = request.env
        if not user_ids:
            user_ids = [env.uid]
        elif isinstance(user_ids, (int, str)):
            user_ids = [int(user_ids)]
        else:
            user_ids = [int(u) for u in user_ids if u]

        date_str = str(date).strip() if date else fields.Date.today().strftime('%Y-%m-%d')
        parsed_date = None
        for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%Y/%m/%d', '%d/%m/%Y'):
            try:
                parsed_date = datetime.strptime(date_str, fmt).date()
                break
            except ValueError:
                continue

        if not parsed_date:
            parsed_date = fields.Date.today()

        formatted_date = parsed_date.strftime('%Y-%m-%d')

        time_start_str = str(time_start).strip() if time_start else '09:00'
        time_stop_str = str(time_stop).strip() if time_stop else '10:00'

        user_tz_name = env.user.tz or 'Asia/Kolkata'
        try:
            user_tz = pytz.timezone(user_tz_name)
        except Exception:
            user_tz = pytz.timezone('UTC')

        try:
            local_dt_start = user_tz.localize(datetime.strptime(f"{formatted_date} {time_start_str}:00", "%Y-%m-%d %H:%M:%S"))
            dt_start = local_dt_start.astimezone(pytz.utc).replace(tzinfo=None)
        except Exception:
            dt_start = datetime.strptime(f"{formatted_date} 09:00:00", "%Y-%m-%d %H:%M:%S")

        try:
            local_dt_stop = user_tz.localize(datetime.strptime(f"{formatted_date} {time_stop_str}:00", "%Y-%m-%d %H:%M:%S"))
            dt_stop = local_dt_stop.astimezone(pytz.utc).replace(tzinfo=None)
        except Exception:
            dt_stop = dt_start + timedelta(hours=1)

        users = env['res.users'].sudo().browse(user_ids)
        partner_ids = [u.partner_id.id for u in users if u.partner_id]
        if env.user.partner_id and env.user.partner_id.id not in partner_ids:
            partner_ids.append(env.user.partner_id.id)

        if event_id:
            event_id_str = str(event_id)
            if event_id_str.startswith('cal_') or source == 'calendar':
                cal_id = int(event_id_str.replace('cal_', ''))
                if 'calendar.event' in env:
                    cal_model = env['calendar.event'].sudo()
                    cal_ev = cal_model.browse(cal_id)
                    if cal_ev.exists():
                        vals = {
                            'name': title or 'Meeting',
                            'start': dt_start,
                            'stop': dt_stop,
                        }
                        if 'description' in cal_model._fields:
                            desc = description or ''
                            if mark_done:
                                if '[DONE]' not in desc:
                                    desc += '\n[DONE]'
                            vals['description'] = desc
                        if 'user_id' in cal_model._fields:
                            vals['user_id'] = user_ids[0] if user_ids else env.uid
                        if 'partner_ids' in cal_model._fields and partner_ids:
                            vals['partner_ids'] = [(6, 0, partner_ids)]
                        
                        try:
                            with env.cr.savepoint():
                                cal_ev.write(vals)
                            return {'status': 'success', 'event_id': f"cal_{cal_ev.id}"}
                        except Exception as ex:
                            _logger.error("Error updating calendar event: %s", ex)
            elif event_id_str.startswith('act_') or source == 'activity':
                act_id = int(event_id_str.replace('act_', ''))
                act = env['mail.activity'].sudo().browse(act_id)
                if act.exists():
                    try:
                        with env.cr.savepoint():
                            act.write({
                                'summary': title or 'Activity',
                                'date_deadline': formatted_date,
                                'note': description or '',
                                'user_id': user_ids[0] if user_ids else env.uid,
                            })
                            if mark_done:
                                act.action_done()
                        return {'status': 'success', 'event_id': f"act_{act.id}"}
                    except Exception as ex:
                        _logger.error("Error updating activity: %s", ex)

        if activity_type == 'meeting' or source == 'calendar':
            if 'calendar.event' in env:
                cal_model = env['calendar.event'].sudo()
                vals = {
                    'name': title or 'Scheduled Meeting',
                    'start': dt_start,
                    'stop': dt_stop,
                    'allday': False,
                }
                if 'description' in cal_model._fields:
                    desc = description or ''
                    if mark_done:
                        if '[DONE]' not in desc:
                            desc += '\n[DONE]'
                    vals['description'] = desc
                if 'user_id' in cal_model._fields:
                    vals['user_id'] = user_ids[0] if user_ids else env.uid
                if 'partner_ids' in cal_model._fields and partner_ids:
                    vals['partner_ids'] = [(6, 0, partner_ids)]

                try:
                    with env.cr.savepoint():
                        cal_ev = cal_model.create(vals)
                    return {'status': 'success', 'event_id': f"cal_{cal_ev.id}"}
                except Exception as ex:
                    _logger.error("Error creating calendar event: %s", ex)

        # Fallback to mail.activity creation
        created_activity_ids = []
        try:
            act_type_rec = env['mail.activity.type'].sudo().search([
                '|', ('name', '=ilike', activity_type), ('category', '=', activity_type)
            ], limit=1)
            if not act_type_rec:
                act_type_rec = env['mail.activity.type'].sudo().search([], limit=1)

            res_model_id = env['ir.model'].sudo()._get_id('res.users')
            for uid in user_ids:
                with env.cr.savepoint():
                    act = env['mail.activity'].sudo().create({
                        'activity_type_id': act_type_rec.id if act_type_rec else False,
                        'summary': title or (act_type_rec.name if act_type_rec else 'Scheduled Activity'),
                        'date_deadline': formatted_date,
                        'note': description or '',
                        'user_id': uid,
                        'res_model_id': res_model_id,
                        'res_id': uid,
                    })
                    created_activity_ids.append(act.id)
                    if mark_done:
                        act.action_done()

            return {'status': 'success', 'activity_ids': created_activity_ids}
        except Exception as ex:
            _logger.error("Error creating activity fallback: %s", ex)
            return {'status': 'error', 'message': str(ex)}

    @http.route('/department_dashboard/delete_event', type='json', auth='user')
    def delete_event(self, event_id, source='calendar', **kw):
        env = request.env
        if not event_id:
            return {'status': 'error', 'message': 'Missing event ID'}

        event_id_str = str(event_id)
        try:
            if event_id_str.startswith('cal_') or source == 'calendar':
                cal_id = int(event_id_str.replace('cal_', ''))
                if 'calendar.event' in env:
                    cal_ev = env['calendar.event'].sudo().browse(cal_id)
                    if cal_ev.exists():
                        cal_ev.unlink()
                        return {'status': 'success'}
            elif event_id_str.startswith('act_') or source == 'activity':
                act_id = int(event_id_str.replace('act_', ''))
                act = env['mail.activity'].sudo().browse(act_id)
                if act.exists():
                    act.unlink()
                    return {'status': 'success'}
        except Exception as e:
            _logger.error("Error deleting event %s: %s", event_id, e)
            return {'status': 'error', 'message': str(e)}

        return {'status': 'error', 'message': 'Event not found'}



    def _clean_html_text(self, html_str):
        if not html_str:
            return ''
        import re, html
        # Replace <br> and paragraph endings with newlines
        text = re.sub(r'<br\s*/?>', '\n', str(html_str), flags=re.IGNORECASE)
        text = re.sub(r'</(p|div|li|tr|h[1-6])>', '\n', text, flags=re.IGNORECASE)
        # Strip all HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        # Unescape HTML entities
        text = html.unescape(text)
        # Clean consecutive blank lines
        text = re.sub(r'\n\s*\n+', '\n\n', text)
        return text.strip()

    def _get_user_tz(self, env):
        return pytz.timezone(env.user.tz or 'UTC')

    def _is_done(self, task):
        if not task:
            return False
        if getattr(task, 'state', '') == '1_done':
            return True
        st_name = (task.stage_id.name or '').strip().lower() if task.stage_id else ''
        if st_name in ['done', 'completed', 'task completed', 'task complete', 'work done', 'pass', 'md\'s approval done']:
            return True
        if any(w in st_name for w in ['complete', 'done', 'closed', 'finished']) and not any(w in st_name for w in ['pending', 'cancel', 'fail', 'hold']):
            return True
        if task.stage_id and task.stage_id.fold and not any(w in st_name for w in ['cancel', 'fail', 'hold', 'pending']):
            return True
        return False

    def _is_hold(self, task):
        if task.state == '04_waiting_normal':
            return True
        if task.stage_id and task.stage_id.name and task.stage_id.name.lower() in ['hold', 'on hold', 'on_hold', 'blocked']:
            return True
        return False

    def _is_overdue(self, task, today_date):
        if self._is_done(task) or task.state == '1_canceled':
            return False
        if task.date_deadline:
            dd = task.date_deadline.date() if isinstance(task.date_deadline, datetime) else task.date_deadline
            return dd < today_date
        return False

    def _get_team_avatars(self, user_rec_set, max_count=5):
        res = []
        for u in user_rec_set:
            if u.id == 1:
                continue  # Skip OdooBot
            initials = "".join([part[0].upper() for part in (u.name or "").split()[:2]]) or "U"
            res.append({
                'id': u.id,
                'name': u.name,
                'initials': initials,
                'avatar': f'/web/image?model=res.users&field=avatar_128&id={u.id}'
            })
            if len(res) >= max_count:
                break
        return res
    def _get_last_update_str(self, tasks, today_date):
        if not tasks:
            return "Last Update Today"
        dates = []
        # Exclude system/OdooBot batch updates if human user updates exist
        human_tasks = tasks.filtered(lambda tk: tk.write_uid and tk.write_uid.id != 1)
        target_tasks = human_tasks if human_tasks else tasks

        for tk in target_tasks:
            if hasattr(tk, 'date_last_stage_update') and tk.date_last_stage_update:
                dt = tk.date_last_stage_update.date() if hasattr(tk.date_last_stage_update, 'date') else tk.date_last_stage_update
                dates.append(dt)
            elif tk.write_date:
                dt = tk.write_date.date() if hasattr(tk.write_date, 'date') else tk.write_date
                dates.append(dt)
            elif tk.create_date:
                dt = tk.create_date.date() if hasattr(tk.create_date, 'date') else tk.create_date
                dates.append(dt)

        if not dates:
            return "Last Update Today"

        max_date = max(dates)
        if max_date == today_date:
            return "Last Update Today"
        elif max_date > today_date:
            return f"Last Update {self._format_date(today_date)}"
        else:
            return f"Last Update {self._format_date(max_date)}"

    def _format_date(self, dt_val, fmt='%d %b %Y'):
        if not dt_val:
            return ''
        if isinstance(dt_val, str):
            try:
                dt_val = datetime.strptime(dt_val[:10], '%Y-%m-%d').date()
            except Exception:
                return dt_val
        elif isinstance(dt_val, datetime):
            dt_val = dt_val.date()
        return dt_val.strftime(fmt)

    def _build_task_row(self, task, today_date):
        is_done_flag = self._is_done(task)
        is_due_flag = self._is_overdue(task, today_date)

        if hasattr(task, 'state') and task.state == '05_management_discussion':
            status_code = 'MGMT Discussion'
        elif is_done_flag:
            status_code = 'Done'
        elif is_due_flag:
            status_code = 'Due'
        else:
            status_code = 'Pending'

        emp_names = ", ".join([u.name for u in task.user_ids if u.id != 1]) or "Unassigned"
        dept_name = task.department_id.name if 'department_id' in task._fields and task.department_id else (
            task.project_id.department_id.name if task.project_id and 'department_id' in task.project_id._fields and task.project_id.department_id else "General"
        )

        # Prefer tag name / short name for Project column matching reference UI (e.g. GTM, Estella, Industrial, Signature, HO)
        proj_display_name = ""
        if task.tag_ids:
            proj_display_name = task.tag_ids[0].name
        elif task.project_id and task.project_id.tag_ids:
            proj_display_name = task.project_id.tag_ids[0].name
        elif task.project_id:
            proj_display_name = task.project_id.name
        else:
            proj_display_name = 'No Project'

        return {
            'id': task.id,
            'project': proj_display_name,
            'department': dept_name,
            'task': task.name,
            'employee': emp_names,
            'status': status_code,
            'priority': getattr(task, 'priority', '0'),
            'due_date': self._format_date(task.date_deadline) if task.date_deadline else 'No Due Date',
            'raw_deadline': task.date_deadline.strftime('%Y-%m-%d') if task.date_deadline else '9999-12-31',
        }

    @http.route('/department_dashboard/data', type='json', auth='user')
    def department_dashboard_data(self, **kwargs):
        return self.get_dashboard_data(**kwargs)

    @http.route('/project_dashboard/data', type='json', auth='user')
    def project_dashboard_data(self, **kwargs):
        return self.get_dashboard_data(**kwargs)

    def get_dashboard_data(self, **kwargs):
        env = request.env
        today_date = date.today()

        level = int(kwargs.get('level', 1))
        tag_id = kwargs.get('tag_id')
        department_id = kwargs.get('department_id')

        # Clean string inputs
        if tag_id == '' or tag_id == 'null' or tag_id == 'undefined':
            tag_id = None
        if department_id == '' or department_id == 'null' or department_id == 'undefined':
            department_id = None

        firm_id = kwargs.get('firm_id')
        if firm_id in ['', 'null', 'undefined', 'all']:
            firm_id = None

        firms_list = []
        allowed_tag_ids = None
        if 'project.firm' in env:
            all_firms = env['project.firm'].sudo().search([])
            firms_list = [{'id': f.id, 'name': f.name, 'tag_ids': f.tag_ids.ids} for f in all_firms]
            if firm_id:
                try:
                    sel_firm = env['project.firm'].sudo().browse(int(firm_id))
                    if sel_firm.exists():
                        allowed_tag_ids = set(sel_firm.tag_ids.ids)
                except Exception as e:
                    _logger.error("Error reading firm %s: %s", firm_id, e)

        start_date = kwargs.get('start_date')
        end_date = kwargs.get('end_date')

        # Base tasks query - fetch tasks respecting the current user's access rules
        base_domain = []
        if start_date:
            base_domain.append(('create_date', '>=', start_date + ' 00:00:00'))
        if end_date:
            base_domain.append(('create_date', '<=', end_date + ' 23:59:59'))
            
        if not env.user.has_group('project.group_project_manager') and env.uid != 1:
            base_domain.append(('user_ids', 'in', env.uid))

        all_visible_tasks = env['project.task'].search(base_domain, order='date_deadline asc, create_date desc')

        if allowed_tag_ids is not None:
            all_visible_tasks = all_visible_tasks.filtered(
                lambda t: bool(set(t.tag_ids.ids) & allowed_tag_ids) if t.tag_ids else bool(t.project_id and 'tag_ids' in t.project_id._fields and set(t.project_id.tag_ids.ids) & allowed_tag_ids)
            )

        # Level 1 — Tag Cards
        tag_cards = []
        all_tags = env['project.tags'].sudo().search([])
        
        # Group tasks by tag (prioritizing task tag_ids over project tag_ids)
        tag_to_tasks = {}
        for t in all_visible_tasks:
            proj_tags = t.project_id.tag_ids if (t.project_id and 'tag_ids' in t.project_id._fields) else env['project.tags']
            t_tags = t.tag_ids if t.tag_ids else proj_tags
            if t_tags:
                for tg in t_tags:
                    tag_to_tasks.setdefault(tg, env['project.task'])
                    tag_to_tasks[tg] |= t
            else:
                tag_to_tasks.setdefault('untagged', env['project.task'])
                tag_to_tasks['untagged'] |= t

        tags_to_process = list(all_tags)
        if 'untagged' in tag_to_tasks:
            tags_to_process.append('untagged')

        for tg in tags_to_process:
            if isinstance(tg, str) and tg == 'untagged':
                if allowed_tag_ids is not None:
                    continue
                t_id = 'untagged'
                t_name = 'Untagged'
                tg_tasks = tag_to_tasks.get('untagged', env['project.task'])
            else:
                if allowed_tag_ids is not None and tg.id not in allowed_tag_ids:
                    continue
                t_id = tg.id
                t_name = tg.name
                tg_tasks = tag_to_tasks.get(tg, env['project.task'])

            total_cnt = len(tg_tasks)
            # Only include tag card if it has tasks
            if total_cnt == 0:
                continue

            done_cnt = len(tg_tasks.filtered(self._is_done))
            hold_cnt = len(tg_tasks.filtered(self._is_hold))
            due_cnt = len(tg_tasks.filtered(lambda tk: self._is_overdue(tk, today_date)))
            pending_cnt = max(0, total_cnt - done_cnt - hold_cnt - due_cnt)

            team_users = tg_tasks.mapped('user_ids')
            team_avatars = self._get_team_avatars(team_users)
            extra_team_cnt = max(0, len(team_users) - 5)

            deadlines = [tk.date_deadline for tk in tg_tasks if tk.date_deadline]
            due_date_str = f"Due on {self._format_date(max(deadlines))}" if deadlines else "Due on Jul 28, 2026"

            tag_cards.append({
                'id': t_id,
                'name': t_name,
                'total': total_cnt,
                'done': done_cnt,
                'pending': pending_cnt,
                'due': due_cnt,
                'hold': hold_cnt,
                'due_date_str': due_date_str,
                'last_update': self._get_last_update_str(tg_tasks, today_date),
                'team': team_avatars,
                'extra_team_count': extra_team_cnt,
            })

        # Level 2 — Dynamic Department Cards (ONLY departments with tasks under this Tag)
        dept_cards = []
        selected_tag_name = ""
        if tag_id or level >= 2:
            if tag_id:
                if str(tag_id) == 'untagged':
                    selected_tag_name = "Untagged"
                    l2_tasks = all_visible_tasks.filtered(lambda tk: not tk.tag_ids and not (tk.project_id and tk.project_id.tag_ids))
                else:
                    tag_rec = env['project.tags'].sudo().browse(int(tag_id))
                    selected_tag_name = tag_rec.name if tag_rec.exists() else f"Tag #{tag_id}"
                    l2_tasks = all_visible_tasks.filtered(lambda tk: (int(tag_id) in tk.tag_ids.ids) if tk.tag_ids else (tk.project_id and int(tag_id) in tk.project_id.tag_ids.ids))
            else:
                l2_tasks = all_visible_tasks

            # Group tasks by department dynamically
            dept_to_tasks = {}
            if 'hr.department' in env:
                for d in env['hr.department'].sudo().search([]):
                    dept_to_tasks.setdefault(d, env['project.task'])
                    
            for t in l2_tasks:
                dept_obj = t.department_id if 'department_id' in t._fields and t.department_id else (
                    t.project_id.department_id if t.project_id and 'department_id' in t.project_id._fields and t.project_id.department_id else None
                )
                if dept_obj:
                    dept_to_tasks.setdefault(dept_obj, env['project.task'])
                    dept_to_tasks[dept_obj] |= t
                else:
                    dept_to_tasks.setdefault('no_dept', env['project.task'])
                    dept_to_tasks['no_dept'] |= t

            # Sort departments alphabetically by name
            sorted_active_depts = sorted(list(dept_to_tasks.keys()), key=lambda d: d.name if hasattr(d, 'name') else '')

            is_admin = env.user.has_group('project.group_project_manager')
            for d_obj in sorted_active_depts:
                if isinstance(d_obj, str) and d_obj == 'no_dept':
                    d_id = 'no_dept'
                    d_name = 'No Department'
                else:
                    d_id = d_obj.id
                    d_name = d_obj.name

                d_tasks = dept_to_tasks.get(d_obj, env['project.task'])
                total_cnt = len(d_tasks)

                # Hide empty departments for regular users and managers (and always hide empty 'no_dept')
                if total_cnt == 0:
                    if d_id == 'no_dept':
                        continue
                    if not is_admin:
                        continue

                done_cnt = len(d_tasks.filtered(self._is_done))
                hold_cnt = len(d_tasks.filtered(self._is_hold))
                due_cnt = len(d_tasks.filtered(lambda tk: self._is_overdue(tk, today_date)))
                pending_cnt = max(0, total_cnt - done_cnt - hold_cnt - due_cnt)

                team_users = d_tasks.mapped('user_ids')
                team_avatars = self._get_team_avatars(team_users)
                extra_team_cnt = max(0, len(team_users) - 5)

                deadlines = [tk.date_deadline for tk in d_tasks if tk.date_deadline]
                due_date_str = f"Due on {self._format_date(max(deadlines))}" if deadlines else "Due on Jul 28, 2026"

                dept_cards.append({
                    'id': d_id,
                    'name': d_name,
                    'total': total_cnt,
                    'done': done_cnt,
                    'pending': pending_cnt,
                    'due': due_cnt,
                    'hold': hold_cnt,
                    'due_date_str': due_date_str,
                    'last_update': self._get_last_update_str(d_tasks, today_date),
                    'team': team_avatars,
                    'extra_team_count': extra_team_cnt,
                })

        # Level 3 — Employee Cards & Grouped Task List View (ONLY employees with tasks in this Tag & Dept)
        emp_cards = []
        grouped_tasks_view = []
        selected_dept_name = ""
        summary_totals = {'time_spent': 0.0, 'overall_progress': 0}

        if (tag_id or level >= 3) and department_id:
            if str(department_id) != 'no_dept':
                dept_rec = env['hr.department'].sudo().browse(int(department_id))
                selected_dept_name = dept_rec.name if dept_rec.exists() else f"Department #{department_id}"

            if tag_id:
                if str(tag_id) == 'untagged':
                    l3_tasks = all_visible_tasks.filtered(lambda tk: not tk.tag_ids and not (tk.project_id and tk.project_id.tag_ids))
                else:
                    l3_tasks = all_visible_tasks.filtered(lambda tk: (int(tag_id) in tk.tag_ids.ids) if tk.tag_ids else (tk.project_id and int(tag_id) in tk.project_id.tag_ids.ids))
            else:
                l3_tasks = all_visible_tasks

            if str(department_id) != 'no_dept':
                l3_tasks = l3_tasks.filtered(lambda tk: (
                    (tk.department_id and tk.department_id.id == int(department_id)) or
                    (tk.project_id and 'department_id' in tk.project_id._fields and tk.project_id.department_id and tk.project_id.department_id.id == int(department_id))
                ))
            else:
                l3_tasks = l3_tasks.filtered(lambda tk: not (
                    tk.department_id or
                    (tk.project_id and 'department_id' in tk.project_id._fields and tk.project_id.department_id)
                ))

            # Group tasks by assigned employee
            emp_to_tasks = {}
            for t in l3_tasks:
                if t.user_ids:
                    for u in t.user_ids:
                        if u.id == 1: continue
                        emp_to_tasks.setdefault(u, env['project.task'])
                        emp_to_tasks[u] |= t
                else:
                    emp_to_tasks.setdefault('unassigned', env['project.task'])
                    emp_to_tasks['unassigned'] |= t

            # Build Employee Cards dynamically (only employees with total_cnt > 0)
            for u_obj, u_tasks in emp_to_tasks.items():
                if isinstance(u_obj, str) and u_obj == 'unassigned':
                    u_id = 'unassigned'
                    u_name = 'Unassigned'
                else:
                    u_id = u_obj.id
                    u_name = u_obj.name

                total_cnt = len(u_tasks)
                if total_cnt == 0:
                    continue  # Skip employee if no tasks

                done_cnt = len(u_tasks.filtered(self._is_done))
                hold_cnt = len(u_tasks.filtered(self._is_hold))
                due_cnt = len(u_tasks.filtered(lambda tk: self._is_overdue(tk, today_date)))
                pending_cnt = max(0, total_cnt - done_cnt - hold_cnt - due_cnt)

                deadlines = [tk.date_deadline for tk in u_tasks if tk.date_deadline]
                due_date_str = f"Due on {self._format_date(max(deadlines))}" if deadlines else "Due on Jul 28, 2026"

                team_avatars = self._get_team_avatars([u_obj]) if not isinstance(u_obj, str) else []

                emp_cards.append({
                    'id': u_id,
                    'name': u_name,
                    'total': total_cnt,
                    'done': done_cnt,
                    'pending': pending_cnt,
                    'due': due_cnt,
                    'hold': hold_cnt,
                    'due_date_str': due_date_str,
                    'last_update': self._get_last_update_str(u_tasks, today_date),
                    'team': team_avatars,
                    'extra_team_count': 0,
                })

            # Build Grouped Task List View by Assignee
            total_time_all = 0.0
            total_progress_sum = 0
            tasks_count_for_prog = 0

            for u_obj, u_tasks in emp_to_tasks.items():
                if len(u_tasks) == 0:
                    continue
                u_name = "Unassigned" if isinstance(u_obj, str) else u_obj.name
                u_id = "unassigned" if isinstance(u_obj, str) else u_obj.id

                task_list_items = []
                emp_time_spent = 0.0

                for tk in u_tasks:
                    subtask_count = len(tk.child_ids)
                    closed_subtasks = len(tk.child_ids.filtered(self._is_done))
                    subtask_str = f"({closed_subtasks}/{subtask_count} sub-tasks)" if subtask_count > 0 else ""

                    eff_hours = getattr(tk, 'effective_hours', 0.0) or 0.0
                    emp_time_spent += eff_hours

                    prog_pct = round(getattr(tk, 'task_progress_rate', 0.0) or 0.0)

                    total_progress_sum += prog_pct
                    tasks_count_for_prog += 1

                    c_date = tk.create_date.date() if tk.create_date else today_date
                    days_open = (today_date - c_date).days
                    ts_str = f"{int(eff_hours)}h" if eff_hours > 0 else "0h"
                    tg_str = tk.tag_ids[0].name if tk.tag_ids else ""
                    stg_name = tk.stage_id.name if tk.stage_id else (
                        "Done" if self._is_done(tk) else "NEW"
                    )

                    creator_info = self._get_team_avatars([tk.create_uid]) if tk.create_uid else []
                    create_uid_name = creator_info[0]['name'] if creator_info else ''
                    create_uid_avatar = creator_info[0]['avatar'] if creator_info else ''
                    create_uid_initials = creator_info[0]['initials'] if creator_info else ''

                    date_deadline_str = ''
                    if tk.date_deadline:
                        date_deadline_str = tk.date_deadline.strftime('%d/%m/%Y') if hasattr(tk.date_deadline, 'strftime') else str(tk.date_deadline)

                    task_list_items.append({
                        'id': tk.id,
                        'title': tk.name,
                        'subtask_str': subtask_str,
                        'project_name': tk.project_id.name if tk.project_id else 'Dashboard Design',
                        'create_uid_name': create_uid_name,
                        'create_uid_avatar': create_uid_avatar,
                        'create_uid_initials': create_uid_initials,
                        'assignees': self._get_team_avatars(tk.user_ids),
                        'time_spent': f"{eff_hours:.2f}",
                        'progress': prog_pct,
                        'days_open': days_open,
                        'date_deadline': date_deadline_str,
                        'next_activity': 'icon',
                        'timesheets': ts_str,
                        'tag_name': tg_str,
                        'stage': stg_name,
                        'is_done': self._is_done(tk),
                    })

                total_time_all += emp_time_spent

                grouped_tasks_view.append({
                    'employee_id': u_id,
                    'employee_name': u_name,
                    'count': len(u_tasks),
                    'tasks': task_list_items,
                })

            summary_totals['time_spent'] = f"{total_time_all:.2f}"
            summary_totals['overall_progress'] = (
                round(total_progress_sum / tasks_count_for_prog) if tasks_count_for_prog > 0 else 10
            )

        # Build Side-by-side Tables: My Task & My Due Task
        base_dashboard_tasks = all_visible_tasks

        if tag_id:
            if str(tag_id) == 'untagged':
                base_dashboard_tasks = base_dashboard_tasks.filtered(lambda tk: not tk.tag_ids and not (tk.project_id and tk.project_id.tag_ids))
            else:
                base_dashboard_tasks = base_dashboard_tasks.filtered(lambda tk: (int(tag_id) in tk.tag_ids.ids) or (tk.project_id and int(tag_id) in tk.project_id.tag_ids.ids))

        if department_id:
            if str(department_id) != 'no_dept':
                base_dashboard_tasks = base_dashboard_tasks.filtered(lambda tk: (
                    (tk.department_id and tk.department_id.id == int(department_id)) or
                    (tk.project_id and 'department_id' in tk.project_id._fields and tk.project_id.department_id and tk.project_id.department_id.id == int(department_id))
                ))
            else:
                base_dashboard_tasks = base_dashboard_tasks.filtered(lambda tk: not (
                    tk.department_id or
                    (tk.project_id and 'department_id' in tk.project_id._fields and tk.project_id.department_id)
                ))

        # My Task Section: List ONLY tasks in 'Discussion' state (05_management_discussion)
        my_tasks_raw = base_dashboard_tasks.filtered(lambda tk: hasattr(tk, 'state') and tk.state == '05_management_discussion')

        # Sort My Task by recently updated
        recent_tasks = my_tasks_raw.sorted(key=lambda tk: tk.write_date if tk.write_date else tk.create_date, reverse=True)
        my_task_list = [self._build_task_row(t, today_date) for t in recent_tasks[:20]]

        # My Due Task Section — Tasks that are overdue or active pending (Top 20 max)
        my_due_tasks_raw = base_dashboard_tasks.filtered(lambda tk: self._is_overdue(tk, today_date) or not self._is_done(tk))
        my_due_task_list = [self._build_task_row(t, today_date) for t in my_due_tasks_raw[:20]]

        # Meeting Calendar Activities/Events
        calendar_events = []
        is_admin = False
        try:
            # Check if user is System Administrator, superuser, or root admin
            is_admin = (
                env.user.has_group('base.group_system') or
                env.is_superuser() or
                env.uid in (1, 2)
            )
            # MD / System Admin UIDs for filtering MD Meetings
            admin_uids = set()
            for grp_xmlid in ['base.group_system']:
                try:
                    admin_group = env.ref(grp_xmlid, raise_if_not_found=False)
                    if admin_group:
                        admin_uids.update(env['res.users'].sudo().search([('groups_id', 'in', [admin_group.id])]).ids)
                except Exception:
                    pass
            admin_uids.add(1)
            admin_uids.add(2)
            if env.is_superuser():
                admin_uids.add(env.uid)

            # Build mapping of User ID -> set of project.firm IDs & department IDs
            user_firm_map = {}
            user_dept_map = {}
            all_firms_objs = env['project.firm'].sudo().search([]) if 'project.firm' in env else []

            # 1. Map users from project.firm associated tags (firm.tag_ids) & team_user_ids
            for f in all_firms_objs:
                f_tags = set(f.tag_ids.ids)
                if hasattr(f, 'team_user_ids') and f.team_user_ids:
                    for u in f.team_user_ids:
                        user_firm_map.setdefault(u.id, set()).add(f.id)
                if f_tags:
                    tasks_for_firm = env['project.task'].sudo().search([
                        '|', ('tag_ids', 'in', list(f_tags)), ('project_id.tag_ids', 'in', list(f_tags))
                    ])
                    for tk in tasks_for_firm:
                        for u in tk.user_ids:
                            user_firm_map.setdefault(u.id, set()).add(f.id)

            # 2. Map users from res.users / hr.employee department, and fallback company matching for unmapped users
            all_users_objs = env['res.users'].sudo().search([('active', '=', True)])
            for u in all_users_objs:
                emp = env['hr.employee'].sudo().search([('user_id', '=', u.id)], limit=1) if 'hr.employee' in env else False
                d_id = None
                if hasattr(u, 'department_id') and u.department_id:
                    d_id = u.department_id.id
                elif emp and hasattr(emp, 'department_id') and emp.department_id:
                    d_id = emp.department_id.id
                if d_id:
                    user_dept_map[u.id] = d_id

                # Only fallback to res.company name matching if user has no firm mapped from tags/tasks
                if u.id not in user_firm_map or not user_firm_map[u.id]:
                    u_comp_name = (u.company_id.name or '').strip().lower() if (hasattr(u, 'company_id') and u.company_id) else ''
                    for f in all_firms_objs:
                        f_name_lower = (f.name or '').strip().lower()
                        if f_name_lower and u_comp_name and (f_name_lower in u_comp_name or u_comp_name in f_name_lower):
                            user_firm_map.setdefault(u.id, set()).add(f.id)

            # 1. Mail Activities
            domain_act = [] if is_admin else ['|', ('user_id', '=', env.uid), ('create_uid', '=', env.uid)]
            user_activities = env['mail.activity'].sudo().search(domain_act, limit=100)
            for act in user_activities:
                act_date = act.date_deadline.strftime('%Y-%m-%d') if act.date_deadline else today_date.strftime('%Y-%m-%d')
                is_meeting = act.activity_type_id and 'meeting' in (act.activity_type_id.name or '').lower()
                user_uids = [act.user_id.id] if act.user_id else ([act.create_uid.id] if act.create_uid else [])
                user_unames = [act.user_id.name] if act.user_id else []

                act_user = act.user_id or act.create_uid
                
                # Determine firm_ids and department_ids for all users in activity
                act_firm_ids = set()
                act_dept_ids = set()
                for uid in user_uids:
                    if uid in user_firm_map:
                        act_firm_ids.update(user_firm_map[uid])
                    if uid in user_dept_map:
                        act_dept_ids.add(user_dept_map[uid])

                if not act_firm_ids and act_user and hasattr(act_user, 'company_id') and act_user.company_id:
                    c_id = act_user.company_id.id
                    c_name = (act_user.company_id.name or '').strip().lower()
                    for f in all_firms_objs:
                        if f.id == c_id or (f.name and (f.name.strip().lower() in c_name or c_name in f.name.strip().lower())):
                            act_firm_ids.add(f.id)

                act_dept_id = list(act_dept_ids)[0] if act_dept_ids else None
                act_dept_name = env['hr.department'].sudo().browse(act_dept_id).name if act_dept_id else ''

                act_company_id = list(act_firm_ids)[0] if act_firm_ids else None
                act_company_name = env['project.firm'].sudo().browse(act_company_id).name if act_company_id else ''

                is_admin_ev = (act.create_uid and act.create_uid.id in admin_uids) or (act.user_id and act.user_id.id in admin_uids)

                calendar_events.append({
                    'id': f"act_{act.id}",
                    'raw_id': act.id,
                    'source': 'activity',
                    'title': act.summary or (act.activity_type_id.name if act.activity_type_id else 'Activity'),
                    'date': act_date,
                    'time': 'All Day',
                    'time_start': '09:00',
                    'time_stop': '10:00',
                    'type': 'meeting' if is_meeting else 'todo',
                    'user_ids': user_uids,
                    'user_names': user_unames,
                    'user_name': act.user_id.name if act.user_id else '',
                    'description': act.note or '',
                    'project_dept': act.res_name or 'Dashboard',
                    'state': act.state or 'planned',
                    'color': '#ec4899' if is_meeting else '#3b82f6',
                    'is_editable': act.create_uid.id == env.uid or is_admin,
                    'is_admin_event': is_admin_ev,
                    'department_id': act_dept_id,
                    'department_name': act_dept_name,
                    'department_ids': list(act_dept_ids),
                    'company_id': act_company_id,
                    'company_name': act_company_name,
                    'firm_id': act_company_id,
                    'firm_name': act_company_name,
                    'firm_ids': list(act_firm_ids),
                    'company_ids': list(act_firm_ids),
                })

            # 2. Calendar Meetings
            if 'calendar.event' in env:
                user_tz_name = env.user.tz or 'Asia/Kolkata'
                try:
                    user_tz = pytz.timezone(user_tz_name)
                except Exception:
                    user_tz = pytz.timezone('UTC')

                cal_domain = [] if is_admin else [('partner_ids', 'in', [env.user.partner_id.id])]
                cal_events = env['calendar.event'].sudo().search(cal_domain, order="start desc", limit=200)
                for ev in cal_events:
                    ev_date = ''
                    time_str = 'All Day'
                    time_start_str = '09:00'
                    time_stop_str = '10:00'

                    if ev.start:
                        try:
                            loc_start = pytz.utc.localize(ev.start).astimezone(user_tz)
                            ev_date = loc_start.strftime('%Y-%m-%d')
                            time_str = loc_start.strftime('%I:%M %p')
                            time_start_str = loc_start.strftime('%H:%M')
                        except Exception:
                            ev_date = ev.start.strftime('%Y-%m-%d')
                    elif ev.start_date:
                        ev_date = ev.start_date.strftime('%Y-%m-%d')
                    else:
                        ev_date = today_date.strftime('%Y-%m-%d')

                    if ev.stop:
                        try:
                            loc_stop = pytz.utc.localize(ev.stop).astimezone(user_tz)
                            time_stop_str = loc_stop.strftime('%H:%M')
                        except Exception:
                            pass

                    partner_ids_list = ev.partner_ids.ids if ev.partner_ids else []
                    attendee_users = env['res.users'].sudo().search([('partner_id', 'in', partner_ids_list)]) if partner_ids_list else env['res.users']
                    u_ids = attendee_users.ids if attendee_users else ([ev.user_id.id] if ev.user_id else [])
                    if ev.create_uid and ev.create_uid.id not in u_ids:
                        u_ids.append(ev.create_uid.id)
                    u_names = [p.name for p in ev.partner_ids if p.name] or ([ev.user_id.name] if ev.user_id else [])

                    attendees = ", ".join(u_names)

                    ev_organizer = ev.user_id or ev.create_uid

                    # Determine firm_ids and department_ids for all users in meeting
                    ev_firm_ids = set()
                    ev_dept_ids = set()
                    for uid in u_ids:
                        if uid in user_firm_map:
                            ev_firm_ids.update(user_firm_map[uid])
                        if uid in user_dept_map:
                            ev_dept_ids.add(user_dept_map[uid])

                    if not ev_firm_ids and ev_organizer and hasattr(ev_organizer, 'company_id') and ev_organizer.company_id:
                        c_id = ev_organizer.company_id.id
                        c_name = (ev_organizer.company_id.name or '').strip().lower()
                        for f in all_firms_objs:
                            if f.id == c_id or (f.name and (f.name.strip().lower() in c_name or c_name in f.name.strip().lower())):
                                ev_firm_ids.add(f.id)

                    ev_dept_id = list(ev_dept_ids)[0] if ev_dept_ids else None
                    ev_dept_name = env['hr.department'].sudo().browse(ev_dept_id).name if ev_dept_id else ''

                    ev_company_id = list(ev_firm_ids)[0] if ev_firm_ids else None
                    ev_company_name = env['project.firm'].sudo().browse(ev_company_id).name if ev_company_id else ''

                    is_admin_ev = (ev.create_uid and ev.create_uid.id in admin_uids) or (ev.user_id and ev.user_id.id in admin_uids) or any(uid in admin_uids for uid in u_ids)

                    calendar_events.append({
                        'id': f"cal_{ev.id}",
                        'raw_id': ev.id,
                        'source': 'calendar',
                        'title': ev.name or 'Meeting',
                        'date': ev_date,
                        'time': time_str,
                        'time_start': time_start_str,
                        'time_stop': time_stop_str,
                        'type': 'meeting',
                        'user_ids': u_ids,
                        'user_names': u_names,
                        'user_name': attendees,
                        'description': ev.description or '',
                        'project_dept': 'Meeting',
                        'state': 'done' if '[DONE]' in (ev.description or '') else 'planned',
                        'color': '#22c55e' if '[DONE]' in (ev.description or '') else '#ec4899',
                        'is_editable': (ev.user_id.id == env.uid or is_admin) and '[DONE]' not in (ev.description or ''),
                        'is_admin_event': is_admin_ev,
                        'department_id': ev_dept_id,
                        'department_name': ev_dept_name,
                        'department_ids': list(ev_dept_ids),
                        'company_id': ev_company_id,
                        'company_name': ev_company_name,
                        'firm_id': ev_company_id,
                        'firm_name': ev_company_name,
                        'firm_ids': list(ev_firm_ids),
                        'company_ids': list(ev_firm_ids),
                    })
                    
                    if '[DONE]' in calendar_events[-1]['description']:
                        calendar_events[-1]['description'] = calendar_events[-1]['description'].replace('\n[DONE]', '').replace('[DONE]', '')
        except Exception as e:
            _logger.error("Error fetching calendar events: %s", e)


        all_tags_list = [{'id': tg.id, 'name': tg.name} for tg in all_tags]
        all_depts_list = [{'id': d.id, 'name': d.name} for d in env['hr.department'].sudo().search([])]
        all_emps_list = []
        for u in env['res.users'].sudo().search([('active', '=', True), ('id', '!=', 1)]):
            emp = env['hr.employee'].sudo().search([('user_id', '=', u.id)], limit=1) if 'hr.employee' in env else False
            
            dept_name = ''
            if hasattr(u, 'department_id') and u.department_id:
                dept_name = u.department_id.name
            elif emp and hasattr(emp, 'department_id') and emp.department_id:
                dept_name = emp.department_id.name
                
            all_emps_list.append({
                'id': u.id,
                'name': u.name,
                'email': u.login or u.email or '',
                'phone': u.phone or u.mobile or '',
                'job_title': emp.job_title if emp else (getattr(u, 'function', '')),
                'department': dept_name,
                'avatar': f'/web/image/res.users/{u.id}/avatar_128'
            })

        return {
            'is_admin': is_admin,
            'level': level,
            'tag_id': tag_id,
            'department_id': department_id,
            'firm_id': firm_id,
            'firms': firms_list,
            'selected_tag_name': selected_tag_name,
            'selected_dept_name': selected_dept_name,
            'tag_cards': tag_cards,
            'dept_cards': dept_cards,
            'emp_cards': emp_cards,
            'firm_tags': list(allowed_tag_ids) if allowed_tag_ids is not None else [],
            'my_tasks': my_task_list,
            'my_due_tasks': my_due_task_list,
            'calendar_events': calendar_events,
            'grouped_tasks_view': grouped_tasks_view,
            'summary_totals': summary_totals,
            'filter_data': {
                'tags': all_tags_list,
                'departments': all_depts_list,
                'employees': all_emps_list,
            }
        }