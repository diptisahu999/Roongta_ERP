# -*- coding: utf-8 -*-
from odoo import models, fields, api
from datetime import datetime, date
import pytz
import logging

_logger = logging.getLogger(__name__)


class ProjectTaskMOM(models.Model):
    _name = 'project.task.mom'
    _description = 'Task Minutes of Meeting (MOM)'
    _order = 'date desc, id desc'

    name = fields.Char(string='Meeting Subject / Title', required=True)
    task_id = fields.Many2one('project.task', string='Task', ondelete='cascade', required=True)
    project_id = fields.Many2one('project.project', string='Project', related='task_id.project_id', store=True, readonly=True)
    department_id = fields.Many2one('hr.department', string='Department', related='task_id.department_id', store=True, readonly=True)
    date = fields.Datetime(string='Meeting Date & Time', default=fields.Datetime.now, required=True)
    attendee_ids = fields.Many2many('res.users', string='Attendees')
    key_discussion = fields.Text(string='Key Discussion / Notes')
    decisions = fields.Text(string='Decisions Taken')
    action_items = fields.Text(string='Action Items')
    created_by = fields.Many2one('res.users', string='Created By', default=lambda self: self.env.user)


class ProjectTaskBlocker(models.Model):
    _name = 'project.task.blocker'
    _description = 'Task Blocker / Impediment'
    _order = 'status asc, severity desc, id desc'

    name = fields.Char(string='Blocker Description / Root Cause', required=True)
    task_id = fields.Many2one('project.task', string='Task', ondelete='cascade', required=True)
    project_id = fields.Many2one('project.project', string='Project', related='task_id.project_id', store=True, readonly=True)
    department_id = fields.Many2one('hr.department', string='Department', related='task_id.department_id', store=True, readonly=True)
    category = fields.Selection([
        ('internal', 'Internal Dependency'),
        ('external', 'External / Client Dependency'),
        ('management', 'Management Decision / Approval'),
        ('technical', 'Technical / Infrastructure'),
        ('other', 'Other'),
    ], string='Category', default='internal', required=True)
    severity = fields.Selection([
        ('critical', 'Critical (Blocks Work)'),
        ('moderate', 'Moderate (Slows Down)'),
        ('low', 'Low (Minor)'),
    ], string='Severity', default='critical', required=True)
    status = fields.Selection([
        ('active', 'Active Blocker'),
        ('resolved', 'Resolved'),
    ], string='Status', default='active', required=True)
    date_blocked = fields.Date(string='Date Blocked', default=fields.Date.context_today, required=True)
    date_resolved = fields.Date(string='Date Resolved')
    assigned_to = fields.Many2one('res.users', string='Assigned to Resolve')
    resolution_notes = fields.Text(string='Resolution Notes')
    created_by = fields.Many2one('res.users', string='Reported By', default=lambda self: self.env.user)


