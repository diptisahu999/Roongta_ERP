from odoo import models, fields, api
from odoo.exceptions import ValidationError
from datetime import datetime, time, timedelta
import pytz
import logging

_logger = logging.getLogger(__name__)


class ProjectTask(models.Model):
    _inherit = 'project.task'

    date_deadline = fields.Date(default=lambda self: fields.Date.context_today(self) + timedelta(days=3), required=True)
    department_id = fields.Many2one('hr.department', string='Department')
    priority = fields.Selection([
        ('0', 'Low'),
        ('1', 'Medium'),
        ('2', 'High'),
        ('3', 'Urgent'),
    ], default='0', string="Priority", tracking=True)
    timesheet_total = fields.Float(string='Timesheets', compute='_compute_timesheet_total')
    recurrence_time = fields.Float(string="Recurring Time", tracking=True)
    days_open = fields.Integer(string="Days Open", compute="_compute_days_open", search="_search_days_open")
    state = fields.Selection(
        selection_add=[
            ('05_management_discussion', 'MGMT Discussion'),
        ],
        ondelete={'05_management_discussion': 'cascade'}
    )

    task_progress = fields.Selection([
        ('0', '0%'),
        ('10', '10%'),
        ('20', '20%'),
        ('30', '30%'),
        ('40', '40%'),
        ('50', '50%'),
        ('60', '60%'),
        ('70', '70%'),
        ('80', '80%'),
        ('90', '90%'),
        ('100', '100%'),
    ], string="Progress Dropdown", default='0', tracking=True)
    task_progress_rate = fields.Float(string="Progress Rate", compute='_compute_task_progress_rate', store=True, group_operator=False)
    progress = fields.Float(string="Progress", compute='_compute_task_progress_rate', store=True, group_operator=False)

    @api.onchange('state', 'stage_id')
    def _onchange_state_auto_fill_progress(self):
        st_name = (self.stage_id.name or '').lower() if self.stage_id else ''
        is_done_flag = (
            self.state == '1_done' or
            (self.stage_id and (self.stage_id.fold or getattr(self.stage_id, 'is_closed', False) or 'complete' in st_name or 'done' in st_name))
        )
        if is_done_flag:
            self.task_progress = '100'
            if self.state != '1_done' and self.state != '1_canceled':
                self.state = '1_done'

    @api.depends('task_progress', 'state', 'stage_id', 'stage_id.fold', 'stage_id.name')
    def _compute_task_progress_rate(self):
        for task in self:
            st_name = (task.stage_id.name or '').lower() if task.stage_id else ''
            is_done_flag = (
                task.state == '1_done' or
                (task.stage_id and (task.stage_id.fold or getattr(task.stage_id, 'is_closed', False) or 'complete' in st_name or 'done' in st_name))
            )
            if is_done_flag:
                val = 100.0
                if task.task_progress != '100':
                    task.task_progress = '100'
                if task.state != '1_done' and task.state != '1_canceled':
                    task.state = '1_done'
            else:
                try:
                    val = float(task.task_progress or '0')
                except (ValueError, TypeError):
                    val = 0.0
            task.task_progress_rate = val
            task.progress = val

    @api.constrains('tag_ids')
    def _check_tag_ids_limit(self):
        for rec in self:
            if len(rec.tag_ids) > 1:
                raise ValidationError("You can only select one tag.")

    single_tag_id = fields.Many2one(
        'project.tags',
        string="Tag",
        compute='_compute_single_tag_id',
        inverse='_inverse_single_tag_id',
        store=True
    )

    @api.depends('tag_ids')
    def _compute_single_tag_id(self):
        for rec in self:
            rec.single_tag_id = rec.tag_ids[0] if rec.tag_ids else False

    def _inverse_single_tag_id(self):
        for rec in self:
            if rec.single_tag_id:
                rec.tag_ids = [(6, 0, [rec.single_tag_id.id])]
            else:
                rec.tag_ids = [(5, 0, 0)]

    @api.depends('create_date', 'state', 'date_last_stage_update')
    def _compute_days_open(self):
        for task in self:
            if not task.create_date:
                task.days_open = 0
                continue
                
            if task.state in ['1_done', '1_canceled'] and task.date_last_stage_update:
                end_date = task.date_last_stage_update.date()
            else:
                end_date = fields.Date.today()
                
            task.days_open = (end_date - task.create_date.date()).days

    def _search_days_open(self, operator, value):
        # Fetch active or all tasks since dataset is small, compute days_open, and filter
        tasks = self.search([])
        matched_ids = []
        try:
            val_int = int(value)
        except (ValueError, TypeError):
            return []
            
        for task in tasks:
            if operator == '=' and task.days_open == val_int:
                matched_ids.append(task.id)
            elif operator == '!=' and task.days_open != val_int:
                matched_ids.append(task.id)
            elif operator == '>' and task.days_open > val_int:
                matched_ids.append(task.id)
            elif operator == '>=' and task.days_open >= val_int:
                matched_ids.append(task.id)
            elif operator == '<' and task.days_open < val_int:
                matched_ids.append(task.id)
            elif operator == '<=' and task.days_open <= val_int:
                matched_ids.append(task.id)
        return [('id', 'in', matched_ids)]

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            stage_id = vals.get('stage_id')
            stage_obj = self.env['project.task.type'].browse(stage_id) if stage_id else None
            st_name = (stage_obj.name or '').lower() if stage_obj else ''
            is_done_flag = (
                vals.get('state') == '1_done' or
                (stage_obj and (stage_obj.fold or getattr(stage_obj, 'is_closed', False) or 'complete' in st_name or 'done' in st_name))
            )
            if is_done_flag:
                vals['task_progress'] = '100'
                vals['state'] = '1_done'
            # Auto-fill department and tag for sub-tasks from parent task
            parent_id = vals.get('parent_id') or self.env.context.get('default_parent_id')
            if parent_id:
                parent_task = self.env['project.task'].browse(parent_id)
                if parent_task.exists():
                    if not vals.get('department_id') and parent_task.department_id:
                        vals['department_id'] = parent_task.department_id.id
                    if not vals.get('tag_ids') and parent_task.tag_ids:
                        vals['tag_ids'] = [(6, 0, parent_task.tag_ids.ids)]
                    if not vals.get('single_tag_id') and parent_task.single_tag_id:
                        vals['single_tag_id'] = parent_task.single_tag_id.id

        if self.env.context.get('default_project_id'):
            for vals in vals_list:
                if not vals.get('department_id'):
                    raise ValidationError("Department is strictly required when adding a new task.")
                if 'date_deadline' in vals and not vals.get('date_deadline'):
                    raise ValidationError("Deadline is strictly required when adding a new task.")
                
                user_ids = vals.get('user_ids')
                has_users = False
                if user_ids:
                    for command in user_ids:
                        if command[0] == 6 and command[2]:
                            has_users = True
                        elif command[0] == 4:
                            has_users = True
                
                if not has_users:
                    raise ValidationError("Assignees are strictly required when adding a new task.")
                    
        tasks = super().create(vals_list)
        for task in tasks:
            if task.parent_id and task.user_ids:
                new_users = task.user_ids - task.parent_id.user_ids
                if new_users:
                    task.parent_id.sudo().write({
                        'user_ids': [(4, user.id) for user in new_users]
                    })
        return tasks

    @api.model
    def _read_group_stage_ids(self, *args, **kwargs):
        stages_rs = super()._read_group_stage_ids(*args, **kwargs)
        done_stages = stages_rs.filtered(lambda s: s.name and s.name.lower() == 'done')
        if done_stages:
            other_stages = stages_rs - done_stages
            return other_stages + done_stages
        return stages_rs

    @api.depends('timesheet_ids.unit_amount')
    def _compute_timesheet_total(self):
        for rec in self:
            rec.timesheet_total = sum(rec.timesheet_ids.mapped('unit_amount'))

    assignable_user_ids = fields.Many2many('res.users', compute='_compute_assignable_user_ids')

    @api.depends('department_id')
    def _compute_assignable_user_ids(self):
        user = self.env.user
        # Admins, Project Administrators AND Custom Managers all see ALL users
        is_admin_or_manager = (
            user.has_group('project.group_project_manager')
            or user.has_group('base.group_system')
            or user.has_group('custom_project.group_project_manager_custom')
        )

        for task in self:
            if is_admin_or_manager:
                # Admins & managers can assign any internal user
                allowed_users = self.env['res.users'].sudo().search([('share', '=', False), ('active', '=', True)])
            else:
                # Regular users: restrict to all internal users (basic behaviour)
                allowed_users = self.env['res.users'].sudo().search([('share', '=', False), ('active', '=', True)])

            task.assignable_user_ids = allowed_users


    @api.model
    def _search(self, domain, offset=0, limit=None, order=None):
        if self.env.su:
            return super()._search(domain, offset=offset, limit=limit, order=order)
        """
        Task visibility restriction:

        Tier 1 - System Administrator: Sees ALL tasks.
        Tier 2 - Project Administrator: Sees ALL tasks.

        Tier 3 - Custom Project Manager:
            → Sees tasks assigned directly to them (user_ids includes them).
            → Sees ALL tasks in projects they manage:
                  projects where they are Project Manager (user_id = me)
                  OR they are in Assigned To (assigned_user_ids).
            This lets managers track their own work AND monitor their team's tasks
            without seeing tasks from projects they have no relation to.

        Tier 4 - Project User:
            → Sees ONLY tasks assigned directly to them (user_ids includes them).
        """
        user = self.env.user

        # Tier 1 & 2: Admins see everything
        if user.has_group('base.group_system') or user.has_group('project.group_project_manager'):
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Bypass custom visibility filters if Odoo is looking for specific records 
        # (e.g. during read() or name_get() on relational fields) to avoid AccessErrors.
        is_specific_id_search = any(
            isinstance(term, tuple) and term[0] == 'id' and term[1] in ('=', 'in') 
            for term in domain if isinstance(term, tuple)
        )
        if is_specific_id_search:
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Tier 3: Custom Project Manager
        # Sees their own tasks + ALL tasks in projects they manage.
        # Uses sudo() to safely fetch managed project IDs without triggering
        # recursive project.project access checks inside task._search.
        if user.has_group('custom_project.group_project_manager_custom'):
            managed_project_ids = self.env['project.project'].sudo().search([
                '|',
                ('user_id', '=', user.id),
                ('assigned_user_ids', 'in', [user.id]),
            ]).ids

            visibility_domain = [
                '|',
                ('user_ids', 'in', [user.id]),          # tasks assigned to the manager
                ('project_id', 'in', managed_project_ids),  # all tasks in managed projects
            ]
            domain = visibility_domain + list(domain)
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Tier 4: Project User — see tasks assigned directly to them OR created by them
        visibility_domain = [
            '|',
            ('user_ids', 'in', [user.id]),
            ('create_uid', '=', user.id),
        ]
        domain = visibility_domain + list(domain)
        return super()._search(domain, offset=offset, limit=limit, order=order)



    def write(self, vals):
        stage_id = vals.get('stage_id')
        stage_obj = self.env['project.task.type'].browse(stage_id) if stage_id else None
        st_name = (stage_obj.name or '').lower() if stage_obj else ''
        is_done_flag = (
            vals.get('state') == '1_done' or
            (stage_obj and (stage_obj.fold or getattr(stage_obj, 'is_closed', False) or 'complete' in st_name or 'done' in st_name))
        )
        if is_done_flag:
            vals['task_progress'] = '100'
            vals['state'] = '1_done'

        res = super().write(vals)

        if 'user_ids' in vals or 'parent_id' in vals:
            for task in self:
                if task.parent_id and task.user_ids:
                    new_users = task.user_ids - task.parent_id.user_ids
                    if new_users:
                        task.parent_id.sudo().write({
                            'user_ids': [(4, user.id) for user in new_users]
                        })
        return res

