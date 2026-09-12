# -*- coding: utf-8 -*-
{
    'name': 'Custom Task Create',
    'version': '1.0',
    'category': 'Project',
    'summary': 'Interactive Modern Task Creation Modal with Live Overview & Sub-tasks',
    'description': """
Custom Task Create Module
=========================
- Scope-based Task Scheduling (Inbox, Today, This Week, This Month, Later)
- Live Reactive Task Overview Card Preview
- Single Tag Selection with Color Indicator and Assignee Multi-selection
- Rich Text Description Editor with Markdown shortcuts
- Sub-tasks Checklist Creator
- Smooth Modern UI with animations
    """,
    'author': 'Roongta ERP',
    'depends': ['base', 'web', 'project', 'hr'],
    'data': [
        'views/views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_taskcreate/static/src/css/task_create_modal.css',
            'custom_taskcreate/static/src/components/task_create_modal.js',
            'custom_taskcreate/static/src/components/task_create_modal.xml',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