class ProjectTask(models.Model):
    _inherit = 'project.task'

    mom_ids = fields.One2many('project.task.mom', 'task_id', string='Minutes of Meeting')
    mom_count = fields.Integer(string='MOM Count', compute='_compute_mom_blocker_counts', store=False)

    blocker_ids = fields.One2many('project.task.blocker', 'task_id', string='Blockers')
    active_blocker_count = fields.Integer(string='Active Blockers', compute='_compute_mom_blocker_counts', store=False)

    @api.depends('mom_ids', 'blocker_ids.status')
    def _compute_mom_blocker_counts(self):
        for task in self:
            task.mom_count = len(task.mom_ids)
            task.active_blocker_count = len(task.blocker_ids.filtered(lambda b: b.status == 'active'))

    def action_view_task_moms(self):
        self.ensure_one()
        return {
            'name': f'MOMs - {self.name}',
            'type': 'ir.actions.act_window',
            'res_model': 'project.task.mom',
            'view_mode': 'list,form',
            'domain': [('task_id', '=', self.id)],
            'context': {
                'default_task_id': self.id,
            },
        }

    def action_view_task_blockers(self):
        self.ensure_one()
        return {
            'name': f'Blockers - {self.name}',
            'type': 'ir.actions.act_window',
            'res_model': 'project.task.blocker',
            'view_mode': 'list,form',
            'domain': [('task_id', '=', self.id)],
            'context': {
                'default_task_id': self.id,
            },
        }

    @api.model
    def get_task_tracking_dashboard_data(self, filters=None):
        """Fetch unified data for the 3 Dedicated Tiles: MOM, Blockers, and Timeline."""
        if filters is None:
            filters = {}

        today = fields.Date.context_today(self)
        uid = self.env.uid

        # Timezone setup
        user_tz_name = self.env.user.tz or 'Asia/Kolkata'
        try:
            user_tz = pytz.timezone(user_tz_name)
        except Exception:
            user_tz = pytz.timezone('Asia/Kolkata')

        # Base role scoping
        is_admin = bool(
            self.env.su or 
            self.env.user.has_group('base.group_system') or 
            self.env.user.has_group('project.group_project_manager')
        )
        is_manager = self.env.user.has_group('custom_project.group_project_manager_custom')

        task_domain = [('active', '=', True)]
        managed_project_ids = []
        if not is_admin:
            if is_manager:
                managed_project_ids = self.env['project.project'].sudo().search([
                    '|',
                    ('user_id', '=', uid),
                    ('assigned_user_ids', 'in', [uid]),
                ]).ids
                task_domain.extend([
                    '|', '|',
                    ('user_ids', 'in', [uid]),
                    ('create_uid', '=', uid),
                    ('project_id', 'in', managed_project_ids),
                ])
            else:
                task_domain.extend([
                    '|',
                    ('user_ids', 'in', [uid]),
                    ('create_uid', '=', uid),
                ])

        # Filter: Department
        dept_filter = filters.get('department_id')
        if dept_filter and dept_filter != 'all':
            try:
                task_domain.append(('department_id', '=', int(dept_filter)))
            except (ValueError, TypeError):
                pass

        # Filter: Project
        proj_filter = filters.get('project_id')
        if proj_filter and proj_filter != 'all':
            try:
                task_domain.append(('project_id', '=', int(proj_filter)))
            except (ValueError, TypeError):
                pass

        # Filter: Search term
        search_term = filters.get('search_term', '').strip()
        if search_term:
            task_domain.append(('name', 'ilike', search_term))

        tasks = self.search(task_domain, order='date_deadline asc, create_date desc', limit=200)

        # Base role scoping for MOMs and Blockers
        base_sub_domain = []
        if not is_admin:
            if is_manager and managed_project_ids:
                base_sub_domain.extend(['|', '|', ('task_id.user_ids', 'in', [uid]), ('task_id.create_uid', '=', uid), ('project_id', 'in', managed_project_ids)])
            else:
                base_sub_domain.extend(['|', ('task_id.user_ids', 'in', [uid]), ('task_id.create_uid', '=', uid)])

        # ═══ 1. TILE 1: MOM (Minutes of Meeting) ═══
        mom_domain = list(base_sub_domain)
        if dept_filter and dept_filter != 'all':
            try:
                mom_domain.append(('department_id', '=', int(dept_filter)))
            except (ValueError, TypeError):
                pass
        if proj_filter and proj_filter != 'all':
            try:
                mom_domain.append(('project_id', '=', int(proj_filter)))
            except (ValueError, TypeError):
                pass
        if search_term:
            mom_domain.extend(['|', ('name', 'ilike', search_term), ('task_id.name', 'ilike', search_term)])

        moms = self.env['project.task.mom'].search(mom_domain, order='date desc', limit=50)
        mom_list = []
        for m in moms:
            dt_formatted = ""
            if m.date:
                utc_dt = pytz.utc.localize(m.date) if m.date.tzinfo is None else m.date
                dt_formatted = utc_dt.astimezone(user_tz).strftime('%d %b %Y, %I:%M %p')

            attendees = [{'id': u.id, 'name': u.name} for u in m.attendee_ids]
            mom_list.append({
                'id': m.id,
                'name': m.name,
                'task_id': m.task_id.id,
                'task_name': m.task_id.name,
                'project_name': m.project_id.name or 'General',
                'dept_name': m.department_id.name or 'General',
                'date': dt_formatted,
                'attendees': attendees,
                'key_discussion': m.key_discussion or '',
                'decisions': m.decisions or '',
                'action_items': m.action_items or '',
                'created_by': m.created_by.name if m.created_by else 'User',
            })

        # ═══ 2. TILE 2: BLOCKERS ═══
        blocker_domain = list(base_sub_domain)
        if dept_filter and dept_filter != 'all':
            try:
                blocker_domain.append(('department_id', '=', int(dept_filter)))
            except (ValueError, TypeError):
                pass
        if proj_filter and proj_filter != 'all':
            try:
                blocker_domain.append(('project_id', '=', int(proj_filter)))
            except (ValueError, TypeError):
                pass
        if search_term:
            blocker_domain.extend(['|', ('name', 'ilike', search_term), ('task_id.name', 'ilike', search_term)])

        blockers = self.env['project.task.blocker'].search(blocker_domain, order='status asc, severity desc, id desc', limit=50)
        blocker_list = []
        active_blocker_count = 0
        critical_blocker_count = 0

        for b in blockers:
            if b.status == 'active':
                active_blocker_count += 1
                if b.severity == 'critical':
                    critical_blocker_count += 1

            days_blocked = (today - b.date_blocked).days if b.date_blocked else 0
            blocker_list.append({
                'id': b.id,
                'name': b.name,
                'task_id': b.task_id.id,
                'task_name': b.task_id.name,
                'project_name': b.project_id.name or 'General',
                'dept_name': b.department_id.name or 'General',
                'category': b.category,
                'category_label': dict(b._fields['category'].selection).get(b.category, b.category),
                'severity': b.severity,
                'severity_label': dict(b._fields['severity'].selection).get(b.severity, b.severity),
                'status': b.status,
                'date_blocked': b.date_blocked.strftime('%d %b %Y') if b.date_blocked else '',
                'date_resolved': b.date_resolved.strftime('%d %b %Y') if b.date_resolved else '',
                'days_blocked': max(0, days_blocked),
                'assigned_to_name': b.assigned_to.name if b.assigned_to else 'Unassigned',
                'resolution_notes': b.resolution_notes or '',
                'reported_by': b.created_by.name if b.created_by else 'User',
            })

        # ═══ 3. TILE 3: TIMELINE ═══
        timeline_list = []
        overdue_count = 0

        for t in tasks:
            is_done = t.state == '1_done' or bool(t.is_closed and t.state not in ['1_canceled', '01_in_progress'])
            dd_val = t.date_deadline
            is_overdue = False
            days_left = None
            formatted_dd = ""

            if dd_val:
                formatted_dd = dd_val.strftime('%d %b %Y')
                if not is_done and dd_val < today:
                    is_overdue = True
                    overdue_count += 1
                    days_left = (today - dd_val).days  # Days overdue
                elif not is_done:
                    days_left = (dd_val - today).days  # Days remaining

            prog = t.task_progress_rate or 0.0
            if not prog and hasattr(t, 'task_progress') and t.task_progress:
                try:
                    prog = float(t.task_progress)
                except Exception:
                    prog = 0.0

            create_dt_fmt = ""
            if t.create_date:
                utc_dt = pytz.utc.localize(t.create_date) if t.create_date.tzinfo is None else t.create_date
                create_dt_fmt = utc_dt.astimezone(user_tz).strftime('%d %b %Y')

            timeline_list.append({
                'id': t.id,
                'name': t.name,
                'project_name': t.project_id.name if t.project_id else 'General',
                'dept_name': t.department_id.name if t.department_id else 'General',
                'stage_name': t.stage_id.name if t.stage_id else (t.state or 'To Do'),
                'progress': int(round(prog)),
                'is_done': is_done,
                'is_overdue': is_overdue,
                'days_left': days_left,
                'create_date': create_dt_fmt,
                'deadline': formatted_dd,
                'days_open': max(0, (today - t.create_date.date()).days) if t.create_date else 0,
                'assignees': [{'id': u.id, 'name': u.name} for u in t.user_ids],
                'has_active_blocker': bool(t.blocker_ids.filtered(lambda b: b.status == 'active')),
            })

        # Filter lists for dropdowns
        all_depts = self.env['hr.department'].search_read([], ['id', 'name'], order='name asc')
        if is_admin:
            all_projs = self.env['project.project'].search_read([('active', '=', True)], ['id', 'name'], order='name asc')
        elif is_manager and managed_project_ids:
            all_projs = self.env['project.project'].sudo().search_read([('id', 'in', managed_project_ids), ('active', '=', True)], ['id', 'name'], order='name asc')
        else:
            all_projs = self.env['project.project'].search_read([('active', '=', True)], ['id', 'name'], order='name asc')

        all_users = self.env['res.users'].search_read([('share', '=', False)], ['id', 'name'], order='name asc')

        return {
            'metrics': {
                'total_moms': len(mom_list),
                'active_blockers': active_blocker_count,
                'critical_blockers': critical_blocker_count,
                'tracked_tasks': len(timeline_list),
                'overdue_timelines': overdue_count,
            },
            'moms': mom_list,
            'blockers': blocker_list,
            'timelines': timeline_list,
            'departments': all_depts,
            'projects': all_projs,
            'users': all_users,
            'tasks_simple': [{'id': t.id, 'name': f"#{t.id} - {t.name}"} for t in tasks[:100]],
        }

    @api.model
    def create_task_mom(self, vals):
        """Create a new Minutes of Meeting record."""
        return self.env['project.task.mom'].create(vals).id

    @api.model
    def create_task_blocker(self, vals):
        """Report a new blocker on a task."""
        return self.env['project.task.blocker'].create(vals).id

    @api.model
    def resolve_task_blocker(self, blocker_id, resolution_notes=''):
        """Mark a blocker as resolved."""
        blocker = self.env['project.task.blocker'].browse(int(blocker_id))
        if blocker.exists():
            blocker.write({
                'status': 'resolved',
                'date_resolved': fields.Date.context_today(self),
                'resolution_notes': resolution_notes,
            })
            return True
        return False
