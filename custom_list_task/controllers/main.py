# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request


class CustomTaskListController(http.Controller):

    @http.route('/custom_list_task/get_data', type='json', auth='user')
    def get_task_list_data(self, filters=None, **kw):
        return request.env['project.task'].get_custom_list_task_data(filters=filters)

    @http.route('/custom_list_task/toggle_priority', type='json', auth='user')
    def toggle_priority(self, task_id, **kw):
        return request.env['project.task'].toggle_task_priority(task_id)

    @http.route('/custom_list_task/add_assignee', type='json', auth='user')
    def add_assignee(self, task_id, user_id, **kw):
        return request.env['project.task'].quick_add_assignee(task_id, user_id)
