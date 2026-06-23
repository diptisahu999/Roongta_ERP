from odoo import models


class HrDepartment(models.Model):
    _inherit = 'hr.department'

    def action_delete_department(self):
        """Force delete the department, auto-unassigning any employees and child departments."""
        self.ensure_one()

        # Unassign all employees from this department
        employees = self.env['hr.employee'].search([('department_id', '=', self.id)])
        if employees:
            employees.write({'department_id': False})

        # Detach any child departments so they don't get cascade-blocked
        child_depts = self.env['hr.department'].search([('parent_id', '=', self.id)])
        if child_depts:
            child_depts.write({'parent_id': False})

        self.unlink()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Departments',
            'res_model': 'hr.department',
            'view_mode': 'list,form,kanban',
            'target': 'current',
        }