class ProjectTaskType(models.Model):
    _inherit = 'project.task.type'

    @api.model
    def _search(self, domain, offset=0, limit=None, order=None):
        if self.env.su:
            return super()._search(domain, offset=offset, limit=limit, order=order)
        user = self.env.user

        # Admins see everything
        if user.has_group('base.group_system') or user.has_group('project.group_project_manager'):
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Bypass for specific ID searches
        is_specific_id_search = any(
            isinstance(term, tuple) and term[0] == 'id' and term[1] in ('=', 'in')
            for term in domain if isinstance(term, tuple)
        )
        if is_specific_id_search:
            return super()._search(domain, offset=offset, limit=limit, order=order)

        # Tier 3 (Manager) and Tier 4 (User) only see task stages for projects they are involved in.
        # Find project IDs where this user has assigned tasks safely via sudo()
        assigned_task_project_ids = self.env['project.task'].sudo().search([
            ('user_ids', 'in', [user.id]),
            ('project_id', '!=', False),
        ]).mapped('project_id').ids

        managed_project_domain = [
            '|', '|', '|', '|', '|',
            ('user_id', '=', user.id),
            ('assigned_user_ids', 'in', [user.id]),
            ('partner_id', '=', user.partner_id.id),
            ('create_uid', '=', user.id),
            ('message_partner_ids', 'in', [user.partner_id.id]),
            ('id', 'in', assigned_task_project_ids),
        ]
        
        # Get IDs of projects they can see
        allowed_project_ids = self.env['project.project'].sudo().search(managed_project_domain).ids

        visibility_domain = [
            '|', 
            ('project_ids', '=', False), # Global stages
            ('project_ids', 'in', allowed_project_ids) # Stages for their projects
        ]
        
        domain = visibility_domain + list(domain)
        return super()._search(domain, offset=offset, limit=limit, order=order)

