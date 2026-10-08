# -*- coding: utf-8 -*-
from odoo import fields, models

class AiAgentMessage(models.Model):
    _name = 'ai.agent.message'
    _description = 'AI Agent Chat Message'
    _order = 'create_date asc'

    session_id = fields.Many2one('ai.agent.session', string="Session", required=True, ondelete='cascade', index=True)
    role = fields.Selection([
        ('user', 'User'),
        ('assistant', 'Assistant (Claude)'),
        ('system', 'System')
    ], string="Role", required=True, default='user')
    content = fields.Text(string="Content", required=True)
    tool_calls = fields.Json(string="Tool Calls / Actions", default=list)
    prompt_tokens = fields.Integer(string="Prompt Tokens", default=0)
    completion_tokens = fields.Integer(string="Completion Tokens", default=0)
