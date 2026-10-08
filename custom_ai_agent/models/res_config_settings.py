# -*- coding: utf-8 -*-
from odoo import fields, models, api

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    anthropic_base_url = fields.Char(
        string="Anthropic Base URL",
        default="https://api-router.opustokens.workers.dev",
        config_parameter="custom_ai_agent.anthropic_base_url",
        help="Base URL for Anthropic Claude API router",
    )
    anthropic_api_key = fields.Char(
        string="Anthropic Auth Token / API Key",
        default="sk-hG6rK85ZD0oup3pl7yuFJXsnjgD6tcLX8LMJrpEKmVoIGcuY",
        config_parameter="custom_ai_agent.anthropic_api_key",
        help="API Key / Auth token for Anthropic API",
    )
    ai_agent_default_model = fields.Selection(
        selection=[
            ('claude-sonnet-5', 'Claude Sonnet 5 (Recommended)'),
            ('claude-haiku-4-5', 'Claude Haiku 4.5 (Fast)'),
            ('claude-opus-5', 'Claude Opus 5 (Deep Reasoning)'),
            ('claude-fable-5', 'Claude Fable 5'),
            ('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet (Direct)'),
            ('claude-3-7-sonnet-20250219', 'Claude 3.7 Sonnet (Direct)'),
        ],
        string="Default AI Model",
        default="claude-sonnet-5",
        config_parameter="custom_ai_agent.default_model",
        help="Default model used for new chat sessions",
    )
    ai_agent_system_prompt = fields.Text(
        string="Default System Prompt",
        default="""You are Roongta ERP AI Agent, a helpful, intelligent, and proactive AI assistant embedded directly inside Odoo 18.
You have access to real-time Odoo data and actions through built-in context tools.

Guidelines:
1. Always be concise, polite, professional, and clear.
2. When answering questions regarding tasks, projects, contacts, or metrics, format data neatly in markdown tables or bulleted lists.
3. Proactively offer to execute relevant Odoo actions (e.g. creating tasks, updating status, querying details) when appropriate.
4. When creating tasks or performing actions, confirm the parameters clearly before/after execution.
5. If you provide code snippets, specify the language for proper syntax highlighting.""",
        config_parameter="custom_ai_agent.system_prompt",
        help="System instructions sent to Claude for context and personality",
    )
    ai_agent_max_tokens = fields.Integer(
        string="Max Output Tokens",
        default=4096,
        config_parameter="custom_ai_agent.max_tokens",
    )
    ai_agent_temperature = fields.Float(
        string="Temperature",
        default=0.7,
        config_parameter="custom_ai_agent.temperature",
    )
