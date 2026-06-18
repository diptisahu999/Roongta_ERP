from odoo import models, api

class HideMenus(models.AbstractModel):
    _name = 'hide.menus'

    @api.model
    def hide_link_tracker_menu(self):
        menus = self.env['ir.ui.menu'].search([
            '|',
            ('name', 'ilike', 'Link Tracker'),
            ('name', 'ilike', 'Link Preview')
        ])
        menus.write({'active': False})