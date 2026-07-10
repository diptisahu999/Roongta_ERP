# -*- coding: utf-8 -*-
import uuid
from odoo import models, fields, api

class ResUsers(models.Model):
    _inherit = 'res.users'

    api_token = fields.Char(string='API Token', copy=False, help="Token used for REST API authentication.")

    def generate_api_token(self):
        """Generate a new unique API token for the user."""
        for user in self:
            user.api_token = str(uuid.uuid4())
        return True
