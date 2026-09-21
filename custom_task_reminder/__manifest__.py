# -*- coding: utf-8 -*-
{
    'name': 'Custom Task Reminder',
    'version': '1.0',
    'category': 'Project',
    'summary': 'Send custom task reminder messages to assigned users with interactive popup',
    'description': """
Custom Task Reminder Module
===========================
- Task-wise reminder button
- Interactive reminder composition popup dialog
- Quick message presets (Deadline, Overdue, Status update, Urgent)
- Multi-assignee selection & direct Discuss chat notification
- Automatic logging in Task Chatter
    """,
    'author': 'Roongta ERP',
    'depends': ['base', 'web', 'project', 'mail', 'push_notification_system'],
    'data': [
        'security/ir.model.access.csv',
        'views/task_reminder_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_task_reminder/static/src/css/task_reminder_modal.css',
            'custom_task_reminder/static/src/components/task_reminder_modal.js',
            'custom_task_reminder/static/src/components/task_reminder_modal.xml',
            'custom_task_reminder/static/src/js/chatter_patch.js',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
