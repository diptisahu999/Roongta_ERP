{
    'name': 'Custom Overdue Task Notifier',
    'version': '18.0.1.0.0',
    'summary': 'Sends web notifications to users for all overdue project tasks via a daily scheduled action.',
    'author': 'Roongta Developers',
    'category': 'Project',
    'depends': ['project', 'push_notification_system', 'bus'],
    'data': [
        'data/cron.xml',
    ],
    'application': False,
    'installable': True,
    'auto_install': False,
}
