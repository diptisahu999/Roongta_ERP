# -*- coding: utf-8 -*-
# pyrefly: ignore [missing-import]
from odoo import models, fields, api, _
# pyrefly: ignore [missing-import]
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)

class CustomSubtask(models.TransientModel):
    _name = 'custom_subtask'
    _description = 'Custom Subtask Confirmation Wizard'

    task_id = fields.Many2one('project.task', string='Parent Task', required=True, readonly=True)
    subtask_line_ids = fields.One2many(
        'custom_subtask_line',
        'wizard_id',
        string='Incomplete Sub-tasks'
    )
    subtask_count = fields.Integer(string='Pending Count', compute='_compute_subtask_count')
    subtask_badge_label = fields.Char(string='Pending Badge', compute='_compute_subtask_badge_label')
    message = fields.Html(string='Message', compute='_compute_message')
    target_state = fields.Char(string='Target State', default='1_done')
    target_stage_id = fields.Many2one('project.task.type', string='Target Stage')
    target_progress = fields.Char(string='Target Progress', default='100')

    @api.model
    def default_get(self, fields_list):
        defaults = super(CustomSubtask, self).default_get(fields_list)
        task_id = defaults.get('task_id') or self.env.context.get('default_task_id')
        if task_id and 'subtask_line_ids' in fields_list:
            task = self.env['project.task'].browse(task_id)
            if task.exists():
                lines = []
                for sub in task.get_open_subtasks():
                    st_name = sub.stage_id.name if sub.stage_id else (sub.state or 'In Progress')
                    lines.append((0, 0, {
                        'subtask_id': sub.id,
                        'name': sub.name,
                        'user_ids': [(6, 0, sub.user_ids.ids)],
                        'date_deadline': sub.date_deadline,
                        'current_stage': st_name,
                        'mark_done': True,
                    }))
                defaults['subtask_line_ids'] = lines
        return defaults

    @api.depends('subtask_line_ids')
    def _compute_subtask_count(self):
        for rec in self:
            rec.subtask_count = len(rec.subtask_line_ids)

    @api.depends('subtask_line_ids')
    def _compute_subtask_badge_label(self):
        for rec in self:
            rec.subtask_badge_label = f"{len(rec.subtask_line_ids)} Pending"

    @api.depends('task_id', 'subtask_count')
    def _compute_message(self):
        for rec in self:
            count = rec.subtask_count
            task_name = rec.task_id.name if rec.task_id else 'this task'
            rec.message = f"""
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: #dcfce7; color: #15803d; font-size: 18px; flex-shrink: 0;">
                            <i class="fa fa-tasks"></i>
                        </span>
                        <div>
                            <h6 style="margin: 0; color: #166534; font-weight: 700; font-size: 0.95rem;">Sub-tasks Confirmation</h6>
                            <p style="margin: 3px 0 0 0; color: #15803d; font-size: 0.875rem; line-height: 1.4;">
                                Task <strong>"{task_name}"</strong> has <strong>{count}</strong> unfinished sub-task(s).
                                Toggle the sub-tasks below to mark them as <strong>Done</strong> directly, or proceed without closing them.
                            </p>
                        </div>
                    </div>
                </div>
            """

    def action_confirm_selection(self):
        """Mark selected subtasks as Done and complete the parent task."""
        self.ensure_one()
        closed_subs = []
        for line in self.subtask_line_ids:
            if line.mark_done and line.subtask_id:
                sub = line.subtask_id
                sub_vals = {
                    'state': '1_done',
                    'task_progress': '100',
                }
                done_stage = self.env['project.task.type'].search([
                    ('project_ids', 'in', [sub.project_id.id] if sub.project_id else []),
                    '|', ('name', 'ilike', 'done'), ('name', 'ilike', 'completed')
                ], limit=1)
                if done_stage:
                    sub_vals['stage_id'] = done_stage.id
                sub.with_context(skip_subtask_check=True).write(sub_vals)
                closed_subs.append(sub.name)

        # Complete parent task
        vals = {
            'state': self.target_state or '1_done',
            'task_progress': self.target_progress or '100',
        }
        if self.target_stage_id:
            vals['stage_id'] = self.target_stage_id.id
        else:
            done_stage = self.env['project.task.type'].search([
                ('project_ids', 'in', [self.task_id.project_id.id] if self.task_id.project_id else []),
                '|', ('name', 'ilike', 'done'), ('name', 'ilike', 'completed')
            ], limit=1)
            if done_stage:
                vals['stage_id'] = done_stage.id

        self.task_id.with_context(skip_subtask_check=True).write(vals)

        # Chatter audit log
        if hasattr(self.task_id, 'message_post'):
            if closed_subs:
                self.task_id.message_post(
                    body=_(
                        "<b>Task marked as Done</b>.<br/>Sub-task(s) marked as Done directly from confirmation popup: <i>%s</i>"
                    ) % ", ".join(closed_subs),
                    subtype_xmlid='mail.mt_note'
                )
            else:
                self.task_id.message_post(
                    body=_("<b>Task marked as Done</b> with sub-tasks left open via confirmation popup."),
                    subtype_xmlid='mail.mt_note'
                )
        return {'type': 'ir.actions.act_window_close'}

    def action_select_all(self):
        """Quick action to select all subtasks in the wizard."""
        self.ensure_one()
        self.subtask_line_ids.write({'mark_done': True})
        return self.env['project.task']._get_subtask_wizard_action(self)

    def action_deselect_all(self):
        """Quick action to deselect all subtasks in the wizard."""
        self.ensure_one()
        self.subtask_line_ids.write({'mark_done': False})
        return self.env['project.task']._get_subtask_wizard_action(self)

    def action_confirm_done(self):
        """Mark parent task as Done without altering any subtasks."""
        self.ensure_one()
        vals = {
            'state': self.target_state or '1_done',
            'task_progress': self.target_progress or '100',
        }
        if self.target_stage_id:
            vals['stage_id'] = self.target_stage_id.id
        else:
            done_stage = self.env['project.task.type'].search([
                ('project_ids', 'in', [self.task_id.project_id.id] if self.task_id.project_id else []),
                '|', ('name', 'ilike', 'done'), ('name', 'ilike', 'completed')
            ], limit=1)
            if done_stage:
                vals['stage_id'] = done_stage.id

        self.task_id.with_context(skip_subtask_check=True).write(vals)
        if hasattr(self.task_id, 'message_post'):
            self.task_id.message_post(
                body=_("<b>Task marked as Done</b> via confirmation popup (sub-tasks left open)."),
                subtype_xmlid='mail.mt_note'
            )
        return {'type': 'ir.actions.act_window_close'}

    def action_cancel(self):
        """Dismiss the wizard without making changes."""
        return {'type': 'ir.actions.act_window_close'}


class CustomSubtaskLine(models.TransientModel):
    _name = 'custom_subtask_line'
    _description = 'Custom Subtask Confirmation Line'

    wizard_id = fields.Many2one('custom_subtask', string='Wizard', ondelete='cascade')
    subtask_id = fields.Many2one('project.task', string='Sub-task', required=True, readonly=True)
    name = fields.Char(string='Sub-task Title', readonly=True)
    user_ids = fields.Many2many('res.users', string='Assignees', readonly=True)
    date_deadline = fields.Date(string='Deadline', readonly=True)
    current_stage = fields.Char(string='Current Status', readonly=True)
    mark_done = fields.Boolean(string='Mark as Done', default=True)
