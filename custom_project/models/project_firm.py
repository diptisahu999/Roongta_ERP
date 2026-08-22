from odoo import models, fields, api
from datetime import date, datetime

class ProjectFirm(models.Model):
    _name = 'project.firm'
    _description = 'Project Department'
    _order = 'name'

    name = fields.Char(string='Department Name', required=True)
    tag_ids = fields.Many2many(
        'project.tags',
        'project_firm_tag_rel',
        'firm_id',
        'tag_id',
        string='Associated Tags'
    )

    task_count_total = fields.Integer(string='Total Tasks', compute='_compute_firm_metrics')
    task_count_done = fields.Integer(string='Done Tasks', compute='_compute_firm_metrics')
    task_count_pending = fields.Integer(string='Pending Tasks', compute='_compute_firm_metrics')
    task_count_due = fields.Integer(string='Due Tasks', compute='_compute_firm_metrics')
    task_count_hold = fields.Integer(string='Hold Tasks', compute='_compute_firm_metrics')

    last_update_str = fields.Char(string='Last Update', compute='_compute_firm_metrics')
    team_user_ids = fields.Many2many('res.users', string='Team Members', compute='_compute_firm_metrics')

    progress_percentage = fields.Integer(string='Progress (%)', compute='_compute_firm_metrics')
    done_dasharray = fields.Char(compute='_compute_firm_metrics')
    pending_dasharray = fields.Char(compute='_compute_firm_metrics')
    pending_dashoffset = fields.Char(compute='_compute_firm_metrics')
    due_dasharray = fields.Char(compute='_compute_firm_metrics')
    due_dashoffset = fields.Char(compute='_compute_firm_metrics')

    @api.depends('tag_ids')
    def _compute_firm_metrics(self):
        today_date = date.today()
        domain = []
        # Odoo's native record rules will automatically restrict the search() to tasks the user is allowed to see.
        all_tasks = self.env['project.task'].search(domain)

        for firm in self:
            firm_tags = firm.tag_ids
            if not firm_tags:
                firm.task_count_total = 0
                firm.task_count_done = 0
                firm.task_count_pending = 0
                firm.task_count_due = 0
                firm.task_count_hold = 0
                firm.last_update_str = "Last Update Today"
                firm.team_user_ids = [(6, 0, [])]
                firm.progress_percentage = 0
                firm.done_dasharray = "0 100"
                firm.pending_dasharray = "0 100"
                firm.pending_dashoffset = "0"
                firm.due_dasharray = "0 100"
                firm.due_dashoffset = "0"
                continue

            tag_ids_set = set(firm_tags.ids)

            # Filter tasks matching any tag in firm_tags (either directly on task, or on task's project if task has no tags)
            matching_tasks = all_tasks.filtered(
                lambda t: bool(set(t.tag_ids.ids) & tag_ids_set) if t.tag_ids else bool(t.project_id and 'tag_ids' in t.project_id._fields and set(t.project_id.tag_ids.ids) & tag_ids_set)
            )

            total_cnt = len(matching_tasks)

            # Done check
            done_tasks = matching_tasks.filtered(
                lambda t: t.state == '1_done' or (t.stage_id and t.stage_id.name and t.stage_id.name.lower() in ['done', 'completed'])
            )
            done_cnt = len(done_tasks)

            # Hold check
            hold_tasks = matching_tasks.filtered(
                lambda t: t.state == '04_waiting_normal' or (t.stage_id and t.stage_id.name and t.stage_id.name.lower() in ['hold', 'on hold', 'on_hold', 'blocked'])
            )
            hold_cnt = len(hold_tasks)

            # Overdue check
            due_tasks = matching_tasks.filtered(
                lambda t: t.state != '1_done' and t.state != '1_canceled' and not (t.stage_id and t.stage_id.name and t.stage_id.name.lower() in ['done', 'completed']) and t.date_deadline and (t.date_deadline.date() if isinstance(t.date_deadline, datetime) else t.date_deadline) < today_date
            )
            due_cnt = len(due_tasks)

            pending_cnt = max(0, total_cnt - done_cnt - hold_cnt - due_cnt)

            firm.task_count_total = total_cnt
            firm.task_count_done = done_cnt
            firm.task_count_pending = pending_cnt
            firm.task_count_due = due_cnt
            firm.task_count_hold = hold_cnt

            # Team members
            team_users = matching_tasks.mapped('user_ids').filtered(lambda u: u.id != 1)
            firm.team_user_ids = [(6, 0, team_users.ids)]

            # Progress & Donut geometry
            if total_cnt > 0:
                prog_pct = round((done_cnt / total_cnt) * 100)
                done_pct = round((done_cnt / total_cnt) * 100)
                pending_pct = round((pending_cnt / total_cnt) * 100)
                due_pct = round((due_cnt / total_cnt) * 100)
            else:
                prog_pct = 0
                done_pct = 0
                pending_pct = 0
                due_pct = 0

            firm.progress_percentage = prog_pct
            firm.done_dasharray = f"{done_pct} 100"
            firm.pending_dasharray = f"{pending_pct} 100"
            firm.pending_dashoffset = f"-{done_pct}"
            firm.due_dasharray = f"{due_pct} 100"
            firm.due_dashoffset = f"-{done_pct + pending_pct}"

            # Last update string calculation
            human_tasks = matching_tasks.filtered(lambda tk: tk.write_uid and tk.write_uid.id != 1)
            target_tasks = human_tasks if human_tasks else matching_tasks
            dates = []
            for tk in target_tasks:
                if hasattr(tk, 'date_last_stage_update') and tk.date_last_stage_update:
                    dt = tk.date_last_stage_update.date() if hasattr(tk.date_last_stage_update, 'date') else tk.date_last_stage_update
                    dates.append(dt)
                elif tk.write_date:
                    dt = tk.write_date.date() if hasattr(tk.write_date, 'date') else tk.write_date
                    dates.append(dt)

            if dates:
                max_date = max(dates)
                if max_date == today_date:
                    firm.last_update_str = "Last Update Today"
                else:
                    firm.last_update_str = f"Last Update {max_date.strftime('%d %b %Y')}"
            else:
                firm.last_update_str = "Last Update Today"

    def action_open_department_dashboard(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.client',
            'tag': 'department_dashboard_action',
            'name': f'{self.name} - Department Dashboard',
            'target': 'current',
            'context': {
                'default_level': 2,
                'default_firm_id': self.id,
                'default_tag_name': self.name,
            },
            'params': {
                'level': 2,
                'firm_id': self.id,
                'tag_name': self.name,
            }
        }



