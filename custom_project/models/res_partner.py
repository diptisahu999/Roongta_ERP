from odoo import models
from odoo.exceptions import UserError


class ResPartner(models.Model):
    _inherit = 'res.partner'

    def action_delete_customer(self):
        """Delete this customer record from the list view button."""
        for partner in self:
            if partner.project_ids or self.env['project.task'].search([('partner_id', '=', partner.id)], limit=1):
                raise UserError(
                    f'Cannot delete "{partner.name}" because they are linked to projects or tasks. '
                    'Please remove the reference first.'
                )
        self.unlink()
        return {'type': 'ir.actions.act_window_close'}
