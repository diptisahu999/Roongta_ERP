# -*- coding: utf-8 -*-
from odoo import fields, models, api

class AiAgentSession(models.Model):
    _name = 'ai.agent.session'
    _description = 'AI Agent Chat Session'
    _order = 'is_pinned desc, write_date desc'

    name = fields.Char(string="Title", default="New Conversation", required=True)
    user_id = fields.Many2one('res.users', string="User", default=lambda self: self.env.user, required=True, ondelete='cascade', index=True)
    model = fields.Char(string="AI Model", default=lambda self: self._get_default_model())
    system_prompt = fields.Text(string="System Prompt", default=lambda self: self._get_default_system_prompt())
    message_ids = fields.One2many('ai.agent.message', 'session_id', string="Messages", copy=True)
    is_pinned = fields.Boolean(string="Pinned", default=False)
    is_archived = fields.Boolean(string="Archived", default=False)
    total_tokens = fields.Integer(string="Total Tokens Used", default=0)

    @api.model
    def _get_default_model(self):
        return self.env['ir.config_parameter'].sudo().get_param('custom_ai_agent.default_model', 'claude-sonnet-5')

    @api.model
    def _get_default_system_prompt(self):
        default_prompt = self.env['ir.config_parameter'].sudo().get_param('custom_ai_agent.system_prompt', '')
        if not default_prompt:
            default_prompt = (
                "You are Roongta ERP AI Agent, a helpful, intelligent, and proactive AI assistant embedded directly inside Odoo 18.\n"
                "You have access to real-time Odoo data and actions through built-in context tools."
            )
        return default_prompt

    def get_serialized_data(self):
        self.ensure_one()
        messages = []
        for msg in self.message_ids.sorted('create_date'):
            messages.append({
                'id': msg.id,
                'role': msg.role,
                'content': msg.content,
                'tool_calls': msg.tool_calls,
                'created_at': fields.Datetime.to_string(msg.create_date),
            })
        return {
            'id': self.id,
            'name': self.name,
            'model': self.model,
            'is_pinned': self.is_pinned,
            'is_archived': self.is_archived,
            'total_tokens': self.total_tokens,
            'updated_at': fields.Datetime.to_string(self.write_date),
            'messages': messages,
        }
