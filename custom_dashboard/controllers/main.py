# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request

class CustomDashboardController(http.Controller):
    
    @http.route('/custom_dashboard/data', type='json', auth='user')
    def get_dashboard_data(self):
        return request.env['custom.dashboard'].get_dashboard_data()
