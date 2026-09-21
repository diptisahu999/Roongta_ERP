# -*- coding: utf-8 -*-
{
    'name': 'Custom Meeting Calendar',
    'version': '1.0',
    'category': 'Productivity',
    'summary': 'Custom Meeting Calendar with Admin vs Managers & Users 2-Color Categorization & Completion Dimming',
    'description': 'Custom Meeting Calendar with Admin vs Managers & Users 2-Color categorization and completion dimming.',
    'author': 'Techvizor',
    'depends': ['base', 'web', 'calendar', 'hr'],
    'data': [
        'views/calendar_views.xml',
        'views/menu_override.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_calendar/static/src/css/custom_calendar.css',
            'custom_calendar/static/src/components/meeting_calendar.js',
            'custom_calendar/static/src/components/meeting_calendar_action.js',
        ],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
