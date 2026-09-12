# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request

class CustomTaskCreateController(http.Controller):

    @http.route('/custom_taskcreate/init_data', type='json', auth='user')
    def get_init_data(self):
        return request.env['custom.taskcreate'].get_init_data()

    @http.route('/custom_taskcreate/get_stages', type='json', auth='user')
    def get_stages(self, project_id=None):
        return request.env['custom.taskcreate'].get_project_stages(project_id=project_id)

    @http.route('/custom_taskcreate/create_task', type='json', auth='user')
    def create_task(self, **vals):
        return request.env['custom.taskcreate'].create_task_from_modal(vals)