class AccountAnalyticLine(models.Model):
    _inherit = 'account.analytic.line'

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            user_id = vals.get('user_id')
            if user_id and not vals.get('employee_id'):
                user = self.env['res.users'].sudo().browse(user_id)
                if user.exists():
                    employee = self.env['hr.employee'].sudo().search([('user_id', '=', user.id)], limit=1)
                    if not employee:
                        employee = self.env['hr.employee'].sudo().create({
                            'name': user.name,
                            'user_id': user.id,
                            'company_id': user.company_id.id or self.env.company.id,
                        })
                    vals['employee_id'] = employee.id
        return super().create(vals_list)

    def write(self, vals):
        if 'user_id' in vals and not vals.get('employee_id'):
            user_id = vals.get('user_id')
            if user_id:
                user = self.env['res.users'].sudo().browse(user_id)
                if user.exists():
                    employee = self.env['hr.employee'].sudo().search([('user_id', '=', user.id)], limit=1)
                    if not employee:
                        employee = self.env['hr.employee'].sudo().create({
                            'name': user.name,
                            'user_id': user.id,
                            'company_id': user.company_id.id or self.env.company.id,
                        })
                    vals['employee_id'] = employee.id
        return super().write(vals)

    @api.onchange('user_id')
    def _onchange_user_id_custom(self):
        if self.user_id:
            employee = self.env['hr.employee'].sudo().search([('user_id', '=', self.user_id.id)], limit=1)
            if employee:
                self.employee_id = employee.id

