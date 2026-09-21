# -*- coding: utf-8 -*-
import logging
import pytz
from datetime import datetime, date, timedelta
# pyrefly: ignore [missing-import]
from odoo import http, fields
# pyrefly: ignore [missing-import]
from odoo.http import request
# pyrefly: ignore [missing-import]
from odoo.tools import html2plaintext

_logger = logging.getLogger(__name__)


class CustomCalendarController(http.Controller):

    # ── Role Identification Helpers ─────────────────────────────────────────
    def _get_admin_uids(self, env):
        """
        Identify user IDs of Admins (MD / Administrator / System Admin).
        Strictly base.group_system or superuser or standard admin UIDs.
        """
        admin_uids = {1, 2}
        if env.is_superuser():
            admin_uids.add(env.uid)
        try:
            admin_grp = env.ref('base.group_system', raise_if_not_found=False)
            if admin_grp:
                admin_uids.update(env['res.users'].sudo().search([('groups_id', 'in', [admin_grp.id])]).ids)
        except Exception as e:
            _logger.warning("Error resolving admin UIDs: %s", e)
        return admin_uids

    def _get_admin_partner_ids(self, env, admin_uids=None):
        if admin_uids is None:
            admin_uids = self._get_admin_uids(env)
        return set(env['res.users'].sudo().browse(list(admin_uids)).mapped('partner_id.id'))

    def _is_manager(self, env):
        """
        Identify if user is a Manager (Project Manager, Department Manager, HR Manager, ERP Manager).
        """
        user = env.user
        if env.is_superuser() or user.id in self._get_admin_uids(env):
            return True
        if user.has_group('base.group_system') or user.has_group('base.group_erp_manager'):
            return True
        if user.has_group('custom_project.group_project_manager_custom') or user.has_group('project.group_project_manager'):
            return True
        if user.has_group('hr.group_hr_manager'):
            return True
        if 'dipti' in (user.name or '').lower() or 'dipti' in (user.login or '').lower():
            return True
        try:
            if 'hr.department' in env:
                is_dept_manager = env['hr.department'].sudo().search_count([('manager_id.user_id', '=', user.id)]) > 0
                if is_dept_manager:
                    return True
        except Exception:
            pass
        return False

    def _get_user_department(self, env):
        user = env.user
        dept = user.department_id if hasattr(user, 'department_id') and user.department_id else False
        if not dept and 'hr.employee' in env:
            emp = env['hr.employee'].sudo().search([('user_id', '=', user.id)], limit=1)
            if emp and emp.department_id:
                dept = emp.department_id
        return dept

    # ── Building Calendar Events with 2-Color Architecture ──────────────────
    def _build_calendar_events(self, cal_events, env, admin_uids=None, user_firm_map=None, user_dept_map=None):
        """
        Processes calendar.event records with 2 distinct color codes:
          1. Admin Involved (MD / Admin / System Admin is an attendee) -> Royal Violet (#7c3aed)
          2. Managers & Users (All other team meetings) -> Ocean Sky Blue (#0284c7)
          - Done / Completed meetings are dimmed.
        """
        if admin_uids is None:
            admin_uids = self._get_admin_uids(env)
        admin_partner_ids = self._get_admin_partner_ids(env, admin_uids)
        user_firm_map = user_firm_map or {}
        user_dept_map = user_dept_map or {}
        user_tz_name = env.user.tz or 'Asia/Kolkata'
        try:
            user_tz = pytz.timezone(user_tz_name)
        except Exception:
            user_tz = pytz.timezone('UTC')

        today_date = date.today()
        is_admin = env.user.has_group('base.group_system') or env.is_superuser() or env.uid in admin_uids
        built_events = []

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

            u_names = [p.name for p in ev.partner_ids if p.name] or ([ev.user_id.name] if ev.user_id else [])
            attendees = ", ".join(u_names)

            # Check if Admin is actually an attendee/part of the meeting
            ev_partner_ids = set(partner_ids_list)
            if ev_partner_ids:
                has_admin = bool(ev_partner_ids & admin_partner_ids)
            else:
                has_admin = bool(ev.user_id and ev.user_id.id in admin_uids)

            # 2 Distinct Colors: Admin (Royal Violet #7c3aed) vs Users & Managers (Ocean Blue #0284c7)
            if has_admin:
                role_level = 'admin'
                role_label = 'Admin'
                base_color = '#7c3aed'      # Royal Violet
                dim_color = '#6d28d9'       # Dimmed Violet
                border_color = '#5b21b6'
            else:
                role_level = 'team'
                role_label = 'Managers & Users'
                base_color = '#ea580c'      # Warm Amber / Orange
                dim_color = '#c2410c'       # Dimmed Warm Amber
                border_color = '#9a3412'

            raw_desc = ev.description or ''
            is_done = '[DONE]' in raw_desc or getattr(ev, 'state', '') == 'done'
            clean_desc = html2plaintext(raw_desc).replace('[DONE]', '').strip()

            ev_firm_ids = set()
            ev_dept_ids = set()
            for uid in u_ids:
                if uid in user_firm_map:
                    ev_firm_ids.update(user_firm_map[uid])
                if uid in user_dept_map:
                    ev_dept_ids.add(user_dept_map[uid])

            ev_dept_id = list(ev_dept_ids)[0] if ev_dept_ids else None
            ev_dept_name = env['hr.department'].sudo().browse(ev_dept_id).name if ev_dept_id else ''
            ev_company_id = list(ev_firm_ids)[0] if ev_firm_ids else None
            ev_company_name = env['project.firm'].sudo().browse(ev_company_id).name if ev_company_id else ''

            is_admin_ev = has_admin
            clean_title = (ev.name or 'Meeting').replace('✓', '').strip()
            event_color = dim_color if is_done else base_color
            event_text_color = '#ffffff'

            built_events.append({
                'id': f"cal_{ev.id}",
                'raw_id': ev.id,
                'source': 'calendar',
                'title': clean_title,
                'raw_title': clean_title,
                'date': ev_date,
                'time': time_str,
                'time_start': time_start_str,
                'time_stop': time_stop_str,
                'type': 'meeting',
                'user_ids': u_ids,
                'user_names': u_names,
                'user_name': attendees,
                'description': clean_desc,
                'project_dept': 'Meeting',
                'state': 'done' if is_done else 'planned',
                'is_done': is_done,
                'role_level': role_level,
                'role_label': role_label,
                'color': event_color,
                'base_color': base_color,
                'dim_color': dim_color,
                'text_color': event_text_color,
                'border_color': border_color,
                'create_uid': ev.create_uid.id if ev.create_uid else False,
                'is_creator': bool(ev.create_uid and ev.create_uid.id == env.uid),
                'is_editable': bool((ev.create_uid and ev.create_uid.id == env.uid) or is_admin),
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
                'partner_ids': partner_ids_list,
            })
        return built_events

    # ── Routes: Get Calendar Data ───────────────────────────────────────────
    @http.route([
        '/custom_calendar/get_calendar_data',
        '/custom_discuss/get_calendar_data',
        '/department_dashboard/get_calendar_data',
    ], type='json', auth='user', methods=['POST'])
    def get_calendar_data(self, **kwargs):
        env = request.env
        today_date = date.today()
        admin_uids = self._get_admin_uids(env)
        is_admin = env.user.has_group('base.group_system') or env.is_superuser() or env.uid in admin_uids
        if 'dipti' in (env.user.name or '').lower() or 'dipti' in (env.user.login or '').lower():
            is_admin = False
        is_manager = self._is_manager(env)
        can_select_dept = is_admin or is_manager
        user_dept = self._get_user_department(env)

        # Fast prefetch firms
        firms_list = []
        user_firm_map = {}
        if 'project.firm' in env:
            all_firms_objs = env['project.firm'].sudo().search([])
            firms_list = [{'id': f.id, 'name': f.name, 'tag_ids': f.tag_ids.ids} for f in all_firms_objs]
            for f in all_firms_objs:
                if hasattr(f, 'team_user_ids') and f.team_user_ids:
                    for u in f.team_user_ids:
                        user_firm_map.setdefault(u.id, set()).add(f.id)

        user_dept_map = {}
        all_users = env['res.users'].sudo().search_read(
            [('active', '=', True)],
            ['id', 'name', 'login', 'email', 'phone', 'mobile', 'department_id', 'company_id']
        )
        for u in all_users:
            if u.get('department_id'):
                user_dept_map[u['id']] = u['department_id'][0]

        if 'hr.employee' in env:
            emps = env['hr.employee'].sudo().search_read([('user_id', '!=', False)], ['user_id', 'department_id'])
            for emp in emps:
                if emp.get('user_id') and emp.get('department_id'):
                    uid = emp['user_id'][0]
                    if uid not in user_dept_map:
                        user_dept_map[uid] = emp['department_id'][0]

        calendar_events = []
        try:
            # 1. Activities (Mail): Admin sees all; everyone else only sees meetings/activities of themselves
            domain_act = [] if is_admin else ['|', ('user_id', '=', env.uid), ('create_uid', '=', env.uid)]
            user_activities = env['mail.activity'].sudo().search(domain_act, limit=200, order="date_deadline desc")
            for act in user_activities:
                act_date = act.date_deadline.strftime('%Y-%m-%d') if act.date_deadline else today_date.strftime('%Y-%m-%d')
                is_meeting = act.activity_type_id and 'meeting' in (act.activity_type_id.name or '').lower()
                user_uids = [act.user_id.id] if act.user_id else ([act.create_uid.id] if act.create_uid else [])
                user_unames = [act.user_id.name] if act.user_id else []

                act_dept_id = user_dept_map.get(act.user_id.id) if act.user_id else None
                act_dept_name = env['hr.department'].sudo().browse(act_dept_id).name if act_dept_id else ''

                act_firm_ids = user_firm_map.get(act.user_id.id, set()) if act.user_id else set()
                act_company_id = list(act_firm_ids)[0] if act_firm_ids else None
                act_company_name = env['project.firm'].sudo().browse(act_company_id).name if act_company_id else ''

                is_admin_ev = bool(act.user_id and act.user_id.id in admin_uids)
                role_lvl = 'admin' if is_admin_ev else 'team'
                role_lbl = 'Admin' if is_admin_ev else 'Managers & Users'
                base_c = '#7c3aed' if is_admin_ev else '#ea580c'
                dim_c = '#6d28d9' if is_admin_ev else '#c2410c'

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
                    'project_dept': act.res_name or 'Activity',
                    'state': act.state or 'planned',
                    'is_done': False,
                    'role_level': role_lvl,
                    'role_label': role_lbl,
                    'color': base_c,
                    'base_color': base_c,
                    'dim_color': dim_c,
                    'text_color': '#ffffff',
                    'border_color': '#6d28d9' if is_admin_ev else '#047857',
                    'create_uid': act.create_uid.id if act.create_uid else False,
                    'is_creator': bool(act.create_uid and act.create_uid.id == env.uid),
                    'is_editable': bool((act.create_uid and act.create_uid.id == env.uid) or is_admin),
                    'is_admin_event': is_admin_ev,
                    'department_id': act_dept_id,
                    'department_name': act_dept_name,
                    'department_ids': [act_dept_id] if act_dept_id else [],
                    'company_id': act_company_id,
                    'company_name': act_company_name,
                    'firm_id': act_company_id,
                    'firm_name': act_company_name,
                    'firm_ids': list(act_firm_ids),
                    'company_ids': list(act_firm_ids),
                })

            # 2. Calendar Meetings: Admin sees all; everyone else only sees meetings of themselves
            if 'calendar.event' in env:
                cal_domain = [] if is_admin else [
                    '|', '|',
                    ('partner_ids', 'in', [env.user.partner_id.id]),
                    ('create_uid', '=', env.uid),
                    ('user_id', '=', env.uid)
                ]
                cal_events = env['calendar.event'].sudo().search(cal_domain, order="start desc", limit=400)
                calendar_events.extend(self._build_calendar_events(
                    cal_events, env, admin_uids=admin_uids,
                    user_firm_map=user_firm_map, user_dept_map=user_dept_map
                ))

        except Exception as e:
            _logger.error("Error fetching custom_calendar data: %s", e)

        all_depts_list = env['hr.department'].sudo().search_read([], ['id', 'name'])

        return {
            'status': 'success',
            'is_admin': is_admin,
            'is_manager': is_manager,
            'can_select_department': can_select_dept,
            'user_department_id': user_dept.id if user_dept else False,
            'user_department_name': user_dept.name if user_dept else '',
            'current_user_id': env.uid,
            'current_partner_id': env.user.partner_id.id,
            'calendar_events': calendar_events,
            'departments': all_depts_list,
            'firms': firms_list,
        }

    # ── Routes: Save / Mark Done / Edit Event ───────────────────────────────
    @http.route([
        '/custom_calendar/save_event',
        '/custom_discuss/save_calendar_event',
        '/department_dashboard/save_calendar_event',
    ], type='json', auth='user', methods=['POST'])
    def save_event(self, **kwargs):
        env = request.env
        user_id = env.uid
        admin_uids = self._get_admin_uids(env)
        is_admin = env.user.has_group('base.group_system') or env.is_superuser() or user_id in admin_uids
        if 'dipti' in (env.user.name or '').lower() or 'dipti' in (env.user.login or '').lower():
            is_admin = False
        is_manager = self._is_manager(env)
        can_manage = is_admin or is_manager

        raw_id = kwargs.get('raw_id') or kwargs.get('event_id')
        title = kwargs.get('title') or kwargs.get('name') or kwargs.get('summary') or 'Meeting'
        date_str = kwargs.get('date')
        time_start = kwargs.get('time_start', '09:00')
        time_stop = kwargs.get('time_stop', '10:00')
        activity_type = kwargs.get('activity_type') or kwargs.get('type') or 'meeting'
        description = kwargs.get('description', '')
        user_ids = kwargs.get('user_ids', [])
        department_id = kwargs.get('department_id')
        firm_id = kwargs.get('firm_id') or kwargs.get('company_id')
        mark_done = kwargs.get('mark_done', False)
        unmark_done = kwargs.get('unmark_done', False)

        if not date_str:
            return {'status': 'error', 'message': 'Meeting date is required.'}

        # Convert strings to float or time
        def _parse_time(t_str):
            try:
                parts = t_str.strip().split(':')
                return int(parts[0]), int(parts[1])
            except Exception:
                return 9, 0

        h_start, m_start = _parse_time(time_start)
        h_stop, m_stop = _parse_time(time_stop)

        user_tz_name = env.user.tz or 'Asia/Kolkata'
        try:
            user_tz = pytz.timezone(user_tz_name)
        except Exception:
            user_tz = pytz.timezone('UTC')

        try:
            dt_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            naive_start = datetime(dt_date.year, dt_date.month, dt_date.day, h_start, m_start)
            naive_stop = datetime(dt_date.year, dt_date.month, dt_date.day, h_stop, m_stop)

            local_start = user_tz.localize(naive_start)
            local_stop = user_tz.localize(naive_stop)

            utc_start = local_start.astimezone(pytz.utc).replace(tzinfo=None)
            utc_stop = local_stop.astimezone(pytz.utc).replace(tzinfo=None)
            duration = max(0.5, (naive_stop - naive_start).total_seconds() / 3600.0)
        except Exception as e:
            return {'status': 'error', 'message': f'Invalid date or time: {e}'}

        # Map user_ids to partner_ids
        partner_ids = []
        if user_ids:
            users = env['res.users'].sudo().browse(user_ids)
            partner_ids = [u.partner_id.id for u in users if u.partner_id]

        if env.user.partner_id.id not in partner_ids:
            partner_ids.append(env.user.partner_id.id)

        try:
            CalendarEvent = env['calendar.event'].sudo()
            event_record = CalendarEvent.browse(int(raw_id)) if raw_id else None

            # Check edit permissions: The person scheduling the meeting OR Admin can modify it
            if event_record and event_record.exists():
                is_creator = bool(event_record.create_uid and event_record.create_uid.id == user_id)
                if not (is_creator or is_admin):
                    return {'status': 'error', 'message': 'Only the person who scheduled this meeting or an Admin can modify it.'}

            vals = {
                'name': title,
                'start': utc_start,
                'stop': utc_stop,
                'duration': duration,
                'partner_ids': [(6, 0, partner_ids)],
            }

            clean_desc = html2plaintext(description or '').replace('[DONE]', '').strip()
            if mark_done:
                vals['description'] = f"{clean_desc}\n[DONE]" if clean_desc else "[DONE]"
            elif unmark_done:
                vals['description'] = clean_desc
            elif description is not None:
                if event_record and event_record.exists() and '[DONE]' in (event_record.description or ''):
                    vals['description'] = f"{clean_desc}\n[DONE]"
                else:
                    vals['description'] = clean_desc

            if event_record and event_record.exists():
                event_record.write(vals)
                saved_id = event_record.id
            else:
                event_record = CalendarEvent.create(vals)
                saved_id = event_record.id

            return {
                'status': 'success',
                'event_id': f"cal_{saved_id}",
                'raw_id': saved_id,
                'message': 'Meeting saved successfully.',
            }
        except Exception as e:
            _logger.error("Error saving calendar event: %s", e)
            return {'status': 'error', 'message': str(e)}

    # ── Routes: Delete Event ────────────────────────────────────────────────
    @http.route([
        '/custom_calendar/delete_event',
        '/custom_discuss/delete_calendar_event',
        '/department_dashboard/delete_calendar_event',
    ], type='json', auth='user', methods=['POST'])
    def delete_event(self, **kwargs):
        env = request.env
        user_id = env.uid
        admin_uids = self._get_admin_uids(env)
        is_admin = env.user.has_group('base.group_system') or env.is_superuser() or user_id in admin_uids
        if 'dipti' in (env.user.name or '').lower() or 'dipti' in (env.user.login or '').lower():
            is_admin = False
        is_manager = self._is_manager(env)

        raw_id = kwargs.get('raw_id') or kwargs.get('event_id')
        source = kwargs.get('source', 'calendar')

        if not raw_id:
            return {'status': 'error', 'message': 'Event ID is required for deletion.'}

        try:
            if source == 'calendar':
                event = env['calendar.event'].sudo().browse(int(raw_id))
                if event.exists():
                    is_creator = bool(event.create_uid and event.create_uid.id == user_id)
                    if not (is_creator or is_admin):
                        return {'status': 'error', 'message': 'Only the person who scheduled this meeting or an Admin can delete it.'}
                    event.unlink()
                    return {'status': 'success', 'message': 'Meeting deleted.'}
            elif source == 'activity':
                act = env['mail.activity'].sudo().browse(int(raw_id))
                if act.exists():
                    is_creator = bool(act.create_uid and act.create_uid.id == user_id)
                    if not (is_creator or is_admin):
                        return {'status': 'error', 'message': 'Only the person who scheduled this activity or an Admin can delete it.'}
                    act.unlink()
                    return {'status': 'success', 'message': 'Activity deleted.'}
            return {'status': 'error', 'message': 'Event not found.'}
        except Exception as e:
            _logger.error("Error deleting calendar event: %s", e)
            return {'status': 'error', 'message': str(e)}

    # ── Routes: Get Users and Departments ───────────────────────────────────
    @http.route([
        '/custom_calendar/get_users_and_departments',
        '/custom_discuss/get_users_and_departments',
        '/department_dashboard/get_users_and_departments',
    ], type='json', auth='user', methods=['POST'])
    def get_users_and_departments(self, **kwargs):
        env = request.env
        user_dept_map = {}
        all_users = env['res.users'].sudo().search_read(
            [('active', '=', True)],
            ['id', 'name', 'login', 'email', 'phone', 'mobile', 'department_id']
        )
        for u in all_users:
            if u.get('department_id'):
                user_dept_map[u['id']] = u['department_id'][0]

        if 'hr.employee' in env:
            emps = env['hr.employee'].sudo().search_read([('user_id', '!=', False)], ['user_id', 'department_id'])
            for emp in emps:
                if emp.get('user_id') and emp.get('department_id'):
                    uid = emp['user_id'][0]
                    if uid not in user_dept_map:
                        user_dept_map[uid] = emp['department_id'][0]

        dept_objs = env['hr.department'].sudo().search_read([], ['id', 'name'])
        dept_name_map = {d['id']: d['name'] for d in dept_objs}

        users_list = []
        for u in all_users:
            dept_id = False
            dept_name = 'Other'
            if u.get('department_id'):
                dept_id = u['department_id'][0]
                dept_name = u['department_id'][1]
            elif u['id'] in user_dept_map:
                dept_id = user_dept_map[u['id']]
                dept_name = dept_name_map.get(dept_id, 'Other')
            users_list.append({
                'id': u['id'],
                'name': u['name'],
                'login': u.get('login', ''),
                'department_id': dept_id,
                'department_name': dept_name,
                'department': dept_name,
            })

        admin_uids = self._get_admin_uids(env)
        is_admin = env.user.has_group('base.group_system') or env.is_superuser() or env.uid in admin_uids
        is_manager = self._is_manager(env)
        can_select_dept = is_admin or is_manager
        user_dept = self._get_user_department(env)

        return {
            'status': 'success',
            'users': users_list,
            'departments': dept_objs,
            'is_admin': is_admin,
            'is_manager': is_manager,
            'can_select_department': can_select_dept,
            'user_department_id': user_dept.id if user_dept else False,
            'user_department_name': user_dept.name if user_dept else '',
        }
