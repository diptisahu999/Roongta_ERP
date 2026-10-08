# -*- coding: utf-8 -*-
{
    'name': 'Custom AI Agent (Claude Powered)',
    'version': '18.0.1.0.0',
    'category': 'Productivity/AI',
    'summary': 'Dedicated Claude AI Agent Workspace with Real-Time Odoo Context & Data Actions',
    'description': """
Custom AI Agent Bot powered by Claude API:
- Full-page dedicated AI Agent Workspace with modern UI/UX
- Real-time Odoo context tools (Query tasks, create tasks, project overviews, customer directory, employee lookup)
- Multi-session chat management (Search, pin, rename, archive, token tracking)
- Configurable Claude endpoints and model selection (Sonnet, Haiku, Opus)
- Markdown rendering, code highlighting, copy actions, and quick prompt chips
    """,
    'author': 'Roongta ERP',
    'depends': ['base', 'web', 'project', 'mail', 'muk_web_appsbar'],
    'data': [
        'security/ir.model.access.csv',
        'views/ai_agent_views.xml',
        'views/res_config_settings_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_ai_agent/static/src/css/ai_agent_workspace.css',
            'custom_ai_agent/static/src/components/ai_agent_workspace.js',
            'custom_ai_agent/static/src/components/ai_agent_workspace.xml',
        ],
    },
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
