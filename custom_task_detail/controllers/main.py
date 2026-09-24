# -*- coding: utf-8 -*-
import base64
import json
from odoo import http
from odoo.http import request


class TaskDetailController(http.Controller):

    @http.route('/custom_task_detail/get_data', type='json', auth='user')
    def get_task_detail_data(self, task_id, **kw):
        return request.env['project.task'].get_custom_task_detail(task_id)

    @http.route('/custom_task_detail/upload_attachment', type='http', auth='user', methods=['POST'], csrf=False)
    def upload_attachment(self, task_id, ufile, **kw):
        try:
            if not task_id or not ufile:
                return request.make_response(json.dumps({'error': 'Missing parameters'}), headers=[('Content-Type', 'application/json')])

            file_content = ufile.read()
            filename = ufile.filename

            attachment = request.env['ir.attachment'].sudo().create({
                'name': filename,
                'datas': base64.b64encode(file_content),
                'res_model': 'project.task',
                'res_id': int(task_id),
                'mimetype': ufile.content_type,
            })

            return request.make_response(json.dumps({
                'success': True,
                'attachment_id': attachment.id,
                'name': attachment.name,
            }), headers=[('Content-Type', 'application/json')])
        except Exception as e:
            return request.make_response(json.dumps({'error': str(e)}), headers=[('Content-Type', 'application/json')])
