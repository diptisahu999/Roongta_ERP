# -*- coding: utf-8 -*-
# pyrefly: ignore [missing-import]
from odoo import models, fields, api, _
# pyrefly: ignore [missing-import]
from odoo.exceptions import UserError, RedirectWarning
import logging

_logger = logging.getLogger(__name__)

class ProjectTask(models.Model):
    _inherit = 'project.task'

    def get_open_subtasks(self):
        """Returns all child tasks (subtasks) that are not yet in a completed/done state."""
        self.ensure_one()
        open_subtasks = self.env['project.task']
        for sub in self.child_ids:
            # 1. Closed state check
            if sub.state in ('1_done', '1_canceled'):
                continue
            if getattr(sub, 'is_closed', False):
                continue
            # 2. Progress 100 check
            if getattr(sub, 'task_progress', '') == '100' or getattr(sub, 'task_progress_rate', 0.0) >= 100.0:
                continue
            # 3. Stage name / closed flag check
            if sub.stage_id:
                if getattr(sub.stage_id, 'fold', False) or getattr(sub.stage_id, 'is_closed', False):
                    continue
                st_name = (sub.stage_id.name or '').strip().lower()
                if st_name in ('done', 'completed', 'task completed', 'task complete', 'work done', 'closed', 'finished'):
                    continue
            open_subtasks |= sub
        return open_subtasks

    def _get_subtask_wizard_action(self, wizard):
        """Helper to return a well-formed act_window dictionary for the subtask confirmation wizard."""
        view_id = self.env.ref('custom_subtask.view_custom_subtask_wizard_form', raise_if_not_found=False)
        view_id_val = view_id.id if view_id else False
        return {
            'name': _('Pending Sub-tasks Confirmation'),
            'type': 'ir.actions.act_window',
            'res_model': 'custom_subtask',
            'res_id': wizard.id,
            'view_mode': 'form',
            'views': [(view_id_val, 'form')],
            'target': 'new',
            'context': {
                'default_task_id': wizard.task_id.id,
                'dialog_size': 'large',
            },
        }

    def action_check_subtasks_and_done(self):
        """Action invoked by header button or kanban: checks open subtasks before completing."""
        self.ensure_one()
        open_subtasks = self.get_open_subtasks()
        if not open_subtasks:
            # No open subtasks, directly mark as done
            done_stage = self.env['project.task.type'].search([
                ('project_ids', 'in', [self.project_id.id] if self.project_id else []),
                '|', ('name', 'ilike', 'done'), ('name', 'ilike', 'completed')
            ], limit=1)
            vals = {
                'state': '1_done',
                'task_progress': '100',
            }
            if done_stage:
                vals['stage_id'] = done_stage.id
            self.with_context(skip_subtask_check=True).write(vals)
            return True

        # Open confirmation popup
        lines = []
        for sub in open_subtasks:
            st_name = sub.stage_id.name if sub.stage_id else (sub.state or 'In Progress')
            lines.append((0, 0, {
                'subtask_id': sub.id,
                'name': sub.name,
                'user_ids': [(6, 0, sub.user_ids.ids)],
                'date_deadline': sub.date_deadline,
                'current_stage': st_name,
                'mark_done': True,
            }))

        wizard = self.env['custom_subtask'].create({
            'task_id': self.id,
            'target_state': '1_done',
            'target_progress': '100',
            'subtask_line_ids': lines,
        })
        return self._get_subtask_wizard_action(wizard)

    @api.model
    def check_task_subtasks_status(self, task_id, target_state='1_done', target_progress='100', target_stage_id=None):
        """RPC helper for dashboards/frontends: returns wizard action if open subtasks exist."""
        task = self.browse(int(task_id))
        if not task.exists():
            return {'has_open_subtasks': False}

        # If checking a stage change, verify if target_stage_id is a closed/done stage
        if target_stage_id:
            try:
                target_stage_id = int(target_stage_id)
                stage = self.env['project.task.type'].browse(target_stage_id)
                if stage.exists():
                    st_name = (stage.name or '').strip().lower()
                    is_closing_stage = stage.fold or getattr(stage, 'is_closed', False) or st_name in ('done', 'completed', 'closed', 'finished')
                    if not is_closing_stage:
                        return {'has_open_subtasks': False}
            except (ValueError, TypeError):
                pass
        
        open_subtasks = task.get_open_subtasks()
        if not open_subtasks:
            return {'has_open_subtasks': False}

        lines = []
        for sub in open_subtasks:
            st_name = sub.stage_id.name if sub.stage_id else (sub.state or 'In Progress')
            lines.append((0, 0, {
                'subtask_id': sub.id,
                'name': sub.name,
                'user_ids': [(6, 0, sub.user_ids.ids)],
                'date_deadline': sub.date_deadline,
                'current_stage': st_name,
                'mark_done': True,
            }))

        wizard_vals = {
            'task_id': task.id,
            'target_state': target_state or '1_done',
            'target_progress': str(target_progress or '100'),
            'subtask_line_ids': lines,
        }
        if target_stage_id:
            try:
                wizard_vals['target_stage_id'] = int(target_stage_id)
            except (ValueError, TypeError):
                pass

        wizard = self.env['custom_subtask'].create(wizard_vals)
        return {
            'has_open_subtasks': True,
            'open_count': len(open_subtasks),
            'action': self._get_subtask_wizard_action(wizard),
        }

    def write(self, vals):
        if not self.env.context.get('skip_subtask_check'):
            is_marking_done = False
            if vals.get('state') == '1_done':
                is_marking_done = True
            elif vals.get('task_progress') == '100':
                is_marking_done = True
            elif vals.get('stage_id'):
                stage = self.env['project.task.type'].browse(vals['stage_id'])
                if stage.exists():
                    st_name = (stage.name or '').strip().lower()
                    if stage.fold or getattr(stage, 'is_closed', False) or st_name in ('done', 'completed', 'closed', 'finished'):
                        is_marking_done = True

            if is_marking_done:
                for task in self:
                    open_subs = task.get_open_subtasks()
                    if open_subs:
                        lines = []
                        for sub in open_subs:
                            st_name = sub.stage_id.name if sub.stage_id else (sub.state or 'In Progress')
                            lines.append((0, 0, {
                                'subtask_id': sub.id,
                                'name': sub.name,
                                'user_ids': [(6, 0, sub.user_ids.ids)],
                                'date_deadline': sub.date_deadline,
                                'current_stage': st_name,
                                'mark_done': True,
                            }))

                        wizard = self.env['custom_subtask'].create({
                            'task_id': task.id,
                            'target_state': vals.get('state') or '1_done',
                            'target_progress': vals.get('task_progress') or '100',
                            'target_stage_id': vals.get('stage_id') or False,
                            'subtask_line_ids': lines,
                        })
                        action = self._get_subtask_wizard_action(wizard)
                        raise RedirectWarning(
                            _("Task '%s' has %s incomplete sub-task(s).\nClick below to review and mark sub-tasks as Done.") % (task.name, len(open_subs)),
                            action,
                            _("Review & Mark Sub-tasks as Done")
                        )

        return super(ProjectTask, self).write(vals)
