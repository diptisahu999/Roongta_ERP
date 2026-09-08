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

        firm_ids = tuple(self.ids)
        if not firm_ids:
            return

        # Direct SQL aggregation: computes counts and last update in ~10ms across all tasks
        # without loading thousands of task records into Python memory
        self.env.cr.execute('''
            SELECT 
                r.firm_id,
                COUNT(DISTINCT t.id) as total,
                COUNT(DISTINCT CASE WHEN t.state = '1_done' OR LOWER(s.name::text) LIKE '%%done%%' OR LOWER(s.name::text) LIKE '%%completed%%' THEN t.id END) as done,
                COUNT(DISTINCT CASE WHEN t.state = '04_waiting_normal' OR LOWER(s.name::text) LIKE '%%hold%%' OR LOWER(s.name::text) LIKE '%%blocked%%' THEN t.id END) as hold,
                COUNT(DISTINCT CASE WHEN t.state NOT IN ('1_done', '1_canceled') AND LOWER(s.name::text) NOT LIKE '%%done%%' AND LOWER(s.name::text) NOT LIKE '%%completed%%' AND t.date_deadline < CURRENT_DATE THEN t.id END) as due,
                MAX(COALESCE(t.date_last_stage_update, t.write_date)) as last_update
            FROM project_firm_tag_rel r
            JOIN project_tags_project_task_rel tr ON tr.project_tags_id = r.tag_id
            JOIN project_task t ON t.id = tr.project_task_id
            LEFT JOIN project_task_type s ON s.id = t.stage_id
            WHERE r.firm_id IN %s AND t.active = TRUE
            GROUP BY r.firm_id
        ''', [firm_ids])
        metric_map = {row['firm_id']: row for row in self.env.cr.dictfetchall()}

        # Limit team members to top 5 active assignees per firm in ~15ms
        # Prevents loading 38+ avatars per card which causes massive filestore attachment I/O and freezes UI
        self.env.cr.execute('''
            SELECT firm_id, user_id
            FROM (
                SELECT 
                    r.firm_id,
                    tu.user_id,
                    ROW_NUMBER() OVER(PARTITION BY r.firm_id ORDER BY COUNT(t.id) DESC) as rn
                FROM project_firm_tag_rel r
                JOIN project_tags_project_task_rel tr ON tr.project_tags_id = r.tag_id
                JOIN project_task t ON t.id = tr.project_task_id
                JOIN project_task_user_rel tu ON tu.task_id = t.id
                WHERE r.firm_id IN %s AND t.active = TRUE AND tu.user_id != 1
                GROUP BY r.firm_id, tu.user_id
            ) sub
            WHERE rn <= 5
        ''', [firm_ids])
        users_map = {}
        for f_id, u_id in self.env.cr.fetchall():
            users_map.setdefault(f_id, []).append(u_id)

        for firm in self:
            m = metric_map.get(firm.id)
            if not m or not firm.tag_ids:
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

            total_cnt = m.get('total', 0)
            done_cnt = m.get('done', 0)
            hold_cnt = m.get('hold', 0)
            due_cnt = m.get('due', 0)
            pending_cnt = max(0, total_cnt - done_cnt - hold_cnt - due_cnt)

            firm.task_count_total = total_cnt
            firm.task_count_done = done_cnt
            firm.task_count_pending = pending_cnt
            firm.task_count_due = due_cnt
            firm.task_count_hold = hold_cnt
            firm.team_user_ids = [(6, 0, users_map.get(firm.id, []))]

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

            max_date = m.get('last_update')
            if max_date:
                if isinstance(max_date, str):
                    d_obj = max_date[:10]
                else:
                    d_obj = max_date.strftime('%Y-%m-%d')

                if d_obj == today_str:
                    firm.last_update_str = "Last Update Today"
                else:
                    try:
                        d_parsed = datetime.strptime(d_obj, '%Y-%m-%d').date() if isinstance(d_obj, str) else d_obj
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