class ProjectTaskRecurrence(models.Model):
    _inherit = 'project.task.recurrence'

    pending_task_id = fields.Many2one('project.task', string="Pending Task for Recurrence")
    next_recurrence_datetime = fields.Datetime(string="Next Recurrence Date/Time")

    def _create_next_occurrence(self, occurrence_from):
        self.ensure_one()
        # Prevent double mail_followers creation (from standard)
        if (
            self.repeat_type != 'until' or not occurrence_from.date_deadline or
            self.repeat_until and (occurrence_from.date_deadline + self._get_recurrence_delta()).date() <= self.repeat_until
        ):
            delta = self._get_recurrence_delta()
            next_date = occurrence_from.date_deadline + delta if occurrence_from.date_deadline else fields.Date.today() + delta
            
            hours = int(occurrence_from.recurrence_time)
            minutes = int((occurrence_from.recurrence_time - hours) * 60)
            
            user_tz = pytz.timezone(self.env.user.tz or 'UTC')
            local_dt = user_tz.localize(datetime.combine(next_date, time(hours, minutes)))
            utc_dt = local_dt.astimezone(pytz.utc).replace(tzinfo=None)
            
            self.pending_task_id = occurrence_from.id
            self.next_recurrence_datetime = utc_dt

    @api.model
    def _cron_generate_delayed_recurring_tasks(self):
        records = self.search([
            ('pending_task_id', '!=', False),
            ('next_recurrence_datetime', '<=', fields.Datetime.now())
        ])
        for rec in records:
            if rec.pending_task_id:
                rec.pending_task_id.with_context(copy_project=True).sudo().copy(
                    rec._create_next_occurrence_values(rec.pending_task_id)
                )
                rec.pending_task_id = False
                rec.next_recurrence_datetime = False
