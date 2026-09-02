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
        today_str = today_date.strftime('%Y-%m-%d')

        # Fast single search_read query for all task fields needed
        task_data = self.env['project.task'].search_read(
            [],
            ['id', 'tag_ids', 'project_id', 'state', 'stage_id', 'date_deadline', 'write_date', 'date_last_stage_update', 'user_ids', 'write_uid']
        )

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

            matching_tasks = []
            for t in task_data:
                t_tags = set(t.get('tag_ids') or [])
                if t_tags & tag_ids_set:
                    matching_tasks.append(t)

            total_cnt = len(matching_tasks)
            done_cnt = 0
            hold_cnt = 0
            due_cnt = 0
            user_ids_set = set()
            max_date = None

            for t in matching_tasks:
                state = t.get('state') or ''
                stage_name = (t.get('stage_id') and t['stage_id'][1] or '').lower()
                deadline = t.get('date_deadline')
                is_done = state == '1_done' or stage_name in ['done', 'completed']
                is_hold = state == '04_waiting_normal' or stage_name in ['hold', 'on hold', 'on_hold', 'blocked']

                if is_done:
                    done_cnt += 1
                elif is_hold:
                    hold_cnt += 1
                elif deadline and str(deadline)[:10] < today_str and state != '1_canceled':
                    due_cnt += 1

                for uid in (t.get('user_ids') or []):
                    if uid != 1:
                        user_ids_set.add(uid)

                dt_str = t.get('date_last_stage_update') or t.get('write_date')
                if dt_str:
                    d_obj = str(dt_str)[:10]
                    if not max_date or d_obj > max_date:
                        max_date = d_obj

            pending_cnt = max(0, total_cnt - done_cnt - hold_cnt - due_cnt)

            firm.task_count_total = total_cnt
            firm.task_count_done = done_cnt
            firm.task_count_pending = pending_cnt
            firm.task_count_due = due_cnt
            firm.task_count_hold = hold_cnt
            firm.team_user_ids = [(6, 0, list(user_ids_set))]

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

            if max_date:
                if max_date == today_str:
                    firm.last_update_str = "Last Update Today"
                else:
                    try:
                        d_parsed = datetime.strptime(max_date, '%Y-%m-%d').date()
                        firm.last_update_str = f"Last Update {d_parsed.strftime('%d %b %Y')}"
                    except Exception:
                        firm.last_update_str = "Last Update Today"
            else:
                firm.last_update_str = "Last Update Today"

    def action_open_department_dashboard(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.client',
            'tag': 'department_dashboard_action',
            'name': f'{self.name} - Project List',
            'target': 'current',
            'context': {
                'default_level': 1,
                'default_firm_id': self.id,
            },
            'params': {
                'level': 1,
                'firm_id': self.id,
            }
        }



